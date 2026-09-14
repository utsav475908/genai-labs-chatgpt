import "./globals.css";

export const metadata = {
    title: "GenAI-Labs V6",
    description: "GenAI-Labs Voice AI"
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