import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "@/lib/server/http.server";
import { generateSparrowxBackupScript } from "@/lib/server/sparrowx-backup.server";
import { processUpiAutoWebhook, verifyUpiUtr, createUpiOrder } from "@/lib/server/upi-payments.server";
import type { ManagedInfraServer } from "@/lib/server/proxmox.server";

describe("OWASP Top 10 Platform Security Hardening Verification", () => {
  it("A01/A03: blocks Host Header Injection in resolveRequestOrigin", () => {
    const poisoned = new Request("https://sparrowx.net/api/auth/verify-email", {
      headers: {
        "x-forwarded-host": "evil.attacker.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveRequestOrigin(poisoned)).toBe("https://sparrowx.net");

    const legitSub = new Request("https://sparrowx.net/api/auth/google/login", {
      headers: {
        "x-forwarded-host": "infra.sparrowx.net",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveRequestOrigin(legitSub)).toBe("https://infra.sparrowx.net");
  });

  it("A01: blocks unauthenticated access to /api/deploy/projects and /api/infra/servers/*", async () => {
    const { Route: deployRoute } = await import("@/routes/api/deploy/projects");
    const deployGet = (deployRoute.options.server as any)?.handlers?.GET;
    const deployPost = (deployRoute.options.server as any)?.handlers?.POST;

    const r1 = await deployGet({ request: new Request("https://sparrowx.net/api/deploy/projects") });
    expect(r1.status).toBe(401);

    const r2 = await deployPost({
      request: new Request("https://sparrowx.net/api/deploy/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: "https://github.com/octocat/Hello-World" }),
      }),
    });
    expect(r2.status).toBe(401);

    const { Route: infraList } = await import("@/routes/api/infra/servers/index");
    const infraGet = (infraList.options.server as any)?.handlers?.GET;
    const r3 = await infraGet({ request: new Request("https://infra.sparrowx.net/api/infra/servers") });
    expect(r3.status).toBe(401);

    const { Route: infraProv } = await import("@/routes/api/infra/servers/provision");
    const provPost = (infraProv.options.server as any)?.handlers?.POST;
    const r4 = await provPost({
      request: new Request("https://infra.sparrowx.net/api/infra/servers/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "vps-starter" }),
      }),
    });
    expect(r4.status).toBe(401);

    const { Route: infraAction } = await import("@/routes/api/infra/servers/action");
    const actPost = (infraAction.options.server as any)?.handlers?.POST;
    const r5 = await actPost({
      request: new Request("https://infra.sparrowx.net/api/infra/servers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: "srv-1", action: "stop" }),
      }),
    });
    expect(r5.status).toBe(401);
  });

  it("A04/A07: fails closed on unsigned UPI webhooks and never auto-approves unverified UTRs", () => {
    const prevRzp = process.env.RAZORPAY_WEBHOOK_SECRET;
    const prevBridge = process.env.SPARROWX_UPI_BRIDGE_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.SPARROWX_UPI_BRIDGE_SECRET;

    try {
      const order = createUpiOrder({
        service: "infra",
        planId: "vps-starter",
        planName: "VPS Starter",
        amountInr: 999,
        customerEmail: "victim@sparrowx.net",
      });
      // Order ID must have >= 12 hex chars of CSPRNG entropy (SPX + 12 hex = 15 chars)
      expect(order.orderId.length).toBeGreaterThanOrEqual(15);

      const unsignedWebhook = processUpiAutoWebhook({
        rawBody: JSON.stringify({ orderId: order.orderId, utr: "412345678901", amountInr: 999 }),
        headers: {},
        payload: { orderId: order.orderId, utr: "412345678901", amountInr: 999 },
      });
      expect(unsignedWebhook.ok).toBe(false);
      expect(unsignedWebhook.status).toBe(401);

      const fakeUtr = verifyUpiUtr({ orderId: order.orderId, utr: "999999999999" });
      expect(fakeUtr.ok).toBe(false);
    } finally {
      if (prevRzp !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = prevRzp;
      if (prevBridge !== undefined) process.env.SPARROWX_UPI_BRIDGE_SECRET = prevBridge;
    }
  });

  it("A03: neutralizes shell & Nginx injection payloads inside backup restore scripts", () => {
    const maliciousServer: ManagedInfraServer = {
      id: "srv-evil",
      vmid: 401,
      node: "pve",
      name: 'bad$(id)`whoami`',
      hostname: 'node$(rm -rf /);.sparrowx.net',
      category: "vps",
      planId: "vps-1",
      planName: "VPS",
      region: 'Mumbai"; curl evil.com #',
      os: "Ubuntu$(uname)",
      status: "running",
      ipv4: "103.1.1.1; id",
      extraIpv4s: [],
      ipv6: "::1/64; whoami",
      rdns: 'bad\nlocation /evil { return 200; }',
      sshUser: "root",
      sshPort: 22,
      sshKeys: [],
      wireguardEnabled: true,
      wireguardIp: "10.66.1.1/24; id",
      ddosMode: "XDP/eBPF Always-On",
      cpuCores: 4,
      cpuUsagePct: 5,
      ramTotalGb: 8,
      ramUsedGb: 1,
      diskTotalGb: 100,
      diskUsedGb: 10,
      bandwidthUsedTb: 0,
      bandwidthQuotaTb: 10,
      uptimeSeconds: 10,
      monthlyPriceInr: 849,
      nextDueDate: "2026-12-30",
      proxmoxBacked: true,
      snapshots: [],
    };

    const script = generateSparrowxBackupScript(maliciousServer);
    expect(script).not.toContain("$(rm");
    expect(script).not.toContain("$(id)");
    expect(script).not.toContain("`whoami`");
    expect(script).not.toContain('"; curl');
    expect(script).not.toContain("location /evil");
    expect(script).not.toContain("X-Powered-By");
  });

  it("A05: redacts internal hostnames and ports from /api/system/backbone for unauthenticated callers", async () => {
    const { Route: backboneRoute } = await import("@/routes/api/system/backbone");
    const getHandler = (backboneRoute.options.server as any)?.handlers?.GET;
    const res = await getHandler({ request: new Request("https://sparrowx.net/api/system/backbone") });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { backbone: Record<string, Record<string, unknown>> };
    expect(json.backbone.postgres?.host).toBeUndefined();
    expect(json.backbone.smtp?.host).toBeUndefined();
    expect(json.backbone.deployRunner).toBeUndefined();
  });
});
