"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  BarChart3, Users, ShoppingBag, Camera, LogOut,
  DollarSign, TrendingUp, Eye, Clock, Loader2,
  Activity, ArrowUpRight, RefreshCw, Download,
  CheckCircle2, XCircle, AlertCircle, Package,
  Trophy, Mail, Globe, CreditCard, Star, Crown,
  Zap, Percent, Settings, Save, Power, Link2,
  Youtube, Image, ShieldCheck, Pencil, Trash2, Plus,
  ToggleLeft, ToggleRight, ExternalLink, UserCog,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import AdminProductManager from "@/components/admin/AdminProductManager";
import AdminQueueManager from "@/components/admin/AdminQueueManager";
import AdminOrderManager from "@/components/admin/AdminOrderManager";
import AdminCustomerManager from "@/components/admin/AdminCustomerManager";
import AdminPhotoManager from "@/components/admin/AdminPhotoManager";
import AdminEmailManager from "@/components/admin/AdminEmailManager";
import AdminPrizeDrawManager from "@/components/admin/AdminPrizeDrawManager";
import { exportCustomers, exportOrders, exportSupporters, exportQueue, exportPrizeEntries, exportToCsv } from "@/lib/csv-export";
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ─── Chart Palette ─── */
const CHART_COLORS = {
  gold: "hsl(45, 100%, 50%)",
  red: "hsl(4, 90%, 50%)",
  green: "hsl(142, 71%, 45%)",
  blue: "hsl(217, 91%, 60%)",
  purple: "hsl(263, 70%, 50%)",
};

