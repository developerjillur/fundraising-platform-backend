import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl prose prose-invert">
          <h1 className="font-display text-4xl sm:text-5xl text-gradient-gold mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: February 25, 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">1. Information We Collect</h2>
              <p>When you use The Last McDonald's Burger platform, we may collect the following information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Name and email address (provided during photo submission)</li>
                <li>Uploaded photos for live stream display</li>
                <li>Payment information (processed securely via Stripe)</li>
                <li>Shipping address (for merchandise orders)</li>
                <li>Usage data and analytics (page views, interactions)</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">2. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Display your photo on the live stream as requested</li>
                <li>Process payments and fulfill merchandise orders</li>
                <li>Send confirmation emails and display notifications</li>
                <li>Improve our platform and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">3. Data Sharing</h2>
              <p>We do not sell your personal information. We may share data with:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Stripe — for secure payment processing</li>
                <li>Printful — for merchandise fulfillment</li>
                <li>Cloud hosting providers — for platform operation</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">4. Photo Content</h2>
              <p>Photos uploaded to the platform are displayed publicly on the live stream. By uploading a photo, you grant us a non-exclusive license to display it during the fundraiser. Photos undergo automated content moderation. Rejected photos result in a full refund.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">5. Data Security</h2>
              <p>We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure payment processing, and restricted access to personal information.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">6. Your Rights</h2>
              <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at privacy@thelastburger.com.</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground mb-3">7. Contact</h2>
              <p>For privacy-related questions, email us at <span className="text-primary">privacy@thelastburger.com</span>.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
