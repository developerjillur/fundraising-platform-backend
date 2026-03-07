"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Plus, Minus, Loader2, MapPin, Ticket } from "lucide-react";
import { createMerchCheckout } from "@/lib/api";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import merchTshirt from "@/assets/merch-tshirt.jpg";
import merchMug from "@/assets/merch-mug.jpg";
import merchCap from "@/assets/merch-cap.jpg";

const IMAGE_MAP: Record<string, string> = { tee: merchTshirt.src, mug: merchMug.src, cap: merchCap.src };

const getProductImage = (name: string, imageUrl?: string | null) => {
  if (imageUrl && imageUrl.startsWith("http")) return imageUrl;
  const lower = name.toLowerCase();
  for (const [key, img] of Object.entries(IMAGE_MAP)) {
    if (lower.includes(key)) return img;
  }
  return merchTshirt.src;
};

type Product = { id: string; name: string; description: string | null; price_cents: number; image_url: string | null; variants: any };
type CartItem = { id: string; quantity: number; size?: string; selectedVariants?: Record<string, string> };

const parseVariants = (variants: any): { name: string; options: string[] }[] => {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants.filter((v: any) => v.name && v.options?.length);
  return [];
};

const Merchandise = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<string, string>>>({});
  const [shipping, setShipping] = useState({ line1: "", line2: "", city: "", state: "", postal_code: "", country: "US" });
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await api.get("/merchandise/products");
        if (data?.length) setProducts(data);
      } catch (e) {
        console.error("Failed to load merchandise", e);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const variants = product ? parseVariants(product.variants) : [];
    const prodSelectedVariants = selectedVariants[productId] || {};
    if (variants.length > 0) {
      const unselected = variants.filter(v => !prodSelectedVariants[v.name]);
      if (unselected.length > 0) { toast.error(`Please select ${unselected.map(v => v.name).join(", ")}`); return; }
    }
    const variantKey = Object.values(prodSelectedVariants).join(" / ");
    setCart(prev => {
      const existing = prev.find(i => i.id === productId);
      if (existing) return prev.map(i => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: productId, quantity: 1, size: variantKey || undefined, selectedVariants: prodSelectedVariants }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.map(i => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  };

  const getQuantity = (productId: string) => cart.find(i => i.id === productId)?.quantity || 0;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => { const p = products.find(pr => pr.id === i.id); return s + ((p?.price_cents || 0) / 100) * i.quantity; }, 0);

  const handleCheckout = async () => {
    if (totalItems === 0) return;
    if (!showShipping) { setShowShipping(true); return; }
    if (!shipping.line1 || !shipping.city || !shipping.postal_code || !shipping.country) { toast.error("Please fill in all required shipping fields."); return; }
    if (!customerName.trim() || !customerEmail.trim()) { toast.error("Please enter your name and email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) { toast.error("Please enter a valid email address."); return; }

    setCheckingOut(true);
    try {
      const items = cart.map(c => ({ merchandise_id: c.id, quantity: c.quantity, variant_info: c.size || undefined }));
      const result = await createMerchCheckout({ customer_name: customerName, customer_email: customerEmail, items, shipping_address: shipping });
      if (result?.url) { window.location.href = result.url; }
      else if (result?.duplicate) { toast.warning("You already have a pending order."); }
      else { toast.error(result?.error || "Failed to create checkout."); }
    } catch (err: any) { toast.error(err?.message || "Checkout failed."); }
    finally { setCheckingOut(false); }
  };

  if (loading) return (
    <section id="merch" className="py-12 md:py-16 px-4"><div className="container mx-auto max-w-5xl flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div></section>
  );
  if (products.length === 0) return null;

  return (
    <section id="merch" className="py-12 md:py-16 px-4 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[180px] dark:hidden" style={{ background: "hsl(38 100% 50% / 0.05)" }} />
      <div className="container mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-3">
            🔥 LIMITED EDITION MERCH
          </h2>
          <p className="text-muted-foreground text-lg mb-2">
            Own a piece of history. Every purchase = grand prize entry.
          </p>
          <p className="text-sm text-primary font-medium">🚚 Free worldwide shipping</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {products.map((product, i) => {
            const qty = getQuantity(product.id);
            const price = (product.price_cents / 100).toFixed(2);
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="bg-card border border-border rounded-2xl overflow-hidden group shadow-sm shadow-foreground/[0.03] hover:shadow-md hover:shadow-primary/5 transition-shadow"
              >
                <div className="aspect-square overflow-hidden relative">
                  <img src={getProductImage(product.name, product.image_url)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Ticket size={10} /> = 1 Prize Entry
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-xl text-foreground">{product.name}</h3>
                  <p className="text-muted-foreground text-xs mt-1 mb-3 line-clamp-2">{product.description}</p>

                  {parseVariants(product.variants).length > 0 && (
                    <div className="space-y-2 mb-3">
                      {parseVariants(product.variants).map(variant => (
                        <div key={variant.name}>
                          <label className="text-xs text-muted-foreground mb-1 block">{variant.name}</label>
                          <div className="flex flex-wrap gap-1.5">
                            {variant.options.map(opt => (
                              <button key={opt}
                                onClick={() => setSelectedVariants(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || {}), [variant.name]: opt } }))}
                                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${selectedVariants[product.id]?.[variant.name] === opt ? "border-primary bg-primary/20 text-primary font-medium" : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/50"}`}
                              >{opt}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-mono-num text-xl font-bold text-primary">${price}</span>
                    {qty === 0 ? (
                      <button onClick={() => addToCart(product.id)} className="btn-red !px-4 !py-2 !text-sm !rounded-lg">Add 🛒</button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => removeFromCart(product.id)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-muted transition-colors"><Minus size={14} /></button>
                        <span className="font-bold text-foreground w-6 text-center font-mono-num">{qty}</span>
                        <button onClick={() => addToCart(product.id)} className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground hover:opacity-90"><Plus size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground mb-6">
          <span>🎫 Every purchase = prize entry</span>
          <span>🔒 Secure checkout via Stripe</span>
        </div>

        {/* Cart */}
        {totalItems > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-3">
              <ShoppingCart className="text-primary" size={20} />
              <span className="font-semibold text-foreground">{totalItems} item{totalItems > 1 ? "s" : ""}</span>
            </div>
            <p className="font-mono-num text-3xl font-bold text-primary mb-4 text-center">${totalPrice.toFixed(2)}</p>

            {showShipping && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin size={14} className="text-primary" />
                  <span className="font-medium text-foreground">Your Details & Shipping</span>
                </div>
                <input type="text" placeholder="Full Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="email" placeholder="Email Address *" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="text" placeholder="Address Line 1 *" value={shipping.line1} onChange={e => setShipping(s => ({ ...s, line1: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="text" placeholder="Address Line 2" value={shipping.line2} onChange={e => setShipping(s => ({ ...s, line2: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="City *" value={shipping.city} onChange={e => setShipping(s => ({ ...s, city: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="text" placeholder="State/Province" value={shipping.state} onChange={e => setShipping(s => ({ ...s, state: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Postal Code *" value={shipping.postal_code} onChange={e => setShipping(s => ({ ...s, postal_code: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="text" placeholder="Country *" value={shipping.country} onChange={e => setShipping(s => ({ ...s, country: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            )}

            <button onClick={handleCheckout} disabled={checkingOut} className="w-full btn-red !rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {checkingOut ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : showShipping ? "Checkout with Stripe →" : "Continue to Shipping →"}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default Merchandise;
