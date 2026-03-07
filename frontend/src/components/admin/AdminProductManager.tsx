"use client";

import { useState, useCallback } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, Pencil, Trash2, Save, X, Loader2,
  Upload, Image as ImageIcon, ChevronDown, ChevronUp, Package,
  Download, FileUp, RefreshCw,
} from "lucide-react";
import { exportProducts, parseCsvToProducts } from "@/lib/csv-export";
import { Switch } from "@/components/ui/switch";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  active: boolean | null;
  sort_order: number | null;
  stock_quantity: number | null;
  printful_product_id: string | null;
  printful_variant_id: string | null;
  variants: any;
};

type ProductFormData = {
  name: string;
  description: string;
  price: string;
  image_url: string;
  active: boolean;
  sort_order: string;
  stock_quantity: string;
  printful_product_id: string;
  printful_variant_id: string;
  variants: VariantGroup[];
};

type VariantGroup = {
  name: string; // e.g., "Size", "Color"
  options: string[]; // e.g., ["S", "M", "L", "XL"]
};

const emptyForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  active: true,
  sort_order: "0",
  stock_quantity: "0",
  printful_product_id: "",
  printful_variant_id: "",
  variants: [],
};

const parseVariants = (variants: any): VariantGroup[] => {
  if (!variants) return [];
  if (Array.isArray(variants)) {
    // Check if it's already in {name, options} format
    if (variants.length > 0 && variants[0]?.name !== undefined && Array.isArray(variants[0]?.options)) {
      return variants.map(v => ({
        name: v?.name || "",
        options: Array.isArray(v?.options) ? v.options : [],
      }));
    }
    // Handle flat key-value format: [{size: "S", color: "Black"}, ...]
    // Convert to grouped format: [{name: "size", options: ["S","M"]}, {name: "color", options: ["Black"]}]
    const grouped: Record<string, Set<string>> = {};
    for (const item of variants) {
      if (item && typeof item === "object") {
        for (const [key, val] of Object.entries(item)) {
          if (!grouped[key]) grouped[key] = new Set();
          if (val != null) grouped[key].add(String(val));
        }
      }
    }
    return Object.entries(grouped).map(([name, opts]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      options: Array.from(opts),
    }));
  }
  if (typeof variants === "object") {
    return Object.entries(variants).map(([name, options]) => ({
      name,
      options: Array.isArray(options) ? options : [String(options ?? "")],
    }));
  }
  return [];
};

const productToForm = (p: Product): ProductFormData => ({
  name: p.name,
  description: p.description || "",
  price: (p.price_cents / 100).toFixed(2),
  image_url: p.image_url || "",
  active: p.active ?? true,
  sort_order: String(p.sort_order ?? 0),
  stock_quantity: String(p.stock_quantity ?? 0),
  printful_product_id: p.printful_product_id || "",
  printful_variant_id: p.printful_variant_id || "",
  variants: parseVariants(p.variants),
});

