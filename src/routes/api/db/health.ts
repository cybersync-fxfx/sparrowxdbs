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
          const { sendDiscordTelemetry } = await import("@/lib/server/discord-webhook.server");
          void sendDiscordTelemetry({
            category: "error",
            severity: "critical",
            service: "PostgreSQL Sovereign Cluster",
            title: "Database Cluster Health Failure",
            description: message,
          });
          return Response.json(
            {
              ok: false,
              engine: "PostgreSQL Sovereign Cluster",
              error: "Database cluster temporarily unavailable",
              checkedAt: new Date().toISOString(),
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
