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
        const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
          "@/lib/server/db-auth.server"
        );
        const { readMasterSsoFromRequest } = await import(
          "@/lib/server/master-sso.server"
        );
        const { sendDiscordTelemetry } = await import(
          "@/lib/server/discord-webhook.server"
        );

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`discord-telemetry:${ip}`, 15, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        // Enforce same-origin browser check unless caller presents an authenticated session/admin key
        const isAdminKey = hasValidAdminKey(request);
        const claims = await readMasterSsoFromRequest(request);
        if (!isAdminKey && !claims) {
          const strictRate = checkDbRateLimit(`discord-telemetry-anon:${ip}`, 6, 60_000);
          if (!strictRate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${strictRate.retryAfterSec}s.` },
              {
                status: 429,
                headers: { "Retry-After": String(strictRate.retryAfterSec), "Cache-Control": "no-store" },
              },
            );
          }
          const originOrReferer =
            (request.headers.get("origin") || request.headers.get("referer") || "").trim();
          if (!originOrReferer) {
            return Response.json(
              { ok: false, error: "Authentication or trusted origin required." },
              { status: 403, headers: { "Cache-Control": "no-store" } },
            );
          }
          try {
            const parsedOrigin = new URL(originOrReferer);
            const oHost = parsedOrigin.hostname.toLowerCase();
            const isProd = process.env.NODE_ENV === "production";
            const trustedOrigin =
              (parsedOrigin.protocol === "https:" &&
                (oHost === "sparrowx.net" || oHost.endsWith(".sparrowx.net"))) ||
              (!isProd && (oHost === "localhost" || oHost === "127.0.0.1"));
            if (!trustedOrigin) {
              return Response.json(
                { ok: false, error: "Forbidden origin" },
                { status: 403, headers: { "Cache-Control": "no-store" } },
              );
            }
          } catch {
            return Response.json(
              { ok: false, error: "Invalid origin" },
              { status: 403, headers: { "Cache-Control": "no-store" } },
            );
          }
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

        const isTrustedCaller = isAdminKey || Boolean(claims);
        const requestedCategory: DiscordTelemetryCategory = ALLOWED_CATEGORIES.has(
          body.category as DiscordTelemetryCategory,
        )
          ? (body.category as DiscordTelemetryCategory)
          : "audit";
        // Unauthenticated browser callers cannot forge emergency alerts
        const category: DiscordTelemetryCategory =
          !isTrustedCaller && requestedCategory === "emergency" ? "form" : requestedCategory;

        const requestedSeverity: DiscordTelemetrySeverity = ALLOWED_SEVERITIES.has(
          body.severity as DiscordTelemetrySeverity,
        )
          ? (body.severity as DiscordTelemetrySeverity)
          : category === "emergency" || category === "error"
            ? "high"
            : "info";
        const severity: DiscordTelemetrySeverity =
          !isTrustedCaller && requestedSeverity === "critical" ? "medium" : requestedSeverity;

        const title = String(body.title || "").trim().slice(0, 160);
        if (!title) {
          return Response.json({ ok: false, error: "title is required" }, { status: 400 });
        }

        const result = await sendDiscordTelemetry({
          category,
          severity,
          title,
          ...(body.description ? { description: String(body.description).slice(0, 800) } : {}),
          ...(body.service ? { service: String(body.service).slice(0, 80) } : {}),
          ...(body.url ? { url: String(body.url).slice(0, 240) } : {}),
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
