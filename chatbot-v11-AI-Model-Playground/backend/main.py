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


# =========================================================
# ENVIRONMENT
# =========================================================

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

client = OpenAI(
    api_key=OPENAI_API_KEY
)


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="GenAI-Labs V11",
    description="GenAI-Labs Advanced RAG Laboratory",
    version="11.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3011",
        "http://127.0.0.1:3011",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# MODELS
# =========================================================

MODELS = {
    "gpt-5.6-luna": {
        "id": "gpt-5.6-luna",
        "name": "GPT-5.6 Luna",
        "description": "Cost-sensitive / high-volume",
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
        "description": "Advanced reasoning and coding",
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


# =========================================================
# DATA MODELS
# =========================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class RagChatRequest(BaseModel):

    messages: List[ChatMessage]

    model: Optional[str] = None

    reasoning_effort: Optional[str] = "medium"

    vector_store_id: Optional[str] = None

    system_prompt: Optional[str] = None

    use_web_search: bool = False


class RagCompareRequest(BaseModel):

    messages: List[ChatMessage]

    model_a: str

    model_b: str

    reasoning_a: Optional[str] = "medium"

    reasoning_b: Optional[str] = "medium"

    vector_store_id: Optional[str] = None

    system_prompt: Optional[str] = None


class KnowledgeBaseRequest(BaseModel):

    name: str


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V11",
        "name": "Advanced RAG Lab",

        "default_model": DEFAULT_MODEL,

        "realtime_model": REALTIME_MODEL,

        "authentication": False,

        "database": False,

        "persistent_memory": False,

        "web_search": True,

        "file_search": True,

        "rag_lab": True,

        "rag_comparison": True,

        "vision": True,

        "voice": True,
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "version": "11.0.0",
        "default_model": DEFAULT_MODEL,
    }


# =========================================================
# MODELS
# =========================================================

@app.get("/models")
def get_models():

    return {
        "default_model": DEFAULT_MODEL,
        "models": list(MODELS.values()),
    }


# =========================================================
# CREATE KNOWLEDGE BASE
# =========================================================

@app.post("/knowledge-base")
async def create_knowledge_base(
    request: KnowledgeBaseRequest
):

    name = request.name.strip()

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Knowledge base name is required."
        )

    try:

        vector_store = client.vector_stores.create(
            name=name
        )

        return {
            "success": True,
            "vector_store_id": vector_store.id,
            "name": vector_store.name,
        }

    except Exception as e:

        print(
            "KNOWLEDGE BASE ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Knowledge base creation failed: "
                + str(e)
            )
        )


# =========================================================
# DOCUMENT UPLOAD
# =========================================================

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),

    vector_store_id: Optional[str] = None,
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
            detail=(
                "Unsupported document type. "
                "Use PDF, TXT, DOC or DOCX."
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
                contents
            ),
            purpose="user_data"
        )

        # -------------------------------------------------
        # Use existing knowledge base if supplied
        # -------------------------------------------------

        if vector_store_id:

            current_vector_store_id = vector_store_id

        else:

            vector_store = (
                client.vector_stores.create(
                    name=f"GenAI-Labs V11 - {filename}"
                )
            )

            current_vector_store_id = (
                vector_store.id
            )

        # -------------------------------------------------
        # Add file to vector store
        # -------------------------------------------------

        vector_store_file = (
            client.vector_stores.files.create_and_poll(
                vector_store_id=current_vector_store_id,

                file_id=uploaded_file.id,
            )
        )

        return {

            "success": True,

            "filename": filename,

            "file_id": uploaded_file.id,

            "vector_store_id":
                current_vector_store_id,

            "vector_store_file_id":
                vector_store_file.id,

            "status":
                getattr(
                    vector_store_file,
                    "status",
                    "completed"
                ),

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
            detail=(
                "Document upload failed: "
                + str(e)
            )
        )


# =========================================================
# IMAGE UPLOAD
# =========================================================

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
                detail="The image is empty."
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

            "filename":
                file.filename,

            "file_id":
                uploaded_file.id,

            "type":
                "image",
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "IMAGE UPLOAD ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image upload failed: "
                + str(e)
            )
        )


# =========================================================
# KNOWLEDGE BASE DETAILS
# =========================================================

