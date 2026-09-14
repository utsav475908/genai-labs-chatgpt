import json
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)

REALTIME_MODEL = os.getenv(
    "OPENAI_REALTIME_MODEL",
    "gpt-realtime-2.1"
)

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured in backend/.env"
    )


client = OpenAI(
    api_key=OPENAI_API_KEY
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="GenAI-Labs V9",
    description="GenAI-Labs Visual and Interactive AI Lab",
    version="9.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3009",
        "http://127.0.0.1:3009",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELS
# ============================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]

    image_file_id: Optional[str] = None

    vector_store_id: Optional[str] = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V9",
        "name": "Visual, Interactive",
        "model": MODEL,
        "realtime_model": REALTIME_MODEL,
        "authentication": False,
        "database": False,
        "persistent_memory": False,
        "web_search": True,
        "file_search": True,
        "image_vision": True,
        "voice": True,
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "9.0.0",
        "model": MODEL,
    }


# ============================================================
# IMAGE UPLOAD
# ============================================================

@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...)
):
    """
    Upload an image to OpenAI for Vision analysis.
    """

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File content type is missing."
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are supported by this endpoint."
        )

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        uploaded_file = client.files.create(
            file=(
                file.filename,
                contents,
                file.content_type
            ),
            purpose="user_data"
        )

        return {
            "success": True,
            "filename": file.filename,
            "file_id": uploaded_file.id,
            "id": uploaded_file.id,
            "content_type": file.content_type,
            "type": "image",
        }

    except HTTPException:
        raise

    except Exception as e:
        print("IMAGE UPLOAD ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(e)}"
        )


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):
    """
    Upload a document and create a vector store
    for File Search / RAG.
    """

    allowed_types = {
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    filename = file.filename or ""

    extension = filename.lower().split(".")[-1]

    allowed_extensions = {
        "pdf",
        "txt",
        "doc",
        "docx",
    }

    if (
        file.content_type not in allowed_types
        and extension not in allowed_extensions
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported document type. "
                "Please upload PDF, DOC, DOCX, or TXT."
            )
        )

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded document is empty."
            )

        uploaded_file = client.files.create(
            file=(
                filename,
                contents,
                file.content_type or "application/octet-stream"
            ),
            purpose="user_data"
        )

        vector_store = client.vector_stores.create(
            name=f"GenAI-Labs V9 - {filename}"
        )

        vector_store_file = (
            client.vector_stores.files.create_and_poll(
                vector_store_id=vector_store.id,
                file_id=uploaded_file.id
            )
        )

        return {
            "success": True,
            "filename": filename,
            "file_id": uploaded_file.id,
            "vector_store_id": vector_store.id,
            "vector_store_file_id": vector_store_file.id,
            "type": "document",
        }

    except HTTPException:
        raise

    except Exception as e:
        print("DOCUMENT UPLOAD ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {str(e)}"
        )


# ============================================================
# CHAT STREAM
# ============================================================

def create_sse(data):
    """
    Convert a Python object into Server-Sent Event format.
    """

    return f"data: {json.dumps(data)}\n\n"


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Main GenAI endpoint.

    Supports:

    1. Normal chat
    2. Streaming
    3. Web Search
    4. File Search / RAG
    5. Image Vision
    """

    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="At least one message is required."
        )

    try:
        # ----------------------------------------------------
        # Convert frontend messages
        # ----------------------------------------------------

        input_messages = []

        for message in request.messages:
            input_messages.append(
                {
                    "role": message.role,
                    "content": message.content,
                }
            )

        # ----------------------------------------------------
        # Tools
        # ----------------------------------------------------

        tools = [
            {
                "type": "web_search"
            }
        ]

        # ----------------------------------------------------
        # File Search
        # ----------------------------------------------------

        if request.vector_store_id:

            tools.append(
                {
                    "type": "file_search",
                    "vector_store_ids": [
                        request.vector_store_id
                    ],
                }
            )

        # ----------------------------------------------------
        # Image
        # ----------------------------------------------------

        if request.image_file_id:

            if not input_messages:
                raise HTTPException(
                    status_code=400,
                    detail="An image requires a user message."
                )

            last_message = input_messages[-1]

            existing_text = last_message.get(
                "content",
                ""
            )

            last_message["content"] = [
                {
                    "type": "input_text",
                    "text": existing_text,
                },
                {
                    "type": "input_image",
                    "file_id": request.image_file_id,
                    "detail": "auto",
                },
            ]

        # ----------------------------------------------------
        # Instructions
        # ----------------------------------------------------

        instructions = """
