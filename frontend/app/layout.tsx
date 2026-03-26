import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Executive Meeting Assistant",
  description:
    "Autonomous AI agent that monitors email, negotiates meeting schedules, transcribes audio, and extracts action items.",
  keywords: ["AI", "meeting assistant", "scheduling", "LangGraph", "GPT-4"],
  authors: [{ name: "Team Anurag" }],
  openGraph: {
    title: "AI Executive Meeting Assistant",
    description:
      "Eliminates scheduling overhead, preserves deep focus time, and scales your bandwidth.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}