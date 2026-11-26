import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/db/query")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          authorizeDbRequest,
          checkDbRateLimit,
          extractClientIp,
        } = await import("@/lib/server/db-auth.server");
        const { sendDiscordTelemetry } = await import(
          "@/lib/server/discord-webhook.server"
        );
        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`query:${ip}`, 60, 60_000);
        if (!rate.allowed) {
          void sendDiscordTelemetry({
            category: "security",
            severity: "high",
            service: "SparrowX Cloud DB",
            title: "SQL Query Rate Limit Triggered",
            ip,
            fields: { RetryAfterSec: rate.retryAfterSec },
          });
          return Response.json(
            { ok: false, error: `Query rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: { dbName?: string; sql?: string; email?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        const dbName = String(body.dbName || "").trim();
        const sql = String(body.sql || "");
        const email = body.email ? String(body.email).trim().toLowerCase() : undefined;

        if (!dbName || !sql.trim()) {
          return Response.json(
            { ok: false, error: "dbName and sql are required" },
            { status: 400 },
          );
        }

        const auth = await authorizeDbRequest(request, email ? { targetEmail: email } : {});
        if (!auth.authorized) {
          return Response.json(
            { ok: false, error: auth.reason || "Unauthorized" },
            { status: 401 },
          );
        }

        try {
          const { executeTenantSqlQuery } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const result = await executeTenantSqlQuery(
            dbName,
            sql,
            auth.actorEmail || (auth.actorId === "studio-user" || auth.isAdmin ? email || auth.actorId : auth.actorId),
            auth.isAdmin,
            auth.tenantId,
          );
          return Response.json(result);
        } catch (err) {
          const pgErr = err as {
            statusCode?: number;
            message?: string;
            pgCode?: string;
            code?: string;
            detail?: string;
            hint?: string;
            position?: string;
          };
          const status = pgErr?.statusCode ? Number(pgErr.statusCode) : 400;
          const message = err instanceof Error ? err.message : "Query execution failed";
          return Response.json(
            {
              ok: false,
              error: message,
              ...(pgErr?.pgCode || pgErr?.code ? { pgCode: pgErr.pgCode || pgErr.code } : {}),
              ...(pgErr?.detail ? { detail: pgErr.detail } : {}),
              ...(pgErr?.hint ? { hint: pgErr.hint } : {}),
              ...(pgErr?.position ? { position: pgErr.position } : {}),
            },
            { status },
          );
        }
      },
    },
  },
});
