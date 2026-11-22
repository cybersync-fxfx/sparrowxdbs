import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/console")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { serverId?: string };
          const { createServerConsoleSession } = await import(
            "@/lib/server/proxmox.server"
          );
          const result = await createServerConsoleSession(String(body.serverId || ""));
          return Response.json(result, { status: result.ok ? 200 : 404 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Invalid console payload";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
