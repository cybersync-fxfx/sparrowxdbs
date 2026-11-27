import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfigView, ServerView } from "@/lib/portal-types";

const mockGetLiveServerConfig = vi.fn();
const mockSaveLiveServerConfig = vi.fn();
const mockReinstallLiveServer = vi.fn();
const mockGetEggConfigDetails = vi.fn();

vi.mock("@/lib/portal.functions", () => ({
  getLiveServerConfig: (...args: unknown[]) => mockGetLiveServerConfig(...args),
  saveLiveServerConfig: (...args: unknown[]) => mockSaveLiveServerConfig(...args),
  reinstallLiveServer: (...args: unknown[]) => mockReinstallLiveServer(...args),
  getEggConfigDetails: (...args: unknown[]) => mockGetEggConfigDetails(...args),
  getDashboard: vi.fn(),
  getServers: vi.fn(),
  getSubscriptions: vi.fn(),
  getTransactions: vi.fn(),
}));

import { ServerConfigModal } from "@/components/dashboard/ServerConfigModal";

const MOCK_SERVER: ServerView = {
  id: "42",
  identifier: "ab12cd34",
  name: "SparrowX SMP",
  description: "Main survival realm",
  service: "minecraft",
  planName: "Pro 8GB",
  nestId: 10,
  eggId: 101,
  eggName: "Paper",
  dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
  status: "ONLINE",
  address: "play.sparrowx.net:25565",
  ramLimitMb: 8192,
  ramUsedMb: 2048,
  cpuLimit: 200,
  cpuUsed: 32,
  diskLimitGb: 40,
  expiresAt: "2026-12-27T00:00:00Z",
  manageUrl: "https://game.panel.sparrowx.net/server/ab12cd34",
};

const MOCK_CONFIG: ServerConfigView = {
  serverId: 42,
  identifier: "ab12cd34",
  name: "SparrowX SMP",
  description: "Main survival realm",
  nestId: 10,
  nestName: "SparrowX Game Servers",
  eggId: 101,
  eggName: "Paper",
  startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
  dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
  dockerImages: {
    "Java 21": "ghcr.io/pterodactyl/yolks:java_21",
    "Java 17": "ghcr.io/pterodactyl/yolks:java_17",
  },
  variables: [
    {
      name: "Server Jar File",
      description: "The name of the server jarfile to run.",
      envVariable: "SERVER_JARFILE",
      defaultValue: "server.jar",
      serverValue: "server.jar",
      userViewable: true,
      userEditable: true,
      rules: "required|string",
    },
    {
      name: "RCON Password",
      description: "Password used for RCON remote commands.",
      envVariable: "RCON_PASSWORD",
      defaultValue: "",
      serverValue: "super-secret-rcon",
      userViewable: true,
      userEditable: true,
      rules: "nullable|string",
    },
  ],
  limits: { memory: 8192, swap: 0, disk: 40960, io: 500, cpu: 200 },
  featureLimits: { databases: 2, allocations: 1, backups: 3 },
  address: "play.sparrowx.net:25565",
  panelUrl: "https://game.panel.sparrowx.net",
};

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ServerConfigModal server={MOCK_SERVER} open={true} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("ServerConfigModal (Live Panel <-> Client Area Configurator)", () => {
  beforeEach(() => {
    // JSDOM does not implement HTMLDialogElement.prototype.showModal/close natively
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    mockGetLiveServerConfig.mockResolvedValue(MOCK_CONFIG);
    mockSaveLiveServerConfig.mockResolvedValue(MOCK_CONFIG);
    mockReinstallLiveServer.mockResolvedValue({ ok: true, message: "Reinstall queued" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads live Pterodactyl variables, masks secrets, and saves edits back to Panel", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByDisplayValue("server.jar")).toBeDefined();
    });

    // Secret field starts masked and toggles cleanly with aria-pressed
    const rconInput = screen.getByLabelText(/^RCON Password$/i, { selector: "input" }) as HTMLInputElement;
    expect(rconInput.type).toBe("password");
    const revealBtn = screen.getByRole("button", { name: /Show RCON Password/i });
    fireEvent.click(revealBtn);
    expect(rconInput.type).toBe("text");

    // Edit variable + switch Docker image
    const jarInput = screen.getByDisplayValue("server.jar");
    fireEvent.change(jarInput, { target: { value: "purpur.jar" } });

    const imgSelect = screen.getByLabelText(/Container Runtime \/ Docker Image/i);
    fireEvent.change(imgSelect, { target: { value: "ghcr.io/pterodactyl/yolks:java_17" } });

    // Save to Panel
    fireEvent.click(screen.getByRole("button", { name: /^Save to Panel$/i }));

    await waitFor(() => {
      expect(mockSaveLiveServerConfig).toHaveBeenCalledWith({
        data: {
          serverId: 42,
          dockerImage: "ghcr.io/pterodactyl/yolks:java_17",
          environment: {
            SERVER_JARFILE: "purpur.jar",
            RCON_PASSWORD: "super-secret-rcon",
          },
          restartAfter: false,
        },
      });
    });
  });

  it("renders auto-SSO Panel deep-links and guards unsaved edits on close", async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    await waitFor(() => {
      expect(screen.getByDisplayValue("server.jar")).toBeDefined();
    });

    // Direct Panel SSO links exist
    const filesLinks = screen.getAllByRole("link", { name: /Files/i });
    expect(filesLinks.some((a) => a.getAttribute("href")?.includes("%2Fserver%2Fab12cd34%2Ffiles"))).toBe(true);

    // Dirty an input and try closing -> triggers unsaved changes guard instead of silently closing
    fireEvent.change(screen.getByDisplayValue("server.jar"), { target: { value: "changed.jar" } });
    fireEvent.click(screen.getByRole("button", { name: /Close server configurator/i }));

    expect(screen.getByText(/unsaved changes not synced/i)).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();

    // Confirm Discard Changes closes cleanly
    fireEvent.click(screen.getByRole("button", { name: /Discard Changes/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
