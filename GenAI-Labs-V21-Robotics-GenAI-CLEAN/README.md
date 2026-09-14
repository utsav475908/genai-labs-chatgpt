# GenAI-Labs V21 — Robotics + GenAI Lab

V21 is a local-first robotics and GenAI teaching module.

No AWS, Docker, Kubernetes, ROS 2 installation, or physical robot is required for this first version.

## Architecture

Natural Language
    ↓
AI Planner
    ↓
Safety Validator
    ↓
Robot Simulator

## Ports

Frontend: http://localhost:3021
Backend: http://localhost:8021

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8021
```

## Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

http://localhost:3021

## Example

Try:

"Move the robot forward 1 meter and explain the safety checks."

The AI generates a plan. V21 does not directly control a physical robot.

## V21 progression

1. Robot Simulator
2. AI Command Planner
3. Safety Validation
4. Vision
5. Telemetry
6. ROS 2 concepts
7. Real robot integration
