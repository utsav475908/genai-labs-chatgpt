import json
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured in backend/.env")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(
    title="GenAI-Labs V13",
    description="Data Analysis and Code Interpreter Lab",
    version="13.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3013",
        "http://127.0.0.1:3013",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class AnalysisRequest(BaseModel):
    messages: List[ChatMessage]
    file_ids: List[str] = []
    model: Optional[str] = None


@app.get("/")
def root():
    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V13",
        "name": "Data Analysis / Code Interpreter Lab",
        "model": MODEL,
        "code_interpreter": True,
        "csv": True,
        "excel": True,
        "charts": True,
        "python": True,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "13.0.0",
        "model": MODEL,
    }


@app.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    filename = file.filename or "dataset"
    extension = filename.lower().split(".")[-1]

    supported = {
        "csv",
        "xlsx",
        "xls",
        "json",
        "txt",
        "tsv",
        "pdf",
    }

    if extension not in supported:
        raise HTTPException(
            status_code=400,
            detail="Supported files: CSV, XLSX, XLS, JSON, TXT, TSV and PDF.",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        uploaded = client.files.create(
            file=(
                filename,
                contents,
                file.content_type or "application/octet-stream",
            ),
            purpose="user_data",
        )

        return {
            "success": True,
            "filename": filename,
            "file_id": uploaded.id,
            "extension": extension,
            "content_type": file.content_type,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset upload failed: {exc}",
        )


def sse(data):
    return f"data: {json.dumps(data)}\n\n"


def build_instructions():
    return """
You are GenAI-Labs V13, the Data Analysis and Code Interpreter Lab assistant.

Your main job is to teach and demonstrate AI-powered data analysis.

When files are attached:
- Inspect the files with the Code Interpreter tool.
- For CSV, TSV, XLSX and XLS files, use Python and pandas when appropriate.
- For JSON files, inspect the structure and analyze the data.
- For PDFs or text files, extract useful information and analyze it.
- Never invent numbers that are not supported by the uploaded data.
- Show important calculations clearly.
- When useful, create charts with Python/matplotlib.
- Prefer readable tables and concise findings.
- Explain the Python/data-analysis approach in beginner-friendly language.

For data analysis questions, try to provide:
1. Answer
2. Evidence from the dataset
3. Important calculations
4. A useful chart when appropriate
5. Short interpretation
6. Python/code explanation when educational

If the user asks for code, provide the relevant Python code and explain it.

If the dataset contains missing values, duplicates, unusual values, or obvious data-quality issues, mention them.

If the user asks a question that cannot be answered from the uploaded data, say exactly what is missing.

You are an educational lab assistant. Do not claim that a chart, calculation, or file was created unless the Code Interpreter actually completed it.
"""


@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="At least one user message is required.",
        )

    selected_model = request.model or MODEL

    input_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in request.messages
    ]

    tools = [
        {
            "type": "code_interpreter",
            "container": {
                "type": "auto",
                "file_ids": request.file_ids,
            },
        }
    ]

    try:
        response = client.responses.create(
            model=selected_model,
            instructions=build_instructions(),
            input=input_messages,
            tools=tools,
        )

        output_text = getattr(response, "output_text", "") or ""

        generated_files = []

        for item in getattr(response, "output", []) or []:
            for content in getattr(item, "content", []) or []:
                annotations = getattr(content, "annotations", []) or []

                for annotation in annotations:
                    annotation_type = getattr(annotation, "type", "")

                    if annotation_type == "container_file_citation":
                        generated_files.append(
                            {
                                "filename": getattr(
                                    annotation, "filename", None
                                ),
                                "file_id": getattr(
                                    annotation, "file_id", None
                                ),
                                "container_id": getattr(
                                    annotation, "container_id", None
                                ),
                            }
                        )

        return {
            "success": True,
            "answer": output_text,
            "generated_files": generated_files,
            "model": selected_model,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Data analysis failed: {exc}",
        )


@app.post("/clear-files")
async def clear_files():
    # Files are intentionally left in the OpenAI project so the user can
    # continue using them in the same lab session. This endpoint is provided
    # for future cleanup functionality.
    return {
        "success": True,
        "message": "Local V13 state cleared. Uploaded OpenAI files were not deleted.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8013,
    )
