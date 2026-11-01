import { describe, expect, it, beforeEach } from "vitest";
import {
  CREDIT_PACKAGES,
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
} from "@/lib/billing-credits";

describe("Billing & Credits System", () => {
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
