import { motion } from "framer-motion";

const pressItems = [
  { name: "BBC News", quote: "The burger that broke the internet" },
  { name: "The Guardian", quote: "Iceland's most famous export" },
  { name: "CNN", quote: "A fundraiser like no other" },
  { name: "Vice", quote: "The last meal standing" },
  { name: "Reuters", quote: "15 years and still going" },
];

const AsSeenOn = () => {
  return (
    <section className="py-10 md:py-12 px-4 border-y border-border/50 bg-background">
      <div className="container mx-auto max-w-5xl">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs uppercase tracking-[0.25em] text-muted-foreground mb-6 font-medium"
        >
          As Seen On
        </motion.p>

        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {pressItems.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center group"
            >
              <p className="font-display text-lg md:text-xl text-foreground/30 group-hover:text-foreground/60 transition-colors tracking-wider">
                {item.name}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AsSeenOn;
