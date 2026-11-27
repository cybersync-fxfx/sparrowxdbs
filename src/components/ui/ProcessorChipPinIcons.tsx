import React from "react";

export interface ProcessorChipPinIconProps {
  className?: string;
  size?: number;
}

/**
 * Real photographic AMD Ryzen 9 9950X AM5 hardware processor seated in a precision
 * dark-titanium socket bezel with subtle crimson rim lighting.
 */
export function RyzenChipPinIcon({ className = "size-14", size }: ProcessorChipPinIconProps) {
  const customStyle = size ? { width: size, height: size } : undefined;

  return (
    <span
      style={customStyle}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-500/35 bg-gradient-to-b from-[#15080B] via-[#090609] to-[#040508] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-6px_14px_rgba(0,0,0,0.85),0_8px_22px_-6px_rgba(237,28,36,0.35)] transition-all duration-300 group-hover:border-red-400/65 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_-4px_rgba(237,28,36,0.5)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.22),transparent_65%)]"
      />
      <picture className="relative z-10 flex size-full items-center justify-center">
        <source srcSet="/3d/amd-ryzen-processor.webp" type="image/webp" />
        <img
          src="/3d/amd-ryzen-processor.png"
          alt="AMD Ryzen 9 9950X AM5 Zen 5 Processor"
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          className="size-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:scale-105"
        />
      </picture>
    </span>
  );
}

/**
 * Real photographic Intel Xeon Gold LGA enterprise processor seated in a precision
 * brushed-steel socket bezel with subtle sapphire rim lighting.
 */
export function IntelXeonChipPinIcon({ className = "size-14", size }: ProcessorChipPinIconProps) {
  const customStyle = size ? { width: size, height: size } : undefined;

  return (
    <span
      style={customStyle}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-400/35 bg-gradient-to-b from-[#071525] via-[#050C16] to-[#03060B] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-6px_14px_rgba(0,0,0,0.85),0_8px_22px_-6px_rgba(56,189,248,0.3)] transition-all duration-300 group-hover:border-sky-400/65 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_-4px_rgba(56,189,248,0.48)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.22),transparent_65%)]"
      />
      <picture className="relative z-10 flex size-full items-center justify-center">
        <source srcSet="/3d/intel-xeon-processor.webp" type="image/webp" />
        <img
          src="/3d/intel-xeon-processor.png"
          alt="Intel Xeon Gold Dual-Socket Enterprise Processor"
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          className="size-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:scale-105"
        />
      </picture>
    </span>
  );
}

/**
 * Clean specular metallic top hairline & subtle directional hardware aura for plan cards.
 */
export function HardwarePinGridWatermark({ accent = "red" }: { accent?: "red" | "blue" }) {
  const isRed = accent === "red";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      {/* Top machined specular hairline */}
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
          isRed ? "via-red-500/60" : "via-sky-400/60"
        } to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
      />
      {/* Subtle corner radial ambient light */}
      <div
        className="absolute -right-12 -top-12 size-40 rounded-full blur-3xl opacity-35 transition-opacity duration-300 group-hover:opacity-60"
        style={{
          background: isRed
            ? "radial-gradient(circle, rgba(237,28,36,0.35), transparent 70%)"
            : "radial-gradient(circle, rgba(56,189,248,0.35), transparent 70%)",
        }}
      />
    </div>
  );
}
