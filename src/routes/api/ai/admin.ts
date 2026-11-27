import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const AdminActionSchema = z.object({
  action: z.enum(["suspend", "resume"]),
  instanceId: z.string().min(1),
});

export const Route = createFileRoute("/api/ai/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
          "@/lib/server/db-auth.server"
        );
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`ai-admin-get:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" } },
          );
        }

        const isAdminKey = hasValidAdminKey(request);
        const claims = isAdminKey ? null : await readMasterSsoFromRequest(request);
        if (!isAdminKey && !claims) {
          return Response.json(
            { ok: false, error: "Authentication required." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }
        if (!isAdminKey && claims?.role !== "admin") {
          return Response.json(
            { ok: false, error: "Forbidden: administrator privileges required." },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }

        const { getFounderAdminTelemetry, listAiWorkspaceState } = await import(
          "@/lib/server/ai-hosting.server"
        );
        return Response.json(
          {
            ok: true,
            telemetry: getFounderAdminTelemetry(),
            instances: listAiWorkspaceState(undefined, { isAdmin: true }).instances,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
          "@/lib/server/db-auth.server"
        );
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`ai-admin-post:${ip}`, 20, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" } },
          );
        }

        const isAdminKey = hasValidAdminKey(request);
        const claims = isAdminKey ? null : await readMasterSsoFromRequest(request);
        if (!isAdminKey && !claims) {
          return Response.json(
            { ok: false, error: "Authentication required." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }
        if (!isAdminKey && claims?.role !== "admin") {
          return Response.json(
            { ok: false, error: "Forbidden: administrator privileges required." },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }

        const { performAiInstanceAction, getFounderAdminTelemetry } = await import(
          "@/lib/server/ai-hosting.server"
        );
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const parsed = AdminActionSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.issues[0]?.message || "Invalid admin action" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const actorEmail = claims?.email || "sparrowx-admin@sparrowx.net";
        try {
          const result = performAiInstanceAction(
            { action: parsed.data.action, instanceId: parsed.data.instanceId },
            actorEmail,
            ip,
            { isAdmin: true },
          );
          return Response.json(
            {
              ok: true,
              instance: result.instance,
              telemetry: getFounderAdminTelemetry(),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const isNotFound = err instanceof Error && err.message === "Instance not found";
          return Response.json(
            { ok: false, error: isNotFound ? "Instance not found" : "Admin action failed" },
            { status: isNotFound ? 404 : 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
