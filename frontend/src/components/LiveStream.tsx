"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Play, Crown, Volume2, VolumeX, Pause, Maximize, MessageSquare, MessageSquareOff, Radio } from "lucide-react";
import heroBurger from "@/assets/hero-burger.jpg";
import { api, API_URL } from "@/lib/api-client";

// Declare global YT types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface LiveStreamProps {
  youtubeVideoId?: string;
}

interface DisplayItem {
  id: string;
  photo_url: string;
  package_type: string;
  display_duration_seconds: number;
  has_badge: boolean;
  supporter_name: string;
  view_count: number;
  total_screen_time_seconds: number;
}

type OverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
type OverlaySize = "small" | "medium" | "large";

interface StreamSettings {
  interval: number;
  loopEnabled: boolean;
  loopHours: number;
  overlayPosition: OverlayPosition;
  overlaySize: OverlaySize;
  autoplay: boolean;
  muted: boolean;
  chatEnabled: boolean;
  paused: boolean;
}

const POSITION_CLASSES: Record<OverlayPosition, string> = {
  "top-left": "top-3 left-3",
  "top-right": "top-3 right-3",
  "bottom-left": "bottom-14 left-3",
  "bottom-right": "bottom-14 right-3",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const SIZE_DIMENSIONS: Record<OverlaySize, { w: string; imgMax: string }> = {
  small: { w: "w-40 md:w-48", imgMax: "max-h-24" },
  medium: { w: "w-56 md:w-64", imgMax: "max-h-36" },
  large: { w: "w-72 md:w-80", imgMax: "max-h-48" },
};

const ViewerCount = () => {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get("/fundraising/stats");
        if (data?.current_viewer_count) setViewerCount(data.current_viewer_count);
      } catch { /* best effort */ }
    };
    load();

    // Auto-fetch YouTube viewer count every 60 seconds
    const fetchYouTubeViewers = async () => {
      try {
        await api.get("/stream/youtube-viewers");
      } catch { /* best effort */ }
    };
    fetchYouTubeViewers(); // fetch immediately on mount
    const pollInterval = setInterval(fetchYouTubeViewers, 60000); // every 60s

    // SSE listener updates UI instantly when stats change
    const es = new EventSource(`${API_URL}/fundraising/stream`);
    es.addEventListener("stats-update", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d?.current_viewer_count != null) setViewerCount(d.current_viewer_count);
      } catch { /* best effort */ }
    });

    return () => {
      clearInterval(pollInterval);
      es.close();
    };
  }, []);

  return (
    <p className="text-muted-foreground">
      {viewerCount > 0 ? (
        <>Join <span className="font-mono-num font-bold text-foreground">{viewerCount.toLocaleString()}</span> people watching supporter photos appear live</>
      ) : (
        <>Watch supporter photos appear live on stream</>
      )}
    </p>
  );
};

