import { ArrowDown } from "lucide-react";
import GithubIcon from "./icons/github";
import Button from "./button";
import HeroTerminal from "./hero-terminal";

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden grid-bg">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        <div className="absolute top-1/4 right-1/4 w-150 h-150 rounded-full bg-sky-400/[0.07] blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/3 w-125 h-125 rounded-full bg-indigo-600/[0.06] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-6 pt-28 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-[2.75rem] md:text-[3.5rem] lg:text-[3.8rem] font-bold tracking-[-0.03em] leading-[1.06] mb-6">
            Seguridad para agentes
            <br />en la capa del{" "}
            <span className="text-sky-400">sistema operativo.</span>
          </h1>

          <p className="text-slate-500 mb-10 leading-relaxed max-w-md text-[15px]">
            Wardlm te protege en cada proceso de tus agentes, a nivel kernel.
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

        <div className="relative">
          <HeroTerminal />

          <div className="absolute -bottom-3 -left-3 p-px rounded-lg bg-gradient-to-br from-red-500/30 to-transparent">
            <div className="bg-slate-950/90 backdrop-blur-sm rounded-[7px] px-3 py-1.5 text-[11px] font-mono ring-1 ring-red-500/20">
              <span className="text-red-400 font-bold">DENY</span>
              <span className="text-slate-500"> sql_database_destruction</span>
            </div>
          </div>
          <div className="absolute -top-3 -right-3 p-px rounded-lg bg-gradient-to-br from-sky-400/30 to-transparent">
            <div className="bg-slate-950/90 backdrop-blur-sm rounded-[7px] px-3 py-1.5 text-[11px] font-mono ring-1 ring-sky-400/20">
              <span className="text-sky-400">LLM judge</span>
              <span className="text-slate-500"> + kernel-level</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#07090f] to-transparent pointer-events-none" />
    </section>
  );
}
