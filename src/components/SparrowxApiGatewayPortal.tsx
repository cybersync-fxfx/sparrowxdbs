import React, { useState, useEffect } from "react";
import {
  Server,
  Database,
  Shield,
  Key,
  Copy,
  Check,
  Code2,
  ExternalLink,
  Zap,
  Globe,
  Terminal,
  Activity,
  Play,
  ArrowRight,
  ShieldCheck,
  Layers,
} from "lucide-react";

interface EndpointMeta {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  description: string;
  category: "Auth & Users" | "Database Tables" | "Security Telemetry" | "System Health";
  exampleQuery: string;
}

const ENDPOINTS: EndpointMeta[] = [
  {
    path: "/rest/v1/app_users",
    method: "GET",
    description: "Query registered platform users, roles, and administrative profiles.",
    category: "Auth & Users",
    exampleQuery: "select=id,email,full_name,admin&limit=5",
  },
  {
    path: "/rest/v1/client_tenants",
    method: "GET",
    description: "Multi-tenant organizations, API keys, and service quotas.",
    category: "Database Tables",
    exampleQuery: "select=*&status=eq.Active",
  },
  {
    path: "/rest/v1/protected_services",
    method: "GET",
    description: "Active web services, endpoints, and microservices guarded by SparrowX.",
    category: "Database Tables",
    exampleQuery: "select=*&order=created_at.desc&limit=10",
  },
  {
    path: "/rest/v1/incidents",
    method: "GET",
    description: "Real-time edge security incidents, WAF triggers, and mitigation logs.",
    category: "Security Telemetry",
    exampleQuery: "select=*&severity=eq.High&order=detected_at.desc&limit=5",
  },
  {
    path: "/rest/v1/assets",
    method: "GET",
    description: "Discovered hostnames, VPS nodes, and edge infrastructure components.",
    category: "Security Telemetry",
    exampleQuery: "select=*&status=eq.Protected",
  },
  {
    path: "/rest/v1/threat_indicators",
    method: "GET",
    description: "Harvested IOCs, malicious IP ranges, and MITRE ATT&CK patterns.",
    category: "Security Telemetry",
    exampleQuery: "select=*&severity=eq.Critical",
  },
  {
    path: "/api/v1/health",
    method: "GET",
    description: "Edge health probe reporting node availability and latency.",
    category: "System Health",
    exampleQuery: "",
  },
];

