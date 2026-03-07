import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw, ShoppingBag, Mail } from "lucide-react";
import { motion } from "framer-motion";

const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");
  const email = searchParams.get("email");

  const errorMessages: Record<string, string> = {
    card_declined: "Your card was declined. Please try a different payment method.",
    insufficient_funds: "Insufficient funds. Please use a different card or contact your bank.",
    expired_card: "Your card has expired. Please update your payment details.",
    processing_error: "A processing error occurred. Please try again in a few moments.",
    authentication_failed: "Card authentication failed. Please try again or use a different card.",
  };

  const displayMessage = reason
    ? errorMessages[reason] || "Something went wrong during payment processing."
    : "Your payment could not be completed. No charges were made to your account.";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-destructive" size={32} />
        </div>

        <h1 className="font-display text-4xl text-gradient-red mb-3">PAYMENT FAILED</h1>

        <p className="text-muted-foreground mb-2">{displayMessage}</p>

        {email && (
          <p className="text-xs text-muted-foreground mb-6 flex items-center justify-center gap-1">
            <Mail size={12} /> {email}
          </p>
        )}

        {!email && <div className="mb-6" />}

        <div className="bg-secondary/50 rounded-lg p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-foreground mb-2">What you can try:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Use a different credit or debit card
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Check that your card details are correct
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Contact your bank to authorize the transaction
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Try again in a few minutes
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/#support"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={16} />
            Try Again
          </Link>
          <Link
            to="/#merch"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
          >
            <ShoppingBag size={16} />
            Browse Merchandise
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentFailed;