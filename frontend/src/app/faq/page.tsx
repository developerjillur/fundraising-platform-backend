"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
