import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
          const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
            "@/lib/server/db-auth.server"
          );
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`infra-provision:${ip}`, 10, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const isAdminKey = hasValidAdminKey(request);
          const claims = await readMasterSsoFromRequest(request);
          const isAdmin = isAdminKey || claims?.role === "admin";
          if (!isAdmin && !claims) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const body = await request.json();
          const orderId = String(body.orderId || "").trim().toUpperCase();

          // Non-admin callers MUST present a verified PAID payment order owned by their account
          if (!isAdmin) {
            if (!orderId) {
              return Response.json(
                { ok: false, error: "A verified paid orderId is required to provision a server." },
                { status: 402, headers: { "Cache-Control": "no-store" } },
              );
            }
            const { getSparrowxPayOrder } = await import("@/lib/server/sparrowx-pay.server");
            const { getUpiOrder } = await import("@/lib/server/upi-payments.server");
            const payOrder = getSparrowxPayOrder(orderId);
            const upiOrder = getUpiOrder(orderId);
            const verifiedOrder = payOrder?.status === "PAID" ? payOrder : upiOrder?.status === "PAID" ? upiOrder : null;
            if (!verifiedOrder) {
              return Response.json(
                { ok: false, error: "Payment verification required before provisioning." },
                { status: 402, headers: { "Cache-Control": "no-store" } },
              );
            }
            if (
              claims &&
              verifiedOrder.customerEmail.toLowerCase() !== claims.email.toLowerCase()
            ) {
              return Response.json(
                { ok: false, error: "Forbidden: order belongs to another account." },
                { status: 403, headers: { "Cache-Control": "no-store" } },
              );
            }
          }

          const { provisionServerFromPaidOrder } = await import(
            "@/lib/server/proxmox.server"
          );
          const server = provisionServerFromPaidOrder({
            orderId: orderId || `SPX-${Date.now().toString(36).toUpperCase()}`,
            planId: String(body.planId || "vps-starter"),
            planName: String(body.planName || "VPS-Builder NVMe"),
            category: body.category || "vps",
            hostname: String(body.hostname || "node-01.sparrowx.net"),
            region: String(body.region || "Mumbai IN-1"),
            os: String(body.os || "Ubuntu 24.04 LTS (Hardened)"),
            monthlyPriceInr: Number(body.monthlyPriceInr || 849),
          });
          void import("@/lib/server/discord-webhook.server")
            .then(({ sendDiscordTelemetry }) =>
              sendDiscordTelemetry({
                category: "deploy",
                severity: "info",
                service: "SparrowX Cloud Infra",
                title: `Cloud Server Provisioned — ${server.name}`,
                ip,
                fields: {
                  "Server ID": server.id,
                  Plan: server.planName,
                  Category: server.category,
                  Hostname: server.hostname,
                  Region: server.region,
                  OS: server.os,
                  IPv4: server.ipv4,
                  "Monthly INR": `₹${server.monthlyPriceInr}`,
                },
              }),
            )
            .catch(() => {});
          return Response.json(
            { ok: true, server },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Invalid provision payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
