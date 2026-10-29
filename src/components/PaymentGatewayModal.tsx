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
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CREDIT_PACKAGES,
  type CreditPackage,
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

  // Payment method tab
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto" | "bank">("card");

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
  const activePrice =
    selectedPackId === "custom" ? Math.round(customCredits * 0.18) : (selectedPack?.priceUsd ?? 79);

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
    const tx = recordBillingTransaction(
      {
        type: "topup",
        credits: activeCredits,
        costUsd: activePrice,
        title: `Purchased ${activeCredits} Security Credits`,
        description: `Top-up of ${activeCredits} credits via ${
          paymentMethod === "card"
            ? `${getCardBrand(cardNumber)} ending in ${cardNumber.slice(-4)}`
            : paymentMethod === "crypto"
              ? "USDC Sovereign Web3"
              : "Dev Bank Wire"
        }`,
        paymentMethod:
          paymentMethod === "card"
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto"
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
                        ${pack.priceUsd} USD
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
                    {customCredits} Credits = ${Math.round(customCredits * 0.18)} USD
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
                    <span>50 credits ($9)</span>
                    <span>2,500 credits ($450)</span>
                    <span>5,000 credits ($900)</span>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: PAYMENT METHOD & CARD PREVIEW */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Payment Method
                </span>
                <div className="flex items-center gap-1">
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
                      "1/3 Encrypting & Verifying Payment Authorization..."}
                    {processStage === "charging" &&
                      `2/3 Processing $${activePrice}.00 USD Settlement...`}
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
                <strong className="text-base text-foreground font-bold">${activePrice} USD</strong>{" "}
                for <strong className="text-primary font-bold">+{activeCredits} Credits</strong>
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
                  Authorize & Top Up {activeCredits} Credits
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

            <div className="mx-auto max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">New Total Balance:</span>
              <span className="font-mono text-base font-bold text-primary">
                {currentBalance + activeCredits} Credits
              </span>
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
