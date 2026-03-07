"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const milestones = [
  {
    year: "2009",
    title: "McDonald's closes in Iceland",
    description: "One customer buys the final burger and decides never to eat it.",
  },
  {
    year: "2009–2024",
    title: "The burger survives",
    description: "15+ years and it still hasn't decayed. Scientists are baffled. Displayed in museums. The internet goes wild.",
  },
  {
    year: "2024",
    title: "15 years later, still intact",
    description: "The idea is born: turn this legend into the world's biggest fundraiser.",
  },
  {
    year: "NOW",
    title: "You're here. The stream is LIVE.",
    description: "Every $10 puts YOUR photo on the live stream for the world to see.",
    isCurrent: true,
  },
];

const Story = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  return (
    <section ref={ref} id="story" className="py-12 md:py-16 px-4 bg-background relative overflow-hidden">
      {/* Parallax decorative blobs */}
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [60, -60]) }}
        className="absolute -top-20 -right-20 w-[350px] h-[350px] rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-full h-full" style={{ background: "hsl(var(--gold) / 0.06)" }} />
      </motion.div>
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [-40, 40]) }}
        className="absolute -bottom-20 -left-20 w-[250px] h-[250px] rounded-full blur-[120px] pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-full h-full" style={{ background: "hsl(var(--mcred) / 0.04)" }} />
      </motion.div>
      <div className="container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-3">
            THE STORY
          </h2>
          <p className="text-muted-foreground text-lg">How a burger became a legend</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line - thicker gold with glow */}
          <div
            className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[2px]"
            style={{
              background: "linear-gradient(to bottom, hsl(var(--gold) / 0.6), hsl(var(--gold) / 0.3), hsl(var(--mcred) / 0.6))",
              boxShadow: "0 0 8px hsl(var(--gold) / 0.3)",
            }}
          />

          {milestones.map((m, i) => {
            const isRight = i % 2 === 1;
            return (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: isRight ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className={`relative flex items-start gap-4 mb-8 md:mb-10 ${
                  isRight ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Dot on timeline - bigger with glow */}
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      m.isCurrent
                        ? "bg-accent live-dot"
                        : "bg-primary"
                    }`}
                    style={!m.isCurrent ? { boxShadow: "0 0 10px hsl(var(--gold) / 0.5)" } : undefined}
                  />
                </div>

                {/* Content card */}
                <div className={`ml-14 md:ml-0 md:w-[calc(50%-2rem)] ${isRight ? "md:mr-auto md:pr-8 md:text-right" : "md:ml-auto md:pl-8"}`}>
                  <span
                    className={`font-mono-num text-xs font-bold uppercase tracking-widest ${
                      m.isCurrent ? "text-accent" : "text-primary"
                    }`}
                  >
                    {m.year}
                  </span>
                  <h3 className="font-display text-xl md:text-2xl text-foreground mt-1 mb-2 normal-case">
                    {m.title}
                  </h3>
                  <p className="text-foreground/80 text-sm leading-relaxed">
                    {m.description}
                  </p>
                  {m.isCurrent && (
                    <a
                      href="#support"
                      className="inline-flex items-center gap-1 text-accent font-semibold text-sm mt-3 hover:underline transition-all"
                    >
                      Get your photo on stream →
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Story;
