import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const AdminActionSchema = z.object({
  action: z.enum(["suspend", "resume"]),
  instanceId: z.string().min(1),
});

export const Route = createFileRoute("/api/ai/admin")({
  server: {
    handlers: {
      GET: async () => {
        const { getFounderAdminTelemetry, listAiWorkspaceState } = await import(
          "@/lib/server/ai-hosting.server"
        );
        return Response.json({
          ok: true,
          telemetry: getFounderAdminTelemetry(),
          instances: listAiWorkspaceState().instances,
        });
      },

      POST: async ({ request }) => {
        const { performAiInstanceAction, getFounderAdminTelemetry } = await import(
          "@/lib/server/ai-hosting.server"
        );
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
        const parsed = AdminActionSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.issues[0]?.message || "Invalid admin action" },
            { status: 400 },
          );
        }
        try {
          const result = performAiInstanceAction(
            { action: parsed.data.action, instanceId: parsed.data.instanceId },
            "founder-admin@sparrowx.net",
          );
          return Response.json({
            ok: true,
            instance: result.instance,
            telemetry: getFounderAdminTelemetry(),
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Admin action failed" },
            { status: 404 },
          );
        }
      },
    },
  },
});
