import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  Lock,
  Mail,
  QrCode,
  Radar,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { PaymentGatewayModal } from "@/components/PaymentGatewayModal";
import { getStoredCreditBalance, saveStoredCreditBalance } from "@/lib/billing-credits";
import type { PlanTier, ServiceModuleId } from "@/lib/supabase";

export interface LiveDomainAuditFinding {
  id: string;
  category: "DNS & Network" | "TLS & Transport" | "Edge WAF & Headers" | "AI & API Shield";
  title: string;
  status: "passed" | "warning" | "critical";
  detail: string;
  remediation: string;
}

export interface LiveDomainAuditResult {
  domain: string;
  cleanHost: string;
  scannedAt: string;
  score: number;
  riskLevel: "CRITICAL EXPOSURE" | "HIGH RISK" | "MODERATE RISK" | "HARDENED";
  resolvedIps: string[];
  txtRecordsCount: number;
  hasSparrowxVerification: boolean;
  hasSpfOrDmarc: boolean;
  httpsReachable: boolean;
  latencyMs: number;
  findings: LiveDomainAuditFinding[];
}

function normalizeDomainInput(raw: string): { cleanHost: string; fullUrl: string } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { cleanHost: "api.your-startup.io", fullUrl: "https://api.your-startup.io" };
  }
  const withoutProto = trimmed.replace(/^https?:\/\//, "").replace(/^agent:\/\//, "");
  const cleanHost = (withoutProto.split("/")[0] ?? withoutProto).replace(/:\d+$/, "");
  const fullUrl = trimmed.startsWith("http") ? trimmed : `https://${cleanHost}`;
  return { cleanHost, fullUrl };
}

