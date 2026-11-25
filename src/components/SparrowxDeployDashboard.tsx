import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Globe,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { buildMasterHref } from "@/lib/routing";
import { SubdomainAuthChip } from "@/components/SubdomainAuthChip";

export type DeployFramework =
  | "nextjs"
  | "vite"
  | "tanstack"
  | "node"
  | "python"
  | "static"
  | "docker";

export type DeployTab = "overview" | "deployments" | "domains" | "env" | "settings";

export interface DeployEnvVar {
  id: string;
  key: string;
  value: string;
  target: "Production" | "Preview" | "Development";
}

export interface DeployProject {
  id: string;
  name: string;
  slug: string;
  repoUrl: string;
  branch: string;
  framework: DeployFramework;
  buildCommand: string;
  outputDir: string;
  rootDir: string;
  region: "Mumbai IN-1" | "Chennai IN-2" | "Singapore SG-1";
  status: "Ready" | "Building" | "Queued" | "Unreachable" | "Failed";
  commitSha?: string;
  livePath?: string;
  customDomain?: string;
  envVars: DeployEnvVar[];
  createdAt: string;
  lastDeployedAt: string;
  commitMessage: string;
  logs: string[];
}

const FRAMEWORK_PRESETS: Record<
  DeployFramework,
  { label: string; buildCommand: string; outputDir: string; badge: string }
> = {
  nextjs: {
    label: "Next.js",
    buildCommand: "npm run build",
    outputDir: ".next",
    badge: "SSR / Edge",
  },
  vite: {
    label: "Vite / React",
    buildCommand: "npm run build",
    outputDir: "dist",
    badge: "SPA / Static",
  },
  tanstack: {
    label: "TanStack Start",
    buildCommand: "npm run build",
    outputDir: ".output",
    badge: "Full-Stack",
  },
  node: {
    label: "Node.js / Express",
    buildCommand: "npm install",
    outputDir: ".",
    badge: "API / Bot",
  },
  python: {
    label: "Python / FastAPI",
    buildCommand: "pip install -r requirements.txt",
    outputDir: ".",
    badge: "ASGI / AI",
  },
  static: {
    label: "Static HTML / CSS",
    buildCommand: "",
    outputDir: ".",
    badge: "CDN Edge",
  },
  docker: {
    label: "Dockerfile",
    buildCommand: "docker build .",
    outputDir: ".",
    badge: "Container",
  },
};

