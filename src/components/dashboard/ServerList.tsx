import { toast } from "sonner";
import { Clock, Copy, ExternalLink, Server as ServerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICES } from "@/lib/services";
import type { ServerStatus, ServerView } from "@/lib/portal-types";
import { cn } from "@/lib/utils";
import { errorText, useServers } from "./hooks";

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
  const copyAddr = () =>
    s.address &&
    navigator.clipboard.writeText(s.address).then(
      () => toast.success("Address copied"),
      () => toast.error("Couldn't access clipboard"),
    );
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex items-start gap-3">
        {svc ? (
          <img src={svc.image} alt="" className="size-11 rounded-xl object-cover" />
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

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" /> {countdown(s.expiresAt)}</span>
        <Button asChild size="sm" variant="discord" className="rounded-lg">
          <a href={s.manageUrl} target="_blank" rel="noreferrer">Manage Console <ExternalLink /></a>
        </Button>
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
