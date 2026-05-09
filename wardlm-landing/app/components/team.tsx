import Image from "next/image";
import LinkedinIcon from "./icons/linkedin";
import ScrollReveal from "./scroll-reveal";
import Chip from "./chip";

const members = [
  {
    name: "Daniel Salmun",
    title: "Founding Engineer @ Gullie",
    image: "/salmun.jpeg",
    linkedin: "https://www.linkedin.com/in/daniel-salmun/",
  },
  {
    name: "Gianfranco Bogetti",
    title: "Sr. AI/ML Engineer @ Nivii",
    image: "/gian.jpeg",
    linkedin: "https://www.linkedin.com/in/gianfranco-bogetti/",
  },
  {
    name: "Franco Sanchez",
    title: "Sr. Fullstack Engineer @ Nivii",
    image: "/franco.jpeg",
    linkedin: "https://linkedin.com/in/francogabriel92/",
  },
];

export default function Team() {
  return (
    <section id="equipo" className="relative py-32 border-t border-blue-950/60 overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 rounded-full bg-sky-400/[0.03] blur-[160px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <ScrollReveal>
          <div className="mb-16">
            <Chip color="sky" className="mb-6">
              Equipo
            </Chip>
            <h2 className="text-[2.2rem] md:text-[2.8rem] font-bold tracking-[-0.025em] leading-[1.1]">
              Las personas detrás
              <br />
              <span className="text-sky-400">de wardlm.</span>
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal stagger delay={80}>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
            {members.map((member) => (
              <div
                key={member.name}
                className="group p-px rounded-2xl bg-gradient-to-b from-indigo-900/30 to-transparent transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:from-sky-900/30"
              >
                <div className="rounded-[calc(1rem-1px)] bg-[#0b0e1a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-4 h-full">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden ring-1 ring-white/[0.08]">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-slate-100 font-semibold text-[14px] leading-snug">
                      {member.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">
                      {member.title}
                    </p>
                  </div>

                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-slate-500 hover:text-sky-400 transition-colors duration-300 w-fit mt-auto"
                  >
                    <LinkedinIcon size={13} />
                    <span className="font-mono text-[10px]">LinkedIn</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
