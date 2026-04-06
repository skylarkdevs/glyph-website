import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://getglyph.dev"),
  title: "Drip — AI App Icon Generator & App Store Screenshot Builder",
  description:
    "Generate professional app icons and App Store screenshots with AI in seconds. No design skills needed. Describe your app, pick a style, and ship to the App Store. Free to start.",
  alternates: { canonical: "/" },
  authors: [{ name: "Steven Kleinveld", url: "https://steven.vision" }],
  creator: "Steven Kleinveld",
  publisher: "Skylark",
  keywords: [
    "AI icon generator",
    "app icon maker",
    "App Store screenshots",
    "AI app design",
    "icon generation",
    "app store optimization",
    "ASO tool",
    "indie developer tools",
  ],
  openGraph: {
    title: "Drip — AI App Icon Generator & App Store Screenshot Builder",
    description:
      "Generate professional app icons and App Store screenshots with AI. From idea to App Store in minutes.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
    siteName: "Drip",
    url: "https://getglyph.dev",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Sobban",
    creator: "@Sobban",
    title: "Drip — AI App Icon Generator & App Store Screenshots",
    description:
      "Generate professional app icons and App Store screenshots with AI. Free to start.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Drip",
      applicationCategory: "DesignApplication",
      operatingSystem: "iOS",
      url: "https://getglyph.dev",
      description:
        "AI-powered app icon generator and App Store screenshot builder for iOS developers.",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free tier with starter credits" },
        { "@type": "Offer", price: "9.99", priceCurrency: "USD", description: "Pro — 50 credits/month + unlimited screenshots" },
      ],
      author: {
        "@type": "Person",
        name: "Steven Kleinveld",
        url: "https://steven.vision",
        sameAs: ["https://x.com/Sobban", "https://linkedin.com/in/stevenkleinveld"],
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "42",
        bestRating: "5",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Drip?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Drip is an AI-powered iOS app that generates professional app icons and App Store screenshots. Describe your app, pick a style, and get production-ready assets in seconds — no design skills needed.",
          },
        },
        {
          "@type": "Question",
          name: "How much does Drip cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Drip is free to start with no credit card needed. Pro costs $9.99/month for 50 icon credits and unlimited screenshots. You can also buy credit packs starting at $4.99 for 25 credits.",
          },
        },
        {
          "@type": "Question",
          name: "Can I upload screenshots directly to App Store Connect?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Drip generates App Store-ready screenshots with real device frames and lets you upload them directly to App Store Connect from within the app.",
          },
        },
        {
          "@type": "Question",
          name: "What makes Drip different from other AI icon generators?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Drip is purpose-built for indie iOS developers. It combines icon generation, screenshot creation, and direct App Store Connect upload in a single native iOS app — no web tools, no Figma, no designer needed.",
          },
        },
      ],
    },
    {
      "@type": "Organization",
      name: "Skylark",
      url: "https://skylark.dev",
      founder: {
        "@type": "Person",
        name: "Steven Kleinveld",
        url: "https://steven.vision",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src="https://aromatic-caribou-889.convex.site/api/a/am_UZEyCHl5ckFhHM-x"
          strategy="afterInteractive"
          async
        />
      </head>
      <body className="font-[family-name:var(--font-nunito)]">{children}</body>
    </html>
  );
}
