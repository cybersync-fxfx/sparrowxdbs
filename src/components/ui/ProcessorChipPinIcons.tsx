import React from "react";

export interface ProcessorChipPinIconProps {
  className?: string;
  size?: number;
}

/**
 * High-detail vector AMD Ryzen 9 9950X AM5 Processor Chip with visible gold socket pins.
 */
export function RyzenChipPinIcon({ className = "size-12", size }: ProcessorChipPinIconProps) {
  const customStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={customStyle}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AMD Ryzen Zen 5 Processor with AM5 Gold Socket Pins"
      role="img"
    >
      <defs>
        {/* Gold Socket Pins Gradient */}
        <linearGradient id="ryzenGoldPins" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="40%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#A16207" />
        </linearGradient>

        {/* Heat Spreader Top */}
        <linearGradient id="ryzenIhsMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="35%" stopColor="#334155" />
          <stop offset="70%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Zen Fiery Core Glow */}
        <linearGradient id="zenFireGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="60%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>

        {/* Radial ambient glow */}
        <radialGradient id="ryzenRedAmbient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Red Glow */}
      <circle cx="32" cy="32" r="28" fill="url(#ryzenRedAmbient)" />

      {/* Outer AM5 Gold Contact Pins Array (Top, Bottom, Left, Right) */}
      <g stroke="url(#ryzenGoldPins)" strokeWidth="1.4" strokeLinecap="round">
        {/* Top Pins */}
        <line x1="16" y1="2" x2="16" y2="7" />
        <line x1="20" y1="2" x2="20" y2="7" />
        <line x1="24" y1="2" x2="24" y2="7" />
        <line x1="28" y1="2" x2="28" y2="7" />
        <line x1="32" y1="2" x2="32" y2="7" />
        <line x1="36" y1="2" x2="36" y2="7" />
        <line x1="40" y1="2" x2="40" y2="7" />
        <line x1="44" y1="2" x2="44" y2="7" />
        <line x1="48" y1="2" x2="48" y2="7" />

        {/* Bottom Pins */}
        <line x1="16" y1="57" x2="16" y2="62" />
        <line x1="20" y1="57" x2="20" y2="62" />
        <line x1="24" y1="57" x2="24" y2="62" />
        <line x1="28" y1="57" x2="28" y2="62" />
        <line x1="32" y1="57" x2="32" y2="62" />
        <line x1="36" y1="57" x2="36" y2="62" />
        <line x1="40" y1="57" x2="40" y2="62" />
        <line x1="44" y1="57" x2="44" y2="62" />
        <line x1="48" y1="57" x2="48" y2="62" />

        {/* Left Pins */}
        <line x1="2" y1="16" x2="7" y2="16" />
        <line x1="2" y1="20" x2="7" y2="20" />
        <line x1="2" y1="24" x2="7" y2="24" />
        <line x1="2" y1="28" x2="7" y2="28" />
        <line x1="2" y1="32" x2="7" y2="32" />
        <line x1="2" y1="36" x2="7" y2="36" />
        <line x1="2" y1="40" x2="7" y2="40" />
        <line x1="2" y1="44" x2="7" y2="44" />
        <line x1="2" y1="48" x2="7" y2="48" />

        {/* Right Pins */}
        <line x1="57" y1="16" x2="62" y2="16" />
        <line x1="57" y1="20" x2="62" y2="20" />
        <line x1="57" y1="24" x2="62" y2="24" />
        <line x1="57" y1="28" x2="62" y2="28" />
        <line x1="57" y1="32" x2="62" y2="32" />
        <line x1="57" y1="36" x2="62" y2="36" />
        <line x1="57" y1="40" x2="62" y2="40" />
        <line x1="57" y1="44" x2="62" y2="44" />
        <line x1="57" y1="48" x2="62" y2="48" />
      </g>

      {/* PCB Substrate (Server Green-Black Base) */}
      <rect x="6" y="6" width="52" height="52" rx="6" fill="#111B13" stroke="#22543D" strokeWidth="1.5" />
      {/* Circuit Trace Border */}
      <rect x="9" y="9" width="46" height="46" rx="4" fill="none" stroke="url(#ryzenGoldPins)" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.6" />

      {/* Pin 1 Gold Index Triangle (AM5 Orientation Marker) */}
      <polygon points="10,10 17,10 10,17" fill="url(#ryzenGoldPins)" />

      {/* AM5 Octopus Perimeter Cutouts & Gold SMD Capacitors */}
      <rect x="26" y="7" width="12" height="3" rx="1" fill="#0A0F0A" />
      <circle cx="29" cy="8.5" r="1" fill="url(#ryzenGoldPins)" />
      <circle cx="35" cy="8.5" r="1" fill="url(#ryzenGoldPins)" />

      <rect x="26" y="54" width="12" height="3" rx="1" fill="#0A0F0A" />
      <circle cx="29" cy="55.5" r="1" fill="url(#ryzenGoldPins)" />
      <circle cx="35" cy="55.5" r="1" fill="url(#ryzenGoldPins)" />

      {/* AM5 Metallic Integrated Heat Spreader (IHS) */}
      <rect x="13" y="13" width="38" height="38" rx="4" fill="url(#ryzenIhsMetallic)" stroke="#94A3B8" strokeWidth="1.2" />

      {/* Subtle Polishing Grain */}
      <line x1="16" y1="21" x2="48" y2="21" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="0.8" />
      <line x1="16" y1="32" x2="48" y2="32" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="0.8" />
      <line x1="16" y1="43" x2="48" y2="43" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="0.8" />

      {/* Center Zen Enso Fire Ring */}
      <circle
        cx="32"
        cy="30"
        r="10"
        fill="none"
        stroke="url(#zenFireGlow)"
        strokeWidth="2.4"
        strokeDasharray="24 8 16 6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="30" r="10" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="0.6" />

      {/* Core AMD Chevron Emblem */}
      <path d="M30 28 L35 30 L30 32 Z" fill="url(#zenFireGlow)" />

      {/* Typography: RYZEN */}
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="5.5"
        fontWeight="900"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        letterSpacing="0.8"
      >
        RYZEN
      </text>

      {/* Typography: 9950X / ZEN 5 */}
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fill="#EF4444"
        fontSize="3.8"
        fontWeight="800"
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing="0.5"
      >
        ZEN 5 • AM5
      </text>
    </svg>
  );
}

