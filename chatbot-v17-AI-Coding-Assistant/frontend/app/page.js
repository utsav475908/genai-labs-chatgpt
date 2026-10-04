"use client";

import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8017";

const MODES = {
  generate: {
    icon: "💻",
    title: "Generate Code",
    subtitle: "Create code from a natural-language requirement.",
  },
  debug: {
    icon: "🐛",
    title: "Debug Code",
    subtitle: "Find bugs and generate corrected code.",
  },
  review: {
    icon: "🔍",
    title: "Code Review",
    subtitle: "Analyze quality, security and maintainability.",
  },
  explain: {
    icon: "📖",
    title: "Explain Code",
    subtitle: "Understand code step by step.",
  },
  refactor: {
    icon: "🔄",
    title: "Refactor",
    subtitle: "Improve structure without changing intent.",
  },
  tests: {
    icon: "🧪",
    title: "Generate Tests",
    subtitle: "Create useful unit and edge-case tests.",
  },
  optimize: {
    icon: "⚡",
    title: "Optimize",
    subtitle: "Find performance and efficiency improvements.",
  },
};

const LANGUAGES = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C",
  "C++",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "SQL",
  "HTML",
  "CSS",
  "Shell",
];

const QUICK_PROMPTS = [
  "Create a FastAPI REST API for a student management system.",
  "Write a Python program that reads a CSV file and calculates statistics.",
  "Create a React dashboard with cards, charts and a sidebar.",
  "Write a Kubernetes Deployment and Service YAML for nginx.",
];

