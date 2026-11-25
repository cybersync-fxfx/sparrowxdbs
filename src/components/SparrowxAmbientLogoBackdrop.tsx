const AMBIENT_LOGO_SLOTS = [
  { top: "10%", left: "6%", size: 120, duration: "18s", delay: "0s", rotate: "-8deg" },
  { top: "16%", right: "8%", size: 144, duration: "22s", delay: "-6s", rotate: "6deg" },
  { bottom: "18%", left: "10%", size: 132, duration: "20s", delay: "-11s", rotate: "5deg" },
  { bottom: "14%", right: "10%", size: 112, duration: "19s", delay: "-4s", rotate: "-7deg" },
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
          fetchPriority="low"
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
