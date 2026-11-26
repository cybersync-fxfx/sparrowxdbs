import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  GitBranch,
  KeyRound,
  Plus,
  Rocket,
  Search,
  Server,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import {
  FrameworkIcon,
  STARTER_TEMPLATES,
  useDeploySession,
  type DeployFrameworkId,
} from "@/components/deploy/deploy-ui";

export const Route = createFileRoute("/deploy/new")({
  head: () => ({
    meta: [{ title: "New Project — SparrowX Deploy" }],
  }),
  component: NewDeployProjectPage,
});

const TIER_OPTIONS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "₹0 / mo",
    specs: "1 vCPU · 1 GB RAM · 100 Mbps · 100 GB/mo",
    note: "Up to 3 projects free",
  },
  {
    id: "growth" as const,
    name: "Growth",
    price: "₹799 / mo",
    specs: "2 vCPU · 4 GB RAM · 200 Mbps · 500 GB/mo",
    note: "Production web apps",
  },
  {
    id: "scale" as const,
    name: "Scale",
    price: "₹1,999 / mo",
    specs: "4 vCPU · 8 GB RAM · 300 Mbps · 2 TB/mo",
    note: "High-concurrency APAC workloads",
  },
];

interface DraftEnv {
  id: string;
  key: string;
  value: string;
  target: "Production" | "Preview" | "Development";
}

interface GithubRepoItem {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
}

function slugifyName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?(github|gitlab)\.com\/[^/]+\//i, "")
      .replace(/\.git$/i, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "my-app"
  );
}

