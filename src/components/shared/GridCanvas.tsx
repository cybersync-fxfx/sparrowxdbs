import React, { useCallback, useRef } from "react";

export interface GridCanvasProps {
  className?: string;
  accent?: "periwinkle" | "cyan" | "emerald" | "amber" | "crimson";
  variant?: "blueprint" | "dots";
  children?: React.ReactNode;
}

const ACCENT_RGBA: Record<NonNullable<GridCanvasProps["accent"]>, string> = {
  periwinkle: "rgba(143, 156, 255, 0.16)",
  cyan: "rgba(6, 182, 212, 0.16)",
  emerald: "rgba(16, 185, 129, 0.16)",
  amber: "rgba(245, 158, 11, 0.15)",
  crimson: "rgba(244, 63, 94, 0.16)",
};

const LASER_COLOR: Record<NonNullable<GridCanvasProps["accent"]>, string> = {
  periwinkle: "from-transparent via-[#8F9CFF]/60 to-transparent",
  cyan: "from-transparent via-[#06B6D4]/60 to-transparent",
  emerald: "from-transparent via-[#10B981]/60 to-transparent",
  amber: "from-transparent via-[#F59E0B]/60 to-transparent",
  crimson: "from-transparent via-rose-500/60 to-transparent",
};

/**
 * Spatial architectural grid backdrop with mouse-tracking radial cursor spotlight
 * and GPU-composited laser scanlines.
 */
export function GridCanvas({
  className = "",
  accent = "periwinkle",
  variant = "blueprint",
  children,
}: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spx-gx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spx-gy", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className={`relative overflow-hidden ${className}`}
      style={
        {
          "--spx-gx": "50%",
          "--spx-gy": "25%",
        } as React.CSSProperties
      }
    >
      {/* Architectural blueprint / dot-matrix surface */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          variant === "dots" ? "spx-dot-matrix-bg opacity-80" : "spx-blueprint-bg opacity-90"
        }`}
        style={{
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 100%)",
        }}
      />

      {/* Interactive cursor spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(520px circle at var(--spx-gx) var(--spx-gy), ${ACCENT_RGBA[accent]}, transparent 65%)`,
        }}
      />

      {/* Subtle horizontal laser line-tracer */}
      <div
        aria-hidden="true"
        className={`spx-laser-trace-x pointer-events-none absolute top-[24%] left-0 h-px w-1/2 bg-gradient-to-r ${LASER_COLOR[accent]}`}
      />
      <div
        aria-hidden="true"
        className={`spx-laser-trace-x pointer-events-none absolute bottom-[22%] left-0 h-px w-2/5 bg-gradient-to-r ${LASER_COLOR[accent]}`}
        style={{ animationDelay: "-3.4s" }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
