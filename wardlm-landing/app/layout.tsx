import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "wardlm",
  description:
    "Wrapper en C con seccomp. Bloquea comandos peligrosos ejecutados por agentes antes de que lleguen al sistema. Compatible con Claude Code, openclaw, Codex, Cursor, Aider.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn(geistSans.variable, geistMono.variable, "h-full")}
    >
      <body className="min-h-full bg-[#07090f] text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
