import { createFileRoute } from "@tanstack/react-router";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/api/db/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          tenantId?: string;
          userId?: string;
          email?: string;
          projectName?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        const email = String(body.email || "").trim().toLowerCase();
        const tenantId = String(body.tenantId || "").trim();
        const userId = String(body.userId || "").trim();
        const projectName = body.projectName ? String(body.projectName).trim() : undefined;

        if (!EMAIL_RE.test(email) || !tenantId || !userId) {
          return Response.json(
            { ok: false, error: "tenantId, userId, and valid email are required" },
            { status: 400 },
          );
        }

        try {
          const { provisionSeparateUserDatabase } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const database = await provisionSeparateUserDatabase({
            tenantId,
            userId,
            email,
            projectName,
          });
          return Response.json({ ok: true, database });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Database provisioning failed";
          return Response.json(
            { ok: false, error: message },
            { status: 503 },
          );
        }
      },
    },
  },
});
