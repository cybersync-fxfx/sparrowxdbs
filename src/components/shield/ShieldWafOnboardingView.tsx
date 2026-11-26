import React, { useId, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Info,
  Layers,
  Lock,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  persistAssetToBackend,
  persistClientTenantToBackend,
  persistProtectedServiceToBackend,
  type AppUser,
  type Asset,
  type ClientTenant,
  type ProtectedService,
  type ServiceModuleId,
} from "@/lib/supabase";
import {
  runLivePublicDomainScan,
  validateSafePublicTarget,
  type LiveDomainAuditResult,
} from "@/components/GrowthAndMonetizationHub";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { ShieldEdgeCheckingPage } from "./ShieldEdgeCheckingPage";

export interface ShieldWafOnboardingViewProps {
  activeUser: AppUser;
  onDomainConnected: (result: {
    tenant: ClientTenant;
    service: ProtectedService;
    asset: Asset;
  }) => void;
  onDomainVerified?: (tenant: ClientTenant) => void;
  onLaunchWorkbench: () => void;
  onBackToClientArea: () => void;
  onSignOut: () => void;
}

type TargetCategory = "web" | "api" | "ai" | "proxy";
type ProtectionStrictness = "balanced" | "strict" | "monitor";
type ConnectMethodTab = "cloudflare" | "dns" | "sdk";

interface CloudflareConfigResult {
  zone: { id: string; name: string };
  actions: Array<{
    type: "TXT" | "CNAME";
    name: string;
    target: string;
    status: "created" | "updated";
    proxied: boolean;
  }>;
  replacedRecords: Array<{ type: string; name: string; content: string; proxied?: boolean }>;
}

interface DnsVerifyResult {
  cnameVerified: boolean;
  txtVerified: boolean;
  flattenedMatch: boolean;
  observedCnames: string[];
  observedIps: string[];
  observedTxts: string[];
  checkedAt: string;
}

/**
 * Splits a domain like "app.example.com" or "example.com" into the short Host/Name
 * value expected by Cloudflare / Namecheap / GoDaddy DNS dashboards.
 */
function resolveDnsHostLabels(domain: string): {
  isApex: boolean;
  cnameHostShort: string;
  txtHostShort: string;
  cnameFqdn: string;
  txtFqdn: string;
} {
  const clean = domain.trim().toLowerCase().replace(/\.$/, "");
  const parts = clean.split(".").filter(Boolean);
  const multiPartSlds = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
  const hasMultiPartTld =
    parts.length >= 3 &&
    parts[parts.length - 1]!.length === 2 &&
    multiPartSlds.has(parts[parts.length - 2]!);
  const apexPartCount = hasMultiPartTld ? 3 : 2;
  const isApex = parts.length <= apexPartCount;
  const subPrefix = isApex ? "" : parts.slice(0, parts.length - apexPartCount).join(".");

  return {
    isApex,
    cnameHostShort: isApex ? "@" : subPrefix,
    txtHostShort: isApex ? "_sparrowx-verify" : `_sparrowx-verify.${subPrefix}`,
    cnameFqdn: clean || "yourdomain.com",
    txtFqdn: `_sparrowx-verify.${clean || "yourdomain.com"}`,
  };
}

const TARGET_STACKS: Array<{
  id: TargetCategory;
  label: string;
  desc: string;
  serviceCategory: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "web",
    label: "Website / Web App",
    desc: "Next.js, React, SaaS, WordPress & e-commerce",
    serviceCategory: "Web App & Website",
    icon: Globe,
  },
  {
    id: "api",
    label: "REST / GraphQL API",
    desc: "Node, Go, Python & edge microservice APIs",
    serviceCategory: "Backend API",
    icon: Server,
  },
  {
    id: "ai",
    label: "AI / LLM Endpoint",
    desc: "Prompt injection & PII redaction guardrails",
    serviceCategory: "AI Agent & LLM",
    icon: Bot,
  },
  {
    id: "proxy",
    label: "Origin Server / VPS",
    desc: "Bare-metal VPS, Docker & custom backend origin",
    serviceCategory: "Edge Origin Proxy",
    icon: Layers,
  },
];

const DEFENSE_MODULES: Array<{
  id: ServiceModuleId;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "web_security",
    title: "Edge L7 WAF & OWASP Core",
    desc: "Blocks SQLi, XSS, SSRF, RCE, and path traversal at the perimeter.",
    icon: ShieldCheck,
  },
  {
    id: "cloud_security",
    title: "L7 DDoS & Bot Mitigation",
    desc: "Adaptive rate-limiting and automated headless scraper deflection.",
    icon: Zap,
  },
  {
    id: "ai_shield",
    title: "AI Prompt & PII Firewall",
    desc: "Intercepts prompt jailbreaks, credential leaks, and unsafe tool calls.",
    icon: Sparkles,
  },
  {
    id: "compliance",
    title: "SOC Telemetry & Audit Stream",
    desc: "Streams live request inspection and alerts into your SOC Workbench.",
    icon: Activity,
  },
];

function generateSensorKey(): string {
  const bytes = new Uint8Array(14);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `spx_waf_${hex || Date.now().toString(16)}`;
}

function legacyCopyFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  const previousFocus = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.({ preventScroll: true });
  }
}

