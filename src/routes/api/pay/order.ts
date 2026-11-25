import { createFileRoute } from "@tanstack/react-router";

function maskOrderForCaller<T extends { customerEmail: string }>(
  order: T,
  callerEmail?: string,
  isAdmin = false,
): T {
  if (isAdmin) return order;
  if (callerEmail && order.customerEmail.toLowerCase() === callerEmail.toLowerCase()) {
    return order;
  }
  const [local, domain] = order.customerEmail.split("@");
  const masked =
    local && domain
      ? `${local.slice(0, 2)}***@${domain}`
      : "***";
  return { ...order, customerEmail: masked };
}

export const Route = createFileRoute("/api/pay/order")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
            "@/lib/server/db-auth.server"
          );
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`pay-order-get:${ip}`, 40, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const url = new URL(request.url);
          const mod = await import("@/lib/server/sparrowx-pay.server");

          if (url.searchParams.get("config") === "1") {
            return Response.json(
              { ok: true, config: mod.getSparrowxPayPublicConfig() },
              { headers: { "Cache-Control": "no-store" } },
            );
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

          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
          const claims = await readMasterSsoFromRequest(request);
          const isAdmin = hasValidAdminKey(request) || claims?.role === "admin";
          return Response.json(
            { ok: true, order: maskOrderForCaller(order, claims?.email, isAdmin) },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Failed to fetch payment order" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`pay-order-post:${ip}`, 15, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const mod = await import("@/lib/server/sparrowx-pay.server");
          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
          const claims = await readMasterSsoFromRequest(request);

          const method =
            body.method === "binance_usdt_trc20" || body.method === "binance_usdt_bep20"
              ? body.method
              : "upi";
          const amountInr = Number(body.amountInr) || 0;
          if (!Number.isFinite(amountInr) || amountInr < 1 || amountInr > 500_000) {
            return Response.json(
              { ok: false, error: "Payment amount must be between ₹1 and ₹500,000." },
              { status: 400 },
            );
          }

          const order = mod.createSparrowxPayOrder({
            method,
            service: (typeof body.service === "string" ? body.service : "wallet") as any,
            planId: typeof body.planId === "string" ? body.planId : "coins-topup",
            planName: typeof body.planName === "string" ? body.planName : "SparrowX Coins",
            amountInr,
            customerEmail:
              claims?.email || (typeof body.customerEmail === "string" ? body.customerEmail : ""),
            metadata: typeof body.metadata === "object" && body.metadata ? (body.metadata as any) : undefined,
          });

          return Response.json(
            { ok: true, order, config: mod.getSparrowxPayPublicConfig() },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create payment order";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
