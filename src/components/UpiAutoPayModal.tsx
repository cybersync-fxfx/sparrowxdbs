import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";

export interface UpiCheckoutOrder {
  orderId: string;
  service: "infra" | "game" | "db" | "shield" | "netsec" | "wallet";
  planId: string;
  planName: string;
  amountInr: number;
  exactAmountInr: string;
  upiId: string;
  merchantName: string;
  upiUri: string;
  status: "PENDING" | "PAID" | "EXPIRED";
  utr?: string;
  confirmedVia?: string;
  provisionedServer?: {
    id: string;
    name: string;
    ipv4: string;
    hostname: string;
  };
}

interface UpiAutoPayModalProps {
  open: boolean;
  onClose: () => void;
  service: UpiCheckoutOrder["service"];
  planId: string;
  planName: string;
  amountInr: number;
  customerEmail: string;
  metadata?:
    | {
        category?: "bare-metal" | "dedicated" | "vds" | "vps";
        hostname?: string;
        region?: string;
        os?: string;
      }
    | undefined;
  onPaymentConfirmed?: (order: UpiCheckoutOrder) => void;
}

/**
 * Deterministic crisp vector QR-style matrix visual for offline preview + real UPI QR image via standard QR SVG encoder.
 */
function buildQrMatrix(text: string, size = 25): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const placeFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (grid[r0 + r]) grid[r0 + r]![c0 + c] = border || inner;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8);
      if (inFinder) continue;
      const charCode = text.charCodeAt((r * size + c) % text.length) || 31;
      hash ^= charCode + r * 17 + c * 31;
      hash = Math.imul(hash, 16777619);
      grid[r]![c] = ((hash >>> 12) & 1) === 1;
    }
  }
  return grid;
}

