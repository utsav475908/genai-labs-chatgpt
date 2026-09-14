import json
import os
import time
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

DEFAULT_MODEL = os.getenv(
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

client = OpenAI(api_key=OPENAI_API_KEY)


# ---------------------------------------------------------
# APP
# ---------------------------------------------------------

app = FastAPI(
    title="GenAI-Labs V10",
    description="GenAI-Labs AI Model Playground",
    version="10.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3010",
        "http://127.0.0.1:3010",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# AVAILABLE MODELS
# ---------------------------------------------------------

MODELS = {
    "gpt-5.6-luna": {
        "id": "gpt-5.6-luna",
        "name": "GPT-5.6 Luna",
        "description": "Cost-sensitive, high-volume model",
        "reasoning_levels": [
            "none",
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
        ],
    },
    "gpt-5.6-terra": {
        "id": "gpt-5.6-terra",
        "name": "GPT-5.6 Terra",
        "description": "Balanced intelligence and cost",
        "reasoning_levels": [
            "none",
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
        ],
    },
    "gpt-5.6-sol": {
        "id": "gpt-5.6-sol",
        "name": "GPT-5.6 Sol",
        "description": "Frontier model for complex reasoning and coding",
        "reasoning_levels": [
            "none",
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
        ],
    },
}


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]

    model: Optional[str] = None

    reasoning_effort: Optional[str] = "medium"

    system_prompt: Optional[str] = None

    image_file_id: Optional[str] = None

    vector_store_id: Optional[str] = None


class CompareRequest(BaseModel):
    messages: List[ChatMessage]

    model_a: str
    model_b: str

    reasoning_a: Optional[str] = "medium"
    reasoning_b: Optional[str] = "medium"

    system_prompt: Optional[str] = None


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
def root():

    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V10",
        "name": "AI Model Playground",
        "default_model": DEFAULT_MODEL,
        "realtime_model": REALTIME_MODEL,
        "authentication": False,
        "database": False,
        "persistent_memory": False,
        "web_search": True,
        "file_search": True,
        "image_vision": True,
        "voice": True,
        "model_playground": True,
        "model_comparison": True,
    }


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "version": "10.0.0",
        "default_model": DEFAULT_MODEL,
    }


# ---------------------------------------------------------
# MODELS
# ---------------------------------------------------------

@app.get("/models")
def get_models():

    return {
        "default_model": DEFAULT_MODEL,
        "models": list(MODELS.values()),
    }


# ---------------------------------------------------------
# IMAGE UPLOAD
# ---------------------------------------------------------

@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...)
):

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File content type is missing."
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are supported."
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


# ---------------------------------------------------------
# DOCUMENT UPLOAD
# ---------------------------------------------------------

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):

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
            detail="Unsupported document type."
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
                contents
            ),
            purpose="user_data"
        )

        vector_store = client.vector_stores.create(
            name=f"GenAI-Labs V10 - {filename}"
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

        print(
            "DOCUMENT UPLOAD ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {str(e)}"
        )


# ---------------------------------------------------------
# SSE HELPER
# ---------------------------------------------------------

def create_sse(data):

    return (
        f"data: {json.dumps(data)}\n\n"
    )


# ---------------------------------------------------------
# BUILD INSTRUCTIONS
# ---------------------------------------------------------

def build_instructions(
    system_prompt: Optional[str]
):

    default_instructions = """
You are GenAI-Labs V10, an AI assistant inside
a Visual and Interactive Generative AI Model Playground.

Your job is to help users learn and experiment with
Generative AI, LLMs, prompting, RAG, computer vision,
AI architecture, Kubernetes, cloud computing and
software engineering.

When teaching:

1. Start with a simple explanation.
2. Use an analogy when useful.
3. Explain the technical flow.
4. Give a practical example.
5. Keep the answer structured and clear.

You may use web search when current information is useful.

If a document is provided, use file search when available.

If an image is provided, analyze it directly.

Do not claim that an action was performed unless
it was actually performed.
"""

    if system_prompt and system_prompt.strip():

        return (
            default_instructions
            + "\n\n"
            + "USER-PROVIDED SYSTEM INSTRUCTIONS:\n"
            + system_prompt.strip()
        )

    return default_instructions


# ---------------------------------------------------------
# VALIDATE MODEL
# ---------------------------------------------------------

def validate_model(model):

    if model not in MODELS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported model: {model}. "
                f"Available models: {list(MODELS.keys())}"
            )
        )

    return model


# ---------------------------------------------------------
# CHAT
# ---------------------------------------------------------

