import json
import os
import random
import tempfile
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# NEW: import the live voice router.
# Keep live_voice.py in the same backend folder as this main.py.
from backend.live_voice import router as live_voice_router


# --------------------------------------------------
# APPLICATION SETUP
# --------------------------------------------------

app = FastAPI(title="TalkReady AI API")

# NEW: register the WebSocket voice endpoint without replacing existing APIs.
app.include_router(live_voice_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Vite development origins
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        # Capacitor Android WebView origins
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ENVIRONMENT AND GEMINI CONFIGURATION
# --------------------------------------------------

load_dotenv(Path(__file__).with_name(".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_CHAT_MODEL = os.getenv(
    "GEMINI_CHAT_MODEL",
    "gemini-3.8-flash",
)

DAILY_PACK_FILE = Path(__file__).with_name("daily_sentence_pack.json")

gemini_client = (
    genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=600000),
    )
    if GEMINI_API_KEY
    else None
)


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def health_check():
    return {
        "app": "TalkReady AI",
        "status": "running",
    }


# --------------------------------------------------
# SPEECH TRANSCRIPTION
# --------------------------------------------------

@lru_cache(maxsize=1)
def get_whisper_model():
    return WhisperModel(
        "base",
        device="cpu",
        compute_type="int8",
    )


@app.post("/api/speech/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    expected_text: str = Form(""),
):
    if not audio.content_type or not (
        audio.content_type.startswith("audio/")
        or audio.content_type == "application/octet-stream"
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid audio recording.",
        )

    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded recording is empty.",
        )

    if len(audio_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Recording must be smaller than 15 MB.",
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".audio",
            delete=False,
        ) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        model = get_whisper_model()

        segments, info = model.transcribe(
            temp_path,
            language="en",
            beam_size=5,
            best_of=5,
            vad_filter=False,
            condition_on_previous_text=False,
            temperature=0.0,
            initial_prompt=(
                "English reading practice. "
                "Transcribe the speaker's actual words accurately. "
                "Do not replace words with the reference sentence."
            ),
        )

        transcript_parts = []

        for segment in segments:
            text = segment.text.strip()
            if text:
                transcript_parts.append(text)

        transcript = " ".join(transcript_parts).strip()

        return {
            "transcript": transcript,
            "expected_text": expected_text.strip(),
            "language": info.language,
            "duration_seconds": round(info.duration, 2),
            "transcript_empty": not bool(transcript),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(exc)}",
        ) from exc

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# --------------------------------------------------
# DAILY SPEAKING SENTENCES
# --------------------------------------------------

SENTENCE_CATEGORIES = [
    "personal strengths and abilities",
    "personal skills and confidence",
    "education and learning",
    "IT jobs and technical interviews",
    "programming and debugging",
    "web development and databases",
    "AI and machine learning",
    "college projects and practical skills",
    "HR interviews and career goals",
    "teamwork and workplace communication",
    "everyday English and professional situations",
]


