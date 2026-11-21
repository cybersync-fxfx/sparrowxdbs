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
      },

      POST: async ({ request }) => {
        const { recordClientVpsHeartbeat } = await import("@/lib/server/client-protect.server");
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
      },
    },
  },
});
