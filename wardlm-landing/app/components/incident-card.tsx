import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Chip from "./chip";

type IncidentColor = "red" | "amber";

interface IncidentCardProps {
  inc: string;
  date: string;
  agent: string;
  cmd: string;
  desc: string;
  source: string;
  sourceUrl: string;
  severity: string;
  color: IncidentColor;
}

export default function IncidentCard({
  inc,
  date,
  agent,
  cmd,
  desc,
  source,
  sourceUrl,
  severity,
  color,
}: IncidentCardProps) {
  const isRed = color === "red";

  return (
    <div
      className={cn(
        "group p-px rounded-2xl bg-gradient-to-b to-transparent hover:from-opacity-60 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        isRed ? "from-red-900/30" : "from-amber-900/20"
      )}
    >
      <div className="rounded-[calc(1rem-1px)] bg-[#0b0e1a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] h-full flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] text-slate-700 tracking-widest">
              {inc}
            </span>
            <span className="w-px h-2.5 bg-indigo-900/80" />
            <span className="font-mono text-[10px] text-slate-600">{date}</span>
          </div>
          <Chip color={color} size="sm">
            {severity}
          </Chip>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-600">
          {agent}
        </div>

        <code
          className={cn(
            "font-mono text-[13px] font-semibold break-all leading-snug",
            isRed ? "text-red-300" : "text-amber-300"
          )}
        >
          {cmd}
        </code>

        <p className="text-slate-400 text-[13px] leading-relaxed flex-1">
          {desc}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-indigo-900/40">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-700 hover:text-slate-400 transition-colors"
          >
            <ExternalLink size={10} />
            {source}
          </a>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-400/[0.06] ring-1 ring-sky-400/15">
            <Image
              src="/logo.png"
              alt=""
              width={10}
              height={10}
              className="rounded-sm opacity-70"
            />
            <span className="font-mono text-[9px] text-sky-400">bloqueado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
