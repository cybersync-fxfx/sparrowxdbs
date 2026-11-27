import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShieldSocDashboardView } from "@/components/shield/ShieldSocDashboardView";
import type { AppUser, ClientTenant } from "@/lib/supabase";

const TEST_USER: AppUser = {
  id: "USR-SOC-01",
  email: "lead@sparrowx.net",
  fullName: "SOC Lead",
  password: "",
  admin: "no",
  tenantId: "tnt-sec-01",
};

const TEST_TENANT: ClientTenant = {
  id: "tnt-sec-01",
  name: "SparrowX Edge",
  contactEmail: "lead@sparrowx.net",
  primaryDomain: "sparrowx.net",
  planTier: "SparrowX Edge Core",
  status: "Active",
  enabledModules: ["web_security", "ai_shield", "cloud_security", "compliance"],
  apiKey: "spx_waf_1234567890abcdef1234",
  sdkVerified: false,
  guardrailsActive: true,
  requestsPerMin: 140,
  blockedThreats: 0,
  avgLatencyMs: 11,
  quotaUsedPct: 8,
};

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("SparrowX Shield — Midnight Silver Tactical SOC Command Center", () => {
  it("renders unified single-shell SOC workbench with zero duplicate Sign Out buttons and zero fake incidents", () => {
    render(
      <ShieldSocDashboardView
        activeUser={TEST_USER}
        tenants={[TEST_TENANT]}
        activeDomainId="tnt-sec-01"
        incidents={[]}
        assets={[]}
        onIncidentsUpdated={vi.fn()}
        onResolveIncident={vi.fn()}
        onToggleAssetIsolation={vi.fn()}
        onBackToClientArea={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Unified shell: single SOC Dashboard Sections rail + single Sign Out button
    expect(screen.getByRole("navigation", { name: /SOC Dashboard Sections/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Sign Out$/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Run Origin Audit/i })).toBeInTheDocument();
    expect(screen.getByText(/Live Edge Telemetry Stream/i)).toBeInTheDocument();

    // Zero legacy fake incidents in zero-incident state
    expect(screen.queryByText(/FIN-WS-0419/i)).toBeNull();
    expect(screen.queryByText(/INC-4127/i)).toBeNull();

    // Sensor key masked by default until reveal toggle is pressed
    expect(screen.queryByText("spx_waf_1234567890abcdef1234")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Reveal Edge WAF sensor key/i }));
    expect(screen.getByText("spx_waf_1234567890abcdef1234")).toBeInTheDocument();

    // Both left rail & footer banner link safely to dedicated Game DDoS portal
    const gameLinks = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href") === "https://gamesec.sparrowx.net");
    expect(gameLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("runs and exits the safe client-side Sandbox Attack Drill without mutating real DB incidents", async () => {
    const onIncidentsUpdated = vi.fn();

    render(
      <ShieldSocDashboardView
        activeUser={TEST_USER}
        tenants={[TEST_TENANT]}
        activeDomainId="tnt-sec-01"
        incidents={[]}
        assets={[]}
        onIncidentsUpdated={onIncidentsUpdated}
        onResolveIncident={vi.fn()}
        onToggleAssetIsolation={vi.fn()}
        onBackToClientArea={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    const drillBtn = screen.getByRole("button", { name: /Run Sandbox Attack Drill/i });
    fireEvent.click(drillBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/SIMULATION DRILL/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/DRILL-9041/i).length).toBeGreaterThanOrEqual(1);
    });

    // Real backend incident state must never be mutated by sandbox simulation
    expect(onIncidentsUpdated).not.toHaveBeenCalled();

    // Exit drill cleanly
    fireEvent.click(screen.getByRole("button", { name: /Exit Sandbox Drill/i }));
    await waitFor(() => {
      expect(screen.queryByText(/DRILL-9041/i)).toBeNull();
    });
  });

  it("supports AI Prompt Firewall inspection, IOC blocklist validation, Reverse Proxy stack switch, and Ctrl+K palette", async () => {
    render(
      <ShieldSocDashboardView
        activeUser={TEST_USER}
        tenants={[TEST_TENANT]}
        activeDomainId="tnt-sec-01"
        incidents={[]}
        assets={[]}
        onIncidentsUpdated={vi.fn()}
        onResolveIncident={vi.fn()}
        onToggleAssetIsolation={vi.fn()}
        onBackToClientArea={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // 1. AI Prompt Firewall preset chip triggers verdict & WAF rule generator
    fireEvent.click(screen.getByRole("button", { name: "Prompt Injection" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Generate & Copy WAF Rule/i })).toBeInTheDocument();
    });

    // 2. Reverse Proxy stack switcher updates code frame filename cleanly
    expect(screen.getByText("/etc/nginx/sites-available/sparrowx.conf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Caddy" }));
    expect(screen.getByText("Caddyfile")).toBeInTheDocument();

    // 3. Firewall Blocklist IOC validation + removable chip + Live Edge Telemetry Ticker entry
    const iocInput = screen.getByLabelText(/Malicious IPv4 or domain indicator/i);
    fireEvent.change(iocInput, { target: { value: "203.0.113.45" } });
    fireEvent.click(screen.getByRole("button", { name: /Add IOC/i }));
    expect(screen.getAllByText("203.0.113.45").length).toBeGreaterThanOrEqual(2);

    // 4. Global Ctrl+K opens Command Palette
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search SOC modules, domains/i)).toBeInTheDocument();
    });
  });
});
