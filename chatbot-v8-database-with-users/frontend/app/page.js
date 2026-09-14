"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8008";

export default function Home() {

    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);

    const [authMode, setAuthMode] =
        useState("login");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [authError, setAuthError] =
        useState("");

    const [conversations, setConversations] =
        useState([]);

    const [conversationId, setConversationId] =
        useState(null);

    const [messages, setMessages] =
        useState([]);

    const [input, setInput] = useState("");

    const [loading, setLoading] =
        useState(false);

    const [memories, setMemories] =
        useState([]);

    const [upload, setUpload] =
        useState(null);

    const [vectorStoreId, setVectorStoreId] =
        useState(null);

    const [imageFileId, setImageFileId] =
        useState(null);

    const [voiceActive, setVoiceActive] =
        useState(false);

    const [voiceStatus, setVoiceStatus] =
        useState("");

    const fileInputRef = useRef(null);
    const abortRef = useRef(null);
    const textareaRef = useRef(null);

    const peerRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {

        const savedToken =
            localStorage.getItem(
                "genai-labs-v8-token"
            );

        const savedUser =
            localStorage.getItem(
                "genai-labs-v8-user"
            );

        if (savedToken && savedUser) {

            setToken(savedToken);

            setUser(
                JSON.parse(savedUser)
            );
        }

    }, []);


    useEffect(() => {

        if (token) {

            loadConversations();
            loadMemories();
        }

    }, [token]);


    function authHeaders() {

        return {
            "Content-Type":
                "application/json",

            Authorization:
                `Bearer ${token}`
        };
    }


    async function authenticate() {

        setAuthError("");

        try {

            const endpoint =
                authMode === "login"
                    ? "/auth/login"
                    : "/auth/register";

            const body =
                authMode === "login"
                    ? {
                        email,
                        password
                    }
                    : {
                        name,
                        email,
                        password
                    };

            const response =
                await fetch(
                    `${BACKEND}${endpoint}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify(body)
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Authentication failed"
                );
            }

            localStorage.setItem(
                "genai-labs-v8-token",
                data.access_token
            );

            localStorage.setItem(
                "genai-labs-v8-user",
                JSON.stringify(data.user)
            );

            setToken(
                data.access_token
            );

            setUser(data.user);

            setPassword("");

        } catch (error) {

            setAuthError(
                error.message
            );
        }
    }


    function logout() {

        stopVoice();

        localStorage.removeItem(
            "genai-labs-v8-token"
        );

        localStorage.removeItem(
            "genai-labs-v8-user"
        );

        setToken(null);
        setUser(null);
        setConversations([]);
        setMessages([]);
        setConversationId(null);
    }


    async function loadConversations() {

        try {

            const response =
                await fetch(
                    `${BACKEND}/conversations`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            if (response.status === 401) {

                logout();
                return;
            }

            const data =
                await response.json();

            setConversations(data);

            if (
                data.length > 0 &&
                !conversationId
            ) {

                loadConversation(
                    data[0].id
                );
            }

        } catch (error) {

            console.error(error);
        }
    }


    async function loadConversation(id) {

        try {

            const response =
                await fetch(
                    `${BACKEND}/conversations/${id}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const data =
                await response.json();

            setConversationId(id);

            setMessages(
                data.messages.map(
                    message => ({
                        role:
                            message.role,
                        content:
                            message.content
                    })
                )
            );

        } catch (error) {

            console.error(error);
        }
    }


    async function newChat() {

        try {

            const response =
                await fetch(
                    `${BACKEND}/conversations`,
                    {
                        method: "POST",
                        headers:
                            authHeaders(),
                        body:
                            JSON.stringify({
                                title:
                                    "New Chat"
                            })
                    }
                );

            const data =
                await response.json();

            setConversationId(data.id);
            setMessages([]);

            setUpload(null);
            setVectorStoreId(null);
            setImageFileId(null);

            await loadConversations();

        } catch (error) {

            console.error(error);
        }
    }


    async function deleteChat(id) {

        if (
            !confirm(
                "Delete this conversation?"
            )
        ) {
            return;
        }

        await fetch(
            `${BACKEND}/conversations/${id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const remaining =
            conversations.filter(
                chat => chat.id !== id
            );

        setConversations(
            remaining
        );

        if (
            conversationId === id
        ) {

            setMessages([]);

            if (remaining.length > 0) {

                loadConversation(
                    remaining[0].id
                );

            } else {

                newChat();
            }
        }
    }


    async function loadMemories() {

        try {

            const response =
                await fetch(
                    `${BACKEND}/memories`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const data =
                await response.json();

            setMemories(data);

        } catch (error) {

            console.error(error);
        }
    }


    async function saveMemory() {

        const memory =
            prompt(
                "What should GenAI-Labs remember?"
            );

        if (!memory?.trim()) {
            return;
        }

        await fetch(
            `${BACKEND}/memories`,
            {
                method: "POST",
                headers:
                    authHeaders(),
                body:
                    JSON.stringify({
                        memory:
                            memory.trim()
                    })
            }
        );

        loadMemories();
    }


    async function deleteMemory(id) {

        await fetch(
            `${BACKEND}/memories/${id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        loadMemories();
    }


    async function handleFile(event) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        setUpload({
            name: file.name,
            status: "Uploading..."
        });

        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            const endpoint =
                file.type.startsWith("image/")
                    ? "/upload-image"
                    : "/upload";

            const response =
                await fetch(
                    `${BACKEND}${endpoint}`,
                    {
                        method: "POST",
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Upload failed"
                );
            }

            if (
                file.type.startsWith("image/")
            ) {

                setImageFileId(
                    data.file_id
                );

                setVectorStoreId(null);

                setUpload({
                    name: file.name,
                    status:
                        "Ready for image analysis"
                });

            } else {

                setVectorStoreId(
                    data.vector_store_id
                );

                setImageFileId(null);

                setUpload({
                    name: file.name,
                    status:
                        "Ready for questions"
                });
            }

        } catch (error) {

            setUpload({
                name: file.name,
                status:
                    `Upload failed: ${error.message}`
            });
        }

        event.target.value = "";
    }


    async function sendMessage() {

        const text = input.trim();

        if (
            !text ||
            loading ||
            !conversationId
        ) {
            return;
        }

        const userMessage = {
            role: "user",
            content: text
        };

        const updatedMessages = [
            ...messages,
            userMessage
        ];

        setMessages([
            ...updatedMessages,
            {
                role: "assistant",
                content: ""
            }
        ]);

        setInput("");
        setLoading(true);

        const controller =
            new AbortController();

        abortRef.current =
            controller;

        try {

            const response =
                await fetch(
                    `${BACKEND}/chat`,
                    {
                        method: "POST",
                        headers:
                            authHeaders(),
                        body:
                            JSON.stringify({
                                conversation_id:
                                    conversationId,
                                messages:
                                    updatedMessages,
                                vector_store_id:
                                    vectorStoreId,
                                image_file_id:
                                    imageFileId
                            }),
                        signal:
                            controller.signal
                    }
                );

            if (!response.ok) {

                throw new Error(
                    await response.text()
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
                    done
                } =
                    await reader.read();

                if (done) break;

                buffer +=
                    decoder.decode(
                        value,
                        { stream: true }
                    );

                const events =
                    buffer.split("\n\n");

                buffer =
                    events.pop() || "";

                for (
                    const event
                    of events
                ) {

                    const line =
                        event
                            .split("\n")
                            .find(
                                line =>
                                    line.startsWith(
                                        "data:"
                                    )
                            );

                    if (!line) continue;

                    const payload =
                        JSON.parse(
                            line.slice(5)
                        );

                    if (
                        payload.type ===
                        "delta"
                    ) {

                        setMessages(
                            current => {

                                const copy =
                                    [...current];

                                const last =
                                    copy[
                                        copy.length - 1
                                    ];

                                copy[
                                    copy.length - 1
                                ] = {
                                    ...last,
                                    content:
                                        last.content +
                                        payload.text
                                };

                                return copy;
                            }
                        );
                    }
                }
            }

            loadConversations();

        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(error);
            }

        } finally {

            setLoading(false);
            abortRef.current = null;
        }
    }


    function stopGeneration() {

        if (abortRef.current) {

            abortRef.current.abort();

            abortRef.current = null;

            setLoading(false);
        }
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


    function resizeTextarea(event) {

        setInput(
            event.target.value
        );

        event.target.style.height =
            "auto";

        event.target.style.height =
            `${Math.min(
                event.target.scrollHeight,
                180
            )}px`;
    }


    async function startVoice() {

        if (voiceActive) {

            stopVoice();

            return;
        }

        try {

            setVoiceStatus(
                "Connecting..."
            );

            const tokenResponse =
                await fetch(
                    `${BACKEND}/realtime-token`,
                    {
                        method: "POST",
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const tokenData =
                await tokenResponse.json();

            if (!tokenResponse.ok) {

                throw new Error(
                    tokenData.detail ||
                    "Could not get voice token"
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

            document.body.appendChild(
                audio
            );

            audioRef.current =
                audio;

            pc.ontrack = event => {

                audio.srcObject =
                    event.streams[0];
            };

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            stream
                .getTracks()
                .forEach(track =>
                    pc.addTrack(
                        track,
                        stream
                    )
                );

            pc.createDataChannel(
                "oai-events"
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
                        body:
                            offer.sdp,
                        headers: {
                            Authorization:
                                `Bearer ${tokenData.client_secret}`,
                            "Content-Type":
                                "application/sdp"
                        }
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
                sdp: answer
            });

            setVoiceActive(true);

            setVoiceStatus(
                "Voice connected"
            );

        } catch (error) {

            console.error(error);

            stopVoice();

            alert(
                `Voice connection failed:\n\n${error.message}`
            );
        }
    }


    function stopVoice() {

        if (peerRef.current) {

            peerRef.current
                .getSenders()
                .forEach(sender => {

                    sender.track?.stop();
                });

            peerRef.current.close();

            peerRef.current = null;
        }

        if (audioRef.current) {

            audioRef.current.remove();

            audioRef.current = null;
        }

        setVoiceActive(false);
        setVoiceStatus("");
    }


    // -----------------------------------------------------
    // LOGIN / REGISTER SCREEN
    // -----------------------------------------------------

    if (!token) {

        return (
            <main className="auth-page">

                <div className="auth-card">

                    <div className="auth-brand">
                        GenAI-Labs
                        <span>V8</span>
                    </div>

                    <h1>
                        {authMode === "login"
                            ? "Welcome back"
                            : "Create your account"}
                    </h1>

                    <p className="auth-subtitle">
                        {authMode === "login"
                            ? "Sign in to your GenAI-Labs account."
                            : "Create your personal GenAI-Labs account."}
                    </p>

                    {authMode === "register" && (

                        <input
                            placeholder="Your name"
                            value={name}
                            onChange={e =>
                                setName(
                                    e.target.value
                                )
                            }
                        />

                    )}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e =>
                            setEmail(
                                e.target.value
                            )
                        }
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e =>
                            setPassword(
                                e.target.value
                            )
                        }
                        onKeyDown={e => {

                            if (
                                e.key === "Enter"
                            ) {
                                authenticate();
                            }
                        }}
                    />

                    {authError && (

                        <div className="auth-error">
                            {authError}
                        </div>

                    )}

                    <button
                        className="auth-submit"
                        onClick={
                            authenticate
                        }
                    >
                        {authMode === "login"
                            ? "Sign In"
                            : "Create Account"}
                    </button>

                    <button
                        className="auth-switch"
                        onClick={() => {

                            setAuthError("");

                            setAuthMode(
                                authMode === "login"
                                    ? "register"
                                    : "login"
                            );
                        }}
                    >
                        {authMode === "login"
                            ? "Create a new account"
                            : "Already have an account? Sign in"}
                    </button>

                </div>

            </main>
        );
    }


    // -----------------------------------------------------
    // MAIN APPLICATION
    // -----------------------------------------------------

    return (
        <div className="app-shell">

            <header className="topbar">

                <div className="brand">
                    GenAI-Labs
                </div>

                <div className="version">
                    V8
                </div>

                <div className="user-area">

                    <span>
                        👤 {user?.name}
                    </span>

                    <button
                        onClick={logout}
                    >
                        Logout
                    </button>

                </div>

            </header>


            <div className="main-layout">

                <aside className="sidebar">

                    <button
                        className="new-chat"
                        onClick={newChat}
                    >
                        + New Chat
                    </button>

                    <div className="sidebar-title">
                        Conversations
                    </div>

                    {conversations.map(
                        chat => (

                            <div
                                key={chat.id}
                                className={
                                    `conversation-item ${
                                        chat.id ===
                                        conversationId
                                            ? "active"
                                            : ""
                                    }`
                                }
                                onClick={() =>
                                    loadConversation(
                                        chat.id
                                    )
                                }
                            >

                                <span>
                                    {chat.title}
                                </span>

                                <button
                                    onClick={e => {

                                        e.stopPropagation();

                                        deleteChat(
                                            chat.id
                                        );
                                    }}
                                >
                                    ×
                                </button>

                            </div>
                        )
                    )}


                    <div className="memory-section">

                        <div className="sidebar-title">
                            🧠 Persistent Memory
                        </div>

                        <button
                            className="memory-add"
                            onClick={
                                saveMemory
                            }
                        >
                            + Add Memory
                        </button>

                        {memories.map(
                            memory => (

                                <div
                                    key={
                                        memory.id
                                    }
                                    className="memory-item"
                                >

                                    <span>
                                        {memory.memory}
                                    </span>

                                    <button
                                        onClick={() =>
                                            deleteMemory(
                                                memory.id
                                            )
                                        }
                                    >
                                        ×
                                    </button>

                                </div>

                            )
                        )}

                    </div>

                </aside>


                <main className="chat-area">

                    <div className="welcome">

                        <h1>
                            Hello {user?.name} 👋
                        </h1>

                        <p>
                            Welcome to
                            GenAI-Labs V8.
                        </p>

                        <p>
                            Your conversations and
                            memories are private to
                            your account.
                        </p>

                    </div>


                    <div className="messages">

                        {messages.map(
                            (message, index) => (

                                <div
                                    key={index}
                                    className={
                                        `message ${
                                            message.role
                                        }`
                                    }
                                >

                                    <div className="message-role">
                                        {message.role ===
                                        "user"
                                            ? "You"
                                            : "GenAI-Labs"}
                                    </div>

                                    <div>
                                        {message.content}
                                    </div>

                                </div>

                            )
                        )}

                    </div>


                    {upload && (

                        <div className="upload-preview">

                            📎 {upload.name}

                            <span>
                                {upload.status}
                            </span>

                            <button
                                onClick={() => {

                                    setUpload(null);
                                    setVectorStoreId(null);
                                    setImageFileId(null);

                                }}
                            >
                                Remove
                            </button>

                        </div>

                    )}


                    {voiceStatus && (

                        <div className="voice-status">
                            🎙️ {voiceStatus}
                        </div>

                    )}


                    <div className="composer">

                        <input
                            ref={fileInputRef}
                            hidden
                            type="file"
                            accept="
                                image/*,
                                .pdf,
                                .doc,
                                .docx,
                                .txt,
                                .md,
                                .csv,
                                .json
                            "
                            onChange={
                                handleFile
                            }
                        />

                        <button
                            className="icon-button"
                            onClick={() =>
                                fileInputRef.current?.click()
                            }
                        >
                            📎
                        </button>

                        <button
                            className={
                                `icon-button ${
                                    voiceActive
                                        ? "voice-active"
                                        : ""
                                }`
                            }
                            onClick={
                                startVoice
                            }
                        >
                            🎙️
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={
                                resizeTextarea
                            }
                            onKeyDown={
                                handleKeyDown
                            }
                            placeholder=
                                "Message GenAI-Labs..."
                            rows={1}
                        />

                        <button
                            className="send-button"
                            onClick={
                                loading
                                    ? stopGeneration
                                    : sendMessage
                            }
                        >
                            {loading
                                ? "■"
                                : "↑"}
                        </button>

                    </div>

                </main>

            </div>

        </div>
    );
}