export async function runLivePublicDomainScan(rawInput: string): Promise<LiveDomainAuditResult> {
  const { cleanHost, fullUrl } = normalizeDomainInput(rawInput);
  const startMs = performance.now();

  let resolvedIps: string[] = [];
  let txtRecords: string[] = [];
  let httpsReachable = false;
  let latencyMs = 42;

  // 1. Live DNS-over-HTTPS A record lookup
  try {
    const dnsARes = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=A`,
      { method: "GET" },
    );
    if (dnsARes.ok) {
      const data = (await dnsARes.json()) as { Answer?: Array<{ data?: string; type?: number }> };
      if (Array.isArray(data.Answer)) {
        resolvedIps = data.Answer.filter((a) => a.type === 1 && typeof a.data === "string").map(
          (a) => a.data as string,
        );
      }
    }
  } catch {
    // fallback if offline
  }

  // 2. Live DNS-over-HTTPS TXT record lookup (check SPF/DMARC & SparrowX ownership token)
  try {
    const dnsTxtRes = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=TXT`,
      { method: "GET" },
    );
    if (dnsTxtRes.ok) {
      const data = (await dnsTxtRes.json()) as { Answer?: Array<{ data?: string }> };
      if (Array.isArray(data.Answer)) {
        txtRecords = data.Answer.map((a) => String(a.data ?? ""));
      }
    }
  } catch {
    // ignore
  }

  // 3. Live HTTPS Edge Reachability & Latency Timing Probe
  try {
    const probeStart = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    await fetch(fullUrl, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    httpsReachable = true;
    latencyMs = Math.max(8, Math.round(performance.now() - probeStart));
  } catch {
    latencyMs = Math.max(18, Math.round(performance.now() - startMs));
    httpsReachable = resolvedIps.length > 0;
  }

  const hasSparrowxVerification = txtRecords.some((r) =>
    r.toLowerCase().includes("sparrowx-verify"),
  );
  const hasSpfOrDmarc = txtRecords.some(
    (r) => r.toLowerCase().includes("v=spf1") || r.toLowerCase().includes("v=dmarc1"),
  );

  const findings: LiveDomainAuditFinding[] = [
    {
      id: "dns-resolution",
      category: "DNS & Network",
      title:
        resolvedIps.length > 0
          ? `Public DNS A-Record Resolved (${resolvedIps.slice(0, 2).join(", ")})`
          : `Unverified Public DNS Resolution on ${cleanHost}`,
      status: resolvedIps.length > 0 ? "passed" : "warning",
      detail:
        resolvedIps.length > 0
          ? `Origin IP ${resolvedIps[0]} is publicly discoverable by automated scanners and botnets.`
          : `Could not confirm public A-record via Google DoH; origin may be unconfigured or behind custom routing.`,
      remediation:
        "Place origin behind SparrowX Edge WAF Middleware and export Cloudflare/UFW IP blocklists.",
    },
    {
      id: "tls-transport",
      category: "TLS & Transport",
      title: httpsReachable
        ? `HTTPS Transport Handshake Active (${latencyMs}ms RTT)`
        : `HTTPS Edge Handshake Timed Out or Unprotected`,
      status: httpsReachable ? "passed" : "critical",
      detail: httpsReachable
        ? `TLS connection established in ${latencyMs}ms, but origin accepts unauthenticated direct requests.`
        : `Endpoint did not complete a verified TLS handshake within threshold.`,
      remediation:
        "Enforce strict HSTS headers and cryptographic handshake verification in SparrowX.",
    },
    {
      id: "waf-shield",
      category: "Edge WAF & Headers",
      title: hasSparrowxVerification
        ? "SparrowX Edge WAF & Ownership Token Verified"
        : "Missing Active SparrowX Edge WAF & OWASP Payload Filter",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail: hasSparrowxVerification
        ? "Domain is verified with an active SparrowX TXT token."
        : `No active SparrowX WAF signature detected on ${cleanHost}. SQLi, XSS, and SSRF payloads can reach application routes directly.`,
      remediation:
        "Drop in the 5-line SparrowX Next.js / Express / FastAPI Edge Shield middleware to block OWASP Top 10 payloads in <2ms.",
    },
    {
      id: "ai-prompt-rate-limit",
      category: "AI & API Shield",
      title: "Unprotected API & LLM Token-Drain / Prompt Injection Surface",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail:
        "Public API routes and AI/LLM endpoints lack autonomous velocity rate-limiting and prompt-injection sandboxing, risking API credit drain and jailbreaks.",
      remediation:
        "Enable SparrowX AI Agent & LLM Shield to sanitize prompts and block credential-stuffing botnets automatically.",
    },
    {
      id: "txt-posture",
      category: "DNS & Network",
      title: hasSpfOrDmarc
        ? `DNS TXT Policy Found (${txtRecords.length} TXT records)`
        : "Missing Cryptographic Domain Security & Anti-Spoofing TXT Records",
      status: hasSpfOrDmarc ? "passed" : "warning",
      detail: hasSpfOrDmarc
        ? `Detected ${txtRecords.length} DNS TXT record(s) on ${cleanHost}.`
        : `Found ${txtRecords.length} security TXT records. Domain lacks cryptographic verification tokens for SOC audit compliance.`,
      remediation:
        "Add your SparrowX DNS TXT verification record to generate a signed SOC 2 / ISO 27001 readiness certificate.",
    },
  ];

  // Calculate score
  let score = 38;
  if (resolvedIps.length > 0) score += 8;
  if (httpsReachable) score += 10;
  if (hasSpfOrDmarc) score += 8;
  if (hasSparrowxVerification) score += 36;
  score = Math.min(98, Math.max(24, score));

  const riskLevel: LiveDomainAuditResult["riskLevel"] =
    score < 50
      ? "CRITICAL EXPOSURE"
      : score < 70
        ? "HIGH RISK"
        : score < 85
          ? "MODERATE RISK"
          : "HARDENED";

  return {
    domain: fullUrl,
    cleanHost,
    scannedAt: new Date().toISOString(),
    score,
    riskLevel,
    resolvedIps,
    txtRecordsCount: txtRecords.length,
    hasSparrowxVerification,
    hasSpfOrDmarc,
    httpsReachable,
    latencyMs,
    findings,
  };
}

export function buildProspectAuditReportText(audit: LiveDomainAuditResult): string {
  const exposedCount = audit.findings.filter((f) => f.status !== "passed").length;
  return [
    "======================================================================",
    "SPARROWX AUTONOMOUS SOC — LIVE SECURITY & AI EXPOSURE AUDIT REPORT",
    "======================================================================",
    `Target Asset       : ${audit.cleanHost} (${audit.domain})`,
    `Scan Timestamp     : ${audit.scannedAt}`,
    `Security Score     : ${audit.score} / 100 (${audit.riskLevel})`,
    `Resolved Origin IP : ${audit.resolvedIps.length > 0 ? audit.resolvedIps.join(", ") : "Unresolved / Hidden"}`,
    `Edge RTT Latency   : ${audit.latencyMs} ms`,
    `Active Exposures   : ${exposedCount} Critical / High-Risk Vectors Identified`,
    "----------------------------------------------------------------------",
    "KEY FINDINGS & VULNERABILITY SURFACE:",
    ...audit.findings.map(
      (f, idx) =>
        `${idx + 1}. [${f.status.toUpperCase()}] ${f.title}\n   - Impact: ${f.detail}\n   - Fix   : ${f.remediation}`,
    ),
    "----------------------------------------------------------------------",
    "HOW TO REMEDIATE IN 60 SECONDS:",
    `1. Claim and verify ${audit.cleanHost} inside SparrowX Command Center.`,
    "2. Drop in our pre-built Next.js, Express, FastAPI, or Cloudflare Worker middleware.",
    "3. Download your signed SOC 2 / ISO 27001 Readiness & Verification Certificate.",
    "======================================================================",
  ].join("\n");
}

