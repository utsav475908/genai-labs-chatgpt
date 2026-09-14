"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8011";

const ragLessons = {
    overview: {
        title: "RAG Overview",
        icon: "🧠",
        description:
            "Understand how Retrieval-Augmented Generation connects documents, retrieval, an LLM, and the final answer.",
        steps: [
            ["01", "Documents", "Your PDFs, DOCX, and TXT files become the knowledge source."],
            ["02", "Vector Store", "Documents are indexed so relevant information can be retrieved."],
            ["03", "Retrieval", "The system finds information relevant to your question."],
            ["04", "LLM", "The model uses the retrieved context to generate an answer."],
            ["05", "Answer", "The grounded answer is returned to the user."],
        ],
    },

    retrieval: {
        title: "Retrieval",
        icon: "🔎",
        description:
            "Learn how a RAG system searches a knowledge base for information relevant to a question.",
        steps: [
            ["01", "Question", "The user asks a question."],
            ["02", "Search", "The knowledge base is searched."],
            ["03", "Relevant Chunks", "Useful document sections are identified."],
            ["04", "Context", "Retrieved information is supplied to the LLM."],
            ["05", "Answer", "The model generates a grounded response."],
        ],
    },

    chunking: {
        title: "Document Chunking",
        icon: "✂️",
        description:
            "Documents are divided into smaller pieces so retrieval can find relevant information efficiently.",
        steps: [
            ["01", "Document", "Start with the original document."],
            ["02", "Split", "The document is divided into chunks."],
            ["03", "Index", "Chunks are stored for retrieval."],
            ["04", "Retrieve", "Relevant chunks are selected."],
            ["05", "Generate", "The LLM uses those chunks as context."],
        ],
    },

    embeddings: {
        title: "Embeddings",
        icon: "🔢",
        description:
            "Embeddings represent text as vectors so semantically related information can be discovered.",
        steps: [
            ["01", "Text", "A document chunk is converted into numerical representation."],
            ["02", "Embedding", "The text becomes a vector."],
            ["03", "Vector Store", "The vector is stored with the document information."],
            ["04", "Similarity", "Related vectors can be identified."],
            ["05", "Retrieval", "The most relevant information is returned."],
        ],
    },

    grounding: {
        title: "Grounded Generation",
        icon: "🎯",
        description:
            "Grounding helps the model answer using retrieved information rather than relying only on its internal knowledge.",
        steps: [
            ["01", "Question", "The user asks a question."],
            ["02", "Retrieve", "Relevant information is retrieved."],
            ["03", "Context", "Retrieved information becomes model context."],
            ["04", "Generate", "The model reasons over the context."],
            ["05", "Grounded Answer", "The response is based on available evidence."],
        ],
    },
};

const quickQuestions = [
    "Summarize the uploaded document.",
    "What are the most important points in this document?",
    "What does the document say about the main topic?",
    "Find the section related to the topic I asked about.",
    "Explain the retrieved information in simple terms.",
];

