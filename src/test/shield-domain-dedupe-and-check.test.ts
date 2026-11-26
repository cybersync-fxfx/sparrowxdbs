import { describe, expect, it } from "vitest";
import {
  deduplicateAndPruneTenants,
  normalizeShieldDomain,
  type ClientTenant,
} from "@/lib/supabase";

function makeTenant(overrides: Partial<ClientTenant> & { id: string; primaryDomain: string }): ClientTenant {
  return {
    name: overrides.primaryDomain,
    contactEmail: "operator@sparrowx.net",
    planTier: "Growth",
    status: "Active",
    enabledModules: ["web_security"],
    apiKey: "spx_waf_1234567890abcd",
    sdkVerified: false,
    guardrailsActive: true,
    requestsPerMin: 0,
    blockedThreats: 0,
    avgLatencyMs: 0,
    quotaUsedPct: 0,
    ...overrides,
  };
}

describe("SparrowX Shield Domain Normalization & Zombie Cleanup", () => {
  it("normalizes protocol, www, paths, and ports to bare lowercase hostnames", () => {
    expect(normalizeShieldDomain("https://sparrowx.net/")).toBe("sparrowx.net");
    expect(normalizeShieldDomain("http://WWW.Detriot.Cloud:443/app?a=1")).toBe("detriot.cloud");
    expect(normalizeShieldDomain("sparrowx.net")).toBe("sparrowx.net");
  });

  it("drops duplicate protocol-prefixed zombie records and preserves the best verified domain", () => {
    const raw: ClientTenant[] = [
      makeTenant({ id: "t1", primaryDomain: "https://sparrowx.net", name: "sc", sdkVerified: false }),
      makeTenant({ id: "t2", primaryDomain: "https://sparrowx.net", name: "as", sdkVerified: false }),
      makeTenant({ id: "t3", primaryDomain: "sparrowx.net", name: "sparrowx.net", sdkVerified: true, enabledModules: ["web_security", "cloud_security", "compliance"] }),
      makeTenant({ id: "t4", primaryDomain: "sparrowx.net", name: "pro", sdkVerified: false }),
      makeTenant({ id: "t5", primaryDomain: "detriot.cloud", name: "as", sdkVerified: true }),
      makeTenant({ id: "t6", primaryDomain: "localhost", name: "dead-local", sdkVerified: false }),
      makeTenant({ id: "t7", primaryDomain: "dead-suspended.com", status: "Suspended", sdkVerified: false }),
    ];

    const { active, dropped } = deduplicateAndPruneTenants(raw);
    expect(active).toHaveLength(2);
    expect(active.map((t) => t.primaryDomain)).toEqual(["sparrowx.net", "detriot.cloud"]);
    expect(active.find((t) => t.primaryDomain === "sparrowx.net")?.id).toBe("t3");
    expect(dropped).toHaveLength(5);
  });
});
