import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shield/telemetry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const domain = url.searchParams.get("domain");
          const { getLiveWafTelemetry } = await import("@/lib/server/edge-waf.server");
          const snapshot = await getLiveWafTelemetry(domain);
          return Response.json(snapshot, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Failed to load Edge WAF telemetry",
            },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const { authorizeDbRequest } = await import("@/lib/server/db-auth.server");
          const auth = await authorizeDbRequest(request);
          if (!auth.authorized) {
            return Response.json(
              { ok: false, error: auth.reason || "Authentication required" },
              { status: 401 },
            );
          }

          const body = (await request.json().catch(() => null)) as {
            action?: "register_domain" | "update_policy" | "test_waf_block";
            domain?: string;
            wafMode?: "balanced" | "strict" | "monitor";
            edgeCheckEnabled?: boolean;
            sensorKey?: string;
          } | null;

          const action = body?.action || "update_policy";
          const domain = String(body?.domain || "").trim();
          if (!domain) {
            return Response.json(
              { ok: false, error: "domain is required" },
              { status: 400 },
            );
          }

          const waf = await import("@/lib/server/edge-waf.server");

          if (action === "test_waf_block") {
            const ip =
              request.headers.get("cf-connecting-ip")?.trim() ||
              request.headers.get("x-real-ip")?.trim() ||
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              "127.0.0.1";
            const ua = request.headers.get("user-agent") || "SparrowX-SOC-Probe/1.0";
            const probe = await waf.runLiveWafTestProbe({ domain, ip, userAgent: ua });
            const telemetry = await waf.getLiveWafTelemetry(domain);
            return Response.json({ ok: true, probe, telemetry });
          }

          const policy = waf.upsertDomainWafPolicy({
            domain,
            wafMode: body?.wafMode,
            edgeCheckEnabled: body?.edgeCheckEnabled,
            sensorKey: body?.sensorKey,
          });
          const telemetry = await waf.getLiveWafTelemetry(policy.domain);
          return Response.json({ ok: true, policy, telemetry });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Failed to update Edge WAF policy",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
