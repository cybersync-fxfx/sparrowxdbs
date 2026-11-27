import React from "react";
import { InteractiveCard } from "./InteractiveCard";

export interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children}
    </div>
  );
}

export interface BentoCardProps {
  title: string;
  description: string;
  badge?: string;
  statusLabel?: string;
  accent?: "periwinkle" | "cyan" | "emerald" | "amber" | "crimson";
  icon?: React.ReactNode;
  visual?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}

const ACCENT_MAP = {
  periwinkle: {
    spotlight: "rgba(143, 156, 255, 0.16)",
    pill: "border-[#8F9CFF]/35 bg-[#8F9CFF]/10 text-[#8F9CFF]",
    dot: "bg-[#8F9CFF]",
  },
  cyan: {
    spotlight: "rgba(6, 182, 212, 0.16)",
    pill: "border-[#06B6D4]/35 bg-[#06B6D4]/10 text-[#06B6D4]",
    dot: "bg-[#06B6D4]",
  },
  emerald: {
    spotlight: "rgba(16, 185, 129, 0.16)",
    pill: "border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]",
    dot: "bg-[#10B981]",
  },
  amber: {
    spotlight: "rgba(245, 158, 11, 0.16)",
    pill: "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#F59E0B]",
    dot: "bg-[#F59E0B]",
  },
  crimson: {
    spotlight: "rgba(244, 63, 94, 0.16)",
    pill: "border-rose-500/35 bg-rose-500/10 text-rose-400",
    dot: "bg-rose-400",
  },
} as const;

export function BentoCard({
  title,
  description,
  badge,
  statusLabel,
  accent = "periwinkle",
  icon,
  visual,
  footer,
  className = "",
  href,
  onClick,
}: BentoCardProps) {
  const tone = ACCENT_MAP[accent];

  const inner = (
    <InteractiveCard
      spotlightColor={tone.spotlight}
      onClick={onClick}
      className={`h-full p-5 sm:p-6 ${href || onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {icon && (
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#141A29] bg-[#030407] text-white">
                  {icon}
                </div>
              )}
              {badge && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}
                >
                  {badge}
                </span>
              )}
            </div>
            {statusLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#030407]/80 px-2.5 py-0.5 font-mono text-[10px] text-zinc-300">
                <span className={`size-1.5 rounded-full ${tone.dot}`} />
                {statusLabel}
              </span>
            )}
          </div>

          {visual && <div className="pt-1">{visual}</div>}

          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-[#8F9CFF] transition-colors">
              {title}
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-400">{description}</p>
          </div>
        </div>

        {footer && <div className="border-t border-[#141A29] pt-3">{footer}</div>}
      </div>
    </InteractiveCard>
  );

  if (href) {
    return (
      <a href={href} className="block h-full no-underline">
        {inner}
      </a>
    );
  }
  return inner;
}
