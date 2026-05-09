export default function Footer() {
  return (
    <footer className="border-t border-blue-950/60 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="font-mono text-[13px] font-semibold mb-2 tracking-tight">
              <span className="text-sky-400">ward</span>
              <span className="text-slate-200">lm</span>
            </div>
            <p className="text-slate-600 text-[12px] mb-1">
              Defensa kernel-level para tu AI agent.
            </p>
            <p className="text-slate-700 text-[11px] font-mono">
              MIT licensed. No telemetry. Your machine, your rules.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href="https://github.com/platanus-hack/platanus-hack-26-ar-team-7#"
              className="text-[12px] text-slate-600 hover:text-slate-300 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Github
            </a>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-blue-950/60">
          <p className="text-slate-700 text-[11px] font-mono text-center tracking-wide">
            Hecho con C, kernel APIs, y desconfianza saludable.
          </p>
        </div>
      </div>
    </footer>
  );
}
