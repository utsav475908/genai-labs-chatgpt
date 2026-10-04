"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8006";

const API_URL =
    `${BACKEND}/chat`;

const IMAGE_UPLOAD_URL =
    `${BACKEND}/upload-image`;

const DOCUMENT_UPLOAD_URL =
    `${BACKEND}/upload`;

const REALTIME_TOKEN_URL =
    `${BACKEND}/realtime-token`;


export default function Home() {

    const [messages, setMessages] =
        useState([]);

    const [input, setInput] =
        useState("");

    const [selectedFile, setSelectedFile] =
        useState(null);

    const [imageFileId, setImageFileId] =
        useState(null);

    const [vectorStoreId, setVectorStoreId] =
        useState(null);

    const [fileStatus, setFileStatus] =
        useState("");

    const [isLoading, setIsLoading] =
        useState(false);

    const [isListening, setIsListening] =
        useState(false);

    const [voiceStatus, setVoiceStatus] =
        useState("");


    const fileInputRef =
        useRef(null);

    const peerConnectionRef =
        useRef(null);

    const audioElementRef =
        useRef(null);

    const dataChannelRef =
        useRef(null);


    // =====================================================
    // FILE PICKER
    // =====================================================

    function openFilePicker() {

        if (fileInputRef.current) {

            fileInputRef.current.value = "";

            fileInputRef.current.click();

        }

    }


    async function handleFile(event) {

        const file =
            event.target.files?.[0];

        if (!file) return;


        setSelectedFile(file);

        setImageFileId(null);

        setVectorStoreId(null);

        setFileStatus("Uploading...");


        if (
            file.type.startsWith("image/")
        ) {

            await uploadImage(file);

        } else {

            await uploadDocument(file);

        }

    }


    // =====================================================
    // IMAGE
    // =====================================================

    async function uploadImage(file) {

        try {

            setFileStatus(
                "Uploading image..."
            );


            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );


            const response =
                await fetch(
                    IMAGE_UPLOAD_URL,
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

            setFileStatus(
                "Ready for image analysis"
            );


        } catch (error) {

            setFileStatus(
                "Image upload failed"
            );

            alert(
                error.message
            );

        }

    }


    // =====================================================
    // DOCUMENT
    // =====================================================

    async function uploadDocument(file) {

        try {

            setFileStatus(
                "Uploading document..."
            );


            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );


            const response =
                await fetch(
                    DOCUMENT_UPLOAD_URL,
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

            setFileStatus(
                "Ready for questions"
            );


        } catch (error) {

            setFileStatus(
                "Document upload failed"
            );

            alert(
                error.message
            );

        }

    }


    // =====================================================
    // REMOVE FILE
    // =====================================================

    function removeFile() {

        setSelectedFile(null);

        setImageFileId(null);

        setVectorStoreId(null);

        setFileStatus("");

        if (fileInputRef.current) {

            fileInputRef.current.value =
                "";

        }

    }


    // =====================================================
    // TEXT CHAT
    // =====================================================

    async function sendMessage() {

        const text =
            input.trim();

        if (!text || isLoading) {
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


        setMessages(
            updatedMessages
        );

        setInput("");

        setIsLoading(true);


        try {

            const body = {

                messages:
                    updatedMessages

            };


            if (imageFileId) {

                body.image_file_id =
                    imageFileId;

            }


            if (vectorStoreId) {

                body.vector_store_id =
                    vectorStoreId;

            }


            const response =
                await fetch(
                    API_URL,
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

            let assistantText = "";


            setMessages(
                prev => [
                    ...prev,
                    {
                        role: "assistant",
                        content: ""
                    }
                ]
            );


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
                        {
                            stream: true
                        }
                    );


                const parts =
                    buffer.split("\n\n");

                buffer =
                    parts.pop();


                for (
                    const part of parts
                ) {

                    const line =
                        part
                            .split("\n")
                            .find(
                                line =>
                                    line.startsWith(
                                        "data:"
                                    )
                            );


                    if (!line) continue;


                    const json =
                        line
                            .replace(
                                /^data:\s*/,
                                ""
                            )
                            .trim();


                    if (!json) continue;


                    const data =
                        JSON.parse(json);


                    if (
                        data.type ===
                        "delta"
                    ) {

                        assistantText +=
                            data.text || "";


                        setMessages(
                            prev => {

                                const copy =
                                    [...prev];

                                copy[
                                    copy.length - 1
                                ] = {

                                    role:
                                        "assistant",

                                    content:
                                        assistantText

                                };

                                return copy;

                            }
                        );

                    }

                }

            }


        } catch (error) {

            setMessages(
                prev => [
                    ...prev,
                    {
                        role: "assistant",
                        content:
                            "Error: " +
                            error.message
                    }
                ]
            );

        } finally {

            setIsLoading(false);

        }

    }


    // =====================================================
    // VOICE
    // =====================================================

    async function startVoice() {

        try {

            setVoiceStatus(
                "Connecting..."
            );


            // ---------------------------------------------
            // Get short-lived Realtime token
            // ---------------------------------------------

            const tokenResponse =
                await fetch(
                    REALTIME_TOKEN_URL,
                    {
                        method: "POST"
                    }
                );


            const tokenData =
                await tokenResponse.json();


            if (!tokenResponse.ok) {

                throw new Error(
                    tokenData.detail ||
                    "Could not create voice session"
                );

            }


            const ephemeralKey =
                tokenData.client_secret;


            // ---------------------------------------------
            // WebRTC
            // ---------------------------------------------

            const pc =
                new RTCPeerConnection();


            peerConnectionRef.current =
                pc;


            // ---------------------------------------------
            // Audio output
            // ---------------------------------------------

            const audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay = true;

            document.body.appendChild(
                audio
            );

            audioElementRef.current =
                audio;


            pc.ontrack = event => {

                audio.srcObject =
                    event.streams[0];

            };


            // ---------------------------------------------
            // Microphone
            // ---------------------------------------------

            const localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            localStream
                .getTracks()
                .forEach(
                    track => {

                        pc.addTrack(
                            track,
                            localStream
                        );

                    }
                );


            // ---------------------------------------------
            // Data channel
            // ---------------------------------------------

            const dataChannel =
                pc.createDataChannel(
                    "oai-events"
                );


            dataChannelRef.current =
                dataChannel;


            dataChannel.onopen =
                () => {

                    dataChannel.send(
                        JSON.stringify({

                            type:
                                "session.update",

                            session: {

                                type:
                                    "realtime",

                                instructions: `
You are GenAI-Labs V6.

Speak naturally and clearly.

You are an AI assistant for
GenAI-Labs, an AI and robotics
learning platform.

Help the user with technical,
educational and general questions.

Keep spoken answers concise
unless the user asks for detail.
`,

                                audio: {

                                    output: {

                                        voice:
                                            "marin"

                                    }

                                }

                            }

                        })
                    );


                    setIsListening(true);

                    setVoiceStatus(
                        "🎙️ Listening..."
                    );

                };


            dataChannel.onmessage =
                event => {

                    try {

                        const data =
                            JSON.parse(
                                event.data
                            );


                        // User speech transcript
                        if (
                            data.type ===
                            "conversation.item.input_audio_transcription.completed"
                        ) {

                            if (
                                data.transcript
                            ) {

                                setMessages(
                                    prev => [
                                        ...prev,
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


                        // Assistant transcript
                        if (
                            data.type ===
                            "response.output_audio_transcript.delta"
                        ) {

                            const delta =
                                data.delta || "";


                            setMessages(
                                prev => {

                                    const copy =
                                        [...prev];


                                    const last =
                                        copy[
                                            copy.length - 1
                                        ];


                                    if (
                                        last &&
                                        last.role ===
                                            "assistant"
                                    ) {

                                        copy[
                                            copy.length - 1
                                        ] = {

                                            ...last,

                                            content:
                                                last.content +
                                                delta

                                        };

                                    } else {

                                        copy.push({

                                            role:
                                                "assistant",

                                            content:
                                                delta

                                        });

                                    }


                                    return copy;

                                }
                            );

                        }


                        if (
                            data.type ===
                            "error"
                        ) {

                            console.error(
                                "Realtime error:",
                                data
                            );

                            setVoiceStatus(
                                "Voice error"
                            );

                        }

                    } catch (error) {

                        console.error(
                            error
                        );

                    }

                };


            // ---------------------------------------------
            // Create SDP offer
            // ---------------------------------------------

            const offer =
                await pc.createOffer();


            await pc.setLocalDescription(
                offer
            );


            // ---------------------------------------------
            // Send SDP to OpenAI
            // ---------------------------------------------

            const sdpResponse =
                await fetch(
                    "https://api.openai.com/v1/realtime/calls",
                    {

                        method: "POST",

                        headers: {

                            "Authorization":
                                `Bearer ${ephemeralKey}`,

                            "Content-Type":
                                "application/sdp"

                        },

                        body:
                            offer.sdp

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


            setIsListening(true);

            setVoiceStatus(
                "🎙️ Voice connected"
            );


        } catch (error) {

            console.error(
                "Voice error:",
                error
            );

            setVoiceStatus(
                "Voice connection failed"
            );

            alert(
                "Voice connection failed:\n\n" +
                error.message
            );

        }

    }


    // =====================================================
    // STOP VOICE
    // =====================================================

    function stopVoice() {

        const pc =
            peerConnectionRef.current;


        if (pc) {

            pc.close();

        }


        peerConnectionRef.current =
            null;


        if (
            audioElementRef.current
        ) {

            audioElementRef.current
                .remove();

            audioElementRef.current =
                null;

        }


        setIsListening(false);

        setVoiceStatus(
            "Voice disconnected"
        );

    }


    // =====================================================
    // NEW CHAT
    // =====================================================

    function newChat() {

        setMessages([]);

        setInput("");

        removeFile();

    }


    return (

        <main className="page">


            {/* HEADER */}

            <header className="header">

                <div className="brand">
                    GenAI-Labs
                </div>

                <div className="version">
                    V6
                </div>

            </header>


            {/* NEW CHAT */}

            <button
                className="newChat"
                onClick={newChat}
            >
                + New Chat
            </button>


            {/* CHAT */}

            <section className="chat">


                {messages.length === 0 && (

                    <div className="welcome">

                        <h2>
                            Hello! I'm
                            <strong>
                                {" "}GenAI-Labs V6.
                            </strong>
                        </h2>

                        <p>
                            You can chat normally,
                            search the web,
                            upload documents,
                            analyze images,
                            or talk to me using your voice.
                        </p>

                    </div>

                )}


                {messages.map(
                    (message, index) => (

                        <div
                            key={index}
                            className={
                                message.role ===
                                "user"
                                    ? "message user"
                                    : "message assistant"
                            }
                        >

                            {message.content}

                        </div>

                    )
                )}

            </section>


            {/* FILE PREVIEW */}

            {selectedFile && (

                <div className="filePreview">

                    <div>

                        {selectedFile.type.startsWith(
                            "image/"
                        ) ? (

                            <img
                                src={
                                    URL.createObjectURL(
                                        selectedFile
                                    )
                                }
                                alt=""
                            />

                        ) : (

                            <span className="fileIcon">
                                📄
                            </span>

                        )}

                    </div>


                    <div className="fileInfo">

                        <strong>
                            {selectedFile.name}
                        </strong>

                        <small>
                            {fileStatus}
                        </small>

                    </div>


                    <button
                        onClick={
                            removeFile
                        }
                    >
                        ×
                    </button>

                </div>

            )}


            {/* COMPOSER */}

            <div className="composer">


                <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="
                        image/jpeg,
                        image/png,
                        image/webp,
                        image/gif,
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


                {/* ATTACH */}

                <button
                    className="iconButton"
                    onClick={
                        openFilePicker
                    }
                    title="Attach image or document"
                >
                    📎
                </button>


                {/* VOICE */}

                <button
                    className={
                        isListening
                            ? "voiceButton active"
                            : "voiceButton"
                    }
                    onClick={
                        isListening
                            ? stopVoice
                            : startVoice
                    }
                    title={
                        isListening
                            ? "Stop voice"
                            : "Start voice"
                    }
                >
                    {isListening
                        ? "⏹"
                        : "🎙️"}
                </button>


                {/* INPUT */}

                <textarea
                    value={input}
                    onChange={
                        event =>
                            setInput(
                                event.target.value
                            )
                    }
                    onKeyDown={
                        event => {

                            if (
                                event.key ===
                                    "Enter" &&
                                !event.shiftKey
                            ) {

                                event.preventDefault();

                                sendMessage();

                            }

                        }
                    }
                    placeholder={
                        "Message GenAI-Labs..."
                    }
                />


                {/* SEND */}

                <button
                    className="sendButton"
                    onClick={
                        sendMessage
                    }
                >
                    ↑
                </button>

            </div>


            {/* VOICE STATUS */}

            {voiceStatus && (

                <div className="voiceStatus">

                    {voiceStatus}

                </div>

            )}

        </main>

    );

}