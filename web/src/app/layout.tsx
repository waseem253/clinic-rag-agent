import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Clinical RAG · HIPAA-aware AI",
  description: "Multi-agent RAG over CDC, USPSTF & NHLBI clinical guidelines. Voyage + Claude Sonnet 4.6 + LangGraph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body style={{ fontFamily: "var(--font-sans), Inter, -apple-system, system-ui, sans-serif" }} className="min-h-full">
        {children}
      </body>
    </html>
  );
}
