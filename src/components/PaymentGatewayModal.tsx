import React, { useState } from "react";
import {
  X,
  CreditCard,
  Zap,
  Check,
  ShieldCheck,
  ArrowRight,
  Download,
  Lock,
  Sparkles,
  QrCode,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Coins,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  CREDIT_PACKAGES,
  type BillingTransaction,
  recordBillingTransaction,
  downloadTransactionReceipt,
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

const TARGET_UPI_ID = "bm.atchuthakrishna@okhdfcbank";
const TARGET_PAYEE_NAME = "SparrowX Security";

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

  // Payment method tab - Default to UPI as requested
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "crypto" | "bank">("upi");

  // UPI fields
  const [upiUtr, setUpiUtr] = useState("");
  const [upiCopied, setUpiCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardHolder, setCardHolder] = useState("ALEX RIVERA");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("888");

  // Processing state
  const [processStage, setProcessStage] = useState<
    "idle" | "verifying" | "charging" | "minting" | "success"
  >("idle");
  const [completedTx, setCompletedTx] = useState<BillingTransaction | null>(null);

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

  // Official NPCI UPI payment intent URI
  const upiUri = `upi://pay?pa=${TARGET_UPI_ID}&pn=${encodeURIComponent(
    TARGET_PAYEE_NAME,
  )}&am=${inrPrice}&cu=INR&tn=${encodeURIComponent(
    `SparrowX Security - ${activeCredits} Credits Topup`,
  )}`;

  // Detect card brand
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\s+/g, "");
    if (clean.startsWith("4")) return "VISA";
    if (clean.startsWith("5") || clean.startsWith("2")) return "MASTERCARD";
    if (clean.startsWith("34") || clean.startsWith("37")) return "AMEX";
    return "DEBIT";
  };

  const handleFillTestCard = () => {
    setCardNumber("4242 4242 4242 4242");
    setCardHolder(tenantName ? tenantName.toUpperCase() : "SPARROWX FOUNDER");
    setCardExpiry("08/29");
    setCardCvv("737");
    showToast("Filled verified sandbox test card credentials");
  };

  const handleCopyUpiId = () => {
    void navigator.clipboard.writeText(TARGET_UPI_ID);
    setUpiCopied(true);
    showToast(`Copied UPI ID: ${TARGET_UPI_ID}`);
    setTimeout(() => setUpiCopied(false), 2500);
  };

  const handleCopyPaymentLink = () => {
    void navigator.clipboard.writeText(upiUri);
    setLinkCopied(true);
    showToast("Copied UPI Payment Link to clipboard");
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleExecutePayment = async () => {
    setProcessStage("verifying");

    // Stage 1: Verification
    await new Promise((r) => setTimeout(r, 900));
    setProcessStage("charging");

    // Stage 2: Charging
    await new Promise((r) => setTimeout(r, 1100));
    setProcessStage("minting");

    // Stage 3: Minting credits
    await new Promise((r) => setTimeout(r, 1000));

    // Complete transaction
    const newBalance = currentBalance + activeCredits;
    const utrRef = upiUtr.trim() || `UPI-TXN-${Date.now().toString().slice(-6)}`;

    const tx = recordBillingTransaction(
      {
        type: "topup",
        credits: activeCredits,
        costUsd: activePriceUsd,
        title: `Purchased ${activeCredits} Security Credits${paymentMethod === "upi" ? " (UPI Pay)" : ""}`,
        description: `Top-up of ${activeCredits} credits via ${
          paymentMethod === "upi"
            ? `UPI to ${TARGET_UPI_ID} (Ref/UTR: ${utrRef})`
            : paymentMethod === "card"
              ? `${getCardBrand(cardNumber)} ending in ${cardNumber.slice(-4)}`
              : paymentMethod === "crypto"
                ? "USDC Sovereign Web3"
                : "Dev Bank Wire"
        }`,
        paymentMethod:
          paymentMethod === "upi"
            ? `UPI QR (${TARGET_UPI_ID})`
            : paymentMethod === "card"
              ? `${getCardBrand(cardNumber)} •••• ${cardNumber.slice(-4)}`
              : paymentMethod === "crypto"
                ? "USDC on Base (Sovereign Pay)"
                : "Direct ACH Wire",
      },
      tenantId,
      userEmail,
    );

    setCompletedTx(tx);
    setProcessStage("success");
    onCreditsAdded(newBalance, activeCredits);
    showToast(`Successfully added ${activeCredits} credits! New balance: ${newBalance} credits`);
  };

  return (
    <div
      aria-label="Payment Gateway Modal"
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f13] p-5 sm:p-7 shadow-2xl my-6 text-foreground font-sans">
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
              <h2 className="text-lg font-bold tracking-tight">Security Credits Gateway</h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400">
                Current: {currentBalance} Credits
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Top up security credits to provision web firewalls, AI tool shields, and run automated
              guardrails.
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

        {/* STEP 1: SELECT CREDIT PACKAGE */}
        {processStage !== "success" ? (
          <div className="mt-5 space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                1. Select Credit Package
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
                          Most Popular
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
                        ₹{packInr.toLocaleString()} INR{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          (${pack.priceUsd})
                        </span>
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
                    {customCredits} Credits = ₹{(customCredits * 15).toLocaleString()} INR ($
                    {Math.round(customCredits * 0.18)})
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
                    <span>50 credits (₹750)</span>
                    <span>2,500 credits (₹37,500)</span>
                    <span>5,000 credits (₹75,000)</span>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: PAYMENT METHOD & INTERACTIVE GATEWAY */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Payment Method
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upi")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      paymentMethod === "upi"
                        ? "bg-primary text-white shadow-sm ring-1 ring-primary/50"
                        : "text-muted-foreground hover:text-white bg-white/[0.03]"
                    }`}
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>UPI Instant QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      paymentMethod === "card"
                        ? "bg-white/10 text-white font-semibold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Credit / Debit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("crypto")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      paymentMethod === "crypto"
                        ? "bg-white/10 text-white font-semibold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    USDC Crypto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("bank")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      paymentMethod === "bank"
                        ? "bg-white/10 text-white font-semibold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Dev Bank ACH
                  </button>
                </div>
              </div>

              {/* UPI QR PAYMENT TAB */}
              {paymentMethod === "upi" && (
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/[0.08] via-black/40 to-black/60 p-4 sm:p-5 shadow-inner space-y-4">
                  {/* Top amount & payee badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Payable via NPCI Unified Payments Interface:
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-display text-2xl font-black text-foreground">
                          ₹{inrPrice.toLocaleString()} INR
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          (~${activePriceUsd} USD)
                        </span>
                        <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary font-mono">
                          +{activeCredits} Credits
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 text-xs">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span className="text-muted-foreground text-[11px]">Payee:</span>
                      <span className="font-mono text-xs font-bold text-primary">
                        {TARGET_UPI_ID}
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
                        Instant auto-detection
                      </div>
                    </div>

                    {/* Instructions & Interactive Copy Tools */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" /> Supported UPI Apps:
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          Google Pay, PhonePe, Paytm, BHIM, Cred, Amazon Pay, or any Mobile Banking
                          App.
                        </p>
                      </div>

                      {/* Direct UPI ID Pill with 1-Click Copy */}
                      <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Target VPA / UPI ID:</span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            Verified Merchant
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs font-bold text-primary truncate">
                            {TARGET_UPI_ID}
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCopyUpiId}
                            className="h-7 px-2.5 text-[11px] font-medium border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary shrink-0"
                          >
                            {upiCopied ? (
                              <>
                                <Check className="size-3 mr-1 text-emerald-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3 mr-1" /> Copy ID
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Mobile Intent & Link tools */}
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={upiUri}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white/[0.09] transition-all"
                        >
                          <ExternalLink className="size-3 text-primary" />
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

                      {/* UTR / Reference Number Field */}
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
                            placeholder="e.g. 429182901234 (Optional / Instant Verification)"
                            className="h-8.5 w-full rounded-lg border border-white/10 bg-black/50 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD PAYMENT TAB */}
              {paymentMethod === "card" && (
                <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr] items-center">
                  {/* Animated Credit Card Hologram */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-[#1b1a22] via-[#2a2638] to-[#1a1724] p-4 text-white shadow-xl border border-white/15">
                    {/* Atmospheric card glow */}
                    <div className="absolute top-0 right-0 size-32 rounded-full bg-primary/25 blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-widest text-primary">
                        SPARROW<span className="text-white">X</span> PAY
                      </div>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider">
                        {getCardBrand(cardNumber)}
                      </span>
                    </div>

                    {/* Chip & Contactless */}
                    <div className="my-3 flex items-center gap-3">
                      <div className="size-7 rounded bg-amber-400/80 border border-amber-300 shadow-inner flex flex-col justify-around p-0.5">
                        <div className="h-0.5 bg-amber-900/40 rounded" />
                        <div className="h-0.5 bg-amber-900/40 rounded" />
                      </div>
                      <span className="text-muted-foreground text-xs font-mono">)))</span>
                    </div>

                    {/* Card Number */}
                    <div className="font-mono text-base tracking-[0.2em] font-semibold text-white/95">
                      {cardNumber || "•••• •••• •••• ••••"}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                          Cardholder
                        </div>
                        <div className="text-white/90 truncate max-w-[130px]">
                          {cardHolder || "DEVELOPER"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                          Expires
                        </div>
                        <div className="text-white/90">{cardExpiry || "MM/YY"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Card Input Fields */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Card Number
                      </label>
                      <button
                        type="button"
                        onClick={handleFillTestCard}
                        className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="size-2.5" /> Fill Test Card
                      </button>
                    </div>
                    <input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="h-8.5 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                          Expires
                        </label>
                        <input
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="h-8.5 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                          CVC / CVV
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="•••"
                          className="h-8.5 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CRYPTO PAYMENT TAB */}
              {paymentMethod === "crypto" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="size-24 rounded-lg bg-white p-2 shrink-0 grid place-items-center">
                    <QrCode className="size-20 text-black" />
                  </div>
                  <div className="space-y-1.5 text-xs text-left min-w-0">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-400" /> Pay with USDC on Base /
                      Arbitrum
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Zero slippage, sub-cent transaction fees. Credits are minted instantly upon 1
                      blockchain confirmation.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-primary truncate max-w-[200px]">
                        0x71C94827F38a6a2491A24B09938...
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                        onClick={() => showToast("Copied USDC payment address to clipboard")}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* BANK PAYMENT TAB */}
              {paymentMethod === "bank" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3 text-xs">
                  <Building2 className="size-6 text-primary shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">
                      Instant Direct Bank Debit (ACH / SEPA)
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Connected to Stripe Financial Connections. Funds settle immediately and credit
                      balance updates in real-time.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* PROCESSING STAGE ANIMATION */}
            {processStage !== "idle" && (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="size-4 animate-spin" />
                  <span>
                    {processStage === "verifying" &&
                      (paymentMethod === "upi"
                        ? `1/3 Verifying UPI payment to ${TARGET_UPI_ID}...`
                        : "1/3 Encrypting & Verifying Payment Authorization...")}
                    {processStage === "charging" &&
                      (paymentMethod === "upi"
                        ? `2/3 Confirming ₹${inrPrice.toLocaleString()} INR via NPCI UPI network...`
                        : `2/3 Processing $${activePriceUsd}.00 USD Settlement...`)}
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

            {/* CHECKOUT ACTION BUTTON */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <div className="text-xs text-muted-foreground">
                Total Due:{" "}
                <strong className="text-base text-foreground font-bold">
                  ₹{inrPrice.toLocaleString()} INR
                </strong>{" "}
                <span className="text-xs text-muted-foreground">(${activePriceUsd} USD)</span> for{" "}
                <strong className="text-primary font-bold">+{activeCredits} Credits</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={onClose}
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={processStage !== "idle"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecutePayment}
                  disabled={processStage !== "idle"}
                  size="sm"
                  className="w-full sm:w-auto px-5 bg-gradient-to-r from-primary to-orange-500 font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40"
                >
                  <Lock className="size-3.5 mr-1" />
                  {paymentMethod === "upi"
                    ? `Confirm UPI Payment & Add +${activeCredits} Credits`
                    : `Authorize & Top Up ${activeCredits} Credits`}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* SUCCESS STAGE */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">
                Payment Confirmed & Credits Minted!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Successfully added{" "}
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
                <span className="text-muted-foreground">Settlement Method:</span>
                <span className="font-mono font-medium text-foreground">
                  {paymentMethod === "upi" ? `UPI (${TARGET_UPI_ID})` : "Card / Web3"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ₹{inrPrice.toLocaleString()} INR (${activePriceUsd} USD)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <ShieldCheck className="size-3.5" />
              <span>Audited & Stored in Supabase PostgreSQL Cloud Ledger</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {completedTx && (
                <Button
                  onClick={() => downloadTransactionReceipt(completedTx)}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                >
                  <Download className="size-3 mr-1" /> Download Receipt ({completedTx.receiptNumber}
                  )
                </Button>
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
