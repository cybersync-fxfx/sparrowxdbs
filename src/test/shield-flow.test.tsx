import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import type { AppUser } from "@/lib/supabase";

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return {
    ...actual,
    fetchAllWorkspaceData: vi.fn(async () => ({
      tenants: [],
      services: [],
      incidents: [],
      assets: [],
    })),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const DEMO_OPERATOR: AppUser = {
  id: "USR-TEST-01",
  email: "operator@yourdomain.com",
  fullName: "Test Operator",
  password: "",
  admin: "no",
  tenantId: null,
};

describe("SparrowX Security (sec.sparrowx.net) Landing -> Client Area -> SOC Dashboard flow", () => {
  it("renders public Landing Page with generic domain examples, zero fake SOC incidents, and dedicated Game DDoS redirect link", () => {
    render(<SparrowxShieldEngine currentUser={null} />);

    expect(
      screen.getByText(/Want to secure your game\? Need to protect your server from DDoS attack\?/i),
    ).toBeInTheDocument();

    const gameSecLinks = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href") === "https://gamesec.sparrowx.net");
    expect(gameSecLinks.length).toBeGreaterThanOrEqual(1);
    expect(gameSecLinks.every((el) => el.getAttribute("target") === "_blank")).toBe(true);

    // Strict no-fake-data check: zero demo SOC telemetry or fake incidents
    expect(screen.queryByText(/FIN-WS-0419/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/INC-4127/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Open Security & SOC Dashboard/i)).not.toBeInTheDocument();
  });

  it("lands authenticated users in the Client Area first (with Off / Not Configured states) before entering the Security + SOC Dashboard", async () => {
    render(<SparrowxShieldEngine currentUser={DEMO_OPERATOR} initialStage="client-area" />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Test Operator/i)).toBeInTheDocument();
    });

    // Strict rule: unintegrated modules stay Off / Not Configured
    expect(screen.getAllByText(/Not Configured/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/^Off$/i).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByRole("link").filter((el) => el.getAttribute("href") === "https://gamesec.sparrowx.net").length,
    ).toBeGreaterThanOrEqual(1);

    // Must not render the SOC dashboard view before clicking Dashboard button
    expect(screen.queryByRole("navigation", { name: /SOC Dashboard Sections/i })).not.toBeInTheDocument();

    // Click the Dashboard button to enter Security + SOC Dashboard
    const openDashboardBtn = screen.getByRole("button", { name: /Open Security & SOC Dashboard/i });
    fireEvent.click(openDashboardBtn);

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: /SOC Dashboard Sections/i })).toBeInTheDocument();
    });

    // Functional tools inside SOC Dashboard & zero fake incidents
    expect(screen.getAllByRole("button", { name: /Client Area/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Run Origin Audit/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").filter((el) => el.getAttribute("href") === "https://gamesec.sparrowx.net").length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/FIN-WS-0419/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/INC-4127/i)).not.toBeInTheDocument();
  });
});
