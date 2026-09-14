import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V9 — Visual, Interactive",
    description:
        "GenAI-Labs Visual and Interactive AI Workspace"
};

export default function RootLayout({
    children
}) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}