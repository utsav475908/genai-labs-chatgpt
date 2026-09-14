import os
import json
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

from fastapi.responses import StreamingResponse   # V2 feature 


load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured. Create backend/.env"
    )

client = OpenAI(api_key=API_KEY)

app = FastAPI(title="MyAI V2")

# Allow our local frontend to communicate with the backend.
app.add_middleware(  
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


SYSTEM_INSTRUCTIONS = """
You are MyAI, a helpful and intelligent AI assistant.

Give clear, accurate and useful answers.

Use Markdown when appropriate.

For technical questions:
- Explain concepts step by step.
- Give practical examples.
- Use code blocks when useful.
- Keep explanations understandable.

When the user asks for code, provide complete working examples.

Do not claim to have performed actions that you did not actually perform.
"""


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "MyAI V2 backend is running"
    }


@app.post("/chat")
async def chat(request: ChatRequest):

    messages = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.messages
    ]

    def generate():  # V2 feature 

        try:
            stream = client.responses.create(    # V2 feature. 
                model=os.getenv(
                    "OPENAI_MODEL",     
                    "gpt-5.6-luna"
                ),
                instructions=SYSTEM_INSTRUCTIONS,
                input=messages,
                stream=True,
            )

            for event in stream:

                if event.type == "response.output_text.delta":
                    data = {
                        "type": "delta",
                        "text": event.delta
                    }

                    yield f"data: {json.dumps(data)}\n\n"

                elif event.type == "response.completed":

                    yield (
                        "data: "
                        + json.dumps({"type": "done"})
                        + "\n\n"
                    )

        except Exception as e:

            error_data = {
                "type": "error",
                "message": str(e)
            }

            yield (
                "data: "
                + json.dumps(error_data)
                + "\n\n"
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )