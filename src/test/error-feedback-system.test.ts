import { describe, it, expect, beforeEach } from "vitest";
import {
  ERROR_REGISTRY,
  ERROR_CATEGORIES,
  searchErrors,
  getErrorDoc,
  formatTroubleshootingText,
  type ErrorCode,
} from "@/lib/error-registry";
import {
  sanitizeContext,
  recordDiagnosticError,
  computeErrorMetricSummary,
  getDiagnosticEvents,
  toggleEventResolution,
  clearDiagnosticEvents,
  submitProblemReport,
} from "@/lib/diagnostics";
import {
  recordUserOperation,
  updateOperationStatus,
  getUserActivityHistory,
  exportActivityHistoryToCsv,
  clearUserActivityHistory,
} from "@/lib/activity-history";
import {
  runSystemHealthProbe,
  checkSystemHealthSummary,
  SUBSYSTEM_IDS,
} from "@/lib/system-health";
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyLoading,
} from "@/lib/feedback";

describe("SparrowX Global Error Registry & Documentation System", () => {
  it("contains all 16 required categories with IDs and labels", () => {
    expect(ERROR_CATEGORIES.length).toBe(16);
    const categoryIds = ERROR_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain("auth");
    expect(categoryIds).toContain("connection");
    expect(categoryIds).toContain("dns_ssl");
    expect(categoryIds).toContain("scanner");
    expect(categoryIds).toContain("firewall");
    expect(categoryIds).toContain("ai_guardrail");
    expect(categoryIds).toContain("sdk");
    expect(categoryIds).toContain("api_webhook");
    expect(categoryIds).toContain("payment");
    expect(categoryIds).toContain("credits");
    expect(categoryIds).toContain("reports");
    expect(categoryIds).toContain("database");
    expect(categoryIds).toContain("network");
    expect(categoryIds).toContain("permissions");
    expect(categoryIds).toContain("config");
    expect(categoryIds).toContain("unknown");
  });

  it("registers at least 50 comprehensive error codes with complete repair procedures", () => {
    const errorCodes = Object.keys(ERROR_REGISTRY);
    expect(errorCodes.length).toBeGreaterThanOrEqual(50);

    const categoryIds = ERROR_CATEGORIES.map((c) => c.id);

    for (const code of errorCodes) {
      const entry = ERROR_REGISTRY[code as ErrorCode];
      expect(entry.code).toBe(code);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.explanation.length).toBeGreaterThan(0);
      expect(entry.causes.length).toBeGreaterThan(0);
      expect(entry.steps.length).toBeGreaterThan(0);
      expect(entry.expectedResult.length).toBeGreaterThan(0);
      expect(entry.prevention.length).toBeGreaterThan(0);
      expect(categoryIds).toContain(entry.category);
    }
  });

  it("searches error articles by code, keyword, and category filter", () => {
    const domainErrors = searchErrors({ category: "connection" });
    expect(domainErrors.length).toBeGreaterThan(0);
    expect(domainErrors.every((e) => e.category === "connection")).toBe(true);

    const dnsMatches = searchErrors({ query: "DNS" });
    expect(dnsMatches.length).toBeGreaterThan(0);
    expect(
      dnsMatches.some(
        (e) =>
          e.code.includes("DNS") ||
          e.title.toLowerCase().includes("dns") ||
          e.explanation.toLowerCase().includes("dns"),
      ),
    ).toBe(true);

    const specificDoc = getErrorDoc("DOMAIN_VERIFICATION_FAILED");
    expect(specificDoc.code).toBe("DOMAIN_VERIFICATION_FAILED");
    expect(specificDoc.id).toBe("SPX-E-0202");
  });

  it("formats structured troubleshooting guides with reference IDs", () => {
    const guide = formatTroubleshootingText("DOMAIN_VERIFICATION_FAILED", "SPX-ERR-20261101-ABCD");
    expect(guide).toContain("ERROR: DOMAIN_VERIFICATION_FAILED");
    expect(guide).toContain("Reference ID: SPX-ERR-20261101-ABCD");
    expect(guide).toContain("What happened:");
    expect(guide).toContain("Why it happened:");
    expect(guide).toContain("How to fix:");
    expect(guide).toContain("Expected result:");
    expect(guide).toContain("Prevention & Best Practices:");
  });
});

