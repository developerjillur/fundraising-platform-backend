import { useSiteSettings } from "@/hooks/use-site-settings";
import { Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FundraisingTracker from "@/components/FundraisingTracker";
import SocialProofToast from "@/components/SocialProofToast";
import AsSeenOn from "@/components/AsSeenOn";
import Story from "@/components/Story";
import HowItWorks from "@/components/HowItWorks";
import LiveStream from "@/components/LiveStream";
import StreamQueue from "@/components/StreamQueue";
import Support from "@/components/Support";
import PhotoGallery from "@/components/PhotoGallery";
import Merchandise from "@/components/Merchandise";
import GrandPrize from "@/components/GrandPrize";
import CountdownTimer from "@/components/CountdownTimer";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import SectionDivider from "@/components/SectionDivider";

const Index = () => {
  const { isEnabled, getSetting, loading } = useSiteSettings();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Show sticky mobile CTA after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const announcementBanner = getSetting("announcement_banner");

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Banner */}
      {announcementBanner && !bannerDismissed && (
        <div className="bg-accent text-accent-foreground text-center py-2.5 px-4 text-sm font-medium relative z-[60]">
          <span>{announcementBanner}</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
            aria-label="Dismiss announcement"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Header siteTitle={getSetting("site_title")} />
      <Hero
        headline={getSetting("hero_headline")}
        subheadline={getSetting("hero_subheadline")}
        ctaText={getSetting("cta_button_text")}
      />
      {isEnabled("fundraising_tracker_visible") && <FundraisingTracker />}
      <AsSeenOn />
      <SectionDivider />
      <Story />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
      {isEnabled("livestream_enabled") && <LiveStream youtubeVideoId={getSetting("youtube_video_id")} />}
      {isEnabled("stream_queue_visible") && <StreamQueue />}
      <SectionDivider />
      {isEnabled("photo_submissions_enabled") && <Support />}
      <PhotoGallery />
      <SectionDivider />
      {isEnabled("merch_store_enabled") && <Merchandise />}
      <SectionDivider />
      {isEnabled("grand_prize_enabled") && <GrandPrize />}
      {isEnabled("grand_prize_enabled") && <CountdownTimer drawDate={getSetting("grand_prize_draw_date")} />}
      <SectionDivider />
      {isEnabled("faq_enabled") && <FAQ />}
      <Footer
        footerText={getSetting("footer_text")}
        socialTwitter={getSetting("social_twitter")}
        socialInstagram={getSetting("social_instagram")}
        contactEmail={getSetting("contact_email")}
      />

      {/* Social Proof Toast */}
      <SocialProofToast />

      {/* Sticky Mobile CTA */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
          >
            <a
              href="#support"
              className="flex items-center justify-center gap-2 py-4 text-white font-bold text-sm"
              style={{ background: "hsl(var(--mcred))" }}
            >
              🍔 GET YOUR PHOTO — $10
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