function NewDeployProjectPage() {
  const { user, checking } = useDeploySession(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Source
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GithubRepoItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [rootDir, setRootDir] = useState("./");
  const [detecting, setDetecting] = useState(false);

  // Step 2: Build & Compute
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [framework, setFramework] = useState<DeployFrameworkId>("nextjs");
  const [buildMethod, setBuildMethod] = useState<"railpack" | "dockerfile">("railpack");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [startCommand, setStartCommand] = useState("npm run start");
  const [outputDir, setOutputDir] = useState(".next");
  const [port, setPort] = useState(3000);
  const [region, setRegion] = useState<"Mumbai IN-1" | "Chennai IN-2" | "Singapore SG-1">(
    "Mumbai IN-1",
  );
  const [tier, setTier] = useState<"starter" | "growth" | "scale">("starter");
  const [attachManagedPostgres, setAttachManagedPostgres] = useState(false);

  // Step 3: Env Vars
  const [envVars, setEnvVars] = useState<DraftEnv[]>([]);
  const [envKey, setEnvKey] = useState("");
  const [envVal, setEnvVal] = useState("");
  const [envTarget, setEnvTarget] = useState<DraftEnv["target"]>("Production");
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    // Hydrate from URL params (?template=... or ?repo=...)
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tplId = sp.get("template");
      const qRepo = sp.get("repo");
      const qBranch = sp.get("branch");
      if (tplId) {
        const tpl = STARTER_TEMPLATES.find((t) => t.id === tplId);
        if (tpl) {
          setRepoUrl(tpl.repoUrl);
          setBranch(tpl.branch);
          setName(tpl.id);
          setSlug(slugifyName(tpl.id));
          setFramework(tpl.framework);
          setBuildMethod(tpl.framework === "docker" ? "dockerfile" : "railpack");
          setBuildCommand(tpl.buildCommand);
          setStartCommand(tpl.startCommand);
          setOutputDir(tpl.outputDir);
          setPort(tpl.port);
          setStep(2);
        }
      } else if (qRepo) {
        setRepoUrl(qRepo);
        if (qBranch) setBranch(qBranch);
        const derived = slugifyName(qRepo);
        setName(derived);
        setSlug(derived);
        setStep(2);
      }
    }

    void fetch("/api/deploy/github/repos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setGithubConnected(Boolean(d.connected));
          if (Array.isArray(d.repos)) setGithubRepos(d.repos);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      void fetch(`/api/deploy/projects?checkSlug=${encodeURIComponent(slug)}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.available === "boolean") setSlugAvailable(d.available);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [slug]);

  const detectRepoFramework = async (urlValue: string) => {
    const match = urlValue.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git|\/|$)/i);
    if (!match || !match[1]) return;
    setDetecting(true);
    try {
      const res = await fetch(`/api/deploy/github/repos?detect=${encodeURIComponent(match[1])}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data?.ok && data.detected) {
        setFramework(data.detected.framework);
        setBuildMethod(data.detected.buildMethod);
        setBuildCommand(data.detected.buildCommand);
        setStartCommand(data.detected.startCommand);
        setOutputDir(data.detected.outputDir);
        setPort(data.detected.port);
      }
    } catch {
      // keep manual defaults
    } finally {
      setDetecting(false);
    }
  };

  const selectGithubRepo = (repo: GithubRepoItem) => {
    setRepoUrl(repo.htmlUrl);
    setBranch(repo.defaultBranch || "main");
    setName(repo.name);
    setSlug(slugifyName(repo.name));
    void detectRepoFramework(repo.htmlUrl);
    setStep(2);
  };

  const handleParseBulkEnv = () => {
    const lines = bulkEnvText.split(/\r?\n/);
    const added: DraftEnv[] = [];
    for (const raw of lines) {
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
        added.push({
          id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          key: k,
          value: v,
          target: envTarget,
        });
      }
    }
    if (added.length === 0) {
      toast.error("No valid KEY=VALUE pairs detected.");
      return;
    }
    setEnvVars((prev) => [...prev, ...added]);
    setBulkEnvText("");
    toast.success(`Parsed ${added.length} environment variable(s).`);
  };

  const handleAddSingleEnv = () => {
    const k = envKey.trim();
    if (!k) return;
    setEnvVars((prev) => [
      ...prev,
      { id: `env_${Date.now()}`, key: k, value: envVal, target: envTarget },
    ]);
    setEnvKey("");
    setEnvVal("");
  };

  const handleLaunchDeploy = async () => {
    setError("");
    if (!repoUrl.trim().startsWith("https://")) {
      setError("Enter a valid https:// Git repository URL in Step 1.");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/deploy/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || slugifyName(repoUrl),
          slug: slug.trim() || slugifyName(name || repoUrl),
          repoUrl: repoUrl.trim(),
          branch: branch.trim() || "main",
          rootDir: rootDir.trim() || "./",
          framework,
          buildMethod,
          buildCommand,
          startCommand,
          outputDir,
          port,
          region,
          tier,
          attachManagedPostgres,
          envVars: envVars.map((v) => ({ key: v.key, value: v.value, target: v.target })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data.project?.id) {
        throw new Error(data?.error || `Deployment failed (HTTP ${res.status})`);
      }
      toast.success("Build enqueued — streaming live deployment logs.");
      window.location.href = `/projects/${data.project.id}?tab=logs`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to launch deployment.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-xs spx-mono text-zinc-400">
        Verifying session...
      </div>
    );
  }

  return (
    <DeployAppShell user={user} activeNav="overview" breadcrumbProject="New Project">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <a
              href="/deploy"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Overview</span>
            </a>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Import &amp; Deploy Web App
            </h1>
          </div>

          {/* 3-Step Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {[
              { n: 1 as const, label: "Source" },
              { n: 2 as const, label: "Build & Compute" },
              { n: 3 as const, label: "Secrets & Launch" },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-colors cursor-pointer ${
                  step === s.n
                    ? "border-white/20 bg-white/[0.08] text-white font-medium"
                    : step > s.n
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/[0.06] text-zinc-500"
                }`}
              >
                <span className="spx-mono text-[10px]">
                  {step > s.n ? <Check className="size-3" /> : `0${s.n}`}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* STEP 1 — SOURCE */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-2xl spx-obsidian-card p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">1. Select Git Repository</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Pick a connected GitHub repo or paste any public HTTPS Git URL.
                  </p>
                </div>
                {!githubConnected && (
                  <a
                    href="/api/auth/github/login?scope=repo&next=%2Fdeploy%2Fnew"
                    className="h-8 rounded-lg spx-ghost-btn inline-flex items-center gap-1.5 px-3 text-xs"
                  >
                    <GitBranch className="size-3.5" />
                    <span>Connect GitHub</span>
                  </a>
                )}
              </div>

              {githubConnected && githubRepos.length > 0 && (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Filter GitHub repositories..."
                      className="w-full h-9 rounded-lg spx-obsidian-input pl-8 pr-3 text-xs"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#06080E]">
                    {githubRepos
                      .filter((r) =>
                        r.fullName.toLowerCase().includes(repoSearch.trim().toLowerCase()),
                      )
                      .map((repo) => (
                        <div
                          key={repo.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {repo.fullName}
                            </div>
                            <div className="text-[10px] spx-mono text-zinc-500">
                              {repo.defaultBranch} · {repo.isPrivate ? "Private" : "Public"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectGithubRepo(repo)}
                            className="h-7 rounded-md spx-silver-btn px-2.5 text-[11px] font-semibold cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-6 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Git Repository URL (HTTPS)
                  </label>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRepoUrl(v);
                      if (!name) {
                        const d = slugifyName(v);
                        setName(d);
                        setSlug(d);
                      }
                    }}
                    placeholder="https://github.com/username/project"
                    className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Root Dir (Monorepo)
                  </label>
                  <input
                    type="text"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                    placeholder="./"
                    className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!repoUrl.trim().startsWith("https://")) {
                      toast.error("Enter a valid https:// Git URL first.");
                      return;
                    }
                    if (!name) setName(slugifyName(repoUrl));
                    if (!slug) setSlug(slugifyName(repoUrl));
                    void detectRepoFramework(repoUrl);
                    setStep(2);
                  }}
                  className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-2 px-4 text-xs font-semibold cursor-pointer"
                >
                  <span>{detecting ? "Detecting Framework..." : "Continue to Build Config"}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — BUILD & COMPUTE CONFIG */}
        {step === 2 && (
          <div className="rounded-2xl spx-obsidian-card p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">2. Build &amp; Compute Config</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Railpack zero-config or Dockerfile BuildKit with instant Mumbai edge routing.
                </p>
              </div>
              {detecting && (
                <span className="text-[11px] spx-mono text-sky-400">Auto-detecting repo...</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Subdomain Preview</label>
                  {slugAvailable !== null && (
                    <span
                      className={`text-[10px] spx-mono ${
                        slugAvailable ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {slugAvailable ? "✓ Available" : "Taken (auto-suffix applied)"}
                    </span>
                  )}
                </div>
                <div className="flex items-center rounded-lg spx-obsidian-input overflow-hidden h-10">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(slugifyName(e.target.value))}
                    className="flex-1 bg-transparent px-3 text-xs spx-mono text-white focus:outline-none"
                  />
                  <span className="px-3 text-[11px] spx-mono text-zinc-500 border-l border-white/[0.07]">
                    .deploy.sparrowx.net
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Build Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["railpack", "dockerfile"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBuildMethod(m)}
                      className={`h-10 rounded-lg border text-xs font-medium capitalize cursor-pointer ${
                        buildMethod === m
                          ? "border-white/25 bg-white/[0.1] text-white"
                          : "border-white/[0.07] bg-[#06080E] text-zinc-400"
                      }`}
                    >
                      {m === "railpack" ? "Railpack" : "Dockerfile"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Framework</label>
                <div className="flex items-center gap-2 h-10 rounded-lg spx-obsidian-input px-2.5">
                  <FrameworkIcon framework={framework} className="size-4 shrink-0" />
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value as DeployFrameworkId)}
                    className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                  >
                    <option value="nextjs" className="bg-[#090B11]">
                      Next.js
                    </option>
                    <option value="tanstack" className="bg-[#090B11]">
                      TanStack Start
                    </option>
                    <option value="vite" className="bg-[#090B11]">
                      Vite / React
                    </option>
                    <option value="node" className="bg-[#090B11]">
                      Node.js / Express
                    </option>
                    <option value="python" className="bg-[#090B11]">
                      Python / FastAPI
                    </option>
                    <option value="static" className="bg-[#090B11]">
                      Static HTML
                    </option>
                    <option value="docker" className="bg-[#090B11]">
                      Dockerfile
                    </option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Exposed Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 3000)}
                  className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Build Command</label>
                <input
                  type="text"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Start Command</label>
                <input
                  type="text"
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Edge Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as typeof region)}
                  className="w-full h-10 rounded-lg spx-obsidian-input px-3 text-xs"
                >
                  <option value="Mumbai IN-1" className="bg-[#090B11]">
                    Mumbai IN-1 (BOM)
                  </option>
                  <option value="Chennai IN-2" className="bg-[#090B11]">
                    Chennai IN-2 (MAA)
                  </option>
                  <option value="Singapore SG-1" className="bg-[#090B11]">
                    Singapore SG-1 (SIN)
                  </option>
                </select>
              </div>
            </div>

            {/* Flat INR Compute & Network Tiers */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Server className="size-3.5 text-zinc-400" />
                <span>Compute &amp; Network Tier (Flat INR)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TIER_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                      tier === t.id
                        ? "border-white/30 bg-[#10131C] shadow-md"
                        : "border-white/[0.07] bg-[#06080E] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{t.name}</span>
                      <span className="text-xs spx-mono font-semibold text-emerald-400 tabular-nums">
                        {t.price}
                      </span>
                    </div>
                    <div className="text-[11px] spx-mono text-zinc-400 mt-1.5 tabular-nums">
                      {t.specs}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{t.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Managed PostgreSQL Toggle */}
            <label className="rounded-xl border border-white/[0.08] bg-[#06080E] p-4 flex items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg border border-white/10 bg-[#090B11] grid place-items-center text-sky-400">
                  <Database className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Attach Managed PostgreSQL (db.sparrowx.net)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Automatically provisions isolated credentials and injects{" "}
                    <span className="spx-mono text-zinc-200">DATABASE_URL</span> encrypted via
                    AES-256-GCM.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={attachManagedPostgres}
                onChange={(e) => setAttachManagedPostgres(e.target.checked)}
                className="size-4 accent-white"
              />
            </label>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-9 rounded-lg spx-ghost-btn px-4 text-xs font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-2 px-4 text-xs font-semibold cursor-pointer"
              >
                <span>Continue to Environment Variables</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — ENVIRONMENT VARIABLES & LAUNCH */}
        {step === 3 && (
          <div className="rounded-2xl spx-obsidian-card p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white">
                3. Environment Variables &amp; Launch
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Secrets are encrypted with AES-256-GCM and redacted automatically from build logs.
              </p>
            </div>

            {/* Bulk .env Paste Parser */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-zinc-400" />
                <span>Bulk .env Paste (KEY=VALUE)</span>
              </label>
              <textarea
                rows={4}
                value={bulkEnvText}
                onChange={(e) => setBulkEnvText(e.target.value)}
                placeholder={
                  "API_KEY=sk_live_...\nNEXT_PUBLIC_SITE_URL=https://app.deploy.sparrowx.net"
                }
                className="w-full rounded-lg spx-obsidian-input p-3 text-xs spx-mono"
              />
              <button
                type="button"
                onClick={handleParseBulkEnv}
                className="h-8 rounded-lg spx-ghost-btn px-3 text-xs font-medium cursor-pointer"
              >
                Parse &amp; Add .env Block
              </button>
            </div>

            {/* Single Row Add */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                placeholder="KEY_NAME"
                className="sm:col-span-4 h-9 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
              />
              <input
                type="password"
                value={envVal}
                onChange={(e) => setEnvVal(e.target.value)}
                placeholder="Secret value"
                className="sm:col-span-4 h-9 rounded-lg spx-obsidian-input px-3 text-xs spx-mono"
              />
              <select
                value={envTarget}
                onChange={(e) => setEnvTarget(e.target.value as DraftEnv["target"])}
                className="sm:col-span-2 h-9 rounded-lg spx-obsidian-input px-2 text-xs"
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
                type="button"
                onClick={handleAddSingleEnv}
                className="sm:col-span-2 h-9 rounded-lg spx-ghost-btn inline-flex items-center justify-center gap-1 text-xs font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add</span>
              </button>
            </div>

            {envVars.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#06080E] divide-y divide-white/[0.06]">
                {envVars.map((v) => (
                  <div
                    key={v.id}
                    className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 spx-mono">
                      <span className="text-white truncate">{v.key}</span>
                      <span className="text-zinc-500">••••••••</span>
                      <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {v.target}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnvVars((prev) => prev.filter((x) => x.id !== v.id))}
                      className="text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pre-Launch Summary */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Ready to build <strong className="text-white">{name || slug}</strong> via{" "}
                  <span className="spx-mono">{buildMethod}</span> →{" "}
                  <span className="spx-mono text-white">
                    https://{slug || "app"}.deploy.sparrowx.net
                  </span>
                </span>
              </div>
              <span className="spx-mono text-[11px] text-zinc-400">{region}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-9 rounded-lg spx-ghost-btn px-4 text-xs font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleLaunchDeploy()}
                className="h-10 rounded-lg spx-silver-btn inline-flex items-center gap-2 px-5 text-xs font-semibold cursor-pointer"
              >
                <Rocket className="size-4" />
                <span>{submitting ? "Enqueuing Build..." : "Deploy Now"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </DeployAppShell>
  );
}
