import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Drip",
  description: "How Drip handles your data. We store everything locally on your device and don't collect personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen py-20 px-6">
      <article className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)] transition-colors mb-8">
          <span>←</span> Back to Drip
        </Link>

        <h1 className="text-3xl md:text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--color-ink-tertiary)] mb-10">Last updated: March 11, 2026</p>

        <div className="prose-drip">
          <p>This privacy policy describes how Drip (&ldquo;the app&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) handles your data.</p>

          <h2>Summary</h2>
          <p>Drip stores your project data locally on your device. We do not collect, sell, or share personal information.</p>

          <h2>Data Stored Locally</h2>
          <p>The app stores the following data <strong>on your device only</strong>:</p>
          <ul>
            <li>App names and descriptions you enter</li>
            <li>Uploaded reference icons and mood boards</li>
            <li>Generated icon images</li>
            <li>Screenshot projects and exported images</li>
            <li>Project settings (style, platform, variations)</li>
            <li>Credit balance and subscription status</li>
          </ul>

          <h2>AI Image Generation</h2>
          <p>When you generate icons or enhance screenshots, your text prompts and any reference images are sent to our image generation service to produce results. We do not store your prompts or images on our servers after generation is complete.</p>

          <h2>In-App Purchases</h2>
          <p>Subscriptions and credit purchases are handled through Apple&rsquo;s App Store and RevenueCat. We do not process or store any payment information directly. Apple&rsquo;s privacy policy governs all payment transactions.</p>

          <h2>What We Do NOT Do</h2>
          <ul>
            <li>We do <strong>not</strong> collect personal information</li>
            <li>We do <strong>not</strong> use analytics or tracking tools</li>
            <li>We do <strong>not</strong> share data with third parties</li>
            <li>We do <strong>not</strong> use cookies</li>
            <li>We do <strong>not</strong> display advertisements</li>
            <li>We do <strong>not</strong> store generated images on our servers</li>
          </ul>

          <h2>Data Deletion</h2>
          <p>All data is stored locally. Deleting the app permanently removes all your data. You can also delete individual projects within the app.</p>

          <h2>Subscriptions</h2>
          <p>Drip offers auto-renewable subscriptions managed through the App Store. You can manage or cancel your subscription in your device&rsquo;s Settings &rarr; Apple ID &rarr; Subscriptions.</p>

          <h2>Children</h2>
          <p>Drip is not directed at children under 13. We do not knowingly collect data from children.</p>

          <h2>Changes</h2>
          <p>We may update this policy from time to time. Changes will be posted on this page.</p>

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
