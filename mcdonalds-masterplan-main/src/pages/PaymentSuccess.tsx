import { useSearchParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { CheckCircle, Clock, ArrowLeft, Package } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "photo";
  const sessionId = searchParams.get("session_id");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    if (type === "photo") {
      const calculateETA = async () => {
        try {
          const data = await api.get("/stream/queue/count");
          const waitingCount = Number(data.count) || 0;
          if (waitingCount > 0) {
            // Estimate ~15 seconds per item average
            setEtaMinutes(Math.max(5, Math.ceil((waitingCount * 15) / 60)));
          } else {
            setEtaMinutes(5);
          }
        } catch {
          setEtaMinutes(15);
        }
      };
      calculateETA();
    }

    // Fetch order number for merch orders (retry up to 10 times since webhook may be delayed)
    if (type === "merch" && sessionId) {
      let attempts = 0;
      const fetchOrder = async () => {
        try {
          const data = await api.get(`/merchandise/orders/by-session/${sessionId}`);
          if (data?.order_number) {
            setOrderNumber(data.order_number);
          } else if (attempts < 10) {
            attempts++;
            setTimeout(fetchOrder, 2000);
          }
        } catch { /* ignore */ }
      };
      fetchOrder();
    }
  }, [type, sessionId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-primary" size={32} />
        </div>

        <h1 className="font-display text-4xl text-gradient-gold mb-3">PAYMENT SUCCESSFUL!</h1>

        {type === "photo" ? (
          <>
            <p className="text-muted-foreground mb-6">
              Your photo has been submitted! It will go through a quick moderation check
              and then be added to the display queue.
            </p>
            <div className="bg-secondary rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Clock size={16} />
                <span className="font-semibold">Estimated display time</span>
              </div>
              <p className="text-foreground font-display text-2xl mt-1">
                ~{etaMinutes ?? "..."} minutes
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                You'll receive an email with a screenshot when your photo is displayed!
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              Your merchandise order has been placed! You'll receive a confirmation
              email with tracking details once your order ships.
            </p>
            {orderNumber && (
              <div className="bg-secondary rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-primary mb-1">
                  <Package size={16} />
                  <span className="font-semibold">Your Order Number</span>
                </div>
                <p className="font-mono text-lg text-foreground font-medium">{orderNumber}</p>
                <p className="text-muted-foreground text-xs mt-2">
                  Save this to track your order anytime.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-3">
          {type === "merch" && (
            <Link to="/track-order" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              <Package size={16} /> Track Your Order
            </Link>
          )}
          {type === "photo" && (
            <a href="/#livestream" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              🍔 Watch the Stream
            </a>
          )}
          <Link to="/" className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
