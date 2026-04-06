import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Drip",
  description: "Get help with Drip — AI-powered app icons and App Store screenshots. FAQs and contact info.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen py-20 px-6">
      <article className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)] transition-colors mb-8">
          <span>←</span> Back to Drip
        </Link>

        <h1 className="text-3xl md:text-4xl font-black mb-2">Support</h1>
        <p className="text-lg text-[var(--color-ink-secondary)] mb-10">Thanks for using Drip!</p>

        <div className="prose-drip">
          <h2>Contact</h2>
          <p>Have a question, issue, or suggestion? Send us an email:</p>
          <p><a href="mailto:steven@skylark.dev"><strong>steven@skylark.dev</strong></a></p>

          <h2>FAQ</h2>

          <h3>How does Drip work?</h3>
          <p>Add your apps (name + description), pick a visual style, and hit generate. Drip&rsquo;s AI creates cohesive icons and App Store-ready screenshots &mdash; all sharing the same visual language.</p>

          <h3>How many icons can I generate?</h3>
          <p>Each generation costs 1 credit per icon. If you have 5 apps and choose 2 variations, that&rsquo;s 10 credits. Subscriptions include 50 credits per month, or you can buy credit packs.</p>

          <h3>Can I use the icons commercially?</h3>
          <p>Yes. You own full rights to all generated icons and screenshots. Use them in the App Store, Google Play, or anywhere else.</p>

          <h3>What styles are available?</h3>
          <p>Drip offers 7 curated styles: Minimal, Glassmorphic, Flat Geometric, Soft 3D, Skeuomorphic, Duotone, and Outlined.</p>

          <h3>What platforms are supported?</h3>
          <p>iOS (1024&times;1024), Android (512&times;512), and Apple Vision Pro (1024&times;1024).</p>

          <h3>Can I upload my existing icons as reference?</h3>
          <p>Yes. Upload old icons for each app so the AI maintains recognizable elements while unifying the style.</p>

          <h3>Can I lock icons I like and regenerate the rest?</h3>
          <p>Yes. Lock any icon you&rsquo;re happy with, and only the unlocked ones will be regenerated.</p>

          <h3>How do I cancel my subscription?</h3>
          <p>Go to Settings &rarr; Apple ID &rarr; Subscriptions on your device and cancel from there.</p>

          <h3>I didn&rsquo;t receive my credits after purchase</h3>
          <p>Try restoring purchases in the app&rsquo;s settings. If credits still don&rsquo;t appear, contact us at <a href="mailto:steven@skylark.dev">steven@skylark.dev</a> with your Apple receipt.</p>

          <h3>The app crashed during generation</h3>
          <p>Close and reopen the app. Your project data is saved locally. If the issue persists, email us with details about what happened.</p>
        </div>

        <div className="mt-16 pt-8 border-t border-black/[0.06] text-center">
          <p className="text-xs text-[var(--color-ink-tertiary)]">Drip &mdash; AI icons & App Store screenshots</p>
        </div>
      </article>
    </main>
  );
}
