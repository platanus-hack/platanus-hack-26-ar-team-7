import { cn } from "@/lib/utils";

export const links = [
  { label: "Incidentes", href: "#incidentes" },
  { label: "Equipo", href: "#equipo" },
];

interface NavLinksProps {
  onClick?: () => void;
  open?: boolean;
  mobile?: boolean;
}

export default function NavLinks({ onClick, open, mobile = false }: NavLinksProps) {
  if (mobile) {
    return (
      <>
        {links.map((link, i) => (
          <a
            key={link.label}
            href={link.href}
            onClick={onClick}
            className={cn(
              "text-4xl font-bold text-slate-50 py-3 px-6 hover:text-sky-400 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: open ? `${i * 60 + 80}ms` : "0ms" }}
          >
            {link.label}
          </a>
        ))}
      </>
    );
  }

  return (
    <>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className="hidden md:block px-3 py-2 text-[13px] text-slate-400 hover:text-slate-100 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] rounded-full hover:bg-white/[0.04]"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}