const InputField = ({ label, value, onChange, type = "text", placeholder = "", required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) => (
  <div>
    <label className="text-xs text-muted-foreground block mb-1">{label} {required && <span className="text-accent">*</span>}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
  </div>
);

interface Props {
  merchandise: Product[];
  onDataChanged: () => void;
}

const AdminProductManager = ({ merchandise, onDataChanged }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const updateForm = (key: keyof ProductFormData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await api.upload("/admin/products/upload-image", formData);
      updateForm("image_url", data.url);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  const addVariantGroup = () => {
    updateForm("variants", [...form.variants, { name: "", options: [""] }]);
  };

  const removeVariantGroup = (idx: number) => {
    updateForm("variants", form.variants.filter((_, i) => i !== idx));
  };

  const updateVariantGroupName = (idx: number, name: string) => {
    const updated = [...form.variants];
    updated[idx] = { ...updated[idx], name };
    updateForm("variants", updated);
  };

  const updateVariantOption = (groupIdx: number, optIdx: number, value: string) => {
    const updated = [...form.variants];
    const options = [...updated[groupIdx].options];
    options[optIdx] = value;
    updated[groupIdx] = { ...updated[groupIdx], options };
    updateForm("variants", updated);
  };

  const addVariantOption = (groupIdx: number) => {
    const updated = [...form.variants];
    updated[groupIdx] = { ...updated[groupIdx], options: [...updated[groupIdx].options, ""] };
    updateForm("variants", updated);
  };

  const removeVariantOption = (groupIdx: number, optIdx: number) => {
    const updated = [...form.variants];
    updated[groupIdx] = { ...updated[groupIdx], options: updated[groupIdx].options.filter((_, i) => i !== optIdx) };
    updateForm("variants", updated);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error("Valid price is required"); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cents: Math.round(parseFloat(form.price) * 100),
        image_url: form.image_url.trim() || null,
        active: form.active,
        sort_order: parseInt(form.sort_order) || 0,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        printful_product_id: form.printful_product_id.trim() || null,
        printful_variant_id: form.printful_variant_id.trim() || null,
        variants: form.variants.length > 0 ? form.variants.filter(v => v.name.trim()) : null,
      };

      if (editingId) {
        await api.put(`/admin/products/${editingId}`, payload);
        toast.success("Product updated!");
      } else {
        await api.post("/admin/products", payload);
        toast.success("Product created!");
      }

      setEditingId(null);
      setShowAddForm(false);
      setForm(emptyForm);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    }
    setSaving(false);
  };

  const handleEdit = (product: Product) => {
    setForm(productToForm(product));
    setEditingId(product.id);
    setShowAddForm(true);
    setExpandedId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Product deleted");
      onDataChanged();
    } catch (err: any) {
      toast.error("Delete failed: " + (err.message || "Unknown error"));
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setForm(emptyForm);
  };

  const handleExport = () => {
    if (merchandise.length === 0) {
      toast.error("No products to export");
      return;
    }
    exportProducts(merchandise);
    toast.success(`Exported ${merchandise.length} product(s)`);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const products = parseCsvToProducts(text);
      if (products.length === 0) {
        toast.error("No valid products found in CSV. Make sure the CSV has a 'name' column.");
        setImporting(false);
        return;
      }

      for (const product of products) {
        await api.post("/admin/products", product);
      }

      toast.success(`Imported ${products.length} product(s) successfully!`);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    }
    setImporting(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await api.put(`/admin/products/${id}`, { active: !active });
    onDataChanged();
    toast.success(`Product ${active ? "disabled" : "enabled"}`);
  };

  const handleSyncPrintful = async () => {
    setShowSyncConfirm(false);
    setSyncing(true);
    try {
      const data = await api.post("/admin/merchandise/sync");
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || `Synced ${data?.synced || 0} products from Printful`);
      if (data?.errors?.length) {
        data.errors.forEach((e: string) => toast.warning(e));
      }
      onDataChanged();
    } catch (err: any) {
      toast.error(err?.message || "Printful sync failed");
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <ShoppingBag className="text-primary" size={18} /> PRODUCTS ({merchandise.length})
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSyncConfirm(true)} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent/20 border border-accent/30 text-accent-foreground rounded-lg text-sm hover:bg-accent/30 transition-colors disabled:opacity-50">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? "Syncing..." : "Sync Printful"}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            {importing ? "Importing..." : "Import CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} disabled={importing} />
          </label>
          {!showAddForm && (
            <button onClick={() => { setShowAddForm(true); setEditingId(null); setForm(emptyForm); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90">
              <Plus size={14} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground">{editingId ? "EDIT PRODUCT" : "ADD NEW PRODUCT"}</h3>
            <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Product Name" value={form.name} onChange={(v) => updateForm("name", v)} required placeholder="e.g. The Eternal Burger Tee" />
            <InputField label="Price ($)" value={form.price} onChange={(v) => updateForm("price", v)} type="number" required placeholder="29.99" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={2} placeholder="Premium cotton tee featuring the iconic burger."
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Product Image</label>
            <div className="flex items-start gap-4">
              {form.image_url ? (
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-border bg-secondary shrink-0">
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/50 shrink-0">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground cursor-pointer hover:bg-secondary/80 transition-colors w-fit">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} disabled={uploading} />
                </label>
                <InputField label="Or paste image URL" value={form.image_url} onChange={(v) => updateForm("image_url", v)} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Stock Quantity" value={form.stock_quantity} onChange={(v) => updateForm("stock_quantity", v)} type="number" />
            <InputField label="Sort Order" value={form.sort_order} onChange={(v) => updateForm("sort_order", v)} type="number" />
            <InputField label="Printful Product ID" value={form.printful_product_id} onChange={(v) => updateForm("printful_product_id", v)} placeholder="Optional" />
            <InputField label="Printful Variant ID" value={form.printful_variant_id} onChange={(v) => updateForm("printful_variant_id", v)} placeholder="Optional" />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.active} onCheckedChange={(v) => updateForm("active", v)} />
            <span className="text-sm text-foreground">{form.active ? "Active (visible on site)" : "Inactive (hidden)"}</span>
          </div>

          {/* Variants */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2"><Package size={14} className="text-primary" /> Product Variants</h4>
              <button onClick={addVariantGroup} className="text-xs px-3 py-1 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 flex items-center gap-1">
                <Plus size={12} /> Add Variant Group
              </button>
            </div>
            {form.variants.length === 0 && (
              <p className="text-xs text-muted-foreground">No variants configured. Add variant groups like "Size" or "Color" to offer options.</p>
            )}
            {form.variants.map((group, gi) => (
              <div key={gi} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={group.name} onChange={(e) => updateVariantGroupName(gi, e.target.value)} placeholder="Variant name (e.g. Size)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={() => removeVariantGroup(gi)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {group.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-1">
                      <input value={opt} onChange={(e) => updateVariantOption(gi, oi, e.target.value)} placeholder="Option"
                        className="w-24 px-2 py-1 rounded bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      {group.options.length > 1 && (
                        <button onClick={() => removeVariantOption(gi, oi)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addVariantOption(gi)} className="text-xs text-primary hover:underline">+ option</button>
                </div>
              </div>
            ))}
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? "Update Product" : "Create Product"}
            </button>
            <button onClick={handleCancel} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="space-y-3">
        {merchandise.map((item) => {
          const variants = parseVariants(item.variants);
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className={`border rounded-xl overflow-hidden transition-colors ${item.active ? "border-border bg-card" : "border-border/50 bg-secondary/20 opacity-70"}`}>
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-muted-foreground" /></div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg text-foreground truncate">{item.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.description || "No description"}</p>
                </div>

                {/* Price & Stock */}
                <div className="text-right hidden sm:block">
                  <p className="font-display text-lg text-primary">${(item.price_cents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{item.stock_quantity ?? 0} in stock</p>
                </div>

                {/* Variants badge */}
                {variants.length > 0 && (
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full hidden md:block">
                    {variants.length} variant{variants.length > 1 ? "s" : ""}
                  </span>
                )}

                {/* Expand */}
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-xs text-muted-foreground block">Price</span><span className="text-foreground font-medium">${(item.price_cents / 100).toFixed(2)}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Stock</span><span className="text-foreground">{item.stock_quantity ?? 0}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Sort Order</span><span className="text-foreground">{item.sort_order ?? 0}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Printful ID</span><span className="text-foreground font-mono text-xs">{item.printful_product_id || "—"}</span></div>
                  </div>

                  {variants.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Variants:</p>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((v, i) => (
                          <div key={i} className="bg-secondary rounded-lg px-3 py-1.5">
                            <span className="text-xs font-medium text-foreground">{v.name}: </span>
                            <span className="text-xs text-muted-foreground">{v.options.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => handleEdit(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(item.id, item.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30">
                      <Trash2 size={12} /> Delete
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{item.active ? "Active" : "Inactive"}</span>
                      <Switch checked={item.active ?? false} onCheckedChange={() => toggleActive(item.id, item.active ?? false)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {merchandise.length === 0 && !showAddForm && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No products yet. Click "Add Product" to get started.</p>
          </div>
        )}
      </div>

      {/* Sync Confirmation Dialog */}
      <AlertDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">Sync Products from Printful?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <p>This will fetch all products from your Printful store and sync them into your product catalog.</p>
              <p className="text-accent font-medium">Products that were previously synced will be overwritten with data from Printful (name, price, image, variants). Manually edited details on those products will be lost.</p>
              <p>New Printful products will be added. Existing products without a Printful ID will not be affected.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncPrintful} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Yes, Sync Products
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProductManager;