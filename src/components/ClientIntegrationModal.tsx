import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Terminal,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
  Globe2,
  Cpu,
  Radio,
  Server,
  Layers,
  ExternalLink,
  ShieldCheck,
  Radar,
  ArrowRight,
  Play,
  KeyRound,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateClientSdkSnippet,
  runAutomatedServiceDiagnostic,
  type SdkTargetLanguage,
  type ServiceDiagnosticResult,
} from "@/lib/client-sdk-generator";
import { notifySuccess, notifyError, notifyLoading } from "@/lib/feedback";
import {
  supabaseUrl,
  getSupabaseHeaders,
  persistAuditLogToBackend,
  maskSecretKey,
} from "@/lib/supabase";
import { CyberEmblem, CyberPill } from "@/components/ui/CyberBadge";

export type ProductTechnologyCategory =
  | "website"
  | "ai_agent"
  | "voice_multimodal"
  | "api_backend"
  | "edge_container";

export function ClientIntegrationModal({
  service,
  onClose,
  onVerificationComplete,
  showToast,
  onOpenAttackSimulator,
}: {
  service: {
    id: string;
    name: string;
    endpoint: string;
    apiKey: string;
    category?: string;
  };
  onClose: () => void;
  onVerificationComplete?: (serviceId: string) => Promise<void> | void;
  showToast: (msg: string) => void;
  onOpenAttackSimulator?: (serviceName: string) => void;
}) {
  // Determine initial category
  const initialCategory: ProductTechnologyCategory =
    service.category?.includes("Voice") || service.endpoint.includes("voice")
      ? "voice_multimodal"
      : service.category?.includes("AI") || service.endpoint.startsWith("agent://")
        ? "ai_agent"
        : service.category?.includes("API") || service.endpoint.includes("api.")
          ? "api_backend"
          : "website";

  const [selectedCategory, setSelectedCategory] = useState<ProductTechnologyCategory>(initialCategory);

  const [activeTab, setActiveTab] = useState<SdkTargetLanguage>(() => {
    if (initialCategory === "website") return "html_script";
    if (initialCategory === "ai_agent") return "ai_agent_mcp";
    if (initialCategory === "voice_multimodal") return "ai_voice_multimodal";
    if (initialCategory === "edge_container") return "docker_sidecar";
    return "nextjs";
  });

  const [customEndpoint, setCustomEndpoint] = useState(service.endpoint);
  const [copied, setCopied] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<ServiceDiagnosticResult | null>(null);
  const [isSendingProbe, setIsSendingProbe] = useState(false);
  const [verificationBadgeId, setVerificationBadgeId] = useState<string | null>(null);

  // Switch tab automatically when changing high-level technology category
  const handleSelectCategory = (cat: ProductTechnologyCategory) => {
    setSelectedCategory(cat);
    if (cat === "website") setActiveTab("html_script");
    else if (cat === "ai_agent") setActiveTab("ai_agent_mcp");
    else if (cat === "voice_multimodal") setActiveTab("ai_voice_multimodal");
    else if (cat === "api_backend") setActiveTab("nextjs");
    else if (cat === "edge_container") setActiveTab("docker_sidecar");
  };

  const snippet = generateClientSdkSnippet(activeTab, {
    ...service,
    endpoint: customEndpoint.trim() || service.endpoint,
  });

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippet.code);
    setCopied(true);
    showToast(`Copied ${snippet.filename} snippet to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEnvConfig = () => {
    const liveOrigin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://sparrowx.net";
    const envContent = `# SparrowX Autonomous Shield Configuration\nSPARROWX_SERVICE_ID=${service.id}\nSPARROWX_SERVICE_NAME="${service.name}"\nSPARROWX_TARGET_ENDPOINT="${customEndpoint.trim() || service.endpoint}"\nSPARROWX_API_KEY="${service.apiKey}"\nSPARROWX_TELEMETRY_INGEST="${liveOrigin}/api/v1/telemetry"\nSPARROWX_AI_GUARDRAIL="enforced"\nSPARROWX_WAF_MODE="autonomous_block"\n`;
    navigator.clipboard?.writeText(envContent);
    setCopiedEnv(true);
    showToast("Copied .env.sparrowx configuration to clipboard");
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([snippet.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snippet.filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${snippet.filename}`);
  };

  const handleDownloadEnvFile = () => {
    const liveOrigin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://sparrowx.net";
    const envContent = `# SparrowX Autonomous Shield Configuration\nSPARROWX_SERVICE_ID=${service.id}\nSPARROWX_SERVICE_NAME="${service.name}"\nSPARROWX_TARGET_ENDPOINT="${customEndpoint.trim() || service.endpoint}"\nSPARROWX_API_KEY="${service.apiKey}"\nSPARROWX_TELEMETRY_INGEST="${liveOrigin}/api/v1/telemetry"\nSPARROWX_AI_GUARDRAIL="enforced"\nSPARROWX_WAF_MODE="autonomous_block"\n`;
    const blob = new Blob([envContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.sparrowx";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded .env.sparrowx configuration");
  };

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      const targetEndpoint = customEndpoint.trim() || service.endpoint;
      const res = await runAutomatedServiceDiagnostic({
        ...service,
        endpoint: targetEndpoint,
      });
      setDiagnosticResult(res);
      setIsDiagnosing(false);

      const generatedBadge = `SPX-PROOF-${Math.abs(
        (customEndpoint || service.name)
          .split("")
          .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0),
      )
        .toString(16)
        .toUpperCase()
        .slice(0, 8)}`;
      setVerificationBadgeId(generatedBadge);

      if (res.handshakeVerified) {
        notifySuccess(
          `Automated diagnostic passed — ${service.name} is verified active (${res.avgLatencyMs}ms RTT)`,
          {
            category: "SDK & Diagnostic",
            target: service.name,
            latencyMs: res.avgLatencyMs,
          },
        );
        if (onVerificationComplete) {
          await onVerificationComplete(service.id);
        }
      } else {
        notifyError("SDK_HANDSHAKE_FAILED", {
          target: service.name,
          category: "SDK & Diagnostic",
          customMessage: `Setup incomplete for ${targetEndpoint}: No SparrowX SDK middleware beacon or _sparrowx DNS TXT record detected yet. Install the SDK snippet above on your server/site first.`,
          retryAction: handleRunDiagnostic,
        });
      }
    } catch (err) {
      setIsDiagnosing(false);
      notifyError("SDK_HANDSHAKE_FAILED", {
        target: service.name,
        error: err,
        retryAction: handleRunDiagnostic,
      });
    }
  };

  const handleSendLiveProbe = async () => {
    setIsSendingProbe(true);
    try {
      const targetEndpoint = customEndpoint.trim() || service.endpoint;
      const res = await runAutomatedServiceDiagnostic({
        ...service,
        endpoint: targetEndpoint,
      });
      setDiagnosticResult(res);

      if (!res.handshakeVerified) {
        notifyError("SDK_HANDSHAKE_FAILED", {
          target: service.name,
          category: "SDK & Diagnostic",
          customMessage: `Live beacon check failed for ${targetEndpoint}: SDK middleware or _sparrowx DNS TXT record is not yet installed on your target server. Deploy the snippet above first, then click Verify.`,
          retryAction: handleSendLiveProbe,
        });
        return;
      }

      await persistAuditLogToBackend({
        id: `AUD-${Date.now().toString().slice(-4)}`,
        actor: "Client Diagnostic Agent",
        role: "Automated Probe",
        action: `Verified live handshake for ${service.name} (${res.avgLatencyMs}ms latency)`,
        target: service.name,
        severity: "Info",
        timestamp: "Just now",
      });

      if (onVerificationComplete) {
        await onVerificationComplete(service.id);
      }
      notifySuccess(
        `Verified live handshake: Security beacon confirmed for ${service.name} (${res.avgLatencyMs}ms roundtrip)`,
        {
          category: "SDK & Diagnostic",
          target: service.name,
          latencyMs: res.avgLatencyMs,
        },
      );
    } catch (err) {
      notifyError("SDK_HANDSHAKE_FAILED", {
        target: service.name,
        category: "SDK & Diagnostic",
        error: err,
        customMessage: `Live verification probe failed for ${service.name}. Network handshake timed out.`,
        retryAction: handleSendLiveProbe,
      });
    } finally {
      setIsSendingProbe(false);
    }
  };

  const categories: {
    id: ProductTechnologyCategory;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
  }[] = [
    {
      id: "website",
      title: "Website & Web App",
      description: "1-line HTML script tag, WordPress, Shopify, Webflow, Next.js",
      icon: Globe2,
      badge: "1-Line Drop-In",
    },
    {
      id: "ai_agent",
      title: "AI Agent & LLM",
      description: "Model Context Protocol (MCP), OpenAI, Gemini, Anthropic, Ollama",
      icon: Cpu,
      badge: "Prompt Guardrail",
    },
    {
      id: "voice_multimodal",
      title: "Voice & Multimodal Stream",
      description: "Real-time WebRTC & WebSocket bidirectional speech AI streams",
      icon: Radio,
      badge: "< 3ms Latency",
    },
    {
      id: "api_backend",
      title: "REST / GraphQL API",
      description: "Express/Node.js, Python FastAPI, Go, cURL microservices",
      icon: Zap,
      badge: "Edge WAF",
    },
    {
      id: "edge_container",
      title: "Cloud & Container",
      description: "Cloudflare Worker, Docker sidecar, Linux VPS Gateway",
      icon: Server,
      badge: "Autonomous Armor",
    },
  ];

  return (
    <div
      aria-label="Guided Product Integration Studio"
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 sm:p-6 lg:p-8 backdrop-blur-md overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-5xl rounded-3xl border border-white/15 bg-gradient-to-b from-[#121318] via-[#0c0d11] to-[#08080a] p-6 sm:p-8 lg:p-10 shadow-2xl space-y-8 my-6 max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-start sm:items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-black/80 border border-white/15 p-2 text-primary shadow-inner shrink-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Logo"
                className="size-full object-contain"
              />
            </span>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Guided Setup · Connect {service.name}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-mono font-semibold border ${
                    diagnosticResult?.handshakeVerified
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {diagnosticResult?.handshakeVerified ? "VERIFIED ACTIVE" : "AWAITING SDK SETUP"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono">
                Target: <span className="text-zinc-200">{customEndpoint}</span>{" "}
                <span className="mx-1.5 text-zinc-600">·</span> Key:{" "}
                <code className="text-primary font-bold">{maskSecretKey(service.apiKey)}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              aria-label="Close modal"
              className="size-9 rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* STEP 1: CHOOSE PRODUCT OR FUTURE-TECH CATEGORY */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[11px] text-primary">
                  1
                </span>
                <span>Step 1 · Choose What You Are Connecting</span>
              </span>
              <p className="text-xs text-zinc-400 mt-1">
                Select your application architecture to generate drop-in telemetry and edge protection.
              </p>
            </div>
            <span className="self-start sm:self-auto rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono font-medium text-emerald-300">
              Zero code refactoring required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer min-h-[132px] ${
                    isSelected
                      ? "border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-black/60 shadow-lg shadow-primary/15 ring-1 ring-primary/40"
                      : "border-white/10 bg-black/50 hover:border-white/25 hover:bg-black/75"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`grid size-10 place-items-center rounded-xl border transition-colors ${
                          isSelected
                            ? "border-primary/40 bg-primary/20 text-primary"
                            : "border-white/10 bg-white/5 text-zinc-300 group-hover:text-white"
                        }`}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${
                          isSelected
                            ? "border-primary/40 bg-primary/20 text-primary"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        {cat.badge}
                      </span>
                    </div>
                    <div
                      className={`text-sm font-bold tracking-tight ${
                        isSelected ? "text-white" : "text-zinc-100"
                      }`}
                    >
                      {cat.title}
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
                    {cat.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: FRAMEWORK / TARGET TABS & CODE SNIPPET */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[11px] text-primary">
                  2
                </span>
                <span>Step 2 · 1-Click Code &amp; Drop-In Configuration</span>
              </span>
              <p className="text-xs text-zinc-400 mt-1">
                Copy or download the pre-configured snippet for your target runtime.
              </p>
            </div>
            {snippet.installCmd && (
              <span className="font-mono text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25">
                {snippet.installCmd}
              </span>
            )}
          </div>

          {/* Framework tabs */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 overflow-x-auto no-scrollbar sm:flex-wrap">
            {(
              [
                { id: "html_script", label: "1-Line HTML Script Tag", category: "website" },
                { id: "nextjs", label: "Next.js Edge Middleware", category: "website" },
                { id: "ai_agent_mcp", label: "AI Agent & MCP Tool Firewall", category: "ai_agent" },
                { id: "ai_voice_multimodal", label: "Voice & Multimodal Stream", category: "voice_multimodal" },
                { id: "express", label: "Express / Node.js", category: "api_backend" },
                { id: "python_fastapi", label: "Python FastAPI / ASGI", category: "api_backend" },
                { id: "cloudflare_worker", label: "Cloudflare Edge Worker", category: "edge_container" },
                { id: "docker_sidecar", label: "Docker Edge Armor", category: "edge_container" },
                { id: "curl", label: "Terminal cURL Probe", category: "api_backend" },
              ] as const
            ).map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setActiveTab(lang.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  activeTab === lang.id
                    ? "bg-primary text-black font-bold shadow-md shadow-primary/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Target endpoint adjuster input */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-3.5 text-xs">
            <span className="font-mono text-zinc-300 font-medium shrink-0">
              Target Endpoint / Origin URL:
            </span>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://app.yourdomain.com or agent://mcp-server"
              className="h-9 flex-1 rounded-xl border border-white/10 bg-black px-3.5 font-mono text-xs text-white outline-none focus:border-primary"
            />
          </div>

          {/* Code Snippet Box */}
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-2 text-white font-semibold">
                <Code2 className="size-4 text-primary" />
                <span>{snippet.filename}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied ? "Copied Snippet" : "Copy Code"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Download {snippet.filename}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEnvConfig}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/40 px-3 py-1.5 text-xs font-mono text-primary hover:bg-primary/30 transition-colors cursor-pointer"
                >
                  {copiedEnv ? <Check className="size-3.5 text-emerald-400" /> : <KeyRound className="size-3.5" />}
                  <span>{copiedEnv ? "Copied .env" : "Copy .env.sparrowx"}</span>
                </button>
              </div>
            </div>
            <pre className="max-h-72 overflow-y-auto p-5 font-mono text-xs text-zinc-200 leading-relaxed select-all">
              {snippet.code}
            </pre>
          </div>
        </div>

        {/* STEP 3: INTERACTIVE HANDSHAKE & THREAT INTERCEPTION PROBE */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-black/80 to-black p-5 sm:p-6 space-y-5 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[11px] text-primary">
                  3
                </span>
                <Activity className="size-4 text-primary" />
                <span>Step 3 · Automated Diagnostic Handshake &amp; Probe</span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Verifies DNS TXT ownership, checks live SDK telemetry ingestion, and validates your endpoint handshake.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleRunDiagnostic}
                disabled={isDiagnosing}
                size="sm"
                className="h-10 px-4 gap-2 text-xs bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white font-bold shadow-md cursor-pointer rounded-xl"
              >
                <Radar className={`size-4 ${isDiagnosing ? "animate-spin" : ""}`} />
                <span>{isDiagnosing ? "Probing Network..." : "Verify Connection & Handshake"}</span>
              </Button>
              <Button
                onClick={handleSendLiveProbe}
                disabled={isSendingProbe}
                size="sm"
                variant="outline"
                className="h-10 px-4 gap-2 text-xs border-white/20 text-zinc-200 hover:text-white hover:bg-white/10 cursor-pointer rounded-xl"
              >
                <Send className="size-3.5 text-emerald-400" />
                <span>{isSendingProbe ? "Checking Telemetry..." : "Send Live Beacon"}</span>
              </Button>
            </div>
          </div>

          {/* Diagnostic Step Results Matrix */}
          {diagnosticResult && (
            <div className="space-y-4 border-t border-primary/20 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
                <span className="text-white font-bold flex items-center gap-2 text-sm">
                  {diagnosticResult.handshakeVerified ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span>Handshake Diagnostic Passed</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4 text-amber-400" />
                      <span>Setup Incomplete — Awaiting SDK Deployment or DNS TXT Proof</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 text-xs bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg">
                    Average RTT: {diagnosticResult.avgLatencyMs}ms
                  </span>
                  {verificationBadgeId && (
                    <span className="font-mono text-primary text-xs bg-primary/10 border border-primary/30 px-3 py-1 rounded-lg font-bold">
                      SEAL: {verificationBadgeId}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {diagnosticResult.steps.map((step) => (
                  <div
                    key={step.name}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${
                      step.status === "failed"
                        ? "border-red-500/30 bg-red-950/20"
                        : step.status === "warning"
                          ? "border-amber-500/30 bg-amber-950/20"
                          : "border-white/10 bg-black/60"
                    }`}
                  >
                    {step.status === "success" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertTriangle
                        className={`size-4 shrink-0 mt-0.5 ${
                          step.status === "failed" ? "text-red-400" : "text-amber-400"
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-bold text-white flex items-center justify-between gap-2">
                        <span>{step.name}</span>
                        {step.latencyMs !== undefined && (
                          <span className="font-mono text-[11px] text-zinc-400">
                            {step.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verified / Unverified Status Callout & Action Buttons */}
              <div
                className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  diagnosticResult.handshakeVerified
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-amber-500/30 bg-amber-950/20"
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    {diagnosticResult.handshakeVerified ? (
                      <>
                        <ShieldCheck className="size-4 text-emerald-400" />
                        <span>Product is now Protected &amp; Connected to your Dashboard!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-4 text-amber-400" />
                        <span>Deploy the Step 2 SDK snippet on your server, then re-verify.</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300">
                    {diagnosticResult.handshakeVerified
                      ? "Live telemetry is transmitting to your edge ledger with under 2ms latency SLA."
                      : "No live telemetry or DNS TXT ownership record has been detected from your target domain yet."}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {onOpenAttackSimulator && diagnosticResult.handshakeVerified && (
                    <Button
                      onClick={() => onOpenAttackSimulator(service.name)}
                      size="sm"
                      className="h-9 px-3.5 gap-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer rounded-xl"
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Launch Threat Simulator</span>
                    </Button>
                  )}
                  <Button
                    onClick={onClose}
                    size="sm"
                    className={`h-9 px-4 gap-1.5 text-xs font-bold cursor-pointer rounded-xl ${
                      diagnosticResult.handshakeVerified
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <span>
                      {diagnosticResult.handshakeVerified ? "Done & Open Dashboard" : "Close Setup"}
                    </span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-zinc-400 font-mono">
          <span>SparrowX Autonomous Integration Studio · Real-Time Telemetry Pipeline</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              size="sm"
              variant="outline"
              className="h-9 px-4 rounded-xl text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
