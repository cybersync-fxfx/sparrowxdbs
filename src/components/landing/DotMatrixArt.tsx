import React, { useId } from "react";

// =============================================================================
// SPARROWX DOT-MATRIX & HALFTONE VISUAL PRIMITIVES
// Pure deterministic SVG art — SSR-safe, zero hydration mismatch, zero WebGL
// overhead, crisp at any DPR, and isolated with CSS layout/paint containment.
// =============================================================================

export type DotAccentTone = "blue" | "violet" | "emerald" | "amber" | "rose" | "indigo";

const TONE_RGB: Record<DotAccentTone, { primary: string; secondary: string; soft: string }> = {
  blue: {
    primary: "#5B87FF",
    secondary: "#93B4FF",
    soft: "rgba(91, 135, 255, 0.22)",
  },
  violet: {
    primary: "#8B5CF6",
    secondary: "#C4B5FD",
    soft: "rgba(139, 92, 246, 0.22)",
  },
  emerald: {
    primary: "#10B981",
    secondary: "#6EE7B7",
    soft: "rgba(16, 185, 129, 0.22)",
  },
  amber: {
    primary: "#F59E0B",
    secondary: "#FCD34D",
    soft: "rgba(245, 158, 11, 0.22)",
  },
  rose: {
    primary: "#F43F5E",
    secondary: "#FDA4AF",
    soft: "rgba(244, 63, 94, 0.22)",
  },
  indigo: {
    primary: "#818CF8",
    secondary: "#C7D2FE",
    soft: "rgba(129, 140, 248, 0.22)",
  },
};

/**
 * Compact 3x3 colored dot-matrix icon used in footer headers, bento legends,
 * and telemetry badges to establish the signature SparrowX matrix motif.
 */
export function DotGridMiniIcon({
  tone = "blue",
  className = "size-2.5",
}: {
  tone?: DotAccentTone;
  className?: string;
}) {
  const { primary, secondary } = TONE_RGB[tone];
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="2" cy="2" r="1.1" fill={primary} fillOpacity="0.45" />
      <circle cx="6" cy="2" r="1.1" fill={secondary} fillOpacity="0.9" />
      <circle cx="10" cy="2" r="1.1" fill={primary} fillOpacity="0.45" />
      <circle cx="2" cy="6" r="1.1" fill={secondary} fillOpacity="0.85" />
      <circle cx="6" cy="6" r="1.2" fill={primary} />
      <circle cx="10" cy="6" r="1.1" fill={secondary} fillOpacity="0.85" />
      <circle cx="2" cy="10" r="1.1" fill={primary} fillOpacity="0.45" />
      <circle cx="6" cy="10" r="1.1" fill={secondary} fillOpacity="0.9" />
      <circle cx="10" cy="10" r="1.1" fill={primary} fillOpacity="0.45" />
    </svg>
  );
}

/**
 * Glowing halftone planetary horizon arc for Hero & Closing CTA.
 * Uses layered SVG dot patterns masked by radial luminance curves — crisp on
 * every display with zero blur-filter GPU spikes.
 */
