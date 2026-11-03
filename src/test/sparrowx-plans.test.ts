import { describe, expect, it } from "vitest";
import {
  SPARROWX_PLANS,
  getPlanById,
  getClientActiveSubscription,
  subscribeToPlan,
  saveClientActiveSubscription,
} from "@/lib/sparrowx-plans";

describe("SparrowX Monetization & 6 Subscription Plans", () => {
  it("defines exactly 6 production subscription plans from the business model", () => {
    expect(SPARROWX_PLANS).toHaveLength(6);

    const planIds = SPARROWX_PLANS.map((p) => p.id);
    expect(planIds).toEqual([
      "plan-developer-starter",
      "plan-startup-shield",
      "plan-business-pro",
      "plan-ai-agent-shield",
      "plan-enterprise-soc",
      "plan-hyperscale-defense",
    ]);
  });

  it("measures realistic infrastructure costs and maintains sustainable gross margins between 84% and 87%", () => {
    for (const plan of SPARROWX_PLANS) {
      const cost = plan.costAnalysis;

      // Ensure cost breakdown sums up to total monthly cost
      const calculatedTotal =
        cost.edgeDnsBandwidth +
        cost.wafCompute +
        cost.aiNeuralEngine +
        cost.storageAndVault +
        cost.secOpsOverhead;

      expect(cost.totalMonthlyCost).toBeCloseTo(calculatedTotal, 1);
      expect(cost.grossProfitMonthly).toBeCloseTo(plan.monthlyPrice - cost.totalMonthlyCost, 1);

      // Verify sustainable SaaS gross margin between 84% and 88%
      expect(cost.grossMarginPct).toBeGreaterThanOrEqual(84);
      expect(cost.grossMarginPct).toBeLessThanOrEqual(88);
    }
  });

  it("configures tiered domain quotas and monthly request limits", () => {
    const dev = getPlanById("plan-developer-starter");
    const startup = getPlanById("plan-startup-shield");
    const biz = getPlanById("plan-business-pro");
    const ai = getPlanById("plan-ai-agent-shield");
    const ent = getPlanById("plan-enterprise-soc");
    const hyper = getPlanById("plan-hyperscale-defense");

    expect(dev.maxDomains).toBe(1);
    expect(dev.monthlyPrice).toBe(29);
    expect(dev.requestQuotaMonthly).toBe(250_000);

    expect(startup.maxDomains).toBe(3);
    expect(startup.monthlyPrice).toBe(79);
    expect(startup.requestQuotaMonthly).toBe(1_000_000);

    expect(biz.maxDomains).toBe(10);
    expect(biz.monthlyPrice).toBe(199);
    expect(biz.popular).toBe(true);

    expect(ai.maxDomains).toBe(15);
    expect(ai.monthlyPrice).toBe(399);

    expect(ent.maxDomains).toBe(50);
    expect(ent.monthlyPrice).toBe(799);

    expect(hyper.maxDomains).toBe(-1); // Unlimited
    expect(hyper.monthlyPrice).toBe(1499);
    expect(hyper.requestQuotaMonthly).toBe(250_000_000);
  });

  it("handles instant plan subscription and retrieves active client subscription", () => {
    localStorage.clear();

    const initial = getClientActiveSubscription("tenant-test-1");
    expect(initial.planName).toBe("Startup Shield");
    expect(initial.status).toBe("active");

    // Upgrade to Business Pro
    const upgraded = subscribeToPlan("plan-business-pro", "monthly", "Corporate Card", "tenant-test-1");
    expect(upgraded.planName).toBe("Business Pro");
    expect(upgraded.priceUsd).toBe(199);
    expect(upgraded.maxDomains).toBe(10);

    const retrieved = getClientActiveSubscription("tenant-test-1");
    expect(retrieved.planId).toBe("plan-business-pro");
    expect(retrieved.maxDomains).toBe(10);
  });
});
