import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoolifyTenantTraefikLabels,
  buildHostOnlySessionCookie,
  isNoIndexHost,
  RESERVED_SUBDOMAINS,
  resolveApiCorsHeaders,
  validateTenantSlug,
} from "../lib/server/tenant-security.server";

describe("SparrowX Tenant Slug Validator & Reserved Subdomain Blocklist", () => {
  it("accepts valid lowercase alphanumeric & hyphenated slugs (4–32 chars)", () => {
    for (const valid of [
      "acme",
      "my-app-01",
      "alpha-bot-2026",
      "a".repeat(32),
      "n8n-prod-west",
    ]) {
      const res = validateTenantSlug(valid);
      expect(res).toEqual({ ok: true, slug: valid });
    }
  });

  it("rejects slugs violating ^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$", () => {
    for (const invalid of [
      "",
      "ab",
      "abc", // too short (3 chars; min is 4)
      "a".repeat(33), // too long (33 chars; max is 32)
      "-leading",
      "trailing-",
      "UpperCase",
      "has_underscore",
      "has.dot",
      "space slug",
      "semi;colon",
    ]) {
      const res = validateTenantSlug(invalid);
      expect(res.ok).toBe(false);
    }
  });

  it("blocks every reserved SparrowX subdomain slug", () => {
    const mustBlock = [
      "www",
      "api",
      "admin",
      "console",
      "panel",
      "db",
      "sec",
      "dpdp",
      "ingest",
      "file",
      "password",
      "ai",
      "deploy",
      "agents",
      "mail",
      "smtp",
      "status",
      "auth",
      "billing",
      "support",
      "sparrowx",
      "root",
      "system",
    ];
    for (const reserved of mustBlock) {
      expect(RESERVED_SUBDOMAINS.has(reserved)).toBe(true);
      expect(validateTenantSlug(reserved).ok).toBe(false);
    }
  });
});

describe("Cookie Isolation (__Host-) & Strict CORS on api.sparrowx.net", () => {
  it("builds strict __Host- cookies with Secure, HttpOnly, Path=/ and NO Domain attribute", () => {
    const cookie = buildHostOnlySessionCookie("session", "tok_12345");
    expect(cookie).toContain("__Host-session=tok_12345");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie.toLowerCase()).not.toContain("domain=");
  });

  it("locks api.sparrowx.net CORS strictly to console & admin origins", () => {
    const consoleCors = resolveApiCorsHeaders("https://console.sparrowx.net");
    expect(consoleCors?.["Access-Control-Allow-Origin"]).toBe("https://console.sparrowx.net");
    expect(consoleCors?.["Access-Control-Allow-Credentials"]).toBe("true");

    const adminCors = resolveApiCorsHeaders("https://admin.sparrowx.net");
    expect(adminCors?.["Access-Control-Allow-Origin"]).toBe("https://admin.sparrowx.net");

    expect(resolveApiCorsHeaders("*")).toBeNull();
    expect(resolveApiCorsHeaders("http://console.sparrowx.net")).toBeNull();
    expect(resolveApiCorsHeaders("https://customer.deploy.sparrowx.net")).toBeNull();
    expect(resolveApiCorsHeaders("https://customer.ai.sparrowx.net")).toBeNull();
    expect(resolveApiCorsHeaders("https://evil.example")).toBeNull();
  });

  it("classifies private portals and wildcard tenant subdomains as NOINDEX", () => {
    for (const noindexHost of [
      "console.sparrowx.net",
      "admin.sparrowx.net",
      "panel.sparrowx.net",
      "api.sparrowx.net",
      "ingest.sec.sparrowx.net",
      "ingest.dpdp.sparrowx.net",
      "acme.ai.sparrowx.net",
      "mybot.deploy.sparrowx.net",
    ]) {
      expect(isNoIndexHost(noindexHost)).toBe(true);
    }

    for (const indexableHost of [
      "sparrowx.net",
      "ai.sparrowx.net",
      "deploy.sparrowx.net",
      "agents.sparrowx.net",
      "sec.sparrowx.net",
      "dpdp.sparrowx.net",
      "db.sparrowx.net",
      "file.sparrowx.net",
      "password.sparrowx.net",
    ]) {
      expect(isNoIndexHost(indexableHost)).toBe(false);
    }
  });

  it("generates validated Coolify Traefik labels with SSE/WebSocket streaming & noindex", () => {
    const labels = buildCoolifyTenantTraefikLabels("ai", "acme-flow", 5678);
    expect(labels["traefik.http.routers.tenant-ai-acme-flow.rule"]).toBe(
      "Host(`acme-flow.ai.sparrowx.net`)",
    );
    expect(labels["traefik.http.routers.tenant-ai-acme-flow.middlewares"]).toContain("noindex@file");
    expect(labels["traefik.http.routers.tenant-ai-acme-flow.middlewares"]).toContain(
      "tenant-security-headers@file",
    );
    expect(
      labels["traefik.http.services.tenant-ai-acme-flow.loadbalancer.responseforwarding.flushinterval"],
    ).toBe("-1");

    expect(() => buildCoolifyTenantTraefikLabels("deploy", "admin", 3000)).toThrow(/reserved/i);
  });
});

describe("Traefik v3 Config & Verification Script Integrity", () => {
  const root = process.cwd();

  it("contains static Traefik v3 DNS-01 Cloudflare wildcard config & HTTP/3", () => {
    const traefikYml = fs.readFileSync(path.join(root, "traefik/traefik.yml"), "utf8");
    expect(traefikYml).toContain("provider: cloudflare");
    expect(traefikYml).toContain("*.sparrowx.net");
    expect(traefikYml).toContain("*.ai.sparrowx.net");
    expect(traefikYml).toContain("*.deploy.sparrowx.net");
    expect(traefikYml).toContain("http3:");
    expect(traefikYml).toContain("permanent: true");
  });

  it("contains dynamic routing, TLS 1.2+ AEAD, sniStrict, admin ipAllowList, and single-hop 301s", () => {
    const routingYml = fs.readFileSync(path.join(root, "traefik/dynamic/routing.yml"), "utf8");
    expect(routingYml).toContain("minVersion: VersionTLS12");
    expect(routingYml).toContain("sniStrict: true");
    expect(routingYml).toContain("admin-ip-allowlist:");
    expect(routingYml).toContain("X-Robots-Tag: \"noindex, nofollow\"");
    expect(routingYml).toContain("flushInterval: \"-1\"");
    expect(routingYml).toContain("Host(`dpdp.sparrowx.net`)");
    expect(routingYml).toContain("Host(`ingest.dpdp.sparrowx.net`)");
    expect(routingYml).toContain("Host(`ingest.sec.sparrowx.net`)");
    expect(routingYml).toContain("PathPrefix(`/webhooks/whatsapp`)");
    expect(routingYml).toContain("redirect-www-to-apex");
    expect(routingYml).toContain("redirect-game-subdomain");
    expect(routingYml).toContain("redirect-db-game-leak");
    expect(routingYml).toContain("redirect-sec-story-leak");
  });

  it("ships executable verify-routing.sh script", () => {
    const script = fs.readFileSync(path.join(root, "scripts/verify-routing.sh"), "utf8");
    expect(script).toContain("admin.sparrowx.net");
    expect(script).toContain("x-robots-tag");
    expect(script).toContain("unmapped-rogue-host.invalid");
  });
});
