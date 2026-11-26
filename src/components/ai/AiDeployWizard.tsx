import React, { useId, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Database,
  GitBranch,
  KeyRound,
  Loader2,
  Plus,
  Rocket,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  AI_COMPUTE_PLANS,
  AI_TEMPLATES,
  detectRuntimeFromRepo,
  parseBulkDotEnv,
  type AiComputePlan,
  type AiInstanceRecord,
} from "@/lib/ai/contracts";

interface AiDeployWizardProps {
  initialTemplateId?: string;
  initialPlanId?: AiComputePlan["id"];
  userEmail: string;
  onCancel: () => void;
  onDeployed: (instance: AiInstanceRecord) => void;
}

type PipelineStage = "queued" | "allocating" | "configuring_ssl" | "live";

const PIPELINE_STEPS: Array<{ key: PipelineStage; label: string; detail: string }> = [
  { key: "queued", label: "Queued", detail: "Enqueuing idempotent BullMQ job to Mumbai control plane" },
  { key: "allocating", label: "Allocating", detail: "Applying Proxmox/Docker cgroups, tc port cap & TCP/25 SMTP block" },
  { key: "configuring_ssl", label: "Configuring SSL", detail: "Writing Nginx/Caddy wildcard route & Let's Encrypt TLS + WebSockets" },
  { key: "live", label: "Live", detail: "Container healthy & serving HTTPS traffic behind sec.sparrowx.net" },
];

