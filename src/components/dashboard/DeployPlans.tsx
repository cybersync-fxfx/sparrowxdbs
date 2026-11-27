import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Coins,
  Layers,
  Loader2,
  MessageCircle,
  Rocket,
  Sliders,
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
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";
import { cn } from "@/lib/utils";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { errorText, useRefreshAll } from "./hooks";

function inferServiceForEgg(egg: EggCatalogItem): ServiceId {
  const haystack = `${egg.name} ${egg.category} ${egg.repoPath}`.toLowerCase();
  if (egg.section === "applications" || egg.section === "generic") return "discord";
  if (haystack.includes("fivem") || haystack.includes("redm") || haystack.includes("altv") || haystack.includes("gta")) {
    return "fivem";
  }
  if (haystack.includes("samp") || haystack.includes("open.mp") || haystack.includes("san andreas")) {
    return "samp";
  }
  return "minecraft";
}

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

  // Automatically focus the matching hardware tier whenever the user picks an egg from the 3-repo catalog
  useEffect(() => {
    if (!selectedEgg) return;
    setService(inferServiceForEgg(selectedEgg));
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

  const open = (p: Plan) => {
    setSelected(p);
    setName(selectedEgg ? `${selectedEgg.name} (${p.name})` : `${p.name} Server`);
  };
  const short = selected ? Math.max(0, planCostCoins(selected) - coins) : 0;

  return (
    <section data-service={service} className="surface-3d rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Deploy &amp; Pre-Configure a New Server</h2>
          <p className="text-sm text-muted-foreground">
            Pick your hardware tier — customize Docker image &amp; Panel startup variables before first boot.
          </p>
        </div>
        <ServiceSwitcher value={service} onChange={setService} layoutId="dash-pill" />
      </div>

      {/* Active Egg Selected from the 3-Repo Egg Library */}
      {selectedEgg && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-sky-400/40 bg-[#05060a] text-sky-300">
              <Layers className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">Pre-Selected Egg: {selectedEgg.name}</span>
                <span className="rounded-full border border-border bg-[#05060a] px-2 py-0.5 font-mono text-[10px] text-sky-300">
                  {selectedEgg.nestName}
                </span>
                {selectedEgg.installed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" /> Panel Live
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                    Sync on VPS via sudo sparrowx-eggs sync
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Choose any RAM / vCPU plan below to configure startup variables and provision directly into Pterodactyl.
              </p>
            </div>
          </div>
          {onClearEgg && (
            <button
              type="button"
              onClick={onClearEgg}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-[#05060a] px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-white shrink-0"
            >
              <X className="size-3.5" aria-hidden="true" /> Reset Egg
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {SERVICES[service].plans.map((p) => {
          const cost = planCostCoins(p);
          return (
            <div
              key={p.id}
              className={cn(
                "relative rounded-2xl border border-border bg-[#05060a]/80 p-5 transition-colors hover:border-sky-400/50",
                p.popular && "border-sky-500/50",
              )}
            >
              {p.popular && (
                <span className="absolute right-4 top-4 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-sm font-semibold">{p.name}</h3>
              <p className="mt-2 flex items-center gap-1.5 font-display text-2xl font-bold">
                <Coins className="size-5 text-sheen" /> {cost}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {formatRam(p.ramMb)} · {p.vcpu} vCPU · {p.diskGb}GB NVMe{p.slots ? ` · ${p.slots} slots` : ""}
              </p>
              <Button variant="discord" className="mt-4 w-full rounded-xl" onClick={() => open(p)}>
                <Rocket /> {selectedEgg ? `Deploy ${selectedEgg.name}` : "Configure & Deploy"}
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
                  <div className="rounded-2xl border border-border bg-[#05060a] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
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
