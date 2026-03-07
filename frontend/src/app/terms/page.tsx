"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl prose prose-invert">
          <h1 className="font-display text-4xl sm:text-5xl text-gradient-gold mb-8">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: February 25, 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using The Last McDonald&apos;s Burger platform (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">2. Description of Service</h2>
              <p>The Service is a fundraising platform that allows users to purchase photo display packages and merchandise. Photos are displayed on a public YouTube live stream alongside the preserved last McDonald&apos;s burger from Iceland.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">3. Photo Submissions</h2>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>You must own or have rights to any photo you upload</li>
                <li>Photos must not contain explicit, violent, hateful, or illegal content</li>
                <li>All photos are subject to automated content moderation</li>
                <li>Rejected photos will receive a full refund</li>
                <li>By uploading, you grant us a license to publicly display your photo on the live stream</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">4. Payments &amp; Refunds</h2>
              <p>All payments are processed securely through Stripe. Prices are listed in USD. Refunds are issued automatically for rejected photos. For merchandise, refund policies follow Printful&apos;s standard return policy. No refunds are provided for successfully displayed photos.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">5. Merchandise</h2>
              <p>Merchandise is produced and fulfilled by Printful, a third-party print-on-demand provider. Shipping times, quality, and returns are subject to Printful&apos;s policies. We are not responsible for manufacturing defects or shipping delays.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">6. Grand Prize Draw</h2>
              <p>Each qualifying purchase grants one entry into the grand prize draw. Winners will be selected randomly. Prize details will be announced when the fundraising goal is reached. The draw is void where prohibited by law.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">7. Intellectual Property</h2>
              <p>All content on the platform, including branding, design, and text, is owned by The Last McDonald&apos;s Burger project. You may not reproduce, distribute, or create derivative works without permission.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">8. Limitation of Liability</h2>
              <p>The Service is provided &quot;as is&quot; without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to stream downtime, display delays, or technical issues.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">9. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">10. Contact</h2>
              <p>For questions about these terms, email us at <span className="text-primary">legal@thelastburger.com</span>.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
