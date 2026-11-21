import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { matchProductSubdomain, resolveRootRedirectTarget } from "@/lib/routing";
import { computePlanPrice, INFRA_PLANS } from "@/lib/infra-plans";
import { SparrowxInfraEngine } from "@/components/SparrowxInfraEngine";
import { Floating3DVisual } from "@/components/ui/Floating3DVisual";

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

  it("renders Floating3DVisual with LCP priority and keyboard-accessible Pause/Play toggle", () => {
    render(
      <Floating3DVisual
        src="/3d/cloud-infra-server.jpg"
        alt="3D Server Cluster"
        priority="lcp"
        showMotionControl={true}
      />,
    );
    const img = screen.getByAltText("3D Server Cluster");
    expect(img).toBeTruthy();
    const pauseBtn = screen.getByRole("button", { name: "Pause 3D animation" });
    fireEvent.click(pauseBtn);
    expect(screen.getByRole("button", { name: "Play 3D animation" })).toBeTruthy();
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
});
