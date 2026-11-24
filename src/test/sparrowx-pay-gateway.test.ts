import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildBinanceSignedQuery,
  clearPayLedgerForTests,
  createSparrowxPayOrder,
  getSparrowxPayOrder,
  ingestVerifiedUpiCredit,
  pollBinanceDepositForOrder,
  verifySubmittedUtr,
  verifyUpiBridgeHmac,
} from "@/lib/server/sparrowx-pay.server";

describe("Self-Hosted SparrowX Pay Gateway (UPI + Binance Spot USDT)", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.SPARROWX_DATA_DIR = "./data-test-pay";
    process.env.SPARROWX_UPI_ID = "sparrowx@okaxis";
    process.env.SPARROWX_UPI_BRIDGE_SECRET = "super_secret_bridge_hmac_key_2026";
    process.env.SPARROWX_BINANCE_API_KEY = "binance_readonly_key_test";
    process.env.SPARROWX_BINANCE_API_SECRET = "binance_readonly_secret_test";
    process.env.SPARROWX_BINANCE_USDT_TRC20 = "TTestSparrowxTrc20Address123456789";
    process.env.SPARROWX_BINANCE_USDT_BEP20 = "0xTestSparrowxBep20Address1234567890";
    clearPayLedgerForTests();
  });

  afterEach(() => {
    clearPayLedgerForTests();
    process.env = { ...prevEnv };
  });

  it("allocates unique paise amounts for UPI orders, verifies HMAC bridge credits, and blocks UTR replay", async () => {
    const orderA = createSparrowxPayOrder({
      method: "upi",
      service: "wallet",
      planId: "coins-999",
      planName: "999 SparrowX Coins",
      amountInr: 999,
      customerEmail: "buyer@sparrowx.net",
    });
    const orderB = createSparrowxPayOrder({
      method: "upi",
      service: "wallet",
      planId: "coins-999",
      planName: "999 SparrowX Coins",
      amountInr: 999,
      customerEmail: "buyer2@sparrowx.net",
    });

    expect(orderA.exactAmount).not.toBe(orderB.exactAmount);
    expect(orderA.upiUri).toContain("upi://pay?");

    // Forged signature must fail
    const rawPayload = JSON.stringify({ utr: "412345678901", amountInr: orderA.exactAmount });
    expect(verifyUpiBridgeHmac(rawPayload, "deadbeef")).toBe(false);

    // Valid HMAC-SHA256 signature must pass
    const validSig = crypto
      .createHmac("sha256", process.env.SPARROWX_UPI_BRIDGE_SECRET!)
      .update(rawPayload)
      .digest("hex");
    expect(verifyUpiBridgeHmac(rawPayload, validSig)).toBe(true);

    // Fake unverified UTR must NEVER confirm an order
    const fakeCheck = await verifySubmittedUtr(orderA.orderId, "999999999999");
    expect(fakeCheck.verified).toBe(false);

    // Real bank credit ingest auto-confirms orderA by exact unique paise
    const ingested = await ingestVerifiedUpiCredit({
      utr: "412345678901",
      amountInr: orderA.exactAmount,
    });
    expect(ingested.matched).toBe(true);
    expect(ingested.order?.status).toBe("PAID");
    expect(getSparrowxPayOrder(orderA.orderId)?.status).toBe("PAID");

    // Replaying the same UTR on orderB must be rejected
    await expect(
      ingestVerifiedUpiCredit({
        utr: "412345678901",
        amountInr: orderB.exactAmount,
      }),
    ).rejects.toThrow(/Duplicate UTR/i);
  });

  it("creates Binance USDT TRC20/BEP20 orders and auto-confirms via signed Binance Spot deposit API", async () => {
    const order = createSparrowxPayOrder({
      method: "binance_usdt_trc20",
      service: "infra",
      planId: "vps-ryzen-9950x-8gb",
      planName: "Ryzen 9 9950X — 8GB",
      amountInr: 1499,
      customerEmail: "client@sparrowx.net",
    });

    expect(order.currency).toBe("USDT");
    expect(order.network).toBe("TRC20");
    expect(order.depositAddress).toBe("TTestSparrowxTrc20Address123456789");

    const signed = buildBinanceSignedQuery({ coin: "USDT", timestamp: 1700000000000 }, "secret");
    expect(signed).toContain("&signature=");

    // Mock fetch returning Binance Spot deposit matching exactAmount
    const fakeBinanceFetch = (async () =>
      new Response(
        JSON.stringify([
          {
            amount: order.exactAmount,
            coin: "USDT",
            network: "TRX",
            status: 1,
            txId: "0xBINANCE_TX_HASH_987654321",
            insertTime: Date.now(),
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;

    const result = await pollBinanceDepositForOrder(order.orderId, fakeBinanceFetch);
    expect(result.verified).toBe(true);
    expect(result.order?.status).toBe("PAID");
    expect(result.order?.verifiedRef).toBe("0XBINANCE_TX_HASH_987654321");
  });
});
