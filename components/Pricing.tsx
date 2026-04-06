"use client";

import FadeIn from "./FadeIn";

const packs = [
  { credits: 25, price: "$4.99", per: "$0.20/icon", badge: null },
  { credits: 50, price: "$8.99", per: "$0.18/icon", badge: null },
  { credits: 100, price: "$14.99", per: "$0.15/icon", badge: "Best Value" },
];

export default function Pricing() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            A complete App Store listing for less than a coffee.
          </h2>
          <p className="text-center text-[var(--color-ink-secondary)] text-lg mb-6 max-w-xl mx-auto">
            Credits never expire. Use them when you&apos;re ready to ship.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
            {/* Pro Plan */}
            <div className="bg-[var(--color-surface)] rounded-[20px] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_6px_20px_rgba(0,0,0,0.04)] border-2 border-[var(--color-credit-blue)] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rainbow-gradient text-white text-[11px] font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  Recommended
                </span>
              </div>
              <div className="text-center mb-5 mt-2">
                <div className="text-2xl font-black">Pro</div>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-3xl font-black">$9.99</span>
                  <span className="text-sm text-[var(--color-ink-tertiary)]">/month</span>
                </div>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  <span>50 credits/month — icons and AI screenshots</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  <span>6 AI art styles for screenshot backgrounds</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  <span>Localization to every major language</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  <span>iPhone + iPad export sizes</span>
                </div>
              </div>
            </div>

            {/* Credit Packs */}
            <div className="bg-[var(--color-surface)] rounded-[20px] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_6px_20px_rgba(0,0,0,0.04)]">
              <div className="text-center mb-5">
                <div className="text-2xl font-black">Credits</div>
                <p className="text-xs text-[var(--color-ink-tertiary)] mt-1">Pay as you go — never expire</p>
              </div>
              <div className="space-y-3">
                {packs.map((p) => (
                  <div
                    key={p.credits}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      p.badge
                        ? "border-[var(--color-credit-blue)] bg-[var(--color-credit-blue)]/[0.04]"
                        : "border-black/[0.04] bg-white/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold">{p.credits}</span>
                        <span className="text-sm text-[var(--color-ink-secondary)]">Credits</span>
                        {p.badge && (
                          <span className="rainbow-gradient text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--color-ink-tertiary)]">{p.per}</span>
                    </div>
                    <span className="text-base font-bold text-[var(--color-ink)]">{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <p className="text-center text-sm text-[var(--color-ink-tertiary)] mb-8">
            Free to start — generate your first icons with no credit card needed.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 text-center">
              <div className="text-2xl mb-2">🎨</div>
              <div className="font-bold text-sm mb-1">Icons & Screenshots</div>
              <div className="text-xs text-[var(--color-ink-tertiary)]">1 credit = 1 icon or 1 AI-enhanced screenshot. Everything else included.</div>
            </div>
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 text-center">
              <div className="text-2xl mb-2">♾️</div>
              <div className="font-bold text-sm mb-1">Credits Never Expire</div>
              <div className="text-xs text-[var(--color-ink-tertiary)]">Unused credits roll over. Use them whenever you&apos;re ready to ship.</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
