import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMasterSsoToken, MASTER_SSO_COOKIE_NAME } from "@/lib/server/master-sso.server";
import { extractClientIp } from "@/lib/server/db-auth.server";
import {
  clearInfraServerStoreForTests,
  provisionServerFromPaidOrder,
} from "@/lib/server/proxmox.server";

async function makeSsoCookie(email: string, role: "admin" | "client" = "client"): Promise<string> {
  const token = await createMasterSsoToken({
    id: `usr_${email.replace(/[^a-z0-9]/gi, "")}`,
    email,
    fullName: email.split("@")[0] || "User",
    role,
    tenantId: `tnt_${email.replace(/[^a-z0-9]/gi, "")}`,
  });
  return `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

describe("Full-Platform Security Audit & Regression Guards", () => {
  it("A01: enforces admin-only RBAC on /api/ai/admin (401 unauth, 403 client, 200 admin)", async () => {
    const { Route: aiAdminRoute } = await import("@/routes/api/ai/admin");
    const getHandler = (aiAdminRoute.options.server as any)?.handlers?.GET;
    const postHandler = (aiAdminRoute.options.server as any)?.handlers?.POST;

    const unauthGet = await getHandler({
      request: new Request("https://ai.sparrowx.net/api/ai/admin", {
        headers: { "x-real-ip": "198.51.100.10" },
      }),
    });
    expect(unauthGet.status).toBe(401);

    const unauthPost = await postHandler({
      request: new Request("https://ai.sparrowx.net/api/ai/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.11" },
        body: JSON.stringify({ action: "suspend", instanceId: "inst-langflow-bom1" }),
      }),
    });
    expect(unauthPost.status).toBe(401);

    const clientCookie = await makeSsoCookie("regular@startup.in", "client");
    const clientGet = await getHandler({
      request: new Request("https://ai.sparrowx.net/api/ai/admin", {
        headers: { Cookie: clientCookie, "x-real-ip": "198.51.100.12" },
      }),
    });
    expect(clientGet.status).toBe(403);

    const adminCookie = await makeSsoCookie("founder@sparrowx.net", "admin");
    const adminGet = await getHandler({
      request: new Request("https://ai.sparrowx.net/api/ai/admin", {
        headers: { Cookie: adminCookie, "x-real-ip": "198.51.100.13" },
      }),
    });
    expect(adminGet.status).toBe(200);
  });

  it("A01: blocks unauthenticated access, header spoofing, and cross-tenant IDOR on /api/ai/instances", async () => {
    const { Route: aiInstRoute } = await import("@/routes/api/ai/instances");
    const getH = (aiInstRoute.options.server as any)?.handlers?.GET;
    const postH = (aiInstRoute.options.server as any)?.handlers?.POST;
    const patchH = (aiInstRoute.options.server as any)?.handlers?.PATCH;
    const delH = (aiInstRoute.options.server as any)?.handlers?.DELETE;

    // Even with spoofed x-sparrowx-user-email, unauthenticated callers MUST receive 401
    const unauthGet = await getH({
      request: new Request("https://ai.sparrowx.net/api/ai/instances?email=victim@sparrowx.net", {
        headers: { "x-sparrowx-user-email": "victim@sparrowx.net", "x-real-ip": "198.51.100.20" },
      }),
    });
    expect(unauthGet.status).toBe(401);

    const aliceCookie = await makeSsoCookie("alice@company.in", "client");
    const bobCookie = await makeSsoCookie("bob@rival.in", "client");

    const createRes = await postH({
      request: new Request("https://ai.sparrowx.net/api/ai/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceCookie,
          // Attempt to spoof another owner header — must be ignored!
          "x-sparrowx-user-email": "bob@rival.in",
          "x-real-ip": "198.51.100.21",
        },
        body: JSON.stringify({
          name: "alice-private-agent",
          subdomain: `alice-sec-${Date.now().toString(36).slice(-5)}`,
          sourceType: "template",
          templateId: "tpl-mcp-runtime",
          planId: "starter",
          autoProvisionPgVector: false,
          webhookWafEnabled: true,
          kycPhoneVerified: true,
          envVars: [{ key: "TOP_SECRET_TOKEN", value: "spx_alice_secret_9999", isSecret: true }],
        }),
      }),
    });
    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as { instance: { id: string; ownerEmail: string } };
    expect(createdJson.instance.ownerEmail).toBe("alice@company.in");

    // Bob MUST NOT be able to reveal Alice's secret env var
    const bobReveal = await patchH({
      request: new Request("https://ai.sparrowx.net/api/ai/instances", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: bobCookie,
          "x-real-ip": "198.51.100.22",
        },
        body: JSON.stringify({
          action: "reveal_env",
          instanceId: createdJson.instance.id,
          key: "TOP_SECRET_TOKEN",
        }),
      }),
    });
    expect(bobReveal.status).toBe(403);

    // Bob MUST NOT be able to delete Alice's instance
    const bobDel = await delH({
      request: new Request(
        `https://ai.sparrowx.net/api/ai/instances?id=${encodeURIComponent(createdJson.instance.id)}`,
        {
          method: "DELETE",
          headers: { Cookie: bobCookie, "x-real-ip": "198.51.100.23" },
        },
      ),
    });
    expect(bobDel.status).toBe(403);

    // Bob's GET list MUST NOT contain Alice's instance
    const bobList = await getH({
      request: new Request("https://ai.sparrowx.net/api/ai/instances?email=alice@company.in", {
        headers: { Cookie: bobCookie, "x-real-ip": "198.51.100.24" },
      }),
    });
    expect(bobList.status).toBe(200);
    const bobJson = (await bobList.json()) as { instances: Array<{ id: string }> };
    expect(bobJson.instances.some((i) => i.id === createdJson.instance.id)).toBe(false);
  });

  it("A01: blocks horizontal IDOR across /api/infra/servers/* (list, action, console)", async () => {
    clearInfraServerStoreForTests();
    const srv = provisionServerFromPaidOrder({
      orderId: "SPX-TEST-OWNER-1",
      ownerEmail: "owner@company.in",
      planId: "vps-starter",
      planName: "VPS Starter",
      category: "vps",
      hostname: "owner-node.sparrowx.net",
      region: "Mumbai IN-1",
      os: "Ubuntu 24.04 LTS",
      monthlyPriceInr: 849,
    });

    const attackerCookie = await makeSsoCookie("attacker@other.in", "client");
    const { Route: listRoute } = await import("@/routes/api/infra/servers/index");
    const { Route: actionRoute } = await import("@/routes/api/infra/servers/action");
    const { Route: consoleRoute } = await import("@/routes/api/infra/servers/console");

    const listRes = await (listRoute.options.server as any).handlers.GET({
      request: new Request("https://infra.sparrowx.net/api/infra/servers", {
        headers: { Cookie: attackerCookie, "x-real-ip": "198.51.100.30" },
      }),
    });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { servers: Array<{ id: string }> };
    expect(listJson.servers.some((s) => s.id === srv.id)).toBe(false);

    const actionRes = await (actionRoute.options.server as any).handlers.POST({
      request: new Request("https://infra.sparrowx.net/api/infra/servers/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: attackerCookie,
          "x-real-ip": "198.51.100.31",
        },
        body: JSON.stringify({ serverId: srv.id, action: "reset-password" }),
      }),
    });
    expect(actionRes.status).toBe(403);

    const consoleRes = await (consoleRoute.options.server as any).handlers.POST({
      request: new Request("https://infra.sparrowx.net/api/infra/servers/console", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: attackerCookie,
          "x-real-ip": "198.51.100.32",
        },
        body: JSON.stringify({ serverId: srv.id }),
      }),
    });
    expect(consoleRes.status).toBe(403);
    clearInfraServerStoreForTests();
  });

  it("A01/A10: requires auth on /api/shield/cloudflare-autoconfig and blocks private hosts on /api/shield/dns-verify", async () => {
    const { Route: cfRoute } = await import("@/routes/api/shield/cloudflare-autoconfig");
    const cfRes = await (cfRoute.options.server as any).handlers.POST({
      request: new Request("https://sec.sparrowx.net/api/shield/cloudflare-autoconfig", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.40" },
        body: JSON.stringify({ apiToken: "x".repeat(40), domain: "example.com" }),
      }),
    });
    expect(cfRes.status).toBe(401);

    const { Route: dnsRoute } = await import("@/routes/api/shield/dns-verify");
    for (const badHost of ["localhost", "127.0.0.1", "postgres.internal", "printer.local"]) {
      const res = await (dnsRoute.options.server as any).handlers.POST({
        request: new Request("https://sec.sparrowx.net/api/shield/dns-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.41" },
          body: JSON.stringify({ domain: badHost }),
        }),
      });
      expect(res.status).toBe(400);
    }
  });

  it("A01/A04: blocks raw non-browser /api/telemetry/discord spam when Origin & Referer are absent", async () => {
    const { Route: discordRoute } = await import("@/routes/api/telemetry/discord");
    const postH = (discordRoute.options.server as any)?.handlers?.POST;

    const noOrigin = await postH({
      request: new Request("https://sparrowx.net/api/telemetry/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.50" },
        body: JSON.stringify({ category: "audit", title: "curl spam attempt" }),
      }),
    });
    expect(noOrigin.status).toBe(403);

    const evilOrigin = await postH({
      request: new Request("https://sparrowx.net/api/telemetry/discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil-attacker.example",
          "x-real-ip": "198.51.100.51",
        },
        body: JSON.stringify({ category: "audit", title: "cross-origin spam" }),
      }),
    });
    expect(evilOrigin.status).toBe(403);
  });

  it("A01: restricts /api/deploy/internal/ask to internal/loopback callers only", async () => {
    const { Route: askRoute } = await import("@/routes/api/deploy/internal.ask");
    const getH = (askRoute.options.server as any)?.handlers?.GET;

    const externalRes = await getH({
      request: new Request("https://deploy.sparrowx.net/api/deploy/internal/ask?domain=deploy.sparrowx.net", {
        headers: { "x-real-ip": "203.0.113.55" },
      }),
    });
    expect(externalRes.status).toBe(403);

    const internalRes = await getH({
      request: new Request("http://127.0.0.1:3000/api/deploy/internal/ask?domain=deploy.sparrowx.net", {
        headers: { "x-real-ip": "127.0.0.1" },
      }),
    });
    expect(internalRes.status).toBe(200);
  });

  it("A07: prevents CF-Connecting-IP rate-limit spoofing when behind direct Nginx", () => {
    const prev = process.env.SPARROWX_TRUST_CLOUDFLARE;
    delete process.env.SPARROWX_TRUST_CLOUDFLARE;
    try {
      const req = new Request("https://sparrowx.net/api/auth/master-sso", {
        headers: {
          "cf-connecting-ip": "1.2.3.4",
          "x-real-ip": "203.0.113.99",
        },
      });
      expect(extractClientIp(req)).toBe("203.0.113.99");
    } finally {
      if (prev !== undefined) process.env.SPARROWX_TRUST_CLOUDFLARE = prev;
    }
  });

  it("A02/A05: enforces zero hardcoded secrets, zero wildcard CORS, and zero world-open 3306 across infra files", () => {
    const root = process.cwd();
    const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

    // 1. No hardcoded Discord webhook secret in maintenance script
    expect(read("ovh/optimize-and-maintain.sh")).not.toContain("https://discord.com/api/webhooks/");

    // 2. Cryptographic Master SSO & JWT verification in node-server.mjs (no regex/length bypass)
    const nodeSrv = read("ovh/node-server.mjs");
    expect(nodeSrv).toContain("function verifyMasterSsoCookie(");
    expect(nodeSrv).toContain("function verifyHs256Jwt(");
    expect(nodeSrv).not.toContain("function hasMasterSsoCookie(");
    expect(nodeSrv).not.toContain("apiKey.length >= 64");

    // 3. Caddy admin API isolated from untrusted tenant network (no 0.0.0.0:2019)
    expect(read("deploy/Caddyfile.deploy")).not.toContain("0.0.0.0:2019");

    // 4. Zero hardcoded default passwords in Docker Compose & Drizzle config
    for (const file of [
      "docker-compose.ovh.yml",
      "docker-compose.yml",
      "docker-compose.sparrowx.yml",
      "docker-compose.standalone.yml",
      "drizzle.config.ts",
    ]) {
      const content = read(file);
      expect(content).not.toContain("sparrowx_ovh_secret_2026");
      expect(content).not.toContain("SparrowxMasterSecretPass2026!");
      expect(content).not.toContain("sparrowx_jwt_secret_key_32_characters_2026");
      expect(content).not.toContain("super-secret-jwt-token-with-at-least-32-characters-sparrowx");
    }

    // 5. Zero wildcard CORS "*" & zero public UFW 3306 in reverse proxy & deployment scripts
    for (const file of ["ovh/nginx.conf", "Caddyfile", "ovh/update.sh", "ovh/fix.sh", "setup.sh"]) {
      const content = read(file);
      expect(content).not.toContain('Access-Control-Allow-Origin "*"');
    }
    for (const file of ["ovh/update.sh", "ovh/fix.sh"]) {
      const content = read(file);
      expect(content).not.toMatch(/^\s*ufw allow 3306\/tcp/m);
    }
  });
});
