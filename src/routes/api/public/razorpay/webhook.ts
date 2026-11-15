import { createFileRoute } from "@tanstack/react-router";

// Razorpay -> Settings -> Webhooks: point "payment.captured" here, secret = RAZORPAY_WEBHOOK_SECRET.
export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyWebhook } = await import("@/lib/server/razorpay.server");
        if (!(await verifyWebhook(raw, request.headers.get("x-razorpay-signature")))) {
          return new Response("invalid signature", { status: 401 });
        }
        let evt: { event?: string; payload?: { payment?: { entity?: { id?: string; amount?: number; status?: string; notes?: { client_id?: string } } } } };
        try {
          evt = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const p = evt.payload?.payment?.entity;
        if (evt.event !== "payment.captured" || !p?.id || !p.amount || !p.notes?.client_id) {
          return Response.json({ ignored: true });
        }
        const clientId = p.notes.client_id;
        if (!/^[0-9a-f-]{36}$/i.test(clientId)) return new Response("bad client", { status: 400 });
        const { creditTopup } = await import("@/lib/server/portal.server");
        const r = await creditTopup(clientId, Math.floor(p.amount / 100), p.id);
        return Response.json({ ok: true, applied: r.applied });
      },
    },
  },
});
