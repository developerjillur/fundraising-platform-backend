"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api-client";

interface RecentSupporter {
  name: string;
  created_at: string;
}

const SocialProofToast = () => {
  const [supporter, setSupporter] = useState<RecentSupporter | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchRecent = async () => {
    const data = await api.get("/fundraising/recent-supporters");

    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setSupporter(random);
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    }
  };

  useEffect(() => {
    // First toast after 15s
    const initial = setTimeout(fetchRecent, 15000);
    // Then every 35-45s
    const interval = setInterval(() => {
      fetchRecent();
    }, 35000 + Math.random() * 10000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <AnimatePresence>
      {visible && supporter && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 md:bottom-6 left-4 z-40 max-w-[300px] bg-card border border-border rounded-xl p-3 shadow-lg shadow-foreground/[0.06]"
        >
          <p className="text-sm text-foreground font-medium">
            🍔 {supporter.name} just got their photo on stream!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {timeAgo(supporter.created_at)}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SocialProofToast;