export function ShieldWafOnboardingView({
  activeUser,
  onDomainConnected,
  onDomainVerified,
  onLaunchWorkbench,
  onBackToClientArea,
  onSignOut,
}: ShieldWafOnboardingViewProps) {
  const [previewCheckingPage, setPreviewCheckingPage] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Domain target
  const [domainInput, setDomainInput] = useState("");
  const [workspaceLabel, setWorkspaceLabel] = useState("");
  const [targetStack, setTargetStack] = useState<TargetCategory>("web");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleanHost, setCleanHost] = useState("");
  const [preflightAudit, setPreflightAudit] = useState<LiveDomainAuditResult | null>(null);

  // Step 2: Protection profile
  const [selectedModules, setSelectedModules] = useState<ServiceModuleId[]>([
    "web_security",
    "cloud_security",
    "compliance",
  ]);
  const [strictness, setStrictness] = useState<ProtectionStrictness>("balanced");
  const [provisioning, setProvisioning] = useState(false);

  // Step 3: Provisioned credentials & verification
  const [provisionedTenant, setProvisionedTenant] = useState<ClientTenant | null>(null);
  const [connectTab, setConnectTab] = useState<ConnectMethodTab>("cloudflare");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyStatusText, setCopyStatusText] = useState("");
  const lastAnnouncementRef = useRef("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const domainInputRef = useRef<HTMLInputElement | null>(null);
  const domainErrorId = useId();

  // Cloudflare 1-Click Auto-Configuration state (token stays transient in RAM only)
  const [cfApiToken, setCfApiToken] = useState("");
  const [showCfToken, setShowCfToken] = useState(false);
  const [cfReplaceA, setCfReplaceA] = useState(true);
  const [cfIncludeWww, setCfIncludeWww] = useState(false);
  const [cfSubmitting, setCfSubmitting] = useState(false);
  const [cfError, setCfError] = useState<string | null>(null);
  const [cfResult, setCfResult] = useState<CloudflareConfigResult | null>(null);
  const cfTokenInputRef = useRef<HTMLInputElement | null>(null);
  const cfTokenId = useId();
  const cfTokenHelpId = useId();
  const cfTokenErrorId = useId();
  const cfReplaceAId = useId();
  const cfIncludeWwwId = useId();

  // Live DNS propagation verifier state
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsVerifyResult, setDnsVerifyResult] = useState<DnsVerifyResult | null>(null);
  const [dnsVerifyError, setDnsVerifyError] = useState<string | null>(null);

  const toggleModule = (mod: ServiceModuleId) => {
    setSelectedModules((prev) => {
      if (prev.includes(mod)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleCopyValue = async (id: string, text: string, label: string) => {
    if (!text) return;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        ok = legacyCopyFallback(text);
      }
    } catch {
      ok = legacyCopyFallback(text);
    }

    let message = ok ? `${label} copied` : "Copy failed";
    if (message === lastAnnouncementRef.current) {
      message += "\u00A0";
    }
    lastAnnouncementRef.current = message;
    setCopiedKey(ok ? id : null);
    setCopyStatusText(message);
    if (ok) {
      emitEngineToast("Ready to paste into your DNS provider or server.", "success", `${label} copied`);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedKey(null);
      setCopyStatusText("");
    }, 2200);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainError(null);
    const check = validateSafePublicTarget(domainInput);
    if (!check.valid) {
      setDomainError(check.error ?? "Enter a valid public domain such as yourdomain.com.");
      domainInputRef.current?.focus();
      return;
    }

    setCleanHost(check.cleanHost);
    if (targetStack === "ai" && !selectedModules.includes("ai_shield")) {
      setSelectedModules((prev) => [...prev, "ai_shield"]);
    }

    setScanning(true);
    try {
      const scanPromise = runLivePublicDomainScan(check.cleanHost).catch(() => null);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500));
      const auditResult = await Promise.race([scanPromise, timeoutPromise]);
      setPreflightAudit(auditResult);
    } finally {
      setScanning(false);
      setStep(2);
    }
  };

  const handleProvisionWaf = async () => {
    if (!cleanHost) return;
    setProvisioning(true);
    try {
      const apiKey = generateSensorKey();
      const nowSlug = Date.now().toString(36);
      const tenantId = `tnt-${nowSlug}`;
      const displayName = workspaceLabel.trim() || cleanHost;
      const stackMeta = TARGET_STACKS.find((s) => s.id === targetStack) ?? TARGET_STACKS[0]!;
      const modeLabel =
        strictness === "strict"
          ? "Strict Under-Attack Shield"
          : strictness === "monitor"
            ? "Monitor & Inspect"
            : "Active Shield";

      const newTenant: ClientTenant = {
        id: tenantId,
        name: displayName,
        contactEmail: activeUser.email,
        primaryDomain: cleanHost,
        planTier: "SparrowX Edge Shield",
        status: "Active",
        enabledModules: selectedModules,
        apiKey,
        sdkVerified: false,
        guardrailsActive: selectedModules.includes("ai_shield"),
        requestsPerMin: 0,
        blockedThreats: 0,
        avgLatencyMs: 0,
        quotaUsedPct: 0,
      };

      const newService: ProtectedService = {
        id: `svc-${nowSlug}`,
        tenantId,
        name: displayName,
        category: stackMeta.serviceCategory,
        endpoint: `https://${cleanHost}`,
        mode: modeLabel,
        requests24h: "0 req",
        blockedThreats: 0,
        apiKey,
        promptShield: selectedModules.includes("ai_shield"),
        piiRedaction: selectedModules.includes("ai_shield"),
        toolCallFirewall: selectedModules.includes("web_security"),
        lastHeartbeat: "Awaiting edge verification",
      };

      const newAsset: Asset = {
        id: `ast-${nowSlug}`,
        name: displayName,
        type: stackMeta.id === "api" ? "API Gateway" : stackMeta.id === "ai" ? "AI Service" : "Web Application",
        endpoint: `https://${cleanHost}`,
        owner: activeUser.email,
        status: "Protected",
        riskScore: preflightAudit ? Math.max(5, 100 - preflightAudit.score) : 18,
        lastScanned: "Just now",
      };

      await Promise.all([
        persistClientTenantToBackend(newTenant),
        persistProtectedServiceToBackend(newService),
        persistAssetToBackend(newAsset),
      ]).catch(() => {});

      setProvisionedTenant(newTenant);
      onDomainConnected({
        tenant: newTenant,
        service: newService,
        asset: newAsset,
      });

      emitEngineToast(
        `${cleanHost} provisioned with Edge WAF sensor key.`,
        "success",
        "WAF Perimeter Ready",
      );
      setStep(3);
    } finally {
      setProvisioning(false);
    }
  };

  const verifyToken = provisionedTenant
    ? `spx-verify=${provisionedTenant.apiKey.slice(-14)}`
    : "spx-verify=pending";

  const dnsLabels = resolveDnsHostLabels(provisionedTenant?.primaryDomain || cleanHost || "yourdomain.com");

  const handleVerifyDnsLive = async (overrideDomain?: string, overrideVerifyToken?: string) => {
    const targetDomain = overrideDomain || provisionedTenant?.primaryDomain;
    const targetToken = overrideVerifyToken || verifyToken;
    if (!targetDomain || dnsChecking) return;

    setDnsChecking(true);
    setDnsVerifyError(null);
    try {
      const res = await fetch("/api/shield/dns-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: targetDomain, verifyToken: targetToken }),
      });
      const data = (await res.json().catch(() => null)) as
        | ({ ok: true } & DnsVerifyResult)
        | { ok: false; error?: string }
        | null;

      if (!res.ok || !data || !data.ok) {
        throw new Error((data && "error" in data && data.error) || "Live DNS verification check failed.");
      }

      setDnsVerifyResult({
        cnameVerified: data.cnameVerified,
        txtVerified: data.txtVerified,
        flattenedMatch: data.flattenedMatch,
        observedCnames: data.observedCnames,
        observedIps: data.observedIps,
        observedTxts: data.observedTxts,
        checkedAt: data.checkedAt,
      });

      if (data.cnameVerified || data.txtVerified) {
        if (provisionedTenant && !provisionedTenant.sdkVerified) {
          const verifiedTenant: ClientTenant = { ...provisionedTenant, sdkVerified: true };
          setProvisionedTenant(verifiedTenant);
          onDomainVerified?.(verifiedTenant);
        }
        emitEngineToast(
          `Connection verified live for ${targetDomain} — saved to your active monitor list.`,
          "success",
          "DNS Verified Live",
        );
      }
    } catch (err) {
      setDnsVerifyError(
        err instanceof Error ? err.message : "Could not check DNS propagation right now.",
      );
    } finally {
      setDnsChecking(false);
    }
  };

  const handleCloudflareAutoConfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionedTenant || cfSubmitting) return;

    const trimmedToken = cfApiToken.trim();
    if (trimmedToken.length < 20) {
      setCfError("Paste a valid Cloudflare API Token with Zone → DNS → Edit permission.");
      cfTokenInputRef.current?.focus();
      return;
    }

    setCfError(null);
    setCfSubmitting(true);
    try {
      const res = await fetch("/api/shield/cloudflare-autoconfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiToken: trimmedToken,
          domain: provisionedTenant.primaryDomain,
          verifyToken,
          replaceExistingA: cfReplaceA,
          includeWww: dnsLabels.isApex ? cfIncludeWww : false,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | ({ ok: true } & CloudflareConfigResult)
        | { ok: false; error?: string }
        | null;

      if (!res.ok || !data || !data.ok) {
        const errMsg =
          (data && "error" in data && data.error) ||
          "Cloudflare DNS auto-configuration failed. Verify token permissions and try again.";
        setCfError(errMsg);
        cfTokenInputRef.current?.focus();
        return;
      }

      setCfResult({
        zone: data.zone,
        actions: data.actions,
        replacedRecords: data.replacedRecords ?? [],
      });
      // Immediately wipe the API token from component state after successful setup
      setCfApiToken("");
      setShowCfToken(false);
      emitEngineToast(
        `Configured ${data.actions.length} DNS record(s) in Cloudflare zone ${data.zone.name}.`,
        "success",
        "Cloudflare Auto-Configured",
      );
      void handleVerifyDnsLive(provisionedTenant.primaryDomain, verifyToken);
    } catch (err) {
      setCfError(
        err instanceof Error
          ? err.message
          : "Network error reaching Cloudflare auto-config endpoint.",
      );
      cfTokenInputRef.current?.focus();
    } finally {
      setCfSubmitting(false);
    }
  };

  const sdkSnippet = `<!-- Paste before </head> on ${cleanHost || "yourdomain.com"} for Cloudflare-style Edge Browser Checking + Live WAF Telemetry -->
<script
  src="https://sec.sparrowx.net/sparrowx-shield.js"
  data-spx-key="${provisionedTenant?.apiKey ?? "spx_waf_key"}"
  data-spx-tenant="${provisionedTenant?.id ?? "tnt_sparrowx"}"
  data-spx-domain="${cleanHost || "yourdomain.com"}"
  data-spx-challenge="${strictness === "strict" ? "always" : "true"}"
></script>`;

  const stepsMeta = [
    { num: 1 as const, label: "Target Domain" },
    { num: 2 as const, label: "WAF Profile" },
    { num: 3 as const, label: "Connect & Launch" },
  ];

  return (
    <div className="min-h-screen bg-[#04060B] text-[#F4F6FA] font-soc flex flex-col relative overflow-x-hidden">
      {/* Subtle radial ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(249,16,58,0.12),rgba(16,185,129,0.06)_45%,transparent_72%)]"
      />

      {/* Screen-reader polite status region for copy feedback (outside buttons per copy-button guidance) */}
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatusText}
      </span>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070D]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto min-h-14 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToClientArea}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] hover:bg-white/[0.08] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Client Area</span>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logos/sparrowx-shield.png"
                alt="SparrowX Shield"
                width={30}
                height={30}
                className="size-7.5 object-contain shrink-0"
              />
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold text-white truncate">Connect Website for WAF</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 truncate">
                  SparrowX Shield · Edge Setup
                </div>
              </div>
            </div>
          </div>

          {/* 3-Step Indicator */}
          <nav aria-label="WAF onboarding steps" className="hidden md:flex items-center gap-2">
            {stepsMeta.map((s, idx) => {
              const isDone = step > s.num;
              const isCurrent = step === s.num;
              return (
                <React.Fragment key={s.num}>
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isCurrent
                        ? "border-[#F9103A]/60 bg-[#F9103A]/15 text-white shadow-[0_0_20px_rgba(249,16,58,0.2)]"
                        : isDone
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/[0.02] text-zinc-400"
                    }`}
                  >
                    <span
                      className={`size-4 rounded-full grid place-items-center text-[10px] font-mono font-bold ${
                        isCurrent
                          ? "bg-[#F9103A] text-white"
                          : isDone
                            ? "bg-emerald-500 text-black"
                            : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {isDone ? <Check className="size-2.5" aria-hidden="true" /> : s.num}
                    </span>
                    <span>{s.label}</span>
                  </div>
                  {idx < stepsMeta.length - 1 && (
                    <span className="h-px w-5 bg-white/15" aria-hidden="true" />
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLaunchWorkbench}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
            >
              <span>Skip to Workbench</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="hidden lg:inline-flex min-h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-zinc-400 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Onboarding Canvas */}
      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Mobile Step Bar */}
        <div className="md:hidden mb-6 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0A0D16] px-3.5 py-2.5 text-xs">
          <span className="font-mono text-zinc-400">STEP {step} OF 3</span>
          <span className="font-semibold text-white">{stepsMeta[step - 1]?.label}</span>
        </div>

        {/* ================================================================ */}
        {/* STEP 1: TARGET DOMAIN & APPLICATION TYPE                         */}
        {/* ================================================================ */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-mono text-emerald-300">
                <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
                <span>AUTONOMOUS EDGE WAF · 60-SECOND SETUP</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.12]">
                Connect your domain or website before entering the SOC
              </h1>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Add your site or API so SparrowX can inspect live L7 traffic, block DDoS &amp; OWASP attacks, and populate your Autonomous SOC Workbench with real telemetry.
              </p>
            </div>

            <form
              noValidate
              onSubmit={handleStep1Submit}
              className="vibe-glass-panel rounded-2xl p-6 sm:p-8 space-y-6"
            >
              {/* Domain + Workspace Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7 space-y-1.5">
                  <label
                    htmlFor="waf-onboarding-domain"
                    className="block text-xs font-semibold text-zinc-200"
                  >
                    Website or Domain Name <span aria-hidden="true" className="text-[#F9103A]">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 text-xs font-mono text-zinc-400 select-none">
                      https://
                    </span>
                    <input
                      ref={domainInputRef}
                      id="waf-onboarding-domain"
                      name="domain"
                      type="text"
                      required
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      enterKeyHint="next"
                      value={domainInput}
                      onChange={(e) => {
                        setDomainInput(e.target.value);
                        if (domainError) setDomainError(null);
                      }}
                      aria-invalid={Boolean(domainError)}
                      aria-describedby={domainError ? domainErrorId : undefined}
                      placeholder="yourdomain.com"
                      className={`w-full min-h-[48px] rounded-xl border bg-[#06080E] pl-[4.75rem] pr-4 text-base sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 transition-colors ${
                        domainError
                          ? "border-red-500/70 focus-visible:ring-red-500/50"
                          : "border-white/15 hover:border-white/30 focus-visible:border-[#F9103A] focus-visible:ring-[#F9103A]/40"
                      }`}
                    />
                  </div>
                  {domainError && (
                    <p
                      id={domainErrorId}
                      role="alert"
                      className="text-xs text-red-400 flex items-center gap-1.5 pt-1"
                    >
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{domainError}</span>
                    </p>
                  )}
                </div>

                <div className="sm:col-span-5 space-y-1.5">
                  <label
                    htmlFor="waf-onboarding-label"
                    className="block text-xs font-semibold text-zinc-200"
                  >
                    Workspace Label <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="waf-onboarding-label"
                    name="workspaceLabel"
                    type="text"
                    enterKeyHint="done"
                    value={workspaceLabel}
                    onChange={(e) => setWorkspaceLabel(e.target.value)}
                    placeholder="Production Storefront"
                    className="w-full min-h-[48px] rounded-xl border border-white/15 bg-[#06080E] hover:border-white/30 px-4 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus-visible:border-[#F9103A] focus-visible:ring-2 focus-visible:ring-[#F9103A]/40 transition-colors"
                  />
                </div>
              </div>

              {/* Target Stack Selector */}
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold text-zinc-200">
                  What are you protecting?
                </span>
                <div
                  role="radiogroup"
                  aria-label="Protected target type"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                >
                  {TARGET_STACKS.map((item) => {
                    const Icon = item.icon;
                    const active = targetStack === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTargetStack(item.id)}
                        className={`text-left rounded-xl border p-4 transition-all cursor-pointer space-y-2 ${
                          active
                            ? "border-[#F9103A] bg-[#F9103A]/12 shadow-[0_0_24px_rgba(249,16,58,0.18)]"
                            : "border-white/12 bg-[#070A12] hover:border-white/30 hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`size-8 rounded-lg grid place-items-center border ${
                              active
                                ? "border-[#F9103A]/50 bg-[#F9103A]/20 text-[#FF6B84]"
                                : "border-white/10 bg-white/[0.04] text-zinc-300"
                            }`}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          {active && <CheckCircle2 className="size-4 text-[#F9103A]" aria-hidden="true" />}
                        </div>
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="text-[11px] text-zinc-400 leading-snug">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Row */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Lock className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Zero downtime · Instant DNS or lightweight Edge snippet</span>
                </div>
                <button
                  type="submit"
                  disabled={scanning}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F9103A] hover:bg-[#E00E34] disabled:opacity-60 px-6 text-sm font-semibold text-white shadow-[0_0_28px_rgba(249,16,58,0.35)] transition-all cursor-pointer"
                >
                  {scanning ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                      <span>Running Live Edge Pre-Flight Scan...</span>
                    </>
                  ) : (
                    <>
                      <span>Scan Domain &amp; Continue</span>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: LIVE PRE-FLIGHT + WAF PROTECTION PROFILE                 */}
        {/* ================================================================ */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">
                  Target Verified · Configure Defense Rules
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Configure WAF Shield for <span className="font-mono text-[#FF6B84]">{cleanHost}</span>
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3.5 text-xs font-medium text-zinc-200 cursor-pointer w-fit"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Change Domain</span>
              </button>
            </div>

            {/* Real Live Pre-Flight Telemetry Banner */}
            <div className="vibe-glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-11 rounded-xl bg-emerald-500/15 border border-emerald-500/35 grid place-items-center text-emerald-400 shrink-0">
                  <Globe className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white truncate">{cleanHost}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono text-zinc-200">
                      {TARGET_STACKS.find((s) => s.id === targetStack)?.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {preflightAudit
                      ? `Live scan detected ${preflightAudit.findings.length} security headers & perimeter checks (${preflightAudit.deepTelemetry?.wafProvider ?? "Direct origin"}).`
                      : "Origin ready for SparrowX L7 Edge WAF & Autonomous SOC telemetry."}
                  </p>
                </div>
              </div>

              {preflightAudit && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="rounded-xl border border-white/12 bg-[#070A12] px-4 py-2 text-right tabular-nums">
                    <div className="text-[10px] font-mono uppercase text-zinc-400">Baseline Score</div>
                    <div className="text-lg font-bold text-white">
                      {preflightAudit.score}
                      <span className="text-xs text-zinc-400">/100</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Defense Modules & Protection Mode */}
            <div className="vibe-glass-panel rounded-2xl p-6 sm:p-7 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">Active Edge Protection Modules</h2>
                  <span className="text-xs font-mono text-zinc-400">
                    {selectedModules.length} of {DEFENSE_MODULES.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEFENSE_MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const enabled = selectedModules.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        aria-pressed={enabled}
                        onClick={() => toggleModule(mod.id)}
                        className={`text-left rounded-xl border p-4 transition-all cursor-pointer flex items-start gap-3.5 ${
                          enabled
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-white/10 bg-[#070A12] hover:border-white/25"
                        }`}
                      >
                        <span
                          className={`mt-0.5 size-8 rounded-lg grid place-items-center shrink-0 border ${
                            enabled
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                              : "border-white/10 bg-white/[0.04] text-zinc-400"
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white">{mod.title}</span>
                            <span
                              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                                enabled
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/10 text-zinc-400"
                              }`}
                            >
                              {enabled ? "ON" : "OFF"}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{mod.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enforcement Mode */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <span className="block text-xs font-semibold text-white">WAF Enforcement Mode</span>
                <div
                  role="radiogroup"
                  aria-label="WAF enforcement mode"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {(
                    [
                      {
                        id: "balanced" as const,
                        title: "Balanced (Recommended)",
                        desc: "Blocks high-confidence attacks with zero false positives.",
                      },
                      {
                        id: "strict" as const,
                        title: "Strict / Under Attack",
                        desc: "Aggressive bot challenge & tight rate limits immediately.",
                      },
                      {
                        id: "monitor" as const,
                        title: "Monitor Only",
                        desc: "Log & score every threat in SOC without dropping traffic.",
                      },
                    ]
                  ).map((opt) => {
                    const active = strictness === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setStrictness(opt.id)}
                        className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer space-y-1 ${
                          active
                            ? "border-[#F9103A] bg-[#F9103A]/12"
                            : "border-white/10 bg-[#070A12] hover:border-white/25"
                        }`}
                      >
                        <div className="text-xs font-semibold text-white flex items-center justify-between">
                          <span>{opt.title}</span>
                          {active && <Check className="size-3.5 text-[#F9103A]" aria-hidden="true" />}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
                <span className="text-xs text-zinc-400">
                  Creates an isolated tenant key for <strong className="text-zinc-200">{activeUser.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleProvisionWaf}
                  disabled={provisioning}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F9103A] hover:bg-[#E00E34] disabled:opacity-60 px-6 text-sm font-semibold text-white shadow-[0_0_28px_rgba(249,16,58,0.35)] transition-all cursor-pointer"
                >
                  {provisioning ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                      <span>Provisioning Edge WAF...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="size-4" aria-hidden="true" />
                      <span>Provision WAF &amp; Generate Setup</span>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: CLOUDFLARE 1-CLICK & GUIDED DNS SETUP + LAUNCH WORKBENCH */}
        {/* ================================================================ */}
        {step === 3 && provisionedTenant && (
          <div className="space-y-6">
            {/* Success Hero Banner */}
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 grid place-items-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {provisionedTenant.primaryDomain} is armed for SparrowX WAF
                  </h1>
                  <p className="text-xs sm:text-sm text-emerald-100/85">
                    No Nginx or server edits required — auto-configure your Cloudflare DNS in 1 click or follow the 3-step manual DNS guide below, then launch your Autonomous SOC Workbench.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLaunchWorkbench}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 px-5 text-xs sm:text-sm font-bold text-black shadow-lg transition-colors cursor-pointer shrink-0"
              >
                <span>Enter SOC Workbench</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Connection Methods Card */}
            <div className="vibe-glass-panel rounded-2xl overflow-hidden">
              {/* Method Tabs (DNS-first — no Nginx required) */}
              <div
                role="tablist"
                aria-label="WAF DNS connection methods"
                className="border-b border-white/10 bg-[#070A12] px-4 sm:px-6 pt-4 flex flex-wrap gap-2"
              >
                {(
                  [
                    { id: "cloudflare" as const, label: "1. Cloudflare Auto-Setup (1-Click)", icon: Cloud },
                    { id: "dns" as const, label: "2. Manual DNS Setup (Step-by-Step)", icon: Globe },
                    { id: "sdk" as const, label: "3. 1-Line Website Script (Optional)", icon: Code2 },
                  ]
                ).map((t) => {
                  const Icon = t.icon;
                  const active = connectTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setConnectTab(t.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
                        active
                          ? "border-[#F9103A] bg-white/[0.06] text-white"
                          : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {/* TAB 1: CLOUDFLARE 1-CLICK AUTO-CONFIGURATION */}
                {connectTab === "cloudflare" && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/[0.07] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h2
                          id="cf-autoconfig-heading"
                          className="text-sm font-semibold text-white flex items-center gap-2"
                        >
                          <Cloud className="size-4 text-orange-400 shrink-0" aria-hidden="true" />
                          <span>1-Click Cloudflare DNS Auto-Configuration</span>
                        </h2>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          Using Cloudflare for <code className="font-mono text-white">{provisionedTenant.primaryDomain}</code>? Paste a scoped Cloudflare API Token once and SparrowX automatically creates your <strong className="text-white">CNAME → edge.sparrowx.net</strong> (DNS Only / Grey Cloud) and <strong className="text-white">TXT verification</strong> records.
                        </p>
                      </div>
                      <a
                        href="https://dash.cloudflare.com/profile/api-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 hover:bg-orange-500/25 px-3.5 text-xs font-semibold text-orange-200 transition-colors shrink-0"
                      >
                        <span>Open Cloudflare Tokens</span>
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    </div>

                    {/* Non-exclusive step-by-step disclosure (no heading inside summary) */}
                    <details
                      open
                      className="rounded-xl border border-white/10 bg-[#060910] px-4 py-3 text-xs text-zinc-300"
                    >
                      <summary className="cursor-pointer font-semibold text-zinc-100 select-none">
                        How to create a safe, DNS-only Cloudflare API Token (takes 20 seconds)
                      </summary>
                      <ol className="mt-3 space-y-2 list-decimal list-inside text-zinc-300 leading-relaxed">
                        <li>
                          Click <strong className="text-white">Open Cloudflare Tokens</strong> above → click <strong className="text-white">Create Token</strong>.
                        </li>
                        <li>
                          Next to the <strong className="text-white">Edit zone DNS</strong> template, click <strong className="text-white">Use template</strong>.
                        </li>
                        <li>
                          Under <strong className="text-white">Zone Resources</strong>, select <strong className="text-white">Specific zone → {dnsLabels.cnameFqdn}</strong>, click <strong className="text-white">Continue to summary → Create Token</strong>, and paste it below.
                        </li>
                      </ol>
                    </details>

                    <form
                      method="POST"
                      action="/api/shield/cloudflare-autoconfig"
                      noValidate
                      aria-labelledby="cf-autoconfig-heading"
                      onSubmit={handleCloudflareAutoConfigure}
                      className="rounded-xl border border-white/12 bg-[#05070C] p-4 sm:p-5 space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor={cfTokenId}
                          className="block text-xs font-semibold text-zinc-200"
                        >
                          Cloudflare API Token (Edit zone DNS) <span aria-hidden="true" className="text-[#F9103A]">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            ref={cfTokenInputRef}
                            id={cfTokenId}
                            name="cfApiToken"
                            type={showCfToken ? "text" : "password"}
                            required
                            autoComplete="off"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="none"
                            enterKeyHint="done"
                            value={cfApiToken}
                            onChange={(e) => {
                              setCfApiToken(e.target.value);
                              if (cfError) setCfError(null);
                            }}
                            aria-invalid={Boolean(cfError)}
                            aria-describedby={cfError ? `${cfTokenHelpId} ${cfTokenErrorId}` : cfTokenHelpId}
                            placeholder="Paste your Cloudflare API token here..."
                            className={`w-full min-h-[48px] rounded-xl border bg-[#080B14] pl-4 pr-12 text-base sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 transition-colors ${
                              cfError
                                ? "border-red-500/70 focus-visible:ring-red-500/50"
                                : "border-white/15 hover:border-white/30 focus-visible:border-orange-400 focus-visible:ring-orange-400/40"
                            }`}
                          />
                          <button
                            type="button"
                            aria-pressed={showCfToken}
                            aria-label={showCfToken ? "Hide Cloudflare API token" : "Show Cloudflare API token"}
                            onClick={() => setShowCfToken((prev) => !prev)}
                            className="absolute right-2 inline-flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                          >
                            {showCfToken ? (
                              <EyeOff className="size-4" aria-hidden="true" />
                            ) : (
                              <Eye className="size-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        <p id={cfTokenHelpId} className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                          <Lock className="size-3 text-emerald-400 shrink-0" aria-hidden="true" />
                          <span>Used once over HTTPS to upsert DNS records, then immediately discarded — never stored in our database or localStorage.</span>
                        </p>
                        {cfError && (
                          <p
                            id={cfTokenErrorId}
                            role="alert"
                            className="text-xs text-red-400 flex items-start gap-1.5 pt-1"
                          >
                            <AlertCircle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{cfError}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-start gap-2.5">
                          <input
                            id={cfReplaceAId}
                            name="replaceExistingA"
                            type="checkbox"
                            checked={cfReplaceA}
                            onChange={(e) => setCfReplaceA(e.target.checked)}
                            className="mt-0.5 size-4 rounded border-white/25 accent-[#F9103A] cursor-pointer"
                          />
                          <label htmlFor={cfReplaceAId} className="text-xs text-zinc-300 cursor-pointer leading-snug">
                            Replace any existing <code className="font-mono text-white">A / AAAA</code> record on <code className="font-mono text-white">{provisionedTenant.primaryDomain}</code> with CNAME → <code className="font-mono text-emerald-300">edge.sparrowx.net</code> (your old IP is displayed below so you can restore anytime).
                          </label>
                        </div>

                        {dnsLabels.isApex && (
                          <div className="flex items-start gap-2.5">
                            <input
                              id={cfIncludeWwwId}
                              name="includeWww"
                              type="checkbox"
                              checked={cfIncludeWww}
                              onChange={(e) => setCfIncludeWww(e.target.checked)}
                              className="mt-0.5 size-4 rounded border-white/25 accent-[#F9103A] cursor-pointer"
                            />
                            <label htmlFor={cfIncludeWwwId} className="text-xs text-zinc-300 cursor-pointer leading-snug">
                              Also route <code className="font-mono text-white">www.{provisionedTenant.primaryDomain}</code> through SparrowX Edge WAF.
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => setConnectTab("dns")}
                          className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
                        >
                          Not on Cloudflare? View step-by-step manual DNS guide
                        </button>
                        <button
                          type="submit"
                          disabled={cfSubmitting}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 px-5 text-xs sm:text-sm font-bold text-black transition-colors cursor-pointer"
                        >
                          {cfSubmitting ? (
                            <>
                              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                              <span>Configuring Cloudflare DNS...</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="size-4" aria-hidden="true" />
                              <span>Auto-Configure Cloudflare DNS</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Live Cloudflare Auto-Config Success Summary */}
                    {cfResult && (
                      <div
                        role="status"
                        className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-300">
                          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                          <span>
                            Cloudflare zone <code className="font-mono text-white">{cfResult.zone.name}</code> configured automatically!
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs font-mono text-zinc-200">
                          {cfResult.actions.map((act) => (
                            <li
                              key={`${act.type}-${act.name}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#05080E]/80 px-3 py-2"
                            >
                              <span className="flex items-center gap-2">
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                                  {act.status}
                                </span>
                                <span className="text-sky-300 font-semibold">{act.type}</span>
                                <span className="text-white">{act.name}</span>
                              </span>
                              <span className="text-emerald-300 truncate max-w-full">
                                → {act.target} {act.type === "CNAME" ? "(DNS Only)" : ""}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {cfResult.replacedRecords.length > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 space-y-1">
                            <div className="font-semibold text-amber-300">
                              Previous Origin Record Backed Up (save if you ever want to revert):
                            </div>
                            {cfResult.replacedRecords.map((rec, idx) => (
                              <div key={`${rec.type}-${rec.content}-${idx}`} className="flex items-center justify-between gap-2 font-mono">
                                <span>
                                  {rec.type} {rec.name} → {rec.content}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyValue(`backup-${idx}`, rec.content, "Previous origin IP")}
                                  className="inline-flex min-h-7 items-center gap-1 rounded border border-amber-400/30 px-2 text-[11px] text-amber-200 hover:bg-amber-400/15 cursor-pointer"
                                >
                                  <Copy className="size-3" aria-hidden="true" />
                                  <span>{copiedKey === `backup-${idx}` ? "Copied" : "Copy IP"}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DETAILED STEP-BY-STEP MANUAL DNS SETUP */}
                {connectTab === "dns" && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <h2 className="text-sm font-semibold text-white">
                        Complete DNS Setup Guide — No Nginx or Server Changes Needed
                      </h2>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        You only need to add <strong className="text-white">2 DNS records</strong> inside your DNS provider (Cloudflare, GoDaddy, Namecheap, Hostinger, or Route53). All traffic for <code className="font-mono text-white">{provisionedTenant.primaryDomain}</code> will flow directly through SparrowX Edge WAF.
                      </p>
                    </div>

                    {/* Crucial Cloudflare Proxy Callout */}
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 flex items-start gap-3 text-xs text-amber-100">
                      <Info className="size-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="space-y-1 leading-relaxed">
                        <div className="font-semibold text-amber-200">
                          Important for Cloudflare Users: Set Proxy Status to &ldquo;DNS Only&rdquo; (Grey Cloud)
                        </div>
                        <p>
                          When adding the <code className="font-mono text-white">CNAME</code> record in Cloudflare, click the orange cloud toggle to turn it <strong className="text-white">OFF (Grey Cloud / DNS Only)</strong>. Keeping Cloudflare Proxy ON double-proxies traffic and can cause SSL redirect loops. If you already have an <code className="font-mono text-white">A</code> record for <code className="font-mono text-white">{dnsLabels.cnameHostShort}</code>, note its IP and delete it before saving the CNAME.
                        </p>
                      </div>
                    </div>

                    {/* Step-by-Step Cards */}
                    <div className="space-y-3">
                      {/* Step 1 */}
                      <div className="rounded-xl border border-white/10 bg-[#060910] p-4 flex items-start gap-3">
                        <span className="size-6 rounded-full bg-white/10 text-white text-xs font-mono font-bold grid place-items-center shrink-0">
                          1
                        </span>
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold text-white">Open your domain&apos;s DNS Records page</div>
                          <p className="text-zinc-400 leading-relaxed">
                            <strong className="text-zinc-200">Cloudflare:</strong> Select your domain → <code className="text-zinc-200">DNS → Records → Add record</code>.{" "}
                            <strong className="text-zinc-200">Namecheap:</strong> Domain List → Manage → <code className="text-zinc-200">Advanced DNS</code>.{" "}
                            <strong className="text-zinc-200">GoDaddy:</strong> My Products → DNS → <code className="text-zinc-200">Add New Record</code>.
                          </p>
                        </div>
                      </div>

                      {/* Step 2: CNAME Record */}
                      <div className="rounded-xl border border-sky-500/25 bg-[#05070C] p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="size-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-mono font-bold grid place-items-center shrink-0">
                            2
                          </span>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-semibold text-white">
                              Add the CNAME Record <span className="text-sky-300 font-normal">(Routes traffic through SparrowX Edge WAF)</span>
                            </div>
                            <p className="text-zinc-400">
                              {dnsLabels.isApex
                                ? `For a root domain, enter "@" in the Name/Host field (Cloudflare CNAME flattening handles root CNAMEs automatically).`
                                : `Enter "${dnsLabels.cnameHostShort}" in the Name/Host field (your provider appends the root domain automatically).`}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3">
                            <div className="text-[10px] text-zinc-400 uppercase mb-1">Type</div>
                            <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-sky-300 font-semibold">
                              CNAME
                            </span>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-zinc-400 uppercase mb-1">Name / Host</div>
                              <div className="text-white font-semibold truncate">{dnsLabels.cnameHostShort}</div>
                              <div className="text-[10px] text-zinc-500 truncate">{dnsLabels.cnameFqdn}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyValue("cname-host", dnsLabels.cnameHostShort, "CNAME host")}
                              aria-label={`Copy CNAME host ${dnsLabels.cnameHostShort}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 cursor-pointer shrink-0"
                            >
                              {copiedKey === "cname-host" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3 sm:col-span-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-zinc-400 uppercase mb-1">Target / Value · Proxy: DNS Only</div>
                              <div className="text-emerald-300 font-semibold truncate">edge.sparrowx.net</div>
                              <div className="text-[10px] text-zinc-500">TTL: Auto · Cloudflare Proxy: OFF (Grey Cloud)</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyValue("cname", "edge.sparrowx.net", "CNAME target")}
                              aria-label="Copy CNAME target edge.sparrowx.net"
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] px-2.5 text-[11px] text-zinc-200 cursor-pointer shrink-0"
                            >
                              {copiedKey === "cname" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                              <span>{copiedKey === "cname" ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: TXT Record */}
                      <div className="rounded-xl border border-amber-500/25 bg-[#05070C] p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="size-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold grid place-items-center shrink-0">
                            3
                          </span>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-semibold text-white">
                              Add the TXT Record <span className="text-amber-300 font-normal">(Verifies you own this domain)</span>
                            </div>
                            <p className="text-zinc-400">
                              Proves ownership before SparrowX issues your automated TLS certificate and streams live WAF logs to your account.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3">
                            <div className="text-[10px] text-zinc-400 uppercase mb-1">Type</div>
                            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300 font-semibold">
                              TXT
                            </span>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-zinc-400 uppercase mb-1">Name / Host</div>
                              <div className="text-white font-semibold truncate">{dnsLabels.txtHostShort}</div>
                              <div className="text-[10px] text-zinc-500 truncate">{dnsLabels.txtFqdn}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyValue("txt-host", dnsLabels.txtHostShort, "TXT host")}
                              aria-label={`Copy TXT host ${dnsLabels.txtHostShort}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 cursor-pointer shrink-0"
                            >
                              {copiedKey === "txt-host" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#090D16] p-3 sm:col-span-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-zinc-400 uppercase mb-1">Content / Value</div>
                              <div className="text-amber-200 font-semibold break-all">{verifyToken}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyValue("txt", verifyToken, "TXT verification token")}
                              aria-label="Copy TXT verification token"
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] px-2.5 text-[11px] text-zinc-200 cursor-pointer shrink-0"
                            >
                              {copiedKey === "txt" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                              <span>{copiedKey === "txt" ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Non-exclusive DNS FAQ disclosures */}
                    <div className="space-y-2">
                      <details className="rounded-xl border border-white/10 bg-[#060910] px-4 py-3 text-xs text-zinc-300">
                        <summary className="cursor-pointer font-medium text-zinc-200 select-none">
                          How long does DNS propagation take?
                        </summary>
                        <p className="mt-2 text-zinc-400 leading-relaxed">
                          Cloudflare updates in 15–60 seconds. GoDaddy, Namecheap, and other registrars typically propagate in 2–10 minutes. Click <strong className="text-white">Check DNS Live</strong> below to confirm immediately.
                        </p>
                      </details>
                      <details className="rounded-xl border border-white/10 bg-[#060910] px-4 py-3 text-xs text-zinc-300">
                        <summary className="cursor-pointer font-medium text-zinc-200 select-none">
                          My DNS provider doesn&apos;t allow a CNAME on the root domain (@) — what should I do?
                        </summary>
                        <p className="mt-2 text-zinc-400 leading-relaxed">
                          Cloudflare supports root CNAMEs natively via CNAME Flattening (free plan). If you use a traditional registrar like Namecheap or GoDaddy without ALIAS/ANAME support, point <code className="font-mono text-white">www</code> as a CNAME to <code className="font-mono text-emerald-300">edge.sparrowx.net</code> or move DNS to Cloudflare&apos;s free plan and use Tab 1 for 1-click setup.
                        </p>
                      </details>
                    </div>
                  </div>
                )}

                {/* TAB 3: OPTIONAL 1-LINE WEBSITE SCRIPT */}
                {connectTab === "sdk" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-300">
                        Optional client-side telemetry add-on — paste before <code className="text-white">&lt;/head&gt;</code> on <code className="text-white">{provisionedTenant.primaryDomain}</code> (no server or Nginx config needed):
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyValue("sdk", sdkSnippet, "Website Shield script")}
                        aria-label="Copy Website Shield script snippet"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 text-xs text-zinc-200 cursor-pointer shrink-0"
                      >
                        {copiedKey === "sdk" ? (
                          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5" aria-hidden="true" />
                        )}
                        <span>{copiedKey === "sdk" ? "Copied" : "Copy Script Tag"}</span>
                      </button>
                    </div>
                    <pre className="rounded-xl border border-white/10 bg-[#05070C] p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                      <code>{sdkSnippet}</code>
                    </pre>
                  </div>
                )}

                {/* LIVE DNS PROPAGATION VERIFIER STRIP */}
                <div className="rounded-xl border border-white/12 bg-[#060910] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white">
                        Live DNS Propagation Check
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Checks public DNS &amp; Cloudflare DoH in real time for your CNAME and TXT records.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={dnsChecking}
                      onClick={() => void handleVerifyDnsLive()}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-60 px-3.5 text-xs font-semibold text-emerald-200 cursor-pointer"
                    >
                      <RefreshCw className={`size-3.5 ${dnsChecking ? "animate-spin" : ""}`} aria-hidden="true" />
                      <span>{dnsChecking ? "Checking Live DNS..." : "Check DNS Live"}</span>
                    </button>
                  </div>

                  {dnsVerifyError && (
                    <p role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{dnsVerifyError}</span>
                    </p>
                  )}

                  {dnsVerifyResult && (
                    <div role="status" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div
                        className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 ${
                          dnsVerifyResult.cnameVerified
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        <span className="font-medium">
                          CNAME → edge.sparrowx.net
                          {dnsVerifyResult.flattenedMatch ? " (Flattened)" : ""}
                        </span>
                        <span className="font-mono font-bold">
                          {dnsVerifyResult.cnameVerified ? "VERIFIED" : "PENDING"}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 ${
                          dnsVerifyResult.txtVerified
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        <span className="font-medium">TXT _sparrowx-verify</span>
                        <span className="font-mono font-bold">
                          {dnsVerifyResult.txtVerified ? "VERIFIED" : "PENDING"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sensor Key Strip */}
                <div className="rounded-xl border border-white/10 bg-[#060910] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Edge WAF Sensor Key
                    </div>
                    <div className="font-mono text-xs text-white truncate">{provisionedTenant.apiKey}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue("apikey", provisionedTenant.apiKey, "Sensor API key")}
                    aria-label="Copy Edge WAF sensor API key"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 text-xs text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === "apikey" ? (
                      <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5" aria-hidden="true" />
                    )}
                    <span>{copiedKey === "apikey" ? "Copied" : "Copy Key"}</span>
                  </button>
                </div>

                {/* Bottom Launch Bar */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDomainInput("");
                        setWorkspaceLabel("");
                        setPreflightAudit(null);
                        setCfApiToken("");
                        setCfError(null);
                        setCfResult(null);
                        setDnsVerifyResult(null);
                        setDnsVerifyError(null);
                        setStep(1);
                      }}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-4 text-xs font-medium text-zinc-200 cursor-pointer"
                    >
                      <span>+ Connect Another Domain</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewCheckingPage(true)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/35 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 px-4 text-xs font-semibold text-[#38BDF8] cursor-pointer"
                    >
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      <span>Preview Edge Checking Page</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onLaunchWorkbench}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F9103A] hover:bg-[#E00E34] px-6 text-sm font-semibold text-white shadow-[0_0_28px_rgba(249,16,58,0.35)] transition-all cursor-pointer"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    <span>Launch Autonomous SOC Workbench</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {previewCheckingPage && provisionedTenant ? (
        <ShieldEdgeCheckingPage
          domain={provisionedTenant.primaryDomain}
          previewMode
          onClosePreview={() => setPreviewCheckingPage(false)}
        />
      ) : null}

      <SparrowxFooter
        isAuthenticated={true}
        onSignOut={onSignOut}
      />
    </div>
  );
}
