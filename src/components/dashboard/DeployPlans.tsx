import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ServiceSwitcher } from "@/components/site/ServiceSwitcher";
import { deployPlan } from "@/lib/portal.functions";
import { findPlan, formatRam, planCostCoins, SERVICES, type Plan, type ServiceId } from "@/lib/services";
import { cn } from "@/lib/utils";
import { errorText, useRefreshAll } from "./hooks";

export function DeployPlans({ coins, initialPlanId, onNeedCoins }: { coins: number; initialPlanId?: string; onNeedCoins: () => void }) {
  const initial = initialPlanId ? findPlan(initialPlanId) : null;
  const [service, setService] = useState<ServiceId>(initial?.service.id ?? "fivem");
  const [selected, setSelected] = useState<Plan | null>(initial?.plan ?? null);
  const [name, setName] = useState("");
  const refresh = useRefreshAll();

  useEffect(() => {
    if (initial) setName(`${initial.plan.name} Server`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deploy = useMutation({
    mutationFn: (p: Plan) => deployPlan({ data: { planId: p.id, serverName: name } }),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.serverName} is deploying`, { description: `Remaining balance: ${r.coins} SparrowCoins` });
      setSelected(null);
      document.getElementById("servers")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const open = (p: Plan) => {
    setSelected(p);
    setName(`${p.name} Server`);
  };
  const short = selected ? Math.max(0, planCostCoins(selected) - coins) : 0;

  return (
    <section data-service={service} className="surface-3d rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Deploy a new server</h2>
          <p className="text-sm text-muted-foreground">Coins are deducted now; renews every 30 days.</p>
        </div>
        <ServiceSwitcher value={service} onChange={setService} layoutId="dash-pill" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {SERVICES[service].plans.map((p) => {
          const cost = planCostCoins(p);
          return (
            <div key={p.id} className={cn("relative rounded-2xl border border-border bg-background/40 p-5", p.popular && "border-svc/60")}>
              {p.popular && <span className="absolute right-4 top-4 rounded-full bg-svc/15 px-2 py-0.5 text-[10px] font-semibold text-svc">Most Popular</span>}
              <h3 className="font-display text-sm font-semibold">{p.name}</h3>
              <p className="mt-2 flex items-center gap-1.5 font-display text-2xl font-bold">
                <Coins className="size-5 text-sheen" /> {cost}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {formatRam(p.ramMb)} · {p.vcpu} vCPU · {p.diskGb}GB NVMe{p.slots ? ` · ${p.slots} slots` : ""}
              </p>
              <Button variant="discord" className="mt-4 w-full rounded-xl" onClick={() => open(p)}>
                <Rocket /> Deploy Plan
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="theme-dashboard surface-3d max-w-md rounded-3xl border-border text-foreground">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Deploy {selected.name}</DialogTitle>
                <DialogDescription>
                  {formatRam(selected.ramMb)} RAM · {selected.vcpu} vCPU · {selected.diskGb}GB NVMe Gen4
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor="srvname" className="text-xs text-muted-foreground">Server name</label>
                <Input id="srvname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="bg-background/50" />
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Cost (30 days)</span><span className="font-mono">{planCostCoins(selected)} coins</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Your balance</span><span className="font-mono">{coins} coins</span></div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>After deploy</span>
                  <span className={cn("font-mono", short > 0 ? "text-destructive" : "text-success")}>{coins - planCostCoins(selected)} coins</span>
                </div>
              </div>
              <DialogFooter>
                {short > 0 ? (
                  <Button variant="discord" className="w-full rounded-xl" onClick={() => { setSelected(null); onNeedCoins(); }}>
                    Top up {short} coins to continue
                  </Button>
                ) : (
                  <Button variant="discord" className="w-full rounded-xl" disabled={deploy.isPending || !name.trim()} onClick={() => deploy.mutate(selected)}>
                    {deploy.isPending ? <Loader2 className="animate-spin" /> : <Rocket />} Confirm & deploy
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
