import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V7",
    description: "GenAI-Labs Database and Persistent Memory AI"
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}