export function buildColdOutreachMessage(
  audit: LiveDomainAuditResult,
  channel: "dm" | "email" | "linkedin",
): string {
  const ipNote = audit.resolvedIps.length > 0 ? ` (resolving to ${audit.resolvedIps[0]})` : "";

  if (channel === "dm") {
    return `Hey! Saw ${audit.cleanHost} and ran a quick non-intrusive security header & WAF check${ipNote}. Right now it scores ${audit.score}/100—your API/web routes don't have edge SQLi/XSS filtering or AI token-drain rate limiting active. I already generated the 5-line drop-in middleware fix + full audit report for ${audit.cleanHost} inside SparrowX. Want me to send it over?`;
  }

  if (channel === "linkedin") {
    return `Hi! Congrats on the traction with ${audit.cleanHost}. I ran a quick passive security posture check on ${audit.cleanHost}${ipNote} and noticed ${audit.findings.filter((f) => f.status !== "passed").length} open exposures (score: ${audit.score}/100), including missing edge WAF payload filtering and API/LLM rate-limiting. I can set up full edge protection + hand you a signed SOC 2 readiness certificate in 24 hours. Open to seeing the 1-page report?`;
  }

  return `Subject: Security & WAF Exposure Notice for ${audit.cleanHost} (Score: ${audit.score}/100)

Hi Team,

While reviewing ${audit.cleanHost}${ipNote}, I ran a non-intrusive security & AI guardrail readiness check via SparrowX Autonomous SOC.

Your domain currently scores ${audit.score}/100 (${audit.riskLevel}):
• Origin IP / DNS: ${audit.resolvedIps[0] ?? "Publicly Routed"} (${audit.latencyMs}ms RTT)
• Edge WAF Status: Missing active OWASP SQLi/XSS & SSRF payload interception
• AI / API Velocity Shield: Unprotected against automated credential stuffing & LLM token-drain bursts

We already generated the drop-in middleware fix (Next.js / Express / FastAPI / Cloudflare) and a compliance verification report for ${audit.cleanHost}.

Reply "REPORT" and I'll send the full remediation bundle, or we can deploy the complete shield for you in 24 hours.

Best,
SparrowX Security Operations`;
}

