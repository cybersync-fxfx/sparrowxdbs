import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShieldWafOnboardingView } from "@/components/shield/ShieldWafOnboardingView";
import type { AppUser } from "@/lib/supabase";

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return {
    ...actual,
    persistClientTenantToBackend: vi.fn(async () => true),
    persistProtectedServiceToBackend: vi.fn(async () => true),
    persistAssetToBackend: vi.fn(async () => true),
  };
});

vi.mock("@/components/GrowthAndMonetizationHub", async () => {
  const actual = await vi.importActual<typeof import("@/components/GrowthAndMonetizationHub")>(
    "@/components/GrowthAndMonetizationHub",
  );
  return {
    ...actual,
    runLivePublicDomainScan: vi.fn(async () => null),
  };
});

const TEST_USER: AppUser = {
  id: "USR-CF-01",
  email: "owner@example.com",
  fullName: "Site Owner",
  password: "",
  admin: "no",
  tenantId: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function advanceToStep3(domain = "example.com") {
  render(
    <ShieldWafOnboardingView
      activeUser={TEST_USER}
      onDomainConnected={vi.fn()}
      onLaunchWorkbench={vi.fn()}
      onBackToClientArea={vi.fn()}
      onSignOut={vi.fn()}
    />,
  );

  const input = screen.getByLabelText(/Website or Domain Name/i);
  fireEvent.change(input, { target: { value: domain } });
  fireEvent.click(screen.getByRole("button", { name: /Scan Domain & Continue/i }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Provision WAF & Generate Setup/i })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: /Provision WAF & Generate Setup/i }));

  await waitFor(() => {
    expect(screen.getByRole("tab", { name: /1\. Cloudflare Auto-Setup/i })).toBeInTheDocument();
  });
}

describe("ShieldWafOnboardingView DNS-First & Cloudflare 1-Click Setup", () => {
  it("removes Nginx tab, shows Cloudflare 1-Click Auto-Setup by default, and provides guided step-by-step manual DNS instructions", async () => {
    await advanceToStep3("example.com");

    // Nginx tab is completely removed
    expect(screen.queryByRole("tab", { name: /Nginx/i })).toBeNull();
    expect(screen.getByRole("tab", { name: /1\. Cloudflare Auto-Setup/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /2\. Manual DNS Setup/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /3\. 1-Line Website Script/i })).toBeInTheDocument();

    // Switch to Manual DNS tab and verify step-by-step guidance + short Host labels + Grey Cloud warning
    fireEvent.click(screen.getByRole("tab", { name: /2\. Manual DNS Setup/i }));
    expect(screen.getByText(/No Nginx or Server Changes Needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/DNS Only/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("edge.sparrowx.net").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("@").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("_sparrowx-verify").length).toBeGreaterThanOrEqual(1);
  });

  it("validates Cloudflare token input and executes 1-click Cloudflare auto-config with origin IP backup and live DNS check", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/shield/cloudflare-autoconfig")) {
        return new Response(
          JSON.stringify({
            ok: true,
            zone: { id: "zone-123", name: "example.com" },
            actions: [
              { type: "TXT", name: "_sparrowx-verify.example.com", target: "spx-verify=abc123", status: "created", proxied: false },
              { type: "CNAME", name: "example.com", target: "edge.sparrowx.net", status: "updated", proxied: false },
            ],
            replacedRecords: [{ type: "A", name: "example.com", content: "203.0.113.10", proxied: true }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/shield/dns-verify")) {
        return new Response(
          JSON.stringify({
            ok: true,
            domain: "example.com",
            cnameVerified: true,
            txtVerified: true,
            flattenedMatch: true,
            observedCnames: [],
            observedIps: ["139.99.131.135"],
            observedTxts: ["spx-verify=abc123"],
            checkedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    });

    await advanceToStep3("example.com");

    // Empty submit triggers accessible validation error
    fireEvent.click(screen.getByRole("button", { name: /Auto-Configure Cloudflare DNS/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Paste a valid Cloudflare API Token/i);
    });

    // Submit valid token
    const tokenInput = screen.getByLabelText(/Cloudflare API Token \(Edit zone DNS\)/i);
    fireEvent.change(tokenInput, { target: { value: "cf_test_token_1234567890abcdefghij" } });
    fireEvent.click(screen.getByRole("button", { name: /Auto-Configure Cloudflare DNS/i }));

    await waitFor(() => {
      expect(screen.getByText(/configured automatically!/i)).toBeInTheDocument();
    });

    // Shows backed-up A record IP and live verified DNS status
    expect(screen.getByText(/203\.0\.113\.10/)).toBeInTheDocument();
    expect(screen.getAllByText("VERIFIED").length).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shield/cloudflare-autoconfig",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
