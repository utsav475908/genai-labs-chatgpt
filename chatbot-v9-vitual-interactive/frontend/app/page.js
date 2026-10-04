"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8009";

const visualLessons = {
  overview: {
    title: "Visual AI Overview",
    icon: "🧠",
    description:
      "Understand how a modern GenAI application connects the user interface, model, tools, knowledge, vision, and voice.",
    steps: [
      ["01", "User", "You ask a question, upload a file, or speak."],
      ["02", "AI Model", "GPT-5.6 Luna understands the request."],
      ["03", "Tools", "Web Search or File Search can provide additional context."],
      ["04", "Response", "The model streams the answer back to the interface."],
    ],
  },

  llm: {
    title: "How an LLM Works",
    icon: "🤖",
    description:
      "A simple visual explanation of the request → token → model → response flow.",
    steps: [
      ["01", "Prompt", "Your text is converted into tokens."],
      ["02", "Context", "The model processes the available conversation context."],
      ["03", "Prediction", "The model predicts the next token repeatedly."],
      ["04", "Answer", "Tokens are assembled into the final response."],
    ],
  },

  tokens: {
    title: "Tokens",
    icon: "🔤",
    description:
      "Tokens are the pieces of text that language models process.",
    steps: [
      ["01", "Text", "Start with a sentence."],
      ["02", "Split", "The sentence is divided into smaller token units."],
      ["03", "Numbers", "Tokens are represented internally as numeric IDs."],
      ["04", "Model", "The model processes those IDs to generate output."],
    ],
  },

  prompting: {
    title: "Prompt Engineering",
    icon: "✍️",
    description:
      "See how a clear prompt can guide an AI model toward a more useful response.",
    steps: [
      ["01", "Goal", "Clearly state what you want."],
      ["02", "Context", "Provide relevant background information."],
      ["03", "Constraints", "Specify format, audience, length, or rules."],
      ["04", "Output", "The model generates a response based on those instructions."],
    ],
  },

  rag: {
    title: "RAG / Knowledge Base",
    icon: "📚",
    description:
      "Retrieval-Augmented Generation combines your documents with model reasoning.",
    steps: [
      ["01", "Documents", "Upload PDFs, DOCX, or TXT files."],
      ["02", "Retrieval", "Relevant information is searched from the knowledge base."],
      ["03", "Context", "Retrieved information is supplied to the model."],
      ["04", "Answer", "The model answers using the available context."],
    ],
  },

  vision: {
    title: "Vision AI",
    icon: "👁️",
    description:
      "Upload an image and ask the model to understand diagrams, screenshots, charts, photos, and other visual information.",
    steps: [
      ["01", "Image", "Upload an image from your computer."],
      ["02", "Vision", "The model analyzes the visual information."],
      ["03", "Question", "Ask what you want to understand about the image."],
      ["04", "Answer", "The model explains the visual content."],
    ],
  },

  architecture: {
    title: "GenAI Application Architecture",
    icon: "🏗️",
    description:
      "Explore the main building blocks of a production-style GenAI application.",
    steps: [
      ["01", "Frontend", "Next.js provides the interactive user interface."],
      ["02", "Backend", "FastAPI receives requests and communicates with AI services."],
      ["03", "AI Services", "Models, search, file retrieval, vision, and realtime voice work together."],
      ["04", "User", "The result is streamed back into the application."],
    ],
  },
};

