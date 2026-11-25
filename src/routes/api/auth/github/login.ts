import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/github/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          githubOAuthCredentials,
          resolveCanonicalGithubRedirectUri,
        } = await import("@/lib/server/config.server");
        const { randomToken } = await import("@/lib/server/crypto.server");
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const {
          buildGoogleStateCookieHeader,
          createGoogleOAuthState,
          sanitizeGoogleNextUrl,
        } = await import("@/lib/server/master-sso.server");

        const reqUrl = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const nextUrl = sanitizeGoogleNextUrl(reqUrl.searchParams.get("next"), origin);

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`github-oauth-login:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many sign-in attempts. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const { clientId, clientSecret } = githubOAuthCredentials();
        if (!clientId || !clientSecret) {
          const dest = new URL(nextUrl);
          if (dest.pathname === "/game/dashboard") dest.pathname = "/game";
          else if (dest.pathname === "/infra/dashboard") dest.pathname = "/infra";
          dest.searchParams.set("auth_error", "GitHub OAuth is not configured on this server.");
          return new Response(null, {
            status: 302,
            headers: {
              Location: dest.toString(),
              "Cache-Control": "no-store",
            },
          });
        }

        const nonce = randomToken(18);
        const signedState = await createGoogleOAuthState({
          nonce,
          next: nextUrl,
          origin,
          ttlSeconds: 600,
        });

        const redirectUri = resolveCanonicalGithubRedirectUri(origin);

        const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
        githubAuthUrl.searchParams.set("client_id", clientId);
        githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
        githubAuthUrl.searchParams.set("scope", "read:user user:email");
        githubAuthUrl.searchParams.set("state", signedState);

        const headers = new Headers();
        headers.set("Location", githubAuthUrl.toString());
        headers.set("Cache-Control", "no-store");
        headers.append("Set-Cookie", buildGoogleStateCookieHeader(request, signedState, 600));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
