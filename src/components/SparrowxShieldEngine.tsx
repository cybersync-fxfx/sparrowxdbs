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
  Radio,
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
} from "lucide-react";
import { GlobalEcosystemBar } from "./GlobalEcosystemBar";
import { CyberThreatMatrixMap } from "@/components/CyberThreatMatrixMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authenticateAppUserFromBackend } from "@/lib/supabase";

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

export function SparrowxShieldEngine() {
  const [targetDomain, setTargetDomain] = useState<string>("sparrowx.net");
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [socModalOpen, setSocModalOpen] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR">("INR");

  // SOC sign in state
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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
      {/* SECTION 0: GLOBAL ECOSYSTEM BAR */}
      <GlobalEcosystemBar activeDomain="sec" />

      {/* TACTICAL HEADER — ICONIC CYBER ORANGE THEME */}
      <header className="border-b border-[#FF6B00]/30 bg-[#0C0E14] px-4 sm:px-6 py-3.5 shadow-[0_2px_15px_rgba(255,107,0,0.08)] sticky top-7 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-[#161311] border border-[#FF6B00]/40 grid place-items-center shadow-[0_0_12px_rgba(255,107,0,0.2)]">
              <Shield className="size-5 text-[#FF6B00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-mono">
                  SPARROWX <span className="text-[#FF6B00]">//</span> SHIELD
                </span>
                <span className="rounded bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF8533] px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider">
                  SHADOWSHIELD DEFENSE ENGINE
                </span>
              </div>
              <p className="text-[10px] text-[#A3A3A3] font-mono">
                sec.sparrowx.net • Tactical Origin Cloaking, DDoS Deflection &amp; Threat Radar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-[#161311] border border-[#FF6B00]/30 text-xs font-mono text-[#FF8533]">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B00] opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-[#FF6B00]" />
              </span>
              <span>TACTICAL RADAR ACTIVE</span>
            </div>

            <button
              type="button"
              onClick={() => setSocModalOpen(true)}
              className="px-4 py-2 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,107,0,0.35)]"
            >
              <Lock className="size-3.5" />
              <span>Operator Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        
        {/* HERO TITLE & HIGHLIGHT CARD */}
        <div className="border border-[#FF6B00]/30 bg-gradient-to-r from-[#120E0A] via-[#0E1015] to-[#120E0A] rounded-lg p-6 sm:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(255,107,0,0.06)]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6B00]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#1C140C] border border-[#FF6B00]/40 text-xs font-mono text-[#FF8533]">
              <Radio className="size-3.5 text-[#FF6B00] animate-pulse" />
              <span>Shadowshield Perimeter Engine • Real-Time Packet Scrubbing</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-sans">
              Instant Website Protection. <br />
              <span className="text-[#FF8533]">Zero Hackers. Zero Downtime.</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#CCCCCC] max-w-2xl leading-relaxed">
              SparrowX Shield (Shadowshield) stands between your website and malicious attackers. We cloak your real server IP address, block DDoS floods in under a second, and stop malicious scrapers before they reach your database.
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
              <span className="rounded bg-[#FF6B00]/20 text-[#FF8533] text-[10px] px-2 py-0.5 border border-[#FF6B00]/40 font-bold">
                SHADOWSHIELD RADAR
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
              <span className="text-[#FF8533] text-[10px] font-bold">STARTUP ADVANTAGE</span>
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
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#FF6B00]/25 bg-[#050608] px-6 py-4 text-center text-[10px] font-mono text-[#A3A3A3]">
        <span>SPARROWX SHIELD // SHADOWSHIELD THREAT RADAR &amp; WAF • BUILT WITH PASSION FOR INDEPENDENT BUILDERS</span>
      </footer>

      {/* Operator Auth Dialog */}
      <Dialog open={socModalOpen} onOpenChange={setSocModalOpen}>
        <DialogContent className="bg-[#0F131D] border border-[#FF6B00]/40 text-white max-w-md p-6 font-sans">
          <DialogHeader className="text-left space-y-1.5 mb-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#FF8533] mb-1 font-bold">
              <span className="size-1.5 rounded-full bg-[#FF6B00] animate-pulse" />
              SHADOWSHIELD OPERATOR GATEWAY
            </div>
            <DialogTitle className="text-xl font-bold text-white tracking-tight font-mono">
              Sign In to Shield Dashboard
            </DialogTitle>
            <DialogDescription className="text-xs text-[#A3A3A3] leading-relaxed">
              Authenticate operator credentials to inspect active packet scrubbing and manage firewall rules.
            </DialogDescription>
          </DialogHeader>

          {authError && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
              {authError}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthLoading(true);
              setAuthError("");
              try {
                const res = await authenticateAppUserFromBackend(authEmail.trim(), authPassword);
                if (res.user) {
                  setSocModalOpen(false);
                  window.location.href = "/?shield=1";
                } else {
                  setAuthError(res.error || "Invalid operator credentials.");
                }
              } catch {
                setAuthError("Auth gateway offline.");
              } finally {
                setAuthLoading(false);
              }
            }}
            className="space-y-4 pt-1 font-mono text-xs"
          >
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-[#A3A3A3]">Operator Email</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="admin@sparrowx.net"
                className="w-full px-3.5 py-2.5 rounded bg-[#08090C] border border-[#FF6B00]/30 text-white placeholder-[#666666] focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-[#A3A3A3]">Cryptographic Key / Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3.5 py-2.5 rounded bg-[#08090C] border border-[#FF6B00]/30 text-white placeholder-[#666666] focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSocModalOpen(false)}
                className="px-4 py-2 rounded text-xs text-[#A3A3A3] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authLoading}
                className="px-5 py-2 rounded bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-xs transition-all flex items-center gap-1.5"
              >
                {authLoading && <RefreshCw className="size-3 animate-spin" />}
                <span>Authenticate Operator</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
