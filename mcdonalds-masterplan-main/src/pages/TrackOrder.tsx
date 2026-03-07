import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Package, Truck, CheckCircle, Clock, XCircle,
  ArrowLeft, Globe, Loader2, Mail, Hash,
} from "lucide-react";

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  completed: CheckCircle,
  paid: CheckCircle,
  failed: XCircle,
  refunded: XCircle,
  shipped: Truck,
  delivered: CheckCircle,
  in_production: Package,
  submitted: Package,
  canceled: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-green-400",
  paid: "text-green-400",
  pending: "text-yellow-400",
  failed: "text-red-400",
  refunded: "text-purple-400",
  shipped: "text-green-400",
  delivered: "text-green-400",
  in_production: "text-blue-400",
  submitted: "text-blue-400",
  canceled: "text-red-400",
};

const FULFILLMENT_STEPS = ["pending", "submitted", "in_production", "shipped", "delivered"];

const TrackOrder = () => {
  const [searchParams] = useSearchParams();
  const [searchType, setSearchType] = useState<"email" | "order">(
    searchParams.get("order") ? "order" : "email"
  );
  const [input, setInput] = useState(searchParams.get("order") || searchParams.get("email") || "");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const body = searchType === "email"
        ? { email: input.trim() }
        : { order_number: input.trim() };

      const data = await api.post("/merchandise/orders/lookup", body);
      setOrders(data?.orders || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setOrders([]);
    }
    setLoading(false);
  };

  const getFulfillmentStep = (status: string) => {
    const idx = FULFILLMENT_STEPS.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft size={14} /> Back to home
          </Link>
          <h1 className="font-display text-4xl text-gradient-gold">TRACK YOUR ORDER</h1>
          <p className="text-muted-foreground mt-1">
            Enter your email or order number to check your order status.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => { setSearchType("email"); setInput(""); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchType === "email" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <Mail size={14} /> By Email
            </button>
            <button type="button" onClick={() => { setSearchType("order"); setInput(""); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchType === "order" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <Hash size={14} /> By Order Number
            </button>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={searchType === "email" ? "email" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={searchType === "email" ? "you@example.com" : "ORD-..."}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <button type="submit" disabled={loading}
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {searched && !loading && orders.length === 0 && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16">
              <Package size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No orders found. Please check your {searchType === "email" ? "email address" : "order number"} and try again.</p>
            </motion.div>
          )}

          {orders.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""} found</p>

              {orders.map((order) => {
                const PaymentIcon = STATUS_ICON[order.payment_status] || Clock;
                const FulfillmentIcon = STATUS_ICON[order.fulfillment_status] || Clock;
                const step = getFulfillmentStep(order.fulfillment_status || "pending");

                return (
                  <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Order header */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-mono text-sm font-medium text-foreground">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                        </div>
                        <p className="font-display text-2xl text-primary">${(order.total_cents / 100).toFixed(2)}</p>
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-secondary ${STATUS_COLOR[order.payment_status] || "text-muted-foreground"}`}>
                          <PaymentIcon size={12} /> Payment: {order.payment_status}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-secondary ${STATUS_COLOR[order.fulfillment_status] || "text-muted-foreground"}`}>
                          <FulfillmentIcon size={12} /> {(order.fulfillment_status || "pending").replace("_", " ")}
                        </span>
                      </div>

                      {/* Fulfillment progress */}
                      {order.payment_status === "completed" && (
                        <div className="pt-2">
                          <div className="flex items-center justify-between mb-2">
                            {FULFILLMENT_STEPS.map((s, i) => {
                              const isActive = i <= step;
                              const isCurrent = i === step;
                              return (
                                <div key={s} className="flex flex-col items-center flex-1">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                    isActive ? "bg-primary border-primary text-primary-foreground" : "bg-secondary border-border text-muted-foreground"
                                  } ${isCurrent ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}`}>
                                    {i + 1}
                                  </div>
                                  <p className={`text-[10px] mt-1 capitalize ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                    {s.replace("_", " ")}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="relative h-1 bg-secondary rounded-full mx-3">
                            <div className="absolute h-1 bg-primary rounded-full transition-all" style={{ width: `${(step / (FULFILLMENT_STEPS.length - 1)) * 100}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Tracking link */}
                      {order.tracking_url && (
                        <a href={order.tracking_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <Globe size={14} /> Track shipment
                          {order.tracking_number && <span className="text-muted-foreground font-mono text-xs">({order.tracking_number})</span>}
                        </a>
                      )}

                      {/* Items */}
                      {order.order_items?.length > 0 && (
                        <div className="border-t border-border pt-3 mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Items</p>
                          {order.order_items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm py-1">
                              <span className="text-foreground">{item.variant_info || "Item"} × {item.quantity}</span>
                              <span className="text-muted-foreground">${(item.total_cents / 100).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TrackOrder;
