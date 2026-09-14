import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI

MODEL = os.getenv("OPENAI_MODEL", "gpt-6-astra")

app = FastAPI(title="GenAI-Labs V21 Robotics + GenAI Lab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3021"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlanRequest(BaseModel):
    instruction: str
    robot: str = "Simulator"


class VisionRequest(BaseModel):
    description: str


class ExecuteRequest(BaseModel):
    action: str
    direction: str = "forward"
    distance_m: float = Field(default=0.0, ge=0, le=2)
    speed: float = Field(default=0.2, ge=0, le=0.5)


@app.get("/")
def root():
    return {
        "module": "V21",
        "name": "Robotics + GenAI Lab",
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/robot/status")
def robot_status():
    return {
        "connected": True,
        "robot": "GenAI Robot Simulator",
        "battery": 87,
        "mode": "SIMULATION",
        "position": {
            "x": 0.0,
            "y": 0.0,
        },
        "heading": 0,
        "safety": "READY",
    }


@app.post("/robot/validate")
def validate(req: ExecuteRequest):
    reasons = []

    if req.distance_m > 2:
        reasons.append(
            "Maximum simulator distance is 2 meters."
        )

    if req.speed > 0.5:
        reasons.append(
            "Maximum simulator speed is 0.5 m/s."
        )

    if req.action not in {
        "move",
        "rotate",
        "stop",
    }:
        reasons.append(
            "Unsupported action."
        )

    return {
        "approved": not reasons,
        "reasons": reasons,
        "command": req.model_dump(),
    }


@app.post("/robot/plan")
def plan(req: PlanRequest):
    client = OpenAI()

    response = client.responses.create(
        model=MODEL,
        instructions=(
            "You are a safe robotics planning assistant. "
            "Convert natural-language instructions into an "
            "educational robot plan. "
            "Never claim a physical robot was controlled. "
            "Use conservative simulator limits: movement <= 2 m "
            "and speed <= 0.5 m/s. "
            "Return JSON only with these keys: "
            "action, direction, distance_m, speed, "
            "explanation, safety_notes. "
            "Allowed actions: move, rotate, stop, inspect."
        ),
        input=(
            f"Robot: {req.robot}\n"
            f"Instruction: {req.instruction}"
        ),
    )

    text = response.output_text

    try:
        plan_data = json.loads(text)
    except Exception:
        plan_data = {
            "action": "inspect",
            "explanation": text,
            "safety_notes": "Review the generated plan before execution.",
        }

    return {
        "plan": plan_data,
        "model": MODEL,
    }


@app.post("/ask")
def ask(req: PlanRequest):
    client = OpenAI()

    response = client.responses.create(
        model=MODEL,
        instructions=(
            "You are a robotics and ROS 2 instructor. "
            "Explain concepts clearly for students. "
            "Use simulator examples where possible. "
            "Do not claim access to physical hardware."
        ),
        input=req.instruction,
    )

    return {
        "response": response.output_text,
        "model": MODEL,
    }


@app.post("/vision")
def vision(req: VisionRequest):
    client = OpenAI()

    response = client.responses.create(
        model=MODEL,
        instructions=(
            "You are a robotics vision teaching assistant. "
            "Analyze the textual camera-scene description and "
            "explain possible detections, coordinates, and safe "
            "robot responses. "
            "Do not claim to see a real camera."
        ),
        input=req.description,
    )

    return {
        "analysis": response.output_text,
        "model": MODEL,
    }


@app.get("/ros2")
def ros2():
    return {
        "nodes": [
            "ai_planner",
            "safety_node",
            "robot_controller",
            "camera_node",
        ],
        "topics": [
            "/cmd_vel",
            "/camera/image_raw",
            "/scan",
            "/odom",
            "/battery_state",
        ],
        "flow": (
            "AI Planner → Safety Node → "
            "ROS 2 Controller → Robot"
        ),
    }
