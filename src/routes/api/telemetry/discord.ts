import { createFileRoute } from "@tanstack/react-router";
import type {
  DiscordTelemetryCategory,
  DiscordTelemetrySeverity,
} from "@/lib/server/discord-webhook.server";

const ALLOWED_CATEGORIES = new Set<DiscordTelemetryCategory>([
  "emergency",
  "security",
  "error",
  "auth",
  "form",
  "audit",
]);

const ALLOWED_SEVERITIES = new Set<DiscordTelemetrySeverity>([
  "critical",
  "high",
  "medium",
  "info",
]);

export const Route = createFileRoute("/api/telemetry/discord")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp } = await import(
          "@/lib/server/db-auth.server"
        );
        const { sendDiscordTelemetry } = await import(
          "@/lib/server/discord-webhook.server"
        );

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`discord-telemetry:${ip}`, 60, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: {
          category?: string;
          severity?: string;
          title?: string;
          description?: string;
          service?: string;
          url?: string;
          fields?: Record<string, unknown>;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        const category: DiscordTelemetryCategory = ALLOWED_CATEGORIES.has(
          body.category as DiscordTelemetryCategory,
        )
          ? (body.category as DiscordTelemetryCategory)
          : "audit";

        const severity: DiscordTelemetrySeverity = ALLOWED_SEVERITIES.has(
          body.severity as DiscordTelemetrySeverity,
        )
          ? (body.severity as DiscordTelemetrySeverity)
          : category === "emergency" || category === "error"
            ? "critical"
            : "info";

        const title = String(body.title || "").trim();
        if (!title) {
          return Response.json({ ok: false, error: "title is required" }, { status: 400 });
        }

        const result = await sendDiscordTelemetry({
          category,
          severity,
          title,
          ...(body.description ? { description: String(body.description) } : {}),
          ...(body.service ? { service: String(body.service) } : {}),
          ...(body.url ? { url: String(body.url) } : {}),
          ...(body.fields && typeof body.fields === "object" ? { fields: body.fields } : {}),
          ip,
          userAgent: request.headers.get("user-agent") || undefined,
        });

        return Response.json(
          { ok: result.ok, ticketId: `SPX-${Date.now().toString(36).toUpperCase()}` },
          {
            status: result.ok ? 200 : 502,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
