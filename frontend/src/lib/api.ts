import { api, API_URL } from "./api-client";

// ============================================
// REAL API FUNCTIONS (connected to NestJS backend)
// ============================================

export interface FundraisingStats {
  total_raised_cents: number;
  goal_amount_cents: number;
  supporter_count: number;
  merch_order_count: number;
  photos_displayed: number;
  current_viewer_count: number;
}

export async function fetchStats(): Promise<FundraisingStats> {
  try {
    return await api.get<FundraisingStats>("/fundraising/stats");
  } catch {
    return {
      total_raised_cents: 0,
      goal_amount_cents: 200000000,
      supporter_count: 0,
      merch_order_count: 0,
      photos_displayed: 0,
      current_viewer_count: 0,
    };
  }
}

export async function fetchQueue() {
  try {
    return await api.get("/stream/queue");
  } catch {
    return { current: null, upcoming: [], total_waiting: 0 };
  }
}

export async function fetchMerchandise() {
  try {
    return await api.get("/merchandise/products");
  } catch {
    return [];
  }
}

export async function uploadPhoto(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const data = await api.upload<{ path: string; url: string }>("/photos/upload", formData);
    return data?.url || data?.path || null;
  } catch (err) {
    console.error("Photo upload error:", err);
    return null;
  }
}

export async function createPhotoCheckout(params: {
  name: string;
  email: string;
  package_type: "standard" | "premium";
  photo_storage_path: string | null;
}) {
  try {
    return await api.post("/payments/checkout/photo", {
      ...params,
      origin: window.location.origin,
    });
  } catch (err: any) {
    return { error: err?.message || "Request failed." };
  }
}

export async function createMerchCheckout(params: {
  customer_name: string;
  customer_email: string;
  items: { merchandise_id: string; quantity: number; variant_info?: string }[];
  shipping_address?: any;
}) {
  try {
    return await api.post("/payments/checkout/merch", {
      ...params,
      origin: window.location.origin,
    });
  } catch (err: any) {
    return { error: err?.message || "Request failed." };
  }
}

// Helper to resolve photo URLs — supports S3 URLs and legacy local paths
export function resolvePhotoUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}/uploads/photos/${path.replace(/^uploads\/photos\//, "")}`;
}

// ============================================
// MOCK DATA (used as fallback when DB is empty)
// ============================================
export const MOCK_STATS = {
  total_raised: 847392,
  goal_amount: 2000000,
  supporter_count: 34219,
  merch_order_count: 8743,
  photos_displayed: 28456,
  viewer_count: 12847,
};

export const MOCK_QUEUE = {
  current: { supporter: { name: 'Alex M.' }, display_duration_seconds: 30, package_type: 'premium' as const },
  upcoming: [
    { supporter: { name: 'Sarah K.' }, package_type: 'standard' as const, estimated_display_at: new Date(Date.now() + 300000).toISOString() },
    { supporter: { name: 'Mike R.' }, package_type: 'premium' as const, estimated_display_at: new Date(Date.now() + 600000).toISOString() },
    { supporter: { name: 'Jenny L.' }, package_type: 'standard' as const, estimated_display_at: new Date(Date.now() + 900000).toISOString() },
    { supporter: { name: 'David P.' }, package_type: 'standard' as const, estimated_display_at: new Date(Date.now() + 1200000).toISOString() },
    { supporter: { name: 'Emma W.' }, package_type: 'premium' as const, estimated_display_at: new Date(Date.now() + 1500000).toISOString() },
  ],
  total_waiting: 142,
};
