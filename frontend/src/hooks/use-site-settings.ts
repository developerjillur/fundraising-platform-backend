import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export type SiteSettings = Record<string, string>;

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await api.get("/settings");
      if (data) {
        setSettings(data);
      }
    } catch { /* best effort */ }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const getSetting = (key: string, fallback = "") => settings[key] ?? fallback;
  const isEnabled = (key: string) => getSetting(key, "true") === "true";

  return { settings, loading, getSetting, isEnabled, refetch: fetchSettings };
}
