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
});
