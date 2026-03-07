"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api, API_URL } from "@/lib/api-client";

interface QueueItem {
  id: string;
  photo_url: string;
  package_type: "standard" | "premium";
  display_duration_seconds: number;
  has_badge: boolean;
  queue_position: number;
  supporter_name: string;
  supporter_email?: string;
  display_started_at?: string;
}

type OverlayState = "idle" | "loading" | "displaying" | "capturing" | "transitioning";

export default function StreamOverlayPage() {
  const [state, setState] = useState<OverlayState>("idle");
  const [currentItem, setCurrentItem] = useState<QueueItem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentItemRef = useRef<QueueItem | null>(null);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      const sw = window.innerWidth / 1920;
      const sh = window.innerHeight / 1080;
      setScale(Math.min(sw, sh, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    currentItemRef.current = currentItem;
  }, [currentItem]);

  const fetchNext = useCallback(async () => {
    try {
      const data = await api.get("/stream/queue/next");

      if (data.status === "idle" || data.status === "paused" || !data.item) {
        setState("idle");
        setCurrentItem(null);
        return;
      }

      if (data.status === "new" || data.status === "displaying") {
        const item = data.item;
        let photoUrl = item.photo_url;
        if (photoUrl && !photoUrl.startsWith("http")) {
          photoUrl = `${API_URL}/uploads/photos/${photoUrl}`;
        }

        setCurrentItem({
          id: item.id,
          photo_url: photoUrl,
          package_type: item.package_type,
          display_duration_seconds: item.display_duration_seconds,
          has_badge: item.has_badge,
          queue_position: item.queue_position,
          supporter_name: item.supporter_name || "Supporter",
          supporter_email: item.supporter_email,
          display_started_at: item.display_started_at,
        });

        let duration = item.display_duration_seconds;
        if (data.status === "displaying" && item.display_started_at) {
          const elapsed = (Date.now() - new Date(item.display_started_at).getTime()) / 1000;
          duration = Math.max(1, item.display_duration_seconds - elapsed);
        }

        setTimeRemaining(Math.ceil(duration));
        setState("displaying");
        setTimeout(() => setFadeIn(true), 50);
      }
    } catch (err) {
      console.error("Error fetching next queue item:", err);
      setTimeout(fetchNext, 5000);
    }
  }, []);

  const completeDisplay = useCallback(async () => {
    const item = currentItemRef.current;
    if (!item) return;

    setState("capturing");

    let screenshotBase64: string | null = null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (displayRef.current) {
        const canvas = await html2canvas(displayRef.current, {
          backgroundColor: "#000000",
          scale: 1,
          useCORS: true,
          allowTaint: true,
        });
        screenshotBase64 = canvas.toDataURL("image/png");
      }
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    }

    try {
      await api.post("/stream/queue/advance", { queue_id: item.id, screenshot_url: null });
    } catch (err) {
      console.error("Queue advance failed:", err);
    }

    if (screenshotBase64) {
      api.post("/stream/screenshot", { queue_id: item.id, screenshot_base64: screenshotBase64 })
        .catch((err) => console.error("Screenshot upload failed:", err));
    }

    setState("transitioning");
    setFadeIn(false);

    setTimeout(() => {
      setCurrentItem(null);
      setState("loading");
      fetchNext();
    }, 800);
  }, [fetchNext]);

  useEffect(() => {
    if (state !== "displaying" || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          completeDisplay();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, completeDisplay]);

  useEffect(() => {
    if (state === "idle") {
      pollRef.current = setInterval(fetchNext, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [state, fetchNext]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: "64px", marginBottom: "24px" }}>🖥️</div>
        <h1 style={{ color: "#D4AF37", fontSize: "28px", fontWeight: "bold", marginBottom: "16px" }}>Desktop Required</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", maxWidth: "400px", lineHeight: 1.6 }}>
          The stream overlay is designed for OBS Browser Source at 1920×1080 resolution. Please open this page on a desktop computer.
        </p>
        <a href="/" style={{ marginTop: "24px", color: "#D4AF37", textDecoration: "underline", fontSize: "14px" }}>← Back to home</a>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw", height: "100vh", backgroundColor: "#000000",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: "1920px", height: "1080px",
          transform: `scale(${scale})`, transformOrigin: "center center",
          position: "relative", overflow: "hidden", flexShrink: 0,
        }}
      >
        <div ref={displayRef} style={{ width: "100%", height: "100%", position: "relative" }}>
          {state === "idle" && <IdleScreen />}

          {currentItem && (
            <div
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                opacity: fadeIn ? 1 : 0, transition: "opacity 800ms ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentItem.photo_url}
                alt="Supporter photo"
                style={{
                  maxWidth: "80%", maxHeight: "70%", objectFit: "contain",
                  borderRadius: "16px", boxShadow: "0 0 60px rgba(212, 175, 55, 0.3)",
                }}
                crossOrigin="anonymous"
                onError={() => {
                  console.error("Photo failed to load, skipping...");
                  completeDisplay();
                }}
              />

              <div
                style={{
                  marginTop: "32px", padding: "16px 48px",
                  background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(0,0,0,0.8) 100%)",
                  borderRadius: "12px", border: "1px solid rgba(212,175,55,0.3)", textAlign: "center",
                }}
              >
                <p style={{ color: "#D4AF37", fontSize: "32px", fontWeight: "bold", margin: 0, letterSpacing: "2px" }}>
                  {currentItem.supporter_name}
                </p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "4px" }}>
                  {currentItem.package_type === "premium" ? "★ PREMIUM SUPPORTER ★" : "SUPPORTER"}
                </p>
              </div>

              {currentItem.has_badge && (
                <div
                  style={{
                    position: "absolute", top: "40px", right: "40px",
                    background: "linear-gradient(135deg, #D4AF37, #FFD700)",
                    borderRadius: "50%", width: "80px", height: "80px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 30px rgba(212,175,55,0.5)", animation: "badgePulse 2s infinite",
                  }}
                >
                  <span style={{ fontSize: "40px" }}>👑</span>
                </div>
              )}

              <div style={{ position: "absolute", bottom: "40px", right: "40px", color: "rgba(255,255,255,0.4)", fontSize: "24px", fontVariantNumeric: "tabular-nums" }}>
                {timeRemaining}s
              </div>

              <div style={{ position: "absolute", bottom: "40px", left: "40px", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
                Queue #{currentItem.queue_position}
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes idlePulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { overflow: hidden; background: #000; }
        `}</style>
      </div>
    </div>
  );
}

const IdleScreen = () => (
  <div
    style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "idlePulse 3s ease-in-out infinite",
    }}
  >
    <div style={{ fontSize: "80px", marginBottom: "24px" }}>🍔</div>
    <h1 style={{ color: "#D4AF37", fontSize: "48px", fontWeight: "bold", textAlign: "center", letterSpacing: "4px", marginBottom: "16px" }}>
      THE LAST McDONALD&apos;S BURGER
    </h1>
    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "24px", textAlign: "center", letterSpacing: "2px" }}>
      Waiting for supporters...
    </p>
    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", marginTop: "8px" }}>
      Get your photo on stream at lastmcdonaldsburger.com
    </p>
  </div>
);
