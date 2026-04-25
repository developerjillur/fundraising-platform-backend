"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Check, Crown, Clock, Image, Loader2, ShieldCheck } from "lucide-react";
import { uploadPhoto, createPhotoCheckout } from "@/lib/api";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useNsfwCheck } from "@/hooks/use-nsfw-check";

type Package = "standard" | "premium";

type PhotoPackage = {
  slug: string;
  name: string;
  price_cents: number;
  display_duration_seconds: number;
  has_badge: boolean;
  description: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;

const Support = () => {
  const [selectedPackage, setSelectedPackage] = useState<Package>("premium");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packages, setPackages] = useState<PhotoPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [photoSafe, setPhotoSafe] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const { analyzeImage, isChecking: isNsfwChecking } = useNsfwCheck();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await api.get("/photos/packages");
        if (data?.length) {
          setPackages(data);
        } else {
          setPackages([
            { slug: "standard", name: "Standard", price_cents: 1000, display_duration_seconds: 10, has_badge: false, description: "Your photo displayed on the live stream for 10 seconds" },
            { slug: "premium", name: "Premium", price_cents: 2500, display_duration_seconds: 30, has_badge: true, description: "Your photo displayed for 30 seconds with a premium badge overlay" },
          ]);
        }
      } catch (e) {
        setPackages([
          { slug: "standard", name: "Standard", price_cents: 1000, display_duration_seconds: 10, has_badge: false, description: "Your photo displayed on the live stream for 10 seconds" },
          { slug: "premium", name: "Premium", price_cents: 2500, display_duration_seconds: 30, has_badge: true, description: "Your photo displayed for 30 seconds with a premium badge overlay" },
        ]);
      }
      setLoadingPackages(false);
    };

    const fetchQueueCount = async () => {
      try {
        const data = await api.get("/stream/queue/count");
        setQueueCount(Number(data?.count) || 0);
      } catch (e) {
        console.error("Failed to load queue count", e);
      }
    };

    fetchPackages();
    fetchQueueCount();
  }, []);

  const getPackageFeatures = (pkg: PhotoPackage) => {
    const features = [
      "Photo displayed on live stream",
      `${pkg.display_duration_seconds} second display time`,
      "Name shown on stream",
      "Keepsake screenshot emailed to you",
    ];
    if (pkg.has_badge) {
      features.splice(2, 0, "Gold premium badge overlay", "Priority queue position");
    }
    return features;
  };

  const selectedPkg = packages.find(p => p.slug === selectedPackage) || packages[0];

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Max 10MB.");
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type. Only JPG, PNG, GIF, WebP allowed.");
        return;
      }

      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoSafe(false);

      // Run client-side NSFW check
      const result = await analyzeImage(file);
      if (result.isNsfw) {
        toast.error("This photo appears to contain inappropriate content. Please upload a different, family-friendly photo.");
        setPhoto(null);
        setPhotoPreview(null);
        setPhotoSafe(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPhotoSafe(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingRef.current) {
      toast.warning("Payment is already being processed. Please wait.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) { toast.error("Please enter your name."); return; }
    if (trimmedName.length > MAX_NAME_LENGTH) { toast.error(`Name must be less than ${MAX_NAME_LENGTH} characters.`); return; }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) { toast.error("Please enter a valid email address."); return; }
    if (trimmedEmail.length > MAX_EMAIL_LENGTH) { toast.error(`Email must be less than ${MAX_EMAIL_LENGTH} characters.`); return; }
    if (!photo) { toast.error("Please upload a photo before submitting."); return; }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      let photoPath: string | null = null;
      if (photo) {
        photoPath = await uploadPhoto(photo);
        if (!photoPath) {
          toast.error("Photo upload failed. Please try again.");
          return;
        }
      }

      const result = await createPhotoCheckout({
        name: trimmedName,
        email: trimmedEmail,
        package_type: selectedPackage,
        photo_storage_path: photoPath,
      });

      if (result?.url) {
        window.location.href = result.url;
      } else if (result?.error) {
        if (result.moderation_rejected) {
          toast.error("Your photo was rejected by our content moderation system. Please upload a different, family-friendly photo.");
        } else if (result.duplicate) {
          toast.warning("You already have a pending submission. Please complete your existing payment or wait a moment before trying again.");
        } else {
          toast.error(result.error);
        }
      } else {
        toast.error("Failed to create checkout. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong.";
      if (msg.includes("Photo rejected")) {
        toast.error("Your photo was rejected by our content moderation system. Please upload a different, family-friendly photo.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => { submittingRef.current = false; }, 3000);
    }
  };

  if (loadingPackages) {
    return (
      <section id="support" className="py-16 px-4">
        <div className="container mx-auto max-w-5xl flex justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </section>
    );
  }

  const estimatedWaitMin = Math.max(1, Math.ceil((queueCount * 15) / 60));

  return (
    <section id="support" className="py-12 md:py-16 px-4 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full blur-[200px] -translate-y-1/2 dark:hidden" style={{ background: "hsl(38 100% 50% / 0.04)" }} />
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-4">
            GET YOUR PHOTO ON STREAM
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose your package, upload your photo, and watch it appear live on the world's most famous burger stream.
          </p>
          {queueCount > 0 && (
            <p className="text-sm text-muted-foreground mt-3 font-mono-num">
              ~{queueCount} photos in queue • Est. wait: ~{estimatedWaitMin} min
            </p>
          )}
        </motion.div>

        {/* Package selection */}
        <div
          className="grid md:grid-cols-2 gap-6 mb-10"
          role="radiogroup"
          aria-label="Photo package"
        >
          {packages.map((pkg) => {
            const key = pkg.slug as Package;
            const features = getPackageFeatures(pkg);
            const price = (pkg.price_cents / 100).toFixed(0);
            const isPremium = key === "premium";
            const isSelected = selectedPackage === key;
            return (
              <motion.button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${pkg.name} package, $${price}, ${pkg.display_duration_seconds} seconds display${pkg.has_badge ? ", with premium badge" : ""}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => setSelectedPackage(key)}
                className={`relative text-left p-6 rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                  isSelected
                    ? isPremium
                      ? "border-primary bg-primary/5 glow-gold"
                      : "border-accent bg-accent/5 glow-red"
                    : "border-border bg-card hover:border-muted-foreground/30"
                } ${isPremium ? "md:scale-[1.03]" : ""}`}
              >
                {pkg.has_badge && (
                  <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 font-display tracking-wider">
                    <Crown size={12} aria-hidden="true" /> MOST POPULAR
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-3xl text-foreground">{pkg.name}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                      <Clock size={14} />
                      {pkg.display_duration_seconds} seconds display
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-num text-4xl font-bold text-foreground">${price}</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check size={14} className={selectedPackage === key ? "text-primary" : "text-muted-foreground"} />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>

        {/* Upload form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          onSubmit={handleSubmit}
          className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-8 shadow-sm shadow-foreground/[0.03]"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Your Name</label>
              <input
                type="text"
                required
                maxLength={MAX_NAME_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we display your name?"
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                required
                maxLength={MAX_EMAIL_LENGTH}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="For receipt & display notification"
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Your Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handlePhotoChange}
                className="sr-only"
              />
              {photoPreview ? (
                <div className="relative group">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                  {isNsfwChecking && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm font-medium">Scanning photo...</span>
                      </div>
                    </div>
                  )}
                  {!isNsfwChecking && photoSafe && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} /> Safe
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-foreground font-medium rounded-lg"
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Image size={32} />
                  <span className="text-sm">Click to upload (JPG, PNG, GIF, WebP — max 10MB)</span>
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isNsfwChecking || !photoSafe}
            className="w-full mt-6 btn-red !rounded-lg !text-lg animate-pulse-red disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Checking your photo & processing...
              </>
            ) : (
              `🍔 PAY $${selectedPkg ? (selectedPkg.price_cents / 100).toFixed(0) : '10'} — GET ON STREAM NOW!`
            )}
          </button>

          <div className="text-center mt-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              🔒 Secure payment via Stripe
            </p>
            <p className="text-xs text-muted-foreground">
              ✓ <span className="font-mono-num">12,453</span> photos already displayed on stream
            </p>
          </div>
        </motion.form>
      </div>
    </section>
  );
};

export default Support;
