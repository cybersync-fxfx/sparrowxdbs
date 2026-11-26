import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";

export const Route = createFileRoute("/api/deploy/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const url = new URL(request.url);
          const checkSlug = url.searchParams.get("checkSlug");
          const store = await import("@/lib/server/deploy-store.server");
          if (checkSlug !== null) {
            const available = await store.isSlugAvailable(checkSlug);
            return Response.json(
              { ok: true, slug: checkSlug, available },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          const data = await store.listProjectsForActor(auth.actor);
          return Response.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { ok: false, error: "Failed to list deploy projects" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`deploy-post:${ip}`, 15, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required to deploy projects." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const store = await import("@/lib/server/deploy-store.server");

          if (body.action === "redeploy" && typeof body.id === "string") {
            const result = await store.runProjectLifecycleAction(body.id, "redeploy", auth.actor);
            return Response.json({ ...result }, { headers: { "Cache-Control": "no-store" } });
          }

          const created = await store.createProjectForActor(body, auth.actor);
          return Response.json(
            { ok: true, ...created },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof ZodError) {
            return Response.json(
              { ok: false, error: err.issues[0]?.message || "Invalid project configuration." },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          const message = err instanceof Error ? err.message : "Failed to create deployment";
          if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code?: string }).code === "FREE_PROJECT_LIMIT_REACHED"
          ) {
            const q = err as { used?: number; limit?: number };
            return Response.json(
              {
                ok: false,
                code: "FREE_PROJECT_LIMIT_REACHED",
                projectLimit: q.limit ?? 3,
                projectsUsed: q.used ?? 3,
                error: message,
              },
              { status: 403, headers: { "Cache-Control": "no-store" } },
            );
          }
          return Response.json(
            { ok: false, error: message },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      PATCH: async ({ request }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const id = typeof body.id === "string" ? body.id : "";
          if (!id) {
            return Response.json({ ok: false, error: "Project id is required" }, { status: 400 });
          }
          const store = await import("@/lib/server/deploy-store.server");

          if (body.action === "attach-domain" && typeof body.domain === "string") {
            const domain = await store.attachDomainForActor(id, body.domain, auth.actor);
            return Response.json(
              { ok: true, domain },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (body.action === "add-env" && typeof body.key === "string") {
            const envVars = await store.upsertEnvVarsForProject(
              id,
              [
                {
                  key: body.key,
                  value: typeof body.value === "string" ? body.value : "",
                  target: typeof body.target === "string" ? body.target : "Production",
                },
              ],
              auth.actor,
            );
            return Response.json(
              { ok: true, envVars },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (body.action === "remove-env" && typeof body.envId === "string") {
            await store.removeEnvVarForProject(id, body.envId, auth.actor);
            return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
          }

          return Response.json({ ok: false, error: "Unsupported patch action" }, { status: 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update project";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id") || "";
          if (!id) {
            return Response.json({ ok: false, error: "Project id is required" }, { status: 400 });
          }
          const { deleteProjectForActor } = await import("@/lib/server/deploy-store.server");
          const result = await deleteProjectForActor(id, auth.actor);
          return Response.json(
            { ok: true, ...result },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json({ ok: false, error: "Failed to delete project" }, { status: 500 });
        }
      },
    },
  },
});
