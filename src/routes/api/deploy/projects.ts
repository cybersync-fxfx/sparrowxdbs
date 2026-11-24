import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/deploy/projects")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listDeployProjects } = await import("@/lib/server/deploy.server");
          const data = await listDeployProjects();
          return Response.json({ ok: true, ...data });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list deploy projects";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const mod = await import("@/lib/server/deploy.server");

          if (body.action === "redeploy" && typeof body.id === "string") {
            const project = await mod.redeployProject(body.id);
            return Response.json({ ok: true, project });
          }

          const project = await mod.createDeployProject({
            name: typeof body.name === "string" ? body.name : undefined,
            repoUrl: typeof body.repoUrl === "string" ? body.repoUrl : "",
            branch: typeof body.branch === "string" ? body.branch : "main",
            framework: typeof body.framework === "string" ? (body.framework as any) : "nextjs",
            buildCommand: typeof body.buildCommand === "string" ? body.buildCommand : "",
            outputDir: typeof body.outputDir === "string" ? body.outputDir : "dist",
            rootDir: typeof body.rootDir === "string" ? body.rootDir : "./",
            region: typeof body.region === "string" ? (body.region as any) : "Mumbai IN-1",
            envVars: Array.isArray(body.envVars) ? (body.envVars as any) : [],
          });
          return Response.json({ ok: true, project }, { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create deployment";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },

      PATCH: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const id = typeof body.id === "string" ? body.id : "";
          if (!id) {
            return Response.json({ ok: false, error: "Project id is required" }, { status: 400 });
          }
          const mod = await import("@/lib/server/deploy.server");

          if (body.action === "attach-domain" && typeof body.domain === "string") {
            const project = await mod.attachCustomDomain(id, body.domain);
            return Response.json({ ok: true, project });
          }

          if (body.action === "add-env" && typeof body.key === "string") {
            const project = await mod.addProjectEnvVar(
              id,
              body.key,
              typeof body.value === "string" ? body.value : "",
              typeof body.target === "string" ? (body.target as any) : "Production",
            );
            return Response.json({ ok: true, project });
          }

          if (body.action === "remove-env" && typeof body.envId === "string") {
            const project = await mod.removeProjectEnvVar(id, body.envId);
            return Response.json({ ok: true, project });
          }

          return Response.json({ ok: false, error: "Unsupported patch action" }, { status: 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update project";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const id = url.searchParams.get("id") || "";
          if (!id) {
            return Response.json({ ok: false, error: "Project id is required" }, { status: 400 });
          }
          const { deleteDeployProject } = await import("@/lib/server/deploy.server");
          const result = await deleteDeployProject(id);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete project";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
