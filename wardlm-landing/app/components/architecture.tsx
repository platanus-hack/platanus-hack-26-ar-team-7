"use client";

import ScrollReveal from "./scroll-reveal";
import Chip from "./chip";
import { cn } from "@/lib/utils";

type StepTone = "sky" | "indigo";

const agents = [
  { name: "Claude Code", icon: "/icons/claude-color.svg" },
  { name: "Codex", icon: "/icons/codex-color.svg" },
  { name: "Cursor", icon: "/icons/cursor.svg" },
  { name: "GitHub Copilot", icon: "/icons/copilot-color.svg" },
  { name: "Gemini CLI", icon: "/icons/geminicli-color.svg" },
  { name: "openclaw", icon: "/icons/openclaw-color.svg" },
  { name: "opencode", icon: "/icons/opencode.svg" },
];

function StepBadge({ n, tone = "sky" }: { n: number; tone?: StepTone }) {
  const styles =
    tone === "sky"
      ? "text-sky-400 ring-sky-400/30 bg-sky-400/[0.08]"
      : "text-indigo-300 ring-indigo-400/30 bg-indigo-400/[0.08]";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full ring-1 font-mono text-[10px] font-bold",
        styles,
      )}
    >
      {n}
    </span>
  );
}

interface DiagramCardProps {
  label: string;
  title: string;
  desc?: string;
  icon?: string;
  iconAlt?: string;
  accent?: "sky" | "indigo" | "slate";
  highlight?: boolean;
  className?: string;
}

