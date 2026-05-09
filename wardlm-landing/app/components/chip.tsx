import { cn } from "@/lib/utils";

type ChipColor = "red" | "amber" | "sky" | "indigo";
type ChipSize = "sm" | "md";

const colorStyles: Record<ChipColor, string> = {
  red: "border-red-500/30 bg-red-500/[0.06] text-red-400 ring-red-500/30",
  amber: "border-amber-500/30 bg-amber-500/[0.06] text-amber-400 ring-amber-500/30",
  sky: "border-sky-400/30 bg-sky-400/[0.06] text-sky-400 ring-sky-400/30",
  indigo: "border-indigo-500/30 bg-indigo-500/[0.06] text-indigo-400 ring-indigo-500/30",
};

const sizeStyles: Record<ChipSize, string> = {
  sm: "px-2 py-0.5 text-[9px] gap-1 ring-1",
  md: "px-3 py-1 text-[10px] gap-2 border",
};

interface ChipProps {
  children: React.ReactNode;
  color?: ChipColor;
  size?: ChipSize;
  className?: string;
}

export default function Chip({
  children,
  color = "sky",
  size = "md",
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-mono font-semibold uppercase tracking-[0.18em] leading-none",
        colorStyles[color],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
