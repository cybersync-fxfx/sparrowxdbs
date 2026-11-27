import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Coins,
  Cpu,
  HardDrive,
  Layers,
  Loader2,
  MessageCircle,
  Rocket,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ServiceSwitcher } from "@/components/site/ServiceSwitcher";
import { deployPlan, getEggConfigDetails } from "@/lib/portal.functions";
import { findPlan, formatRam, planCostCoins, SERVICES, type Plan, type ServiceId } from "@/lib/services";
import {
  getDefaultProfileForService,
  resolveEggResourceProfile,
  type SmartPlanTier,
} from "@/lib/egg-smart-plans";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";
import { cn } from "@/lib/utils";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { errorText, useRefreshAll } from "./hooks";

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
  const [selected, setSelected] = useState<Plan | null>(initial?.plan ?? null);
  const [name, setName] = useState("");
  const [dockerImageDraft, setDockerImageDraft] = useState("");
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [showPreConfig, setShowPreConfig] = useState(true);
  const refresh = useRefreshAll();

  useEffect(() => {
    if (initial) setName(`${initial.plan.name} Server`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the intelligent 5-plan hardware profile from the selected egg (or active service tab)
  const activeProfile = useMemo(
    () => (selectedEgg ? resolveEggResourceProfile(selectedEgg) : getDefaultProfileForService(service)),
    [selectedEgg, service],
  );

  useEffect(() => {
    if (!selectedEgg) return;
    setService(resolveEggResourceProfile(selectedEgg).serviceId);
  }, [selectedEgg]);

  const canLoadEggVars = Boolean(
    selected && selectedEgg?.installed && selectedEgg.nestId && selectedEgg.eggId,
  );

  const { data: eggDetails, isLoading: eggDetailsLoading } = useQuery({
    queryKey: ["deploy-egg-details", selectedEgg?.nestId, selectedEgg?.eggId],
    queryFn: () =>
      getEggConfigDetails({
        data: { nestId: selectedEgg!.nestId!, eggId: selectedEgg!.eggId! },
      }),
    enabled: canLoadEggVars,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!eggDetails) {
      setDockerImageDraft("");
      setEnvDraft({});
      return;
    }
    setDockerImageDraft(eggDetails.dockerImage);
    const defaults: Record<string, string> = {};
    for (const v of eggDetails.variables) {
      defaults[v.envVariable] = v.defaultValue;
    }
    setEnvDraft(defaults);
  }, [eggDetails]);

  const editableEggVars = useMemo(
    () => (eggDetails?.variables ?? []).filter((v) => v.userEditable).slice(0, 8),
    [eggDetails],
  );

  const deploy = useMutation({
    mutationFn: (p: Plan) =>
      deployPlan({
        data: {
          planId: p.id,
          serverName: name,
          ...(selectedEgg?.installed && selectedEgg.nestId && selectedEgg.eggId
            ? {
                eggOverride: {
                  nestId: selectedEgg.nestId,
                  eggId: selectedEgg.eggId,
                  ...(dockerImageDraft ? { dockerImage: dockerImageDraft } : {}),
                  ...(Object.keys(envDraft).length > 0 ? { environment: envDraft } : {}),
                },
              }
            : {}),
        },
      }),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.serverName} is deploying`, {
        description: `Remaining balance: ${r.coins} SparrowCoins · Pre-configured in Pterodactyl Panel.`,
      });
      setSelected(null);
      onClearEgg?.();
      document.getElementById("servers")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const open = (p: SmartPlanTier) => {
    setSelected(p);
    setName(selectedEgg ? `${selectedEgg.name} — ${p.name}` : `${SERVICES[service].name} ${p.name}`);
  };
  const short = selected ? Math.max(0, planCostCoins(selected) - coins) : 0;

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
            {selectedEgg ? `Smart Plans for ${selectedEgg.name}` : "Deploy & Pre-Configure a New Server"}
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
                  {activeProfile.label} ({activeProfile.ramRangeLabel})
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
                Nest: {selectedEgg.nestName} · Pick any of the 5 tailored plans below to pre-configure startup variables &amp; deploy.
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

                <p className="mt-3 flex items-baseline gap-1 font-display text-2xl font-bold text-foreground">
                  <Coins className="size-4 text-emerald-400 self-center shrink-0" aria-hidden="true" />
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
                onClick={() => open(p)}
              >
                <Rocket className="size-3.5" />
                <span>{selectedEgg ? "Deploy Egg" : "Deploy Plan"}</span>
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="theme-dashboard surface-3d max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl border-border text-foreground">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Deploy {selectedEgg ? `${selectedEgg.name} — ` : ""}
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {formatRam(selected.ramMb)} RAM · {selected.vcpu} vCPU · {selected.diskGb}GB NVMe Gen4 · Instant Pterodactyl Provisioning
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="srvname" className="text-xs font-semibold text-foreground">
                    Server Name
                  </label>
                  <Input
                    id="srvname"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#05060a]"
                  />
                </div>

                {/* Live Pre-Deploy Egg Startup Configuration (Synced directly from Pterodactyl Panel!) */}
                {selectedEgg && (
                  <div className="rounded-2xl border border-emerald-500/35 bg-[#05060a] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                        <Sliders className="size-3.5" aria-hidden="true" />
                        Panel Pre-Configuration ({selectedEgg.name})
                      </span>
                      {editableEggVars.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowPreConfig((v) => !v)}
                          className="text-[11px] text-muted-foreground hover:text-white"
                        >
                          {showPreConfig ? "Collapse" : "Customize Vars"}
                        </button>
                      )}
                    </div>

                    {!selectedEgg.installed ? (
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Run <code className="rounded bg-[#0b0e17] px-1.5 py-0.5 font-mono">sudo sparrowx-eggs sync</code> on your VPS to unlock live pre-configuration for this egg. Proceeding now uses your default {SERVICES[service].name} egg.
                      </p>
                    ) : eggDetailsLoading ? (
                      <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Loading runtime &amp; startup variables from Panel…
                      </p>
                    ) : eggDetails ? (
                      showPreConfig && (
                        <div className="space-y-3">
                          {Object.keys(eggDetails.dockerImages).length > 0 && (
                            <div className="space-y-1">
                              <label htmlFor="deploy-docker-img" className="text-[11px] font-medium text-muted-foreground">
                                Docker Runtime Image
                              </label>
                              <select
                                id="deploy-docker-img"
                                value={dockerImageDraft}
                                onChange={(e) => setDockerImageDraft(e.target.value)}
                                className="h-9 w-full rounded-xl border border-border bg-[#0b0e17] px-2.5 font-mono text-[11px] text-foreground"
                              >
                                {Object.entries(eggDetails.dockerImages).map(([label, img]) => (
                                  <option key={img} value={img}>
                                    {label} — {img}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {editableEggVars.length > 0 && (
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {editableEggVars.map((v) => (
                                <div key={v.envVariable} className="space-y-1">
                                  <label
                                    htmlFor={`precfg-${v.envVariable}`}
                                    className="block truncate text-[11px] font-medium text-foreground"
                                    title={v.description || v.name}
                                  >
                                    {v.name}
                                  </label>
                                  <input
                                    id={`precfg-${v.envVariable}`}
                                    type="text"
                                    value={envDraft[v.envVariable] ?? ""}
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    onChange={(e) =>
                                      setEnvDraft((prev) => ({
                                        ...prev,
                                        [v.envVariable]: e.target.value,
                                      }))
                                    }
                                    placeholder={v.defaultValue || v.envVariable}
                                    className="h-9 w-full rounded-xl border border-border bg-[#0b0e17] px-2.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    ) : null}
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-[#05060a] p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost (30 days)</span>
                    <span className="font-mono">{planCostCoins(selected)} coins</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="font-mono">{coins} coins</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                    <span>After deploy</span>
                    <span className={cn("font-mono", short > 0 ? "text-destructive" : "text-success")}>
                      {coins - planCostCoins(selected)} coins
                    </span>
                  </div>
                </div>
                <PurchasePolicyNotice compact />
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {short > 0 ? (
                  <Button
                    variant="discord"
                    className="w-full rounded-xl"
                    onClick={() => {
                      setSelected(null);
                      onNeedCoins();
                    }}
                  >
                    Top up {short} coins to continue
                  </Button>
                ) : (
                  <Button
                    variant="discord"
                    className="w-full rounded-xl"
                    disabled={deploy.isPending || !name.trim()}
                    onClick={() => deploy.mutate(selected)}
                  >
                    {deploy.isPending ? <Loader2 className="animate-spin" /> : <Rocket />} Confirm &amp; Deploy to Panel
                  </Button>
                )}
                <a
                  href={buildWhatsAppSupportUrl(
                    `Hi SparrowX, I want to start a subscription for ${selectedEgg?.name ?? SERVICES[service].name} - ${selected.name} (${planCostCoins(selected)} Coins / 30d, Server: ${name || selected.name}).`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  <span>Contact on WhatsApp ({WHATSAPP_SUPPORT_DISPLAY})</span>
                </a>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
