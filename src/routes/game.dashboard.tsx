import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, Database, ExternalLink, Gift, Loader2, LogOut, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { getSessionSummary, logout, redeemPromo } from "@/lib/portal.functions";
import { verifySessionToken } from "@/lib/advanced-features";
import { fetchMasterSsoUser } from "@/lib/developer-connection";
import { PanelCredentials } from "@/components/dashboard/PanelCredentials";
import { TopUpDialog } from "@/components/dashboard/TopUpDialog";
import { DeployPlans } from "@/components/dashboard/DeployPlans";
import { ServerList } from "@/components/dashboard/ServerList";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";
import { Transactions } from "@/components/dashboard/Transactions";
import { DashboardSubscriptionLock } from "@/components/DashboardSubscriptionLock";
import { errorText, useDashboard, useRefreshAll, useServers } from "@/components/dashboard/hooks";

export const Route = createFileRoute("/game/dashboard")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { deploy?: string | undefined; auth_error?: string | undefined } => ({
    deploy: typeof s.deploy === "string" && /^[a-z0-9-]{1,40}$/.test(s.deploy) ? s.deploy : undefined,
    auth_error: typeof s.auth_error === "string" ? s.auth_error.slice(0, 200) : undefined,
  }),
  beforeLoad: async ({ search }) => {
    let me = await getSessionSummary().catch(() => null);
    if (!me) {
      const localToken = verifySessionToken();
      if (localToken?.email) {
        me = {
          id: localToken.sub,
          email: localToken.email,
          username: localToken.fullName || localToken.email.split("@")[0] || "Player",
          avatarUrl: null,
        };
      } else {
        const sso = await fetchMasterSsoUser().catch(() => null);
        if (sso?.email) {
          me = {
            id: sso.id,
            email: sso.email,
            username: sso.fullName || sso.email.split("@")[0] || "Player",
            avatarUrl: null,
          };
        }
      }
    }
    if (!me) {
      throw redirect({
        to: "/game",
        search: { auth_error: search.auth_error || "Please sign in with Google first" },
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Client Area — SparrowX Game Hosting" },
      { name: "description", content: "Manage your SparrowX game servers, subscriptions, SparrowCoins wallet, and Pterodactyl panel credentials." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-main.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-main.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  pendingComponent: () => (
    <div className="theme-dashboard grid min-h-screen place-items-center bg-background">
      <Loader2 className="size-6 animate-spin text-sheen" />
    </div>
  ),
  component: GameDashboard,
});

function GameDashboard() {
  const { deploy } = Route.useSearch();
  const { data, isLoading, error } = useDashboard();
  const { data: servers } = useServers();
  const [topUp, setTopUp] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const navigate = useNavigate();

  const quickPromo = useMutation({
    mutationFn: () => redeemPromo({ data: { code: promoCode } }),
    onSuccess: async (res) => {
      await refresh();
      setPromoCode("");
      toast.success(`+${res.added} SparrowCoins credited`, { description: `New wallet balance: ${res.coins.toLocaleString("en-IN")} coins` });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const signOut = async () => {
    setLeaving(true);
    await qc.cancelQueries();
    await fetch("/api/auth/master-sso", { method: "DELETE", credentials: "include" }).catch(() => {});
    await logout();
    qc.clear();
    navigate({ to: "/game", search: {}, replace: true });
  };

  const onlineCount = servers?.filter((s) => s.status === "ONLINE").length ?? 0;

  return (
    <div className="theme-dashboard min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/15 to-transparent" />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/game" search={{}} className="flex items-center gap-2.5">
            <img src="/sparrowx-logo.png" alt="SparrowX logo" width={34} height={34} className="size-8.5 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]" />
            <span className="hidden font-display text-sm font-bold tracking-[0.18em] sm:block">SPARROWX</span>
            <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-sheen">CLIENT AREA</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm" className="hidden h-9 rounded-full px-3.5 sm:inline-flex">
              <a href="https://php.sparrowx.net" target="_blank" rel="noreferrer">
                <Database className="size-4 text-sky-400" /> phpMyAdmin <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm" className="hidden h-9 rounded-full px-3.5 sm:inline-flex">
              <a href="/api/game/panel-sso?next=%2F" target="_blank" rel="noreferrer">
                <ShieldCheck className="size-4 text-emerald-400" /> Panel Auto-Login <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 pl-3 glow-discord">
              <Coins className="size-4 text-sheen" />
              <span className="font-mono text-sm font-semibold">{data ? data.coins.toLocaleString("en-IN") : "—"}</span>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">· 1 Coin = ₹1</span>
              <Button size="sm" variant="discord" className="ml-1 h-7 rounded-full px-3" onClick={() => setTopUp(true)}>
                <Plus /> <span className="hidden sm:inline">Top Up</span>
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} disabled={leaving} aria-label="Log out">
              {leaving ? <Loader2 className="animate-spin" /> : <LogOut />}
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-6 px-5 py-8">
        {error && <p className="rounded-2xl border border-destructive/40 p-4 text-sm text-destructive">{errorText(error)}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <section className="surface-3d rim-sheen relative flex flex-col justify-between overflow-hidden rounded-3xl p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/30 blur-3xl" />
            {isLoading || !data ? (
              <Skeleton className="h-44 rounded-2xl bg-background/40" />
            ) : (
              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {data.user.avatarUrl ? (
                      <img src={data.user.avatarUrl} alt={`${data.user.username} avatar`} width={64} height={64} className="size-16 rounded-2xl ring-2 ring-sheen/60" />
                    ) : (
                      <div className="grid size-16 place-items-center rounded-2xl bg-primary/25 ring-2 ring-sheen/60 font-display text-2xl font-bold text-white">
                        {(data.user.globalName ?? data.user.username).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SparrowX Google Client Area</p>
                      <h1 className="truncate text-2xl font-bold">{data.user.globalName ?? data.user.username}</h1>
                      <p className="font-mono text-sm text-sheen">{data.user.email}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ivory" className="rounded-xl" onClick={() => setTopUp(true)}>
                    <Sparkles className="size-4" /> Add SparrowCoins
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Active servers", value: servers?.length ?? "—" },
                    { label: "Online nodes", value: servers ? onlineCount : "—" },
                    { label: "SparrowCoins", value: data.coins.toLocaleString("en-IN") },
                    { label: "INR Value", value: `₹${data.coins.toLocaleString("en-IN")}` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-border bg-background/45 p-3">
                      <p className="font-display text-xl font-bold">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-background/45 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Gift className="size-3.5 text-sheen" /> Redeem SparrowCoins Promo
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Instant credit · 1 Coin = ₹1
                      </p>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (promoCode.trim().length >= 3) quickPromo.mutate();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        placeholder="PROMO CODE"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="h-9 w-40 bg-background/60 font-mono text-xs uppercase"
                      />
                      <Button type="submit" size="sm" variant="secondary" disabled={quickPromo.isPending || promoCode.trim().length < 3}>
                        {quickPromo.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Claim"}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </section>
          {data ? <PanelCredentials panel={data.panel} /> : <Skeleton className="h-72 rounded-3xl bg-card" />}
        </div>

        <DashboardSubscriptionLock
          serviceName="SparrowX Game Hosting"
          mode="overlay"
          locked={Boolean(data && servers && servers.length === 0)}
          onChoosePlan={() =>
            document.getElementById("game-deploy-plans")?.scrollIntoView({ behavior: "smooth" })
          }
          secondaryActionLabel="Add SparrowCoins"
          onSecondaryAction={() => setTopUp(true)}
        >
          <ServerList />
        </DashboardSubscriptionLock>
        {data && (
          <SubscriptionManager
            coins={data.coins}
            onOpenCoinStore={() => setTopUp(true)}
          />
        )}
        {data && (
          <div id="game-deploy-plans" className="scroll-mt-20">
            <DeployPlans
              coins={data.coins}
              {...(deploy ? { initialPlanId: deploy } : {})}
              onNeedCoins={() => setTopUp(true)}
            />
          </div>
        )}
        <Transactions />

        <section
          aria-label="SparrowX Security & Cloud Ecosystem"
          className="surface-3d rim-sheen rounded-3xl border border-border p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sheen">
                Connected SparrowX Ecosystem
              </p>
              <h2 className="text-lg font-bold">
                Need Edge WAF DDoS Protection or Managed Cloud Databases?
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Protect external dedicated/VPS game nodes on SparrowX Shield, manage Linux firewall agents on NetSec, or provision low-latency PostgreSQL databases on SparrowX Cloud DB.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <a href="https://sec.sparrowx.net" target="_blank" rel="noreferrer">
                  <ShieldCheck className="size-4 text-emerald-400" /> SparrowX Shield <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <a href="https://netsec.sparrowx.net/login?sso=master" target="_blank" rel="noreferrer">
                  NetSec Firewall Panel <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <a href="https://sparrowx.net">
                  SparrowX Cloud
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {data && <TopUpDialog open={topUp} onOpenChange={setTopUp} demo={false} razorpay={data.integrations.razorpay} />}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
