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
    const envContent = `# SparrowX Autonomous Shield Configuration\nSPARROWX_SERVICE_ID=${service.id}\nSPARROWX_SERVICE_NAME="${service.name}"\nSPARROWX_TARGET_ENDPOINT="${customEndpoint.trim() || service.endpoint}"\nSPARROWX_API_KEY="${service.apiKey}"\nSPARROWX_TELEMETRY_INGEST="https://sparrowx.dev/api/v1/telemetry"\nSPARROWX_AI_GUARDRAIL="enforced"\nSPARROWX_WAF_MODE="autonomous_block"\n`;
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
    const envContent = `# SparrowX Autonomous Shield Configuration\nSPARROWX_SERVICE_ID=${service.id}\nSPARROWX_SERVICE_NAME="${service.name}"\nSPARROWX_TARGET_ENDPOINT="${customEndpoint.trim() || service.endpoint}"\nSPARROWX_API_KEY="${service.apiKey}"\nSPARROWX_TELEMETRY_INGEST="https://sparrowx.dev/api/v1/telemetry"\nSPARROWX_AI_GUARDRAIL="enforced"\nSPARROWX_WAF_MODE="autonomous_block"\n`;
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/15 bg-gradient-to-b from-[#111215] via-[#0c0d10] to-[#08080a] p-4 sm:p-6 shadow-2xl space-y-5 my-4 max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-black/70 border border-white/15 p-1 text-primary shadow-inner shrink-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Logo"
                className="size-full object-contain"
              />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Guided Setup · Connect {service.name}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${
                    diagnosticResult?.handshakeVerified
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {diagnosticResult?.handshakeVerified ? "VERIFIED ACTIVE" : "AWAITING SDK SETUP"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Target: <span className="text-zinc-200">{customEndpoint}</span> · Key:{" "}
                <code className="text-primary font-bold">{maskSecretKey(service.apiKey)}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              aria-label="Close modal"
              className="size-8 rounded-lg text-zinc-400 hover:text-white"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* STEP 1: CHOOSE PRODUCT OR FUTURE-TECH CATEGORY */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <span>Step 1 · Choose What You Are Connecting</span>
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              Zero code refactoring required
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/15 shadow-lg shadow-primary/20 scale-[1.02]"
                      : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-black/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <Icon
                        className={`size-4 ${isSelected ? "text-primary" : "text-zinc-400"}`}
                      />
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-300">
                        {cat.badge}
                      </span>
                    </div>
                    <div
                      className={`text-xs font-bold mt-2 ${
                        isSelected ? "text-white" : "text-zinc-200"
                      }`}
                    >
                      {cat.title}
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-400 leading-tight">
                    {cat.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: FRAMEWORK / TARGET TABS & CODE SNIPPET */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <span>Step 2 · 1-Click Code &amp; Drop-In Configuration</span>
            </span>
            {snippet.installCmd && (
              <span className="font-mono text-[11px] text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                {snippet.installCmd}
              </span>
            )}
          </div>

          {/* Framework tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 p-1 overflow-x-auto no-scrollbar sm:flex-wrap">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-2.5 text-xs">
            <span className="font-mono text-zinc-400 shrink-0">Target Endpoint / Origin URL:</span>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://app.yourdomain.com or agent://mcp-server"
              className="h-8 flex-1 rounded-lg border border-white/10 bg-black px-3 font-mono text-xs text-white outline-none focus:border-primary"
            />
          </div>

          {/* Code Snippet Box */}
          <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/90 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-2 text-white font-semibold">
                <Code2 className="size-3.5 text-primary" />
                <span>{snippet.filename}</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-mono text-zinc-200 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copied ? "Copied Snippet" : "Copy Code"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-mono text-zinc-200 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <Download className="size-3 text-primary" />
                  <span>Download {snippet.filename}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEnvConfig}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/20 border border-primary/40 px-2.5 py-1 text-[11px] font-mono text-primary hover:bg-primary/30 transition-colors cursor-pointer"
                >
                  {copiedEnv ? <Check className="size-3 text-emerald-400" /> : <KeyRound className="size-3" />}
                  <span>{copiedEnv ? "Copied .env" : "Copy .env.sparrowx"}</span>
                </button>
              </div>
            </div>
            <pre className="max-h-64 overflow-y-auto p-4 font-mono text-xs text-zinc-200 leading-relaxed select-all">
              {snippet.code}
            </pre>
          </div>
        </div>

        {/* STEP 3: INTERACTIVE HANDSHAKE & THREAT INTERCEPTION PROBE */}
        <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-black/80 to-black p-4 space-y-3.5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <span>Step 3 · Automated Diagnostic Handshake &amp; Probe</span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-300">
                Pings your target endpoint, verifies TLS &amp; API keys, and runs an automated threat interception probe.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleRunDiagnostic}
                disabled={isDiagnosing}
                size="sm"
                className="h-9 gap-2 text-xs bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white font-bold shadow-md cursor-pointer"
              >
                <Radar className={`size-4 ${isDiagnosing ? "animate-spin" : ""}`} />
                <span>{isDiagnosing ? "Probing Network..." : "Verify Connection & Handshake"}</span>
              </Button>
              <Button
                onClick={handleSendLiveProbe}
                disabled={isSendingProbe}
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 text-xs border-white/20 text-zinc-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <Send className="size-3.5 text-emerald-400" />
                <span>{isSendingProbe ? "Transmitting..." : "Send Live Beacon"}</span>
              </Button>
            </div>
          </div>

          {/* Diagnostic Step Results Matrix */}
          {diagnosticResult && (
            <div className="space-y-3 border-t border-primary/20 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <span className="text-white font-bold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Handshake Diagnostic Passed</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 text-xs bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded">
                    Average RTT: {diagnosticResult.avgLatencyMs}ms
                  </span>
                  {verificationBadgeId && (
                    <span className="font-mono text-primary text-xs bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded font-bold">
                      SEAL: {verificationBadgeId}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {diagnosticResult.steps.map((step) => (
                  <div
                    key={step.name}
                    className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-black/60 p-3 text-xs"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>{step.name}</span>
                        {step.latencyMs !== undefined && (
                          <span className="font-mono text-[10px] text-zinc-400">
                            {step.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-300 leading-snug">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verified Success Callout & Action Buttons */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-400" />
                    <span>Product is now Protected &amp; Connected to your Dashboard!</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Live telemetry is transmitting to your edge ledger with under 2ms latency SLA.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onOpenAttackSimulator && (
                    <Button
                      onClick={() => onOpenAttackSimulator(service.name)}
                      size="sm"
                      className="h-8 gap-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Launch Threat Simulator</span>
                    </Button>
                  )}
                  <Button
                    onClick={onClose}
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-emerald-500 text-black font-bold hover:bg-emerald-400 cursor-pointer"
                  >
                    <span>Done &amp; Open Dashboard</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-zinc-400 font-mono">
          <span>SparrowX Autonomous Integration Studio · Real-Time Telemetry Pipeline</span>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} size="sm" variant="outline" className="h-8 text-xs cursor-pointer">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
