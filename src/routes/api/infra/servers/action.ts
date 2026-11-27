import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
          const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
            "@/lib/server/db-auth.server"
          );
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`infra-action:${ip}`, 30, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const isAdminKey = hasValidAdminKey(request);
          const claims = await readMasterSsoFromRequest(request);
          if (!isAdminKey && !claims) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const isAdmin = isAdminKey || claims?.role === "admin";
          const body = await request.json();
          const { executeServerAction } = await import(
            "@/lib/server/proxmox.server"
          );
          const result = await executeServerAction(body, {
            email: claims?.email,
            isAdmin,
          });
          return Response.json(result, {
            status: result.ok ? 200 : result.statusCode || 400,
            headers: { "Cache-Control": "no-store" },
          });
        } catch {
          return Response.json(
            { ok: false, error: "Invalid action payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
