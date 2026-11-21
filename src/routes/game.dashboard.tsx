import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, ExternalLink, FlaskConical, Gift, Loader2, LogOut, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { getSessionSummary, logout, redeemPromo } from "@/lib/portal.functions";
import { PanelCredentials } from "@/components/dashboard/PanelCredentials";
import { TopUpDialog } from "@/components/dashboard/TopUpDialog";
import { DeployPlans } from "@/components/dashboard/DeployPlans";
import { ServerList } from "@/components/dashboard/ServerList";
import { Transactions } from "@/components/dashboard/Transactions";
import { errorText, useDashboard, useRefreshAll, useServers } from "@/components/dashboard/hooks";

export const Route = createFileRoute("/game/dashboard")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { deploy?: string | undefined } => ({
    deploy: typeof s.deploy === "string" && /^[a-z0-9-]{1,40}$/.test(s.deploy) ? s.deploy : undefined,
  }),
  beforeLoad: async () => {
    const me = await getSessionSummary();
    if (!me) throw redirect({ to: "/game", search: { auth_error: "Please log in with Discord first" } });
  },
  head: () => ({
    meta: [
      { title: "Client Area — SparrowX Game Hosting" },
      { name: "description", content: "Manage your SparrowX game servers, SparrowCoins wallet and game panel credentials." },
      { property: "og:title", content: "SparrowX Client Area" },
      { property: "og:description", content: "Deploy and manage FiveM, SA-MP, Minecraft and Discord bot servers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-main.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-main.png" },
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

        {data?.mode === "demo" && (
          <div className="flex items-start gap-3 rounded-2xl border border-sheen/30 bg-primary/10 p-4 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-sheen" />
            <p className="text-secondary-foreground">
              <span className="font-semibold text-foreground">Preview mode.</span> You're exploring with demo data — coins,
              servers and payments are simulated until Discord, the database and the game panel are connected.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <section className="surface-3d rim-sheen relative flex flex-col justify-between overflow-hidden rounded-3xl p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/30 blur-3xl" />
            {isLoading || !data ? (
              <Skeleton className="h-44 rounded-2xl bg-background/40" />
            ) : (
              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src={data.user.avatarUrl} alt={`${data.user.username} player avatar`} width={64} height={64} className="size-16 rounded-2xl ring-2 ring-sheen/60" />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Discord Client Area</p>
                      <h1 className="truncate text-2xl font-bold">{data.user.globalName ?? data.user.username}</h1>
                      <p className="font-mono text-sm text-sheen">@{data.user.username}</p>
                    </div>
                  </div>
                  <Button type="button" variant="discord" className="rounded-xl" onClick={() => setTopUp(true)}>
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
                        Instant credit · 1 Coin = ₹1 {data.mode === "demo" ? "(Try SPARROW100 or LAUNCH250)" : ""}
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

        <ServerList />
        {data && (
          <DeployPlans
            coins={data.coins}
            {...(deploy ? { initialPlanId: deploy } : {})}
            onNeedCoins={() => setTopUp(true)}
          />
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
                Need Anycast L3/L4 DDoS Protection or Managed Cloud Databases?
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Protect external dedicated/VPS game nodes against UDP, RakNet, and SYN floods on GameSec, manage Linux firewall agents on NetSec, or provision low-latency PostgreSQL databases on SparrowX Cloud.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <a href="https://gamesec.sparrowx.net" target="_blank" rel="noreferrer">
                  <ShieldCheck className="size-4 text-emerald-400" /> GameSec L4 DDoS <ExternalLink className="size-3.5" />
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

      {data && <TopUpDialog open={topUp} onOpenChange={setTopUp} demo={data.mode === "demo"} razorpay={data.integrations.razorpay} />}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
