import base64
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

TRANSCRIBE_MODEL = os.getenv(
    "OPENAI_TRANSCRIBE_MODEL",
    "gpt-transcribe",
)

TTS_MODEL = os.getenv(
    "OPENAI_TTS_MODEL",
    "gpt-4o-mini-tts",
)

TEXT_MODEL = os.getenv(
    "OPENAI_TEXT_MODEL",
    "gpt-5.6-luna",
)

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured in backend/.env"
    )

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(
    title="GenAI-Labs V16",
    description="Speech and Transcription Lab",
    version="16.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3016",
        "http://127.0.0.1:3016",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SpeechRequest(BaseModel):
    text: str
    voice: str = "alloy"


class AnalyzeRequest(BaseModel):
    transcript: str


class TranslationRequest(BaseModel):
    text: str
    target_language: str = "English"


@app.get("/")
def root():
    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V16",
        "name": "Speech & Transcription Lab",
        "transcribe_model": TRANSCRIBE_MODEL,
        "tts_model": TTS_MODEL,
        "text_model": TEXT_MODEL,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "16.0.0",
        "transcribe_model": TRANSCRIBE_MODEL,
        "tts_model": TTS_MODEL,
        "text_model": TEXT_MODEL,
    }


def validate_audio(filename: str, content_type: str):
    allowed_extensions = {
        ".mp3",
        ".mp4",
        ".mpeg",
        ".mpga",
        ".m4a",
        ".wav",
        ".webm",
        ".ogg",
        ".flac",
    }

    extension = os.path.splitext(filename.lower())[1]

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Use MP3, MP4, MPEG, M4A, WAV, WEBM, OGG or FLAC."
            ),
        )

    if not content_type.startswith("audio/") and not (
        content_type == "video/mp4"
    ):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be an audio file.",
        )


@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
):
    filename = audio.filename or "recording.webm"
    content_type = (
        audio.content_type
        or "audio/webm"
    )

    validate_audio(filename, content_type)

    contents = await audio.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded audio file is empty.",
        )

    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Audio file is too large. Please keep it below 25 MB.",
        )

    try:
        audio_file = (
            filename,
            contents,
            content_type,
        )

        kwargs = {
            "model": TRANSCRIBE_MODEL,
            "file": audio_file,
        }

        if language and language != "auto":
            kwargs["language"] = language

        response = client.audio.transcriptions.create(
            **kwargs
        )

        text = getattr(response, "text", "") or ""

        return {
            "success": True,
            "text": text,
            "model": TRANSCRIBE_MODEL,
            "filename": filename,
            "language": language,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {exc}",
        )


@app.post("/speech")
def text_to_speech(request: SpeechRequest):
    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Please provide text to convert to speech.",
        )

    if len(text) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Text is too long. Keep it below 10,000 characters.",
        )

    allowed_voices = {
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "fable",
        "nova",
        "onyx",
        "sage",
        "shimmer",
    }

    if request.voice not in allowed_voices:
        raise HTTPException(
            status_code=400,
            detail="Invalid voice selection.",
        )

    try:
        response = client.audio.speech.create(
            model=TTS_MODEL,
            voice=request.voice,
            input=text,
            response_format="mp3",
        )

        audio_bytes = response.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=500,
                detail="The speech model returned no audio.",
            )

        encoded = base64.b64encode(
            audio_bytes
        ).decode("utf-8")

        return {
            "success": True,
            "model": TTS_MODEL,
            "voice": request.voice,
            "mime_type": "audio/mpeg",
            "audio_base64": encoded,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Speech generation failed: {exc}",
        )


@app.post("/translate")
async def translate_audio(
    audio: UploadFile = File(...),
    target_language: str = Form("English"),
):
    filename = audio.filename or "audio.webm"
    content_type = (
        audio.content_type
        or "audio/webm"
    )

    validate_audio(filename, content_type)

    contents = await audio.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded audio file is empty.",
        )

    try:
        transcription = client.audio.transcriptions.create(
            model=TRANSCRIBE_MODEL,
            file=(
                filename,
                contents,
                content_type,
            ),
        )

        source_text = getattr(
            transcription,
            "text",
            "",
        ) or ""

        if not source_text.strip():
            raise HTTPException(
                status_code=500,
                detail="No speech was detected in the audio.",
            )

        response = client.responses.create(
            model=TEXT_MODEL,
            instructions=f"""
You are a professional translation assistant.

Translate the supplied transcript into {target_language}.

Requirements:
- Preserve the original meaning.
- Do not summarize.
- Do not add explanations.
- Preserve names and technical terms where appropriate.
- Return only the translated text.
""",
            input=source_text,
        )

        translated = (
            response.output_text or ""
        ).strip()

        return {
            "success": True,
            "source_text": source_text,
            "translated_text": translated,
            "target_language": target_language,
            "transcribe_model": TRANSCRIBE_MODEL,
            "text_model": TEXT_MODEL,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Translation failed: {exc}",
        )


@app.post("/analyze-transcript")
def analyze_transcript(
    request: AnalyzeRequest,
):
    transcript = request.transcript.strip()

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Please provide a transcript.",
        )

    if len(transcript) > 50000:
        raise HTTPException(
            status_code=400,
            detail="Transcript is too long.",
        )

    try:
        response = client.responses.create(
            model=TEXT_MODEL,
            instructions="""
You are the transcript analysis engine for GenAI-Labs V16.

Analyze the supplied transcript.

Return a concise but useful analysis with these sections:

SUMMARY:
<summary>

KEY TOPICS:
- topic
- topic

KEY POINTS:
- point
- point

ACTION ITEMS:
- action item
- action item

IMPORTANT TERMS:
- term
- term

Return only these sections.
""",
            input=transcript,
        )

        analysis = (
            response.output_text or ""
        ).strip()

        return {
            "success": True,
            "analysis": analysis,
            "model": TEXT_MODEL,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcript analysis failed: {exc}",
        )


@app.post("/analyze-text")
def analyze_text(
    request: AnalyzeRequest,
):
    return analyze_transcript(request)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8016,
    )