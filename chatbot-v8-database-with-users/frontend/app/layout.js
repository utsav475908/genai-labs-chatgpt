import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V8",
    description:
        "GenAI-Labs Login and User Management"
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