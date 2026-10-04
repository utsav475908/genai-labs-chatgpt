"use client";

import { useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8014";

const MODES = {
  generate: {
    icon: "🎨",
    title: "Text → Image",
    subtitle: "Create a new image from a natural-language prompt.",
  },
  edit: {
    icon: "🪄",
    title: "Image Edit",
    subtitle: "Upload an image and describe the changes you want.",
  },
  variations: {
    icon: "🖼️",
    title: "Variations",
    subtitle: "Generate multiple visual directions from one idea.",
  },
  prompt: {
    icon: "✨",
    title: "Prompt Lab",
    subtitle: "Turn a simple idea into a stronger image prompt.",
  },
};

const QUICK_PROMPTS = [
  "A futuristic robotics laboratory with humanoid robots, cinematic lighting",
  "A modern AI classroom where students are learning with robots",
  "A realistic humanoid robot working beside an engineer in a laboratory",
  "A futuristic university campus designed around artificial intelligence",
  "A friendly educational robot teaching students in a bright classroom",
  "A cinematic aerial view of a smart city powered by AI",
];

export default function Page() {
  const [mode, setMode] = useState("generate");
  const [prompt, setPrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");

  const [images, setImages] = useState([]);
  const [sourceImage, setSourceImage] = useState(null);
  const [sourcePreview, setSourcePreview] = useState("");

  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("auto");
  const [background, setBackground] = useState("auto");
  const [count, setCount] = useState(1);

  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [status, setStatus] = useState("");

  const imageInputRef = useRef(null);

  function newGeneration() {
    setPrompt("");
    setEnhancedPrompt("");
    setImages([]);
    setSourceImage(null);
    setSourcePreview("");
    setStatus("");
  }

  function changeMode(newMode) {
    setMode(newMode);
    setImages([]);
    setStatus("");

    if (newMode === "generate") {
      setPrompt("");
      setEnhancedPrompt("");
    }

    if (newMode === "edit") {
      setPrompt(
        "Change the background to a modern AI robotics laboratory while keeping the main subject realistic."
      );
    }

    if (newMode === "prompt") {
      setPrompt("robot in a futuristic laboratory");
    }

    if (newMode === "variations") {
      setPrompt(
        "A futuristic humanoid robot in an advanced robotics laboratory"
      );
    }
  }

  function chooseImage() {
    imageInputRef.current?.click();
  }

  function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setStatus("Please select a PNG, JPEG or WEBP image.");
      return;
    }

    setSourceImage(file);
    setSourcePreview(URL.createObjectURL(file));
    setImages([]);
    setStatus("Source image ready.");
  }

  async function generateImage() {
    if (!prompt.trim()) {
      setStatus("Enter an image prompt first.");
      return;
    }

    setLoading(true);
    setStatus("Generating image...");
    setImages([]);

    try {
      const response = await fetch(`${BACKEND}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: enhancedPrompt || prompt.trim(),
          size,
          quality,
          n: count,
          background,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Image generation failed.");
      }

      const result = (data.images || []).map((item) => ({
        src: `data:image/png;base64,${item.data}`,
        type: "generated",
      }));

      setImages(result);
      setStatus(`Generated ${result.length} image${result.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(`Generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function editImage() {
    if (!sourceImage) {
      setStatus("Upload an image first.");
      return;
    }

    if (!prompt.trim()) {
      setStatus("Describe the changes you want.");
      return;
    }

    setLoading(true);
    setStatus("Editing image...");
    setImages([]);

    try {
      const formData = new FormData();

      formData.append("image", sourceImage);
      formData.append("prompt", prompt.trim());
      formData.append("size", size);
      formData.append("quality", quality);
      formData.append("n", String(count));

      const response = await fetch(`${BACKEND}/edit`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Image editing failed.");
      }

      const result = (data.images || []).map((item) => ({
        src: `data:image/png;base64,${item.data}`,
        type: "edited",
      }));

      setImages(result);
      setStatus(`Created ${result.length} edited image${result.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(`Editing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function enhancePrompt() {
    if (!prompt.trim()) {
      setStatus("Enter a short idea first.");
      return;
    }

    setEnhancing(true);
    setStatus("Improving prompt...");

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());

      const response = await fetch(`${BACKEND}/enhance-prompt`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prompt enhancement failed.");
      }

      setEnhancedPrompt(data.enhanced || "");
      setPrompt(data.enhanced || prompt);
      setStatus("Prompt improved.");
    } catch (error) {
      setStatus(`Prompt enhancement failed: ${error.message}`);
    } finally {
      setEnhancing(false);
    }
  }

  async function describeImage() {
    if (!sourceImage) {
      setStatus("Upload an image first.");
      return;
    }

    setLoading(true);
    setStatus("Understanding image...");

    try {
      const formData = new FormData();
      formData.append("image", sourceImage);

      const response = await fetch(`${BACKEND}/describe-image`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Image analysis failed.");
      }

      setPrompt(data.description || "");
      setMode("edit");
      setStatus("Image analyzed. You can now edit it.");
    } catch (error) {
      setStatus(`Image analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function downloadImage(src, index) {
    const link = document.createElement("a");

    link.href = src;
    link.download = `genai-labs-v14-${index + 1}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function useQuickPrompt(value) {
    setPrompt(value);
    setEnhancedPrompt("");
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      mode !== "edit" &&
      mode !== "prompt"
    ) {
      event.preventDefault();
      generateImage();
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
              V14 · Image Generation Lab
            </div>
          </div>

        </div>

        <button
          className="top-button"
          onClick={newGeneration}
        >
          ＋ New Generation
        </button>

      </header>


      {/* WORKSPACE */}

      <div className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-title">
            IMAGE GENERATION LAB
          </div>


          <div className="sidebar-label">
            MODE
          </div>


          {Object.entries(MODES).map(([key, item]) => (

            <button
              key={key}
              className={`nav-button ${
                mode === key ? "active" : ""
              }`}
              onClick={() => changeMode(key)}
            >
              {item.icon} {item.title}
            </button>

          ))}


          <div className="sidebar-label">
            MODEL
          </div>


          <div className="model-card">

            <span>
              🎨
            </span>

            <div>

              <strong>
                GPT-Image-2
              </strong>

              <small>
                Image generation & editing
              </small>

            </div>

          </div>


          <div className="sidebar-label">
            SETTINGS
          </div>


          <label className="setting-label">
            Size

            <select
              className="control"
              value={size}
              onChange={(event) =>
                setSize(event.target.value)
              }
            >
              <option value="1024x1024">
                Square · 1024×1024
              </option>

              <option value="1536x1024">
                Landscape · 1536×1024
              </option>

              <option value="1024x1536">
                Portrait · 1024×1536
              </option>
            </select>

          </label>


          <label className="setting-label">
            Quality

            <select
              className="control"
              value={quality}
              onChange={(event) =>
                setQuality(event.target.value)
              }
            >
              <option value="auto">
                Auto
              </option>

              <option value="low">
                Low
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="high">
                High
              </option>
            </select>

          </label>


          <label className="setting-label">
            Number of Images

            <select
              className="control"
              value={count}
              onChange={(event) =>
                setCount(Number(event.target.value))
              }
            >
              <option value={1}>
                1 image
              </option>

              <option value={2}>
                2 images
              </option>

              <option value={3}>
                3 images
              </option>

              <option value={4}>
                4 images
              </option>
            </select>

          </label>


          <label className="setting-label">
            Background

            <select
              className="control"
              value={background}
              onChange={(event) =>
                setBackground(event.target.value)
              }
            >
              <option value="auto">
                Auto
              </option>

              <option value="opaque">
                Opaque
              </option>

              <option value="transparent">
                Transparent
              </option>
            </select>

          </label>


          <div className="sidebar-footer">
            V14 · Image Generation Lab
            <br />
            Text → Image · Editing · Prompt Lab
          </div>

        </aside>


        {/* MAIN */}

        <section className="main">

          {/* HEADING */}

          <div className="page-heading">

            <div>

              <div className="eyebrow">
                IMAGE GENERATION / EDITING
              </div>

              <h1>
                {modeInfo.icon} {modeInfo.title}
              </h1>

              <p>
                {modeInfo.subtitle}
              </p>

            </div>


            <div className="capability-badges">

              <span>
                TEXT → IMAGE
              </span>

              <span>
                IMAGE EDIT
              </span>

              <span>
                VARIATIONS
              </span>

              <span>
                PROMPT LAB
              </span>

            </div>

          </div>


          {/* PIPELINE */}

          <section className="pipeline">

            <div className="pipeline-node">

              <span>
                ✍️
              </span>

              <strong>
                Prompt
              </strong>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-node">

              <span>
                🧠
              </span>

              <strong>
                Understand
              </strong>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-node model-node">

              <span>
                🎨
              </span>

              <strong>
                Generate
              </strong>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-node">

              <span>
                🖼️
              </span>

              <strong>
                Image
              </strong>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-node">

              <span>
                ✨
              </span>

              <strong>
                Refine
              </strong>

            </div>

          </section>


          {/* HERO */}

          <section className="hero-card">

            <div className="hero-copy">

              <span className="hero-icon">
                🎨
              </span>

              <div>

                <h2>
                  AI Image Generation Lab
                </h2>

                <p>
                  Create images, edit existing images
                  and experiment with AI prompts.
                </p>

              </div>

            </div>


            <div className="hero-status">

              <div className="status ready">
                <span />
                GPT-Image-2
              </div>

              <div className="status ready">
                <span />
                Image Generation
              </div>

            </div>

          </section>


          {/* CREATION */}

          <section className="creation-card">

            <div className="creation-header">

              <div>

                <div className="eyebrow">
                  YOUR PROMPT
                </div>

                <h2>
                  Describe what you want
                </h2>

              </div>


              <div className="creation-actions">

                {mode !== "edit" && (

                  <button
                    className="secondary-button"
                    onClick={enhancePrompt}
                    disabled={
                      enhancing ||
                      !prompt.trim()
                    }
                  >
                    {enhancing
                      ? "Improving..."
                      : "✨ Improve Prompt"}
                  </button>

                )}


                {mode === "edit" && (

                  <button
                    className="secondary-button"
                    onClick={chooseImage}
                  >
                    📁 Upload Image
                  </button>

                )}

              </div>

            </div>


            {/* IMAGE INPUT */}

            <input
              ref={imageInputRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImage}
            />


            {mode === "edit" && sourcePreview && (

              <div className="source-panel">

                <img
                  src={sourcePreview}
                  alt="Source image"
                />

                <div className="source-info">

                  <strong>
                    Source image ready
                  </strong>

                  <span>
                    Describe what you want to change.
                  </span>

                  <div className="source-actions">

                    <button
                      className="small-button"
                      onClick={describeImage}
                      disabled={loading}
                    >
                      🔎 Analyze Image
                    </button>

                    <button
                      className="small-button"
                      onClick={chooseImage}
                    >
                      Replace
                    </button>

                  </div>

                </div>

              </div>

            )}


            {mode === "edit" && !sourcePreview && (

              <button
                className="upload-dropzone"
                onClick={chooseImage}
              >

                <span>
                  🖼️
                </span>

                <strong>
                  Upload an image to edit
                </strong>

                <small>
                  PNG, JPEG or WEBP
                </small>

              </button>

            )}


            {/* PROMPT */}

            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setEnhancedPrompt("");
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "edit"
                  ? "Example: Change the background to a futuristic robotics laboratory..."
                  : "Example: A futuristic robotics laboratory with humanoid robots..."
              }
              rows={3}
            />


            {/* ENHANCED PROMPT */}

            {enhancedPrompt && (

              <div className="enhanced-card">

                <div className="eyebrow">
                  ENHANCED PROMPT
                </div>

                <p>
                  {enhancedPrompt}
                </p>

                <button
                  className="small-button"
                  onClick={() =>
                    setPrompt(enhancedPrompt)
                  }
                >
                  Use Enhanced Prompt
                </button>

              </div>

            )}


            {/* BOTTOM */}

            <div className="prompt-bottom">

              <div className="prompt-hints">

                <span>
                  {size}
                </span>

                <span>
                  {quality}
                </span>

                <span>
                  {count} image
                  {count > 1 ? "s" : ""}
                </span>

              </div>


              {mode === "edit" ? (

                <button
                  className="generate-button"
                  onClick={editImage}
                  disabled={
                    loading ||
                    !sourceImage ||
                    !prompt.trim()
                  }
                >
                  {loading
                    ? "Editing..."
                    : "🪄 Edit Image"}
                </button>

              ) : mode === "prompt" ? (

                <button
                  className="generate-button"
                  onClick={enhancePrompt}
                  disabled={
                    enhancing ||
                    !prompt.trim()
                  }
                >
                  {enhancing
                    ? "Improving..."
                    : "✨ Enhance Prompt"}
                </button>

              ) : (

                <button
                  className="generate-button"
                  onClick={generateImage}
                  disabled={
                    loading ||
                    !prompt.trim()
                  }
                >
                  {loading
                    ? "Generating..."
                    : "🎨 Generate Image"}
                </button>

              )}

            </div>

          </section>


          {/* QUICK PROMPTS */}

          {mode !== "edit" && mode !== "prompt" && (

            <section className="quick-section">

              <div className="section-heading">

                <div>

                  <div className="eyebrow">
                    QUICK IDEAS
                  </div>

                  <h2>
                    Try a prompt
                  </h2>

                </div>

              </div>


              <div className="quick-grid">

                {QUICK_PROMPTS.map((item) => (

                  <button
                    key={item}
                    onClick={() =>
                      useQuickPrompt(item)
                    }
                  >

                    <span>
                      ✨
                    </span>

                    {item}

                  </button>

                ))}

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


          {/* GALLERY */}

          {images.length > 0 && (

            <section className="gallery-section">

              <div className="section-heading">

                <div>

                  <div className="eyebrow">
                    GENERATED RESULTS
                  </div>

                  <h2>
                    Image Gallery
                  </h2>

                </div>

                <span className="gallery-count">
                  {images.length} result
                  {images.length > 1 ? "s" : ""}
                </span>

              </div>


              <div
                className={`gallery ${
                  images.length === 1
                    ? "single"
                    : ""
                }`}
              >

                {images.map((image, index) => (

                  <article
                    className="image-card"
                    key={`${index}-${image.src.slice(0, 20)}`}
                  >

                    <img
                      src={image.src}
                      alt={`Generated result ${index + 1}`}
                    />

                    <div className="image-card-footer">

                      <span>
                        {image.type === "edited"
                          ? "Edited image"
                          : "Generated image"}
                      </span>

                      <button
                        className="small-button"
                        onClick={() =>
                          downloadImage(
                            image.src,
                            index
                          )
                        }
                      >
                        ↓ Save
                      </button>

                    </div>

                  </article>

                ))}

              </div>

            </section>

          )}


          {/* EMPTY GALLERY */}

          {!images.length && !loading && (

            <section className="empty-gallery">

              <div className="empty-gallery-icon">
                🖼️
              </div>

              <h2>
                Your generated images will appear here
              </h2>

              <p>
                Start with a prompt and generate your
                first V14 image.
              </p>

            </section>

          )}


          {/* LEARNING SECTION */}

          <section className="architecture-card">

            <div>

              <span className="eyebrow">
                WHAT YOU ARE LEARNING
              </span>

              <h2>
                How AI image generation works
              </h2>

            </div>


            <div className="architecture-grid">

              <div>

                <b>
                  01
                </b>

                <strong>
                  Prompt
                </strong>

                <p>
                  Natural language describes the image
                  you want the model to create.
                </p>

              </div>


              <div>

                <b>
                  02
                </b>

                <strong>
                  Understanding
                </strong>

                <p>
                  The AI interprets subjects, relationships,
                  composition and visual style.
                </p>

              </div>


              <div>

                <b>
                  03
                </b>

                <strong>
                  Generation
                </strong>

                <p>
                  The image model creates a new visual
                  based on the instructions.
                </p>

              </div>


              <div>

                <b>
                  04
                </b>

                <strong>
                  Refinement
                </strong>

                <p>
                  Editing and prompt improvement allow
                  iterative visual creation.
                </p>

              </div>

            </div>

          </section>

        </section>

      </div>

    </main>
  );
}