/* ─── Reusable Widgets ─── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" && entry.name.includes("$")
            ? `$${entry.value.toLocaleString()}`
            : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, trend, iconColor }: {
  icon: any; label: string; value: string; sub?: string; trend?: string | null; iconColor?: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
    <div className="flex items-center justify-between mb-2">
      <Icon className={iconColor || "text-primary"} size={20} />
      {trend === "up" && <ArrowUpRight className="text-green-400" size={16} />}
    </div>
    <p className="font-display text-3xl text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

const MiniStat = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
    <Icon size={16} className={color} />
    <div className="flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

/* ─── Settings Row ─── */
const SettingRow = ({ label, description, children }: { label: React.ReactNode; description?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SettingInput = ({ value, onChange, placeholder, type = "text", warning }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; warning?: string }) => (
  <div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-64 px-3 py-2 rounded-lg bg-secondary border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${warning ? "border-destructive" : "border-border"}`}
    />
    {warning && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {warning}</p>}
  </div>
);

/* ─── Main Component ─── */
const AdminDashboard = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [supporters, setSupporters] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any[]>([]);
  const [grandPrizeEntries, setGrandPrizeEntries] = useState<any[]>([]);
  const [photoPackages, setPhotoPackages] = useState<any[]>([]);
  const [merchandise, setMerchandise] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeMainTab, setActiveMainTab] = useState("overview");

  useEffect(() => { checkAuth(); loadData(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { loadData(); setLastRefreshed(new Date()); }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const checkAuth = async () => {
    try {
      const user = await api.get("/auth/me");
      if (!user || user.role !== "admin") { api.setToken(null); router.push("/admin/login"); }
    } catch { router.push("/admin/login"); }
  };

  const loadData = async () => {
    const [statsRes, supportersRes, ordersRes, queueRes, customerStatsRes, prizeRes, packagesRes, merchRes, settingsRes] = await Promise.all([
      api.get("/fundraising/stats"),
      api.get("/admin/supporters"),
      api.get("/admin/orders"),
      api.get("/admin/queue"),
      api.get("/admin/customers"),
      api.get("/admin/prize-entries"),
      api.get("/admin/packages"),
      api.get("/admin/products"),
      api.get("/settings/all"),
    ]);
    setStats(statsRes);
    setSupporters(supportersRes || []);
    setOrders(ordersRes || []);
    setQueue(queueRes || []);
    setCustomerStats(customerStatsRes || []);
    setGrandPrizeEntries(prizeRes || []);
    setPhotoPackages(packagesRes || []);
    setMerchandise(merchRes || []);
    if (settingsRes && !settingsDirty) {
      setSiteSettings(settingsRes);
    }
    setLastRefreshed(new Date());
    setLoading(false);
  };

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); toast.success("Data refreshed"); };
  const handleLogout = async () => { api.setToken(null); router.push("/admin/login"); };

  const updateSetting = (key: string, value: string) => {
    setSiteSettings(prev => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const saveSettings = async () => {
    // Warn about missing required fields for enabled integrations
    const warnings: string[] = [];
    if (siteSettings.stripe_connected === "true" && !siteSettings.stripe_publishable_key?.trim()) {
      warnings.push("Stripe: Publishable Key is missing");
    }
    if (siteSettings.printful_connected === "true" && !siteSettings.printful_api_key?.trim()) {
      warnings.push("Printful: API Key is missing");
    }
    if (siteSettings.klaviyo_connected === "true" && !siteSettings.klaviyo_api_key?.trim()) {
      warnings.push("Klaviyo: API Key is missing");
    }
    if (siteSettings.content_moderation_enabled === "true" && siteSettings.moderation_provider === "custom" && !siteSettings.moderation_api_url?.trim()) {
      warnings.push("Content Moderation: Custom API URL is missing");
    }

    setSavingSettings(true);
    try {
      await api.put("/settings", { settings: siteSettings });

      // Also sync fundraising goal if changed
      const goalCents = parseInt(siteSettings.fundraising_goal_cents || "200000000");
      if (!isNaN(goalCents)) {
        await api.put("/fundraising/stats", { goal_amount_cents: goalCents });
      }

      setSettingsDirty(false);
      if (warnings.length > 0) {
        toast.warning(`Settings saved with warnings:\n${warnings.join(", ")}`, { duration: 6000 });
      } else {
        toast.success("Settings saved successfully!");
      }
    } catch {
      toast.error("Failed to save settings.");
    }
    setSavingSettings(false);
  };

  /* ─── Package Management ─── */
  const togglePackageActive = async (id: string, active: boolean) => {
    await api.put(`/admin/packages/${id}`, { active: !active });
    loadData();
    toast.success(`Package ${active ? "disabled" : "enabled"}`);
  };

  const updatePackageField = async (id: string, field: string, value: any) => {
    await api.put(`/admin/packages/${id}`, { [field]: value });
    loadData();
    toast.success("Package updated");
  };

  /* ─── Merchandise Management ─── */
  const toggleMerchActive = async (id: string, active: boolean) => {
    await api.put(`/admin/products/${id}`, { active: !active });
    loadData();
    toast.success(`Product ${active ? "disabled" : "enabled"}`);
  };

  const updateMerchField = async (id: string, field: string, value: any) => {
    await api.put(`/admin/products/${id}`, { [field]: value });
    loadData();
    toast.success("Product updated");
  };

  /* ─── Queue & Moderation ─── */
  const updateQueueStatus = async (id: string, status: "waiting" | "displaying" | "displayed" | "skipped") => {
    await api.put(`/admin/queue/${id}`, { status });
    loadData();
    toast.success(`Queue item updated to ${status}`);
  };

  const updateSupporterModeration = async (id: string, status: "pending" | "approved" | "rejected") => {
    await api.put(`/admin/supporters/${id}`, { moderation_status: status });
    loadData();
    toast.success(`Supporter ${status}`);
  };

  /* ─── Fundraising Stats Direct Edit ─── */
  const updateFundraisingStat = async (field: string, value: number) => {
    await api.put("/fundraising/stats", { [field]: value });
    loadData();
    toast.success("Stat updated");
  };

  /* ─── Analytics Memo ─── */
  const analytics = useMemo(() => {
    const raised = (stats?.total_raised_cents || 0) / 100;
    const goal = (stats?.goal_amount_cents || 200000000) / 100;
    const progressPct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
    const standardCount = supporters.filter(s => s.package_type === "standard").length;
    const premiumCount = supporters.filter(s => s.package_type === "premium").length;
    const packageData = [
      { name: "Standard", value: standardCount, color: CHART_COLORS.gold },
      { name: "Premium", value: premiumCount, color: CHART_COLORS.red },
    ].filter(d => d.value > 0);
    const pending = supporters.filter(s => s.moderation_status === "pending").length;
    const approved = supporters.filter(s => s.moderation_status === "approved").length;
    const rejected = supporters.filter(s => s.moderation_status === "rejected").length;
    const moderationData = [
      { name: "Pending", value: pending, color: "hsl(45, 100%, 50%)" },
      { name: "Approved", value: approved, color: CHART_COLORS.green },
      { name: "Rejected", value: rejected, color: CHART_COLORS.red },
    ].filter(d => d.value > 0);
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d; });
    const revenueByDay = days.map(day => {
      const dateStr = day.toISOString().split("T")[0];
      const label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const daySupporters = supporters.filter(s => s.created_at?.startsWith(dateStr) && s.payment_status === "completed");
      const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr) && o.payment_status === "completed");
      const photoRev = daySupporters.reduce((sum: number, s: any) => sum + (s.amount_cents || 0), 0) / 100;
      const merchRev = dayOrders.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0) / 100;
      return { label, "$ Photos": photoRev, "$ Merch": merchRev };
    });
    const queueWaiting = queue.filter(q => q.status === "waiting").length;
    const queueData = [
      { status: "Waiting", count: queueWaiting },
      { status: "Displaying", count: queue.filter(q => q.status === "displaying").length },
      { status: "Displayed", count: queue.filter(q => q.status === "displayed").length },
      { status: "Skipped", count: queue.filter(q => q.status === "skipped").length },
    ];
    const recentActivity = [
      ...supporters.slice(0, 15).map(s => ({ type: "supporter" as const, name: s.name, detail: `${s.package_type} photo — $${(s.amount_cents / 100).toFixed(2)}`, status: s.payment_status, time: s.created_at })),
      ...orders.slice(0, 15).map(o => ({ type: "order" as const, name: o.customer_name, detail: `Order ${o.order_number} — $${(o.total_cents / 100).toFixed(2)}`, status: o.payment_status, time: o.created_at })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
    const completedPayments = supporters.filter(s => s.payment_status === "completed").length + orders.filter(o => o.payment_status === "completed").length;
    const pendingPayments = supporters.filter(s => s.payment_status === "pending").length + orders.filter(o => o.payment_status === "pending").length;
    const failedPayments = supporters.filter(s => s.payment_status === "failed").length + orders.filter(o => o.payment_status === "failed").length;
    const completedOrders = orders.filter(o => o.payment_status === "completed");
    const avgOrderValue = completedOrders.length > 0 ? completedOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0) / completedOrders.length / 100 : 0;
    const completedPhotos = supporters.filter(s => s.payment_status === "completed");
    const avgPhotoValue = completedPhotos.length > 0 ? completedPhotos.reduce((sum, s) => sum + (s.amount_cents || 0), 0) / completedPhotos.length / 100 : 0;
    const totalPhotoRevenue = completedPhotos.reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100;
    const totalMerchRevenue = completedOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0) / 100;
    const revenueBreakdown = [
      { name: "Photos", value: totalPhotoRevenue, color: CHART_COLORS.gold },
      { name: "Merch", value: totalMerchRevenue, color: CHART_COLORS.blue },
    ].filter(d => d.value > 0);
    const fulfillmentPending = orders.filter(o => o.fulfillment_status === "pending").length;
    const fulfillmentShipped = orders.filter(o => o.fulfillment_status === "shipped").length;
    const fulfillmentData = [
      { status: "Pending", count: fulfillmentPending },
      { status: "Submitted", count: orders.filter(o => o.fulfillment_status === "submitted").length },
      { status: "Production", count: orders.filter(o => o.fulfillment_status === "in_production").length },
      { status: "Shipped", count: fulfillmentShipped },
      { status: "Delivered", count: orders.filter(o => o.fulfillment_status === "delivered").length },
    ];
    const topCustomers = customerStats.slice(0, 10);
    const totalEntries = grandPrizeEntries.length;
    const uniqueEntrants = new Set(grandPrizeEntries.map(e => e.email)).size;
    const todayStr = new Date().toISOString().split("T")[0];
    const todaySupporters = supporters.filter(s => s.created_at?.startsWith(todayStr));
    const todayOrders = orders.filter(o => o.created_at?.startsWith(todayStr));
    const todayRevenue = (todaySupporters.filter(s => s.payment_status === "completed").reduce((sum, s) => sum + (s.amount_cents || 0), 0) + todayOrders.filter(o => o.payment_status === "completed").reduce((sum, o) => sum + (o.total_cents || 0), 0)) / 100;
    const totalTransactions = supporters.length + orders.length;
    const conversionRate = totalTransactions > 0 ? ((completedPayments / totalTransactions) * 100) : 0;

    return {
      raised, goal, progressPct, packageData, moderationData, revenueByDay, queueData,
      recentActivity, completedPayments, pendingPayments, failedPayments,
      standardCount, premiumCount, avgOrderValue, avgPhotoValue,
      totalPhotoRevenue, totalMerchRevenue, revenueBreakdown,
      fulfillmentData, fulfillmentPending, fulfillmentShipped,
      topCustomers, totalEntries, uniqueEntrants,
      todayRevenue, todaySupporters: todaySupporters.length, todayOrders: todayOrders.length,
      conversionRate, pending, approved, rejected, queueWaiting,
    };
  }, [stats, supporters, orders, queue, customerStats, grandPrizeEntries]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-primary" size={24} />
          <h1 className="font-display text-2xl text-gradient-gold">ADMIN DASHBOARD</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden sm:block">Updated {lastRefreshed.toLocaleTimeString()}</span>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`text-xs px-2 py-1 rounded-full transition-colors ${autoRefresh ? "bg-green-500/20 text-green-400" : "bg-secondary text-muted-foreground"}`}>
            {autoRefresh ? "Auto ●" : "Auto ○"}
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View Site</a>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Main Navigation Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
           <TabsList className="bg-card border border-border flex-wrap">
            <TabsTrigger value="overview" className="flex items-center gap-2"><BarChart3 size={14} /> Overview</TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2"><Camera size={14} /> Photos</TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2"><ShoppingBag size={14} /> Products</TabsTrigger>
            <TabsTrigger value="stream-queue" className="flex items-center gap-2"><Eye size={14} /> Stream Queue</TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2"><Download size={14} /> Reports</TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2"><Users size={14} /> Data</TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2"><Pencil size={14} /> Manage</TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2"><Mail size={14} /> Emails</TabsTrigger>
            <TabsTrigger value="prize-draw" className="flex items-center gap-2"><Trophy size={14} /> Prize Draw</TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2"><Settings size={14} /> Settings</TabsTrigger>
          </TabsList>

          {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
          <TabsContent value="overview" className="space-y-6">
            {/* Today's Snapshot */}
            <div className="bg-gradient-to-r from-primary/10 via-card to-card border border-primary/20 rounded-xl p-6">
              <h2 className="font-display text-lg text-primary mb-4 flex items-center gap-2"><Zap size={18} /> TODAY'S SNAPSHOT</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Revenue Today" value={`$${analytics.todayRevenue.toLocaleString()}`} icon={DollarSign} color="text-primary" />
                <MiniStat label="New Supporters" value={analytics.todaySupporters} icon={Users} color="text-green-400" />
                <MiniStat label="New Orders" value={analytics.todayOrders} icon={ShoppingBag} color="text-blue-400" />
                <MiniStat label="Queue Waiting" value={analytics.queueWaiting} icon={Clock} color="text-yellow-400" />
              </div>
            </div>
            {/* Primary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Total Raised" value={`$${analytics.raised.toLocaleString()}`} sub={`${analytics.progressPct.toFixed(1)}% of $${analytics.goal.toLocaleString()} goal`} trend={analytics.raised > 0 ? "up" : null} />
              <StatCard icon={Users} label="Supporters" value={(stats?.supporter_count || 0).toLocaleString()} sub={`${analytics.premiumCount} premium · ${analytics.standardCount} standard`} trend={(stats?.supporter_count || 0) > 0 ? "up" : null} />
              <StatCard icon={ShoppingBag} label="Merch Orders" value={(stats?.merch_order_count || 0).toLocaleString()} sub={`${analytics.fulfillmentShipped} shipped · ${analytics.fulfillmentPending} pending`} />
              <StatCard icon={Camera} label="Photos Displayed" value={(stats?.photos_displayed || 0).toLocaleString()} sub={`${analytics.queueWaiting} in queue`} />
            </div>
            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard icon={TrendingUp} label="Avg Order Value" value={`$${analytics.avgOrderValue.toFixed(2)}`} iconColor="text-blue-400" />
              <StatCard icon={Camera} label="Avg Photo Value" value={`$${analytics.avgPhotoValue.toFixed(2)}`} iconColor="text-purple-400" />
              <StatCard icon={Percent} label="Payment Success" value={`${analytics.conversionRate.toFixed(1)}%`} iconColor="text-green-400" />
              <StatCard icon={Trophy} label="Prize Entries" value={analytics.totalEntries.toLocaleString()} sub={`${analytics.uniqueEntrants} unique`} iconColor="text-yellow-400" />
              <StatCard icon={Eye} label="Live Viewers" value={(stats?.current_viewer_count || 0).toLocaleString()} iconColor="text-red-400" />
              <StatCard icon={AlertCircle} label="Needs Moderation" value={analytics.pending.toLocaleString()} sub={`${analytics.approved} approved`} iconColor="text-orange-400" />
            </div>
            {/* Fundraising Progress */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xl text-foreground">FUNDRAISING PROGRESS</h2>
                <span className="text-sm font-medium text-primary">{analytics.progressPct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-4 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${analytics.progressPct}%`, background: `linear-gradient(90deg, ${CHART_COLORS.gold}, ${CHART_COLORS.red})`, boxShadow: `0 0 16px ${CHART_COLORS.gold}80` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>$0</span>
                <span>${(analytics.goal / 2).toLocaleString()}</span>
                <span>${analytics.goal.toLocaleString()}</span>
              </div>
            </div>
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><TrendingUp className="text-primary" size={18} /> REVENUE (LAST 7 DAYS)</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={analytics.revenueByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.4} /><stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} /></linearGradient>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.4} /><stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="$ Photos" stroke={CHART_COLORS.gold} fill="url(#goldGradient)" strokeWidth={2} />
                    <Area type="monotone" dataKey="$ Merch" stroke={CHART_COLORS.blue} fill="url(#blueGradient)" strokeWidth={2} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "hsl(0, 0%, 55%)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><CreditCard className="text-primary" size={18} /> REVENUE SPLIT</h2>
                {analytics.revenueBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart><Pie data={analytics.revenueBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                        {analytics.revenueBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground"><span>Photos</span><span className="text-foreground font-medium">${analytics.totalPhotoRevenue.toLocaleString()}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Merch</span><span className="text-foreground font-medium">${analytics.totalMerchRevenue.toLocaleString()}</span></div>
                    </div>
                  </>
                ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No revenue yet</div>}
              </div>
            </div>
            {/* Mini Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "QUEUE", icon: Clock, data: analytics.queueData, dataKey: "status", color: CHART_COLORS.gold },
                { title: "PACKAGES", icon: Eye, data: analytics.packageData, pie: true },
                { title: "MODERATION", icon: AlertCircle, data: analytics.moderationData, pie: true },
                { title: "FULFILLMENT", icon: Package, data: analytics.fulfillmentData, dataKey: "status", color: CHART_COLORS.blue },
              ].map((chart, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-6">
                  <h2 className="font-display text-sm text-foreground mb-3 flex items-center gap-2"><chart.icon className="text-primary" size={16} /> {chart.title}</h2>
                  {chart.pie ? (
                    chart.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart><Pie data={chart.data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
                          {chart.data.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={chart.data as any[]} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" />
                        <XAxis dataKey={chart.dataKey} tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill={chart.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ))}
            </div>
            {/* Payment Health + Top Customers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><Activity className="text-primary" size={18} /> PAYMENT HEALTH</h2>
                <div className="space-y-3">
                  {[
                    { label: "Completed", count: analytics.completedPayments, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
                    { label: "Pending", count: analytics.pendingPayments, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    { label: "Failed", count: analytics.failedPayments, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-3 p-3 rounded-lg ${item.bg}`}>
                      <item.icon size={20} className={item.color} />
                      <div className="flex-1"><p className="text-sm font-medium text-foreground">{item.label}</p></div>
                      <p className={`font-display text-2xl ${item.color}`}>{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><Star className="text-primary" size={18} /> TOP CUSTOMERS</h2>
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 sticky top-0"><tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Photos</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Merch</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Entries</th>
                    </tr></thead>
                    <tbody>
                      {analytics.topCustomers.length > 0 ? analytics.topCustomers.map((c: any, i: number) => (
                        <tr key={c.id} className="border-t border-border hover:bg-secondary/20">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 text-foreground">{c.email}</td>
                          <td className="p-2 text-right text-primary font-medium">${(c.total_spent_cents / 100).toFixed(2)}</td>
                          <td className="p-2 text-right text-muted-foreground">{c.photo_purchase_count}</td>
                          <td className="p-2 text-right text-muted-foreground">{c.merch_purchase_count}</td>
                          <td className="p-2 text-right"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{c.grand_prize_entries}</span></td>
                        </tr>
                      )) : <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No customer data yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ PHOTOS TAB ═══════════════════ */}
          <TabsContent value="photos" className="space-y-6">
            {/* Photo Package Configuration */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                  <Crown className="text-primary" size={18} /> PHOTO PACKAGES ({photoPackages.length})
                </h2>
                <button
                  onClick={async () => {
                    try {
                      await api.post("/admin/packages", {
                        slug: `package-${Date.now()}`,
                        name: "New Package",
                        price_cents: 1000,
                        display_duration_seconds: 15,
                        has_badge: false,
                        active: false,
                        sort_order: photoPackages.length,
                      });
                      toast.success("Package created"); loadData();
                    } catch (err: any) { toast.error(err?.message || "Failed to create package"); }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-sm hover:bg-primary/30"
                >
                  <Plus size={14} /> Add Package
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Configure the photo packages available on the public site. Pricing is automatically used in Stripe checkout.</p>

              {photoPackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No packages configured. Add one to enable photo purchases.</p>
              ) : (
                <div className="space-y-3">
                  {photoPackages.map((pkg: any) => (
                    <div key={pkg.id} className={`border rounded-xl p-4 space-y-3 ${pkg.active ? "border-border bg-card" : "border-border/50 bg-secondary/20 opacity-70"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {pkg.active ? "Active" : "Inactive"}
                          </span>
                          <span className="font-display text-foreground">{pkg.name}</span>
                          <span className="text-primary font-mono-num font-bold">${(pkg.price_cents / 100).toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">{pkg.display_duration_seconds}s • {pkg.has_badge ? "Badge ✓" : "No badge"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={pkg.active ?? false} onCheckedChange={() => togglePackageActive(pkg.id, pkg.active)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Name</label>
                          <input defaultValue={pkg.name} onBlur={(e) => e.target.value !== pkg.name && updatePackageField(pkg.id, "name", e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Slug</label>
                          <input defaultValue={pkg.slug} onBlur={(e) => e.target.value !== pkg.slug && updatePackageField(pkg.id, "slug", e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Price ($)</label>
                          <input type="number" step="0.01" defaultValue={(pkg.price_cents / 100).toFixed(2)}
                            onBlur={(e) => { const cents = Math.round(parseFloat(e.target.value) * 100); if (cents !== pkg.price_cents) updatePackageField(pkg.id, "price_cents", cents); }}
                            className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Display (seconds)</label>
                          <input type="number" defaultValue={pkg.display_duration_seconds}
                            onBlur={(e) => { const val = parseInt(e.target.value); if (val !== pkg.display_duration_seconds) updatePackageField(pkg.id, "display_duration_seconds", val); }}
                            className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div className="flex items-end gap-3">
                          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                            <input type="checkbox" defaultChecked={pkg.has_badge} onChange={(e) => updatePackageField(pkg.id, "has_badge", e.target.checked)}
                              className="rounded border-border" />
                            Badge
                          </label>
                          <button onClick={async () => {
                            if (!confirm(`Delete "${pkg.name}"?`)) return;
                            await api.delete(`/admin/packages/${pkg.id}`);
                            toast.success("Package deleted"); loadData();
                          }} className="text-red-400 hover:text-red-300 text-xs px-2 py-1">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AdminPhotoManager supporters={supporters} onDataChanged={loadData} />
          </TabsContent>

          {/* ═══════════════════ PRODUCTS TAB ═══════════════════ */}
          <TabsContent value="products" className="space-y-6">
            <AdminProductManager merchandise={merchandise} onDataChanged={loadData} />
          </TabsContent>




          {/* ═══════════════════ REPORTS TAB ═══════════════════ */}
          <TabsContent value="reports" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                <Download className="text-primary" size={18} /> EXPORT & REPORTS
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Download comprehensive CSV reports for all data. Each export includes full details with payment info, timestamps, and status.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Photo Submissions Report */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Camera className="text-primary" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Photo Submissions</h3>
                      <p className="text-xs text-muted-foreground">{supporters.length} records</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Name, email, package, amount, payment status, moderation, Stripe IDs, display status, photo URL, timestamps.</p>
                  <button onClick={() => exportSupporters(supporters)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                {/* Orders Report */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Package className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Merch Orders</h3>
                      <p className="text-xs text-muted-foreground">{orders.length} records</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Order #, customer, total, subtotal, shipping, payment & fulfillment status, tracking, Stripe PI, item count, date.</p>
                  <button onClick={() => exportOrders(orders)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                {/* Customer Stats Report */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <UserCog className="text-green-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Customer Stats</h3>
                      <p className="text-xs text-muted-foreground">{customerStats.length} records</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Email, total spent, photo & merch purchase counts, grand prize entries, first purchase date.</p>
                  <button onClick={() => exportCustomers(customerStats)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                {/* Stream Queue Report */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Clock className="text-yellow-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Stream Queue</h3>
                      <p className="text-xs text-muted-foreground">{queue.length} records</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Queue position, supporter name/email, package, duration, status, badge, display timestamps.</p>
                  <button onClick={() => exportQueue(queue)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                {/* Grand Prize Entries Report */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Trophy className="text-purple-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Grand Prize Entries</h3>
                      <p className="text-xs text-muted-foreground">{grandPrizeEntries.length} records</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Email, entry type (photo/merch), amount, reference ID, date.</p>
                  <button onClick={() => exportPrizeEntries(grandPrizeEntries)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                {/* Full Revenue Summary */}
                <div className="border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="text-primary" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Revenue Summary</h3>
                      <p className="text-xs text-muted-foreground">Combined report</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">All completed payments (photos + merch) with customer, type, amount, date — single combined file.</p>
                  <button onClick={() => {
                    const photoRows = supporters.filter(s => s.payment_status === "completed").map(s => ({
                      type: "Photo",
                      customer_name: s.name,
                      customer_email: s.email,
                      amount: `$${(s.amount_cents / 100).toFixed(2)}`,
                      package_or_items: s.package_type,
                      stripe_payment_intent: s.stripe_payment_intent_id || "",
                      date: s.created_at,
                    }));
                    const merchRows = orders.filter(o => o.payment_status === "completed").map(o => ({
                      type: "Merch",
                      customer_name: o.customer_name,
                      customer_email: o.customer_email,
                      amount: `$${(o.total_cents / 100).toFixed(2)}`,
                      package_or_items: `${o.order_items?.length || 0} items`,
                      stripe_payment_intent: o.stripe_payment_intent_id || "",
                      date: o.created_at,
                    }));
                    const combined = [...photoRows, ...merchRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    if (combined.length > 0) {
                      exportToCsv("revenue_summary", combined);
                    } else {
                      toast("No completed payments to export");
                    }
                  }} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Summary Stats */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="text-primary" size={18} /> SUMMARY METRICS
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="font-display text-2xl text-primary">${analytics.raised.toLocaleString()}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Photo Revenue</p>
                  <p className="font-display text-2xl text-foreground">${analytics.totalPhotoRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Merch Revenue</p>
                  <p className="font-display text-2xl text-foreground">${analytics.totalMerchRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Avg Order Value</p>
                  <p className="font-display text-2xl text-foreground">${analytics.avgOrderValue.toFixed(2)}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                  <p className="font-display text-2xl text-green-400">{analytics.conversionRate.toFixed(1)}%</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Unique Customers</p>
                  <p className="font-display text-2xl text-foreground">{customerStats.length}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Prize Entries</p>
                  <p className="font-display text-2xl text-foreground">{analytics.totalEntries}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Queue Waiting</p>
                  <p className="font-display text-2xl text-yellow-400">{analytics.queueWaiting}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ DATA TAB ═══════════════════ */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent Activity */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><Activity className="text-primary" size={18} /> RECENT ACTIVITY</h2>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {analytics.recentActivity.length > 0 ? analytics.recentActivity.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.status === "completed" ? "bg-green-400" : item.status === "failed" ? "bg-red-400" : "bg-yellow-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(item.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                      <span className={`text-xs shrink-0 px-2 py-0.5 rounded-full ${item.type === "supporter" ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400"}`}>
                        {item.type === "supporter" ? "Photo" : "Order"}
                      </span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>}
                </div>
              </div>
              {/* Data Tables */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="supporters" className="space-y-4">
                  <TabsList className="bg-card border border-border">
                    <TabsTrigger value="supporters">Supporters ({supporters.length})</TabsTrigger>
                    <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                    <TabsTrigger value="customers">Customers ({customerStats.length})</TabsTrigger>
                    <TabsTrigger value="queue">Queue ({queue.length})</TabsTrigger>
                    <TabsTrigger value="prizes">Prizes ({grandPrizeEntries.length})</TabsTrigger>
                  </TabsList>
                  {/* Supporters */}
                  <TabsContent value="supporters">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => exportSupporters(supporters)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary/50 sticky top-0"><tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Package</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Moderation</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                          </tr></thead>
                          <tbody>
                            {supporters.map((s) => (
                              <tr key={s.id} className="border-t border-border hover:bg-secondary/20">
                                <td className="p-3"><p className="text-foreground font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${s.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.package_type}</span></td>
                                <td className="p-3 text-foreground">${(s.amount_cents / 100).toFixed(2)}</td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${s.payment_status === "completed" ? "bg-green-500/20 text-green-400" : s.payment_status === "failed" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{s.payment_status}</span></td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${s.moderation_status === "approved" ? "bg-green-500/20 text-green-400" : s.moderation_status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{s.moderation_status}</span></td>
                                <td className="p-3">{s.moderation_status === "pending" && (
                                  <div className="flex gap-1">
                                    <button onClick={() => updateSupporterModeration(s.id, "approved")} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">✓</button>
                                    <button onClick={() => updateSupporterModeration(s.id, "rejected")} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">✗</button>
                                  </div>
                                )}</td>
                              </tr>
                            ))}
                            {supporters.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No supporters yet</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </TabsContent>
                  {/* Orders */}
                  <TabsContent value="orders">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => exportOrders(orders)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                    <AdminOrderManager orders={orders} onDataChanged={loadData} />
                  </TabsContent>
                  {/* Customers */}
                  <TabsContent value="customers">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => exportCustomers(customerStats)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                    <AdminCustomerManager customerStats={customerStats} supporters={supporters} orders={orders} />
                  </TabsContent>
                  {/* Queue */}
                  <TabsContent value="queue">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => exportQueue(queue)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary/50 sticky top-0"><tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Supporter</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Package</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                          </tr></thead>
                          <tbody>
                            {queue.map((q) => (
                              <tr key={q.id} className="border-t border-border hover:bg-secondary/20">
                                <td className="p-3 text-foreground">{q.queue_position}</td>
                                <td className="p-3"><p className="text-foreground">{q.supporters?.name || "Unknown"}</p><p className="text-xs text-muted-foreground">{q.supporters?.email}</p></td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${q.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{q.package_type}</span></td>
                                <td className="p-3 text-muted-foreground">{q.display_duration_seconds}s</td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${q.status === "displaying" ? "bg-green-500/20 text-green-400" : q.status === "displayed" ? "bg-secondary text-muted-foreground" : q.status === "skipped" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{q.status}</span></td>
                                <td className="p-3">
                                  {q.status === "waiting" && <div className="flex gap-1"><button onClick={() => updateQueueStatus(q.id, "displaying")} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">Display</button><button onClick={() => updateQueueStatus(q.id, "skipped")} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Skip</button></div>}
                                  {q.status === "displaying" && <button onClick={() => updateQueueStatus(q.id, "displayed")} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30">Mark Done</button>}
                                </td>
                              </tr>
                            ))}
                            {queue.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Queue is empty</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </TabsContent>
                  {/* Prizes */}
                  <TabsContent value="prizes">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => exportPrizeEntries(grandPrizeEntries)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-medium">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-2">
                        <Trophy className="text-primary" size={16} />
                        <span className="text-sm font-medium text-foreground">{analytics.totalEntries} entries from {analytics.uniqueEntrants} participants</span>
                      </div>
                      <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary/50 sticky top-0"><tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                          </tr></thead>
                          <tbody>
                            {grandPrizeEntries.map((e: any) => (
                              <tr key={e.id} className="border-t border-border hover:bg-secondary/20">
                                <td className="p-3 text-foreground">{e.email}</td>
                                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${e.entry_type === "photo" ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400"}`}>{e.entry_type}</span></td>
                                <td className="p-3 text-foreground">${(e.amount_cents / 100).toFixed(2)}</td>
                                <td className="p-3 text-muted-foreground text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                            {grandPrizeEntries.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No prize entries yet</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ MANAGE TAB ═══════════════════ */}
          <TabsContent value="manage" className="space-y-6">
            {/* Photo Packages Management */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><Camera className="text-primary" size={18} /> PHOTO PACKAGES</h2>
              <div className="space-y-4">
                {photoPackages.map((pkg) => (
                  <div key={pkg.id} className={`border rounded-xl p-5 transition-colors ${pkg.active ? "border-border bg-card" : "border-border/50 bg-secondary/20 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-xl text-foreground">{pkg.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${pkg.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{pkg.active ? "Active" : "Disabled"}</span>
                      </div>
                      <Switch checked={pkg.active} onCheckedChange={() => togglePackageActive(pkg.id, pkg.active)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Price ($)</label>
                        <input type="number" step="0.01" defaultValue={(pkg.price_cents / 100).toFixed(2)} onBlur={(e) => updatePackageField(pkg.id, "price_cents", Math.round(parseFloat(e.target.value) * 100))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Display Duration (s)</label>
                        <input type="number" defaultValue={pkg.display_duration_seconds} onBlur={(e) => updatePackageField(pkg.id, "display_duration_seconds", parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Has Badge</label>
                        <Switch checked={pkg.has_badge} onCheckedChange={(v) => updatePackageField(pkg.id, "has_badge", v)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Sort Order</label>
                        <input type="number" defaultValue={pkg.sort_order} onBlur={(e) => updatePackageField(pkg.id, "sort_order", parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Description</label>
                        <input type="text" defaultValue={pkg.description || ""} onBlur={(e) => updatePackageField(pkg.id, "description", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Stripe Price ID <span className="text-muted-foreground/50">(optional)</span></label>
                        <input type="text" defaultValue={pkg.stripe_price_id || ""} placeholder="price_..." onBlur={(e) => updatePackageField(pkg.id, "stripe_price_id", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary" />
                        <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Zap size={10} /> {siteSettings.stripe_connected === "true" ? "Leave empty — price is auto-generated from the package price at checkout" : "Connect Stripe in Settings → Integrations first"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {photoPackages.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No photo packages configured</p>}
              </div>
            </div>

            {/* Merchandise Management */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><ShoppingBag className="text-primary" size={18} /> MERCHANDISE</h2>
              <div className="space-y-4">
                {merchandise.map((item) => (
                  <div key={item.id} className={`border rounded-xl p-5 transition-colors ${item.active ? "border-border bg-card" : "border-border/50 bg-secondary/20 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-xl text-foreground">{item.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${item.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{item.active ? "Active" : "Disabled"}</span>
                      </div>
                      <Switch checked={item.active} onCheckedChange={() => toggleMerchActive(item.id, item.active)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Price ($)</label>
                        <input type="number" step="0.01" defaultValue={(item.price_cents / 100).toFixed(2)} onBlur={(e) => updateMerchField(item.id, "price_cents", Math.round(parseFloat(e.target.value) * 100))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Stock Quantity</label>
                        <input type="number" defaultValue={item.stock_quantity} onBlur={(e) => updateMerchField(item.id, "stock_quantity", parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Sort Order</label>
                        <input type="number" defaultValue={item.sort_order} onBlur={(e) => updateMerchField(item.id, "sort_order", parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Printful Product ID</label>
                        <input type="text" defaultValue={item.printful_product_id || ""} onBlur={(e) => updateMerchField(item.id, "printful_product_id", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 12345" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground block mb-1">Description</label>
                      <input type="text" defaultValue={item.description || ""} onBlur={(e) => updateMerchField(item.id, "description", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                ))}
                {merchandise.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No merchandise configured</p>}
              </div>
            </div>

            {/* Fundraising Stats Direct Edit */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2"><DollarSign className="text-primary" size={18} /> FUNDRAISING STATS (Manual Override)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Raised (cents)", field: "total_raised_cents", value: stats?.total_raised_cents || 0 },
                  { label: "Supporter Count", field: "supporter_count", value: stats?.supporter_count || 0 },
                  { label: "Merch Order Count", field: "merch_order_count", value: stats?.merch_order_count || 0 },
                  { label: "Photos Displayed", field: "photos_displayed", value: stats?.photos_displayed || 0 },
                  { label: "Current Viewers", field: "current_viewer_count", value: stats?.current_viewer_count || 0 },
                  { label: "Goal Amount (cents)", field: "goal_amount_cents", value: stats?.goal_amount_cents || 200000000 },
                ].map((stat) => (
                  <div key={stat.field}>
                    <label className="text-xs text-muted-foreground block mb-1">{stat.label}</label>
                    <input type="number" defaultValue={stat.value} onBlur={(e) => updateFundraisingStat(stat.field, parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ EMAILS TAB ═══════════════════ */}
          <TabsContent value="emails" className="space-y-6">
            <AdminEmailManager />
          </TabsContent>

          {/* ═══════════════════ PRIZE DRAW TAB ═══════════════════ */}
          <TabsContent value="prize-draw" className="space-y-6">
            <AdminPrizeDrawManager />
          </TabsContent>

          {/* ═══════════════════ SETTINGS TAB ═══════════════════ */}
          <TabsContent value="settings" className="space-y-6">
            {/* Save Bar */}
            {settingsDirty && (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm text-primary font-medium">You have unsaved changes</p>
                <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50">
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save All Settings
                </button>
              </div>
            )}

            {/* ── INTEGRATIONS ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Link2 className="text-blue-400" size={18} /> INTEGRATIONS</h2>
              <p className="text-xs text-muted-foreground mb-4">Enable integrations and provide API credentials. Settings are saved when you click "Save All Settings".</p>

              {/* Stripe */}
              <div className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CreditCard size={16} className="text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Stripe Payments</p>
                      <p className="text-xs text-muted-foreground">Accept credit card payments via Stripe</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${siteSettings.stripe_connected === "true" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {siteSettings.stripe_connected === "true" ? "Connected" : "Disconnected"}
                    </span>
                    <Switch checked={siteSettings.stripe_connected === "true"} onCheckedChange={(v) => updateSetting("stripe_connected", v ? "true" : "false")} />
                  </div>
                </div>
                {siteSettings.stripe_connected === "true" && (
                  <div className="mt-4 ml-6 space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Stripe Publishable Key</label>
                      <SettingInput value={siteSettings.stripe_publishable_key || ""} onChange={(v) => updateSetting("stripe_publishable_key", v)} placeholder="pk_live_..." warning={!siteSettings.stripe_publishable_key?.trim() ? "Required for payments to work" : undefined} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Stripe Secret Key</label>
                      <SettingInput value={siteSettings.stripe_secret_key || ""} onChange={(v) => updateSetting("stripe_secret_key", v)} placeholder="sk_live_... or sk_test_..." warning={!siteSettings.stripe_secret_key?.trim() ? "Required for payments to work" : undefined} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Stripe Webhook URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/payments/webhooks/stripe`}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-mono select-all focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/payments/webhooks/stripe`);
                            toast.success("Webhook URL copied!");
                          }}
                          className="shrink-0 px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        📋 Paste this URL in your Stripe Dashboard → Developers → Webhooks → Add endpoint. Listen for: <code className="text-primary/80">checkout.session.completed</code>, <code className="text-primary/80">payment_intent.payment_failed</code>, <code className="text-primary/80">charge.refunded</code>.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Stripe Webhook Signing Secret <span className="text-muted-foreground/50">(optional)</span></label>
                      <SettingInput value={siteSettings.stripe_webhook_secret || ""} onChange={(v) => updateSetting("stripe_webhook_secret", v)} placeholder="whsec_..." />
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        ✅ <strong>Not required</strong> — payments work without this. It adds extra security. After adding the webhook endpoint in Stripe, copy the Signing secret (starts with <code className="text-primary/80">whsec_</code>) and paste it here.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground/70">⚠️ Keep your Secret Key safe. It's stored in the database and used by backend functions for payment processing.</p>
                  </div>
                )}
              </div>

              {/* Printful */}
              <div className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Package size={16} className="text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Printful Fulfillment</p>
                      <p className="text-xs text-muted-foreground">Auto-fulfill merchandise orders via Printful</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${siteSettings.printful_connected === "true" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {siteSettings.printful_connected === "true" ? "Connected" : "Disconnected"}
                    </span>
                    <Switch checked={siteSettings.printful_connected === "true"} onCheckedChange={(v) => updateSetting("printful_connected", v ? "true" : "false")} />
                  </div>
                </div>
                {siteSettings.printful_connected === "true" && (
                  <div className="mt-4 ml-6 space-y-4 p-4 bg-secondary/30 rounded-lg border border-border">
                    {/* Setup Guide */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary">📋 Setup Guide</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to <a href="https://www.printful.com/dashboard/settings/store-api" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Printful Dashboard → Settings → Store API</a></li>
                        <li>Click <strong>"Add new token"</strong>, name it (e.g. "Burger Token")</li>
                        <li>Enable <strong>all scopes</strong> (View/manage orders, store info, products, files, webhooks, templates)</li>
                        <li>Copy the generated <strong>Access Key</strong> and paste below</li>
                        <li>Find your <strong>Store ID</strong> in Printful Dashboard URL: <code className="text-primary/80">printful.com/dashboard/<strong>store-id</strong>/...</code> or from Store Settings</li>
                        <li>Copy the <strong>Webhook URL</strong> below and add it in <a href="https://www.printful.com/dashboard/settings/store-api" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Printful → Settings → Webhooks</a></li>
                      </ol>
                    </div>

                    {/* Required Scopes Info */}
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-foreground mb-1">✅ Required API Token Scopes</p>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          "View all orders", "View and manage all orders",
                          "View all store information", "View store information and manage store settings",
                          "View all store products", "View and manage all store products",
                          "View all store files", "View and manage all store files",
                          "View webhooks", "View and manage webhooks",
                          "View product templates", "View and manage product templates",
                        ].map((scope) => (
                          <p key={scope} className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="text-green-400">✓</span> {scope}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Printful API Key (Access Token)</label>
                      <SettingInput value={siteSettings.printful_api_key || ""} onChange={(v) => updateSetting("printful_api_key", v)} placeholder="sEHrMDe5Ow69VLX8sLcsK4..." warning={!siteSettings.printful_api_key?.trim() ? "Required for order fulfillment" : undefined} />
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Get from: <a href="https://www.printful.com/dashboard/settings/store-api" target="_blank" rel="noopener noreferrer" className="text-primary underline">Printful → Settings → Store API → Tokens</a>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Printful Store ID</label>
                      <SettingInput value={siteSettings.printful_store_id || ""} onChange={(v) => updateSetting("printful_store_id", v)} placeholder="e.g. 12345678" warning={!siteSettings.printful_store_id?.trim() ? "Required for order routing" : undefined} />
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Find in your Printful dashboard URL or <a href="https://www.printful.com/dashboard/default" target="_blank" rel="noopener noreferrer" className="text-primary underline">Printful Dashboard → Stores</a>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Webhook URL (add this to Printful)</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-secondary px-2 py-1.5 rounded text-primary font-mono flex-1 truncate">
                          {`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/merchandise/webhooks/printful`}
                        </code>
                        <button onClick={() => { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/merchandise/webhooks/printful`); toast.success("Webhook URL copied!"); }}
                          className="text-xs px-2 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">Copy</button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Add at: <a href="https://www.printful.com/dashboard/settings/store-api" target="_blank" rel="noopener noreferrer" className="text-primary underline">Printful → Settings → Webhooks → Add Webhook</a> — select events: order_created, package_shipped, order_failed, order_canceled
                      </p>
                    </div>

                    {/* How Products Connect */}
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-accent">🔗 How Products Connect to Printful</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Each product in the <strong>Products</strong> tab has a <strong>Printful Product ID</strong> and <strong>Printful Variant ID</strong> field.
                        When a customer completes a merchandise purchase, the system automatically creates a Printful fulfillment order using those IDs.
                        Make sure each product's Printful Variant ID matches the variant in your Printful store for correct fulfillment.
                        Find your Printful variant IDs in: <a href="https://www.printful.com/dashboard/default" target="_blank" rel="noopener noreferrer" className="text-primary underline">My Products → click product → variant details</a>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Klaviyo */}
              <div className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Mail size={16} className="text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Klaviyo Email</p>
                      <p className="text-xs text-muted-foreground">Send email events (purchase confirmations, photo-live notifications)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${siteSettings.klaviyo_connected === "true" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {siteSettings.klaviyo_connected === "true" ? "Connected" : "Disconnected"}
                    </span>
                    <Switch checked={siteSettings.klaviyo_connected === "true"} onCheckedChange={(v) => updateSetting("klaviyo_connected", v ? "true" : "false")} />
                  </div>
                </div>
                {siteSettings.klaviyo_connected === "true" && (
                  <div className="mt-4 ml-6 space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Klaviyo Private API Key</label>
                      <SettingInput value={siteSettings.klaviyo_api_key || ""} onChange={(v) => updateSetting("klaviyo_api_key", v)} placeholder="pk_..." warning={!siteSettings.klaviyo_api_key?.trim() ? "Required for sending emails" : undefined} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Klaviyo List ID (for subscribers)</label>
                      <SettingInput value={siteSettings.klaviyo_list_id || ""} onChange={(v) => updateSetting("klaviyo_list_id", v)} placeholder="e.g. AbCdEf" />
                    </div>
                  </div>
                )}
              </div>

              {/* Resend (Transactional Email) */}
              <div className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Mail size={16} className="text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Resend (Email Delivery)</p>
                      <p className="text-xs text-muted-foreground">Send transactional emails (purchase confirmations, display notifications, winner alerts)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${siteSettings.resend_api_key ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {siteSettings.resend_api_key ? "Connected" : "Not configured"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 ml-6 space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Resend API Key</label>
                    <SettingInput value={siteSettings.resend_api_key || ""} onChange={(v) => updateSetting("resend_api_key", v)} placeholder="re_..." warning={!siteSettings.resend_api_key?.trim() ? "Required for sending emails" : undefined} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">From Email Address</label>
                    <SettingInput value={siteSettings.email_from_address || ""} onChange={(v) => updateSetting("email_from_address", v)} placeholder="noreply@yourdomain.com or onboarding@resend.dev" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">From Name</label>
                    <SettingInput value={siteSettings.email_from_name || ""} onChange={(v) => updateSetting("email_from_name", v)} placeholder="The Last McDonald's Burger" />
                  </div>
                  <p className="text-xs text-muted-foreground">Free tier: 100 emails/day. Get your key at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">resend.com</a></p>
                </div>
              </div>

              {/* Content Moderation */}
              <div className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ShieldCheck size={16} className="text-yellow-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Content Moderation</p>
                      <p className="text-xs text-muted-foreground">Auto-moderate uploaded photos for explicit content</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${siteSettings.content_moderation_enabled === "true" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {siteSettings.content_moderation_enabled === "true" ? "Connected" : "Disconnected"}
                    </span>
                    <Switch checked={siteSettings.content_moderation_enabled === "true"} onCheckedChange={(v) => updateSetting("content_moderation_enabled", v ? "true" : "false")} />
                  </div>
                </div>
                {siteSettings.content_moderation_enabled === "true" && (
                  <div className="mt-4 ml-6 space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Moderation Provider</label>
                      <select
                        value={siteSettings.moderation_provider || "lovable_ai"}
                        onChange={(e) => updateSetting("moderation_provider", e.target.value)}
                        className="w-64 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="lovable_ai">Lovable AI (Built-in)</option>
                        <option value="custom">Custom API</option>
                      </select>
                    </div>
                    {siteSettings.moderation_provider === "custom" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Custom Moderation API URL</label>
                        <SettingInput value={siteSettings.moderation_api_url || ""} onChange={(v) => updateSetting("moderation_api_url", v)} placeholder="https://api.example.com/moderate" warning={!siteSettings.moderation_api_url?.trim() ? "Required for custom moderation" : undefined} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Auto-reject threshold</label>
                      <select
                        value={siteSettings.moderation_threshold || "high"}
                        onChange={(e) => updateSetting("moderation_threshold", e.target.value)}
                        className="w-64 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="low">Low (block only extreme content)</option>
                        <option value="medium">Medium (balanced)</option>
                        <option value="high">High (strict moderation)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── LIVE STREAM ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Youtube className="text-red-400" size={18} /> LIVE STREAM</h2>
              <SettingRow label="Show Live Stream Section" description="Toggle the entire livestream section on the homepage">
                <Switch checked={siteSettings.livestream_enabled === "true"} onCheckedChange={(v) => updateSetting("livestream_enabled", v ? "true" : "false")} />
              </SettingRow>
              <SettingRow label="YouTube Video ID" description="The ID from youtube.com/watch?v=THIS_PART">
                <SettingInput value={siteSettings.youtube_video_id || ""} onChange={(v) => updateSetting("youtube_video_id", v)} placeholder="e.g. dQw4w9WgXcQ" />
              </SettingRow>
              <SettingRow label="Enable Chat Embed" description="Show YouTube live chat alongside the stream player">
                <Switch checked={siteSettings.youtube_chat_enabled === "true"} onCheckedChange={(v) => updateSetting("youtube_chat_enabled", v ? "true" : "false")} />
              </SettingRow>
              <SettingRow label="Auto-play Stream" description="Automatically play the video when the page loads (requires muted)">
                <Switch checked={siteSettings.stream_autoplay !== "false"} onCheckedChange={(v) => updateSetting("stream_autoplay", v ? "true" : "false")} />
              </SettingRow>
              <SettingRow label="Start Muted" description="Start the stream muted (required for autoplay in most browsers)">
                <Switch checked={siteSettings.stream_muted !== "false"} onCheckedChange={(v) => updateSetting("stream_muted", v ? "true" : "false")} />
              </SettingRow>
              <SettingRow label="Stream Status Override" description="Force stream status regardless of YouTube state">
                <select
                  value={siteSettings.stream_status_override || "auto"}
                  onChange={(e) => { updateSetting("stream_status_override", e.target.value); }}
                  className="w-64 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="live">Force Live</option>
                  <option value="offline">Force Offline</option>
                  <option value="countdown">Countdown Timer</option>
                </select>
              </SettingRow>
              <SettingRow label="Countdown Date" description="If stream status is 'Countdown Timer', show countdown to this date/time">
                <SettingInput type="datetime-local" value={siteSettings.stream_countdown_date || ""} onChange={(v) => updateSetting("stream_countdown_date", v)} />
              </SettingRow>
              <SettingRow label="YouTube Data API Key" description="Required for auto-fetching live viewer count. Get from Google Cloud Console → APIs → YouTube Data API v3. Add your backend URL to the allowed referrers list.">
                <SettingInput value={siteSettings.youtube_api_key || ""} onChange={(v) => updateSetting("youtube_api_key", v)} placeholder="AIzaSy..." />
              </SettingRow>
              <SettingRow label="Auto-Sync Viewer Count" description="Fetch live viewer count from YouTube and update the 'Watching Now' stat">
                <button
                  onClick={async () => {
                    try {
                      const data = await api.get("/stream/youtube-viewers");
                      if (data?.error) {
                        toast.error(data.error);
                      } else if (data?.is_live) {
                        toast.success(`Live viewers updated: ${data.concurrent_viewers.toLocaleString()}`);
                        loadData();
                      } else {
                        toast.info(`Stream not live. Total views: ${data?.total_views?.toLocaleString() || 0}`);
                      }
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to fetch YouTube viewers");
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
                >
                  <Youtube size={14} /> Fetch Now
                </button>
              </SettingRow>
            </div>

            {/* ── STREAM PHOTO DISPLAY ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Eye className="text-primary" size={18} /> STREAM PHOTO DISPLAY</h2>
              <p className="text-xs text-muted-foreground mb-4">Control how supporter photos cycle on the public stream player.</p>
              <SettingRow label="Overlay Position" description="Where the photo overlay appears on the stream player">
                <select
                  value={siteSettings.overlay_position || "bottom-right"}
                  onChange={(e) => updateSetting("overlay_position", e.target.value)}
                  className="w-64 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="center">Center</option>
                </select>
              </SettingRow>
              <SettingRow label="Overlay Size" description="Size of the photo overlay on the stream player">
                <select
                  value={siteSettings.overlay_size || "small"}
                  onChange={(e) => updateSetting("overlay_size", e.target.value)}
                  className="w-64 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </SettingRow>
              <SettingRow label="Interval Between Photos (seconds)" description="Gap in seconds between each photo display on the stream player">
                <SettingInput type="number" value={siteSettings.queue_interval_seconds || "5"} onChange={(v) => updateSetting("queue_interval_seconds", v)} placeholder="5" />
              </SettingRow>
              <SettingRow label="Enable Queue Looping" description="When no new photos are waiting, replay recently displayed photos">
                <Switch checked={siteSettings.queue_loop_enabled === "true"} onCheckedChange={(v) => updateSetting("queue_loop_enabled", v ? "true" : "false")} />
              </SettingRow>
              {siteSettings.queue_loop_enabled === "true" && (
                <SettingRow label="Loop Window (hours)" description="How many hours of past photos to loop through when queue is empty">
                  <SettingInput type="number" value={siteSettings.queue_loop_hours || "24"} onChange={(v) => updateSetting("queue_loop_hours", v)} placeholder="24" />
                </SettingRow>
              )}
            </div>

            {/* ── DISPLAY & CONTENT ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Image className="text-purple-400" size={18} /> DISPLAY & CONTENT</h2>
              <SettingRow label="Hero Headline" description="Main headline on the landing page">
                <SettingInput value={siteSettings.hero_headline || ""} onChange={(v) => updateSetting("hero_headline", v)} placeholder="e.g. THE LAST BURGER" />
              </SettingRow>
              <SettingRow label="Hero Subheadline" description="Secondary text below the headline">
                <SettingInput value={siteSettings.hero_subheadline || ""} onChange={(v) => updateSetting("hero_subheadline", v)} placeholder="e.g. Join the ultimate..." />
              </SettingRow>
              <SettingRow label="CTA Button Text" description="Text on the main call-to-action button">
                <SettingInput value={siteSettings.cta_button_text || ""} onChange={(v) => updateSetting("cta_button_text", v)} placeholder="e.g. Show Your Photo" />
              </SettingRow>
              <SettingRow label="Footer Text" description="Text displayed in the site footer">
                <SettingInput value={siteSettings.footer_text || ""} onChange={(v) => updateSetting("footer_text", v)} placeholder="e.g. © 2026 The Last Burger" />
              </SettingRow>
              <SettingRow label="Announcement Banner" description="Optional banner message shown at the top of the page (leave empty to hide)">
                <SettingInput value={siteSettings.announcement_banner || ""} onChange={(v) => updateSetting("announcement_banner", v)} placeholder="e.g. 🔥 Live now!" />
              </SettingRow>
              <SettingRow label="Grand Prize Draw Date" description="Countdown timer target date (YYYY-MM-DD format, e.g. 2026-06-15)">
                <SettingInput value={siteSettings.grand_prize_draw_date || ""} onChange={(v) => updateSetting("grand_prize_draw_date", v)} placeholder="e.g. 2026-06-15" />
              </SettingRow>
            </div>

            {/* ── FEATURE TOGGLES ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Power className="text-green-400" size={18} /> FEATURE TOGGLES</h2>
              <p className="text-xs text-muted-foreground mb-4">Enable or disable entire sections of the website.</p>
              {[
                { key: "photo_submissions_enabled", label: "Photo Submissions", desc: "Allow visitors to submit photos for the stream" },
                { key: "merch_store_enabled", label: "Merchandise Store", desc: "Show the merch section on the homepage" },
                { key: "grand_prize_enabled", label: "Grand Prize Section", desc: "Display the grand prize draw info" },
                { key: "faq_enabled", label: "FAQ Section", desc: "Show the frequently asked questions section" },
                { key: "stream_queue_visible", label: "Stream Queue (Public)", desc: "Show the photo display queue to visitors on the homepage" },
                { key: "fundraising_tracker_visible", label: "Fundraising Tracker", desc: "Show the fundraising progress bar to visitors" },
                { key: "supporter_count_visible", label: "Supporter Counter", desc: "Display the live supporter count on the homepage" },
              ].map((toggle) => (
                <SettingRow key={toggle.key} label={toggle.label} description={toggle.desc}>
                  <Switch checked={siteSettings[toggle.key] !== "false"} onCheckedChange={(v) => updateSetting(toggle.key, v ? "true" : "false")} />
                </SettingRow>
              ))}
            </div>

            {/* ── GENERAL SETTINGS ── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-lg text-foreground mb-2 flex items-center gap-2"><Settings className="text-primary" size={18} /> GENERAL SETTINGS</h2>
              <SettingRow label="Site Title" description="Displayed in the browser tab and meta tags">
                <SettingInput value={siteSettings.site_title || ""} onChange={(v) => updateSetting("site_title", v)} placeholder="The Last Burger" />
              </SettingRow>
              <SettingRow label="Site Description" description="Meta description for SEO">
                <SettingInput value={siteSettings.site_description || ""} onChange={(v) => updateSetting("site_description", v)} placeholder="Join the ultimate fundraising stream..." />
              </SettingRow>
              <SettingRow label="Fundraising Goal ($)" description="The target fundraising amount displayed publicly">
                <SettingInput type="number" value={String(parseInt(siteSettings.fundraising_goal_cents || "200000000") / 100)} onChange={(v) => updateSetting("fundraising_goal_cents", String(Math.round(parseFloat(v) * 100)))} />
              </SettingRow>
              <SettingRow label="Contact Email" description="Public contact email for support inquiries">
                <SettingInput value={siteSettings.contact_email || ""} onChange={(v) => updateSetting("contact_email", v)} placeholder="hello@example.com" />
              </SettingRow>
              <SettingRow label="Social — Twitter/X" description="Twitter handle or URL">
                <SettingInput value={siteSettings.social_twitter || ""} onChange={(v) => updateSetting("social_twitter", v)} placeholder="@theLastBurger" />
              </SettingRow>
              <SettingRow label="Social — Instagram" description="Instagram handle or URL">
                <SettingInput value={siteSettings.social_instagram || ""} onChange={(v) => updateSetting("social_instagram", v)} placeholder="@theLastBurger" />
              </SettingRow>
            </div>
          </TabsContent>

          {/* ═══════════════════ STREAM QUEUE TAB ═══════════════════ */}
          <TabsContent value="stream-queue" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display text-xl text-foreground mb-4 flex items-center gap-2">
                <Eye className="text-primary" size={20} /> STREAM QUEUE MANAGEMENT
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <p className="text-sm text-muted-foreground flex-1">
                  Manage the photo display queue for the OBS stream overlay.
                </p>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/stream-overlay`;
                    navigator.clipboard.writeText(url);
                    toast.success("Overlay URL copied to clipboard!");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors shrink-0"
                >
                  <Link2 size={14} /> Copy Overlay URL
                </button>
              </div>

              {/* OBS Setup Instructions */}
              <details className="mb-6 bg-secondary/30 border border-border rounded-xl overflow-hidden">
                <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors flex items-center gap-2 select-none">
                  <ExternalLink size={14} className="text-primary" />
                  OBS Browser Source Setup Guide
                </summary>
                <div className="px-5 pb-5 pt-2 space-y-3 text-sm text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Open <strong className="text-foreground">OBS Studio</strong> on your computer.</li>
                    <li>In the <strong className="text-foreground">Sources</strong> panel at the bottom, click the <strong className="text-foreground">+</strong> button.</li>
                    <li>Select <strong className="text-foreground">Browser</strong> from the list.</li>
                    <li>Name it <strong className="text-foreground">"Photo Stream"</strong> and click OK.</li>
                    <li>
                      In the properties window, set:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><strong className="text-foreground">URL:</strong>{" "}
                          <code className="bg-secondary px-1.5 py-0.5 rounded text-xs text-primary">{window.location.origin}/stream-overlay</code>
                        </li>
                        <li><strong className="text-foreground">Width:</strong> 1920</li>
                        <li><strong className="text-foreground">Height:</strong> 1080</li>
                        <li><strong className="text-foreground">Shutdown source when not visible:</strong> OFF</li>
                        <li><strong className="text-foreground">Refresh browser when scene becomes active:</strong> ON</li>
                      </ul>
                    </li>
                    <li>Click <strong className="text-foreground">OK</strong> and resize/position as needed.</li>
                    <li>Set up your YouTube stream key in <strong className="text-foreground">Settings → Stream</strong>.</li>
                    <li>Click <strong className="text-foreground">Start Streaming</strong> — photos will auto-cycle!</li>
                  </ol>
                  <p className="text-xs text-muted-foreground/70 mt-3 pt-3 border-t border-border">
                    💡 The overlay handles everything automatically — photo cycling, badges, animations, and timing. No manual intervention needed after setup.
                  </p>
                </div>
              </details>

              <AdminQueueManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