export function HalftoneHorizonArc({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const h = compact ? 150 : 210;
  const cy = compact ? 520 : 590;
  const rx = 560;
  const ry = compact ? 430 : 480;

  return (
    <div
      aria-hidden="true"
      className={`spx-dot-canvas pointer-events-none select-none overflow-hidden ${className}`}
    >
      <svg
        viewBox={`0 0 1200 ${h}`}
        preserveAspectRatio="xMidYMax slice"
        className="block w-full h-full"
      >
        <defs>
          {/* Fine halftone dot grid */}
          <pattern
            id={`horizon-dots-${uid}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2.5" cy="2.5" r="1.15" fill="#6D97FF" />
          </pattern>

          {/* Secondary denser specular dots along the bright rim */}
          <pattern
            id={`horizon-rim-dots-${uid}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.95" fill="#BFD4FF" />
          </pattern>

          {/* Soft atmospheric glow gradient */}
          <radialGradient
            id={`horizon-glow-${uid}`}
            cx="50%"
            cy="108%"
            r="62%"
            fx="50%"
            fy="100%"
          >
            <stop offset="0%" stopColor="#5B87FF" stopOpacity="0.58" />
            <stop offset="44%" stopColor="#3B64E6" stopOpacity="0.22" />
            <stop offset="76%" stopColor="#1D368F" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#06070A" stopOpacity="0" />
          </radialGradient>

          {/* Horizontal vignette mask so left/right edges fade cleanly */}
          <linearGradient id={`horizon-fade-x-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="black" />
            <stop offset="14%" stopColor="white" />
            <stop offset="50%" stopColor="white" />
            <stop offset="86%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>

          {/* Band mask shaping the curved planetary dot-matrix horizon */}
          <mask id={`horizon-band-mask-${uid}`}>
            <rect width="1200" height={h} fill="black" />
            <ellipse cx="600" cy={cy} rx={rx} ry={ry} fill="white" fillOpacity="0.92" />
            <ellipse
              cx="600"
              cy={cy + 34}
              rx={rx - 32}
              ry={ry - 32}
              fill="black"
              fillOpacity="0.62"
            />
            <ellipse
              cx="600"
              cy={cy + 74}
              rx={rx - 68}
              ry={ry - 72}
              fill="black"
              fillOpacity="0.95"
            />
          </mask>

          {/* Tight bright rim mask */}
          <mask id={`horizon-rim-mask-${uid}`}>
            <rect width="1200" height={h} fill="black" />
            <ellipse
              cx="600"
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke="white"
              strokeWidth="16"
            />
          </mask>

          <mask id={`horizon-vignette-${uid}`}>
            <rect width="1200" height={h} fill={`url(#horizon-fade-x-${uid})`} />
          </mask>
        </defs>

        <g mask={`url(#horizon-vignette-${uid})`}>
          {/* Deep blue radial atmosphere */}
          <rect width="1200" height={h} fill={`url(#horizon-glow-${uid})`} />

          {/* Main curved dot-matrix horizon band */}
          <rect
            width="1200"
            height={h}
            fill={`url(#horizon-dots-${uid})`}
            mask={`url(#horizon-band-mask-${uid})`}
            opacity="0.86"
          />

          {/* Bright specular rim dots */}
          <rect
            width="1200"
            height={h}
            fill={`url(#horizon-rim-dots-${uid})`}
            mask={`url(#horizon-rim-mask-${uid})`}
            opacity="0.9"
          />

          {/* Subtle curved inner horizon core hairline */}
          <ellipse
            cx="600"
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="#8CB2FF"
            strokeOpacity="0.35"
            strokeWidth="1.2"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Subtle geometric Sparrow silhouette rendered purely as a crisp halftone
 * dot-matrix watermark behind the Hero heading (100% original SparrowX geometry).
 */
export function DotMatrixSparrowBackdrop({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <div
      aria-hidden="true"
      className={`spx-dot-canvas pointer-events-none select-none ${className}`}
    >
      <svg
        viewBox="0 0 640 360"
        fill="none"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id={`sparrow-dots-${uid}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.05" fill="#5B87FF" />
          </pattern>

          <radialGradient id={`sparrow-fade-${uid}`} cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor="white" stopOpacity="0.52" />
            <stop offset="68%" stopColor="white" stopOpacity="0.22" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>

          {/* Original geometric soaring Sparrow mark clipped from dot pattern */}
          <mask id={`sparrow-shape-${uid}`}>
            <rect width="640" height="360" fill="black" />
            <g fill="white">
              {/* Swept upper left wing */}
              <polygon points="315,175 182,42 238,142" />
              <polygon points="300,190 148,88 228,176" />
              <polygon points="286,204 166,144 236,204" />
              {/* Swept right crest wing */}
              <polygon points="325,168 386,58 358,154" />
              {/* Sleek sparrow body & head */}
              <polygon points="256,226 356,154 442,148 474,162 436,174 396,216 320,248" />
              {/* Forked tail feathers */}
              <polygon points="258,226 164,296 226,274 268,246" />
              <polygon points="274,244 214,322 256,288 294,252" />
            </g>
          </mask>
        </defs>

        {/* Faint ambient micro-grid dots behind hero */}
        <rect
          width="640"
          height="360"
          fill={`url(#sparrow-dots-${uid})`}
          opacity="0.09"
        />

        {/* Crisp dotted soaring Sparrow mark */}
        <g mask={`url(#sparrow-shape-${uid})`}>
          <rect
            width="640"
            height="360"
            fill={`url(#sparrow-dots-${uid})`}
            opacity="0.46"
          />
          <rect
            width="640"
            height="360"
            fill={`url(#sparrow-fade-${uid})`}
            opacity="0.16"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Reusable architectural halftone dot-matrix wash for chapter panels and bento cells.
 */
export function DotMatrixWash({
  tone = "blue",
  variant = "radial",
  className = "",
}: {
  tone?: DotAccentTone;
  variant?: "radial" | "streaks" | "orbit" | "diagonal";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { primary, secondary } = TONE_RGB[tone];

  return (
    <div
      aria-hidden="true"
      className={`spx-dot-canvas pointer-events-none select-none overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid slice"
        className="block w-full h-full"
      >
        <defs>
          <pattern
            id={`wash-dots-${uid}`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill={primary} />
          </pattern>

          <pattern
            id={`wash-streaks-${uid}`}
            width="14"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3" cy="6" r="1.15" fill={secondary} fillOpacity="0.95" />
            <circle cx="3" cy="13" r="1.05" fill={primary} fillOpacity="0.7" />
            <circle cx="3" cy="20" r="0.95" fill={primary} fillOpacity="0.42" />
            <circle cx="3" cy="27" r="0.85" fill={primary} fillOpacity="0.18" />
            <circle cx="10" cy="22" r="1.1" fill={secondary} fillOpacity="0.8" />
            <circle cx="10" cy="29" r="0.95" fill={primary} fillOpacity="0.45" />
            <circle cx="10" cy="36" r="0.85" fill={primary} fillOpacity="0.2" />
          </pattern>

          <radialGradient id={`wash-rad-${uid}`} cx="72%" cy="32%" r="68%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="55%" stopColor="white" stopOpacity="0.32" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`wash-diag-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="black" />
            <stop offset="35%" stopColor="white" stopOpacity="0.72" />
            <stop offset="68%" stopColor="white" stopOpacity="0.24" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>

          <mask id={`wash-mask-${uid}`}>
            <rect
              width="600"
              height="400"
              fill={variant === "diagonal" ? `url(#wash-diag-${uid})` : `url(#wash-rad-${uid})`}
            />
          </mask>
        </defs>

        {variant === "orbit" ? (
          <g opacity="0.72">
            {[95, 145, 195, 245, 295].map((r, idx) => (
              <circle
                key={r}
                cx="310"
                cy="365"
                r={r}
                fill="none"
                stroke={idx % 2 === 0 ? secondary : primary}
                strokeWidth={idx === 1 ? "2.4" : "1.6"}
                strokeDasharray={idx % 2 === 0 ? "2 6" : "2 9"}
                strokeOpacity={0.55 - idx * 0.08}
              />
            ))}
            <rect
              width="600"
              height="400"
              fill={`url(#wash-dots-${uid})`}
              mask={`url(#wash-mask-${uid})`}
              opacity="0.25"
            />
          </g>
        ) : variant === "streaks" ? (
          <rect
            width="600"
            height="400"
            fill={`url(#wash-streaks-${uid})`}
            mask={`url(#wash-mask-${uid})`}
            opacity="0.7"
          />
        ) : (
          <>
            <ellipse
              cx={variant === "diagonal" ? "340" : "440"}
              cy={variant === "diagonal" ? "200" : "130"}
              rx="280"
              ry="190"
              fill={primary}
              fillOpacity="0.09"
            />
            <rect
              width="600"
              height="400"
              fill={`url(#wash-dots-${uid})`}
              mask={`url(#wash-mask-${uid})`}
              opacity="0.52"
            />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Chapter 1 Visual: Bare-metal & container hardware isolation cluster schematic
 * with live dotted CPU/RAM quota ceiling bars beneath each node.
 */
export function IsolationSchematicArt() {
  const uid = useId().replace(/:/g, "");

  const nodes = [
    {
      name: "pg-mumbai-01",
      state: "idle",
      atQuota: false,
      filledCols: 6,
      totalCols: 24,
      usageLabel: "24% of 200%",
    },
    {
      name: "ryzen-node-04",
      state: "at quota",
      atQuota: true,
      filledCols: 24,
      totalCols: 24,
      usageLabel: "400% of 400%",
    },
    {
      name: "deploy-edge-02",
      state: "idle",
      atQuota: false,
      filledCols: 4,
      totalCols: 24,
      usageLabel: "18% of 100%",
    },
  ];

  return (
    <div className="spx-dot-canvas flex flex-col h-full justify-between bg-[#07080D]">
      {/* Isometric Bare-Metal Isolation Stage */}
      <div className="relative flex-1 min-h-[280px] sm:min-h-[340px] overflow-hidden">
        <svg
          viewBox="0 0 640 360"
          fill="none"
          aria-hidden="true"
          className="w-full h-full object-cover"
        >
          <defs>
            <pattern
              id={`iso-bg-dots-${uid}`}
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="0.85" fill="#94A3B8" fillOpacity="0.24" />
            </pattern>
            <pattern
              id={`iso-burst-dots-${uid}`}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.05" fill="#A855F7" />
            </pattern>
            <radialGradient id={`iso-burst-glow-${uid}`} cx="52%" cy="42%" r="34%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
              <stop offset="52%" stopColor="#38BDF8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#07080D" stopOpacity="0" />
            </radialGradient>
            <mask id={`iso-burst-mask-${uid}`}>
              <circle cx="332" cy="146" r="138" fill={`url(#iso-burst-glow-${uid})`} />
            </mask>
          </defs>

          {/* Subtle dotted starfield backdrop */}
          <rect width="640" height="360" fill={`url(#iso-bg-dots-${uid})`} />

          {/* Contained telemetry burst behind the center high-load node */}
          <rect width="640" height="360" fill={`url(#iso-burst-glow-${uid})`} />
          <rect
            width="640"
            height="360"
            fill={`url(#iso-burst-dots-${uid})`}
            mask={`url(#iso-burst-mask-${uid})`}
            opacity="0.85"
          />

          {/* Isometric bare-metal rack bus platform */}
          <polygon
            points="72,216 320,332 568,216 320,104"
            fill="#0D1018"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          <polygon
            points="72,216 320,332 320,348 72,232"
            fill="#090B12"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <polygon
            points="568,216 320,332 320,348 568,232"
            fill="#0B0E17"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          {/* Dashed interconnect lane */}
          <line
            x1="126"
            y1="214"
            x2="340"
            y2="314"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1"
            strokeDasharray="6 8"
          />

          {/* Isolation boundary walls between tenants */}
          <line
            x1="240"
            y1="142"
            x2="322"
            y2="180"
            stroke="#8B5CF6"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1="408"
            y1="176"
            x2="486"
            y2="212"
            stroke="#8B5CF6"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Node 1 (Left — Quiet PostgreSQL tenant) */}
          <g transform="translate(152, 114)">
            <polygon points="0,34 52,10 104,34 52,58" fill="#1C2233" stroke="rgba(255,255,255,0.16)" />
            <polygon points="0,34 52,58 52,110 0,86" fill="#121622" stroke="rgba(255,255,255,0.1)" />
            <polygon points="104,34 52,58 52,110 104,86" fill="#161B2A" stroke="rgba(255,255,255,0.1)" />
            {/* Quiet amber/emerald rack LEDs */}
            <rect x="16" y="56" width="12" height="5" rx="1" fill="#10B981" fillOpacity="0.7" transform="skewY(24)" />
            <rect x="34" y="64" width="8" height="5" rx="1" fill="#38BDF8" fillOpacity="0.4" transform="skewY(24)" />
            <rect x="66" y="92" width="14" height="5" rx="1" fill="#F59E0B" fillOpacity="0.55" transform="skewY(-24)" />
          </g>

          {/* Node 2 (Center — Bursting Tenant Clamped at Hard cgroups Quota) */}
          <g transform="translate(268, 120)">
            {/* Hard cgroups containment halo */}
            <polygon
              points="-8,42 74,4 156,42 74,80"
              fill="none"
              stroke="#A855F7"
              strokeOpacity="0.55"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <polygon points="0,42 74,8 148,42 74,76" fill="#232940" stroke="rgba(196,181,253,0.45)" />
            <polygon points="0,42 74,76 74,146 0,112" fill="#151928" stroke="rgba(168,85,247,0.35)" />
            <polygon points="148,42 74,76 74,146 148,112" fill="#1A2033" stroke="rgba(168,85,247,0.35)" />
            {/* Bright active load cells */}
            <rect x="14" y="64" width="16" height="10" rx="1.5" fill="#FBBF24" transform="skewY(24)" />
            <rect x="38" y="75" width="16" height="10" rx="1.5" fill="#F59E0B" transform="skewY(24)" />
            <rect x="14" y="84" width="16" height="10" rx="1.5" fill="#A855F7" transform="skewY(24)" />
            <rect x="38" y="95" width="16" height="10" rx="1.5" fill="#FBBF24" transform="skewY(24)" />
            <rect x="92" y="138" width="18" height="10" rx="1.5" fill="#FBBF24" transform="skewY(-24)" />
            <rect x="116" y="127" width="16" height="10" rx="1.5" fill="#C084FC" transform="skewY(-24)" />
            {/* Quota ceiling badge */}
            <g transform="translate(26, -16)">
              <rect width="96" height="20" rx="4" fill="#0B0D14" stroke="#A855F7" strokeOpacity="0.65" />
              <text
                x="48"
                y="13"
                textAnchor="middle"
                fill="#E9D5FF"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                CGROUPS CLAMPED
              </text>
            </g>
          </g>

          {/* Node 3 (Right — Quiet Edge App tenant) */}
          <g transform="translate(426, 176)">
            <polygon points="0,28 44,8 88,28 44,48" fill="#1C2233" stroke="rgba(255,255,255,0.16)" />
            <polygon points="0,28 44,48 44,96 0,76" fill="#121622" stroke="rgba(255,255,255,0.1)" />
            <polygon points="88,28 44,48 44,96 88,76" fill="#161B2A" stroke="rgba(255,255,255,0.1)" />
            <rect x="14" y="48" width="10" height="5" rx="1" fill="#10B981" fillOpacity="0.7" transform="skewY(24)" />
            <rect x="56" y="76" width="12" height="5" rx="1" fill="#F59E0B" fillOpacity="0.45" transform="skewY(-24)" />
          </g>

          {/* Subtle crescent/node coordinate indicator top-right */}
          <text
            x="616"
            y="28"
            textAnchor="end"
            fill="#64748B"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
          >
            BOM-01 · KVM + CGROUPS V2
          </text>
        </svg>
      </div>

      {/* Dotted Quota Readout Strip (matches crisp 3-column metered footer) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-white/[0.08] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] bg-[#06070B]">
        {nodes.map((node) => (
          <div key={node.name} className="p-3.5 space-y-2.5 font-mono">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-200 truncate">{node.name}</span>
              <span
                className={
                  node.atQuota
                    ? "text-fuchsia-400 font-semibold shrink-0"
                    : "text-zinc-500 shrink-0"
                }
              >
                {node.state}
              </span>
            </div>

            {/* 4-row dotted utilization matrix */}
            <div
              className="grid gap-[3px] py-1"
              style={{ gridTemplateColumns: `repeat(${node.totalCols}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {Array.from({ length: node.totalCols * 3 }).map((_, idx) => {
                const col = idx % node.totalCols;
                const row = Math.floor(idx / node.totalCols);
                const isActive = node.atQuota
                  ? true
                  : col >= node.totalCols - node.filledCols && row >= 1;
                const isClampedZone = node.atQuota && col >= 13;
                return (
                  <span
                    key={idx}
                    className={`size-[3px] rounded-full ${
                      isClampedZone
                        ? "bg-fuchsia-500"
                        : isActive
                          ? node.atQuota
                            ? "bg-zinc-300"
                            : "bg-zinc-400"
                          : "bg-white/10"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 tabular-nums">
              <span>{node.usageLabel}</span>
              <span>{node.atQuota ? "throttled" : "isolated"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// JUMBO DOT-MATRIX LED COUNTER + VERTICAL DOTTED-STEM TIMELINE
// Authentic 5x7 dot-matrix LED glyph renderer for crisp, unmistakable scale art
// =============================================================================

const LED_GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ",": ["00", "00", "00", "00", "00", "01", "10"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

// Deterministic telemetry bars (upper: requests routed; lower: attacks/bots scrubbed)
const TELEMETRY_STEMS: Array<{ up: number; down: number }> = [
  { up: 2, down: 0 }, { up: 1, down: 0 }, { up: 0, down: 0 }, { up: 2, down: 0 },
  { up: 3, down: 1 }, { up: 2, down: 0 }, { up: 4, down: 1 }, { up: 3, down: 1 },
  { up: 5, down: 2 }, { up: 3, down: 1 }, { up: 2, down: 1 }, { up: 4, down: 2 },
  { up: 6, down: 2 }, { up: 4, down: 1 }, { up: 5, down: 3 }, { up: 7, down: 2 },
  { up: 4, down: 3 }, { up: 6, down: 4 }, { up: 8, down: 3 }, { up: 5, down: 4 },
  { up: 7, down: 5 }, { up: 9, down: 4 }, { up: 6, down: 5 }, { up: 10, down: 6 },
  { up: 8, down: 5 }, { up: 11, down: 7 }, { up: 9, down: 6 }, { up: 12, down: 8 },
  { up: 10, down: 7 }, { up: 13, down: 9 }, { up: 11, down: 8 }, { up: 15, down: 9 },
  { up: 12, down: 10 }, { up: 14, down: 11 }, { up: 16, down: 10 }, { up: 13, down: 12 },
  { up: 17, down: 11 }, { up: 19, down: 13 }, { up: 15, down: 12 }, { up: 21, down: 14 },
  { up: 18, down: 15 }, { up: 23, down: 16 }, { up: 20, down: 15 }, { up: 25, down: 18 },
  { up: 22, down: 17 }, { up: 26, down: 19 }, { up: 24, down: 21 }, { up: 28, down: 23 },
];

const TIMELINE_LABELS = [
  "2024 Q1",
  "2024 Q3",
  "2025 Q1",
  "2025 Q3",
  "2026 Q1",
  "2026 Q3",
  "LIVE",
];

export function DotMatrixTelemetryBoard({
  value = "14,820,490",
  primaryLabel = "Edge & DB Requests",
  primaryCount = "9,412,840",
  secondaryLabel = "Threats Scrubbed",
  secondaryCount = "5,407,650",
}: {
  value?: string;
  primaryLabel?: string;
  primaryCount?: string;
  secondaryLabel?: string;
  secondaryCount?: string;
}) {
  // Build crisp 2D dot matrix grid for the jumbo LED counter
  const chars = value.split("");
  const padX = 3;
  const padY = 2;
  const colsPerChar = chars.map((ch) => (LED_GLYPHS[ch]?.[0]?.length ?? 4));
  const totalContentCols =
    colsPerChar.reduce((acc, n) => acc + n, 0) + Math.max(0, chars.length - 1) * 1;
  const gridCols = totalContentCols + padX * 2;
  const gridRows = 7 + padY * 2;

  const litSet = new Set<string>();
  let cursorCol = padX;
  for (let i = 0; i < chars.length; i += 1) {
    const glyph = LED_GLYPHS[chars[i]!] ?? LED_GLYPHS["0"]!;
    for (let r = 0; r < glyph.length; r += 1) {
      const rowStr = glyph[r] ?? "";
      for (let c = 0; c < rowStr.length; c += 1) {
        if (rowStr[c] === "1") {
          litSet.add(`${cursorCol + c}:${padY + r}`);
        }
      }
    }
    cursorCol += (glyph[0]?.length ?? 5) + 1;
  }

  const pitch = 10;
  const boardW = gridCols * pitch + 8;
  const boardH = gridRows * pitch + 8;

  return (
    <div className="spx-dot-canvas space-y-8">
      {/* Jumbo LED Dot-Matrix Panel */}
      <div className="space-y-4">
        <div className="inline-block max-w-full overflow-x-auto rounded-md border border-white/[0.08] bg-[#080B14] p-2 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <svg
            viewBox={`0 0 ${boardW} ${boardH}`}
            role="img"
            aria-label={`${value} total platform requests and mitigated edge events`}
            className="block h-[84px] sm:h-[118px] md:h-[136px] w-auto max-w-full"
          >
            {Array.from({ length: gridRows }).map((_, r) =>
              Array.from({ length: gridCols }).map((__, c) => {
                const isLit = litSet.has(`${c}:${r}`);
                const cx = 4 + c * pitch + pitch / 2;
                const cy = 4 + r * pitch + pitch / 2;
                return (
                  <rect
                    key={`${c}-${r}`}
                    x={cx - (isLit ? 3.3 : 2.3)}
                    y={cy - (isLit ? 3.3 : 2.3)}
                    width={isLit ? 6.6 : 4.6}
                    height={isLit ? 6.6 : 4.6}
                    rx={isLit ? 1.5 : 1}
                    fill={isLit ? "#5B87FF" : "#18223C"}
                    fillOpacity={isLit ? 0.98 : 0.48}
                  />
                );
              }),
            )}
          </svg>
        </div>

        {/* Telemetry Legend Row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-zinc-400 tabular-nums">
          <span className="inline-flex items-center gap-2">
            <DotGridMiniIcon tone="blue" className="size-2.5" />
            <span>{primaryLabel}</span>
            <span className="text-zinc-200 font-semibold">{primaryCount}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <DotGridMiniIcon tone="emerald" className="size-2.5" />
            <span>{secondaryLabel}</span>
            <span className="text-zinc-200 font-semibold">{secondaryCount}</span>
          </span>
        </div>
      </div>

      {/* Dual-Axis Vertical Dotted-Stem Waveform Chart */}
      <div className="space-y-3 pt-2">
        <div className="w-full overflow-hidden">
          <svg
            viewBox="0 0 960 220"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="block w-full h-[160px] sm:h-[210px]"
          >
            {/* Center dashed zero baseline */}
            <line
              x1="0"
              y1="116"
              x2="960"
              y2="116"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="2 5"
            />

            {TELEMETRY_STEMS.map((stem, colIdx) => {
              const x = 14 + colIdx * 19.8;
              const upDots = Array.from({ length: stem.up }).map((_, d) => (
                <circle
                  key={`u-${colIdx}-${d}`}
                  cx={x}
                  cy={110 - d * 3.7}
                  r={d === stem.up - 1 ? 1.65 : 1.15}
                  fill={d >= stem.up - 3 ? "#93B4FF" : "#4E78F5"}
                  fillOpacity={0.35 + (d / Math.max(1, stem.up)) * 0.65}
                />
              ));

              const downDots = Array.from({ length: stem.down }).map((_, d) => (
                <circle
                  key={`d-${colIdx}-${d}`}
                  cx={x}
                  cy={122 + d * 3.7}
                  r={d === stem.down - 1 ? 1.6 : 1.1}
                  fill={d >= stem.down - 3 ? "#6EE7B7" : "#10B981"}
                  fillOpacity={0.32 + (d / Math.max(1, stem.down)) * 0.68}
                />
              ));

              return (
                <g key={colIdx}>
                  {upDots}
                  {downDots}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-zinc-500 border-t border-white/[0.06] pt-3 tabular-nums">
          {TIMELINE_LABELS.map((label) => (
            <span
              key={label}
              className={label === "LIVE" ? "text-emerald-400 font-semibold" : undefined}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