/**
 * High-detail vector Dual Intel Xeon Gold Processor Chip with visible LGA pads & circuit traces.
 */
export function IntelXeonChipPinIcon({ className = "size-12", size }: ProcessorChipPinIconProps) {
  const customStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={customStyle}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Intel Xeon Gold Enterprise Processor with LGA Socket Pads"
      role="img"
    >
      <defs>
        <linearGradient id="xeonGoldPins" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>

        <linearGradient id="xeonBlueAmbient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0071C5" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        <linearGradient id="xeonMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="30%" stopColor="#475569" />
          <stop offset="70%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* Ambient Blue Glow */}
      <circle cx="32" cy="32" r="28" fill="url(#xeonBlueAmbient)" opacity="0.25" />

      {/* Gold LGA Edge Fingers / Pads */}
      <g fill="url(#xeonGoldPins)">
        {/* Top Edge Pads */}
        <rect x="15" y="3" width="2" height="4" rx="0.5" />
        <rect x="19" y="3" width="2" height="4" rx="0.5" />
        <rect x="23" y="3" width="2" height="4" rx="0.5" />
        <rect x="27" y="3" width="2" height="4" rx="0.5" />
        <rect x="35" y="3" width="2" height="4" rx="0.5" />
        <rect x="39" y="3" width="2" height="4" rx="0.5" />
        <rect x="43" y="3" width="2" height="4" rx="0.5" />
        <rect x="47" y="3" width="2" height="4" rx="0.5" />

        {/* Bottom Edge Pads */}
        <rect x="15" y="57" width="2" height="4" rx="0.5" />
        <rect x="19" y="57" width="2" height="4" rx="0.5" />
        <rect x="23" y="57" width="2" height="4" rx="0.5" />
        <rect x="27" y="57" width="2" height="4" rx="0.5" />
        <rect x="35" y="57" width="2" height="4" rx="0.5" />
        <rect x="39" y="57" width="2" height="4" rx="0.5" />
        <rect x="43" y="57" width="2" height="4" rx="0.5" />
        <rect x="47" y="57" width="2" height="4" rx="0.5" />
      </g>

      {/* Enterprise Substrate PCB */}
      <rect x="6" y="8" width="52" height="48" rx="5" fill="#081E38" stroke="#0071C5" strokeWidth="1.4" />
      <rect x="9" y="11" width="46" height="42" rx="3" fill="none" stroke="url(#xeonBlueAmbient)" strokeWidth="0.8" strokeDasharray="5 2" opacity="0.6" />

      {/* Alignment Triangle */}
      <polygon points="10,12 16,12 10,18" fill="url(#xeonGoldPins)" />

      {/* Enterprise LGA Heat Spreader Face */}
      <rect x="13" y="14" width="38" height="36" rx="4" fill="url(#xeonMetallic)" stroke="#94A3B8" strokeWidth="1.2" />

      {/* Intel Cyber Blue Ring */}
      <circle cx="32" cy="27" r="8" fill="none" stroke="url(#xeonBlueAmbient)" strokeWidth="1.8" strokeDasharray="18 4" />

      {/* Typography: intel */}
      <text
        x="32"
        y="29.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="6"
        fontWeight="800"
        fontFamily="'Inter', sans-serif"
        letterSpacing="0.4"
      >
        intel
      </text>

      {/* Typography: XEON GOLD */}
      <text
        x="32"
        y="39"
        textAnchor="middle"
        fill="#F8FAFC"
        fontSize="4.8"
        fontWeight="900"
        fontFamily="'Inter', sans-serif"
        letterSpacing="0.8"
      >
        XEON GOLD
      </text>

      <text
        x="32"
        y="44"
        textAnchor="middle"
        fill="url(#xeonGoldPins)"
        fontSize="3.2"
        fontWeight="800"
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing="0.5"
      >
        DUAL SOCKET LGA
      </text>
    </svg>
  );
}

