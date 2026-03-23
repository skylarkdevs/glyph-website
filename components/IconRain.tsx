"use client";

import { useEffect, useRef, useState } from "react";

interface Icon {
  x: number;
  y: number;
  r: number;
  rotation: number;
}

const ICON_COUNT = 90;
const ICON_SIZE_MIN = 32;
const ICON_SIZE_MAX = 50;

// Seeded random for consistent placement across renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeIcons(w: number, h: number): Icon[] {
  const rand = mulberry32(42);
  const icons: Icon[] = [];
  const floorY = h;

  // Place icons in rows from the bottom up, like a pile on the ground
  const cols = Math.floor(w / (ICON_SIZE_MIN + 4));
  let row = 0;
  let col = 0;

  for (let i = 0; i < ICON_COUNT; i++) {
    const size = ICON_SIZE_MIN + rand() * (ICON_SIZE_MAX - ICON_SIZE_MIN);
    const r = size / 2;

    // Stagger each row with slight offset
    const rowOffset = row % 2 === 1 ? (ICON_SIZE_MIN + 4) / 2 : 0;
    const x = rowOffset + col * (ICON_SIZE_MIN + 4) + r + (rand() - 0.5) * 6;
    const y = floorY - r - row * (ICON_SIZE_MIN * 0.85) + (rand() - 0.5) * 4;

    icons.push({
      x: Math.max(r, Math.min(w - r, x)),
      y,
      r,
      rotation: (rand() - 0.5) * 0.25,
    });

    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
  }

  return icons;
}

export default function IconRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconsRef = useRef<Icon[]>([]);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const scrollOpacityRef = useRef(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = "/logo.png";
    img.onload = () => {
      logoRef.current = img;
      setReady(true);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Recalculate icon positions on resize
      iconsRef.current = placeIcons(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    const onScroll = () => {
      const scrollY = window.scrollY;
      const fadeDistance = window.innerHeight * 0.6;
      scrollOpacityRef.current = Math.max(0, 1 - scrollY / fadeDistance);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const logo = logoRef.current;
      const opacity = scrollOpacityRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = opacity;

      if (logo && opacity > 0.01) {
        for (const icon of iconsRef.current) {
          ctx.save();
          ctx.translate(icon.x, icon.y);
          ctx.rotate(icon.rotation);

          const size = icon.r * 2;
          const radius = size * 0.22;

          ctx.beginPath();
          ctx.roundRect(-size / 2 - 3, -size / 2 - 3, size + 6, size + 6, radius + 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.shadowColor = "rgba(0,0,0,0.12)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowColor = "transparent";

          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 2, size, size, radius);
          ctx.clip();
          ctx.drawImage(logo, -size / 2, -size / 2, size, size);

          ctx.restore();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
