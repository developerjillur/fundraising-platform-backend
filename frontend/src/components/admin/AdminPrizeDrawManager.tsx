"use client";
import { useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Trophy, Loader2, Shuffle, Crown, Mail, Calendar, DollarSign, Users, RefreshCw, AlertCircle, Send } from "lucide-react";

interface PrizeEntry {
  id: string;
  email: string;
  entry_type: string;
  amount_cents: number;
  reference_id: string;
  created_at: string;
}

interface Winner {
  email: string;
  totalEntries: number;
  totalSpent: number;
  drawnAt: Date;
}

const AdminPrizeDrawManager = () => {
  const [entries, setEntries] = useState<PrizeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [pastWinners, setPastWinners] = useState<Winner[]>([]);
  const [animatingEmail, setAnimatingEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await api.get("/admin/prize-entries");
      setEntries(data || []);
    } catch {
      toast.error("Failed to load entries");
    }
    setLoading(false);
    setLoaded(true);
  };

  const stats = useMemo(() => {
    const uniqueEmails = new Set(entries.map((e) => e.email));
    const totalSpent = entries.reduce((sum, e) => sum + e.amount_cents, 0);
    const photoEntries = entries.filter((e) => e.entry_type === "photo").length;
    const merchEntries = entries.filter((e) => e.entry_type === "merch").length;

    // Build weighted list: each entry = 1 ticket
    const entrantMap = new Map<string, { count: number; spent: number }>();
    entries.forEach((e) => {
      const existing = entrantMap.get(e.email) || { count: 0, spent: 0 };
      existing.count += 1;
      existing.spent += e.amount_cents;
      entrantMap.set(e.email, existing);
    });

    return {
      totalEntries: entries.length,
      uniqueEntrants: uniqueEmails.size,
      totalSpent: totalSpent / 100,
      photoEntries,
      merchEntries,
      entrantMap,
    };
  }, [entries]);

  const drawWinner = async () => {
    if (entries.length === 0) {
      toast.error("No entries to draw from!");
      return;
    }

    setDrawing(true);
    setWinner(null);

    // Dramatic animation: cycle through random emails
    const uniqueEmails = [...new Set(entries.map((e) => e.email))];
    const animDuration = 3000;
    const interval = 80;
    const steps = Math.floor(animDuration / interval);

    for (let i = 0; i < steps; i++) {
      const randomEmail = uniqueEmails[Math.floor(Math.random() * uniqueEmails.length)];
      setAnimatingEmail(randomEmail);
      await new Promise((r) => setTimeout(r, interval + i * 2)); // slows down
    }

    // Weighted random: each entry row = 1 ticket
    const winnerIndex = Math.floor(Math.random() * entries.length);
    const winnerEntry = entries[winnerIndex];
    const entrantData = stats.entrantMap.get(winnerEntry.email)!;

    const drawnWinner: Winner = {
      email: winnerEntry.email,
      totalEntries: entrantData.count,
      totalSpent: entrantData.spent / 100,
      drawnAt: new Date(),
    };

    setAnimatingEmail(null);
    setWinner(drawnWinner);
    setPastWinners((prev) => [drawnWinner, ...prev]);
    setDrawing(false);

    toast.success(`🎉 Winner drawn: ${drawnWinner.email}`);
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Trophy className="text-primary mx-auto mb-4" size={48} />
          <h2 className="font-display text-2xl text-foreground mb-2">Grand Prize Drawing</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Randomly select a winner from all grand prize entries. Each purchase = 1 entry ticket. The draw is weighted by number of entries.
          </p>
          <button
            onClick={loadEntries}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Load Prize Entries
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Unique Entrants", value: stats.uniqueEntrants, color: "text-blue-400" },
          { icon: Trophy, label: "Total Entries", value: stats.totalEntries, color: "text-primary" },
          { icon: DollarSign, label: "Total Spent", value: `$${stats.totalSpent.toLocaleString()}`, color: "text-green-400" },
          { icon: Calendar, label: "Photo / Merch", value: `${stats.photoEntries} / ${stats.merchEntries}`, color: "text-purple-400" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={s.color} size={18} />
            <p className="font-display text-2xl text-foreground mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Draw Section */}
      <div className="bg-card border border-primary/30 rounded-xl p-8 text-center relative overflow-hidden">
        {/* Background glow */}
        {(drawing || winner) && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        )}

        <div className="relative z-10">
          <Crown className="text-primary mx-auto mb-3" size={40} />
          <h2 className="font-display text-2xl text-foreground mb-1">THE HISTORIC BITE</h2>
          <p className="text-sm text-muted-foreground mb-6">Grand Prize Winner Drawing</p>

          {/* Animation display */}
          {drawing && animatingEmail && (
            <div className="mb-6 py-4 px-8 bg-secondary/50 rounded-xl border border-border inline-block">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Selecting...</p>
              <p className="font-mono text-xl text-primary animate-pulse">{animatingEmail}</p>
            </div>
          )}

          {/* Winner display */}
          {winner && !drawing && (
            <div className="mb-6 py-6 px-8 bg-primary/10 rounded-xl border border-primary/30 inline-block">
              <p className="text-xs text-primary uppercase tracking-widest mb-2">🎉 WINNER 🎉</p>
              <p className="font-display text-3xl text-primary mb-2">{winner.email}</p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span>{winner.totalEntries} entries</span>
                <span>•</span>
                <span>${winner.totalSpent.toFixed(2)} spent</span>
                <span>•</span>
                <span>{winner.drawnAt.toLocaleTimeString()}</span>
              </div>
              <button
                onClick={async () => {
                  setSendingEmail(true);
                  try {
                    await api.post("/admin/notifications/send-email", {
                      to: winner.email,
                      template_key: "grand_prize_winner",
                      variables: {
                        name: winner.email.split("@")[0],
                        total_entries: `${winner.totalEntries}`,
                        total_spent: `$${winner.totalSpent.toFixed(2)}`,
                      },
                    });
                    toast.success(`Winner notification sent to ${winner.email}`);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to send notification. Check Resend API key in Settings.");
                  } finally {
                    setSendingEmail(false);
                  }
                }}
                disabled={sendingEmail}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sendingEmail ? "Sending..." : "Send Winner Notification Email"}
              </button>
            </div>
          )}

          {/* Draw button */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={drawWinner}
              disabled={drawing || entries.length === 0}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-display text-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-lg hover:shadow-primary/20"
            >
              {drawing ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Shuffle size={22} />
              )}
              {drawing ? "Drawing..." : winner ? "Draw Again" : "Draw Winner"}
            </button>

            <button
              onClick={loadEntries}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-4 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 transition-colors disabled:opacity-50"
              title="Refresh entries"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {entries.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <AlertCircle size={14} /> No prize entries yet. Entries are created when supporters make purchases.
            </p>
          )}
        </div>
      </div>

      {/* Past winners (this session) */}
      {pastWinners.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
            <Trophy className="text-primary" size={18} /> Drawing History (This Session)
          </h3>
          <div className="space-y-2">
            {pastWinners.map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">#{pastWinners.length - i}</span>
                  <Crown className="text-primary" size={16} />
                  <span className="font-medium text-foreground">{w.email}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{w.totalEntries} entries</span>
                  <span>${w.totalSpent.toFixed(2)}</span>
                  <span>{w.drawnAt.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top entrants table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
          <Users className="text-primary" size={18} /> Top Entrants by Tickets
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-medium">#</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Entries</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Total Spent</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Win %</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.entrantMap.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 20)
                .map(([email, data], i) => (
                  <tr key={email} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 text-foreground font-medium">{email}</td>
                    <td className="p-2 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                        {data.count}
                      </span>
                    </td>
                    <td className="p-2 text-right text-muted-foreground">${(data.spent / 100).toFixed(2)}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {stats.totalEntries > 0 ? ((data.count / stats.totalEntries) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              {stats.entrantMap.size === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPrizeDrawManager;