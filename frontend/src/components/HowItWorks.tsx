"use client";
import { motion } from "framer-motion";
import { Camera, Upload, Tv } from "lucide-react";

const steps = [
  {
    icon: Camera,
    step: "01",
    title: "Choose Your Package",
    description: "Pick Standard ($10) or Premium ($25) — premium gets you 30 seconds on stream with a gold badge.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Upload Your Photo",
    description: "Drop in any photo you want the world to see. Family-friendly content only — AI moderation keeps it clean.",
  },
  {
    icon: Tv,
    step: "03",
    title: "Watch It Live",
    description: "Your photo appears on the YouTube live stream for thousands to see. You'll get a screenshot keepsake too.",
  },
];

const HowItWorks = () => {
  return (
    <section className="how-it-works-section py-12 md:py-16 px-4 relative overflow-hidden">
      {/* Warm decorative accent blobs for light mode */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[160px] dark:hidden" style={{ background: "hsl(38 100% 50% / 0.05)" }} />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[140px] dark:hidden" style={{ background: "hsl(5 87% 48% / 0.03)" }} />
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-3">
            HOW IT WORKS
          </h2>
          <p className="text-muted-foreground text-lg">Three simple steps to internet fame</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="glass-card rounded-2xl p-6 text-center relative group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              {/* Step number watermark */}
              <span className="absolute top-4 right-5 font-mono-num text-5xl font-bold text-foreground/[0.04] select-none">
                {s.step}
              </span>

              {/* Connector line (not on last) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-[2px] bg-gradient-to-r from-primary/40 to-transparent" />
              )}

              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <s.icon className="text-primary" size={26} />
              </div>

              <h3 className="font-display text-xl text-foreground mb-2 normal-case">{s.title}</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">{s.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <a href="#support" className="btn-red !rounded-lg inline-flex items-center gap-2">
            🍔 Get Started — $10
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;