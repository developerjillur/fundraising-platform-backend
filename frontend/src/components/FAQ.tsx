"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Is this real? Like, actually real?",
    a: "100% real. In 2009, McDonald's closed all locations in Iceland. The final burger purchased has been preserved ever since, becoming one of the world's most famous food artifacts. We're using it to power the biggest fundraiser the internet has ever seen.",
  },
  {
    q: "What happens to my photo?",
    a: "After your payment is confirmed, your photo enters a queue. When it's your turn, your photo is displayed on the YouTube live stream for everyone to see. Standard package gives you 10 seconds, Premium gives you 30 seconds with a special gold premium badge overlay.",
  },
  {
    q: "How long until my photo is shown?",
    a: "After purchasing, you'll see an estimated display time based on your queue position. You can check your status anytime using the email confirmation link. When your photo airs, you'll get an email with a keepsake screenshot from the live stream.",
  },
  {
    q: "What photos are allowed?",
    a: "All photos go through automatic content moderation (AWS Rekognition) that screens for explicit, violent, or otherwise inappropriate content. Keep it fun and family-friendly!",
  },
  {
    q: "What if my photo is rejected?",
    a: "If moderation flags your photo, you'll receive an email with a re-upload link. Your payment stays valid — just upload a different photo and you're back in the queue. You can re-upload up to 3 times.",
  },
  {
    q: "Will I get a copy of my moment on stream?",
    a: "Yes! Once your photo airs, we automatically capture a screenshot from the live stream and email it to you as a keepsake. Premium supporters get the gold badge baked into their screenshot.",
  },
  {
    q: "What's the difference between Standard and Premium?",
    a: "Standard ($10) shows your photo for 10 seconds. Premium ($25) shows it for 30 seconds with a gold PREMIUM SUPPORTER badge overlay on the stream and on your keepsake screenshot. Premium also gives you priority placement in the queue and more grand prize entries.",
  },
  {
    q: "Where does the money go?",
    a: "100% of proceeds go to the fundraising goal. Detailed breakdown and charity partners will be announced as we hit key milestones.",
  },
  {
    q: "Can I really win the grand prize?",
    a: "Yes! Every $10 spent gives you an entry into the grand prize draw. Premium photo purchases ($25) give you 2-3 entries. Merch purchases give you entries based on order value. The winner will be drawn live on stream.",
  },
  {
    q: "How does merchandise shipping work?",
    a: "Merch is fulfilled by Printful — they print and ship every order on demand directly to you. Most items ship within 2-7 business days. You'll get a tracking link by email once your order is on the way.",
  },
  {
    q: "Can I track my merch order?",
    a: "Yes — visit our Track Order page and enter your email or order number. You'll see live status from order placed through to delivery, plus a tracking link once it ships.",
  },
  {
    q: "Do I need to create an account?",
    a: "Nope! The entire process is frictionless. Just provide your name, email, upload a photo (or pick merch), pay, and you're done. No accounts, no passwords.",
  },
  {
    q: "Is my payment information safe?",
    a: "Yes. All payments are processed by Stripe — we never see or store your card details. Stripe is PCI-DSS compliant and used by millions of businesses worldwide.",
  },
  {
    q: "Can I get a refund?",
    a: "Photo purchases are non-refundable once your photo enters the queue. If you have a question about an order or want to report an issue, email hello@lastmcdonaldsburger.com.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-12 md:py-16 px-4 bg-background relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[180px] dark:hidden" style={{ background: "hsl(38 100% 50% / 0.04)" }} />
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl sm:text-5xl text-gradient-gold mb-2">
            GOT QUESTIONS?
          </h2>
          <p className="text-muted-foreground">We've got answers.</p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <AccordionItem
                value={`faq-${i}`}
                className="glass-card rounded-xl px-6 border-b border-border/50 data-[state=open]:border-primary/30 transition-all"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary py-4 text-[15px]">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-foreground/70 pb-4 text-sm leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Still have questions? <a href="mailto:hello@lastmcdonaldsburger.com" className="text-primary hover:underline">Get in touch</a>
        </motion.p>
      </div>
    </section>
  );
};

export default FAQ;
