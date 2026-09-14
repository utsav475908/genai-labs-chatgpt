# GenAI-Labs V20 — Kubernetes Deployment Lab

Runs locally on macOS using Docker Desktop + Kubernetes.

## Ports

Frontend: http://localhost:3020
Backend: http://localhost:8020

## 1. Start Docker Desktop

Make sure Docker Desktop is running and Kubernetes is enabled.

Check:

```bash
docker --version
kubectl version --client
kubectl get nodes
```

## 2. Create the V20 folder

This project should be:

```text
/Users/dilip/Desktop/my-ai-chatbot/chatbot-v20-kubernetes
```

## 3. Install backend dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start backend:

```bash
uvicorn main:app --reload --port 8020
```

## 4. Start frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

http://localhost:3020

## 5. Run with Docker

From the V20 root:

```bash
docker build -f docker/backend.Dockerfile -t genai-backend:local .
docker build -f docker/frontend.Dockerfile -t genai-frontend:local .
```

## 6. Deploy to local Kubernetes

Create namespace:

```bash
kubectl apply -f k8s/namespace.yaml
```

Create ConfigMap:

```bash
kubectl apply -f k8s/configmap.yaml
```

Create the OpenAI Secret without pasting the key into this project:

```bash
export OPENAI_API_KEY="YOUR_KEY_IN_YOUR_LOCAL_SHELL"
kubectl create secret generic openai-secret \
  -n genai-lab \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY"
```

Then:

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

Check:

```bash
kubectl get pods -n genai-lab
kubectl get deployments -n genai-lab
kubectl get services -n genai-lab
```

Open the frontend:

```bash
kubectl port-forward service/genai-frontend 3020:3020 -n genai-lab
```

Then browse:

http://localhost:3020

## 7. Useful teaching commands

Pods:

```bash
kubectl get pods -n genai-lab
```

Detailed Pod:

```bash
kubectl describe pod -n genai-lab <POD_NAME>
```

Logs:

```bash
kubectl logs -n genai-lab deployment/genai-backend
```

Scale:

```bash
kubectl scale deployment/genai-backend --replicas=4 -n genai-lab
```

Rolling status:

```bash
kubectl rollout status deployment/genai-backend -n genai-lab
```

History:

```bash
kubectl rollout history deployment/genai-backend -n genai-lab
```

Rollback:

```bash
kubectl rollout undo deployment/genai-backend -n genai-lab
```

Delete the lab:

```bash
kubectl delete namespace genai-lab
```

## Important

`k8s/secret.yaml.example` contains a placeholder only. Do not put your real OpenAI API key into Git or YAML files.

The Ingress manifest is included for teaching. The first local run uses port-forwarding, so no Ingress controller is required.
