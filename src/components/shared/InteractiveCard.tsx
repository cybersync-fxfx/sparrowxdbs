import React, { useCallback, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface InteractiveCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  tiltEnabled?: boolean;
  onClick?: () => void;
}

/**
 * 3D perspective spring tilt card with pointer-tracking radial spotlight illumination.
 */
export function InteractiveCard({
  children,
  className = "",
  spotlightColor = "rgba(143, 156, 255, 0.16)",
  tiltEnabled = true,
  onClick,
}: InteractiveCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5.5, -5.5]), {
    stiffness: 260,
    damping: 26,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5.5, 5.5]), {
    stiffness: 260,
    damping: 26,
  });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      node.style.setProperty("--card-mx", `${px}px`);
      node.style.setProperty("--card-my", `${py}px`);
      if (tiltEnabled) {
        mx.set(px / Math.max(1, rect.width) - 0.5);
        my.set(py / Math.max(1, rect.height) - 0.5);
      }
    },
    [mx, my, tiltEnabled],
  );

  const handlePointerLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
      style={{
        rotateX: tiltEnabled ? rotateX : 0,
        rotateY: tiltEnabled ? rotateY : 0,
        transformPerspective: 950,
      }}
      className={`group relative overflow-hidden rounded-2xl border border-[#141A29] bg-[#080B12]/90 transition-colors duration-200 hover:border-[#8F9CFF]/45 ${className}`}
    >
      {/* Top machined metallic hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100"
      />
      {/* Pointer-following radial spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(360px circle at var(--card-mx, 50%) var(--card-my, 50%), ${spotlightColor}, transparent 68%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
