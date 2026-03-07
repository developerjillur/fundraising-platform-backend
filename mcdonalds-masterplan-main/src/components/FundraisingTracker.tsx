import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Users, ShoppingBag, Camera, Eye } from "lucide-react";
import { api, API_URL } from "@/lib/api-client";

interface Stats {
  total_raised_cents: number;
  goal_amount_cents: number;
  supporter_count: number;
  photos_displayed: number;
  merch_order_count: number;
  current_viewer_count: number;
}

const FundraisingTracker = () => {
  const [displayedAmount, setDisplayedAmount] = useState(0);
  const [stats, setStats] = useState<Stats>({
    total_raised_cents: 0,
    goal_amount_cents: 200000000,
    supporter_count: 0,
    photos_displayed: 0,
    merch_order_count: 0,
    current_viewer_count: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await api.get("/fundraising/stats");
        if (data) {
          const s: Stats = {
            total_raised_cents: data.total_raised_cents ?? 0,
            goal_amount_cents: data.goal_amount_cents ?? 200000000,
            supporter_count: data.supporter_count ?? 0,
            photos_displayed: data.photos_displayed ?? 0,
            merch_order_count: data.merch_order_count ?? 0,
            current_viewer_count: data.current_viewer_count ?? 0,
          };
          setStats(s);
          animateCountUp(s.total_raised_cents / 100);
        }
      } catch (e) {
        console.error("Failed to load fundraising stats", e);
      }
    };

    const animateCountUp = (target: number) => {
      const duration = 2000;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayedAmount(Math.floor(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    loadStats();

    const es = new EventSource(`${API_URL}/fundraising/stream`);
    es.addEventListener("stats-update", (e) => {
      const d = JSON.parse(e.data);
      setStats({
        total_raised_cents: d.total_raised_cents ?? 0,
        goal_amount_cents: d.goal_amount_cents ?? 200000000,
        supporter_count: d.supporter_count ?? 0,
        photos_displayed: d.photos_displayed ?? 0,
        merch_order_count: d.merch_order_count ?? 0,
        current_viewer_count: d.current_viewer_count ?? 0,
      });
      setDisplayedAmount(Math.floor((d.total_raised_cents ?? 0) / 100));
    });

    return () => { es.close(); };
  }, []);

  const goalAmount = stats.goal_amount_cents / 100;
  const percentage = Math.min((displayedAmount / goalAmount) * 100, 100);

  const statItems = [
    { icon: Camera, label: "Photos Displayed", value: stats.photos_displayed },
    { icon: Users, label: "Supporters", value: stats.supporter_count },
    { icon: ShoppingBag, label: "Merch Sold", value: stats.merch_order_count },
    { icon: Eye, label: "Watching Now", value: stats.current_viewer_count },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={sectionRef} className="py-12 md:py-16 px-4 relative" style={{ background: "linear-gradient(135deg, hsl(var(--fundraiser-bar-from)), hsl(var(--fundraiser-bar-to)))" }}>
      {/* Subtle gold glow behind — with parallax */}
      <motion.div
        style={{ y: glowY }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"
      />

      <div className="container mx-auto max-w-4xl relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* Big amount */}
          <div className="text-center mb-6">
            <p className="text-white/70 text-xs uppercase tracking-[0.3em] mb-3 font-medium">
              Raised So Far
            </p>
            <h2 className="font-mono-num text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white">
              ${displayedAmount.toLocaleString()}
            </h2>
          </div>

          {/* Progress bar */}
          <div className="relative h-4 bg-white/20 rounded-full overflow-hidden mb-2 max-w-2xl mx-auto">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 2.5, ease: "easeOut", delay: 0.3 }}
              className="absolute inset-y-0 left-0 rounded-full animate-shimmer"
              style={{
                background: `linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,1), rgba(255,255,255,0.9))`,
                boxShadow: "0 0 20px rgba(255,255,255,0.4)",
              }}
            />
          </div>
          <p className="text-center text-sm text-white/70 mb-8">
            <span className="font-mono-num font-bold text-white">{percentage.toFixed(1)}%</span> of ${goalAmount.toLocaleString()} goal
          </p>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {statItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i + 0.5, duration: 0.5 }}
                className="rounded-xl p-4 text-center border border-white/15 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <item.icon className="mx-auto mb-2 text-white/80" size={20} />
                <p className="font-mono-num text-xl md:text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
                <p className="text-xs text-white/60 mt-1">{item.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Live ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="flex items-center justify-center gap-2 text-sm"
          >
            <span className="flex items-center gap-1.5 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
              <span className="live-dot" /> Live
            </span>
            <span className="text-white/70">
              Photos are being displayed on the live stream right now!
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default FundraisingTracker;
