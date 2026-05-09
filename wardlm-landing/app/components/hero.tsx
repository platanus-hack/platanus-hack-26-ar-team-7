import { ArrowDown } from "lucide-react";
import GithubIcon from "./icons/github";
import Button from "./button";

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden grid-bg">
      {/* Orbs */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        <div className="absolute top-1/4 right-1/4 w-150 h-150 rounded-full bg-sky-400/[0.07] blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/3 w-125 h-125 rounded-full bg-indigo-600/[0.06] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-6 pt-28 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div>
          <h1 className="text-[2.75rem] md:text-[3.5rem] lg:text-[3.8rem] font-bold tracking-[-0.03em] leading-[1.06] mb-6">
            Dale más autonomía
            <br />a tu <span className="text-sky-400">agente.</span>
          </h1>

          <p className="text-slate-500 mb-10 leading-relaxed max-w-md text-[15px]">
            Wardlm sandboxea cada proceso de tu AI agent a nivel kernel — LLM
            judge y log completo.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button href="#install" icon={<ArrowDown size={10} />}>
              Descargar
            </Button>
            <Button
              variant="ghost"
              href="https://github.com/platanus-hack/platanus-hack-26-ar-team-7"
            >
              <GithubIcon size={14} />
              GitHub
            </Button>
          </div>
        </div>

        {/* Terminal */}
        <div className="relative">
          <div className="p-1.5 rounded-[1.25rem] bg-white/[0.03] ring-1 ring-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
            <div className="rounded-[calc(1.25rem-6px)] bg-[#0b0e1a] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-[#101525] border-b border-white/[0.05]">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-sky-500/70" />
                <span className="ml-3 text-[11px] font-mono text-slate-500">
                  bash — wardlm
                </span>
              </div>
              <div className="p-5 font-mono text-[13px] leading-6 min-h-[270px]">
                <div className="terminal-line">
                  <span className="text-sky-400">$</span>{" "}
                  <span className="text-slate-100">wardlm run -- claude</span>
                </div>
                <div className="terminal-line h-4" />
                <div className="terminal-line">
                  <span className="text-slate-500">claude </span>
                  <span className="text-slate-600">›</span>
                  <span className="text-slate-300">
                    {" "}
                    Voy a limpiar el proyecto...
                  </span>
                </div>
                <div className="terminal-line">
                  <span className="text-slate-500">claude </span>
                  <span className="text-slate-600">›</span>
                  <span className="text-slate-300"> Ejecutando: </span>
                  <span className="text-slate-100">rm -rf ~/proyecto</span>
                </div>
                <div className="terminal-line h-3" />
                <div className="blocked-line -mx-5 px-5 py-0.5">
                  <span className="text-red-400 font-semibold glow-red">
                    [wardlm] ⚠ BLOCKED
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    · execve(&quot;rm&quot;, &quot;-rf&quot;,
                    &quot;~/proyecto&quot;)
                  </span>
                </div>
                <div className="terminal-line">
                  <span className="text-slate-600">[wardlm] Verdict: </span>
                  <span className="text-red-400">dangerous</span>
                  <span className="text-slate-500"> 300ms</span>
                </div>
                <div className="terminal-line">
                  <span className="cursor-blink text-slate-300">█</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-3 -left-3 p-px rounded-lg bg-gradient-to-br from-red-500/30 to-transparent">
            <div className="bg-slate-950/90 backdrop-blur-sm rounded-[7px] px-3 py-1.5 text-[11px] font-mono ring-1 ring-red-500/20">
              <span className="text-red-400 font-bold">BLOCKED</span>
              <span className="text-slate-500"> en ~300ms</span>
            </div>
          </div>
          <div className="absolute -top-3 -right-3 p-px rounded-lg bg-gradient-to-br from-sky-400/30 to-transparent">
            <div className="bg-slate-950/90 backdrop-blur-sm rounded-[7px] px-3 py-1.5 text-[11px] font-mono ring-1 ring-sky-400/20">
              <span className="text-sky-400">seccomp</span>
              <span className="text-slate-500"> kernel-level</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#07090f] to-transparent pointer-events-none" />
    </section>
  );
}
