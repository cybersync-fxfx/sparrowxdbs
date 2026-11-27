import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isGameAdminEmail } from "@/lib/server/portal.server";
import type { AdminOverviewData } from "@/lib/portal-types";

const mockGetAdminOverview = vi.fn();
const mockAdminAdjustCoins = vi.fn();
const mockAdminUpdateSubscription = vi.fn();
const mockAdminAssignSubscription = vi.fn();
const mockAdminSetUserAdminRole = vi.fn();

vi.mock("@/lib/portal.functions", () => ({
  getAdminOverview: (...args: unknown[]) => mockGetAdminOverview(...args),
  adminAdjustCoins: (...args: unknown[]) => mockAdminAdjustCoins(...args),
  adminUpdateSubscription: (...args: unknown[]) => mockAdminUpdateSubscription(...args),
  adminAssignSubscription: (...args: unknown[]) => mockAdminAssignSubscription(...args),
  adminSetUserAdminRole: (...args: unknown[]) => mockAdminSetUserAdminRole(...args),
  getDashboard: vi.fn(),
  getServers: vi.fn(),
  getSubscriptions: vi.fn(),
  getTransactions: vi.fn(),
}));

import { AdminControlPanel } from "@/components/dashboard/AdminControlPanel";

const MOCK_OVERVIEW: AdminOverviewData = {
  adminEmail: "atchukriz@gmail.com",
  stats: {
    totalClients: 2,
    totalCoins: 1750,
    activeSubscriptions: 1,
    expiredSubscriptions: 0,
    monthlyCoinVolume: 349,
  },
  clients: [
    {
      id: "cli-1",
      email: "player@example.com",
      username: "ProPlayer",
      pteroUserId: 14,
      pteroUsername: "proplayer",
      coins: 250,
      createdAt: "2026-11-01T10:00:00Z",
      subscriptionCount: 1,
      activeSubscriptions: 1,
      isAdmin: false,
      isPrimaryAdmin: false,
    },
    {
      id: "cli-2",
      email: "atchukriz@gmail.com",
      username: "Atchu Kriz",
      pteroUserId: 1,
      pteroUsername: "atchukriz_ac24",
      coins: 1500,
      createdAt: "2026-10-01T10:00:00Z",
      subscriptionCount: 0,
      activeSubscriptions: 0,
      isAdmin: true,
      isPrimaryAdmin: true,
    },
  ],
  subscriptions: [
    {
      id: "sub-1",
      clientId: "cli-1",
      clientEmail: "player@example.com",
      clientUsername: "ProPlayer",
      pteroServerId: 88,
      serviceType: "minecraft",
      planName: "Core SMP",
      priceCoins: 349,
      status: "active",
      expiresAt: "2026-12-20T00:00:00Z",
      createdAt: "2026-11-20T00:00:00Z",
    },
  ],
  recentTransactions: [
    {
      id: "tx-1",
      clientId: "cli-1",
      clientEmail: "player@example.com",
      amount: 500,
      type: "topup",
      description: "UPI top-up",
      createdAt: "2026-11-20T00:00:00Z",
    },
  ],
};

describe("Client Area Admin Access & Control Panel (atchukriz@gmail.com)", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    mockGetAdminOverview.mockResolvedValue(MOCK_OVERVIEW);
    mockAdminAdjustCoins.mockResolvedValue({
      ok: true,
      clientId: "cli-1",
      email: "player@example.com",
      previousCoins: 250,
      newCoins: 750,
      delta: 500,
    });
    mockAdminUpdateSubscription.mockResolvedValue({
      ok: true,
      subscription: { ...MOCK_OVERVIEW.subscriptions[0]!, planName: "Diamond SMP", priceCoins: 499 },
      panelSyncedLimits: true,
      panelSyncedStatus: true,
      panelWarning: null,
    });
    mockAdminSetUserAdminRole.mockResolvedValue({
      ok: true,
      clientId: "cli-1",
      email: "player@example.com",
      isAdmin: true,
      appointedBy: "atchukriz@gmail.com",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("strictly authorizes atchukriz@gmail.com (case-insensitive) and rejects non-admin emails", () => {
    expect(isGameAdminEmail("atchukriz@gmail.com")).toBe(true);
    expect(isGameAdminEmail("  ATCHUKRIZ@GMAIL.COM ")).toBe(true);
    expect(isGameAdminEmail("other@gmail.com")).toBe(false);
    expect(isGameAdminEmail("atchukriz@gmail.com.evil.net")).toBe(false);
    expect(isGameAdminEmail(null)).toBe(false);
  });

  it("lets atchukriz@gmail.com appoint a new admin from the user list, adjust coins, and edit subscriptions", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AdminControlPanel />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Super Admin · atchukriz@gmail.com/i)).toBeDefined();
    });

    // Primary Admin badge shown on atchukriz@gmail.com, Make Admin shown only on non-primary client
    expect(screen.getByText("Primary Admin")).toBeDefined();
    const makeAdminBtn = screen.getByRole("button", { name: /Make Admin/i });
    fireEvent.click(makeAdminBtn);

    await waitFor(() => {
      expect(mockAdminSetUserAdminRole).toHaveBeenCalledWith({
        data: {
          clientId: "cli-1",
          makeAdmin: true,
        },
      });
    });

    // Manage coins for player@example.com
    const coinButtons = screen.getAllByRole("button", { name: /^Coins$/i });
    fireEvent.click(coinButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Apply Coin Update/i }));

    await waitFor(() => {
      expect(mockAdminAdjustCoins).toHaveBeenCalledWith({
        data: {
          clientId: "cli-1",
          mode: "add",
          amount: 500,
          note: undefined,
        },
      });
    });

    // Switch to Subscriptions & Plans tab and trigger +30d quick extend
    fireEvent.click(screen.getByRole("tab", { name: /Subscriptions & Plans/i }));
    expect(screen.getByText("Core SMP")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /\+30d/i }));
    await waitFor(() => {
      expect(mockAdminUpdateSubscription).toHaveBeenCalledWith({
        data: {
          subscriptionId: "sub-1",
          extendDays: 30,
          status: "active",
          syncPanelStatus: true,
        },
      });
    });
  });
});
