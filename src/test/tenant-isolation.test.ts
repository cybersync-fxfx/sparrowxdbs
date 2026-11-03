import { describe, it, expect, vi, beforeAll } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  GlobalTrafficMeshGlobe,
  PRESET_ORIGINS,
  sanitizeDomainName,
} from "../components/GlobalTrafficMeshGlobe";
import {
  fetchVerificationProofsFromBackend,
  type ClientTenant,
  type ProtectedService,
} from "../lib/supabase";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
});

describe("Multi-Tenant Isolation & Zero Fake Data Verification", () => {
  it("ensures PRESET_ORIGINS contains no fake demo companies or foreign platforms", () => {
    const allNames = PRESET_ORIGINS.map((o) => o.name.toLowerCase()).join(" ");
    const allDomains = PRESET_ORIGINS.map((o) => o.domain.toLowerCase()).join(" ");

    // Verify completely removed fake demo names
    expect(allNames).not.toContain("novapay");
    expect(allDomains).not.toContain("novapay.io");
    expect(allNames).not.toContain("eu financial core");
    expect(allDomains).not.toContain("cloudscale.dev");
    expect(allNames).not.toContain("apac microservices");
    expect(allDomains).not.toContain("acmepay.in");
    expect(allDomains).not.toContain("cloudflare.com");
    expect(allDomains).not.toContain("github.com");

    // Must only have SparrowX Edge Mesh platform baseline
    expect(PRESET_ORIGINS.length).toBe(1);
    expect(PRESET_ORIGINS[0].domain).toBe("sparrowx.net");
  });

  it("sanitizes domain inputs properly", () => {
    expect(sanitizeDomainName("https://api.myclient.com/v1")).toBe("api.myclient.com");
    expect(sanitizeDomainName("http://myapp.io:8080/")).toBe("myapp.io");
    expect(sanitizeDomainName("agent://mcp.internal:3000")).toBe("mcp.internal");
  });

  it("renders GlobalTrafficMeshGlobe with strict isolation for client tenant", () => {
    const clientTenant: ClientTenant = {
      id: "tnt-client-alpha",
      name: "Alpha Corp",
      contactEmail: "ops@alphacorp.com",
      primaryDomain: "alphacorp.io",
      planTier: "Growth",
      status: "Active",
      enabledModules: ["web_security"],
      apiKey: "spx_test_key_1",
      sdkVerified: true,
      guardrailsActive: true,
      requestsPerMin: 120,
      blockedThreats: 5,
      avgLatencyMs: 14,
      quotaUsedPct: 15,
    };

    render(
      React.createElement(GlobalTrafficMeshGlobe, {
        tenants: [clientTenant],
        currentUserRole: "client",
        activeTenantId: clientTenant.id,
      }),
    );

    // Verify that the client sees their own domain
    expect(screen.getAllByText(/alphacorp\.io/i).length).toBeGreaterThan(0);

    // Verify that other companies or fake origins are NOT in the document
    expect(screen.queryByText(/novapay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cloudscale/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acmepay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/detriot\.cloud/i)).not.toBeInTheDocument();
  });

  it("never leaks sparrowx.net or presets to client detriot.cloud and prevents duplicate pills", () => {
    const detriotTenant: ClientTenant = {
      id: "tnt-detriot-cloud",
      name: "Detriot Cloud",
      contactEmail: "admin@detriot.cloud",
      primaryDomain: "detriot.cloud",
      planTier: "Enterprise",
      status: "Active",
      enabledModules: ["web_security"],
      apiKey: "spx_test_detriot",
      sdkVerified: true,
      guardrailsActive: true,
      requestsPerMin: 240,
      blockedThreats: 18,
      avgLatencyMs: 9,
      quotaUsedPct: 32,
    };

    render(
      React.createElement(GlobalTrafficMeshGlobe, {
        tenants: [detriotTenant],
        currentUserRole: "client",
        portalMode: "client",
        activeTenantId: detriotTenant.id,
      }),
    );

    // Verify detriot.cloud is shown
    expect(screen.getAllByText(/detriot\.cloud/i).length).toBeGreaterThan(0);

    // CRITICAL: sparrowx.net MUST NOT be exposed in client session
    expect(screen.queryByText(/sparrowx\.net/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cloudflare\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/github\.com/i)).not.toBeInTheDocument();
  });

  it("strictly scopes verification proofs to the client's provided tenant and services", async () => {
    const tenantA: ClientTenant = {
      id: "tnt-isolated-a",
      name: "Acme Secure",
      contactEmail: "admin@acme.com",
      primaryDomain: "acme.com",
      planTier: "Enterprise",
      status: "Active",
      enabledModules: ["web_security", "ai_shield"],
      apiKey: "spx_test_a",
      sdkVerified: true,
      guardrailsActive: true,
      requestsPerMin: 300,
      blockedThreats: 12,
      avgLatencyMs: 10,
      quotaUsedPct: 20,
    };

    const serviceA: ProtectedService = {
      id: "srv-a-1",
      tenantId: "tnt-isolated-a",
      name: "Acme Web Portal",
      category: "Web App & Website",
      endpoint: "https://acme.com",
      mode: "Active Shield",
      requests24h: "1500",
      blockedThreats: 4,
      apiKey: "spx_srv_a",
      promptShield: true,
      piiRedaction: true,
      toolCallFirewall: false,
      lastHeartbeat: "Active",
    };

    const proofs = await fetchVerificationProofsFromBackend([tenantA], [serviceA]);
    expect(proofs.length).toBeGreaterThanOrEqual(1);

    // Every proof for tenantA should reference tenantA or serviceA
    const tenantProof = proofs.find((p) => p.id === "VRF-TEN-tnt-isolated-a");
    expect(tenantProof).toBeDefined();
    expect(tenantProof?.clientName).toBe("Acme Secure");

    const serviceProof = proofs.find((p) => p.id === "VRF-srv-a-1");
    expect(serviceProof).toBeDefined();
    expect(serviceProof?.name).toBe("Acme Web Portal");
  });
});
