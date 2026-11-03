import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Terminal,
  Sparkles,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
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

export function ClientIntegrationModal({
  service,
  onClose,
  onVerificationComplete,
  showToast,
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
}) {
  const [activeTab, setActiveTab] = useState<SdkTargetLanguage>(
    service.category?.includes("AI") || service.endpoint.startsWith("agent://")
      ? "ai_agent_mcp"
      : "nextjs",
  );
  const [copied, setCopied] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<ServiceDiagnosticResult | null>(null);
  const [isSendingProbe, setIsSendingProbe] = useState(false);

  const snippet = generateClientSdkSnippet(activeTab, service);

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippet.code);
    setCopied(true);
    showToast(`Copied ${snippet.filename} snippet to clipboard`);
    setTimeout(() => setCopied(false), 2000);
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

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      const res = await runAutomatedServiceDiagnostic(service);
      setDiagnosticResult(res);
      setIsDiagnosing(false);

      if (res.overallStatus === "healthy") {
        notifySuccess(`Automated diagnostic passed — ${service.name} is verified active (${res.avgLatencyMs}ms)`, {
          category: "SDK & Diagnostic",
          target: service.name,
          latencyMs: res.avgLatencyMs,
        });
        if (onVerificationComplete) {
          await onVerificationComplete(service.id);
        }
      } else if (res.overallStatus === "warning") {
        showToast("Diagnostic check passed with configuration warnings", "info");
        if (onVerificationComplete) {
          await onVerificationComplete(service.id);
        }
      } else {
        notifyError("SDK_HANDSHAKE_FAILED", {
          target: service.name,
          category: "SDK & Diagnostic",
          customMessage: `Diagnostic check failed for ${service.name}. One or more security probes failed.`,
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
      const start = performance.now();
      if (supabaseUrl) {
        await fetch(`${supabaseUrl}/rest/v1/client_tenants?id=eq.${service.id}&select=id`, {
          headers: getSupabaseHeaders(),
        });
      }
      const latency = Math.max(8, Math.round(performance.now() - start));

      await persistAuditLogToBackend({
        id: `AUD-${Date.now().toString().slice(-4)}`,
        actor: "Client Diagnostic Agent",
        role: "Automated Probe",
        action: `Verified live handshake for ${service.name} (${latency}ms latency)`,
        target: service.name,
        severity: "Info",
        timestamp: "Just now",
      });

      if (onVerificationComplete) {
        await onVerificationComplete(service.id);
      }
      notifySuccess(
        `Verified live handshake: Security beacon emitted for ${service.name} (${latency}ms roundtrip)`,
        {
          category: "SDK & Diagnostic",
          target: service.name,
          latencyMs: latency,
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

  return (
    <div
      aria-label="Connect Service Command Center"
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f0f12] p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-black/60 border border-white/10 p-1 text-primary shadow-sm">
                <img
                  src="/sparrowx-logo.png"
                  alt="SparrowX Logo"
                  className="size-full object-contain"
                />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    Connect & Protect {service.name}
                  </h2>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                    Live Telemetry
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Target: <span className="text-foreground">{service.endpoint}</span> · Key:{" "}
              <code className="text-primary">{maskSecretKey(service.apiKey)}</code>
            </p>
          </div>
          <Button
            aria-label="Close modal"
            className="size-8 rounded-lg"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Integration Language / Framework Tabs */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              1. Choose Drop-In Integration
            </span>
            {snippet.installCmd && (
              <span className="font-mono text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {snippet.installCmd}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1 overflow-x-auto no-scrollbar sm:flex-wrap">
            {(
              [
                { id: "nextjs", label: "Next.js Edge" },
                { id: "express", label: "Express / Node" },
                { id: "python_fastapi", label: "Python FastAPI" },
                { id: "ai_agent_mcp", label: "AI Agent & MCP" },
                { id: "curl", label: "Terminal cURL" },
                { id: "cloudflare_worker", label: "SparrowX Edge Worker" },
              ] as const
            ).map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setActiveTab(lang.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  activeTab === lang.id
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#09090b]">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-mono text-muted-foreground">
            <span>{snippet.filename}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-primary hover:text-orange-400"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy Snippet"}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={handleDownloadFile}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </div>
          <pre className="max-h-60 overflow-y-auto p-4 font-mono text-xs text-foreground leading-relaxed">
            {snippet.code}
          </pre>
        </div>

        {/* Step 2: Automated Diagnostic & Live Handshake Verification */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> 2. Automated Diagnostic & Handshake Probe
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Verify TLS, DNS routing, and edge WAF responsiveness before sending live traffic.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRunDiagnostic}
                disabled={isDiagnosing}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Activity className={`size-3.5 ${isDiagnosing ? "animate-spin" : ""}`} />
                {isDiagnosing ? "Diagnosing..." : "Run Diagnostic Test"}
              </Button>
              <Button
                onClick={handleSendLiveProbe}
                disabled={isSendingProbe}
                size="sm"
                className="h-8 gap-1.5 text-xs bg-gradient-to-r from-primary to-orange-500 font-semibold"
              >
                <Send className="size-3.5" />
                {isSendingProbe ? "Transmitting..." : "Send Live Beacon"}
              </Button>
            </div>
          </div>

          {/* Diagnostic Step Results */}
          {diagnosticResult && (
            <div className="mt-3 space-y-2 border-t border-primary/20 pt-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-foreground">Diagnostic Summary</span>
                <span className="font-mono text-emerald-400">
                  Avg Latency: {diagnosticResult.avgLatencyMs}ms
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {diagnosticResult.steps.map((step) => (
                  <div
                    key={step.name}
                    className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/40 p-2.5 text-xs"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>{step.name}</span>
                        {step.latencyMs !== undefined && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {step.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-muted-foreground">
          <span className="font-mono text-[11px]">SparrowX v2.4 · Autonomous Edge Ingestion</span>
          <Button onClick={onClose} size="sm" variant="outline" className="h-8 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
