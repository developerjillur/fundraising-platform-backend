"use client";
import { useState, useMemo } from "react";
import {
  Users, Search, ChevronDown, ChevronUp, Mail, ShoppingBag, Camera,
  Trophy, DollarSign, ArrowUpDown,
} from "lucide-react";

interface Props {
  customerStats: any[];
  supporters: any[];
  orders: any[];
}

type SortField = "total_spent_cents" | "photo_purchase_count" | "merch_purchase_count" | "grand_prize_entries";

const AdminCustomerManager = ({ customerStats, supporters, orders }: Props) => {
  const [search, setSearch] = useState("");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("total_spent_cents");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedCustomers = useMemo(() => {
    let filtered = customerStats.filter((c) =>
      !search || c.email?.toLowerCase().includes(search.toLowerCase())
    );
    filtered.sort((a, b) => sortAsc ? a[sortField] - b[sortField] : b[sortField] - a[sortField]);
    return filtered;
  }, [customerStats, search, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getCustomerOrders = (email: string) => orders.filter((o) => o.customer_email === email);
  const getCustomerSupporters = (email: string) => supporters.filter((s) => s.email === email);

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-xs ${sortField === field ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {label} <ArrowUpDown size={10} />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Users className="text-primary" size={18} /> CUSTOMERS ({customerStats.length})
        </h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-right p-3"><SortButton field="total_spent_cents" label="Total Spent" /></th>
                <th className="text-right p-3"><SortButton field="photo_purchase_count" label="Photos" /></th>
                <th className="text-right p-3"><SortButton field="merch_purchase_count" label="Merch" /></th>
                <th className="text-right p-3"><SortButton field="grand_prize_entries" label="Entries" /></th>
                <th className="text-center p-3 font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((c, idx) => {
                const isExpanded = expandedEmail === c.email;
                const custOrders = getCustomerOrders(c.email);
                const custSupporters = getCustomerSupporters(c.email);
                return (
                  <>
                    <tr key={c.id} className="border-t border-border hover:bg-secondary/20 cursor-pointer" onClick={() => setExpandedEmail(isExpanded ? null : c.email)}>
                      <td className="p-3 text-muted-foreground">{idx + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-muted-foreground" />
                          <span className="text-foreground">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-primary font-medium">${(c.total_spent_cents / 100).toFixed(2)}</td>
                      <td className="p-3 text-right text-muted-foreground">{c.photo_purchase_count}</td>
                      <td className="p-3 text-right text-muted-foreground">{c.merch_purchase_count}</td>
                      <td className="p-3 text-right">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{c.grand_prize_entries}</span>
                      </td>
                      <td className="p-3 text-center">
                        {isExpanded ? <ChevronUp size={14} className="mx-auto text-muted-foreground" /> : <ChevronDown size={14} className="mx-auto text-muted-foreground" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={7} className="p-0">
                          <div className="bg-secondary/10 p-4 space-y-4 border-b border-border">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-secondary/30 rounded-lg p-3">
                                <DollarSign size={14} className="text-primary mb-1" />
                                <p className="text-xs text-muted-foreground">Total Spent</p>
                                <p className="text-lg font-display text-foreground">${(c.total_spent_cents / 100).toFixed(2)}</p>
                              </div>
                              <div className="bg-secondary/30 rounded-lg p-3">
                                <Camera size={14} className="text-purple-400 mb-1" />
                                <p className="text-xs text-muted-foreground">Photo Purchases</p>
                                <p className="text-lg font-display text-foreground">{c.photo_purchase_count}</p>
                              </div>
                              <div className="bg-secondary/30 rounded-lg p-3">
                                <ShoppingBag size={14} className="text-blue-400 mb-1" />
                                <p className="text-xs text-muted-foreground">Merch Orders</p>
                                <p className="text-lg font-display text-foreground">{c.merch_purchase_count}</p>
                              </div>
                              <div className="bg-secondary/30 rounded-lg p-3">
                                <Trophy size={14} className="text-yellow-400 mb-1" />
                                <p className="text-xs text-muted-foreground">Prize Entries</p>
                                <p className="text-lg font-display text-foreground">{c.grand_prize_entries}</p>
                              </div>
                            </div>

                            {/* Recent Orders */}
                            {custOrders.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><ShoppingBag size={12} /> MERCH ORDERS ({custOrders.length})</h4>
                                <div className="space-y-1">
                                  {custOrders.slice(0, 5).map((o: any) => (
                                    <div key={o.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                                      <span className="text-xs font-mono text-foreground">{o.order_number}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.payment_status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{o.payment_status}</span>
                                      <span className="text-xs text-muted-foreground">{o.order_items?.length || 0} items</span>
                                      <span className="text-xs text-primary font-medium">${(o.total_cents / 100).toFixed(2)}</span>
                                      <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Photo Submissions */}
                            {custSupporters.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Camera size={12} /> PHOTO SUBMISSIONS ({custSupporters.length})</h4>
                                <div className="space-y-1">
                                  {custSupporters.slice(0, 5).map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                                      <span className="text-xs text-foreground">{s.name}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.package_type === "premium" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.package_type}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.payment_status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{s.payment_status}</span>
                                      <span className="text-xs text-primary font-medium">${(s.amount_cents / 100).toFixed(2)}</span>
                                      <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {custOrders.length === 0 && custSupporters.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No detailed activity found for this customer.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {sortedCustomers.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{search ? "No customers match your search." : "No customer data yet."}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCustomerManager;