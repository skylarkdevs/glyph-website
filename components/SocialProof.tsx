"use client";

import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const render = () => {
      if (window.twttr && ref.current && !loaded) {
        // Create a fresh container so React DOM isn't disrupted
        const container = document.createElement("div");
        ref.current.appendChild(container);
        window.twttr.widgets
          .createTweet(tweetId, container, {
            theme: "light",
            conversation: "none",
            width: "340",
          })
          .then(() => setLoaded(true))
          .catch(() => {});
      }
    };

    if (window.twttr) {
      render();
    } else {
      const check = setInterval(() => {
        if (window.twttr) {
          clearInterval(check);
          render();
        }
      }, 300);
      return () => {
        clearInterval(check);
        // Clean up on unmount (strict mode re-mount)
        if (ref.current) {
          while (ref.current.firstChild) {
            ref.current.removeChild(ref.current.firstChild);
          }
        }
      };
    }
  }, [tweetId, loaded]);

  return (
    <div ref={ref} className="min-h-[200px] flex items-center justify-center">
      {!loaded && (
        <p className="text-sm text-[var(--color-ink-tertiary)]">Loading tweet...</p>
      )}
    </div>
  );
}

export default function SocialProof() {
  useEffect(() => {
    if (!document.getElementById("twitter-wjs")) {
      const script = document.createElement("script");
      script.id = "twitter-wjs";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.body.appendChild(script);
    }
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