/**
 * Decorative background circuit and pin-pad matrix watermark for hardware price cards.
 */
export function HardwarePinGridWatermark({ accent = "red" }: { accent?: "red" | "blue" }) {
  const pinColor = accent === "red" ? "#EF4444" : "#38BDF8";
  const glowColor = accent === "red" ? "rgba(239, 68, 68, 0.12)" : "rgba(56, 189, 248, 0.12)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-40 group-hover:opacity-75 transition-opacity duration-300"
    >
      {/* Ambient Corner Radial Flare */}
      <div
        className="absolute -top-12 -right-12 size-36 rounded-full blur-2xl"
        style={{ background: glowColor }}
      />

      {/* Subtle Microchip Pin-Matrix Corner Overlay */}
      <svg
        className="absolute top-2 right-2 size-20 text-zinc-700/30"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill={pinColor} opacity="0.35">
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="20" cy="10" r="1.5" />
          <circle cx="30" cy="10" r="1.5" />
          <circle cx="40" cy="10" r="1.5" />
          <circle cx="50" cy="10" r="1.5" />
          <circle cx="60" cy="10" r="1.5" />
          <circle cx="70" cy="10" r="1.5" />

          <circle cx="70" cy="20" r="1.5" />
          <circle cx="70" cy="30" r="1.5" />
          <circle cx="70" cy="40" r="1.5" />
          <circle cx="70" cy="50" r="1.5" />
          <circle cx="70" cy="60" r="1.5" />
          <circle cx="70" cy="70" r="1.5" />
        </g>
        <path
          d="M 10 10 L 60 10 L 70 20 L 70 70"
          stroke={pinColor}
          strokeWidth="0.8"
          strokeDasharray="4 2"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