const LiveStream = ({ youtubeVideoId }: LiveStreamProps) => {
  const [playing, setPlaying] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState<DisplayItem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [phase, setPhase] = useState<"idle" | "showing" | "interval">("idle");
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const videoId = youtubeVideoId || "";
  const hasVideo = videoId.length > 0;
  const thumbnailUrl = hasVideo ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "";

  // DVR seek state
  const [dvrCurrentTime, setDvrCurrentTime] = useState(0);
  const [dvrDuration, setDvrDuration] = useState(0);
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const dvrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings
  const settingsRef = useRef<StreamSettings>({
    interval: 5, loopEnabled: true, loopHours: 24,
    overlayPosition: "bottom-right", overlaySize: "small",
    autoplay: true, muted: true, chatEnabled: false, paused: false,
  });
  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition>("bottom-right");
  const [overlaySize, setOverlaySize] = useState<OverlaySize>("small");
  const [chatEnabled, setChatEnabled] = useState(false);

  const queueIndexRef = useRef(0);
  const loopItemsRef = useRef<any[]>([]);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayStartTimeRef = useRef<number>(0);
  const priorityQueueRef = useRef<DisplayItem[]>([]);
  const currentPhotoRef = useRef<DisplayItem | null>(null);
  const phaseRef = useRef<"idle" | "showing" | "interval">("idle");
  const videoPausedRef = useRef(false);
  const timerPausedAtRef = useRef<number | null>(null);

  useEffect(() => { currentPhotoRef.current = currentPhoto; }, [currentPhoto]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { videoPausedRef.current = videoPaused; }, [videoPaused]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (playing) resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [playing, resetControlsTimer]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get("/settings");

      if (data) {
        const get = (key: string) => data[key];
        if (get("queue_interval_seconds")) settingsRef.current.interval = parseInt(get("queue_interval_seconds") || "5") || 5;
        if (get("queue_loop_enabled") !== undefined) settingsRef.current.loopEnabled = get("queue_loop_enabled") === "true";
        if (get("queue_loop_hours")) settingsRef.current.loopHours = parseInt(get("queue_loop_hours") || "24") || 24;
        if (get("stream_queue_paused") !== undefined) settingsRef.current.paused = get("stream_queue_paused") === "true";
        if (get("overlay_position")) {
          const pos = get("overlay_position") as OverlayPosition;
          if (POSITION_CLASSES[pos]) { settingsRef.current.overlayPosition = pos; setOverlayPosition(pos); }
        }
        if (get("overlay_size")) {
          const sz = get("overlay_size") as OverlaySize;
          if (SIZE_DIMENSIONS[sz]) { settingsRef.current.overlaySize = sz; setOverlaySize(sz); }
        }
        if (get("stream_autoplay") !== undefined) settingsRef.current.autoplay = get("stream_autoplay") !== "false";
        if (get("stream_muted") !== undefined) { settingsRef.current.muted = get("stream_muted") !== "false"; setMuted(get("stream_muted") !== "false"); }
        if (get("youtube_chat_enabled") !== undefined) { settingsRef.current.chatEnabled = get("youtube_chat_enabled") === "true"; setChatEnabled(get("youtube_chat_enabled") === "true"); }
      }
    } catch { /* best effort */ }
  }, []);

  const resolvePhotoUrl = (url: string) => {
    if (url && !url.startsWith("http")) {
      const filename = url.replace(/^uploads\/photos\//, "");
      return `${API_URL}/uploads/photos/${filename}`;
    }
    return url;
  };

  const trackView = useCallback(async (id: string, screenTimeSeconds: number) => {
    try {
      await api.post("/stream/queue/track-view", { id, screen_time_seconds: Math.round(screenTimeSeconds) });
    } catch { /* best effort */ }
  }, []);

  const getNextItem = useCallback(async (): Promise<DisplayItem | null> => {
    if (priorityQueueRef.current.length > 0) return priorityQueueRef.current.shift()!;

    try {
      const result = await api.get("/stream/queue/next");

      if (result?.item) {
        const item = result.item;
        return {
          id: item.id,
          photo_url: resolvePhotoUrl(item.photo_url),
          package_type: item.package_type,
          display_duration_seconds: item.display_duration_seconds,
          has_badge: item.has_badge || false,
          supporter_name: item.supporter_name || "Supporter",
          view_count: item.view_count || 0,
          total_screen_time_seconds: item.total_screen_time_seconds || 0,
        };
      }
    } catch { /* no waiting items */ }

    if (settingsRef.current.loopEnabled) {
      if (loopItemsRef.current.length === 0) {
        try {
          const displayData = await api.get("/stream/queue/display");
          const displayed = displayData?.recently_displayed || [];
          loopItemsRef.current = displayed;
          // Only reset index if this is a fresh fetch, not a refetch
          if (queueIndexRef.current >= displayed.length) {
            queueIndexRef.current = 0;
          }
        } catch {
          loopItemsRef.current = [];
        }
      }

      if (loopItemsRef.current.length > 0) {
        const idx = queueIndexRef.current % loopItemsRef.current.length;
        const item = loopItemsRef.current[idx];
        queueIndexRef.current = idx + 1;

        return {
          id: item.id,
          photo_url: resolvePhotoUrl(item.photo_url),
          package_type: item.package_type,
          display_duration_seconds: item.display_duration_seconds,
          has_badge: item.has_badge || false,
          supporter_name: item.supporter_name || (item.supporters as any)?.name || "Supporter",
          view_count: item.view_count || 0,
          total_screen_time_seconds: item.total_screen_time_seconds || 0,
        };
      }
    }

    return null;
  }, []);

  const markDisplayed = useCallback(async (id: string) => {
    try {
      await api.post("/stream/queue/advance", { queue_id: id });
    } catch { /* best effort */ }
  }, []);

  const runCycle = useCallback(async () => {
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);

    await loadSettings();

    if (settingsRef.current.paused) {
      cycleTimeoutRef.current = setTimeout(runCycle, 5000);
      return;
    }

    const item = await getNextItem();

    if (!item) {
      setCurrentPhoto(null);
      setPhase("idle");
      cycleTimeoutRef.current = setTimeout(runCycle, 5000);
      return;
    }

    setCurrentPhoto(item);
    setTimeRemaining(item.display_duration_seconds);
    setPhase("showing");
    displayStartTimeRef.current = Date.now();

    cycleTimeoutRef.current = setTimeout(async () => {
      const screenTime = (Date.now() - displayStartTimeRef.current) / 1000;
      await trackView(item.id, screenTime);
      await markDisplayed(item.id);

      setPhase("interval");
      setCurrentPhoto(null);

      if (priorityQueueRef.current.length > 0) {
        runCycle();
      } else {
        cycleTimeoutRef.current = setTimeout(() => runCycle(), settingsRef.current.interval * 1000);
      }
    }, item.display_duration_seconds * 1000);
  }, [getNextItem, loadSettings, markDisplayed, trackView]);

  // Countdown timer - pauses when video is paused
  useEffect(() => {
    if (phase !== "showing" || timeRemaining <= 0) return;
    if (videoPaused) { timerPausedAtRef.current = timeRemaining; return; }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, currentPhoto?.id, videoPaused]);

  // Pause/resume cycle timeout when video pauses
  useEffect(() => {
    if (phase !== "showing" || !currentPhoto) return;

    if (videoPaused) {
      if (cycleTimeoutRef.current) { clearTimeout(cycleTimeoutRef.current); cycleTimeoutRef.current = null; }
    } else if (timerPausedAtRef.current !== null) {
      const remaining = timerPausedAtRef.current;
      timerPausedAtRef.current = null;
      displayStartTimeRef.current = Date.now();

      cycleTimeoutRef.current = setTimeout(async () => {
        const screenTime = (Date.now() - displayStartTimeRef.current) / 1000;
        await trackView(currentPhoto.id, screenTime);
        await markDisplayed(currentPhoto.id);
        setPhase("interval");
        setCurrentPhoto(null);

        if (priorityQueueRef.current.length > 0) {
          runCycle();
        } else {
          cycleTimeoutRef.current = setTimeout(() => runCycle(), settingsRef.current.interval * 1000);
        }
      }, remaining * 1000);
    }
  }, [videoPaused, phase, currentPhoto]);

  // Realtime: listen for new queue items
  useEffect(() => {
    loadSettings().then(() => {
      if (settingsRef.current.autoplay && hasVideo) setPlaying(true);
      runCycle();
    });

    const es = new EventSource(`${API_URL}/stream/queue/stream`);
    es.addEventListener("queue-update", () => {
      // Clear loop cache and re-run cycle on any queue change
      loopItemsRef.current = [];
      if (phaseRef.current === "idle" || phaseRef.current === "interval") {
        if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
        runCycle();
      }
    });

    return () => {
      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
      es.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load YouTube IFrame API and create player
  useEffect(() => {
    if (!playing || !hasVideo) return;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      // Destroy existing player
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
      }

      ytPlayerRef.current = new window.YT.Player("yt-player-container", {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: muted ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          showinfo: 0,
          iv_load_policy: 3,
          disablekb: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            setVideoPaused(event.data === 2);
          },
          onReady: () => {
            // Start DVR polling
            if (dvrIntervalRef.current) clearInterval(dvrIntervalRef.current);
            dvrIntervalRef.current = setInterval(() => {
              if (!ytPlayerRef.current || isSeeking) return;
              try {
                const currentTime = ytPlayerRef.current.getCurrentTime?.() || 0;
                const duration = ytPlayerRef.current.getDuration?.() || 0;
                setDvrCurrentTime(currentTime);
                setDvrDuration(duration);
                // Consider "live edge" if within 15 seconds of the end
                setIsLiveEdge(duration > 0 && (duration - currentTime) < 15);
              } catch {}
            }, 500);
          },
        },
      });

      // Store iframe ref for the overscaling CSS
      setTimeout(() => {
        const iframe = document.querySelector("#yt-player-container") as HTMLIFrameElement;
        if (iframe) iframeRef.current = iframe;
      }, 100);
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Load the IFrame API script
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (dvrIntervalRef.current) clearInterval(dvrIntervalRef.current);
    };
  }, [playing, hasVideo, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (ytPlayerRef.current) {
      if (newMuted) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    }
  };

  const togglePause = () => {
    const newPaused = !videoPaused;
    setVideoPaused(newPaused);
    if (ytPlayerRef.current) {
      if (newPaused) ytPlayerRef.current.pauseVideo?.();
      else ytPlayerRef.current.playVideo?.();
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerContainerRef.current.requestFullscreen();
    }
  };

  const seekTo = (seconds: number) => {
    if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(seconds, true);
      setDvrCurrentTime(seconds);
      setIsLiveEdge((dvrDuration - seconds) < 15);
    }
  };

  const jumpToLive = () => {
    if (ytPlayerRef.current?.seekTo && dvrDuration > 0) {
      ytPlayerRef.current.seekTo(dvrDuration - 2, true);
      setIsLiveEdge(true);
      if (videoPaused) {
        ytPlayerRef.current.playVideo?.();
        setVideoPaused(false);
      }
    }
  };

  const formatDvrTime = (seconds: number) => {
    const totalSec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Seek bar mouse/touch handlers
  const seekBarRef = useRef<HTMLDivElement>(null);

  const getSeekPosition = (clientX: number) => {
    if (!seekBarRef.current || dvrDuration <= 0) return 0;
    const rect = seekBarRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return fraction * dvrDuration;
  };

  const handleSeekMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSeeking(true);
    const pos = getSeekPosition(e.clientX);
    setSeekPreview(pos);

    const handleMove = (ev: MouseEvent) => {
      setSeekPreview(getSeekPosition(ev.clientX));
    };
    const handleUp = (ev: MouseEvent) => {
      const finalPos = getSeekPosition(ev.clientX);
      seekTo(finalPos);
      setIsSeeking(false);
      setSeekPreview(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleSeekTouchStart = (e: React.TouchEvent) => {
    setIsSeeking(true);
    const pos = getSeekPosition(e.touches[0].clientX);
    setSeekPreview(pos);

    const handleTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      setSeekPreview(getSeekPosition(ev.touches[0].clientX));
    };
    const handleTouchEnd = (ev: TouchEvent) => {
      const finalPos = ev.changedTouches[0] ? getSeekPosition(ev.changedTouches[0].clientX) : seekPreview || 0;
      seekTo(finalPos);
      setIsSeeking(false);
      setSeekPreview(null);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
  };

  const sizeCfg = SIZE_DIMENSIONS[overlaySize];

  return (
    <section ref={sectionRef} id="livestream" className="py-12 md:py-16 px-4 bg-background relative overflow-hidden">
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [80, -80]) }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full blur-[150px] pointer-events-none"
        aria-hidden
      >
        <div className="w-full h-full" style={{ background: "hsl(var(--gold) / 0.06)" }} />
      </motion.div>
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 bg-accent/15 text-accent px-4 py-1.5 rounded-full text-xs font-bold uppercase mb-4">
            <span className="live-dot" /> Live Now
          </div>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-2">
            WATCH THE STREAM
          </h2>
          <ViewerCount />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Custom Video Player Container */}
          <div
            ref={playerContainerRef}
            className="relative rounded-2xl overflow-hidden bg-black group"
            style={{ boxShadow: "0 0 60px hsl(var(--gold) / 0.15)" }}
            onMouseMove={resetControlsTimer}
            onMouseEnter={resetControlsTimer}
          >
            {/* Aspect ratio wrapper */}
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              {playing && hasVideo ? (
                <>
                   {/* YouTube Player via IFrame API — vertically oversized to hide YouTube controls/overlays */}
                   <div className="absolute inset-0 overflow-hidden">
                     <div
                       id="yt-player-container"
                       className="absolute w-full border-0"
                       style={{
                         top: "-150px",
                         left: 0,
                         width: "100%",
                         height: "calc(100% + 300px)",
                         pointerEvents: "none",
                       }}
                     />
                     {/* Transparent click catcher for play/pause */}
                     <div
                       className="absolute inset-0 z-10 cursor-pointer"
                       onClick={togglePause}
                       onDoubleClick={toggleFullscreen}
                     />
                   </div>

                  {/* Photo Overlay — native-feeling, part of the player */}
                  <AnimatePresence>
                    {currentPhoto && (
                      <motion.div
                        key={currentPhoto.id + "-" + queueIndexRef.current}
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={`absolute ${POSITION_CLASSES[overlayPosition]} ${sizeCfg.w} z-20 pointer-events-none`}
                      >
                        <div
                          className="rounded-lg overflow-hidden backdrop-blur-md"
                          style={{
                            background: "rgba(0,0,0,0.6)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <div className="p-1.5">
                            <img
                              src={currentPhoto.photo_url}
                              alt={`Photo by ${currentPhoto.supporter_name}`}
                              className={`w-full ${sizeCfg.imgMax} object-contain rounded`}
                            />
                          </div>
                          <div className="px-2 pb-1.5 flex items-center justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="live-dot" style={{ width: 5, height: 5 }} />
                                <span className="text-white/90 text-[10px] font-semibold truncate">
                                  {currentPhoto.supporter_name}
                                </span>
                                {currentPhoto.has_badge && <Crown size={9} className="text-primary shrink-0" />}
                              </div>
                              <p className="text-white/40 text-[8px] uppercase tracking-wider">
                                {currentPhoto.package_type === "premium" ? "★ Premium" : "Supporter"}
                              </p>
                            </div>
                            <div className="text-white/30 text-[10px] font-mono tabular-nums shrink-0">
                              {videoPaused ? "⏸" : `${timeRemaining}s`}
                            </div>
                          </div>
                          {/* Countdown progress bar */}
                          <div className="h-0.5 w-full bg-white/10">
                            <motion.div
                              className="h-full bg-primary"
                              initial={{ width: "100%" }}
                              animate={{ width: videoPaused ? undefined : "0%" }}
                              transition={videoPaused ? {} : { duration: timeRemaining, ease: "linear" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Floating Chat Overlay — transparent, inside player */}
                  {chatEnabled && hasVideo && (
                    <AnimatePresence>
                      {showChat && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                          className="absolute top-2 right-2 z-20 pointer-events-auto"
                          style={{ width: "280px", height: "60%" }}
                        >
                          <div
                            className="w-full h-full rounded-lg overflow-hidden"
                            style={{
                              background: "rgba(0,0,0,0.4)",
                              backdropFilter: "blur(8px)",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <iframe
                              src={`https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}&dark_theme=1`}
                              title="Live Chat"
                              className="w-full h-full border-0"
                              style={{ opacity: 0.9 }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Pause overlay icon */}
                  <AnimatePresence>
                    {videoPaused && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none"
                      >
                        <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <Pause size={28} className="text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                   {/* Custom Controls Bar with DVR Seek */}
                   <motion.div
                     initial={false}
                     animate={{ opacity: controlsVisible || videoPaused ? 1 : 0 }}
                     transition={{ duration: 0.3 }}
                     className="absolute bottom-0 left-0 right-0 z-30"
                   >
                     {/* DVR Seek Bar */}
                     <div className="px-3">
                       <div
                         ref={seekBarRef}
                         className="relative h-5 flex items-center cursor-pointer group/seek"
                         onMouseDown={handleSeekMouseDown}
                         onTouchStart={handleSeekTouchStart}
                       >
                         {/* Track background */}
                         <div className="absolute left-0 right-0 h-[3px] group-hover/seek:h-[5px] transition-all bg-white/20 rounded-full">
                           {/* Buffered / playable range */}
                           <div
                             className="absolute h-full bg-white/30 rounded-full"
                             style={{ width: "100%" }}
                           />
                           {/* Current progress */}
                           <div
                             className="absolute h-full rounded-full transition-all"
                             style={{
                               width: dvrDuration > 0
                                 ? `${((seekPreview ?? dvrCurrentTime) / dvrDuration) * 100}%`
                                 : "0%",
                               background: isLiveEdge && seekPreview === null
                                 ? "hsl(var(--accent))"
                                 : "hsl(var(--primary))",
                             }}
                           />
                         </div>
                         {/* Seek thumb */}
                         {dvrDuration > 0 && (
                           <div
                             className="absolute w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
                             style={{
                               left: `calc(${((seekPreview ?? dvrCurrentTime) / dvrDuration) * 100}% - 6px)`,
                             }}
                           />
                         )}
                         {/* Seek preview tooltip */}
                         {isSeeking && seekPreview !== null && dvrDuration > 0 && (
                           <div
                             className="absolute -top-7 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono pointer-events-none whitespace-nowrap"
                             style={{
                               left: `calc(${(seekPreview / dvrDuration) * 100}% - 20px)`,
                             }}
                           >
                             -{formatDvrTime(dvrDuration - seekPreview)}
                           </div>
                         )}
                       </div>
                     </div>

                     <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                       {/* Play/Pause */}
                       <button
                         onClick={togglePause}
                         className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                         aria-label={videoPaused ? "Play" : "Pause"}
                       >
                         {videoPaused ? <Play size={18} fill="white" /> : <Pause size={18} />}
                       </button>

                       {/* Volume */}
                       <button
                         onClick={toggleMute}
                         className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                         aria-label={muted ? "Unmute" : "Mute"}
                       >
                         {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                       </button>

                       {/* Time display */}
                       {dvrDuration > 0 && (
                         <span className="text-white/60 text-[10px] font-mono tabular-nums ml-1">
                           {!isLiveEdge && `-${formatDvrTime(dvrDuration - dvrCurrentTime)}`}
                         </span>
                       )}

                       <div className="flex-1" />

                       {/* Live badge / Jump to Live */}
                       <button
                         onClick={jumpToLive}
                         className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                           isLiveEdge
                             ? "bg-accent/90 text-white cursor-default"
                             : "bg-white/10 text-white/60 hover:bg-accent/70 hover:text-white"
                         }`}
                         title={isLiveEdge ? "Watching live" : "Jump to live"}
                       >
                         {isLiveEdge ? (
                           <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                         ) : (
                           <Radio size={10} />
                         )}
                         LIVE
                       </button>

                       {/* Chat toggle */}
                       {chatEnabled && (
                         <button
                           onClick={() => setShowChat(!showChat)}
                           className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                           aria-label={showChat ? "Hide chat" : "Show chat"}
                         >
                           {showChat ? <MessageSquareOff size={18} /> : <MessageSquare size={18} />}
                         </button>
                       )}

                       {/* Fullscreen */}
                       <button
                         onClick={toggleFullscreen}
                         className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                         aria-label="Fullscreen"
                       >
                         <Maximize size={18} />
                       </button>
                     </div>
                   </motion.div>
                </>
              ) : (
                <button
                  onClick={() => { if (hasVideo) setPlaying(true); }}
                  className="absolute inset-0 w-full h-full group cursor-pointer"
                  aria-label="Play live stream"
                >
                  {hasVideo ? (
                    <img src={thumbnailUrl} alt="Stream thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <img src={heroBurger.src} alt="The Last Burger" className="w-full h-full object-cover opacity-40" style={{ filter: "saturate(1.2) brightness(0.7)" }} />
                  )}
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 glow-red">
                        <Play size={32} className="text-white ml-1" fill="white" />
                      </div>
                      <p className="text-white font-semibold text-sm">
                        {hasVideo ? "Click to Watch" : "Stream starts soon — check back!"}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        {hasVideo ? "Stream is live — tap to play" : "The live stream will appear here when we go live"}
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <a href="#support" className="btn-red !rounded-lg inline-flex items-center gap-2">
            🍔 Get Your Photo On Stream — $10
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default LiveStream;
