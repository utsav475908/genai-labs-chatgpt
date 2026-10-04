"use client";

import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8015";

const MODES = {
  writer: {
    icon: "📄",
    title: "Document Writer",
    subtitle: "Create professional documents from a natural-language prompt.",
  },
  pdf: {
    icon: "📕",
    title: "PDF Generator",
    subtitle: "Generate a formatted PDF document ready to download.",
  },
  docx: {
    icon: "📘",
    title: "DOCX Generator",
    subtitle: "Create a Microsoft Word document with professional formatting.",
  },
  report: {
    icon: "📊",
    title: "Report Generator",
    subtitle: "Create structured technical, academic or business reports.",
  },
  enhance: {
    icon: "✨",
    title: "Document Enhancer",
    subtitle: "Turn a simple document idea into a stronger professional prompt.",
  },
  templates: {
    icon: "📑",
    title: "Template Lab",
    subtitle: "Start from a ready-made document template.",
  },
};

const QUICK_PROMPTS = [
  "Create a technical report explaining Kubernetes architecture, including Pods, Nodes, Deployments, Services and Ingress.",
  "Create a college assignment about Artificial Intelligence and its applications in education.",
  "Create a professional project report for an AI-powered robotics laboratory.",
  "Create a business report explaining how generative AI can improve software development.",
  "Create a research-style report about computer vision in autonomous robots.",
  "Create a meeting report with agenda, decisions, action items and next steps.",
];

