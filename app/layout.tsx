import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Glyph — Everything your app needs to look legit",
  description: "AI-powered icon generation and App Store screenshot builder. From idea to App Store in minutes.",
  openGraph: {
    title: "Glyph — Everything your app needs to look legit",
    description: "AI-powered icon generation and App Store screenshot builder.",
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glyph — Everything your app needs to look legit",
    description: "AI-powered icon generation and App Store screenshot builder.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <head>
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
