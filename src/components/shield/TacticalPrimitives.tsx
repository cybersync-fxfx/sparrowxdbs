import React, { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Highlight, themes, type Language } from "prism-react-renderer";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Globe,
  Pause,
  Play,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Terminal,
  WrapText,
} from "lucide-react";
import { Area, AreaChart } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =============================================================================
// 1. SPOTLIGHT CARD — Obsidian Carbon Surface + Pointer-Tracking Silver Glow
// =============================================================================
export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "silver" | "emerald" | "amber" | "crimson";
}

const SPOTLIGHT_GLOW: Record<NonNullable<SpotlightCardProps["tone"]>, string> = {
  silver: "rgba(226, 232, 240, 0.13)",
  emerald: "rgba(16, 185, 129, 0.16)",
  amber: "rgba(245, 158, 11, 0.16)",
  crimson: "rgba(244, 63, 94, 0.18)",
};

export function SpotlightCard({
  tone = "silver",
  className,
  children,
  onMouseMove,
  onMouseLeave,
  ...rest
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpot({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true,
      });
    }
    onMouseMove?.(e);
  };

  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setSpot((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    onMouseLeave?.(e);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0A0D14] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.45)] transition-[border-color,background-color] duration-200 hover:border-white/[0.15]",
        className,
      )}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: spot.visible ? 1 : 0,
          background: `radial-gradient(280px circle at ${spot.x}px ${spot.y}px, ${SPOTLIGHT_GLOW[tone]}, transparent 70%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

// =============================================================================
// 2. KPI TELEMETRY CARD WITH 24-POINT RECHARTS SPARKLINE
// =============================================================================
export interface KpiSparklineCardProps {
  label: string;
  value: string | number;
  sublabel: string;
  badgeText?: string;
  tone?: "silver" | "emerald" | "amber" | "crimson";
  icon: React.ComponentType<{ className?: string }>;
  series: Array<{ t: number; v: number }>;
  pulseDot?: boolean;
}

const SPARKLINE_STROKE: Record<NonNullable<KpiSparklineCardProps["tone"]>, string> = {
  silver: "#CBD5E1",
  emerald: "#10B981",
  amber: "#F59E0B",
  crimson: "#F43F5E",
};

export function KpiSparklineCard({
  label,
  value,
  sublabel,
  badgeText,
  tone = "silver",
  icon: Icon,
  series,
  pulseDot = false,
}: KpiSparklineCardProps) {
  const gradId = useId().replace(/:/g, "");
  const stroke = SPARKLINE_STROKE[tone];

  return (
    <SpotlightCard tone={tone} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8A94A6] truncate">{label}</span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          {pulseDot && (
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full spx-soc-pulse",
                tone === "crimson"
                  ? "bg-[#F43F5E]"
                  : tone === "amber"
                    ? "bg-[#F59E0B]"
                    : "bg-[#10B981]",
              )}
            />
          )}
          <Icon className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums truncate",
              tone === "crimson"
                ? "text-[#F43F5E]"
                : tone === "emerald"
                  ? "text-[#10B981]"
                  : tone === "amber"
                    ? "text-[#F59E0B]"
                    : "text-[#F4F6FA]",
            )}
          >
            {value}
          </div>
          {badgeText ? (
            <span
              className={cn(
                "mt-1 inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                tone === "crimson"
                  ? "border-[#F43F5E]/35 bg-[#F43F5E]/10 text-[#FDA4AF]"
                  : tone === "amber"
                    ? "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FCD34D]"
                    : tone === "emerald"
                      ? "border-[#10B981]/35 bg-[#10B981]/10 text-[#6EE7B7]"
                      : "border-white/[0.1] bg-white/[0.04] text-[#CBD5E1]",
              )}
            >
              {badgeText}
            </span>
          ) : null}
        </div>

        {/* 24-Point Micro Sparkline */}
        <div className="w-24 h-11 shrink-0 overflow-hidden" aria-hidden="true">
          <AreaChart width={96} height={44} data={series} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={`kpi-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#kpi-grad-${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-[#8A94A6] truncate">{sublabel}</p>
    </SpotlightCard>
  );
}