You are GenAI-Labs V9, a helpful AI assistant inside
a Visual and Interactive Generative AI learning laboratory.

Your job is to help users understand and experiment with
Generative AI.

You can:

- Answer normal questions
- Explain AI concepts
- Search the web when current information is useful
- Answer questions about uploaded documents
- Analyze uploaded images
- Explain diagrams, charts, screenshots and photos
- Teach concepts step by step
- Give practical programming examples
- Explain GenAI architecture

When teaching technical concepts:

1. Start with a simple explanation.
2. Give a real-world analogy when useful.
3. Explain the technical flow.
4. Give a small practical example.
5. Keep the explanation clear and structured.

Do not claim that you performed an action unless you actually
performed that action.

When web search results are available, use them appropriately.

When file search results are available, ground document answers
in the retrieved document information.

When an image is provided, analyze the image directly.
"""

        # ----------------------------------------------------
        # Streaming response
        # ----------------------------------------------------

        def generate():

            try:

                stream = client.responses.create(
                    model=MODEL,
                    instructions=instructions,
                    input=input_messages,
                    tools=tools,
                    stream=True,
                )

                for event in stream:

                    # ----------------------------------------
                    # Text delta
                    # ----------------------------------------

                    if (
                        event.type
                        == "response.output_text.delta"
                    ):
                        text = event.delta

                        if text:
                            yield create_sse(
                                {
                                    "type": "delta",
                                    "text": text,
                                }
                            )

                    # ----------------------------------------
                    # Response completed
                    # ----------------------------------------

                    elif (
                        event.type
                        == "response.completed"
                    ):
                        yield create_sse(
                            {
                                "type": "completed"
                            }
                        )

                    # ----------------------------------------
                    # Error
                    # ----------------------------------------

                    elif (
                        event.type
                        == "error"
                    ):
                        error_message = (
                            getattr(
                                event,
                                "message",
                                None
                            )
                            or "OpenAI returned an error."
                        )

                        yield create_sse(
                            {
                                "type": "error",
                                "message": error_message,
                            }
                        )

                yield "data: [DONE]\n\n"

            except Exception as e:

                print(
                    "STREAMING ERROR:",
                    str(e)
                )

                yield create_sse(
                    {
                        "type": "error",
                        "message": str(e),
                    }
                )

                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except HTTPException:
        raise

    except Exception as e:

        print(
            "CHAT ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Chat request failed: {str(e)}"
        )


# ============================================================
# REALTIME VOICE TOKEN
# ============================================================

@app.post("/realtime-token")
async def realtime_token():
    """
    Create a short-lived Realtime client secret.

    The browser uses this secret to establish the
    WebRTC connection for voice.
    """

    try:

        result = client.realtime.client_secrets.create(
            session={
                "type": "realtime",
                "model": REALTIME_MODEL,
                "instructions": """
You are the voice assistant for GenAI-Labs V9.

Help users learn about Generative AI, LLMs,
prompt engineering, RAG, computer vision,
AI application architecture and related
technical topics.

Explain concepts clearly and conversationally.
Use simple examples when useful.
""",
                "audio": {
                    "output": {
                        "voice": "marin"
                    }
                },
            }
        )

        return {
            "success": True,
            "client_secret": result.client_secret,
            "model": REALTIME_MODEL,
        }

    except Exception as e:

        print(
            "REALTIME TOKEN ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Realtime token creation failed: {str(e)}"
        )


# ============================================================
# SERVER START MESSAGE
# ============================================================

if __name__ == "__main__":

    import uvicorn

    print("")
    print("==============================================")
    print("        GenAI-Labs V9")
    print("        Visual, Interactive AI Lab")
    print("==============================================")
    print("")
    print(f"Model: {MODEL}")
    print(f"Realtime: {REALTIME_MODEL}")
    print("Authentication: OFF")
    print("Database: OFF")
    print("Persistent Memory: OFF")
    print("Web Search: ON")
    print("File Search: ON")
    print("Vision: ON")
    print("Voice: ON")
    print("")
    print("Backend: http://localhost:8009")
    print("==============================================")
    print("")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8009,
    )