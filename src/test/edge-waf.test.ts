import { describe, expect, it, beforeEach } from "vitest";
import {
  getLiveWafTelemetry,
  handleLiveEdgeWaf,
  isProtectedWafHost,
  upsertDomainWafPolicy,
  verifyEdgeChallengeAndIssueClearance,
} from "../lib/server/edge-waf.server";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

describe("SparrowX Shield Live Edge WAF", () => {
  beforeEach(() => {
    upsertDomainWafPolicy({
      domain: "sparrowx.net",
      wafMode: "balanced",
      edgeCheckEnabled: true,
      sensorKey: "spx_waf_secret_test_key_123456",
    });
  });

  it("protects onboarded domains while exempting sec/admin/api control planes", () => {
    expect(isProtectedWafHost("sparrowx.net")?.domain).toBe("sparrowx.net");
    expect(isProtectedWafHost("www.sparrowx.net")?.domain).toBe("sparrowx.net");
    expect(isProtectedWafHost("sec.sparrowx.net")).toBeNull();
    expect(isProtectedWafHost("admin.sparrowx.net")).toBeNull();
    expect(isProtectedWafHost("panel.sparrowx.net")).toBeNull();
    expect(isProtectedWafHost("game.panel.sparrowx.net")).toBeNull();
  });

  it("serves real Edge Checking Page on unverified browser GET and clears after verification", async () => {
    const req = new Request("https://sparrowx.net/", {
      method: "GET",
      headers: {
        host: "sparrowx.net",
        accept: "text/html,application/xhtml+xml",
        "user-agent": BROWSER_UA,
        "x-real-ip": "203.0.113.42",
      },
    });

    const gate = await handleLiveEdgeWaf(req);
    expect(gate.edgeStatus).toBe("CHALLENGE");
    expect(gate.response).toBeDefined();
    expect(gate.response?.status).toBe(200);
    expect(gate.response?.headers.get("X-SparrowX-WAF")).toBe("CHALLENGE");

    const html = await gate.response!.text();
    expect(html).toContain("Checking if the site connection is secure");
    expect(html).toContain("/api/shield/edge-verify");

    const tokenMatch = html.match(/token:\s*"([^"]+)"/);
    expect(tokenMatch?.[1]).toBeTruthy();

    const verified = verifyEdgeChallengeAndIssueClearance(
      tokenMatch![1]!,
      "sparrowx.net",
      BROWSER_UA,
      "203.0.113.42",
    );
    expect(verified.ok).toBe(true);
    expect(verified.cookieHeader).toContain("__spx_edge_clearance=");

    const cookiePair = verified.cookieHeader!.split(";")[0]!;
    const secondReq = new Request("https://sparrowx.net/", {
      method: "GET",
      headers: {
        host: "sparrowx.net",
        accept: "text/html",
        "user-agent": BROWSER_UA,
        "x-real-ip": "203.0.113.42",
        cookie: cookiePair,
      },
    });

    const secondGate = await handleLiveEdgeWaf(secondReq);
    expect(secondGate.edgeStatus).toBe("ALLOW");
    expect(secondGate.response).toBeUndefined();
  });

  it("blocks SQLi, XSS, LFI, scanner UAs, and ?spx_waf_test=1 with 403", async () => {
    const attackUrls = [
      "https://sparrowx.net/?spx_waf_test=1",
      "https://sparrowx.net/?id=1%27%20OR%201=1--",
      "https://sparrowx.net/?q=%3Cscript%3Ealert(1)%3C/script%3E",
      "https://sparrowx.net/../../etc/passwd",
      "https://sparrowx.net/.env",
    ];

    for (const url of attackUrls) {
      const gate = await handleLiveEdgeWaf(
        new Request(url, {
          method: "GET",
          headers: {
            host: "sparrowx.net",
            accept: "text/html",
            "user-agent": BROWSER_UA,
            "x-real-ip": "198.51.100.77",
          },
        }),
      );
      expect(gate.edgeStatus).toBe("BLOCKED");
      expect(gate.response?.status).toBe(403);
      expect(gate.response?.headers.get("X-SparrowX-WAF")).toBe("BLOCKED");
      expect(gate.response?.headers.get("X-SparrowX-Ray")).toMatch(/^spx_/);
    }

    const scannerGate = await handleLiveEdgeWaf(
      new Request("https://sparrowx.net/", {
        method: "GET",
        headers: {
          host: "sparrowx.net",
          accept: "text/html",
          "user-agent": "sqlmap/1.8.4#stable",
          "x-real-ip": "198.51.100.78",
        },
      }),
    );
    expect(scannerGate.edgeStatus).toBe("BLOCKED");
    expect(scannerGate.response?.status).toBe(403);
  });

  it("logs without blocking in monitor mode and allows verified search crawlers", async () => {
    upsertDomainWafPolicy({
      domain: "sparrowx.net",
      wafMode: "monitor",
      edgeCheckEnabled: true,
    });

    const monitorGate = await handleLiveEdgeWaf(
      new Request("https://sparrowx.net/?spx_waf_test=1", {
        method: "GET",
        headers: {
          host: "sparrowx.net",
          accept: "*/*",
          "user-agent": BROWSER_UA,
          "x-real-ip": "198.51.100.90",
        },
      }),
    );
    expect(monitorGate.edgeStatus).toBe("ALLOW");
    expect(monitorGate.response).toBeUndefined();

    const botGate = await handleLiveEdgeWaf(
      new Request("https://sparrowx.net/", {
        method: "GET",
        headers: {
          host: "sparrowx.net",
          accept: "text/html",
          "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "x-real-ip": "66.249.66.1",
        },
      }),
    );
    expect(botGate.edgeStatus).toBe("ALLOW");
    expect(botGate.response).toBeUndefined();
  });

  it("never exposes raw sensorKey in public GET telemetry snapshots", async () => {
    const snap = await getLiveWafTelemetry("sparrowx.net");
    expect(snap.ok).toBe(true);
    expect(snap.domainProtected).toBe(true);
    expect(snap.policy.hasSensorKey).toBe(true);
    expect("sensorKey" in snap.policy).toBe(false);
    expect(snap.totalInspected).toBeGreaterThan(0);
    expect(snap.blockedCount).toBeGreaterThan(0);
  });
});
