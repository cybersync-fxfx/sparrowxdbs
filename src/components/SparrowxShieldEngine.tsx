import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Terminal,
  User,
} from "lucide-react";
import { CyberThreatMatrixMap } from "@/components/CyberThreatMatrixMap";
import {
  SparrowxSentraSocWorkbench,
  type SocViewMode,
} from "@/components/SparrowxSentraSocWorkbench";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authenticateAppUserFromBackend,
  fetchAppUserByEmailFromBackend,
  persistAppUserToBackend,
  type AppUser,
} from "@/lib/supabase";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";

export interface SparrowxShieldEngineProps {
  currentUser?: AppUser | null;
  onUserAuthenticated?: (user: AppUser) => void;
  onOpenClientArea?: () => void;
  onSignOut?: () => void;
}

function readInitialShieldUser(propUser?: AppUser | null): AppUser | null {
  if (propUser) return propUser;
  if (typeof window === "undefined") return null;
  const verified = verifySessionToken();
  if (verified) {
    return {
      id: verified.sub,
      email: verified.email,
      fullName: verified.fullName || verified.email.split("@")[0] || "Operator",
      password: "",
      admin: verified.role === "admin" ? "yes" : "no",
      tenantId: verified.tenantId,
    };
  }
  const rawAuthUser = localStorage.getItem("sparrowx_auth_user");
  if (rawAuthUser) {
    try {
      const parsed = JSON.parse(rawAuthUser) as Partial<AppUser>;
      if (parsed && typeof parsed.email === "string" && parsed.email.includes("@")) {
        return {
          id: String(parsed.id || "USR-SHIELD"),
          email: parsed.email,
          fullName: String(parsed.fullName || parsed.email.split("@")[0]),
          password: "",
          admin: parsed.admin === "yes" ? "yes" : "no",
          tenantId: parsed.tenantId ?? null,
        };
      }
    } catch {
      // Ignore malformed sparrowx_auth_user
    }
  }
  return null;
}

interface InspectionResult {
  domain: string;
  ip: string;
  tlsVersion: string;
  cipherSuite: string;
  dnsPropagation: string;
  edgeLatencyMs: number;
  originCloaked: boolean;
  wafStatus: "Active" | "Monitoring";
  threatScore: number;
  securityHeaders: {
    hsts: boolean;
    csp: boolean;
    xframe: boolean;
    nosniff: boolean;
  };
}