export default function Page() {
  const [mode, setMode] = useState("generate");
  const [language, setLanguage] = useState("Python");

  const [instruction, setInstruction] = useState(
    "Create a Python REST API that manages a list of students."
  );

  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeMode = MODES[mode];

  function reset() {
    setInstruction(
      "Create a Python REST API that manages a list of students."
    );

    setCode("");
    setResult("");
    setFilename("");
    setError("");
    setMode("generate");
    setLanguage("Python");
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    setResult("");
    setError("");
  }

  async function readJson(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        error:
          text ||
          `Server returned HTTP ${response.status}`,
      };
    }
  }

  async function runAssistant() {
    if (!instruction.trim() && !code.trim()) {
      setError(
        "Please provide an instruction or existing code."
      );
      return;
    }

    setBusy(true);
    setError("");
    setResult("");

    try {
      const response = await fetch(
        `${BACKEND}/code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode,
            language,
            code,
            instruction,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.error ||
            "Coding request failed."
        );
      }

      setResult(data.result || "");
    } catch (err) {
      setError(
        err.message ||
          "Coding request failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateCode() {
    if (!instruction.trim()) {
      setError(
        "Please describe what you want to build."
      );
      return;
    }

    setBusy(true);
    setError("");
    setResult("");

    try {
      const response = await fetch(
        `${BACKEND}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language,
            instruction,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.error ||
            "Code generation failed."
        );
      }

      setResult(data.result || "");
    } catch (err) {
      setError(
        err.message ||
          "Code generation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadCode(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);
    setError("");
    setResult("");

    try {
      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        `${BACKEND}/upload-code`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await readJson(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.error ||
            "File upload failed."
        );
      }

      setCode(
        data.code || ""
      );

      setFilename(
        data.filename ||
          file.name
      );

      setInstruction(
        `Analyze the uploaded file "${data.filename}".`
      );
    } catch (err) {
      setError(
        err.message ||
          "File upload failed."
      );
    } finally {
      setBusy(false);

      event.target.value = "";
    }
  }

  function useQuickPrompt(prompt) {
    setInstruction(prompt);
    setMode("generate");
    setResult("");
    setError("");
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        result
      );
    } catch {
      setError(
        "Could not copy the result to the clipboard."
      );
    }
  }

  function downloadResult() {
    if (!result) {
      return;
    }

    const blob = new Blob(
      [result],
      {
        type:
          "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      "genai-labs-v17-result.txt";

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">

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
              V17 · AI Coding Assistant
            </div>

          </div>

        </div>

        <button
          className="new-generation"
          onClick={reset}
        >
          + New Coding Session
        </button>

      </header>


      <div className="workspace">

        <aside className="sidebar">

          <div className="sidebar-label">
            AI CODING ASSISTANT
          </div>


          <div className="section-label">
            MODE
          </div>


          {Object.entries(MODES).map(
            ([key, item]) => (

              <button
                key={key}
                className={`mode-button ${
                  mode === key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  selectMode(key)
                }
              >

                <span className="mode-icon">
                  {item.icon}
                </span>

                <span>
                  {item.title}
                </span>

              </button>

            )
          )}


          <div className="section-label model-section">
            MODEL
          </div>


          <div className="model-card">

            <div className="model-icon">
              🧠
            </div>

            <div>

              <strong>
                GPT-6 Astra
              </strong>

              <span>
                Software engineering
              </span>

            </div>

          </div>


          <div className="section-label model-section">
            LANGUAGE
          </div>


          <select
            className="language-select"
            value={language}
            onChange={(event) =>
              setLanguage(
                event.target.value
              )
            }
          >

            {LANGUAGES.map(
              (item) => (

                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>

              )
            )}

          </select>


          <div className="sidebar-footer">

            <div>
              V17 · AI Coding Assistant
            </div>

            <span>
              Generate · Debug · Review · Refactor
            </span>

          </div>

        </aside>


        <section className="main-content">

          <div className="breadcrumb">
            CODE / ENGINEERING / AI ASSISTANT
          </div>


          <div className="page-heading">

            <div>

              <h1>
                {activeMode.icon}{" "}
                {activeMode.title}
              </h1>

              <p>
                {activeMode.subtitle}
              </p>

            </div>


            <div className="mode-pills">

              <span>
                GPT-6 Astra
              </span>

              <span>
                {language}
              </span>

            </div>

          </div>


          <div className="pipeline-card">

            <div className="pipeline-step">

              <span>
                💬
              </span>

              <b>
                Prompt
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>
                📄
              </span>

              <b>
                Code Context
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>
                🧠
              </span>

              <b>
                AI Engineer
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>
                💻
              </span>

              <b>
                Solution
              </b>

            </div>

          </div>


          <div className="coding-grid">


            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    CODING WORKSPACE
                  </div>

                  <h2>
                    {activeMode.title}
                  </h2>

                </div>

              </div>


              <label className="field-label">
                Programming Language
              </label>


              <select
                className="language-select large"
                value={language}
                onChange={(event) =>
                  setLanguage(
                    event.target.value
                  )
                }
              >

                {LANGUAGES.map(
                  (item) => (

                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>

                  )
                )}

              </select>


              <label className="field-label">
                Instruction
              </label>


              <textarea
                className="prompt-box"
                value={instruction}
                onChange={(event) =>
                  setInstruction(
                    event.target.value
                  )
                }
                rows={6}
                placeholder="Describe what you want the AI coding assistant to do..."
              />


              <label className="field-label">
                Existing Code
              </label>


              <textarea
                className="code-box"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                  )
                }
                rows={13}
                spellCheck={false}
                placeholder={`Paste your ${language} code here...`}
              />


              <div className="input-footer">

                <label className="upload-button">

                  📁 Upload Code

                  <input
                    type="file"
                    hidden
                    accept=".py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.cc,.h,.hpp,.go,.rs,.php,.rb,.swift,.kt,.kts,.sql,.sh,.bash,.yaml,.yml,.json,.html,.htm,.css"
                    onChange={
                      uploadCode
                    }
                  />

                </label>


                {filename && (

                  <span className="file-chip">

                    📄 {filename}

                  </span>

                )}

              </div>


              <div className="action-row">

                <div className="small-tags">

                  <span>
                    {language}
                  </span>

                  <span>
                    {activeMode.title}
                  </span>

                  <span>
                    AI Engineer
                  </span>

                </div>


                <button
                  className="primary-button"
                  onClick={
                    mode === "generate"
                      ? generateCode
                      : runAssistant
                  }
                  disabled={busy}
                >

                  {busy
                    ? "⏳ Working..."
                    : `${activeMode.icon} ${activeMode.title}`}

                </button>

              </div>

            </div>


            <div className="lab-card result-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    AI OUTPUT
                  </div>

                  <h2>
                    Engineering Result
                  </h2>

                </div>


                {result && (

                  <div className="result-actions">

                    <button
                      className="small-button"
                      onClick={
                        copyResult
                      }
                    >
                      📋 Copy
                    </button>


                    <button
                      className="small-button"
                      onClick={
                        downloadResult
                      }
                    >
                      ⬇️ Save
                    </button>

                  </div>

                )}

              </div>


              {!result && !busy && (

                <div className="empty-state">

                  <div className="empty-icon">
                    💻
                  </div>

                  <h3>
                    Your coding result will appear here
                  </h3>

                  <p>
                    Describe a task or provide code
                    and ask the AI engineer to work on it.
                  </p>

                </div>

              )}


              {busy && (

                <div className="loading-state">

                  <div className="loading-orb">
                    🧠
                  </div>

                  <h3>
                    AI engineer is working...
                  </h3>

                  <p>
                    Analyzing your request and code.
                  </p>

                </div>

              )}


              {result && (

                <div className="code-result">

                  <pre>
                    {result}
                  </pre>

                </div>

              )}

            </div>

          </div>


          {error && (

            <div className="error-box">

              <strong>
                Operation failed:
              </strong>{" "}

              {error}

            </div>

          )}


          <div className="lab-card quick-card">

            <div className="eyebrow">
              QUICK CODING TASKS
            </div>

            <h2>
              Try an engineering experiment
            </h2>


            <div className="quick-grid">

              {QUICK_PROMPTS.map(
                (prompt) => (

                  <button
                    key={prompt}
                    className="quick-prompt"
                    onClick={() =>
                      useQuickPrompt(
                        prompt
                      )
                    }
                  >
                    💻 {prompt}
                  </button>

                )
              )}

            </div>

          </div>


          <div className="lab-card architecture-card">

            <div className="eyebrow">
              V17 ARCHITECTURE
            </div>

            <h2>
              How the AI Coding Assistant works
            </h2>


            <div className="architecture-grid">

              <div className="architecture-node">

                <span>
                  👨‍💻
                </span>

                <strong>
                  Developer
                </strong>

                <small>
                  Requirement
                </small>

              </div>


              <div className="architecture-arrow">
                →
              </div>


              <div className="architecture-node">

                <span>
                  📄
                </span>

                <strong>
                  Code Context
                </strong>

                <small>
                  Source files
                </small>

              </div>


              <div className="architecture-arrow">
                →
              </div>


              <div className="architecture-node">

                <span>
                  🧠
                </span>

                <strong>
                  GPT-6 Astra
                </strong>

                <small>
                  Reasoning
                </small>

              </div>


              <div className="architecture-arrow">
                →
              </div>


              <div className="architecture-node">

                <span>
                  🚀
                </span>

                <strong>
                  Solution
                </strong>

                <small>
                  Code / Review / Fix
                </small>

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}