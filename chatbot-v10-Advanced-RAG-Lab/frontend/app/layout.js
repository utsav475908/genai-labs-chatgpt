import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V10 — AI Model Playground",
    description:
        "GenAI-Labs AI Model Playground",
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