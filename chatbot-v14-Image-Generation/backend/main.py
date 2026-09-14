import base64
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured in backend/.env")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(
    title="GenAI-Labs V14",
    description="Image Generation and Editing Lab",
    version="14.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3014",
        "http://127.0.0.1:3014",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    quality: str = "auto"
    n: int = 1
    background: str = "auto"


@app.get("/")
def root():
    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V14",
        "name": "Image Generation Lab",
        "image_model": IMAGE_MODEL,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "14.0.0",
        "image_model": IMAGE_MODEL,
    }


def image_response_items(response):
    results = []

    for item in getattr(response, "data", []) or []:
        b64 = getattr(item, "b64_json", None)

        if b64:
            results.append(
                {
                    "type": "image",
                    "data": b64,
                }
            )

    return results


@app.post("/generate")
def generate_image(request: GenerateRequest):
    prompt = request.prompt.strip()

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Please provide an image prompt.",
        )

    if len(prompt) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Prompt is too long. Please keep it under 10,000 characters.",
        )

    if request.n < 1 or request.n > 4:
        raise HTTPException(
            status_code=400,
            detail="Number of images must be between 1 and 4.",
        )

    allowed_sizes = {
        "1024x1024",
        "1536x1024",
        "1024x1536",
    }

    if request.size not in allowed_sizes:
        raise HTTPException(
            status_code=400,
            detail="Invalid image size.",
        )

    allowed_quality = {"auto", "low", "medium", "high"}

    if request.quality not in allowed_quality:
        raise HTTPException(
            status_code=400,
            detail="Invalid image quality.",
        )

    allowed_background = {"auto", "opaque", "transparent"}

    if request.background not in allowed_background:
        raise HTTPException(
            status_code=400,
            detail="Invalid background setting.",
        )

    try:
        response = client.images.generate(
            model=IMAGE_MODEL,
            prompt=prompt,
            size=request.size,
            quality=request.quality,
            n=request.n,
            background=request.background,
        )

        images = image_response_items(response)

        if not images:
            raise HTTPException(
                status_code=500,
                detail="The image model returned no image data.",
            )

        return {
            "success": True,
            "mode": "text-to-image",
            "prompt": prompt,
            "model": IMAGE_MODEL,
            "images": images,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {exc}",
        )


@app.post("/edit")
async def edit_image(
    prompt: str = Form(...),
    image: UploadFile = File(...),
    size: str = Form("1024x1024"),
    quality: str = Form("auto"),
    n: int = Form(1),
):
    prompt = prompt.strip()

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Please provide an editing instruction.",
        )

    if n < 1 or n > 4:
        raise HTTPException(
            status_code=400,
            detail="Number of images must be between 1 and 4.",
        )

    allowed_sizes = {
        "1024x1024",
        "1536x1024",
        "1024x1536",
    }

    if size not in allowed_sizes:
        raise HTTPException(
            status_code=400,
            detail="Invalid image size.",
        )

    allowed_quality = {"auto", "low", "medium", "high"}

    if quality not in allowed_quality:
        raise HTTPException(
            status_code=400,
            detail="Invalid image quality.",
        )

    filename = image.filename or "image.png"

    allowed_types = {
        "image/png",
        "image/jpeg",
        "image/webp",
    }

    content_type = image.content_type or "application/octet-stream"

    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PNG, JPEG or WEBP image.",
        )

    contents = await image.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    try:
        response = client.images.edit(
            model=IMAGE_MODEL,
            image=(filename, contents, content_type),
            prompt=prompt,
            size=size,
            quality=quality,
            n=n,
        )

        images = image_response_items(response)

        if not images:
            raise HTTPException(
                status_code=500,
                detail="The image model returned no edited image.",
            )

        return {
            "success": True,
            "mode": "image-edit",
            "prompt": prompt,
            "model": IMAGE_MODEL,
            "images": images,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image editing failed: {exc}",
        )


@app.post("/enhance-prompt")
def enhance_prompt(prompt: str = Form(...)):
    prompt = prompt.strip()

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Enter a short image idea first.",
        )

    if len(prompt) > 4000:
        raise HTTPException(
            status_code=400,
            detail="Prompt is too long.",
        )

    system = """
You are the prompt designer for GenAI-Labs V14.

Turn a short image idea into a strong image-generation prompt.

Preserve the user's actual intent. Add useful visual details such as:
- subject
- environment
- composition
- camera/viewpoint
- lighting
- materials
- mood
- color relationships
- level of realism

Do not add unrelated subjects or change the requested concept.

Return only the improved image prompt, with no explanation.
"""

    try:
        response = client.responses.create(
            model="gpt-5.6-luna",
            instructions=system,
            input=prompt,
        )

        enhanced = response.output_text.strip()

        return {
            "success": True,
            "original": prompt,
            "enhanced": enhanced,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prompt enhancement failed: {exc}",
        )


@app.post("/describe-image")
async def describe_image(image: UploadFile = File(...)):
    """
    Uses a vision-capable text model to describe an uploaded image.
    This gives the V14 lab a useful 'understand before editing' workflow.
    """

    content_type = image.content_type or "image/png"

    if content_type not in {
        "image/png",
        "image/jpeg",
        "image/webp",
    }:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PNG, JPEG or WEBP image.",
        )

    contents = await image.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    encoded = base64.b64encode(contents).decode("utf-8")

    try:
        response = client.responses.create(
            model="gpt-5.6-luna",
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Describe this image for an image-generation "
                                "and editing workflow. Identify the main "
                                "subject, setting, composition, lighting, "
                                "style, colors and important visual details."
                            ),
                        },
                        {
                            "type": "input_image",
                            "image_url": (
                                f"data:{content_type};base64,{encoded}"
                            ),
                        },
                    ],
                }
            ],
        )

        return {
            "success": True,
            "description": response.output_text,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image understanding failed: {exc}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8014,
    )
