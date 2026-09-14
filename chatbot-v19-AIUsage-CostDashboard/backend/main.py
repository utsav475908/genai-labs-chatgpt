import os
import sqlite3
import time
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured. Check the .env file.")

MODEL = os.getenv("OPENAI_USAGE_MODEL", "gpt-6-astra")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(
    title="GenAI-Labs V19 - AI Usage & Cost Dashboard",
    version="19.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3019",
        "http://127.0.0.1:3019",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "usage.db",
)


# ---------------------------------------------------------
# MODEL PRICING
# ---------------------------------------------------------

# These are configurable estimates.
# Update them according to the pricing applicable to your
# OpenAI project/model.

MODEL_PRICING = {
    "gpt-6-astra": {
        "input_per_1m": 5.00,
        "output_per_1m": 20.00,
    },
    "gpt-5.6-luna": {
        "input_per_1m": 1.00,
        "output_per_1m": 5.00,
    },
}


# ---------------------------------------------------------
# DATABASE
# ---------------------------------------------------------

def get_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    connection = get_db()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            model TEXT NOT NULL,
            operation TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            estimated_cost REAL DEFAULT 0,
            latency_ms INTEGER DEFAULT 0,
            success INTEGER DEFAULT 1
        )
        """
    )

    connection.commit()
    connection.close()


init_db()


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    operation: str = "chat"


class UsageLogRequest(BaseModel):
    model: str
    operation: str = "manual"
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    success: bool = True


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def calculate_cost(model, input_tokens, output_tokens):
    pricing = MODEL_PRICING.get(
        model,
        {
            "input_per_1m": 0,
            "output_per_1m": 0,
        },
    )

    input_cost = (
        input_tokens / 1_000_000
    ) * pricing["input_per_1m"]

    output_cost = (
        output_tokens / 1_000_000
    ) * pricing["output_per_1m"]

    return input_cost + output_cost


def log_usage(
    model,
    operation,
    input_tokens,
    output_tokens,
    latency_ms,
    success=True,
):
    total_tokens = input_tokens + output_tokens

    estimated_cost = calculate_cost(
        model,
        input_tokens,
        output_tokens,
    )

    timestamp = datetime.now(timezone.utc).isoformat()

    connection = get_db()

    connection.execute(
        """
        INSERT INTO usage_logs (
            timestamp,
            model,
            operation,
            input_tokens,
            output_tokens,
            total_tokens,
            estimated_cost,
            latency_ms,
            success
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            timestamp,
            model,
            operation,
            input_tokens,
            output_tokens,
            total_tokens,
            estimated_cost,
            latency_ms,
            1 if success else 0,
        ),
    )

    connection.commit()
    connection.close()

    return estimated_cost


def get_response_text(response):
    try:
        if response.output_text:
            return response.output_text
    except Exception:
        pass

    try:
        parts = []

        for item in response.output:

            if getattr(item, "type", None) != "message":
                continue

            for content in getattr(item, "content", []):

                if getattr(content, "type", None) in {
                    "output_text",
                    "text",
                }:

                    text = getattr(
                        content,
                        "text",
                        None,
                    )

                    if text:
                        parts.append(text)

        return "\n".join(parts)

    except Exception:
        return ""


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/")
def root():

    return {
        "application": "GenAI-Labs",
        "version": "19.0.0",
        "module": "AI Usage & Cost Dashboard",
        "model": MODEL,
        "status": "running",
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "version": "19.0.0",
        "module": "AI Usage & Cost Dashboard",
        "model": MODEL,
    }


# ---------------------------------------------------------
# AI CHAT WITH USAGE LOGGING
# ---------------------------------------------------------

@app.post("/chat")
def chat(request: ChatRequest):

    if not request.prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Prompt cannot be empty.",
        )

    selected_model = request.model or MODEL

    start_time = time.perf_counter()

    try:

        response = client.responses.create(
            model=selected_model,
            input=request.prompt,
        )

        latency_ms = int(
            (time.perf_counter() - start_time) * 1000
        )

        input_tokens = 0
        output_tokens = 0

        try:

            usage = response.usage

            input_tokens = int(
                getattr(
                    usage,
                    "input_tokens",
                    0,
                )
                or 0
            )

            output_tokens = int(
                getattr(
                    usage,
                    "output_tokens",
                    0,
                )
                or 0
            )

        except Exception:
            pass

        cost = log_usage(
            selected_model,
            request.operation,
            input_tokens,
            output_tokens,
            latency_ms,
            True,
        )

        return {
            "success": True,
            "model": selected_model,
            "result": get_response_text(response),
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
            "estimated_cost": cost,
            "latency_ms": latency_ms,
        }

    except Exception as exc:

        latency_ms = int(
            (time.perf_counter() - start_time) * 1000
        )

        log_usage(
            selected_model,
            request.operation,
            0,
            0,
            latency_ms,
            False,
        )

        raise HTTPException(
            status_code=500,
            detail=f"OpenAI request failed: {str(exc)}",
        )


