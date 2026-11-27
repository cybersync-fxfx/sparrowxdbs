import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  Boxes,
  CalendarClock,
  Check,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sliders,
  Terminal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getEggConfigDetails,
  getLiveServerConfig,
  reinstallLiveServer,
  saveLiveServerConfig,
} from "@/lib/portal.functions";
import type { ServerConfigView, ServerView } from "@/lib/portal-types";
import type { EggCatalogItem, EggSectionSummary } from "@/routes/api/game/eggs-catalog";
import { errorText, useRefreshAll } from "./hooks";

type ConfigTab = "startup" | "egg-switch" | "profile" | "panel-map";

interface CatalogResponse {
  ok: boolean;
  totalEggs: number;
  sections: EggSectionSummary[];
  eggs: EggCatalogItem[];
}

export interface PanelDeepLink {
  id: string;
  label: string;
  subpath: string;
  description: string;
  icon: typeof Terminal;
}

export const PANEL_DEEP_LINKS: PanelDeepLink[] = [
  { id: "console", label: "Console", subpath: "", description: "Live WebSocket terminal, logs & instant commands", icon: Terminal },
  { id: "files", label: "Files & SFTP", subpath: "/files", description: "Edit server.properties, upload mods/plugins & SFTP", icon: FolderOpen },
  { id: "databases", label: "Databases", subpath: "/databases", description: "Create MySQL databases for QBCore, LuckPerms & apps", icon: Database },
  { id: "backups", label: "Backups", subpath: "/backups", description: "Snapshot, download & restore server world backups", icon: Archive },
  { id: "network", label: "Network", subpath: "/network", description: "Inspect primary IP:Port & extra port allocations", icon: Network },
  { id: "schedules", label: "Schedules", subpath: "/schedules", description: "Automated restarts, daily backups & cron tasks", icon: CalendarClock },
  { id: "users", label: "Sub-Users", subpath: "/users", description: "Grant staff granular Console/Files/Startup access", icon: Users },
  { id: "startup", label: "Panel Startup", subpath: "/startup", description: "Inspect Pterodactyl's native Startup view directly", icon: Sliders },
];

export function buildPanelSsoHref(identifier: string, subpath = ""): string {
  return `/api/game/panel-sso?next=${encodeURIComponent(`/server/${identifier}${subpath}`)}`;
}

function isSensitiveEnvKey(envKey: string): boolean {
  return /(TOKEN|PASSWORD|PASS|SECRET|LICENSE|API_KEY|AUTH_KEY|RCON)/i.test(envKey);
}

function isRequiredRule(rules: string): boolean {
  return /(^|\|)required(\||$)/i.test(rules);
}

function renderStartupPreview(startup: string, envValues: Record<string, string>, memMb: number): string {
  return startup.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => {
    if (key === "SERVER_MEMORY") return String(memMb);
    if (key === "SERVER_IP") return "0.0.0.0";
    if (key === "SERVER_PORT") return "25565";
    return envValues[key] ?? `{{${key}}}`;
  });
}

