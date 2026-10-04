"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8013";

const MODES = {
  analysis: {
    icon: "📊",
    title: "Data Analysis",
    subtitle:
      "Ask questions about CSV, Excel, JSON and other uploaded datasets.",
  },
  explore: {
    icon: "🔎",
    title: "Explore Dataset",
    subtitle:
      "Inspect columns, data types, missing values and patterns.",
  },
  charts: {
    icon: "📈",
    title: "Charts & Insights",
    subtitle:
      "Ask the AI to calculate results and create useful visualizations.",
  },
  code: {
    icon: "🐍",
    title: "Python Lab",
    subtitle:
      "Learn how Python and pandas can be used for AI-powered analysis.",
  },
};

const QUICK = [
  "Give me a complete overview of this dataset.",
  "Which columns have missing values?",
  "Find the most important patterns in this data.",
  "Create a useful chart and explain what it shows.",
  "Which category has the highest value?",
  "Calculate the average and compare the groups.",
];

export default function Page() {
  const [mode, setMode] = useState("analysis");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-5.6-luna");

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState([]);

  const fileRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    resize();
  }, [input]);

  function resize() {
    const element = textRef.current;

    if (!element) return;

    element.style.height = "auto";
    element.style.height =
      Math.min(element.scrollHeight, 180) + "px";
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setStatus("");
    setGeneratedFiles([]);
    setUploadStatus("");

    setTimeout(() => {
      resize();
      textRef.current?.focus();
    }, 0);
  }

  function chooseMode(selected) {
    setMode(selected);

    const prompts = {
      analysis:
        "Analyze this dataset and give me the most important findings.",

      explore:
        "Explore this dataset. Show its structure, columns, data types, missing values and useful observations.",

      charts:
        "Analyze this dataset and create a useful chart. Explain the chart and the main insight.",

      code:
        "Analyze this dataset using Python and explain the important pandas code used.",
    };

    setInput(prompts[selected]);

    setTimeout(() => {
      resize();
      textRef.current?.focus();
    }, 0);
  }

  async function uploadFiles(event) {
    const selected = Array.from(event.target.files || []);

    if (!selected.length) return;

    setUploading(true);
    setUploadStatus(
      `Uploading ${selected.length} file(s)...`
    );

    try {
      const uploaded = [];

      for (const file of selected) {
        const formData = new FormData();

        formData.append("file", file);

        const response = await fetch(
          `${BACKEND}/upload-data`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Upload failed."
          );
        }

        uploaded.push({
          name: data.filename,
          id: data.file_id,
          extension: data.extension,
        });
      }

      setFiles((current) => [
        ...current,
        ...uploaded,
      ]);

      setUploadStatus(
        `${uploaded.length} file(s) ready for Code Interpreter analysis.`
      );
    } catch (error) {
      setUploadStatus(
        `Upload failed: ${error.message}`
      );
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  }

  function removeFile(id) {
    setFiles((current) =>
      current.filter((file) => file.id !== id)
    );
  }

  function keyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      analyze();
    }
  }

  async function analyze() {
    const question = input.trim();

    if (!question || loading) return;

    if (!files.length) {
      setStatus(
        "Upload a CSV, Excel or data file first."
      );
      return;
    }

    const conversation = [
      ...messages,
      {
        role: "user",
        content: question,
      },
    ];

    setMessages([
      ...conversation,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setLoading(true);
    setStatus("Starting Code Interpreter...");
    setGeneratedFiles([]);

    try {
      const response = await fetch(
        `${BACKEND}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversation,
            file_ids: files.map(
              (file) => file.id
            ),
            model,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Analysis failed."
        );
      }

      setMessages((current) => {
        const updated = [...current];

        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content:
            data.answer ||
            "The analysis completed without text output.",
        };

        return updated;
      });

      setGeneratedFiles(
        data.generated_files || []
      );

      setStatus("");
    } catch (error) {
      setMessages((current) => {
        const updated = [...current];

        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content:
            `Analysis error: ${error.message}`,
        };

        return updated;
      });

      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  const modeInfo = MODES[mode];

  return (
    <main className="app-shell">

      {/* TOP BAR */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-mark">
            G
          </div>

          <div>
            <div className="brand-name">
              GenAI-Labs
            </div>

            <div className="brand-subtitle">
              V13 · Data Analysis / Code Interpreter
            </div>
          </div>

        </div>

        <div className="top-actions">

          <button
            className="top-button"
            onClick={newChat}
          >
            ＋ New Analysis
          </button>

        </div>

      </header>


      {/* WORKSPACE */}

      <div className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-title">
            DATA ANALYSIS LAB
          </div>


          <div className="sidebar-label">
            MODE
          </div>


          {Object.entries(MODES).map(
            ([key, value]) => (
              <button
                key={key}
                className={`nav-button ${
                  mode === key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  chooseMode(key)
                }
              >
                {value.icon}{" "}
                {value.title}
              </button>
            )
          )}


          <div className="sidebar-label">
            MODEL
          </div>


          <select
            className="control"
            value={model}
            onChange={(event) =>
              setModel(event.target.value)
            }
          >
            <option value="gpt-5.6-luna">
              GPT-5.6 Luna
            </option>

            <option value="gpt-5.6">
              GPT-5.6
            </option>
          </select>


          <div className="sidebar-note">
            Code Interpreter + Python analysis
          </div>


          <div className="sidebar-label">
            DATA FILES
          </div>


          <button
            className="input-tool"
            onClick={() =>
              fileRef.current?.click()
            }
            disabled={uploading}
          >
            📁 Upload CSV / Excel
          </button>


          <input
            ref={fileRef}
            hidden
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.json,.txt,.tsv,.pdf"
            onChange={uploadFiles}
          />


          <div className="asset-list">

            {files.map((file) => (

              <div
                className="asset"
                key={file.id}
              >

                <span>
                  📄
                </span>

                <div>

                  <strong>
                    {file.name}
                  </strong>

                  <small>
                    {file.extension.toUpperCase()}
                    {" · "}
                    Ready
                  </small>

                </div>


                <button
                  className="asset-remove"
                  onClick={() =>
                    removeFile(file.id)
                  }
                  title="Remove from current analysis"
                >
                  ×
                </button>

              </div>

            ))}

          </div>


          <div className="sidebar-footer">
            V13 · Data Analysis Lab
            <br />
            Python · pandas · charts · statistics
          </div>

        </aside>


        {/* MAIN */}

        <section className="main">

          {/* PAGE HEADING */}

          <div className="page-heading">

            <div>

              <div className="eyebrow">
                DATA ANALYSIS / CODE INTERPRETER
              </div>

              <h1>
                {modeInfo.icon}{" "}
                {modeInfo.title}
              </h1>

              <p>
                {modeInfo.subtitle}
              </p>

            </div>


            <div className="capability-badges">

              <span>CSV</span>
              <span>EXCEL</span>
              <span>PYTHON</span>
              <span>CHARTS</span>
              <span>STATS</span>

            </div>

          </div>


          {/* PIPELINE */}

          <section className="pipeline">

            <div className="pipeline-node">
              <span>📁</span>
              <strong>Dataset</strong>
            </div>

            <div className="pipeline-arrow">
              →
            </div>

            <div className="pipeline-node">
              <span>🔎</span>
              <strong>Inspect</strong>
            </div>

            <div className="pipeline-arrow">
              →
            </div>

            <div className="pipeline-node">
              <span>🐍</span>
              <strong>Python</strong>
            </div>

            <div className="pipeline-arrow">
              →
            </div>

            <div className="pipeline-node model-node">
              <span>🧠</span>
              <strong>
                AI Reasoning
              </strong>
            </div>

            <div className="pipeline-arrow">
              →
            </div>

            <div className="pipeline-node">
              <span>📊</span>
              <strong>Insight</strong>
            </div>

          </section>


          {/* HERO */}

          <section className="hero-card">

            <div className="hero-copy">

              <span className="hero-icon">
                📊
              </span>

              <div>

                <h2>
                  AI Data Analysis Lab
                </h2>

                <p>
                  Upload a dataset and let the
                  AI inspect, calculate, visualize
                  and explain the results using
                  Python.
                </p>

              </div>

            </div>


            <div className="input-status">

              <div
                className={`status ${
                  files.length
                    ? "ready"
                    : ""
                }`}
              >
                <span />

                {files.length
                  ? `${files.length} data file${
                      files.length > 1
                        ? "s"
                        : ""
                    } ready`
                  : "No dataset uploaded"}
              </div>


              <div className="status ready">

                <span />

                Code Interpreter

              </div>

            </div>

          </section>


          {/* UPLOAD STATUS */}

          {uploadStatus && (

            <div className="upload-status">

              {uploading && (
                <span className="spinner" />
              )}

              {uploadStatus}

            </div>

          )}


          {/* EMPTY STATE */}

          {!files.length &&
            !messages.length && (

              <section className="empty-lab">

                <div className="empty-icon">
                  📈
                </div>

                <h2>
                  Start with a dataset
                </h2>

                <p>
                  Upload CSV or Excel data,
                  then ask questions in natural
                  language. V13 can use Python
                  to calculate results and create
                  visualizations.
                </p>

                <button
                  className="primary-upload"
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  📁 Upload Dataset
                </button>

              </section>

            )}


          {/* QUICK QUESTIONS */}

          {files.length > 0 &&
            !messages.length && (

              <section className="empty-lab">

                <div className="empty-icon">
                  🧠
                </div>

                <h2>
                  What should we analyze?
                </h2>

                <p>
                  Choose a question below or
                  write your own. The AI will use
                  the uploaded files as its
                  analysis context.
                </p>


                <div className="quick-grid">

                  {QUICK.map(
                    (question) => (

                      <button
                        key={question}
                        onClick={() => {
                          setInput(question);

                          setTimeout(
                            resize,
                            0
                          );
                        }}
                      >
                        {question}
                      </button>

                    )
                  )}

                </div>

              </section>

            )}


          {/* MESSAGES */}

          <section className="messages">

            {messages.map(
              (message, index) => (

                <article
                  className={`message ${
                    message.role
                  }`}
                  key={`${message.role}-${index}`}
                >

                  <div className="message-role">

                    {message.role === "user"
                      ? "YOU"
                      : "AI ANALYST"}

                  </div>


                  <div className="message-body">

                    {message.content ||
                      (loading
                        ? "Running Python analysis..."
                        : "")}

                  </div>

                </article>

              )
            )}

          </section>


          {/* GENERATED FILES */}

          {generatedFiles.length > 0 && (

            <section className="generated-card">

              <div className="eyebrow">
                GENERATED OUTPUTS
              </div>

              <h3>
                Files created by Code Interpreter
              </h3>


              <div className="generated-list">

                {generatedFiles.map(
                  (file, index) => (

                    <div
                      className="generated-file"
                      key={`${file.file_id}-${index}`}
                    >

                      <span>
                        📊
                      </span>

                      <div>

                        <strong>
                          {file.filename ||
                            "Generated file"}
                        </strong>

                        <small>
                          Created during this
                          analysis
                        </small>

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>

          )}


          {/* STATUS */}

          {status && (

            <div className="status-bar">

              {loading && (
                <span className="spinner" />
              )}

              {status}

            </div>

          )}


          {/* COMPOSER */}

          <section className="composer">

            <textarea
              ref={textRef}
              value={input}
              onChange={(event) => {
                setInput(
                  event.target.value
                );
                resize();
              }}
              onKeyDown={keyDown}
              placeholder={
                files.length
                  ? "Ask a question about your dataset..."
                  : "Upload a dataset first..."
              }
              rows={1}
            />


            <div className="composer-bottom">

              <div className="composer-tools">

                <button
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  📁 Dataset
                </button>

                <span>
                  Enter to analyze ·
                  Shift+Enter for new line
                </span>

              </div>


              <button
                className="send-button"
                onClick={analyze}
                disabled={
                  !input.trim() ||
                  loading ||
                  !files.length
                }
              >
                {loading
                  ? "Analyzing..."
                  : "Analyze →"}
              </button>

            </div>

          </section>


          {/* ARCHITECTURE */}

          <section className="architecture-card">

            <div>

              <span className="eyebrow">
                WHAT YOU ARE LEARNING
              </span>

              <h2>
                How AI data analysis works
              </h2>

            </div>


            <div className="architecture-grid">

              <div>

                <b>
                  01
                </b>

                <strong>
                  Upload
                </strong>

                <p>
                  CSV, Excel and other supported
                  files become analysis inputs.
                </p>

              </div>


              <div>

                <b>
                  02
                </b>

                <strong>
                  Inspect
                </strong>

                <p>
                  Python can inspect rows,
                  columns, types and data quality.
                </p>

              </div>


              <div>

                <b>
                  03
                </b>

                <strong>
                  Compute
                </strong>

                <p>
                  Code Interpreter runs
                  calculations, statistics and
                  transformations.
                </p>

              </div>


              <div>

                <b>
                  04
                </b>

                <strong>
                  Visualize
                </strong>

                <p>
                  Python can create charts that
                  help explain the findings.
                </p>

              </div>

            </div>

          </section>

        </section>

      </div>

    </main>
  );
}