export function SparrowxApiGatewayPortal() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointMeta>(ENDPOINTS[0]);
  const [customParams, setCustomParams] = useState(ENDPOINTS[0].exampleQuery);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.sparrowx.net");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setApiBaseUrl(window.location.origin);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunRequest = async () => {
    setLoading(true);
    setApiResponse(null);
    setStatusCode(null);
    try {
      const fullUrl = `${apiBaseUrl}${selectedEndpoint.path}${
        customParams ? `?${customParams}` : ""
      }`;
      const res = await fetch(fullUrl, {
        headers: {
          apikey: "spx_ovh_sovereign_key",
          Accept: "application/json",
        },
      });
      setStatusCode(res.status);
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setStatusCode(500);
      setApiResponse(
        JSON.stringify(
          {
            error: "Gateway Request Failed",
            detail: String(err),
            hint: "Verify CORS or test directly using curl or PostgREST URL.",
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-zinc-100 font-sans selection:bg-[#3ECF8E] selection:text-black">
      {/* Top Banner Navigation */}
      <header className="border-b border-zinc-800 bg-[#161B22]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 grid place-items-center text-emerald-400 font-bold">
              <Server className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  SparrowX <span className="text-emerald-400">REST API Gateway</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                  PostgREST v12.2 • Postgres 16
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">https://api.sparrowx.net/rest/v1</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://db.sparrowx.net"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors"
            >
              <Database className="size-3.5 text-emerald-400" />
              <span>SparrowX DB Studio</span>
            </a>
            <a
              href="https://sec.sparrowx.net"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-orange-950/40 hover:bg-orange-900/60 border border-orange-500/30 text-orange-300 transition-colors"
            >
              <Shield className="size-3.5 text-orange-400" />
              <span>Security SOC</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-[#161B22] to-[#0D1117] p-6 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                <Activity className="size-3 animate-pulse" />
                <span>Zero-Latency Autonomous Edge Ingress Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Sovereign PostgreSQL REST & GraphQL Engine
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                Every table in your sovereign PostgreSQL cluster is instantly published with full
                CRUD capabilities, JSON filtering, and role-based Row Level Security (RLS) over
                HTTPS. Compatible with the official Supabase Client SDK, Prisma, and PostgREST.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#0A0D12] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono">Default Anonymous API Key</span>
                <span className="text-emerald-400 font-bold">Public Safe</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5">
                <code className="text-xs text-zinc-300 font-mono truncate flex-1">
                  spx_ovh_sovereign_key
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy("spx_ovh_sovereign_key", "anon-key")}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Copy Anon Key"
                >
                  {copiedKey === "anon-key" ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>Authenticated via PostgREST JWT & SCRAM-SHA-256</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Endpoint Explorer & Test Runner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Endpoints Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                REST Endpoints
              </h2>
              <span className="text-[11px] text-zinc-500 font-mono">{ENDPOINTS.length} Available</span>
            </div>

            <div className="space-y-1.5">
              {ENDPOINTS.map((ep) => {
                const isSelected = selectedEndpoint.path === ep.path;
                return (
                  <button
                    key={ep.path}
                    type="button"
                    onClick={() => {
                      setSelectedEndpoint(ep);
                      setCustomParams(ep.exampleQuery);
                      setApiResponse(null);
                      setStatusCode(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-zinc-800/80 border-emerald-500/50 shadow-md"
                        : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        {ep.method}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">{ep.category}</span>
                    </div>
                    <code className="text-xs font-mono font-semibold text-zinc-200 block truncate">
                      {ep.path}
                    </code>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{ep.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Request & Response Console */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-[#161B22] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <span>{selectedEndpoint.description}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    PostgREST Target: {selectedEndpoint.path}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunRequest}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className={`size-3.5 fill-current ${loading ? "animate-spin" : ""}`} />
                  <span>{loading ? "Executing..." : "Send Request"}</span>
                </button>
              </div>

              {/* URL & Query Parameter Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-mono">Query Parameters (PostgREST syntax):</label>
                <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs font-mono">
                  <span className="text-emerald-400 shrink-0 select-none">
                    {apiBaseUrl}
                    {selectedEndpoint.path}?
                  </span>
                  <input
                    type="text"
                    value={customParams}
                    onChange={(e) => setCustomParams(e.target.value)}
                    placeholder="select=*&limit=10"
                    className="bg-transparent text-zinc-100 focus:outline-none flex-1 ml-1"
                  />
                </div>
              </div>

              {/* Code Snippet Tabs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono">cURL Command</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `curl -X GET "${apiBaseUrl}${selectedEndpoint.path}${
                          customParams ? `?${customParams}` : ""
                        }" \\\n  -H "apikey: spx_ovh_sovereign_key" \\\n  -H "Accept: application/json"`,
                        "curl-cmd",
                      )
                    }
                    className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    {copiedKey === "curl-cmd" ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>Copy cURL</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                  {`curl -X GET "${apiBaseUrl}${selectedEndpoint.path}${
                    customParams ? `?${customParams}` : ""
                  }" \\\n  -H "apikey: spx_ovh_sovereign_key" \\\n  -H "Accept: application/json"`}
                </pre>
              </div>

              {/* Live Response Viewer */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono">Server Response</span>
                  {statusCode !== null && (
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                        statusCode >= 200 && statusCode < 300
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      HTTP {statusCode}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#0A0D12] p-4 min-h-[180px] max-h-[320px] overflow-auto">
                  {loading ? (
                    <div className="h-32 flex flex-col items-center justify-center text-xs text-zinc-500 gap-2">
                      <Activity className="size-5 text-emerald-400 animate-spin" />
                      <span>Fetching records from PostgreSQL...</span>
                    </div>
                  ) : apiResponse ? (
                    <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap break-words">
                      {apiResponse}
                    </pre>
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5">
                      <Terminal className="size-5 text-zinc-600" />
                      <span>Click "Send Request" to test this endpoint live.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
