import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Clock, Flame } from "lucide-react";

const DEFAULT_DATE = "2026-06-15T00:00:00Z";

function parseDrawDate(drawDate?: string): Date {
  if (!drawDate || !drawDate.trim()) return new Date(DEFAULT_DATE);
  // Handle YYYY-MM-DD, YYYY-MM-DDTHH:MM, or full ISO
  const raw = drawDate.includes("T") ? drawDate : drawDate + "T00:00:00";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(DEFAULT_DATE) : d;
}

function getTimeLeft(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  drawDate?: string;
}

const CountdownTimer = ({ drawDate }: CountdownTimerProps) => {
  const finalTarget = parseDrawDate(drawDate);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(finalTarget));

  useEffect(() => {
    setTimeLeft(getTimeLeft(finalTarget));
    const interval = setInterval(() => setTimeLeft(getTimeLeft(finalTarget)), 1000);
    return () => clearInterval(interval);
  }, [drawDate]);

  const displayDate = finalTarget.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section ref={sectionRef} className="countdown-section py-12 md:py-16 px-4 relative overflow-hidden">
      {/* Ambient glow — parallax */}
      <motion.div
        style={{ y: glowY }}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="w-full h-full" style={{ background: "radial-gradient(ellipse at center, hsl(5 87% 48% / 0.04) 0%, transparent 70%)" }} />
      </motion.div>
      {/* Warm accent for light mode — parallax */}
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [-40, 40]) }}
        className="absolute inset-0 dark:hidden pointer-events-none"
      >
        <div className="w-full h-full" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 30%, hsl(38 100% 50% / 0.06) 0%, transparent 70%)" }} />
      </motion.div>

      <div className="container mx-auto max-w-3xl relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-accent/15 text-accent px-4 py-1.5 rounded-full text-xs font-bold uppercase mb-5">
            <Flame size={14} /> Grand Prize Draw
          </div>

          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-white mb-2">
            THE COUNTDOWN IS ON
          </h2>
          <p className="text-white/70 text-sm sm:text-base mb-8 max-w-md mx-auto">
            One lucky supporter will take the historic first bite — live on stream. Don't miss it.
          </p>

          {/* Timer digits */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8">
            {units.map((u, i) => (
              <div key={u.label} className="flex items-center gap-3 sm:gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="cd-card rounded-xl sm:rounded-2xl w-16 sm:w-20 md:w-24 py-3 sm:py-4 text-center border backdrop-blur-sm"
                >
                  <span className="font-mono-num text-2xl sm:text-3xl md:text-4xl font-bold text-white block leading-none">
                    {String(u.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/60 uppercase tracking-widest mt-1 block">
                    {u.label}
                  </span>
                </motion.div>
                {i < units.length - 1 && (
                  <span className="text-white/30 font-mono-num text-xl sm:text-2xl font-bold select-none">:</span>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <a href="#support" className="btn-red !rounded-lg inline-flex items-center gap-2 animate-pulse-red">
              🍔 Enter Now — Every $10 = 1 Entry
            </a>
            <p className="text-xs text-white/50 mt-3">
              <Clock size={12} className="inline mr-1" />
              Drawing live on stream • {displayDate}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CountdownTimer;
