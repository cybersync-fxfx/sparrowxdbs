import React, { Suspense, lazy, useEffect, useState } from "react";
import { ThreeModelViewer, type ThreeModelVariant } from "./ThreeModelViewer";

const LazySpline = lazy(() => import("@splinetool/react-spline"));

export interface SplineSceneProps {
  sceneUrl?: string;
  fallbackVariant?: ThreeModelVariant;
  className?: string;
  heightClass?: string;
  label?: string;
}

/**
 * Embeddable `@splinetool/react-spline` wrapper with optimistic shimmer skeleton
 * and automatic fallback to `ThreeModelViewer` when no external Spline URL is configured
 * or when rendering on SSR/offline devices.
 */
export function SplineScene({
  sceneUrl,
  fallbackVariant = "sparrow-coin",
  className = "",
  heightClass = "h-[320px] sm:h-[400px]",
  label,
}: SplineSceneProps) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!sceneUrl || failed || !mounted) {
    return (
      <ThreeModelViewer
        variant={fallbackVariant}
        className={className}
        heightClass={heightClass}
        label={label}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#141A29] bg-[#080B12] ${heightClass} ${className}`}
    >
      <Suspense
        fallback={
          <div className="spx-animate-shimmer flex h-full w-full items-center justify-center bg-gradient-to-r from-[#080B12] via-[#141A29] to-[#080B12]">
            <span className="font-mono text-xs text-zinc-400">Loading 3D Spatial Scene…</span>
          </div>
        }
      >
        <LazySpline
          scene={sceneUrl}
          onError={() => setFailed(true)}
          className="h-full w-full"
        />
      </Suspense>
    </div>
  );
}
