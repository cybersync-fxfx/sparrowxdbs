import React, { useEffect, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, ShieldCheck, X } from "lucide-react";

export interface EmailVerificationModalProps {
  open: boolean;
  email: string;
  fullName?: string | undefined;
  serviceName?: string | undefined;
  onVerified: (email: string) => void;
  onClose?: (() => void) | undefined;
  allowSkip?: boolean | undefined;
}

/**
 * Triggers a verification email send via `/api/auth/verify-email`.
 * Safe to call right after account registration across any SparrowX service.
 */
export async function sendVerificationEmailRequest(params: {
  email: string;
  fullName?: string | undefined;
  serviceName?: string | undefined;
}): Promise<{
  ok: boolean;
  delivered: boolean;
  smtpConfigured: boolean;
  retryAfterSeconds?: number | undefined;
  error?: string | undefined;
}> {
  try {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName,
        serviceName: params.serviceName || "SparrowX Sovereign Cloud",
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: Boolean(data.ok),
      delivered: Boolean(data.delivered),
      smtpConfigured: Boolean(data.smtpConfigured),
      retryAfterSeconds: typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      delivered: false,
      smtpConfigured: false,
      error: err instanceof Error ? err.message : "Network error sending verification email",
    };
  }
}

export interface GlobalEmailVerificationRequest {
  email: string;
  fullName?: string;
  serviceName?: string;
}

export const EMAIL_VERIFICATION_EVENT = "sparrowx:email-verification-required";

/**
 * Triggers verification email dispatch AND opens the unified root EmailVerificationModal
 * across any SparrowX service (Master Portal, Cloud DB, Shield WAF, Drop Vault, API Gateway).
 */
export function requestGlobalEmailVerification(params: GlobalEmailVerificationRequest): void {
  void sendVerificationEmailRequest(params);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<GlobalEmailVerificationRequest>(EMAIL_VERIFICATION_EVENT, {
        detail: params,
      }),
    );
  }
}

export function GlobalEmailVerificationHost() {
  const [pending, setPending] = useState<GlobalEmailVerificationRequest | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<GlobalEmailVerificationRequest>).detail;
      if (detail?.email) {
        setPending(detail);
      }
    };
    window.addEventListener(EMAIL_VERIFICATION_EVENT, onRequest);

    const params = new URLSearchParams(window.location.search);
    if (params.get("email_verified") === "1") {
      const verifiedEmail = params.get("email") || "your account";
      setBanner(`Email verified for ${verifiedEmail} across all SparrowX services.`);
      window.setTimeout(() => setBanner(null), 6000);
    }

    return () => {
      window.removeEventListener(EMAIL_VERIFICATION_EVENT, onRequest);
    };
  }, []);

  return (
    <>
      {banner && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[130] flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0B1210] px-4 py-3 text-xs font-medium text-emerald-300 shadow-2xl"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span>{banner}</span>
        </div>
      )}
      <EmailVerificationModal
        open={Boolean(pending)}
        email={pending?.email || ""}
        fullName={pending?.fullName}
        serviceName={pending?.serviceName || "SparrowX"}
        allowSkip={true}
        onVerified={(verifiedEmail) => {
          setPending(null);
          setBanner(`Email verified for ${verifiedEmail} across all SparrowX services.`);
          window.setTimeout(() => setBanner(null), 5000);
        }}
        onClose={() => setPending(null)}
      />
    </>
  );
}

export function EmailVerificationModal({
  open,
  email,
  fullName,
  serviceName = "SparrowX",
  onVerified,
  onClose,
  allowSkip = false,
}: EmailVerificationModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [statusMessage, setStatusMessage] = useState<string>(
    `We sent a 6-digit verification code to ${email}.`,
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setErrorMessage("");
    setVerifiedSuccess(false);
    setCooldown(60);
    setStatusMessage(`We sent a 6-digit verification code to ${email}.`);
  }, [open, email]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, cooldown]);

  if (!open) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      setErrorMessage("Enter the 6-digit verification code from your inbox.");
      return;
    }

    setVerifying(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: email.trim().toLowerCase(),
          code: clean,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        setVerifiedSuccess(true);
        setStatusMessage("Email verified across all SparrowX services.");
        window.setTimeout(() => {
          onVerified(email.trim().toLowerCase());
        }, 650);
      } else {
        setErrorMessage(data.error || "Invalid or expired verification code.");
      }
    } catch {
      setErrorMessage("Could not reach verification server. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage("");
    const res = await sendVerificationEmailRequest({ email, fullName, serviceName });
    setResending(false);
    if (res.ok && res.delivered) {
      setCooldown(res.retryAfterSeconds ?? 60);
      setStatusMessage(`Fresh verification code sent to ${email} via SparrowX SMTP.`);
    } else if (res.ok && !res.delivered) {
      setCooldown(res.retryAfterSeconds ?? 60);
      setStatusMessage(
        res.smtpConfigured
          ? "Verification code generated, but SMTP relay reported a delivery issue. Check server DNS/SMTP logs."
          : "Verification code generated. Configure self-hosted SMTP on your server via ./deploy/smtp-setup.sh to deliver emails.",
      );
    } else {
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
      setErrorMessage(res.error || "Failed to resend verification email.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Verify your SparrowX email"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0B0E14] p-6 text-white shadow-2xl">
        {onClose && allowSkip && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification dialog"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {verifiedSuccess ? <CheckCircle2 className="size-5" /> : <Mail className="size-5" />}
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              SparrowX Unified Identity
            </p>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Verify Your Email Address
            </h2>
          </div>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-zinc-400">
          {statusMessage} Verifying once activates your account across{" "}
          <span className="text-zinc-200 font-medium">
            Cloud DB, Shield WAF, Drop Vault, API Gateway, and Game Hosting
          </span>
          .
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {verifiedSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-300 flex items-center justify-center gap-2">
            <ShieldCheck className="size-4" />
            Email Verified — Entering {serviceName}...
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="spx-email-otp"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                6-Digit Verification Code
              </label>
              <input
                id="spx-email-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-bold text-black transition-opacity hover:bg-zinc-100 disabled:opacity-50"
            >
              {verifying ? "Verifying Code..." : "Verify Email & Continue"}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                disabled={cooldown > 0 || resending}
                onClick={handleResend}
                className="inline-flex items-center gap-1.5 font-medium text-zinc-300 hover:text-white disabled:text-zinc-600 transition-colors"
              >
                <RefreshCw className={`size-3.5 ${resending ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Verification Code"}
              </button>

              {allowSkip && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Verify later
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
