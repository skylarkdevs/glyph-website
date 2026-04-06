import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import SocialProof from "@/components/SocialProof";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <div className="relative">
        <Hero />
        <Features />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FAQ />
        <Footer />
      </div>
    </main>
  );
}