FALLBACK_SENTENCES = [
    "I am learning to communicate clearly and confidently.",
    "My strengths include problem solving and teamwork.",
    "I enjoy learning new technologies and practical skills.",
    "I can explain my ideas in a simple and organized way.",
    "I am improving my English by practising every day.",
    "I believe consistent practice helps me make progress.",
    "I am prepared to learn from feedback and mistakes.",
    "I can stay calm when I face a difficult problem.",
    "I try to complete my work carefully and on time.",
    "I enjoy working with people who share new ideas.",
    "My education has helped me build a strong technical foundation.",
    "I am interested in software development and artificial intelligence.",
    "I can describe the goals and features of my projects.",
    "I use debugging to understand and fix software problems.",
    "I test my code before considering a task complete.",
    "I am comfortable learning from documentation and examples.",
    "I want to build applications that solve real problems.",
    "I can explain how a web application works.",
    "I understand the importance of readable and maintainable code.",
    "I try to break large tasks into smaller steps.",
    "I ask clear questions when I need help.",
    "I listen carefully before responding to a question.",
    "I respect different opinions during a team discussion.",
    "I communicate project updates clearly to my teammates.",
    "I can adapt when a plan or requirement changes.",
    "I take responsibility for the tasks assigned to me.",
    "I welcome constructive feedback from my colleagues.",
    "I prepare examples before explaining my experience.",
    "I am working toward becoming a better software developer.",
    "I want to contribute positively to a professional team.",
    "Tell me about yourself and your educational background.",
    "What are your strongest technical skills?",
    "Why are you interested in this position?",
    "What did you learn from your final-year project?",
    "How do you approach a problem you have never solved before?",
    "Can you describe a challenge you overcame during a project?",
    "How do you prioritize tasks when you have a deadline?",
    "What would you do if you disagreed with a teammate?",
    "How do you respond when someone gives you feedback?",
    "What are your career goals for the next few years?",
    "Could you please explain the requirements for this task?",
    "I would appreciate an opportunity to discuss this further.",
    "Could you help me understand the next steps?",
    "I would like to request leave for a personal reason.",
    "I am not feeling well and need to request sick leave.",
    "Could you please confirm whether my leave request is approved?",
    "I will complete my pending tasks before my planned leave.",
    "Thank you for explaining the company policy.",
    "Could you please clarify the expected delivery date?",
    "I will inform the team if I encounter a delay.",
    "I would like to report an issue with my recent order.",
    "Could you please check the status of my request?",
    "I understand your concern and will try to help.",
    "Thank you for your patience while I review the details.",
    "I will explain the problem and the steps I have tried.",
    "Could you please repeat that a little more slowly?",
    "I am sorry for the inconvenience this has caused.",
    "Let me confirm the details before I proceed.",
    "I appreciate your help and understanding.",
    "I will follow up once I have an update.",
    "Good morning, could I speak with the concerned person?",
    "I have a question about the assignment instructions.",
    "May I share my opinion about this topic?",
    "I agree with your point because of the evidence provided.",
    "I see your perspective, although I have a different view.",
    "In my opinion, teamwork improves the quality of a project.",
    "Let me organize my thoughts before I answer.",
    "The main purpose of this feature is to save time.",
    "First, I will explain the problem, then the solution.",
    "Thank you for giving me the opportunity to present.",
    "Could you please give me a moment to think?",
    "I am practising so I can speak more naturally.",
    "I sometimes make mistakes, but I learn from them.",
    "I can improve by speaking clearly and at a steady pace.",
    "I want my explanations to be concise and easy to follow.",
    "I will try again if my first answer is not clear.",
    "A short pause can help me organize my response.",
    "I can speak confidently when I prepare and practise.",
    "I am becoming more comfortable speaking in English.",
    "I will focus on clarity instead of speaking too quickly.",
    "I can explain my ideas without using unnecessary jargon.",
    "I will listen to the full question before answering.",
    "Could you tell me more about the situation?",
    "I would like to understand your expectations clearly.",
    "I can provide an update at the end of the day.",
    "Please let me know if any additional information is needed.",
    "I will review the details and get back to you.",
    "I appreciate the chance to learn and contribute.",
    "I am ready to take on new responsibilities.",
    "I believe honesty and reliability are important at work.",
    "I will make sure the information is accurate.",
    "I can work independently and ask for support when needed.",
    "I enjoy finding practical solutions to everyday problems.",
    "I try to understand the user's needs before building a feature.",
    "A good interface should be clear and easy to use.",
    "A reliable application should handle errors gracefully.",
    "I check edge cases before releasing a change.",
    "I use version control to track changes in my code.",
    "I can describe the difference between frontend and backend code.",
    "An API allows different parts of an application to communicate.",
    "A database stores information so it can be retrieved later.",
    "Authentication helps verify the identity of a user.",
    "I protect private keys and credentials from public access.",
    "I test important user journeys before deployment.",
    "I can explain why a particular technology suits a project.",
    "I will document important decisions for the team.",
    "I am willing to learn tools that improve my workflow.",
    "I can adjust my approach when I discover a better solution.",
    "I make progress by practising a little every day.",
    "I will focus on one task at a time.",
    "I can ask for clarification rather than make assumptions.",
    "I will check the results before saying the task is finished.",
    "I am proud of the progress I make through consistent effort.",
]


