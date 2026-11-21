import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/verify-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();
        const token = (url.searchParams.get("token") || "").trim();
        const statusOnly = url.searchParams.get("status") === "1";

        const { isEmailVerifiedInDb, verifyEmailCodeOrToken } = await import(
          "@/lib/server/email-verification.server"
        );
        const { getSmtpConfig } = await import("@/lib/server/email.server");

        if (statusOnly) {
          const verified = email ? await isEmailVerifiedInDb(email) : false;
          return Response.json(
            {
              ok: true,
              email,
              verified,
              smtpConfigured: getSmtpConfig().configured,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        if (email && token) {
          const res = await verifyEmailCodeOrToken({ email, token });
          const origin = `${url.protocol}//${url.host}`;
          const target = res.verified
            ? `${origin}/?email_verified=1&email=${encodeURIComponent(email)}`
            : `${origin}/?email_verified=0&error=${encodeURIComponent(res.error || "Invalid or expired verification link")}`;
          return new Response(null, {
            status: 302,
            headers: {
              Location: target,
              "Cache-Control": "no-store",
            },
          });
        }

        return Response.json(
          { ok: false, error: "Provide ?status=1&email=... or ?email=...&token=..." },
          { status: 400 },
        );
      },

      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const { issueAndSendEmailVerification, verifyEmailCodeOrToken } = await import(
          "@/lib/server/email-verification.server"
        );

        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`email-verify:${ip}`, 20, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Too many requests. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        let body: {
          action?: "send" | "verify";
          email?: string;
          code?: string;
          token?: string;
          fullName?: string;
          userId?: string | null;
          serviceName?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        const action = body.action || (body.code || body.token ? "verify" : "send");
        const email = String(body.email || "").trim().toLowerCase();
        if (!email) {
          return Response.json({ ok: false, error: "Email address is required." }, { status: 400 });
        }

        if (action === "verify") {
          const result = await verifyEmailCodeOrToken({
            email,
            ...(body.code ? { code: String(body.code) } : {}),
            ...(body.token ? { token: String(body.token) } : {}),
          });
          return Response.json(result, {
            status: result.verified ? 200 : 400,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const reqUrl = new URL(request.url);
        const origin = `${reqUrl.protocol}//${reqUrl.host}`;
        const sendResult = await issueAndSendEmailVerification({
          email,
          fullName: body.fullName,
          userId: body.userId ?? null,
          serviceName: body.serviceName,
          origin,
        });

        return Response.json(sendResult, {
          status: sendResult.ok ? 200 : sendResult.retryAfterSeconds ? 429 : 400,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