export default function Page() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState(null);

  const [visualMode, setVisualMode] = useState("overview");

  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);

  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    return () => {
      try {
        abortRef.current?.abort();
        dcRef.current?.close();
        pcRef.current?.close();
        mediaStreamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {}
    };
  }, []);

  function autoResize() {
    const el = textareaRef.current;

    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function newChat() {
    if (loading) {
      abortRef.current?.abort();
    }

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setUploadedInfo(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setTimeout(autoResize, 0);
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);
    setUploadedInfo(null);
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    setUploadedInfo(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function isImage(file) {
    return file?.type?.startsWith("image/");
  }

  async function uploadImage(file) {
    const form = new FormData();

    form.append("file", file);

    const response = await fetch(`${BACKEND}/upload-image`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Image upload failed");
    }

    return response.json();
  }

  async function uploadDocument(file) {
    const form = new FormData();

    form.append("file", file);

    const response = await fetch(`${BACKEND}/upload`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Document upload failed");
    }

    return response.json();
  }

  async function uploadSelectedFile() {
    if (!selectedFile) {
      return null;
    }

    setUploading(true);

    try {
      let result;

      if (isImage(selectedFile)) {
        result = await uploadImage(selectedFile);
      } else {
        result = await uploadDocument(selectedFile);
      }

      const info = {
        ...result,
        filename: selectedFile.name,
        isImage: isImage(selectedFile),
      };

      setUploadedInfo(info);

      return info;
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();

    if ((!text && !selectedFile) || loading) {
      return;
    }

    let uploadResult = uploadedInfo;

    try {
      if (selectedFile && !uploadResult) {
        uploadResult = await uploadSelectedFile();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Upload error: ${error.message}`,
        },
      ]);

      return;
    }

    const userText =
      text ||
      (uploadResult?.isImage
        ? `Please analyze this image: ${uploadResult.filename}`
        : `Please analyze the uploaded document: ${uploadResult.filename}`);

    const userMessage = {
      role: "user",
      content: userText,

      attachment: uploadResult
        ? {
            filename: uploadResult.filename,
            isImage: uploadResult.isImage,
          }
        : null,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSelectedFile(null);
    setUploadedInfo(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setTimeout(autoResize, 0);

    await streamChat(nextMessages, uploadResult);
  }

  async function streamChat(chatMessages, uploadResult) {
    setLoading(true);

    const controller = new AbortController();

    abortRef.current = controller;

    const assistantIndex = chatMessages.length;

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
      },
    ]);

    try {
      const apiMessages = chatMessages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const imageFileId = uploadResult?.isImage
        ? uploadResult.file_id || uploadResult.id
        : null;

      const vectorStoreId = uploadResult?.isImage
        ? null
        : uploadResult?.vector_store_id || null;

      const response = await fetch(`${BACKEND}/chat`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        signal: controller.signal,

        body: JSON.stringify({
          messages: apiMessages,
          image_file_id: imageFileId,
          vector_store_id: vectorStoreId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(errorText || "Chat request failed");
      }

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this browser."
        );
      }

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";
      let answer = "";

      const updateAssistant = (content) => {
        setMessages((prev) =>
          prev.map((message, index) =>
            index === assistantIndex
              ? {
                  ...message,
                  content,
                }
              : message
          )
        );
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line.startsWith("data:")) {
            continue;
          }

          const data = line.slice(5).trim();

          if (!data || data === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(data);

            if (event.type === "delta") {
              answer += event.text || "";

              updateAssistant(answer);
            }

            if (event.type === "error") {
              throw new Error(
                event.message || "AI request failed"
              );
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              continue;
            }

            throw parseError;
          }
        }
      }

      if (!answer) {
        updateAssistant("No response was returned.");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((message, index) =>
            index === assistantIndex
              ? {
                  ...message,
                  content:
                    message.content || "Generation stopped.",
                }
              : message
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((message, index) =>
            index === assistantIndex
              ? {
                  ...message,
                  content: `Error: ${error.message}`,
                }
              : message
          )
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      sendMessage();
    }
  }

  async function startVoice() {
    if (voiceConnected || voiceConnecting) {
      return;
    }

    setVoiceConnecting(true);

    try {
      const tokenResponse = await fetch(
        `${BACKEND}/realtime-token`,
        {
          method: "POST",
        }
      );

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();

        throw new Error(
          text || "Could not get realtime token"
        );
      }

      const tokenData = await tokenResponse.json();

      const clientSecret =
        tokenData.client_secret?.value ||
        tokenData.client_secret;

      if (!clientSecret) {
        throw new Error(
          "Realtime client secret was not returned."
        );
      }

      const pc = new RTCPeerConnection();

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;

        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          setVoiceConnected(false);
        }
      };

      const audio = document.createElement("audio");

      audio.autoplay = true;

      pc.ontrack = (event) => {
        if (event.streams?.[0]) {
          audio.srcObject = event.streams[0];
        }
      };

      audioRef.current = audio;

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      mediaStreamRef.current = mediaStream;

      mediaStream.getTracks().forEach((track) => {
        pc.addTrack(track, mediaStream);
      });

      const dc = pc.createDataChannel("oai-events");

      dc.onopen = () => {
        setVoiceConnected(true);

        dc.send(
          JSON.stringify({
            type: "response.create",
          })
        );
      };

      dc.onclose = () => {
        setVoiceConnected(false);
      };

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      const realtimeResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },

          body: offer.sdp,
        }
      );

      if (!realtimeResponse.ok) {
        const text = await realtimeResponse.text();

        throw new Error(
          text || "Realtime connection failed"
        );
      }

      const answer = {
        type: "answer",
        sdp: await realtimeResponse.text(),
      };

      await pc.setRemoteDescription(answer);

      pcRef.current = pc;
      dcRef.current = dc;
    } catch (error) {
      console.error(error);

      alert(`Voice error: ${error.message}`);

      try {
        mediaStreamRef.current
          ?.getTracks()
          .forEach((track) => track.stop());

        pcRef.current?.close();
      } catch {}

      setVoiceConnected(false);
    } finally {
      setVoiceConnecting(false);
    }
  }

  function stopVoice() {
    try {
      dcRef.current?.close();
      pcRef.current?.close();

      mediaStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
    } catch {}

    dcRef.current = null;
    pcRef.current = null;
    mediaStreamRef.current = null;

    setVoiceConnected(false);
  }

  function runVisualLesson(key) {
    setVisualMode(key);

    const selectedLesson = visualLessons[key];

    const text =
      `Explain "${selectedLesson.title}" to me step by step. ` +
      selectedLesson.description;

    setInput(text);

    setTimeout(autoResize, 0);
  }

  const lesson = visualLessons[visualMode];

  const lessonNumber =
    Object.keys(visualLessons).indexOf(visualMode) + 1;

  return (
    <main className="app-shell">
      {/* =========================
          TOP BAR
      ========================== */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">G</div>

          <div>
            <div className="brand-name">
              GenAI-Labs
            </div>

            <div className="brand-subtitle">
              V9 · Visual, Interactive
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="status-dot" />

          <span>
            AI Workspace
          </span>

          <button
            className="new-chat-btn"
            onClick={newChat}
          >
            ＋ New Chat
          </button>
        </div>
      </header>

      {/* =========================
          WORKSPACE
      ========================== */}

      <section className="workspace">
        {/* =========================
            SIDEBAR
        ========================== */}

        <aside className="sidebar">
          <div className="sidebar-title">
            Visual Lab
          </div>

          <div className="lesson-list">
            {Object.entries(visualLessons).map(
              ([key, item]) => (
                <button
                  key={key}
                  className={`lesson-button ${
                    visualMode === key
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    runVisualLesson(key)
                  }
                >
                  <span className="lesson-icon">
                    {item.icon}
                  </span>

                  <span>
                    <strong>
                      {item.title}
                    </strong>

                    <small>
                      {item.description}
                    </small>
                  </span>
                </button>
              )
            )}
          </div>

          <div className="sidebar-footer">
            <div className="mini-card">
              <span>⚡</span>

              <div>
                <strong>
                  GPT-5.6 Luna
                </strong>

                <small>
                  Interactive AI model
                </small>
              </div>
            </div>

            <div className="mini-card">
              <span>🌐</span>

              <div>
                <strong>
                  Web Search
                </strong>

                <small>
                  Current information
                </small>
              </div>
            </div>

            <div className="mini-card">
              <span>📁</span>

              <div>
                <strong>
                  Knowledge Base
                </strong>

                <small>
                  PDF · DOCX · TXT
                </small>
              </div>
            </div>
          </div>
        </aside>

        {/* =========================
            MAIN PANEL
        ========================== */}

        <section className="main-panel">
          {/* =========================
              HERO
          ========================== */}

          <section className="hero-card">
            <div>
              <span className="eyebrow">
                GENAI-LABS V9
              </span>

              <h1>
                Visual &amp; Interactive
                <span> AI Lab</span>
              </h1>

              <p>
                Learn how generative AI applications
                work through interactive visual flows,
                chat, documents, images, web search,
                and voice.
              </p>
            </div>

            <div className="hero-icon">
              🧠
            </div>
          </section>

          {/* =========================
              VISUAL LESSON
          ========================== */}

          <section className="visual-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  INTERACTIVE VISUAL
                </span>

                <h2>
                  {lesson.icon}{" "}
                  {lesson.title}
                </h2>

                <p>
                  {lesson.description}
                </p>
              </div>

              <div className="lesson-number">
                {String(lessonNumber).padStart(
                  2,
                  "0"
                )}
              </div>
            </div>

            <div className="visual-flow">
              {lesson.steps.map(
                (step, index) => (
                  <div
                    className="flow-item"
                    key={step[0]}
                  >
                    <div className="flow-card">
                      <div className="flow-number">
                        {step[0]}
                      </div>

                      <div>
                        <h3>
                          {step[1]}
                        </h3>

                        <p>
                          {step[2]}
                        </p>
                      </div>
                    </div>

                    {index <
                      lesson.steps.length -
                        1 && (
                      <div className="flow-arrow">
                        →
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <button
              className="explain-btn"
              onClick={() => {
                setInput(
                  `Teach me ${lesson.title} using a simple real-world example and explain each step.`
                );

                setTimeout(
                  autoResize,
                  0
                );
              }}
            >
              ✨ Ask AI to explain this
            </button>
          </section>

          {/* =========================
              QUICK TOPICS
          ========================== */}

          <section className="quick-topics">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">
                  EXPLORE
                </span>

                <h2>
                  Quick Topics
                </h2>
              </div>
            </div>

            <div className="topic-grid">
              {[
                [
                  "🧠",
                  "LLM",
                  "How language models work",
                  "llm",
                ],

                [
                  "🔤",
                  "Tokens",
                  "How text becomes tokens",
                  "tokens",
                ],

                [
                  "✍️",
                  "Prompting",
                  "Build better prompts",
                  "prompting",
                ],

                [
                  "📚",
                  "RAG",
                  "Ask questions about documents",
                  "rag",
                ],

                [
                  "👁️",
                  "Vision",
                  "Understand images",
                  "vision",
                ],

                [
                  "🏗️",
                  "Architecture",
                  "Build a GenAI application",
                  "architecture",
                ],
              ].map(
                ([
                  icon,
                  title,
                  description,
                  key,
                ]) => (
                  <button
                    className="topic-card"
                    key={key}
                    onClick={() =>
                      runVisualLesson(
                        key
                      )
                    }
                  >
                    <span>
                      {icon}
                    </span>

                    <strong>
                      {title}
                    </strong>

                    <small>
                      {description}
                    </small>
                  </button>
                )
              )}
            </div>
          </section>

          {/* =========================
              CHAT
          ========================== */}

          <section className="chat-card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">
                  AI ASSISTANT
                </span>

                <h2>
                  Ask GenAI-Labs
                </h2>
              </div>

              <div className="capability-badges">
                <span>
                  Streaming
                </span>

                <span>
                  Web
                </span>

                <span>
                  Vision
                </span>

                <span>
                  Files
                </span>

                <span>
                  Voice
                </span>
              </div>
            </div>

            {/* CHAT WINDOW */}

            <div className="chat-window">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-icon">
                    💬
                  </div>

                  <h3>
                    Start exploring
                  </h3>

                  <p>
                    Ask a question, upload a
                    document, or send an image
                    for analysis.
                  </p>
                </div>
              ) : (
                messages.map(
                  (message, index) => (
                    <div
                      key={`${index}-${message.role}`}
                      className={`message-row ${message.role}`}
                    >
                      <div className="message-avatar">
                        {message.role ===
                        "user"
                          ? "👤"
                          : "G"}
                      </div>

                      <div className="message-content">
                        {message.attachment && (
                          <div className="attachment-chip">
                            {message
                              .attachment
                              .isImage
                              ? "🖼️"
                              : "📄"}{" "}
                            {
                              message
                                .attachment
                                .filename
                            }
                          </div>
                        )}

                        <div className="message-bubble">
                          {message.content ||
                            (
                              <span className="typing">
                                Thinking
                                <span>
                                  .
                                </span>

                                <span>
                                  .
                                </span>

                                <span>
                                  .
                                </span>
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {/* SELECTED FILE */}

            {selectedFile && (
              <div className="upload-preview">
                <div>
                  <span>
                    {isImage(
                      selectedFile
                    )
                      ? "🖼️"
                      : "📄"}
                  </span>

                  <div>
                    <strong>
                      {selectedFile.name}
                    </strong>

                    <small>
                      {(
                        selectedFile.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </small>
                  </div>
                </div>

                <button
                  onClick={
                    removeSelectedFile
                  }
                >
                  ✕
                </button>
              </div>
            )}

            {/* UPLOAD SUCCESS */}

            {uploadedInfo && (
              <div className="uploaded-success">
                ✓ Uploaded:{" "}
                {uploadedInfo.filename}
              </div>
            )}

            {/* COMPOSER */}

            <div className="composer">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={
                  handleFileSelect
                }
              />

              <button
                className="icon-btn"
                title="Upload image or document"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={
                  loading ||
                  uploading
                }
              >
                📎
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(
                    event.target.value
                  );

                  autoResize();
                }}
                onKeyDown={
                  handleKeyDown
                }
                placeholder="Ask anything...  Enter to send · Shift+Enter for new line"
                rows={1}
              />

              {loading ? (
                <button
                  className="send-btn stop"
                  onClick={
                    stopGeneration
                  }
                  title="Stop generation"
                >
                  ■
                </button>
              ) : (
                <button
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={
                    !input.trim() &&
                    !selectedFile
                  }
                  title="Send"
                >
                  ➤
                </button>
              )}
            </div>

            {/* COMPOSER FOOTER */}

            <div className="composer-footer">
              <span>
                GPT-5.6 Luna · Web Search ·
                File Search · Vision
              </span>

              <div className="voice-controls">
                {!voiceConnected ? (
                  <button
                    className="voice-btn"
                    onClick={startVoice}
                    disabled={
                      voiceConnecting
                    }
                  >
                    {voiceConnecting
                      ? "Connecting..."
                      : "🎙️ Start Voice"}
                  </button>
                ) : (
                  <button
                    className="voice-btn active"
                    onClick={stopVoice}
                  >
                    🔴 Stop Voice
                  </button>
                )}
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}