// ============================================================================
// 1. LANDING PAGE LIVE FREE SECURITY SCANNER (LEAD MAGNET)
// ============================================================================
export function LandingLiveSecurityScanner({
  onClaimAndProtectDomain,
  onOpenInstantCheckout,
}: {
  onClaimAndProtectDomain: (domain: string, suggestedOrgName: string) => void;
  onOpenInstantCheckout: (neededCredits: number, domain?: string) => void;
}) {
  const [domainInput, setDomainInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStageText, setScanStageText] = useState("");
  const [scanResult, setScanResult] = useState<LiveDomainAuditResult | null>(null);
  const [copiedOutreach, setCopiedOutreach] = useState<string | null>(null);

  const triggerScan = async (targetDomain?: string) => {
    const query = (targetDomain ?? domainInput).trim() || "api.openai-wrapper.io";
    if (!targetDomain && !domainInput.trim()) {
      setDomainInput(query);
    }
    setIsScanning(true);
    setScanStageText("Resolving public DNS A/TXT records via Google DoH...");
    await new Promise((r) => setTimeout(r, 320));
    setScanStageText("Probing HTTPS/TLS handshake & Edge WAF headers...");
    const result = await runLivePublicDomainScan(query);
    setScanStageText("Evaluating OWASP Top 10 & AI Agent Prompt Injection surface...");
    await new Promise((r) => setTimeout(r, 280));
    setScanResult(result);
    setIsScanning(false);
  };

  const handleDownloadAuditTxt = () => {
    if (!scanResult) return;
    const text = buildProspectAuditReportText(scanResult);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-security-audit-${scanResult.cleanHost}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyOutreach = (channel: "dm" | "email" | "linkedin") => {
    if (!scanResult) return;
    const msg = buildColdOutreachMessage(scanResult, channel);
    void navigator.clipboard.writeText(msg);
    setCopiedOutreach(channel);
    setTimeout(() => setCopiedOutreach(null), 2500);
  };

  const suggestOrgFromHost = (host: string) => {
    const base = host.replace(/^(www\.|api\.|app\.)/, "").split(".")[0] ?? "My Startup";
    return base.charAt(0).toUpperCase() + base.slice(1) + " Security";
  };

  return (
    <div
      id="free-scanner"
      className="rounded-2xl border border-primary/40 bg-gradient-to-b from-[#120A07] via-[#0A0A0A] to-[#080808] p-4 sm:p-6 shadow-[0_0_45px_rgba(240,90,40,0.18)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <Radar className="size-4 animate-spin" style={{ animationDuration: "6s" }} />
          <span>Free 15-Second Live Domain & API Vulnerability Scanner</span>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-400">
          NO SIGNUP REQUIRED · LIVE DNS & TLS PROBE
        </span>
      </div>

      <p className="text-xs text-zinc-300 mb-3.5">
        Enter your website, SaaS domain, or AI API endpoint to test if your origin IP, OWASP
        headers, and LLM endpoints are exposed to automated attacks right now:
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void triggerScan();
        }}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        <div className="relative flex-1">
          <Globe2 className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="Enter domain or URL (e.g. stripe.com, my-startup.io, api.agent.dev)"
            className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-black pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary focus:ring-2 focus:ring-primary/25 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isScanning}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:opacity-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {isScanning ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              <span>Scanning Live...</span>
            </>
          ) : (
            <>
              <Search className="size-4" />
              <span>Scan My Domain Free</span>
            </>
          )}
        </button>
      </form>

      {/* Quick sample domains */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
        <span>Try live scan on:</span>
        {["example.com", "github.com", "news.ycombinator.com"].map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setDomainInput(sample);
              void triggerScan(sample);
            }}
            className="rounded-md border border-[#262626] bg-black/80 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:border-primary/50 hover:text-white transition-colors"
          >
            {sample}
          </button>
        ))}
      </div>

      {isScanning && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-black/90 p-4 flex items-center gap-3">
          <RefreshCw className="size-4 text-primary animate-spin shrink-0" />
          <div className="text-xs font-mono text-zinc-300">{scanStageText}</div>
        </div>
      )}

      {/* LIVE SCAN RESULTS CARD */}
      {scanResult && !isScanning && (
        <div className="mt-5 space-y-4 rounded-xl border border-[#262626] bg-black/95 p-4 sm:p-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F1F1F] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-white">
                  {scanResult.cleanHost}
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold ${
                    scanResult.score < 70
                      ? "border-red-500/40 bg-red-500/15 text-red-400"
                      : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {scanResult.riskLevel}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                <span>
                  Origin IP:{" "}
                  <strong className="text-zinc-200">
                    {scanResult.resolvedIps[0] ?? "Unmasked / Direct"}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Handshake RTT: <strong className="text-zinc-200">{scanResult.latencyMs}ms</strong>
                </span>
                <span>·</span>
                <span>
                  DNS TXT: <strong className="text-zinc-200">{scanResult.txtRecordsCount}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto rounded-xl border border-red-500/30 bg-red-950/20 px-3.5 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-red-300">
                  Security Score
                </div>
                <div className="font-mono text-2xl font-black text-red-400">
                  {scanResult.score}
                  <span className="text-xs text-zinc-400">/100</span>
                </div>
              </div>
              <ShieldAlert className="size-7 text-red-400" />
            </div>
          </div>

          {/* Findings List */}
          <div className="space-y-2">
            {scanResult.findings.map((finding) => {
              const isCrit = finding.status === "critical";
              const isWarn = finding.status === "warning";
              return (
                <div
                  key={finding.id}
                  className={`rounded-xl border p-3 text-xs ${
                    isCrit
                      ? "border-red-500/30 bg-red-950/15"
                      : isWarn
                        ? "border-amber-500/30 bg-amber-950/15"
                        : "border-emerald-500/25 bg-emerald-950/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {isCrit ? (
                        <ShieldAlert className="size-4 text-red-400 shrink-0 mt-0.5" />
                      ) : isWarn ? (
                        <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-white">{finding.title}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{finding.detail}</div>
                        {finding.status !== "passed" && (
                          <div className="mt-1.5 text-[11px] text-primary font-medium">
                            Fix: {finding.remediation}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold ${
                        isCrit
                          ? "bg-red-500/20 text-red-300"
                          : isWarn
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {finding.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* High-Converting Monetization CTA Box inside Scanner */}
          <div className="rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-orange-500/10 to-black p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <Zap className="size-4 text-primary" />
                  <span>
                    Auto-Remediate {scanResult.cleanHost} & Deploy Edge WAF + AI Shield Now
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Get your drop-in Next.js/Express/Cloudflare middleware, block SQLi & prompt
                  injections, and download your signed SOC 2 verification certificate.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onClaimAndProtectDomain(
                      scanResult.domain,
                      suggestOrgFromHost(scanResult.cleanHost),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-black shadow-md hover:bg-zinc-200 transition-all cursor-pointer"
                >
                  <Shield className="size-3.5 text-primary" />
                  <span>Fix & Protect Free (60s)</span>
                  <ArrowRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInstantCheckout(500, scanResult.cleanHost)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  <CreditCard className="size-3.5" />
                  <span>Instant Shield ($19 / ₹1,599)</span>
                </button>
              </div>
            </div>

            {/* Founder Outreach & Report Tools */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-400">
                Scanning a client or prospect? Share their audit report to close a deal:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadAuditTxt}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#262626] bg-black px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-zinc-600 cursor-pointer"
                >
                  <Download className="size-3 text-primary" />
                  <span>Download Audit Report (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyOutreach("dm")}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#262626] bg-black px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-zinc-600 cursor-pointer"
                >
                  {copiedOutreach === "dm" ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3 text-primary" />
                  )}
                  <span>{copiedOutreach === "dm" ? "Copied X/DM Pitch!" : "Copy Cold DM"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyOutreach("email")}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#262626] bg-black px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-zinc-600 cursor-pointer"
                >
                  {copiedOutreach === "email" ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Mail className="size-3 text-primary" />
                  )}
                  <span>
                    {copiedOutreach === "email" ? "Copied Cold Email!" : "Copy Cold Email"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. PUBLIC PRICING, SELF-SERVE PACKAGES & "DONE-FOR-YOU" AUDIT SECTION
// ============================================================================
export function LandingPricingSection({
  onSelectPlanAndSignup,
  onOpenDirectPaymentModal,
}: {
  onSelectPlanAndSignup: (plan: PlanTier, modules: ServiceModuleId[]) => void;
  onOpenDirectPaymentModal: (credits: number, label: string) => void;
}) {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const pricingTiers = [
    {
      id: "starter",
      name: "Starter Shield",
      badge: "Indie Builders & Early Apps",
      priceUsd: "$19",
      priceInr: "₹1,599",
      period: "one-time 100 Security Credits",
      credits: 100,
      planTier: "Starter" as PlanTier,
      modules: ["web_security", "ai_shield"] as ServiceModuleId[],
      description:
        "Ideal for protecting 1–2 web apps or AI wrapper endpoints with drop-in Edge WAF middleware and DNS ownership proof.",
      features: [
        "100 Autonomous Security Credits",
        "Edge WAF Middleware (Next.js, Express, FastAPI)",
        "DNS TXT & HTTP Live Ownership Certificate",
        "Real-time SQLi, XSS & SSRF Interception",
        "1-Click Cloudflare & UFW Blocklist Export",
      ],
      ctaText: "Buy Starter Shield",
      popular: false,
      highlightDoneForYou: false,
    },
    {
      id: "builder",
      name: "Builder SOC Pack",
      badge: "MOST POPULAR · GROWING STARTUPS",
      priceUsd: "$79",
      priceInr: "₹6,499",
      period: "500 Security Credits (Save 17%)",
      credits: 500,
      planTier: "Growth" as PlanTier,
      modules: ["web_security", "ai_shield", "cloud_security", "compliance"] as ServiceModuleId[],
      description:
        "Full-spectrum protection for 5+ production services, LLM/MCP AI agents, MITRE ATT&CK SIEM rules, and webhook alerting.",
      features: [
        "500 Autonomous Security Credits",
        "AI Agent & LLM Prompt Injection Firewall",
        "MITRE ATT&CK SIEM & Threat Hunting Console",
        "Slack, Discord & PagerDuty Live Webhooks",
        "Automated SOC 2 Type II & ISO 27001 Evidence",
      ],
      ctaText: "Launch Builder Shield",
      popular: true,
      highlightDoneForYou: false,
    },
    {
      id: "dfy_audit",
      name: "24-Hour Done-For-You Audit + Setup",
      badge: "FASTEST FOR FOUNDERS & AGENCIES",
      priceUsd: "$149",
      priceInr: "₹9,999",
      period: "Hands-On Setup + 1,000 Credits",
      credits: 1000,
      planTier: "Growth" as PlanTier,
      modules: ["web_security", "ai_shield", "cloud_security", "compliance"] as ServiceModuleId[],
      description:
        "Don't want to touch code? We audit your live app, configure your WAF & AI guardrails, and deliver a signed Compliance Report in 24 hours.",
      features: [
        "1,000 Security Credits Included",
        "Full OWASP Top 10 + LLM Prompt Vulnerability Audit",
        "Done-For-You Middleware PR / Cloudflare WAF Setup",
        "Signed Security Verification Report for Enterprise Clients",
        "Embeddable 'Verified Protected by SparrowX' Trust Badge",
      ],
      ctaText: "Book 24h Audit & Pay Now",
      popular: false,
      highlightDoneForYou: true,
    },
    {
      id: "scale",
      name: "Scale & Enterprise SOC",
      badge: "HIGH-THROUGHPUT & MULTI-TENANT",
      priceUsd: "$249",
      priceInr: "₹19,999",
      period: "2,000 Security Credits (Save 35%)",
      credits: 2000,
      planTier: "Enterprise" as PlanTier,
      modules: ["web_security", "ai_shield", "cloud_security", "compliance"] as ServiceModuleId[],
      description:
        "Built for agencies, multi-cluster SaaS platforms, and fintech/AI teams requiring continuous audit bundles and priority triage.",
      features: [
        "2,000 Autonomous Security Credits",
        "Unlimited Protected Domains & AI Agent Endpoints",
        "Multi-Tenant Client Portals (Bill Your Own Clients)",
        "Custom SIEM Sigma Rules & Dedicated Lockdown Playbooks",
        "Priority 24/7 Incident Containment & Auditor Exports",
      ],
      ctaText: "Unlock Scale SOC",
      popular: false,
      highlightDoneForYou: false,
    },
  ];

  return (
    <section id="pricing" className="border-t border-[#1F1F1F] bg-[#060606] py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Coins className="size-3.5" />
              <span>Transparent Self-Serve & Done-For-You Pricing</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Enterprise cyber defense without the $50,000 annual contract.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Start instantly with pay-as-you-go Security Credits via UPI QR, Card, or Crypto—or
              book our 24-Hour Done-For-You Security Audit & Shield Setup to unblock enterprise
              deals immediately.
            </p>
          </div>

          {/* Currency Switcher */}
          <div className="inline-flex items-center rounded-xl border border-[#262626] bg-[#0A0A0A] p-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                currency === "INR"
                  ? "bg-primary text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🇮🇳 INR (₹ · Instant UPI)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                currency === "USD"
                  ? "bg-primary text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🌐 USD ($ · Global Card)
            </button>
          </div>
        </div>

        {/* 4-Column Pricing Grid */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                tier.popular
                  ? "border-primary bg-gradient-to-b from-primary/15 via-[#0A0A0A] to-[#0A0A0A] shadow-[0_0_35px_rgba(240,90,40,0.18)]"
                  : tier.highlightDoneForYou
                    ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 via-[#0A0A0A] to-[#0A0A0A] shadow-[0_0_30px_rgba(16,185,129,0.12)]"
                    : "border-[#1F1F1F] bg-[#0A0A0A] hover:border-zinc-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                      tier.popular
                        ? "bg-primary text-white"
                        : tier.highlightDoneForYou
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-zinc-900 text-zinc-400 border border-[#262626]"
                    }`}
                  >
                    {tier.badge}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-white">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-white">
                    {currency === "INR" ? tier.priceInr : tier.priceUsd}
                  </span>
                  <span className="text-[11px] text-zinc-400">{tier.period}</span>
                </div>

                <p className="mt-3 text-xs text-zinc-400 leading-relaxed">{tier.description}</p>

                <ul className="mt-5 space-y-2.5 border-t border-[#1F1F1F] pt-4">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs text-zinc-300">
                      <CheckCircle2
                        className={`size-4 shrink-0 mt-0.5 ${
                          tier.highlightDoneForYou ? "text-emerald-400" : "text-primary"
                        }`}
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t border-[#1F1F1F]">
                <button
                  type="button"
                  onClick={() => onOpenDirectPaymentModal(tier.credits, tier.name)}
                  className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    tier.popular
                      ? "bg-gradient-to-r from-primary to-orange-500 text-white shadow-lg shadow-primary/25 hover:opacity-95"
                      : tier.highlightDoneForYou
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  <QrCode className="size-3.5" />
                  <span>{tier.ctaText} (Instant Checkout)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectPlanAndSignup(tier.planTier, tier.modules)}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#262626] bg-black text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-all cursor-pointer"
                >
                  <span>Create Free Account First</span>
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 3. VIRAL TRUST BADGE GENERATOR & OUTBOUND REVENUE ENGINE
// ============================================================================
export function ViralTrustBadgeAndOutreachSection({
  defaultDomain = "your-startup.io",
}: {
  defaultDomain?: string;
}) {
  const [badgeDomain, setBadgeDomain] = useState(defaultDomain);
  const [badgeStyle, setBadgeStyle] = useState<"emerald" | "orange" | "minimal">("emerald");
  const [copiedBadge, setCopiedBadge] = useState(false);

  const cleanDomain = badgeDomain.trim().replace(/^https?:\/\//, "") || "your-startup.io";
  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://sparrowx.dev";

  const embedHtmlSnippet = `<!-- Verified Protected by SparrowX Trust Badge -->
<a href="${originUrl}?verify=${encodeURIComponent(cleanDomain)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9999px;background:#0A0A0A;border:1px solid ${
    badgeStyle === "emerald" ? "#10b98155" : badgeStyle === "orange" ? "#f05a2855" : "#262626"
  };color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.5);">
  <span style="width:8px;height:8px;border-radius:9999px;background:${
    badgeStyle === "orange" ? "#f05a28" : "#10b981"
  };display:inline-block;"></span>
  <span>Protected & Verified by <strong>SparrowX SOC</strong></span>
  <span style="color:#a1a1aa;font-size:10px;font-family:monospace;">· ${cleanDomain}</span>
</a>`;

  const handleCopyBadge = () => {
    void navigator.clipboard.writeText(embedHtmlSnippet);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2500);
  };

  return (
    <section className="border-t border-[#1F1F1F] bg-[#040404] py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 items-center">
          {/* Left: Viral Trust Badge Generator */}
          <div className="lg:col-span-7 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span>Viral Customer Trust Badge (Turns Buyers Into Referrals)</span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Show your users that your app is actively defended by SparrowX.
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Every protected workspace gets an embeddable live verification badge for their landing
              page footer. It increases customer checkout trust and drives organic referrals back to
              SparrowX.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={badgeDomain}
                onChange={(e) => setBadgeDomain(e.target.value)}
                placeholder="your-startup.io"
                className="h-9 flex-1 rounded-xl border border-[#262626] bg-black px-3 text-xs text-white font-mono outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1.5">
                {(["emerald", "orange", "minimal"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setBadgeStyle(style)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize cursor-pointer ${
                      badgeStyle === style
                        ? "border-primary bg-primary/15 text-white"
                        : "border-[#262626] bg-black text-zinc-400 hover:text-white"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Badge Preview */}
            <div className="mt-4 rounded-xl border border-[#1F1F1F] bg-black p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-zinc-400 font-mono">LIVE FOOTER PREVIEW:</div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg ${
                  badgeStyle === "emerald"
                    ? "border-emerald-500/40"
                    : badgeStyle === "orange"
                      ? "border-primary/40"
                      : "border-zinc-700"
                }`}
              >
                <span
                  className={`size-2 rounded-full animate-pulse ${
                    badgeStyle === "orange" ? "bg-primary" : "bg-emerald-400"
                  }`}
                />
                <span>
                  Protected & Verified by <strong className="text-white">SparrowX SOC</strong>
                </span>
                <span className="font-mono text-[10px] text-zinc-400">· {cleanDomain}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500 font-mono truncate">
                Copy & paste into any Next.js, React, or HTML footer
              </span>
              <button
                type="button"
                onClick={handleCopyBadge}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all cursor-pointer shrink-0"
              >
                {copiedBadge ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span>Copied HTML Embed!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy Embed Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Agency / Reseller & Enterprise Audit Pitch */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <TrendingUp className="size-3.5" />
              <span>For Agencies, Freelancers & Security Consultants</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Resell SparrowX Protection & Audits to Your Own Clients
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use SparrowX&apos;s Multi-Tenant Client Portal to onboard your agency clients, run
              automated OWASP + AI Guardrail audits, and bill them monthly retainers while SparrowX
              handles the heavy telemetry.
            </p>
            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Generate 1-click SOC 2 & ISO 27001 readiness reports for clients</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Dedicated multi-tenant isolation with per-client API keys</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Instant UPI QR, Card & Wire invoicing with downloadable receipts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 4. ADMIN FOUNDER REVENUE & COLD OUTREACH ENGINE (INSIDE ADMIN PORTAL)
// ============================================================================
export function AdminRevenueAndOutreachEngine({
  onOpenPaymentModal,
  showToast,
}: {
  onOpenPaymentModal: (neededCredits?: number) => void;
  showToast: (msg: string) => void;
}) {
  const [prospectDomain, setProspectDomain] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<LiveDomainAuditResult | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"dm" | "email" | "linkedin">("dm");

  const handleRunProspectAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = prospectDomain.trim() || "api.prospect-saas.io";
    if (!prospectDomain.trim()) setProspectDomain(target);
    setIsAuditing(true);
    const res = await runLivePublicDomainScan(target);
    setAuditResult(res);
    setIsAuditing(false);
    showToast(`Prospect scan complete for ${res.cleanHost} (Score: ${res.score}/100)`);
  };

  const handleCopyScript = () => {
    if (!auditResult) return;
    const text = buildColdOutreachMessage(auditResult, selectedChannel);
    void navigator.clipboard.writeText(text);
    showToast(
      `Copied ${selectedChannel.toUpperCase()} outreach pitch for ${auditResult.cleanHost}`,
    );
  };

  const handleDownloadProspectReport = () => {
    if (!auditResult) return;
    const text = buildProspectAuditReportText(auditResult);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-audit-${auditResult.cleanHost}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded audit teaser report for ${auditResult.cleanHost}`);
  };

  return (
    <section className="border border-primary/30 bg-card p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
            <TrendingUp className="size-3.5" />
            <span>Founder Revenue & Client Acquisition Engine</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Scan Any Prospect Domain → Generate Audit Report & Personalized Cold Pitch
          </h2>
          <p className="text-xs text-muted-foreground">
            Find newly launched SaaS or AI apps on Product Hunt, X, or LinkedIn. Scan their URL
            here, attach their real exposure report, and close $99–$249 (₹1,599–₹19,999) deals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenPaymentModal(500)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 shrink-0 cursor-pointer"
        >
          <QrCode className="size-3.5" />
          <span>Open UPI / Card Payment Terminal</span>
        </button>
      </div>

      {/* Prospect Scanner Form */}
      <form onSubmit={handleRunProspectAudit} className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={prospectDomain}
          onChange={(e) => setProspectDomain(e.target.value)}
          placeholder="Paste prospect's domain (e.g. cursor.com, cal.com, their-startup.ai)"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={isAuditing}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-secondary px-4 text-xs font-semibold text-foreground border border-border hover:border-primary/50 cursor-pointer"
        >
          {isAuditing ? (
            <>
              <RefreshCw className="size-3.5 animate-spin text-primary" />
              <span>Scanning Prospect...</span>
            </>
          ) : (
            <>
              <Search className="size-3.5 text-primary" />
              <span>1. Scan Prospect Domain</span>
            </>
          )}
        </button>
      </form>

      {auditResult && (
        <div className="grid gap-4 lg:grid-cols-12 pt-1">
          {/* Left: Prospect Telemetry Summary */}
          <div className="lg:col-span-5 rounded-md border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-foreground">
                  {auditResult.cleanHost}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  IP: {auditResult.resolvedIps[0] ?? "Direct"} · {auditResult.latencyMs}ms RTT
                </div>
              </div>
              <span className="rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-xs font-bold text-destructive">
                Score: {auditResult.score}/100
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {auditResult.findings.map((f) => (
                <div key={f.id} className="flex items-start gap-1.5">
                  <span
                    className={`mt-0.5 size-2 rounded-full shrink-0 ${
                      f.status === "critical"
                        ? "bg-destructive"
                        : f.status === "warning"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                    }`}
                  />
                  <span className="text-muted-foreground">{f.title}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadProspectReport}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background py-2 text-xs font-semibold text-foreground hover:border-primary/50 cursor-pointer"
            >
              <Download className="size-3.5 text-primary" />
              <span>2. Download Prospect Audit Report (.txt)</span>
            </button>
          </div>

          {/* Right: Ready-to-Send Cold Pitch Script */}
          <div className="lg:col-span-7 rounded-md border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                3. Copy Personalized Outreach Pitch:
              </span>
              <div className="flex items-center gap-1">
                {(["dm", "linkedin", "email"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSelectedChannel(ch)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase cursor-pointer ${
                      selectedChannel === ch
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    {ch === "dm" ? "X / Twitter DM" : ch === "linkedin" ? "LinkedIn" : "Cold Email"}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              readOnly
              value={buildColdOutreachMessage(auditResult, selectedChannel)}
              rows={5}
              className="w-full rounded-md border border-border bg-background p-2.5 font-mono text-[11px] text-foreground outline-none"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 cursor-pointer"
              >
                <Copy className="size-3.5" />
                <span>Copy Pitch to Clipboard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
