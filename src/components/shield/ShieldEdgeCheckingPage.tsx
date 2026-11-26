import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { normalizeShieldDomain } from "@/lib/supabase";

interface ShieldEdgeCheckingPageProps {
  domain: string;
  redirectUrl?: string | null;
  previewMode?: boolean;
  onClosePreview?: () => void;
  onVerified?: () => void;
}

const CHECK_STAGES = [
  {
    step: "Inspecting TLS fingerprint & OVH Mumbai edge route...",
    detail: "Checking origin routing & L4/L7 DDoS posture (IN-BOM1)",
    pct: 28,
  },
  {
    step: "Verifying browser integrity & anti-bot JS challenge...",
    detail: "WebDriver, headless & behavioral token validation",
    pct: 68,
  },
  {
    step: "Connection is secure — routing you to origin server",
    detail: "SparrowX clearance cookie issued (30 min session)",
    pct: 100,
  },
] as const;

export function ShieldEdgeCheckingPage({
  domain,
  redirectUrl,
  previewMode = false,
  onClosePreview,
  onVerified,
}: ShieldEdgeCheckingPageProps) {
  const cleanDomain = useMemo(() => normalizeShieldDomain(domain) || "yourdomain.com", [domain]);
  const [stageIdx, setStageIdx] = useState(0);
  const [rayId] = useState(() => {
    const bytes = new Uint8Array(8);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    }
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `spx_${hex || Date.now().toString(16)}`;
  });

  useEffect(() => {
    setStageIdx(0);
    const t1 = setTimeout(() => setStageIdx(1), 750);
    const t2 = setTimeout(() => {
      setStageIdx(2);
      onVerified?.();
      if (!previewMode && redirectUrl) {
        try {
          const parsed = new URL(redirectUrl);
          if (
            (parsed.protocol === "https:" || parsed.protocol === "http:") &&
            normalizeShieldDomain(parsed.hostname) === cleanDomain
          ) {
            document.cookie = `__spx_edge_clearance_${cleanDomain.replace(/[^a-z0-9]/g, "_")}=verified; path=/; max-age=1800; SameSite=Lax`;
            setTimeout(() => {
              window.location.replace(parsed.toString());
            }, 600);
          }
        } catch {
          // ignore invalid redirect URL
        }
      }
    }, 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cleanDomain, previewMode, redirectUrl, onVerified]);

  const current = CHECK_STAGES[stageIdx] ?? CHECK_STAGES[0];
  const verified = stageIdx === 2;

  return (
    <div
      className={`${
        previewMode ? "fixed inset-0 z-[120]" : "min-h-screen"
      } bg-[#05060A] text-[#F4F6FA] flex flex-col items-center justify-center p-6 font-sans antialiased`}
    >
      {previewMode && onClosePreview ? (
        <div className="fixed top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStageIdx(0)}
            className="rounded-lg border border-white/15 bg-[#090B11] hover:bg-[#10131C] px-3 py-1.5 text-xs font-mono text-zinc-200 cursor-pointer"
          >
            Replay Check
          </button>
          <button
            type="button"
            onClick={onClosePreview}
            aria-label="Close checking page preview"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#090B11] hover:bg-[#10131C] px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Exit Preview</span>
          </button>
        </div>
      ) : null}

      <div className="w-full max-w-[540px] rounded-2xl border border-white/[0.1] bg-[#090B11] p-7 sm:p-9 shadow-[0_28px_90px_rgba(0,0,0,0.85)] space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/10 grid place-items-center shrink-0">
              <img
                src="/logos/sparrowx-shield.png"
                alt="SparrowX Shield"
                width={26}
                height={26}
                className="size-6.5 object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400">
                SparrowX Shield · Edge Verification
              </div>
              <div className="text-base font-mono font-semibold text-white truncate">
                {cleanDomain}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 text-[10px] font-mono text-[#10B981] shrink-0">
            <Lock className="size-3" aria-hidden="true" />
            <span>TLS 1.3</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Checking if the site connection is secure
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            <strong className="text-zinc-200 font-mono">{cleanDomain}</strong> needs to review the
            security of your connection before proceeding to the origin server.
          </p>
        </div>

        {/* Live Verification Box */}
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 flex items-center gap-3.5 transition-colors ${
            verified
              ? "border-[#10B981]/40 bg-[#10B981]/[0.07]"
              : "border-white/[0.08] bg-[#05060A]"
          }`}
        >
          {verified ? (
            <CheckCircle2 className="size-6 text-[#10B981] shrink-0" aria-hidden="true" />
          ) : (
            <Loader2 className="size-6 text-[#10B981] animate-spin shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">{current.step}</div>
            <div className="mt-0.5 text-[11px] font-mono text-zinc-400">{current.detail}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#B8C2D1] to-[#10B981] transition-all duration-500"
            style={{ width: `${current.pct}%` }}
          />
        </div>

        {previewMode && verified ? (
          <div className="rounded-lg border border-white/[0.08] bg-[#05060A] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-zinc-300">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#10B981] shrink-0" aria-hidden="true" />
              <span>Visitors now proceed automatically to https://{cleanDomain}</span>
            </span>
          </div>
        ) : null}

        <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <span>
            Ray ID: <strong className="text-zinc-300">{rayId}</strong>
          </span>
          <span>
            Edge POP: <strong className="text-[#10B981]">IN-BOM1 (Mumbai)</strong>
          </span>
        </div>
      </div>

      <p className="mt-5 text-xs text-zinc-500 text-center">
        Performance &amp; DDoS protection by{" "}
        <strong className="text-zinc-300 font-medium">SparrowX Shield</strong>{" "}
        <span className="font-mono text-zinc-400">(sec.sparrowx.net)</span>
      </p>
    </div>
  );
}
