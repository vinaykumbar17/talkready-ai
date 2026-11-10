import asyncio
import json
import os

import websockets
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).with_name(".env"))

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise SystemExit("GEMINI_API_KEY is missing from backend/.env")

URL = "ws://127.0.0.1:8000/api/conversation/live"

async def main():
    async with websockets.connect(URL, open_timeout=30) as socket:
        await socket.send(json.dumps({
            "type": "start",
            "scenario": "Job Interview",
            "difficulty": "Beginner",
            "voice": "Kore",
            "resume_context": ""
        }))

        try:
            response = await asyncio.wait_for(socket.recv(), timeout=45)
        except asyncio.TimeoutError:
            raise SystemExit(
                "Timed out waiting for the voice server. Check the Uvicorn terminal."
            )

        data = json.loads(response)
        if data.get("type") == "ready":
            print("SUCCESS: Backend connected to Gemini Live.")
            print("Model:", data.get("model", "gemini-3.8-live"))
            print("Voice:", data.get("voice"))
            print("Input sample rate:", data.get("input_sample_rate"))
            print("Output sample rate:", data.get("output_sample_rate"))
        else:
            print("VOICE CONNECTION FAILED:")
            print(data.get("message", data))

if __name__ == "__main__":
    asyncio.run(main())
