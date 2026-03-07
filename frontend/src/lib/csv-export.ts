/**
 * Generic CSV export utility for admin data tables.
 */

type CsvRow = Record<string, string | number | boolean | null | undefined>;

export function exportToCsv(filename: string, rows: CsvRow[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val == null) return "";
          const str = String(val);
          // Escape quotes and wrap in quotes if contains comma/quote/newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Pre-built export formatters for each data type

export function exportCustomers(customers: any[]) {
  exportToCsv(
    "customers",
    customers.map((c) => ({
      email: c.email,
      total_spent: `$${(c.total_spent_cents / 100).toFixed(2)}`,
      photo_purchases: c.photo_purchase_count,
      merch_purchases: c.merch_purchase_count,
      grand_prize_entries: c.grand_prize_entries,
      created_at: c.created_at,
    }))
  );
}

export function exportOrders(orders: any[]) {
  exportToCsv(
    "orders",
    orders.map((o) => ({
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      total: `$${(o.total_cents / 100).toFixed(2)}`,
      subtotal: `$${((o.subtotal_cents || 0) / 100).toFixed(2)}`,
      shipping: `$${((o.shipping_cents || 0) / 100).toFixed(2)}`,
      payment_status: o.payment_status,
      fulfillment_status: o.fulfillment_status,
      tracking_number: o.tracking_number || "",
      tracking_url: o.tracking_url || "",
      stripe_payment_intent: o.stripe_payment_intent_id || "",
      items_count: o.order_items?.length || 0,
      created_at: o.created_at,
    }))
  );
}

export function exportSupporters(supporters: any[]) {
  exportToCsv(
    "photo_submissions",
    supporters.map((s) => ({
      name: s.name,
      email: s.email,
      package_type: s.package_type,
      amount: `$${(s.amount_cents / 100).toFixed(2)}`,
      display_duration: `${s.display_duration_seconds}s`,
      payment_status: s.payment_status,
      moderation_status: s.moderation_status,
      display_status: s.display_status,
      stripe_payment_intent: s.stripe_payment_intent_id || "",
      stripe_checkout_session: s.stripe_checkout_session_id || "",
      photo_url: s.photo_url || "",
      created_at: s.created_at,
      displayed_at: s.displayed_at || "",
    }))
  );
}

export function exportQueue(queue: any[]) {
  exportToCsv(
    "stream_queue",
    queue.map((q) => ({
      position: q.queue_position,
      supporter_name: q.supporters?.name || "Unknown",
      supporter_email: q.supporters?.email || "",
      package_type: q.package_type,
      duration_seconds: q.display_duration_seconds,
      status: q.status,
      has_badge: q.has_badge,
      created_at: q.created_at,
      display_started_at: q.display_started_at || "",
      display_ended_at: q.display_ended_at || "",
    }))
  );
}

export function exportPrizeEntries(entries: any[]) {
  exportToCsv(
    "grand_prize_entries",
    entries.map((e) => ({
      email: e.email,
      entry_type: e.entry_type,
      amount: `$${(e.amount_cents / 100).toFixed(2)}`,
      reference_id: e.reference_id,
      created_at: e.created_at,
    }))
  );
}

export function exportProducts(products: any[]) {
  exportToCsv(
    "products",
    products.map((p) => ({
      name: p.name,
      description: p.description || "",
      price: `$${(p.price_cents / 100).toFixed(2)}`,
      price_cents: p.price_cents,
      image_url: p.image_url || "",
      active: p.active ?? true,
      stock_quantity: p.stock_quantity ?? 0,
      sort_order: p.sort_order ?? 0,
      printful_product_id: p.printful_product_id || "",
      printful_variant_id: p.printful_variant_id || "",
      variants: p.variants ? JSON.stringify(p.variants) : "",
    }))
  );
}

export function parseCsvToProducts(csvText: string): Array<{
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  active: boolean;
  stock_quantity: number;
  sort_order: number;
  printful_product_id: string | null;
  printful_variant_id: string | null;
  variants: any;
}> {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const products: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim().toLowerCase()] = values[idx]?.trim() || "";
    });

    // Support both "price_cents" and "price" (dollar) columns
    let priceCents = 0;
    if (row.price_cents && !isNaN(Number(row.price_cents))) {
      priceCents = parseInt(row.price_cents);
    } else if (row.price) {
      const cleaned = row.price.replace(/[^0-9.]/g, "");
      if (!isNaN(parseFloat(cleaned))) {
        priceCents = Math.round(parseFloat(cleaned) * 100);
      }
    }

    const name = row.name;
    if (!name) continue;

    let variants: any = null;
    if (row.variants) {
      try {
        variants = JSON.parse(row.variants);
      } catch {
        variants = null;
      }
    }

    products.push({
      name,
      description: row.description || null,
      price_cents: priceCents,
      image_url: row.image_url || null,
      active: row.active !== "false",
      stock_quantity: parseInt(row.stock_quantity) || 0,
      sort_order: parseInt(row.sort_order) || 0,
      printful_product_id: row.printful_product_id || null,
      printful_variant_id: row.printful_variant_id || null,
      variants,
    });
  }

  return products;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
