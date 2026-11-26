import React, { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  KeyRound,
  LayoutGrid,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import {
  formatRelativeTime,
  FrameworkIcon,
  StatusBadge,
  useDeploySession,
} from "@/components/deploy/deploy-ui";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [{ title: "Project Control Plane — SparrowX Deploy" }],
  }),
  component: ProjectControlPlanePage,
});

type ControlTab = "overview" | "deployments" | "logs" | "env" | "domains" | "settings";

interface ProjectControlPayload {
  project: {
    id: string;
    name: string;
    slug: string;
    repoUrl: string;
    branch: string;
    framework: string;
    buildMethod: "railpack" | "dockerfile";
    buildCommand: string;
    startCommand: string;
    outputDir: string;
    rootDir: string;
    port: number;
    healthcheckPath: string;
    region: string;
    tier: "starter" | "growth" | "scale";
    status: string;
    autoDeploy: boolean;
    webhookSecret?: string | null;
    activeDeploymentId?: string | null;
    activeContainerName?: string | null;
    activeImageTag?: string | null;
    customDomain?: string | null;
    commitSha?: string | null;
    commitMessage: string;
    managedPostgresAttached: boolean;
    createdAt: string;
    lastDeployedAt: string;
  };
  deployments: Array<{
    id: string;
    status: string;
    triggerSource: string;
    branch: string;
    commitSha?: string | null;
    commitMessage: string;
    commitAuthor?: string | null;
    imageTag?: string | null;
    durationMs?: number | null;
    errorMessage?: string | null;
    createdAt: string;
  }>;
  logs: Array<{
    id: string;
    deploymentId: string;
    stage: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
  envVars: Array<{
    id: string;
    key: string;
    value: string;
    target: "Production" | "Preview" | "Development";
    updatedAt: string;
  }>;
  domains: Array<{
    id: string;
    domain: string;
    isDefault: boolean;
    verified: boolean;
    tlsStatus: string;
    verificationTarget: string;
    lastCheckedAt: string | null;
  }>;
  metrics: Array<{
    cpuPct: number;
    memoryMb: number;
    networkRxMb: number;
    networkTxMb: number;
    recordedAt: string;
  }>;
  hostDomain: string;
}

const BUILD_STAGES = [
  { id: "clone", label: "Cloning" },
  { id: "build", label: "Railpack / BuildKit" },
  { id: "healthcheck", label: "Healthcheck" },
  { id: "route", label: "Routing SSL" },
] as const;

function ProjectControlPlanePage() {
  const { id } = Route.useParams();
  const { user, checking } = useDeploySession(true);
  const [tab, setTab] = useState<ControlTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (
        q === "overview" ||
        q === "deployments" ||
        q === "logs" ||
        q === "env" ||
        q === "domains" ||
        q === "settings"
      ) {
        return q;
      }
    }
    return "overview";
  });

  const [data, setData] = useState<ProjectControlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live SSE Logs state
  const [streamLogs, setStreamLogs] = useState<ProjectControlPayload["logs"]>([]);
  const [logSearch, setLogSearch] = useState("");
  const [logLevel, setLogLevel] = useState<"all" | "info" | "warn" | "error" | "success">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const logBottomRef = useRef<HTMLDivElement | null>(null);

  // Env Vars state
  const [envKey, setEnvKey] = useState("");
  const [envVal, setEnvVal] = useState("");
  const [envTarget, setEnvTarget] = useState<"Production" | "Preview" | "Development">(
    "Production",
  );
  const [bulkEnv, setBulkEnv] = useState("");
  const [revealedEnvMap, setRevealedEnvMap] = useState<Record<string, string>>({});
  const [envDirty, setEnvDirty] = useState(false);

  // Domains state
  const [newDomain, setNewDomain] = useState("");
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  // Settings form state
  const [cfgBranch, setCfgBranch] = useState("main");
  const [cfgRootDir, setCfgRootDir] = useState("./");
  const [cfgBuildMethod, setCfgBuildMethod] = useState<"railpack" | "dockerfile">("railpack");
  const [cfgBuildCmd, setCfgBuildCmd] = useState("");
  const [cfgStartCmd, setCfgStartCmd] = useState("");
  const [cfgHealthPath, setCfgHealthPath] = useState("/");
  const [cfgAutoDeploy, setCfgAutoDeploy] = useState(true);
  const [cfgTier, setCfgTier] = useState<"starter" | "growth" | "scale">("starter");

  const switchTab = (next: ControlTab) => {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const loadProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent(`/projects/${id}`)}`);
        return;
      }
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load project");
      }
      const payload = json as ProjectControlPayload;
      setData(payload);
      setStreamLogs(payload.logs);
      setCfgBranch(payload.project.branch);
      setCfgRootDir(payload.project.rootDir);
      setCfgBuildMethod(payload.project.buildMethod);
      setCfgBuildCmd(payload.project.buildCommand);
      setCfgStartCmd(payload.project.startCommand);
      setCfgHealthPath(payload.project.healthcheckPath);
      setCfgAutoDeploy(payload.project.autoDeploy);
      setCfgTier(payload.project.tier);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void loadProject();
  }, [user, id]);

  // Real-time SSE log subscription when on Logs tab
  const activeDeploymentId = data?.project.activeDeploymentId || data?.deployments[0]?.id || null;
  useEffect(() => {
    if (!user || tab !== "logs" || !activeDeploymentId) return;
    if (typeof EventSource === "undefined") return;

    const es = new EventSource(
      `/api/deploy/deployments/${encodeURIComponent(activeDeploymentId)}/stream`,
      { withCredentials: true },
    );

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.addEventListener("log", (ev) => {
      try {
        const entry = JSON.parse(
          (ev as MessageEvent).data,
        ) as ProjectControlPayload["logs"][number];
        setStreamLogs((prev) =>
          prev.some((x) => x.id === entry.id) ? prev : [...prev.slice(-499), entry],
        );
      } catch {
        // ignore malformed event
      }
    });

    return () => {
      setSseConnected(false);
      es.close();
    };
  }, [user, tab, activeDeploymentId]);

  useEffect(() => {
    if (autoScroll && tab === "logs") {
      logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, autoScroll, tab]);

  const copyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedId(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1500);
  };

  const runLifecycle = async (
    action: "redeploy" | "rollback" | "start" | "stop" | "restart",
    targetDeploymentId?: string,
  ) => {
    setBusyAction(action);
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          ...(targetDeploymentId ? { targetDeploymentId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `${action} failed`);
      toast.success(
        action === "rollback"
          ? "1-click rollback queued on immutable image tag."
          : `Action "${action}" executed cleanly.`,
      );
      setEnvDirty(false);
      await loadProject();
      if (action === "redeploy" || action === "rollback") switchTab("logs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`Permanently delete "${data?.project.name}" and stop its container?`)) {
      return;
    }
    setBusyAction("delete");
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Project deleted.");
      window.location.replace("/deploy");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusyAction(null);
    }
  };

  const handleSaveEnvVar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envKey.trim()) return;
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "bulk-env",
          envVars: [{ key: envKey.trim(), value: envVal, target: envTarget }],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save env var");
      setEnvKey("");
      setEnvVal("");
      setEnvDirty(true);
      toast.success("Encrypted secret stored (AES-256-GCM).");
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save secret");
    }
  };

  const handleBulkEnvImport = async () => {
    const items: Array<{ key: string; value: string; target: typeof envTarget }> = [];
    for (const raw of bulkEnv.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const k = line
        .slice(0, eq)
        .trim()
        .replace(/^export\s+/, "");
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
        items.push({ key: k, value: v, target: envTarget });
      }
    }
    if (items.length === 0) {
      toast.error("No valid KEY=VALUE entries found.");
      return;
    }
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "bulk-env", envVars: items }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Bulk import failed");
      setBulkEnv("");
      setEnvDirty(true);
      toast.success(`Imported & encrypted ${items.length} variables.`);
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk import failed");
    }
  };

  const handleRevealEnv = async (envId: string) => {
    if (revealedEnvMap[envId] !== undefined) {
      setRevealedEnvMap((prev) => {
        const next = { ...prev };
        delete next[envId];
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reveal-env", envId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Unable to decrypt secret");
      setRevealedEnvMap((prev) => ({ ...prev, [envId]: json.envVar.value }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reveal secret");
    }
  };

  const handleDeleteEnv = async (envId: string) => {
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "remove-env", envId }),
      });
      if (!res.ok) throw new Error("Failed to remove env var");
      setEnvDirty(true);
      toast.success("Environment variable removed.");
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove env var");
    }
  };

  const handleAttachDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      const res = await fetch("/api/deploy/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: id, domain: newDomain.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add domain");
      setNewDomain("");
      toast.success("Custom domain added — configure CNAME/A record then verify DNS.");
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach domain");
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await fetch("/api/deploy/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domainId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "DNS verification failed");
      if (json.verified) toast.success(json.detail || "DNS verified & TLS active.");
      else toast.warning(json.detail || "DNS record not detected yet.");
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DNS check failed");
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("settings");
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branch: cfgBranch,
          rootDir: cfgRootDir,
          buildMethod: cfgBuildMethod,
          buildCommand: cfgBuildCmd,
          startCommand: cfgStartCmd,
          healthcheckPath: cfgHealthPath,
          autoDeploy: cfgAutoDeploy,
          tier: cfgTier,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save settings");
      toast.success("Project settings updated.");
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setBusyAction(null);
    }
  };

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return streamLogs.filter((l) => {
      if (logLevel !== "all" && l.level !== logLevel) return false;
      if (!q) return true;
      return l.message.toLowerCase().includes(q) || l.stage.toLowerCase().includes(q);
    });
  }, [streamLogs, logSearch, logLevel]);

  const downloadLogs = () => {
    const body = filteredLogs
      .map(
        (l) =>
          `[${l.createdAt}] [${l.stage.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`,
      )
      .join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.project.slug || id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-xs spx-mono text-zinc-400">
        Verifying SparrowX session...
      </div>
    );
  }

  const project = data?.project;
  const hostDomain = data?.hostDomain || "sparrowx.net";
  const primaryUrl = project
    ? `https://${project.customDomain || `${project.slug}.deploy.${hostDomain}`}`
    : "";

  const chartData =
    data && data.metrics.length > 0
      ? data.metrics.map((m) => ({
          t: new Date(m.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          cpu: m.cpuPct,
          ram: m.memoryMb,
          net: Number((m.networkRxMb + m.networkTxMb).toFixed(2)),
        }))
      : [{ t: "Now", cpu: 0, ram: 0, net: 0 }];

  return (
    <DeployAppShell
      user={user}
      activeNav="overview"
      {...(project?.name ? { breadcrumbProject: project.name } : {})}
      onQuickRedeploy={() => void runLifecycle("redeploy")}
    >
      {loading || !project ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-56 rounded bg-white/[0.06]" />
          <div className="h-44 rounded-2xl spx-obsidian-card" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header + Lifecycle Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <a
                href="/deploy"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="size-3.5" />
                <span>All Projects</span>
              </a>
              <div className="flex flex-wrap items-center gap-3">
                <div className="size-9 rounded-lg border border-white/10 bg-[#090B11] grid place-items-center">
                  <FrameworkIcon framework={project.framework} className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-semibold tracking-tight text-white">
                      {project.name}
                    </h1>
                    <StatusBadge status={project.status} />
                  </div>
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs spx-mono text-zinc-400 hover:text-white mt-0.5"
                  >
                    <span>{primaryUrl}</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void runLifecycle("redeploy")}
                className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"
              >
                <RefreshCw
                  className={`size-3.5 ${busyAction === "redeploy" ? "animate-spin" : ""}`}
                />
                <span>Redeploy</span>
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void runLifecycle("restart")}
                className="h-9 rounded-lg spx-ghost-btn inline-flex items-center gap-1.5 px-3 text-xs cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Restart</span>
              </button>
              {project.status === "Stopped" ? (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void runLifecycle("start")}
                  className="h-9 rounded-lg spx-ghost-btn inline-flex items-center gap-1.5 px-3 text-xs text-emerald-300 cursor-pointer"
                >
                  <Play className="size-3.5" />
                  <span>Start</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void runLifecycle("stop")}
                  className="h-9 rounded-lg spx-ghost-btn inline-flex items-center gap-1.5 px-3 text-xs text-amber-300 cursor-pointer"
                >
                  <Square className="size-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          {/* 6 URL-Synced Control Plane Tabs */}
          <nav
            aria-label="Project Control Plane Tabs"
            className="flex items-center gap-1 border-b border-white/[0.07] overflow-x-auto"
          >
            {(
              [
                { id: "overview", label: "Overview", icon: LayoutGrid },
                { id: "deployments", label: "Deployments", icon: Rocket },
                { id: "logs", label: "Live Logs", icon: Terminal },
                { id: "env", label: "Environment Variables", icon: KeyRound },
                { id: "domains", label: "Domains & SSL", icon: Globe },
                { id: "settings", label: "Settings", icon: Settings },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                    active
                      ? "border-white text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Production Deployment Card */}
                <div className="lg:col-span-7 rounded-2xl spx-obsidian-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Production Deployment</h2>
                    <span className="text-[11px] spx-mono text-zinc-400">
                      {project.region} · {project.buildMethod}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-white/[0.06] bg-[#06080E] p-3">
                      <div className="text-[10px] text-zinc-500">Branch</div>
                      <div className="spx-mono text-white mt-1 truncate">{project.branch}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-[#06080E] p-3">
                      <div className="text-[10px] text-zinc-500">Commit SHA</div>
                      <div className="spx-mono text-sky-400 mt-1">
                        {project.commitSha?.slice(0, 7) || "HEAD"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-[#06080E] p-3">
                      <div className="text-[10px] text-zinc-500">Container</div>
                      <div className="spx-mono text-zinc-200 mt-1 truncate">
                        {project.activeContainerName || "Pending"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-[#06080E] p-3">
                      <div className="text-[10px] text-zinc-500">Last Deploy</div>
                      <div className="spx-mono text-zinc-200 mt-1 tabular-nums">
                        {formatRelativeTime(project.lastDeployedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-[#06080E] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-zinc-300">{project.commitMessage}</span>
                    <button
                      type="button"
                      onClick={() => switchTab("logs")}
                      className="text-sky-400 hover:text-sky-300 spx-mono text-[11px] shrink-0 cursor-pointer"
                    >
                      Inspect Logs →
                    </button>
                  </div>
                </div>

                {/* Telemetry Sparklines (CPU / RAM / Network) */}
                <div className="lg:col-span-5 rounded-2xl spx-obsidian-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Activity className="size-4 text-sky-400" />
                      <span>Runtime Telemetry</span>
                    </h2>
                    <span className="text-[10px] spx-mono text-zinc-500">CPU % &amp; RAM MB</span>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <XAxis dataKey="t" stroke="#52525B" fontSize={10} />
                        <YAxis stroke="#52525B" fontSize={10} width={32} />
                        <Tooltip
                          contentStyle={{
                            background: "#090B11",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            fontSize: 11,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cpu"
                          name="CPU %"
                          stroke="#38BDF8"
                          fill="rgba(56,189,248,0.16)"
                        />
                        <Area
                          type="monotone"
                          dataKey="ram"
                          name="RAM MB"
                          stroke="#10B981"
                          fill="rgba(16,185,129,0.12)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPLOYMENTS TIMELINE + 1-CLICK ROLLBACK */}
          {tab === "deployments" && (
            <div className="rounded-2xl spx-obsidian-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Deployment History</h2>
                  <p className="text-xs text-zinc-400">
                    Immutable OCI image tags allow 1-click zero-rebuild rollback to any prior build.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {data.deployments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No deployments recorded yet.
                  </div>
                ) : (
                  data.deployments.map((dep) => (
                    <div
                      key={dep.id}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02]"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={dep.status} />
                          <span className="spx-mono text-xs text-white font-medium">
                            {dep.commitSha?.slice(0, 7) || dep.id.slice(-7)}
                          </span>
                          <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] spx-mono text-zinc-400">
                            {dep.triggerSource}
                          </span>
                          <span className="text-[11px] spx-mono text-zinc-500">
                            <GitBranch className="size-3 inline mr-1" />
                            {dep.branch}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 truncate">{dep.commitMessage}</p>
                        <div className="text-[11px] spx-mono text-zinc-500 tabular-nums">
                          {formatRelativeTime(dep.createdAt)}
                          {dep.durationMs ? ` · ${(dep.durationMs / 1000).toFixed(1)}s build` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => switchTab("logs")}
                          className="h-8 rounded-md spx-ghost-btn px-3 text-xs cursor-pointer"
                        >
                          Logs
                        </button>
                        {dep.imageTag && dep.id !== project.activeDeploymentId && (
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() => void runLifecycle("rollback", dep.id)}
                            className="h-8 rounded-md spx-silver-btn px-3 text-xs font-semibold cursor-pointer"
                          >
                            Rollback
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FULL-BLEED JETBRAINS MONO LIVE SSE LOG TERMINAL */}
          {tab === "logs" && (
            <div className="rounded-2xl spx-obsidian-card overflow-hidden">
              {/* Stage Progress Pipeline */}
              <div className="px-4 py-3 border-b border-white/[0.07] bg-[#07090F] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {BUILD_STAGES.map((s, idx) => {
                    const seen = streamLogs.some((l) => l.stage === s.id);
                    return (
                      <span
                        key={s.id}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] spx-mono ${
                          seen
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-white/[0.07] bg-white/[0.02] text-zinc-500"
                        }`}
                      >
                        <span>0{idx + 1}</span>
                        <span>{s.label}</span>
                      </span>
                    );
                  })}
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] spx-mono text-zinc-400">
                  <span
                    className={`size-1.5 rounded-full ${
                      sseConnected ? "bg-sky-400 animate-pulse" : "bg-zinc-600"
                    }`}
                  />
                  <span>{sseConnected ? "SSE Stream Live" : "History Loaded"}</span>
                </span>
              </div>

              {/* Log Toolbar */}
              <div className="px-4 py-2.5 border-b border-white/[0.07] flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filter build & runtime logs..."
                    className="w-full h-8 rounded-md spx-obsidian-input pl-8 pr-3 text-xs spx-mono"
                  />
                </div>
                <select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value as typeof logLevel)}
                  className="h-8 rounded-md spx-obsidian-input px-2.5 text-xs"
                >
                  <option value="all" className="bg-[#090B11]">
                    All Levels
                  </option>
                  <option value="info" className="bg-[#090B11]">
                    Info
                  </option>
                  <option value="success" className="bg-[#090B11]">
                    Success
                  </option>
                  <option value="warn" className="bg-[#090B11]">
                    Warn
                  </option>
                  <option value="error" className="bg-[#090B11]">
                    Error
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => setAutoScroll((v) => !v)}
                  className={`h-8 rounded-md px-2.5 text-xs border cursor-pointer ${
                    autoScroll
                      ? "border-sky-400/35 bg-sky-400/10 text-sky-300"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  Auto-scroll: {autoScroll ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={downloadLogs}
                  className="h-8 rounded-md spx-ghost-btn inline-flex items-center gap-1.5 px-2.5 text-xs cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Download</span>
                </button>
              </div>

              {/* Terminal Viewport */}
              <div className="bg-[#040508] p-4 h-[460px] overflow-y-auto spx-mono text-xs space-y-1.5">
                {filteredLogs.length === 0 ? (
                  <div className="text-zinc-500 py-10 text-center">
                    Waiting for deployment output...
                  </div>
                ) : (
                  filteredLogs.map((l) => (
                    <div key={l.id} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="text-zinc-600 shrink-0 tabular-nums">
                        {new Date(l.createdAt).toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                      <span className="text-zinc-500 uppercase shrink-0 w-20 truncate">
                        [{l.stage}]
                      </span>
                      <span
                        className={`whitespace-pre-wrap break-all ${
                          l.level === "error"
                            ? "text-red-400"
                            : l.level === "warn"
                              ? "text-amber-300"
                              : l.level === "success"
                                ? "text-emerald-400"
                                : "text-zinc-200"
                        }`}
                      >
                        {l.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logBottomRef} />
              </div>
            </div>
          )}

          {/* TAB 4: ENCRYPTED ENVIRONMENT VARIABLES */}
          {tab === "env" && (
            <div className="space-y-5 max-w-4xl">
              {envDirty && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
                  <span>Environment variables changed — redeploy to apply to live container.</span>
                  <button
                    type="button"
                    onClick={() => void runLifecycle("redeploy")}
                    className="h-8 rounded-md spx-silver-btn px-3 text-xs font-semibold cursor-pointer"
                  >
                    Save &amp; Trigger Redeploy
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSaveEnvVar}
                className="rounded-2xl spx-obsidian-card p-5 grid grid-cols-1 sm:grid-cols-12 gap-2.5"
              >
                <input
                  type="text"
                  value={envKey}
                  onChange={(e) => setEnvKey(e.target.value)}
                  placeholder="DATABASE_URL"
                  className="sm:col-span-4 h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                />
                <input
                  type="password"
                  value={envVal}
                  onChange={(e) => setEnvVal(e.target.value)}
                  placeholder="Encrypted secret value"
                  className="sm:col-span-4 h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                />
                <select
                  value={envTarget}
                  onChange={(e) => setEnvTarget(e.target.value as typeof envTarget)}
                  className="sm:col-span-2 h-10 rounded-lg spx-obsidian-input px-2 text-xs"
                >
                  <option value="Production" className="bg-[#090B11]">
                    Production
                  </option>
                  <option value="Preview" className="bg-[#090B11]">
                    Preview
                  </option>
                  <option value="Development" className="bg-[#090B11]">
                    Development
                  </option>
                </select>
                <button
                  type="submit"
                  className="sm:col-span-2 h-10 rounded-lg spx-silver-btn text-xs font-semibold cursor-pointer"
                >
                  Save Secret
                </button>
              </form>

              <div className="rounded-2xl spx-obsidian-card p-5 space-y-2.5">
                <div className="text-xs font-medium text-zinc-300">Bulk Import (.env)</div>
                <textarea
                  rows={3}
                  value={bulkEnv}
                  onChange={(e) => setBulkEnv(e.target.value)}
                  placeholder="KEY_A=value_a&#10;KEY_B=value_b"
                  className="w-full rounded-lg spx-obsidian-input p-3 text-xs spx-mono"
                />
                <button
                  type="button"
                  onClick={() => void handleBulkEnvImport()}
                  className="h-8 rounded-lg spx-ghost-btn px-3 text-xs cursor-pointer"
                >
                  Import &amp; Encrypt Block
                </button>
              </div>

              <div className="rounded-2xl spx-obsidian-card divide-y divide-white/[0.06]">
                {data.envVars.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    No environment variables saved for this project.
                  </div>
                ) : (
                  data.envVars.map((v) => {
                    const revealed = revealedEnvMap[v.id];
                    return (
                      <div
                        key={v.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs spx-mono font-semibold text-white truncate">
                            {v.key}
                          </div>
                          <div className="text-[11px] spx-mono text-zinc-400 mt-0.5 break-all">
                            {revealed !== undefined ? revealed : v.value} ·{" "}
                            <span className="text-zinc-500">{v.target}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleRevealEnv(v.id)}
                            aria-label="Reveal value"
                            className="size-8 rounded-md spx-ghost-btn grid place-items-center cursor-pointer"
                          >
                            {revealed !== undefined ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteEnv(v.id)}
                            aria-label="Delete variable"
                            className="size-8 rounded-md spx-ghost-btn hover:text-red-400 grid place-items-center cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DOMAINS & AUTOMATED LET'S ENCRYPT SSL */}
          {tab === "domains" && (
            <div className="space-y-5 max-w-4xl">
              <form
                onSubmit={handleAttachDomain}
                className="rounded-2xl spx-obsidian-card p-5 flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="app.yourdomain.in"
                  className="flex-1 h-10 rounded-lg spx-obsidian-input px-3.5 text-sm spx-mono"
                />
                <button
                  type="submit"
                  className="h-10 rounded-lg spx-silver-btn inline-flex items-center justify-center gap-1.5 px-5 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Custom Domain</span>
                </button>
              </form>

              <div className="rounded-2xl spx-obsidian-card divide-y divide-white/[0.06]">
                {data.domains.map((dom) => (
                  <div key={dom.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm spx-mono font-semibold text-white">
                          {dom.domain}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {dom.isDefault ? "Default SparrowX Subdomain" : "Custom Domain"} · TLS:{" "}
                          <span className="spx-mono text-zinc-200">{dom.tlsStatus}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={dom.verified ? "Active" : "Pending"} />
                        {!dom.isDefault && (
                          <button
                            type="button"
                            disabled={verifyingDomainId === dom.id}
                            onClick={() => void handleVerifyDomain(dom.id)}
                            className="h-8 rounded-md spx-ghost-btn px-3 text-xs cursor-pointer"
                          >
                            {verifyingDomainId === dom.id ? "Checking DNS..." : "Verify DNS"}
                          </button>
                        )}
                      </div>
                    </div>

                    {!dom.isDefault && !dom.verified && (
                      <div className="rounded-xl border border-white/[0.07] bg-[#06080E] p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs spx-mono">
                        <div>
                          <div className="text-[10px] text-zinc-500">TYPE</div>
                          <div className="text-zinc-200 mt-0.5">CNAME</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500">NAME</div>
                          <div className="text-zinc-200 mt-0.5 truncate">{dom.domain}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] text-zinc-500">VALUE</div>
                            <div className="text-sky-400 mt-0.5">{dom.verificationTarget}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(dom.id, dom.verificationTarget)}
                            className="size-7 rounded spx-ghost-btn grid place-items-center cursor-pointer"
                          >
                            {copiedId === dom.id ? (
                              <Check className="size-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS & DANGER ZONE */}
          {tab === "settings" && (
            <div className="space-y-6 max-w-4xl">
              <form
                onSubmit={handleSaveSettings}
                className="rounded-2xl spx-obsidian-card p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Build &amp; Git Settings</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configure branch auto-deploy webhooks, build overrides, and healthcheck
                      probes.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfgAutoDeploy}
                      onChange={(e) => setCfgAutoDeploy(e.target.checked)}
                      className="size-4 accent-white"
                    />
                    <span>Git Push Auto-Deploy</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Production Branch</label>
                    <input
                      type="text"
                      value={cfgBranch}
                      onChange={(e) => setCfgBranch(e.target.value)}
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Root Directory</label>
                    <input
                      type="text"
                      value={cfgRootDir}
                      onChange={(e) => setCfgRootDir(e.target.value)}
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Build Command</label>
                    <input
                      type="text"
                      value={cfgBuildCmd}
                      onChange={(e) => setCfgBuildCmd(e.target.value)}
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Start Command</label>
                    <input
                      type="text"
                      value={cfgStartCmd}
                      onChange={(e) => setCfgStartCmd(e.target.value)}
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Healthcheck Path</label>
                    <input
                      type="text"
                      value={cfgHealthPath}
                      onChange={(e) => setCfgHealthPath(e.target.value)}
                      placeholder="/health"
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 block">Compute Tier</label>
                    <select
                      value={cfgTier}
                      onChange={(e) => setCfgTier(e.target.value as typeof cfgTier)}
                      className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs"
                    >
                      <option value="starter" className="bg-[#090B11]">
                        Starter (1 vCPU / 1 GB RAM)
                      </option>
                      <option value="growth" className="bg-[#090B11]">
                        Growth (2 vCPU / 4 GB RAM)
                      </option>
                      <option value="scale" className="bg-[#090B11]">
                        Scale (4 vCPU / 8 GB RAM)
                      </option>
                    </select>
                  </div>
                </div>

                {/* GitHub Webhook Endpoint Info */}
                <div className="rounded-xl border border-white/[0.07] bg-[#06080E] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-zinc-300 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-400" />
                      <span>GitHub Push Webhook (HMAC-SHA256)</span>
                    </div>
                    <div className="spx-mono text-[11px] text-zinc-400 truncate">
                      https://deploy.{hostDomain}/api/webhooks/github
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText("wh-url", `https://deploy.${hostDomain}/api/webhooks/github`)
                    }
                    className="h-8 rounded-md spx-ghost-btn px-3 text-xs cursor-pointer"
                  >
                    Copy Webhook URL
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busyAction === "settings"}
                    className="h-9 rounded-lg spx-silver-btn px-4 text-xs font-semibold cursor-pointer"
                  >
                    {busyAction === "settings" ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-red-300">Danger Zone</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Permanently remove this project, its encrypted env vars, routes, and running
                    container.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyAction === "delete"}
                  onClick={() => void handleDeleteProject()}
                  className="h-9 rounded-lg border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-4 text-xs font-semibold text-red-200 cursor-pointer"
                >
                  Delete Project
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DeployAppShell>
  );
}
