import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/client-protect/heartbeat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
        const { readClientVpsRegistry } = await import("@/lib/server/client-protect.server");

        const claims = await readMasterSsoFromRequest(request);
        if (!claims) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        try {
          const all = await readClientVpsRegistry();
          const visible =
            claims.role === "admin"
              ? all
              : all.filter((item) => item.email.toLowerCase() === claims.email.toLowerCase());

          return Response.json(
            {
              ok: true,
              clients: visible.map(({ tokenHash: _hidden, ...safe }) => safe),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Failed to load client registry." },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const { recordClientVpsHeartbeat } = await import("@/lib/server/client-protect.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`client-protect-hb:${ip}`, 60, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const token = request.headers.get("x-sparrowx-client-token")?.trim() || "";
        if (!token) {
          return Response.json({ ok: false, error: "Missing X-SparrowX-Client-Token" }, { status: 401 });
        }

        let body: {
          agentId?: string;
          hostname?: string;
          publicIp?: string;
          load1m?: string;
          synRecv?: number;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        try {
          const updated = await recordClientVpsHeartbeat({
            token,
            agentId: String(body.agentId || "").trim(),
            hostname: body.hostname,
            publicIp: body.publicIp,
            load1m: body.load1m,
            synRecv: typeof body.synRecv === "number" ? body.synRecv : undefined,
          });

          if (!updated) {
            return Response.json({ ok: false, error: "Invalid client agent token or agentId" }, { status: 403 });
          }

          return Response.json({
            ok: true,
            agentId: updated.agentId,
            status: updated.status,
            lastSeen: updated.lastSeen,
          });
        } catch {
          return Response.json(
            { ok: false, error: "Heartbeat update failed." },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
