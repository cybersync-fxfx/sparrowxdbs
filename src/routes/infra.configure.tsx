import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxInfraConfigurator } from "@/components/SparrowxInfraConfigurator";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import type { BillingCycle, InfraRegionId } from "@/lib/infra-plans";

type ConfigureSearch = {
  plan?: string | undefined;
  region?: InfraRegionId | undefined;
  cycle?: BillingCycle | undefined;
  currency?: "INR" | "USD" | undefined;
};

const VALID_REGIONS = new Set<InfraRegionId>(["in-mum", "in-maa", "sg-sin", "uk-lon", "de-fra", "fr-gra"]);
const VALID_CYCLES = new Set<BillingCycle>(["monthly", "quarterly", "annual"]);

export const Route = createFileRoute("/infra/configure")({
  validateSearch: (s: Record<string, unknown>): ConfigureSearch => ({
    plan: typeof s.plan === "string" && /^[a-z0-9-]{1,60}$/i.test(s.plan) ? s.plan : undefined,
    region: typeof s.region === "string" && VALID_REGIONS.has(s.region as InfraRegionId)
      ? (s.region as InfraRegionId)
      : undefined,
    cycle: typeof s.cycle === "string" && VALID_CYCLES.has(s.cycle as BillingCycle)
      ? (s.cycle as BillingCycle)
      : undefined,
    currency: s.currency === "USD" || s.currency === "INR" ? s.currency : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Configure Server — SparrowX Cloud Infra (OS, Region & Custom Plans)" },
      {
        name: "description",
        content:
          "Configure your SparrowX KVM VPS, Dedicated VDS, or Bare Metal server. Choose from 15 Linux, Windows Server, Proxmox VE, and Docker OS images or request a custom plan on WhatsApp.",
      },
    ],
    links: [{ rel: "icon", href: "/sparrowx-logo.png", type: "image/png" }],
  }),
  component: SparrowxInfraConfigureRoute,
});

function SparrowxInfraConfigureRoute() {
  const { plan, region, cycle, currency } = Route.useSearch();
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(
        `https://infra.sparrowx.net/infra/configure${window.location.search}${window.location.hash}`,
      );
    }
  }, []);
  return (
    <>
      <SparrowxInfraConfigurator
        initialPlanId={plan}
        initialRegion={region}
        initialCycle={cycle}
        initialCurrency={currency}
      />
      <BackgroundEngineToaster />
    </>
  );
}
