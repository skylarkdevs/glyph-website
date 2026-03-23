import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import ScreenshotCarousel from "@/components/ScreenshotCarousel";
import SocialProof from "@/components/SocialProof";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
export default function Home() {
  return (
    <main>
      <div className="relative">
        <Hero />
        <Features />
        <HowItWorks />
        {/* <ScreenshotCarousel /> */}
        <SocialProof />
        <Pricing />
        <Footer />
      </div>
    </main>
  );
}
