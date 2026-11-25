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
        const { sendDiscordTelemetry } = await import("@/lib/server/discord-webhook.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`master-sso:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          void sendDiscordTelemetry({
            category: "security",
            severity: "high",
            service: "Master SSO Auth",
            title: "Auth Rate Limit Triggered",
            ip,
            fields: { RetryAfterSec: rate.retryAfterSec },
          });
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
          void sendDiscordTelemetry({
            category: "security",
            severity: "medium",
            service: "Master SSO Auth",
            title: `Failed ${body.mode === "register" ? "Sign Up" : "Sign In"} Attempt`,
            ip,
            fields: { Email: email, Mode: body.mode || "signin" },
          });
          return Response.json(
            { ok: false, error: "Credentials did not verify against PostgreSQL." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        void sendDiscordTelemetry({
          category: "auth",
          severity: "info",
          service: "Master SSO Auth",
          title: body.mode === "register" ? "New User Registered" : "User Signed In",
          ip,
          fields: {
            Email: authResult.user.email,
            FullName: authResult.user.fullName,
            Role: authResult.user.role,
            Source: authResult.source,
          },
        });

        // Proactively provision/link Pterodactyl Game Panel user on signup / sign-in
        await import("@/lib/server/portal.server")
          .then(({ syncPteroAccountOnSignIn }) =>
            Promise.race([
              syncPteroAccountOnSignIn(authResult.user!),
              new Promise((resolve) => setTimeout(resolve, 2500)),
            ]),
          )
          .catch(() => {});

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
