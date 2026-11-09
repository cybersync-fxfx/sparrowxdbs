import React, { useState } from "react";
import {
  Database,
  FileUp,
  KeyRound,
  ShieldCheck,
  Terminal,
  Server,
  ArrowRight,
  ExternalLink,
  Lock,
  Zap,
  Globe2,
  CheckCircle2,
  Cpu,
  Layers,
  HardDrive,
  Copy,
  Check,
  Search,
  Sparkles,
  ChevronRight,
  Activity,
  Fingerprint,
  RefreshCw,
} from "lucide-react";
import { LandingLiveSecurityScanner } from "@/components/GrowthAndMonetizationHub";

interface SparrowxMasterLandingProps {
  onOpenLogin: () => void;
  onDirectNav?: (target: string) => void;
}

export function SparrowxMasterLanding({
  onOpenLogin,
  onDirectNav,
}: SparrowxMasterLandingProps) {
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDomain(text);
    setTimeout(() => setCopiedDomain(null), 2000);
  };

  const handleLaunchService = (subdomain: string, queryParam: string) => {
    // If running in production with real domains, navigate to the subdomain
    if (
      typeof window !== "undefined" &&
      window.location.hostname.includes("sparrowx.net")
    ) {
      window.location.href = `https://${subdomain}.sparrowx.net`;
      return;
    }

    // In local dev or fallback environment, use query parameter or direct navigation
    if (onDirectNav) {
      onDirectNav(queryParam);
    } else if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set(queryParam, "1");
      window.location.href = url.toString();
    }
  };

  const products = [
    {
      id: "db",
      subdomain: "db",
      title: "SparrowX DB",
      subtitle: "Sovereign BaaS & PostgreSQL 16 Studio",
      badge: "PostgreSQL 16 • pgvector",
      color: "emerald",
      borderGlow: "border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20",
      accentBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      icon: Database,
      description:
        "The complete self-hosted alternative to Supabase. Features a visual schema and dynamic column designer, instant SQL scratchpad, connection pooling on port 6543, and automated disaster recovery backups.",
      features: [
        "PostgreSQL 16.2 with native pgvector 0.7.0 embeddings",
        "PgBouncer high-throughput pooler on port 6543",
        "Automated JSON schema & database migration engine",
        "Instant disaster recovery & one-click cloud exports",
      ],
      linkText: "Launch SparrowX DB",
      urlDisplay: "https://db.sparrowx.net",
    },
    {
      id: "file",
      subdomain: "file",
      title: "SparrowX Files",
      subtitle: "MediaFire-Style Persistent NVMe Storage & RAM Drop",
      badge: "Dual-Mode • NVMe Storage",
      color: "cyan",
      borderGlow: "border-cyan-500/30 hover:border-cyan-500/60 shadow-cyan-950/20",
      accentBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      icon: FileUp,
      description:
        "Upload files directly to dedicated server NVMe disk to generate permanent shareable URLs (file.sparrowx.net/f/<id>) with download counters, or toggle into Zero-Disk Ephemeral Drop with browser RAM AES-GCM 256-bit P2P encryption.",
      features: [
        "Permanent NVMe disk storage with unique file hash URLs",
        "Zero-disk ephemeral P2P drop with 15-minute RAM auto-purge",
        "Live download hit counters & client-side file deletion",
        "Web Crypto AES-GCM 256-bit encryption before wire transfer",
      ],
      linkText: "Launch SparrowX Files",
      urlDisplay: "https://file.sparrowx.net",
    },
    {
      id: "password",
      subdomain: "password",
      title: "SparrowX Keys",
      subtitle: "100% Offline Cryptographic & Password Engine",
      badge: "Web Crypto • 0 Network Calls",
      color: "purple",
      borderGlow: "border-purple-500/30 hover:border-purple-500/60 shadow-purple-950/20",
      accentBg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      icon: KeyRound,
      description:
        "Native browser Web Crypto CSPRNG generator. Calculates real-time Shannon entropy, generates high-security alphanumeric secrets, Diceware passphrases, and 256-bit API bearer tokens without a single packet leaving your device.",
      features: [
        "W3C Web Cryptography API (window.crypto.getRandomValues)",
        "Mathematical Shannon Entropy analyzer with visual strength meters",
        "Custom symbol matrices, Diceware passphrases & API tokens",
        "Zero server roundtrips, zero storage leaks, zero tracking",
      ],
      linkText: "Launch SparrowX Keys",
      urlDisplay: "https://password.sparrowx.net",
    },
    {
      id: "sec",
      subdomain: "sec",
      title: "SparrowX Shield",
      subtitle: "Autonomous Edge WAF & Threat Mitigation SOC",
      badge: "Edge WAF • AI Guardrails",
      color: "emerald",
      borderGlow: "border-blue-500/30 hover:border-blue-500/60 shadow-blue-950/20",
      accentBg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      icon: ShieldCheck,
      description:
        "Reverse proxy edge protection, AI prompt injection guardrails, Redis threat caching, origin IP cloaking, and real-time security operations center telemetry running on dedicated OVH hardware.",
      features: [
        "High-performance edge WAF with sub-10ms packet evaluation",
        "AI LLM prompt injection & jailbreak detection filters",
        "Redis cluster threat cache for instant IP rate-limiting",
        "Real-time SOC incident timeline & compliance attestations",
      ],
      linkText: "Launch SparrowX Shield",
      urlDisplay: "https://sec.sparrowx.net",
    },
    {
      id: "api",
      subdomain: "api",
      title: "SparrowX API Gateway",
      subtitle: "High-Performance Sovereign PostgREST API",
      badge: "PostgREST 12 • OpenAPI 3.0",
      color: "amber",
      borderGlow: "border-amber-500/30 hover:border-amber-500/60 shadow-amber-950/20",
      accentBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      icon: Terminal,
      description:
        "Automated REST API compiled directly from your database schema into lightning-fast C/Rust binary queries. Includes interactive OpenAPI documentation, schema inspector, and live query runner.",
      features: [
        "Sub-millisecond PostgREST 12 query-to-JSON serialization",
        "Interactive Swagger / OpenAPI live endpoint documentation",
        "cURL, TypeScript, and Python SDK code generators",
        "Role-based JWT authorization header verification",
      ],
      linkText: "Launch API Gateway",
      urlDisplay: "https://api.sparrowx.net",
    },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-100 flex flex-col font-sans selection:bg-[#00F2FE] selection:text-zinc-950">
      {/* 1. TOP LIVE FLEET TELEMETRY RIBBON */}
      <div className="bg-[#070D18] border-b border-[#1E293B] px-4 py-2 text-xs text-zinc-300 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            BARE-METAL CLUSTER ACTIVE
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-400 hidden sm:inline">
            Node: <span className="text-zinc-200">sparrowx1 (10.10.10.10)</span>
          </span>
          <span className="text-zinc-600 hidden md:inline">•</span>
          <span className="text-zinc-400 hidden md:inline">
            Ingress Proxy: <span className="text-zinc-200">NPM (10.10.10.2)</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
            0% THIRD-PARTY TELEMETRY
          </span>
          <span className="rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 text-[10px] font-bold">
            100% NVMe PERSISTENCE
          </span>
        </div>
      </div>

      {/* 2. GLOBAL NAVIGATION HEADER */}
      <header className="border-b border-[#1E293B]/80 bg-[#030712]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#0B1528] to-[#050B14] border border-[#1E293B] grid place-items-center shadow-lg p-1.5">
            <img
              src="/sparrowx-cyber-hawk.png"
              alt="SparrowX Technologies Emblem"
              className="size-7 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-white">
                SparrowX <span className="text-[#00F2FE]">Technologies</span>
              </span>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                Ecosystem Hub
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              sparrowx.net • Sovereign Cloud & Privacy Suite
            </p>
          </div>
        </div>

        {/* Desktop Anchor Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <a
            href="#products"
            className="hover:text-cyan-400 transition-colors"
          >
            Sovereign Products
          </a>
          <a
            href="#architecture"
            className="hover:text-cyan-400 transition-colors"
          >
            System Topology
          </a>
          <a
            href="#scanner"
            className="hover:text-cyan-400 transition-colors"
          >
            Free Security Scan
          </a>
          <a
            href="#manifesto"
            className="hover:text-cyan-400 transition-colors"
          >
            Sovereign Manifesto
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenLogin}
            className="px-4 py-2 rounded-lg bg-[#0E1726] border border-[#1E293B] hover:border-cyan-500/50 hover:bg-[#121E32] text-xs font-semibold text-zinc-200 transition-all flex items-center gap-2"
          >
            <Lock className="size-3.5 text-cyan-400" />
            <span>Sign In to Console</span>
          </button>

          <a
            href="#products"
            className="hidden sm:flex px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-zinc-950 transition-all items-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <span>Explore Services</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative px-6 pt-20 pb-16 overflow-hidden border-b border-[#1E293B]/60">
        {/* Cyber grid and luminous backdrops */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-cyan-500/15 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D1525] border border-cyan-500/30 text-xs font-mono text-cyan-400 mb-6 shadow-inner">
            <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
            SPARROWX TECHNOLOGIES • BARE-METAL SOVEREIGN PRIVACY CLOUD
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight">
            Defend. Store. Share. <br />
            <span className="bg-gradient-to-r from-[#00F2FE] via-[#38BDF8] to-[#10B981] bg-clip-text text-transparent">
              Without Leaving a Trace.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            A battle-hardened suite of zero-knowledge developer tools, edge defense, persistent cloud storage, and sovereign databases. Built for radical data ownership with zero remote telemetry, zero VC surveillance, and mathematically verified cryptographic isolation.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#products"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 hover:opacity-95 text-sm font-bold text-zinc-950 transition-all flex items-center gap-2 shadow-xl shadow-cyan-500/20"
            >
              <span>Explore Sovereign Products</span>
              <ArrowRight className="size-4" />
            </a>

            <a
              href="#scanner"
              className="px-6 py-3.5 rounded-xl bg-[#0D1525] border border-[#1E293B] hover:border-cyan-500/40 text-sm font-semibold text-zinc-200 transition-all flex items-center gap-2"
            >
              <Search className="size-4 text-cyan-400" />
              <span>Run Free Domain Scanner</span>
            </a>

            <button
              type="button"
              onClick={onOpenLogin}
              className="px-6 py-3.5 rounded-xl bg-[#0B101D] border border-emerald-500/30 hover:border-emerald-500/60 text-sm font-semibold text-emerald-400 transition-all flex items-center gap-2"
            >
              <ShieldCheck className="size-4" />
              <span>Access SOC Console</span>
            </button>
          </div>

          {/* Infrastructure Metrics Strip */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-[#070D18]/80 border border-[#1E293B] backdrop-blur-sm text-left">
              <div className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                Ingress Latency
              </div>
              <div className="mt-1 text-2xl font-black text-cyan-400 font-mono">
                &lt; 12ms
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Nginx Proxy Manager on bare-metal
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#070D18]/80 border border-[#1E293B] backdrop-blur-sm text-left">
              <div className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                Relational DB Engine
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-400 font-mono">
                PG 16 + Vector
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Port 5432 &amp; PgBouncer :6543
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#070D18]/80 border border-[#1E293B] backdrop-blur-sm text-left">
              <div className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                Crypto Verification
              </div>
              <div className="mt-1 text-2xl font-black text-purple-400 font-mono">
                100% Offline
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Native Web Crypto CSPRNG
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#070D18]/80 border border-[#1E293B] backdrop-blur-sm text-left">
              <div className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                Storage Engine
              </div>
              <div className="mt-1 text-2xl font-black text-amber-400 font-mono">
                NVMe + RAM
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Permanent link hashes &amp; P2P Drop
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE 5 CORE SOVEREIGN PRODUCTS */}
      <section id="products" className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 mb-3">
            <Layers className="size-3.5" />
            INDEPENDENT DEDICATED DOMAIN SERVICES
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            The SparrowX Sovereign Fleet
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400">
            Every core pillar operates as a dedicated standalone website with its own specialized subdomain, optimized routing, and full cryptographic isolation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl bg-[#070D18] border transition-all duration-300 p-6 flex flex-col justify-between shadow-xl ${p.borderGlow} group`}
              >
                <div>
                  {/* Top Bar with subdomain pill and live status */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${p.accentBg}`}
                    >
                      <Globe2 className="size-3" />
                      {p.urlDisplay.replace("https://", "")}
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(p.urlDisplay)}
                      title="Copy Subdomain URL"
                      className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                      {copiedDomain === p.urlDisplay ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="p-3 rounded-xl bg-[#0D1525] border border-[#1E293B] group-hover:scale-105 transition-transform">
                      <Icon className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {p.title}
                      </h3>
                      <div className="text-xs text-zinc-400 font-medium">
                        {p.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                    {p.description}
                  </p>

                  {/* Feature Bullets */}
                  <div className="space-y-2 mb-6 border-t border-[#1E293B]/70 pt-4">
                    {p.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs text-zinc-300"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct Launch Button */}
                <div className="pt-4 border-t border-[#1E293B]/70">
                  <button
                    type="button"
                    onClick={() => handleLaunchService(p.subdomain, p.id)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0D1525] border border-[#1E293B] group-hover:bg-white group-hover:text-zinc-950 hover:border-transparent text-xs font-bold text-zinc-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>{p.linkText}</span>
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 6th Card: Operator Management & SOC Console */}
          <div className="relative rounded-2xl bg-gradient-to-br from-[#070D18] to-[#0A1220] border border-[#1E293B] hover:border-cyan-500/40 p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  <Activity className="size-3" />
                  Operator Console
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  RESTRICTED
                </span>
              </div>

              <div className="flex items-center gap-3.5 mb-3">
                <div className="p-3 rounded-xl bg-[#0D1525] border border-[#1E293B]">
                  <Fingerprint className="size-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    SOC &amp; Admin Command
                  </h3>
                  <div className="text-xs text-zinc-400 font-medium">
                    Unified Operator Management
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Authenticate with your cryptographic admin key or tenant credentials to access live incident response feeds, SIEM audit trails, subscriber management, and sovereign node monitors.
              </p>

              <div className="space-y-2 mb-6 border-t border-[#1E293B]/70 pt-4">
                <div className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Interactive 3D threat globe &amp; live packet telemetry</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Real-time tenant credit ledger &amp; audit logging</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>One-click ISO 27001 &amp; SOC 2 report generation</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1E293B]/70">
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-xs font-bold text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
              >
                <span>Sign In to Admin Console</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LIVE SYSTEM ARCHITECTURE & TOPOLOGY MAP */}
      <section id="architecture" className="px-6 py-20 bg-[#02050D] border-y border-[#1E293B]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-400 mb-3">
              <Cpu className="size-3.5" />
              DEPLOYMENT TOPOLOGY
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Sovereign Multi-Subdomain Architecture
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-zinc-400">
              How traffic flows from Public Internet through Nginx Proxy Manager (10.10.10.2) into the SparrowX VPS Fleet (10.10.10.10).
            </p>
          </div>

          {/* Interactive Topology Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1: Ingress Layer */}
            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <div className="text-xs font-mono text-cyan-400 font-bold mb-2">
                LAYER 1 • EDGE INGRESS
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                Nginx Proxy Manager
              </h4>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                SSL Termination via Let&apos;s Encrypt, DDoS rate-limiting, and WebSocket multiplexing hosted on reverse-proxy VPS (10.10.10.2).
              </p>
              <div className="space-y-1.5 font-mono text-[11px] bg-[#030712] p-3 rounded-lg border border-[#1E293B]">
                <div className="text-emerald-400">sparrowx.net → Port 80</div>
                <div className="text-cyan-400">db.sparrowx.net → Port 80</div>
                <div className="text-purple-400">file.sparrowx.net → Port 80</div>
                <div className="text-amber-400">password.sparrowx.net → Port 80</div>
                <div className="text-blue-400">sec.sparrowx.net → Port 80</div>
                <div className="text-pink-400">api.sparrowx.net → Port 80</div>
              </div>
            </div>

            {/* Step 2: Ingress Routing */}
            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <div className="text-xs font-mono text-emerald-400 font-bold mb-2">
                LAYER 2 • HOST ROUTING
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                SparrowX VPS Fleet (10.10.10.10)
              </h4>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Host-level router isolates traffic by domain header. Programmatic PostgREST calls bypass the web layer and stream directly into the gateway.
              </p>
              <div className="space-y-1.5 font-mono text-[11px] bg-[#030712] p-3 rounded-lg border border-[#1E293B]">
                <div className="text-zinc-300">Web App Studio :3000</div>
                <div className="text-zinc-300">PostgREST API :3001</div>
                <div className="text-zinc-300">PgBouncer Pooler :6543</div>
                <div className="text-zinc-300">PostgreSQL 16 :5432</div>
                <div className="text-zinc-300">Redis Threat Cache :6379</div>
              </div>
            </div>

            {/* Step 3: Persistence & Storage */}
            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <div className="text-xs font-mono text-purple-400 font-bold mb-2">
                LAYER 3 • DATA PERSISTENCE
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                Local NVMe Disk Volumes
              </h4>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Data never leaves your bare-metal server. Persistent volumes mount directly into Linux host NVMe storage without external S3 dependencies.
              </p>
              <div className="space-y-1.5 font-mono text-[11px] bg-[#030712] p-3 rounded-lg border border-[#1E293B]">
                <div className="text-cyan-400">sparrowx_file_storage → /app/data/storage</div>
                <div className="text-emerald-400">sparrowx_pgdata → /var/lib/postgresql</div>
                <div className="text-amber-400">sparrowx_redis_data → /data</div>
                <div className="text-zinc-400">Shannon Entropy: 100% Client RAM</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. EMBEDDED FREE 15-SECOND DOMAIN SCANNER */}
      <section id="scanner" className="px-6 py-20 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-400 mb-3">
            <Zap className="size-3.5" />
            FREE INSTANT SECURITY AUDIT
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Scan Any Domain in 15 Seconds
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-zinc-400">
            Check live DNS records, TLS/SSL cipher suites, CORS security headers, security.txt policy, and AI prompt leakage without creating an account.
          </p>
        </div>

        <div className="rounded-2xl bg-[#070D18] border border-[#1E293B] p-6 shadow-2xl">
          <LandingLiveSecurityScanner />
        </div>
      </section>

      {/* 7. WHY SPARROWX TECHNOLOGIES (THE SOVEREIGN MANIFESTO) */}
      <section id="manifesto" className="px-6 py-20 bg-[#02050D] border-t border-[#1E293B]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 mb-3">
              <ShieldCheck className="size-3.5" />
              THE SOVEREIGN PROMISE
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Why SparrowX Technologies?
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-zinc-400">
              Modern clouds charge rent on your data while feeding telemetry into Big Tech models. SparrowX is built with a different philosophy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-cyan-400" />
                Zero VC Telemetry Beacons
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Most cloud providers inject tracking scripts, analytics pixels, and profiling tools into every dashboard. SparrowX contains 0 external trackers. The code running on your client talks only to your bare-metal server.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                100% Bare-Metal Hardware Custody
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your PostgreSQL tables, your uploaded files, your firewall policies, and your logs live in local directories on your server. If you disconnect the machine from the internet, every service remains fully operational.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-purple-400" />
                Mathematically Verified Cryptography
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Keys and ephemeral files are processed using native Web Cryptography API primitives (AES-GCM 256-bit and CSPRNG). Entropy is calculated in real-time in RAM and zeroed out immediately when you close the tab.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070D18] border border-[#1E293B]">
              <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-400" />
                Native High-Throughput Performance
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Instead of bloated Node microservices for every request, SparrowX routes database operations through native C/Rust engines (PostgREST &amp; PgBouncer) capable of sustaining 15,000+ requests per second with sub-millisecond response times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-[#1E293B] bg-[#010309] px-6 py-12 text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-[#0B1528] border border-[#1E293B] grid place-items-center p-1">
              <img
                src="/sparrowx-cyber-hawk.png"
                alt="SparrowX Emblem"
                className="size-6 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                SparrowX Technologies Inc.
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                The Sovereign Privacy Cloud
              </div>
            </div>
          </div>

          {/* Subdomain Links */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-mono">
            <a
              href="https://db.sparrowx.net"
              className="text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              db.sparrowx.net
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://file.sparrowx.net"
              className="text-zinc-400 hover:text-cyan-400 transition-colors"
            >
              file.sparrowx.net
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://password.sparrowx.net"
              className="text-zinc-400 hover:text-purple-400 transition-colors"
            >
              password.sparrowx.net
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://sec.sparrowx.net"
              className="text-zinc-400 hover:text-blue-400 transition-colors"
            >
              sec.sparrowx.net
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://api.sparrowx.net"
              className="text-zinc-400 hover:text-amber-400 transition-colors"
            >
              api.sparrowx.net
            </a>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Operator Sign In
            </button>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-500">
              © {new Date().getFullYear()} SparrowX. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
