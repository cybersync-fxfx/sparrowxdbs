import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { provisionServerFromPaidOrder } = await import(
            "@/lib/server/proxmox.server"
          );
          const server = provisionServerFromPaidOrder({
            orderId: String(body.orderId || `SPX-${Date.now().toString(36).toUpperCase()}`),
            planId: String(body.planId || "vps-starter"),
            planName: String(body.planName || "VPS-Builder NVMe"),
            category: body.category || "vps",
            hostname: String(body.hostname || "node-01.sparrowx.net"),
            region: String(body.region || "Mumbai IN-1"),
            os: String(body.os || "Ubuntu 24.04 LTS (Hardened)"),
            monthlyPriceInr: Number(body.monthlyPriceInr || 849),
          });
          return Response.json({ ok: true, server }, { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Invalid provision payload";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