def normalize_sentences(items):
    sentences = []
    seen = set()

    for item in items:
        if not isinstance(item, str):
            continue

        sentence = " ".join(item.split()).strip()
        key = sentence.casefold()

        if sentence and sentence[-1] in ".!?" and key not in seen:
            sentences.append(sentence)
            seen.add(key)

    return sentences


def generate_sentence_batch(count: int) -> list[str]:
    """Generate English speaking practice sentences using Gemini."""
    if gemini_client is None:
        raise RuntimeError(
            "GEMINI_API_KEY is missing from backend/.env"
        )

    prompt = f"""
Generate exactly {count} distinct English speaking practice sentences.

Topics:
{", ".join(SENTENCE_CATEGORIES)}

Requirements:
- Include personal sentences about strengths, abilities and skills.
- Include education, IT careers, programming and interviews.
- Include everyday and professional communication.
- Use natural, grammatically correct English.
- Use correct capitalization and punctuation.
- Vary sentence length and vocabulary difficulty.
- Make every sentence suitable for reading aloud.
- Do not number the sentences.
- Do not include headings, explanations or markdown.
- Return only a valid JSON array of strings.
"""

    response = gemini_client.models.generate_content(
        model=GEMINI_CHAT_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "temperature": 0.9,
            "max_output_tokens": 4096,
        },
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    try:
        data = json.loads(response.text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Gemini returned invalid JSON. Please retry."
        ) from exc

    if not isinstance(data, list):
        raise RuntimeError("Gemini did not return a sentence list.")

    return normalize_sentences(data)


