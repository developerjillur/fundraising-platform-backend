import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Search, Loader2, Globe, Plane, Video, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api-client";

const prizeFeatures = [
  { icon: Globe, title: "Global Event", desc: "Witnessed by millions worldwide" },
  { icon: Plane, title: "All-Expense Paid", desc: "Travel & accommodation covered" },
  { icon: Video, title: "Stream Fame", desc: "Broadcast live to the world" },
  { icon: UtensilsCrossed, title: "The Historic Bite", desc: "Take the first bite of history" },
];

const GrandPrize = () => {
  const [email, setEmail] = useState("");
  const [entries, setEntries] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [totalEntries, setTotalEntries] = useState<number>(0);

  useEffect(() => {
    const fetchTotal = async () => {
      const result = await api.get("/fundraising/prize-count");
      setTotalEntries(Number(result?.count) || 0);
    };
    fetchTotal();
  }, []);

  const lookupEntries = async () => {
    if (!email) return;
    setSearching(true);
    const result = await api.get(`/fundraising/prize-count?email=${encodeURIComponent(email)}`);
    setEntries(Number(result?.count) || 0);
    setSearching(false);
  };

  return (
    <section className="grand-prize-section py-12 md:py-16 px-4 relative overflow-hidden">
      {/* Gold radial glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, hsl(43 100% 50% / 0.05) 0%, transparent 70%)" }}
      />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-primary/[0.08] rounded-full blur-[120px] animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] bg-primary/5 rounded-full blur-[100px] animate-float pointer-events-none" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto max-w-3xl relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
            className="gp-icon-circle w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border border-border dark:border-white/20"
          >
            <Trophy size={32} />
          </motion.div>

          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl gp-text mb-3">
            🏆 THE GRAND PRIZE
          </h2>

          <p className="gp-text-muted text-lg mb-8 max-w-xl mx-auto">
            One lucky supporter will take the <span className="text-primary font-semibold">FIRST BITE</span> of
            the Last McDonald's Burger — live on stream, in front of millions.
          </p>

          {/* Prize feature cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {prizeFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i + 0.4 }}
                className="gp-card rounded-xl p-4 text-center border backdrop-blur-sm"
              >
                <f.icon className="mx-auto mb-2 gp-text-muted" size={24} />
                <p className="font-display text-sm gp-text">{f.title}</p>
                <p className="text-xs gp-text-muted mt-1">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* How to enter */}
          <div className="gp-card rounded-xl p-6 max-w-md mx-auto text-left mb-6 border backdrop-blur-sm">
            <p className="font-display text-lg gp-text mb-3">How to Enter:</p>
            <ul className="space-y-2 text-sm gp-text-muted">
              <li>• Every <span className="gp-text font-medium">$10 spent</span> = 1 entry</li>
              <li>• Premium photo (<span className="font-medium text-primary">$25</span>) = 3 entries</li>
              <li>• Any merch purchase = 1 entry</li>
            </ul>
          </div>

          {/* Entry lookup */}
          <div className="gp-card rounded-xl p-6 max-w-sm mx-auto border backdrop-blur-sm">
            <p className="text-sm gp-text-muted mb-3">Check your entries:</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupEntries()}
                placeholder="your@email.com"
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={lookupEntries}
                disabled={searching || !email}
                className="btn-red !px-4 !py-2 !text-sm !rounded-lg flex items-center gap-1"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Check
              </button>
            </div>
            {entries !== null && (
              <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 font-display text-xl text-primary">
                You have <span className="font-mono-num font-bold text-2xl">{entries}</span> {entries === 1 ? "entry" : "entries"} 🎉
              </motion.p>
            )}
            {totalEntries > 0 && (
              <p className="text-xs gp-text-muted mt-2">
                Total entries in draw: <span className="font-mono-num font-bold gp-text">{totalEntries.toLocaleString()}</span>
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="mt-6">
            <a href="#support" className="btn-red !rounded-lg inline-flex items-center gap-2">
              🍔 Support for $10 — Earn Entries
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default GrandPrize;
