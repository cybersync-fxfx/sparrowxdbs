import { createFileRoute } from "@tanstack/react-router";

async function requireDeployAuth(request: Request) {
  const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
  const { hasValidAdminKey } = await import("@/lib/server/db-auth.server");
  if (hasValidAdminKey(request)) {
    return { authorized: true as const, isAdmin: true, email: "admin@sparrowx.net" };
  }
  const claims = await readMasterSsoFromRequest(request);
  if (!claims) {
    return { authorized: false as const, isAdmin: false, email: "" };
  }
  return {
    authorized: true as const,
    isAdmin: claims.role === "admin",
    email: claims.email,
  };
}

export const Route = createFileRoute("/api/deploy/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await requireDeployAuth(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }
          const { listDeployProjects } = await import("@/lib/server/deploy.server");
          const data = await listDeployProjects(auth.email, auth.isAdmin);
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
          const rate = checkDbRateLimit(`deploy-post:${ip}`, 10, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
            );
          }

          const auth = await requireDeployAuth(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: "Authentication required to deploy projects." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const mod = await import("@/lib/server/deploy.server");

          if (body.action === "redeploy" && typeof body.id === "string") {
            const project = await mod.redeployProject(body.id, auth.email, auth.isAdmin);
            return Response.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
          }

          const project = await mod.createDeployProject({
            ownerEmail: auth.email,
            ...(typeof body.name === "string" && body.name.trim() ? { name: body.name } : {}),
            repoUrl: typeof body.repoUrl === "string" ? body.repoUrl : "",
            branch: typeof body.branch === "string" ? body.branch : "main",
            framework: typeof body.framework === "string" ? (body.framework as any) : "nextjs",
            buildCommand: typeof body.buildCommand === "string" ? body.buildCommand : "",
            outputDir: typeof body.outputDir === "string" ? body.outputDir : "dist",
            rootDir: typeof body.rootDir === "string" ? body.rootDir : "./",
            region: typeof body.region === "string" ? (body.region as any) : "Mumbai IN-1",
            envVars: Array.isArray(body.envVars) ? (body.envVars as any) : [],
          });
          return Response.json(
            { ok: true, project },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create deployment";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },

      PATCH: async ({ request }) => {
        try {
          const auth = await requireDeployAuth(request);
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
          const mod = await import("@/lib/server/deploy.server");

          if (body.action === "attach-domain" && typeof body.domain === "string") {
            const project = await mod.attachCustomDomain(id, body.domain, auth.email, auth.isAdmin);
            return Response.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
          }

          if (body.action === "add-env" && typeof body.key === "string") {
            const project = await mod.addProjectEnvVar(
              id,
              body.key,
              typeof body.value === "string" ? body.value : "",
              typeof body.target === "string" ? (body.target as any) : "Production",
              auth.email,
              auth.isAdmin,
            );
            return Response.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
          }

          if (body.action === "remove-env" && typeof body.envId === "string") {
            const project = await mod.removeProjectEnvVar(id, body.envId, auth.email, auth.isAdmin);
            return Response.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
          }

          return Response.json({ ok: false, error: "Unsupported patch action" }, { status: 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update project";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const auth = await requireDeployAuth(request);
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
          const { deleteDeployProject } = await import("@/lib/server/deploy.server");
          const result = await deleteDeployProject(id, auth.email, auth.isAdmin);
          return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ ok: false, error: "Failed to delete project" }, { status: 500 });
        }
      },
    },
  },
});
