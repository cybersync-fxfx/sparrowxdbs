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
          const rawBody = await request.text();
          const signature = request.headers.get("x-sparrowx-signature") || "";
          const mod = await import("@/lib/server/sparrowx-pay.server");

          if (!mod.verifyUpiBridgeHmac(rawBody, signature)) {
            return Response.json(
              { ok: false, error: "Invalid or missing X-SparrowX-Signature HMAC." },
              { status: 401 },
            );
          }

          const body = JSON.parse(rawBody) as Record<string, unknown>;
          const result = await mod.ingestVerifiedUpiCredit({
            utr: String(body.utr || ""),
            amountInr: (body.amountInr ?? body.amount ?? 0) as number | string,
            orderId: typeof body.orderId === "string" ? body.orderId : undefined,
            senderText: typeof body.senderText === "string" ? body.senderText : undefined,
          });

          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to ingest UPI credit";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