def get_daily_sentence_pack() -> dict:
    """Reuse saved sentences first; use local fallback if Gemini is unavailable."""
    today = datetime.now(
        ZoneInfo("Asia/Kolkata")
    ).date().isoformat()

    if DAILY_PACK_FILE.exists():
        try:
            saved = json.loads(
                DAILY_PACK_FILE.read_text(encoding="utf-8")
            )
            saved_sentences = normalize_sentences(
                saved.get("sentences", [])
            )

            if len(saved_sentences) >= 200:
                pack = {
                    "date": today,
                    "sentences": saved_sentences[:200],
                }

                if saved.get("date") != today:
                    DAILY_PACK_FILE.write_text(
                        json.dumps(pack, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )

                return pack

        except (OSError, json.JSONDecodeError, AttributeError):
            pass

    all_sentences = []
    seen = set()

    for _ in range(5):
        remaining = 200 - len(all_sentences)

        if remaining <= 0:
            break

        try:
            batch = generate_sentence_batch(
                min(remaining + 10, 50)
            )
        except Exception as exc:
            print(f"Gemini generation stopped: {exc}")
            break

        for sentence in batch:
            key = sentence.casefold()

            if key not in seen:
                seen.add(key)
                all_sentences.append(sentence)

    for sentence in normalize_sentences(FALLBACK_SENTENCES):
        if len(all_sentences) >= 200:
            break

        key = sentence.casefold()

        if key not in seen:
            seen.add(key)
            all_sentences.append(sentence)

    fallback = normalize_sentences(FALLBACK_SENTENCES)
    index = 0

    while len(all_sentences) < 200 and fallback:
        sentence = fallback[index % len(fallback)]
        index += 1
        all_sentences.append(sentence)

    random.shuffle(all_sentences)

    pack = {
        "date": today,
        "sentences": all_sentences[:200],
    }

    try:
        DAILY_PACK_FILE.write_text(
            json.dumps(pack, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        print(f"Could not save daily sentence pack: {exc}")

    return pack


@app.get("/api/sentences/daily")
def daily_sentences():
    try:
        pack = get_daily_sentence_pack()

        return {
            "date": pack["date"],
            "count": len(pack["sentences"]),
            "sentences": pack["sentences"],
        }

    except Exception as exc:
        print(f"Daily sentence generation failed: {exc}")

        raise HTTPException(
            status_code=503,
            detail=(
                "Daily sentences are temporarily unavailable. "
                "Check the backend terminal for details."
            ),
        ) from exc


# --------------------------------------------------
# CONVERSATION REQUEST MODELS
# --------------------------------------------------

class ConversationMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=2000)


class ConversationRequest(BaseModel):
    scenario: str = Field(min_length=1, max_length=100)
    difficulty: str = "Beginner"
    messages: list[ConversationMessage] = Field(
        min_length=1,
        max_length=30,
    )


# --------------------------------------------------
# AI CONVERSATION ENDPOINT
# --------------------------------------------------

@app.post("/api/conversation/reply")
def conversation_reply(request: ConversationRequest):
    if gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI conversations are unavailable. "
                "Check GEMINI_API_KEY in backend/.env."
            ),
        )

    allowed_difficulties = {
        "Beginner",
        "Intermediate",
        "Advanced",
    }

    allowed_scenarios = {
        "Job Interview",
        "Self-Introduction",
        "Everyday Conversation",
        "Group Discussion",
        "Meeting New People",
    }

    if request.difficulty not in allowed_difficulties:
        raise HTTPException(
            status_code=400,
            detail="Invalid difficulty.",
        )

    if request.scenario not in allowed_scenarios:
        raise HTTPException(
            status_code=400,
            detail="Invalid scenario.",
        )

    messages = []

    for message in request.messages:
        if message.role not in {"user", "assistant"}:
            raise HTTPException(
                status_code=400,
                detail="Invalid message role.",
            )

        messages.append({
            "role": message.role,
            "content": message.content.strip(),
        })

    history = "\n".join(
        f"{'Learner' if item['role'] == 'user' else 'AI Coach'}: "
        f"{item['content']}"
        for item in messages[-12:]
    )

    prompt = f"""
You are TalkReady AI, a friendly English conversation coach.

Scenario: {request.scenario}
Difficulty: {request.difficulty}

Continue a realistic conversation by responding to the learner's
latest message. Use vocabulary suitable for their level. Correct
important English mistakes gently, but do not invent mistakes.
Keep your response concise and encouraging.

Return only valid JSON in this format:
{{
  "reply": "Your conversational response",
  "suggested_replies": [
    "Suggested response one",
    "Suggested response two",
    "Suggested response three"
  ],
  "feedback": {{
    "correction": "",
    "explanation": "",
    "tip": "One practical speaking tip"
  }}
}}

Use empty correction and explanation strings when no correction is needed.

Conversation history:
{history}
"""

    try:
        print(
            f"Generating conversation reply: "
            f"scenario={request.scenario}, "
            f"difficulty={request.difficulty}, "
            f"messages={len(messages)}"
        )

        response = gemini_client.models.generate_content(
            model=GEMINI_CHAT_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.7,
                "thinking_config": types.ThinkingConfig(
                    thinking_level="LOW"
                ),
                "max_output_tokens": 300,
            },
        )

        if not response.text:
            raise ValueError("Gemini returned an empty response.")

        result = json.loads(response.text)

        if not isinstance(result, dict) or not isinstance(
            result.get("reply"), str
        ):
            raise ValueError("Unexpected Gemini response format.")

        suggestions = result.get("suggested_replies", [])
        feedback = result.get("feedback", {})

        if not isinstance(suggestions, list):
            suggestions = []

        if not isinstance(feedback, dict):
            feedback = {}

        return {
            "reply": result["reply"],
            "suggested_replies": [
                item
                for item in suggestions
                if isinstance(item, str)
            ][:3],
            "feedback": {
                "correction": str(feedback.get("correction", "")),
                "explanation": str(feedback.get("explanation", "")),
                "tip": str(feedback.get("tip", "")),
            },
        }

    except Exception as exc:
        print(
            f"Conversation generation failed: "
            f"{type(exc).__name__}: {exc}"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "The AI response timed out or failed. "
                "Please try again."
            ),
        ) from exc
