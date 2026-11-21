import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/client-protect/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
        const { env } = await import("@/lib/server/config.server");
        const { timingSafeEqual } = await import("@/lib/server/crypto.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const { createBoundClientVpsBundle } = await import("@/lib/server/client-protect.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`client-protect-gen:${ip}`, 20, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const adminKey = env("SPARROWX_ADMIN_API_KEY");
        const suppliedAdminKey = request.headers.get("x-sparrowx-admin-key")?.trim() || "";
        const isAdminKeyValid = Boolean(
          adminKey && suppliedAdminKey && timingSafeEqual(suppliedAdminKey, adminKey),
        );
        const ssoClaims = await readMasterSsoFromRequest(request);

        if (!isAdminKeyValid && !ssoClaims) {
          return Response.json(
            { ok: false, error: "Sign in with your SparrowX account or provide an admin API key." },
            { status: 401 },
          );
        }

        let body: {
          username?: string;
          email?: string;
          ports?: string;
          guardIp?: string;
          enableXdp?: boolean;
          format?: "json" | "script";
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        const isAdmin = isAdminKeyValid || ssoClaims?.role === "admin";
        const targetEmail = isAdmin
          ? String(body.email || ssoClaims?.email || "").trim().toLowerCase()
          : String(ssoClaims?.email || "").trim().toLowerCase();
        const targetUsername = String(
          body.username || ssoClaims?.fullName || targetEmail.split("@")[0] || "",
        ).trim();

        try {
          const { record, filename, script } = await createBoundClientVpsBundle({
            username: targetUsername,
            email: targetEmail,
            ports: body.ports,
            guardIp: body.guardIp,
            enableXdp: body.enableXdp,
          });

          if (body.format === "script") {
            return new Response(script, {
              status: 200,
              headers: {
                "Content-Type": "text/x-shellscript; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
              },
            });
          }

          return Response.json(
            {
              ok: true,
              filename,
              agentId: record.agentId,
              tenantId: record.tenantId,
              username: record.username,
              email: record.email,
              tokenFingerprint: record.tokenFingerprint,
              ports: record.ports,
              createdAt: record.createdAt,
              runCommand: `sudo bash ${filename}`,
              script,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Bundle generation failed" },
            { status: 400 },
          );
        }
      },
    },
  },
});
