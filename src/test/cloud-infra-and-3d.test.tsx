import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { matchProductSubdomain, resolveRootRedirectTarget } from "@/lib/routing";
import { computePlanPrice, INFRA_PLANS } from "@/lib/infra-plans";
import { SparrowxInfraEngine } from "@/components/SparrowxInfraEngine";
import { Floating3DVisual } from "@/components/ui/Floating3DVisual";
import {
  clearInfraServerStoreForTests,
  executeServerAction,
  listManagedInfraServers,
} from "@/lib/server/proxmox.server";
import {
  createUpiOrder,
  getUpiOrder,
  processUpiAutoWebhook,
} from "@/lib/server/upi-payments.server";

describe("SparrowX Cloud Infra (infra.sparrowx.net) & 3D Floating Visuals", () => {
  it("routes infra.sparrowx.net and metal.sparrowx.net to /infra", () => {
    expect(matchProductSubdomain("infra.sparrowx.net")).toEqual({
      product: "infra",
      prefix: "infra.",
      route: "/infra",
    });
    expect(resolveRootRedirectTarget({ hostname: "infra.sparrowx.net" })).toEqual({
      to: "/infra",
      search: {},
    });
    expect(resolveRootRedirectTarget({ search: { infra: "1" } })).toEqual({
      to: "/infra",
      search: {},
    });
  });

  it("computes quarterly (-5%) and annual (-15%) discounts cleanly", () => {
    const plan = INFRA_PLANS.find((p) => p.id === "bm-ryzen-9950x")!;
    const monthly = computePlanPrice(plan, "USD", "monthly");
    const annual = computePlanPrice(plan, "USD", "annual");
    expect(monthly.unitMonthly).toBe(199);
    expect(annual.unitMonthly).toBe(Math.round(199 * 0.85));
    expect(annual.cycleMonths).toBe(12);
  });

  it("renders Floating3DVisual cleanly without caption or pause overlay clutter", () => {
    render(
      <Floating3DVisual
        src="/3d/cloud-infra-server.jpg"
        alt="3D Server Cluster"
        priority="lcp"
      />,
    );
    const img = screen.getByAltText("3D Server Cluster");
    expect(img).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pause 3D animation/i })).toBeNull();
  });

  it("renders simplified SparrowxInfraEngine hero and reveals Bare Metal & Cloud KVM VPS plans only when selected in workload selector", () => {
    render(<SparrowxInfraEngine />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Your life's work deserves infrastructure/i }),
    ).toBeTruthy();
    // Raw silicon, Tier IV Mumbai, and Pterodactyl Panel must not appear on SparrowX Infra
    expect(screen.queryByText(/Raw silicon/i)).toBeNull();
    expect(screen.queryByText(/Tier IV Mumbai/i)).toBeNull();
    expect(screen.queryByText(/Pterodactyl Panel/i)).toBeNull();
    // SparrowX Sec & NetSec logos must appear in Powered By
    expect(screen.getAllByText("SparrowX Sec").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SparrowX NetSec").length).toBeGreaterThan(0);

    // Price lists are hidden by default until a workload is chosen
    expect(screen.queryByRole("heading", { name: /Ryzen 9 9950X Cloud VPS Plans/i })).toBeNull();

    // Select Bare Metal Servers from the isolation workload selector
    fireEvent.click(screen.getByRole("heading", { name: "Bare Metal Servers" }));
    expect(screen.getByRole("tab", { name: "Bare metal" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dedicated servers" })).toBeTruthy();
  });

  it("verifies Ryzen 9 9950X VPS & VDS plans with +₹200 added to all base reference prices and Intel Free Backup difference", () => {
    // Cloud VPS plans: 4GB(799+200), 8GB(1299+200), 12GB(1799+200), 16GB(2399+200), 24GB(2999+200)
    const vps4 = INFRA_PLANS.find((p) => p.id === "vps-ryzen-9950x-4gb")!;
    const vps8 = INFRA_PLANS.find((p) => p.id === "vps-ryzen-9950x-8gb")!;
    const vps12 = INFRA_PLANS.find((p) => p.id === "vps-ryzen-9950x-12gb")!;
    const vps16 = INFRA_PLANS.find((p) => p.id === "vps-ryzen-9950x-16gb")!;
    const vps24 = INFRA_PLANS.find((p) => p.id === "vps-ryzen-9950x-24gb")!;

    expect(vps4.priceMonthlyInr).toBe(999);
    expect(vps8.priceMonthlyInr).toBe(1499);
    expect(vps12.priceMonthlyInr).toBe(1999);
    expect(vps16.priceMonthlyInr).toBe(2599);
    expect(vps24.priceMonthlyInr).toBe(3199);

    // Dedicated VDS plans: 4GB(2500+200), 8GB(3799+200), 12GB(4299+200), 16GB(4899+200), 24GB(5499+200)
    const vds4 = INFRA_PLANS.find((p) => p.id === "vds-ryzen-9950x-4gb")!;
    const vds8 = INFRA_PLANS.find((p) => p.id === "vds-ryzen-9950x-8gb")!;
    const vds12 = INFRA_PLANS.find((p) => p.id === "vds-ryzen-9950x-12gb")!;
    const vds16 = INFRA_PLANS.find((p) => p.id === "vds-ryzen-9950x-16gb")!;
    const vds24 = INFRA_PLANS.find((p) => p.id === "vds-ryzen-9950x-24gb")!;

    expect(vds4.priceMonthlyInr).toBe(2700);
    expect(vds8.priceMonthlyInr).toBe(3999);
    expect(vds12.priceMonthlyInr).toBe(4499);
    expect(vds16.priceMonthlyInr).toBe(5099);
    expect(vds24.priceMonthlyInr).toBe(5699);

    // Render engine, select Cloud KVM VPS, and verify Ryzen 9 badge, pinned In Stock stickers, & Intel 1 Free Backup
    render(<SparrowxInfraEngine />);
    fireEvent.click(screen.getByRole("heading", { name: "Cloud KVM VPS" }));
    expect(screen.getByRole("heading", { name: /Ryzen 9 9950X Cloud VPS Plans/i })).toBeTruthy();
    expect(screen.getAllByText("Ryzen 9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 Free Backup").length).toBeGreaterThan(0);
  });

  it("starts with an empty server list (zero mock data), then provisions on UPI webhook auto-confirmation", async () => {
    clearInfraServerStoreForTests();
    const initialFleet = await listManagedInfraServers();
    expect(initialFleet.servers).toHaveLength(0);

    const order = createUpiOrder({
      service: "infra",
      planId: "vps-starter",
      planName: "VPS-Builder NVMe",
      amountInr: 849,
      customerEmail: "ops@sparrowx.net",
      metadata: {
        category: "vps",
        hostname: "auto-vps-01.sparrowx.net",
        region: "Mumbai IN-1",
        os: "Ubuntu 24.04 LTS (Hardened)",
      },
    });
    expect(order.status).toBe("PENDING");
    expect(order.upiUri).toContain("upi://pay?");

    const prevSecret = process.env.SPARROWX_UPI_BRIDGE_SECRET;
    process.env.SPARROWX_UPI_BRIDGE_SECRET = "test_upi_bridge_secret_2026";
    const rawBody = JSON.stringify({
      orderId: order.orderId,
      amountInr: 849,
      utr: "432199887766",
    });
    const hookRes = processUpiAutoWebhook({
      rawBody,
      headers: { "x-sparrowx-upi-secret": "test_upi_bridge_secret_2026" },
      payload: JSON.parse(rawBody),
    });
    if (prevSecret === undefined) delete process.env.SPARROWX_UPI_BRIDGE_SECRET;
    else process.env.SPARROWX_UPI_BRIDGE_SECRET = prevSecret;
    expect(hookRes.ok).toBe(true);
    expect(hookRes.order?.status).toBe("PAID");
    expect(hookRes.order?.provisionedServer?.hostname).toBe("auto-vps-01.sparrowx.net");

    const verifiedOrder = getUpiOrder(order.orderId);
    expect(verifiedOrder?.status).toBe("PAID");

    const fleet = await listManagedInfraServers();
    const created = fleet.servers.find((s) => s.hostname === "auto-vps-01.sparrowx.net");
    expect(created).toBeTruthy();

    const snapRes = await executeServerAction({
      serverId: created!.id,
      action: "snapshot",
      snapshotName: "post-deploy",
    });
    expect(snapRes.ok).toBe(true);
    expect(snapRes.server?.snapshots[0]?.name).toBe("post-deploy");
  });
});
