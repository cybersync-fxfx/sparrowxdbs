import React, { useEffect } from "react";

export interface SmoothScrollProps {
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Lenis smooth-scrolling wrapper synchronized with GSAP ScrollTrigger.
 * Automatically disables itself during SSR, in jsdom tests, or when the user
 * prefers reduced motion.
 */
export function SmoothScroll({ children, disabled = false }: SmoothScrollProps) {
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let rafId = 0;
    let lenisInstance: { raf: (t: number) => void; destroy: () => void; on: (e: string, cb: () => void) => void } | null = null;

    const init = async () => {
      try {
        const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;

        gsap.registerPlugin(ScrollTrigger);

        const lenis = new Lenis({
          duration: 1.05,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.4,
        });

        lenisInstance = lenis;
        lenis.on("scroll", () => {
          ScrollTrigger.update();
        });

        const loop = (time: number) => {
          if (cancelled) return;
          lenis.raf(time);
          rafId = window.requestAnimationFrame(loop);
        };
        rafId = window.requestAnimationFrame(loop);
      } catch {
        // Fallback smoothly to native browser scrolling
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      lenisInstance?.destroy();
    };
  }, [disabled]);

  return <>{children}</>;
}
