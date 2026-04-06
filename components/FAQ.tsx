"use client";

import { useState } from "react";
import FadeIn from "./FadeIn";

const faqs = [
  {
    q: "What is Drip?",
    a: "Drip turns your app into a professional App Store listing in minutes. AI-generated icons, screenshots with 6 art styles for backgrounds, ASO-optimized headlines, and localization \u2014 all from one description and your screenshots. Built for developers who ship.",
  },
  {
    q: "How does it work?",
    a: "If your app is on the App Store, just search it \u2014 Drip auto-fills everything. If it\u2019s new, describe it in a sentence. Upload your screenshots, and Drip generates icons, builds screenshot sets with AI backgrounds, writes conversion-optimized headlines, and localizes to every major language. You just export and upload.",
  },
  {
    q: "What do I actually have to do myself?",
    a: "Upload your screenshots and describe your app. That\u2019s it. Drip handles the backgrounds, headlines, device frames, localization, and export sizes. Everything follows ASO best practices automatically.",
  },
  {
    q: "How much does Drip cost?",
    a: "Free to start \u2014 no credit card needed. Pro is $9.99/month for 50 credits. Or buy credit packs starting at $4.99 that never expire. 1 credit = 1 icon or 1 AI-enhanced screenshot.",
  },
  {
    q: "Who is Drip built for?",
    a: "Indie developers, solo founders, and vibe coders shipping to the App Store. If you can build the app but dread the listing \u2014 icons, screenshots, headlines, localization \u2014 Drip does all of it.",
  },
  {
    q: "What makes Drip different?",
    a: "Most tools stop at icon generation. Drip builds your entire App Store listing \u2014 icons, screenshots with AI backgrounds in 6 art styles, headlines optimized to convert, and localization to every major language. All in one native iOS app.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 px-6" id="faq">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-[var(--color-ink-secondary)] text-lg mb-12 max-w-xl mx-auto">
            Everything you need to know about AI icon generation and App Store screenshots with Drip.
          </p>
        </FadeIn>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                >
                  <h3 className="font-bold text-base">{faq.q}</h3>
                  <span
                    className="text-[var(--color-ink-tertiary)] text-xl shrink-0 transition-transform duration-200"
                    style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: open === i ? 200 : 0, opacity: open === i ? 1 : 0 }}
                >
                  <p className="px-6 pb-5 text-sm text-[var(--color-ink-secondary)] leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
