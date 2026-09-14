import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V11 — Advanced RAG Lab",
    description:
        "GenAI-Labs Advanced Retrieval-Augmented Generation Laboratory",
};

export default function RootLayout({
    children,
}) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}