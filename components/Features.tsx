"use client";

import FadeIn from "./FadeIn";

const features = [
  {
    icon: "✨",
    title: "AI Icons. Instantly.",
    description: "One description. Multiple styles. All export-ready at 1024\u00d71024. The icon is the easy part now.",
  },
  {
    icon: "📱",
    title: "Screenshots That Actually Convert",
    description: "Upload your screenshots \u2014 Drip handles the rest. AI-generated backgrounds, ASO-optimized headlines, real device frames. No templates.",
  },
  {
    icon: "🌍",
    title: "Every Language. Every Device.",
    description: "Localized headlines for every major market. iPhone and iPad sizes exported in one tap. Ship globally from day one.",
  },
];

export default function Features() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            The bottleneck isn&apos;t building anymore.
          </h2>
          <p className="text-center text-[var(--color-ink-secondary)] text-lg mb-16 max-w-2xl mx-auto">
            Building is the easy part. The listing — icons, screenshots, headlines, localization — still takes days. Drip does it in minutes.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.12}>
              <div className="bg-[var(--color-surface)] rounded-[20px] p-7 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_6px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.06)] transition-shadow duration-300 h-full">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-[var(--color-ink-secondary)] text-sm leading-relaxed">{f.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
