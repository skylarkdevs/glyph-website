"use client";

import { useEffect, useState } from "react";
import PhoneMockup from "./PhoneMockup";
import AppStoreBadge from "./AppStoreBadge";

export default function Hero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20 px-6">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full bg-gradient-to-br from-[#44A8F7]/[0.08] to-[#A78BFA]/[0.04] blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-[#F472B6]/[0.06] to-[#FEC163]/[0.03] blur-[80px] animate-pulse-slow-delayed" />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-[#4ECDC4]/[0.05] blur-[60px]" />
      </div>

      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-60" />

      <div className="max-w-5xl w-full mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16 relative z-10">
        <div className={`flex-1 text-center lg:text-left transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Logo pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-black/[0.06] shadow-sm mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Drip" width={32} height={32} className="rounded-[8px]" />
            <span className="text-lg font-extrabold tracking-tight">Drip.</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] mb-4 max-w-lg leading-snug">
            <span>The app works.</span><br />
            <span>Now make people </span>
            <span className="relative inline-block">
              <span className="relative z-10 rainbow-text">download it.</span>
              <span className="absolute bottom-0.5 left-0 right-0 h-2 md:h-3 bg-gradient-to-r from-[#44A8F7]/20 via-[#A78BFA]/20 to-[#F472B6]/20 rounded-full -z-0 blur-[2px]" />
            </span>
          </h1>

          <p className="text-base md:text-lg text-[var(--color-ink-secondary)] mb-8 max-w-md leading-relaxed">
            AI icons and App Store screenshots in seconds. The bottleneck was never the code — it was everything around it. <span className="font-semibold text-[var(--color-ink)]">Drip fixes that.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4">
            <AppStoreBadge />
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink-tertiary)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
              Free to start · No account needed
            </div>
          </div>
        </div>

        <div className={`flex-1 flex justify-center transition-all duration-1000 delay-300 ease-out ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`}>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#44A8F7]/10 via-[#A78BFA]/10 to-transparent rounded-[60px] blur-[40px] scale-110" />
            <PhoneMockup size="lg" animate>
              <video
                autoPlay
                loop
                muted
                playsInline
                aria-label="Drip app demo — generating app icons with AI"
                className="w-full h-full object-cover"
              >
                <source src="/hero-video.mp4" type="video/mp4" />
              </video>
            </PhoneMockup>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-1000 delay-700 ${mounted ? 'opacity-40' : 'opacity-0'}`}>
        <span className="text-xs font-medium tracking-widest uppercase text-[var(--color-ink-tertiary)]">Scroll</span>
        <div className="w-5 h-8 rounded-full border-2 border-[var(--color-ink-tertiary)]/40 flex items-start justify-center p-1">
          <div className="w-1 h-2 rounded-full bg-[var(--color-ink-tertiary)] animate-bounce" />
        </div>
      </div>
    </section>
  );
}
