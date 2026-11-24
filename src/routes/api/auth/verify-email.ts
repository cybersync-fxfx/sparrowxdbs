import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/verify-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();
        const token = (url.searchParams.get("token") || "").trim();
        const statusOnly = url.searchParams.get("status") === "1";

        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
        const { isEmailVerifiedInDb, verifyEmailCodeOrToken } = await import(
          "@/lib/server/email-verification.server"
        );
        const { getSmtpConfig } = await import("@/lib/server/email.server");
        const origin = resolveRequestOrigin(request);

        try {
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Verification service temporarily unavailable.";
          if (email && token) {
            return new Response(null, {
              status: 302,
              headers: {
                Location: `${origin}/?email_verified=0&error=${encodeURIComponent(message)}`,
                "Cache-Control": "no-store",
              },
            });
          }
          return Response.json(
            { ok: false, error: message },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const { resolveRequestOrigin } = await import("@/lib/server/http.server");
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

        try {
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

          const origin = resolveRequestOrigin(request);
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Email verification request failed.";
          const { sendDiscordTelemetry } = await import("@/lib/server/discord-webhook.server");
          void sendDiscordTelemetry({
            category: "error",
            severity: "high",
            service: "SMTP Email Verification",
            title: `Email Verification Failure (${action})`,
            description: message,
            ip,
            fields: { Email: email },
          });
          return Response.json(
            {
              ok: false,
              error: message,
            },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
