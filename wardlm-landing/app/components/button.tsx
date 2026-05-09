import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost";

interface ButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  as?: "a" | "button";
  onClick?: () => void;
}

const base =
  "inline-flex items-center gap-2 rounded-full font-semibold text-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "group pl-5 pr-2 py-2 bg-sky-400 text-slate-950 hover:bg-sky-300 active:scale-[0.97]",
  ghost:
    "px-5 py-2 ring-1 ring-indigo-900 text-slate-300 hover:ring-blue-800 hover:text-slate-100",
};

export default function Button({
  variant = "primary",
  icon,
  children,
  className,
  as,
  onClick,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], className);

  const content = (
    <>
      {children}
      {icon && (
        <span className="w-7 h-7 rounded-full bg-black/[0.14] flex items-center justify-center group-hover:scale-110 group-hover:translate-x-px group-hover:-translate-y-px transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
          {icon}
        </span>
      )}
    </>
  );

  if (as === "button") {
    return (
      <button className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <a className={classes} {...props}>
      {content}
    </a>
  );
}
