import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Zap,
  Check,
  ShieldCheck,
  ArrowRight,
  Download,
  Lock,
  Sparkles,
  QrCode,
  CheckCircle2,
  Copy,
  ExternalLink,
  Coins,
  Clock,
  AlertTriangle,
  RefreshCw,
  Ban,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { emitEngineActivity, emitEngineToast } from "@/components/BackgroundEngineToaster";
import { Button } from "@/components/ui/button";
import {
  CREDIT_PACKAGES,
  MERCHANT_PAYMENT_CONFIG,
  type BillingTransaction,
  type BinancePaymentOrder,
  type UpiPaymentOrder,
  downloadTransactionReceipt,
  downloadPrintableInvoiceHtml,
  validateUpiUtr,
  createBinanceOrder,
  cancelBinanceOrder,
  verifyBinanceOrderAutomation,
  createUpiOrder,
  cancelUpiOrder,
  verifyUpiOrderAutomation,
} from "@/lib/billing-credits";

interface PaymentGatewayModalProps {
  currentBalance: number;
  neededCredits?: number | undefined;
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  userEmail?: string | undefined;
  onClose: () => void;
  onCreditsAdded: (newBalance: number, creditsAdded: number) => void;
  showToast: (msg: string) => void;
}

export function PaymentGatewayModal({
  currentBalance,
  neededCredits,
  tenantId,
  tenantName,
  userEmail,
  onClose,
  onCreditsAdded,
  showToast,
}: PaymentGatewayModalProps) {
  // Selected package
  const [selectedPackId, setSelectedPackId] = useState<string>(
    neededCredits && neededCredits > 500 ? "scale" : "builder",
  );
  const [customCredits, setCustomCredits] = useState<number>(
    neededCredits ? Math.max(100, neededCredits) : 300,
  );

  // Strictly exclusive payment models: ONLY UPI or Binance
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "binance">("upi");

  // Orders
  const [binanceOrder, setBinanceOrder] = useState<BinancePaymentOrder | null>(null);
  const [upiOrder, setUpiOrder] = useState<UpiPaymentOrder | null>(null);

  // Binance form & countdown
  const [userBinanceIdOrTx, setUserBinanceIdOrTx] = useState("");
  const [binanceSecondsLeft, setBinanceSecondsLeft] = useState(15 * 60); // 15-minute window
  const [binanceCopiedId, setBinanceCopiedId] = useState(false);
  const [binanceCopiedMemo, setBinanceCopiedMemo] = useState(false);

  // UPI form & copy states
  const [upiUtr, setUpiUtr] = useState("");
  const [upiCopied, setUpiCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Processing & stage states
  const [processStage, setProcessStage] = useState<
    "idle" | "verifying" | "charging" | "minting" | "success" | "cancelled"
  >("idle");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [completedTx, setCompletedTx] = useState<BillingTransaction | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const selectedPack = CREDIT_PACKAGES.find((p) => p.id === selectedPackId);
  const activeCredits =
    selectedPackId === "custom" ? customCredits : (selectedPack?.credits ?? 500);

  const activePriceUsd =
    selectedPackId === "custom" ? Math.round(customCredits * 0.18) : (selectedPack?.priceUsd ?? 79);

  // INR equivalent calculation
  const inrPrice =
    selectedPackId === "starter"
      ? 1599
      : selectedPackId === "builder"
        ? 6499
        : selectedPackId === "scale"
          ? 19999
          : Math.round(customCredits * 15);

  // Setup / regenerate active orders whenever active package or credits change
  useEffect(() => {
    const bOrder = createBinanceOrder({
      credits: activeCredits,
      amountUsdt: activePriceUsd,
      tenantId,
      userEmail,
      expiryMinutes: 15,
    });
    setBinanceOrder(bOrder);
    setBinanceSecondsLeft(15 * 60);

    const uOrder = createUpiOrder({
      credits: activeCredits,
      amountInr: inrPrice,
      amountUsd: activePriceUsd,
      tenantId,
      userEmail,
    });
    setUpiOrder(uOrder);
    setProcessStage("idle");
    setPaymentError(null);
  }, [activeCredits, activePriceUsd, inrPrice, tenantId, userEmail]);

  // Binance 15-minute countdown timer with automatic order cancellation
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (paymentMethod !== "binance" || processStage !== "idle") return;

    timerRef.current = setInterval(() => {
      setBinanceSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Automated cancellation: payment window elapsed without receiving funds
          if (binanceOrder && binanceOrder.status === "pending") {
            const reason =
              "Order expired: 15-minute payment window elapsed without Binance deposit confirmation. Order auto-cancelled.";
            cancelBinanceOrder(binanceOrder.orderId, reason, tenantId, userEmail);
            setCancellationReason(reason);
            setProcessStage("cancelled");
            emitEngineActivity(
              "Binance Payment Automation",
              `Order ${binanceOrder.orderId} cancelled due to payment timeout.`,
              "warning",
            );
            emitEngineToast("Binance order expired and was auto-cancelled.", "warning");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paymentMethod, processStage, binanceOrder, tenantId, userEmail]);

  // Format countdown mm:ss
  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Official NPCI UPI payment intent URI
  const upiUri = `upi://pay?pa=${MERCHANT_PAYMENT_CONFIG.upi.id}&pn=${encodeURIComponent(
    MERCHANT_PAYMENT_CONFIG.upi.payeeName,
  )}&am=${inrPrice}&cu=INR&tn=${encodeURIComponent(
    `SparrowX ${upiOrder?.orderId || "Order"} - ${activeCredits} Credits`,
  )}`;

  // Binance Pay deep link / payload representation
  const binancePayPayload = `binance://pay?receiverId=${MERCHANT_PAYMENT_CONFIG.binance.binanceId}&amount=${activePriceUsd}&currency=USDT&orderId=${binanceOrder?.orderId || ""}`;

  const handleCopyUpiId = () => {
    void navigator.clipboard.writeText(MERCHANT_PAYMENT_CONFIG.upi.id);
    setUpiCopied(true);
    showToast(`Copied UPI ID: ${MERCHANT_PAYMENT_CONFIG.upi.id}`);
    setTimeout(() => setUpiCopied(false), 2500);
  };

  const handleCopyPaymentLink = () => {
    void navigator.clipboard.writeText(upiUri);
    setLinkCopied(true);
    showToast("Copied UPI Payment Link to clipboard");
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleCopyBinanceId = () => {
    void navigator.clipboard.writeText(MERCHANT_PAYMENT_CONFIG.binance.binanceId);
    setBinanceCopiedId(true);
    showToast(`Copied Binance ID: ${MERCHANT_PAYMENT_CONFIG.binance.binanceId}`);
    setTimeout(() => setBinanceCopiedId(false), 2500);
  };

  const handleCopyBinanceMemo = () => {
    if (!binanceOrder) return;
    void navigator.clipboard.writeText(binanceOrder.memo);
    setBinanceCopiedMemo(true);
    showToast(`Copied Order Memo: ${binanceOrder.memo}`);
    setTimeout(() => setBinanceCopiedMemo(false), 2500);
  };

  // Manual cancellation of Binance Order
  const handleCancelBinanceOrder = () => {
    if (!binanceOrder) return;
    const reason = "Order cancelled by user before Binance transfer.";
    cancelBinanceOrder(binanceOrder.orderId, reason, tenantId, userEmail);
    setCancellationReason(reason);
    setProcessStage("cancelled");
    showToast(`Binance Order ${binanceOrder.orderId} cancelled. No credits granted.`);
  };

  // Manual cancellation of UPI Order
  const handleCancelUpiOrder = () => {
    if (!upiOrder) return;
    const reason = "Order cancelled by user before UPI completion.";
    cancelUpiOrder(upiOrder.orderId, reason, tenantId, userEmail);
    setCancellationReason(reason);
    setProcessStage("cancelled");
    showToast(`UPI Order ${upiOrder.orderId} cancelled. No credits granted.`);
  };

  // Reset order to try again
  const handleRestartOrder = () => {
    const bOrder = createBinanceOrder({
      credits: activeCredits,
      amountUsdt: activePriceUsd,
      tenantId,
      userEmail,
      expiryMinutes: 15,
    });
    setBinanceOrder(bOrder);
    setBinanceSecondsLeft(15 * 60);

    const uOrder = createUpiOrder({
      credits: activeCredits,
      amountInr: inrPrice,
      amountUsd: activePriceUsd,
      tenantId,
      userEmail,
    });
    setUpiOrder(uOrder);
    setProcessStage("idle");
    setPaymentError(null);
    setCancellationReason("");
  };

  // Automated Receipt Verification & Onboarding Credit Grant Execution
  const handleExecutePayment = async () => {
    setPaymentError(null);

    if (paymentMethod === "upi") {
      if (upiUtr.trim().length > 0) {
        const utrCheck = validateUpiUtr(upiUtr);
        if (!utrCheck.valid) {
          const failReason = utrCheck.reason ?? "Invalid UPI UTR reference.";
          setPaymentError(failReason);
          showToast(failReason, "error");
          return;
        }
      }

      setProcessStage("verifying");
      emitEngineActivity(
        "UPI Bank Automation Engine",
        `Verifying NPCI UPI payment to ${MERCHANT_PAYMENT_CONFIG.upi.id} (Ref: ${upiUtr.trim() || upiOrder?.orderId || "Auto"})...`,
        "cooking",
      );

      // Automated receipt verification simulation across stages
      await new Promise((r) => setTimeout(r, 900));
      setProcessStage("charging");
      await new Promise((r) => setTimeout(r, 900));
      setProcessStage("minting");
      await new Promise((r) => setTimeout(r, 800));

      const result = await verifyUpiOrderAutomation(
        upiOrder?.orderId || `SPX-UPI-${Date.now()}`,
        upiUtr,
        tenantId,
        userEmail,
      );

      if (!result.verified || !result.transaction) {
        setPaymentError(result.error || "Failed to verify UPI transfer receipt.");
        setProcessStage("idle");
        showToast(result.error || "UPI verification failed", "error");
        return;
      }

      const newBalance = currentBalance + activeCredits;
      setCompletedTx(result.transaction);
      setProcessStage("success");
      onCreditsAdded(newBalance, activeCredits);

      emitEngineActivity(
        "SparrowX Cloud Ledger",
        `Granted +${activeCredits} credits on workspace onboarding (Bal: ${newBalance})`,
        "success",
      );
      emitEngineToast(
        `UPI payment verified! Granted +${activeCredits} credits to workspace`,
        "success",
        "Payment Succeeded",
      );
      showToast(`Successfully verified UPI receipt! Granted +${activeCredits} credits.`);
      return;
    }

    if (paymentMethod === "binance") {
      if (!binanceOrder) return;

      setProcessStage("verifying");
      emitEngineActivity(
        "Binance Pay Automation Engine",
        `Checking Binance Open Ledger for transfer matching Memo: ${binanceOrder.memo}...`,
        "cooking",
      );

      await new Promise((r) => setTimeout(r, 1000));
      setProcessStage("charging");
      await new Promise((r) => setTimeout(r, 1100));
      setProcessStage("minting");
      await new Promise((r) => setTimeout(r, 800));

      const result = await verifyBinanceOrderAutomation(
        binanceOrder.orderId,
        {
          userBinanceId: userBinanceIdOrTx,
          txId: userBinanceIdOrTx,
        },
        tenantId,
        userEmail,
      );

      if (!result.verified || !result.transaction) {
        setPaymentError(
          result.error ||
            "Binance automation check: Payment not yet detected. If you have not sent funds, please cancel the order.",
        );
        setProcessStage("idle");
        showToast(result.error || "Binance receipt check failed", "error");
        return;
      }

      const newBalance = currentBalance + activeCredits;
      setCompletedTx(result.transaction);
      setProcessStage("success");
      onCreditsAdded(newBalance, activeCredits);

      emitEngineActivity(
        "SparrowX Cloud Ledger",
        `Binance payment received! Minted +${activeCredits} credits (Bal: ${newBalance})`,
        "success",
      );
      emitEngineToast(
        `Binance transfer verified! Granted +${activeCredits} credits`,
        "success",
        "Binance Pay Succeeded",
      );
      showToast(`Binance payment verified! Granted +${activeCredits} credits.`);
    }
  };

  return (
    <div
      aria-label="Payment Gateway Modal"
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c0d12] p-5 sm:p-7 shadow-2xl my-6 text-foreground font-sans">
        {/* Subtle top ambient glow flare */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-primary/20 blur-[100px]" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-black/60 border border-white/10 p-1 text-primary shadow-sm">
                <img
                  src="/sparrowx-logo.png"
                  alt="SparrowX Logo"
                  className="size-full object-contain"
                />
              </span>
              <h2 className="text-lg font-bold tracking-tight">Direct Security Payment Gateway</h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400">
                Current: {currentBalance} Credits
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Automated reconciliation: choose <strong>UPI Instant Model</strong> or{" "}
              <strong>Binance Pay Model</strong>. Instant verification & onboarding credit grant.
            </p>
          </div>
          <Button
            aria-label="Close Payment Modal"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* If Insufficient Balance warning was passed */}
        {neededCredits && currentBalance < neededCredits && (
          <div className="mt-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 shrink-0 text-amber-400" />
              <span>
                Service requires <strong>{neededCredits} credits</strong> (you are short by{" "}
                <strong>{neededCredits - currentBalance} credits</strong>).
              </span>
            </div>
            <span className="rounded font-mono font-bold bg-amber-500/20 px-2 py-0.5 text-[10px]">
              Top-Up Required
            </span>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: ACTIVE ORDER FLOW (UPI OR BINANCE)               */}
        {/* ======================================================== */}
        {processStage !== "success" && processStage !== "cancelled" ? (
          <div className="mt-5 space-y-5">
            {/* STEP 1: SELECT CREDIT PACKAGE */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center justify-between">
                <span>1. Select Security Credits Plan</span>
                <span className="text-[10px] text-primary font-mono lowercase">
                  automated onboarding activation
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {CREDIT_PACKAGES.map((pack) => {
                  const isSelected = selectedPackId === pack.id;
                  const packInr =
                    pack.id === "starter" ? 1599 : pack.id === "builder" ? 6499 : 19999;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(240,90,40,0.15)] ring-1 ring-primary/40"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      {pack.popular && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-r from-primary to-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                          Recommended
                        </span>
                      )}
                      {pack.savings && !pack.popular && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          {pack.savings}
                        </span>
                      )}

                      <div className="text-xs font-medium text-muted-foreground">{pack.name}</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {pack.credits}
                        </span>
                        <span className="text-xs text-primary font-semibold">Credits</span>
                      </div>
                      <div className="mt-2 text-sm font-bold text-foreground/90">
                        {paymentMethod === "upi" ? (
                          <>
                            ₹{packInr.toLocaleString()} INR{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              (${pack.priceUsd})
                            </span>
                          </>
                        ) : (
                          <>
                            ${pack.priceUsd}.00 USDT{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              (Binance Pay)
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                        {pack.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Custom Credit Amount Slider toggle */}
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedPackId("custom")}
                  className={`text-[11px] font-medium transition-colors ${
                    selectedPackId === "custom"
                      ? "text-primary underline font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Need a custom amount? Click for custom credit slider
                </button>
                {selectedPackId === "custom" && (
                  <span className="font-mono text-primary text-xs font-bold">
                    {customCredits} Credits ={" "}
                    {paymentMethod === "upi"
                      ? `₹${(customCredits * 15).toLocaleString()} INR ($${Math.round(customCredits * 0.18)})`
                      : `$${Math.round(customCredits * 0.18)}.00 USDT`}
                  </span>
                )}
              </div>

              {selectedPackId === "custom" && (
                <div className="mt-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Slide to adjust credits:</span>
                    <span className="font-mono font-bold text-foreground">
                      {customCredits} Credits
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="5000"
                    step="50"
                    value={customCredits}
                    onChange={(e) => setCustomCredits(Number.parseInt(e.target.value, 10))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>50 credits</span>
                    <span>2,500 credits</span>
                    <span>5,000 credits</span>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: SELECT EXCLUSIVE PAYMENT MODEL (UPI OR BINANCE ONLY) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Select Direct Settlement Model (UPI or Binance Only)
                </span>
                <div className="inline-flex rounded-xl bg-black/50 p-1 border border-white/10">
                  {/* UPI Model Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("upi");
                      setPaymentError(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      paymentMethod === "upi"
                        ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm ring-1 ring-emerald-400/50"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>🇮🇳 UPI Model (Instant INR)</span>
                  </button>

                  {/* Binance Model Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("binance");
                      setPaymentError(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      paymentMethod === "binance"
                        ? "bg-[#F3BA2F] text-black shadow-sm ring-1 ring-[#F3BA2F]/70 font-bold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    <Coins className="size-3.5 text-amber-400" />
                    <span>🟡 Binance Pay Model (ID / USDT)</span>
                  </button>
                </div>
              </div>

              {/* ==================================================== */}
              {/* MODEL 1: UPI DIRECT MODEL                            */}
              {/* ==================================================== */}
              {paymentMethod === "upi" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-black/40 to-black/60 p-4 sm:p-5 shadow-inner space-y-4">
                  {/* Top amount & payee badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <span>Payable via NPCI Unified Payments Interface</span>
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-mono">
                          Order: {upiOrder?.orderId}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-display text-2xl font-black text-foreground">
                          ₹{inrPrice.toLocaleString()} INR
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          (~${activePriceUsd} USD)
                        </span>
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                          +{activeCredits} Credits on Onboarding
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 text-xs">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span className="text-muted-foreground text-[11px]">UPI VPA:</span>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {MERCHANT_PAYMENT_CONFIG.upi.id}
                      </span>
                    </div>
                  </div>

                  {/* QR Code and Quick Pay Section */}
                  <div className="grid gap-5 sm:grid-cols-[190px_1fr] items-center">
                    {/* Real Dynamic SVG QR Code */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative rounded-2xl bg-white p-3 shadow-2xl border-4 border-emerald-500/30">
                        <QRCodeSVG
                          value={upiUri}
                          size={160}
                          level="H"
                          bgColor="#FFFFFF"
                          fgColor="#0c0c0e"
                          includeMargin={false}
                        />
                        <div className="mt-2 text-center">
                          <span className="rounded bg-black/80 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                            Scan with Any UPI App
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-center text-[10px] text-muted-foreground font-mono">
                        Bank reconciliation automation active
                      </div>
                    </div>

                    {/* Instructions & Interactive Copy Tools */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-emerald-400" />
                          <span>Auto-Detected UPI Applications:</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          Google Pay, PhonePe, Paytm, BHIM, Cred, Amazon Pay, or any Mobile Banking
                          App.
                        </p>
                      </div>

                      {/* Direct UPI ID Pill with 1-Click Copy */}
                      <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">SparrowX Payee UPI ID:</span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            Verified Payee
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs font-bold text-emerald-300 truncate">
                            {MERCHANT_PAYMENT_CONFIG.upi.id}
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCopyUpiId}
                            className="h-7 px-2.5 text-[11px] font-medium border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 shrink-0"
                          >
                            {upiCopied ? (
                              <>
                                <Check className="size-3 mr-1 text-emerald-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3 mr-1" /> Copy UPI ID
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Mobile Intent & Link tools */}
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={upiUri}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
                        >
                          <ExternalLink className="size-3 text-emerald-400" />
                          <span>Open in Mobile UPI App</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyPaymentLink}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Copy className="size-3" />
                          <span>{linkCopied ? "Link Copied!" : "Copy Payment URI"}</span>
                        </button>
                      </div>

                      {/* UTR / Reference Number Field for Verification Automation */}
                      <div className="pt-1">
                        <label
                          htmlFor="upi-utr-input"
                          className="block text-[11px] font-medium text-muted-foreground mb-1"
                        >
                          12-Digit UPI Reference / UTR No (from SMS or receipt):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="upi-utr-input"
                            value={upiUtr}
                            onChange={(e) => setUpiUtr(e.target.value)}
                            placeholder="e.g. 429182901234 (Auto-reconciles bank feed)"
                            className="h-8.5 w-full rounded-lg border border-white/10 bg-black/50 px-2.5 font-mono text-xs text-foreground outline-none focus:border-emerald-500 placeholder:text-muted-foreground/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* MODEL 2: BINANCE PAY DIRECT MODEL                    */}
              {/* ==================================================== */}
              {paymentMethod === "binance" && binanceOrder && (
                <div className="rounded-2xl border border-[#F3BA2F]/40 bg-gradient-to-b from-[#F3BA2F]/[0.08] via-black/50 to-black/70 p-4 sm:p-5 shadow-inner space-y-4">
                  {/* Top order summary with countdown */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <span>Direct Binance Transfer / Binance Pay</span>
                        <span className="size-1.5 rounded-full bg-[#F3BA2F]" />
                        <span className="text-[10px] text-[#F3BA2F] font-mono">
                          Order: {binanceOrder.orderId}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-display text-2xl font-black text-foreground">
                          ${binanceOrder.amountUsdt}.00 USDT
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          (or equivalent FDUSD / BNB)
                        </span>
                        <span className="rounded-full bg-[#F3BA2F]/20 border border-[#F3BA2F]/40 px-2 py-0.5 text-[10px] font-bold text-[#F3BA2F] font-mono">
                          +{activeCredits} Credits
                        </span>
                      </div>
                    </div>

                    {/* Expiration Countdown Timer */}
                    <div className="flex items-center gap-2 rounded-xl border border-[#F3BA2F]/30 bg-black/70 px-3 py-1.5 text-xs shadow-sm">
                      <Clock className="size-3.5 text-[#F3BA2F] animate-pulse" />
                      <span className="text-muted-foreground text-[11px]">Auto-Cancel in:</span>
                      <span className="font-mono text-xs font-bold text-[#F3BA2F]">
                        {formatTimer(binanceSecondsLeft)}
                      </span>
                    </div>
                  </div>

                  {/* QR Code and Binance ID Details */}
                  <div className="grid gap-5 sm:grid-cols-[190px_1fr] items-center">
                    {/* Binance Pay QR */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative rounded-2xl bg-white p-3 shadow-2xl border-4 border-[#F3BA2F]/40">
                        <QRCodeSVG
                          value={binancePayPayload}
                          size={160}
                          level="H"
                          bgColor="#FFFFFF"
                          fgColor="#0c0c0e"
                          includeMargin={false}
                        />
                        <div className="mt-2 text-center">
                          <span className="rounded bg-black/90 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-[#F3BA2F] uppercase">
                            Binance App Pay QR
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-center text-[10px] text-muted-foreground font-mono">
                        Scan with Binance App camera
                      </div>
                    </div>

                    {/* Step-by-Step Instructions with Binance ID */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-[#F3BA2F]" />
                          <span>How to Pay via Binance ID / Pay ID:</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          Open Binance App &gt; <strong>Pay</strong> &gt; <strong>Send</strong> &gt;{" "}
                          paste our <strong>Binance ID</strong> below. Include the order memo so our
                          automation detects it immediately.
                        </p>
                      </div>

                      {/* Official Binance ID with Copy */}
                      <div className="rounded-xl border border-white/10 bg-black/50 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">SparrowX Official Binance ID:</span>
                          <span className="text-[10px] text-[#F3BA2F] font-mono">
                            Verified Merchant
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-sm font-black text-[#F3BA2F]">
                            {MERCHANT_PAYMENT_CONFIG.binance.binanceId}
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCopyBinanceId}
                            className="h-7 px-2.5 text-[11px] font-medium border-[#F3BA2F]/40 bg-[#F3BA2F]/10 hover:bg-[#F3BA2F]/20 text-[#F3BA2F] shrink-0"
                          >
                            {binanceCopiedId ? (
                              <>
                                <Check className="size-3 mr-1 text-[#F3BA2F]" /> Copied ID
                              </>
                            ) : (
                              <>
                                <Copy className="size-3 mr-1" /> Copy Binance ID
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Required Order Memo */}
                      <div className="rounded-xl border border-white/10 bg-black/40 p-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Required Transfer Memo / Note:</span>
                          <span className="text-[9px] text-amber-400 font-mono uppercase">
                            Required for match
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs font-bold text-white truncate">
                            {binanceOrder.memo}
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleCopyBinanceMemo}
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-white"
                          >
                            {binanceCopiedMemo ? "Copied!" : "Copy Memo"}
                          </Button>
                        </div>
                      </div>

                      {/* Optional User Binance ID / TxID */}
                      <div>
                        <label
                          htmlFor="binance-user-tx"
                          className="block text-[11px] font-medium text-muted-foreground mb-1"
                        >
                          Your Binance User ID / Internal TxID (optional for instant matching):
                        </label>
                        <input
                          id="binance-user-tx"
                          value={userBinanceIdOrTx}
                          onChange={(e) => setUserBinanceIdOrTx(e.target.value)}
                          placeholder="e.g. 981240182 or TxID (Auto-matches memo)"
                          className="h-8.5 w-full rounded-lg border border-white/10 bg-black/50 px-2.5 font-mono text-xs text-foreground outline-none focus:border-[#F3BA2F] placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PROCESSING STAGE ANIMATION */}
            {processStage !== "idle" && (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                  <RefreshCw className="size-4 animate-spin text-primary" />
                  <span>
                    {processStage === "verifying" &&
                      (paymentMethod === "upi"
                        ? `1/3 Connecting to NPCI bank automation for ${MERCHANT_PAYMENT_CONFIG.upi.id}...`
                        : `1/3 Scanning Binance account ledger for Order ${binanceOrder?.orderId}...`)}
                    {processStage === "charging" &&
                      (paymentMethod === "upi"
                        ? `2/3 Verifying ₹${inrPrice.toLocaleString()} INR settlement...`
                        : `2/3 Confirming $${activePriceUsd}.00 USDT deposit match...`)}
                    {processStage === "minting" &&
                      `3/3 Minting ${activeCredits} Security Credits to Workspace...`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-700 rounded-full"
                    style={{
                      width:
                        processStage === "verifying"
                          ? "35%"
                          : processStage === "charging"
                            ? "70%"
                            : "95%",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ERROR ALERT */}
            {paymentError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-red-400" />
                  <span>{paymentError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentError(null)}
                  className="shrink-0 rounded-lg border border-red-400/40 bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500/30"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* CHECKOUT ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <div className="text-xs text-muted-foreground">
                Total Due:{" "}
                <strong className="text-base text-foreground font-bold">
                  {paymentMethod === "upi"
                    ? `₹${inrPrice.toLocaleString()} INR`
                    : `$${activePriceUsd}.00 USDT`}
                </strong>{" "}
                for{" "}
                <strong className="text-primary font-bold">+{activeCredits} Credits</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Cancel Order Action */}
                <Button
                  onClick={
                    paymentMethod === "binance" ? handleCancelBinanceOrder : handleCancelUpiOrder
                  }
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={processStage !== "idle"}
                  className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 text-xs"
                >
                  <Ban className="size-3 mr-1" />
                  Cancel Order
                </Button>

                {/* Primary Execute / Verify Button */}
                <Button
                  onClick={handleExecutePayment}
                  disabled={processStage !== "idle"}
                  size="sm"
                  className={`w-full sm:w-auto px-5 font-semibold text-white shadow-lg ${
                    paymentMethod === "upi"
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20"
                      : "bg-[#F3BA2F] hover:bg-[#ffc83b] text-black shadow-amber-500/20 font-bold"
                  }`}
                >
                  <Lock className="size-3.5 mr-1" />
                  {paymentMethod === "upi"
                    ? `Verify UPI Receipt & Grant +${activeCredits} Credits`
                    : `Check Binance Payment & Grant +${activeCredits} Credits`}
                </Button>
              </div>
            </div>
          </div>
        ) : processStage === "cancelled" ? (
          /* ======================================================== */
          /* VIEW 2: ORDER CANCELLED VIEW                              */
          /* ======================================================== */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <Ban className="size-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">Order Cancelled</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {cancellationReason ||
                  "The payment was not received or the order was cancelled. No money was received and no credits were granted."}
              </p>
            </div>

            <div className="mx-auto max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Order Status:</span>
                <span className="font-mono font-bold text-red-400">CANCELLED &amp; VOIDED</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Credits Awarded:</span>
                <span className="font-mono font-bold text-foreground">0 Credits</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Active Balance:</span>
                <span className="font-mono font-bold text-primary">{currentBalance} Credits</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Button onClick={handleRestartOrder} size="sm" className="h-8 text-xs">
                <RefreshCw className="size-3 mr-1" /> Start New Order
              </Button>
              <Button onClick={onClose} size="sm" variant="ghost" className="h-8 text-xs">
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 3: SUCCESS & CREDITS GRANTED VIEW                    */
          /* ======================================================== */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">
                Payment Confirmed &amp; Credits Minted!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Automated reconciliation confirmed receipt of funds. Successfully granted{" "}
                <strong className="text-emerald-400 font-semibold">+{activeCredits} credits</strong>{" "}
                to your workspace.
              </p>
            </div>

            <div className="mx-auto max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New Total Balance:</span>
                <span className="font-mono text-base font-bold text-primary">
                  {currentBalance + activeCredits} Credits
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-[11px]">
                <span className="text-muted-foreground">Settlement Model:</span>
                <span className="font-mono font-medium text-foreground">
                  {paymentMethod === "upi"
                    ? `UPI Direct (${MERCHANT_PAYMENT_CONFIG.upi.id})`
                    : `Binance Pay (ID: ${MERCHANT_PAYMENT_CONFIG.binance.binanceId})`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {paymentMethod === "upi"
                    ? `₹${inrPrice.toLocaleString()} INR`
                    : `$${activePriceUsd}.00 USDT`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <ShieldCheck className="size-3.5" />
              <span>Audited &amp; Stored in SparrowX Sovereign Ledger</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {completedTx && (
                <>
                  <Button
                    onClick={() => downloadTransactionReceipt(completedTx)}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                  >
                    <Download className="size-3 mr-1" /> Receipt (.txt)
                  </Button>
                  <Button
                    onClick={() => downloadPrintableInvoiceHtml(completedTx, userEmail, tenantName)}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                  >
                    <Download className="size-3 mr-1" /> Tax Invoice (.html)
                  </Button>
                </>
              )}
              <Button onClick={onClose} size="sm" className="h-8 text-xs">
                Continue to Dashboard <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
