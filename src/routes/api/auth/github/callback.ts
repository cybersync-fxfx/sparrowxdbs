import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          githubOAuthCredentials,
          resolveCanonicalGithubRedirectUri,
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
        const rate = checkDbRateLimit(`github-oauth-cb:${ip}`, 30, 60_000);
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
          return failRedirect("GitHub sign-in was cancelled.");
        }

        const code = reqUrl.searchParams.get("code");
        const stateMatchesCookie =
          Boolean(verifiedCookieState && stateParam) &&
          (timingSafeEqual(stateParam, verifiedCookieState!.nonce) ||
            (Boolean(verifiedParamState) &&
              timingSafeEqual(verifiedParamState!.nonce, verifiedCookieState!.nonce)));

        if (!code || !verifiedState || !stateParam || !stateMatchesCookie) {
          return failRedirect("GitHub sign-in session expired. Please try again.");
        }

        const { clientId, clientSecret } = githubOAuthCredentials();
        if (!clientId || !clientSecret) {
          return failRedirect("GitHub OAuth credentials are not configured on this server.");
        }

        try {
          const redirectUri = resolveCanonicalGithubRedirectUri(verifiedState.origin);

          const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (!tokenRes.ok) {
            return failRedirect("GitHub token exchange failed. Please try signing in again.");
          }

          const tokenData = (await tokenRes.json()) as { access_token?: string };
          if (!tokenData.access_token) {
            return failRedirect("GitHub did not return an access token.");
          }

          const ghHeaders = {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "SparrowX-OAuth/1.0",
          };

          const [profileRes, emailsRes] = await Promise.all([
            fetch("https://api.github.com/user", {
              headers: ghHeaders,
              signal: AbortSignal.timeout(8000),
            }),
            fetch("https://api.github.com/user/emails", {
              headers: ghHeaders,
              signal: AbortSignal.timeout(8000),
            }),
          ]);

          if (!profileRes.ok) {
            return failRedirect("Could not read your verified GitHub profile.");
          }

          const profile = (await profileRes.json()) as {
            id?: number | string;
            login?: string;
            name?: string | null;
            email?: string | null;
          };

          let verifiedEmail = "";
          if (emailsRes.ok) {
            const emails = (await emailsRes.json()) as Array<{
              email?: string;
              primary?: boolean;
              verified?: boolean;
            }>;
            const primaryVerified = emails.find((e) => e.primary && e.verified && e.email);
            const anyVerified = emails.find((e) => e.verified && e.email);
            verifiedEmail = (primaryVerified?.email || anyVerified?.email || "").trim().toLowerCase();
          }

          if (!verifiedEmail && profile.email) {
            verifiedEmail = profile.email.trim().toLowerCase();
          }

          if (!verifiedEmail) {
            return failRedirect("Your GitHub account must have a verified email address.");
          }

          const user = await upsertGoogleSsoUserInDb({
            email: verifiedEmail,
            fullName: profile.name || profile.login || verifiedEmail.split("@")[0] || "Operator",
            googleSub: profile.id ? `github:${profile.id}` : null,
          });

          // Proactively provision/link Pterodactyl Game Panel user on sign-in
          await import("@/lib/server/portal.server")
            .then(({ syncPteroAccountOnSignIn }) =>
              Promise.race([
                syncPteroAccountOnSignIn(user),
                new Promise((resolve) => setTimeout(resolve, 2500)),
              ]),
            )
            .catch(() => {});

          const masterToken = await createMasterSsoToken(user);
          const dest = new URL(fallbackNext);
          dest.searchParams.delete("auth_error");
          dest.searchParams.set("google_auth", "1");

          void import("@/lib/server/discord-webhook.server")
            .then(({ sendDiscordTelemetry }) =>
              sendDiscordTelemetry({
                category: "auth",
                severity: "info",
                service: "SparrowX GitHub OAuth SSO",
                title: `User Signed In (GitHub) — ${user.email}`,
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
        } catch {
          return failRedirect("GitHub sign-in encountered a network error. Please try again.");
        }
      },
    },
  },
});
