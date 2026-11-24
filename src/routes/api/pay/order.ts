import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pay/order")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const mod = await import("@/lib/server/sparrowx-pay.server");

          if (url.searchParams.get("config") === "1") {
            return Response.json({ ok: true, config: mod.getSparrowxPayPublicConfig() });
          }

          const orderId = url.searchParams.get("orderId") || "";
          if (!orderId) {
            return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });
          }

          let order = mod.getSparrowxPayOrder(orderId);
          if (!order) {
            return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
          }

          // Automatically check Binance Spot Read-Only API while order is PENDING
          if (order.status === "PENDING" && order.currency === "USDT") {
            const check = await mod.pollBinanceDepositForOrder(order.orderId);
            if (check.order) order = check.order;
          }

          return Response.json({ ok: true, order });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to fetch payment order";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const mod = await import("@/lib/server/sparrowx-pay.server");

          const method =
            body.method === "binance_usdt_trc20" || body.method === "binance_usdt_bep20"
              ? body.method
              : "upi";

          const order = mod.createSparrowxPayOrder({
            method,
            service: (typeof body.service === "string" ? body.service : "wallet") as any,
            planId: typeof body.planId === "string" ? body.planId : "coins-topup",
            planName: typeof body.planName === "string" ? body.planName : "SparrowX Coins",
            amountInr: Number(body.amountInr) || 0,
            customerEmail: typeof body.customerEmail === "string" ? body.customerEmail : "",
            metadata: typeof body.metadata === "object" && body.metadata ? (body.metadata as any) : undefined,
          });

          return Response.json(
            { ok: true, order, config: mod.getSparrowxPayPublicConfig() },
            { status: 201 },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create payment order";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
