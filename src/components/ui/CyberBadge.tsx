import React from "react";
import {
  Zap,
  Shield,
  ShieldAlert,
  Lock,
  Siren,
  Dna,
  Settings,
  Brain,
  BarChart3,
  FileCheck2,
  AlertTriangle,
  Globe2,
  Sparkles,
  Server,
  Activity,
  Flame,
  Radio,
} from "lucide-react";

export type CyberEmblemVariant =
  | "zap"
  | "shield"
  | "shield-alert"
  | "lock"
  | "siren"
  | "dna"
  | "gear"
  | "brain"
  | "chart"
  | "audit"
  | "warning"
  | "globe"
  | "sparkles"
  | "server"
  | "radar";

export interface CyberBadgeProps {
  variant: CyberEmblemVariant;
  label?: string;
  sublabel?: string;
  badge?: string;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles: Record<
  CyberEmblemVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgGradient: string;
    borderColor: string;
    iconColor: string;
    badgeStyle: string;
  }
> = {
  zap: {
    icon: Zap,
    accentColor: "text-amber-400",
    bgGradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-400",
    badgeStyle: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  shield: {
    icon: Shield,
    accentColor: "text-emerald-400",
    bgGradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    badgeStyle: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  "shield-alert": {
    icon: ShieldAlert,
    accentColor: "text-rose-400",
    bgGradient: "from-rose-500/20 via-red-500/10 to-transparent",
    borderColor: "border-rose-500/30",
    iconColor: "text-rose-400",
    badgeStyle: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  },
  lock: {
    icon: Lock,
    accentColor: "text-primary",
    bgGradient: "from-primary/25 via-orange-500/10 to-transparent",
    borderColor: "border-primary/35",
    iconColor: "text-primary",
    badgeStyle: "bg-primary/10 text-primary border-primary/30",
  },
  siren: {
    icon: Siren,
    accentColor: "text-red-400",
    bgGradient: "from-red-500/25 via-rose-500/10 to-transparent",
    borderColor: "border-red-500/35",
    iconColor: "text-red-400",
    badgeStyle: "bg-red-500/10 text-red-300 border-red-500/30",
  },
  dna: {
    icon: Dna,
    accentColor: "text-blue-400",
    bgGradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-400",
    badgeStyle: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  },
  gear: {
    icon: Settings,
    accentColor: "text-zinc-300",
    bgGradient: "from-zinc-500/20 via-zinc-700/10 to-transparent",
    borderColor: "border-zinc-700/50",
    iconColor: "text-zinc-300",
    badgeStyle: "bg-zinc-800 text-zinc-300 border-zinc-700",
  },
  brain: {
    icon: Brain,
    accentColor: "text-purple-400",
    bgGradient: "from-purple-500/25 via-fuchsia-500/10 to-transparent",
    borderColor: "border-purple-500/35",
    iconColor: "text-purple-400",
    badgeStyle: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  },
  chart: {
    icon: BarChart3,
    accentColor: "text-cyan-400",
    bgGradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
    borderColor: "border-cyan-500/30",
    iconColor: "text-cyan-400",
    badgeStyle: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  },
  audit: {
    icon: FileCheck2,
    accentColor: "text-emerald-400",
    bgGradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    badgeStyle: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  warning: {
    icon: AlertTriangle,
    accentColor: "text-amber-400",
    bgGradient: "from-amber-500/25 via-yellow-500/10 to-transparent",
    borderColor: "border-amber-500/35",
    iconColor: "text-amber-400",
    badgeStyle: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  globe: {
    icon: Globe2,
    accentColor: "text-sky-400",
    bgGradient: "from-sky-500/20 via-blue-500/10 to-transparent",
    borderColor: "border-sky-500/30",
    iconColor: "text-sky-400",
    badgeStyle: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  },
  sparkles: {
    icon: Sparkles,
    accentColor: "text-yellow-400",
    bgGradient: "from-yellow-500/20 via-amber-500/10 to-transparent",
    borderColor: "border-yellow-500/30",
    iconColor: "text-yellow-400",
    badgeStyle: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  },
  server: {
    icon: Server,
    accentColor: "text-indigo-400",
    bgGradient: "from-indigo-500/20 via-purple-500/10 to-transparent",
    borderColor: "border-indigo-500/30",
    iconColor: "text-indigo-400",
    badgeStyle: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  },
  radar: {
    icon: Radio,
    accentColor: "text-emerald-400",
    bgGradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    badgeStyle: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
};

export function CyberEmblem({
  variant,
  pulse = false,
  size = "md",
  className = "",
}: {
  variant: CyberEmblemVariant;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = variantStyles[variant] || variantStyles.shield;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "size-6 p-1 text-xs",
    md: "size-8 p-1.5 text-sm",
    lg: "size-10 p-2 text-base",
  }[size];

  const iconSizes = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
  }[size];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${config.bgGradient} ${config.borderColor} ${sizeClasses} shadow-sm backdrop-blur-md ${className}`}
    >
      {pulse && (
        <span
          className={`absolute -inset-0.5 rounded-xl bg-current opacity-20 blur-xs animate-ping ${config.accentColor}`}
        />
      )}
      <Icon className={`${iconSizes} ${config.iconColor} shrink-0 transition-transform hover:scale-110`} />
    </div>
  );
}

export function CyberPill({
  variant,
  title,
  action,
  actionClass,
  className = "",
}: {
  variant: CyberEmblemVariant;
  title: string;
  action?: string;
  actionClass?: string;
  className?: string;
}) {
  const config = variantStyles[variant] || variantStyles.shield;

  return (
    <div
      className={`group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/90 py-1.5 pl-1.5 pr-3 text-xs shadow-md backdrop-blur-md transition-all hover:border-white/20 hover:bg-zinc-900/90 ${className}`}
    >
      <CyberEmblem variant={variant} size="sm" />
      <span className="font-semibold text-zinc-200 tracking-tight">{title}</span>
      {action && (
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
            actionClass || config.badgeStyle
          }`}
        >
          {action}
        </span>
      )}
    </div>
  );
}
