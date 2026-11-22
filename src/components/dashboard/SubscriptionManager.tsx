import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Coins, CreditCard, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { renewSubscription } from "@/lib/portal.functions";
import { SERVICES } from "@/lib/services";
import { errorText, useRefreshAll, useSubscriptions } from "./hooks";

const COIN_PACKS = [
  { coins: 100, price: "₹100", label: "Starter Pack", tag: "Instant" },
  { coins: 250, price: "₹250", label: "Builder Pack", tag: "Popular" },
  { coins: 500, price: "₹500", label: "Pro Pack", tag: "Best Value" },
  { coins: 1000, price: "₹1,000", label: "Studio Pack", tag: "Multi-Node" },
] as const;

function formatDueDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysRemaining(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function SubscriptionManager({
  coins,
  onOpenCoinStore,
}: {
  coins: number;
  onOpenCoinStore: () => void;
}) {
  const { data: subs, isLoading, error } = useSubscriptions();
  const refresh = useRefreshAll();

  const renew = useMutation({
    mutationFn: (subscriptionId: string) => renewSubscription({ data: { subscriptionId, days: 30 } }),
    onSuccess: async (res) => {
      await refresh();
      toast.success("Subscription renewed +30 days", {
        description: `Remaining balance: ${res.coins.toLocaleString("en-IN")} SparrowCoins`,
      });
    },
    onError: (e) => {
      const msg = errorText(e);
      toast.error(msg);
      if (msg.toLowerCase().includes("sparrowcoins")) {
        onOpenCoinStore();
      }
    },
  });

  return (
    <section id="subscriptions" className="grid gap-6 lg:grid-cols-[1.35fr_1fr] scroll-mt-24">
      {/* Active Subscriptions & Renewal Management */}
      <div className="surface-3d rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/20 text-sheen">
              <CreditCard className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">Subscriptions &amp; Renewals</h2>
              <p className="text-xs text-muted-foreground">
                Renew game servers anytime using your SparrowCoins balance (1 Coin = ₹1)
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border bg-background/50 px-3 py-1 font-mono text-xs text-muted-foreground">
            {subs ? `${subs.length} active` : "…"}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-2xl bg-background/40" />)}
          {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
          {!isLoading && subs?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No active server subscriptions yet. Deploy a game server below to start a 30-day SparrowCoins subscription.
            </div>
          )}
          {subs?.map((sub) => {
            const svc = SERVICES[sub.serviceType];
            const days = daysRemaining(sub.expiresAt);
            const canAfford = coins >= sub.priceCoins;
            return (
              <div
                key={sub.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-sm">
                      {svc?.name ?? sub.serviceType} · {sub.planName}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        sub.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-3.5" /> Due {formatDueDate(sub.expiresAt)} (
                      {days > 0 ? `${days}d left` : "Overdue"})
                    </span>
                    <span className="font-mono text-sheen">
                      {sub.priceCoins.toLocaleString("en-IN")} Coins / 30d
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canAfford ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="discord"
                      className="rounded-xl"
                      disabled={renew.isPending}
                      onClick={() => renew.mutate(sub.id)}
                    >
                      {renew.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Renew +30d
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={onOpenCoinStore}
                    >
                      <Coins className="size-3.5 text-sheen" /> Add Coins
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SparrowCoins User Store */}
      <div id="coin-store" className="surface-3d rim-sheen flex flex-col justify-between rounded-3xl p-6">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
                <Coins className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">SparrowCoins Store</h2>
                <p className="text-xs text-muted-foreground">1 SparrowCoin = ₹1 · Instant UPI / Card credit</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {COIN_PACKS.map((pack) => (
              <button
                key={pack.coins}
                type="button"
                onClick={onOpenCoinStore}
                className="group rounded-2xl border border-border bg-background/45 p-3.5 text-left transition-all hover:border-sheen/60 hover:bg-background/70"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-bold text-foreground">
                    {pack.coins.toLocaleString("en-IN")}
                  </span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sheen">
                    {pack.tag}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{pack.label}</p>
                <p className="mt-2 font-mono text-xs font-semibold text-emerald-300">{pack.price} →</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="ivory"
          className="mt-4 w-full rounded-xl"
          onClick={onOpenCoinStore}
        >
          <Sparkles className="size-4" /> Open SparrowCoins Top-Up Store
        </Button>
      </div>
    </section>
  );
}
