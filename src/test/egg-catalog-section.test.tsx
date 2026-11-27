import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EggCatalogSection } from "@/components/dashboard/EggCatalogSection";

const MOCK_CATALOG = {
  ok: true,
  version: "2.0.0",
  generatedAt: "2026-11-27T04:00:00Z",
  totalEggs: 3,
  sections: [
    {
      id: "games" as const,
      title: "Game Servers",
      nestName: "SparrowX Game Servers",
      nestId: 10,
      repoUrl: "https://github.com/pterodactyl/game-eggs",
      commit: "be654a2",
      count: 1,
    },
    {
      id: "applications" as const,
      title: "Applications & Bots",
      nestName: "SparrowX Applications & Bots",
      nestId: 11,
      repoUrl: "https://github.com/pterodactyl/application-eggs",
      commit: "1220866",
      count: 1,
    },
    {
      id: "generic" as const,
      title: "Generic Runtimes",
      nestName: "SparrowX Generic Runtimes",
      nestId: 12,
      repoUrl: "https://github.com/pterodactyl/generic-eggs",
      commit: "6e8d254",
      count: 1,
    },
  ],
  eggs: [
    {
      id: "games:paper-1",
      section: "games" as const,
      nestName: "SparrowX Game Servers",
      nestId: 10,
      eggId: 101,
      installed: true,
      name: "Paper",
      category: "Minecraft / Java",
      description: "High performance Minecraft Java server",
      author: "pterodactyl",
      dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
      repoPath: "minecraft/java/paper/egg-paper.json",
    },
    {
      id: "applications:uptime-kuma-1",
      section: "applications" as const,
      nestName: "SparrowX Applications & Bots",
      nestId: 11,
      eggId: 201,
      installed: true,
      name: "Uptime Kuma",
      category: "Monitoring",
      description: "Self-hosted status monitoring tool",
      author: "pterodactyl",
      dockerImage: "ghcr.io/pterodactyl/yolks:nodejs_20",
      repoPath: "monitoring/uptime-kuma/egg-uptime-kuma.json",
    },
    {
      id: "generic:python-1",
      section: "generic" as const,
      nestName: "SparrowX Generic Runtimes",
      nestId: 12,
      eggId: 301,
      installed: false,
      name: "Python Generic",
      category: "Python",
      description: "Generic Python runtime container",
      author: "pterodactyl",
      dockerImage: "ghcr.io/pterodactyl/yolks:python_3.12",
      repoPath: "python/egg-python-generic.json",
    },
  ],
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("EggCatalogSection", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all 3 separate repository sections, switches tabs, and filters by search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_CATALOG,
      }),
    );

    const onDeploy = vi.fn();
    renderWithQuery(<EggCatalogSection onSelectDeployPlans={onDeploy} />);

    // Default section: Game Servers
    await waitFor(() => {
      expect(screen.getByText("Paper")).toBeDefined();
    });
    expect(screen.getByText(/sudo sparrowx-eggs sync/i)).toBeDefined();
    expect(screen.getByText("Panel Live")).toBeDefined();
    expect(screen.queryByText("Uptime Kuma")).toBeNull();

    // Switch to Applications & Bots section
    fireEvent.click(screen.getByRole("tab", { name: /Applications & Bots/i }));
    expect(screen.getByText("Uptime Kuma")).toBeDefined();
    expect(screen.queryByText("Paper")).toBeNull();

    // Switch to Generic Runtimes section
    fireEvent.click(screen.getByRole("tab", { name: /Generic Runtimes/i }));
    expect(screen.getByText("Python Generic")).toBeDefined();

    // Filter with search query
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "nonexistent-egg" } });
    expect(screen.getByText(/No eggs matched/i)).toBeDefined();

    fireEvent.change(searchInput, { target: { value: "python" } });
    expect(screen.getByText("Python Generic")).toBeDefined();

    // Click Deploy CTA
    fireEvent.click(screen.getByRole("button", { name: /Deploy/i }));
    expect(onDeploy).toHaveBeenCalledTimes(1);
  });
});