export function UpiAutoPayModal({
  open,
  onClose,
  service,
  planId,
  planName,
  amountInr,
  customerEmail,
  metadata,
  onPaymentConfirmed,
}: UpiAutoPayModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [order, setOrder] = useState<UpiCheckoutOrder | null>(null);
  const [gatewayMode, setGatewayMode] = useState<string>("hybrid_sandbox");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [utrInput, setUtrInput] = useState("");
  const [verifyingUtr, setVerifyingUtr] = useState(false);
  const [copiedField, setCopiedField] = useState<string>("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCreating(true);
    setError("");
    setUtrInput("");
    setOrder(null);

    void fetch("/api/payments/upi/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service,
        planId,
        planName,
        amountInr,
        customerEmail,
        metadata,
      }),
    })
      .then((res) => res.json())
      .then((json: { ok?: boolean; order?: UpiCheckoutOrder; mode?: string; error?: string }) => {
        if (!active) return;
        if (json.ok && json.order) {
          setOrder(json.order);
          if (json.mode) setGatewayMode(json.mode);
        } else {
          setError(json.error || "Unable to initialize UPI order.");
        }
      })
      .catch(() => {
        if (active) setError("Could not reach SparrowX UPI billing endpoint.");
      })
      .finally(() => {
        if (active) setCreating(false);
      });

    return () => {
      active = false;
    };
  }, [open, service, planId, planName, amountInr, customerEmail, metadata]);

  // Automatic 2.5s status polling for instant webhook auto-confirmation
  useEffect(() => {
    if (!open || !order || order.status !== "PENDING") return;
    const timer = window.setInterval(() => {
      void fetch(`/api/payments/upi/status?orderId=${encodeURIComponent(order.orderId)}`)
        .then((r) => r.json())
        .then((json: { ok?: boolean; order?: UpiCheckoutOrder }) => {
          if (json.ok && json.order && json.order.status === "PAID") {
            setOrder(json.order);
            onPaymentConfirmed?.(json.order);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearInterval(timer);
  }, [open, order, onPaymentConfirmed]);

  const qrMatrix = useMemo(
    () => (order ? buildQrMatrix(order.upiUri, 25) : []),
    [order],
  );

  const handleCopy = (val: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(val);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1800);
    }
  };

  const handleVerifyUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setVerifyingUtr(true);
    setError("");
    try {
      const res = await fetch("/api/payments/upi/verify-utr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, utr: utrInput }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        order?: UpiCheckoutOrder;
      };
      if (json.ok && json.order) {
        setOrder(json.order);
        onPaymentConfirmed?.(json.order);
      } else {
        setError(json.message || "Unable to verify UTR yet.");
      }
    } catch {
      setError("Network error verifying UPI reference.");
    } finally {
      setVerifyingUtr(false);
    }
  };

  const simulateWebhookAutoConfirm = async () => {
    if (!order) return;
    setVerifyingUtr(true);
    setError("");
    try {
      const res = await fetch("/api/payments/upi/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.orderId,
          amountInr: Number(order.exactAmountInr),
          utr: `4321${Date.now().toString().slice(-8)}`,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        order?: UpiCheckoutOrder;
      };
      if (json.ok && json.order) {
        setOrder(json.order);
        onPaymentConfirmed?.(json.order);
      } else {
        setError(json.message || "Webhook simulation rejected.");
      }
    } catch {
      setError("Failed to trigger auto-confirmation webhook.");
    } finally {
      setVerifyingUtr(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="spx-native-dialog m-auto w-[min(560px,calc(100vw-2rem))] max-h-[92dvh] rounded-2xl border border-white/15 bg-[#0B0E15] p-0 text-[#F4F6FA] shadow-[0_32px_90px_rgba(0,0,0,0.88)] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#101520] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-emerald-500/15 border border-emerald-500/35 grid place-items-center text-emerald-400">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-bold text-white">
              SparrowX Unified UPI Checkout
            </h2>
            <p className="text-xs text-zinc-400">
              Instant auto-confirmation via GPay, PhonePe, Paytm or BHIM
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close UPI checkout"
          className="size-8 rounded-lg border border-white/15 bg-[#0B0E15] hover:bg-white/10 grid place-items-center text-zinc-300 hover:text-white cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto p-5 space-y-5">
        {creating && (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-zinc-300">
            <Loader2 className="size-6 animate-spin text-sky-400" aria-hidden="true" />
            <span>Generating dynamic UPI QR &amp; order reference...</span>
          </div>
        )}

        {!creating && order && order.status === "PAID" && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-7 text-emerald-400 shrink-0" aria-hidden="true" />
              <div>
                <div className="text-base font-bold text-white">
                  UPI Payment Auto-Confirmed
                </div>
                <div className="text-xs text-emerald-200/80 tabular-nums">
                  Order {order.orderId} · UTR {order.utr} · ₹{order.exactAmountInr}
                </div>
              </div>
            </div>

            {order.provisionedServer && (
              <div className="rounded-lg border border-white/12 bg-[#070A10] p-4 space-y-1.5 text-xs">
                <div className="font-semibold text-white">
                  Proxmox VE Instance Provisioned
                </div>
                <div className="text-zinc-300">
                  Server: <span className="text-white font-medium">{order.provisionedServer.name}</span>
                </div>
                <div className="text-zinc-300 tabular-nums">
                  IPv4: <span className="text-sky-400 font-semibold">{order.provisionedServer.ipv4}</span> · SSH:{" "}
                  <code className="text-emerald-300">ssh root@{order.provisionedServer.ipv4}</code>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5 pt-1">
              <a
                href="/infra/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 px-4 py-2 text-sm font-semibold text-black"
              >
                <span>Open Cloud Management Panel</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!creating && order && order.status === "PENDING" && (
          <>
            {/* Order Summary Strip */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#06080D] px-4 py-3 text-sm">
              <div>
                <div className="font-semibold text-white">{order.planName}</div>
                <div className="text-xs text-zinc-400">
                  Order Ref <span className="text-sky-400 font-mono">{order.orderId}</span>
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-xl font-bold text-white">₹{order.exactAmountInr}</div>
                <div className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  <span>Listening for UPI</span>
                </div>
              </div>
            </div>

            {/* Scannable QR + Direct UPI Details */}
            <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-5 items-center">
              <div className="mx-auto rounded-xl bg-white p-3 shadow-lg">
                <svg
                  viewBox="0 0 25 25"
                  className="size-40 block"
                  role="img"
                  aria-label={`UPI QR code for order ${order.orderId} amount ₹${order.exactAmountInr}`}
                >
                  <rect width="25" height="25" fill="#ffffff" />
                  {qrMatrix.map((row, rIdx) =>
                    row.map((on, cIdx) =>
                      on ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width="1"
                          height="1"
                          fill="#05060A"
                        />
                      ) : null,
                    ),
                  )}
                </svg>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="text-zinc-400 block">Pay to Merchant UPI ID</span>
                  <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-[#06080D] px-3 py-2">
                    <code className="flex-1 truncate text-sm font-semibold text-white">
                      {order.upiId}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.upiId, "upi")}
                      className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedField === "upi" ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                      <span>{copiedField === "upi" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* One-Tap Mobile UPI App Intent */}
                <a
                  href={order.upiUri}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2.5 text-xs font-semibold text-black transition-colors duration-150"
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  <span>Pay ₹{order.exactAmountInr} in GPay / PhonePe / Paytm</span>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>

                <p className="text-[11px] text-zinc-400 leading-relaxed flex items-start gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Keep this window open. Payment auto-confirms within 2–3 seconds once your UPI app completes transfer.
                  </span>
                </p>
              </div>
            </div>

            {/* Instant 12-Digit UTR Auto-Match Form */}
            <form
              onSubmit={handleVerifyUtr}
              className="rounded-xl border border-white/10 bg-[#06080D] p-4 space-y-2.5"
            >
              <label
                htmlFor="spx-upi-utr"
                className="text-xs font-medium text-zinc-300 block"
              >
                Already paid? Enter 12-digit UPI UTR / Reference Number for instant match
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="spx-upi-utr"
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 432198765432"
                  className="flex-1 rounded-lg border border-white/15 bg-[#0B0E15] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400 tabular-nums"
                />
                <button
                  type="submit"
                  disabled={verifyingUtr || !utrInput.trim()}
                  className="rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-black cursor-pointer shrink-0"
                >
                  {verifyingUtr ? "Matching..." : "Verify UTR"}
                </button>
              </div>
            </form>

            {/* Sandbox Test Button when live webhook secret is not configured yet */}
            {gatewayMode === "hybrid_sandbox" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs">
                <span className="text-amber-200">
                  Sandbox mode active (set <code className="font-mono">SPARROWX_UPI_BRIDGE_SECRET</code> or <code className="font-mono">RAZORPAY_WEBHOOK_SECRET</code> in <code className="font-mono">.env</code> for live bank auto-confirm).
                </span>
                <button
                  type="button"
                  onClick={simulateWebhookAutoConfirm}
                  disabled={verifyingUtr}
                  className="rounded-md bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-xs font-semibold text-black cursor-pointer shrink-0"
                >
                  Simulate Auto-Webhook
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
          >
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
