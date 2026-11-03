import { describe, expect, it, beforeEach } from "vitest";
import {
  CREDIT_PACKAGES,
  MERCHANT_PAYMENT_CONFIG,
  calculateServiceCost,
  getStoredCreditBalance,
  saveStoredCreditBalance,
  recordBillingTransaction,
  getStoredBillingTransactions,
  validateCardLuhn,
  validateCardExpiry,
  validateUpiUtr,
  generatePaymentVerificationSignature,
  refundBillingTransaction,
  createBinanceOrder,
  cancelBinanceOrder,
  verifyBinanceOrderAutomation,
  createUpiOrder,
  cancelUpiOrder,
  verifyUpiOrderAutomation,
} from "@/lib/billing-credits";

describe("Billing & Credits System (Exclusive UPI & Binance Models)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defines standard credit packages with proper pricing", () => {
    expect(CREDIT_PACKAGES.length).toBeGreaterThanOrEqual(3);
    const starter = CREDIT_PACKAGES.find((p) => p.id === "starter");
    const builder = CREDIT_PACKAGES.find((p) => p.id === "builder");
    const scale = CREDIT_PACKAGES.find((p) => p.id === "scale");

    expect(starter?.credits).toBe(100);
    expect(starter?.priceUsd).toBe(19);
    expect(builder?.credits).toBe(500);
    expect(scale?.credits).toBe(2000);
  });

  it("enforces dedicated UPI and Binance payment configurations only", () => {
    expect(MERCHANT_PAYMENT_CONFIG.upi.id).toBe("bm.atchuthakrishna@okhdfcbank");
    expect(MERCHANT_PAYMENT_CONFIG.upi.payeeName).toBe("SparrowX Security");
    expect(MERCHANT_PAYMENT_CONFIG.binance.binanceId).toBe("582910482");
    expect(MERCHANT_PAYMENT_CONFIG.binance.acceptedCurrency).toBe("USDT");
  });

  it("calculates service costs dynamically based on modules and plan tiers", () => {
    // Starter: 40 base + 15/module
    const starterCost = calculateServiceCost(["web_security"], "Starter");
    expect(starterCost).toBe(40 + 15);

    // Growth: 100 base + 15/module
    const growthCost = calculateServiceCost(["web_security", "ai_shield"], "Growth");
    expect(growthCost).toBe(100 + 30);

    // Enterprise: 300 base + 15/module
    const entCost = calculateServiceCost(
      ["web_security", "ai_shield", "cloud_security", "compliance"],
      "Enterprise",
    );
    expect(entCost).toBe(300 + 60);
  });

  it("stores and retrieves credit balance correctly without fake initial seed", () => {
    expect(getStoredCreditBalance()).toBe(0);
    saveStoredCreditBalance(250);
    expect(getStoredCreditBalance()).toBe(250);
  });

  it("records billing transactions and returns receipt metadata", () => {
    const tx = recordBillingTransaction({
      type: "topup",
      credits: 500,
      costUsd: 79,
      title: "Builder Pack Top-Up",
      description: "Direct UPI payment",
      paymentMethod: "UPI (bm.atchuthakrishna@okhdfcbank)",
    });

    expect(tx.id).toMatch(/^TXN-\d{4}-/);
    expect(tx.receiptNumber).toMatch(/^REC-\d{4}-/);
    expect(tx.credits).toBe(500);

    const txs = getStoredBillingTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0]?.id).toBe(tx.id);
    expect(txs[0]?.verificationSignature).toMatch(/^SPX-SIG-/);
  });

  it("creates Binance orders, verifies via automation, and grants credits", async () => {
    expect(getStoredCreditBalance("tenant-alpha")).toBe(0);

    const order = createBinanceOrder({
      credits: 500,
      amountUsdt: 79,
      tenantId: "tenant-alpha",
      userEmail: "ops@client.com",
      expiryMinutes: 15,
    });

    expect(order.orderId).toMatch(/^SPX-BN-\d{4}-/);
    expect(order.merchantBinanceId).toBe("582910482");
    expect(order.status).toBe("pending");
    expect(order.memo).toBe(order.orderId);

    // Automation verifies the Binance deposit receipt
    const result = await verifyBinanceOrderAutomation(
      order.orderId,
      { userBinanceId: "99182312", txId: "TX-BINANCE-12345" },
      "tenant-alpha",
      "ops@client.com",
    );

    expect(result.verified).toBe(true);
    expect(result.transaction?.credits).toBe(500);
    expect(result.transaction?.paymentMethod).toContain("Binance Pay");
    expect(getStoredCreditBalance("tenant-alpha")).toBe(500);
  });

  it("cancels Binance orders and prevents credit grant if payment is not received or cancelled", async () => {
    const initialBal = getStoredCreditBalance("tenant-beta");
    expect(initialBal).toBe(0);

    const order = createBinanceOrder({
      credits: 2000,
      amountUsdt: 249,
      tenantId: "tenant-beta",
      userEmail: "risk@client.com",
    });

    // Cancel order because no funds were received
    const cancelled = cancelBinanceOrder(
      order.orderId,
      "Order cancelled: No Binance deposit detected within payment window",
      "tenant-beta",
      "risk@client.com",
    );

    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.cancellationReason).toContain("No Binance deposit detected");

    // Attempting to verify a cancelled order fails and awards 0 credits
    const verifyAttempt = await verifyBinanceOrderAutomation(
      order.orderId,
      undefined,
      "tenant-beta",
      "risk@client.com",
    );

    expect(verifyAttempt.verified).toBe(false);
    expect(verifyAttempt.error).toContain("cancelled");
    expect(getStoredCreditBalance("tenant-beta")).toBe(0);
  });

  it("creates UPI orders, verifies via automated receipt check, and grants credits on onboarding", async () => {
    expect(getStoredCreditBalance("tenant-onboard")).toBe(0);

    const upiOrder = createUpiOrder({
      credits: 100,
      amountInr: 1599,
      amountUsd: 19,
      tenantId: "tenant-onboard",
      userEmail: "newuser@startup.io",
    });

    expect(upiOrder.orderId).toMatch(/^SPX-UPI-\d{4}-/);
    expect(upiOrder.payeeUpiId).toBe("bm.atchuthakrishna@okhdfcbank");
    expect(upiOrder.status).toBe("pending");

    // Automated bank feed / UTR verification check
    const verifyRes = await verifyUpiOrderAutomation(
      upiOrder.orderId,
      "429182901234",
      "tenant-onboard",
      "newuser@startup.io",
    );

    expect(verifyRes.verified).toBe(true);
    expect(verifyRes.transaction?.credits).toBe(100);
    expect(getStoredCreditBalance("tenant-onboard")).toBe(100);
  });

  it("cancels UPI order cleanly and audits the cancellation event", () => {
    const upiOrder = createUpiOrder({
      credits: 500,
      amountInr: 6499,
      amountUsd: 79,
    });

    const cancelled = cancelUpiOrder(upiOrder.orderId, "Customer aborted checkout");
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.cancellationReason).toBe("Customer aborted checkout");
  });

  it("validates card numbers with Luhn checksum, expiry dates, and UPI UTR references", () => {
    expect(validateCardLuhn("4242 4242 4242 4242")).toBe(true);
    expect(validateCardLuhn("4000 0000 0000 0002")).toBe(false);
    expect(validateCardLuhn("1234 5678 1234 5678")).toBe(false);

    expect(validateCardExpiry("12/29")).toBe(true);
    expect(validateCardExpiry("01/20")).toBe(false);

    expect(validateUpiUtr("431298765432").valid).toBe(true);
    expect(validateUpiUtr("").valid).toBe(false);

    const sig = generatePaymentVerificationSignature({
      credits: 500,
      costUsd: 79,
      method: "UPI",
    });
    expect(sig).toContain("500CR");
  });

  it("processes credit refunds and updates stored balance accurately", () => {
    saveStoredCreditBalance(500);
    const tx = recordBillingTransaction({
      type: "topup",
      credits: 500,
      costUsd: 79,
      title: "Builder Top-Up",
      description: "UPI payment",
      paymentMethod: "UPI",
    });

    const refundRes = refundBillingTransaction(tx.id, "Customer requested refund");
    expect(refundRes.refundedTx).not.toBeNull();
    expect(refundRes.newBalance).toBe(0);
    expect(getStoredCreditBalance()).toBe(0);
  });
});