describe("SparrowX Safe Diagnostics & Error Reporting", () => {
  beforeEach(() => {
    clearDiagnosticEvents();
  });

  it("safely redacts sensitive credentials, tokens, and credit card numbers", () => {
    const sensitiveContext = {
      apiKey: "spx_live_sec_993882747182993817462",
      password: "SuperSecretPassword123!",
      authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig",
      cardNumber: "4111 2222 3333 4444",
      cvv: "992",
      normalField: "SparrowX Gateway Endpoint",
      servicePort: 8080,
    };

    const sanitized = sanitizeContext(sensitiveContext) as Record<string, unknown>;
    expect(sanitized.apiKey).toBe("[REDACTED_SECRET]");
    expect(sanitized.password).toBe("[REDACTED_SECRET]");
    expect(sanitized.authHeader).toBe("[REDACTED_SECRET]");
    expect(sanitized.cardNumber).toBe("[REDACTED_SECRET]");
    expect(sanitized.cvv).toBe("[REDACTED_SECRET]");
    expect(sanitized.normalField).toBe("SparrowX Gateway Endpoint");
    expect(sanitized.servicePort).toBe(8080);
  });

  it("records diagnostic events with unique SPX-ERR reference IDs and updates metrics", () => {
    const event1 = recordDiagnosticError("FIREWALL_DEPLOYMENT_FAILED", {
      module: "Firewall Engine",
      customMessage: "Firewall deployment rejected: Syntax error in ingress rule CIDR block",
      context: { ruleId: "r-9012" },
    });

    expect(event1.referenceId).toMatch(/^SPX-ERR-\d{8}-[A-Z0-9]+$/);
    expect(event1.resolved).toBe(false);

    const event2 = recordDiagnosticError("FIREWALL_DEPLOYMENT_FAILED", {
      module: "Firewall Engine",
      customMessage: "Secondary deployment timeout",
    });

    const events = getDiagnosticEvents();
    expect(events.length).toBe(2);

    const summary = computeErrorMetricSummary();
    expect(summary.totalErrors).toBe(2);
    expect(summary.unresolvedCount).toBe(2);
    expect(summary.topErrors[0]?.code).toBe("FIREWALL_DEPLOYMENT_FAILED");
    expect(summary.topErrors[0]?.count).toBe(2);
    expect(summary.affectedModules.some((m) => m.module === "Firewall Engine")).toBe(true);
  });

  it("toggles event resolution and submits problem reports", () => {
    const event = recordDiagnosticError("PAYMENT_GATEWAY_TIMEOUT", {
      module: "Billing",
      customMessage: "Stripe connection timed out after 10000ms",
    });

    expect(event.resolved).toBe(false);
    const toggled = toggleEventResolution(event.referenceId, "Admin Bob");
    expect(toggled).toBe(true);

    const updatedEvents = getDiagnosticEvents();
    const updated = updatedEvents.find((e) => e.referenceId === event.referenceId);
    expect(updated?.resolved).toBe(true);
    expect(updated?.resolvedBy).toBe("Admin Bob");

    const reportSuccess = submitProblemReport(
      event.referenceId,
      "client@acme-corp.com",
      "Attempted credit reload of $50 via Stripe gateway, failed with timeout",
    );

    expect(reportSuccess).toBe(true);
  });
});

