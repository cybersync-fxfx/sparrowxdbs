import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEggResourceProfile } from "@/lib/egg-smart-plans";
import type { EggDetailsView } from "@/lib/portal-types";
import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";

const mockGetEggConfigDetails = vi.fn();
const mockDeployPlan = vi.fn();

vi.mock("@/lib/portal.functions", () => ({
  getEggConfigDetails: (...args: unknown[]) => mockGetEggConfigDetails(...args),
  deployPlan: (...args: unknown[]) => mockDeployPlan(...args),
  getDashboard: vi.fn(),
  getServers: vi.fn(),
  getSubscriptions: vi.fn(),
  getTransactions: vi.fn(),
}));

import { ServerDeployWizard } from "@/components/dashboard/ServerDeployWizard";

const SAMP_EGG: EggCatalogItem = {
  id: "games:samp-1",
  section: "games",
  nestName: "SparrowX Game Servers",
  nestId: 10,
  eggId: 77,
  installed: true,
  name: "SA-MP",
  category: "Gta / Samp",
  description: "San Andreas Multiplayer dedicated server",
  author: "pterodactyl",
  dockerImage: "ghcr.io/ptero-eggs/games:samp",
  repoPath: "gta/samp/egg-s-a-m-p.json",
};

const SAMP_EGG_DETAILS: EggDetailsView = {
  nestId: 10,
  eggId: 77,
  name: "SA-MP",
  description: "San Andreas Multiplayer",
  dockerImage: "ghcr.io/ptero-eggs/games:samp",
  dockerImages: {
    "SA-MP 0.3.7": "ghcr.io/ptero-eggs/games:samp",
  },
  startup: "./samp03svr",
  variables: [
    {
      name: "RCON Password",
      description: "Password used for remote admin RCON login.",
      envVariable: "RCON_PASSWORD",
      defaultValue: "changeme",
      serverValue: "changeme",
      userViewable: true,
      userEditable: true,
      rules: "required|string|max:32",
    },
    {
      name: "Server Hostname",
      description: "Public name shown in SA-MP server browser.",
      envVariable: "HOSTNAME",
      defaultValue: "SA-MP 0.3 Server",
      serverValue: "SA-MP 0.3 Server",
      userViewable: true,
      userEditable: true,
      rules: "required|string|max:64",
    },
    {
      name: "Max Players",
      description: "Maximum player slots.",
      envVariable: "MAX_PLAYERS",
      defaultValue: "50",
      serverValue: "50",
      userViewable: true,
      userEditable: true,
      rules: "required|numeric|between:1,1000",
    },
    {
      name: "Gamemode 0",
      description: "Primary gamemode .amx script.",
      envVariable: "GAMEMODE0",
      defaultValue: "grandlarc 1",
      serverValue: "grandlarc 1",
      userViewable: true,
      userEditable: true,
      rules: "nullable|string",
    },
  ],
};

describe("ServerDeployWizard (Guided 3-Step Smart Creator)", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    mockGetEggConfigDetails.mockResolvedValue(SAMP_EGG_DETAILS);
    mockDeployPlan.mockResolvedValue({ coins: 721, serverName: "Los Santos Mafia RP" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("clears unsafe SA-MP defaults (changeme), blocks creation until RCON is configured, supports password generation, and deploys with custom env", async () => {
    const profile = resolveEggResourceProfile(SAMP_EGG);
    const plan = profile.plans[2]!; // Los Santos RP (4GB, 350 slots, 279 coins)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <ServerDeployWizard
          open={true}
          onClose={vi.fn()}
          coins={1000}
          service="samp"
          profile={profile}
          initialPlan={plan}
          selectedEgg={SAMP_EGG}
          onNeedCoins={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Wait for egg details to load
    await waitFor(() => {
      expect(screen.getByText(/4 egg variables loaded live/i)).toBeDefined();
    });

    // Step 1 blocks blank server name
    fireEvent.click(screen.getByRole("button", { name: /Next: Required Setup/i }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a custom server name");

    // Enter real server name & advance to Step 2
    fireEvent.change(screen.getByLabelText(/Custom Server Name/i), {
      target: { value: "Los Santos Mafia RP" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next: Required Setup/i }));

    // Step 2: unsafe default "changeme" was cleared! Hostname synced to custom server name!
    const rconInput = screen.getByLabelText(/^RCON Password$/i, { selector: "input" }) as HTMLInputElement;
    expect(rconInput.value).toBe("");
    expect(screen.getByText("Default Cleared")).toBeDefined();

    const hostnameInput = screen.getByLabelText(/^Server Hostname$/i, { selector: "input" }) as HTMLInputElement;
    expect(hostnameInput.value).toBe("Los Santos Mafia RP");

    const maxPlayersInput = screen.getByLabelText(/^Max Players$/i, { selector: "input" }) as HTMLInputElement;
    expect(maxPlayersInput.value).toBe("350");

    // Trying to skip Step 2 without setting RCON Password is blocked!
    fireEvent.click(screen.getByRole("button", { name: /Next: Review & Launch/i }));
    expect(screen.getByRole("alert").textContent).toContain("RCON Password is required");

    // Click Generate button to create a strong RCON password
    fireEvent.click(screen.getByRole("button", { name: /^Generate$/i }));
    expect(rconInput.value.length).toBeGreaterThanOrEqual(16);
    const generatedRcon = rconInput.value;

    // Advance cleanly to Step 3 Review
    fireEvent.click(screen.getByRole("button", { name: /Next: Review & Launch/i }));
    expect(screen.getByText(/Step 3 · Review Configuration/i)).toBeDefined();
    expect(screen.getByText("••••••••••")).toBeDefined();

    // Launch configured server -> passes generated RCON & custom hostname into deployPlan!
    fireEvent.click(screen.getByRole("button", { name: /Create & Launch Server/i }));

    await waitFor(() => {
      expect(mockDeployPlan).toHaveBeenCalledWith({
        data: {
          planId: "smart-samp-3",
          serverName: "Los Santos Mafia RP",
          eggOverride: {
            nestId: 10,
            eggId: 77,
            dockerImage: "ghcr.io/ptero-eggs/games:samp",
            environment: {
              RCON_PASSWORD: generatedRcon,
              HOSTNAME: "Los Santos Mafia RP",
              MAX_PLAYERS: "350",
              GAMEMODE0: "grandlarc 1",
            },
          },
        },
      });
    });
  });
});
