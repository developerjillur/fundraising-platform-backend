import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Play } from "lucide-react";
import heroBurger from "@/assets/hero-burger.jpg";
import { api, API_URL } from "@/lib/api-client";

interface HeroProps {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
}

const Hero = ({ headline, subheadline, ctaText }: HeroProps) => {
  const displayCta = ctaText || "Get Your Photo On Stream — $10";
  const lines = ["THE LAST McDONALD'S", "BURGER IN ICELAND"];

  const [viewerCount, setViewerCount] = useState(0);
  const [photosDisplayed, setPhotosDisplayed] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get("/fundraising/stats");
        if (data) {
          setViewerCount(data.current_viewer_count ?? 0);
          setPhotosDisplayed(data.photos_displayed ?? 0);
        }
      } catch (e) {
        console.error("Failed to load hero stats", e);
      }
    };
    load();

    const es = new EventSource(`${API_URL}/fundraising/stream`);
    es.addEventListener("stats-update", (e) => {
      const d = JSON.parse(e.data);
      setViewerCount(d.current_viewer_count ?? 0);
      setPhotosDisplayed(d.photos_displayed ?? 0);
    });
    return () => { es.close(); };
  }, []);

  const particles = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 4,
      drift: Math.random() * 60 - 30,
      opacity: Math.random() * 0.5 + 0.15,
    })), []);

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <motion.img
          src={heroBurger}
          alt="The Last McDonald's Burger preserved under glass"
          className="w-full h-full object-cover opacity-60 dark:opacity-60"
          style={{ filter: "saturate(1.4) contrast(1.1) brightness(1.05)", y: imgY, scale: imgScale }}
          loading="eager"
        />
        {/* Dark cinematic overlay — stronger in light mode for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/[0.92] dark:from-background/95 via-background/50 dark:via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 dark:from-background/80 via-transparent to-background/70 dark:to-background/80" />
        {/* Warm radial accent in light mode */}
        <div className="absolute inset-0 dark:hidden" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, hsl(38 100% 50% / 0.08) 0%, transparent 70%)" }} />

        {/* Glass dome glow layers */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            className="absolute -inset-20 rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--gold) / 0.2) 0%, hsl(var(--gold) / 0.05) 50%, transparent 70%)",
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.04, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }}
            className="w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--gold) / 0.12) 0%, hsl(var(--gold) / 0.06) 40%, transparent 65%)",
            }}
          />
          <motion.div
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--gold-light) / 0.18) 0%, hsl(var(--gold) / 0.06) 50%, transparent 70%)",
            }}
          />
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-primary/60"
              style={{
                width: p.size,
                height: p.size,
                top: `calc(50% + ${p.y}px)`,
                left: `calc(50% + ${p.x}px)`,
              }}
              animate={{
                y: [0, -p.drift, 0],
                x: [0, p.drift * 0.5, 0],
                opacity: [0, p.opacity, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                repeat: Infinity,
                duration: p.duration,
                delay: p.delay,
                ease: "easeInOut",
              }}
            />
          ))}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] rounded-full opacity-20"
            style={{
              background: "conic-gradient(from 200deg, transparent 0%, hsl(var(--foreground) / 0.15) 15%, transparent 30%, transparent 100%)",
            }}
          />
        </div>

        {/* Subtle red accent glow bottom */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-accent/5 rounded-full blur-[100px]" />

        {/* Drifting fog / mist layers */}
        <div className="absolute bottom-0 left-0 right-0 h-[220px] overflow-hidden pointer-events-none">
          <motion.div
            animate={{ x: ["-10%", "10%", "-10%"] }}
            transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
            className="absolute -bottom-4 -left-[20%] w-[140%] h-[180px] opacity-[0.07]"
            style={{
              background: "radial-gradient(ellipse 80% 100% at 30% 100%, hsl(var(--foreground)) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <motion.div
            animate={{ x: ["8%", "-12%", "8%"] }}
            transition={{ repeat: Infinity, duration: 26, ease: "easeInOut", delay: 3 }}
            className="absolute -bottom-2 -left-[15%] w-[130%] h-[140px] opacity-[0.05]"
            style={{
              background: "radial-gradient(ellipse 70% 100% at 65% 100%, hsl(var(--gold)) 0%, transparent 65%)",
              filter: "blur(40px)",
            }}
          />
          <motion.div
            animate={{ x: ["-5%", "15%", "-5%"] }}
            transition={{ repeat: Infinity, duration: 16, ease: "easeInOut", delay: 6 }}
            className="absolute -bottom-6 -left-[10%] w-[120%] h-[100px] opacity-[0.04]"
            style={{
              background: "radial-gradient(ellipse 60% 100% at 50% 100%, hsl(var(--foreground)) 0%, transparent 60%)",
              filter: "blur(50px)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-20">
        {/* Pre-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="text-primary font-semibold tracking-[0.3em] uppercase text-xs sm:text-sm mb-6"
        >
          ✨ THE WORLD'S MOST FAMOUS FUNDRAISER ✨
        </motion.p>

        {/* Staggered headline */}
        <h1 className="font-display leading-[0.9] mb-6 text-center">
          {lines.map((line, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.2, duration: 0.7, ease: [0, 0, 0.2, 1] }}
              className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-foreground"
            >
              {line}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
        >
          {subheadline || "Preserved since 2009. Now powering the biggest live stream fundraiser the internet has ever seen."}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <a href="#support" className="btn-red animate-pulse-red flex items-center gap-2">
            🍔 {displayCta}
          </a>
          <a
            href="#livestream"
            className="px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-secondary/50 transition-all flex items-center gap-2"
          >
            <Play size={18} /> Watch Live
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <span className="live-dot" /> <span className="font-mono-num font-bold text-foreground">{viewerCount.toLocaleString()}</span> watching now
          </span>
          <span className="hidden sm:inline text-border">•</span>
          <span>
            <span className="font-mono-num font-bold text-foreground">{photosDisplayed.toLocaleString()}</span> photos displayed
          </span>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
          <ArrowDown className="text-muted-foreground" size={24} />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
