import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
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
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import { WhatsAppLogo } from "@/components/WhatsAppPlansToaster";

export type CheckoutPayMethod = "upi" | "binance_usdt_trc20" | "binance_usdt_bep20";

export interface UpiCheckoutOrder {
  orderId: string;
  method?: CheckoutPayMethod;
  service: "infra" | "game" | "db" | "shield" | "netsec" | "wallet" | "drop" | "deploy";
  planId: string;
  planName: string;
  amountInr: number;
  exactAmountInr?: string;
  exactAmount?: string;
  currency?: "INR" | "USDT";
  upiId?: string;
  merchantName?: string;
  upiUri?: string;
  network?: "TRC20" | "BEP20";
  depositAddress?: string;
  status: "PENDING" | "PAID" | "EXPIRED";
  utr?: string;
  verifiedRef?: string;
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

  const [payMethod, setPayMethod] = useState<CheckoutPayMethod>("upi");
  const [order, setOrder] = useState<UpiCheckoutOrder | null>(null);
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

    void fetch("/api/pay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: payMethod,
        service,
        planId,
        planName,
        amountInr,
        customerEmail,
        metadata,
      }),
    })
      .then((res) => res.json())
      .then((json: { ok?: boolean; order?: UpiCheckoutOrder; error?: string }) => {
        if (!active) return;
        if (json.ok && json.order) {
          setOrder({
            ...json.order,
            exactAmountInr: json.order.exactAmountInr || json.order.exactAmount || `${amountInr}.00`,
          });
        } else {
          setError(json.error || "Unable to initialize SparrowX Pay order.");
        }
      })
      .catch(() => {
        if (active) setError("Could not reach SparrowX Pay backend endpoint.");
      })
      .finally(() => {
        if (active) setCreating(false);
      });

    return () => {
      active = false;
    };
  }, [open, payMethod, service, planId, planName, amountInr, customerEmail, metadata]);

  // Automatic 4s server-side status polling (UPI bank ledger + Binance Spot Read-Only API)
  useEffect(() => {
    if (!open || !order || order.status !== "PENDING") return;
    const timer = window.setInterval(() => {
      void fetch(`/api/pay/order?orderId=${encodeURIComponent(order.orderId)}`)
        .then((r) => r.json())
        .then((json: { ok?: boolean; order?: UpiCheckoutOrder }) => {
          if (json.ok && json.order && json.order.status === "PAID") {
            const normalized = {
              ...json.order,
              exactAmountInr: json.order.exactAmountInr || json.order.exactAmount || `${amountInr}.00`,
              utr: json.order.utr || json.order.verifiedRef,
            };
            setOrder(normalized);
            onPaymentConfirmed?.(normalized);
          }
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, order, amountInr, onPaymentConfirmed]);

  const qrPayload = order?.upiUri || order?.depositAddress || "";
  const qrMatrix = useMemo(
    () => (qrPayload ? buildQrMatrix(qrPayload, 25) : []),
    [qrPayload],
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
      const res = await fetch("/api/pay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, utr: utrInput }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        verified?: boolean;
        message?: string;
        error?: string;
        order?: UpiCheckoutOrder;
      };
      if (json.ok && json.verified && json.order) {
        const normalized = {
          ...json.order,
          exactAmountInr: json.order.exactAmountInr || json.order.exactAmount || `${amountInr}.00`,
          utr: json.order.utr || json.order.verifiedRef,
        };
        setOrder(normalized);
        onPaymentConfirmed?.(normalized);
      } else {
        setError(json.message || json.error || "Not confirmed in bank/Binance ledger yet.");
      }
    } catch {
      setError("Network error verifying payment reference.");
    } finally {
      setVerifyingUtr(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="spx-native-dialog m-auto w-[min(780px,calc(100vw-1.5rem))] max-h-[92dvh] rounded-2xl border border-white/15 bg-[#090C12] p-0 text-[#F4F6FA] shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0E131D] px-6 py-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 grid place-items-center text-emerald-400 shrink-0">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-white tracking-tight truncate">
              SparrowX Pay
            </h2>
            <p className="text-xs text-zinc-400 truncate">
              Direct UPI &amp; Binance USDT · Self-verified · 0% gateway fee
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close SparrowX Pay checkout"
          className="size-9 rounded-xl border border-white/15 bg-[#090C12] hover:bg-white/10 grid place-items-center text-zinc-300 hover:text-white cursor-pointer shrink-0 transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto overflow-x-hidden max-h-[calc(92dvh-82px)] p-5 sm:p-7 space-y-6">
        {/* Payment Method Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#05070B] p-1.5">
          {(
            [
              { id: "upi", label: "UPI QR (INR)" },
              { id: "binance_usdt_trc20", label: "USDT TRC20" },
              { id: "binance_usdt_bep20", label: "USDT BEP20" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPayMethod(m.id)}
              className={`min-h-[42px] rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                payMethod === m.id
                  ? m.id === "upi"
                    ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    : "bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
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
          <div className="space-y-6">
            {/* Spacious 2-Column Checkout Layout (Zero Horizontal Overflow) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Elevated QR Code & Exact Amount Stage */}
              <div className="md:col-span-5 rounded-2xl border border-white/10 bg-[#05070B] p-6 flex flex-col items-center justify-center text-center gap-4">
                <div className="rounded-2xl bg-white p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&ecc=M&data=${encodeURIComponent(qrPayload)}`}
                    alt={`Scannable payment QR code for order ${order.orderId}`}
                    width={184}
                    height={184}
                    className="size-44 sm:size-48 block rounded-lg"
                  />
                </div>

                <div className="space-y-1 tabular-nums">
                  <div className="text-[11px] uppercase tracking-wider font-mono text-zinc-400">
                    Pay Exact Amount
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {order.currency === "USDT"
                        ? `${order.exactAmount} USDT`
                        : `₹${order.exactAmountInr}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          (order.currency === "USDT" ? order.exactAmount : order.exactAmountInr) || "",
                          "amt",
                        )
                      }
                      aria-label="Copy exact amount"
                      className="size-7 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 grid place-items-center text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {copiedField === "amt" ? (
                        <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>
                    {order.currency === "USDT"
                      ? `Watching Binance (${order.network})`
                      : "Watching Bank Ledger"}
                  </span>
                </div>
              </div>

              {/* Right Column: Order Details, Copyable UPI/Address & Actions */}
              <div className="md:col-span-7 min-w-0 flex flex-col justify-between gap-5">
                {/* Order Info Card */}
                <div className="rounded-xl border border-white/10 bg-[#0D1119] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{order.planName}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Order Ref{" "}
                      <span className="text-sky-400 font-mono font-semibold">{order.orderId}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-zinc-300">
                    {order.currency === "USDT" ? order.network : "UPI Direct"}
                  </span>
                </div>

                {/* Copyable UPI ID / Binance Address */}
                <div className="space-y-2 min-w-0">
                  <span className="text-xs font-medium text-zinc-400 block">
                    {order.currency === "USDT"
                      ? `Binance ${order.network} Deposit Address`
                      : "Merchant UPI ID (GPay · PhonePe · Paytm · BHIM)"}
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#05070B] px-3.5 py-3 min-w-0">
                    <code className="flex-1 min-w-0 truncate text-xs sm:text-sm font-mono font-semibold text-white">
                      {order.currency === "USDT" ? order.depositAddress : order.upiId}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          (order.currency === "USDT" ? order.depositAddress : order.upiId) || "",
                          "dest",
                        )
                      }
                      className="shrink-0 min-h-[32px] rounded-lg border border-sky-400/30 bg-sky-400/10 hover:bg-sky-400/20 px-3 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copiedField === "dest" ? (
                        <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                      <span>{copiedField === "dest" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Primary & Secondary Actions */}
                <div className="space-y-2.5">
                  {order.currency !== "USDT" && order.upiUri && (
                    <a
                      href={order.upiUri}
                      className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition-colors shadow-[0_6px_24px_rgba(16,185,129,0.28)]"
                    >
                      <Smartphone className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">Open UPI App (₹{order.exactAmountInr})</span>
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}

                  <a
                    href={buildWhatsAppSupportUrl(
                      `Hi SparrowX, I am paying for ${order.planName} (${order.currency === "USDT" ? `${order.exactAmount} USDT ${order.network}` : `₹${order.exactAmountInr}`}, Order: ${order.orderId}, Email: ${customerEmail}).`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/35 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <WhatsAppLogo className="size-4 text-[#25D366] shrink-0" />
                    <span className="truncate">Need help? WhatsApp {WHATSAPP_SUPPORT_DISPLAY}</span>
                  </a>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed flex items-start gap-2">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Send the exact amount shown. Your order confirms automatically once verified by our server.
                  </span>
                </p>
              </div>
            </div>

            {/* Full-Width Verification Bar */}
            <form
              onSubmit={handleVerifyUtr}
              className="rounded-2xl border border-white/10 bg-[#05070B] p-4 sm:p-5 space-y-3"
            >
              {order.currency === "USDT" ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-zinc-300">
                    Already sent <strong className="text-white">{order.exactAmount} USDT</strong> ({order.network})?
                  </span>
                  <button
                    type="submit"
                    disabled={verifyingUtr}
                    className="min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-bold text-black cursor-pointer shrink-0"
                  >
                    {verifyingUtr ? "Checking Binance..." : "Check Binance Deposit Now"}
                  </button>
                </div>
              ) : (
                <>
                  <label
                    htmlFor="spx-upi-utr"
                    className="text-xs font-medium text-zinc-300 block"
                  >
                    Already paid? Enter your 12-digit UPI UTR to match immediately
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="spx-upi-utr"
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 432198765432"
                      className="flex-1 min-h-[44px] rounded-xl border border-white/15 bg-[#0B0E15] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400 tabular-nums"
                    />
                    <button
                      type="submit"
                      disabled={verifyingUtr || !utrInput.trim()}
                      className="min-h-[44px] rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 px-6 py-2.5 text-sm font-bold text-black cursor-pointer shrink-0 transition-colors"
                    >
                      {verifyingUtr ? "Verifying..." : "Verify UTR"}
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Clean Footer Policy Notice */}
            <PurchasePolicyNotice compact />
          </div>
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
