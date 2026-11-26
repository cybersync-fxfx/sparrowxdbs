import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/deploy/deployments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json(
            { ok: false, error: "Authentication required." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }
        const { listGlobalDeploymentsForActor } = await import("@/lib/server/deploy-store.server");
        const deployments = await listGlobalDeploymentsForActor(auth.actor);
        return Response.json(
          { ok: true, deployments },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
