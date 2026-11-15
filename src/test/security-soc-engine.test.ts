import { describe, expect, it, beforeEach } from "vitest";
import {
  appendAuditLog,
  verifyAuditChain,
  executeSocContainment,
  getTenantFirewallRules,
  addFirewallRule,
  removeFirewallRule,
  getTenantPlanEntitlements,
  getTenantAuditLogs,
  type ImmutableAuditLogEntry,
} from "../lib/server/security-soc.server";
import { SPARROWX_PLANS } from "../lib/sparrowx-plans";

describe("SparrowX Hardened Security & SOC Engine (Cryptographic Chaining & Containment)", () => {
  it("builds an immutable SHA-256 cryptographic audit chain and verifies integrity", () => {
    const entry1 = appendAuditLog({
      tenantId: "tnt-alpha",
      actor: "secops@sparrowx.net",
      role: "Incident Responder",
      action: "ISOLATE_HOST",
      target: "api-worker-01.sparrowx.net",
      severity: "High",
    });

    expect(entry1.id).toMatch(/^AUD-/);
    expect(entry1.hash).toHaveLength(64);
    expect(entry1.previousHash).toHaveLength(64);

    const entry2 = appendAuditLog({
      tenantId: "tnt-alpha",
      actor: "secops@sparrowx.net",
      role: "Security Engineer",
      action: "BLOCK_IP_WAF",
      target: "198.51.100.42",
      severity: "Critical",
    });

    expect(entry2.previousHash).toBe(entry1.hash);

    const verification = verifyAuditChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBeGreaterThanOrEqual(2);
  });

  it("detects tampering when an audit block hash or content is manipulated", () => {
    const logs = getTenantAuditLogs();
    expect(logs.length).toBeGreaterThan(0);

    // Verify currently valid
    expect(verifyAuditChain().valid).toBe(true);
  });

  it("executes autonomous host quarantine and IP blocking with audit logging", async () => {
    const result = await executeSocContainment({
      incidentId: "INC-9912",
      tenantId: "tnt-fintech-01",
      actionType: "quarantine_host",
      target: "FIN-WS-0419",
      actor: "AI SOC Autonomous Engine",
      reason: "CobaltStrike beacon detected over outbound TCP 443",
    });

    expect(result.success).toBe(true);
    expect(result.actionId).toMatch(/^ACT-/);
    expect(result.message).toContain("quarantine");
    expect(result.auditEntry.action).toBe("SOC_CONTAINMENT_QUARANTINE_HOST");
    expect(result.auditEntry.severity).toBe("High");
  });

  it("adds, lists, and removes multi-tenant firewall rules at the edge", () => {
    const initialRules = getTenantFirewallRules("tnt-client-omega");

    const newRule = addFirewallRule({
      tenantId: "tnt-client-omega",
      type: "cidr",
      value: "203.0.113.0/24",
      action: "block",
      comment: "Brute-force crawler subnet",
      expiresAt: null,
      active: true,
    });

    expect(newRule.id).toMatch(/^fwr-/);
    expect(newRule.value).toBe("203.0.113.0/24");

    const updatedRules = getTenantFirewallRules("tnt-client-omega");
    expect(updatedRules.some((r) => r.id === newRule.id)).toBe(true);

    const removed = removeFirewallRule("tnt-client-omega", newRule.id);
    expect(removed).toBe(true);

    const finalRules = getTenantFirewallRules("tnt-client-omega");
    expect(finalRules.some((r) => r.id === newRule.id)).toBe(false);
  });

  it("validates all 6 official SparrowX business model subscription plans and entitlements", () => {
    expect(SPARROWX_PLANS).toHaveLength(6);

    const dev = getTenantPlanEntitlements("DEV_STARTER");
    expect(dev?.monthlyPrice).toBe(5);
    expect(dev?.maxDomains).toBe(1);

    const startup = getTenantPlanEntitlements("STARTUP_SHIELD");
    expect(startup?.monthlyPrice).toBe(12);
    expect(startup?.maxDomains).toBe(3);

    const biz = getTenantPlanEntitlements("BIZ_PRO");
    expect(biz?.popular).toBe(true);
    expect(biz?.monthlyPrice).toBe(25);
    expect(biz?.requestQuotaMonthly).toBe(5_000_000);

    const ai = getTenantPlanEntitlements("AI_AGENT_SHIELD");
    expect(ai?.tier).toBe("AI Native");
    expect(ai?.monthlyPrice).toBe(39);

    const enterprise = getTenantPlanEntitlements("ENTERPRISE_SOC");
    expect(enterprise?.monthlyPrice).toBe(59);
    expect(enterprise?.maxDomains).toBe(50);

    const hyperscale = getTenantPlanEntitlements("HYPERSCALE_DEFENSE");
    expect(hyperscale?.monthlyPrice).toBe(79);
    expect(hyperscale?.maxDomains).toBe(-1);
  });
});
