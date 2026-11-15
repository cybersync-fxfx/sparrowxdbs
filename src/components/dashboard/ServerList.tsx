import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Copy, ExternalLink, Loader2, Play, RotateCw, Server as ServerIcon, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { serverPowerAction } from "@/lib/portal.functions";
import { SERVICES } from "@/lib/services";
import type { ServerStatus, ServerView } from "@/lib/portal-types";
import { cn } from "@/lib/utils";
import { errorText, useRefreshAll, useServers } from "./hooks";

const STATUS: Record<ServerStatus, string> = {
  ONLINE: "bg-success/15 text-success",
  OFFLINE: "bg-destructive/15 text-destructive",
  INSTALLING: "bg-warning/15 text-warning",
  SUSPENDED: "bg-muted text-muted-foreground",
};

function countdown(iso: string | null) {
  if (!iso) return "No renewal on file";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Renewal due";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `Renews in ${d}d ${h}h`;
}

function Usage({ label, used, limit, unit }: { label: string; used: number | null; limit: number; unit: string }) {
  const pct = used == null || !limit ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{used == null ? `— / ${limit}${unit}` : `${used} / ${limit}${unit}`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
        <div className="h-full rounded-full bg-gradient-discord transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ServerCard({ s }: { s: ServerView }) {
  const svc = s.service ? SERVICES[s.service] : null;
  const refresh = useRefreshAll();
  const power = useMutation({
    mutationFn: (signal: "start" | "restart" | "stop") =>
      serverPowerAction({ data: { identifier: s.identifier, signal } }),
    onSuccess: async (res) => {
      toast.success(res.message);
      await refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const copyAddr = () =>
    s.address &&
    navigator.clipboard.writeText(s.address).then(
      () => toast.success("Address copied"),
      () => toast.error("Couldn't access clipboard"),
    );

  const ssoConsoleHref = `/api/game/panel-sso?next=${encodeURIComponent(`/server/${s.identifier}`)}`;

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex items-start gap-3">
        {svc ? (
          <img src={svc.image} alt={`${svc.name} game server node`} width={44} height={44} className="size-11 rounded-xl object-cover" />
        ) : (
          <span className="grid size-11 place-items-center rounded-xl bg-muted"><ServerIcon className="size-5" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="truncate text-xs text-muted-foreground">{[svc?.name, s.planName].filter(Boolean).join(" · ") || "Game server"}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 font-mono text-[10px] font-bold", STATUS[s.status])}>{s.status}</span>
      </div>

      <button
        type="button"
        onClick={copyAddr}
        disabled={!s.address}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 font-mono text-sm hover:border-sheen/60"
      >
        <span className="truncate">{s.address ?? "Allocating address…"}</span>
        <Copy className="size-4 text-muted-foreground" />
      </button>

      <div className="mt-4 space-y-3">
        <Usage label="RAM" used={s.ramUsedMb} limit={s.ramLimitMb} unit="MB" />
        <Usage label="CPU" used={s.cpuUsed} limit={s.cpuLimit} unit="%" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3.5">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2.5 text-xs text-emerald-300 hover:bg-emerald-500/15"
            disabled={power.isPending}
            onClick={() => power.mutate("start")}
            title="Start server"
          >
            {power.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Start
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2.5 text-xs text-amber-300 hover:bg-amber-500/15"
            disabled={power.isPending}
            onClick={() => power.mutate("restart")}
            title="Restart server"
          >
            <RotateCw className="size-3.5" /> Restart
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2.5 text-xs text-rose-300 hover:bg-rose-500/15"
            disabled={power.isPending}
            onClick={() => power.mutate("stop")}
            title="Stop server"
          >
            <Square className="size-3.5" /> Stop
          </Button>
        </div>

        <Button asChild size="sm" variant="discord" className="rounded-lg">
          <a href={ssoConsoleHref} target="_blank" rel="noreferrer">
            Open Panel <ExternalLink />
          </a>
        </Button>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><Clock className="size-3" /> {countdown(s.expiresAt)}</span>
        <span className="font-mono opacity-75">ID: {s.identifier}</span>
      </div>
    </div>
  );
}

export function ServerList() {
  const { data, isLoading, error } = useServers();
  return (
    <section id="servers" className="surface-3d scroll-mt-24 rounded-3xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Your servers</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse-dot" /> Live · refreshes every 15s
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl bg-background/40" />)}
        {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
        {data?.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No servers yet — deploy your first plan above.
          </p>
        )}
        {data?.map((s) => <ServerCard key={s.id} s={s} />)}
      </div>
    </section>
  );
}
