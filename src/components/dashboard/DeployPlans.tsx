import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  HardDrive,
  Layers,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import { SparrowxCoinIcon } from "@/components/SparrowxCoinVisuals";
import { Button } from "@/components/ui/button";
import { ServiceSwitcher } from "@/components/site/ServiceSwitcher";
import { findPlan, formatRam, planCostCoins, type ServiceId } from "@/lib/services";
import {
  getDefaultProfileForService,
  resolveEggResourceProfile,
  type SmartPlanTier,
} from "@/lib/egg-smart-plans";
import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";
import { cn } from "@/lib/utils";
import { ServerDeployWizard } from "./ServerDeployWizard";

export function DeployPlans({
  coins,
  initialPlanId,
  selectedEgg,
  onClearEgg,
  onNeedCoins,
}: {
  coins: number;
  initialPlanId?: string;
  selectedEgg?: EggCatalogItem | null;
  onClearEgg?: () => void;
  onNeedCoins: () => void;
}) {
  const initial = initialPlanId ? findPlan(initialPlanId) : null;
  const [service, setService] = useState<ServiceId>(initial?.service.id ?? "fivem");
  const [wizardPlan, setWizardPlan] = useState<SmartPlanTier | null>(null);

  // Resolve the intelligent 5-plan themed profile from the selected egg (or active service tab)
  const activeProfile = useMemo(
    () => (selectedEgg ? resolveEggResourceProfile(selectedEgg) : getDefaultProfileForService(service)),
    [selectedEgg, service],
  );

  // If URL arrived with ?deploy=<planId>, open the wizard on the closest matching smart tier
  useEffect(() => {
    if (!initial) return;
    const match =
      activeProfile.plans.find((p) => p.id === initial.plan.id) ??
      activeProfile.plans.find((p) => p.ramMb >= initial.plan.ramMb) ??
      activeProfile.plans[2]!;
    setWizardPlan(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEgg) return;
    setService(resolveEggResourceProfile(selectedEgg).serviceId);
  }, [selectedEgg]);

  return (
    <section data-service={service} className="surface-3d rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles className="size-3" aria-hidden="true" />
              {activeProfile.themeLabel ?? activeProfile.label} · {activeProfile.ramRangeLabel}
            </span>
          </div>
          <h2 className="font-display text-lg font-semibold">
            {selectedEgg ? `Smart Plans for ${selectedEgg.name}` : "Deploy & Configure a New Server"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">
            {activeProfile.reasoning}
          </p>
        </div>
        <ServiceSwitcher
          value={service}
          onChange={(nextSvc) => {
            onClearEgg?.();
            setService(nextSvc);
          }}
          layoutId="dash-pill"
        />
      </div>

      {/* Active Egg Selected Banner (Green Highlighted State) */}
      {selectedEgg && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-xs shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-400/50 bg-[#05060a] text-emerald-300">
              <Layers className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">Selected Egg: {selectedEgg.name}</span>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                  {activeProfile.themeLabel ?? activeProfile.label} ({activeProfile.ramRangeLabel})
                </span>
                {selectedEgg.installed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" /> Panel Live
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                    Run sudo sparrowx-eggs sync on VPS
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Nest: {selectedEgg.nestName} · Pick any plan below to open the guided setup wizard (required RCON/tokens/settings asked before launch).
              </p>
            </div>
          </div>
          {onClearEgg && (
            <button
              type="button"
              onClick={onClearEgg}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-[#05060a] px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-white shrink-0"
            >
              <X className="size-3.5" aria-hidden="true" /> Clear Egg
            </button>
          )}
        </div>
      )}

      {/* Smart 5-Plan Grid tailored specifically to the active egg's logical RAM/CPU range */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {activeProfile.plans.map((p) => {
          const cost = planCostCoins(p);
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border bg-[#05060a]/85 p-4 transition-all hover:border-emerald-400/60",
                p.popular
                  ? "border-emerald-400/70 bg-emerald-500/[0.06] ring-1 ring-emerald-400/35"
                  : "border-border",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.tierLabel}
                  </span>
                  {p.popular && (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-200">
                      Recommended
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 font-display text-sm font-bold text-foreground">{p.name}</h3>
                <p className="text-[11px] text-muted-foreground">{p.capacityHint}</p>

                <p className="mt-3 flex items-baseline gap-1.5 font-display text-2xl font-bold text-foreground">
                  <SparrowxCoinIcon className="size-5 self-center shrink-0" />
                  <span>{cost}</span>
                  <span className="font-mono text-[10px] font-normal text-muted-foreground">/30d</span>
                </p>

                <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3 font-mono text-[11px] text-secondary-foreground">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">RAM</span>
                    <span className="font-semibold text-white">{formatRam(p.ramMb)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Cpu className="size-3" aria-hidden="true" /> vCPU
                    </span>
                    <span>{p.vcpu} Cores</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <HardDrive className="size-3" aria-hidden="true" /> NVMe
                    </span>
                    <span>{p.diskGb} GB</span>
                  </li>
                </ul>
              </div>

              <Button
                variant={p.popular ? "ivory" : "discord"}
                size="sm"
                className="mt-4 w-full rounded-xl text-xs"
                onClick={() => setWizardPlan(p)}
              >
                <Rocket className="size-3.5" />
                <span>Configure &amp; Deploy</span>
              </Button>
            </div>
          );
        })}
      </div>

      {wizardPlan && (
        <ServerDeployWizard
          open={true}
          onClose={() => setWizardPlan(null)}
          coins={coins}
          service={service}
          profile={activeProfile}
          initialPlan={wizardPlan}
          selectedEgg={selectedEgg}
          onNeedCoins={onNeedCoins}
          onDeployed={() => onClearEgg?.()}
        />
      )}
    </section>
  );
}
