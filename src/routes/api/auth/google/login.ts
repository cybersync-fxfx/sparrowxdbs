import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/google/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = await import("@/lib/server/config.server");
        const { randomToken } = await import("@/lib/server/crypto.server");
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const {
          buildGoogleStateCookieHeader,
          createGoogleOAuthState,
          sanitizeGoogleNextUrl,
        } = await import("@/lib/server/master-sso.server");

        const reqUrl = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const nextUrl = sanitizeGoogleNextUrl(reqUrl.searchParams.get("next"), origin);

        const clientId = env("GOOGLE_CLIENT_ID");
        if (!clientId) {
          const errDest = new URL(nextUrl);
          errDest.searchParams.set("auth_error", "Google Auth is not configured on this server yet.");
          return new Response(null, {
            status: 302,
            headers: { Location: errDest.toString(), "Cache-Control": "no-store" },
          });
        }

        const nonce = randomToken(18);
        const signedState = await createGoogleOAuthState({
          nonce,
          next: nextUrl,
          origin,
          ttlSeconds: 600,
        });

        const redirectUri =
          env("GOOGLE_REDIRECT_URI") || `${origin}/api/auth/google/callback`;

        const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        googleAuthUrl.searchParams.set("client_id", clientId);
        googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
        googleAuthUrl.searchParams.set("response_type", "code");
        googleAuthUrl.searchParams.set("scope", "openid email profile");
        googleAuthUrl.searchParams.set("access_type", "online");
        googleAuthUrl.searchParams.set("prompt", "select_account");
        googleAuthUrl.searchParams.set("state", nonce);

        const headers = new Headers();
        headers.set("Location", googleAuthUrl.toString());
        headers.set("Cache-Control", "no-store");
        headers.append("Set-Cookie", buildGoogleStateCookieHeader(request, signedState, 600));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
