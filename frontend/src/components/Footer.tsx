"use client";

import { motion } from "framer-motion";
import { ArrowUp, Heart, Mail, Globe } from "lucide-react";

interface FooterProps {
  footerText?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  contactEmail?: string;
}

const Footer = ({ footerText, socialTwitter, socialInstagram, contactEmail }: FooterProps) => {
  const displayFooter = footerText || `© ${new Date().getFullYear()} The Last Burger. All rights reserved.`;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="relative border-t border-border overflow-hidden" style={{ background: "rgb(10, 13, 18)", color: "hsl(var(--section-footer-fg))" }}
    >
      {/* Subtle ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[80px] bg-primary/5 blur-[60px] rounded-full" />

      <div className="relative z-10 px-4 pt-16 pb-8">
        <div className="container mx-auto max-w-6xl">
          {/* Top section with CTA */}
          <div className="text-center mb-14">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-2xl sm:text-3xl text-gradient-gold mb-3"
            >
              BE PART OF HISTORY
            </motion.p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Every photo, every purchase, every share brings us closer to the goal. Join thousands making internet history.
            </p>
            <a
              href="#support"
              className="btn-red animate-pulse-red inline-flex items-center gap-2 text-base"
            >
              🍔 Get Your Photo On Stream
            </a>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-12" />

          {/* Main grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <p className="font-display text-xl text-primary mb-3">🍔 THE LAST BURGER</p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                The world's most preserved fast food item, now powering the internet's biggest fundraiser.
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Made with</span>
                <Heart size={12} className="text-accent fill-accent" />
                <span>for charity</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <p className="font-display text-foreground mb-4 text-sm tracking-wider">Navigate</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-primary transition-colors">Home</a>
                <a href="#story" className="block hover:text-primary transition-colors">The Story</a>
                <a href="#livestream" className="block hover:text-primary transition-colors">Live Stream</a>
                <a href="#support" className="block hover:text-primary transition-colors">Support</a>
                <a href="#merch" className="block hover:text-primary transition-colors">Merch</a>
                <a href="#faq" className="block hover:text-primary transition-colors">FAQ</a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="font-display text-foreground mb-4 text-sm tracking-wider">Legal</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <a href="/privacy" className="block hover:text-primary transition-colors">Privacy Policy</a>
                <a href="/terms" className="block hover:text-primary transition-colors">Terms of Service</a>
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Mail size={13} /> Contact Us
                  </a>
                )}
              </div>
            </div>

            {/* Social & Community */}
            <div>
              <p className="font-display text-foreground mb-4 text-sm tracking-wider">Community</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                {socialTwitter && (
                  <a
                    href={socialTwitter.startsWith("http") ? socialTwitter : `https://x.com/${socialTwitter.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Globe size={13} /> Twitter / X
                  </a>
                )}
                {socialInstagram && (
                  <a
                    href={socialInstagram.startsWith("http") ? socialInstagram : `https://instagram.com/${socialInstagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Globe size={13} /> Instagram
                  </a>
                )}
                <a href="#livestream" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <span className="live-dot scale-75" /> Watch Live
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs text-muted-foreground">{displayFooter}</p>
              <p className="text-xs text-muted-foreground mt-1">
                All proceeds go to charity. Not affiliated with McDonald's Corporation.
              </p>
            </div>
            <button
              onClick={scrollToTop}
              className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              aria-label="Back to top"
            >
              Back to top
              <span className="w-8 h-8 rounded-full border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
                <ArrowUp size={14} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
