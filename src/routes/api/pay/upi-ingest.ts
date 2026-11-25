import { createFileRoute } from "@tanstack/react-router";

/**
 * Self-hosted UPI Bank Alert / Android SMS Forwarder ingest webhook.
 * Requires valid HMAC-SHA256 signature in `X-SparrowX-Signature` signed with SPARROWX_UPI_BRIDGE_SECRET.
 */
export const Route = createFileRoute("/api/pay/upi-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`pay-upi-ingest:${ip}`, 60, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const rawBody = await request.text();
          const signature = request.headers.get("x-sparrowx-signature") || "";
          const mod = await import("@/lib/server/sparrowx-pay.server");

          if (!mod.verifyUpiBridgeHmac(rawBody, signature)) {
            return Response.json(
              { ok: false, error: "Invalid or missing X-SparrowX-Signature HMAC." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const body = JSON.parse(rawBody) as Record<string, unknown>;
          const result = await mod.ingestVerifiedUpiCredit({
            utr: String(body.utr || ""),
            amountInr: (body.amountInr ?? body.amount ?? 0) as number | string,
            ...(typeof body.orderId === "string" ? { orderId: body.orderId } : {}),
            ...(typeof body.senderText === "string" ? { senderText: body.senderText } : {}),
          });

          return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { ok: false, error: "Failed to ingest UPI credit" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
