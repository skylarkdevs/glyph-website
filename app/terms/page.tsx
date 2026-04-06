import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — Drip",
  description: "Terms of use for the Drip app — AI-powered app icons and App Store screenshots.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen py-20 px-6">
      <article className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)] transition-colors mb-8">
          <span>←</span> Back to Drip
        </Link>

        <h1 className="text-3xl md:text-4xl font-black mb-2">Terms of Use</h1>
        <p className="text-sm text-[var(--color-ink-tertiary)] mb-10">Last updated: March 11, 2026</p>

        <div className="prose-drip">
          <p>By using Drip (&ldquo;the app&rdquo;), you agree to these terms.</p>

          <h2>Service Description</h2>
          <p>Drip is an AI-powered app icon and App Store screenshot builder for app developers and designers.</p>

          <h2>Account & Access</h2>
          <p>Drip uses a credit-based system. Credits are required to generate icons and enhance screenshots, and can be obtained through:</p>
          <ul>
            <li>Monthly subscription (auto-renewable)</li>
            <li>One-time credit pack purchases</li>
          </ul>

          <h2>Subscriptions & Payments</h2>
          <ul>
            <li>Subscriptions are billed monthly through the Apple App Store</li>
            <li>Payment is charged to your Apple ID account at confirmation of purchase</li>
            <li>Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period</li>
            <li>You can manage and cancel subscriptions in your device&rsquo;s Settings &rarr; Apple ID &rarr; Subscriptions</li>
            <li>No refunds are provided for partial subscription periods</li>
          </ul>

          <h2>Credits</h2>
          <ul>
            <li>1 credit = 1 icon generation or 1 uploaded screenshot enhancement</li>
            <li>Unused credits do not expire and roll over month-to-month</li>
            <li>Credits are non-transferable and non-refundable</li>
            <li>Credits are consumed at the time of generation</li>
          </ul>

          <h2>Generated Content</h2>
          <ul>
            <li>You own full rights to the icons and screenshots generated through Drip</li>
            <li>You may use generated content for any purpose, including commercial use</li>
            <li>We do not claim ownership over your generated content</li>
            <li>We are not responsible for the similarity of generated icons to existing trademarks or copyrighted material</li>
          </ul>

          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Reverse engineer, decompile, or disassemble the app</li>
            <li>Use the service to generate illegal, harmful, or offensive content</li>
            <li>Attempt to bypass the credit system or payment mechanisms</li>
            <li>Resell or redistribute the generation service itself</li>
          </ul>

          <h2>Limitation of Liability</h2>
          <p>Drip is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for:</p>
          <ul>
            <li>Quality or suitability of generated content for your specific use case</li>
            <li>Service interruptions or downtime</li>
            <li>Loss of data stored locally on your device</li>
            <li>Any indirect or consequential damages</li>
          </ul>

          <h2>Termination</h2>
          <p>We reserve the right to suspend or terminate access to the service for violations of these terms.</p>

          <h2>Changes</h2>
          <p>We may update these terms from time to time. Continued use of the app constitutes acceptance of updated terms.</p>

          <h2>Governing Law</h2>
          <p>These terms are governed by the laws of the Netherlands.</p>

          <h2>Contact</h2>
          <p><a href="mailto:steven@skylark.dev">steven@skylark.dev</a></p>
        </div>

        <div className="mt-16 pt-8 border-t border-black/[0.06] text-center">
          <p className="text-xs text-[var(--color-ink-tertiary)]">Drip &mdash; AI icons & App Store screenshots</p>
        </div>
      </article>
    </main>
  );
}
