"use client";

import Link from "next/link";
import { XCircle, ArrowLeft, RefreshCw, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <XCircle className="text-accent" size={32} />
        </div>

        <h1 className="font-display text-4xl text-gradient-red mb-3">PAYMENT CANCELLED</h1>

        <p className="text-muted-foreground mb-6">
          Your payment was not completed. No charges were made.
          Feel free to try again whenever you&apos;re ready!
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/#support"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={16} />
            Try Again — Get Your Photo on Stream
          </Link>
          <Link
            href="/#merch"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
          >
            <ShoppingBag size={16} />
            Browse Merchandise Instead
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
