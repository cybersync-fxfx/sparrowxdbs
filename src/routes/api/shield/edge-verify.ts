import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shield/edge-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            token?: string;
            domain?: string;
          } | null;

          const token = String(body?.token || "").trim();
          const reqHost =
            request.headers.get("x-forwarded-host") ||
            request.headers.get("host") ||
            new URL(request.url).hostname;
          const domain = String(body?.domain || reqHost).trim();
          const ua = request.headers.get("user-agent") || "";
          const ip =
            request.headers.get("cf-connecting-ip")?.trim() ||
            request.headers.get("x-real-ip")?.trim() ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "127.0.0.1";

          if (!token) {
            return Response.json(
              { ok: false, error: "Challenge token required" },
              { status: 400 },
            );
          }

          const { verifyEdgeChallengeAndIssueClearance } = await import(
            "@/lib/server/edge-waf.server"
          );
          const result = verifyEdgeChallengeAndIssueClearance(token, domain, ua, ip);
          if (!result.ok || !result.cookieHeader) {
            return Response.json(
              { ok: false, error: result.error || "Edge verification failed" },
              { status: 403 },
            );
          }

          return new Response(
            JSON.stringify({
              ok: true,
              rayId: result.rayId,
              expiresInSec: 1800,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                "Set-Cookie": result.cookieHeader,
                "X-SparrowX-WAF": "VERIFIED",
                "X-SparrowX-Ray": result.rayId || "",
              },
            },
          );
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Verification error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
