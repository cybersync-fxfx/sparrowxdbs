import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { executeServerAction } = await import(
            "@/lib/server/proxmox.server"
          );
          const result = await executeServerAction(body);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Invalid action payload";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
