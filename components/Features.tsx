"use client";

import FadeIn from "./FadeIn";

const features = [
  {
    icon: "✨",
    title: "AI Icons in Seconds",
    description: "Describe your app. Get multiple stunning icon variations instantly. No Figma, no designer, no prompt engineering.",
  },
  {
    icon: "📱",
    title: "Screenshots That Ship",
    description: "Smart layouts, auto-matched vibes, real device frames. App Store-ready screenshots without touching a design tool.",
  },
  {
    icon: "🚀",
    title: "Straight to App Store",
    description: "Upload directly to App Store Connect from the app. Generate, preview, ship — all in one flow.",
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
            Vibe coding made apps easy. But icons and screenshots? Still a time sink. Glyph fixes that.
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
