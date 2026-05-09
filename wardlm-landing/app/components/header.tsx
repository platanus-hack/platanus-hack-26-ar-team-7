"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Menu, X, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import NavLinks from "./nav-links";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  /* lock body scroll when mobile menu open */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ── floating pill ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
        <nav
          className={cn(
            "pointer-events-auto flex items-center gap-1 px-2 h-11 rounded-full ring-1 ring-white/[0.08] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            scrolled
              ? "bg-slate-950/92 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
              : "bg-slate-950/55 backdrop-blur-lg"
          )}
        >
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 pl-1 pr-2">
            <Image
              src="/logo.png"
              alt="wardlm"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-mono text-[13px] font-semibold tracking-tight">
              <span className="text-sky-400">ward</span>
              <span className="text-slate-50">lm</span>
            </span>
          </a>

          {/* Divider */}
          <span className="hidden md:block w-px h-3 bg-indigo-900 mx-1" />

          {/* Desktop links */}
          <NavLinks />

          {/* CTA */}
          <a
            href="#install"
            className="hidden md:inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-sky-400 text-slate-950 text-[13px] font-semibold hover:bg-sky-300 active:scale-[0.97] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group"
          >
            Instalar
            <span className="w-5 h-5 rounded-full bg-black/[0.15] flex items-center justify-center group-hover:scale-110 group-hover:translate-x-px group-hover:-translate-y-px transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                <path
                  d="M3.5 1v4.5M1.5 3.5l2 2 2-2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>

          {/* Hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden w-10 h-8 flex items-center justify-center text-slate-300 hover:text-slate-100 transition-colors"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </div>

      {/* ── Mobile overlay ── */}
      <div
        className={cn(
          "fixed inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open
            ? "bg-slate-950/94 pointer-events-auto opacity-100"
            : "bg-slate-950/0 pointer-events-none opacity-0"
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <NavLinks mobile open={open} onClick={() => setOpen(false)} />

          <a
            href="#install"
            onClick={() => setOpen(false)}
            className={cn(
              "mt-6 inline-flex items-center gap-2 pl-5 pr-3 py-3 rounded-full bg-sky-400 text-slate-950 font-semibold hover:bg-sky-300 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: open ? "300ms" : "0ms" }}
          >
            Instalar
            <span className="w-7 h-7 rounded-full bg-black/[0.15] flex items-center justify-center">
              <ArrowDown size={10} />
            </span>
          </a>
        </div>
      </div>
    </>
  );
}
