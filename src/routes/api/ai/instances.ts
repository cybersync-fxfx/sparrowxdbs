import { createFileRoute } from "@tanstack/react-router";
import { CreateInstanceInputSchema, InstanceActionSchema } from "@/lib/ai/contracts";

export const Route = createFileRoute("/api/ai/instances")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { listAiWorkspaceState } = await import("@/lib/server/ai-hosting.server");
        const url = new URL(request.url);
        const ownerEmail = url.searchParams.get("email")?.trim().toLowerCase() || undefined;
        const state = listAiWorkspaceState(ownerEmail);
        return Response.json({ ok: true, ...state });
      },

      POST: async ({ request }) => {
        const { createAiInstance } = await import("@/lib/server/ai-hosting.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
        const parsed = CreateInstanceInputSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              error: parsed.error.issues[0]?.message || "Invalid deployment configuration",
              issues: parsed.error.issues,
            },
            { status: 400 },
          );
        }
        const actorEmail =
          request.headers.get("x-sparrowx-user-email")?.trim().toLowerCase() ||
          "developer@sparrowx.net";
        const actorIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-real-ip") ||
          "103.174.10.24";
        try {
          const instance = createAiInstance(parsed.data, actorEmail, actorIp);
          return Response.json({ ok: true, instance }, { status: 201 });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Failed to deploy instance" },
            { status: 409 },
          );
        }
      },

      PATCH: async ({ request }) => {
        const { performAiInstanceAction } = await import("@/lib/server/ai-hosting.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }
        const parsed = InstanceActionSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              error: parsed.error.issues[0]?.message || "Invalid instance action",
            },
            { status: 400 },
          );
        }
        const actorEmail =
          request.headers.get("x-sparrowx-user-email")?.trim().toLowerCase() ||
          "developer@sparrowx.net";
        const actorIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-real-ip") ||
          "103.174.10.24";
        try {
          const result = performAiInstanceAction(parsed.data, actorEmail, actorIp);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Action failed" },
            { status: 400 },
          );
        }
      },

      DELETE: async ({ request }) => {
        const { deleteAiInstance } = await import("@/lib/server/ai-hosting.server");
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "Missing instance id" }, { status: 400 });
        }
        const actorEmail =
          request.headers.get("x-sparrowx-user-email")?.trim().toLowerCase() ||
          "developer@sparrowx.net";
        const deleted = deleteAiInstance(id, actorEmail);
        if (!deleted) {
          return Response.json({ ok: false, error: "Instance not found" }, { status: 404 });
        }
        return Response.json({ ok: true, deletedId: id });
      },
    },
  },
});