// =============================================================================
// 3. LIVING PERIMETER RADAR (60fps SVG Beam + Ripples + Telemetry Readouts)
// =============================================================================
export interface LivingPerimeterRadarProps {
  threatState: "calm" | "elevated" | "critical";
  assetCount: number;
  domainLabel?: string | undefined;
  latencyMs?: number | undefined;
  rulesArmed?: number | undefined;
  simulationActive?: boolean | undefined;
}

export function LivingPerimeterRadar({
  threatState,
  assetCount,
  domainLabel,
  latencyMs = 11,
  rulesArmed = 142,
  simulationActive = false,
}: LivingPerimeterRadarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const uid = useId().replace(/:/g, "");

  const isCritical = threatState === "critical";
  const isElevated = threatState === "elevated";
  const accentHex = isCritical ? "#F43F5E" : isElevated ? "#F59E0B" : "#10B981";
  const animateRadar = !prefersReducedMotion && !paused;

  const blips = [
    { id: "bom", cx: 148, cy: 76, label: "BOM-EDGE", alert: isCritical },
    { id: "maa", cx: 74, cy: 132, label: "MAA-POP", alert: false },
    { id: "sin", cx: 162, cy: 146, label: "SIN-WAF", alert: isElevated },
    { id: "org", cx: 92, cy: 72, label: domainLabel ? domainLabel.slice(0, 10) : "ORIGIN", alert: isCritical },
  ];

  return (
    <div className="relative w-full rounded-xl border border-white/[0.08] bg-[#06080E] p-4 sm:p-5 overflow-hidden spx-dot-canvas">
      {/* Subtle Tactical Corner Readouts */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#8A94A6] pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ backgroundColor: accentHex, boxShadow: `0 0 8px ${accentHex}` }}
          />
          <span className="text-[#E2E8F0] font-semibold">
            {simulationActive ? "SIMULATION DRILL · LIVE RADAR" : "AUTONOMOUS PERIMETER RADAR"}
          </span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span>
            LATENCY <strong className="text-[#F4F6FA]">{latencyMs}ms</strong>
          </span>
          <span className="hidden sm:inline">
            TLS <strong className="text-[#10B981]">1.3</strong>
          </span>
          <span className="hidden sm:inline">
            WAF <strong className="text-[#F4F6FA]">{rulesArmed}</strong>
          </span>
          {/* WCAG 2.2.2 Pause/Resume control for continuous sweep animation */}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume radar sweep animation" : "Pause radar sweep animation"}
            className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#CBD5E1] cursor-pointer"
          >
            {paused ? <Play className="size-2.5" aria-hidden="true" /> : <Pause className="size-2.5" aria-hidden="true" />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>
        </div>
      </div>

      {/* Main Centered Animated Radar Canvas */}
      <div className="relative mx-auto my-4 flex items-center justify-center max-w-[230px] aspect-square">
        <svg
          viewBox="0 0 220 220"
          role="img"
          aria-label={`Perimeter radar status: ${threatState}, monitoring ${assetCount} assets`}
          className="w-full h-full select-none"
        >
          <defs>
            <radialGradient id={`radar-bg-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accentHex} stopOpacity="0.16" />
              <stop offset="68%" stopColor={accentHex} stopOpacity="0.04" />
              <stop offset="100%" stopColor="#06080E" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`radar-beam-${uid}`} x1="50%" y1="50%" x2="100%" y2="20%">
              <stop offset="0%" stopColor={accentHex} stopOpacity="0.48" />
              <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
            </linearGradient>
          </defs>

          <circle cx="110" cy="110" r="102" fill={`url(#radar-bg-${uid})`} />

          {/* Concentric Range Rings */}
          {[100, 74, 48, 24].map((r) => (
            <circle
              key={r}
              cx="110"
              cy="110"
              r={r}
              fill="none"
              stroke="rgba(244,246,250,0.09)"
              strokeWidth="1"
              strokeDasharray={r === 74 ? "2 4" : undefined}
            />
          ))}

          {/* Tactical Crosshairs */}
          <line x1="110" y1="8" x2="110" y2="212" stroke="rgba(244,246,250,0.07)" strokeWidth="1" />
          <line x1="8" y1="110" x2="212" y2="110" stroke="rgba(244,246,250,0.07)" strokeWidth="1" />

          {/* Rotating 60fps Sweep Beam */}
          <motion.g
            style={{ transformOrigin: "110px 110px" }}
            animate={animateRadar ? { rotate: 360 } : { rotate: 35 }}
            transition={
              animateRadar
                ? { repeat: Infinity, duration: isCritical ? 2.6 : 5.5, ease: "linear" }
                : { duration: 0.2 }
            }
          >
            <path
              d="M110,110 L110,10 A100,100 0 0,1 188,48 Z"
              fill={`url(#radar-beam-${uid})`}
            />
            <line
              x1="110"
              y1="110"
              x2="110"
              y2="10"
              stroke={accentHex}
              strokeWidth="1.4"
              strokeOpacity="0.9"
            />
          </motion.g>

          {/* Connected Asset Ping Blips */}
          {blips.slice(0, Math.max(2, Math.min(4, assetCount + 2))).map((b, idx) => {
            const blipColor = b.alert ? "#F43F5E" : "#10B981";
            return (
              <g key={b.id}>
                {animateRadar && (
                  <motion.circle
                    cx={b.cx}
                    cy={b.cy}
                    r={4}
                    fill="none"
                    stroke={blipColor}
                    strokeWidth="1"
                    initial={{ r: 3, opacity: 0.85 }}
                    animate={{ r: 14, opacity: 0 }}
                    transition={{
                      repeat: Infinity,
                      duration: b.alert ? 1.4 : 2.8,
                      delay: idx * 0.55,
                      ease: "easeOut",
                    }}
                  />
                )}
                <circle cx={b.cx} cy={b.cy} r="3" fill={blipColor} />
                <text
                  x={b.cx + 6}
                  y={b.cy + 3}
                  fill="rgba(226,232,240,0.72)"
                  fontSize="7.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {b.label}
                </text>
              </g>
            );
          })}

          {/* Radar Core Anchor */}
          <circle cx="110" cy="110" r="4" fill={accentHex} />
          <circle cx="110" cy="110" r="8" fill="none" stroke={accentHex} strokeOpacity="0.45" />
        </svg>
      </div>

      {/* Bottom Corner Telemetry Micro-Strip */}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/[0.06] font-mono text-[10px] tabular-nums">
        <div>
          <span className="text-[#8A94A6] block">EDGE STATE</span>
          <span className="font-semibold" style={{ color: accentHex }}>
            {isCritical ? "MITIGATING" : isElevated ? "ELEVATED" : "ARMED"}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[#8A94A6] block">ASSETS WATCHED</span>
          <span className="text-[#F4F6FA] font-semibold">{Math.max(assetCount, 1)} ACTIVE</span>
        </div>
        <div className="text-right">
          <span className="text-[#8A94A6] block">SSL / EDGE</span>
          <span className="text-[#10B981] font-semibold">TLSv1.3 OK</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 4. KINETIC "SPARROWX SENSE" NEURAL CORE (Plasma Ring + AI Triage Gauge)
// =============================================================================
export interface SparrowxSenseCoreProps {
  state: "calm" | "elevated" | "critical";
  activeCount: number;
  confidencePct: number;
  statusLabel: string;
  simulationActive?: boolean;
}

export function SparrowxSenseCore({
  state,
  activeCount,
  confidencePct,
  statusLabel,
  simulationActive = false,
}: SparrowxSenseCoreProps) {
  const prefersReducedMotion = useReducedMotion();
  const isCritical = state === "critical";
  const isElevated = state === "elevated";
  const color = isCritical ? "#F43F5E" : isElevated ? "#F59E0B" : "#10B981";
  const clampedConfidence = Math.max(0, Math.min(100, confidencePct));
  const gaugeRadius = 46;
  const gaugeCirc = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCirc - (clampedConfidence / 100) * gaugeCirc;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#06080E] p-4 space-y-3">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${color}24 0%, transparent 65%)`,
        }}
      />

      <div className="relative flex items-center justify-between text-[11px] font-mono">
        <span className="inline-flex items-center gap-1.5 text-[#F4F6FA] font-semibold">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span>SparrowX Sense</span>
        </span>
        <span className="text-[#8A94A6] tabular-nums">
          {simulationActive ? "DRILL MODE" : "NEURAL CORE"}
        </span>
      </div>

      {/* Multi-layered Breathing Plasma Core + Circular AI Readiness Gauge */}
      <div className="relative mx-auto flex size-28 items-center justify-center">
        <svg viewBox="0 0 112 112" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
          <circle
            cx="56"
            cy="56"
            r={gaugeRadius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2.5"
          />
          <motion.circle
            cx="56"
            cy="56"
            r={gaugeRadius}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={gaugeCirc}
            animate={{ strokeDashoffset: gaugeOffset }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        </svg>

        {/* Outer Orbital Plasma Ring */}
        <motion.div
          aria-hidden="true"
          className="absolute size-20 rounded-full border"
          style={{ borderColor: `${color}55` }}
          animate={
            prefersReducedMotion
              ? { scale: 1, opacity: 0.5 }
              : {
                  scale: isCritical ? [1, 1.12, 1] : [1, 1.05, 1],
                  opacity: isCritical ? [0.5, 0.95, 0.5] : [0.35, 0.65, 0.35],
                }
          }
          transition={{
            repeat: prefersReducedMotion ? 0 : Infinity,
            duration: isCritical ? 1.3 : 3.2,
            ease: "easeInOut",
          }}
        />

        {/* Specular Obsidian Core Sphere */}
        <motion.div
          aria-hidden="true"
          className="relative size-14 rounded-full border border-white/[0.15] shadow-[inset_-8px_-10px_18px_rgba(0,0,0,0.92),inset_6px_6px_14px_rgba(244,246,250,0.16)]"
          style={{
            background: `radial-gradient(circle at 32% 28%, #475569 0%, #111622 48%, #05070B 82%, ${color} 100%)`,
          }}
          animate={
            prefersReducedMotion
              ? { scale: 1 }
              : { scale: isCritical ? [0.97, 1.04, 0.97] : [0.99, 1.02, 0.99] }
          }
          transition={{
            repeat: prefersReducedMotion ? 0 : Infinity,
            duration: isCritical ? 1.1 : 3.6,
            ease: "easeInOut",
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-[100%] border"
            style={{
              borderColor: `${color}CC`,
              boxShadow: `0 0 14px ${color}88`,
            }}
          />
        </motion.div>
      </div>

      <div className="relative grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-[11px] font-mono tabular-nums">
        <div>
          <span className="text-[10px] text-[#8A94A6] block">Threat posture</span>
          <span className="font-semibold" style={{ color }}>
            {statusLabel}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#8A94A6] block">AI readiness</span>
          <span className="text-[#F4F6FA] font-semibold">
            {clampedConfidence}% · {activeCount} active
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 5. TACTICAL CODE FRAME (prism-react-renderer + Line Numbers + Wrap + Download)
// =============================================================================
export interface TacticalCodeFrameProps {
  code: string;
  language?: Language;
  filename: string;
  onDownload?: () => void;
  downloadLabel?: string;
  maxHeightClass?: string;
}

export function TacticalCodeFrame({
  code,
  language = "nginx",
  filename,
  onDownload,
  downloadLabel = "Download",
  maxHeightClass = "max-h-72",
}: TacticalCodeFrameProps) {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${filename} copied to clipboard`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard unavailable in this browser context.");
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.09] bg-[#06080E] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Terminal Frame Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0B0E17]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-white/[0.14]" />
            <span className="size-2.5 rounded-full bg-white/[0.14]" />
            <span className="size-2.5 rounded-full bg-white/[0.14]" />
          </div>
          <span className="font-mono text-[11px] text-[#CBD5E1] truncate" translate="no">
            {filename}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWrapLines((w) => !w)}
            aria-pressed={wrapLines}
            aria-label={wrapLines ? "Disable line wrapping" : "Enable line wrapping"}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors cursor-pointer",
              wrapLines
                ? "border-white/[0.18] bg-white/[0.07] text-[#F4F6FA]"
                : "border-white/[0.08] bg-transparent text-[#8A94A6] hover:text-[#F4F6FA]",
            )}
          >
            <WrapText className="size-3" aria-hidden="true" />
            <span className="hidden sm:inline">Wrap</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.14] bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-[#F4F6FA] transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="size-3 text-[#10B981]" aria-hidden="true" />
            ) : (
              <Copy className="size-3" aria-hidden="true" />
            )}
            <span>{copied ? "Copied" : "Copy Config"}</span>
          </button>

          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#10B981]/35 bg-[#10B981]/12 hover:bg-[#10B981]/20 px-2.5 py-1 text-[11px] font-medium text-[#6EE7B7] transition-colors cursor-pointer"
            >
              <Download className="size-3" aria-hidden="true" />
              <span>{downloadLabel}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Syntax-Highlighted Code Body */}
      <div className={cn("overflow-y-auto overflow-x-auto p-3.5 font-mono text-[11px] leading-relaxed", maxHeightClass)}>
        <Highlight theme={themes.nightOwl} code={code.trimEnd()} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="m-0 bg-transparent p-0 font-mono text-[11px]">
              {tokens.map((line, i) => (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  className={cn(
                    "flex gap-3.5 px-1 rounded hover:bg-white/[0.03]",
                    wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 select-none text-right text-[#4B5563] tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

// =============================================================================
// 6. 3-NODE EDGE PROPAGATION FLOW + MASKED EDGE WAF SENSOR KEY STRIP
// =============================================================================
export interface EdgeTrafficFlowDiagramProps {
  domain: string;
  cnameVerified: boolean;
  txtVerified: boolean;
  checking?: boolean;
  onCheckDnsLive?: () => void;
  sensorKey?: string;
}

export function EdgeTrafficFlowDiagram({
  domain,
  cnameVerified,
  txtVerified,
  checking = false,
  onCheckDnsLive,
  sensorKey,
}: EdgeTrafficFlowDiagramProps) {
  const [revealKey, setRevealKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const edgeVerified = cnameVerified || txtVerified;

  const maskedKey = sensorKey
    ? `${sensorKey.slice(0, 10)}${"•".repeat(Math.max(8, sensorKey.length - 14))}${sensorKey.slice(-4)}`
    : "spx_waf_••••••••••••";

  const copySensorKey = async () => {
    if (!sensorKey) return;
    try {
      await navigator.clipboard.writeText(sensorKey);
      setCopiedKey(true);
      toast.success("Edge WAF sensor key copied");
      setTimeout(() => setCopiedKey(false), 1800);
    } catch {
      toast.error("Unable to copy sensor key.");
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#06080E] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-[#F4F6FA] flex items-center gap-2">
            <span>Live Edge Routing &amp; DNS Propagation</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                edgeVerified
                  ? "border-[#10B981]/35 bg-[#10B981]/12 text-[#6EE7B7]"
                  : "border-[#F59E0B]/35 bg-[#F59E0B]/12 text-[#FCD34D] spx-soc-pulse",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  edgeVerified ? "bg-[#10B981]" : "bg-[#F59E0B]",
                )}
              />
              <span>{edgeVerified ? "EDGE VERIFIED" : "PENDING SYNC"}</span>
            </span>
          </div>
          <p className="text-[11px] text-[#8A94A6]">
            Visualizes real-time DoH propagation from public visitors through SparrowX Edge WAF to your origin.
          </p>
        </div>

        {onCheckDnsLive ? (
          <button
            type="button"
            disabled={checking}
            onClick={onCheckDnsLive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-55 px-3 py-1.5 text-xs font-medium text-[#F4F6FA] transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5 text-[#10B981]", checking && "animate-spin")} aria-hidden="true" />
            <span>{checking ? "Checking Live DNS…" : "Check DNS Live"}</span>
          </button>
        ) : null}
      </div>

      {/* 3-Node Visual Flow: Traffic -> SparrowX Edge WAF -> Origin */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
        {/* Node 1: Public Traffic */}
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-3 flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg border border-white/[0.1] bg-white/[0.04] grid place-items-center text-[#CBD5E1] shrink-0">
            <Globe className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#F4F6FA] truncate">Public Traffic</div>
            <div className="text-[10px] font-mono text-[#8A94A6] truncate">HTTPS · Anycast Edge</div>
          </div>
        </div>

        {/* Animated Dashed Link 1 */}
        <div className="hidden md:flex items-center justify-center w-12" aria-hidden="true">
          <svg viewBox="0 0 48 12" className="w-12 h-3 overflow-visible">
            <line
              x1="0"
              y1="6"
              x2="48"
              y2="6"
              stroke={edgeVerified ? "#10B981" : "#F59E0B"}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="spx-dash-flow"
            />
          </svg>
        </div>

        {/* Node 2: SparrowX Edge WAF */}
        <div
          className={cn(
            "rounded-lg border p-3 flex items-center gap-3 min-w-0",
            edgeVerified
              ? "border-[#10B981]/35 bg-[#10B981]/[0.07]"
              : "border-[#F59E0B]/30 bg-[#F59E0B]/[0.05]",
          )}
        >
          <div
            className={cn(
              "size-9 rounded-lg border grid place-items-center shrink-0",
              edgeVerified
                ? "border-[#10B981]/40 bg-[#10B981]/15 text-[#6EE7B7]"
                : "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#FCD34D]",
            )}
          >
            {edgeVerified ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <Shield className="size-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#F4F6FA] truncate">SparrowX Edge WAF</div>
            <div className="text-[10px] font-mono text-[#8A94A6] truncate">edge.sparrowx.net</div>
          </div>
        </div>

        {/* Animated Dashed Link 2 */}
        <div className="hidden md:flex items-center justify-center w-12" aria-hidden="true">
          <svg viewBox="0 0 48 12" className="w-12 h-3 overflow-visible">
            <line
              x1="0"
              y1="6"
              x2="48"
              y2="6"
              stroke={cnameVerified ? "#10B981" : "#64748B"}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="spx-dash-flow"
            />
          </svg>
        </div>

        {/* Node 3: Origin Server */}
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-3 flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg border border-white/[0.1] bg-white/[0.04] grid place-items-center text-[#CBD5E1] shrink-0">
            <Server className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#F4F6FA] truncate">Origin Server</div>
            <div className="text-[10px] font-mono text-[#8A94A6] truncate" translate="no">
              {domain || "yourdomain.com"}
            </div>
          </div>
        </div>
      </div>

      {/* Record Status Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
        <div
          className={cn(
            "rounded-lg border px-3 py-2 flex items-center justify-between gap-2",
            cnameVerified
              ? "border-[#10B981]/30 bg-[#10B981]/[0.07] text-[#6EE7B7]"
              : "border-[#F59E0B]/25 bg-[#F59E0B]/[0.05] text-[#FCD34D]",
          )}
        >
          <span className="truncate">CNAME → edge.sparrowx.net</span>
          <span className={cn("font-semibold shrink-0", !cnameVerified && "spx-soc-pulse")}>
            {cnameVerified ? "VERIFIED" : "PENDING"}
          </span>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 flex items-center justify-between gap-2",
            txtVerified
              ? "border-[#10B981]/30 bg-[#10B981]/[0.07] text-[#6EE7B7]"
              : "border-[#F59E0B]/25 bg-[#F59E0B]/[0.05] text-[#FCD34D]",
          )}
        >
          <span className="truncate">TXT _sparrowx-verify</span>
          <span className={cn("font-semibold shrink-0", !txtVerified && "spx-soc-pulse")}>
            {txtVerified ? "VERIFIED" : "PENDING"}
          </span>
        </div>
      </div>

      {/* Masked Edge WAF Sensor Key Strip */}
      {sensorKey ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A94A6] block">
              Edge WAF Sensor Key
            </span>
            <code className="font-mono text-xs text-[#F4F6FA] break-all" translate="no">
              {revealKey ? sensorKey : maskedKey}
            </code>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setRevealKey((r) => !r)}
              aria-pressed={revealKey}
              aria-label={revealKey ? "Mask Edge WAF sensor key" : "Reveal Edge WAF sensor key"}
              className="inline-flex size-8 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-[#CBD5E1] hover:text-white cursor-pointer"
            >
              {revealKey ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => void copySensorKey()}
              aria-label="Copy Edge WAF sensor key"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.14] bg-white/[0.06] hover:bg-white/[0.12] px-2.5 text-xs font-medium text-[#F4F6FA] cursor-pointer"
            >
              {copiedKey ? (
                <Check className="size-3.5 text-[#10B981]" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              <span>{copiedKey ? "Copied" : "Copy Key"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// 7. COLLAPSIBLE LIVE EDGE TELEMETRY TICKER STREAM
// =============================================================================
export interface TelemetryEventEntry {
  id: string;
  timestamp: string;
  badge: "200 OK" | "ARMED" | "VERIFIED" | "BLOCKED" | "DRILL" | "PENDING";
  source: string;
  message: string;
  latencyMs?: number;
}

export function LiveEdgeTelemetryTicker({
  events,
  defaultExpanded = true,
}: {
  events: TelemetryEventEntry[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [paused, setPaused] = useState(false);
  const [frozenEvents, setFrozenEvents] = useState<TelemetryEventEntry[]>(events);

  useEffect(() => {
    if (!paused) {
      setFrozenEvents(events);
    }
  }, [events, paused]);

  const badgeStyles: Record<TelemetryEventEntry["badge"], string> = {
    "200 OK": "border-white/[0.14] bg-white/[0.05] text-[#CBD5E1]",
    ARMED: "border-[#10B981]/35 bg-[#10B981]/12 text-[#6EE7B7]",
    VERIFIED: "border-[#10B981]/35 bg-[#10B981]/12 text-[#6EE7B7]",
    PENDING: "border-[#F59E0B]/35 bg-[#F59E0B]/12 text-[#FCD34D]",
    BLOCKED: "border-[#F43F5E]/40 bg-[#F43F5E]/15 text-[#FDA4AF]",
    DRILL: "border-[#F43F5E]/45 bg-[#F43F5E]/15 text-[#FDA4AF]",
  };

  const displayEvents = paused ? frozenEvents : events;

  return (
    <section
      aria-label="Live Edge Telemetry Ticker"
      className="rounded-xl border border-white/[0.08] bg-[#070910] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#0A0D14]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="size-3.5 text-[#CBD5E1] shrink-0" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-[#F4F6FA] truncate">
            Live Edge Telemetry Stream
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded border border-[#10B981]/30 bg-[#10B981]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#6EE7B7]">
            <Activity className="size-2.5" aria-hidden="true" />
            <span>{paused ? "PAUSED" : "STREAMING"}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume telemetry stream" : "Pause telemetry stream"}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] px-2 py-1 font-mono text-[10px] text-[#CBD5E1] cursor-pointer"
          >
            {paused ? <Play className="size-2.5" aria-hidden="true" /> : <Pause className="size-2.5" aria-hidden="true" />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] px-2 py-1 font-mono text-[10px] text-[#CBD5E1] cursor-pointer"
          >
            {expanded ? <ChevronDown className="size-3" aria-hidden="true" /> : <ChevronUp className="size-3" aria-hidden="true" />}
            <span>{expanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="max-h-44 overflow-y-auto divide-y divide-white/[0.04] font-mono text-[11px] tabular-nums">
          {displayEvents.map((ev) => (
            <div
              key={ev.id}
              className="px-4 py-2 flex flex-wrap sm:flex-nowrap items-center gap-2.5 hover:bg-white/[0.02]"
            >
              <span className="text-[#64748B] shrink-0">{ev.timestamp}</span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                  badgeStyles[ev.badge],
                )}
              >
                {ev.badge}
              </span>
              <span className="text-[#CBD5E1] shrink-0 max-w-[140px] truncate" translate="no">
                {ev.source}
              </span>
              <span className="text-[#94A3B8] flex-1 min-w-0 truncate">{ev.message}</span>
              {typeof ev.latencyMs === "number" ? (
                <span className="text-[#64748B] shrink-0">{ev.latencyMs}ms</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
