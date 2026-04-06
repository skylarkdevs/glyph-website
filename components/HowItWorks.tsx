"use client";

import FadeIn from "./FadeIn";
import PhoneMockup from "./PhoneMockup";

const steps = [
  {
    step: "01",
    title: "Search or describe",
    description: "Already on the App Store? Search it \u2014 Drip auto-fills everything. New app? A name and one sentence is enough.",
    screen: "/step1-screen.jpg",
  },
  {
    step: "02",
    title: "Drop your screenshots in",
    description: "Drip picks the art style, generates backgrounds, writes headlines, and builds everything. No design tools needed.",
    screen: "/generate-screen.jpg",
  },
  {
    step: "03",
    title: "Export. Upload. Done.",
    description: "Localized to every major language, sized for every device. Ready for App Store Connect in minutes.",
    screen: "/step3-screen.jpg",
  },
];

export default function HowItWorks() {
  return (
    <section className="dot-grid py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            Idea to App Store in minutes.
          </h2>
          <p className="text-center text-[var(--color-ink-secondary)] text-lg mb-20 max-w-xl mx-auto">
            Three steps. No design skills required.
          </p>
        </FadeIn>

        <div className="space-y-32">
          {steps.map((s, i) => (
            <FadeIn key={s.step} delay={0.1}>
              <div className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-20`}>
                <div className="flex-1 max-w-md">
                  <div className="text-xs font-bold text-[var(--color-navy-ice)] tracking-widest uppercase mb-3">
                    Step {s.step}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold mb-4">{s.title}</h3>
                  <p className="text-[var(--color-ink-secondary)] text-lg leading-relaxed">
                    {s.description}
                  </p>
                </div>
                <div className="flex-1 flex justify-center">
                  <PhoneMockup src={s.screen} alt={s.title} size="md" />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
