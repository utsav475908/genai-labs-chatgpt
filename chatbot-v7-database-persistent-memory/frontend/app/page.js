"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8007";

export default function Home() {

    const [conversations, setConversations] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const [upload, setUpload] = useState(null);
    const [vectorStoreId, setVectorStoreId] = useState(null);
    const [imageFileId, setImageFileId] = useState(null);

    const [memories, setMemories] = useState([]);

    const [voiceActive, setVoiceActive] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState("");

    const fileInputRef = useRef(null);
    const abortRef = useRef(null);
    const textareaRef = useRef(null);
    const peerRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        loadConversations();
        loadMemories();
    }, []);

    useEffect(() => {

        if (
            conversationId &&
            typeof window !== "undefined"
        ) {
            localStorage.setItem(
                "genai-labs-v7-current-chat",
                String(conversationId)
            );
        }

    }, [conversationId]);


    async function loadConversations() {

        try {

            const response = await fetch(
                `${BACKEND}/conversations`
            );

            const data = await response.json();

            setConversations(data);

            if (data.length > 0) {

                const saved =
                    localStorage.getItem(
                        "genai-labs-v7-current-chat"
                    );

                const savedId = saved
                    ? Number(saved)
                    : data[0].id;

                const exists = data.some(
                    chat => chat.id === savedId
                );

                await loadConversation(
                    exists
                        ? savedId
                        : data[0].id
                );
            }

        } catch (error) {

            console.error(
                "Conversation loading failed:",
                error
            );
        }
    }


    async function loadConversation(id) {

        try {

            const response = await fetch(
                `${BACKEND}/conversations/${id}`
            );

            const data = await response.json();

            setConversationId(id);

            setMessages(
                data.messages.map(message => ({
                    role: message.role,
                    content: message.content
                }))
            );

            setUpload(null);
            setVectorStoreId(null);
            setImageFileId(null);

        } catch (error) {

            console.error(
                "Conversation loading failed:",
                error
            );
        }
    }


    async function createNewChat() {

        try {

            const response = await fetch(
                `${BACKEND}/conversations`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: "New Chat"
                    })
                }
            );

            const data = await response.json();

            setConversationId(data.id);
            setMessages([]);

            setUpload(null);
            setVectorStoreId(null);
            setImageFileId(null);

            await loadConversations();

            setTimeout(() => {
                loadConversation(data.id);
            }, 100);

        } catch (error) {

            alert(
                "Could not create new conversation."
            );
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

        try {

            await fetch(
                `${BACKEND}/conversations/${id}`,
                {
                    method: "DELETE"
                }
            );

            const remaining =
                conversations.filter(
                    chat => chat.id !== id
                );

            setConversations(remaining);

            if (conversationId === id) {

                if (remaining.length > 0) {

                    await loadConversation(
                        remaining[0].id
                    );

                } else {

                    await createNewChat();
                }
            }

        } catch (error) {

            alert(
                "Could not delete conversation."
            );
        }
    }


    async function loadMemories() {

        try {

            const response = await fetch(
                `${BACKEND}/memories`
            );

            const data = await response.json();

            setMemories(data);

        } catch (error) {

            console.error(
                "Memory loading failed:",
                error
            );
        }
    }


    async function saveMemory() {

        const memory = prompt(
            "What should GenAI-Labs remember?"
        );

        if (!memory || !memory.trim()) {
            return;
        }

        try {

            await fetch(
                `${BACKEND}/memories`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        memory: memory.trim()
                    })
                }
            );

            await loadMemories();

        } catch (error) {

            alert(
                "Could not save memory."
            );
        }
    }


    async function deleteMemory(id) {

        try {

            await fetch(
                `${BACKEND}/memories/${id}`,
                {
                    method: "DELETE"
                }
            );

            await loadMemories();

        } catch (error) {

            console.error(error);
        }
    }


    async function handleFile(event) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        setUpload({
            name: file.name,
            type: file.type,
            status: "Uploading..."
        });

        try {

            if (
                file.type.startsWith("image/")
            ) {

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
                            body: formData
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Image upload failed"
                    );
                }

                setImageFileId(
                    data.file_id
                );

                setVectorStoreId(null);

                setUpload({
                    name: file.name,
                    type: file.type,
                    status:
                        "Ready for image analysis"
                });

            } else {

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
                            body: formData
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Document upload failed"
                    );
                }

                setVectorStoreId(
                    data.vector_store_id
                );

                setImageFileId(null);

                setUpload({
                    name: file.name,
                    type: file.type,
                    status:
                        "Ready for questions"
                });
            }

        } catch (error) {

            console.error(error);

            setUpload({
                name: file.name,
                type: file.type,
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

        setMessages(updatedMessages);
        setInput("");
        setLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height =
                "auto";
        }

        const assistantMessage = {
            role: "assistant",
            content: ""
        };

        setMessages([
            ...updatedMessages,
            assistantMessage
        ]);

        const controller =
            new AbortController();

        abortRef.current = controller;

        try {

            const response =
                await fetch(
                    `${BACKEND}/chat`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
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
                } = await reader.read();

                if (done) {
                    break;
                }

                buffer +=
                    decoder.decode(
                        value,
                        { stream: true }
                    );

                const events =
                    buffer.split("\n\n");

                buffer =
                    events.pop() || "";

                for (const event of events) {

                    const line =
                        event
                            .split("\n")
                            .find(
                                line =>
                                    line.startsWith(
                                        "data:"
                                    )
                            );

                    if (!line) {
                        continue;
                    }

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

                    } else if (
                        payload.type ===
                        "status"
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
                                    status:
                                        payload.message
                                };

                                return copy;
                            }
                        );

                    } else if (
                        payload.type ===
                        "error"
                    ) {

                        throw new Error(
                            payload.message
                        );
                    }
                }
            }

            await loadConversations();

        } catch (error) {

            if (
                error.name !==
                "AbortError"
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
                                `Error: ${error.message}`
                        };

                        return copy;
                    }
                );
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

        setInput(event.target.value);

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
                "Getting voice connection..."
            );

            const tokenResponse =
                await fetch(
                    `${BACKEND}/realtime-token`,
                    {
                        method: "POST"
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

            const ephemeralKey =
                tokenData.client_secret;

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

            audioRef.current = audio;

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

            const dataChannel =
                pc.createDataChannel(
                    "oai-events"
                );

            dataChannel.onmessage =
                event => {

                    try {

                        const data =
                            JSON.parse(
                                event.data
                            );

                        if (
                            data.type ===
                            "conversation.item.input_audio_transcription.completed"
                        ) {

                            if (
                                data.transcript
                            ) {

                                setMessages(
                                    current => [
                                        ...current,
                                        {
                                            role:
                                                "user",
                                            content:
                                                data.transcript
                                        }
                                    ]
                                );
                            }
                        }

                        if (
                            data.type ===
                            "response.output_audio_transcript.done"
                        ) {

                            if (
                                data.transcript
                            ) {

                                setMessages(
                                    current => [
                                        ...current,
                                        {
                                            role:
                                                "assistant",
                                            content:
                                                data.transcript
                                        }
                                    ]
                                );
                            }
                        }

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                };

            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            setVoiceStatus(
                "Connecting..."
            );

            const sdpResponse =
                await fetch(
                    "https://api.openai.com/v1/realtime/calls",
                    {
                        method: "POST",
                        body: offer.sdp,
                        headers: {
                            Authorization:
                                `Bearer ${ephemeralKey}`,
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

            console.error(
                "Voice error:",
                error
            );

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

                    if (
                        sender.track
                    ) {

                        sender.track.stop();
                    }
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


    return (
        <div className="app-shell">

            <header className="topbar">

                <div className="brand">
                    GenAI-Labs
                </div>

                <div className="version">
                    V7
                </div>

                <div className="top-actions">

                    <button
                        onClick={saveMemory}
                        className="memory-button"
                    >
                        🧠 Memory
                    </button>

                    <button
                        onClick={createNewChat}
                        className="new-chat"
                    >
                        + New Chat
                    </button>

                </div>

            </header>


            <div className="main-layout">

                <aside className="sidebar">

                    <div className="sidebar-title">
                        Conversations
                    </div>

                    <div className="conversation-list">

                        {conversations.map(
                            chat => (

                                <div
                                    key={chat.id}
                                    className={
                                        "conversation-item " +
                                        (
                                            chat.id ===
                                            conversationId
                                                ? "active"
                                                : ""
                                        )
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
                                        onClick={event => {

                                            event.stopPropagation();

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

                    </div>


                    <div className="memory-section">

                        <div className="sidebar-title">
                            Persistent Memory
                        </div>

                        {memories.length === 0 && (

                            <div className="empty-memory">
                                No memories saved.
                            </div>

                        )}

                        {memories.map(
                            memory => (

                                <div
                                    key={memory.id}
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
                            Hello! I'm GenAI-Labs V7.
                        </h1>

                        <p>
                            Your conversations are now
                            stored in the database.
                        </p>

                        <p>
                            I can chat, search the web,
                            analyze documents and images,
                            use voice, and remember
                            information you choose to save.
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

                                    <div className="message-content">
                                        {message.content}
                                    </div>

                                    {message.status && (

                                        <div className="status">
                                            {message.status}
                                        </div>

                                    )}

                                </div>
                            )
                        )}

                    </div>


                    {upload && (

                        <div className="upload-preview">

                            <div>
                                📎 {upload.name}
                            </div>

                            <div>
                                {upload.status}
                            </div>

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
                            type="file"
                            hidden
                            accept="
                                image/*
                                ,.pdf
                                ,.doc
                                ,.docx
                                ,.txt
                                ,.md
                                ,.csv
                                ,.json
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
                            title="Attach file"
                        >
                            📎
                        </button>


                        <button
                            className={
                                `icon-button voice ${
                                    voiceActive
                                        ? "active"
                                        : ""
                                }`
                            }
                            onClick={
                                startVoice
                            }
                            title="Voice"
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
                            placeholder={
                                "Message GenAI-Labs..."
                            }
                            rows={1}
                        />


                        {loading ? (

                            <button
                                className="send-button stop"
                                onClick={
                                    stopGeneration
                                }
                            >
                                ■
                            </button>

                        ) : (

                            <button
                                className="send-button"
                                onClick={
                                    sendMessage
                                }
                            >
                                ↑
                            </button>

                        )}

                    </div>

                </main>

            </div>

        </div>
    );
}