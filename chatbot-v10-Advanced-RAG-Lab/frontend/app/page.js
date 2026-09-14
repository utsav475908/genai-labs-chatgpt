"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8010";

const MODEL_INFO = {
    "gpt-5.6-luna": {
        name: "GPT-5.6 Luna",
        description: "Cost-sensitive / high-volume",
    },
    "gpt-5.6-terra": {
        name: "GPT-5.6 Terra",
        description: "Balanced intelligence and cost",
    },
    "gpt-5.6-sol": {
        name: "GPT-5.6 Sol",
        description: "Advanced reasoning and coding",
    },
};

const REASONING_LEVELS = [
    "none",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
];

const QUICK_TOPICS = [
    "Explain Kubernetes architecture",
    "How does RAG work?",
    "Explain transformer architecture",
    "What are LLM tokens?",
    "How does WebRTC work?",
    "Explain AWS VPC",
    "What is prompt engineering?",
    "Explain Docker containers",
];

function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
        return "";
    }

    return `${seconds}s`;
}

function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function simpleMarkdown(text) {
    let html = escapeHtml(text);

    html = html.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

    html = html.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    html = html.replace(
        /\n/g,
        "<br />"
    );

    return html;
}

export default function Home() {

    const [mode, setMode] = useState("chat");

    const [models, setModels] = useState([]);

    const [selectedModel, setSelectedModel] =
        useState("gpt-5.6-luna");

    const [reasoning, setReasoning] =
        useState("medium");

    const [compareModelA, setCompareModelA] =
        useState("gpt-5.6-luna");

    const [compareModelB, setCompareModelB] =
        useState("gpt-5.6-sol");

    const [compareReasoningA, setCompareReasoningA] =
        useState("medium");

    const [compareReasoningB, setCompareReasoningB] =
        useState("medium");

    const [systemPrompt, setSystemPrompt] =
        useState("");

    const [showSystemPrompt, setShowSystemPrompt] =
        useState(false);

    const [messages, setMessages] =
        useState([]);

    const [input, setInput] =
        useState("");

    const [isStreaming, setIsStreaming] =
        useState(false);

    const [isComparing, setIsComparing] =
        useState(false);

    const [comparison, setComparison] =
        useState(null);

    const [error, setError] =
        useState("");

    const [uploadedImage, setUploadedImage] =
        useState(null);

    const [uploadedDocument, setUploadedDocument] =
        useState(null);

    const [voiceActive, setVoiceActive] =
        useState(false);

    const [voiceConnecting, setVoiceConnecting] =
        useState(false);

    const [visualTopic, setVisualTopic] =
        useState("overview");

    const textareaRef = useRef(null);

    const abortControllerRef = useRef(null);

    const peerConnectionRef = useRef(null);

    const audioElementRef = useRef(null);

    const imageInputRef = useRef(null);

    const documentInputRef = useRef(null);


    useEffect(() => {

        fetch(`${BACKEND}/models`)
            .then(response => response.json())
            .then(data => {

                if (data.models) {

                    setModels(data.models);

                }

            })
            .catch(() => {

                setModels([
                    {
                        id: "gpt-5.6-luna",
                        name: "GPT-5.6 Luna",
                    },
                    {
                        id: "gpt-5.6-terra",
                        name: "GPT-5.6 Terra",
                    },
                    {
                        id: "gpt-5.6-sol",
                        name: "GPT-5.6 Sol",
                    },
                ]);

            });

    }, []);


    useEffect(() => {

        if (!textareaRef.current) {
            return;
        }

        textareaRef.current.style.height = "auto";

        textareaRef.current.style.height =
            `${Math.min(
                textareaRef.current.scrollHeight,
                180
            )}px`;

    }, [input]);


    function newChat() {

        stopGeneration();

        setMessages([]);

        setInput("");

        setComparison(null);

        setError("");

        setUploadedImage(null);

        setUploadedDocument(null);

        setMode("chat");

    }


    function stopGeneration() {

        if (abortControllerRef.current) {

            abortControllerRef.current.abort();

            abortControllerRef.current = null;

        }

        setIsStreaming(false);

    }


    async function sendMessage() {

        if (
            !input.trim() ||
            isStreaming ||
            isComparing
        ) {
            return;
        }

        const userText = input.trim();

        const userMessage = {
            role: "user",
            content: userText,
        };

        const nextMessages = [
            ...messages,
            userMessage,
        ];

        setMessages(nextMessages);

        setInput("");

        setError("");

        setComparison(null);

        setIsStreaming(true);

        const assistantMessage = {
            role: "assistant",
            content: "",
            model: selectedModel,
            reasoning,
            elapsed: null,
            usage: null,
        };

        setMessages([
            ...nextMessages,
            assistantMessage,
        ]);

        const controller = new AbortController();

        abortControllerRef.current = controller;

        try {

            const response = await fetch(
                `${BACKEND}/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        messages: nextMessages,
                        model: selectedModel,
                        reasoning_effort: reasoning,
                        system_prompt:
                            systemPrompt,

                        image_file_id:
                            uploadedImage?.file_id || null,

                        vector_store_id:
                            uploadedDocument?.vector_store_id ||
                            null,
                    }),

                    signal: controller.signal,
                }
            );

            if (!response.ok) {

                const data =
                    await response.json()
                        .catch(() => ({}));

                throw new Error(
                    data.detail ||
                    `HTTP ${response.status}`
                );

            }

            if (!response.body) {

                throw new Error(
                    "Streaming is not supported by this response."
                );

            }

            const reader =
                response.body.getReader();

            const decoder =
                new TextDecoder();

            let buffer = "";

            while (true) {

                const {
                    value,
                    done,
                } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(
                    value,
                    {
                        stream: true,
                    }
                );

                const events =
                    buffer.split("\n\n");

                buffer =
                    events.pop() || "";

                for (const eventBlock of events) {

                    const line =
                        eventBlock
                            .split("\n")
                            .find(
                                line =>
                                    line.startsWith(
                                        "data: "
                                    )
                            );

                    if (!line) {
                        continue;
                    }

                    const data =
                        line.slice(6);

                    if (data === "[DONE]") {
                        continue;
                    }

                    let event;

                    try {

                        event =
                            JSON.parse(data);

                    } catch {

                        continue;

                    }

                    if (
                        event.type ===
                        "delta"
                    ) {

                        setMessages(prev => {

                            const copy =
                                [...prev];

                            const last =
                                copy.length - 1;

                            copy[last] = {
                                ...copy[last],
                                content:
                                    copy[last].content +
                                    event.text,
                            };

                            return copy;

                        });

                    }

                    if (
                        event.type ===
                        "completed"
                    ) {

                        setMessages(prev => {

                            const copy =
                                [...prev];

                            const last =
                                copy.length - 1;

                            copy[last] = {
                                ...copy[last],

                                elapsed:
                                    event.elapsed_seconds,

                                usage:
                                    event.usage,
                            };

                            return copy;

                        });

                    }

                    if (
                        event.type ===
                        "error"
                    ) {

                        setError(
                            event.message
                        );

                    }

                }

            }

        } catch (err) {

            if (
                err.name !==
                "AbortError"
            ) {

                setError(
                    err.message ||
                    "Something went wrong."
                );

                setMessages(prev =>
                    prev.filter(
                        message =>
                            message.content !== ""
                    )
                );

            }

        } finally {

            setIsStreaming(false);

            abortControllerRef.current =
                null;

        }

    }


    async function compareModels() {

        if (
            !input.trim() ||
            isComparing ||
            isStreaming
        ) {
            return;
        }

        setIsComparing(true);

        setError("");

        setComparison(null);

        try {

            const response = await fetch(
                `${BACKEND}/compare`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        messages: [
                            ...messages,
                            {
                                role: "user",
                                content:
                                    input.trim(),
                            },
                        ],

                        model_a:
                            compareModelA,

                        model_b:
                            compareModelB,

                        reasoning_a:
                            compareReasoningA,

                        reasoning_b:
                            compareReasoningB,

                        system_prompt:
                            systemPrompt,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    `HTTP ${response.status}`
                );

            }

            setComparison(data);

        } catch (err) {

            setError(
                err.message ||
                "Comparison failed."
            );

        } finally {

            setIsComparing(false);

        }

    }


    async function uploadImage(file) {

        if (!file) {
            return;
        }

        setError("");

        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            const response =
                await fetch(
                    `${BACKEND}/upload-image`,
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
                    "Image upload failed."
                );

            }

            setUploadedImage(data);

            setUploadedDocument(null);

        } catch (err) {

            setError(
                err.message ||
                "Image upload failed."
            );

        }

    }


    async function uploadDocument(file) {

        if (!file) {
            return;
        }

        setError("");

        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            const response =
                await fetch(
                    `${BACKEND}/upload`,
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
                    "Document upload failed."
                );

            }

            setUploadedDocument(data);

            setUploadedImage(null);

        } catch (err) {

            setError(
                err.message ||
                "Document upload failed."
            );

        }

    }


    async function startVoice() {

        if (voiceActive) {

            stopVoice();

            return;

        }

        setVoiceConnecting(true);

        setError("");

        try {

            const tokenResponse =
                await fetch(
                    `${BACKEND}/realtime-token`,
                    {
                        method: "POST",
                    }
                );

            const tokenData =
                await tokenResponse.json();

            if (!tokenResponse.ok) {

                throw new Error(
                    tokenData.detail ||
                    "Could not create voice session."
                );

            }

            const pc =
                new RTCPeerConnection();

            peerConnectionRef.current =
                pc;

            const audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay = true;

            audioElementRef.current =
                audio;

            pc.ontrack = event => {

                audio.srcObject =
                    event.streams[0];

            };

            const mediaStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true,
                    });

            mediaStream
                .getTracks()
                .forEach(
                    track =>
                        pc.addTrack(
                            track,
                            mediaStream
                        )
                );

            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            const sdpResponse =
                await fetch(
                    "https://api.openai.com/v1/realtime/calls",
                    {
                        method: "POST",

                        body: offer.sdp,

                        headers: {
                            Authorization:
                                `Bearer ${tokenData.client_secret}`,

                            "Content-Type":
                                "application/sdp",
                        },
                    }
                );

            if (!sdpResponse.ok) {

                throw new Error(
                    await sdpResponse.text()
                );

            }

            const answer =
                await sdpResponse.text();

            await pc.setRemoteDescription({
                type: "answer",
                sdp: answer,
            });

            setVoiceActive(true);

        } catch (err) {

            setError(
                err.message ||
                "Voice connection failed."
            );

            stopVoice();

        } finally {

            setVoiceConnecting(false);

        }

    }


    function stopVoice() {

        if (
            peerConnectionRef.current
        ) {

            peerConnectionRef.current
                .getSenders()
                .forEach(sender => {

                    if (sender.track) {
                        sender.track.stop();
                    }

                });

            peerConnectionRef.current
                .close();

            peerConnectionRef.current =
                null;

        }

        setVoiceActive(false);

    }


    function handleKeyDown(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }


    function selectQuickTopic(topic) {

        setInput(topic);

        setMode("chat");

        setTimeout(() => {

            textareaRef.current?.focus();

        }, 50);

    }


    const selectedModelInfo =
        MODEL_INFO[selectedModel] ||
        MODEL_INFO["gpt-5.6-luna"];


    return (
        <main className="app-shell">

            <header className="top-header">

                <div className="brand">

                    <div className="brand-mark">
                        G
                    </div>

                    <div>

                        <div className="brand-name">
                            GenAI-Labs
                        </div>

                        <div className="brand-version">
                            V10 · AI Model Playground
                        </div>

                    </div>

                </div>


                <div className="header-actions">

                    <button
                        className="secondary-button"
                        onClick={newChat}
                    >
                        ＋ New Chat
                    </button>

                    <button
                        className={
                            voiceActive
                                ? "voice-button active"
                                : "voice-button"
                        }
                        onClick={startVoice}
                    >
                        {voiceConnecting
                            ? "Connecting..."
                            : voiceActive
                                ? "● Voice Active"
                                : "🎙 Voice"}
                    </button>

                </div>

            </header>


            <div className="workspace">

                <aside className="playground-sidebar">

                    <div className="sidebar-title">
                        MODEL PLAYGROUND
                    </div>


                    <div className="sidebar-section">

                        <div className="section-label">
                            MODE
                        </div>

                        <div className="mode-buttons">

                            <button
                                className={
                                    mode === "chat"
                                        ? "mode-button selected"
                                        : "mode-button"
                                }
                                onClick={() =>
                                    setMode("chat")
                                }
                            >
                                💬 Chat
                            </button>

                            <button
                                className={
                                    mode === "compare"
                                        ? "mode-button selected"
                                        : "mode-button"
                                }
                                onClick={() =>
                                    setMode("compare")
                                }
                            >
                                ⚖ Compare
                            </button>

                            <button
                                className={
                                    mode === "visual"
                                        ? "mode-button selected"
                                        : "mode-button"
                                }
                                onClick={() =>
                                    setMode("visual")
                                }
                            >
                                🧠 Visual Lab
                            </button>

                        </div>

                    </div>


                    <div className="sidebar-section">

                        <div className="section-label">
                            MODEL
                        </div>

                        <select
                            className="model-select"
                            value={selectedModel}
                            onChange={event =>
                                setSelectedModel(
                                    event.target.value
                                )
                            }
                        >

                            {models.map(model => (

                                <option
                                    key={model.id}
                                    value={model.id}
                                >
                                    {model.name}
                                </option>

                            ))}

                        </select>


                        <div className="model-description">
                            {selectedModelInfo.description}
                        </div>

                    </div>


                    <div className="sidebar-section">

                        <div className="section-label">
                            REASONING
                        </div>

                        <select
                            className="model-select"
                            value={reasoning}
                            onChange={event =>
                                setReasoning(
                                    event.target.value
                                )
                            }
                        >

                            {REASONING_LEVELS.map(level => (

                                <option
                                    key={level}
                                    value={level}
                                >
                                    {level.toUpperCase()}
                                </option>

                            ))}

                        </select>

                    </div>


                    <div className="sidebar-section">

                        <button
                            className="system-toggle"
                            onClick={() =>
                                setShowSystemPrompt(
                                    !showSystemPrompt
                                )
                            }
                        >
                            ⚙ System Prompt
                            <span>
                                {showSystemPrompt
                                    ? "▲"
                                    : "▼"}
                            </span>
                        </button>


                        {showSystemPrompt && (

                            <textarea
                                className="system-prompt"
                                value={systemPrompt}
                                onChange={event =>
                                    setSystemPrompt(
                                        event.target.value
                                    )
                                }
                                placeholder="Optional system instructions..."
                            />

                        )}

                    </div>


                    <div className="sidebar-section">

                        <div className="section-label">
                            INPUT
                        </div>

                        <button
                            className="upload-button"
                            onClick={() =>
                                imageInputRef.current?.click()
                            }
                        >
                            🖼 Image
                        </button>

                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={event =>
                                uploadImage(
                                    event.target.files?.[0]
                                )
                            }
                        />


                        <button
                            className="upload-button"
                            onClick={() =>
                                documentInputRef.current?.click()
                            }
                        >
                            📄 Document
                        </button>

                        <input
                            ref={documentInputRef}
                            type="file"
                            accept=".pdf,.txt,.doc,.docx"
                            hidden
                            onChange={event =>
                                uploadDocument(
                                    event.target.files?.[0]
                                )
                            }
                        />

                    </div>


                    <div className="sidebar-model-card">

                        <div className="mini-label">
                            CURRENT MODEL
                        </div>

                        <strong>
                            {selectedModelInfo.name}
                        </strong>

                        <span>
                            Reasoning: {reasoning}
                        </span>

                    </div>

                </aside>


                <section className="main-panel">


                    {mode === "visual" && (

                        <VisualLab
                            topic={visualTopic}
                            setTopic={setVisualTopic}
                        />

                    )}


                    {mode === "chat" && (

                        <>

                            <div className="playground-header">

                                <div>

                                    <h1>
                                        AI Model Playground
                                    </h1>

                                    <p>
                                        Experiment with different
                                        AI models, prompts and
                                        reasoning levels.
                                    </p>

                                </div>


                                <div className="current-model-badge">

                                    <span className="status-dot" />

                                    {selectedModelInfo.name}

                                </div>

                            </div>


                            <div className="chat-area">

                                {messages.length === 0 && (

                                    <div className="welcome-card">

                                        <div className="welcome-icon">
                                            🧪
                                        </div>

                                        <h2>
                                            Welcome to the Model Playground
                                        </h2>

                                        <p>
                                            Select a model, choose a
                                            reasoning level and start
                                            experimenting.
                                        </p>


                                        <div className="quick-topics">

                                            {QUICK_TOPICS.map(
                                                topic => (

                                                    <button
                                                        key={topic}
                                                        onClick={() =>
                                                            selectQuickTopic(
                                                                topic
                                                            )
                                                        }
                                                    >
                                                        {topic}
                                                    </button>

                                                )
                                            )}

                                        </div>

                                    </div>

                                )}


                                {messages.map(
                                    (message, index) => (

                                        <div
                                            className={
                                                message.role === "user"
                                                    ? "message-row user"
                                                    : "message-row assistant"
                                            }
                                            key={index}
                                        >

                                            <div className="message-avatar">

                                                {message.role ===
                                                "user"
                                                    ? "U"
                                                    : "G"}

                                            </div>


                                            <div className="message-content">

                                                <div className="message-role">

                                                    {message.role ===
                                                    "user"
                                                        ? "You"
                                                        : message.model
                                                            ? message.model
                                                            : "GenAI-Labs"}

                                                </div>


                                                <div
                                                    className="message-text"
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            simpleMarkdown(
                                                                message.content
                                                            ),
                                                    }}
                                                />


                                                {message.role ===
                                                    "assistant" &&
                                                    message.content && (

                                                        <div className="message-meta">

                                                            {message.elapsed !==
                                                                null && (
                                                                    <span>
                                                                        ⏱{" "}
                                                                        {formatTime(
                                                                            message.elapsed
                                                                        )}
                                                                    </span>
                                                                )}

                                                            {message.usage && (
                                                                <span>
                                                                    Tokens:{" "}
                                                                    {
                                                                        message
                                                                            .usage
                                                                            .total_tokens
                                                                    }
                                                                </span>
                                                            )}

                                                            {message.reasoning && (
                                                                <span>
                                                                    Reasoning:{" "}
                                                                    {
                                                                        message.reasoning
                                                                    }
                                                                </span>
                                                            )}

                                                        </div>

                                                    )}

                                            </div>

                                        </div>

                                    )
                                )}


                                {error && (

                                    <div className="error-box">
                                        ⚠ {error}
                                    </div>

                                )}

                            </div>


                            {(uploadedImage ||
                                uploadedDocument) && (

                                <div className="attachment-bar">

                                    <span>
                                        {uploadedImage
                                            ? "🖼"
                                            : "📄"}
                                    </span>

                                    <span>
                                        {uploadedImage
                                            ? uploadedImage.filename
                                            : uploadedDocument.filename}
                                    </span>

                                    <button
                                        onClick={() => {
                                            setUploadedImage(null);
                                            setUploadedDocument(null);
                                        }}
                                    >
                                        ×
                                    </button>

                                </div>

                            )}


                            <div className="composer">

                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={event =>
                                        setInput(
                                            event.target.value
                                        )
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything..."
                                    rows={1}
                                />


                                <div className="composer-footer">

                                    <div className="composer-hint">
                                        Enter to send · Shift+Enter for new line
                                    </div>


                                    <div className="composer-actions">

                                        {isStreaming && (

                                            <button
                                                className="stop-button"
                                                onClick={
                                                    stopGeneration
                                                }
                                            >
                                                ■ Stop
                                            </button>

                                        )}

                                        <button
                                            className="send-button"
                                            disabled={
                                                !input.trim() ||
                                                isStreaming
                                            }
                                            onClick={
                                                sendMessage
                                            }
                                        >
                                            {isStreaming
                                                ? "Generating..."
                                                : "Send →"}
                                        </button>

                                    </div>

                                </div>

                            </div>

                        </>

                    )}


                    {mode === "compare" && (

                        <ComparePanel
                            input={input}
                            setInput={setInput}
                            compareModelA={compareModelA}
                            setCompareModelA={
                                setCompareModelA
                            }
                            compareModelB={compareModelB}
                            setCompareModelB={
                                setCompareModelB
                            }
                            compareReasoningA={
                                compareReasoningA
                            }
                            setCompareReasoningA={
                                setCompareReasoningA
                            }
                            compareReasoningB={
                                compareReasoningB
                            }
                            setCompareReasoningB={
                                setCompareReasoningB
                            }
                            comparison={comparison}
                            isComparing={isComparing}
                            onCompare={
                                compareModels
                            }
                            systemPrompt={
                                systemPrompt
                            }
                            error={error}
                        />

                    )}

                </section>

            </div>

        </main>
    );
}


function ComparePanel({
    input,
    setInput,
    compareModelA,
    setCompareModelA,
    compareModelB,
    setCompareModelB,
    compareReasoningA,
    setCompareReasoningA,
    compareReasoningB,
    setCompareReasoningB,
    comparison,
    isComparing,
    onCompare,
    error,
}) {

    return (

        <div className="compare-page">

            <div className="playground-header">

                <div>

                    <h1>
                        Model Comparison
                    </h1>

                    <p>
                        Send the same prompt to two
                        models and compare their responses.
                    </p>

                </div>

            </div>


            <div className="compare-controls">

                <div className="compare-model-control">

                    <label>
                        MODEL A
                    </label>

                    <select
                        value={compareModelA}
                        onChange={event =>
                            setCompareModelA(
                                event.target.value
                            )
                        }
                    >
                        <option value="gpt-5.6-luna">
                            GPT-5.6 Luna
                        </option>

                        <option value="gpt-5.6-terra">
                            GPT-5.6 Terra
                        </option>

                        <option value="gpt-5.6-sol">
                            GPT-5.6 Sol
                        </option>

                    </select>


                    <select
                        value={compareReasoningA}
                        onChange={event =>
                            setCompareReasoningA(
                                event.target.value
                            )
                        }
                    >

                        {REASONING_LEVELS.map(
                            level => (

                                <option
                                    key={level}
                                    value={level}
                                >
                                    Reasoning: {level}
                                </option>

                            )
                        )}

                    </select>

                </div>


                <div className="compare-vs">
                    VS
                </div>


                <div className="compare-model-control">

                    <label>
                        MODEL B
                    </label>

                    <select
                        value={compareModelB}
                        onChange={event =>
                            setCompareModelB(
                                event.target.value
                            )
                        }
                    >

                        <option value="gpt-5.6-luna">
                            GPT-5.6 Luna
                        </option>

                        <option value="gpt-5.6-terra">
                            GPT-5.6 Terra
                        </option>

                        <option value="gpt-5.6-sol">
                            GPT-5.6 Sol
                        </option>

                    </select>


                    <select
                        value={compareReasoningB}
                        onChange={event =>
                            setCompareReasoningB(
                                event.target.value
                            )
                        }
                    >

                        {REASONING_LEVELS.map(
                            level => (

                                <option
                                    key={level}
                                    value={level}
                                >
                                    Reasoning: {level}
                                </option>

                            )
                        )}

                    </select>

                </div>

            </div>


            <textarea
                className="compare-prompt"
                value={input}
                onChange={event =>
                    setInput(
                        event.target.value
                    )
                }
                placeholder="Enter a prompt to compare the two models..."
            />


            <button
                className="compare-run-button"
                disabled={
                    !input.trim() ||
                    isComparing
                }
                onClick={onCompare}
            >
                {isComparing
                    ? "Running both models..."
                    : "⚖ Compare Models"}
            </button>


            {error && (

                <div className="error-box">
                    ⚠ {error}
                </div>

            )}


            {comparison && (

                <div className="comparison-grid">

                    <ComparisonCard
                        result={
                            comparison.model_a
                        }
                    />

                    <ComparisonCard
                        result={
                            comparison.model_b
                        }
                    />

                </div>

            )}

        </div>

    );
}


function ComparisonCard({
    result
}) {

    if (!result) {
        return null;
    }

    return (

        <div className="comparison-card">

            <div className="comparison-card-header">

                <div>

                    <strong>
                        {MODEL_INFO[result.model]?.name ||
                            result.model}
                    </strong>

                    <span>
                        Reasoning:{" "}
                        {result.reasoning_effort ||
                            "medium"}
                    </span>

                </div>

                {result.success && (

                    <div className="comparison-stats">

                        <span>
                            ⏱ {result.elapsed_seconds}s
                        </span>

                        {result.usage && (
                            <span>
                                {result.usage.total_tokens}
                                {" "}tokens
                            </span>
                        )}

                    </div>

                )}

            </div>


            {!result.success ? (

                <div className="comparison-error">
                    ⚠ {result.error}
                </div>

            ) : (

                <div
                    className="comparison-response"
                    dangerouslySetInnerHTML={{
                        __html:
                            simpleMarkdown(
                                result.text
                            ),
                    }}
                />

            )}

        </div>

    );
}


function VisualLab({
    topic,
    setTopic
}) {

    const lessons = {

        overview: {
            title: "Generative AI",
            subtitle:
                "The complete AI application flow",
            steps: [
                "User Prompt",
                "Model",
                "Tools",
                "Knowledge",
                "Response",
            ],
        },

        llm: {
            title: "Large Language Models",
            subtitle:
                "How prompts become generated text",
            steps: [
                "Prompt",
                "Tokens",
                "Transformer",
                "Reasoning",
                "Output",
            ],
        },

        tokens: {
            title: "Tokens",
            subtitle:
                "Text is converted into tokens",
            steps: [
                "Text",
                "Tokenizer",
                "Token IDs",
                "Model",
                "Generated Tokens",
            ],
        },

        prompting: {
            title: "Prompt Engineering",
            subtitle:
                "Instructions influence model behavior",
            steps: [
                "Role",
                "Context",
                "Task",
                "Constraints",
                "Output",
            ],
        },

        rag: {
            title: "RAG",
            subtitle:
                "Retrieval-Augmented Generation",
            steps: [
                "Question",
                "Embedding",
                "Vector Search",
                "Retrieved Context",
                "LLM",
            ],
        },

        vision: {
            title: "Computer Vision",
            subtitle:
                "How multimodal AI understands images",
            steps: [
                "Image",
                "Visual Encoding",
                "Multimodal Model",
                "Reasoning",
                "Answer",
            ],
        },

        architecture: {
            title: "AI Application",
            subtitle:
                "Typical production architecture",
            steps: [
                "Frontend",
                "API",
                "AI Model",
                "Tools / RAG",
                "User",
            ],
        },

    };

    const lesson =
        lessons[topic] ||
        lessons.overview;


    return (

        <div className="visual-lab">

            <div className="playground-header">

                <div>

                    <h1>
                        Visual AI Lab
                    </h1>

                    <p>
                        Explore how modern AI systems work.
                    </p>

                </div>

            </div>


            <div className="visual-topic-buttons">

                {Object.entries(lessons).map(
                    ([key, value]) => (

                        <button
                            key={key}
                            className={
                                topic === key
                                    ? "selected"
                                    : ""
                            }
                            onClick={() =>
                                setTopic(key)
                            }
                        >
                            {value.title}
                        </button>

                    )
                )}

            </div>


            <div className="visual-card">

                <div className="visual-title">

                    <span className="visual-icon">
                        🧠
                    </span>

                    <div>

                        <h2>
                            {lesson.title}
                        </h2>

                        <p>
                            {lesson.subtitle}
                        </p>

                    </div>

                </div>


                <div className="visual-flow">

                    {lesson.steps.map(
                        (step, index) => (

                            <div
                                className="visual-flow-item"
                                key={step}
                            >

                                <div className="flow-node">

                                    <div className="flow-number">
                                        {index + 1}
                                    </div>

                                    <strong>
                                        {step}
                                    </strong>

                                </div>


                                {index <
                                    lesson.steps.length - 1 && (

                                    <div className="flow-arrow">
                                        →
                                    </div>

                                )}

                            </div>

                        )
                    )}

                </div>

            </div>


            <div className="visual-explanation">

                <h3>
                    Interactive Learning
                </h3>

                <p>
                    Use the Chat mode to ask the AI
                    to explain each stage of this flow
                    with practical examples.
                </p>

            </div>

        </div>

    );
}