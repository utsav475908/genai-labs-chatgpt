import os
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Depends
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from openai import OpenAI
from pwdlib import PasswordHash
from jose import jwt, JWTError

from database import (
    init_db,
    create_user,
    get_user_by_email,
    get_user_by_id,
    create_conversation,
    list_conversations,
    get_conversation,
    add_message,
    get_messages,
    delete_conversation,
    add_memory,
    get_memories,
    delete_memory,
)

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

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "CHANGE_THIS_V8_SECRET"
)

JWT_ALGORITHM = "HS256"

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured"
    )

client = OpenAI(
    api_key=OPENAI_API_KEY
)

password_hash = PasswordHash.recommended()

security = HTTPBearer()

init_db()

app = FastAPI(
    title="GenAI-Labs V8",
    version="8.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


SYSTEM_INSTRUCTIONS = """
You are GenAI-Labs V8.

You are a helpful AI assistant.

You can:

- Answer normal questions.
- Search the web when current information is needed.
- Answer questions about uploaded documents.
- Analyze uploaded images.
- Have natural voice conversations.

The application supports authenticated users,
persistent conversations and persistent memories.

Use user memories only when relevant.

Do not invent memories.

Be clear, accurate and practical.

When current information is required,
use web search.

When a document is attached,
use file search when appropriate.

When an image is attached,
analyze it carefully.

Keep answers reasonably concise unless
the user requests a detailed explanation.
"""


# ---------------------------------------------------------
# AUTH
# ---------------------------------------------------------

class RegisterRequest(BaseModel):

    name: str

    email: EmailStr

    password: str


class LoginRequest(BaseModel):

    email: EmailStr

    password: str


def create_access_token(user_id):

    expires = datetime.now(
        timezone.utc
    ) + timedelta(
        hours=24
    )

    payload = {
        "sub": str(user_id),
        "exp": expires
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials =
        Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = get_user_by_id(
        int(user_id)
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


@app.post("/auth/register")
def register(
    request: RegisterRequest
):

    name = request.name.strip()
    email = request.email.lower()

    if len(name) < 2:

        raise HTTPException(
            status_code=400,
            detail="Name is too short"
        )

    if len(request.password) < 8:

        raise HTTPException(
            status_code=400,
            detail=
            "Password must be at least 8 characters"
        )

    existing = get_user_by_email(email)

    if existing:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = password_hash.hash(
        request.password
    )

    user_id = create_user(
        name,
        email,
        hashed_password
    )

    token = create_access_token(
        user_id
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": name,
            "email": email
        }
    }


@app.post("/auth/login")
def login(
    request: LoginRequest
):

    email = request.email.lower()

    user = get_user_by_email(
        email
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    try:

        valid = password_hash.verify(
            request.password,
            user["password_hash"]
        )

    except Exception:

        valid = False

    if not valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(
        user["id"]
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }


@app.get("/auth/me")
def me(
    user=Depends(get_current_user)
):

    return user


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
def root():

    return {
        "status": "ok",
        "message":
            "GenAI-Labs V8 backend is running",
        "version": "8.0",
        "model": MODEL,
        "realtime_model": REALTIME_MODEL,
        "web_search": True,
        "file_search": True,
        "image_recognition": True,
        "voice": True,
        "database": True,
        "persistent_memory": True,
        "authentication": True
    }


# ---------------------------------------------------------
# CONVERSATIONS
# ---------------------------------------------------------

class CreateConversationRequest(BaseModel):

    title: Optional[str] = "New Chat"


@app.post("/conversations")
def new_conversation(
    request: CreateConversationRequest,
    user=Depends(get_current_user)
):

    conversation_id = create_conversation(
        user["id"],
        request.title or "New Chat"
    )

    return {
        "id": conversation_id,
        "title": request.title or "New Chat"
    }


@app.get("/conversations")
def conversations(
    user=Depends(get_current_user)
):

    return list_conversations(
        user["id"]
    )


@app.get("/conversations/{conversation_id}")
def conversation(
    conversation_id: int,
    user=Depends(get_current_user)
):

    item = get_conversation(
        conversation_id,
        user["id"]
    )

    if not item:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {
        "conversation": item,
        "messages": get_messages(
            conversation_id,
            user["id"]
        )
    }


@app.delete("/conversations/{conversation_id}")
def remove_conversation(
    conversation_id: int,
    user=Depends(get_current_user)
):

    item = get_conversation(
        conversation_id,
        user["id"]
    )

    if not item:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    delete_conversation(
        conversation_id,
        user["id"]
    )

    return {
        "status": "deleted"
    }


# ---------------------------------------------------------
# MEMORY
# ---------------------------------------------------------

class MemoryRequest(BaseModel):

    memory: str


@app.get("/memories")
def memories(
    user=Depends(get_current_user)
):

    return get_memories(
        user["id"]
    )


@app.post("/memories")
def save_memory(
    request: MemoryRequest,
    user=Depends(get_current_user)
):

    memory = request.memory.strip()

    if not memory:

        raise HTTPException(
            status_code=400,
            detail="Memory cannot be empty"
        )

    add_memory(
        user["id"],
        memory
    )

    return {
        "status": "saved",
        "memory": memory
    }


@app.delete("/memories/{memory_id}")
def remove_memory(
    memory_id: int,
    user=Depends(get_current_user)
):

    delete_memory(
        memory_id,
        user["id"]
    )

    return {
        "status": "deleted"
    }


# ---------------------------------------------------------
# IMAGE UPLOAD
# ---------------------------------------------------------

@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    if not file.content_type.startswith(
        "image/"
    ):

        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed"
        )

    contents = await file.read()

    try:

        uploaded = client.files.create(
            file=(
                file.filename,
                contents,
                file.content_type
            ),
            purpose="user_data"
        )

        return {
            "file_id": uploaded.id,
            "filename": file.filename,
            "content_type": file.content_type
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ---------------------------------------------------------
# DOCUMENT UPLOAD
# ---------------------------------------------------------

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):

    filename = file.filename or "document"

    contents = await file.read()

    try:

        uploaded = client.files.create(
            file=(
                filename,
                contents
            ),
            purpose="user_data"
        )

        vector_store = client.vector_stores.create(
            name=f"GenAI-Labs - {filename}"
        )

        vector_store_file = (
            client.vector_stores.files
            .create_and_poll(
                vector_store_id=vector_store.id,
                file_id=uploaded.id
            )
        )

        return {
            "file_id": uploaded.id,
            "vector_store_id":
                vector_store.id,
            "vector_store_file_id":
                vector_store_file.id,
            "filename": filename
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ---------------------------------------------------------
# CHAT
# ---------------------------------------------------------

class ChatRequest(BaseModel):

    conversation_id: int

    messages: list

    vector_store_id: Optional[str] = None

    image_file_id: Optional[str] = None


@app.post("/chat")
def chat(
    request: ChatRequest,
    user=Depends(get_current_user)
):

    conversation = get_conversation(
        request.conversation_id,
        user["id"]
    )

    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    if not request.messages:

        raise HTTPException(
            status_code=400,
            detail="Messages are required"
        )

    latest = request.messages[-1]

    if latest.get("role") == "user":

        content = latest.get(
            "content",
            ""
        )

        if isinstance(content, str):

            add_message(
                request.conversation_id,
                user["id"],
                "user",
                content
            )

    input_messages = (
        request.messages.copy()
    )

    if request.image_file_id:

        latest = input_messages[-1]

        existing_text = latest.get(
            "content",
            ""
        )

        input_messages[-1] = {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": existing_text
                },
                {
                    "type": "input_image",
                    "file_id":
                        request.image_file_id,
                    "detail": "auto"
                }
            ]
        }

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
                ]
            }
        )

    def generate():

        assistant_text = ""

        try:

            stream = client.responses.create(
                model=MODEL,
                instructions=
                    SYSTEM_INSTRUCTIONS,
                input=input_messages,
                tools=tools,
                max_output_tokens=4000,
                stream=True
            )

            for event in stream:

                event_type = getattr(
                    event,
                    "type",
                    ""
                )

                if (
                    event_type ==
                    "response.output_text.delta"
                ):

                    delta = getattr(
                        event,
                        "delta",
                        ""
                    )

                    assistant_text += delta

                    yield (
                        "data: "
                        + json.dumps({
                            "type": "delta",
                            "text": delta
                        })
                        + "\n\n"
                    )

                elif (
                    event_type ==
                    "response.web_search_call.in_progress"
                ):

                    yield (
                        "data: "
                        + json.dumps({
                            "type": "status",
                            "message":
                                "Searching the web..."
                        })
                        + "\n\n"
                    )

                elif (
                    event_type ==
                    "response.file_search_call.in_progress"
                ):

                    yield (
                        "data: "
                        + json.dumps({
                            "type": "status",
                            "message":
                                "Searching your document..."
                        })
                        + "\n\n"
                    )

                elif (
                    event_type ==
                    "response.completed"
                ):

                    if assistant_text.strip():

                        add_message(
                            request.conversation_id,
                            user["id"],
                            "assistant",
                            assistant_text
                        )

                    yield (
                        "data: "
                        + json.dumps({
                            "type": "done"
                        })
                        + "\n\n"
                    )

        except Exception as e:

            print(
                "Chat error:",
                repr(e)
            )

            yield (
                "data: "
                + json.dumps({
                    "type": "error",
                    "message": str(e)
                })
                + "\n\n"
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


# ---------------------------------------------------------
# REALTIME VOICE
# ---------------------------------------------------------

@app.post("/realtime-token")
def realtime_token(
    user=Depends(get_current_user)
):

    try:

        result = (
            client.realtime
            .client_secrets
            .create(
                session={
                    "type": "realtime",
                    "model":
                        REALTIME_MODEL,
                    "instructions": """
You are GenAI-Labs V8.

You are a friendly AI assistant.

Speak naturally and clearly.

Give useful explanations.

When the user asks a simple question,
answer directly.

When the user asks for technical help,
explain step by step.

You are part of the GenAI-Labs AI
and robotics learning platform.
""",
                    "audio": {
                        "output": {
                            "voice": "marin"
                        }
                    }
                }
            )
        )

        return {
            "client_secret":
                result.value,
            "expires_at":
                result.expires_at,
            "model":
                REALTIME_MODEL
        }

    except Exception as e:

        print(
            "Realtime error:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )