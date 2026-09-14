import os
import json
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured. "
        "Please create backend/.env"
    )


# ============================================================
# OPENAI
# ============================================================

client = OpenAI(api_key=API_KEY)

MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="MyAI V3",
    version="3.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATA MODELS
# ============================================================

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


# ============================================================
# SYSTEM INSTRUCTIONS
# ============================================================

SYSTEM_INSTRUCTIONS = """
You are MyAI V3, a powerful AI assistant with web search capability.

Your responsibilities:

GENERAL:
- Give accurate, useful and clear answers.
- Use Markdown when appropriate.
- Explain difficult concepts step by step.

WEB SEARCH:
Use web search whenever current or changing information is needed.

Examples:
- Latest news
- Current events
- Current prices
- Current products
- Current company information
- Current technology
- Latest software versions
- Latest documentation
- Current sports information
- Current political/public information
- Information that may have changed recently
- When the user explicitly asks you to search the web

Do NOT search the web unnecessarily for:
- Basic mathematics
- General programming concepts
- Simple explanations
- Creative writing
- Rewriting
- Translation
- Casual conversation

When using web search:
- Prefer reliable sources.
- Use multiple sources when appropriate.
- Do not invent information.
- Clearly distinguish facts from uncertainty.
- Provide source citations/links when available.

TECHNICAL QUESTIONS:
- Explain step by step.
- Give practical examples.
- Provide complete working code when requested.
- Use code blocks for code.

IMPORTANT:
Never claim that you searched the web unless you actually used the web search tool.
Never claim to have performed an action that you did not perform.
"""


# ============================================================
# ROOT / HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "message": "MyAI V3 backend is running",
        "version": "3.0",
        "model": MODEL,
        "web_search": True
    }


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
async def chat(request: ChatRequest):

    messages = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.messages
    ]

    def generate():

        try:

            # ==================================================
            # OPENAI RESPONSE
            # ==================================================

            stream = client.responses.create(

                model=MODEL,

                instructions=SYSTEM_INSTRUCTIONS,

                input=messages,

                # ==================================================
                # V3 FEATURE
                # BUILT-IN WEB SEARCH
                # ==================================================

                tools=[
                    {
                        "type": "web_search"
                    }
                ],

                stream=True
            )


            # ==================================================
            # PROCESS STREAM
            # ==================================================

            for event in stream:

                # ------------------------------------------------
                # NORMAL TEXT STREAM
                # ------------------------------------------------

                if event.type == "response.output_text.delta":

                    data = {
                        "type": "delta",
                        "text": event.delta
                    }

                    yield (
                        f"data: {json.dumps(data)}\n\n"
                    )


                # ------------------------------------------------
                # WEB SEARCH STARTED
                # ------------------------------------------------

                elif event.type == "response.web_search_call.in_progress":

                    data = {
                        "type": "search_start"
                    }

                    yield (
                        f"data: {json.dumps(data)}\n\n"
                    )


                # ------------------------------------------------
                # WEB SEARCH RUNNING
                # ------------------------------------------------

                elif event.type == "response.web_search_call.searching":

                    data = {
                        "type": "searching"
                    }

                    yield (
                        f"data: {json.dumps(data)}\n\n"
                    )


                # ------------------------------------------------
                # WEB SEARCH COMPLETED
                # ------------------------------------------------

                elif event.type == "response.web_search_call.completed":

                    data = {
                        "type": "search_complete"
                    }

                    yield (
                        f"data: {json.dumps(data)}\n\n"
                    )


                # ------------------------------------------------
                # RESPONSE COMPLETED
                # ------------------------------------------------

                elif event.type == "response.completed":

                    data = {
                        "type": "done"
                    }

                    yield (
                        f"data: {json.dumps(data)}\n\n"
                    )


        except Exception as e:

            # ==================================================
            # ERROR
            # ==================================================

            error_data = {
                "type": "error",
                "message": str(e)
            }

            yield (
                f"data: {json.dumps(error_data)}\n\n"
            )


    # ============================================================
    # STREAMING RESPONSE
    # ============================================================

    return StreamingResponse(

        generate(),

        media_type="text/event-stream",

        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no-cache"
        }
    )