@app.post("/chat")
async def chat(
    request: ChatRequest
):

    if not request.messages:

        raise HTTPException(
            status_code=400,
            detail="At least one message is required."
        )

    model = request.model or DEFAULT_MODEL

    validate_model(model)

    reasoning_effort = request.reasoning_effort or "medium"

    if reasoning_effort not in MODELS[model]["reasoning_levels"]:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported reasoning level "
                f"'{reasoning_effort}' for {model}"
            )
        )

    try:

        input_messages = []

        for message in request.messages:

            input_messages.append({
                "role": message.role,
                "content": message.content,
            })

        tools = [
            {
                "type": "web_search"
            }
        ]

        if request.vector_store_id:

            tools.append(
                {
                    "type": "file_search",
                    "vector_store_ids": [
                        request.vector_store_id
                    ],
                }
            )

        # Add image to the latest user message
        if request.image_file_id:

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

        instructions = build_instructions(
            request.system_prompt
        )

        def generate():

            start_time = time.time()

            try:

                stream = client.responses.create(
                    model=model,
                    instructions=instructions,
                    input=input_messages,
                    tools=tools,
                    reasoning={
                        "effort": reasoning_effort
                    },
                    stream=True,
                )

                for event in stream:

                    if event.type == "response.output_text.delta":

                        text = event.delta

                        if text:

                            yield create_sse(
                                {
                                    "type": "delta",
                                    "text": text,
                                }
                            )

                    elif event.type == "response.completed":

                        elapsed = round(
                            time.time() - start_time,
                            2
                        )

                        response = event.response

                        usage_data = None

                        if response.usage:

                            usage_data = {
                                "input_tokens":
                                    response.usage.input_tokens,

                                "output_tokens":
                                    response.usage.output_tokens,

                                "total_tokens":
                                    response.usage.total_tokens,
                            }

                        yield create_sse(
                            {
                                "type": "completed",

                                "model": model,

                                "reasoning_effort":
                                    reasoning_effort,

                                "elapsed_seconds":
                                    elapsed,

                                "usage":
                                    usage_data,
                            }
                        )

                    elif event.type == "error":

                        error_message = (
                            getattr(
                                event,
                                "message",
                                None
                            )
                            or
                            "OpenAI returned an error."
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


# ---------------------------------------------------------
# MODEL COMPARISON
# ---------------------------------------------------------

@app.post("/compare")
async def compare_models(
    request: CompareRequest
):

    if not request.messages:

        raise HTTPException(
            status_code=400,
            detail="At least one message is required."
        )

    validate_model(request.model_a)
    validate_model(request.model_b)

    instructions = build_instructions(
        request.system_prompt
    )

    input_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in request.messages
    ]

    async def run_model(
        model,
        reasoning
    ):

        start_time = time.time()

        try:

            response = client.responses.create(
                model=model,
                instructions=instructions,
                input=input_messages,
                reasoning={
                    "effort": reasoning
                },
            )

            elapsed = round(
                time.time() - start_time,
                2
            )

            usage = None

            if response.usage:

                usage = {
                    "input_tokens":
                        response.usage.input_tokens,

                    "output_tokens":
                        response.usage.output_tokens,

                    "total_tokens":
                        response.usage.total_tokens,
                }

            return {
                "success": True,
                "model": model,
                "text": response.output_text,
                "elapsed_seconds": elapsed,
                "usage": usage,
                "reasoning_effort": reasoning,
            }

        except Exception as e:

            return {
                "success": False,
                "model": model,
                "text": "",
                "error": str(e),
            }

    result_a = await run_model(
        request.model_a,
        request.reasoning_a or "medium"
    )

    result_b = await run_model(
        request.model_b,
        request.reasoning_b or "medium"
    )

    return {
        "success": True,
        "model_a": result_a,
        "model_b": result_b,
    }


# ---------------------------------------------------------
# REALTIME VOICE
# ---------------------------------------------------------

@app.post("/realtime-token")
async def realtime_token():

    try:

        result = client.realtime.client_secrets.create(
            session={
                "type": "realtime",

                "model": REALTIME_MODEL,

                "instructions": """
You are the voice assistant for GenAI-Labs V10.

Help users learn about Generative AI,
LLMs, prompt engineering, RAG,
computer vision, AI architecture,
Kubernetes, cloud computing and
software engineering.

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
            "client_secret":
                result.client_secret,
            "model":
                REALTIME_MODEL,
        }

    except Exception as e:

        print(
            "REALTIME TOKEN ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Realtime token creation failed: "
                + str(e)
            )
        )


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------

if __name__ == "__main__":

    import uvicorn

    print("")
    print("==============================================")
    print("       GenAI-Labs V10")
    print("       AI MODEL PLAYGROUND")
    print("==============================================")
    print("")
    print(
        f"Default Model: {DEFAULT_MODEL}"
    )
    print(
        f"Realtime: {REALTIME_MODEL}"
    )
    print("")
    print("Models:")
    print(" - GPT-5.6 Luna")
    print(" - GPT-5.6 Terra")
    print(" - GPT-5.6 Sol")
    print("")
    print("Authentication: OFF")
    print("Database: OFF")
    print("Persistent Memory: OFF")
    print("Web Search: ON")
    print("File Search: ON")
    print("Vision: ON")
    print("Voice: ON")
    print("Model Playground: ON")
    print("Model Comparison: ON")
    print("")
    print("Backend: http://localhost:8010")
    print("==============================================")
    print("")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8010
    )