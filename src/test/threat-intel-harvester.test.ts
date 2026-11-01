import { describe, it, expect, beforeEach } from "vitest";
import {
  fetchInternetThreatIntel,
  applyThreatIntelToDefenseSystem,
  getDefenseUpdateBulletins,
  getCurrentDefenseVersion,
  formatBulletinMarkdown,
  CURATED_INTERNET_THREAT_FEEDS,
  type InternetThreatItem,
} from "@/lib/threat-intel-harvester";
import { getLearnedThreatPatterns } from "@/lib/sparrowx-ai-brain";
import { getUserActivityHistory } from "@/lib/activity-history";
import type { ThreatIndicator, ProtectedService, ClientTenant } from "@/lib/supabase";

describe("SparrowX AI Brain Internet Threat Intel & Autonomous Defense System", () => {
  const mockProtectedServices: ProtectedService[] = [
    {
      id: "srv-01",
      name: "Acme Production API Gateway",
      category: "web_security",
      endpoint: "https://api.acme.com",
      mode: "Active Shield",
      blockedThreats: 140,
      quotaUsedPct: 25,
      apiKey: "spx_test_key_1",
    },
  ];

  const mockClientTenants: ClientTenant[] = [
    {
      id: "tnt-01",
      name: "Acme Corp Enterprise",
      contactEmail: "security@acme.com",
      planTier: "Enterprise Shield",
      status: "Active",
      sdkVerified: true,
      primaryDomain: "acme.com",
      guardrailsActive: true,
      blockedThreats: 140,
      requestsPerMin: 120,
      avgLatencyMs: 14,
      quotaUsedPct: 25,
      enabledModules: ["web_security", "ai_shield", "compliance"],
      createdAt: "2026-11-01",
    },
  ];

  const mockExistingIndicators: ThreatIndicator[] = [
    {
      id: "ioc-01",
      indicator: "185.220.101.44",
      type: "IPv4",
      actor: "Volt Typhoon",
      confidence: 95,
      severity: "Critical",
      region: "Global",
      blocked: true,
      lastSeen: "10 mins ago",
    },
  ];

  it("fetches curated and live internet threat feeds covering CISA KEV, AbuseIPDB, and OWASP GenAI", async () => {
    const threats = await fetchInternetThreatIntel();
    expect(threats.length).toBeGreaterThanOrEqual(5);

    const sourceFeeds = threats.map((t) => t.sourceFeed);
    expect(sourceFeeds).toContain("CISA KEV Catalog");
    expect(sourceFeeds).toContain("AbuseIPDB Global C2");
    expect(sourceFeeds).toContain("OWASP GenAI RedTeam");

    for (const threat of threats) {
      expect(threat.id).toBeDefined();
      expect(threat.title.length).toBeGreaterThan(0);
      expect(["Critical", "High", "Medium"]).toContain(threat.severity);
      expect(threat.iocs.length).toBeGreaterThan(0);
      expect(threat.mitreTechnique).toContain("·");
      expect(threat.wafRuleTemplate.length).toBeGreaterThan(0);
      expect(threat.cloudflareExpression.length).toBeGreaterThan(0);
      expect(threat.ufwRule.length).toBeGreaterThan(0);
      expect(threat.aiShieldPolicy.length).toBeGreaterThan(0);
    }
  });

  it("applies threat intel to the blocking system and generates a Defense System Update Bulletin", async () => {
    const threatsToApply: InternetThreatItem[] = [
      CURATED_INTERNET_THREAT_FEEDS[0]!, // SQL AST bypass
      CURATED_INTERNET_THREAT_FEEDS[1]!, // SSRF
      CURATED_INTERNET_THREAT_FEEDS[2]!, // Prompt injection jailbreak
    ];

    const result = await applyThreatIntelToDefenseSystem({
      threatItems: threatsToApply,
      existingThreatIndicators: mockExistingIndicators,
      protectedServices: mockProtectedServices,
      clientTenants: mockClientTenants,
    });

    // 1. Verify Defense Bulletin
    expect(result.bulletin).toBeDefined();
    expect(result.bulletin.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(result.bulletin.threatsHarvestedCount).toBe(3);
    expect(result.bulletin.wafSignaturesAddedCount).toBeGreaterThanOrEqual(3);
    expect(result.bulletin.status).toBe("Enforced Across All Endpoints");
    expect(result.bulletin.summary).toContain("SparrowX AI Brain synchronized threat intelligence");

    // 2. Verify AI Brain Memory Ledger
    const patterns = getLearnedThreatPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(3);

    // 3. Verify Version Bump
    const currentVersion = getCurrentDefenseVersion();
    expect(currentVersion).toBe(result.bulletin.version);

    // 4. Verify Activity History Log
    const activity = getUserActivityHistory();
    const updateLog = activity.find((a) =>
      a.title.includes(`Defense System Update ${result.bulletin.version}`),
    );
    expect(updateLog).toBeDefined();
    expect(updateLog?.status).toBe("successful");
  });

  it("formats defense system update bulletins into comprehensive Markdown for customer reporting", () => {
    const bulletins = getDefenseUpdateBulletins();
    expect(bulletins.length).toBeGreaterThan(0);

    const latest = bulletins[0]!;
    const md = formatBulletinMarkdown(latest);

    expect(md).toContain(`# 🛡️ ${latest.title}`);
    expect(md).toContain(`**Version:** \`${latest.version}\``);
    expect(md).toContain("### 📋 Executive Summary");
    expect(md).toContain("### 📊 Defense Metrics Enforced");
    expect(md).toContain("### 🌐 Key Threats Harvested from Internet Feeds");
    expect(md).toContain("*Generated by SparrowX Autonomous Gemini AI Brain Defense Mesh*");
  });
});