export function ServerConfigModal({
  server,
  open,
  initialTab = "startup",
  onClose,
}: {
  server: ServerView;
  open: boolean;
  initialTab?: ConfigTab;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const discardBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const dirtyHintId = useId();
  const tabBaseId = useId();
  const refreshAll = useRefreshAll();

  const [tab, setTab] = useState<ConfigTab>(initialTab);
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [dockerImageDraft, setDockerImageDraft] = useState("");
  const [nameDraft, setNameDraft] = useState(server.name);
  const [descDraft, setDescDraft] = useState(server.description ?? "");
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showUnsavedGuard, setShowUnsavedGuard] = useState(false);

  // Egg switcher state
  const [eggSection, setEggSection] = useState<"games" | "applications" | "generic">("games");
  const [eggSearch, setEggSearch] = useState("");
  const [selectedSwitchEgg, setSelectedSwitchEgg] = useState<EggCatalogItem | null>(null);
  const [reinstallOnSwitch, setReinstallOnSwitch] = useState(true);

  // Reinstall confirmation state
  const [confirmReinstall, setConfirmReinstall] = useState(false);

  const serverNumericId = Number(server.id);

  const {
    data: liveConfig,
    isLoading: configLoading,
    isFetching: configFetching,
    error: configError,
    refetch: refetchConfig,
  } = useQuery<ServerConfigView>({
    queryKey: ["server-live-config", serverNumericId],
    queryFn: () => getLiveServerConfig({ data: { serverId: serverNumericId } }),
    enabled: open && Number.isFinite(serverNumericId) && serverNumericId > 0,
    staleTime: 15_000,
  });

  const { data: catalog } = useQuery<CatalogResponse>({
    queryKey: ["game-eggs-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/game/eggs-catalog", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load egg catalog");
      return (await res.json()) as CatalogResponse;
    },
    enabled: open && tab === "egg-switch",
    staleTime: 60_000,
  });

  const { data: targetEggDetails, isLoading: targetEggLoading } = useQuery({
    queryKey: ["egg-details-preview", selectedSwitchEgg?.nestId, selectedSwitchEgg?.eggId],
    queryFn: () =>
      getEggConfigDetails({
        data: { nestId: selectedSwitchEgg!.nestId!, eggId: selectedSwitchEgg!.eggId! },
      }),
    enabled: Boolean(open && tab === "egg-switch" && selectedSwitchEgg?.nestId && selectedSwitchEgg?.eggId),
    staleTime: 60_000,
  });

  // Sync draft state whenever live Pterodactyl config loads
  useEffect(() => {
    if (!liveConfig) return;
    const nextEnv: Record<string, string> = {};
    for (const v of liveConfig.variables) {
      nextEnv[v.envVariable] = v.serverValue;
    }
    setEnvDraft(nextEnv);
    setDockerImageDraft(liveConfig.dockerImage);
    setNameDraft(liveConfig.name);
    setDescDraft(liveConfig.description);
    setShowUnsavedGuard(false);
  }, [liveConfig]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setStatusMessage("");
      setConfirmReinstall(false);
      setShowUnsavedGuard(false);
    }
  }, [open, initialTab]);

  const isStartupDirty = useMemo(() => {
    if (!liveConfig) return false;
    if (dockerImageDraft !== liveConfig.dockerImage) return true;
    for (const v of liveConfig.variables) {
      if (v.userEditable && (envDraft[v.envVariable] ?? "") !== v.serverValue) {
        return true;
      }
    }
    return false;
  }, [liveConfig, dockerImageDraft, envDraft]);

  const isProfileDirty = useMemo(() => {
    if (!liveConfig) return false;
    return nameDraft.trim() !== liveConfig.name.trim() || descDraft.trim() !== liveConfig.description.trim();
  }, [liveConfig, nameDraft, descDraft]);

  const isDirty = isStartupDirty || isProfileDirty;

  // Native <dialog> open/close synchronization via showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  // Progressive fallback for browsers lacking native closedby="any" (Safari) + unsaved-changes cancel guard
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const handleCancel = (e: Event) => {
      if (isDirty) {
        e.preventDefault();
        setShowUnsavedGuard(true);
        requestAnimationFrame(() => discardBtnRef.current?.focus());
      }
    };

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const supportsClosedBy = typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;

    const onPointerDown = (e: PointerEvent) => {
      if (!supportsClosedBy && !isDirty) {
        pressedOutside = isOutside(e);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!supportsClosedBy && !isDirty && pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, [open, isDirty, onClose]);

  const requestCloseDialog = () => {
    if (isDirty) {
      setShowUnsavedGuard(true);
      requestAnimationFrame(() => discardBtnRef.current?.focus());
      return;
    }
    dialogRef.current?.close();
    onClose();
  };

  const forceCloseDialog = () => {
    setShowUnsavedGuard(false);
    dialogRef.current?.close();
    onClose();
  };

  const saveStartupMutation = useMutation({
    mutationFn: (opts: { restartAfter?: boolean }) =>
      saveLiveServerConfig({
        data: {
          serverId: serverNumericId,
          dockerImage: dockerImageDraft || undefined,
          environment: envDraft,
          restartAfter: Boolean(opts.restartAfter),
        },
      }),
    onSuccess: async (_res, vars) => {
      await Promise.all([refetchConfig(), refreshAll()]);
      const msg = vars.restartAfter
        ? "Startup settings synced to Pterodactyl Panel and server restart triggered."
        : "Startup settings synced live to Pterodactyl Panel.";
      setStatusMessage(msg);
      toast.success("Synced to Pterodactyl Panel", { description: msg });
    },
    onError: (e) => {
      const msg = errorText(e);
      setStatusMessage(`Save failed: ${msg}`);
      toast.error(msg);
    },
  });

  const switchEggMutation = useMutation({
    mutationFn: () => {
      if (!selectedSwitchEgg?.nestId || !selectedSwitchEgg?.eggId) {
        throw new Error("Select a Panel-synced egg first.");
      }
      return saveLiveServerConfig({
        data: {
          serverId: serverNumericId,
          targetNestId: selectedSwitchEgg.nestId,
          targetEggId: selectedSwitchEgg.eggId,
          reinstallAfter: reinstallOnSwitch,
        },
      });
    },
    onSuccess: async () => {
      const switchedName = selectedSwitchEgg?.name ?? "new runtime";
      setSelectedSwitchEgg(null);
      await Promise.all([refetchConfig(), refreshAll()]);
      setTab("startup");
      const msg = reinstallOnSwitch
        ? `Switched egg to ${switchedName} & queued reinstall in Panel.`
        : `Switched egg to ${switchedName} in Pterodactyl Panel.`;
      setStatusMessage(msg);
      toast.success(`Runtime switched to ${switchedName}`, { description: msg });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      saveLiveServerConfig({
        data: {
          serverId: serverNumericId,
          name: nameDraft.trim(),
          description: descDraft.trim(),
        },
      }),
    onSuccess: async () => {
      await Promise.all([refetchConfig(), refreshAll()]);
      setStatusMessage("Server name & description synced to Panel.");
      toast.success("Server profile updated in Panel");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const reinstallMutation = useMutation({
    mutationFn: () => reinstallLiveServer({ data: { serverId: serverNumericId } }),
    onSuccess: async (res) => {
      setConfirmReinstall(false);
      await refreshAll();
      setStatusMessage(res.message);
      toast.success("Server reinstall started", {
        description: "Track live installation output in the Pterodactyl Console.",
      });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const catalogEggsForSection = useMemo(() => {
    const eggs = (catalog?.eggs ?? []).filter((e) => e.section === eggSection);
    const q = eggSearch.trim().toLowerCase();
    const filtered = q
      ? eggs.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q),
        )
      : eggs;
    // Show Panel-synced (installed) eggs first
    return [...filtered].sort((a, b) => Number(b.installed) - Number(a.installed)).slice(0, 36);
  }, [catalog, eggSection, eggSearch]);

  const tabItems: Array<{ id: ConfigTab; label: string; icon: typeof Sliders }> = [
    { id: "startup", label: "Startup & Variables", icon: Sliders },
    { id: "egg-switch", label: "Switch Egg / Runtime", icon: Layers },
    { id: "profile", label: "Profile & Reinstall", icon: Settings2 },
    { id: "panel-map", label: "Panel Quick-Launch", icon: ExternalLink },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = tabItems.findIndex((t) => t.id === tab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setTab(tabItems[(idx + 1) % tabItems.length]!.id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTab(tabItems[(idx - 1 + tabItems.length) % tabItems.length]!.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      setTab(tabItems[0]!.id);
    } else if (e.key === "End") {
      e.preventDefault();
      setTab(tabItems[tabItems.length - 1]!.id);
    }
  };

  const handleCopyAddress = () => {
    const addr = liveConfig?.address ?? server.address;
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(
      () => {
        setCopiedAddr(true);
        toast.success("Server address copied");
        setTimeout(() => setCopiedAddr(false), 1600);
      },
      () => toast.error("Clipboard unavailable"),
    );
  };

  const closedByProps = { closedby: isDirty ? "none" : "any" } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="spx-native-dialog theme-dashboard"
      {...closedByProps}
    >
      {/* Header + Panel Deep-Link SSO Bar */}
      <header className="shrink-0 border-b border-border bg-[#05060a] px-6 py-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                <ShieldCheck className="size-3" aria-hidden="true" />
                <span>Live Panel Sync</span>
              </span>
              {(liveConfig?.eggName || server.eggName) && (
                <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {liveConfig?.nestName ? `${liveConfig.nestName} · ` : ""}
                  {liveConfig?.eggName ?? server.eggName}
                </span>
              )}
              {(liveConfig?.address || server.address) && (
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] text-foreground hover:border-sky-400/50 transition-colors"
                >
                  <span>{liveConfig?.address ?? server.address}</span>
                  {copiedAddr ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-muted-foreground" />}
                </button>
              )}
            </div>
            <h1 id={titleId} className="font-display text-lg font-bold text-foreground truncate">
              Configure {liveConfig?.name ?? server.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              disabled={configFetching}
              onClick={() => void refetchConfig()}
            >
              <RefreshCw className={`size-3.5 ${configFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">Pull Live</span>
            </Button>
            <button
              type="button"
              onClick={requestCloseDialog}
              aria-label="Close server configurator"
              className="grid size-8 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Direct Auto-SSO Deep-Link Bar into Pterodactyl Panel */}
        <nav aria-label="Pterodactyl Panel direct SSO shortcuts" className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 pr-1">
            Panel SSO:
          </span>
          {PANEL_DEEP_LINKS.slice(0, 7).map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.id}
                href={buildPanelSsoHref(server.identifier, link.subpath)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[#0b0e17] px-2.5 py-1 text-[11px] font-medium text-secondary-foreground hover:border-sky-400/60 hover:text-white transition-colors shrink-0"
              >
                <Icon className="size-3 text-sky-400" aria-hidden="true" />
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Single-Row Accessible Tablist (modern-web-guidance: tabs) */}
        <div
          role="tablist"
          aria-label="Server configuration sections"
          onKeyDown={handleTabKeyDown}
          className="spx-tablist -mb-4 gap-1 border-t border-border/60 pt-2"
        >
          {tabItems.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                id={`${tabBaseId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  selected ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Reserved-space Unsaved Changes Guard (never shifts buttons under pointer) */}
      <div
        id={dirtyHintId}
        className={`shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/35 bg-amber-500/10 px-6 py-2 text-xs text-amber-200 ${
          showUnsavedGuard ? "visible" : "hidden"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <AlertTriangle className="size-3.5 text-amber-400" aria-hidden="true" />
          You have unsaved changes not synced to Pterodactyl Panel yet.
        </span>
        <div className="flex items-center gap-2">
          <Button
            ref={discardBtnRef}
            type="button"
            size="sm"
            variant="destructive"
            aria-describedby={dirtyHintId}
            className="h-7 rounded-lg px-2.5 text-xs"
            onClick={forceCloseDialog}
          >
            Discard Changes
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 rounded-lg px-2.5 text-xs"
            onClick={() => setShowUnsavedGuard(false)}
          >
            Keep Editing
          </Button>
        </div>
      </div>

      {/* Live Status Region */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {configLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-sky-400" />
            <p className="text-xs font-mono">Pulling live startup variables &amp; runtime from Pterodactyl Panel…</p>
          </div>
        ) : configError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 space-y-3 text-xs">
            <p className="font-semibold text-destructive">Could not load live server configuration from Panel</p>
            <p className="text-muted-foreground">{errorText(configError)}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void refetchConfig()}>
                <RefreshCw className="size-3.5" /> Retry Sync
              </Button>
              <Button asChild size="sm" variant="discord">
                <a href={buildPanelSsoHref(server.identifier, "/startup")} target="_blank" rel="noreferrer">
                  Open Panel Startup Directly <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: Live Startup Variables & Docker Runtime */}
            <div
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-startup`}
              hidden={tab !== "startup"}
            >
              {liveConfig && (
                <form
                  aria-label="Server startup configuration form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveStartupMutation.mutate({ restartAfter: false });
                  }}
                  className="space-y-5"
                >
                  {/* Docker Runtime Selector */}
                  <div className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={`${tabBaseId}-docker-img`} className="text-xs font-semibold text-foreground">
                        Container Runtime / Docker Image
                      </label>
                      <span className="font-mono text-[10px] text-emerald-300">
                        {Object.keys(liveConfig.dockerImages).length} runtime(s) available
                      </span>
                    </div>
                    <select
                      id={`${tabBaseId}-docker-img`}
                      name="dockerImage"
                      value={dockerImageDraft}
                      onChange={(e) => setDockerImageDraft(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      {Object.entries(liveConfig.dockerImages).map(([label, img]) => (
                        <option key={img} value={img}>
                          {label} — {img}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Switch Java, Node.js, Python, or game runtime versions cleanly — applied live to Pterodactyl without recreating your server.
                    </p>
                  </div>

                  {/* Startup Environment Variables */}
                  <fieldset className="space-y-3">
                    <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Live Startup Variables ({liveConfig.variables.length})
                    </legend>
                    {liveConfig.variables.length === 0 ? (
                      <p className="rounded-xl border border-border bg-[#0b0e17] p-4 text-xs text-muted-foreground">
                        This egg has no editable startup environment variables.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {liveConfig.variables.map((v) => {
                          const inputId = `${tabBaseId}-var-${v.envVariable}`;
                          const helpId = `${inputId}-help`;
                          const sensitive = isSensitiveEnvKey(v.envVariable);
                          const revealed = Boolean(revealedSecrets[v.envVariable]);
                          const required = isRequiredRule(v.rules);
                          return (
                            <div
                              key={v.envVariable}
                              className="flex flex-col gap-1.5 rounded-2xl border border-border bg-[#0b0e17] p-3.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label htmlFor={inputId} className="text-xs font-semibold text-foreground">
                                  {v.name}{" "}
                                  {required && (
                                    <span className="text-rose-400" aria-hidden="true">
                                      *
                                    </span>
                                  )}
                                </label>
                                <code className="rounded bg-[#05060a] px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                                  {v.envVariable}
                                </code>
                              </div>

                              <div className="relative">
                                <input
                                  id={inputId}
                                  name={v.envVariable}
                                  type={sensitive && !revealed ? "password" : "text"}
                                  value={envDraft[v.envVariable] ?? ""}
                                  disabled={!v.userEditable}
                                  required={required && v.userEditable}
                                  autoCorrect="off"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  aria-describedby={v.description ? helpId : undefined}
                                  onChange={(e) =>
                                    setEnvDraft((prev) => ({ ...prev, [v.envVariable]: e.target.value }))
                                  }
                                  className="spx-field-input h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-60"
                                />
                                {sensitive && (
                                  <button
                                    type="button"
                                    aria-pressed={revealed}
                                    aria-label={revealed ? `Hide ${v.name}` : `Show ${v.name}`}
                                    onClick={() =>
                                      setRevealedSecrets((prev) => ({
                                        ...prev,
                                        [v.envVariable]: !prev[v.envVariable],
                                      }))
                                    }
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                  </button>
                                )}
                              </div>

                              {v.description && (
                                <p id={helpId} className="text-[11px] leading-relaxed text-muted-foreground">
                                  {v.description}
                                </p>
                              )}
                              {!v.userEditable && (
                                <span className="font-mono text-[10px] text-amber-300/80">
                                  Managed by Pterodactyl (read-only)
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>

                  {/* Effective Startup Command Preview */}
                  <div className="rounded-2xl border border-border bg-[#05060a] p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Resolved Startup Command Preview</span>
                      <span className="font-mono">{liveConfig.limits.memory}MB RAM</span>
                    </div>
                    <pre className="overflow-x-auto font-mono text-[11px] text-emerald-300 leading-relaxed">
                      {renderStartupPreview(liveConfig.startup, envDraft, liveConfig.limits.memory)}
                    </pre>
                  </div>

                  {/* Sticky Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-[11px] text-muted-foreground">
                      {isStartupDirty ? "Unsaved changes ready to sync to Panel." : "In sync with Pterodactyl Panel."}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        disabled={saveStartupMutation.isPending}
                      >
                        {saveStartupMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        <span>Save to Panel</span>
                      </Button>
                      <Button
                        type="button"
                        variant="discord"
                        size="sm"
                        className="rounded-xl"
                        disabled={saveStartupMutation.isPending}
                        onClick={() => saveStartupMutation.mutate({ restartAfter: true })}
                      >
                        {saveStartupMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                        <span>Save &amp; Restart Server</span>
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* TAB 2: Live Egg / Runtime Switcher (All 321 Official Eggs) */}
            <div
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-egg-switch`}
              hidden={tab !== "egg-switch"}
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Switch Server Egg / Software Stack</h2>
                    <p className="text-xs text-muted-foreground">
                      Swap between all 3 official Pterodactyl repositories (Games, Applications &amp; Bots, Generic Runtimes) without buying a new server.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: "games", label: "Games", icon: Gamepad2 },
                        { id: "applications", label: "Apps & Bots", icon: Boxes },
                        { id: "generic", label: "Generic", icon: Cpu },
                      ] as const
                    ).map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setEggSection(s.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            eggSection === s.id
                              ? "border-sky-400/70 bg-sky-500/15 text-white"
                              : "border-border bg-[#0b0e17] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div role="search" className="relative">
                  <label htmlFor={`${tabBaseId}-egg-search`} className="sr-only">
                    Search eggs to switch runtime
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id={`${tabBaseId}-egg-search`}
                    type="search"
                    value={eggSearch}
                    onChange={(e) => setEggSearch(e.target.value)}
                    placeholder="Search Paper, Purpur, FiveM, Rust, Palworld, Node.js, Python, Uptime Kuma..."
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Selected Egg Confirmation Card */}
                {selectedSwitchEgg && (
                  <div className="rounded-2xl border border-sky-500/45 bg-sky-500/10 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Ready to switch to: {selectedSwitchEgg.name}
                        </p>
                        <p className="text-[11px] text-sky-200/80">
                          Nest: {selectedSwitchEgg.nestName} · Category: {selectedSwitchEgg.category}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSwitchEgg(null)}
                        className="text-xs text-muted-foreground hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    {targetEggLoading ? (
                      <p className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" /> Loading egg variables from Panel...
                      </p>
                    ) : targetEggDetails ? (
                      <div className="rounded-xl border border-border bg-[#05060a] p-3 font-mono text-[11px] space-y-1">
                        <p className="text-emerald-300 truncate">Docker: {targetEggDetails.dockerImage}</p>
                        <p className="text-muted-foreground">
                          Includes {targetEggDetails.variables.length} configurable startup variables.
                        </p>
                      </div>
                    ) : null}

                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reinstallOnSwitch}
                        onChange={(e) => setReinstallOnSwitch(e.target.checked)}
                        className="size-4 accent-blue-500"
                      />
                      <span>Reinstall server files automatically after switching egg (recommended)</span>
                    </label>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="discord"
                        size="sm"
                        className="rounded-xl"
                        disabled={switchEggMutation.isPending || !selectedSwitchEgg.installed}
                        onClick={() => switchEggMutation.mutate()}
                      >
                        {switchEggMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
                        <span>Apply {selectedSwitchEgg.name} to Server</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Egg Picker Grid */}
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {catalogEggsForSection.map((egg) => {
                    const isCurrent = Boolean(
                      liveConfig && egg.eggId && liveConfig.eggId === egg.eggId,
                    );
                    const isPicked = selectedSwitchEgg?.id === egg.id;
                    return (
                      <button
                        key={egg.id}
                        type="button"
                        disabled={!egg.installed || isCurrent}
                        onClick={() => setSelectedSwitchEgg(egg)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          isCurrent
                            ? "border-emerald-500/45 bg-emerald-500/10 cursor-default"
                            : isPicked
                              ? "border-sky-400 bg-sky-500/15"
                              : egg.installed
                                ? "border-border bg-[#0b0e17] hover:border-sky-400/50"
                                : "border-border/60 bg-[#070910] opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground leading-snug">{egg.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] shrink-0 ${
                              isCurrent
                                ? "bg-emerald-500/20 text-emerald-300"
                                : egg.installed
                                  ? "bg-sky-500/15 text-sky-300"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {isCurrent ? "Active" : egg.installed ? "Ready" : "Sync VPS"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">{egg.category}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* TAB 3: Profile, Allocations & Safe Reinstall */}
            <div
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-profile`}
              hidden={tab !== "profile"}
            >
              {liveConfig && (
                <div className="space-y-5">
                  <form
                    aria-label="Server profile form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (nameDraft.trim()) saveProfileMutation.mutate();
                    }}
                    className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-3"
                  >
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Server Identity (Synced to Panel)
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor={`${tabBaseId}-srv-name`} className="text-xs font-semibold text-foreground">
                          Server Name <span className="text-rose-400" aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`${tabBaseId}-srv-name`}
                          name="serverName"
                          type="text"
                          required
                          maxLength={60}
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="spx-field-input h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`${tabBaseId}-srv-desc`} className="text-xs font-semibold text-foreground">
                          Description / Notes
                        </label>
                        <input
                          id={`${tabBaseId}-srv-desc`}
                          name="serverDesc"
                          type="text"
                          maxLength={200}
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          placeholder="e.g. Survival SMP Season 4"
                          className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        variant="discord"
                        className="rounded-xl"
                        disabled={saveProfileMutation.isPending || !nameDraft.trim()}
                      >
                        {saveProfileMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        <span>Update Server Name</span>
                      </Button>
                    </div>
                  </form>

                  {/* Hardware & Panel Feature Quotas */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      { label: "RAM Limit", value: `${liveConfig.limits.memory} MB`, icon: Cpu },
                      { label: "CPU Limit", value: `${liveConfig.limits.cpu}%`, icon: Cpu },
                      { label: "NVMe Disk", value: `${Math.round(liveConfig.limits.disk / 1024)} GB`, icon: HardDrive },
                      { label: "MySQL DBs", value: String(liveConfig.featureLimits.databases), icon: Database },
                      { label: "Backups", value: String(liveConfig.featureLimits.backups), icon: Archive },
                      { label: "Ports", value: String(liveConfig.featureLimits.allocations), icon: Network },
                    ].map((q) => (
                      <div key={q.label} className="rounded-xl border border-border bg-[#0b0e17] p-3">
                        <p className="font-mono text-sm font-bold text-foreground">{q.value}</p>
                        <p className="text-[10px] text-muted-foreground">{q.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Safe Reinstall Zone */}
                  <div className="rounded-2xl border border-rose-500/35 bg-rose-500/5 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5 text-rose-400" aria-hidden="true" />
                          Reinstall Server Runtime
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Re-runs the active egg&apos;s official installer script inside Pterodactyl Wings. Back up important worlds first.
                        </p>
                      </div>
                      {!confirmReinstall ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="rounded-xl border-rose-500/40 text-rose-200 hover:bg-rose-500/20"
                          onClick={() => setConfirmReinstall(true)}
                        >
                          Reinstall Server…
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-xl"
                            onClick={() => setConfirmReinstall(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="rounded-xl"
                            disabled={reinstallMutation.isPending}
                            onClick={() => reinstallMutation.mutate()}
                          >
                            {reinstallMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                            <span>Confirm Reinstall</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TAB 4: Client Area <-> Panel Unified Workspace Map */}
            <div
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-panel-map`}
              hidden={tab !== "panel-map"}
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs">
                  <p className="font-semibold text-emerald-300">How Client Area &amp; Pterodactyl Panel Work Together</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    Use the <strong className="text-foreground">Client Area</strong> for 1-click deployments, coin wallet renewals, live Startup Variable edits, Docker image switching, and swapping among all 321 eggs. Click any tile below to jump directly into <strong className="text-foreground">Pterodactyl Panel</strong> with instant single sign-on (zero extra login).
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {PANEL_DEEP_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.id}
                        href={buildPanelSsoHref(server.identifier, link.subpath)}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start justify-between gap-3 rounded-2xl border border-border bg-[#0b0e17] p-4 hover:border-sky-400/60 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-[#05060a] text-sky-400">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground group-hover:text-sky-300 transition-colors">
                              {link.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                              {link.description}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-sky-300" aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
