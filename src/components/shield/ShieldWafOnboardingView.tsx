import React, { useId, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Globe,
  Layers,
  Lock,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
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

export interface ShieldWafOnboardingViewProps {
  activeUser: AppUser;
  onDomainConnected: (result: {
    tenant: ClientTenant;
    service: ProtectedService;
    asset: Asset;
  }) => void;
  onLaunchWorkbench: () => void;
  onBackToClientArea: () => void;
  onSignOut: () => void;
}

type TargetCategory = "web" | "api" | "ai" | "proxy";
type ProtectionStrictness = "balanced" | "strict" | "monitor";
type ConnectMethodTab = "dns" | "nginx" | "sdk";

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
    label: "Nginx / Origin Server",
    desc: "Bare-metal VPS, Docker & reverse proxy origin",
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
  onLaunchWorkbench,
  onBackToClientArea,
  onSignOut,
}: ShieldWafOnboardingViewProps) {
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
  const [connectTab, setConnectTab] = useState<ConnectMethodTab>("dns");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyStatusText, setCopyStatusText] = useState("");
  const lastAnnouncementRef = useRef("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const domainInputRef = useRef<HTMLInputElement | null>(null);
  const domainErrorId = useId();

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

  const nginxSnippet = `# SparrowX Edge WAF Telemetry & Origin Shield for ${cleanHost || "yourdomain.com"}
server {
    listen 443 ssl http2;
    server_name ${cleanHost || "yourdomain.com"};

    add_header X-SparrowX-Shield "PROTECTED" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-SparrowX-Key "${provisionedTenant?.apiKey ?? "spx_waf_key"}";
    }
}`;

  const sdkSnippet = `<!-- Paste before </head> on ${cleanHost || "yourdomain.com"} for instant L7 telemetry -->
<script
  src="https://sparrowx.net/sparrowx-shield.js"
  data-sparrowx-key="${provisionedTenant?.apiKey ?? "spx_waf_key"}"
  data-sparrowx-domain="${cleanHost || "yourdomain.com"}"
  data-sparrowx-mode="${strictness}"
  defer
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
        {/* STEP 3: DNS / PROXY / SDK CONNECTION & LAUNCH SOC WORKBENCH      */}
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
                    Pick one connection method below (DNS CNAME, Nginx header, or 1-line Edge script), then launch your Autonomous SOC Workbench.
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
              {/* Method Tabs */}
              <div
                role="tablist"
                aria-label="WAF connection methods"
                className="border-b border-white/10 bg-[#070A12] px-4 sm:px-6 pt-4 flex flex-wrap gap-2"
              >
                {(
                  [
                    { id: "dns" as const, label: "1. DNS CNAME (Recommended)", icon: Globe },
                    { id: "nginx" as const, label: "2. Nginx / Reverse Proxy", icon: Terminal },
                    { id: "sdk" as const, label: "3. 1-Line Website Script", icon: Code2 },
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
                {connectTab === "dns" && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Add these DNS records at Cloudflare, Namecheap, GoDaddy, or Route53 to route traffic through SparrowX Edge WAF and verify domain ownership:
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#05070C]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b border-white/10 text-[11px] text-zinc-400 uppercase">
                          <tr>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Host / Name</th>
                            <th className="px-4 py-3">Value / Target</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06] text-zinc-200">
                          <tr>
                            <td className="px-4 py-3">
                              <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-sky-300 font-semibold">
                                CNAME
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white">{provisionedTenant.primaryDomain}</td>
                            <td className="px-4 py-3 text-emerald-300">edge.sparrowx.net</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleCopyValue("cname", "edge.sparrowx.net", "CNAME target")}
                                aria-label="Copy CNAME target edge.sparrowx.net"
                                className="inline-flex min-h-8 min-w-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] px-2.5 text-[11px] text-zinc-200 cursor-pointer"
                              >
                                {copiedKey === "cname" ? (
                                  <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                                ) : (
                                  <Copy className="size-3.5" aria-hidden="true" />
                                )}
                                <span>{copiedKey === "cname" ? "Copied" : "Copy"}</span>
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3">
                              <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300 font-semibold">
                                TXT
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white">_sparrowx-verify.{provisionedTenant.primaryDomain}</td>
                            <td className="px-4 py-3 text-amber-200 break-all">{verifyToken}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleCopyValue("txt", verifyToken, "TXT verification token")}
                                aria-label="Copy TXT verification token"
                                className="inline-flex min-h-8 min-w-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] px-2.5 text-[11px] text-zinc-200 cursor-pointer"
                              >
                                {copiedKey === "txt" ? (
                                  <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                                ) : (
                                  <Copy className="size-3.5" aria-hidden="true" />
                                )}
                                <span>{copiedKey === "txt" ? "Copied" : "Copy"}</span>
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {connectTab === "nginx" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-300">
                        Add this hardened reverse-proxy config on your origin server:
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyValue("nginx", nginxSnippet, "Nginx WAF config")}
                        aria-label="Copy Nginx WAF configuration"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 text-xs text-zinc-200 cursor-pointer"
                      >
                        {copiedKey === "nginx" ? (
                          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5" aria-hidden="true" />
                        )}
                        <span>{copiedKey === "nginx" ? "Copied" : "Copy Nginx Config"}</span>
                      </button>
                    </div>
                    <pre className="rounded-xl border border-white/10 bg-[#05070C] p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
                      <code>{nginxSnippet}</code>
                    </pre>
                  </div>
                )}

                {connectTab === "sdk" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-300">
                        Drop this lightweight telemetry sensor into your website&apos;s <code className="text-white">&lt;head&gt;</code>:
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyValue("sdk", sdkSnippet, "Website Shield script")}
                        aria-label="Copy Website Shield script snippet"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 text-xs text-zinc-200 cursor-pointer"
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
                  <button
                    type="button"
                    onClick={() => {
                      setDomainInput("");
                      setWorkspaceLabel("");
                      setPreflightAudit(null);
                      setStep(1);
                    }}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-4 text-xs font-medium text-zinc-200 cursor-pointer"
                  >
                    <span>+ Connect Another Domain</span>
                  </button>
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

      <SparrowxFooter
        isAuthenticated={true}
        onSignOut={onSignOut}
      />
    </div>
  );
}
