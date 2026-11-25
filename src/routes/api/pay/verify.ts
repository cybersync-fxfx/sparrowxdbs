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
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`pay-verify:${ip}`, 12, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

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
            return Response.json(
              { ok: check.verified, ...check },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          const check = await mod.verifySubmittedUtr(orderId, utr);
          return Response.json(
            { ok: check.verified, ...check },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Verification failed" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
