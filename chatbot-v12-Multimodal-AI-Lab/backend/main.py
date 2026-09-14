import os
import json
import base64
import asyncio
from typing import Any, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")
REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2.1")

if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured.")

client = OpenAI(api_key=API_KEY)

app = FastAPI(title="GenAI-Labs V12 Multimodal AI Lab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3012", "http://127.0.0.1:3012"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGE_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/gif"
}
DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md"}

class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    image_file_ids: list[str] = []
    vector_store_id: Optional[str] = None
    web_search: bool = False
    model: Optional[str] = None
    system_prompt: Optional[str] = None

class CompareRequest(BaseModel):
    question: str
    image_file_id: Optional[str] = None
    document_file_id: Optional[str] = None
    vector_store_id: Optional[str] = None
    model: Optional[str] = None

class ExperimentRequest(BaseModel):
    question: str
    mode: str = "text"
    image_file_id: Optional[str] = None
    vector_store_id: Optional[str] = None
    web_search: bool = False
    model: Optional[str] = None

@app.get("/")
def root():
    return {
        "name": "GenAI-Labs V12",
        "version": "12.0",
        "module": "Multimodal AI Lab",
        "model": MODEL,
        "features": [
            "cross-modal reasoning",
            "multimodal RAG",
            "vision reasoning",
            "visual comparison",
            "voice + vision",
            "modality experiments"
        ]
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(400, "Please upload a PNG, JPEG, WEBP, or GIF image.")

    contents = await file.read()
    uploaded = client.files.create(
        file=(file.filename, contents, file.content_type),
        purpose="user_data"
    )
    return {
        "file_id": uploaded.id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents)
    }

@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in DOC_EXTENSIONS:
        raise HTTPException(400, "Supported documents: PDF, DOC, DOCX, TXT, MD.")

    contents = await file.read()
    uploaded = client.files.create(
        file=(file.filename, contents),
        purpose="user_data"
    )

    vector_store = client.vector_stores.create(
        name=f"GenAI-Labs V12 - {file.filename}"
    )
    client.vector_stores.files.create_and_poll(
        vector_store_id=vector_store.id,
        file_id=uploaded.id
    )

    return {
        "file_id": uploaded.id,
        "filename": file.filename,
        "vector_store_id": vector_store.id
    }

def latest_user_message(messages: list[dict[str, Any]]) -> dict[str, Any]:
    for message in reversed(messages):
        if message.get("role") == "user":
            return message
    return {"role": "user", "content": "Please analyze the supplied inputs."}

def normalize_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") in {"text", "input_text"}:
                parts.append(str(item.get("text", "")))
        return " ".join(parts).strip()
    return str(content or "")

def multimodal_instructions(mode: str) -> str:
    instructions = {
        "cross_modal": (
            "You are in Cross-Modal Reasoning mode. Analyze all supplied modalities together. "
            "Explicitly distinguish observations from the image, evidence from documents, and "
            "conclusions from reasoning. Identify matches, differences, missing information, "
            "contradictions, and recommendations when relevant."
        ),
        "multimodal_rag": (
            "You are in Multimodal RAG mode. Use retrieved knowledge as grounding and combine "
            "it with the supplied visual input. Do not invent document facts. Clearly state when "
            "an answer is not supported by the retrieved material."
        ),
        "vision": (
            "You are in Vision Reasoning mode. Carefully inspect the supplied image. Explain "
            "visible objects, structure, text, diagrams, charts, relationships, and anomalies "
            "only when supported by the image."
        ),
        "voice_vision": (
            "You are in Voice + Vision mode. Treat the image as visual context for the user's "
            "spoken/text question. Give a concise but useful explanation suitable for spoken output."
        ),
        "modality_compare": (
            "You are in Modality Comparison mode. Compare what can be concluded from the "
            "available modalities. Explain what information becomes available or more reliable "
            "when another modality is added."
        ),
    }
    return instructions.get(mode, "You are a multimodal AI teaching assistant.")

