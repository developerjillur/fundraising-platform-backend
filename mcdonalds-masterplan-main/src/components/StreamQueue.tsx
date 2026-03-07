import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Crown, User, Timer, Zap } from "lucide-react";
import { api, API_URL } from "@/lib/api-client";

interface QueueItem {
  id: string;
  queue_position: number;
  package_type: "standard" | "premium";
  display_duration_seconds: number;
  status: string;
  has_badge: boolean;
  display_started_at: string | null;
  display_ended_at: string | null;
  estimated_display_at: string | null;
  supporter?: { name: string } | null;
  supporters?: { name: string } | null;
}

interface QueueData {
  current: QueueItem | null;
  upcoming: QueueItem[];
  total_waiting: number;
  recently_displayed: QueueItem[];
}

/** Sort waiting items: premium first, then by queue_position */
const prioritySort = (a: QueueItem, b: QueueItem) => {
  if (a.package_type !== b.package_type) {
    return a.package_type === "premium" ? -1 : 1;
  }
  return a.queue_position - b.queue_position;
};

/** Default interval gap between items (seconds) */
const INTERVAL_GAP = 5;

const StreamQueue = () => {
  const [queue, setQueue] = useState<QueueData>({
    current: null,
    upcoming: [],
    total_waiting: 0,
    recently_displayed: [],
  });
  const [now, setNow] = useState(Date.now());
  const [intervalGap, setIntervalGap] = useState(INTERVAL_GAP);

  const loadQueue = useCallback(async () => {
    const [data, settingsData] = await Promise.all([
      api.get("/stream/queue/display"),
      api.get("/settings"),
    ]);

    if (settingsData?.stream_display_interval) {
      const parsed = parseInt(settingsData.stream_display_interval, 10);
      if (!isNaN(parsed) && parsed >= 0) setIntervalGap(parsed);
    }
    if (data) {
      const mapItem = (item: any): QueueItem => ({
        ...item,
        supporter: item.supporter_name ? { name: item.supporter_name } : null,
        supporters: item.supporter_name ? { name: item.supporter_name } : null,
      });

      setQueue({
        current: data.current ? mapItem(data.current) : null,
        upcoming: (data.upcoming || []).map(mapItem).sort(prioritySort),
        total_waiting: data.total_waiting || 0,
        recently_displayed: (data.recently_displayed || []).map(mapItem),
      });
    }
  }, []);

  // Load on mount + realtime
  useEffect(() => {
    loadQueue();
    const es = new EventSource(`${API_URL}/stream/queue/stream`);
    es.addEventListener("queue-update", () => {
      loadQueue();
    });
    return () => {
      es.close();
    };
  }, [loadQueue]);

  // Tick every second for live countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  /** Calculate ETAs considering priority order, durations, and interval gaps */
  const calculateETAs = useCallback(
    (upcoming: QueueItem[], current: QueueItem | null) => {
      let cumulativeSeconds = 0;

      // Account for remaining time of currently displaying item
      if (current?.display_started_at) {
        const elapsed = (now - new Date(current.display_started_at).getTime()) / 1000;
        cumulativeSeconds = Math.max(0, (current.display_duration_seconds || 10) - elapsed);
        cumulativeSeconds += intervalGap; // gap after current item finishes
      } else if (current) {
        cumulativeSeconds = (current.display_duration_seconds || 10) + intervalGap;
      }

      return upcoming.map((item, idx) => {
        const etaMs = now + cumulativeSeconds * 1000;
        cumulativeSeconds += (item.display_duration_seconds || 10) + (idx < upcoming.length - 1 ? intervalGap : 0);
        return { ...item, calculated_eta_ms: etaMs };
      });
    },
    [now, intervalGap]
  );

  const upcomingWithETAs = calculateETAs(queue.upcoming, queue.current);
  const hasActiveQueue = queue.current || queue.upcoming.length > 0;
  const displayItems = hasActiveQueue ? upcomingWithETAs : queue.recently_displayed;

  /** Format countdown from ms remaining */
  const formatCountdown = (targetMs: number) => {
    const diff = targetMs - now;
    if (diff <= 0) return "Next up";
    const totalSecs = Math.ceil(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
    return `${secs}s`;
  };

  const formatTimeAgo = (isoString: string) => {
    if (!isoString) return "";
    const diff = now - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  /** Countdown progress for currently displaying item */
  const currentProgress = (() => {
    if (!queue.current?.display_started_at) return 0;
    const elapsed = (now - new Date(queue.current.display_started_at).getTime()) / 1000;
    const total = queue.current.display_duration_seconds || 10;
    return Math.min(100, (elapsed / total) * 100);
  })();

  const currentTimeLeft = (() => {
    if (!queue.current?.display_started_at) return 0;
    const elapsed = (now - new Date(queue.current.display_started_at).getTime()) / 1000;
    return Math.max(0, Math.ceil((queue.current.display_duration_seconds || 10) - elapsed));
  })();

  return (
    <section id="queue" className="py-8 md:py-12 px-4 bg-[#fff7eb] dark:bg-background">
      <div className="container mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <h3 className="font-display text-2xl md:text-3xl text-gradient-gold text-center mb-2">
            SUPPORTER QUEUE
          </h3>
          <p className="text-center text-muted-foreground text-sm mb-6">
            {hasActiveQueue
              ? `${queue.total_waiting} photo${queue.total_waiting !== 1 ? "s" : ""} waiting · Premium items get priority`
              : "Queue is ready for new submissions"}
          </p>

          {/* Currently displaying */}
          <AnimatePresence mode="wait">
            {queue.current && (
              <motion.div
                key={queue.current.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl p-4 mb-4 border border-primary/30 bg-primary/5 relative overflow-hidden"
              >
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 h-1 bg-primary/30 w-full">
                  <motion.div
                    className="h-full bg-primary"
                    style={{ width: `${currentProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                    <Crown className="text-primary" size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                      🔴 Now Playing
                    </p>
                    <p className="text-foreground font-semibold">
                      {queue.current.supporter?.name || queue.current.supporters?.name || "Supporter"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {queue.current.package_type === "premium" && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <Crown size={10} /> Premium
                      </span>
                    )}
                    <span className="text-sm font-mono-num text-primary font-bold tabular-nums">
                      {currentTimeLeft}s
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* No active queue message */}
          {!hasActiveQueue && queue.recently_displayed.length > 0 && (
            <div className="text-center mb-4">
              <p className="text-muted-foreground text-sm">Queue is idle — recently displayed:</p>
            </div>
          )}

          {/* Upcoming or recently displayed */}
          <div className="space-y-2">
            {displayItems.map((item: any, i: number) => {
              const isPremium = item.package_type === "premium";
              const etaMs = item.calculated_eta_ms;
              const isNextUp = hasActiveQueue && i === 0 && etaMs && (etaMs - now) <= 0;

              return (
                <motion.div
                  key={item.id || i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                    isPremium
                      ? "bg-primary/5 border border-primary/20"
                      : "glass-card"
                  } ${isNextUp ? "ring-1 ring-primary/40" : ""}`}
                >
                  {/* Position number */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono-num ${
                    isPremium
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>

                  {/* Priority indicator */}
                  {isPremium ? (
                    <Zap className="text-primary shrink-0" size={14} />
                  ) : (
                    <User className="text-muted-foreground shrink-0" size={14} />
                  )}

                  {/* Name */}
                  <p className="flex-1 text-foreground text-sm truncate">
                    {item.supporter?.name || item.supporters?.name || "Supporter"}
                  </p>

                  {/* Package badge */}
                  {isPremium && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shrink-0">
                      <Crown size={8} /> PRIORITY
                    </span>
                  )}

                  {/* Duration chip */}
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-mono-num shrink-0">
                    {item.display_duration_seconds || 10}s
                  </span>

                  {/* Countdown / Time ago */}
                  <span className={`flex items-center gap-1 text-xs font-mono-num shrink-0 tabular-nums ${
                    hasActiveQueue
                      ? isNextUp
                        ? "text-primary font-bold"
                        : "text-muted-foreground"
                      : "text-muted-foreground"
                  }`}>
                    {hasActiveQueue ? (
                      <>
                        <Timer size={10} />
                        {formatCountdown(etaMs)}
                      </>
                    ) : (
                      <>
                        <Clock size={10} />
                        {formatTimeAgo(item.display_ended_at)}
                      </>
                    )}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Empty state */}
          {!queue.current && queue.upcoming.length === 0 && queue.recently_displayed.length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-4">
              No photos in the queue yet. Be the first!
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default StreamQueue;