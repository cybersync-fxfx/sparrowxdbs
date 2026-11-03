import React from "react";
import * as Flags from "country-flag-icons/react/3x2";

export interface CountryFlagProps extends React.HTMLAttributes<HTMLSpanElement> {
  code: string;
  className?: string;
  title?: string;
}

export function CountryFlag({ code, className = "size-4", title, ...props }: CountryFlagProps) {
  const normalized = (code || "").toUpperCase().trim();
  // Safe lookup of flag component
  const FlagComponent = (Flags as Record<string, React.ComponentType<{ className?: string; title?: string }>>)[normalized];

  if (!FlagComponent) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xs bg-muted font-mono text-[9px] font-bold text-muted-foreground uppercase border border-border/60 ${className}`}
        title={title || normalized}
        {...props}
      >
        {normalized.slice(0, 2) || "??"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xs shadow-2xs border border-white/10 ${className}`}
      title={title || normalized}
      {...props}
    >
      <FlagComponent className="h-full w-full object-cover" title={title || normalized} />
    </span>
  );
}
