"use client";

import FadeIn from "./FadeIn";
import PhoneMockup from "./PhoneMockup";

const screenshots = [
  { src: "/hero-screen.png", alt: "App Store ready" },
  { src: "/icon-gen-screen.png", alt: "Icon generation" },
  { src: "/results-screen.png", alt: "Results view" },
  { src: "/screenshots-screen.png", alt: "Screenshot builder" },
  { src: "/project-hub-screen.png", alt: "Project hub" },
  { src: "/multi-app-screen.png", alt: "Multi-app suites" },
];

export default function ScreenshotCarousel() {
  return (
    <section className="py-24 overflow-hidden">
      <FadeIn className="px-6">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
          See it in action.
        </h2>
        <p className="text-center text-[var(--color-ink-secondary)] text-lg mb-16 max-w-xl mx-auto">
          Every screen designed to feel premium, fast, and satisfying.
        </p>
      </FadeIn>

      <div className="relative">
        <div
          className="flex gap-4 px-8 overflow-x-auto pb-6 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {screenshots.map((s, i) => (
            <FadeIn key={s.alt} delay={i * 0.06} className="snap-center shrink-0">
              <PhoneMockup src={s.src} alt={s.alt} size="sm" />
            </FadeIn>
          ))}
          <div className="shrink-0 w-4" />
        </div>

        <div className="absolute top-0 left-0 bottom-0 w-12 bg-gradient-to-r from-[var(--color-canvas)] to-transparent pointer-events-none z-30" />
        <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-[var(--color-canvas)] to-transparent pointer-events-none z-30" />
      </div>
    </section>
  );
}
