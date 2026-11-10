"""TALKREADY AI real-time voice WebSocket router."""

import asyncio
import base64
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai

load_dotenv(Path(__file__).with_name(".env"))

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live")

SCENARIOS = {
    "Job Interview",
    "Self-Introduction",
    "Everyday Conversation",
    "Group Discussion",
    "Meeting New People",
}

DIFFICULTIES = {"Beginner", "Intermediate", "Advanced"}
VOICES = {"Aoede", "Charon", "Fenrir", "Kore", "Puck"}

MAX_RESUME_CONTEXT_CHARS = 6000
MAX_AUDIO_FRAME_BYTES = 256 * 1024
INITIAL_RESPONSE_TIMEOUT = 12


def _system_instruction(scenario: str, difficulty: str, resume_context: str) -> str:
    level = {
        "Beginner": "Use short, clear sentences and common vocabulary. Speak patiently and ask one question at a time.",
        "Intermediate": "Use natural professional English, ask useful follow-up questions, and gently coach clarity.",
        "Advanced": "Use nuanced professional English and realistic, challenging follow-up questions.",
    }[difficulty]
    resume = f" Learner background for relevant personalization: {resume_context}" if resume_context.strip() else ""
    return (
        "You are TalkReady AI, a warm, patient English speaking coach using clear, Indian-friendly English. "
        "Keep spoken responses concise and interactive. Ask one question at a time and allow the learner to answer. "
        "Correct important English mistakes gently without interrupting every sentence. Do not invent qualifications "
        "or projects. Do not read markdown or long lists aloud. "
        f"Scenario: {scenario}. Difficulty: {difficulty}. Guidance: {level} "
        "When relevant, personalize questions to the learner's background while also including general career, IT, "
        "and everyday communication practice. Continue asking relevant follow-up questions during the practice session. "
        "ENDING RULES: A plain 'thank you' is not a request to end the call. If the learner says they are not interested, "
        "do not want to continue, are done, need to leave, or says goodbye, treat that as the end of the practice. "
        "Respond with at most ONE short, polite final farewell and no question. Do not invite another response, "
        "do not repeat a goodbye, and do not continue the conversation after the farewell. "
        "If the learner only says thank you without an ending request, continue the practice normally."
        + resume
    )


