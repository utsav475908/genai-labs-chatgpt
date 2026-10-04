"use client";

import { useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8016";

const MODES = {
  record: {
    icon: "🎤",
    title: "Record & Transcribe",
    subtitle: "Record your voice and convert it into text.",
  },

  audio: {
    icon: "📁",
    title: "Audio → Text",
    subtitle: "Upload an audio file and generate a transcript.",
  },

  speech: {
    icon: "🔊",
    title: "Text → Speech",
    subtitle: "Turn written text into natural-sounding speech.",
  },

  translation: {
    icon: "🌐",
    title: "Translation",
    subtitle: "Transcribe speech and translate it into another language.",
  },

  analyzer: {
    icon: "📝",
    title: "Transcript Analyzer",
    subtitle: "Summarize transcripts and extract topics and action items.",
  },

  voice: {
    icon: "🎧",
    title: "Voice Lab",
    subtitle: "Explore the architecture behind realtime AI voice.",
  },
};

const QUICK_TEXTS = [
  "Welcome to the GenAI-Labs artificial intelligence laboratory.",
  "Kubernetes is a container orchestration platform used to deploy and manage containerized applications.",
  "Today we are learning how artificial intelligence can be used in robotics and education.",
];

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
];

export default function Page() {
  const [mode, setMode] = useState("record");

  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState("");

  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [translatedText, setTranslatedText] = useState("");

  const [speechText, setSpeechText] = useState(
    "Welcome to the GenAI-Labs artificial intelligence laboratory."
  );

  const [voice, setVoice] = useState("alloy");
  const [targetLanguage, setTargetLanguage] =
    useState("English");

  const [audioUrl, setAudioUrl] = useState("");

  const [recording, setRecording] =
    useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const activeMode = MODES[mode];

  function resetResults() {
    setError("");
    setTranscript("");
    setAnalysis("");
    setTranslatedText("");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl("");
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  function selectAudio(file) {
    if (!file) return;

    setAudioFile(file);
    setAudioName(file.name);
    setError("");
    setTranscript("");
    setAnalysis("");
    setTranslatedText("");
  }

  async function startRecording() {
    resetResults();

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const recorder =
        new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(
          audioChunksRef.current,
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        const file = new File(
          [blob],
          "recording.webm",
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        setAudioFile(file);
        setAudioName("recording.webm");

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      };

      recorder.start();

      mediaRecorderRef.current =
        recorder;

      setRecording(true);
    } catch (err) {
      setError(
        "Microphone access failed. Please allow microphone access in your browser."
      );
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      recording
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  }

  async function transcribe() {
    if (!audioFile) {
      setError("Please select or record an audio file first.");
      return;
    }

    setBusy(true);
    setError("");
    setTranscript("");

    try {
      const formData = new FormData();

      formData.append(
        "audio",
        audioFile
      );

      formData.append(
        "language",
        "auto"
      );

      const response = await fetch(
        `${BACKEND}/transcribe`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Transcription failed."
        );
      }

      setTranscript(
        data.text || ""
      );
    } catch (err) {
      setError(
        err.message ||
          "Transcription failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function translateAudio() {
    if (!audioFile) {
      setError(
        "Please select or record an audio file first."
      );
      return;
    }

    setBusy(true);
    setError("");
    setTranslatedText("");

    try {
      const formData =
        new FormData();

      formData.append(
        "audio",
        audioFile
      );

      formData.append(
        "target_language",
        targetLanguage
      );

      const response =
        await fetch(
          `${BACKEND}/translate`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Translation failed."
        );
      }

      setTranscript(
        data.source_text || ""
      );

      setTranslatedText(
        data.translated_text || ""
      );
    } catch (err) {
      setError(
        err.message ||
          "Translation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateSpeech() {
    if (!speechText.trim()) {
      setError(
        "Please enter some text first."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await fetch(
          `${BACKEND}/speech`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              text:
                speechText.trim(),
              voice,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Speech generation failed."
        );
      }

      const binary =
        atob(data.audio_base64);

      const bytes =
        new Uint8Array(
          binary.length
        );

      for (
        let i = 0;
        i < binary.length;
        i += 1
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      const blob =
        new Blob(
          [bytes],
          {
            type:
              data.mime_type ||
              "audio/mpeg",
          }
        );

      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );
      }

      const url =
        URL.createObjectURL(
          blob
        );

      setAudioUrl(url);
    } catch (err) {
      setError(
        err.message ||
          "Speech generation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function analyzeTranscript() {
    if (!transcript.trim()) {
      setError(
        "Please transcribe some audio first."
      );
      return;
    }

    setBusy(true);
    setError("");
    setAnalysis("");

    try {
      const response =
        await fetch(
          `${BACKEND}/analyze-transcript`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              transcript:
                transcript.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Transcript analysis failed."
        );
      }

      setAnalysis(
        data.analysis || ""
      );
    } catch (err) {
      setError(
        err.message ||
          "Transcript analysis failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function useQuickText(text) {
    setSpeechText(text);
    setMode("speech");
    setError("");
  }

  function renderTranscript() {
    if (!transcript) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            🎙️
          </div>

          <h3>
            Your transcript will appear here
          </h3>

          <p>
            Record or upload audio to
            generate text.
          </p>
        </div>
      );
    }

    return (
      <div className="text-result">
        <div className="result-label">
          TRANSCRIPT
        </div>

        <p>
          {transcript}
        </p>
      </div>
    );
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
              V16 · Speech & Transcription Lab
            </div>

          </div>

        </div>


        <button
          className="new-generation"
          onClick={resetResults}
        >
          + New Session
        </button>

      </header>


      <div className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-label">
            SPEECH & TRANSCRIPTION LAB
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
            MODELS
          </div>


          <div className="model-card">

            <div className="model-icon">
              🎙️
            </div>

            <div>

              <strong>
                GPT-Transcribe
              </strong>

              <span>
                Speech recognition
              </span>

            </div>

          </div>


          <div className="model-card">

            <div className="model-icon">
              🔊
            </div>

            <div>

              <strong>
                GPT-4o Mini TTS
              </strong>

              <span>
                Speech generation
              </span>

            </div>

          </div>


          <div className="sidebar-footer">

            <div>
              V16 · Speech & Transcription Lab
            </div>

            <span>
              STT · TTS · Translation · Analysis
            </span>

          </div>

        </aside>


        {/* MAIN */}

        <section className="main-content">

          <div className="breadcrumb">
            SPEECH / AUDIO / AI VOICE
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
                GPT-Transcribe
              </span>

              <span>
                Speech AI
              </span>

            </div>

          </div>


          {/* PIPELINE */}

          <div className="pipeline-card">

            <div className="pipeline-step">

              <span>
                🎙️
              </span>

              <b>
                Audio
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>
                📝
              </span>

              <b>
                Transcribe
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
                Understand
              </b>

            </div>


            <div className="pipeline-arrow">
              →
            </div>


            <div className="pipeline-step">

              <span>
                🔊
              </span>

              <b>
                Speech
              </b>

            </div>

          </div>


          {/* RECORD MODE */}

          {mode === "record" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    LIVE RECORDING
                  </div>

                  <h2>
                    Record your voice
                  </h2>

                </div>

              </div>


              <div className="record-panel">

                <div
                  className={`record-circle ${
                    recording
                      ? "recording"
                      : ""
                  }`}
                >
                  {recording
                    ? "⏹️"
                    : "🎤"}
                </div>


                <h3>
                  {recording
                    ? "Recording..."
                    : "Ready to record"}
                </h3>


                <p>
                  Speak clearly into your
                  microphone.
                </p>


                {!recording ? (

                  <button
                    className="primary-button"
                    onClick={
                      startRecording
                    }
                  >
                    🎙️ Start Recording
                  </button>

                ) : (

                  <button
                    className="primary-button"
                    onClick={
                      stopRecording
                    }
                  >
                    ⏹️ Stop Recording
                  </button>

                )}

              </div>


              {audioName && (

                <div className="file-chip">
                  🎵 {audioName}
                </div>

              )}


              {audioFile && !recording && (

                <button
                  className="primary-button"
                  onClick={
                    transcribe
                  }
                  disabled={busy}
                >
                  {busy
                    ? "⏳ Transcribing..."
                    : "📝 Transcribe Recording"}
                </button>

              )}

            </div>

          )}


          {/* AUDIO UPLOAD */}

          {mode === "audio" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    AUDIO INPUT
                  </div>

                  <h2>
                    Upload audio
                  </h2>

                </div>

              </div>


              <label className="upload-area">

                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.flac"
                  onChange={(event) =>
                    selectAudio(
                      event.target
                        .files?.[0]
                    )
                  }
                />

                <div className="upload-icon">
                  📁
                </div>

                <strong>
                  Choose an audio file
                </strong>

                <span>
                  MP3 · WAV · M4A · WEBM · OGG · FLAC
                </span>

              </label>


              {audioName && (

                <div className="file-chip">
                  🎵 {audioName}
                </div>

              )}


              <button
                className="primary-button"
                onClick={
                  transcribe
                }
                disabled={
                  busy ||
                  !audioFile
                }
              >

                {busy
                  ? "⏳ Transcribing..."
                  : "📝 Transcribe Audio"}

              </button>

            </div>

          )}


          {/* SPEECH */}

          {mode === "speech" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    TEXT TO SPEECH
                  </div>

                  <h2>
                    Generate spoken audio
                  </h2>

                </div>

              </div>


              <textarea
                className="prompt-box"
                value={speechText}
                onChange={(event) =>
                  setSpeechText(
                    event.target.value
                  )
                }
                rows={7}
                placeholder="Enter the text you want the AI to speak..."
              />


              <div className="options-grid">

                <label>

                  <span>
                    Voice
                  </span>

                  <select
                    value={voice}
                    onChange={(event) =>
                      setVoice(
                        event.target.value
                      )
                    }
                  >

                    {VOICES.map(
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

                </label>

              </div>


              <div className="action-row">

                <div className="small-tags">

                  <span>
                    GPT-4o Mini TTS
                  </span>

                  <span>
                    MP3
                  </span>

                  <span>
                    {voice}
                  </span>

                </div>


                <button
                  className="primary-button"
                  onClick={
                    generateSpeech
                  }
                  disabled={busy}
                >

                  {busy
                    ? "⏳ Generating..."
                    : "🔊 Generate Speech"}

                </button>

              </div>


              {audioUrl && (

                <div className="audio-result">

                  <div className="result-label">
                    GENERATED AUDIO
                  </div>

                  <audio
                    controls
                    src={audioUrl}
                  />

                  <a
                    className="secondary-button"
                    href={audioUrl}
                    download="genai-labs-speech.mp3"
                  >
                    ⬇️ Download MP3
                  </a>

                </div>

              )}

            </div>

          )}


          {/* TRANSLATION */}

          {mode === "translation" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    SPEECH TRANSLATION
                  </div>

                  <h2>
                    Translate spoken language
                  </h2>

                </div>

              </div>


              <label className="upload-area">

                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.flac"
                  onChange={(event) =>
                    selectAudio(
                      event.target
                        .files?.[0]
                    )
                  }
                />

                <div className="upload-icon">
                  🌐
                </div>

                <strong>
                  Choose spoken audio
                </strong>

                <span>
                  The audio will first be transcribed,
                  then translated.
                </span>

              </label>


              <div className="options-grid">

                <label>

                  <span>
                    Target Language
                  </span>

                  <select
                    value={
                      targetLanguage
                    }
                    onChange={(event) =>
                      setTargetLanguage(
                        event.target.value
                      )
                    }
                  >

                    <option>
                      English
                    </option>

                    <option>
                      Tamil
                    </option>

                    <option>
                      Hindi
                    </option>

                    <option>
                      Kannada
                    </option>

                    <option>
                      Telugu
                    </option>

                    <option>
                      Malayalam
                    </option>

                    <option>
                      French
                    </option>

                    <option>
                      German
                    </option>

                    <option>
                      Spanish
                    </option>

                  </select>

                </label>

              </div>


              {audioName && (

                <div className="file-chip">
                  🎵 {audioName}
                </div>

              )}


              <button
                className="primary-button"
                onClick={
                  translateAudio
                }
                disabled={
                  busy ||
                  !audioFile
                }
              >

                {busy
                  ? "⏳ Translating..."
                  : "🌐 Translate Audio"}

              </button>


              {translatedText && (

                <div className="translation-result">

                  <div>

                    <div className="result-label">
                      ORIGINAL TRANSCRIPT
                    </div>

                    <p>
                      {transcript}
                    </p>

                  </div>


                  <div>

                    <div className="result-label">
                      TRANSLATION
                    </div>

                    <p>
                      {translatedText}
                    </p>

                  </div>

                </div>

              )}

            </div>

          )}


          {/* ANALYZER */}

          {mode === "analyzer" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    TRANSCRIPT ANALYSIS
                  </div>

                  <h2>
                    Analyze a transcript
                  </h2>

                </div>

              </div>


              <textarea
                className="prompt-box"
                value={transcript}
                onChange={(event) =>
                  setTranscript(
                    event.target.value
                  )
                }
                rows={10}
                placeholder="Paste a transcript here or transcribe audio in another mode..."
              />


              <div className="action-row">

                <div className="small-tags">

                  <span>
                    Summary
                  </span>

                  <span>
                    Key Topics
                  </span>

                  <span>
                    Action Items
                  </span>

                </div>


                <button
                  className="primary-button"
                  onClick={
                    analyzeTranscript
                  }
                  disabled={busy}
                >

                  {busy
                    ? "⏳ Analyzing..."
                    : "🧠 Analyze Transcript"}

                </button>

              </div>


              {analysis && (

                <div className="analysis-result">

                  <div className="result-label">
                    AI ANALYSIS
                  </div>

                  <pre>
                    {analysis}
                  </pre>

                </div>

              )}

            </div>

          )}


          {/* VOICE LAB */}

          {mode === "voice" && (

            <div className="lab-card">

              <div className="card-heading">

                <div>

                  <div className="eyebrow">
                    VOICE AI ARCHITECTURE
                  </div>

                  <h2>
                    Realtime Voice Lab
                  </h2>

                </div>

              </div>


              <div className="voice-architecture">

                <div className="voice-node">
                  🎤
                  <strong>
                    Microphone
                  </strong>
                </div>

                <div className="pipeline-arrow">
                  →
                </div>

                <div className="voice-node">
                  🧠
                  <strong>
                    AI
                  </strong>
                </div>

                <div className="pipeline-arrow">
                  →
                </div>

                <div className="voice-node">
                  🔊
                  <strong>
                    Speaker
                  </strong>
                </div>

              </div>


              <div className="info-box">

                <h3>
                  How realtime AI voice works
                </h3>

                <p>
                  A realtime voice application
                  captures microphone audio,
                  sends it to a realtime speech
                  model, processes the conversation,
                  and streams generated audio back
                  to the speaker.
                </p>

              </div>


              <div className="quick-grid">

                <div className="quick-prompt">
                  🎤 Speech input
                </div>

                <div className="quick-prompt">
                  🧠 AI reasoning
                </div>

                <div className="quick-prompt">
                  🔊 Speech output
                </div>

                <div className="quick-prompt">
                  ⚡ Low latency
                </div>

              </div>

            </div>

          )}


          {/* TRANSCRIPT RESULT */}

          {(mode === "record" ||
            mode === "audio") &&
            transcript && (

              <div className="lab-card">

                {renderTranscript()}


                <div className="action-row">

                  <div className="small-tags">

                    <span>
                      GPT-Transcribe
                    </span>

                    <span>
                      Speech → Text
                    </span>

                  </div>


                  <button
                    className="primary-button"
                    onClick={
                      analyzeTranscript
                    }
                    disabled={busy}
                  >
                    🧠 Analyze Transcript
                  </button>

                </div>


                {analysis && (

                  <div className="analysis-result">

                    <div className="result-label">
                      AI ANALYSIS
                    </div>

                    <pre>
                      {analysis}
                    </pre>

                  </div>

                )}

              </div>

            )}


          {/* ERROR */}

          {error && (

            <div className="error-box">

              <strong>
                Operation failed:
              </strong>{" "}

              {error}

            </div>

          )}


          {/* QUICK IDEAS */}

          <div className="lab-card quick-card">

            <div className="eyebrow">
              QUICK IDEAS
            </div>

            <h2>
              Try a voice experiment
            </h2>


            <div className="quick-grid">

              {QUICK_TEXTS.map(
                (text) => (

                  <button
                    key={text}
                    className="quick-prompt"
                    onClick={() =>
                      useQuickText(
                        text
                      )
                    }
                  >
                    🔊 {text}
                  </button>

                )
              )}

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}