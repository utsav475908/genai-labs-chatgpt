import "./globals.css";

export const metadata = {
  title: "GenAI-Labs V12 — Multimodal AI Lab",
  description: "Cross-modal reasoning, multimodal RAG, vision and voice experiments",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
