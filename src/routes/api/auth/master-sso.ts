import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/master-sso")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
        const claims = await readMasterSsoFromRequest(request);
        if (!claims) {
          return Response.json(
            { ok: false, authenticated: false, error: "No active SparrowX Master SSO session." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        return Response.json(
          {
            ok: true,
            authenticated: true,
            user: {
              id: claims.sub,
              email: claims.email,
              fullName: claims.fullName,
              role: claims.role,
              tenantId: claims.tenantId,
              exp: claims.exp,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        const {
          authenticateMasterCredentialsInDb,
          buildMasterSsoCookieHeader,
          buildUnifiedClientSessionCookieHeader,
          createMasterSsoToken,
        } = await import("@/lib/server/master-sso.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`master-sso:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many requests. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: {
          email?: string;
          password?: string;
          mode?: "signin" | "register";
          id?: string;
          fullName?: string;
          tenantId?: string | null;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!email || !password) {
          return Response.json(
            { ok: false, error: "Email and password are required to issue Master SSO." },
            { status: 400 },
          );
        }

        const authResult = await authenticateMasterCredentialsInDb({
          email,
          password,
          ...(body.mode === "register"
            ? {
                registerIfMissing: {
                  ...(body.id ? { id: body.id } : {}),
                  ...(body.fullName ? { fullName: body.fullName } : {}),
                  tenantId: body.tenantId ?? null,
                },
              }
            : {}),
        });

        if (!authResult.user) {
          return Response.json(
            { ok: false, error: "Credentials did not verify against PostgreSQL." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        const ssoToken = await createMasterSsoToken(authResult.user);
        const postHeaders = new Headers();
        postHeaders.set("Cache-Control", "no-store");
        postHeaders.append("Set-Cookie", buildMasterSsoCookieHeader(request, ssoToken));
        postHeaders.append("Set-Cookie", buildUnifiedClientSessionCookieHeader(request, authResult.user));
        return Response.json(
          {
            ok: true,
            authenticated: true,
            source: authResult.source,
            user: authResult.user,
          },
          { headers: postHeaders },
        );
      },

      DELETE: async ({ request }) => {
        const {
          buildMasterSsoCookieHeader,
          buildUnifiedClientSessionCookieHeader,
        } = await import("@/lib/server/master-sso.server");
        const delHeaders = new Headers();
        delHeaders.set("Cache-Control", "no-store");
        delHeaders.append("Set-Cookie", buildMasterSsoCookieHeader(request, "", 0));
        delHeaders.append("Set-Cookie", buildUnifiedClientSessionCookieHeader(request, null, 0));
        return Response.json(
          { ok: true, authenticated: false },
          { headers: delHeaders },
        );
      },
    },
  },
});
