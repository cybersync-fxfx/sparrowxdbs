import React, { useCallback, useId, useRef, useState } from "react";

export type AccentTone =
  | "cyan"
  | "lime"
  | "crimson"
  | "violet"
  | "amber"
  | "emerald"
  | "orange"
  | "white";

const ACCENT_GLOW: Record<AccentTone, string> = {
  cyan: "rgba(56, 189, 248, 0.28)",
  lime: "rgba(163, 230, 53, 0.26)",
  crimson: "rgba(249, 16, 58, 0.28)",
  violet: "rgba(168, 85, 247, 0.28)",
  amber: "rgba(245, 158, 11, 0.28)",
  emerald: "rgba(16, 185, 129, 0.28)",
  orange: "rgba(249, 115, 22, 0.28)",
  white: "rgba(255, 255, 255, 0.2)",
};

const ACCENT_RING: Record<AccentTone, string> = {
  cyan: "rgba(56, 189, 248, 0.35)",
  lime: "rgba(163, 230, 53, 0.35)",
  crimson: "rgba(249, 16, 58, 0.35)",
  violet: "rgba(168, 85, 247, 0.35)",
  amber: "rgba(245, 158, 11, 0.35)",
  emerald: "rgba(16, 185, 129, 0.35)",
  orange: "rgba(249, 115, 22, 0.35)",
  white: "rgba(255, 255, 255, 0.24)",
};

export interface Floating3DVisualProps {
  src: string;
  alt: string;
  accent?: AccentTone;
  size?: "sm" | "md" | "lg" | "hero";
  variant?: "ambient" | "stage";
  priority?: "lcp" | "lazy" | "standard";
  caption?: string;
  showMotionControl?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Interactive 3D floating object stage for SparrowX hardware & cloud renders.
 * - Uses compositor-only transform/opacity animations gated inside `@media (prefers-reduced-motion: no-preference)`.
 * - Defaults to borderless, background-free `ambient` mode so 3D objects float cleanly on the side without dark boxes.
 */
export function Floating3DVisual({
  src,
  alt,
  accent = "cyan",
  size = "md",
  variant = "ambient",
  priority = "lazy",
  className = "",
  width = 512,
  height = 512,
}: Floating3DVisualProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tilted, setTilted] = useState(false);
  const stageId = useId();

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const node = stageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--spx-tilt-y", `${(nx * 16).toFixed(2)}deg`);
    node.style.setProperty("--spx-tilt-x", `${(-ny * 14).toFixed(2)}deg`);
    node.style.setProperty("--spx-glare-x", `${((nx + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--spx-glare-y", `${((ny + 0.5) * 100).toFixed(1)}%`);
    setTilted(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    const node = stageRef.current;
    if (!node) return;
    node.style.setProperty("--spx-tilt-x", "0deg");
    node.style.setProperty("--spx-tilt-y", "0deg");
    setTilted(false);
  }, []);

  const sizeClass =
    size === "sm"
      ? "h-28 sm:h-32"
      : size === "md"
        ? "h-44 sm:h-52"
        : size === "lg"
          ? "h-64 sm:h-80"
          : "h-72 sm:h-96 lg:h-[430px]";

  const imgFetchPriority = priority === "lcp" ? "high" : undefined;
  const imgLoading = priority === "lazy" ? "lazy" : undefined;
  const isRasterDarkBackdrop = /\.(jpe?g)$/i.test(src);
  const resolvedSrc = src.startsWith("/3d/") && !src.includes("?") ? `${src}?v=2` : src;

  return (
    <div
      ref={stageRef}
      id={stageId}
      data-paused="false"
      data-tilted={tilted ? "true" : "false"}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`spx-3d-stage relative select-none ${
        variant === "stage" ? "overflow-hidden rounded-xl" : "overflow-visible bg-transparent"
      } ${sizeClass} ${className}`}
      style={
        {
          "--spx-accent-glow": ACCENT_GLOW[accent],
          "--spx-accent-ring": ACCENT_RING[accent],
        } as React.CSSProperties
      }
    >
      {/* Subtle radial halo behind floating 3D object */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            variant === "stage"
              ? "radial-gradient(circle at 50% 50%, var(--spx-accent-glow), transparent 70%)"
              : "radial-gradient(circle at 50% 50%, var(--spx-accent-glow), transparent 62%)",
          opacity: variant === "stage" ? 1 : isRasterDarkBackdrop ? 0.2 : 0.65,
        }}
      />

      {/* Soft ambient levitation shadow under floating object */}
      <div
        aria-hidden="true"
        className="spx-3d-orbit pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 w-[50%] h-5 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--spx-accent-ring) 0%, transparent 72%)",
        }}
      />

      {/* 3D Floating & Pointer-Tilting Artwork */}
      <div
        className={`spx-3d-tilt relative z-10 flex size-full items-center justify-center ${
          isRasterDarkBackdrop ? "spx-3d-blend" : "p-2"
        }`}
      >
        <div className="spx-3d-float relative flex size-full items-center justify-center">
          <img
            src={resolvedSrc}
            alt={alt}
            width={width}
            height={height}
            decoding={priority === "lcp" ? "sync" : "async"}
            {...(imgFetchPriority ? { fetchPriority: imgFetchPriority } : {})}
            {...(imgLoading ? { loading: imgLoading } : {})}
            className={`size-full object-contain pointer-events-none ${
              isRasterDarkBackdrop ? "spx-3d-img-raster scale-110" : "spx-3d-img-vector"
            }`}
          />
        </div>
      </div>

      {/* Specular spotlight following cursor */}
      <div
        aria-hidden="true"
        className="spx-3d-glare pointer-events-none absolute inset-0 z-20"
      />
    </div>
  );
}
