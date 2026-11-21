import React, { useCallback, useId, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

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
  priority?: "lcp" | "lazy" | "standard";
  caption?: string;
  showMotionControl?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Interactive 3D floating studio stage for SparrowX hardware & cloud renders.
 * - Uses compositor-only transform/opacity animations gated inside `@media (prefers-reduced-motion: no-preference)`.
 * - Supports pointer-driven 3D perspective tilt without layout thrashing.
 * - Offers a WCAG 2.2.2 Play/Pause motion control for persistent hero animations.
 */
export function Floating3DVisual({
  src,
  alt,
  accent = "cyan",
  size = "md",
  priority = "lazy",
  caption,
  showMotionControl = false,
  className = "",
  width = 512,
  height = 512,
}: Floating3DVisualProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [tilted, setTilted] = useState(false);
  const stageId = useId();

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (paused || e.pointerType === "touch") return;
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
  }, [paused]);

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
        ? "h-40 sm:h-48"
        : size === "lg"
          ? "h-56 sm:h-72"
          : "h-64 sm:h-80 lg:h-[380px]";

  const imgFetchPriority = priority === "lcp" ? "high" : undefined;
  const imgLoading = priority === "lazy" ? "lazy" : undefined;

  return (
    <div
      ref={stageRef}
      id={stageId}
      data-paused={paused ? "true" : "false"}
      data-tilted={tilted ? "true" : "false"}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`spx-3d-stage relative select-none overflow-hidden rounded-xl ${sizeClass} ${className}`}
      style={
        {
          "--spx-accent-glow": ACCENT_GLOW[accent],
          "--spx-accent-ring": ACCENT_RING[accent],
        } as React.CSSProperties
      }
    >
      {/* Soft radial studio depth glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 54%, var(--spx-accent-glow), transparent 68%)",
        }}
      />

      {/* Subtle perspective floor ring */}
      <div
        aria-hidden="true"
        className="spx-3d-orbit pointer-events-none absolute left-1/2 bottom-9 -translate-x-1/2 w-[62%] h-4 rounded-full"
        style={{
          border: "1px solid var(--spx-accent-ring)",
          boxShadow: "0 0 24px var(--spx-accent-glow)",
        }}
      />

      {/* 3D Floating & Pointer-Tilting Artwork */}
      <div className="spx-3d-tilt relative z-10 flex size-full items-center justify-center p-2 pb-9">
        <div className="spx-3d-float relative flex size-full items-center justify-center">
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            decoding={priority === "lcp" ? "sync" : "async"}
            {...(imgFetchPriority ? { fetchPriority: imgFetchPriority } : {})}
            {...(imgLoading ? { loading: imgLoading } : {})}
            className="spx-3d-img max-h-full max-w-full object-contain pointer-events-none"
          />
        </div>
      </div>

      {/* Specular spotlight following cursor */}
      <div
        aria-hidden="true"
        className="spx-3d-glare pointer-events-none absolute inset-0 z-20"
      />

      {/* Bottom caption + WCAG 2.2.2 Pause / Play control bar (zero overlap on mobile) */}
      {(caption || showMotionControl) && (
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5 z-30 flex items-center justify-between gap-2">
          {caption ? (
            <span className="min-w-0 truncate text-xs font-medium text-zinc-300/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              {caption}
            </span>
          ) : (
            <span />
          )}

          {showMotionControl && (
            <button
              type="button"
              onClick={() => setPaused((prev) => !prev)}
              aria-label={paused ? "Play 3D animation" : "Pause 3D animation"}
              className="pointer-events-auto shrink-0 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#090B10]/85 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-white/35 hover:text-white backdrop-blur-md transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              {paused ? (
                <>
                  <Play className="size-3" aria-hidden="true" />
                  <span>Play</span>
                </>
              ) : (
                <>
                  <Pause className="size-3" aria-hidden="true" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
