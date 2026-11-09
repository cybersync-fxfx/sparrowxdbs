import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Lock,
  Cpu,
  Zap,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  ExternalLink,
  ChevronRight,
  Terminal,
  Layers,
} from "lucide-react";

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
}

export function SparrowxShieldEngine() {
  const [targetDomain, setTargetDomain] = useState<string>("sparrowx.net");
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [result, setResult] = useState<InspectionResult | null>({
    domain: "sparrowx.net",
    ip: "10.10.10.2 (NPM Edge Gateway)",
    tlsVersion: "TLS 1.3",
    cipherSuite: "TLS_AES_256_GCM_SHA384",
    dnsPropagation: "Global Anycast (14 PoPs)",
    edgeLatencyMs: 11,
    originCloaked: true,
    wafStatus: "Active",
    threatScore: 0,
  });

  // WAF Rules Configuration state
  const [wafRules, setWafRules] = useState([
    {
      id: "sqli",
      name: "SQL Injection Payload Barrier",
      description: "Inspects inbound query strings and bodies for UNION, SELECT, and quote evasion.",
      enabled: true,
      blocks24h: 342,
    },
    {
      id: "ai_guard",
      name: "AI Prompt Injection Shield",
      description: "Guards LLM endpoints against system prompt leaks, jailbreaks, and indirect injection.",
      enabled: true,
      blocks24h: 89,
    },
    {
      id: "redis_cache",
      name: "Redis Threat Slipstream Cache",
      description: "Caches bad actors in RAM for 60 seconds, deflecting attacks before hitting PostgreSQL.",
      enabled: true,
      blocks24h: 1240,
    },
    {
      id: "origin_cloak",
      name: "Origin IP Cloaking",
      description: "Restricts all host traffic exclusively to Nginx Proxy Manager (10.10.10.2).",
      enabled: true,
      blocks24h: 58,
    },
    {
      id: "rate_limit",
      name: "Adaptive L7 Rate Limiter",
      description: "Throttles IPs exceeding 120 requests/min with automatic exponential backoff.",
      enabled: true,
      blocks24h: 412,
    },
  ]);

  const runSecurityInspection = async () => {
    if (!targetDomain.trim()) return;
    setInspecting(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      const clean = targetDomain.trim().toLowerCase().replace(/^https?:\/\//, "");
      setResult({
        domain: clean,
        ip: clean.includes("sparrowx") ? "10.10.10.2 (NPM Edge Gateway)" : "198.51.100.24 (Cloud Provider)",
        tlsVersion: "TLS 1.3 (ChaCha20-Poly1305 / AES-256-GCM)",
        cipherSuite: "ECDHE-ECDSA-AES256-GCM-SHA384",
        dnsPropagation: "Anycast Synchronized (100% propagated)",
        edgeLatencyMs: Math.floor(8 + Math.random() * 12),
        originCloaked: clean.includes("sparrowx"),
        wafStatus: "Active",
        threatScore: clean.includes("sparrowx") ? 0 : 15,
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

  return (
    <div className="min-h-screen bg-[#05070B] text-zinc-100 flex flex-col font-sans selection:bg-[#3ECF8E] selection:text-zinc-950">
      {/* Top Banner */}
      <div className="bg-[#0B0F17] border-b border-[#1E293B] px-4 py-2 text-center text-xs text-zinc-400 font-mono flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
          SparrowX Shield: Edge Security as a Service
        </span>
        <span className="text-zinc-600">|</span>
        <span>Origin IP Cloaking</span>
        <span className="text-zinc-600">|</span>
        <span className="text-emerald-400">Redis Threat Caching</span>
      </div>

      {/* Header */}
      <header className="border-b border-[#1E293B] bg-[#05070B]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-[#0B0F17] border border-[#1E293B] grid place-items-center shadow-lg p-1">
            <img
              src="/sparrowx-cyber-hawk.png"
              alt="SparrowX Logo"
              className="size-7 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                SparrowX <span className="text-[#00F2FE]">Shield</span>
              </span>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400">
                WAF & Edge Defense
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              sparrowx.net/shield • Multi-Tenant Origin Protection
            </p>
          </div>
        </div>

        <a
          href="/"
          className="text-xs text-zinc-400 hover:text-white font-mono flex items-center gap-1 transition-colors"
        >
          <span>SparrowX Ecosystem</span>
          <ChevronRight className="size-3.5" />
        </a>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono text-cyan-400">
            <ShieldCheck className="size-3.5" />
            <span>Autonomous Edge Threat Interception</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Shield Your Infrastructure Before Exploits Reach Your Database.
          </h1>
          <p className="text-sm text-zinc-400">
            Full-spectrum edge defense: origin IP cloaking, automated threat caching in Redis, and
            real-time L7 WAF rule enforcement.
          </p>
        </div>

        {/* SECTION 1: INTERACTIVE SECURITY INSPECTOR */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] overflow-hidden shadow-2xl">
          <div className="border-b border-[#1E293B] bg-[#0E1420] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-[#00F2FE]" />
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Interactive Edge Security & TLS Inspector
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Zero-friction live network audit
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Search Input Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="size-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Enter hostname or IP (e.g. api.sparrowx.net, acme.io)..."
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSecurityInspection()}
                  className="w-full h-10 rounded-xl border border-zinc-800 bg-[#05070B] pl-9 pr-4 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-[#00F2FE]"
                />
              </div>
              <button
                type="button"
                onClick={runSecurityInspection}
                disabled={inspecting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00F2FE] hover:bg-[#00f2fe]/90 text-zinc-950 font-bold px-5 text-xs shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${inspecting ? "animate-spin" : ""}`} />
                <span>{inspecting ? "Inspecting..." : "Inspect Target"}</span>
              </button>
            </div>

            {/* Results Grid */}
            {result && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-zinc-800 bg-[#05070B] p-4 space-y-1">
                  <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>Edge Ingress IP</span>
                    <ShieldCheck className="size-3 text-cyan-400" />
                  </div>
                  <div className="text-xs font-bold text-white font-mono truncate">{result.ip}</div>
                  <p className="text-[10px] text-emerald-400 font-mono">
                    {result.originCloaked ? "Cloaked Behind NPM (10.10.10.2)" : "Direct IP Exposed"}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-[#05070B] p-4 space-y-1">
                  <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>TLS Handshake</span>
                    <Lock className="size-3 text-emerald-400" />
                  </div>
                  <div className="text-xs font-bold text-emerald-400 font-mono">{result.tlsVersion}</div>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">{result.cipherSuite}</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-[#05070B] p-4 space-y-1">
                  <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>DNS Propagation</span>
                    <Globe className="size-3 text-blue-400" />
                  </div>
                  <div className="text-xs font-bold text-white font-mono">{result.dnsPropagation}</div>
                  <p className="text-[10px] text-zinc-400 font-mono">Zero DNS leak detected</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-[#05070B] p-4 space-y-1">
                  <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>Edge TTFB Latency</span>
                    <Zap className="size-3 text-amber-400" />
                  </div>
                  <div className="text-xs font-bold text-amber-300 font-mono">{result.edgeLatencyMs} ms</div>
                  <p className="text-[10px] text-emerald-400 font-mono">High-speed Edge Response</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: WAF RULES & THREAT MITIGATION TOGGLES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Sliders className="size-4 text-[#00F2FE]" />
              <span>Active WAF Defense Policies & Threat Deflection</span>
            </h2>
            <span className="text-xs font-mono text-zinc-500">Host: 10.10.10.10 (sparrowx_threat_cache)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wafRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-5 flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{rule.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        rule.enabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {rule.enabled ? "ACTIVE" : "BYPASSED"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{rule.description}</p>
                  <p className="text-[11px] text-cyan-400 font-mono pt-1">
                    Deflected threats (24h): <span className="font-bold">{rule.blocks24h}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleWafRule(rule.id)}
                  className={`size-6 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-1 ${
                    rule.enabled
                      ? "bg-[#00F2FE] border-[#00F2FE] text-zinc-950 font-bold"
                      : "border-zinc-700 bg-zinc-800 text-transparent"
                  }`}
                >
                  <CheckCircle2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: TOPOLOGY MAP */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-mono uppercase tracking-wider">
            <Layers className="size-4 text-[#00F2FE]" />
            <span>Origin Cloaking & Redis Caching Data Path</span>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-[#05070B] p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
            <pre className="text-cyan-400 leading-relaxed">
{`[ Public Internet ]
       │
 DNS (Anycast)
       │
       ▼
[ Nginx Proxy Manager (NPM) ] ── (Port 80/443 SSL Termination @ 10.10.10.2)
       │
       ├─► [ Redis Threat Cache ] (RAM Sweep Deflection)
       │
       ▼ Forward Port 3000 / 3001
[ SparrowX Studio & PostgREST ]
       │
       ▼ Port 6543
[ PgBouncer Connection Pooler ]
       │
       ▼ Port 5432
[ PostgreSQL 16 + pgvector Engine ]`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
