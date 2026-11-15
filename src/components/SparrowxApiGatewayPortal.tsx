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
  Lock,
  RefreshCw,
  LogOut,
  RotateCcw,
} from "lucide-react";
import {
  authenticateAppUserFromBackend,
  fetchAppUserByEmailFromBackend,
  generateSecureSparrowKey,
  persistAppUserToBackend,
  type AppUser,
} from "@/lib/supabase";
import {
  verifySessionToken,
  issueSignedSessionToken,
  clearSessionToken,
} from "@/lib/advanced-features";
import { SparrowxFooter } from "@/components/SparrowxFooter";

const API_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EndpointMeta {
  path: string;
  method: "GET" | "POST" | "PATCH";
  description: string;
  category: "Workspace Tables" | "Security Telemetry" | "System Health";
  exampleQuery: string;
  payload?: string;
}

const ENDPOINTS: EndpointMeta[] = [
  {
    path: "/rest/v1/client_tenants",
    method: "GET",
    description: "Your organization workspaces, connection metadata, and active service quotas.",
    category: "Workspace Tables",
    exampleQuery: "select=*&status=eq.Active",
  },
  {
    path: "/rest/v1/protected_services",
    method: "GET",
    description: "Active web services, endpoints, and microservices guarded by SparrowX.",
    category: "Workspace Tables",
    exampleQuery: "select=*&order=created_at.desc&limit=10",
  },
  {
    path: "/rest/v1/incidents",
    method: "GET",
    description: "Real-time edge security incidents, WAF triggers, and mitigation logs.",
    category: "Security Telemetry",
    exampleQuery: "select=*&severity=eq.High&order=created_at.desc&limit=5",
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

function getOrCreateUserDbApiKey(userId: string): string {
  const fallback = generateSecureSparrowKey("spx_db");
  if (typeof window === "undefined") return fallback;
  const storageKey = `spx_user_db_api_key_${userId}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing && existing.startsWith("spx_")) return existing;
  window.localStorage.setItem(storageKey, fallback);
  return fallback;
}

export function SparrowxApiGatewayPortal() {
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => {
    const verified = verifySessionToken();
    if (!verified) return null;
    return {
      id: verified.sub,
      email: verified.email,
      fullName: verified.fullName || verified.email.split("@")[0] || "Operator",
      password: "",
      admin: verified.role === "admin" ? "yes" : "no",
      tenantId: verified.tenantId,
    };
  });

  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [fullName, setFullName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [userApiKey, setUserApiKey] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointMeta>(ENDPOINTS[0]);
  const [customParams, setCustomParams] = useState(ENDPOINTS[0].exampleQuery);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<string>("0.8ms");
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "typescript" | "python">("curl");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://db.sparrowx.net");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setApiBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (sessionUser) {
      setUserApiKey(getOrCreateUserDbApiKey(sessionUser.id));
    } else {
      setUserApiKey("");
    }
  }, [sessionUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const emailClean = loginEmail.trim().toLowerCase();
    if (!API_EMAIL_PATTERN.test(emailClean)) {
      setLoginError("Please enter a valid account email address.");
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setLoginError("Password must be at least 6 characters.");
      return;
    }
    setLoggingIn(true);
    try {
      if (authMode === "signin") {
        const res = await authenticateAppUserFromBackend(emailClean, loginPassword);
        if (!res.user) {
          setLoginError(res.error || "Invalid email or password. Sign in with your registered SparrowX account.");
          return;
        }
        issueSignedSessionToken({
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName || res.user.email.split("@")[0] || "Operator",
          role: res.user.admin === "yes" ? "admin" : "client",
          tenantId: res.user.tenantId,
        });
        setSessionUser(res.user);
      } else {
        if (!fullName.trim()) {
          setLoginError("Please enter your full name to register an API account.");
          return;
        }
        const existing = await fetchAppUserByEmailFromBackend(emailClean);
        if (existing) {
          setLoginError("An account with this email already exists. Please sign in instead.");
          return;
        }
        const newUser: AppUser = {
          id: `USR-${Date.now().toString().slice(-4)}`,
          email: emailClean,
          password: loginPassword,
          fullName: fullName.trim(),
          admin: "no",
          tenantId: `TENANT-API-${Date.now().toString().slice(-4)}`,
        };
        await persistAppUserToBackend(newUser);
        const safeUser: AppUser = { ...newUser, password: "" };
        issueSignedSessionToken({
          id: safeUser.id,
          email: safeUser.email,
          fullName: safeUser.fullName,
          role: "client",
          tenantId: safeUser.tenantId,
        });
        setSessionUser(safeUser);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRotateKey = () => {
    if (!sessionUser || typeof window === "undefined") return;
    const nextKey = generateSecureSparrowKey("spx_db");
    window.localStorage.setItem(`spx_user_db_api_key_${sessionUser.id}`, nextKey);
    setUserApiKey(nextKey);
  };

  const handleSignOut = () => {
    clearSessionToken();
    setSessionUser(null);
    setApiResponse(null);
    setStatusCode(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunRequest = async () => {
    if (!sessionUser || !userApiKey) return;
    setLoading(true);
    setApiResponse(null);
    setStatusCode(null);
    const start = performance.now();
    try {
      const fullUrl = `${apiBaseUrl}${selectedEndpoint.path}${
        customParams ? `?${customParams}` : ""
      }`;
      const res = await fetch(fullUrl, {
        headers: {
          apikey: userApiKey,
          Authorization: `Bearer ${userApiKey}`,
          Accept: "application/json",
        },
      });
      const end = performance.now();
      setLatencyMs((end - start).toFixed(1) + "ms");
      setStatusCode(res.status);
      const text = await res.text();
      try {
        setApiResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setApiResponse(text);
      }
    } catch (err) {
      const end = performance.now();
      setLatencyMs((end - start).toFixed(1) + "ms");
      setStatusCode(503);
      setApiResponse(
        JSON.stringify(
          {
            error: "Gateway Unreachable",
            detail: err instanceof Error ? err.message : "Network error connecting to hosted DB API.",
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // Generate code snippet based on activeCodeTab
  const getCodeSnippet = () => {
    const activeKey = userApiKey || "spx_db_sign_in_to_generate";
    const fullUrl = `${apiBaseUrl}${selectedEndpoint.path}${
      customParams ? `?${customParams}` : ""
    }`;

    if (activeCodeTab === "curl") {
      return `curl -X ${selectedEndpoint.method} "${fullUrl}" \\
  -H "apikey: ${activeKey}" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -H "Accept: application/json"`;
    }

    if (activeCodeTab === "typescript") {
      return `import { createClient } from '@supabase/supabase-js';

const sparrowx = createClient('${apiBaseUrl}', '${activeKey}');

const { data, error } = await sparrowx
  .from('${selectedEndpoint.path.replace("/rest/v1/", "")}')
  .select('*')
  .limit(5);

console.log(data);`;
    }

    return `import requests

url = "${fullUrl}"
headers = {
    "apikey": "${activeKey}",
    "Authorization": "Bearer ${activeKey}",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
print(response.json())`;
  };

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#08090C] text-[#F3F4F6] flex flex-col font-sans selection:bg-white selection:text-black">
        <header className="border-b border-white/[0.08] bg-[#0E1015] px-4 sm:px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Private Database API"
                width={36}
                height={36}
                className="size-9 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]"
              />
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-mono">
                  SPARROWX // PRIVATE DATABASE API
                </span>
              </div>
            </div>

            <a
              href="https://db.sparrowx.net"
              className="px-3 py-1.5 rounded bg-[#14171F] border border-white/10 text-xs font-mono text-[#9CA3AF] hover:text-white transition-colors"
            >
              Open DB Studio
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md border border-white/[0.1] bg-[#0E1015] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="space-y-2 text-center">
              <div className="mx-auto size-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 grid place-items-center text-emerald-400">
                <Lock className="size-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Private Database API — Account Sign-In Required
              </h1>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                For your security, SparrowX does not expose database schemas, endpoints, or API keys publicly. Sign in with your account to view and generate your personal Database API credentials (also available in Dashboard Settings).
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setLoginError(null);
                  }}
                  className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
                    authMode === "signin" ? "bg-white text-black" : "text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setLoginError(null);
                  }}
                  className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
                    authMode === "register" ? "bg-emerald-500 text-black" : "text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  Create API Account
                </button>
              </div>

              {loginError && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
                  {loginError}
                </div>
              )}

              {authMode === "register" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-[#9CA3AF] uppercase block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Turner"
                    className="w-full h-10 rounded border border-white/10 bg-[#08090C] px-3 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#9CA3AF] uppercase block">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-10 rounded border border-white/10 bg-[#08090C] px-3 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#9CA3AF] uppercase block">
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-10 rounded border border-white/10 bg-[#08090C] px-3 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full h-10 rounded bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loggingIn
                  ? "Verifying Credentials..."
                  : authMode === "signin"
                    ? "Sign In to Access Your DB API"
                    : "Create API Account & Generate Key"}
              </button>
            </form>

            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-[#64748B]">
              <a href="https://sparrowx.net" className="hover:text-white transition-colors">
                ← sparrowx.net
              </a>
              <a href="https://db.sparrowx.net" className="text-emerald-400 hover:underline">
                Manage in DB Studio →
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090C] text-[#F3F4F6] flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-[#0E1015] px-4 sm:px-6 py-3.5 border-t border-white/[0.16]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX API Gateway"
              width={36}
              height={36}
              className="size-9 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-mono">
                  SPARROWX // HOSTED DB API
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] font-mono">
                Signed in as {sessionUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 border border-white/[0.08] bg-[#14171F] hover:bg-red-500/10 hover:text-red-400 px-2.5 py-1 rounded-sm text-[#9CA3AF] transition-colors cursor-pointer"
            >
              <LogOut className="size-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Pane Technical Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Top Technical Banner & Personal Key Generator */}
        <div className="border border-white/[0.08] bg-[#0E1015] rounded-md p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-mono">
              Your Hosted Database REST API
            </h1>
            <p className="text-xs text-[#9CA3AF] max-w-2xl">
              Authenticated REST endpoints scoped to your account. Use or rotate your personal key below to connect apps to your hosted SparrowX database.
            </p>
          </div>

          {/* Personal API Key Widget */}
          <div className="border border-white/[0.08] bg-[#14171F] p-3 rounded-sm flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[#64748B] uppercase block">Your Personal DB API Key:</span>
              <code className="text-emerald-400 text-[11px] block select-all">{userApiKey}</code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(userApiKey, "anon-top")}
              className="px-2.5 py-1 rounded bg-[#08090C] border border-white/10 hover:border-white/20 text-[#9CA3AF] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              {copiedKey === "anon-top" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copiedKey === "anon-top" ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={handleRotateKey}
              className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              <span>Generate New Key</span>
            </button>
          </div>
        </div>

        {/* Two-Pane Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Endpoint Catalog & Schema Rules */}
          <div className="lg:col-span-4 border border-white/[0.08] bg-[#0E1015] rounded-md overflow-hidden space-y-0">
            <div className="border-b border-white/[0.08] bg-[#14171F] px-4 py-2.5 flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white uppercase text-[11px]">Endpoints Catalog</span>
              <span className="text-[10px] text-[#64748B]">{ENDPOINTS.length} Routes</span>
            </div>

            <div className="divide-y divide-white/[0.06] max-h-[640px] overflow-y-auto">
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
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-white/[0.06] border-l-2 border-emerald-400"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {ep.method}
                      </span>
                      <span className="text-[10px] text-[#64748B] font-mono">{ep.category}</span>
                    </div>
                    <code className="text-xs font-mono text-white block truncate">{ep.path}</code>
                    <p className="text-[11px] text-[#9CA3AF] mt-1 line-clamp-1">{ep.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Live Request & Multi-Language Code Builder */}
          <div className="lg:col-span-8 border border-white/[0.08] bg-[#0E1015] rounded-md overflow-hidden space-y-0">
            {/* Request Builder Header */}
            <div className="border-b border-white/[0.08] bg-[#14171F] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{selectedEndpoint.path}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    {selectedEndpoint.method}
                  </span>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">{selectedEndpoint.description}</div>
              </div>

              <button
                type="button"
                onClick={handleRunRequest}
                disabled={loading}
                className="px-4 py-2 rounded bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loading ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3 fill-current" />}
                <span>{loading ? "Executing..." : "Execute (0.8ms)"}</span>
              </button>
            </div>

            {/* URL Parameter Editor (Mobile-friendly stacked input) */}
            <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-[#08090C] space-y-2 font-mono text-xs">
              <label className="text-[10px] text-[#64748B] uppercase block">PostgREST Query Parameters:</label>
              <div className="flex flex-col sm:flex-row sm:items-center rounded border border-white/10 bg-[#14171F] px-3 py-2 gap-1.5 sm:gap-0">
                <span className="text-emerald-400 shrink-0 select-none text-[11px] truncate max-w-full">
                  {apiBaseUrl}{selectedEndpoint.path}?
                </span>
                <input
                  type="text"
                  value={customParams}
                  onChange={(e) => setCustomParams(e.target.value)}
                  placeholder="select=*&limit=10"
                  className="bg-transparent text-white focus:outline-none flex-1 sm:ml-1 text-xs min-w-0"
                />
              </div>
            </div>

            {/* Code Snippet Multi-Language Tabs */}
            <div className="border-b border-white/[0.08] bg-[#0E1015] p-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-[#14171F] p-0.5 rounded border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab("curl")}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      activeCodeTab === "curl" ? "bg-white text-black font-semibold" : "text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab("typescript")}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      activeCodeTab === "typescript" ? "bg-white text-black font-semibold" : "text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    TypeScript SDK
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab("python")}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      activeCodeTab === "python" ? "bg-white text-black font-semibold" : "text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    Python
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(getCodeSnippet(), "code-snippet")}
                  className="text-[#9CA3AF] hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  {copiedKey === "code-snippet" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>Copy Code</span>
                </button>
              </div>

              <div className="p-3.5 rounded bg-[#08090C] border border-white/[0.08] text-[11px] text-emerald-400 overflow-x-auto">
                <pre>{getCodeSnippet()}</pre>
              </div>
            </div>

            {/* Response Viewer */}
            <div className="p-5 bg-[#08090C] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#64748B] uppercase">Live HTTP Response Payload</span>
                <div className="flex items-center gap-3">
                  {statusCode !== null && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        statusCode >= 200 && statusCode < 300
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      HTTP {statusCode}
                    </span>
                  )}
                  <span className="text-[10px] text-[#64748B] tabular-nums">LATENCY: {latencyMs}</span>
                </div>
              </div>

              <div className="p-4 rounded bg-[#0E1015] border border-white/[0.08] min-h-[160px] max-h-[300px] overflow-auto">
                {loading ? (
                  <div className="h-28 flex flex-col items-center justify-center text-xs text-[#64748B] gap-2">
                    <RefreshCw className="size-4 text-emerald-400 animate-spin" />
                    <span>Querying PostgreSQL schema via PostgREST...</span>
                  </div>
                ) : apiResponse ? (
                  <pre className="text-xs text-white whitespace-pre-wrap break-words">{apiResponse}</pre>
                ) : (
                  <div className="h-28 flex flex-col items-center justify-center text-xs text-[#64748B] gap-1">
                    <Terminal className="size-4 text-[#64748B]" />
                    <span>Click &quot;Execute (0.8ms)&quot; above to inspect the live JSON response.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <SparrowxFooter />
    </div>
  );
}
