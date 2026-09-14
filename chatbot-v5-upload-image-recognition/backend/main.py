import os
import json
import traceback

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI


# ============================================================
# CONFIG
# ============================================================

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is missing. Check your .env file."
    )

client = OpenAI(api_key=OPENAI_API_KEY)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="GenAI-Labs V5",
    version="5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SYSTEM INSTRUCTIONS
# ============================================================

SYSTEM_INSTRUCTIONS = """
You are GenAI-Labs V5.

You are a helpful AI assistant with these capabilities:

1. Normal AI conversation
2. Real-time Web Search
3. Document File Search
4. Image understanding and recognition

IMAGE ANALYSIS:
- Carefully inspect uploaded images.
- Describe what is actually visible.
- Read visible text when possible.
- Analyze screenshots.
- Analyze AWS architecture diagrams.
- Analyze Kubernetes diagrams.
- Analyze charts and graphs.
- Analyze photographs.
- Explain UI screenshots and error messages.
- Do not invent details that cannot be seen.

DOCUMENT ANALYSIS:
- When the user uploads a document and asks about it,
  use File Search.
- Prefer information from the uploaded document for
  document-specific questions.
- Do not claim information exists in a document if it
  cannot be found.

WEB SEARCH:
- Use Web Search when the user asks for current,
  latest, recent, today's, or real-time information.
- Use Web Search when current information is required.

NORMAL QUESTIONS:
- Answer normally when no external information is required.

Be accurate, clear and helpful.
"""


# ============================================================
# REQUEST MODEL
# ============================================================

class ChatRequest(BaseModel):
    messages: list
    vector_store_id: str | None = None
    image_file_id: str | None = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "message": "GenAI-Labs V5 backend is running",
        "version": "5.0",
        "model": MODEL,
        "web_search": True,
        "file_search": True,
        "image_recognition": True
    }


# ============================================================
# IMAGE UPLOAD
# ============================================================

@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...)
):

    try:

        allowed_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        }

        if file.content_type not in allowed_types:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported image type. "
                    "Use JPG, PNG, WEBP or GIF."
                )
            )

        contents = await file.read()

        max_size = 20 * 1024 * 1024

        if len(contents) > max_size:

            raise HTTPException(
                status_code=400,
                detail="Image is too large. Maximum size is 20 MB."
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
            "content_type": file.content_type
        }

    except HTTPException:
        raise

    except Exception as e:

        print("IMAGE UPLOAD ERROR")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):

    try:

        allowed_extensions = {
            ".pdf",
            ".doc",
            ".docx",
            ".txt",
            ".md",
            ".csv",
            ".json"
        }

        filename = file.filename or ""
        filename_lower = filename.lower()

        if not any(
            filename_lower.endswith(ext)
            for ext in allowed_extensions
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported document type. "
                    "Use PDF, DOC, DOCX, TXT, MD, CSV or JSON."
                )
            )

        contents = await file.read()

        max_size = 100 * 1024 * 1024

        if len(contents) > max_size:

            raise HTTPException(
                status_code=400,
                detail="Document is too large. Maximum size is 100 MB."
            )

        # Upload document
        uploaded_file = client.files.create(
            file=(
                filename,
                contents
            ),
            purpose="user_data"
        )

        # Create vector store
        vector_store = client.vector_stores.create(
            name=f"GenAI-Labs - {filename}"
        )

        # Add file and wait for indexing
        vector_store_file = (
            client.vector_stores.files.create_and_poll(
                vector_store_id=vector_store.id,
                file_id=uploaded_file.id
            )
        )

        if vector_store_file.status != "completed":

            raise HTTPException(
                status_code=500,
                detail=(
                    "Document indexing failed. "
                    f"Status: {vector_store_file.status}"
                )
            )

        return {
            "success": True,
            "filename": filename,
            "file_id": uploaded_file.id,
            "vector_store_id": vector_store.id,
            "status": vector_store_file.status
        }

    except HTTPException:
        raise

    except Exception as e:

        print("DOCUMENT UPLOAD ERROR")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
