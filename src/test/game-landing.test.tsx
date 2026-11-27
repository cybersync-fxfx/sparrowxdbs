import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCardDestination, GameHostingShowcase } from "@/components/site/GameHostingShowcase";
import { PlatformFeatures } from "@/components/site/PlatformFeatures";

const mockUseSessionSummary = vi.fn();

vi.mock("@/components/site/Navbar", () => ({
  useSessionSummary: () => mockUseSessionSummary(),
  LOGIN_HREF: "/login?next=%2Fgame%2Fdashboard",
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Redesigned /game Landing Page Showcase & Features", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("routes guests to /login?next=/game/dashboard?egg=... and logged-in users directly to Client Area", () => {
    expect(buildCardDestination(false, "samp", "games")).toBe(
      "/login?next=%2Fgame%2Fdashboard%3Fegg%3Dsamp%26section%3Dgames",
    );
    expect(buildCardDestination(true, "samp", "games")).toBe(
      "/game/dashboard?egg=samp&section=games",
    );
  });

  it("renders visual artwork cards across Games (254), Apps & Bots (55), and Cloud Runtimes (12) without static pricing", () => {
    mockUseSessionSummary.mockReturnValue({ data: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: "2.0.0",
          generatedAt: "2026-11-27T00:00:00Z",
          totalEggs: 321,
          sections: [
            { id: "games", title: "Game Servers", nestName: "SparrowX Game Servers", nestId: 1, repoUrl: "", commit: "abc", count: 254 },
            { id: "applications", title: "Applications & Bots", nestName: "SparrowX Applications & Bots", nestId: 2, repoUrl: "", commit: "def", count: 55 },
            { id: "generic", title: "Generic Runtimes", nestName: "SparrowX Generic Runtimes", nestId: 3, repoUrl: "", commit: "ghi", count: 12 },
          ],
          eggs: [],
        }),
      }),
    );

    renderWithQuery(
      <>
        <GameHostingShowcase />
        <PlatformFeatures />
      </>,
    );

    // Flagship game cards rendered with real images and guest redirect to /login
    const sampHeading = screen.getByText("SA-MP & open.mp");
    const sampAnchor = sampHeading.closest("a");
    expect(sampAnchor?.getAttribute("href")).toBe(
      "/login?next=%2Fgame%2Fdashboard%3Fegg%3Dsamp%26section%3Dgames",
    );
    expect(screen.getByAltText("Rust Dedicated hosting on SparrowX")).toBeDefined();

    // Switch to Applications & Bots tab
    fireEvent.click(screen.getByRole("tab", { name: /Apps & Bots/i }));
    expect(screen.getByText("PostgreSQL & MariaDB")).toBeDefined();

    // Switch to Cloud Runtimes tab
    fireEvent.click(screen.getByRole("tab", { name: /Cloud Runtimes/i }));
    expect(screen.getByText("Python Generic")).toBeDefined();

    // Interactive feature switcher works cleanly
    fireEvent.click(screen.getByRole("tab", { name: /Guided setup with zero unsafe defaults/i }));
    expect(screen.getByText(/Pre-Launch Security/i)).toBeDefined();
  });

  it("links directly to /game/dashboard?egg=... when user is signed in", () => {
    mockUseSessionSummary.mockReturnValue({
      data: { id: "u1", email: "player@sparrowx.net", username: "Player", avatarUrl: null },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    renderWithQuery(<GameHostingShowcase />);

    const mcAnchor = screen.getByText("Minecraft Java & Modded").closest("a");
    expect(mcAnchor?.getAttribute("href")).toBe("/game/dashboard?egg=paper&section=games");
  });
});
