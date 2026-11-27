import React, { useEffect, useRef } from "react";

export interface ParticleFieldProps {
  className?: string;
  accentColor?: string;
  secondaryColor?: string;
  density?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  tint: boolean;
}

/**
 * Lightweight, GPU-friendly HTML5 Canvas particle network reacting smoothly to pointer movement.
 * Automatically scales density on mobile, pauses when scrolled offscreen, and stays static under
 * `prefers-reduced-motion: reduce`.
 */
export function ParticleField({
  className = "",
  accentColor = "143, 156, 255",
  secondaryColor = "6, 182, 212",
  density = 48,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let isVisible = true;
    const mouse = { x: -9999, y: -9999, active: false };
    let particles: Particle[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: 600 };
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.max(300, Math.round(rect.width));
      height = Math.max(260, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isMobile = width < 640;
      const targetCount = isMobile ? Math.min(22, Math.round(density * 0.45)) : density;
      particles = Array.from({ length: targetCount }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
        radius: 1.1 + Math.random() * 1.6,
        alpha: 0.22 + Math.random() * 0.45,
        tint: i % 3 === 0,
      }));
    };

    const drawFrame = (step: boolean) => {
      ctx.clearRect(0, 0, width, height);
      const linkDist = width < 640 ? 95 : 135;
      const mouseDist = 165;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (step) {
          if (mouse.active) {
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 4 && d2 < mouseDist * mouseDist) {
              const dist = Math.sqrt(d2);
              const pull = (1 - dist / mouseDist) * 0.045;
              p.vx += (dx / dist) * pull;
              p.vy += (dy / dist) * pull;
            }
          }
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }

        const rgb = p.tint ? secondaryColor : accentColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha.toFixed(2)})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const opacity = (1 - Math.sqrt(d2) / linkDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${accentColor}, ${opacity.toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
    };

    resize();
    drawFrame(false);

    if (prefersReduced) {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = mouse.x >= 0 && mouse.x <= rect.width && mouse.y >= 0 && mouse.y <= rect.height;
    };

    const onPointerLeave = () => {
      mouse.active = false;
    };

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              isVisible = Boolean(entries[0]?.isIntersecting);
            },
            { threshold: 0.02 },
          )
        : null;
    io?.observe(canvas);

    const tick = () => {
      if (isVisible && !document.hidden) {
        drawFrame(true);
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.cancelAnimationFrame(rafId);
      io?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [accentColor, secondaryColor, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
