"use client";

import { useState } from "react";

const BACKEND = "http://localhost:8020";

const modes = [
  ["☸", "Cluster Overview"],
  ["📦", "Deploy Application"],
  ["🧱", "Pods"],
  ["🔌", "Services"],
  ["🌐", "Ingress"],
  ["🔐", "Secrets"],
  ["⚙", "ConfigMaps"],
  ["📈", "Scaling"],
  ["🔄", "Rolling Updates"],
  ["📋", "YAML Generator"],
  ["🩺", "Health & Logs"],
];

const explanations = {
  "Cluster Overview": "A Kubernetes cluster contains the control plane and worker nodes.",
  "Deploy Application": "A Deployment manages Pods and keeps the requested number of replicas running.",
  "Pods": "A Pod is the smallest deployable Kubernetes unit and can contain one or more containers.",
  "Services": "A Service provides a stable network endpoint for a group of Pods.",
  "Ingress": "Ingress provides HTTP/HTTPS routing from outside the cluster to Services.",
  "Secrets": "Secrets hold sensitive configuration such as API keys. Never commit real secrets to Git.",
  "ConfigMaps": "ConfigMaps store non-sensitive configuration separately from container images.",
  "Scaling": "Scaling changes the number of Pod replicas.",
  "Rolling Updates": "Kubernetes can replace old Pods gradually while deploying a new version.",
  "YAML Generator": "Generate a simple Namespace, Deployment and NodePort Service manifest.",
  "Health & Logs": "kubectl can inspect Pod health and retrieve container logs.",
};

export default function Home() {
  const [mode, setMode] = useState("Cluster Overview");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const [appName, setAppName] = useState("genai-demo");
  const [image, setImage] = useState("genai-demo:latest");
  const [replicas, setReplicas] = useState(2);
  const [yaml, setYaml] = useState("");

  async function askAI() {
    if (!prompt.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt}),
      });
      const data = await res.json();
      setAnswer(data.response || data.detail || "No response");
    } catch (e) {
      setAnswer("Backend is not reachable. Start FastAPI on port 8020.");
    } finally {
      setLoading(false);
    }
  }

  async function generateYaml() {
    try {
      const res = await fetch(`${BACKEND}/generate-yaml`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          app_name: appName,
          image,
          replicas: Number(replicas),
          container_port: 8000,
          service_port: 80,
          namespace: "genai-lab",
        }),
      });
      const data = await res.json();
      setYaml(data.yaml || data.detail || "");
    } catch {
      setYaml("Backend is not reachable.");
    }
  }

  function commandForMode() {
    const map = {
      "Cluster Overview": "kubectl get nodes",
      "Deploy Application": "kubectl get deployments -A",
      "Pods": "kubectl get pods -A -o wide",
      "Services": "kubectl get svc -A",
      "Ingress": "kubectl get ingress -A",
      "Secrets": "kubectl get secrets -A",
      "ConfigMaps": "kubectl get configmaps -A",
      "Scaling": `kubectl scale deployment/${appName} --replicas=${replicas}`,
      "Rolling Updates": `kubectl rollout status deployment/${appName}`,
      "YAML Generator": "kubectl apply -f k8s/",
      "Health & Logs": `kubectl logs deployment/${appName}`,
    };
    return map[mode];
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="brand">GENAI-LABS</div>
          <div className="subtitle">V20 · KUBERNETES DEPLOYMENT LAB</div>
        </div>
        <div className="status">● LOCAL LAB · :3020 / :8020</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">KUBERNETES + GENAI</div>
          <h1>Kubernetes Deployment Lab</h1>
          <p>Learn Pods, Deployments, Services, Ingress, configuration, scaling and rolling updates locally.</p>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <h3>LAB MODULES</h3>
          {modes.map(([icon, name]) => (
            <button
              key={name}
              className={mode === name ? "nav active" : "nav"}
              onClick={() => setMode(name)}
            >
              <span>{icon}</span>{name}
            </button>
          ))}
        </aside>

        <section className="content">
          <div className="card">
            <div className="cardTitle">{mode}</div>
            <p>{explanations[mode]}</p>

            <div className="commandBox">
              <span>$</span>
              <code>{commandForMode()}</code>
            </div>
          </div>

          {mode === "YAML Generator" && (
            <div className="card">
              <div className="grid">
                <label>Application name<input value={appName} onChange={e => setAppName(e.target.value)} /></label>
                <label>Container image<input value={image} onChange={e => setImage(e.target.value)} /></label>
                <label>Replicas<input type="number" min="1" max="20" value={replicas} onChange={e => setReplicas(e.target.value)} /></label>
              </div>
              <button className="primary" onClick={generateYaml}>Generate Kubernetes YAML</button>
              {yaml && <pre className="yaml">{yaml}</pre>}
            </div>
          )}

          <div className="card">
            <div className="cardTitle">AI Kubernetes Assistant</div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask: What is the difference between a Pod and a Deployment?"
            />
            <button className="primary" onClick={askAI} disabled={loading}>
              {loading ? "Thinking..." : "Ask Kubernetes AI"}
            </button>
            {answer && <pre className="answer">{answer}</pre>}
          </div>

          <div className="cards">
            <div className="mini"><b>Pods</b><span>Smallest deployable unit</span></div>
            <div className="mini"><b>Deployment</b><span>Manages replicas and updates</span></div>
            <div className="mini"><b>Service</b><span>Stable network endpoint</span></div>
            <div className="mini"><b>Ingress</b><span>HTTP/HTTPS routing</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}
