"use client";

import { useEffect, useRef, useState } from "react";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotation: number;
  angularV: number;
  settled: boolean;
  bounceCount: number;
}

const GRAVITY = 600;
const RESTITUTION = 0.45;
const FRICTION = 0.998;
const ICON_COUNT = 90;
const ICON_SIZE_MIN = 32;
const ICON_SIZE_MAX = 50;
const DROP_INTERVAL = 60;

export default function IconRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const droppedRef = useRef(0);
  const frozenRef = useRef(false);
  const frameRef = useRef(0);
  const floodStartedRef = useRef(false);
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
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const onScroll = () => {
      const scrollY = window.scrollY;
      const fadeDistance = window.innerHeight * 0.6;
      scrollOpacityRef.current = Math.max(0, 1 - scrollY / fadeDistance);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const spawnIcon = () => {
      const size = ICON_SIZE_MIN + Math.random() * (ICON_SIZE_MAX - ICON_SIZE_MIN);
      bodiesRef.current.push({
        x: 40 + Math.random() * (W() - 80),
        y: -size - Math.random() * 100,
        vx: (Math.random() - 0.5) * 60,
        vy: 50 + Math.random() * 80,
        r: size / 2,
        rotation: (Math.random() - 0.5) * 0.6,
        angularV: (Math.random() - 0.5) * 2,
        settled: false,
        bounceCount: 0,
      });
      droppedRef.current++;
    };

    // Drop the scout icon first — center of screen, slightly bigger
    const scoutSize = 48;
    bodiesRef.current.push({
      x: W() / 2,
      y: -scoutSize,
      vx: 0,
      vy: 30,
      r: scoutSize / 2,
      rotation: 0,
      angularV: 0.5,
      settled: false,
      bounceCount: 0,
    });
    droppedRef.current = 1;

    // Flood timer — starts after scout bounces 3 times
    let floodTimer: ReturnType<typeof setInterval> | null = null;

    const startFlood = () => {
      if (floodStartedRef.current) return;
      floodStartedRef.current = true;
      floodTimer = setInterval(() => {
        if (droppedRef.current >= ICON_COUNT) {
          if (floodTimer) clearInterval(floodTimer);
          return;
        }
        spawnIcon();
      }, DROP_INTERVAL);
    };

    // Freeze after 15 seconds
    const freezeTimer = setTimeout(() => {
      frozenRef.current = true;
    }, 15000);

    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      const w = W();
      const h = H();
      const bodies = bodiesRef.current;

      ctx.clearRect(0, 0, w, h);

      if (!frozenRef.current) {
        for (const b of bodies) {
          if (b.settled) continue;

          b.vy += GRAVITY * dt;
          b.vx *= FRICTION;
          b.vy *= FRICTION;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rotation += b.angularV * dt;
          b.angularV *= 0.99;

          // Floor
          if (b.y + b.r > h) {
            b.y = h - b.r;
            b.vy = -b.vy * RESTITUTION;
            b.vx *= 0.8;
            b.angularV *= 0.7;
            b.bounceCount++;

            // Scout: after 3 bounces, start the flood
            if (b === bodies[0] && b.bounceCount >= 3 && !floodStartedRef.current) {
              startFlood();
            }

            if (Math.abs(b.vy) < 8) {
              b.vy = 0;
            }
          }

          // Walls
          if (b.x - b.r < 0) {
            b.x = b.r;
            b.vx = Math.abs(b.vx) * RESTITUTION;
          }
          if (b.x + b.r > w) {
            b.x = w - b.r;
            b.vx = -Math.abs(b.vx) * RESTITUTION;
          }

          // Settle check
          if (Math.abs(b.vx) < 1.5 && Math.abs(b.vy) < 1.5 && b.y + b.r >= h - 2) {
            b.settled = true;
            b.vx = 0;
            b.vy = 0;
            b.angularV = 0;
          }
        }

        // Icon-to-icon collisions
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const bx = bodies[j];
            const dx = bx.x - a.x;
            const dy = bx.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = a.r + bx.r;

            if (dist < minDist && dist > 0.1) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;

              if (!a.settled && !bx.settled) {
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                bx.x += nx * overlap * 0.5;
                bx.y += ny * overlap * 0.5;
              } else if (a.settled) {
                bx.x += nx * overlap;
                bx.y += ny * overlap;
              } else {
                a.x -= nx * overlap;
                a.y -= ny * overlap;
              }

              const dvx = a.vx - bx.vx;
              const dvy = a.vy - bx.vy;
              const dot = dvx * nx + dvy * ny;

              if (dot > 0) {
                const impulse = dot * RESTITUTION;
                if (!a.settled) {
                  a.vx -= impulse * nx;
                  a.vy -= impulse * ny;
                }
                if (!bx.settled) {
                  bx.vx += impulse * nx;
                  bx.vy += impulse * ny;
                }
              }

              if (a.settled && Math.abs(dot) > 40) a.settled = false;
              if (bx.settled && Math.abs(dot) > 40) bx.settled = false;
            }
          }
        }
      }

      // Draw
      const logo = logoRef.current;
      const opacity = scrollOpacityRef.current;
      ctx.globalAlpha = opacity;
      if (logo && opacity > 0.01) {
        for (const b of bodies) {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.rotation);

          const size = b.r * 2;
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

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (floodTimer) clearInterval(floodTimer);
      clearTimeout(freezeTimer);
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