export default function Page() {
  const [mode, setMode] = useState("writer");
  const [prompt, setPrompt] = useState("");
  const [documentType, setDocumentType] = useState("Technical Report");
  const [format, setFormat] = useState("pdf");
  const [length, setLength] = useState("standard");
  const [includeTable, setIncludeTable] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);

  const activeMode = MODES[mode];

  function chooseMode(nextMode) {
    setMode(nextMode);
    setError("");
    setGenerated(null);

    if (nextMode === "pdf") setFormat("pdf");
    if (nextMode === "docx") setFormat("docx");
  }

  function useQuickPrompt(value) {
    setPrompt(value);
    setGenerated(null);
    setError("");
  }

  async function generateDocument() {
    if (!prompt.trim()) {
      setError("Please enter a document request first.");
      return;
    }

    setBusy(true);
    setError("");
    setGenerated(null);

    try {
      const response = await fetch(`${BACKEND}/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          document_type: documentType,
          format,
          title: title.trim(),
          length,
          include_table: includeTable,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Document generation failed.");
      }

      setGenerated(data);
    } catch (err) {
      setError(err.message || "Document generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function enhancePrompt() {
    if (!prompt.trim()) {
      setError("Enter a short document idea first.");
      return;
    }

    setEnhancing(true);
    setError("");

    try {
      const response = await fetch(`${BACKEND}/enhance-document-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prompt enhancement failed.");
      }

      setPrompt(data.enhanced);
    } catch (err) {
      setError(err.message || "Prompt enhancement failed.");
    } finally {
      setEnhancing(false);
    }
  }

  async function loadTemplates() {
    setTemplateLoading(true);
    setError("");

    try {
      const response = await fetch(`${BACKEND}/templates`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load templates.");
      }

      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message || "Could not load templates.");
    } finally {
      setTemplateLoading(false);
    }
  }

  function useTemplate(template) {
    setDocumentType(template.name);

    setPrompt(
      `Create a professional ${template.name.toLowerCase()} about ` +
      "the following topic: "
    );

    setMode("writer");
    setGenerated(null);
    setError("");
  }

  function downloadGenerated() {
    if (!generated?.file_base64) return;

    const binary = atob(generated.file_base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type: generated.mime_type || "application/octet-stream",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      generated.filename || "genai-labs-document";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function previewContent() {
    if (!generated?.content) return null;

    return generated.content
      .split("\n")
      .filter((line) => line.trim())
      .map((line, index) => {
        const trimmed = line.trim();
        const upper = trimmed.toUpperCase();

        if (upper.startsWith("TITLE:")) {
          return (
            <h3
              key={index}
              className="document-preview-title"
            >
              {trimmed.slice(6).trim()}
            </h3>
          );
        }

        if (upper.startsWith("HEADING:")) {
          return (
            <h4
              key={index}
              className="document-preview-heading"
            >
              {trimmed.slice(8).trim()}
            </h4>
          );
        }

        if (upper.startsWith("BULLET:")) {
          return (
            <div
              key={index}
              className="document-preview-bullet"
            >
              • {trimmed.slice(7).trim()}
            </div>
          );
        }

        if (upper.startsWith("NUMBER:")) {
          return (
            <div
              key={index}
              className="document-preview-number"
            >
              {trimmed.slice(7).trim()}
            </div>
          );
        }

        if (upper.startsWith("TABLE:")) {
          return (
            <div
              key={index}
              className="document-preview-table-title"
            >
              {trimmed.slice(6).trim()}
            </div>
          );
        }

        if (upper.startsWith("ROW:")) {
          return (
            <div
              key={index}
              className="document-preview-row"
            >
              {trimmed.slice(4).trim()}
            </div>
          );
        }

        if (upper.startsWith("PARAGRAPH:")) {
          return (
            <p key={index}>
              {trimmed.slice(10).trim()}
            </p>
          );
        }

        return <p key={index}>{trimmed}</p>;
      });
  }

  return (
    <main className="app-shell">

      {/* HEADER */}

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
              V15 · Document Generation Lab
            </div>

          </div>

        </div>

        <button
          className="new-generation"
          onClick={() => {
            setPrompt("");
            setTitle("");
            setGenerated(null);
            setError("");
          }}
        >
          + New Generation
        </button>

      </header>


      {/* WORKSPACE */}

      <div className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-label">
            DOCUMENT GENERATION LAB
          </div>

          <div className="section-label">
            MODE
          </div>


          {Object.entries(MODES).map(
            ([key, item]) => (
              <button
                key={key}
                className={`mode-button ${
                  mode === key ? "active" : ""
                }`}
                onClick={() =>
                  chooseMode(key)
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
              ✍️
            </div>

            <div>

              <strong>
                GPT-5.6 Luna
              </strong>

              <span>
                Document generation
              </span>

            </div>

          </div>


          <div className="sidebar-footer">

            <div>
              V15 · Document Generation Lab
            </div>

            <span>
              PDF · DOCX · Reports · Templates
            </span>

          </div>

        </aside>


        {/* MAIN */}

        <section className="main-content">

          <div className="breadcrumb">
            DOCUMENT GENERATION / AI DOCUMENTS
          </div>


          {/* PAGE HEADER */}

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
                GPT-5.6 Luna
              </span>

              <span>
                Document Generation
              </span>

            </div>

          </div>


          {/* PIPELINE */}

          <div className="pipeline-card">

            <div className="pipeline-step">

              <span>✍️</span>

              <b>
                Prompt
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>🧠</span>

              <b>
                Plan
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>📝</span>

              <b>
                Generate
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>📄</span>

              <b>
                Format
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>⬇️</span>

              <b>
                Download
              </b>

            </div>

          </div>


          {/* DOCUMENT CREATOR */}

          <div className="lab-card">

            <div className="card-heading">

              <div>

                <div className="eyebrow">
                  YOUR DOCUMENT REQUEST
                </div>

                <h2>
                  Describe what you want to create
                </h2>

              </div>


              <button
                className="secondary-button"
                onClick={enhancePrompt}
                disabled={
                  enhancing || busy
                }
              >

                ✨{" "}
                {enhancing
                  ? "Improving..."
                  : "Improve Prompt"}

              </button>

            </div>


            <textarea
              className="prompt-box"
              value={prompt}
              onChange={(event) =>
                setPrompt(event.target.value)
              }
              placeholder="Example: Create a technical report about Kubernetes architecture..."
              rows={6}
            />


            {/* OPTIONS */}

            <div className="options-grid">

              <label>

                <span>
                  Document Type
                </span>

                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(
                      event.target.value
                    )
                  }
                >

                  <option>
                    Technical Report
                  </option>

                  <option>
                    Project Report
                  </option>

                  <option>
                    Research Report
                  </option>

                  <option>
                    College Assignment
                  </option>

                  <option>
                    Business Report
                  </option>

                  <option>
                    Meeting Report
                  </option>

                </select>

              </label>


              <label>

                <span>
                  Format
                </span>

                <select
                  value={format}
                  onChange={(event) =>
                    setFormat(
                      event.target.value
                    )
                  }
                >

                  <option value="pdf">
                    PDF
                  </option>

                  <option value="docx">
                    DOCX
                  </option>

                </select>

              </label>


              <label>

                <span>
                  Length
                </span>

                <select
                  value={length}
                  onChange={(event) =>
                    setLength(
                      event.target.value
                    )
                  }
                >

                  <option value="short">
                    Short
                  </option>

                  <option value="standard">
                    Standard
                  </option>

                  <option value="long">
                    Long
                  </option>

                </select>

              </label>


              <label>

                <span>
                  Document Title
                </span>

                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="Optional title"
                />

              </label>

            </div>


            {/* TABLE OPTION */}

            <label className="checkbox-row">

              <input
                type="checkbox"
                checked={includeTable}
                onChange={(event) =>
                  setIncludeTable(
                    event.target.checked
                  )
                }
              />

              <span>
                Include a useful table when appropriate
              </span>

            </label>


            {/* ACTION */}

            <div className="action-row">

              <div className="small-tags">

                <span>
                  {documentType}
                </span>

                <span>
                  {format.toUpperCase()}
                </span>

                <span>
                  {length}
                </span>

              </div>


              <button
                className="primary-button"
                onClick={generateDocument}
                disabled={busy}
              >

                {busy
                  ? "⏳ Generating..."
                  : "📄 Generate Document"}

              </button>

            </div>

          </div>


          {/* ERROR */}

          {error && (

            <div className="error-box">

              <strong>
                Generation failed:
              </strong>{" "}

              {error}

            </div>

          )}


          {/* RESULT */}

          {generated && (

            <div className="result-card">

              <div className="result-header">

                <div>

                  <div className="eyebrow">
                    DOCUMENT READY
                  </div>

                  <h2>
                    {generated.title}
                  </h2>

                  <p>
                    {generated.filename}
                  </p>

                </div>


                <button
                  className="primary-button"
                  onClick={
                    downloadGenerated
                  }
                >

                  ⬇️ Download{" "}
                  {generated.format?.toUpperCase()}

                </button>

              </div>


              <div className="document-preview">

                {previewContent()}

              </div>

            </div>

          )}


          {/* QUICK IDEAS */}

          <div className="lab-card quick-card">

            <div className="eyebrow">
              QUICK IDEAS
            </div>

            <h2>
              Try a document
            </h2>


            <div className="quick-grid">

              {QUICK_PROMPTS.map(
                (item) => (

                  <button
                    key={item}
                    className="quick-prompt"
                    onClick={() =>
                      useQuickPrompt(item)
                    }
                  >

                    ✨ {item}

                  </button>

                )
              )}

            </div>

          </div>


          {/* TEMPLATE LAB */}

          <div className="lab-card template-card">

            <div className="card-heading">

              <div>

                <div className="eyebrow">
                  TEMPLATE LAB
                </div>

                <h2>
                  Start from a template
                </h2>

              </div>


              <button
                className="secondary-button"
                onClick={loadTemplates}
                disabled={
                  templateLoading
                }
              >

                {templateLoading
                  ? "Loading..."
                  : "Load Templates"}

              </button>

            </div>


            {templates.length > 0 && (

              <div className="template-grid">

                {templates.map(
                  (template) => (

                    <button
                      key={template.id}
                      className="template-item"
                      onClick={() =>
                        useTemplate(
                          template
                        )
                      }
                    >

                      <strong>
                        {template.name}
                      </strong>

                      <span>
                        {template.description}
                      </span>

                    </button>

                  )
                )}

              </div>

            )}


            {templates.length === 0 && (

              <p className="empty-template">

                Load the available report,
                assignment and business
                templates.

              </p>

            )}

          </div>

        </section>

      </div>

    </main>
  );
}