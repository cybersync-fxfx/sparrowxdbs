import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/db/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getDbClusterHealth } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const health = await getDbClusterHealth();
          return Response.json(health);
        } catch (err) {
          const message = err instanceof Error ? err.message : "PostgreSQL cluster unreachable";
          return Response.json(
            {
              ok: false,
              engine: "PostgreSQL Sovereign Cluster",
              error: message,
              checkedAt: new Date().toISOString(),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
