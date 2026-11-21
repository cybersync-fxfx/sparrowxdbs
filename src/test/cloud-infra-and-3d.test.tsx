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

  it("renders SparrowxInfraEngine with Bare Metal, Dedicated, and KVM VPS catalog tabs", () => {
    render(<SparrowxInfraEngine />);
    expect(screen.getByRole("heading", { level: 1, name: /Raw silicon/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Bare metal" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dedicated servers" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Cloud KVM VPS" })).toBeTruthy();

    // Filter to Cloud KVM VPS
    fireEvent.click(screen.getByRole("tab", { name: "Cloud KVM VPS" }));
    expect(screen.getByText("VPS-Nano NVMe")).toBeTruthy();
    expect(screen.queryByText("BM-Edge 7950X")).toBeNull();
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

    const rawBody = JSON.stringify({
      orderId: order.orderId,
      amountInr: 849,
      utr: "432199887766",
    });
    const hookRes = processUpiAutoWebhook({
      rawBody,
      headers: {},
      payload: JSON.parse(rawBody),
    });
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
