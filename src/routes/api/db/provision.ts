import { createFileRoute } from "@tanstack/react-router";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/api/db/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          authorizeDbRequest,
          checkDbRateLimit,
          extractClientIp,
        } = await import("@/lib/server/db-auth.server");
        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`provision:${ip}`, 12, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: {
          tenantId?: string;
          userId?: string;
          email?: string;
          projectName?: string;
          planId?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        const email = String(body.email || "").trim().toLowerCase();
        const tenantId = String(body.tenantId || "").trim();
        const userId = String(body.userId || "").trim();
        const projectName = body.projectName ? String(body.projectName).trim() : undefined;
        const planId = body.planId ? String(body.planId).trim() : undefined;

        if (!EMAIL_RE.test(email) || !tenantId || !userId) {
          return Response.json(
            { ok: false, error: "tenantId, userId, and valid email are required" },
            { status: 400 },
          );
        }

        const auth = await authorizeDbRequest(request, {
          targetTenantId: tenantId,
          targetEmail: email,
        });
        if (!auth.authorized) {
          return Response.json(
            { ok: false, error: auth.reason || "Unauthorized" },
            { status: 401 },
          );
        }

        try {
          const { DbProvisionerError, provisionSeparateUserDatabase } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const database = await provisionSeparateUserDatabase({
            tenantId,
            userId,
            email,
            projectName,
            planId,
            isAdminOverride: auth.isAdmin,
            actorIp: ip,
          });
          return Response.json({ ok: true, database });
        } catch (err) {
          const status =
            err instanceof Error && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 503;
          const message = err instanceof Error ? err.message : "Database provisioning failed";
          return Response.json(
            { ok: false, error: message },
            { status },
          );
        }
      },
    },
  },
});
