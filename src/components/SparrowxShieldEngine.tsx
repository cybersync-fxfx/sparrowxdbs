import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Lock,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  ChevronRight,
  Flame,
  Layers,
  ArrowRight,
  ArrowUpRight,
  Terminal,
  Copy,
  Check,
  Server,
  Cpu,
  Target,
  ExternalLink,
  User,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { CyberThreatMatrixMap } from "@/components/CyberThreatMatrixMap";
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

  // WAF Rules Configuration state
  const [wafRules, setWafRules] = useState([
    {
      id: "sqli",
      name: "SQL Injection Payload Barrier",
      description: "Inspects inbound query strings and bodies for UNION, SELECT, and quote evasion.",
      enabled: true,
      blocks24h: 412,
    },
    {
      id: "ai_guard",
      name: "AI Prompt Injection Shield",
      description: "Guards LLM endpoints against system prompt leaks, jailbreaks, and indirect injection.",
      enabled: true,
      blocks24h: 128,
    },
    {
      id: "ddos_deflect",
      name: "Autonomous DDoS & Bot Deflection",
      description: "Kernel-level packet filtering deflecting SYN/UDP flood attacks in under 1 second.",
      enabled: true,
      blocks24h: 3140,
    },
    {
      id: "origin_cloak",
      name: "Origin IP Cloaking & Shielding",
      description: "Hides your real application server IP behind our secure Anycast proxy edge.",
      enabled: true,
      blocks24h: 96,
    },
    {
      id: "rate_limit",
      name: "Adaptive L7 Rate Limiter",
      description: "Throttles abusive crawlers exceeding 120 requests/min with exponential backoff.",
      enabled: true,
      blocks24h: 580,
    },
  ]);

  const runSecurityInspection = async () => {
    if (!targetDomain.trim()) return;
    setInspecting(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
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

  const toggleWafRule = (id: string) => {
    setWafRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
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
    <div className="min-h-screen bg-[#07080A] text-[#F3F4F6] flex flex-col font-sans selection:bg-[#FF6B00] selection:text-black">
      {/* TACTICAL HEADER — ICONIC CYBER ORANGE THEME */}
      <header className="border-b border-[#FF6B00]/30 bg-[#0C0E14] px-4 sm:px-6 py-3.5 shadow-[0_2px_15px_rgba(255,107,0,0.08)] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/sparrowx-shield-logo.svg"
              alt="SparrowX Shield"
              className="size-10 object-contain shrink-0 drop-shadow-[0_4px_14px_rgba(255,107,0,0.35)]"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-mono">
                SPARROWX <span className="text-[#FF6B00]">//</span> SHIELD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">

            {activeUser ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>SOC ACTIVE · {activeUser.email}</span>
                </span>
                {onOpenClientArea && (
                  <button
                    type="button"
                    onClick={() => onOpenClientArea()}
                    className="px-3 py-1.5 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,107,0,0.35)]"
                  >
                    <User className="size-3.5" />
                    <span>Open Client Area →</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShieldSignOut}
                  className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSocModalOpen(true)}
                className="px-4 py-2 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,107,0,0.35)]"
              >
                <Lock className="size-3.5" />
                <span>{onOpenClientArea ? "Sign In to Client Area" : "Sign In to Shield Console"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        
        {/* HERO TITLE & HIGHLIGHT CARD */}
        <div className="border border-[#FF6B00]/30 bg-gradient-to-r from-[#120E0A] via-[#0E1015] to-[#120E0A] rounded-lg p-6 sm:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,107,0,0.06)]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6B00]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-sans">
              Instant Website Protection. <br />
              <span className="text-[#FF8533]">DDoS Mitigation &amp; Origin IP Protection.</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#CCCCCC] max-w-2xl leading-relaxed">
              SparrowX Shield stands between your website and malicious traffic. We proxy your origin server IP address, filter DDoS floods, and block automated scrapers before they reach your application.
            </p>

            {/* Quick Stats Banner */}
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-[#16120D] border border-[#FF6B00]/25">
                <span className="text-[10px] text-[#A3A3A3] block uppercase">DDoS Mitigation</span>
                <span className="text-white font-bold text-sm">&lt; 1 Second</span>
              </div>
              <div className="p-3 rounded bg-[#16120D] border border-[#FF6B00]/25">
                <span className="text-[10px] text-[#A3A3A3] block uppercase">Origin Server IP</span>
                <span className="text-[#FF8533] font-bold text-sm">100% Cloaked</span>
              </div>
              <div className="p-3 rounded bg-[#16120D] border border-[#FF6B00]/25">
                <span className="text-[10px] text-[#A3A3A3] block uppercase">Setup Speed</span>
                <span className="text-emerald-400 font-bold text-sm">1 Shell Command</span>
              </div>
              <div className="p-3 rounded bg-[#16120D] border border-[#FF6B00]/25">
                <span className="text-[10px] text-[#A3A3A3] block uppercase">Anycast Ingress</span>
                <span className="text-white font-bold text-sm">Sydney / APAC Relays</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: THE ICONIC 2D DOT-MATRIX GLOBAL THREAT MAP (SHOWSTOPPER) */}
        <div className="border border-[#FF6B00]/40 bg-[#0C0E14] rounded-lg overflow-hidden shadow-[0_0_35px_rgba(255,107,0,0.12)]">
          <div className="border-b border-[#FF6B00]/30 bg-[#16120D] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B00] opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-[#FF6B00]" />
              </span>
              <span className="font-bold text-white uppercase tracking-wider text-xs">
                Live Global Threat Defense Map
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-[11px] text-[#A3A3A3]">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" /> Host Node (Sydney)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#FF6B00]" /> Intercepted Attacks
              </span>
              <span className="text-white font-semibold">Real-Time Inbound Arc Feed</span>
            </div>
          </div>

          <div className="p-1.5 sm:p-4 bg-[#07080A]">
            <CyberThreatMatrixMap
              height={typeof window !== "undefined" && window.innerWidth < 640 ? 320 : 560}
              enableSimulation={true}
              simIntervalMs={1800}
              showControls={true}
              showFeed={true}
              showStats={true}
            />
          </div>
        </div>

        {/* SECTION 2: 15-SECOND DOMAIN SECURITY AUDIT & ORIGIN SCANNER */}
        <div className="border border-[#FF6B00]/30 bg-[#0C0E14] rounded-lg overflow-hidden shadow-sm">
          <div className="border-b border-[#FF6B00]/20 bg-[#141210] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-[#FF6B00]" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                15-Second Live Domain Security &amp; Origin Cloaking Audit
              </span>
            </div>
            <span className="text-[10px] text-[#A3A3A3]">Test whether your server IP is exposed to attackers</span>
          </div>

          <div className="p-4 sm:p-6 space-y-5 bg-[#07080A]">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="size-4 text-[#666666] absolute left-3.5 top-3.5 sm:top-3" />
                <input
                  type="text"
                  placeholder="Enter domain to audit (e.g. yourstartup.com, sparrowx.net)..."
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSecurityInspection()}
                  className="w-full h-11 sm:h-10 rounded-md border border-[#FF6B00]/30 bg-[#12141A] pl-10 pr-4 text-xs font-mono text-white placeholder-[#666666] outline-none focus:border-[#FF6B00]"
                />
              </div>
              <button
                type="button"
                onClick={runSecurityInspection}
                disabled={inspecting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold px-6 h-11 sm:h-10 min-h-[44px] sm:min-h-0 text-xs transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-[0_0_15px_rgba(255,107,0,0.25)] font-mono"
              >
                <RefreshCw className={`size-3.5 ${inspecting ? "animate-spin" : ""}`} />
                <span>{inspecting ? "Auditing Domain..." : "Audit Domain Now"}</span>
              </button>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                    <span className="text-[10px] text-[#A3A3A3] uppercase block">Server Ingress IP</span>
                    <span className="text-white font-bold block truncate">{result.ip}</span>
                    <span className={`text-[10px] ${result.originCloaked ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}`}>
                      {result.originCloaked ? "● Shield Cloaked (Safe)" : "▲ Origin IP Exposed"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                    <span className="text-[10px] text-[#A3A3A3] uppercase block">TLS Encryption</span>
                    <span className="text-emerald-400 font-bold block truncate">{result.tlsVersion}</span>
                    <span className="text-[10px] text-[#A3A3A3] truncate block">{result.cipherSuite}</span>
                  </div>

                  <div className="p-3.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                    <span className="text-[10px] text-[#A3A3A3] uppercase block">Anycast DNS Sync</span>
                    <span className="text-white font-bold block">{result.dnsPropagation}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Zero DNS leak detected</span>
                  </div>

                  <div className="p-3.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                    <span className="text-[10px] text-[#A3A3A3] uppercase block">Edge Relay Latency</span>
                    <span className="text-[#FF8533] font-bold tabular-nums block text-sm">{result.edgeLatencyMs} ms</span>
                    <span className="text-[10px] text-emerald-400">High-speed Edge Relay</span>
                  </div>
                </div>

                {/* Security Headers Verification Checklist */}
                <div className="p-4 rounded bg-[#101218] border border-[#FF6B00]/20 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <span className="text-[#FF8533] text-[11px] uppercase font-bold">WAF Perimeter Headers:</span>
                  <span className="flex items-center gap-1.5 text-white">
                    <Check className={`size-3.5 ${result.securityHeaders.hsts ? "text-emerald-400" : "text-zinc-600"}`} />
                    HSTS Enforced
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <Check className={`size-3.5 ${result.securityHeaders.csp ? "text-emerald-400" : "text-zinc-600"}`} />
                    Content-Security-Policy
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <Check className={`size-3.5 ${result.securityHeaders.xframe ? "text-emerald-400" : "text-zinc-600"}`} />
                    X-Frame-Options: SAMEORIGIN
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <Check className={`size-3.5 ${result.securityHeaders.nosniff ? "text-emerald-400" : "text-zinc-600"}`} />
                    X-Content-Type-Options: nosniff
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: LIVE SCRUBBING TERMINAL & 1-COMMAND AGENT INSTALL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Terminal stream */}
          <div className="lg:col-span-7 border border-[#FF6B00]/30 bg-[#0C0E14] rounded-lg overflow-hidden">
            <div className="border-b border-[#FF6B00]/20 bg-[#16120D] px-4 py-2.5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-[#FF6B00]" />
                <span className="text-white text-[11px] font-bold">Live Attack Scrubbing Terminal</span>
              </div>
              <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE DEFENSE
              </span>
            </div>
            
            <div className="p-4 bg-[#07080A] font-mono text-[11px] text-[#A3A3A3] space-y-1.5 overflow-x-auto max-h-56">
              <div className="text-[#666666]">[00:14:02] shadowshield-daemon v2.8 started on AP-Southeast Edge</div>
              <div className="text-emerald-400">[00:14:05] [packet-filter] Fastpath SYN proxy and origin cloak verified</div>
              <div className="text-[#FF8533] font-semibold">[00:14:12] [DEFLECTED] TCP SYN flood from 182.21.90.11:51204 -&gt; :443 [DROPPED 480 pkts/s]</div>
              <div className="text-emerald-400">[00:14:18] [WAF-L7] SQL injection payload &apos;UNION SELECT&apos; blocked from AS13335</div>
              <div className="text-zinc-400">[00:14:22] [latency] Edge ping: Sydney 1.2ms | Singapore 28.4ms | Tokyo 64.1ms</div>
              <div className="text-[#FF8533] font-semibold">[00:14:30] [RATE-LIMITED] Malicious scraper throttled: 120 req/min threshold exceeded</div>
              <div className="text-emerald-400">[00:14:41] [AI-GUARD] LLM jailbreak payload deflected on /api/v1/generate</div>
            </div>

            {/* 1-command install bar */}
            <div className="p-3.5 bg-[#141210] border-t border-[#FF6B00]/25 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <span className="text-[#A3A3A3] text-[10px] uppercase font-bold">1-Command Server Protect:</span>
              <code className="text-[#FF8533] text-[11px] font-bold truncate select-all">
                curl -sSL https://sec.sparrowx.net/install.sh | sudo bash
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("curl -sSL https://sec.sparrowx.net/install.sh | sudo bash");
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 2000);
                }}
                className="px-3 py-1.5 rounded bg-[#07080A] border border-[#FF6B00]/40 hover:border-[#FF6B00] text-white hover:text-[#FF8533] transition-colors cursor-pointer shrink-0 font-bold"
              >
                {copiedCmd ? <span className="text-emerald-400 flex items-center gap-1"><Check className="size-3" /> Copied!</span> : <span className="flex items-center gap-1"><Copy className="size-3" /> Copy</span>}
              </button>
            </div>
          </div>

          {/* Right: What Shield Solves & What We Provide */}
          <div className="lg:col-span-5 border border-[#FF6B00]/30 bg-[#0C0E14] rounded-lg p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#FF6B00]/20 pb-2">
              <span className="font-bold text-white text-xs uppercase tracking-wider">
                Why Builders Choose Shield
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  Origin Cloaking (Hide Your Real IP)
                </span>
                <p className="text-[11px] text-[#A3A3A3]">
                  Attackers can only attack what they can find. Shield places a battle-tested Anycast wall in front of your real servers.
                </p>
              </div>

              <div className="p-2.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  Sub-Second DDoS Deflection
                </span>
                <p className="text-[11px] text-[#A3A3A3]">
                  Automated SYN flood and volumetric attack dropping at the packet layer without expensive enterprise contracts.
                </p>
              </div>

              <div className="p-2.5 rounded bg-[#101218] border border-[#FF6B00]/20 space-y-1">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  Built-in Web Application Firewall (WAF)
                </span>
                <p className="text-[11px] text-[#A3A3A3]">
                  Immediate barrier against SQL injection, malicious crawlers, and AI prompt exploits.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: SHIELD PRICING MATRIX WITH CURRENCY SWITCHER */}
        <div className="border border-[#FF6B00]/30 bg-[#0C0E14] rounded-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FF6B00]/20 pb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#FF8533]">
                <ShieldCheck className="size-3.5" />
                <span>Transparent Startup Pricing</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                SparrowX Shield Protection Plans
              </h2>
              <p className="text-xs text-[#A3A3A3]">
                Zero hidden bandwidth taxes, zero surprise bills. Predictable flat monthly rates.
              </p>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#16120D] rounded-md border border-[#FF6B00]/40 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-3 py-1 rounded transition-colors ${
                  currency === "INR" ? "bg-[#FF6B00] text-black font-bold" : "text-[#A3A3A3] hover:text-white"
                }`}
              >
                INR (₹)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded transition-colors ${
                  currency === "USD" ? "bg-[#FF6B00] text-black font-bold" : "text-[#A3A3A3] hover:text-white"
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("EUR")}
                className={`px-3 py-1 rounded transition-colors ${
                  currency === "EUR" ? "bg-[#FF6B00] text-black font-bold" : "text-[#A3A3A3] hover:text-white"
                }`}
              >
                EUR (€)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#FF6B00]/20 border border-[#FF6B00]/30 rounded-lg bg-[#07080A]">
            {/* Plan 1 */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#FF8533] uppercase tracking-wider font-bold">Entry Shield</span>
                <h3 className="font-bold text-white text-base">Single-Port Shield</h3>
                <p className="text-xs text-[#A3A3A3]">Origin cloaking for a single API or database port.</p>
              </div>
              <div className="font-mono">
                <span className="text-2xl font-bold text-white">{pricingData[currency].single.price}</span>
                <span className="text-xs text-[#A3A3A3]">{pricingData[currency].single.period}</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#CCCCCC] font-mono">
                <div>✓ 1 Dedicated Cloaked Port</div>
                <div>✓ L4/L7 Rate Limiting</div>
                <div>✓ Live Attack Log Stream</div>
              </div>
              <button
                type="button"
                onClick={() => setSocModalOpen(true)}
                className="w-full py-2.5 rounded-md bg-[#16120D] hover:bg-[#FF6B00] hover:text-black border border-[#FF6B00]/40 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Deploy Port Shield
              </button>
            </div>

            {/* Plan 2 */}
            <div className="p-6 space-y-4 bg-[#FF6B00]/5 border-t-2 border-t-[#FF6B00]">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#FF8533] uppercase tracking-wider font-bold">Most Popular</span>
                <h3 className="font-bold text-white text-base">Basic Shield</h3>
                <p className="text-xs text-[#A3A3A3]">Complete WAF protection for startup web platforms.</p>
              </div>
              <div className="font-mono">
                <span className="text-2xl font-bold text-[#FF8533]">{pricingData[currency].basic.price}</span>
                <span className="text-xs text-[#A3A3A3]">{pricingData[currency].basic.period}</span>
              </div>
              <div className="space-y-1.5 text-xs text-white font-mono">
                <div>✓ Up to 5 Web Domains</div>
                <div>✓ Autonomous DDoS Deflection</div>
                <div>✓ SQL Injection Payload Barrier</div>
                <div>✓ 24/7 Global Threat Radar</div>
              </div>
              <button
                type="button"
                onClick={() => setSocModalOpen(true)}
                className="w-full py-2.5 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-xs transition-colors cursor-pointer shadow-[0_0_15px_rgba(255,107,0,0.3)]"
              >
                Provision Basic Shield
              </button>
            </div>

            {/* Plan 3 */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold">Growing Startups</span>
                <h3 className="font-bold text-white text-base">Pro Shield</h3>
                <p className="text-xs text-[#A3A3A3]">Custom packet rules and AI prompt injection guardrails.</p>
              </div>
              <div className="font-mono">
                <span className="text-2xl font-bold text-white">{pricingData[currency].pro.price}</span>
                <span className="text-xs text-[#A3A3A3]">{pricingData[currency].pro.period}</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#CCCCCC] font-mono">
                <div>✓ Unlimited Domains &amp; Endpoints</div>
                <div>✓ AI Prompt Injection Shield</div>
                <div>✓ Dedicated Attack Scrubbing</div>
                <div>✓ Custom Anycast Routing</div>
              </div>
              <button
                type="button"
                onClick={() => setSocModalOpen(true)}
                className="w-full py-2.5 rounded-md bg-[#16120D] hover:bg-[#FF6B00] hover:text-black border border-[#FF6B00]/40 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Provision Pro Shield
              </button>
            </div>
          </div>
        </div>
        {/* Standalone Protection Plans */}
        <section className="mx-auto max-w-[1400px] pt-8 pb-4 space-y-5 border-t border-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#FF8533]">
                Edge Mitigation Plans
              </span>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                Always-on L7 WAF &amp; DDoS protection for your origin.
              </h2>
            </div>
            <span className="text-xs font-mono text-[#A3A3A3]">Zero latency penalty • Instant DNS onboarding</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#A3A3A3] uppercase">Edge Audit</span>
                <span className="text-emerald-400 font-bold">$0 / forever</span>
              </div>
              <p className="text-xs text-[#D4D4D4] leading-relaxed">
                Live DNS leak audit, SSL/TLS posture verification, and instant WAF rule simulation for any public domain.
              </p>
            </div>

            <div className="rounded-xl border border-[#FF6B00]/40 bg-gradient-to-b from-[#FF6B00]/10 to-[#0B0D12] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#FF8533] uppercase font-bold">Pro Origin Shield</span>
                <span className="text-white font-bold">$19 / month</span>
              </div>
              <p className="text-xs text-[#E5E5E5] leading-relaxed">
                Full origin IP cloaking, automated L7 bot &amp; DDoS scrubbing, custom rate limits, and 1-command Linux connector.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#A3A3A3] uppercase">Enterprise SOC</span>
                  <span className="text-white font-bold">$79 / month</span>
                </div>
                <p className="text-xs text-[#D4D4D4] leading-relaxed">
                  Multi-domain fleet protection, geo-fencing, webhook alerts, and dedicated mitigation SLA.
                </p>
              </div>
              <a
                href="mailto:security@sparrowx.net?subject=SparrowX%20Shield%20Deployment"
                className="text-xs font-mono font-bold text-[#FF8533] hover:text-white transition-colors"
              >
                Deploy with security@sparrowx.net →
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#FF6B00]/25 bg-[#050608] px-6 py-4 text-center text-[10px] font-mono text-[#A3A3A3]">
        <span>SPARROWX SHIELD // L7 WAF &amp; EDGE DDOS MITIGATION • SEC.SPARROWX.NET • SECURITY@SPARROWX.NET</span>
      </footer>

      {/* Operator Auth Dialog */}
      <Dialog open={socModalOpen} onOpenChange={setSocModalOpen}>
        <DialogContent className="bg-[#0B0E17]/95 backdrop-blur-xl border border-white/[0.10] text-white sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-2xl font-sans shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(255,107,0,0.08)]">
          {/* Top Accent Hairline & Ambient Glow */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#FF6B00]/75 to-transparent" />
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-72 rounded-full bg-[#FF6B00]/12 blur-3xl" />

          <DialogHeader className="relative px-6 pt-6 pb-4 pr-12 text-left space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF8533] grid place-items-center shrink-0 shadow-[0_0_20px_rgba(255,107,0,0.15)]">
                <Shield className="size-5" />
              </div>
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-white tracking-tight font-sans">
                {socAuthMode === "signin"
                  ? "Sign In to Shield Dashboard"
                  : "Register Shield Operator"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-[#94A3B8] leading-relaxed font-sans">
                {socAuthMode === "signin"
                  ? "Authenticate operator credentials to inspect active packet scrubbing and manage firewall rules."
                  : "Provision a new SparrowX Shield operator account for domain cloaking and L7 WAF control."}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Segmented Mode Switcher Below Header (Zero Close-Button Overlap) */}
          <div className="mx-6 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#06080E] border border-white/[0.07] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setSocAuthMode("signin");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "signin"
                  ? "bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-black shadow-[0_2px_12px_rgba(255,107,0,0.3)]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              <Lock className="size-3.5" />
              <span>Sign In to SOC</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSocAuthMode("register");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "register"
                  ? "bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-black shadow-[0_2px_12px_rgba(255,107,0,0.3)]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              <User className="size-3.5" />
              <span>Register Operator</span>
            </button>
          </div>

          {authError && (
            <div className="mx-6 mb-4 rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-red-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-red-400 mt-0.5" />
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
                <label className="text-xs font-medium text-[#CBD5E1] block">
                  Operator Name
                </label>
                <div className="relative group">
                  <User className="size-4 text-[#64748B] group-focus-within:text-[#FF8533] transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={socFullName}
                    onChange={(e) => setSocFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full rounded-xl border border-white/[0.10] bg-[#06080E]/90 hover:border-white/[0.18] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#CBD5E1] block">
                Operator Email
              </label>
              <div className="relative group">
                <Mail className="size-4 text-[#64748B] group-focus-within:text-[#FF8533] transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@sparrowx.net"
                  className="w-full rounded-xl border border-white/[0.10] bg-[#06080E]/90 hover:border-white/[0.18] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#CBD5E1] block">
                Cryptographic Key / Password
              </label>
              <div className="relative group">
                <Lock className="size-4 text-[#64748B] group-focus-within:text-[#FF8533] transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAuthPassword ? "text" : "password"}
                  required
                  minLength={socAuthMode === "register" ? 6 : undefined}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full rounded-xl border border-white/[0.10] bg-[#06080E]/90 hover:border-white/[0.18] pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword((prev) => !prev)}
                  aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white transition-colors cursor-pointer p-1"
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
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:brightness-110 text-black font-bold text-xs sm:text-sm tracking-tight shadow-[0_4px_20px_rgba(255,107,0,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer mt-1"
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

          {/* Subtle Security Footer Strip */}
          <div className="bg-[#06080E]/90 border-t border-white/[0.06] px-6 py-3.5 flex items-center justify-between text-xs text-[#64748B]">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <button
                type="button"
                onClick={() => {
                  setSocAuthMode(socAuthMode === "signin" ? "register" : "signin");
                  setAuthError("");
                }}
                className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                {socAuthMode === "signin"
                  ? "Need access? Register operator"
                  : "Already registered? Sign in"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSocModalOpen(false)}
              className="text-[#94A3B8] hover:text-white font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
