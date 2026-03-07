import { useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ShoppingBag, ChevronDown, ChevronUp, Package, Globe,
  Mail, MapPin, CreditCard, Truck, Search, RefreshCw, Loader2,
} from "lucide-react";

interface Props {
  orders: any[];
  onDataChanged: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  paid: "bg-green-500/20 text-green-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  failed: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  shipped: "bg-green-500/20 text-green-400",
  delivered: "bg-green-500/20 text-green-400",
  in_production: "bg-blue-500/20 text-blue-400",
  submitted: "bg-blue-500/20 text-blue-400",
  canceled: "bg-red-500/20 text-red-400",
};

const FULFILLMENT_STEPS = ["pending", "submitted", "in_production", "shipped", "delivered", "canceled"] as const;

const AdminOrderManager = ({ orders, onDataChanged }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFulfillment, setFilterFulfillment] = useState<string>("all");
  const [syncingPrintful, setSyncingPrintful] = useState(false);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = !search || 
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || o.payment_status === filterStatus;
    const matchesFulfillment = filterFulfillment === "all" || o.fulfillment_status === filterFulfillment;
    return matchesSearch && matchesStatus && matchesFulfillment;
  });

  const updateFulfillment = async (orderId: string, status: typeof FULFILLMENT_STEPS[number]) => {
    try {
      await api.put(`/admin/orders/${orderId}`, { fulfillment_status: status });
      toast.success(`Fulfillment updated to ${status}`);
      onDataChanged();
    } catch (err: any) {
      toast.error("Update failed: " + (err.message || "Unknown error"));
    }
  };

  const updateTracking = async (orderId: string, trackingNumber: string, trackingUrl: string) => {
    try {
      await api.put(`/admin/orders/${orderId}`, { tracking_number: trackingNumber, tracking_url: trackingUrl });
      toast.success("Tracking info updated");
      onDataChanged();
    } catch {
      toast.error("Update failed");
    }
  };

  const syncPrintfulStatus = async () => {
    setSyncingPrintful(true);
    try {
      const data = await api.post("/admin/merchandise/sync-status");
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Printful sync complete: ${data.synced || 0} updated, ${data.errors || 0} errors out of ${data.total || 0} orders`);
        onDataChanged();
      }
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    }
    setSyncingPrintful(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <ShoppingBag className="text-primary" size={18} /> ORDERS ({orders.length})
        </h2>
        <button
          onClick={syncPrintfulStatus}
          disabled={syncingPrintful}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-medium disabled:opacity-50"
        >
          {syncingPrintful ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync Printful Status
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders, customers..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Payments</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={filterFulfillment} onChange={(e) => setFilterFulfillment(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Fulfillment</option>
          {FULFILLMENT_STEPS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {filteredOrders.map((order) => {
          const isExpanded = expandedId === order.id;
          const shipping = order.shipping_address as any;
          return (
            <div key={order.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Order Header Row */}
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-foreground font-medium">{order.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.payment_status] || "bg-secondary text-muted-foreground"}`}>{order.payment_status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.fulfillment_status] || "bg-secondary text-muted-foreground"}`}>{order.fulfillment_status?.replace("_", " ")}</span>
                    {order.printful_order_id && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Printful #{order.printful_order_id}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{order.customer_name} · {order.customer_email}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-display text-lg text-primary">${(order.total_cents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{order.order_items?.length || 0} items</p>
                </div>
                <p className="text-xs text-muted-foreground hidden md:block">{new Date(order.created_at).toLocaleDateString()}</p>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Customer Info */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mail size={12} /> CUSTOMER</h4>
                      <p className="text-sm text-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    </div>

                    {/* Shipping */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin size={12} /> SHIPPING ADDRESS</h4>
                      {shipping ? (
                        <div className="text-sm text-foreground">
                          <p>{shipping.line1}</p>
                          {shipping.line2 && <p>{shipping.line2}</p>}
                          <p>{shipping.city}{shipping.state ? `, ${shipping.state}` : ""} {shipping.postal_code}</p>
                          <p>{shipping.country}</p>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">No address</p>}
                    </div>

                    {/* Payment */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CreditCard size={12} /> PAYMENT</h4>
                      <p className="text-sm text-foreground">Subtotal: ${((order.subtotal_cents || 0) / 100).toFixed(2)}</p>
                      <p className="text-sm text-foreground">Shipping: ${((order.shipping_cents || 0) / 100).toFixed(2)}</p>
                      <p className="text-sm text-foreground font-medium">Total: ${(order.total_cents / 100).toFixed(2)}</p>
                      {order.stripe_payment_intent_id && (
                        <p className="text-xs text-muted-foreground font-mono break-all">PI: {order.stripe_payment_intent_id}</p>
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  {order.order_items?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">ORDER ITEMS</h4>
                      <div className="bg-secondary/30 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-border">
                            <th className="text-left p-2 text-xs text-muted-foreground">Item</th>
                            <th className="text-center p-2 text-xs text-muted-foreground">Qty</th>
                            <th className="text-right p-2 text-xs text-muted-foreground">Unit</th>
                            <th className="text-right p-2 text-xs text-muted-foreground">Total</th>
                          </tr></thead>
                          <tbody>
                            {order.order_items.map((item: any) => (
                              <tr key={item.id} className="border-b border-border last:border-0">
                                <td className="p-2 text-foreground">
                                  <div className="flex items-center gap-2">
                                    {item.merchandise?.image_url && (
                                      <img src={item.merchandise.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                    )}
                                    <div>
                                      <p className="font-medium">{item.merchandise?.name || item.variant_info || "Item"}</p>
                                      {item.variant_info && item.merchandise?.name && <p className="text-xs text-muted-foreground">{item.variant_info}</p>}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2 text-center text-muted-foreground">{item.quantity}</td>
                                <td className="p-2 text-right text-muted-foreground">${(item.unit_price_cents / 100).toFixed(2)}</td>
                                <td className="p-2 text-right text-foreground font-medium">${(item.total_cents / 100).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fulfillment Actions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Truck size={12} /> FULFILLMENT</h4>
                    <div className="flex flex-wrap gap-2">
                      {FULFILLMENT_STEPS.map((step) => (
                        <button key={step} onClick={() => updateFulfillment(order.id, step)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            order.fulfillment_status === step 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}>
                          {step.replace("_", " ")}
                        </button>
                      ))}
                    </div>

                    {/* Tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Tracking Number</label>
                        <input type="text" defaultValue={order.tracking_number || ""} 
                          onBlur={(e) => updateTracking(order.id, e.target.value, order.tracking_url || "")}
                          placeholder="Enter tracking number"
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Tracking URL</label>
                        <input type="text" defaultValue={order.tracking_url || ""}
                          onBlur={(e) => updateTracking(order.id, order.tracking_number || "", e.target.value)}
                          placeholder="https://tracking.example.com/..."
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>
                    {order.tracking_url && (
                      <a href={order.tracking_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Globe size={12} /> Open tracking link
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search || filterStatus !== "all" || filterFulfillment !== "all" ? "No orders match your filters." : "No orders yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrderManager;
