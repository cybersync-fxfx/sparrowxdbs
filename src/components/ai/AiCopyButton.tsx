import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";

let lastGlobalCopyAnnouncement = "";

function legacyCopyFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  const previousFocus = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

interface AiCopyButtonProps {
  value: string;
  label?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible copy button following modern-web-guidance `copy-button`:
 * - Keeps the confirmation live region (`role="status"`) outside the `<button>`
 * - Deduplicates repeated VoiceOver announcements with a trailing `\u00A0`
 * - Uses `min-w-[28px] min-h-[28px]`, never disables while showing feedback
 * - Falls back to synchronous `legacyCopyFallback` when Async Clipboard fails
 */
export function AiCopyButton({ value, label, ariaLabel, className = "" }: AiCopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [announcement, setAnnouncement] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!value) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else {
        ok = legacyCopyFallback(value);
      }
    } catch {
      ok = legacyCopyFallback(value);
    }

    let msg = ok ? "Copied" : "Copy failed";
    if (msg === lastGlobalCopyAnnouncement) msg += "\u00A0";
    lastGlobalCopyAnnouncement = msg;

    setStatus(ok ? "copied" : "failed");
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));

    timerRef.current = setTimeout(() => {
      setStatus("idle");
      setAnnouncement("");
    }, 2000);
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={label ? undefined : ariaLabel}
        data-copied={status === "copied" ? "" : undefined}
        data-failed={status === "failed" ? "" : undefined}
        className={`inline-flex items-center justify-center gap-1.5 min-w-[28px] min-h-[28px] rounded-md border border-white/10 bg-[#10131C] hover:border-white/20 hover:bg-[#161A26] px-2.5 py-1 text-xs font-mono text-zinc-200 transition-colors cursor-pointer ${className}`}
      >
        {status === "copied" ? (
          <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden="true" />
        ) : status === "failed" ? (
          <AlertCircle className="size-3.5 text-[#EF4444] shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
        )}
        {label ? <span>{status === "copied" ? "Copied" : status === "failed" ? "Failed" : label}</span> : null}
      </button>
      <span
        role="status"
        className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#10131C] border border-white/15 px-1.5 py-0.5 text-[10px] font-mono text-zinc-100 shadow-lg transition-opacity duration-150 ${
          announcement ? "opacity-100" : "opacity-0"
        }`}
      >
        {announcement}
      </span>
    </span>
  );
}
