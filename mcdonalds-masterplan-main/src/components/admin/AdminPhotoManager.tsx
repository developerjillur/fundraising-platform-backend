import { useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Camera, Search, ChevronDown, ChevronUp, Filter, Download,
  CheckCircle2, XCircle, Clock, Image, Eye, ExternalLink, Play,
  ShieldX, AlertTriangle, Loader2, MessageSquare,
} from "lucide-react";
import { exportSupporters } from "@/lib/csv-export";

interface Props {
  supporters: any[];
  onDataChanged: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  failed: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

const AdminPhotoManager = ({ supporters, onDataChanged }: Props) => {
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterModeration, setFilterModeration] = useState("all");
  const [filterPackage, setFilterPackage] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const filtered = useMemo(() => {
    return supporters.filter((s) => {
      const matchSearch =
        !search ||
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase());
      const matchPayment = filterPayment === "all" || s.payment_status === filterPayment;
      const matchMod = filterModeration === "all" || s.moderation_status === filterModeration;
      const matchPkg = filterPackage === "all" || s.package_type === filterPackage;
      return matchSearch && matchPayment && matchMod && matchPkg;
    });
  }, [supporters, search, filterPayment, filterModeration, filterPackage]);

  const updateModeration = async (id: string, status: "approved" | "rejected") => {
    if (status === "rejected") {
      // Open reject form instead of immediately rejecting
      setRejectingId(id);
      setRejectReason("");
      return;
    }
    try {
      await api.put(`/admin/supporters/${id}`, { moderation_status: status });
      toast.success(`Photo ${status}`);
      onDataChanged();
    } catch {
      toast.error("Update failed");
    }
  };

  const rejectWithReason = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setRejectLoading(true);
    try {
      const supporter = supporters.find(s => s.id === id);

      // 1. Update moderation status with reason
      await api.put(`/admin/supporters/${id}`, {
        moderation_status: "rejected",
        moderation_reason: rejectReason.trim(),
      });

      // 2. Also remove from stream queue if present — skip all queue items for this supporter
      try {
        const queueItems = await api.get("/admin/queue");
        const matchingItems = (queueItems || []).filter((q: any) => q.supporter_id === id);
        for (const q of matchingItems) {
          await api.put(`/admin/queue/${q.id}`, { status: "skipped" });
        }
      } catch {
        // best effort
      }

      // 3. Send rejection email (best effort)
      if (supporter?.email) {
        try {
          await api.post("/admin/notifications/send-email", {
            to: supporter.email,
            template_key: "photo_rejected",
            variables: {
              name: supporter.name || "Supporter",
              reason: rejectReason.trim(),
              email: supporter.email,
            },
          });
        } catch (emailErr) {
          console.error("Rejection email failed:", emailErr);
        }
      }

      toast.success("Photo rejected & owner notified via email");
      setRejectingId(null);
      setRejectReason("");
      onDataChanged();
    } catch (err: any) {
      toast.error("Rejection failed: " + (err.message || "Unknown error"));
    }
    setRejectLoading(false);
  };

  const markPaidAndQueue = async (supporter: any) => {
    try {
      await api.put(`/admin/supporters/${supporter.id}`, { moderation_status: supporter.moderation_status, moderation_reason: supporter.moderation_reason });
      // Check if already in queue
      const queueItems = await api.get("/admin/queue");
      const existing = (queueItems || []).find((q: any) => q.supporter_id === supporter.id);
      if (existing) { toast.success("Payment marked complete (already in queue)"); onDataChanged(); return; }

      await api.post("/admin/queue", {
        supporter_id: supporter.id,
        photo_url: supporter.photo_url || "",
        package_type: supporter.package_type || "standard",
        display_duration_seconds: supporter.display_duration_seconds || 10,
      });
      toast.success("Payment marked complete & added to stream queue!");
      onDataChanged();
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Unknown error"));
    }
  };

  const addToQueue = async (supporter: any) => {
    try {
      const queueItems = await api.get("/admin/queue");
      const existing = (queueItems || []).find((q: any) => q.supporter_id === supporter.id);
      if (existing) { toast.info("Already in stream queue"); return; }

      await api.post("/admin/queue", {
        supporter_id: supporter.id,
        photo_url: supporter.photo_url || "",
        package_type: supporter.package_type || "standard",
        display_duration_seconds: supporter.display_duration_seconds || 10,
      });
      toast.success("Added to stream queue!");
      onDataChanged();
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Unknown error"));
    }
  };

  const stats = useMemo(() => {
    const completed = supporters.filter((s) => s.payment_status === "completed");
    const totalRevenue = completed.reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100;
    const standard = supporters.filter((s) => s.package_type === "standard").length;
    const premium = supporters.filter((s) => s.package_type === "premium").length;
    const pendingMod = supporters.filter((s) => s.moderation_status === "pending").length;
    const rejected = supporters.filter((s) => s.moderation_status === "rejected").length;
    return { totalRevenue, standard, premium, pendingMod, rejected, total: supporters.length };
  }, [supporters]);

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Camera className="text-primary" size={18} /> PHOTO SUBMISSIONS ({stats.total})
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="bg-secondary/50 px-2 py-1 rounded">Revenue: <span className="text-primary font-medium">${stats.totalRevenue.toLocaleString()}</span></span>
          <span className="bg-secondary/50 px-2 py-1 rounded">Standard: {stats.standard}</span>
          <span className="bg-secondary/50 px-2 py-1 rounded">Premium: {stats.premium}</span>
          {stats.pendingMod > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-medium">{stats.pendingMod} pending moderation</span>
          )}
          {stats.rejected > 0 && (
            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded font-medium">{stats.rejected} rejected</span>
          )}
          <button
            onClick={() => exportSupporters(filtered)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Reject Panel (shown when rejecting) */}
      {rejectingId && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">Reject Photo & Notify Owner</p>
          </div>
          <p className="text-xs text-muted-foreground">
            The owner ({supporters.find(s => s.id === rejectingId)?.email}) will receive an email explaining why their content was filtered.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (e.g., 'Contains explicit imagery', 'Inappropriate for family-friendly stream')..."
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive min-h-[80px]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => rejectWithReason(rejectingId)}
              disabled={rejectLoading || !rejectReason.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {rejectLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />}
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

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Payments</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={filterModeration} onChange={(e) => setFilterModeration(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Moderation</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Packages</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* Submissions List */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const isExpanded = expandedId === s.id;
          return (
            <div key={s.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {s.package_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.payment_status] || "bg-secondary text-muted-foreground"}`}>
                      {s.payment_status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.moderation_status] || "bg-secondary text-muted-foreground"}`}>
                      {s.moderation_status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.email}</p>
                  {s.moderation_reason && (
                    <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                      <MessageSquare size={10} /> {s.moderation_reason}
                    </p>
                  )}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-display text-lg text-primary">${(s.amount_cents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{s.display_duration_seconds}s display</p>
                </div>
                <p className="text-xs text-muted-foreground hidden md:block">
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Photo Preview */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Image size={12} /> PHOTO
                      </h4>
                      {s.photo_url ? (
                        <div className="relative group">
                          <img src={s.photo_url} alt="Submission" className="w-full h-48 object-cover rounded-lg border border-border" />
                          <a href={s.photo_url} target="_blank" rel="noreferrer" className="absolute top-2 right-2 bg-background/80 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink size={14} className="text-foreground" />
                          </a>
                        </div>
                      ) : (
                        <div className="w-full h-48 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground text-sm">
                          No photo uploaded
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">DETAILS</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="text-foreground font-medium capitalize">{s.package_type}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-primary font-medium">${(s.amount_cents / 100).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="text-foreground">{s.display_duration_seconds} seconds</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Display Status</span><span className="text-foreground capitalize">{s.display_status || "—"}</span></div>
                        {s.moderation_reason && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Rejection Reason</span><span className="text-destructive text-xs">{s.moderation_reason}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span className="text-foreground">{new Date(s.created_at).toLocaleString()}</span></div>
                      </div>
                    </div>

                    {/* Payment & Actions */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">PAYMENT & ACTIONS</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.payment_status] || ""}`}>{s.payment_status}</span>
                        </div>
                        {s.stripe_payment_intent_id && (
                          <div><span className="text-muted-foreground text-xs">Stripe PI</span><p className="text-xs font-mono text-foreground break-all">{s.stripe_payment_intent_id}</p></div>
                        )}
                      </div>

                      {/* Moderation Actions */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Moderation</p>
                        <div className="flex gap-2">
                          {s.moderation_status !== "approved" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateModeration(s.id, "approved"); }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}
                          {s.moderation_status !== "rejected" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateModeration(s.id, "rejected"); }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              <XCircle size={14} /> Reject & Notify
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Queue Actions */}
                      <div className="pt-3 border-t border-border space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">Queue Actions</p>
                        {s.payment_status === "pending" && (
                          <button
                            onClick={() => markPaidAndQueue(s)}
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                          >
                            <CheckCircle2 size={14} /> Mark Paid & Add to Queue
                          </button>
                        )}
                        {s.payment_status === "completed" && s.moderation_status === "approved" && (
                          <button
                            onClick={() => addToQueue(s)}
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                          >
                            <Play size={14} /> Add to Stream Queue
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Camera size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search || filterPayment !== "all" || filterModeration !== "all" || filterPackage !== "all" ? "No submissions match your filters." : "No photo submissions yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPhotoManager;