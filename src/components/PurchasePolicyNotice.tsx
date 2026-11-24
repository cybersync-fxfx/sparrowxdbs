import React from "react";
import { ShieldCheck } from "lucide-react";

interface PurchasePolicyNoticeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Unified pre-purchase notice displayed wherever a client chooses or buys any
 * plan across SparrowX (Cloud Infra, UPI Checkout, Game Hosting, Cloud DB, Shield).
 */
export function PurchasePolicyNotice({
  className = "",
  compact = false,
}: PurchasePolicyNoticeProps) {
  return (
    <div
      className={`w-full rounded-lg border border-white/10 bg-white/[0.03] ${
        compact ? "px-3 py-2 text-[11px]" : "px-3.5 py-2.5 text-xs"
      } text-zinc-300 flex items-start gap-2 ${className}`}
    >
      <ShieldCheck
        className="size-4 shrink-0 text-emerald-400 mt-0.5"
        aria-hidden="true"
      />
      <p className="leading-relaxed">
        Before purchasing, we request you to read our{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium underline underline-offset-2 hover:text-sky-300 transition-colors"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/refund"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium underline underline-offset-2 hover:text-sky-300 transition-colors"
        >
          Refund Policy
        </a>
        .
      </p>
    </div>
  );
}
