import { createFileRoute } from "@tanstack/react-router";
import { CreateInstanceInputSchema, InstanceActionSchema } from "@/lib/ai/contracts";

async function authenticateAiCaller(request: Request): Promise<
  | { ok: true; email: string; isAdmin: boolean; ip: string }
  | { ok: false; response: Response }
> {
  const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
    "@/lib/server/db-auth.server"
  );
  const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");

  const ip = extractClientIp(request);
  const rate = checkDbRateLimit(`ai-instances:${request.method}:${ip}`, 40, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" },
        },
      ),
    };
  }

  if (hasValidAdminKey(request)) {
    return { ok: true, email: "sparrowx-admin@sparrowx.net", isAdmin: true, ip };
  }

  const claims = await readMasterSsoFromRequest(request);
  if (!claims) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Authentication required." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return {
    ok: true,
    email: claims.email.trim().toLowerCase(),
    isAdmin: claims.role === "admin",
    ip,
  };
}

export const Route = createFileRoute("/api/ai/instances")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateAiCaller(request);
        if (!auth.ok) return auth.response;

        const { listAiWorkspaceState } = await import("@/lib/server/ai-hosting.server");
        const url = new URL(request.url);
        const requestedEmail = url.searchParams.get("email")?.trim().toLowerCase() || undefined;
        const effectiveOwner = auth.isAdmin ? requestedEmail : auth.email;
        const state = listAiWorkspaceState(effectiveOwner, { isAdmin: auth.isAdmin });
        return Response.json(
          { ok: true, ...state },
          { headers: { "Cache-Control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        const auth = await authenticateAiCaller(request);
        if (!auth.ok) return auth.response;

        const { createAiInstance } = await import("@/lib/server/ai-hosting.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const parsed = CreateInstanceInputSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              error: parsed.error.issues[0]?.message || "Invalid deployment configuration",
              issues: parsed.error.issues,
            },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        try {
          const instance = createAiInstance(parsed.data, auth.email, auth.ip);
          return Response.json(
            { ok: true, instance },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Failed to deploy instance" },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      PATCH: async ({ request }) => {
        const auth = await authenticateAiCaller(request);
        if (!auth.ok) return auth.response;

        const { performAiInstanceAction } = await import("@/lib/server/ai-hosting.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const parsed = InstanceActionSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              error: parsed.error.issues[0]?.message || "Invalid instance action",
            },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        try {
          const result = performAiInstanceAction(parsed.data, auth.email, auth.ip, {
            isAdmin: auth.isAdmin,
          });
          return Response.json(
            { ok: true, ...result },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Action failed";
          const status = msg.startsWith("Forbidden:")
            ? 403
            : msg === "Instance not found"
              ? 404
              : 400;
          return Response.json(
            { ok: false, error: msg },
            { status, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      DELETE: async ({ request }) => {
        const auth = await authenticateAiCaller(request);
        if (!auth.ok) return auth.response;

        const { deleteAiInstance } = await import("@/lib/server/ai-hosting.server");
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json(
            { ok: false, error: "Missing instance id" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        try {
          const deleted = deleteAiInstance(id, auth.email, { isAdmin: auth.isAdmin });
          if (!deleted) {
            return Response.json(
              { ok: false, error: "Instance not found" },
              { status: 404, headers: { "Cache-Control": "no-store" } },
            );
          }
          return Response.json(
            { ok: true, deletedId: id },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Forbidden";
          return Response.json(
            { ok: false, error: msg },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
