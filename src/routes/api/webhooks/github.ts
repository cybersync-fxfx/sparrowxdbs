import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
        const ip = extractClientIp(request);
        const rate = checkDbRateLimit(`github-webhook:${ip}`, 60, 60_000);
        if (!rate.allowed) {
          return Response.json(
            { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
          );
        }

        const webhookSecret =
          process.env.GITHUB_WEBHOOK_SECRET?.trim() ||
          process.env.SPARROWX_GITHUB_WEBHOOK_SECRET?.trim() ||
          "";
        if (!webhookSecret) {
          return Response.json(
            { ok: false, error: "GitHub webhook secret not configured." },
            { status: 503 },
          );
        }

        const rawBody = await request.text();
        const sigHeader = request.headers.get("x-hub-signature-256");
        const { verifyGithubWebhookSignature } = await import("@/lib/server/deploy-crypto.server");

        const valid = verifyGithubWebhookSignature(rawBody, sigHeader, webhookSecret);
        if (!valid) {
          return Response.json(
            { ok: false, error: "Invalid X-Hub-Signature-256 signature." },
            { status: 401 },
          );
        }

        const eventType = request.headers.get("x-github-event") || "unknown";
        const deliveryId = request.headers.get("x-github-delivery");

        if (eventType === "ping") {
          return Response.json({ ok: true, pong: true, deliveryId });
        }
        if (eventType !== "push") {
          return Response.json({ ok: true, ignored: true, eventType });
        }

        let payload: {
          ref?: string;
          after?: string;
          repository?: { clone_url?: string; html_url?: string };
          head_commit?: { id?: string; message?: string; author?: { name?: string } };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: false, error: "Malformed webhook JSON." }, { status: 400 });
        }

        const ref = String(payload.ref || "");
        if (!ref.startsWith("refs/heads/")) {
          return Response.json({ ok: true, ignored: true, reason: "non-branch ref" });
        }
        const branch = ref.slice("refs/heads/".length);
        const repoUrl = payload.repository?.html_url || payload.repository?.clone_url || "";
        if (!repoUrl) {
          return Response.json({ ok: false, error: "Missing repository URL." }, { status: 400 });
        }

        const { handleGithubPushWebhook } = await import("@/lib/server/deploy-store.server");
        const res = await handleGithubPushWebhook({
          deliveryId,
          eventType,
          repoUrl,
          branch,
          ...(payload.head_commit?.id || payload.after
            ? { commitSha: (payload.head_commit?.id || payload.after || "").slice(0, 8) }
            : {}),
          ...(payload.head_commit?.message ? { commitMessage: payload.head_commit.message } : {}),
          ...(payload.head_commit?.author?.name
            ? { commitAuthor: payload.head_commit.author.name }
            : {}),
          signatureValid: true,
        });

        return Response.json({ ok: true, ...res }, { status: 202 });
      },
    },
  },
});
