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
import {
  buildTenantDatabaseName,
  getTenantDatabaseConfig,
  generateTenantApiKey,
  readTenantIsolatedStorage,
  writeTenantIsolatedStorage,
  verifyWebsiteConnector,
  validateIpAddress,
  getTenantIpTableName,
  getTenantDatabaseIps,
  addTenantDatabaseIp,
  removeTenantDatabaseIp,
  probeTenantDatabaseIp,
  resetTenantApiCredentials,
} from "../lib/tenant-database";
import { DashboardSettingsAndConnector } from "../components/DashboardSettingsAndConnector";

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

  it("provisions an isolated database partition with dedicated API key for each tenant", () => {
    const dbName = buildTenantDatabaseName("Detriot Cloud", "TNT-8492");
    expect(dbName).toBe("spx_db_detriot_cloud_tnt_8492");

    const configA = getTenantDatabaseConfig("TNT-8492", "Detriot Cloud", "detriot.cloud");
    expect(configA.databaseName).toBe("spx_db_detriot_cloud_tnt_8492");
    expect(configA.dashboardApiKey).toMatch(/^spx_live_/);
    expect(configA.partitionStatus).toBe("Ready");

    // Test cross-tenant storage isolation:
    // Writing to Tenant A's partition MUST NOT leak into Tenant B's partition
    writeTenantIsolatedStorage("TNT-A", "incidents", [{ id: "INC-A1", title: "Tenant A Alert" }]);
    writeTenantIsolatedStorage("TNT-B", "incidents", [{ id: "INC-B1", title: "Tenant B Alert" }]);

    const tenantAIncidents = readTenantIsolatedStorage("TNT-A", "incidents");
    const tenantBIncidents = readTenantIsolatedStorage("TNT-B", "incidents");

    expect(tenantAIncidents).toHaveLength(1);
    expect(tenantAIncidents[0].id).toBe("INC-A1");

    expect(tenantBIncidents).toHaveLength(1);
    expect(tenantBIncidents[0].id).toBe("INC-B1");

    // Zero cross-tenant leakage
    expect(tenantAIncidents.find((i: any) => i.id === "INC-B1")).toBeUndefined();
    expect(tenantBIncidents.find((i: any) => i.id === "INC-A1")).toBeUndefined();
  });

  it("verifies website connector returns honest error when domain is invalid", async () => {
    const result = await verifyWebsiteConnector("TNT-TEST", "x");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Please enter a valid website domain");
  });

  it("ensures unauthenticated visitors never receive or see any client tenant domains", () => {
    const sensitiveClientTenant: ClientTenant = {
      id: "tnt-sensitive",
      name: "Private Healthcare SaaS",
      contactEmail: "ciso@privatehealth.org",
      primaryDomain: "privatehealth.org",
      planTier: "Enterprise",
      status: "Active",
      enabledModules: ["web_security"],
      apiKey: "spx_secret_key",
      sdkVerified: true,
      guardrailsActive: true,
      requestsPerMin: 500,
      blockedThreats: 88,
      avgLatencyMs: 8,
      quotaUsedPct: 40,
    };

    render(
      React.createElement(GlobalTrafficMeshGlobe, {
        tenants: [sensitiveClientTenant],
        currentUserRole: "unauthenticated",
        portalMode: undefined,
        activeTenantId: null,
      }),
    );

    // Unauthenticated visitors must NEVER see client tenant names or domains
    expect(screen.queryByText(/privatehealth\.org/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private Healthcare SaaS/i)).not.toBeInTheDocument();
  });

  it("validates IPv4, CIDR, and IPv6 address formats accurately", () => {
    expect(validateIpAddress("76.76.21.30").valid).toBe(true);
    expect(validateIpAddress("198.51.100.42/24").valid).toBe(true);
    expect(validateIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334").valid).toBe(true);

    expect(validateIpAddress("").valid).toBe(false);
    expect(validateIpAddress("999.999.999.999").valid).toBe(false);
    expect(validateIpAddress("invalid-ip").valid).toBe(false);
  });

  it("creates a separate database table for tenant IPs and supports adding, listing, probing, and removing IPs", async () => {
    const tenantId = "tnt-detriot-cloud";
    const config = getTenantDatabaseConfig(tenantId, "Detriot Cloud", "detriot.cloud");
    const tableName = config.ipTableName;
    expect(tableName).toBe("spx_db_detriot_cloud_tnt_detriot_cloud_ips");

    // Add first IP
    const addRes1 = addTenantDatabaseIp(tenantId, {
      ipAddress: "76.76.21.30",
      label: "Production Web VPS",
      type: "server_wan",
      notes: "Primary host",
    });

    expect(addRes1.success).toBe(true);
    expect(addRes1.record).toBeDefined();
    expect(addRes1.record?.tableName).toBe(tableName);

    // Verify list
    const ips = getTenantDatabaseIps(tenantId);
    expect(ips.length).toBeGreaterThanOrEqual(1);
    expect(ips.some((i) => i.ipAddress === "76.76.21.30")).toBe(true);

    // Reject duplicate IP
    const addResDup = addTenantDatabaseIp(tenantId, {
      ipAddress: "76.76.21.30",
      label: "Duplicate VPS",
    });
    expect(addResDup.success).toBe(false);
    expect(addResDup.message).toContain("already registered");

    // Probe IP
    const probeRes = await probeTenantDatabaseIp(tenantId, addRes1.record!.id);
    expect(probeRes.success).toBe(true);
    expect(probeRes.latencyMs).toBeGreaterThan(0);

    // Remove IP
    const removeRes = removeTenantDatabaseIp(tenantId, addRes1.record!.id);
    expect(removeRes.success).toBe(true);
    const afterRemove = getTenantDatabaseIps(tenantId);
    expect(afterRemove.some((i) => i.id === addRes1.record!.id)).toBe(false);
  });

  it("resets API IDs and Dashboard API keys easily and issues fresh cryptographically signed credentials", () => {
    const tenantId = "tnt-key-reset-test";
    const initialConfig = getTenantDatabaseConfig(tenantId, "Reset Test Org", "reset.org");
    const initialApiKey = initialConfig.dashboardApiKey;
    const initialClientId = initialConfig.apiClientId;

    expect(initialApiKey).toMatch(/^spx_live_/);
    expect(initialClientId).toMatch(/^spx_cid_/);

    // Reset both
    const resetResult = resetTenantApiCredentials(tenantId, "all");
    expect(resetResult.newApiKey).toMatch(/^spx_live_/);
    expect(resetResult.newApiClientId).toMatch(/^spx_cid_/);
    expect(resetResult.newApiKey).not.toBe(initialApiKey);
    expect(resetResult.newApiClientId).not.toBe(initialClientId);

    // Verify persisted
    const updatedConfig = getTenantDatabaseConfig(tenantId);
    expect(updatedConfig.dashboardApiKey).toBe(resetResult.newApiKey);
    expect(updatedConfig.apiClientId).toBe(resetResult.newApiClientId);
  });

  it("renders DashboardSettingsAndConnector with the dedicated IP table and reset UI", () => {
    const mockTenant: ClientTenant = {
      id: "tnt-ui-test",
      name: "Acme Web",
      contactEmail: "admin@acme.com",
      primaryDomain: "acme.com",
      planTier: "Enterprise",
      status: "Active",
      enabledModules: ["web_security"],
      apiKey: "spx_live_test_123",
      sdkVerified: true,
      guardrailsActive: true,
      requestsPerMin: 100,
      blockedThreats: 4,
      avgLatencyMs: 12,
      quotaUsedPct: 10,
    };

    render(
      React.createElement(DashboardSettingsAndConnector, {
        tenant: mockTenant,
        showToast: vi.fn(),
      }),
    );

    // Verify API credentials & reset button exist
    expect(screen.getByText(/API Credentials & ID Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Reset API IDs & Keys/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Client API ID/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dashboard API Key/i).length).toBeGreaterThan(0);

    // Verify dedicated IP table section exists
    expect(screen.getByText(/Dedicated Tenant IP Database Table/i)).toBeInTheDocument();
    expect(screen.getByText(/Add IP Address to Database Table/i)).toBeInTheDocument();
  });
});
