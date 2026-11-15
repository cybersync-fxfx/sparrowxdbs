import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, FlaskConical, Loader2, LogOut, Plus } from "lucide-react";
import logo from "@/assets/logo-game.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { getSessionSummary, logout } from "@/lib/portal.functions";
import { PanelCredentials } from "@/components/dashboard/PanelCredentials";
import { TopUpDialog } from "@/components/dashboard/TopUpDialog";
import { DeployPlans } from "@/components/dashboard/DeployPlans";
import { ServerList } from "@/components/dashboard/ServerList";
import { Transactions } from "@/components/dashboard/Transactions";
import { errorText, useDashboard, useServers } from "@/components/dashboard/hooks";

export const Route = createFileRoute("/game/dashboard")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { deploy?: string } => ({
    deploy: typeof s.deploy === "string" && /^[a-z0-9-]{1,40}$/.test(s.deploy) ? s.deploy : undefined,
  }),
  beforeLoad: async () => {
    const me = await getSessionSummary();
    if (!me) throw redirect({ to: "/game", search: { service: undefined, auth_error: "Please log in with Discord first" } });
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
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    setLeaving(true);
    await qc.cancelQueries();
    await logout();
    qc.clear();
    navigate({ to: "/game", search: { service: undefined }, replace: true });
  };

  return (
    <div className="theme-dashboard min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/15 to-transparent" />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/game" search={{ service: undefined }} className="flex items-center gap-2.5">
            <img src={logo} alt="SparrowX logo" width={32} height={32} className="size-8 object-contain" />
            <span className="hidden font-display text-sm font-bold tracking-[0.18em] sm:block">SPARROWX</span>
            <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-sheen">CLIENT</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 pl-3 glow-discord">
              <Coins className="size-4 text-sheen" />
              <span className="font-mono text-sm font-semibold">{data ? data.coins.toLocaleString("en-IN") : "—"}</span>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">· 1 Coin = ₹1</span>
              <Button size="sm" variant="discord" className="ml-1 h-7 rounded-full px-3" onClick={() => setTopUp(true)}>
                <Plus /> <span className="hidden sm:inline">Top Up Coins</span>
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

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="surface-3d rim-sheen relative overflow-hidden rounded-3xl p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/30 blur-3xl" />
            {isLoading || !data ? (
              <Skeleton className="h-28 rounded-2xl bg-background/40" />
            ) : (
              <div className="relative">
                <div className="flex items-center gap-4">
                  <img src={data.user.avatarUrl} alt={`${data.user.username} avatar`} className="size-16 rounded-2xl ring-2 ring-sheen/60" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</p>
                    <h1 className="truncate text-2xl font-bold">{data.user.globalName ?? data.user.username}</h1>
                    <p className="font-mono text-sm text-sheen">@{data.user.username}</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { label: "Active servers", value: servers?.length ?? "—" },
                    { label: "SparrowCoins", value: data.coins.toLocaleString("en-IN") },
                    { label: "Region", value: "Asia-IN" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-border bg-background/40 p-3">
                      <p className="font-display text-xl font-bold">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          {data ? <PanelCredentials panel={data.panel} /> : <Skeleton className="h-72 rounded-3xl bg-card" />}
        </div>

        <ServerList />
        {data && <DeployPlans coins={data.coins} initialPlanId={deploy} onNeedCoins={() => setTopUp(true)} />}
        <Transactions />
      </main>

      {data && <TopUpDialog open={topUp} onOpenChange={setTopUp} demo={data.mode === "demo"} razorpay={data.integrations.razorpay} />}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
