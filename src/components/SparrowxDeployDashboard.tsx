import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  ExternalLink,
  GitBranch,
  Globe,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import {
  formatRelativeTime,
  FrameworkIcon,
  STARTER_TEMPLATES,
  StatusBadge,
  useDeploySession,
} from "@/components/deploy/deploy-ui";

export interface DeployProjectSummary {
  id: string;
  name: string;
  slug: string;
  repoUrl: string;
  branch: string;
  framework: string;
  buildMethod: "railpack" | "dockerfile";
  region: string;
  tier: string;
  status: string;
  commitSha?: string | null;
  commitMessage: string;
  customDomain?: string | null;
  livePath?: string | null;
  lastDeployedAt: string;
  latestCpuPct?: number;
  latestMemoryMb?: number;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  plan: string;
  projectLimit: number;
  projectsUsed: number;
  remainingSlots: number;
  monthlyTransferLimitGb: number;
  monthlyTransferUsedGb: number;
}

interface GithubRepoItem {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
  updatedAt: string;
}

export function SparrowxDeployDashboard() {
  const { user, checking, networkError } = useDeploySession(true);
  const [projects, setProjects] = useState<DeployProjectSummary[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [hostDomain, setHostDomain] = useState("sparrowx.net");
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepoItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "building" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [redeployingId, setRedeployingId] = useState<string | null>(null);

  const loadWorkspace = async () => {
    setLoading(true);
    setApiWarning(null);
    try {
      const res = await fetch("/api/deploy/projects", { credentials: "include" });
      if (res.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent("/deploy")}`);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      if (data.workspace) setWorkspace(data.workspace);
      if (data.hostDomain) setHostDomain(data.hostDomain);
      setGithubConnected(Boolean(data.githubConnected));
      setGithubUsername(data.githubUsername ?? null);

      if (data.githubConnected && (!data.projects || data.projects.length === 0)) {
        const ghRes = await fetch("/api/deploy/github/repos", { credentials: "include" }).catch(
          () => null,
        );
        if (ghRes && ghRes.ok) {
          const ghData = await ghRes.json();
          if (Array.isArray(ghData.repos)) setGithubRepos(ghData.repos);
        }
      }
    } catch (err) {
      setApiWarning(
        err instanceof Error ? err.message : "Temporary control-plane connection issue.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadWorkspace();
    }
  }, [user]);

  const handleQuickRedeploy = async (projectId: string) => {
    setRedeployingId(projectId);
    try {
      const res = await fetch(`/api/deploy/projects/${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "redeploy" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to queue redeploy");
      }
      toast.success("Redeploy queued — opening live build logs.");
      await loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redeploy failed");
    } finally {
      setRedeployingId(null);
    }
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const s = p.status.toLowerCase();
      if (statusFilter === "live" && s !== "ready" && s !== "live") return false;
      if (statusFilter === "building" && s !== "building" && s !== "queued") return false;
      if (statusFilter === "failed" && s !== "failed") return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.branch.toLowerCase().includes(q) ||
        (p.customDomain || "").toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery, statusFilter]);

  const filteredGithubRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return githubRepos.slice(0, 6);
    return githubRepos.filter((r) => r.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [githubRepos, repoSearch]);

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-xs spx-mono text-zinc-400">
          <span className="size-2 rounded-full bg-zinc-300 animate-pulse" />
          <span>{networkError || "Verifying SparrowX session..."}</span>
        </div>
      </div>
    );
  }

  const liveCount = projects.filter(
    (p) => p.status.toLowerCase() === "ready" || p.status.toLowerCase() === "live",
  ).length;
  const stoppedCount = projects.length - liveCount;
  const transferUsed = workspace?.monthlyTransferUsedGb ?? 0;
  const transferLimit = workspace?.monthlyTransferLimitGb ?? 100;
  const transferPct = Math.min(100, Math.round((transferUsed / Math.max(1, transferLimit)) * 100));

  return (
    <DeployAppShell
      user={user}
      activeNav="overview"
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
      }))}
      onQuickRedeploy={handleQuickRedeploy}
    >
      <div className="space-y-6">
        {/* Non-destructive network / 503 status bar */}
        {(apiWarning || networkError) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-3">
            <span>{apiWarning || networkError}</span>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="rounded-md border border-amber-400/30 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/15 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Action Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Overview
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Git-to-live web applications &amp; containers on OVH Mumbai Edge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Pills */}
            <div className="inline-flex rounded-lg border border-white/[0.07] bg-[#090B11] p-0.5 text-xs">
              {(["all", "live", "building", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1.5 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                    statusFilter === f
                      ? "bg-white/[0.1] text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Grid / List Toggle */}
            <div className="inline-flex rounded-lg border border-white/[0.07] bg-[#090B11] p-0.5">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={`size-8 rounded-md grid place-items-center transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white/[0.1] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={`size-8 rounded-md grid place-items-center transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white/[0.1] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <List className="size-3.5" />
              </button>
            </div>

            <a
              href="/deploy/new"
              className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>New Project</span>
            </a>
          </div>
        </div>

        {/* 4 Compact Inline Telemetry KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="rounded-xl spx-obsidian-card p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Active Deployments</span>
              <Rocket className="size-3.5 text-zinc-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
                {projects.length}
                <span className="text-xs font-normal text-zinc-500 ml-1">
                  / {workspace?.projectLimit ?? 3}
                </span>
              </span>
              <span className="text-[11px] spx-mono text-zinc-400 tabular-nums">
                <span className="text-emerald-400">{liveCount} live</span> · {stoppedCount} idle
              </span>
            </div>
          </div>

          <div className="rounded-xl spx-obsidian-card p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Auto-SSL Namespace</span>
              <Globe className="size-3.5 text-zinc-500" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold spx-mono text-zinc-100 truncate">
                *.deploy.{hostDomain}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] spx-mono text-emerald-400 shrink-0">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                TLS Active
              </span>
            </div>
          </div>

          <div className="rounded-xl spx-obsidian-card p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>DDoS Shield</span>
              <ShieldCheck className="size-3.5 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">SparrowX NetSec</span>
              <span className="text-[10px] spx-mono text-sky-400">OVH BOM Edge</span>
            </div>
          </div>

          <div className="rounded-xl spx-obsidian-card p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Monthly Bandwidth</span>
              <Activity className="size-3.5 text-sky-400" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="font-semibold text-white spx-mono">
                  {transferUsed.toFixed(2)} GB
                </span>
                <span className="text-zinc-500 spx-mono">/ {transferLimit} GB</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                  style={{ width: `${Math.max(4, transferPct)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Search Input when projects exist */}
        {projects.length > 0 && (
          <div className="relative">
            <Search className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter projects by name, subdomain, or branch..."
              className="w-full h-10 rounded-lg spx-obsidian-input pl-10 pr-4 text-xs sm:text-sm"
            />
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 rounded-xl spx-obsidian-card p-5 animate-pulse space-y-4"
              >
                <div className="h-5 w-1/2 rounded bg-white/[0.06]" />
                <div className="h-3.5 w-2/3 rounded bg-white/[0.04]" />
                <div className="h-10 w-full rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* High-Craft Empty State Onboarding Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: GitHub Repo Importer */}
            <div className="lg:col-span-6 rounded-2xl spx-obsidian-card p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-white">
                      Import Git Repository
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Connect GitHub for 1-click deploys and automatic push webhooks.
                    </p>
                  </div>
                  {githubConnected && githubUsername && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] spx-mono text-emerald-300">
                      @{githubUsername}
                    </span>
                  )}
                </div>

                {!githubConnected ? (
                  <div className="rounded-xl border border-white/[0.07] bg-[#06080E] p-6 text-center space-y-4">
                    <div className="mx-auto size-11 rounded-xl border border-white/10 bg-white/[0.04] grid place-items-center text-zinc-200">
                      <GitBranch className="size-5" />
                    </div>
                    <div className="space-y-1 max-w-xs mx-auto">
                      <div className="text-sm font-semibold text-white">Connect your GitHub</div>
                      <p className="text-xs text-zinc-400">
                        Import public or private repositories with automatic framework detection and
                        zero-downtime blue-green rollouts.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <a
                        href="/api/auth/github/login?scope=repo&next=%2Fdeploy"
                        className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-2 px-4 text-xs font-semibold"
                      >
                        <span>Connect GitHub</span>
                        <ArrowRight className="size-3.5" />
                      </a>
                      <a
                        href="/deploy/new"
                        className="h-9 rounded-lg spx-ghost-btn inline-flex items-center gap-1.5 px-3.5 text-xs font-medium"
                      >
                        <span>Paste Public Git URL</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Search your GitHub repositories..."
                        className="w-full h-9 rounded-lg spx-obsidian-input pl-8 pr-3 text-xs"
                      />
                    </div>
                    <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#06080E] overflow-hidden">
                      {filteredGithubRepos.length === 0 ? (
                        <div className="p-6 text-center text-xs text-zinc-500">
                          No repositories found.{" "}
                          <a href="/deploy/new" className="text-zinc-200 underline">
                            Import by URL
                          </a>
                        </div>
                      ) : (
                        filteredGithubRepos.map((repo) => (
                          <div
                            key={repo.id}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                {repo.fullName}
                              </div>
                              <div className="text-[10px] spx-mono text-zinc-500">
                                {repo.defaultBranch} · {repo.language || "Git"}
                              </div>
                            </div>
                            <a
                              href={`/deploy/new?repo=${encodeURIComponent(repo.htmlUrl)}&branch=${encodeURIComponent(repo.defaultBranch)}`}
                              className="h-7 rounded-md spx-silver-btn inline-flex items-center px-2.5 text-[11px] font-semibold shrink-0"
                            >
                              Import
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-zinc-400">
                <span>Free Starter Tier includes up to 3 projects</span>
                <a href="/deploy/new" className="text-zinc-200 hover:text-white spx-mono">
                  Custom Git URL →
                </a>
              </div>
            </div>

            {/* Right: 1-Click Starter Templates with real SVG icons */}
            <div className="lg:col-span-6 rounded-2xl spx-obsidian-card p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  1-Click Starter Templates
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Launch a pre-configured Railpack or BuildKit stack in seconds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_TEMPLATES.map((tpl) => (
                  <a
                    key={tpl.id}
                    href={`/deploy/new?template=${encodeURIComponent(tpl.id)}`}
                    className="group rounded-xl border border-white/[0.07] bg-[#06080E] hover:bg-[#10131C] hover:border-white/[0.15] p-3.5 flex items-start gap-3 transition-all"
                  >
                    <div className="size-9 rounded-lg border border-white/10 bg-[#090B11] grid place-items-center shrink-0">
                      <FrameworkIcon framework={tpl.framework} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] spx-mono text-zinc-500 shrink-0">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Populated Projects Grid / List */
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                : "space-y-3"
            }
          >
            {filteredProjects.map((proj) => {
              const liveUrl = proj.customDomain
                ? `https://${proj.customDomain}`
                : `https://${proj.slug}.deploy.${hostDomain}`;
              return (
                <article
                  key={proj.id}
                  onClick={() => {
                    window.location.href = `/projects/${proj.id}`;
                  }}
                  className="rounded-xl spx-obsidian-card spx-obsidian-card-hover p-5 cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-lg border border-white/10 bg-[#06080E] grid place-items-center shrink-0">
                          <FrameworkIcon framework={proj.framework} className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{proj.name}</h3>
                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] spx-mono text-zinc-400 hover:text-white truncate max-w-full"
                          >
                            <span className="truncate">
                              {proj.customDomain || `${proj.slug}.deploy.${hostDomain}`}
                            </span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        </div>
                      </div>
                      <StatusBadge status={proj.status} />
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#06080E] px-3 py-2 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] spx-mono text-zinc-300">
                        <GitBranch className="size-3 text-zinc-500 shrink-0" />
                        <span>{proj.branch}</span>
                        {proj.commitSha && (
                          <span className="text-sky-400">{proj.commitSha.slice(0, 7)}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">{proj.commitMessage}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] spx-mono text-zinc-400 tabular-nums">
                      <span className="inline-flex items-center gap-1 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-0.5">
                        <Cpu className="size-3 text-zinc-500" />
                        {proj.latestCpuPct ?? 0}% CPU
                      </span>
                      <span className="inline-flex items-center gap-1 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-0.5">
                        <HardDrive className="size-3 text-zinc-500" />
                        {proj.latestMemoryMb ?? 0} MB RAM
                      </span>
                      <span className="rounded border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 uppercase">
                        {proj.buildMethod}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 tabular-nums">
                      <Clock className="size-3" />
                      {formatRelativeTime(proj.lastDeployedAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={redeployingId === proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleQuickRedeploy(proj.id);
                        }}
                        className="h-7 rounded-md spx-ghost-btn inline-flex items-center gap-1 px-2.5 text-[11px] font-medium cursor-pointer"
                      >
                        <RefreshCw
                          className={`size-3 ${redeployingId === proj.id ? "animate-spin" : ""}`}
                        />
                        <span>Redeploy</span>
                      </button>
                      <a
                        href={`/projects/${proj.id}?tab=logs`}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 rounded-md spx-ghost-btn inline-flex items-center gap-1 px-2.5 text-[11px] font-medium"
                      >
                        <Terminal className="size-3 text-sky-400" />
                        <span>Logs</span>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DeployAppShell>
  );
}