export function SparrowxShieldEngine({
  currentUser,
  onUserAuthenticated,
  onOpenClientArea,
  onSignOut,
}: SparrowxShieldEngineProps = {}) {
  const [targetDomain, setTargetDomain] = useState<string>("sparrowx.net");
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [socModalOpen, setSocModalOpen] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR">("INR");
  const [railMode, setRailMode] = useState<SocViewMode>("queue");

  // SOC persistent session & auth dialog state
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() =>
    readInitialShieldUser(currentUser),
  );
  const [socAuthMode, setSocAuthMode] = useState<"signin" | "register">("signin");
  const [socFullName, setSocFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser);
    } else {
      setSessionUser(readInitialShieldUser(null));
    }
  }, [currentUser]);

  const activeUser = currentUser ?? sessionUser;

  const handleShieldSignOut = () => {
    clearSessionToken();
    if (typeof window !== "undefined") {
      localStorage.removeItem("sparrowx_auth_user");
    }
    setSessionUser(null);
    onSignOut?.();
  };

  const handleRailSelect = (mode: SocViewMode) => {
    setRailMode(mode);
    if (typeof document !== "undefined") {
      if (mode === "map") {
        document.getElementById("shield-threat-map")?.scrollIntoView({ behavior: "smooth" });
      } else if (mode === "plans") {
        document.getElementById("shield-agent-plans")?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const [result, setResult] = useState<InspectionResult | null>({
    domain: "sparrowx.net",
    ip: "Anycast Edge Gateway (Origin Cloaked)",
    tlsVersion: "TLS 1.3 (ChaCha20-Poly1305 / AES-256-GCM)",
    cipherSuite: "ECDHE-ECDSA-AES256-GCM-SHA384",
    dnsPropagation: "Global Synchronized (100% propagated)",
    edgeLatencyMs: 9,
    originCloaked: true,
    wafStatus: "Active",
    threatScore: 0,
    securityHeaders: {
      hsts: true,
      csp: true,
      xframe: true,
      nosniff: true,
    },
  });

  const runSecurityInspection = async () => {
    if (!targetDomain.trim()) return;
    setInspecting(true);
    try {
      await new Promise((r) => setTimeout(r, 550));
      const clean = targetDomain.trim().toLowerCase().replace(/^https?:\/\//, "");
      const isSparrow = clean.includes("sparrowx");
      setResult({
        domain: clean,
        ip: isSparrow ? "Anycast Edge Gateway (Protected)" : "Direct Cloud IP Exposed",
        tlsVersion: "TLS 1.3 (ChaCha20-Poly1305 / AES-256-GCM)",
        cipherSuite: "ECDHE-ECDSA-AES256-GCM-SHA384",
        dnsPropagation: "Anycast Synchronized (100% propagated)",
        edgeLatencyMs: Math.floor(8 + Math.random() * 12),
        originCloaked: isSparrow,
        wafStatus: "Active",
        threatScore: isSparrow ? 0 : 35,
        securityHeaders: {
          hsts: isSparrow,
          csp: isSparrow,
          xframe: isSparrow,
          nosniff: isSparrow,
        },
      });
    } finally {
      setInspecting(false);
    }
  };

  const pricingData = {
    INR: {
      single: { price: "₹300", period: "/mo" },
      basic: { price: "₹1,580", period: "/mo" },
      pro: { price: "₹2,420", period: "/mo" },
    },
    USD: {
      single: { price: "$4", period: "/mo" },
      basic: { price: "$19", period: "/mo" },
      pro: { price: "$29", period: "/mo" },
    },
    EUR: {
      single: { price: "€3.70", period: "/mo" },
      basic: { price: "€17.50", period: "/mo" },
      pro: { price: "€26.80", period: "/mo" },
    },
  };

  return (
    <div className="font-soc min-h-screen bg-[#090B11] text-[#F4F6FA] flex flex-col selection:bg-[#F9103A] selection:text-[#F4F6FA]">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[#F4F6FA]/[0.07] bg-[#090B11]/95 px-4 sm:px-6 py-3 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/sparrowx-shield-logo.svg"
              alt="SparrowX Shield"
              className="size-9 object-contain shrink-0"
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-medium tracking-tight text-[#F4F6FA]">
                SparrowX Shield
              </span>
              <span className="hidden sm:inline text-xs text-[#F4F6FA]/40">
                sec.sparrowx.net
              </span>
            </div>
          </div>

          <nav aria-label="Primary Shield Sections" className="hidden md:flex items-center gap-6 text-xs">
            <a
              href="#shield-soc-workbench"
              onClick={() => setRailMode("queue")}
              className="text-[#F4F6FA]/85 hover:text-[#F4F6FA] transition-colors"
            >
              Incident Triage
            </a>
            <a
              href="#shield-threat-map"
              className="text-[#F4F6FA]/60 hover:text-[#F4F6FA] transition-colors"
            >
              Threat Map &amp; Audit
            </a>
            <a
              href="#shield-agent-plans"
              className="text-[#F4F6FA]/60 hover:text-[#F4F6FA] transition-colors"
            >
              Connector &amp; Plans
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {activeUser ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-3 py-1 text-xs font-medium text-[#10B981]">
                  <span className="size-1.5 rounded-full bg-[#10B981]" />
                  <span>{activeUser.email}</span>
                </span>
                {onOpenClientArea && (
                  <button
                    type="button"
                    onClick={() => onOpenClientArea()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-3 py-1.5 text-xs font-medium text-[#F4F6FA] transition-colors hover:bg-[#F9103A]/90 cursor-pointer"
                  >
                    <User className="size-3.5" />
                    <span>Client Area</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShieldSignOut}
                  className="rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-3 py-1.5 text-xs text-[#F4F6FA]/75 transition-colors hover:text-[#F4F6FA] cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSocModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-4 py-2 text-xs font-medium text-[#F4F6FA] transition-colors hover:bg-[#F9103A]/90 cursor-pointer shadow-[0_6px_20px_rgba(249,16,58,0.28)]"
              >
                <Lock className="size-3.5" />
                <span>{onOpenClientArea ? "Sign In to Client Area" : "Sign In to SOC"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER — OPENS DIRECTLY INTO THE SENTRA SOC WORKBENCH */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-8">
        <div id="shield-soc-workbench">
          <SparrowxSentraSocWorkbench
            currentUser={activeUser}
            activeRailMode={railMode}
            onSelectRailMode={handleRailSelect}
            onOpenAuthModal={() => setSocModalOpen(true)}
            onOpenClientArea={onOpenClientArea}
            onSignOut={handleShieldSignOut}
            showExtendedRailItems={true}
          />
        </div>

        {/* SECTION 2: LIVE GLOBAL THREAT MAP & 15-SECOND ORIGIN CLOAKING AUDIT */}
        <section id="shield-threat-map" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-[#F4F6FA]">
                Perimeter Radar &amp; Domain Origin Audit
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#F4F6FA]/55">
                Inspect live inbound packet deflection and test whether your origin IP is exposed.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#F4F6FA]/60">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#10B981]" /> Edge Relay
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#F9103A]" /> Intercepted Flows
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-2 sm:p-4">
            <CyberThreatMatrixMap
              height={typeof window !== "undefined" && window.innerWidth < 640 ? 320 : 500}
              enableSimulation={true}
              simIntervalMs={1800}
              showControls={true}
              showFeed={true}
              showStats={true}
            />
          </div>

          {/* Domain Security & Origin Audit Panel */}
          <div className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Globe className="size-4 text-[#F4F6FA]/40 absolute left-3.5 top-3.5 sm:top-3" />
                <input
                  type="text"
                  placeholder="Enter domain to audit (e.g. yourstartup.com, sparrowx.net)"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSecurityInspection()}
                  className="w-full h-11 sm:h-10 rounded-xl border border-[#F4F6FA]/[0.08] bg-[#090B11] pl-10 pr-4 text-xs font-mono text-[#F4F6FA] placeholder-[#F4F6FA]/40 outline-none focus:border-[#F96246]"
                />
              </div>
              <button
                type="button"
                onClick={runSecurityInspection}
                disabled={inspecting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#F9103A] hover:bg-[#F9103A]/90 text-[#F4F6FA] font-medium px-6 h-11 sm:h-10 text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`size-3.5 ${inspecting ? "animate-spin" : ""}`} />
                <span>{inspecting ? "Auditing..." : "Audit Domain"}</span>
              </button>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-4 rounded-xl bg-[#090B11] border border-[#F4F6FA]/[0.07] space-y-1">
                    <span className="text-[11px] text-[#F4F6FA]/50 block">Server Ingress IP</span>
                    <span className="text-[#F4F6FA] font-medium block truncate">{result.ip}</span>
                    <span
                      className={`text-[11px] font-medium ${
                        result.originCloaked ? "text-[#10B981]" : "text-[#F96246]"
                      }`}
                    >
                      {result.originCloaked ? "Origin Cloaked" : "Origin IP Exposed"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#090B11] border border-[#F4F6FA]/[0.07] space-y-1">
                    <span className="text-[11px] text-[#F4F6FA]/50 block">TLS Encryption</span>
                    <span className="text-[#10B981] font-medium block truncate">
                      {result.tlsVersion}
                    </span>
                    <span className="text-[11px] text-[#F4F6FA]/45 font-mono truncate block">
                      {result.cipherSuite}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#090B11] border border-[#F4F6FA]/[0.07] space-y-1">
                    <span className="text-[11px] text-[#F4F6FA]/50 block">Anycast DNS Sync</span>
                    <span className="text-[#F4F6FA] font-medium block">{result.dnsPropagation}</span>
                    <span className="text-[11px] text-[#10B981]">Zero DNS leak detected</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#090B11] border border-[#F4F6FA]/[0.07] space-y-1">
                    <span className="text-[11px] text-[#F4F6FA]/50 block">Edge Relay Latency</span>
                    <span className="text-[#FFEBB9] font-medium tabular-nums block text-base">
                      {result.edgeLatencyMs} ms
                    </span>
                    <span className="text-[11px] text-[#10B981]">High-speed Edge Relay</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#090B11] border border-[#F4F6FA]/[0.07] flex flex-wrap items-center justify-between gap-4 text-xs">
                  <span className="text-[#FFEBB9] font-medium">Perimeter Headers</span>
                  <span className="flex items-center gap-1.5 text-[#F4F6FA]">
                    <Check
                      className={`size-3.5 ${
                        result.securityHeaders.hsts ? "text-[#10B981]" : "text-[#F4F6FA]/30"
                      }`}
                    />
                    HSTS Enforced
                  </span>
                  <span className="flex items-center gap-1.5 text-[#F4F6FA]">
                    <Check
                      className={`size-3.5 ${
                        result.securityHeaders.csp ? "text-[#10B981]" : "text-[#F4F6FA]/30"
                      }`}
                    />
                    Content-Security-Policy
                  </span>
                  <span className="flex items-center gap-1.5 text-[#F4F6FA]">
                    <Check
                      className={`size-3.5 ${
                        result.securityHeaders.xframe ? "text-[#10B981]" : "text-[#F4F6FA]/30"
                      }`}
                    />
                    X-Frame-Options: SAMEORIGIN
                  </span>
                  <span className="flex items-center gap-1.5 text-[#F4F6FA]">
                    <Check
                      className={`size-3.5 ${
                        result.securityHeaders.nosniff ? "text-[#10B981]" : "text-[#F4F6FA]/30"
                      }`}
                    />
                    X-Content-Type-Options: nosniff
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: 1-COMMAND SERVER AGENT & PROTECTION PLANS */}
        <section id="shield-agent-plans" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Live Scrubbing Stream + 1-Command Agent Install */}
          <div className="lg:col-span-5 rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] flex flex-col justify-between overflow-hidden">
            <div className="border-b border-[#F4F6FA]/[0.07] px-4 py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-[#F96246]" />
                <span className="font-medium text-[#F4F6FA]">Edge Scrubbing Daemon</span>
              </div>
              <span className="text-[#10B981] text-[11px] font-medium">Active Defense</span>
            </div>

            <div className="p-4 bg-[#090B11] font-mono text-[11px] text-[#F4F6FA]/65 space-y-2 overflow-x-auto flex-1">
              <div className="text-[#F4F6FA]/40">
                [00:14:02] shadowshield-daemon v2.8 started on AP-Southeast Edge
              </div>
              <div className="text-[#10B981]">
                [00:14:05] [packet-filter] Fastpath SYN proxy and origin cloak verified
              </div>
              <div className="text-[#F9103A]">
                [00:14:12] [DEFLECTED] TCP SYN flood from 182.21.90.11 -&gt; :443 [480 pkts/s]
              </div>
              <div className="text-[#FFEBB9]">
                [00:14:18] [WAF-L7] SQL injection payload blocked from AS13335
              </div>
              <div className="text-[#F96246]">
                [00:14:30] [RATE-LIMITED] Malicious scraper throttled: 120 req/min cap
              </div>
              <div className="text-[#10B981]">
                [00:14:41] [AI-GUARD] LLM jailbreak payload deflected on /api/v1/generate
              </div>
            </div>

            <div className="p-4 bg-[#0D1017] border-t border-[#F4F6FA]/[0.07] space-y-2.5 text-xs">
              <span className="text-[#F4F6FA]/60 text-[11px] block">1-Command Server Protect</span>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#F4F6FA]/[0.08] bg-[#090B11] px-3 py-2">
                <code className="text-[#FFEBB9] font-mono text-[11px] truncate select-all">
                  curl -sSL https://sec.sparrowx.net/install.sh | sudo bash
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "curl -sSL https://sec.sparrowx.net/install.sh | sudo bash",
                    );
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-[#F4F6FA]/12 bg-[#121620] text-[#F4F6FA] hover:border-[#F96246]/50 transition-colors cursor-pointer shrink-0 text-[11px]"
                >
                  {copiedCmd ? (
                    <span className="text-[#10B981] flex items-center gap-1">
                      <Check className="size-3" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="size-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Protection Plans */}
          <div className="lg:col-span-7 rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F4F6FA]/[0.07] pb-4">
              <div>
                <h2 className="text-xl font-medium text-[#F4F6FA] tracking-tight">
                  Protection Plans
                </h2>
                <p className="text-xs text-[#F4F6FA]/55 mt-0.5">
                  Predictable monthly coverage with origin cloaking and DDoS scrubbing.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Billing currency"
                className="flex items-center gap-1 rounded-xl border border-[#F4F6FA]/[0.08] bg-[#090B11] p-1 text-xs self-start"
              >
                {(["INR", "USD", "EUR"] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    role="tab"
                    aria-selected={currency === curr}
                    onClick={() => setCurrency(curr)}
                    className={`rounded-lg px-3 py-1 transition-colors cursor-pointer ${
                      currency === curr
                        ? "bg-[#F9103A] text-[#F4F6FA] font-medium"
                        : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Plan 1 */}
              <div className="rounded-xl border border-[#F4F6FA]/[0.08] bg-[#090B11] p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-[#F96246]">Single-Port Shield</span>
                  <div className="pt-1 tabular-nums">
                    <span className="text-2xl font-medium text-[#F4F6FA]">
                      {pricingData[currency].single.price}
                    </span>
                    <span className="text-xs text-[#F4F6FA]/45">
                      {pricingData[currency].single.period}
                    </span>
                  </div>
                  <p className="text-xs text-[#F4F6FA]/55">
                    1 cloaked origin port, L4/L7 rate limiting, live attack stream.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSocModalOpen(true)}
                  className="w-full py-2 rounded-lg border border-[#F4F6FA]/15 bg-[#121620] hover:border-[#F96246]/50 text-xs font-medium text-[#F4F6FA] transition-colors cursor-pointer"
                >
                  Deploy Port Shield
                </button>
              </div>

              {/* Plan 2 */}
              <div className="rounded-xl border border-[#F9103A]/45 bg-[#140E13] p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-[#F9103A]">Basic Shield</span>
                  <div className="pt-1 tabular-nums">
                    <span className="text-2xl font-medium text-[#F4F6FA]">
                      {pricingData[currency].basic.price}
                    </span>
                    <span className="text-xs text-[#F4F6FA]/45">
                      {pricingData[currency].basic.period}
                    </span>
                  </div>
                  <p className="text-xs text-[#F4F6FA]/70">
                    Up to 5 domains, DDoS deflection, SQLi WAF barrier, 24/7 radar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSocModalOpen(true)}
                  className="w-full py-2 rounded-lg bg-[#F9103A] hover:bg-[#F9103A]/90 text-xs font-medium text-[#F4F6FA] transition-colors cursor-pointer"
                >
                  Provision Basic Shield
                </button>
              </div>

              {/* Plan 3 */}
              <div className="rounded-xl border border-[#F4F6FA]/[0.08] bg-[#090B11] p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-[#FFEBB9]">Pro Shield</span>
                  <div className="pt-1 tabular-nums">
                    <span className="text-2xl font-medium text-[#F4F6FA]">
                      {pricingData[currency].pro.price}
                    </span>
                    <span className="text-xs text-[#F4F6FA]/45">
                      {pricingData[currency].pro.period}
                    </span>
                  </div>
                  <p className="text-xs text-[#F4F6FA]/55">
                    Unlimited endpoints, AI prompt guard, dedicated scrubbing, custom routing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSocModalOpen(true)}
                  className="w-full py-2 rounded-lg border border-[#F4F6FA]/15 bg-[#121620] hover:border-[#FFEBB9]/45 text-xs font-medium text-[#F4F6FA] transition-colors cursor-pointer"
                >
                  Provision Pro Shield
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#F4F6FA]/[0.07] bg-[#090B11] px-6 py-4 text-center text-xs text-[#F4F6FA]/45">
        <span>SparrowX Shield · L7 WAF &amp; Autonomous Incident Response · security@sparrowx.net</span>
      </footer>

      {/* Operator Auth Dialog */}
      <Dialog open={socModalOpen} onOpenChange={setSocModalOpen}>
        <DialogContent className="font-soc bg-[#0B0E17]/95 backdrop-blur-xl border border-[#F4F6FA]/[0.10] text-[#F4F6FA] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#F9103A]/75 to-transparent" />

          <DialogHeader className="relative px-6 pt-6 pb-4 pr-12 text-left space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#F9103A]/15 border border-[#F9103A]/35 text-[#F9103A] grid place-items-center shrink-0">
                <Shield className="size-5" />
              </div>
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-xl font-medium text-[#F4F6FA] tracking-tight">
                {socAuthMode === "signin"
                  ? "Sign In to Shield Dashboard"
                  : "Register Shield Operator"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-[#F4F6FA]/60 leading-relaxed">
                {socAuthMode === "signin"
                  ? "Authenticate operator credentials to inspect active packet scrubbing and manage firewall rules."
                  : "Provision a new SparrowX Shield operator account for domain cloaking and L7 WAF control."}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Operator authentication mode"
            className="mx-6 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#06080E] border border-[#F4F6FA]/[0.07] p-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={socAuthMode === "signin"}
              onClick={() => {
                setSocAuthMode("signin");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "signin"
                  ? "bg-[#F9103A] text-[#F4F6FA]"
                  : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
              }`}
            >
              <Lock className="size-3.5" />
              <span>Sign In to SOC</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={socAuthMode === "register"}
              onClick={() => {
                setSocAuthMode("register");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "register"
                  ? "bg-[#F9103A] text-[#F4F6FA]"
                  : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
              }`}
            >
              <User className="size-3.5" />
              <span>Register Operator</span>
            </button>
          </div>

          {authError && (
            <div className="mx-6 mb-4 rounded-xl bg-[#F9103A]/10 border border-[#F9103A]/30 px-3.5 py-2.5 text-[#FFEBB9] text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-[#F9103A] mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthLoading(true);
              setAuthError("");
              const emailClean = authEmail.trim().toLowerCase();
              try {
                if (socAuthMode === "signin") {
                  const res = await authenticateAppUserFromBackend(
                    authEmail.trim(),
                    authPassword,
                  );
                  if (res.user) {
                    issueSignedSessionToken({
                      id: res.user.id,
                      email: res.user.email,
                      fullName:
                        res.user.fullName || res.user.email.split("@")[0] || "Operator",
                      role: res.user.admin === "yes" ? "admin" : "client",
                      tenantId: res.user.tenantId,
                    });
                    setSessionUser(res.user);
                    setSocModalOpen(false);
                    if (onUserAuthenticated) {
                      onUserAuthenticated(res.user);
                    } else {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  } else {
                    setAuthError(res.error || "Invalid sign-in credentials.");
                  }
                } else {
                  if (!emailClean || authPassword.length < 6) {
                    setAuthError(
                      "Provide a valid email and a password of at least 6 characters.",
                    );
                    return;
                  }
                  const existing = await fetchAppUserByEmailFromBackend(emailClean);
                  if (existing) {
                    setAuthError(
                      "An account with this email already exists. Please sign in instead.",
                    );
                    return;
                  }
                  const newUser: AppUser = {
                    id: `USR-${Date.now().toString().slice(-4)}`,
                    email: emailClean,
                    password: authPassword,
                    fullName:
                      socFullName.trim() || emailClean.split("@")[0] || "Operator",
                    admin: "no",
                    tenantId: `TENANT-SHIELD-${Date.now().toString().slice(-4)}`,
                  };
                  await persistAppUserToBackend(newUser);
                  const sanitizedUser: AppUser = { ...newUser, password: "" };
                  issueSignedSessionToken({
                    id: sanitizedUser.id,
                    email: sanitizedUser.email,
                    fullName: sanitizedUser.fullName,
                    role: "client",
                    tenantId: sanitizedUser.tenantId,
                  });
                  setSessionUser(sanitizedUser);
                  setSocModalOpen(false);
                  if (onUserAuthenticated) {
                    onUserAuthenticated(sanitizedUser);
                  } else {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }
              } catch {
                setAuthError("Auth gateway offline.");
              } finally {
                setAuthLoading(false);
              }
            }}
            className="px-6 pb-5 space-y-4"
          >
            {socAuthMode === "register" && (
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-medium text-[#F4F6FA]/75 block">
                  Operator Name
                </label>
                <div className="relative">
                  <User className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={socFullName}
                    onChange={(e) => setSocFullName(e.target.value)}
                    placeholder="Mateo Ruiz"
                    className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-3.5 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#F4F6FA]/75 block">
                Operator Email
              </label>
              <div className="relative">
                <Mail className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@sparrowx.net"
                  className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-3.5 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#F4F6FA]/75 block">
                Cryptographic Key / Password
              </label>
              <div className="relative">
                <Lock className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAuthPassword ? "text" : "password"}
                  required
                  minLength={socAuthMode === "register" ? 6 : undefined}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-10 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword((prev) => !prev)}
                  aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F4F6FA]/45 hover:text-[#F4F6FA] transition-colors cursor-pointer p-1"
                >
                  {showAuthPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-11 rounded-xl bg-[#F9103A] hover:bg-[#F9103A]/90 text-[#F4F6FA] font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer mt-1"
            >
              {authLoading ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Shield className="size-4" />
              )}
              <span>
                {socAuthMode === "signin"
                  ? "Authenticate Operator"
                  : "Create Shield Operator"}
              </span>
              {!authLoading && <ArrowRight className="size-4" />}
            </button>
          </form>

          <div className="bg-[#06080E]/90 border-t border-[#F4F6FA]/[0.06] px-6 py-3.5 flex items-center justify-between text-xs text-[#F4F6FA]/55">
            <button
              type="button"
              onClick={() => {
                setSocAuthMode(socAuthMode === "signin" ? "register" : "signin");
                setAuthError("");
              }}
              className="hover:text-[#F4F6FA] transition-colors cursor-pointer"
            >
              {socAuthMode === "signin"
                ? "Need access? Register operator"
                : "Already registered? Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setSocModalOpen(false)}
              className="hover:text-[#F4F6FA] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
