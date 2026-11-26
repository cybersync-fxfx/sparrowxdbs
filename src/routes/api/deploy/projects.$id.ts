import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";

export const Route = createFileRoute("/api/deploy/projects/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json(
            { ok: false, error: "Authentication required." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        const { getProjectControlPlane } = await import("@/lib/server/deploy-store.server");
        const data = await getProjectControlPlane(params.id, auth.actor);
        if (!data) {
          return Response.json(
            { ok: false, error: "Project not found." },
            { status: 404, headers: { "Cache-Control": "no-store" } },
          );
        }
        return Response.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
      },

      POST: async ({ request, params }) => {
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
          const action = String(body.action || "");
          const store = await import("@/lib/server/deploy-store.server");

          if (
            action === "redeploy" ||
            action === "rollback" ||
            action === "start" ||
            action === "stop" ||
            action === "restart"
          ) {
            const res = await store.runProjectLifecycleAction(
              params.id,
              action,
              auth.actor,
              typeof body.targetDeploymentId === "string" ? body.targetDeploymentId : undefined,
            );
            return Response.json(res, { headers: { "Cache-Control": "no-store" } });
          }

          if (action === "bulk-env" && Array.isArray(body.envVars)) {
            const envVars = await store.upsertEnvVarsForProject(
              params.id,
              body.envVars,
              auth.actor,
            );
            return Response.json(
              { ok: true, envVars },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (action === "reveal-env" && typeof body.envId === "string") {
            const revealed = await store.revealEnvVarForProject(params.id, body.envId, auth.actor);
            if (!revealed) {
              return Response.json(
                { ok: false, error: "Environment variable not found." },
                { status: 404 },
              );
            }
            return Response.json(
              { ok: true, envVar: revealed },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (action === "remove-env" && typeof body.envId === "string") {
            await store.removeEnvVarForProject(params.id, body.envId, auth.actor);
            return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
          }

          return Response.json(
            { ok: false, error: "Unsupported project action." },
            { status: 400 },
          );
        } catch (err) {
          if (err instanceof ZodError) {
            return Response.json(
              { ok: false, error: err.issues[0]?.message || "Validation failed." },
              { status: 400 },
            );
          }
          const msg = err instanceof Error ? err.message : "Action failed.";
          return Response.json({ ok: false, error: msg }, { status: 400 });
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
          }
          const body = (await request.json()) as Record<string, unknown>;
          const { updateProjectSettingsForActor } =
            await import("@/lib/server/deploy-store.server");
          const project = await updateProjectSettingsForActor(params.id, body, auth.actor);
          return Response.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
        } catch (err) {
          if (err instanceof ZodError) {
            return Response.json(
              { ok: false, error: err.issues[0]?.message || "Invalid settings." },
              { status: 400 },
            );
          }
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Failed to update settings." },
            { status: 400 },
          );
        }
      },

      DELETE: async ({ request, params }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
        }
        const { deleteProjectForActor } = await import("@/lib/server/deploy-store.server");
        const result = await deleteProjectForActor(params.id, auth.actor);
        return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