async def chat(request: ChatRequest):

    try:

        if not request.messages:

            raise HTTPException(
                status_code=400,
                detail="No messages supplied."
            )

        input_messages = []

        for message in request.messages:

            role = message.get("role")
            content = message.get("content", "")

            if role not in {
                "user",
                "assistant"
            }:
                continue

            input_messages.append({
                "role": role,
                "content": content
            })


        # ====================================================
        # ATTACH IMAGE TO LATEST USER MESSAGE
        # ====================================================

        if request.image_file_id:

            latest_user_index = None

            for index in range(
                len(input_messages) - 1,
                -1,
                -1
            ):

                if (
                    input_messages[index]["role"]
                    == "user"
                ):

                    latest_user_index = index
                    break


            if latest_user_index is not None:

                existing_text = (
                    input_messages[
                        latest_user_index
                    ]["content"]
                )

                input_messages[
                    latest_user_index
                ]["content"] = [

                    {
                        "type": "input_text",
                        "text": existing_text
                    },

                    {
                        "type": "input_image",
                        "file_id": request.image_file_id,
                        "detail": "auto"
                    }

                ]


        # ====================================================
        # TOOLS
        # ====================================================

        tools = [
            {
                "type": "web_search"
            }
        ]


        # Add File Search when document exists
        if request.vector_store_id:

            tools.append(
                {
                    "type": "file_search",
                    "vector_store_ids": [
                        request.vector_store_id
                    ]
                }
            )


        # ====================================================
        # OPENAI RESPONSES API
        # ====================================================

        stream = client.responses.create(

            model=MODEL,

            instructions=SYSTEM_INSTRUCTIONS,

            input=input_messages,

            tools=tools,

            max_output_tokens=4000,

            stream=True
        )


        # ====================================================
        # STREAM EVENTS
        # ====================================================

        async def event_generator():

            try:

                for event in stream:

                    event_type = getattr(
                        event,
                        "type",
                        ""
                    )


                    # -----------------------------
                    # Text
                    # -----------------------------

                    if (
                        event_type
                        == "response.output_text.delta"
                    ):

                        text = getattr(
                            event,
                            "delta",
                            ""
                        )

                        if text:

                            yield (
                                "data: "
                                + json.dumps(
                                    {
                                        "type": "delta",
                                        "text": text
                                    }
                                )
                                + "\n\n"
                            )


                    # -----------------------------
                    # Web Search
                    # -----------------------------

                    elif (
                        event_type
                        == "response.web_search_call.in_progress"
                    ):

                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "type": "searching"
                                }
                            )
                            + "\n\n"
                        )


                    elif (
                        event_type
                        == "response.web_search_call.completed"
                    ):

                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "type": "search_completed"
                                }
                            )
                            + "\n\n"
                        )


                    # -----------------------------
                    # File Search
                    # -----------------------------

                    elif (
                        event_type
                        == "response.file_search_call.in_progress"
                    ):

                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "type": "file_searching"
                                }
                            )
                            + "\n\n"
                        )


                    elif (
                        event_type
                        == "response.file_search_call.completed"
                    ):

                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "type": "file_search_completed"
                                }
                            )
                            + "\n\n"
                        )


                    # -----------------------------
                    # Completed
                    # -----------------------------

                    elif (
                        event_type
                        == "response.completed"
                    ):

                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "type": "done"
                                }
                            )
                            + "\n\n"
                        )


            except Exception as e:

                print("STREAM ERROR")
                traceback.print_exc()

                yield (
                    "data: "
                    + json.dumps(
                        {
                            "type": "error",
                            "message": str(e)
                        }
                    )
                    + "\n\n"
                )


        return StreamingResponse(

            event_generator(),

            media_type="text/event-stream",

            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )


    except HTTPException:
        raise

    except Exception as e:

        print("CHAT ERROR")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )