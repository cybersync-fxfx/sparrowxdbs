import { describe, expect, it } from "vitest";
import {
  isProtectedPlatformHost,
  verifyEdgeTargetResolvable,
} from "@/routes/api/shield/cloudflare-autoconfig";

describe("SparrowX Shield Cloudflare Auto-Config Zero-Downtime Safety Guards", () => {
  it("protects SparrowX apex and platform hosts from circular CNAME replacement", () => {
    expect(isProtectedPlatformHost("sparrowx.net")).toBe(true);
    expect(isProtectedPlatformHost("https://www.sparrowx.net/")).toBe(true);
    expect(isProtectedPlatformHost("edge.sparrowx.net")).toBe(true);
    expect(isProtectedPlatformHost("sec.sparrowx.net")).toBe(true);
    expect(isProtectedPlatformHost("client-shop.in")).toBe(false);
  });

  it("aborts CNAME cutover when edge.sparrowx.net has no live A record in DNS", async () => {
    const nxdomainFetch = (async () =>
      new Response(JSON.stringify({ Status: 3, Answer: [] }), { status: 200 })) as typeof fetch;

    const failed = await verifyEdgeTargetResolvable("edge.sparrowx.net", nxdomainFetch);
    expect(failed.healthy).toBe(false);
    expect(failed.resolvedIps).toHaveLength(0);
    expect(failed.reason).toContain("Aborted CNAME cutover");

    const healthyFetch = (async () =>
      new Response(
        JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "139.99.131.135" }] }),
        { status: 200 },
      )) as typeof fetch;

    const ok = await verifyEdgeTargetResolvable("edge.sparrowx.net", healthyFetch);
    expect(ok.healthy).toBe(true);
    expect(ok.resolvedIps).toEqual(["139.99.131.135"]);
  });
});
