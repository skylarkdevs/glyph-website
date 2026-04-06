"use client";

import { useState } from "react";
import FadeIn from "./FadeIn";

const faqs = [
  {
    q: "What is Drip?",
    a: "Drip is an AI-powered iOS app that generates professional app icons and App Store screenshots. Describe your app, pick a style, and get production-ready assets in seconds — no design skills, no Figma, no back-and-forth with designers.",
  },
  {
    q: "How does AI icon generation work?",
    a: "Type your app name and choose a visual style. Drip's AI generates multiple icon variations instantly — each one App Store-ready at 1024×1024. Lock your favorites, refine if needed, and export directly.",
  },
  {
    q: "Can I create App Store screenshots with Drip?",
    a: "Yes. Drip generates complete App Store screenshot sets with real device frames, smart layouts, and auto-matched color schemes. You can upload them directly to App Store Connect from within the app.",
  },
  {
    q: "How much does Drip cost?",
    a: "Free to start — no credit card needed. Pro is $9.99/month for 50 icon credits and unlimited screenshots. Or buy credit packs starting at $4.99 for 25 credits that never expire.",
  },
  {
    q: "Who is Drip built for?",
    a: "Indie developers, vibe coders, and anyone shipping apps to the App Store. If you can build the app but dread the design work around it — icons, screenshots, marketing assets — Drip handles all of it.",
  },
  {
    q: "What makes Drip different from other AI icon generators?",
    a: "Most AI icon tools are web-based and stop at icon generation. Drip is a native iOS app that combines icon generation, App Store screenshot creation, and direct App Store Connect upload in a single flow. Built specifically for the App Store workflow.",
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
