"use client";

import { useState } from "react";
import { Copy, Check, ArrowDown } from "lucide-react";
import GithubIcon from "./icons/github";
import { cn } from "@/lib/utils";
import Chip from "./chip";
import Button from "./button";

const INSTALL_CMD = "curl -fsSL https://wardlm.vercel.app/install.sh | bash";
const GITHUB_URL =
  "https://github.com/platanus-hack/platanus-hack-26-ar-team-7";

export default function Install() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      id="install"
      className="relative py-32 border-t border-blue-950/60 overflow-hidden grid-bg"
    >
      {/* Orbs */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
      >
        <div className="w-150 h-150 rounded-full bg-sky-400/[0.07] blur-[150px]" />
        <div className="absolute left-1/4 top-1/3 w-100 h-100 rounded-full bg-indigo-600/[0.05] blur-[120px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 text-center">
        {/* Eyebrow */}
        <Chip color="sky" className="mb-10">
          MIT · Sin telemetría · Linux kernel 5.0+
        </Chip>

        <h2 className="text-[3rem] md:text-[4.5rem] font-bold tracking-[-0.035em] leading-[1.04] mb-6">
          Instalá
          <br />
          <span className="text-sky-400">wardlm.</span>
        </h2>

        <p className="text-slate-500 text-[15px] mb-12 leading-relaxed">
          Un comando. Sin dependencias de cloud.
          <br />
          Tu AI agent, contenido a nivel kernel.
        </p>

        {/* Install command — double-bezel */}
        <div className="p-px rounded-2xl bg-gradient-to-b from-sky-400/25 to-indigo-900/20 mb-3">
          <div className="flex items-center rounded-[calc(1rem-1px)] bg-[#0d1020] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">
            <div className="flex items-center gap-3 flex-1 px-5 py-4 min-w-0">
              <span className="text-sky-400 font-mono text-[13px] flex-shrink-0">
                $
              </span>
              <code className="font-mono text-[13px] text-slate-300 truncate">
                {INSTALL_CMD}
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 w-12 h-full flex items-center justify-center border-l border-blue-950 text-slate-500 hover:text-slate-100 hover:bg-blue-950/60 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95"
              aria-label="Copiar comando"
            >
              {copied ? (
                <Check size={14} className="text-sky-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>

        <p
          className={cn(
            "font-mono text-[11px] mb-10 h-4 transition-all duration-300",
            copied ? "text-sky-400 opacity-100" : "opacity-0",
          )}
        >
          Copiado al portapapeles
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            as="button"
            onClick={handleCopy}
            icon={<ArrowDown size={10} />}
          >
            Descargar
          </Button>
          <Button
            variant="ghost"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon size={14} className="text-slate-400" />
            GitHub
          </Button>
        </div>
      </div>
    </section>
  );
}
