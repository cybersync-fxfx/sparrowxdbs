import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ClientPortalView } from "@/components/portals/ClientAndAdminPortals";
import type { ClientTenant } from "@/lib/supabase";

describe("ClientPortalView render test", () => {
  const mockTenant: ClientTenant = {
    id: "tenant-1",
    name: "Production API",
    contactEmail: "admin@company.com",
    primaryDomain: "api.company.com",
    planTier: "Growth",
    status: "Active",
    enabledModules: ["web_waf"],
    apiKey: "spx_test_key_1234567890",
    sdkVerified: true,
    guardrailsActive: true,
    requestsPerMin: 120,
    blockedThreats: 4,
    avgLatencyMs: 8,
    quotaUsedPct: 15,
  };

  it("renders ClientPortalView with tenants", () => {
    const { container } = render(
      <ClientPortalView
        activeNav="My Services"
        assets={[]}
        currentUser={{ id: "u1", email: "admin@company.com", fullName: "Admin User", role: "admin" } as any}
        incidents={[]}
        onCreateTenant={vi.fn()}
        onDeleteTenant={vi.fn()}
        onGenerateReport={vi.fn()}
        onNavigate={vi.fn()}
        onOpenServiceSdk={vi.fn()}
        onRenameOrUpdateTenant={vi.fn()}
        onSelectTenant={vi.fn()}
        onSignOut={vi.fn()}
        onToggleTenantModule={vi.fn()}
        onUpdateUserProfile={vi.fn()}
        onVerifyTenantSdk={vi.fn()}
        protectedServices={[]}
        reports={[]}
        selectedTenantId="tenant-1"
        showToast={vi.fn()}
        tenants={[mockTenant]}
        vulnerabilities={[]}
      />
    );
    expect(container).toBeDefined();
  });

  it("renders ClientPortalView with empty tenants list", () => {
    const { container } = render(
      <ClientPortalView
        activeNav="My Services"
        assets={[]}
        currentUser={{ id: "u1", email: "admin@company.com", fullName: "Admin User", role: "admin" } as any}
        incidents={[]}
        onCreateTenant={vi.fn()}
        onDeleteTenant={vi.fn()}
        onGenerateReport={vi.fn()}
        onNavigate={vi.fn()}
        onOpenServiceSdk={vi.fn()}
        onRenameOrUpdateTenant={vi.fn()}
        onSelectTenant={vi.fn()}
        onSignOut={vi.fn()}
        onToggleTenantModule={vi.fn()}
        onUpdateUserProfile={vi.fn()}
        onVerifyTenantSdk={vi.fn()}
        protectedServices={[]}
        reports={[]}
        selectedTenantId=""
        showToast={vi.fn()}
        tenants={[]}
        vulnerabilities={[]}
      />
    );
    expect(container).toBeDefined();
  });
});
