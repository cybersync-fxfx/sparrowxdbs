import { describe, expect, it } from "vitest";
import {
  createBoundClientVpsBundle,
  recordClientVpsHeartbeat,
  sanitizeClientUsername,
  sanitizePortsCsv,
} from "@/lib/server/client-protect.server";

describe("Client VPS Protection Bundle & Heartbeat Security Hardening", () => {
  it("sanitizes usernames and port lists against shell metacharacters", () => {
    expect(sanitizeClientUsername("  Alice $(rm -rf /)!! ")).toBe("alice_rm_-rf");
    expect(sanitizePortsCsv("80, 443, 27015/udp, ;reboot, 999999")).toBe("80,443,27015/udp");
  });

  it("rejects shell injection payloads in email and authenticates heartbeats with timing-safe token check", async () => {
    await expect(
      createBoundClientVpsBundle({
        username: "attacker",
        email: 'bad"$(id)@sparrowx.net',
      }),
    ).rejects.toThrow(/valid client account email/i);

    const bundle = await createBoundClientVpsBundle({
      username: "cyberops",
      email: "ops@sparrowx.net",
      ports: "80,443,27015/udp",
      enableXdp: true,
    });

    expect(bundle.record.agentId).toMatch(/^spx_cyberops_[a-f0-9]{8}$/);
    expect(bundle.script).toContain("SPARROWX_CLIENT_TOKEN=");

    const tokenMatch = bundle.script.match(/SPARROWX_CLIENT_TOKEN="([^"]+)"/);
    expect(tokenMatch?.[1]).toBeTruthy();

    // Wrong token must fail
    const badHb = await recordClientVpsHeartbeat({
      token: "spx_vps_wrong_token_value",
      agentId: bundle.record.agentId,
      hostname: "vps-01",
    });
    expect(badHb).toBeNull();

    // Valid token updates status to PROTECTED
    const okHb = await recordClientVpsHeartbeat({
      token: tokenMatch![1]!,
      agentId: bundle.record.agentId,
      hostname: "vps-edge-01.sparrowx.net",
      publicIp: "139.99.131.135",
      load1m: "0.24",
      synRecv: 3,
    });
    expect(okHb).not.toBeNull();
    expect(okHb?.status).toBe("PROTECTED");
    expect(okHb?.hostname).toBe("vps-edge-01.sparrowx.net");
    expect(okHb?.synRecv).toBe(3);
  });

  it("resolves official Google OAuth credentials, canonical .sparrowx.net callback URI, and cross-subdomain state cookie", async () => {
    const {
      googleOAuthCredentials,
      resolveCanonicalGoogleRedirectUri,
    } = await import("@/lib/server/config.server");
    const { buildGoogleStateCookieHeader } = await import("@/lib/server/master-sso.server");

    const creds = googleOAuthCredentials();
    expect(creds.clientId).toContain(".apps.googleusercontent.com");
    expect(creds.clientSecret.length).toBeGreaterThan(10);

    expect(resolveCanonicalGoogleRedirectUri("https://netsec.sparrowx.net")).toBe(
      "https://sparrowx.net/api/auth/google/callback",
    );
    expect(resolveCanonicalGoogleRedirectUri("https://db.sparrowx.net")).toBe(
      "https://sparrowx.net/api/auth/google/callback",
    );
    expect(resolveCanonicalGoogleRedirectUri("http://localhost:3000")).toBe(
      "http://localhost:3000/api/auth/google/callback",
    );

    const req = new Request("https://netsec.sparrowx.net/api/auth/google/login", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "netsec.sparrowx.net",
      },
    });
    const stateCookie = buildGoogleStateCookieHeader(req, "signed_state_value", 600);
    expect(stateCookie).toContain("spx_google_oauth_state=");
    expect(stateCookie).toContain("Domain=.sparrowx.net");
    expect(stateCookie).toContain("HttpOnly");
    expect(stateCookie).toContain("Secure");
  });
});
