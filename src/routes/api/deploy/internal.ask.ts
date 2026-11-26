import { createFileRoute } from "@tanstack/react-router";

/**
 * Caddy On-Demand TLS verification endpoint.
 * Caddy queries `GET /api/deploy/internal/ask?domain=<host>` before issuing any
 * Let's Encrypt certificate so arbitrary third-party domains cannot abuse TLS issuance.
 */
export const Route = createFileRoute("/api/deploy/internal/ask")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