def _normalize_text(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9'\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _clearly_wants_to_end(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False

    exact_phrases = {
        "bye", "goodbye", "bye bye", "goodbye take care",
        "that's all", "that is all", "i'm done", "i am done",
        "i need to finish", "i want to finish", "end the call",
        "end call", "please end the call", "you can end the call",
        "hang up", "stop the call", "finish the call", "let's end",
        "lets end", "i have to go", "got to go", "that's it",
        "that is it", "we can stop here", "let's stop here",
        "lets stop here", "i am not interested", "i'm not interested",
        "not interested now", "i don't want to continue",
        "i do not want to continue", "i want to stop",
        "i would like to stop", "i am ready to stop",
        "i think we should stop",
    }
    if normalized in exact_phrases:
        return True

    patterns = (
        r"\b(end|stop|finish|hang up|close)\b.{0,30}\b(call|session|interview|this)\b",
        r"\b(call|session|interview)\b.{0,20}\b(over|finished|ended)\b",
        r"\b(bye|goodbye)\b",
        r"\b(i am done|i'm done|that's all|that is all|i have to go|got to go)\b",
        r"\b(not interested|don't want to continue|do not want to continue)\b",
        r"\b(rather not continue|don't want to do this|do not want to do this)\b",
        r"\b(i want to leave|i need to leave|i have to leave)\b",
        r"\b(we should stop|let's stop|lets stop|stop here)\b",
    )
    return any(re.search(pattern, normalized) for pattern in patterns)


@router.websocket("/api/conversation/live")
async def live_conversation(websocket: WebSocket) -> None:
    await websocket.accept()

    if not GEMINI_API_KEY:
        await websocket.send_json({
            "type": "error",
            "message": "GEMINI_API_KEY is not configured in the backend environment.",
        })
        await websocket.close(code=1011)
        return

    try:
        start = await asyncio.wait_for(websocket.receive_json(), timeout=20)
    except (asyncio.TimeoutError, ValueError):
        await websocket.send_json({"type": "error", "message": "Voice session setup timed out."})
        await websocket.close(code=1008)
        return
    except WebSocketDisconnect:
        return

    if not isinstance(start, dict) or start.get("type") != "start":
        await websocket.send_json({"type": "error", "message": "First message must have type=start."})
        await websocket.close(code=1008)
        return

    scenario = str(start.get("scenario", "Job Interview"))
    difficulty = str(start.get("difficulty", "Beginner"))
    voice = str(start.get("voice", "Kore"))
    resume_context = str(start.get("resume_context", ""))[:MAX_RESUME_CONTEXT_CHARS]

    if scenario not in SCENARIOS:
        await websocket.send_json({"type": "error", "message": "Invalid scenario."})
        await websocket.close(code=1008)
        return
    if difficulty not in DIFFICULTIES:
        await websocket.send_json({"type": "error", "message": "Invalid difficulty."})
        await websocket.close(code=1008)
        return
    if voice not in VOICES:
        await websocket.send_json({"type": "error", "message": "Unsupported voice selection."})
        await websocket.close(code=1008)
        return

    client = genai.Client(api_key=GEMINI_API_KEY)
    stop_event = asyncio.Event()
    ending_requested = asyncio.Event()
    learner_spoke = asyncio.Event()

    user_text_buffer = ""
    initial_greeting_complete = False
    no_response_call = False
    session_finished_sent = False

    try:
        config = {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": voice}
                }
            },
            "system_instruction": _system_instruction(scenario, difficulty, resume_context),
            "input_audio_transcription": {},
            "output_audio_transcription": {},
        }

        async with client.aio.live.connect(model=GEMINI_LIVE_MODEL, config=config) as session:
            await websocket.send_json({
                "type": "ready",
                "scenario": scenario,
                "difficulty": difficulty,
                "voice": voice,
                "input_sample_rate": 16000,
                "output_sample_rate": 24000,
            })

            await session.send_realtime_input(
                text=(
                    f"Start the {scenario} practice at {difficulty} level. "
                    "Greet the learner briefly and ask the first natural question aloud. "
                    "Then pause and listen for the learner's answer."
                )
            )

            async def request_final_goodbye():
                # The learner's original audio/text already tells Gemini why they are ending.
                # Do not send a second prompt: that can trigger a second goodbye turn.
                if not ending_requested.is_set() and not stop_event.is_set():
                    ending_requested.set()

            async def handle_initial_silence():
                nonlocal no_response_call
                try:
                    await asyncio.wait_for(learner_spoke.wait(), timeout=INITIAL_RESPONSE_TIMEOUT)
                    return
                except asyncio.TimeoutError:
                    pass

                if stop_event.is_set() or ending_requested.is_set():
                    return

                no_response_call = True
                ending_requested.set()
                try:
                    await session.send_realtime_input(
                        text=(
                            "The learner did not respond after your initial greeting. "
                            "Say this naturally and briefly: 'Could you hear me? Is my audio working? "
                            "I cannot hear your response. Better luck next time. Goodbye.' "
                            "Do not ask another question. This is your final response."
                        )
                    )
                except Exception as exc:
                    print(f"Initial silence handling failed: {type(exc).__name__}: {exc}")
                    stop_event.set()

            async def send_client_input():
                while not stop_event.is_set():
                    message = await websocket.receive_json()
                    if not isinstance(message, dict):
                        continue

                    kind = message.get("type")
                    if kind == "audio":
                        if ending_requested.is_set():
                            continue
                        encoded = message.get("data")
                        if not isinstance(encoded, str) or not encoded:
                            continue
                        try:
                            audio_bytes = base64.b64decode(encoded, validate=True)
                        except (ValueError, base64.binascii.Error):
                            await websocket.send_json({"type": "error", "message": "Invalid audio encoding."})
                            continue
                        if len(audio_bytes) > MAX_AUDIO_FRAME_BYTES:
                            await websocket.send_json({"type": "error", "message": "Audio frame is too large."})
                            continue
                        await session.send_realtime_input(
                            audio={"data": audio_bytes, "mime_type": "audio/pcm;rate=16000"}
                        )

                    elif kind == "text":
                        text = str(message.get("text", "")).strip()
                        if text and not ending_requested.is_set():
                            learner_spoke.set()
                            await session.send_realtime_input(text=text[:2000])
                            if _clearly_wants_to_end(text):
                                await request_final_goodbye()

                    elif kind == "end":
                        stop_event.set()
                        return

                    elif kind == "ping":
                        await websocket.send_json({"type": "pong"})

            async def handle_gemini_response(response):
                nonlocal user_text_buffer, initial_greeting_complete, session_finished_sent

                if stop_event.is_set() and session_finished_sent:
                    return

                server_content = getattr(response, "server_content", None)
                if server_content is None:
                    return

                incoming = getattr(server_content, "input_transcription", None)
                if incoming and getattr(incoming, "text", ""):
                    user_text = incoming.text.strip()
                    if user_text:
                        learner_spoke.set()
                        await websocket.send_json({
                            "type": "transcript",
                            "speaker": "user",
                            "text": user_text,
                        })
                        if not ending_requested.is_set():
                            user_text_buffer = (user_text_buffer + " " + user_text).strip()
                            if _clearly_wants_to_end(user_text_buffer):
                                user_text_buffer = ""
                                await request_final_goodbye()

                outgoing = getattr(server_content, "output_transcription", None)
                if outgoing and getattr(outgoing, "text", ""):
                    await websocket.send_json({
                        "type": "transcript",
                        "speaker": "assistant",
                        "text": outgoing.text,
                    })

                model_turn = getattr(server_content, "model_turn", None)
                parts = getattr(model_turn, "parts", None) or [] if model_turn else []
                for part in parts:
                    inline_data = getattr(part, "inline_data", None)
                    audio_data = getattr(inline_data, "data", None) if inline_data else None
                    if audio_data:
                        encoded_audio = (
                            audio_data if isinstance(audio_data, str)
                            else base64.b64encode(audio_data).decode("ascii")
                        )
                        await websocket.send_json({
                            "type": "audio",
                            "data": encoded_audio,
                            "sample_rate": 24000,
                        })

                if getattr(server_content, "interrupted", False):
                    await websocket.send_json({"type": "interrupted"})

                if getattr(server_content, "turn_complete", False):
                    await websocket.send_json({"type": "turn_complete"})

                    if not initial_greeting_complete:
                        initial_greeting_complete = True
                        asyncio.create_task(handle_initial_silence())

                    if ending_requested.is_set() and not session_finished_sent:
                        session_finished_sent = True
                        await websocket.send_json({
                            "type": "session_finished",
                            "reason": "no_response" if no_response_call else "completed",
                        })
                        stop_event.set()

                    user_text_buffer = ""

            async def send_gemini_output():
                while not stop_event.is_set():
                    received_any = False
                    async for response in session.receive():
                        received_any = True
                        if stop_event.is_set() and session_finished_sent:
                            return
                        await handle_gemini_response(response)
                        if stop_event.is_set() and session_finished_sent:
                            return
                    if stop_event.is_set():
                        return
                    if not received_any:
                        await asyncio.sleep(0.05)

            sender = asyncio.create_task(send_client_input())
            receiver = asyncio.create_task(send_gemini_output())
            done, pending = await asyncio.wait(
                {sender, receiver},
                return_when=asyncio.FIRST_COMPLETED,
            )
            stop_event.set()
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

            for task in done:
                try:
                    task.result()
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"Gemini Live voice error: {type(exc).__name__}: {exc}", flush=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": "Voice connection failed. Check Gemini Live model access and backend logs.",
            })
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
