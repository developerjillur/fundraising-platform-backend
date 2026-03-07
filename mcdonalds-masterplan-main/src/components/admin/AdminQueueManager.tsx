import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, API_URL } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Clock, Crown, User, Play, Pause, SkipForward,
  ArrowUp, ArrowDown, Trash2, Eye, Loader2, RefreshCw, RotateCcw,
  ShieldCheck, ShieldX, AlertTriangle, Search, Filter, MessageSquare,
} from "lucide-react";

const AdminQueueManager = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadQueue = useCallback(async () => {
    try {
      const [queueData, settingsData] = await Promise.all([
        api.get("/admin/queue"),
        api.get("/settings/all"),
      ]);
      setQueue(queueData || []);
      setIsPaused(settingsData?.stream_queue_paused === "true");
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadQueue();
    const es = new EventSource(`${API_URL}/stream/queue/stream`);
    esRef.current = es;
    es.onmessage = () => loadQueue();
    es.onerror = () => {
      // Will auto-reconnect
    };
    return () => { es.close(); };
  }, [loadQueue]);

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      const matchSearch = !searchQuery ||
        item.supporters?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supporters?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [queue, searchQuery, statusFilter]);

  const togglePause = async () => {
    const newVal = !isPaused;
    await api.put("/settings", { settings: { stream_queue_paused: newVal ? "true" : "false" } });
    setIsPaused(newVal);
    toast.success(newVal ? "Queue paused" : "Queue resumed");
  };

  const skipItem = async (id: string) => {
    setActionLoading(id);
    await api.put(`/admin/queue/${id}`, { status: "skipped" });
    toast.success("Item skipped");
    await loadQueue();
    setActionLoading(null);
  };

  const rejectAndNotify = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setActionLoading(id);
    try {
      const item = queue.find(q => q.id === id);
      // 1. Skip in queue
      await api.put(`/admin/queue/${id}`, { status: "skipped" });

      // 2. Update supporter moderation status
      if (item?.supporter_id) {
        await api.put(`/admin/supporters/${item.supporter_id}`, {
          moderation_status: "rejected",
          moderation_reason: rejectReason.trim(),
        });
      }

      // 3. Send rejection email (best effort)
      const email = item?.supporters?.email;
      const name = item?.supporters?.name || "Supporter";
      if (email) {
        try {
          await api.post("/admin/notifications/send-email", {
            to: email,
            template_key: "photo_rejected",
            variables: {
              name,
              reason: rejectReason.trim(),
              email,
            },
          });
        } catch (emailErr) {
          console.error("Rejection email failed:", emailErr);
        }
      }

      toast.success("Item rejected & owner notified");
      setRejectingId(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error("Rejection failed: " + (err.message || "Unknown error"));
    }
    await loadQueue();
    setActionLoading(null);
  };

  const forceDisplayNext = async () => {
    const displaying = queue.find((q) => q.status === "displaying");
    if (displaying) {
      await api.put(`/admin/queue/${displaying.id}`, { status: "displayed" });
    }
    toast.success("Forced next item");
    await loadQueue();
  };

  const requeueItem = async (id: string) => {
    setActionLoading(id);
    await api.put(`/admin/queue/${id}`, { status: "waiting" });
    toast.success("Item re-queued");
    await loadQueue();
    setActionLoading(null);
  };

  const moveItem = async (id: string, direction: "up" | "down") => {
    setActionLoading(id);
    const waitingItems = queue.filter((q) => q.status === "waiting").sort((a, b) => a.queue_position - b.queue_position);
    const idx = waitingItems.findIndex((q) => q.id === id);
    if (idx < 0) { setActionLoading(null); return; }
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= waitingItems.length) { setActionLoading(null); return; }

    const posA = waitingItems[idx].queue_position;
    const posB = waitingItems[swapIdx].queue_position;
    await Promise.all([
      api.put(`/admin/queue/${waitingItems[idx].id}`, { status: waitingItems[idx].status }),
      api.put(`/admin/queue/${waitingItems[swapIdx].id}`, { status: waitingItems[swapIdx].status }),
    ]);
    toast.success("Queue reordered");
    await loadQueue();
    setActionLoading(null);
  };

  const clearDisplayed = async () => {
    await api.delete("/admin/queue/displayed");
    toast.success("Cleared displayed items");
    await loadQueue();
  };

  const emergencyStop = async () => {
    const displaying = queue.find((q) => q.status === "displaying");
    if (displaying) {
      await api.put(`/admin/queue/${displaying.id}`, { status: "skipped" });
    }
    await api.put("/settings", { settings: { stream_queue_paused: "true" } });
    setIsPaused(true);
    toast.success("Emergency stop — queue paused and current item skipped");
    await loadQueue();
  };

  // Sort waiting items: premium first, then by queue_position
  const waitingItems = queue
    .filter((q) => q.status === "waiting")
    .sort((a, b) => {
      if (a.package_type !== b.package_type) {
        return a.package_type === "premium" ? -1 : 1;
      }
      return a.queue_position - b.queue_position;
    });
  const INTERVAL_GAP = 5; // seconds between items
  const waitingCount = waitingItems.length;
  const displayedCount = queue.filter((q) => q.status === "displayed").length;
  const skippedCount = queue.filter((q) => q.status === "skipped").length;
  const displayingItem = queue.find((q) => q.status === "displaying");

  const etaMap = useMemo(() => {
    const map: Record<string, string> = {};
    let cumulativeSeconds = 0;
    const currentlyDisplaying = queue.find((q) => q.status === "displaying");
    if (currentlyDisplaying?.display_started_at) {
      const elapsed = (Date.now() - new Date(currentlyDisplaying.display_started_at).getTime()) / 1000;
      cumulativeSeconds = Math.max(0, (currentlyDisplaying.display_duration_seconds || 10) - elapsed);
      cumulativeSeconds += INTERVAL_GAP;
    } else if (currentlyDisplaying) {
      cumulativeSeconds = (currentlyDisplaying.display_duration_seconds || 10) + INTERVAL_GAP;
    }
    for (let i = 0; i < waitingItems.length; i++) {
      const item = waitingItems[i];
      const eta = new Date(Date.now() + cumulativeSeconds * 1000);
      map[item.id] = eta.toISOString();
      cumulativeSeconds += (item.display_duration_seconds || 10) + INTERVAL_GAP;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={togglePause} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isPaused ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"}`}>
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
          {isPaused ? "Resume Queue" : "Pause Queue"}
        </button>
        <button onClick={clearDisplayed} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors">
          <Trash2 size={16} /> Clear Displayed ({displayedCount})
        </button>
        <button onClick={forceDisplayNext} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-sm font-medium transition-colors">
          <SkipForward size={16} /> Force Next
        </button>
        <button onClick={emergencyStop} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 text-sm font-medium transition-colors">
          <SkipForward size={16} /> Emergency Stop
        </button>
        <button onClick={loadQueue} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors ml-auto">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          <option value="waiting">Waiting</option>
          <option value="displaying">Displaying</option>
          <option value="displayed">Displayed</option>
          <option value="skipped">Skipped / Rejected</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-secondary/30 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">Queue Status</p>
          <p className={`text-sm font-semibold ${isPaused ? "text-yellow-400" : "text-green-400"}`}>
            {isPaused ? "⏸ Paused" : "▶ Running"}
          </p>
        </div>
        <div className="bg-secondary/30 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">Waiting</p>
          <p className="text-sm font-semibold text-foreground">{waitingCount}</p>
        </div>
        <div className="bg-secondary/30 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">Displayed</p>
          <p className="text-sm font-semibold text-foreground">{displayedCount}</p>
        </div>
        <div className="bg-secondary/30 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">Skipped/Rejected</p>
          <p className="text-sm font-semibold text-red-400">{skippedCount}</p>
        </div>
        <div className="bg-secondary/30 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">Currently Displaying</p>
          <p className="text-sm font-semibold text-foreground">
            {displayingItem ? displayingItem.supporters?.name || "Yes" : "None"}
          </p>
        </div>
      </div>

      {/* Currently Displaying */}
      {displayingItem && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary">
              {displayingItem.photo_url && (
                <img
                  src={displayingItem.photo_url.startsWith("http") ? displayingItem.photo_url : `${API_URL}/uploads/photos/${displayingItem.photo_url}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-accent font-semibold flex items-center gap-2">
                <Eye size={14} /> Now Displaying
              </p>
              <p className="text-foreground font-medium">{displayingItem.supporters?.name || "Supporter"}</p>
              <p className="text-xs text-muted-foreground">{displayingItem.supporters?.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full uppercase ${displayingItem.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {displayingItem.package_type}
            </span>
            <button onClick={() => skipItem(displayingItem.id)} className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg hover:bg-red-500/30">
              Skip
            </button>
            <button
              onClick={() => { setRejectingId(displayingItem.id); setRejectReason(""); }}
              className="text-xs bg-orange-500/20 text-orange-400 px-3 py-1 rounded-lg hover:bg-orange-500/30 flex items-center gap-1"
            >
              <ShieldX size={12} /> Reject & Notify
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">Reject Content & Notify Owner</p>
          </div>
          <p className="text-xs text-muted-foreground">
            The owner will receive an email explaining why their content was filtered.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (e.g., 'Inappropriate content', 'Contains explicit imagery')..."
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive min-h-[80px]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => rejectAndNotify(rejectingId)}
              disabled={actionLoading === rejectingId || !rejectReason.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading === rejectingId ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />}
              Reject & Send Email
            </button>
            <button
              onClick={() => { setRejectingId(null); setRejectReason(""); }}
              className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg text-sm hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="p-3">#</th>
                <th className="p-3">Photo</th>
                <th className="p-3">Name</th>
                <th className="p-3">Package</th>
                <th className="p-3">Status</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Views</th>
                <th className="p-3">Screen Time</th>
                <th className="p-3">Est. Display At</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-3 text-muted-foreground">{item.queue_position}</td>
                  <td className="p-3">
                    <div className="w-10 h-10 rounded overflow-hidden bg-secondary">
                      {item.photo_url && (
                        <img
                          src={item.photo_url.startsWith("http") ? item.photo_url : `${API_URL}/uploads/photos/${item.photo_url}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-foreground">
                    <div>
                      {item.supporters?.name || "—"}
                      {item.has_badge && <Crown size={12} className="inline ml-1 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.supporters?.email}</p>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {item.package_type}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === "waiting" ? "bg-yellow-500/20 text-yellow-400"
                        : item.status === "displaying" ? "bg-green-500/20 text-green-400"
                        : item.status === "displayed" ? "bg-blue-500/20 text-blue-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.display_duration_seconds}s</td>
                  <td className="p-3 text-muted-foreground text-center">{item.view_count || 0}</td>
                  <td className="p-3 text-muted-foreground text-center">{item.total_screen_time_seconds ? `${Math.round(item.total_screen_time_seconds)}s` : "—"}</td>
                  <td className="p-3 text-xs">
                    {item.status === "waiting" && etaMap[item.id] ? (
                      <span className="text-primary font-medium">
                        {new Date(etaMap[item.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    ) : item.status === "displaying" ? (
                      <span className="text-green-400 font-medium">Now</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {item.status === "waiting" && (
                        <>
                          <button onClick={() => moveItem(item.id, "up")} disabled={actionLoading === item.id} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Move up">
                            <ArrowUp size={14} />
                          </button>
                          <button onClick={() => moveItem(item.id, "down")} disabled={actionLoading === item.id} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Move down">
                            <ArrowDown size={14} />
                          </button>
                          <button onClick={() => skipItem(item.id)} disabled={actionLoading === item.id} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Skip">
                            <SkipForward size={14} />
                          </button>
                          <button
                            onClick={() => { setRejectingId(item.id); setRejectReason(""); }}
                            className="p-1 rounded hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400"
                            title="Reject & notify owner"
                          >
                            <ShieldX size={14} />
                          </button>
                        </>
                      )}
                      {item.status === "displaying" && (
                        <>
                          <button onClick={() => skipItem(item.id)} disabled={actionLoading === item.id} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Skip current">
                            <SkipForward size={14} />
                          </button>
                          <button
                            onClick={() => { setRejectingId(item.id); setRejectReason(""); }}
                            className="p-1 rounded hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400"
                            title="Reject & notify owner"
                          >
                            <ShieldX size={14} />
                          </button>
                        </>
                      )}
                      {(item.status === "displayed" || item.status === "skipped") && (
                        <button onClick={() => requeueItem(item.id)} disabled={actionLoading === item.id} className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary" title="Re-queue">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQueue.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    {searchQuery || statusFilter !== "all" ? "No items match your filters" : "No items in queue"}
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

export default AdminQueueManager;