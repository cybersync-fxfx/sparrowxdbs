import { createFileRoute } from "@tanstack/react-router";

type LifecycleAction =
  | "rotate_password"
  | "backup"
  | "list_backups"
  | "upgrade_plan"
  | "suspend"
  | "resume"
  | "deprovision"
  | "list_audit";

export const Route = createFileRoute("/api/db/lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          authorizeDbRequest,
          checkDbRateLimit,
          extractClientIp,
        } = await import("@/lib/server/db-auth.server");
        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`lifecycle:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: {
          action?: LifecycleAction;
          dbName?: string;
          email?: string;
          planId?: string;
          label?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        const action = body.action;
        const dbName = String(body.dbName || "").trim();
        const email = body.email ? String(body.email).trim().toLowerCase() : undefined;

        if (!action) {
          return Response.json(
            { ok: false, error: "action is required" },
            { status: 400 },
          );
        }

        if (action !== "list_audit" && !dbName) {
          return Response.json(
            { ok: false, error: `dbName is required for action "${action}"` },
            { status: 400 },
          );
        }

        const auth = await authorizeDbRequest(request, {
          requireAdmin: action === "list_audit" && !dbName,
          ...(email ? { targetEmail: email } : {}),
        });
        if (!auth.authorized) {
          return Response.json(
            { ok: false, error: auth.reason || "Unauthorized" },
            { status: 401 },
          );
        }

        const actor =
          auth.actorEmail ||
          (auth.actorId === "studio-user" || auth.isAdmin ? email || auth.actorId : auth.actorId);

        try {
          const provisioner = await import("@/lib/server/pg-provisioner.server");

          switch (action) {
            case "rotate_password": {
              const creds = await provisioner.rotateProvisionedDbPassword(
                dbName,
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, ...creds });
            }
            case "backup": {
              const snapshot = await provisioner.createDatabaseSnapshot(
                dbName,
                actor,
                body.label || "Manual Snapshot",
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, snapshot });
            }
            case "list_backups": {
              const snapshots = await provisioner.listDatabaseSnapshots(
                dbName,
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, snapshots });
            }
            case "upgrade_plan": {
              if (!body.planId) {
                return Response.json(
                  { ok: false, error: "planId is required for upgrade_plan" },
                  { status: 400 },
                );
              }
              const updated = await provisioner.updateDatabasePlanOrStatus(
                dbName,
                { planId: body.planId },
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, database: updated });
            }
            case "suspend": {
              const updated = await provisioner.updateDatabasePlanOrStatus(
                dbName,
                { status: "Suspended" },
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, database: updated });
            }
            case "resume": {
              const updated = await provisioner.updateDatabasePlanOrStatus(
                dbName,
                { status: "Active" },
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, database: updated });
            }
            case "deprovision": {
              const result = await provisioner.deprovisionDatabase(
                dbName,
                actor,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, ...result });
            }
            case "list_audit": {
              const logs = await provisioner.listDbAuditLogs(
                dbName || undefined,
                50,
                auth.actorEmail,
                auth.isAdmin,
                auth.tenantId,
              );
              return Response.json({ ok: true, logs });
            }
            default:
              return Response.json(
                { ok: false, error: `Unsupported action: ${String(action)}` },
                { status: 400 },
              );
          }
        } catch (err) {
          const status =
            err instanceof Error && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 503;
          const message = err instanceof Error ? err.message : "Lifecycle operation failed";
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