export function AiDeployWizard({
  initialTemplateId,
  initialPlanId,
  userEmail,
  onCancel,
  onDeployed,
}: AiDeployWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceType, setSourceType] = useState<"template" | "github">("template");
  const [templateId, setTemplateId] = useState(initialTemplateId || AI_TEMPLATES[0].id);
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [planId, setPlanId] = useState<AiComputePlan["id"]>(initialPlanId || "growth");
  const [autoProvisionPgVector, setAutoProvisionPgVector] = useState(true);
  const [webhookWafEnabled, setWebhookWafEnabled] = useState(true);
  const [kycPhoneVerified, setKycPhoneVerified] = useState(true);

  const [instanceName, setInstanceName] = useState("my-ai-agent");
  const [subdomain, setSubdomain] = useState("my-ai-agent");
  const [subdomainTouched, setSubdomainTouched] = useState(false);

  const [envRows, setEnvRows] = useState<Array<{ key: string; value: string; isSecret: boolean }>>([
    { key: "GEMINI_API_KEY", value: "", isSecret: true },
    { key: "EXECUTIONS_DATA_PRUNE", value: "true", isSecret: false },
  ]);
  const [bulkEnvOpen, setBulkEnvOpen] = useState(false);
  const [bulkEnvText, setBulkEnvText] = useState("");

  const [deploying, setDeploying] = useState(false);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const subdomainId = useId();
  const subdomainHintId = useId();
  const subdomainErrorId = useId();

  const selectedTemplate = AI_TEMPLATES.find((t) => t.id === templateId) ?? AI_TEMPLATES[0]!;
  const selectedPlan = AI_COMPUTE_PLANS.find((p) => p.id === planId) ?? AI_COMPUTE_PLANS[1]!;
  const detectedRuntime =
    sourceType === "github"
      ? detectRuntimeFromRepo(gitRepoUrl || "node-agent")
      : selectedTemplate.runtime;

  const isSubdomainValid = /^[a-z0-9]([a-z0-9-]{1,34}[a-z0-9])?$/.test(subdomain.trim().toLowerCase());
  const showSubdomainError = subdomainTouched && !isSubdomainValid;

  const handleBulkImport = () => {
    const parsed = parseBulkDotEnv(bulkEnvText);
    if (parsed.length === 0) return;
    setEnvRows((prev) => {
      const merged = [...prev.filter((r) => r.key.trim())];
      for (const item of parsed) {
        const idx = merged.findIndex((m) => m.key === item.key);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      }
      return merged;
    });
    setBulkEnvText("");
    setBulkEnvOpen(false);
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubdomainTouched(true);
    setErrorMessage(null);

    const cleanSub = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]{1,34}[a-z0-9])?$/.test(cleanSub)) {
      setErrorMessage("Enter a valid lowercase subdomain (3–36 chars, letters, numbers, hyphens).");
      return;
    }

    setDeploying(true);
    setPipelineIndex(0);

    try {
      const cleanEnv = envRows
        .filter((r) => r.key.trim() && r.value.trim())
        .map((r) => ({ key: r.key.trim(), value: r.value.trim(), isSecret: r.isSecret }));

      const reqPromise = fetch("/api/ai/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sparrowx-user-email": userEmail,
        },
        body: JSON.stringify({
          name: instanceName.trim() || cleanSub,
          subdomain: cleanSub,
          sourceType,
          templateId: selectedTemplate.id,
          gitRepoUrl: sourceType === "github" ? gitRepoUrl.trim() : "",
          gitBranch: gitBranch.trim() || "main",
          detectedRuntime,
          planId,
          autoProvisionPgVector,
          webhookWafEnabled,
          kycPhoneVerified,
          envVars: cleanEnv,
        }),
      });

      // Animate 4-stage pipeline visibly while backend creates + encrypts secrets
      await new Promise((r) => setTimeout(r, 420));
      setPipelineIndex(1);
      await new Promise((r) => setTimeout(r, 480));
      setPipelineIndex(2);

      const res = await reqPromise;
      const json = (await res.json()) as { ok?: boolean; instance?: AiInstanceRecord; error?: string };
      if (!res.ok || !json.ok || !json.instance) {
        throw new Error(json.error || "Provisioning failed");
      }

      await new Promise((r) => setTimeout(r, 380));
      setPipelineIndex(3);
      await new Promise((r) => setTimeout(r, 450));
      onDeployed(json.instance);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Deployment error");
      setDeploying(false);
      setPipelineIndex(-1);
    }
  };

  if (deploying) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-white/[0.1] bg-[#090B11] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#38BDF8]">
              Live Provisioning Pipeline
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Launching {subdomain}.ai.sparrowx.net
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-3 py-1 text-xs font-mono text-[#38BDF8]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Mumbai BOM1
          </span>
        </div>

        <ol className="space-y-3" aria-label="Deployment progress">
          {PIPELINE_STEPS.map((st, idx) => {
            const done = idx < pipelineIndex || pipelineIndex === 3;
            const active = idx === pipelineIndex && pipelineIndex < 3;
            return (
              <li
                key={st.key}
                className={`rounded-lg border p-4 flex items-start gap-3 transition-colors ${
                  done
                    ? "border-[#10B981]/30 bg-[#10B981]/5"
                    : active
                      ? "border-[#38BDF8]/40 bg-[#10131C]"
                      : "border-white/[0.06] bg-[#05060A] opacity-55"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="size-4 text-[#10B981]" aria-hidden="true" />
                  ) : active ? (
                    <Loader2 className="size-4 text-[#38BDF8] animate-spin" aria-hidden="true" />
                  ) : (
                    <span className="block size-4 rounded-full border border-zinc-700" />
                  )}
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{st.label}</div>
                  <div className="mt-0.5 text-xs font-mono text-zinc-400">{st.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white mb-2 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to Console</span>
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Deploy New AI Workload
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            3-step provisioning onto isolated Indian Proxmox bare-metal with automatic SSL &amp; WebSockets.
          </p>
        </div>

        {/* 3-Step Indicator */}
        <ol className="flex items-center gap-2 text-xs font-mono">
          {[
            { num: 1 as const, label: "Source" },
            { num: 2 as const, label: "Compute & DB" },
            { num: 3 as const, label: "Vault & Launch" },
          ].map((s) => (
            <li key={s.num}>
              <button
                type="button"
                aria-current={step === s.num ? "step" : undefined}
                onClick={() => setStep(s.num)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 cursor-pointer transition-colors ${
                  step === s.num
                    ? "border-white/25 bg-[#10131C] text-white"
                    : step > s.num
                      ? "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]"
                      : "border-white/[0.08] bg-[#090B11] text-zinc-500"
                }`}
              >
                {step > s.num ? <Check className="size-3" aria-hidden="true" /> : <span>0{s.num}</span>}
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={handleDeploy} noValidate className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 space-y-6">
        {step === 1 ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceType("template")}
                className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  sourceType === "template"
                    ? "border-white/25 bg-[#10131C]"
                    : "border-white/[0.08] bg-[#05060A] hover:border-white/[0.14]"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Box className="size-4 text-[#38BDF8]" aria-hidden="true" />
                  <span>1-Click Template</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Pre-hardened Langflow, MCP Runtime, Private RAG &amp; Workflow VPS containers.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSourceType("github")}
                className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  sourceType === "github"
                    ? "border-white/25 bg-[#10131C]"
                    : "border-white/[0.08] bg-[#05060A] hover:border-white/[0.14]"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <GitBranch className="size-4 text-[#10B981]" aria-hidden="true" />
                  <span>Connect GitHub Repo</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Auto-detects Dockerfile, Python (LangGraph/CrewAI), or Node.js MCP servers.
                </p>
              </button>
            </div>

            {sourceType === "template" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AI_TEMPLATES.map((tpl) => {
                  const selected = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setTemplateId(tpl.id);
                        setInstanceName(tpl.slug);
                        setSubdomain(tpl.slug.slice(0, 22));
                      }}
                      className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                        selected
                          ? "border-white/30 bg-[#10131C]"
                          : "border-white/[0.08] bg-[#05060A] hover:border-white/[0.14]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{tpl.name}</span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          ≥{tpl.minRamGb} GB
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{tpl.tagline}</p>
                      <div className="mt-2 text-[11px] font-mono text-zinc-500">
                        {tpl.image} • Port {tpl.defaultPort}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-white/[0.08] bg-[#05060A] p-4">
                <div>
                  <label htmlFor="ai-git-repo" className="block text-xs font-medium text-zinc-200">
                    GitHub Repository URL
                  </label>
                  <span className="block text-[11px] text-zinc-500 mt-0.5 mb-1.5">
                    Format: https://github.com/org/my-langgraph-agent
                  </span>
                  <input
                    id="ai-git-repo"
                    type="url"
                    value={gitRepoUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGitRepoUrl(v);
                      const slug = v
                        .split("/")
                        .pop()
                        ?.replace(/\.git$/i, "")
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "");
                      if (slug && slug.length >= 3) {
                        setInstanceName(slug);
                        setSubdomain(slug.slice(0, 28));
                      }
                    }}
                    placeholder="https://github.com/sparrowxtech/whatsapp-rag-agent"
                    className="w-full rounded-lg border border-white/12 bg-[#090B11] px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ai-git-branch" className="block text-xs font-medium text-zinc-200 mb-1">
                      Branch
                    </label>
                    <input
                      id="ai-git-branch"
                      type="text"
                      value={gitBranch}
                      onChange={(e) => setGitBranch(e.target.value)}
                      className="w-full rounded-lg border border-white/12 bg-[#090B11] px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-[#090B11] px-3 py-2 flex flex-col justify-center">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">
                      Auto-Detected Builder
                    </span>
                    <span className="text-xs font-mono text-[#10B981] mt-0.5">
                      {detectedRuntime.toUpperCase()} (Nixpacks / BuildKit)
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="spx-silver-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                <span>Continue to Compute &amp; DB</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_COMPUTE_PLANS.map((plan) => {
                const selected = planId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                      selected
                        ? "border-white/30 bg-[#10131C]"
                        : "border-white/[0.08] bg-[#05060A] hover:border-white/[0.14]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{plan.name}</span>
                      <span className="font-mono text-sm font-semibold text-white">
                        ₹{plan.monthlyInr.toLocaleString("en-IN")}/mo
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-mono text-zinc-300">
                      {plan.vcpu} vCPU • {plan.ramGb} GB ECC • {plan.ssdGb} GB NVMe
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-zinc-500">
                      Up to {plan.portMbps} Mbps Shared • {plan.transferGb} GB Transfer • {plan.isolation}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-[#05060A] p-4 cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={autoProvisionPgVector}
                  onChange={(e) => setAutoProvisionPgVector(e.target.checked)}
                  className="mt-1 accent-white"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Database className="size-4 text-[#F59E0B]" aria-hidden="true" />
                    <span>Auto-Provision db.sparrowx.net PostgreSQL 16 + pgvector</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Creates an isolated database on the Mumbai private subnet and automatically injects
                    an encrypted <code className="font-mono text-zinc-200">DATABASE_URL</code> secret.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-[#05060A] p-4 cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={webhookWafEnabled}
                  onChange={(e) => setWebhookWafEnabled(e.target.checked)}
                  className="mt-1 accent-white"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Shield className="size-4 text-[#10B981]" aria-hidden="true" />
                    <span>Enable sec.sparrowx.net Edge WAF &amp; Webhook Guard</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Protects WhatsApp/Razorpay/MCP endpoints from L7 floods and blocks outbound TCP/25 SMTP automatically.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="spx-silver-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                <span>Continue to Vault &amp; Domain</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ai-inst-name" className="block text-xs font-medium text-zinc-200">
                  Instance Display Name
                </label>
                <span className="block text-[11px] text-zinc-500 mt-0.5 mb-1.5">
                  Shown in Console, metrics, and GST invoice breakdown
                </span>
                <input
                  id="ai-inst-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={48}
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="spx-ai-input w-full rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor={subdomainId} className="block text-xs font-medium text-zinc-200">
                  Public Subdomain
                </label>
                <span id={subdomainHintId} className="block text-[11px] text-zinc-500 mt-0.5 mb-1.5">
                  Lowercase letters, numbers &amp; hyphens (3–36 chars)
                </span>
                <div className="flex items-center rounded-lg border border-white/12 bg-[#05060A] focus-within:border-white/30 overflow-hidden">
                  <input
                    id={subdomainId}
                    type="text"
                    required
                    minLength={3}
                    maxLength={36}
                    pattern="^[a-z0-9]([a-z0-9-]{1,34}[a-z0-9])?$"
                    aria-invalid={showSubdomainError ? "true" : "false"}
                    aria-describedby={
                      showSubdomainError ? `${subdomainHintId} ${subdomainErrorId}` : subdomainHintId
                    }
                    value={subdomain}
                    onBlur={() => setSubdomainTouched(true)}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="spx-ai-input w-full bg-transparent px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="shrink-0 border-l border-white/[0.08] bg-[#10131C] px-2.5 py-2 text-[11px] font-mono text-zinc-400">
                    .ai.sparrowx.net
                  </span>
                </div>
                {showSubdomainError ? (
                  <div
                    id={subdomainErrorId}
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#EF4444]"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Error: Use 3–36 lowercase alphanumeric characters with interior hyphens.</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Encrypted Env Vault Editor */}
            <div className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <KeyRound className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                  <span>Encrypted Environment Variables (AES-256-GCM at rest)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkEnvOpen((v) => !v)}
                    className="rounded border border-white/12 bg-[#090B11] hover:bg-[#10131C] px-2.5 py-1 text-[11px] font-mono text-zinc-300 cursor-pointer"
                  >
                    {bulkEnvOpen ? "Close Bulk Paste" : "Paste .env Bulk"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEnvRows((prev) => [...prev, { key: "", value: "", isSecret: true }])
                    }
                    className="inline-flex items-center gap-1 rounded border border-white/12 bg-[#090B11] hover:bg-[#10131C] px-2.5 py-1 text-[11px] font-mono text-zinc-200 cursor-pointer"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    <span>Add Key</span>
                  </button>
                </div>
              </div>

              {bulkEnvOpen ? (
                <div className="space-y-2 rounded-md border border-white/10 bg-[#090B11] p-3">
                  <label htmlFor="ai-bulk-dotenv" className="block text-[11px] font-mono text-zinc-400">
                    Paste standard .env lines (KEY=VALUE) — encrypted in transit and stored via AES-256-GCM
                  </label>
                  <textarea
                    id="ai-bulk-dotenv"
                    rows={4}
                    value={bulkEnvText}
                    onChange={(e) => setBulkEnvText(e.target.value)}
                    placeholder={"GEMINI_API_KEY=AIza...\nOPENAI_API_KEY=sk-...\nWHATSAPP_TOKEN=EAAG..."}
                    className="w-full rounded border border-white/10 bg-[#05060A] p-2.5 text-xs font-mono text-zinc-100 focus:border-white/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-[#05060A] cursor-pointer"
                  >
                    Import Variables
                  </button>
                </div>
              ) : null}

              <div className="space-y-2">
                {envRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      aria-label={`Environment key ${idx + 1}`}
                      value={row.key}
                      onChange={(e) =>
                        setEnvRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)),
                        )
                      }
                      placeholder="KEY_NAME"
                      className="col-span-5 rounded border border-white/10 bg-[#090B11] px-2.5 py-1.5 text-xs font-mono text-zinc-100 focus:border-white/25 focus:outline-none"
                    />
                    <input
                      type={row.isSecret ? "password" : "text"}
                      aria-label={`Environment value ${idx + 1}`}
                      value={row.value}
                      onChange={(e) =>
                        setEnvRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder="secret value"
                      className="col-span-6 rounded border border-white/10 bg-[#090B11] px-2.5 py-1.5 text-xs font-mono text-zinc-100 focus:border-white/25 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={`Remove variable ${idx + 1}`}
                      onClick={() => setEnvRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 flex items-center justify-center rounded border border-white/[0.08] py-1.5 text-zinc-500 hover:text-[#EF4444] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional KYC / Phone anti-abuse gate for public ports */}
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#05060A] px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-[#10B981] shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-xs font-medium text-white">
                    Indian Phone / KYC Anti-Abuse Attestation (Required for Public Edge Ports)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Confirms no spam/phishing/SMTP abuse on OVH Mumbai IPv4 space.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={kycPhoneVerified}
                onChange={(e) => setKycPhoneVerified(e.target.checked)}
                className="accent-[#10B981]"
              />
            </label>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-2.5 text-xs text-[#EF4444]"
              >
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400">
                  {selectedPlan.name} • ₹{selectedPlan.monthlyInr.toLocaleString("en-IN")}/mo
                </span>
                <button
                  type="submit"
                  className="spx-silver-btn inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold text-[#05060A] shadow-lg cursor-pointer"
                >
                  <Rocket className="size-3.5" aria-hidden="true" />
                  <span>Deploy to Mumbai Edge</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