function slugifyProjectName(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?(github|gitlab)\.com\/[^/]+\//i, "")
    .replace(/\.git$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "my-app";
}

export function SparrowxDeployDashboard() {
  const [activeTab, setActiveTab] = useState<DeployTab>("overview");
  const [projects, setProjects] = useState<DeployProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Import / New Project modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [branch, setBranch] = useState("main");
  const [framework, setFramework] = useState<DeployFramework>("nextjs");
  const [buildCommand, setBuildCommand] = useState(FRAMEWORK_PRESETS.nextjs.buildCommand);
  const [outputDir, setOutputDir] = useState(FRAMEWORK_PRESETS.nextjs.outputDir);
  const [rootDir, setRootDir] = useState("./");
  const [region, setRegion] = useState<DeployProject["region"]>("Mumbai IN-1");
  const [draftEnvKey, setDraftEnvKey] = useState("");
  const [draftEnvVal, setDraftEnvVal] = useState("");
  const [draftEnvVars, setDraftEnvVars] = useState<DeployEnvVar[]>([]);
  const [importError, setImportError] = useState("");

  // Domain & Env quick-add state
  const [newDomainInput, setNewDomainInput] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [newEnvTarget, setNewEnvTarget] = useState<DeployEnvVar["target"]>("Production");

  const fetchServerProjects = async () => {
    setLoadingProjects(true);
    setApiError("");
    try {
      const res = await fetch("/api/deploy/projects", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Server returned HTTP ${res.status}`);
      }
      const list = Array.isArray(data.projects) ? (data.projects as DeployProject[]) : [];
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0]!.id);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to reach deploy backend API.");
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    void fetchServerProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.repoUrl.toLowerCase().includes(q) ||
        FRAMEWORK_PRESETS[p.framework].label.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const handleFrameworkChange = (fw: DeployFramework) => {
    setFramework(fw);
    setBuildCommand(FRAMEWORK_PRESETS[fw].buildCommand);
    setOutputDir(FRAMEWORK_PRESETS[fw].outputDir);
  };

  const handleRepoUrlChange = (val: string) => {
    setRepoUrl(val);
    if (!projectName.trim()) {
      const derived = slugifyProjectName(val);
      if (derived && derived !== "my-app") {
        setProjectName(derived);
      }
    }
  };

  const handleAddDraftEnv = () => {
    const k = draftEnvKey.trim();
    if (!k) return;
    setDraftEnvVars((prev) => [
      ...prev,
      { id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: k, value: draftEnvVal, target: "Production" },
    ]);
    setDraftEnvKey("");
    setDraftEnvVal("");
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedRepo = repoUrl.trim();
    if (!cleanedRepo || !/^https?:\/\//i.test(cleanedRepo)) {
      setImportError("Enter a valid https:// Git repository URL (e.g. https://github.com/user/repo).");
      return;
    }
    setSubmitting(true);
    setImportError("");
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: projectName.trim() || slugifyProjectName(cleanedRepo),
          repoUrl: cleanedRepo,
          branch: branch.trim() || "main",
          framework,
          buildCommand,
          outputDir,
          rootDir: rootDir.trim() || "./",
          region,
          envVars: draftEnvVars.map((v) => ({ key: v.key, value: v.value, target: v.target })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project) {
        throw new Error(data?.error || `Deploy API failed (HTTP ${res.status})`);
      }
      const created = data.project as DeployProject;
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setShowNewModal(false);
      setRepoUrl("");
      setProjectName("");
      setDraftEnvVars([]);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to create deployment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeploy = async (projId: string) => {
    setApiError("");
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "redeploy", id: projId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project) {
        throw new Error(data?.error || "Redeploy failed");
      }
      const updated = data.project as DeployProject;
      setProjects((prev) => prev.map((p) => (p.id === projId ? updated : p)));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Redeploy request failed.");
    }
  };

  const handleDeleteProject = async (projId: string) => {
    setApiError("");
    try {
      const res = await fetch(`/api/deploy/projects?id=${encodeURIComponent(projId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Delete failed");
      }
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== projId);
        if (selectedProjectId === projId) {
          setSelectedProjectId(next[0]?.id ?? null);
        }
        return next;
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Delete request failed.");
    }
  };

  const handleAttachDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newDomainInput.trim()) return;
    setApiError("");
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "attach-domain",
          id: activeProject.id,
          domain: newDomainInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project) {
        throw new Error(data?.error || "Failed to attach domain");
      }
      const updated = data.project as DeployProject;
      setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? updated : p)));
      setNewDomainInput("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to attach domain.");
    }
  };

  const handleAddProjectEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newEnvKey.trim()) return;
    setApiError("");
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "add-env",
          id: activeProject.id,
          key: newEnvKey.trim(),
          value: newEnvVal,
          target: newEnvTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project) {
        throw new Error(data?.error || "Failed to save environment variable");
      }
      const updated = data.project as DeployProject;
      setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? updated : p)));
      setNewEnvKey("");
      setNewEnvVal("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save environment variable.");
    }
  };

  const handleRemoveProjectEnv = async (envId: string) => {
    if (!activeProject) return;
    setApiError("");
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "remove-env",
          id: activeProject.id,
          envId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project) {
        throw new Error(data?.error || "Failed to remove environment variable");
      }
      const updated = data.project as DeployProject;
      setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? updated : p)));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to remove environment variable.");
    }
  };

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#EDEDED] font-sans antialiased overflow-x-hidden flex flex-col">
      {/* Vercel-Style Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#222222] bg-[#000000]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <a
              href={buildMasterHref("/")}
              className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
              aria-label="SparrowX Home"
            >
              {/* Vercel-inspired clean geometric triangle mark */}
              <svg viewBox="0 0 24 24" className="size-6 fill-white" aria-hidden="true">
                <path d="M12 2L22 20H2L12 2Z" />
              </svg>
            </a>
            <span className="text-[#444444] text-lg font-light select-none">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                SparrowX Deploy
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-[#333333] bg-[#111111] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300">
                Cloud PaaS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SubdomainAuthChip nextPath="/deploy" />
            <a
              href={buildMasterHref("/docs")}
              className="hidden sm:inline-flex min-h-[36px] items-center rounded-md border border-[#262626] bg-transparent hover:bg-[#141414] px-3 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href={buildMasterHref("/")}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <span>Portal</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-white hover:bg-zinc-200 text-black px-3.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Add New</span>
            </button>
          </div>
        </div>

        {/* Vercel-Style Sub-Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <nav aria-label="Deploy Dashboard Sections" className="flex items-center gap-1 -mb-px">
            {(
              [
                { id: "overview", label: "Overview", icon: LayoutGrid },
                { id: "deployments", label: "Deployments", icon: Rocket },
                { id: "domains", label: "Domains", icon: Globe },
                { id: "env", label: "Environment Variables", icon: KeyRound },
                { id: "settings", label: "Settings", icon: Settings },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "border-white text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {apiError && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300 flex items-center justify-between gap-3">
            <span>{apiError}</span>
            <button
              type="button"
              onClick={() => void fetchServerProjects()}
              className="rounded-md border border-red-400/40 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-500/20 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Search + View Toggle + New Project Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Repositories and Projects..."
                  className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#0A0A0A] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#262626] bg-[#0A0A0A] p-1">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                    className={`min-h-[36px] min-w-[36px] grid place-items-center rounded-md transition-colors cursor-pointer ${
                      viewMode === "grid" ? "bg-[#222222] text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                    className={`min-h-[36px] min-w-[36px] grid place-items-center rounded-md transition-colors cursor-pointer ${
                      viewMode === "list" ? "bg-[#222222] text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <List className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-white hover:bg-zinc-200 text-black px-4 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span>Add New...</span>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Overview Two-Column Layout (Usage Sidebar + Projects Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Sidebar: Usage & Edge Regions */}
              <aside className="lg:col-span-4 space-y-4">
                <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Edge Network</h2>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]">
                      <span className="text-zinc-400">Active Web Apps</span>
                      <span className="font-mono font-semibold text-white">{projects.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]">
                      <span className="text-zinc-400">Auto-SSL Namespace</span>
                      <span className="font-mono text-zinc-200">*.deploy.sparrowx.net</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]">
                      <span className="text-zinc-400">DDoS Shield</span>
                      <span className="font-mono text-emerald-400">SparrowX NetSec</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400">Regions</span>
                      <span className="font-mono text-zinc-200">BOM · MAA · SIN</span>
                    </div>
                  </div>
                </div>

                {/* Quick Framework Templates */}
                <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-white">Deploy a Web App</h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Import any Git repository to deploy Next.js, Vite, React, Node.js APIs, or Python apps with instant HTTPS.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {(["nextjs", "vite", "tanstack", "node", "python", "docker"] as const).map((fw) => (
                      <button
                        key={fw}
                        type="button"
                        onClick={() => {
                          handleFrameworkChange(fw);
                          setShowNewModal(true);
                        }}
                        className="min-h-[42px] rounded-lg border border-[#222222] bg-[#050505] hover:border-zinc-500 px-3 py-2 text-left transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-white">
                          {FRAMEWORK_PRESETS[fw].label}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {FRAMEWORK_PRESETS[fw].badge}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Right Main Area: Projects Grid / Empty State */}
              <div className="lg:col-span-8">
                {filteredProjects.length === 0 ? (
                  <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-8 sm:p-12 text-center space-y-5">
                    <div className="mx-auto size-12 rounded-xl border border-[#262626] bg-[#111111] grid place-items-center text-white">
                      <FolderGit2 className="size-6" aria-hidden="true" />
                    </div>
                    <div className="space-y-2 max-w-md mx-auto">
                      <h2 className="text-xl font-bold tracking-tight text-white">
                        {projects.length === 0
                          ? "Let's deploy your first web app"
                          : "No matching projects found"}
                      </h2>
                      <p className="text-sm text-zinc-400">
                        Import a Git repository to build and publish your web application directly to{" "}
                        <code className="font-mono text-zinc-200">*.deploy.sparrowx.net</code> with automatic Let&apos;s Encrypt SSL.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewModal(true)}
                        className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-200 text-black px-5 text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        <span>Import Git Repository</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === "grid"
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                        : "space-y-3"
                    }
                  >
                    {filteredProjects.map((proj) => {
                      const liveUrl = proj.customDomain
                        ? `https://${proj.customDomain}`
                        : proj.livePath || `https://${proj.slug}.deploy.sparrowx.net`;
                      const isFailed = proj.status === "Failed" || proj.status === "Unreachable";
                      return (
                        <article
                          key={proj.id}
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`group rounded-xl border bg-[#0A0A0A] p-5 transition-all cursor-pointer ${
                            activeProject?.id === proj.id
                              ? "border-zinc-500"
                              : "border-[#222222] hover:border-[#3A3A3A]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded-lg border border-[#262626] bg-[#111111] grid place-items-center text-white shrink-0">
                                <Code2 className="size-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">
                                  {proj.name}
                                </h3>
                                <a
                                  href={liveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white truncate max-w-full"
                                >
                                  <span className="truncate">
                                    {proj.customDomain || `${proj.slug}.deploy.sparrowx.net`}
                                  </span>
                                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                                </a>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${
                                isFailed
                                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  isFailed ? "bg-red-400" : "bg-emerald-400"
                                }`}
                              />
                              {proj.status}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#222222] bg-[#111111] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                              <GitBranch className="size-3" aria-hidden="true" />
                              {proj.branch}
                            </span>
                            <span className="inline-flex items-center rounded-md border border-[#222222] bg-[#111111] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                              {FRAMEWORK_PRESETS[proj.framework].label}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {proj.region}
                            </span>
                          </div>

                          <p className="mt-3 text-xs text-zinc-400 truncate">
                            {proj.commitMessage}
                          </p>

                          <div className="mt-4 pt-3 border-t border-[#1A1A1A] flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                              <Clock className="size-3" aria-hidden="true" />
                              {new Date(proj.lastDeployedAt).toLocaleDateString()}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRedeploy(proj.id);
                                }}
                                className="min-h-[32px] inline-flex items-center gap-1 rounded-md border border-[#262626] bg-[#111111] hover:bg-[#1E1E1E] px-2.5 text-[11px] font-medium text-zinc-200 cursor-pointer"
                              >
                                <RefreshCw className="size-3" aria-hidden="true" />
                                <span>Redeploy</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProjectId(proj.id);
                                  setActiveTab("deployments");
                                }}
                                className="min-h-[32px] inline-flex items-center gap-1 rounded-md border border-[#262626] bg-[#111111] hover:bg-[#1E1E1E] px-2.5 text-[11px] font-medium text-zinc-200 cursor-pointer"
                              >
                                <Terminal className="size-3" aria-hidden="true" />
                                <span>Logs</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${proj.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(proj.id);
                                }}
                                className="min-h-[32px] min-w-[32px] grid place-items-center rounded-md border border-[#262626] bg-[#111111] hover:border-red-500/40 hover:text-red-400 text-zinc-400 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DEPLOYMENTS & BUILD LOGS TAB */}
        {activeTab === "deployments" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-white">Deployments &amp; Build Logs</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Inspect live build pipelines, commit revisions, and instant rollback controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-200 text-black px-4 text-sm font-semibold cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>New Deployment</span>
              </button>
            </div>

            {!activeProject ? (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-10 text-center text-sm text-zinc-400">
                No deployments yet. Click <strong className="text-white">New Deployment</strong> to import a repository.
              </div>
            ) : (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#1E1E1E] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{activeProject.name}</h2>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                        {activeProject.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">
                      https://{activeProject.customDomain || `${activeProject.slug}.deploy.sparrowx.net`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRedeploy(activeProject.id)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#111111] hover:bg-[#1A1A1A] px-3.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    <span>Redeploy</span>
                  </button>
                </div>
                <div className="p-4 sm:p-5 bg-[#050505] font-mono text-xs text-zinc-300 space-y-1.5 overflow-x-auto">
                  {activeProject.logs.map((line, i) => (
                    <div key={`${activeProject.id}-log-${i}`} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DOMAINS TAB */}
        {activeTab === "domains" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-white">Domains &amp; Automatic SSL</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Every project gets an automatic <code className="font-mono text-zinc-200">*.deploy.sparrowx.net</code> domain plus zero-config custom domain TLS.
              </p>
            </div>

            {!activeProject ? (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-8 text-sm text-zinc-400">
                Create or select a project first to attach custom domains.
              </div>
            ) : (
              <div className="space-y-4">
                <form
                  onSubmit={handleAttachDomain}
                  className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    value={newDomainInput}
                    onChange={(e) => setNewDomainInput(e.target.value)}
                    placeholder="app.yourdomain.com"
                    className="flex-1 min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-lg bg-white hover:bg-zinc-200 text-black px-5 text-sm font-semibold cursor-pointer"
                  >
                    Add Domain
                  </button>
                </form>

                <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] divide-y divide-[#1A1A1A]">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-mono font-semibold text-white">
                        {activeProject.slug}.deploy.sparrowx.net
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">Default Production Domain · Auto TLS</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText("default-dom", `https://${activeProject.slug}.deploy.sparrowx.net`)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md border border-[#262626] px-3 text-xs text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {copiedId === "default-dom" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      <span>{copiedId === "default-dom" ? "Copied" : "Copy URL"}</span>
                    </button>
                  </div>

                  {activeProject.customDomain && (
                    <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-mono font-semibold text-white">
                          {activeProject.customDomain}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          Point CNAME record to <code className="font-mono text-zinc-200">deploy.sparrowx.net</code>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                        <ShieldCheck className="size-3.5" />
                        TLS Ready
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ENVIRONMENT VARIABLES TAB */}
        {activeTab === "env" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-white">Environment Variables</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Encrypted secrets injected at build and runtime for your selected web app.
              </p>
            </div>

            {!activeProject ? (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-8 text-sm text-zinc-400">
                Create or select a project first to manage environment variables.
              </div>
            ) : (
              <div className="space-y-4">
                <form
                  onSubmit={handleAddProjectEnv}
                  className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 grid grid-cols-1 sm:grid-cols-12 gap-3"
                >
                  <input
                    type="text"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="DATABASE_URL"
                    className="sm:col-span-4 min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={newEnvVal}
                    onChange={(e) => setNewEnvVal(e.target.value)}
                    placeholder="Secret value"
                    className="sm:col-span-4 min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  <select
                    value={newEnvTarget}
                    onChange={(e) => setNewEnvTarget(e.target.value as DeployEnvVar["target"])}
                    className="sm:col-span-2 min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-2.5 text-xs text-white focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="Production">Production</option>
                    <option value="Preview">Preview</option>
                    <option value="Development">Development</option>
                  </select>
                  <button
                    type="submit"
                    className="sm:col-span-2 min-h-[44px] rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </form>

                <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] divide-y divide-[#1A1A1A]">
                  {activeProject.envVars.length === 0 ? (
                    <div className="p-6 text-xs text-zinc-500 text-center">
                      No environment variables added for {activeProject.name}.
                    </div>
                  ) : (
                    activeProject.envVars.map((env) => (
                      <div key={env.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-semibold text-white truncate">
                            {env.key}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                            •••••••••••• · {env.target}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProjectEnv(env.id)}
                          className="min-h-[36px] min-w-[36px] grid place-items-center rounded-md border border-[#262626] text-zinc-400 hover:text-red-400 hover:border-red-500/40 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-white">Build &amp; Project Settings</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Framework preset, root directory, and deployment region configuration.
              </p>
            </div>

            {!activeProject ? (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-8 text-sm text-zinc-400">
                Create or select a project first to inspect build settings.
              </div>
            ) : (
              <div className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-6 space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500">Framework Preset</div>
                    <div className="font-mono text-white mt-1">
                      {FRAMEWORK_PRESETS[activeProject.framework].label}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Edge Region</div>
                    <div className="font-mono text-white mt-1">{activeProject.region}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Build Command</div>
                    <div className="font-mono text-white mt-1">
                      {activeProject.buildCommand || "(none)"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Output Directory</div>
                    <div className="font-mono text-white mt-1">{activeProject.outputDir}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* IMPORT GIT REPOSITORY / NEW PROJECT MODAL */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-project-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#262626] bg-[#0A0A0A] shadow-2xl overflow-hidden my-auto">
            <div className="px-5 py-4 border-b border-[#1E1E1E] flex items-center justify-between">
              <h2 id="import-project-title" className="text-base font-bold text-white">
                Import Git Repository
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowNewModal(false)}
                className="min-h-[36px] min-w-[36px] grid place-items-center rounded-md text-zinc-400 hover:text-white hover:bg-[#1A1A1A] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-4">
              {importError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {importError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">
                  Git Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => handleRepoUrlChange(e.target.value)}
                  placeholder="https://github.com/username/my-web-app"
                  className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-web-app"
                    className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Framework Preset
                  </label>
                  <select
                    value={framework}
                    onChange={(e) => handleFrameworkChange(e.target.value as DeployFramework)}
                    className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  >
                    {Object.entries(FRAMEWORK_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} ({v.badge})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">Build Command</label>
                  <input
                    type="text"
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">Region</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as DeployProject["region"])}
                    className="w-full min-h-[44px] rounded-lg border border-[#262626] bg-[#050505] px-2.5 text-xs text-white focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="Mumbai IN-1">Mumbai IN-1</option>
                    <option value="Chennai IN-2">Chennai IN-2</option>
                    <option value="Singapore SG-1">Singapore SG-1</option>
                  </select>
                </div>
              </div>

              {/* Optional Env Vars before deploy */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-zinc-300 block">
                  Environment Variables (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draftEnvKey}
                    onChange={(e) => setDraftEnvKey(e.target.value)}
                    placeholder="KEY"
                    className="flex-1 min-h-[40px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white"
                  />
                  <input
                    type="text"
                    value={draftEnvVal}
                    onChange={(e) => setDraftEnvVal(e.target.value)}
                    placeholder="VALUE"
                    className="flex-1 min-h-[40px] rounded-lg border border-[#262626] bg-[#050505] px-3 text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftEnv}
                    className="min-h-[40px] rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1E1E1E] px-3 text-xs font-medium text-white cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                {draftEnvVars.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draftEnvVars.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 rounded border border-[#262626] bg-[#141414] px-2 py-0.5 text-[11px] font-mono text-zinc-300"
                      >
                        {v.key}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#1E1E1E]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="min-h-[44px] rounded-lg border border-[#262626] px-4 text-sm font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-60 text-black px-5 text-sm font-semibold cursor-pointer"
                >
                  <Rocket className="size-4" aria-hidden="true" />
                  <span>{submitting ? "Verifying & Deploying..." : "Deploy"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
