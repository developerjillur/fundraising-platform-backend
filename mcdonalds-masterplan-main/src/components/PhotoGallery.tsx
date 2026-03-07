import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";
import { ImageOff } from "lucide-react";

interface DisplayedPhoto {
  id: string;
  photo_url: string;
  supporter_name: string;
  displayed_at: string;
}

const PhotoGallery = () => {
  const [photos, setPhotos] = useState<DisplayedPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhotos = async () => {
      const data = await api.get("/fundraising/displayed-photos");

      if (data) {
        setPhotos(
          (data as any[]).map((d) => ({
            id: d.id,
            photo_url: d.photo_url!,
            supporter_name: d.name,
            displayed_at: d.displayed_at!,
          }))
        );
      }
      setLoading(false);
    };
    fetchPhotos();
  }, []);

  if (loading || photos.length === 0) return null;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <section className="py-12 md:py-16 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-gradient-gold mb-3">
            WALL OF FAME
          </h2>
          <p className="text-muted-foreground text-lg">
            Recently displayed on stream — your photo could be next
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-card shadow-sm shadow-foreground/[0.03]"
            >
              <img
                src={photo.photo_url}
                alt={`Photo by ${photo.supporter_name}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                <div>
                  <p className="text-foreground text-xs font-semibold truncate">{photo.supporter_name}</p>
                  <p className="text-muted-foreground text-[10px]">{timeAgo(photo.displayed_at)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <a
            href="#support"
            className="text-primary font-semibold text-sm hover:underline inline-flex items-center gap-1"
          >
            Get your photo on the wall →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default PhotoGallery;
