import os
import json
import tempfile
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
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
        "OPENAI_API_KEY is not configured."
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
    title="MyAI V4",
    version="4.0"
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
    vector_store_id: str | None = None


# ============================================================
# SYSTEM INSTRUCTIONS
# ============================================================

SYSTEM_INSTRUCTIONS = """
You are MyAI V4.

You are an intelligent AI assistant with:

1. Web search
2. Document/file search

GENERAL:
- Give accurate and useful answers.
- Use Markdown.
- Explain technical subjects step by step.
- Do not invent information.

WEB SEARCH:
Use web search when the user needs current information.

DOCUMENT SEARCH:
If a document has been uploaded and a vector store is available,
use file search to answer questions about that document.

When answering from uploaded documents:
- Prefer information from the uploaded document.
- Do not invent information that is not present.
- If the document does not contain the answer, clearly say so.
- Mention the document when useful.

Never claim to have searched a document if you did not actually
use the file search tool.
"""


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "message": "MyAI V4 backend is running",
        "version": "4.0",
        "model": MODEL,
        "web_search": True,
        "file_search": True
    }


# ============================================================
# UPLOAD DOCUMENT
# ============================================================

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...)
):

    try:

        # ------------------------------------------------------
        # Read uploaded file
        # ------------------------------------------------------

        file_bytes = await file.read()


        # ------------------------------------------------------
        # Create temporary file
        # ------------------------------------------------------

        suffix = ""

        if file.filename and "." in file.filename:

            suffix = "." + file.filename.split(".")[-1]


        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(file_bytes)

            temp_path = temp_file.name


        # ------------------------------------------------------
        # Upload file to OpenAI
        # ------------------------------------------------------

        with open(
            temp_path,
            "rb"
        ) as uploaded_file:

            openai_file = client.files.create(
                file=uploaded_file,
                purpose="assistants"
            )


        # ------------------------------------------------------
        # Create vector store
        # ------------------------------------------------------

        vector_store = client.vector_stores.create(
            name=f"MyAI V4 - {file.filename}"
        )


        # ------------------------------------------------------
        # Add file to vector store
        # ------------------------------------------------------

        client.vector_stores.files.create(
            vector_store_id=vector_store.id,
            file_id=openai_file.id
        )


        # ------------------------------------------------------
        # Remove temporary file
        # ------------------------------------------------------

        try:
            os.remove(temp_path)
        except Exception:
            pass


        return {

            "status": "success",

            "filename":
                file.filename,

            "file_id":
                openai_file.id,

            "vector_store_id":
                vector_store.id,

            "message":
                "File uploaded successfully."

        }


    except Exception as e:

        return {

            "status": "error",

            "message":
                str(e)

        }


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
async def chat(
    request: ChatRequest
):

    messages = [

        {
            "role": message.role,
            "content": message.content
        }

        for message in request.messages

    ]


    def generate():

        try:

            # --------------------------------------------------
            # TOOLS
            # --------------------------------------------------

            tools = [

                {
                    "type": "web_search"
                }

            ]


            # --------------------------------------------------
            # FILE SEARCH
            # --------------------------------------------------

            if request.vector_store_id:

                tools.append(

                    {
                        "type": "file_search",

                        "vector_store_ids": [
                            request.vector_store_id
                        ]
                    }

                )


            # --------------------------------------------------
            # RESPONSE
            # --------------------------------------------------

            stream = client.responses.create(

                model=MODEL,

                instructions=
                    SYSTEM_INSTRUCTIONS,

                input=messages,

                tools=tools,

                stream=True

            )


            # --------------------------------------------------
            # PROCESS STREAM
            # --------------------------------------------------

            for event in stream:


                # ----------------------------------------------
                # TEXT
                # ----------------------------------------------

                if event.type == \
                    "response.output_text.delta":

                    data = {

                        "type":
                            "delta",

                        "text":
                            event.delta

                    }

                    yield (
                        f"data: "
                        f"{json.dumps(data)}"
                        f"\n\n"
                    )


                # ----------------------------------------------
                # WEB SEARCH
                # ----------------------------------------------

                elif event.type == \
                    "response.web_search_call.in_progress":

                    data = {

                        "type":
                            "search_start"

                    }

                    yield (
                        f"data: "
                        f"{json.dumps(data)}"
                        f"\n\n"
                    )


                elif event.type == \
                    "response.web_search_call.searching":

                    data = {

                        "type":
                            "searching"

                    }

                    yield (
                        f"data: "
                        f"{json.dumps(data)}"
                        f"\n\n"
                    )


                elif event.type == \
                    "response.web_search_call.completed":

                    data = {

                        "type":
                            "search_complete"

                    }

                    yield (
                        f"data: "
                        f"{json.dumps(data)}"
                        f"\n\n"
                    )


                # ----------------------------------------------
                # RESPONSE COMPLETE
                # ----------------------------------------------

                elif event.type == \
                    "response.completed":

                    data = {

                        "type":
                            "done"

                    }

                    yield (
                        f"data: "
                        f"{json.dumps(data)}"
                        f"\n\n"
                    )


        except Exception as e:

            data = {

                "type":
                    "error",

                "message":
                    str(e)

            }

            yield (
                f"data: "
                f"{json.dumps(data)}"
                f"\n\n"
            )


    return StreamingResponse(

        generate(),

        media_type=
            "text/event-stream",

        headers={

            "Cache-Control":
                "no-cache",

            "Connection":
                "keep-alive",

            "X-Accel-Buffering":
                "no"

        }

    )