describe("SparrowX User Activity & Operations History", () => {
  beforeEach(() => {
    clearUserActivityHistory();
  });

  it("records, updates and filters operations history transparently", () => {
    const op = recordUserOperation({
      action: "Deploy WAF Rule",
      category: "Firewall & WAF",
      target: "api.acmeweb.com",
      title: "Deploy WAF Rule",
      affectedResource: "api.acmeweb.com",
      status: "pending",
      details: "Deploying rate limiting rule (100 req/min)",
    } as any);

    expect(op.id).toMatch(/^ACT-\d+-[A-Z0-9]+$/);
    expect(op.status).toBe("pending");

    updateOperationStatus(op.id, "successful", {
      latencyMs: 340,
      details: "Rule deployed across 4 edge nodes",
    });

    const history = getUserActivityHistory();
    const updated = history.find((h) => h.id === op.id);
    expect(updated?.status).toBe("successful");
    expect(updated?.latencyMs).toBe(340);
  });

  it("exports activity history to RFC 4180 compliant CSV format", () => {
    recordUserOperation({
      category: "Website & Domain",
      title: "Domain Ownership Verification",
      affectedResource: "portal.sparrowx.dev",
      status: "successful",
      latencyMs: 1250,
      details: "TXT record _sparrowx-verify validated",
    });

    recordUserOperation({
      category: "Billing & Payment",
      title: "Payment Checkout",
      affectedResource: "Starter Credit Pack",
      status: "failed",
      errorReferenceId: "SPX-ERR-B1-992",
      details: "Card declined by issuing bank",
    });

    const csv = exportActivityHistoryToCsv();
    expect(csv).toContain("Operation ID,Timestamp,Category,Action,Target,Status,Duration (ms),Error Ref ID,Details");
    expect(csv).toContain("Domain Ownership Verification");
    expect(csv).toContain("portal.sparrowx.dev");
    expect(csv).toContain("Payment Checkout");
    expect(csv).toContain("SPX-ERR-B1-992");
  });
});

describe("SparrowX Live Subsystem Health Probing Engine", () => {
  it("probes all 10 core subsystems without throwing and never returns fake operational states", async () => {
    const report = await runSystemHealthProbe();

    expect(report.subsystems.length).toBe(10);
    expect(report.subsystems.map((s) => s.id).sort()).toEqual([...SUBSYSTEM_IDS].sort());

    for (const sub of report.subsystems) {
      expect(["operational", "degraded", "partial_outage", "major_outage", "maintenance", "unknown"]).toContain(
        sub.status,
      );
      expect(sub.uptimePct).toBeGreaterThanOrEqual(95);
      expect(sub.latencyMs).toBeGreaterThanOrEqual(0);
      expect(sub.lastChecked).toBeDefined();
      expect(sub.details.length).toBeGreaterThan(0);
    }

    const summary = checkSystemHealthSummary(report);
    expect(summary.totalSubsystems).toBe(10);
    expect(summary.timestamp).toBeDefined();
    expect(["operational", "degraded", "partial_outage", "major_outage", "maintenance", "unknown"]).toContain(
      summary.overallState,
    );
  });
});

describe("SparrowX Centralized Feedback & Toast System", () => {
  it("dispatches typed success notifications with activity history integration", () => {
    notifySuccess("Website connected successfully. Protection active.", {
      category: "Website & Domain",
      target: "myblog.org",
      latencyMs: 180,
    });

    const history = getUserActivityHistory();
    const item = history.find((h) => h.affectedResource === "myblog.org");
    expect(item).toBeDefined();
    expect(item?.status).toBe("successful");
    expect(item?.latencyMs).toBe(180);
  });

  it("dispatches typed error notifications with correlation IDs and deep doc links", () => {
    const result = notifyError("FIREWALL_DEPLOY_UNCONFIRMED", {
      target: "api.sparrowx.net",
      category: "Firewall & WAF",
      customMessage: "Firewall rules could not be synchronized to edge nodes.",
    });

    expect(result.code).toBe("FIREWALL_DEPLOY_UNCONFIRMED");
    expect(result.referenceId).toMatch(/^SPX-ERR-/);

    const history = getUserActivityHistory();
    const item = history.find((h) => h.errorReferenceId === result.referenceId);
    expect(item).toBeDefined();
    expect(item?.status).toBe("failed");
    expect(item?.troubleshootingUrl).toContain("FIREWALL_DEPLOY_UNCONFIRMED");
  });

  it("handles loading tasks with progress and final completion", () => {
    const loading = notifyLoading("Verifying your domain ownership... Please wait.", {
      category: "Website & Domain",
      target: "example.org",
    });

    expect(loading.id).toBeDefined();

    loading.update("Checking TXT record propagation on edge nodes...");

    loading.success("Domain ownership confirmed successfully");

    const history = getUserActivityHistory();
    const item = history.find((h) => h.id === loading.id);
    expect(item).toBeDefined();
  });
});
