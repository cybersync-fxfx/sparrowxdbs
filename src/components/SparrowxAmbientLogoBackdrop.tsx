const AMBIENT_LOGO_SLOTS = [
  { top: "8%", left: "6%", size: 120, duration: "16s", delay: "0s", rotate: "-8deg" },
  { top: "14%", right: "8%", size: 150, duration: "20s", delay: "-5s", rotate: "6deg" },
  { top: "42%", left: "14%", size: 96, duration: "18s", delay: "-9s", rotate: "-4deg" },
  { top: "48%", right: "16%", size: 136, duration: "22s", delay: "-3s", rotate: "10deg" },
  { bottom: "18%", left: "9%", size: 140, duration: "19s", delay: "-12s", rotate: "5deg" },
  { bottom: "12%", right: "10%", size: 112, duration: "17s", delay: "-7s", rotate: "-7deg" },
  { top: "28%", left: "46%", size: 164, duration: "24s", delay: "-15s", rotate: "0deg" },
] as const;

/**
 * Full-site ambient Midnight Black backdrop where the SparrowX emblem
 * gently appears and disappears using compositor-only opacity/transform keyframes.
 */
export function SparrowxAmbientLogoBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-spx-ambient-logos="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden select-none"
    >
      {AMBIENT_LOGO_SLOTS.map((slot, idx) => (
        <img
          key={idx}
          src="/logos/sparrowx-silver.png"
          alt=""
          width={slot.size}
          height={slot.size}
          loading="lazy"
          decoding="async"
          className="spx-ambient-logo absolute object-contain"
          style={
            {
              ...("top" in slot ? { top: slot.top } : {}),
              ...("bottom" in slot ? { bottom: slot.bottom } : {}),
              ...("left" in slot ? { left: slot.left } : {}),
              ...("right" in slot ? { right: slot.right } : {}),
              width: `${slot.size}px`,
              height: `${slot.size}px`,
              "--spx-logo-dur": slot.duration,
              "--spx-logo-delay": slot.delay,
              "--spx-logo-rot": slot.rotate,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
