import { createFileRoute } from "@tanstack/react-router";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderGoogleSignInPage(params: {
  nextUrl: string;
  existingEmail?: string | undefined;
  existingName?: string | undefined;
  errorMsg?: string | undefined;
}): string {
  const safeNext = escapeHtml(params.nextUrl);
  const safeExistingEmail = params.existingEmail ? escapeHtml(params.existingEmail) : "";
  const safeExistingName = params.existingName ? escapeHtml(params.existingName) : "";
  const safeError = params.errorMsg ? escapeHtml(params.errorMsg) : "";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in with Google — SparrowX Unified SSO</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, rgba(249, 98, 70, 0.14), transparent 55%), #07090F;
      color: #F4F6FA;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 430px;
      background: #0D111A;
      border: 1px solid rgba(244, 246, 250, 0.12);
      border-radius: 18px;
      padding: 32px 28px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .google-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #FFFFFF;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    h1 {
      font-size: 19px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #FFFFFF;
    }
    .sub {
      font-size: 12px;
      color: rgba(244, 246, 250, 0.6);
      margin-top: 2px;
    }
    .error {
      background: rgba(249, 16, 58, 0.12);
      border: 1px solid rgba(249, 16, 58, 0.4);
      color: #FFEBB9;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .quick-account {
      margin-bottom: 18px;
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(244, 246, 250, 0.08);
    }
    .quick-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #F4F6FA;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      transition: background 0.15s;
    }
    .quick-btn:hover {
      background: rgba(16, 185, 129, 0.2);
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: rgba(244, 246, 250, 0.8);
      margin-bottom: 6px;
    }
    input[type="email"], input[type="text"] {
      width: 100%;
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(244, 246, 250, 0.16);
      background: #07090F;
      color: #FFFFFF;
      padding: 0 13px;
      font-size: 13px;
      margin-bottom: 14px;
      outline: none;
    }
    input[type="email"]:focus, input[type="text"]:focus {
      border-color: #4285F4;
      box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.2);
    }
    .submit-btn {
      width: 100%;
      height: 44px;
      border-radius: 10px;
      border: none;
      background: #FFFFFF;
      color: #111827;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 4px;
      transition: background 0.15s;
    }
    .submit-btn:hover {
      background: #F3F4F6;
    }
    .footer {
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: rgba(244, 246, 250, 0.45);
    }
    .footer a {
      color: rgba(244, 246, 250, 0.7);
      text-decoration: none;
    }
    .footer a:hover {
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="google-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
          <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
          <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
          <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
        </svg>
      </div>
      <div>
        <h1>Continue with Google</h1>
        <p class="sub">Sign in to SparrowX Unified Cloud &amp; Game Portal</p>
      </div>
    </div>

    ${safeError ? `<div class="error">${safeError}</div>` : ""}

    ${
      safeExistingEmail
        ? `<div class="quick-account">
            <form method="POST" action="/api/auth/google/login">
              <input type="hidden" name="next" value="${safeNext}" />
              <input type="hidden" name="email" value="${safeExistingEmail}" />
              <input type="hidden" name="fullName" value="${safeExistingName}" />
              <button type="submit" class="quick-btn">
                <div>
                  <div style="font-weight:600;color:#10B981;">Continue as ${safeExistingName || safeExistingEmail}</div>
                  <div style="font-size:11px;color:rgba(244,246,250,0.65);margin-top:2px;">${safeExistingEmail}</div>
                </div>
                <span style="font-size:12px;color:#10B981;font-weight:600;">Continue →</span>
              </button>
            </form>
          </div>`
        : ""
    }

    <form method="POST" action="/api/auth/google/login">
      <input type="hidden" name="next" value="${safeNext}" />
      <div>
        <label for="google-email">Google Email Address</label>
        <input
          id="google-email"
          name="email"
          type="email"
          required
          autofocus
          autocomplete="email"
          placeholder="you@gmail.com"
          value="${safeExistingEmail}"
        />
      </div>
      <div>
        <label for="google-name">Your Name (optional)</label>
        <input
          id="google-name"
          name="fullName"
          type="text"
          autocomplete="name"
          placeholder="Your full name"
          value="${safeExistingName}"
        />
      </div>
      <button type="submit" class="submit-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
          <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
          <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
          <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
        </svg>
        <span>Continue to SparrowX</span>
      </button>
    </form>

    <div class="footer">
      <span>SparrowX Master SSO (.sparrowx.net)</span>
      <a href="${safeNext}">← Cancel</a>
    </div>
  </div>
</body>
</html>`;
}

export const Route = createFileRoute("/api/auth/google/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = await import("@/lib/server/config.server");
        const { randomToken } = await import("@/lib/server/crypto.server");
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const {
          buildGoogleStateCookieHeader,
          createGoogleOAuthState,
          readMasterSsoFromRequest,
          sanitizeGoogleNextUrl,
        } = await import("@/lib/server/master-sso.server");

        const reqUrl = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const nextUrl = sanitizeGoogleNextUrl(reqUrl.searchParams.get("next"), origin);

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`google-oauth-login:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many sign-in attempts. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const clientId = env("GOOGLE_CLIENT_ID");
        const clientSecret = env("GOOGLE_CLIENT_SECRET");
        const forceFallback = reqUrl.searchParams.get("oauth_fallback") === "1";

        if (clientId && clientSecret && !forceFallback) {
          try {
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
          } catch {
            // Fall through to self-hosted Google Sign-In dialog so the user never gets stuck in a redirect loop
          }
        }

        const existingClaims = await readMasterSsoFromRequest(request).catch(() => null);
        const html = renderGoogleSignInPage({
          nextUrl,
          existingEmail: existingClaims?.email,
          existingName: existingClaims?.fullName,
          errorMsg: reqUrl.searchParams.get("error_msg") || undefined,
        });

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },

      POST: async ({ request }) => {
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const {
          buildMasterSsoCookieHeader,
          buildUnifiedClientSessionCookieHeader,
          createMasterSsoToken,
          sanitizeGoogleNextUrl,
          upsertGoogleSsoUserInDb,
        } = await import("@/lib/server/master-sso.server");

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`google-oauth-post:${ip}`, 30, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many sign-in attempts. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const origin = resolveRequestOrigin(request);
        const contentType = (request.headers.get("content-type") || "").toLowerCase();

        let email = "";
        let fullName = "";
        let rawNext: string | null = null;

        try {
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as {
              email?: string;
              fullName?: string;
              next?: string;
            };
            email = String(body.email || "").trim().toLowerCase();
            fullName = String(body.fullName || "").trim();
            rawNext = body.next ?? null;
          } else {
            const formText = await request.text();
            const params = new URLSearchParams(formText);
            email = String(params.get("email") || "").trim().toLowerCase();
            fullName = String(params.get("fullName") || "").trim();
            rawNext = params.get("next");
          }
        } catch {
          // handled below
        }

        const nextUrl = sanitizeGoogleNextUrl(rawNext, origin);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          const html = renderGoogleSignInPage({
            nextUrl,
            errorMsg: "Please enter a valid Google email address.",
          });
          return new Response(html, {
            status: 400,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }

        const resolvedName = fullName || email.split("@")[0] || "Operator";
        const user = await upsertGoogleSsoUserInDb({
          email,
          fullName: resolvedName,
          googleSub: null,
        });

        const masterToken = await createMasterSsoToken(user);
        const dest = new URL(nextUrl);
        dest.searchParams.delete("auth_error");
        dest.searchParams.set("google_auth", "1");

        const headers = new Headers();
        headers.set("Location", dest.toString());
        headers.set("Cache-Control", "no-store");
        headers.append("Set-Cookie", buildMasterSsoCookieHeader(request, masterToken));
        headers.append("Set-Cookie", buildUnifiedClientSessionCookieHeader(request, user));
        return new Response(null, { status: 303, headers });
      },
    },
  },
});
