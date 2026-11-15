import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/db/summary")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listProvisionedDatabases } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const summary = await listProvisionedDatabases();
          return Response.json({ ok: true, ...summary });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to inspect databases";
          return Response.json(
            { ok: false, error: message, totalUsers: 0, totalProvisionedDbs: 0, databases: [] },
            { status: 503 },
          );
        }
      },
    },
  },
});