@app.post("/chat")
async def chat(request: ChatRequest):
    messages = [dict(m) for m in request.messages]
    user = latest_user_message(messages)
    text = normalize_text(user.get("content"))

    content = [{"type": "input_text", "text": text or "Analyze the supplied inputs."}]
    for file_id in request.image_file_ids[:6]:
        content.append({
            "type": "input_image",
            "file_id": file_id,
            "detail": "auto"
        })

    rebuilt = []
    replaced = False
    for m in messages:
        if m is user and not replaced:
            rebuilt.append({"role": "user", "content": content})
            replaced = True
        else:
            rebuilt.append(m)

    tools = []
    if request.web_search:
        tools.append({"type": "web_search"})
    if request.vector_store_id:
        tools.append({
            "type": "file_search",
            "vector_store_ids": [request.vector_store_id]
        })

    instructions = request.system_prompt or (
        "You are the GenAI-Labs V12 Multimodal AI Lab assistant. "
        "You teach multimodal AI clearly while answering the user's question. "
        "When multiple modalities are present, reason across them rather than treating them independently."
    )

    kwargs = {
        "model": request.model or MODEL,
        "input": rebuilt,
        "instructions": instructions,
        "stream": True,
    }
    if tools:
        kwargs["tools"] = tools

    async def event_stream():
        try:
            stream = client.responses.create(**kwargs)
            for event in stream:
                event_type = getattr(event, "type", "")
                if event_type == "response.output_text.delta":
                    delta = getattr(event, "delta", "")
                    if delta:
                        yield f"data: {json.dumps({'type':'delta','text':delta})}\n\n"
                elif event_type == "response.completed":
                    yield f"data: {json.dumps({'type':'completed'})}\n\n"
                elif "web_search" in event_type:
                    yield f"data: {json.dumps({'type':'status','text':'Web search in progress…'})}\n\n"
                elif "file_search" in event_type:
                    yield f"data: {json.dumps({'type':'status','text':'Retrieving knowledge…'})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type':'error','text':str(exc)})}\n\n"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@app.post("/cross-modal/compare")
async def cross_modal_compare(request: CompareRequest):
    inputs = [{
        "role": "user",
        "content": [{
            "type": "input_text",
            "text": request.question
        }]
    }]

    if request.image_file_id:
        inputs[0]["content"].append({
            "type": "input_image",
            "file_id": request.image_file_id,
            "detail": "auto"
        })

    tools = []
    if request.vector_store_id:
        tools.append({
            "type": "file_search",
            "vector_store_ids": [request.vector_store_id]
        })

    prompt = (
        "Perform a structured cross-modal comparison. Return sections: "
        "1) Image observations, 2) Document evidence, 3) Matches, 4) Differences, "
        "5) Missing or contradictory information, 6) Conclusion, 7) Recommendations. "
        "Do not claim that a document says something unless retrieval supports it."
    )

    result = client.responses.create(
        model=request.model or MODEL,
        instructions=prompt,
        input=inputs,
        tools=tools or None
    )
    return {"answer": result.output_text}

@app.post("/experiment")
async def experiment(request: ExperimentRequest):
    content = [{"type": "input_text", "text": request.question}]
    if request.image_file_id:
        content.append({
            "type": "input_image",
            "file_id": request.image_file_id,
            "detail": "auto"
        })

    tools = []
    if request.web_search:
        tools.append({"type": "web_search"})
    if request.vector_store_id:
        tools.append({
            "type": "file_search",
            "vector_store_ids": [request.vector_store_id]
        })

    result = client.responses.create(
        model=request.model or MODEL,
        instructions=multimodal_instructions(request.mode),
        input=[{"role": "user", "content": content}],
        tools=tools or None
    )
    return {
        "mode": request.mode,
        "answer": result.output_text
    }

@app.post("/realtime-token")
async def realtime_token():
    result = client.realtime.client_secrets.create(
        session={
            "type": "realtime",
            "model": REALTIME_MODEL,
            "instructions": (
                "You are the GenAI-Labs V12 Voice + Vision assistant. "
                "Answer questions about the visual context supplied by the user."
            ),
            "audio": {"output": {"voice": "marin"}}
        }
    )
    return {"client_secret": result.value}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)