@app.get("/knowledge-base/{vector_store_id}")
async def knowledge_base_details(
    vector_store_id: str
):

    try:

        vector_store = (
            client.vector_stores.retrieve(
                vector_store_id
            )
        )

        files = (
            client.vector_stores.files.list(
                vector_store_id=
                    vector_store_id
            )
        )

        file_list = []

        for item in files.data:

            file_list.append({
                "id": item.id,
                "file_id":
                    getattr(
                        item,
                        "file_id",
                        None
                    ),
                "status":
                    getattr(
                        item,
                        "status",
                        "unknown"
                    ),
            })

        return {

            "success": True,

            "id":
                vector_store.id,

            "name":
                vector_store.name,

            "status":
                getattr(
                    vector_store,
                    "status",
                    "unknown"
                ),

            "file_count":
                len(file_list),

            "files":
                file_list,
        }

    except Exception as e:

        print(
            "KNOWLEDGE BASE DETAILS ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# SSE
# =========================================================

def create_sse(data):

    return (
        f"data: {json.dumps(data)}\n\n"
    )


# =========================================================
# SYSTEM INSTRUCTIONS
# =========================================================

def build_rag_instructions(
    system_prompt=None
):

    instructions = """

You are GenAI-Labs V11,
an Advanced Retrieval-Augmented Generation
(RAG) laboratory assistant.

Your primary purpose is to help users understand
and experiment with RAG systems.

When a knowledge base is available:

1. Use file search to retrieve relevant information.
2. Ground the answer in the retrieved information.
3. Do not invent information that is not supported
   by the retrieved documents.
4. Explain when the available documents do not
   contain enough information.
5. When possible, clearly distinguish information
   retrieved from the knowledge base from general
   model knowledge.

When answering technical questions:

1. Explain the concept simply.
2. Show the RAG pipeline.
3. Explain retrieval.
4. Explain how the retrieved context reaches the LLM.
5. Give a practical example.

The user is learning about RAG, embeddings,
vector stores, retrieval, chunking, grounding,
hallucinations and AI application architecture.

Be clear, educational and technically accurate.

Do not claim a document contains something unless
the retrieval results support it.
"""

    if system_prompt and system_prompt.strip():

        instructions += """

USER-PROVIDED SYSTEM INSTRUCTIONS:

""" + system_prompt.strip()

    return instructions


# =========================================================
# VALIDATE MODEL
# =========================================================

def validate_model(model):

    if model not in MODELS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported model: {model}"
            )
        )

    return model


# =========================================================
# RAG CHAT
# =========================================================

@app.post("/chat")
async def chat(
    request: RagChatRequest
):

    if not request.messages:

        raise HTTPException(
            status_code=400,
            detail="At least one message is required."
        )

    model = (
        request.model
        or DEFAULT_MODEL
    )

    validate_model(model)

    reasoning = (
        request.reasoning_effort
        or "medium"
    )

    if reasoning not in MODELS[model][
        "reasoning_levels"
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid reasoning level: "
                f"{reasoning}"
            )
        )

    if not request.vector_store_id:

        raise HTTPException(
            status_code=400,
            detail=(
                "Please select or create a "
                "knowledge base first."
            )
        )

    input_messages = []

    for message in request.messages:

        input_messages.append({
            "role": message.role,
            "content": message.content,
        })

    tools = [
        {
            "type": "file_search",

            "vector_store_ids": [
                request.vector_store_id
            ],
        }
    ]

    if request.use_web_search:

        tools.append(
            {
                "type": "web_search"
            }
        )

    instructions = build_rag_instructions(
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
                    "effort": reasoning
                },

                stream=True,
            )

            for event in stream:

                # -----------------------------------------
                # TEXT DELTA
                # -----------------------------------------

                if (
                    event.type ==
                    "response.output_text.delta"
                ):

                    text = event.delta

                    if text:

                        yield create_sse({
                            "type":
                                "delta",

                            "text":
                                text,
                        })

                # -----------------------------------------
                # FILE SEARCH
                # -----------------------------------------

                elif (
                    event.type ==
                    "response.file_search_call.searching"
                ):

                    yield create_sse({

                        "type":
                            "retrieval",

                        "status":
                            "searching",
                    })

                elif (
                    event.type ==
                    "response.file_search_call.completed"
                ):

                    yield create_sse({

                        "type":
                            "retrieval",

                        "status":
                            "completed",
                    })

                # -----------------------------------------
                # RESPONSE COMPLETED
                # -----------------------------------------

                elif (
                    event.type ==
                    "response.completed"
                ):

                    elapsed = round(
                        time.time()
                        - start_time,
                        2
                    )

                    response = event.response

                    usage = None

                    if response.usage:

                        usage = {

                            "input_tokens":
                                response.usage
                                .input_tokens,

                            "output_tokens":
                                response.usage
                                .output_tokens,

                            "total_tokens":
                                response.usage
                                .total_tokens,
                        }

                    yield create_sse({

                        "type":
                            "completed",

                        "model":
                            model,

                        "reasoning":
                            reasoning,

                        "elapsed_seconds":
                            elapsed,

                        "usage":
                            usage,
                    })

                # -----------------------------------------
                # ERROR
                # -----------------------------------------

                elif (
                    event.type ==
                    "error"
                ):

                    error_message = (
                        getattr(
                            event,
                            "message",
                            None
                        )
                        or
                        "OpenAI returned an error."
                    )

                    yield create_sse({

                        "type":
                            "error",

                        "message":
                            error_message,
                    })

            yield "data: [DONE]\n\n"

        except Exception as e:

            print(
                "RAG STREAM ERROR:",
                str(e)
            )

            yield create_sse({

                "type":
                    "error",

                "message":
                    str(e),
            })

            yield "data: [DONE]\n\n"

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
                "no",
        },
    )


# =========================================================
# RAG VS NORMAL LLM
# =========================================================

@app.post("/compare")
async def compare(
    request: RagCompareRequest
):

    validate_model(
        request.model_a
    )

    validate_model(
        request.model_b
    )

    if not request.vector_store_id:

        raise HTTPException(
            status_code=400,
            detail=(
                "A knowledge base is required "
                "for RAG comparison."
            )
        )

    input_messages = [

        {
            "role":
                message.role,

            "content":
                message.content,
        }

        for message in request.messages
    ]

    instructions = build_rag_instructions(
        request.system_prompt
    )

    async def run_model(
        model,
        reasoning
    ):

        start = time.time()

        try:

            response = client.responses.create(

                model=model,

                instructions=instructions,

                input=input_messages,

                tools=[
                    {
                        "type":
                            "file_search",

                        "vector_store_ids": [
                            request.vector_store_id
                        ],
                    }
                ],

                reasoning={
                    "effort":
                        reasoning
                },
            )

            elapsed = round(
                time.time() - start,
                2
            )

            usage = None

            if response.usage:

                usage = {

                    "input_tokens":
                        response.usage
                        .input_tokens,

                    "output_tokens":
                        response.usage
                        .output_tokens,

                    "total_tokens":
                        response.usage
                        .total_tokens,
                }

            return {

                "success":
                    True,

                "model":
                    model,

                "text":
                    response.output_text,

                "elapsed":
                    elapsed,

                "usage":
                    usage,

                "reasoning":
                    reasoning,
            }

        except Exception as e:

            return {

                "success":
                    False,

                "model":
                    model,

                "text":
                    "",

                "error":
                    str(e),
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

        "success":
            True,

        "model_a":
            result_a,

        "model_b":
            result_b,
    }


# =========================================================
# REALTIME VOICE
# =========================================================

@app.post("/realtime-token")
async def realtime_token():

    try:

        result = (
            client.realtime.client_secrets.create(

                session={

                    "type":
                        "realtime",

                    "model":
                        REALTIME_MODEL,

                    "instructions": """
You are the voice assistant for
GenAI-Labs V11.

Help students understand:

- RAG
- embeddings
- vector databases
- retrieval
- chunking
- grounding
- hallucinations
- LLMs
- AI architecture

Explain concepts conversationally
and with simple examples.
""",

                    "audio": {

                        "output": {

                            "voice":
                                "marin"
                        }
                    },
                }
            )
        )

        return {

            "success":
                True,

            "client_secret":
                result.client_secret,

            "model":
                REALTIME_MODEL,
        }

    except Exception as e:

        print(
            "REALTIME ERROR:",
            str(e)
        )

        raise HTTPException(

            status_code=500,

            detail=(
                "Realtime token creation failed: "
                + str(e)
            )
        )


# =========================================================
# RUN
# =========================================================

if __name__ == "__main__":

    import uvicorn

    print("")
    print("==============================================")
    print("       GenAI-Labs V11")
    print("       ADVANCED RAG LAB")
    print("==============================================")
    print("")
    print(
        f"Default Model: {DEFAULT_MODEL}"
    )
    print(
        f"Realtime: {REALTIME_MODEL}"
    )
    print("")
    print("Authentication: OFF")
    print("Database: OFF")
    print("Persistent Memory: OFF")
    print("File Search: ON")
    print("Knowledge Bases: ON")
    print("RAG Pipeline: ON")
    print("RAG Comparison: ON")
    print("Web Search: ON")
    print("Vision: ON")
    print("Voice: ON")
    print("")
    print("Backend: http://localhost:8011")
    print("==============================================")
    print("")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8011
    )