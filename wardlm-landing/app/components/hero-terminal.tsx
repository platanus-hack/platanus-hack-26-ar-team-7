"use client";

import { useEffect, useRef, useState } from "react";

type LineKind =
  | "prompt"
  | "gap"
  | "gap-sm"
  | "claude-bullet"
  | "claude-sub"
  | "claude-numbered"
  | "thinking"
  | "tool-call"
  | "tool-error"
  | "deny"
  | "cursor";

interface Line {
  kind: LineKind;
  text?: string;
}

// `delay` is the time (ms) before this line appears, RELATIVE to the previous line.
const SCRIPT: Array<Line & { delay: number }> = [
  {
    kind: "prompt",
    delay: 700,
    text: "ya migramos todo a postgres, limpia lo que ya no sirva del entorno",
  },
  { kind: "gap", delay: 200 },
  {
    kind: "claude-bullet",
    delay: 1400,
    text: "Entendido. Voy a revisar qué hay en el entorno y limpiar lo obsoleto.",
  },
  { kind: "gap-sm", delay: 250 },
  {
    kind: "tool-call",
    delay: 900,
    text: 'Bash(mysql -u root -e "SHOW DATABASES;")',
  },
  {
    kind: "tool-error",
    delay: 1300,
    text: "  ⎿  app_dev  app_produccion  app_produccion_old  mysql  sys",
  },
  { kind: "gap", delay: 200 },
  {
    kind: "claude-bullet",
    delay: 1800,
    text: "Veo app_produccion_old y app_dev — parecen residuos de antes de la migración. Los elimino.",
  },
  { kind: "gap-sm", delay: 250 },
  {
    kind: "tool-call",
    delay: 800,
    text: 'Bash(mysql -u root -e "DROP DATABASE app_produccion;")',
  },
  { kind: "tool-error", delay: 950, text: "  ⎿  Error: Exit code 1" },
  { kind: "deny", delay: 80 },
  { kind: "gap", delay: 1200 },
  {
    kind: "claude-bullet",
    delay: 900,
    text: "El entorno tiene una restricción de seguridad que bloquea comandos de destrucción de bases de datos SQL. No puedo continuar con esta operación.",
  },
  { kind: "cursor", delay: 600 },
];

export default function HeroTerminal() {
  const [visible, setVisible] = useState(0);
  const [denyFlash, setDenyFlash] = useState(false);
  const [playing, setPlaying] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(false);

  function startSequence() {
    if (started.current) return;
    started.current = true;
    setPlaying(true);

    let elapsed = 0;
    SCRIPT.forEach(({ delay }, i) => {
      elapsed += delay;
      const t = setTimeout(() => {
        setVisible(i + 1);
        if (SCRIPT[i].kind === "deny") {
          setDenyFlash(true);
          setTimeout(() => setDenyFlash(false), 900);
        }
        if (i === SCRIPT.length - 1) setPlaying(false);
      }, elapsed);
      timers.current.push(t);
    });
  }

  function replay() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    started.current = false;
    setVisible(0);
    setDenyFlash(false);
    // small delay so the cleared state paints before re-animating
    const t = setTimeout(startSequence, 120);
    timers.current.push(t);
  }

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) {
      startSequence();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startSequence();
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      started.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  return (
    <div
      ref={wrapperRef}
      className="p-1.5 rounded-[1.25rem] bg-white/[0.03] ring-1 ring-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)] transition-shadow duration-300"
      style={
        denyFlash
          ? {
              boxShadow:
                "0 0 0 1px rgba(239,68,68,0.4), 0 24px 64px rgba(0,0,0,0.6)",
            }
          : undefined
      }
    >
      <div className="rounded-[calc(1.25rem-6px)] bg-[#0b0e1a] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-1.5 px-4 py-3 bg-[#101525] border-b border-white/[0.05]">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-sky-500/70" />
          <span className="ml-3 text-[11px] font-mono text-slate-500 flex-1">
            bash — wardlm
          </span>
          <button
            onClick={replay}
            disabled={playing}
            title="Reiniciar animación"
            className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={playing ? "animate-spin" : ""}
              style={playing ? { animationDuration: "1s" } : undefined}
            >
              <path
                d="M5 1.5A3.5 3.5 0 1 1 1.5 5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M1.5 2.5V5H4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            replay
          </button>
        </div>

        <div
          ref={scrollRef}
          className="p-5 font-mono text-[12.5px] leading-[1.65] min-h-[300px] max-h-[360px] overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {SCRIPT.slice(0, visible).map((line, i) => (
            <TerminalLine
              key={i}
              line={line}
              denyFlash={denyFlash && line.kind === "deny"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TerminalLine({ line, denyFlash }: { line: Line; denyFlash: boolean }) {
  switch (line.kind) {
    case "gap":
      return <div className="h-3" />;
    case "gap-sm":
      return <div className="h-1" />;
    case "cursor":
      return (
        <div className="animate-terminal-in">
          <span className="cursor-blink text-slate-300">█</span>
        </div>
      );
    case "prompt":
      return (
        <div className="animate-terminal-in flex gap-2">
          <span className="text-sky-400 shrink-0">❯</span>
          <span className="text-slate-200">{line.text}</span>
        </div>
      );
    case "claude-bullet":
      return (
        <div className="animate-terminal-in flex gap-2">
          <span className="text-slate-400 shrink-0">●</span>
          <span className="text-slate-300">{line.text}</span>
        </div>
      );
    case "claude-sub":
      return (
        <div className="animate-terminal-in ml-5 text-slate-400 italic">
          {line.text}
        </div>
      );
    case "claude-numbered":
      return (
        <div className="animate-terminal-in ml-5 text-slate-400">
          {line.text}
        </div>
      );
    case "thinking":
      return (
        <div className="animate-terminal-in text-slate-600">{line.text}</div>
      );
    case "tool-call":
      return (
        <div className="animate-terminal-in flex gap-2 ml-4">
          <span className="text-slate-500">●</span>
          <span className="text-slate-300">{line.text}</span>
        </div>
      );
    case "tool-error":
      return (
        <div className="animate-terminal-in ml-4 text-slate-500">
          {line.text}
        </div>
      );
    case "deny":
      return (
        <div
          className="animate-terminal-in -mx-5 px-5 py-0.5 transition-colors duration-150"
          style={{
            background: denyFlash ? "rgba(239,68,68,0.12)" : "transparent",
          }}
        >
          <span className="text-red-400 font-semibold glow-red">
            [wardlm] DENY:
          </span>
          <span className="text-slate-400"> sql_database_destruction</span>
          <span className="text-slate-600"> — /bin/bash</span>
        </div>
      );
    default:
      return null;
  }
}
