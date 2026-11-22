import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listManagedInfraServers } = await import(
            "@/lib/server/proxmox.server"
          );
          const data = await listManagedInfraServers();
          return Response.json({ ok: true, ...data });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list servers";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