export default function Page() {
    const [messages, setMessages] = useState([]);
    const [ragInput, setRagInput] = useState("");

    const [ragLoading, setRagLoading] = useState(false);
    const [ragError, setRagError] = useState("");

    const [knowledgeBase, setKnowledgeBase] = useState(null);
    const [knowledgeBases, setKnowledgeBases] = useState([]);

    const [creatingKB, setCreatingKB] = useState(false);

    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState("");

    const [visualMode, setVisualMode] = useState("overview");

    const [model, setModel] = useState("gpt-5.6-luna");
    const [reasoning, setReasoning] = useState("medium");
    const [webSearch, setWebSearch] = useState(false);

    const [compareQuestion, setCompareQuestion] = useState("");
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareResult, setCompareResult] = useState(null);

    const [imageFileId, setImageFileId] = useState(null);
    const [imageName, setImageName] = useState("");

    const [voiceConnected, setVoiceConnected] = useState(false);
    const [voiceConnecting, setVoiceConnecting] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState("");

    const ragInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const abortRef = useRef(null);

    const peerRef = useRef(null);
    const audioRef = useRef(null);
    const mediaStreamRef = useRef(null);

    useEffect(() => {
        loadKnowledgeBases();

        return () => {
            try {
                abortRef.current?.abort();
                stopVoice();
            } catch {}
        };
    }, []);

    function autoResize() {
        const textarea = ragInputRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height =
            `${Math.min(textarea.scrollHeight, 180)}px`;
    }

    async function loadKnowledgeBases() {
        try {
            const response = await fetch(
                `${BACKEND}/knowledge-bases`
            );

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            const list = Array.isArray(data)
                ? data
                : data.knowledge_bases || [];

            setKnowledgeBases(list);

            if (list.length > 0 && !knowledgeBase) {
                setKnowledgeBase(list[0]);
            }
        } catch (error) {
            console.error("Knowledge base loading error:", error);
        }
    }

    async function createKnowledgeBase() {
        if (creatingKB) {
            return;
        }

        setCreatingKB(true);
        setRagError("");

        try {
            const response = await fetch(
                `${BACKEND}/knowledge-bases`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: "My Knowledge Base",
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "Could not create the Knowledge Base."
                );
            }

            const kb = data.knowledge_base || data;

            setKnowledgeBase(kb);

            setKnowledgeBases((current) => [
                kb,
                ...current,
            ]);

            setRagError("");

        } catch (error) {
            console.error(error);

            setRagError(
                error.message ||
                "Knowledge Base creation failed."
            );
        } finally {
            setCreatingKB(false);
        }
    }

    async function uploadDocument(event) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setSelectedFile(file);
        setUploading(true);
        setUploadStatus("Uploading document...");
        setRagError("");

        try {
            let currentKB = knowledgeBase;

            if (!currentKB) {
                const response = await fetch(
                    `${BACKEND}/knowledge-bases`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: "My Knowledge Base",
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Could not create the Knowledge Base."
                    );
                }

                currentKB =
                    data.knowledge_base || data;

                setKnowledgeBase(currentKB);

                setKnowledgeBases((current) => [
                    currentKB,
                    ...current,
                ]);
            }

            const formData = new FormData();

            formData.append("file", file);

            if (currentKB?.id) {
                formData.append(
                    "knowledge_base_id",
                    currentKB.id
                );
            }

            if (currentKB?.vector_store_id) {
                formData.append(
                    "vector_store_id",
                    currentKB.vector_store_id
                );
            }

            const response = await fetch(
                `${BACKEND}/upload`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "Document upload failed."
                );
            }

            const updatedKB = {
                ...currentKB,
                ...data,
                id:
                    data.knowledge_base_id ||
                    currentKB.id,
                name:
                    currentKB.name ||
                    "My Knowledge Base",
                vector_store_id:
                    data.vector_store_id ||
                    currentKB.vector_store_id,
            };

            setKnowledgeBase(updatedKB);

            setKnowledgeBases((current) =>
                current.map((kb) =>
                    kb.id === currentKB.id
                        ? updatedKB
                        : kb
                )
            );

            setUploadStatus(
                `${file.name} is ready for RAG questions.`
            );

        } catch (error) {
            console.error(error);

            setUploadStatus(
                `Upload failed: ${error.message}`
            );

            setRagError(error.message);
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    }

    async function createKBAndUpload() {
        fileInputRef.current?.click();
    }

    function clearDocument() {
        setSelectedFile(null);
        setUploadStatus("");
    }

    function selectLesson(key) {
        setVisualMode(key);

        const lesson = ragLessons[key];

        setRagInput(
            `Explain ${lesson.title} to me step by step using a simple real-world example.`
        );

        setTimeout(autoResize, 0);
    }

    function setQuickQuestion(question) {
        setRagInput(question);

        setTimeout(() => {
            autoResize();
            ragInputRef.current?.focus();
        }, 0);
    }

    function handleRagKeyDown(event) {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            submitRAG();
        }
    }

    async function submitRAG() {
        const question = ragInput.trim();

        if (!question || ragLoading) {
            return;
        }

        setRagError("");

        /*
         * IMPORTANT:
         * The textarea remains enabled even when there is
         * no Knowledge Base.
         *
         * We only stop the actual request here.
         */
        if (!knowledgeBase) {
            setRagError(
                "Please create a Knowledge Base and upload a document first."
            );
            return;
        }

        const vectorStoreId =
            knowledgeBase.vector_store_id ||
            knowledgeBase.vectorStoreId;

        if (!vectorStoreId) {
            setRagError(
                "Your Knowledge Base does not contain a Vector Store yet. Please upload a document first."
            );
            return;
        }

        const userMessage = {
            role: "user",
            content: question,
        };

        const updatedMessages = [
            ...messages,
            userMessage,
        ];

        setMessages([
            ...updatedMessages,
            {
                role: "assistant",
                content: "",
            },
        ]);

        setRagInput("");
        setRagLoading(true);

        setTimeout(() => {
            autoResize();
        }, 0);

        const controller =
            new AbortController();

        abortRef.current = controller;

        try {
            const response = await fetch(
                `${BACKEND}/rag/chat`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        messages:
                            updatedMessages,

                        vector_store_id:
                            vectorStoreId,

                        knowledge_base_id:
                            knowledgeBase.id,

                        model,

                        reasoning,

                        web_search:
                            webSearch,
                    }),

                    signal:
                        controller.signal,
                }
            );

            if (!response.ok) {
                const text =
                    await response.text();

                throw new Error(
                    text ||
                    "RAG request failed."
                );
            }

            if (!response.body) {
                throw new Error(
                    "The server did not return a response stream."
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

                for (
                    const event of events
                ) {
                    const line =
                        event
                            .split("\n")
                            .find(
                                (line) =>
                                    line.startsWith(
                                        "data:"
                                    )
                            );

                    if (!line) {
                        continue;
                    }

                    const raw =
                        line.slice(5).trim();

                    if (
                        raw === "[DONE]"
                    ) {
                        continue;
                    }

                    let payload;

                    try {
                        payload =
                            JSON.parse(raw);
                    } catch {
                        continue;
                    }

                    if (
                        payload.type ===
                        "delta"
                    ) {
                        setMessages(
                            (current) => {
                                const copy =
                                    [...current];

                                const last =
                                    copy[
                                        copy.length -
                                        1
                                    ];

                                if (!last) {
                                    return current;
                                }

                                copy[
                                    copy.length - 1
                                ] = {
                                    ...last,
                                    content:
                                        last.content +
                                        (
                                            payload.text ||
                                            ""
                                        ),
                                };

                                return copy;
                            }
                        );
                    }

                    if (
                        payload.type ===
                        "retrieval"
                    ) {
                        setMessages(
                            (current) => {
                                const copy =
                                    [...current];

                                const last =
                                    copy[
                                        copy.length -
                                        1
                                    ];

                                if (!last) {
                                    return current;
                                }

                                copy[
                                    copy.length - 1
                                ] = {
                                    ...last,
                                    retrieval:
                                        payload,
                                };

                                return copy;
                            }
                        );
                    }

                    if (
                        payload.type ===
                        "error"
                    ) {
                        throw new Error(
                            payload.message ||
                            "RAG request failed."
                        );
                    }
                }
            }

        } catch (error) {
            if (
                error.name !==
                "AbortError"
            ) {
                console.error(error);

                setRagError(
                    error.message ||
                    "RAG request failed."
                );

                setMessages(
                    (current) => {
                        const copy =
                            [...current];

                        const last =
                            copy[
                                copy.length - 1
                            ];

                        if (
                            last?.role ===
                            "assistant" &&
                            !last.content
                        ) {
                            copy.pop();
                        }

                        return copy;
                    }
                );
            }
        } finally {
            setRagLoading(false);
            abortRef.current = null;
        }
    }

    function stopRAG() {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }

        setRagLoading(false);
    }

    function newChat() {
        stopRAG();

        setMessages([]);
        setRagInput("");
        setRagError("");
        setCompareResult(null);

        setTimeout(autoResize, 0);
    }

    async function runCompare() {
        const question =
            compareQuestion.trim();

        if (!question) {
            return;
        }

        if (!knowledgeBase) {
            setCompareResult({
                error:
                    "Create a Knowledge Base and upload a document first.",
            });

            return;
        }

        const vectorStoreId =
            knowledgeBase.vector_store_id ||
            knowledgeBase.vectorStoreId;

        if (!vectorStoreId) {
            setCompareResult({
                error:
                    "Upload a document to the Knowledge Base first.",
            });

            return;
        }

        setCompareLoading(true);
        setCompareResult(null);

        try {
            const response = await fetch(
                `${BACKEND}/rag/compare`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        question,
                        vector_store_id:
                            vectorStoreId,
                        knowledge_base_id:
                            knowledgeBase.id,
                        model,
                        reasoning,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "RAG comparison failed."
                );
            }

            setCompareResult(data);

        } catch (error) {
            console.error(error);

            setCompareResult({
                error: error.message,
            });
        } finally {
            setCompareLoading(false);
        }
    }

    async function uploadImage(event) {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {
            setRagError(
                "Please select an image file."
            );

            return;
        }

        setRagError("");
        setImageName(file.name);

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

            setImageFileId(
                data.file_id
            );

            setRagInput(
                "Analyze this image and explain what you see."
            );

            setTimeout(
                autoResize,
                0
            );

        } catch (error) {
            console.error(error);

            setRagError(
                error.message ||
                "Image upload failed."
            );
        } finally {
            event.target.value = "";
        }
    }

    async function startVoice() {
        if (voiceConnected) {
            stopVoice();
            return;
        }

        if (voiceConnecting) {
            return;
        }

        setVoiceConnecting(true);
        setVoiceStatus(
            "Connecting to voice..."
        );

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
                    "Could not create realtime token."
                );
            }

            const clientSecret =
                tokenData.client_secret;

            if (!clientSecret) {
                throw new Error(
                    "Realtime client secret was not returned."
                );
            }

            const pc =
                new RTCPeerConnection();

            peerRef.current = pc;

            const audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay = true;

            audio.style.display =
                "none";

            document.body.appendChild(
                audio
            );

            audioRef.current =
                audio;

            pc.ontrack = (event) => {
                if (
                    event.streams?.[0]
                ) {
                    audio.srcObject =
                        event.streams[0];
                }
            };

            const mediaStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true,
                    }
                );

            mediaStreamRef.current =
                mediaStream;

            mediaStream
                .getTracks()
                .forEach(
                    (track) => {
                        pc.addTrack(
                            track,
                            mediaStream
                        );
                    }
                );

            pc.createDataChannel(
                "oai-events"
            );

            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            const realtimeResponse =
                await fetch(
                    "https://api.openai.com/v1/realtime/calls",
                    {
                        method: "POST",

                        body:
                            offer.sdp,

                        headers: {
                            Authorization:
                                `Bearer ${clientSecret}`,

                            "Content-Type":
                                "application/sdp",
                        },
                    }
                );

            if (
                !realtimeResponse.ok
            ) {
                throw new Error(
                    await realtimeResponse.text()
                );
            }

            const answer =
                await realtimeResponse.text();

            await pc.setRemoteDescription(
                {
                    type: "answer",
                    sdp: answer,
                }
            );

            setVoiceConnected(true);
            setVoiceStatus(
                "Voice connected"
            );

        } catch (error) {
            console.error(error);

            stopVoice();

            setVoiceStatus(
                `Voice error: ${error.message}`
            );

        } finally {
            setVoiceConnecting(false);
        }
    }

    function stopVoice() {
        try {
            mediaStreamRef.current
                ?.getTracks()
                .forEach(
                    (track) =>
                        track.stop()
                );
        } catch {}

        mediaStreamRef.current =
            null;

        try {
            peerRef.current?.close();
        } catch {}

        peerRef.current =
            null;

        if (audioRef.current) {
            try {
                audioRef.current.pause();
                audioRef.current.srcObject =
                    null;
                audioRef.current.remove();
            } catch {}

            audioRef.current =
                null;
        }

        setVoiceConnected(false);
        setVoiceConnecting(false);
    }

    const lesson =
        ragLessons[visualMode];

    const hasKnowledgeBase =
        Boolean(knowledgeBase);

    const hasVectorStore =
        Boolean(
            knowledgeBase?.vector_store_id ||
            knowledgeBase?.vectorStoreId
        );

    return (
        <main className="app-shell">

            {/* =====================================================
                TOP BAR
            ===================================================== */}

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
                            V11 · Advanced RAG Lab
                        </div>
                    </div>

                </div>


                <div className="topbar-actions">

                    <button
                        className="new-chat-btn"
                        onClick={newChat}
                    >
                        ＋ New Chat
                    </button>


                    <button
                        className={
                            `voice-top-btn ${
                                voiceConnected
                                    ? "active"
                                    : ""
                            }`
                        }
                        onClick={startVoice}
                    >
                        🎙 Voice
                    </button>

                </div>

            </header>


            {/* =====================================================
                WORKSPACE
            ===================================================== */}

            <section className="workspace">


                {/* =================================================
                    SIDEBAR
                ================================================= */}

                <aside className="sidebar">

                    <div className="sidebar-title">
                        ADVANCED RAG LAB
                    </div>


                    <div className="sidebar-label">
                        MODE
                    </div>


                    <button
                        className="mode-button active"
                        onClick={() =>
                            setVisualMode(
                                "overview"
                            )
                        }
                    >
                        🔎 RAG Chat
                    </button>


                    <button
                        className="mode-button"
                        onClick={() =>
                            setVisualMode(
                                "retrieval"
                            )
                        }
                    >
                        ⚖️ RAG Compare
                    </button>


                    <button
                        className="mode-button"
                        onClick={() =>
                            setVisualMode(
                                "grounding"
                            )
                        }
                    >
                        🧠 RAG Visual Lab
                    </button>


                    {/* =============================================
                        KNOWLEDGE BASE
                    ============================================= */}

                    <div className="sidebar-label">
                        KNOWLEDGE BASE
                    </div>


                    <div className="knowledge-box">

                        <select
                            value={
                                knowledgeBase?.id ||
                                ""
                            }
                            onChange={(event) => {

                                const id =
                                    event.target.value;

                                const selected =
                                    knowledgeBases.find(
                                        (kb) =>
                                            String(
                                                kb.id
                                            ) ===
                                            String(id)
                                    );

                                setKnowledgeBase(
                                    selected ||
                                    null
                                );
                            }}
                        >

                            <option value="">
                                My Knowledge Base
                            </option>

                            {knowledgeBases.map(
                                (kb) => (
                                    <option
                                        key={kb.id}
                                        value={kb.id}
                                    >
                                        {kb.name ||
                                            "Knowledge Base"}
                                    </option>
                                )
                            )}

                        </select>


                        <button
                            className="create-kb-button"
                            onClick={
                                createKnowledgeBase
                            }
                            disabled={
                                creatingKB
                            }
                        >
                            {creatingKB
                                ? "Creating..."
                                : "＋ Create"}
                        </button>


                        <button
                            className="add-document-button"
                            onClick={
                                createKBAndUpload
                            }
                            disabled={
                                uploading
                            }
                        >
                            📄{" "}
                            {uploading
                                ? "Uploading..."
                                : "Add Document"}
                        </button>


                        <input
                            ref={
                                fileInputRef
                            }
                            type="file"
                            hidden
                            accept="
                                .pdf,
                                .doc,
                                .docx,
                                .txt,
                                .md
                            "
                            onChange={
                                uploadDocument
                            }
                        />

                    </div>


                    {selectedFile && (
                        <div className="upload-mini-card">

                            <div>
                                📄{" "}
                                {selectedFile.name}
                            </div>

                            <small>
                                {uploadStatus}
                            </small>

                            <button
                                onClick={
                                    clearDocument
                                }
                            >
                                ×
                            </button>

                        </div>
                    )}


                    {/* =============================================
                        MODEL
                    ============================================= */}

                    <div className="sidebar-label">
                        MODEL
                    </div>


                    <select
                        className="sidebar-select"
                        value={model}
                        onChange={(event) =>
                            setModel(
                                event.target.value
                            )
                        }
                    >
                        <option value="gpt-5.6-luna">
                            GPT-5.6 Luna
                        </option>

                        <option value="gpt-5.6">
                            GPT-5.6
                        </option>
                    </select>


                    <small className="model-note">
                        Cost-sensitive / high-volume
                    </small>


                    {/* =============================================
                        REASONING
                    ============================================= */}

                    <div className="sidebar-label">
                        REASONING
                    </div>


                    <select
                        className="sidebar-select"
                        value={reasoning}
                        onChange={(event) =>
                            setReasoning(
                                event.target.value
                            )
                        }
                    >
                        <option value="low">
                            LOW
                        </option>

                        <option value="medium">
                            MEDIUM
                        </option>

                        <option value="high">
                            HIGH
                        </option>
                    </select>


                    {/* =============================================
                        RETRIEVAL OPTIONS
                    ============================================= */}

                    <div className="sidebar-label">
                        RETRIEVAL OPTIONS
                    </div>


                    <label className="checkbox-row">

                        <input
                            type="checkbox"
                            checked={
                                webSearch
                            }
                            onChange={(event) =>
                                setWebSearch(
                                    event.target.checked
                                )
                            }
                        />

                        <span>
                            Web Search
                        </span>

                    </label>


                    {/* =============================================
                        MULTIMODAL
                    ============================================= */}

                    <div className="sidebar-label">
                        MULTIMODAL
                    </div>


                    <button
                        className="mode-button"
                        onClick={() =>
                            imageInputRef.current?.click()
                        }
                    >
                        🖼️ Analyze Image
                    </button>


                    <input
                        ref={
                            imageInputRef
                        }
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={
                            uploadImage
                        }
                    />


                    {imageName && (
                        <div className="image-status">
                            🖼️ {imageName}
                        </div>
                    )}


                    {/* =============================================
                        SYSTEM PROMPT
                    ============================================= */}

                    <button
                        className="system-prompt-button"
                        onClick={() =>
                            alert(
                                "System Prompt controls how the RAG assistant behaves. The V11 backend provides the main RAG instructions."
                            )
                        }
                    >
                        ⚙ System Prompt
                        <span>▼</span>
                    </button>

                </aside>


                {/* =================================================
                    MAIN PANEL
                ================================================= */}

                <section className="main-panel">


                    {/* =============================================
                        HEADER
                    ============================================= */}

                    <div className="rag-header">

                        <div>

                            <h1>
                                Advanced RAG Chat
                            </h1>

                            <p>
                                Ask questions against your own knowledge base.
                            </p>

                        </div>


                        <div
                            className={
                                `kb-status ${
                                    hasVectorStore
                                        ? "ready"
                                        : ""
                                }`
                            }
                        >

                            <span className="status-dot" />

                            {hasVectorStore
                                ? "Knowledge Base Ready"
                                : "No Knowledge Base"}

                        </div>

                    </div>


                    {/* =============================================
                        RAG PIPELINE
                    ============================================= */}

                    <section className="rag-pipeline">

                        <div className="pipeline-step">

                            <div className="pipeline-icon">
                                📄
                            </div>

                            <strong>
                                Documents
                            </strong>

                        </div>


                        <div className="pipeline-arrow">
                            →
                        </div>


                        <div className="pipeline-step">

                            <div className="pipeline-icon">
                                📁
                            </div>

                            <strong>
                                Vector Store
                            </strong>

                        </div>


                        <div className="pipeline-arrow">
                            →
                        </div>


                        <div className="pipeline-step">

                            <div className="pipeline-icon">
                                🔎
                            </div>

                            <strong>
                                Retrieval
                            </strong>

                        </div>


                        <div className="pipeline-arrow">
                            →
                        </div>


                        <div className="pipeline-step">

                            <div className="pipeline-icon">
                                🧠
                            </div>

                            <strong>
                                LLM
                            </strong>

                        </div>


                        <div className="pipeline-arrow">
                            →
                        </div>


                        <div className="pipeline-step">

                            <div className="pipeline-icon">
                                💬
                            </div>

                            <strong>
                                Answer
                            </strong>

                        </div>

                    </section>


                    {/* =============================================
                        CHAT / VISUAL CONTENT
                    ============================================= */}

                    {messages.length === 0 ? (

                        <section className="rag-empty-card">

                            <div className="rag-empty-icon">
                                🔎
                            </div>

                            <h2>
                                Ask your documents
                            </h2>

                            <p>
                                Upload a document and ask questions grounded in your knowledge base.
                            </p>


                            {!hasKnowledgeBase && (

                                <div className="rag-info-message">

                                    Create a knowledge base from the left panel first.

                                </div>

                            )}


                            {hasKnowledgeBase &&
                                !hasVectorStore && (

                                <div className="rag-info-message">

                                    Upload a document to enable retrieval.

                                </div>

                            )}

                        </section>

                    ) : (

                        <section className="messages-panel">

                            {messages.map(
                                (message, index) => (

                                <div
                                    key={index}
                                    className={
                                        `rag-message ${
                                            message.role
                                        }`
                                    }
                                >

                                    <div className="message-label">

                                        {message.role ===
                                            "user"
                                            ? "You"
                                            : "GenAI-Labs"}

                                    </div>


                                    <div className="message-content">

                                        {message.content}

                                    </div>


                                    {message.retrieval && (
                                        <div className="retrieval-indicator">

                                            🔎 Retrieved context used

                                        </div>
                                    )}

                                </div>

                            ))}

                        </section>

                    )}


                    {/* =============================================
                        VISUAL LAB
                    ============================================= */}

                    <section className="rag-visual-lab">

                        <div className="visual-lab-header">

                            <div>

                                <span className="section-eyebrow">
                                    RAG VISUAL LAB
                                </span>

                                <h2>
                                    {lesson.icon}{" "}
                                    {lesson.title}
                                </h2>

                                <p>
                                    {lesson.description}
                                </p>

                            </div>

                            <div className="lesson-count">
                                {String(
                                    Object.keys(
                                        ragLessons
                                    ).indexOf(
                                        visualMode
                                    ) + 1
                                ).padStart(2, "0")}
                            </div>

                        </div>


                        <div className="rag-flow">

                            {lesson.steps.map(
                                (step, index) => (

                                <div
                                    className="rag-flow-item"
                                    key={step[0]}
                                >

                                    <div className="rag-flow-card">

                                        <div className="rag-flow-number">
                                            {step[0]}
                                        </div>

                                        <div>

                                            <strong>
                                                {step[1]}
                                            </strong>

                                            <p>
                                                {step[2]}
                                            </p>

                                        </div>

                                    </div>


                                    {index <
                                        lesson.steps.length -
                                        1 && (

                                        <div className="rag-flow-arrow">
                                            →
                                        </div>

                                    )}

                                </div>

                            ))}

                        </div>


                        <button
                            className="explain-rag-button"
                            onClick={() => {

                                setRagInput(
                                    `Explain ${lesson.title} using a simple real-world example and explain each step.`
                                );

                                setTimeout(
                                    autoResize,
                                    0
                                );

                                ragInputRef.current?.focus();

                            }}
                        >
                            ✨ Ask AI to explain this
                        </button>

                    </section>


                    {/* =============================================
                        QUICK QUESTIONS
                    ============================================= */}

                    <section className="quick-rag-section">

                        <div className="quick-rag-title">
                            Quick Questions
                        </div>


                        <div className="quick-rag-grid">

                            {quickQuestions.map(
                                (question) => (

                                <button
                                    key={question}
                                    onClick={() =>
                                        setQuickQuestion(
                                            question
                                        )
                                    }
                                >
                                    {question}
                                </button>

                            ))}

                        </div>

                    </section>


                    {/* =============================================
                        ERROR
                    ============================================= */}

                    {ragError && (

                        <div className="rag-error">

                            ⚠️{" "}
                            {ragError}

                        </div>

                    )}


                    {/* =============================================
                        COMPOSER
                    ============================================= */}

                    <section className="rag-composer">

                        <textarea
                            ref={
                                ragInputRef
                            }

                            value={
                                ragInput
                            }

                            /*
                             * IMPORTANT FIX:
                             *
                             * DO NOT use:
                             *
                             * disabled={!knowledgeBase}
                             *
                             * The user must be able to type
                             * before creating a KB.
                             */

                            disabled={
                                ragLoading
                            }

                            placeholder={
                                "Ask a question about your knowledge base..."
                            }

                            rows={1}

                            onChange={(event) => {

                                setRagInput(
                                    event.target.value
                                );

                                event.target.style.height =
                                    "auto";

                                event.target.style.height =
                                    `${Math.min(
                                        event.target
                                            .scrollHeight,
                                        180
                                    )}px`;

                            }}

                            onKeyDown={
                                handleRagKeyDown
                            }

                        />


                        <div className="composer-bottom">

                            <div className="composer-hint">

                                Enter to send · Shift+Enter for new line

                            </div>


                            <button
                                className="ask-rag-button"
                                disabled={
                                    !ragInput.trim() ||
                                    ragLoading
                                }
                                onClick={
                                    ragLoading
                                        ? stopRAG
                                        : submitRAG
                                }
                            >

                                {ragLoading
                                    ? "■ Stop"
                                    : "Ask RAG →"}

                            </button>

                        </div>

                    </section>


                    {/* =============================================
                        RAG COMPARE
                    ============================================= */}

                    <section className="compare-section">

                        <div className="section-heading">

                            <div>

                                <span className="section-eyebrow">
                                    ADVANCED MODE
                                </span>

                                <h2>
                                    ⚖️ RAG Compare
                                </h2>

                                <p>
                                    Compare how an answer changes when retrieval and grounding are used.
                                </p>

                            </div>

                        </div>


                        <div className="compare-composer">

                            <textarea
                                value={
                                    compareQuestion
                                }

                                onChange={(event) =>
                                    setCompareQuestion(
                                        event.target.value
                                    )
                                }

                                placeholder="Enter a question to compare..."
                                rows={3}
                            />


                            <button
                                onClick={
                                    runCompare
                                }
                                disabled={
                                    compareLoading ||
                                    !compareQuestion.trim()
                                }
                            >
                                {compareLoading
                                    ? "Comparing..."
                                    : "Compare RAG"}
                            </button>

                        </div>


                        {compareResult && (

                            <div className="compare-result">

                                {compareResult.error ? (

                                    <div className="rag-error">
                                        ⚠️{" "}
                                        {compareResult.error}
                                    </div>

                                ) : (

                                    <>

                                        <div className="compare-column">

                                            <h3>
                                                Without Retrieval
                                            </h3>

                                            <p>
                                                {compareResult.without_retrieval ||
                                                    compareResult.normal_answer ||
                                                    "No result returned."}
                                            </p>

                                        </div>


                                        <div className="compare-column">

                                            <h3>
                                                With RAG
                                            </h3>

                                            <p>
                                                {compareResult.with_rag ||
                                                    compareResult.rag_answer ||
                                                    "No result returned."}
                                            </p>

                                        </div>

                                    </>

                                )}

                            </div>

                        )}

                    </section>

                </section>

            </section>


            {/* =====================================================
                VOICE STATUS
            ===================================================== */}

            {(voiceStatus ||
                voiceConnecting) && (

                <div className="voice-floating">

                    <span>
                        🎙
                    </span>

                    <span>
                        {voiceStatus ||
                            "Connecting..."}
                    </span>

                    {voiceConnected && (

                        <button
                            onClick={
                                stopVoice
                            }
                        >
                            Stop
                        </button>

                    )}

                </div>

            )}

        </main>
    );
}