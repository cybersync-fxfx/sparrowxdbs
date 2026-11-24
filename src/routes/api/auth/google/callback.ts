import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          googleOAuthCredentials,
          resolveCanonicalGoogleRedirectUri,
        } = await import("@/lib/server/config.server");
        const { timingSafeEqual } = await import("@/lib/server/crypto.server");
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const {
          GOOGLE_OAUTH_STATE_COOKIE,
          buildGoogleStateCookieHeader,
          buildMasterSsoCookieHeader,
          buildUnifiedClientSessionCookieHeader,
          createMasterSsoToken,
          extractCookieValue,
          sanitizeGoogleNextUrl,
          upsertGoogleSsoUserInDb,
          verifyGoogleOAuthState,
        } = await import("@/lib/server/master-sso.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`google-oauth-cb:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many requests. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const reqUrl = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const stateParam = reqUrl.searchParams.get("state") || "";

        const rawStateCookie = extractCookieValue(
          request.headers.get("cookie"),
          GOOGLE_OAUTH_STATE_COOKIE,
        );
        const verifiedCookieState = await verifyGoogleOAuthState(rawStateCookie);
        const verifiedParamState = await verifyGoogleOAuthState(stateParam);
        const verifiedState = verifiedCookieState ?? verifiedParamState;
        const fallbackNext = sanitizeGoogleNextUrl(verifiedState?.next, origin);

        const failRedirect = (message: string) => {
          const dest = new URL(fallbackNext);
          if (dest.pathname === "/game/dashboard") dest.pathname = "/game";
          else if (dest.pathname === "/infra/dashboard") dest.pathname = "/infra";
          dest.searchParams.set("auth_error", message);
          const headers = new Headers();
          headers.set("Location", dest.toString());
          headers.set("Cache-Control", "no-store");
          headers.append("Set-Cookie", buildGoogleStateCookieHeader(request, "", 0));
          return new Response(null, { status: 302, headers });
        };

        const oauthError = reqUrl.searchParams.get("error");
        if (oauthError) {
          return failRedirect("Google sign-in was cancelled.");
        }

        const code = reqUrl.searchParams.get("code");
        const stateMatchesCookie =
          Boolean(verifiedCookieState && stateParam) &&
          (timingSafeEqual(stateParam, verifiedCookieState!.nonce) ||
            (Boolean(verifiedParamState) &&
              timingSafeEqual(verifiedParamState!.nonce, verifiedCookieState!.nonce)));
        const stateValid = stateMatchesCookie || Boolean(verifiedParamState);

        if (!code || !verifiedState || !stateParam || !stateValid) {
          return failRedirect("Google sign-in session expired. Please try again.");
        }

        const { clientId, clientSecret } = googleOAuthCredentials();
        if (!clientId || !clientSecret) {
          return failRedirect("Google OAuth credentials are not configured on this server.");
        }

        try {
          const redirectUri = resolveCanonicalGoogleRedirectUri(verifiedState.origin);

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text().catch(() => "");
            console.error(`[SparrowX Google OAuth] Token exchange failed [${tokenRes.status}]:`, errText);
            return failRedirect("Google token exchange failed. Verify your Redirect URI in Google Console.");
          }

          const tokenData = (await tokenRes.json()) as { access_token?: string };
          if (!tokenData.access_token) {
            return failRedirect("Google did not return an access token.");
          }

          const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            signal: AbortSignal.timeout(8000),
          });

          if (!profileRes.ok) {
            return failRedirect("Could not read your verified Google profile.");
          }

          const profile = (await profileRes.json()) as {
            sub?: string;
            email?: string;
            email_verified?: boolean;
            name?: string;
          };

          if (!profile.email || profile.email_verified === false) {
            return failRedirect("Your Google account must have a verified email address.");
          }

          const user = await upsertGoogleSsoUserInDb({
            email: profile.email,
            fullName: profile.name || profile.email.split("@")[0] || "Operator",
            googleSub: profile.sub || null,
          });

          const masterToken = await createMasterSsoToken(user);
          const dest = new URL(fallbackNext);
          dest.searchParams.delete("auth_error");
          dest.searchParams.set("google_auth", "1");

          void import("@/lib/server/discord-webhook.server")
            .then(({ sendDiscordTelemetry }) =>
              sendDiscordTelemetry({
                category: "auth",
                severity: "info",
                service: "SparrowX Google OAuth SSO",
                title: `User Signed In — ${user.email}`,
                ip,
                userAgent: request.headers.get("user-agent") || undefined,
                url: dest.toString(),
                fields: {
                  Email: user.email,
                  Name: user.fullName,
                  Role: user.role,
                  "User ID": user.id,
                  Destination: dest.hostname + dest.pathname,
                },
              }),
            )
            .catch(() => {});

          const headers = new Headers();
          headers.set("Location", dest.toString());
          headers.set("Cache-Control", "no-store");
          headers.append("Set-Cookie", buildGoogleStateCookieHeader(request, "", 0));
          headers.append("Set-Cookie", buildMasterSsoCookieHeader(request, masterToken));
          headers.append("Set-Cookie", buildUnifiedClientSessionCookieHeader(request, user));
          return new Response(null, { status: 302, headers });
        } catch (err) {
          console.error("[SparrowX Google OAuth] Callback error:", err);
          return failRedirect("Google sign-in encountered a network error. Please try again.");
        }
      },
    },
  },
});