function DiagramCard({
  label,
  title,
  desc,
  icon,
  iconAlt,
  accent = "sky",
  highlight = false,
  className,
}: DiagramCardProps) {
  const accentClass =
    accent === "sky"
      ? "text-sky-400"
      : accent === "indigo"
        ? "text-indigo-300"
        : "text-slate-400";
  return (
    <div
      className={cn(
        "relative p-px rounded-2xl bg-gradient-to-br",
        highlight
          ? "from-sky-400/40 via-sky-400/10 to-white/[0.02]"
          : "from-white/[0.10] via-white/[0.04] to-white/[0.02]",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[calc(1rem-1px)] bg-[#0b0e1a] ring-1 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          highlight ? "ring-sky-400/15" : "ring-white/[0.05]",
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <span
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase tracking-[0.2em]",
                  accentClass,
                )}
              >
                {label}
              </span>
            </div>
            <h3 className="text-slate-100 font-semibold text-[15px] leading-tight mb-1">
              {title}
            </h3>
            {desc && (
              <p className="text-slate-500 text-[12.5px] leading-relaxed">
                {desc}
              </p>
            )}
          </div>
          {icon && (
            <div className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={icon}
                alt={iconAlt ?? ""}
                width={24}
                height={24}
                className="w-6 h-6 object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FlowStep {
  n: number;
  label: string;
  sub?: React.ReactNode;
  tone?: StepTone;
}

function VerticalFlow({
  steps,
  direction = "down",
}: {
  steps: FlowStep[];
  direction?: "down" | "up";
}) {
  const Arrowhead = (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      className="text-sky-400/60"
      aria-hidden
    >
      <path
        d={direction === "down" ? "M0 0 L5 6 L10 0 Z" : "M5 0 L0 6 L10 6 Z"}
        fill="currentColor"
      />
    </svg>
  );

  const Line = (
    <div
      aria-hidden
      className="w-px h-3.5 bg-[repeating-linear-gradient(to_bottom,rgba(56,189,248,0.45)_0_3px,transparent_3px_6px)]"
    />
  );

  return (
    <div className="relative flex justify-center py-2">
      <div className="flex flex-col items-center gap-1.5">
        {direction === "up" && Arrowhead}
        {Line}
        <div className="flex flex-col gap-1.5 items-start py-0.5">
          {steps.map((s) => (
            <div
              key={s.n}
              className="flex items-center gap-2 font-mono text-[11px] text-slate-400 whitespace-nowrap"
            >
              <StepBadge n={s.n} tone={s.tone ?? "sky"} />
              <span>{s.label}</span>
              {s.sub && <span className="text-slate-600">·</span>}
              {s.sub}
            </div>
          ))}
        </div>
        {Line}
        {direction === "down" && Arrowhead}
      </div>
    </div>
  );
}

function HorizontalFlow({ step }: { step: FlowStep }) {
  return (
    <div className="hidden md:flex flex-col items-center justify-center gap-1.5 px-2 self-stretch">
      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">
        <StepBadge n={step.n} tone={step.tone ?? "indigo"} />
        <span>{step.label}</span>
      </div>
      <div className="flex items-center" aria-hidden>
        <div className="w-12 h-px bg-[repeating-linear-gradient(to_right,rgba(56,189,248,0.45)_0_3px,transparent_3px_6px)]" />
        <svg
          width="6"
          height="10"
          viewBox="0 0 6 10"
          className="text-sky-400/60"
        >
          <path d="M0 0 L6 5 L0 10 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export default function Architecture() {
  return (
    <section
      id="arquitectura"
      className="relative py-32 border-t border-blue-950/60 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 rounded-full bg-sky-400/[0.05] blur-[140px]" />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-indigo-600/[0.04] blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <ScrollReveal>
          <div className="mb-16">
            <Chip color="indigo" className="mb-6">
              Arquitectura
            </Chip>
            <h2 className="text-[2.2rem] md:text-[2.8rem] font-bold tracking-[-0.025em] leading-[1.1]">
              Cada syscall,
              <br />
              <span className="text-sky-400">interceptado en el kernel.</span>
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap justify-center items-center gap-3">
              {agents.map(({ name, icon }) => (
                <div
                  key={name}
                  title={name}
                  aria-label={name}
                  className="w-11 h-11 grid place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] hover:ring-white/[0.14] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon}
                    alt={name}
                    width={22}
                    height={22}
                    className="w-[22px] h-[22px]"
                  />
                </div>
              ))}
              <div
                aria-hidden
                className="px-3 h-11 grid place-items-center rounded-xl bg-white/[0.02] ring-1 ring-white/[0.04] font-mono text-[14px] tracking-[0.18em] text-slate-600"
              >
                ···
              </div>
            </div>

            <div className="hidden md:flex justify-center gap-12">
              <VerticalFlow
                direction="down"
                steps={[{ n: 1, label: "execve('/bin/bash', 'rm -rf /')" }]}
              />
              <VerticalFlow
                direction="up"
                steps={[
                  {
                    n: 5,
                    label: "execve() resume",
                    tone: "indigo",
                    sub: (
                      <span className="flex items-center gap-1.5">
                        <span className="text-emerald-400">aprobado</span>
                        <span className="text-slate-700">|</span>
                        <span className="text-red-400">-EACCES</span>
                      </span>
                    ),
                  },
                ]}
              />
            </div>
            <div className="md:hidden">
              <VerticalFlow
                steps={[
                  { n: 1, label: "execve('/bin/bash', 'rm -rf /')" },
                  {
                    n: 5,
                    label: "execve() resume",
                    tone: "indigo",
                    sub: (
                      <span className="flex items-center gap-1.5">
                        <span className="text-emerald-400">aprobado</span>
                        <span className="text-slate-700">|</span>
                        <span className="text-red-400">-EACCES</span>
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            <DiagramCard
              label="Linux Kernel"
              title="seccomp · BPF filter"
              desc="Filtro aplicado solo a procesos del agente. Cada syscall execve queda suspendido a la espera de veredicto."
              accent="sky"
              icon="/icons/tux.svg"
              iconAlt="Linux"
            />

            <div className="grid md:grid-cols-2 md:gap-x-8 md:items-center">
              <div className="hidden md:flex justify-center gap-12 md:-mb-3">
                <VerticalFlow
                  direction="down"
                  steps={[{ n: 2, label: "SECCOMP_RET_USER_NOTIF" }]}
                />
                <VerticalFlow
                  direction="up"
                  steps={[
                    {
                      n: 4,
                      label: "NOTIF_SEND",
                      tone: "indigo",
                      sub: (
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400">CONTINUE</span>
                          <span className="text-slate-700">|</span>
                          <span className="text-red-400">-EACCES</span>
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

              <div className="md:hidden">
                <VerticalFlow
                  steps={[
                    { n: 2, label: "SECCOMP_RET_USER_NOTIF" },
                    {
                      n: 4,
                      label: "NOTIF_SEND",
                      tone: "indigo",
                      sub: (
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400">CONTINUE</span>
                          <span className="text-slate-700">|</span>
                          <span className="text-red-400">-EACCES</span>
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

              <div aria-hidden className="hidden md:block" />

              <div className="md:max-w-sm w-full md:justify-self-stretch">
                <DiagramCard
                  label="wardlm · userspace"
                  title="LLM judge — approve/deny"
                  desc="Clasificador binario por cada execve. ~300ms de overhead."
                  accent="sky"
                  highlight
                  icon="/logo.png"
                  iconAlt="wardlm"
                />
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-stretch gap-3 md:gap-0">
                <div className="md:hidden">
                  <VerticalFlow
                    steps={[{ n: 3, label: "/var/log/wardlm", tone: "indigo" }]}
                  />
                </div>
                <HorizontalFlow
                  step={{ n: 3, label: "/var/log/wardlm", tone: "indigo" }}
                />
                <div className="w-full md:flex-1 md:flex md:items-center">
                  <DiagramCard
                    label="Electron"
                    title="Log + Auditoría"
                    desc="Cada decisión registrada para auditoría y revisión posterior."
                    accent="indigo"
                    icon="/icons/electron.svg"
                    iconAlt="Electron"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
