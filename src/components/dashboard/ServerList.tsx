import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  Clock,
  Copy,
  Database,
  ExternalLink,
  FolderOpen,
  Layers,
  Loader2,
  Play,
  Rocket,
  RotateCw,
  Server as ServerIcon,
  Sliders,
  Square,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { serverPowerAction } from "@/lib/portal.functions";
import { SERVICES } from "@/lib/services";
import type { ServerStatus, ServerView } from "@/lib/portal-types";
import { cn } from "@/lib/utils";
import { errorText, useRefreshAll, useServers } from "./hooks";
import { buildPanelSsoHref, ServerConfigModal } from "./ServerConfigModal";
import { ServerSmartToolbox } from "./ServerSmartToolbox";

const STATUS: Record<ServerStatus, string> = {
  ONLINE: "border border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  OFFLINE: "border border-rose-500/35 bg-rose-500/15 text-rose-300",
  INSTALLING: "border border-amber-500/35 bg-amber-500/15 text-amber-300",
  SUSPENDED: "border border-border bg-muted text-muted-foreground",
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
      <div className="h-1.5 overflow-hidden rounded-full bg-[#0e121d]">
        <div className="h-full rounded-full bg-gradient-discord transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const CARD_QUICK_SSO = [
  { id: "console", label: "Console", subpath: "", icon: Terminal },
  { id: "files", label: "Files", subpath: "/files", icon: FolderOpen },
  { id: "databases", label: "Databases", subpath: "/databases", icon: Database },
  { id: "backups", label: "Backups", subpath: "/backups", icon: Archive },
] as const;

function ServerCard({ s }: { s: ServerView }) {
  const svc = s.service ? SERVICES[s.service] : null;
  const refresh = useRefreshAll();
  const [installing, setInstalling] = useState(false);
  const [installedNow, setInstalledNow] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"startup" | "egg-switch" | "profile" | "panel-map">("startup");

  const power = useMutation({
    mutationFn: (signal: "start" | "restart" | "stop") =>
      serverPowerAction({ data: { identifier: s.identifier, signal } }),
    onSuccess: async (res) => {
      toast.success(res.message);
      await refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const handleAutoInstall = async () => {
    setInstalling(true);
    toast.info(`Booting ${s.name} (${s.eggName ?? svc?.name ?? "Server"})…`, {
      description: "Starting container with configured egg runtime and startup variables.",
    });
    try {
      await serverPowerAction({ data: { identifier: s.identifier, signal: "start" } });
      setInstalledNow(true);
      toast.success(`${s.name} started!`, {
        description: "Click Configure Server to edit live Startup Variables or switch Eggs anytime.",
      });
      await refresh();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setInstalling(false);
    }
  };

  const openConfigurator = (tab: "startup" | "egg-switch" | "profile" | "panel-map" = "startup") => {
    setConfigTab(tab);
    setConfigOpen(true);
  };

  const copyAddr = () =>
    s.address &&
    navigator.clipboard.writeText(s.address).then(
      () => toast.success("Address copied"),
      () => toast.error("Couldn't access clipboard"),
    );

  const ssoConsoleHref = buildPanelSsoHref(s.identifier, "");

  return (
    <div className="rounded-2xl border border-border bg-[#05060a]/90 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start gap-3">
          {svc ? (
            <img src={svc.image} alt={`${svc.name} game server node`} width={44} height={44} className="size-11 rounded-xl object-cover ring-1 ring-border" />
          ) : (
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-secondary">
              <ServerIcon className="size-5 text-sky-400" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{s.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {s.eggName && (
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {s.eggName}
                </span>
              )}
              <span className="truncate">
                {[svc?.name, s.planName].filter(Boolean).join(" · ") || "Managed Server"}
              </span>
            </div>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold shrink-0", STATUS[s.status])}>
            {s.status}
          </span>
        </div>

        <button
          type="button"
          onClick={copyAddr}
          disabled={!s.address}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-[#080a10] px-3 py-2 font-mono text-xs hover:border-sky-400/50 transition-colors"
        >
          <span className="truncate text-foreground">{s.address ?? "Allocating address…"}</span>
          <Copy className="size-3.5 text-muted-foreground shrink-0" />
        </button>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Usage label="RAM" used={s.ramUsedMb} limit={s.ramLimitMb} unit="MB" />
          <Usage label="CPU" used={s.cpuUsed} limit={s.cpuLimit} unit="%" />
        </div>

        {/* Direct Auto-SSO Deep-Links straight to Panel sub-pages */}
        <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label={`Quick Panel SSO links for ${s.name}`}>
          {CARD_QUICK_SSO.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={buildPanelSsoHref(s.identifier, item.subpath)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-[#080a10] px-2 py-2 text-[11px] font-medium text-secondary-foreground hover:border-sky-400/60 hover:text-white transition-colors"
              >
                <Icon className="size-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </div>

        {(s.status === "OFFLINE" || s.status === "INSTALLING") && !installedNow && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-200">Ready to Configure &amp; Boot</p>
              <p className="text-[11px] text-amber-100/75">
                Start node immediately or adjust Startup Variables &amp; Eggs first.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openConfigurator("startup")}
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                <Sliders className="size-3.5" /> Configure
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ivory"
                disabled={installing}
                onClick={handleAutoInstall}
                className="h-8 rounded-lg px-3 text-xs"
              >
                {installing ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                <span>{installing ? "Starting…" : "Boot Node"}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        {/* Power Controls + Primary Configure Server & Open Panel Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3.5">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg px-2 text-xs text-emerald-300 hover:bg-emerald-500/15"
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
              className="h-8 rounded-lg px-2 text-xs text-amber-300 hover:bg-amber-500/15"
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
              className="h-8 rounded-lg px-2 text-xs text-rose-300 hover:bg-rose-500/15"
              disabled={power.isPending}
              onClick={() => power.mutate("stop")}
              title="Stop server"
            >
              <Square className="size-3.5" /> Stop
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-xs border border-sky-500/35 text-sky-200 hover:bg-sky-500/15"
              onClick={() => openConfigurator("startup")}
            >
              <Sliders className="size-3.5" /> Configure
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-2.5 text-xs"
              title="Switch Egg / Runtime"
              onClick={() => openConfigurator("egg-switch")}
            >
              <Layers className="size-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Egg</span>
            </Button>
            <Button asChild size="sm" variant="discord" className="h-8 rounded-lg px-3 text-xs">
              <a href={ssoConsoleHref} target="_blank" rel="noreferrer">
                Panel <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3" /> {countdown(s.expiresAt)}
          </span>
          <span className="font-mono opacity-75">
            {s.diskLimitGb}GB NVMe · ID: {s.identifier}
          </span>
        </div>

        <ServerSmartToolbox server={s} onOpenConfigurator={openConfigurator} />
      </div>

      <ServerConfigModal
        server={s}
        open={configOpen}
        initialTab={configTab}
        onClose={() => setConfigOpen(false)}
      />
    </div>
  );
}

export function ServerList() {
  const { data, isLoading, error } = useServers();
  return (
    <section id="servers" className="surface-3d scroll-mt-24 rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Your Servers · Live Panel Control</h2>
          <p className="text-xs text-muted-foreground">
            Edit startup variables, switch among 321 eggs, or jump straight into Console, Files, Databases &amp; Backups with 1-click Panel SSO.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse-dot" /> Live · refreshes every 15s
        </span>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl bg-background/40" />)}
        {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
        {data?.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No servers yet — pick an egg or deploy your first plan below.
          </p>
        )}
        {data?.map((s) => (
          <ServerCard key={s.id} s={s} />
        ))}
      </div>
    </section>
  );
}
