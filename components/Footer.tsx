"use client";

import AppStoreBadge from "./AppStoreBadge";
import FadeIn from "./FadeIn";

export default function Footer() {
  return (
    <footer className="dot-grid py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-5xl font-black mb-4">
            Stop designing.<br />Start shipping.
          </h2>
          <p className="text-lg text-[var(--color-ink-secondary)] mb-8 max-w-md mx-auto">
            Built by a vibe coder, for vibe coders.
          </p>
          <AppStoreBadge />
        </FadeIn>

        <div className="mt-12 pt-8 border-t border-black/[0.06]">
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Drip" width={28} height={28} className="rounded-lg" />
            <span className="font-extrabold text-lg">Drip.</span>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--color-ink-tertiary)]">
            <a href="#faq" className="hover:text-[var(--color-ink-secondary)] transition-colors">FAQ</a>
            <a href="https://apps.apple.com/us/app/glyph/id6760372860" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-ink-secondary)] transition-colors">App Store</a>
            <a href="/privacy" className="hover:text-[var(--color-ink-secondary)] transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-[var(--color-ink-secondary)] transition-colors">Terms of Use</a>
            <a href="/support" className="hover:text-[var(--color-ink-secondary)] transition-colors">Support</a>
            <a href="https://steven.vision" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-ink-secondary)] transition-colors">By Steven Kleinveld</a>
            <a href="https://x.com/Sobban" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-ink-secondary)] transition-colors">@Sobban</a>
          </nav>
          <p className="text-xs text-[var(--color-ink-tertiary)] mt-4 opacity-60">
            &copy; {new Date().getFullYear()} Drip. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
