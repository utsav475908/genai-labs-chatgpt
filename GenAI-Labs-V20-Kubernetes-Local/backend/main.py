import os
import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

MODEL = os.getenv("OPENAI_MODEL", "gpt-6-astra")

app = FastAPI(title="GenAI-Labs V20 Kubernetes Lab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3020"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str
    model: str = MODEL

class ManifestRequest(BaseModel):
    app_name: str = "genai-demo"
    image: str = "genai-demo:latest"
    replicas: int = 2
    container_port: int = 8000
    service_port: int = 80
    namespace: str = "genai-lab"

@app.get("/")
def root():
    return {"module": "V20", "name": "Kubernetes Deployment Lab", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/chat")
def chat(req: ChatRequest):
    client = OpenAI()
    response = client.responses.create(
        model=req.model,
        instructions=(
            "You are a Kubernetes teaching assistant. "
            "Explain concepts clearly and safely. "
            "Prefer practical kubectl examples and YAML. "
            "Do not claim that a command was executed unless it actually was."
        ),
        input=req.prompt,
    )
    return {"response": response.output_text, "model": req.model}

@app.post("/generate-yaml")
def generate_yaml(req: ManifestRequest):
    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": req.app_name, "namespace": req.namespace},
        "spec": {
            "replicas": req.replicas,
            "selector": {"matchLabels": {"app": req.app_name}},
            "template": {
                "metadata": {"labels": {"app": req.app_name}},
                "spec": {
                    "containers": [{
                        "name": req.app_name,
                        "image": req.image,
                        "ports": [{"containerPort": req.container_port}],
                    }]
                },
            },
        },
    }

    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": req.app_name, "namespace": req.namespace},
        "spec": {
            "selector": {"app": req.app_name},
            "ports": [{"port": req.service_port, "targetPort": req.container_port}],
            "type": "NodePort",
        },
    }

    namespace = {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {"name": req.namespace},
    }

    output = "\n---\n".join(
        yaml.safe_dump(x, sort_keys=False).strip()
        for x in [namespace, deployment, service]
    )
    return {"yaml": output}

@app.get("/kubernetes-concepts")
def concepts():
    return {
        "concepts": [
            "Cluster", "Namespace", "Node", "Pod", "Deployment",
            "ReplicaSet", "Service", "Ingress", "ConfigMap",
            "Secret", "Scaling", "Rolling Update", "Rollback",
            "Health Checks", "Logs"
        ]
    }
