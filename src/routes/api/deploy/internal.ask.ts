import { createFileRoute } from "@tanstack/react-router";

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  if (!clean) return false;
  if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80:")) return true;
  return false;
}

/**
 * Caddy On-Demand TLS verification endpoint.
 * Caddy queries `GET /api/deploy/internal/ask?domain=<host>` before issuing any
 * Let's Encrypt certificate so arbitrary third-party domains cannot abuse TLS issuance.
 * Restricted to internal control-plane/private Docker callers to prevent external domain enumeration.
 */
export const Route = createFileRoute("/api/deploy/internal/ask")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
          "@/lib/server/db-auth.server"
        );
        const ip = extractClientIp(request);
        if (!hasValidAdminKey(request) && !isPrivateOrLoopbackIp(ip)) {
          return new Response("forbidden", {
            status: 403,
            headers: { "Cache-Control": "no-store" },
          });
        }
        const rate = checkDbRateLimit(`deploy-tls-ask:${ip}`, 120, 60_000);
        if (!rate.allowed) {
          return new Response("rate limited", {
            status: 429,
            headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" },
          });
        }

        const url = new URL(request.url);
        const domain = (url.searchParams.get("domain") || "").trim().toLowerCase();
        if (!domain) {
          return new Response("missing domain", { status: 400 });
        }
        const { isDomainAllowedForTls } = await import("@/lib/server/deploy-store.server");
        const allowed = await isDomainAllowedForTls(domain);
        return new Response(allowed ? "ok" : "forbidden", {
          status: allowed ? 200 : 403,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
