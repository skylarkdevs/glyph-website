"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import FadeIn from "./FadeIn";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void;
        createTweet: (id: string, el: HTMLElement, options?: Record<string, string>) => Promise<HTMLElement>;
      };
    };
  }
}

const tweetIds = [
  "2035053353688863103",
  "2035394454958342224",
  "2032550958484320263",
];

function TweetEmbed({ tweetId }: { tweetId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [loaded, setLoaded] = useState(false);

  const tryRender = useCallback(() => {
    if (rendered.current || !containerRef.current || !window.twttr) return;
    rendered.current = true;
    window.twttr.widgets
      .createTweet(tweetId, containerRef.current, {
        theme: "light",
        conversation: "none",
        width: "340",
      })
      .then(() => setLoaded(true))
      .catch(() => { rendered.current = false; });
  }, [tweetId]);

  useEffect(() => {
    // Try immediately
    tryRender();

    // Also poll in case script hasn't loaded yet
    const interval = setInterval(() => {
      if (window.twttr) {
        tryRender();
        clearInterval(interval);
      }
    }, 500);

    // Listen for twitter script ready event
    const onReady = () => tryRender();
    document.addEventListener("twttr:ready", onReady);

    return () => {
      clearInterval(interval);
      document.removeEventListener("twttr:ready", onReady);
    };
  }, [tryRender]);

  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div ref={containerRef} />
      {!loaded && (
        <p className="text-sm text-[var(--color-ink-tertiary)]">Loading tweet...</p>
      )}
    </div>
  );
}

export default function SocialProof() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("twitter-wjs")) return;

    const script = document.createElement("script");
    script.id = "twitter-wjs";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => {
      // Dispatch custom event when script loads
      document.dispatchEvent(new Event("twttr:ready"));
    };
    document.head.appendChild(script);
  }, []);

  return (
    <section className="dot-grid py-24 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--color-credit-blue)] opacity-[0.06] rounded-full blur-[100px]" />

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] px-4 py-2 rounded-full shadow-sm mb-6">
              <span className="text-sm font-semibold text-[var(--color-ink-secondary)]">Loved by vibe coders</span>
            </div>
            <div className="text-5xl md:text-7xl font-black mb-3 rainbow-text">
              350K+
            </div>
            <p className="text-lg md:text-xl text-[var(--color-ink-secondary)]">
              views on the loading screen alone.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="grid md:grid-cols-3 gap-4 justify-items-center">
            {tweetIds.map((id) => (
              <TweetEmbed key={id} tweetId={id} />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
