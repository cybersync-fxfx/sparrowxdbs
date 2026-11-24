import { createFileRoute } from "@tanstack/react-router";

/**
 * Strict server-side verification endpoint:
 * - For UPI: checks submitted 12-digit UTR against REAL bank credit receipts ingested by your OVH bridge.
 * - For Binance USDT: triggers an immediate live Binance Spot Read-Only API deposit check.
 */
export const Route = createFileRoute("/api/pay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const orderId = typeof body.orderId === "string" ? body.orderId : "";
          const utr = typeof body.utr === "string" ? body.utr : "";
          if (!orderId) {
            return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });
          }

          const mod = await import("@/lib/server/sparrowx-pay.server");
          const existing = mod.getSparrowxPayOrder(orderId);
          if (!existing) {
            return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
          }

          if (existing.currency === "USDT") {
            const check = await mod.pollBinanceDepositForOrder(orderId);
            return Response.json({ ok: check.verified, ...check });
          }

          const check = await mod.verifySubmittedUtr(orderId, utr);
          return Response.json({ ok: check.verified, ...check });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Verification failed";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
