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

          const { isInfraOrderProvisioned, provisionServerFromPaidOrder } = await import(
            "@/lib/server/proxmox.server"
          );

          let boundPlanId = String(body.planId || "vps-starter");
          let boundPlanName = String(body.planName || "VPS-Builder NVMe");
          let boundPriceInr = Number(body.monthlyPriceInr || 849);
          let boundOwnerEmail = claims?.email?.trim().toLowerCase();

          // Non-admin callers MUST present a verified, unredeemed PAID infra payment order owned by their account
          if (!isAdmin) {
            if (!orderId) {
              return Response.json(
                { ok: false, error: "A verified paid orderId is required to provision a server." },
                { status: 402, headers: { "Cache-Control": "no-store" } },
              );
            }
            if (isInfraOrderProvisioned(orderId)) {
              return Response.json(
                { ok: false, error: "Order has already been provisioned." },
                { status: 409, headers: { "Cache-Control": "no-store" } },
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
            if (verifiedOrder.service !== "infra") {
              return Response.json(
                { ok: false, error: "Order is not valid for infrastructure provisioning." },
                { status: 403, headers: { "Cache-Control": "no-store" } },
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
            // Bind server specs strictly to the verified PAID order (prevent price/plan tampering)
            boundPlanId = verifiedOrder.planId;
            boundPlanName = verifiedOrder.planName;
            boundPriceInr = verifiedOrder.amountInr;
            boundOwnerEmail = verifiedOrder.customerEmail.toLowerCase();
          }

          const server = provisionServerFromPaidOrder({
            orderId: orderId || `SPX-${Date.now().toString(36).toUpperCase()}`,
            ownerEmail: boundOwnerEmail,
            planId: boundPlanId,
            planName: boundPlanName,
            category: body.category || "vps",
            hostname: String(body.hostname || "node-01.sparrowx.net"),
            region: String(body.region || "Mumbai IN-1"),
            os: String(body.os || "Ubuntu 24.04 LTS (Hardened)"),
            monthlyPriceInr: boundPriceInr,
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
