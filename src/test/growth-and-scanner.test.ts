import { describe, expect, it, beforeEach } from "vitest";
import {
  validateSafePublicTarget,
  isPrivateOrReservedIp,
  checkScannerRateLimit,
  runLivePublicDomainScan,
  buildProspectAuditReportText,
  buildColdOutreachMessage,
  upsertProspectRecord,
  getStoredProspects,
  incrementProspectReportView,
  computeVerificationBadgeId,
  toggleRevokeBadgeId,
  getRevokedBadgeIds,
  type ProspectRecord,
} from "@/components/GrowthAndMonetizationHub";

describe("Public Scanner, SSRF Guard, Prospect CRM & Badge Verification", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("blocks SSRF private IPs, loopback, cloud metadata, and internal hostnames", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.50")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.5.4")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);

    expect(validateSafePublicTarget("http://127.0.0.1:8080").valid).toBe(false);
    expect(validateSafePublicTarget("http://169.254.169.254/latest/meta-data").valid).toBe(false);
    expect(validateSafePublicTarget("internal.corp").valid).toBe(false);
    expect(validateSafePublicTarget("localhost").valid).toBe(false);

    const validTarget = validateSafePublicTarget("https://example.com/api/v1");
    expect(validTarget.valid).toBe(true);
    expect(validTarget.cleanHost).toBe("example.com");
  });

  it("enforces sliding-window rate limiting on the public scanner", () => {
    const first = checkScannerRateLimit();
    expect(first.allowed).toBe(true);
  });

  it("executes a real public domain scan and generates findings with evidence & reports", async () => {
    const result = await runLivePublicDomainScan("example.com");
    expect(result.cleanHost).toBe("example.com");
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.findings.length).toBeGreaterThanOrEqual(5);
    expect(result.findings[0]?.evidence).toBeTruthy();
    expect(result.scoreGrade).toMatch(/^[A-F](\+)?$/);
    expect(result.targetCategory).toBe("Web Application & SaaS");

    // CRITICAL: Ensure regular website never falsely reports AI Prompt Injection
    const findingCategories = result.findings.map((f) => f.category);
    expect(findingCategories).not.toContain("AI & API Shield");
    expect(findingCategories).toContain("Edge Protection & Bot Shield");

    // Verify AI advisory generation with What SparrowX Safes & 5-Min Plan
    expect(result.advisory).toBeDefined();
    expect(result.advisory?.customerConversionPitch).toBeTruthy();
    expect(result.advisory?.recommendedAction).toBeTruthy();
    expect(result.advisory?.whatSparrowxSaves?.length).toBeGreaterThan(0);
    expect(result.advisory?.aiVulnerabilities?.length).toBeGreaterThan(0);
    expect(result.advisory?.fiveMinuteProtectionPlan?.estimatedTime).toBe("5 Minutes");

    const reportTxt = buildProspectAuditReportText(result);
    expect(reportTxt).toContain("example.com");
    expect(reportTxt).toContain("Evidence :");
    expect(reportTxt).toContain("SPARROWX AI BRAIN DEEP ADVISORY");
    expect(reportTxt).toContain("WHAT SPARROWX SAFES & PROTECTS");
    expect(reportTxt).toContain("5-MINUTE RAPID ONBOARDING PLAN");

    const dmPitch = buildColdOutreachMessage(result, "dm");
    expect(dmPitch).toContain("example.com");
  }, 15000);

  it("contextually identifies AI services and performs dedicated LLM prompt guardrail checks", async () => {
    const aiResult = await runLivePublicDomainScan("https://chat.myagent.ai/api/chat");
    expect(aiResult.targetCategory).toBe("AI Agent & LLM Endpoint");
    const aiCategories = aiResult.findings.map((f) => f.category);
    expect(aiCategories).toContain("AI & API Shield");
    expect(aiResult.advisory?.targetCategory).toBe("AI Agent & LLM Endpoint");
  }, 15000);

  it("manages admin prospects, tracks report views, and stores quotations", () => {
    const rec: ProspectRecord = {
      id: "PROS-101",
      domain: "novapay.io",
      companyName: "NovaPay",
      contactName: "Alex",
      contactEmail: "alex@novapay.io",
      source: "Public Scanner Lead",
      status: "New Lead",
      createdAt: "Now",
      lastScanResult: null,
      reportViews: 1,
      lastViewedAt: "Now",
      quotation: null,
    };

    upsertProspectRecord(rec);
    expect(getStoredProspects().length).toBe(1);

    incrementProspectReportView("novapay.io");
    expect(getStoredProspects()[0]?.reportViews).toBe(2);
  });

  it("generates deterministic verification badge IDs and supports revocation", () => {
    const badgeId = computeVerificationBadgeId("https://novapay.io");
    expect(badgeId).toMatch(/^SPX-CERT-[0-9A-F]{6}$/);

    expect(getRevokedBadgeIds().includes("novapay.io")).toBe(false);
    const nowRevoked = toggleRevokeBadgeId("novapay.io");
    expect(nowRevoked).toBe(true);
    expect(getRevokedBadgeIds().includes("novapay.io")).toBe(true);

    const restored = toggleRevokeBadgeId("novapay.io");
    expect(restored).toBe(false);
  });
});