# ---------------------------------------------------------
# MANUAL USAGE LOG
# ---------------------------------------------------------

@app.post("/usage/log")
def create_usage_log(request: UsageLogRequest):

    cost = log_usage(
        request.model,
        request.operation,
        request.input_tokens,
        request.output_tokens,
        request.latency_ms,
        request.success,
    )

    return {
        "success": True,
        "estimated_cost": cost,
    }


# ---------------------------------------------------------
# DASHBOARD SUMMARY
# ---------------------------------------------------------

@app.get("/usage/summary")
def usage_summary():

    connection = get_db()

    row = connection.execute(
        """
        SELECT
            COUNT(*) AS requests,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(estimated_cost), 0) AS total_cost,
            COALESCE(AVG(latency_ms), 0) AS avg_latency,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
        FROM usage_logs
        """
    ).fetchone()

    connection.close()

    return {
        "requests": row["requests"],
        "input_tokens": row["input_tokens"],
        "output_tokens": row["output_tokens"],
        "total_tokens": row["total_tokens"],
        "total_cost": row["total_cost"],
        "avg_latency": round(
            row["avg_latency"] or 0,
            2,
        ),
        "successful": row["successful"] or 0,
        "failed": row["failed"] or 0,
    }


# ---------------------------------------------------------
# MODEL USAGE
# ---------------------------------------------------------

@app.get("/usage/models")
def usage_by_model():

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            model,
            COUNT(*) AS requests,
            SUM(input_tokens) AS input_tokens,
            SUM(output_tokens) AS output_tokens,
            SUM(total_tokens) AS total_tokens,
            SUM(estimated_cost) AS cost,
            AVG(latency_ms) AS latency
        FROM usage_logs
        GROUP BY model
        ORDER BY cost DESC
        """
    ).fetchall()

    connection.close()

    return {
        "models": [
            {
                "model": row["model"],
                "requests": row["requests"],
                "input_tokens": row["input_tokens"] or 0,
                "output_tokens": row["output_tokens"] or 0,
                "total_tokens": row["total_tokens"] or 0,
                "cost": row["cost"] or 0,
                "latency": round(
                    row["latency"] or 0,
                    2,
                ),
            }
            for row in rows
        ]
    }


# ---------------------------------------------------------
# DAILY USAGE
# ---------------------------------------------------------

@app.get("/usage/daily")
def daily_usage():

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            substr(timestamp, 1, 10) AS day,
            COUNT(*) AS requests,
            SUM(total_tokens) AS tokens,
            SUM(estimated_cost) AS cost
        FROM usage_logs
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY day ASC
        """
    ).fetchall()

    connection.close()

    return {
        "days": [
            {
                "day": row["day"],
                "requests": row["requests"],
                "tokens": row["tokens"] or 0,
                "cost": row["cost"] or 0,
            }
            for row in rows
        ]
    }


# ---------------------------------------------------------
# RECENT REQUESTS
# ---------------------------------------------------------

@app.get("/usage/recent")
def recent_usage(limit: int = 20):

    limit = min(max(limit, 1), 100)

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            id,
            timestamp,
            model,
            operation,
            input_tokens,
            output_tokens,
            total_tokens,
            estimated_cost,
            latency_ms,
            success
        FROM usage_logs
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    connection.close()

    return {
        "requests": [
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "model": row["model"],
                "operation": row["operation"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
                "total_tokens": row["total_tokens"],
                "cost": row["estimated_cost"],
                "latency_ms": row["latency_ms"],
                "success": bool(row["success"]),
            }
            for row in rows
        ]
    }


# ---------------------------------------------------------
# PRICING
# ---------------------------------------------------------

@app.get("/usage/pricing")
def pricing():

    return {
        "pricing": MODEL_PRICING,
        "note": "These are configurable estimates for the dashboard."
    }


# ---------------------------------------------------------
# RESET
# ---------------------------------------------------------

@app.delete("/usage/reset")
def reset_usage():

    connection = get_db()

    connection.execute(
        "DELETE FROM usage_logs"
    )

    connection.commit()
    connection.close()

    return {
        "success": True,
        "message": "Usage history reset.",
    }


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8019,
        reload=False,
    )