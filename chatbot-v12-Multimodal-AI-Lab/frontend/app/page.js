"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012";

const MODES = [
  { id: "cross_modal", icon: "🔀", title: "Cross-Modal Reasoning", desc: "Compare images, documents and questions together." },
  { id: "multimodal_rag", icon: "🧠", title: "Multimodal RAG", desc: "Combine retrieval with visual understanding." },
  { id: "vision", icon: "👁️", title: "Vision Reasoning", desc: "Inspect diagrams, screenshots, charts and photos." },
  { id: "voice_vision", icon: "🎙️", title: "Voice + Vision", desc: "Talk to the model while an image provides context." },
  { id: "modality_compare", icon: "⚖️", title: "Modality Compare", desc: "See what changes when another modality is added." },
];

const EXPERIMENTS = [
  { id: "text", label: "Text Only", icon: "📝" },
  { id: "image", label: "Text + Image", icon: "🖼️" },
  { id: "document", label: "Text + Document", icon: "📄" },
  { id: "multimodal", label: "Text + Image + Document", icon: "🧩" },
];

export default function Page() {
  const [mode, setMode] = useState("cross_modal");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [webSearch, setWebSearch] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageFileId, setImageFileId] = useState("");
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [documentFileId, setDocumentFileId] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [vectorStoreId, setVectorStoreId] = useState("");
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareAnswer, setCompareAnswer] = useState("");
  const [experiment, setExperiment] = useState("multimodal");
  const [experimentAnswer, setExperimentAnswer] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Voice off");

  const imageInput = useRef(null);
  const documentInput = useRef(null);
  const abortRef = useRef(null);
  const pcRef = useRef(null);
  const audioRef = useRef(null);

  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  async function uploadImage(file) {
    if (!file) return;
    setStatus("Uploading image…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BACKEND}/upload-image`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Image upload failed.");
    setImageFileId(data.file_id);
    setImageName(data.filename);
    setImagePreview(URL.createObjectURL(file));
    setStatus("Image ready");
  }

  async function uploadDocument(file) {
    if (!file) return;
    setStatus("Creating multimodal knowledge context…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BACKEND}/upload-document`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Document upload failed.");
    setDocumentFileId(data.file_id);
    setDocumentName(data.filename);
    setVectorStoreId(data.vector_store_id);
    setStatus("Document indexed and ready");
  }

  async function handleImageChange(e) {
    try { await uploadImage(e.target.files?.[0]); }
    catch (err) { setStatus(err.message); }
  }

  async function handleDocumentChange(e) {
    try { await uploadDocument(e.target.files?.[0]); }
    catch (err) { setStatus(err.message); }
  }

  async function sendChat() {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage = {
      role: "user",
      text: question,
      image: imagePreview || null,
      imageName: imageName || null,
      documentName: documentName || null
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStatus("Multimodal reasoning…");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.text
      }));

      const res = await fetch(`${BACKEND}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiMessages,
          image_file_ids: imageFileId ? [imageFileId] : [],
          vector_store_id: vectorStoreId || null,
          web_search: webSearch,
          model
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload);
            if (event.type === "delta") {
              assistantText += event.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", text: assistantText };
                return copy;
              });
            } else if (event.type === "status") {
              setStatus(event.text);
            } else if (event.type === "error") {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e.message && e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
      setStatus("Ready");
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus(err.message || "Request failed");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stopChat() {
    abortRef.current?.abort();
    setLoading(false);
    setStatus("Stopped");
  }

  async function runCrossModalCompare() {
    if (!input.trim()) {
      setStatus("Enter a comparison question first.");
      return;
    }
    if (!imageFileId && !vectorStoreId) {
      setStatus("Add an image and/or document first.");
      return;
    }

    setCompareLoading(true);
    setCompareAnswer("");
    setStatus("Comparing modalities…");

    try {
      const res = await fetch(`${BACKEND}/cross-modal/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input.trim(),
          image_file_id: imageFileId || null,
          document_file_id: documentFileId || null,
          vector_store_id: vectorStoreId || null,
          model
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Comparison failed.");
      setCompareAnswer(data.answer);
      setStatus("Comparison complete");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setCompareLoading(false);
    }
  }

  async function runExperiment() {
    setStatus("Running experiment…");
    setExperimentAnswer("");
    try {
      const res = await fetch(`${BACKEND}/experiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input.trim() || "Explain what can be learned from the supplied inputs.",
          mode: experiment === "image" ? "vision" : experiment === "multimodal" ? "cross_modal" : "modality_compare",
          image_file_id: experiment === "image" || experiment === "multimodal" ? imageFileId || null : null,
          vector_store_id: experiment === "document" || experiment === "multimodal" ? vectorStoreId || null : null,
          web_search: webSearch,
          model
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Experiment failed.");
      setExperimentAnswer(data.answer);
      setStatus("Experiment complete");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function startVoice() {
    try {
      setVoiceStatus("Connecting…");
      const tokenRes = await fetch(`${BACKEND}/realtime-token`, { method: "POST" });
      const token = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(token.detail || "Could not create voice session.");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => { audio.srcObject = event.streams[0]; };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dc.onopen = () => {
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: imageFileId
              ? "The user has supplied an image in the GenAI-Labs V12 workspace. Answer spoken questions using that visual context."
              : "You are the GenAI-Labs V12 Voice + Vision assistant."
          }
        }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answerRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token.client_secret}`,
          "Content-Type": "application/sdp"
        }
      });

      if (!answerRes.ok) throw new Error(await answerRes.text());
      const answerSdp = await answerRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setVoiceStatus("Voice connected");
    } catch (err) {
      setVoiceStatus(err.message || "Voice connection failed");
    }
  }

  function stopVoice() {
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    setVoiceStatus("Voice off");
  }

  function clearInputs() {
    setImageFileId("");
    setImageName("");
    setImagePreview("");
    setDocumentFileId("");
    setDocumentName("");
    setVectorStoreId("");
    setCompareAnswer("");
    setExperimentAnswer("");
    setStatus("Inputs cleared");
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setCompareAnswer("");
    setExperimentAnswer("");
    setStatus("New lab session");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <div className="brand-name">GenAI-Labs</div>
            <div className="brand-sub">V12 · MULTIMODAL AI LAB</div>
          </div>
        </div>

        <button className="new-chat" onClick={newChat}>＋ New Lab Session</button>

        <div className="side-section">
          <div className="side-title">LABS</div>
          {MODES.map((item) => (
            <button
              key={item.id}
              className={`mode-button ${mode === item.id ? "active" : ""}`}
              onClick={() => setMode(item.id)}
            >
              <span className="mode-icon">{item.icon}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="side-section">
          <div className="side-title">MODEL</div>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="gpt-5.6-luna">GPT-5.6 Luna</option>
            <option value="gpt-5.6">GPT-5.6</option>
          </select>
        </div>

        <label className="toggle-row">
          <span>🌐 Web Search</span>
          <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
        </label>

        <div className="side-footer">
          <span className="status-dot"></span>{status}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">MULTIMODAL AI EXPERIMENTATION</div>
            <h1>{currentMode.icon} {currentMode.title}</h1>
            <p>{currentMode.desc}</p>
          </div>
          <button className="voice-btn" onClick={voiceStatus === "Voice connected" ? stopVoice : startVoice}>
            {voiceStatus === "Voice connected" ? "🔴 Stop Voice" : "🎙️ Voice + Vision"}
          </button>
        </header>

        <div className="pipeline">
          <div className="pipeline-node">📝 Text</div>
          <div className="pipeline-plus">+</div>
          <div className="pipeline-node">🖼 Image</div>
          <div className="pipeline-plus">+</div>
          <div className="pipeline-node">📄 Document</div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-node highlight">🧠 Multimodal AI</div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-node">💬 Answer</div>
        </div>

        <div className="input-grid">
          <div className="input-card">
            <div className="card-head">
              <div><span className="card-icon">🖼️</span><strong>Visual Input</strong></div>
              <button onClick={() => imageInput.current?.click()}>+ Add Image</button>
            </div>
            <input ref={imageInput} hidden type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview ? (
              <div className="preview-wrap">
                <img src={imagePreview} alt="Uploaded visual" />
                <button className="remove-chip" onClick={() => { setImageFileId(""); setImageName(""); setImagePreview(""); }}>Remove</button>
              </div>
            ) : (
              <div className="drop-placeholder" onClick={() => imageInput.current?.click()}>
                <span>👁️</span>
                Upload a diagram, chart, screenshot or photo
              </div>
            )}
            {imageName && <div className="file-label">{imageName}</div>}
          </div>

          <div className="input-card">
            <div className="card-head">
              <div><span className="card-icon">📄</span><strong>Knowledge Input</strong></div>
              <button onClick={() => documentInput.current?.click()}>+ Add Document</button>
            </div>
            <input ref={documentInput} hidden type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleDocumentChange} />
            {documentName ? (
              <div className="document-ready">
                <div className="doc-symbol">📄</div>
                <div><strong>{documentName}</strong><span>Indexed for retrieval</span></div>
              </div>
            ) : (
              <div className="drop-placeholder" onClick={() => documentInput.current?.click()}>
                <span>🧠</span>
                Upload a document to ground multimodal reasoning
              </div>
            )}
          </div>
        </div>

        <section className="question-card">
          <div className="section-label">QUESTION / INSTRUCTION</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "cross_modal"
                ? "Example: Does the architecture diagram match the PDF specification?"
                : "Ask the multimodal AI to analyze your inputs…"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mode === "cross_modal" ? runCrossModalCompare() : sendChat();
              }
            }}
          />
          <div className="question-actions">
            <span>Enter to run · Shift+Enter for new line</span>
            <div>
              {loading && <button className="stop-btn" onClick={stopChat}>Stop</button>}
              <button className="primary-btn" onClick={mode === "cross_modal" ? runCrossModalCompare : sendChat}>
                {mode === "cross_modal" ? "🔀 Compare Inputs" : "✨ Analyze"}
              </button>
            </div>
          </div>
        </section>

        {(mode === "cross_modal" && compareAnswer) && (
          <section className="result-card">
            <div className="result-title">🔀 Cross-Modal Analysis</div>
            <div className="result-body">{compareAnswer}</div>
          </section>
        )}

        {mode !== "cross_modal" && messages.length > 0 && (
          <section className="chat-card">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <div className="message-role">{m.role === "user" ? "YOU" : "GENAI-LABS AI"}</div>
                {m.image && <img className="message-image" src={m.image} alt={m.imageName || "input"} />}
                {m.documentName && <div className="message-file">📄 {m.documentName}</div>}
                <div className="message-text">{m.text}</div>
              </div>
            ))}
          </section>
        )}

        <section className="experiment-card">
          <div className="experiment-head">
            <div>
              <div className="section-label">🔬 MULTIMODAL EXPERIMENT</div>
              <h2>What does each modality add?</h2>
              <p>Run the same question with different input combinations and compare the result.</p>
            </div>
            <button className="primary-btn" onClick={runExperiment}>Run Experiment</button>
          </div>

          <div className="experiment-tabs">
            {EXPERIMENTS.map((item) => (
              <button key={item.id} className={experiment === item.id ? "selected" : ""} onClick={() => setExperiment(item.id)}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          {experimentAnswer && (
            <div className="experiment-result">
              <div className="result-title">Experiment Result</div>
              <div className="result-body">{experimentAnswer}</div>
            </div>
          )}
        </section>

        <section className="architecture-card">
          <div className="section-label">HOW V12 WORKS</div>
          <div className="architecture-flow">
            {[
              ["01", "Perception", "Understand text, images and documents"],
              ["02", "Context Fusion", "Combine evidence across modalities"],
              ["03", "Retrieval", "Bring in grounded knowledge when needed"],
              ["04", "Reasoning", "Analyze relationships and contradictions"],
              ["05", "Response", "Return an explainable answer"],
            ].map((x) => (
              <div className="arch-step" key={x[0]}>
                <span>{x[0]}</span>
                <strong>{x[1]}</strong>
                <small>{x[2]}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="bottom-bar">
          <button onClick={clearInputs}>Clear Inputs</button>
          <span>{voiceStatus}</span>
        </div>
      </section>
    </main>
  );
}
