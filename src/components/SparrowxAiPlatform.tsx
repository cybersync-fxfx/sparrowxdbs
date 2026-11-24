import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Brain,
  Check,
  Code2,
  Copy,
  Cpu,
  KeyRound,
  LayoutGrid,
  Loader2,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { buildMasterHref } from "@/lib/routing";
import { SubdomainAuthChip } from "@/components/SubdomainAuthChip";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";
import { SparrowxAiBrainCenter } from "@/components/SparrowxAiBrainCenter";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { analyzePromptInSandbox } from "@/lib/advanced-features";
import { collectUnifiedPlatformContext, querySparrowxGeminiBrain } from "@/lib/sparrowx-ai-brain";

type AiTab = "overview" | "playground" | "guardrails" | "keys" | "brain";

interface AiApiKey {
  id: string;
  label: string;
  secret: string;
  scope: "all-models" | "guardrails-only" | "embeddings";
  rpmLimit: number;
  createdAt: string;
}

interface PlaygroundLog {
  id: string;
  model: string;
  promptPreview: string;
  guardrailStatus: "PASSED" | "BLOCKED";
  latencyMs: number;
  tokensEst: number;
  at: string;
}

const AI_MODELS = [
  {
    id: "sparrowx/gemini-2.5-flash",
    provider: "Google Vertex / Gemini",
    context: "1M tokens",
    latency: "~280ms",
    tier: "Fast & Multimodal",
    price: "₹12 / 1M tok",
  },
  {
    id: "sparrowx/gemini-2.5-pro",
    provider: "Google Vertex / Gemini",
    context: "2M tokens",
    latency: "~640ms",
    tier: "Deep Reasoning",
    price: "₹85 / 1M tok",
  },
  {
    id: "sparrowx/llama-3.3-70b",
    provider: "Sovereign OVH GPU Mesh",
    context: "128K tokens",
    latency: "~210ms",
    tier: "Open Weights",
    price: "₹18 / 1M tok",
  },
  {
    id: "sparrowx/sentinel-guard-v2",
    provider: "SparrowX Inline Firewall",
    context: "32K tokens",
    latency: "~18ms",
    tier: "Prompt & PII Shield",
    price: "Included Free",
  },
] as const;

const KEYS_STORAGE = "spx_ai_gateway_keys_v1";
const LOGS_STORAGE = "spx_ai_gateway_logs_v1";

function randomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}

export function SparrowxAiPlatform() {
  const [activeTab, setActiveTab] = useState<AiTab>("overview");
  const [sdkLang, setSdkLang] = useState<"ts" | "py" | "curl">("ts");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are SparrowX AI, an expert cloud, security, and backend engineering assistant. Give concise, production-ready answers.",
  );
  const [userPrompt, setUserPrompt] = useState(
    "Write a hardened Nginx rate-limit and TLS 1.3 snippet for a high-traffic Node.js API.",
  );
  const [enforceGuardrail, setEnforceGuardrail] = useState(true);
  const [running, setRunning] = useState(false);
  const [outputText, setOutputText] = useState("");
  const [lastGuardVerdict, setLastGuardVerdict] = useState<{
    blocked: boolean;
    riskScore: number;
    flags: string[];
  } | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // API Keys & Logs
  const [keys, setKeys] = useState<AiApiKey[]>([]);
  const [logs, setLogs] = useState<PlaygroundLog[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyScope, setNewKeyScope] = useState<AiApiKey["scope"]>("all-models");

  useEffect(() => {
    try {
      const savedKeys = window.localStorage.getItem(KEYS_STORAGE);
      if (savedKeys) {
        setKeys(JSON.parse(savedKeys) as AiApiKey[]);
      } else {
        const initial: AiApiKey[] = [
          {
            id: "key-default",
            label: "Production Gateway Key",
            secret: `spx_ai_live_${randomHex(28)}`,
            scope: "all-models",
            rpmLimit: 300,
            createdAt: new Date().toISOString().slice(0, 10),
          },
        ];
        setKeys(initial);
        window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(initial));
      }
      const savedLogs = window.localStorage.getItem(LOGS_STORAGE);
      if (savedLogs) setLogs(JSON.parse(savedLogs) as PlaygroundLog[]);
    } catch {
      // ignore storage restrictions
    }
  }, []);

  const persistKeys = (next: AiApiKey[]) => {
    setKeys(next);
    try {
      window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistLogs = (next: PlaygroundLog[]) => {
    setLogs(next);
    try {
      window.localStorage.setItem(LOGS_STORAGE, JSON.stringify(next.slice(0, 40)));
    } catch {
      // ignore
    }
  };

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    const created: AiApiKey = {
      id: `key-${Date.now().toString(36)}`,
      label: newKeyLabel.trim(),
      secret: `spx_ai_live_${randomHex(28)}`,
      scope: newKeyScope,
      rpmLimit: newKeyScope === "guardrails-only" ? 1000 : 300,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    persistKeys([created, ...keys]);
    setNewKeyLabel("");
    emitEngineToast(`Issued new AI Gateway key: ${created.label}`, "success");
  };

  const handleRunPlayground = async () => {
    if (!userPrompt.trim() || running) return;
    setRunning(true);
    setOutputText("");
    const start = performance.now();

    try {
      const guard = analyzePromptInSandbox(userPrompt);
      const blocked = enforceGuardrail && guard.blocked;
      const flags = [
        ...(guard.threatCategory !== "Clean" ? [guard.threatCategory] : []),
        ...guard.detectedPii,
      ];
      setLastGuardVerdict({ blocked, riskScore: 100 - guard.score, flags });

      if (blocked) {
        const latencyMs = Math.max(8, Math.round(performance.now() - start));
        setLastLatencyMs(latencyMs);
        setOutputText(
          `[SPARROWX SENTINEL GUARDRAIL BLOCKED — Safety ${guard.score}/100]\nCategory: ${guard.threatCategory}\nAction: ${guard.remediationAction}\n\nYour prompt was intercepted before reaching ${selectedModel}. Disable inline guardrail or sanitize sensitive tokens to proceed.`,
        );
        persistLogs([
          {
            id: `req-${Date.now().toString(36)}`,
            model: selectedModel,
            promptPreview: userPrompt.slice(0, 72),
            guardrailStatus: "BLOCKED",
            latencyMs,
            tokensEst: Math.ceil(userPrompt.length / 4),
            at: new Date().toLocaleTimeString(),
          },
          ...logs,
        ]);
        return;
      }

      const digest = collectUnifiedPlatformContext({
        activeNav: "SparrowX AI Gateway",
        portalMode: "client",
        incidents: [],
        threatIndicators: [],
        assets: [],
        vulnerabilities: [],
        protectedServices: [],
        clientTenants: [],
        auditLogs: [],
      });

      const res = await querySparrowxGeminiBrain({
        prompt: `${systemPrompt}\n\nUser Request:\n${userPrompt}`,
        digest,
      });

      const latencyMs = Math.max(45, Math.round(performance.now() - start));
      setLastLatencyMs(latencyMs);
      setOutputText(res.text);
      persistLogs([
        {
          id: `req-${Date.now().toString(36)}`,
          model: selectedModel,
          promptPreview: userPrompt.slice(0, 72),
          guardrailStatus: "PASSED",
          latencyMs,
          tokensEst: Math.ceil((userPrompt.length + res.text.length) / 4),
          at: new Date().toLocaleTimeString(),
        },
        ...logs,
      ]);
    } catch (err) {
      setOutputText(
        `Execution failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setRunning(false);
    }
  };

  const activeSecret = keys[0]?.secret || "spx_ai_live_your_key_here";
  const sdkSnippets = {
    ts: `import OpenAI from "openai";

const ai = new OpenAI({
  baseURL: "https://ai.sparrowx.net/v1",
  apiKey: process.env.SPARROWX_AI_KEY, // ${activeSecret.slice(0, 16)}...
});

const res = await ai.chat.completions.create({
  model: "${selectedModel}",
  messages: [
    { role: "system", content: "You are a SparrowX engineer." },
    { role: "user", content: "Audit my PostgreSQL connection pool config." },
  ],
  // Inline prompt-injection + PII redaction enabled at edge
  extra_headers: { "X-SparrowX-Guardrail": "strict" },
});
console.log(res.choices[0].message.content);`,
    py: `from openai import OpenAI

client = OpenAI(
    base_url="https://ai.sparrowx.net/v1",
    api_key="${activeSecret.slice(0, 16)}...",
)

resp = client.chat.completions.create(
    model="${selectedModel}",
    messages=[{"role": "user", "content": "Summarize our DPDP compliance status"}],
    extra_headers={"X-SparrowX-Guardrail": "strict"},
)
print(resp.choices[0].message.content)`,
    curl: `curl https://ai.sparrowx.net/v1/chat/completions \\
  -H "Authorization: Bearer ${activeSecret.slice(0, 16)}..." \\
  -H "X-SparrowX-Guardrail: strict" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [{"role": "user", "content": "Hello from SparrowX AI"}]
  }'`,
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans antialiased flex flex-col">
      {/* Vercel-Style Sticky Header + Tabs */}
      <header className="sticky top-0 z-40 border-b border-[#262626] bg-[#000000]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={buildMasterHref("/")} className="flex items-center gap-2 shrink-0">
              <img src="/sparrowx-logo.png" alt="SparrowX AI" width={26} height={26} className="size-6.5 object-contain" />
            </a>
            <span className="text-zinc-600 font-light">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm tracking-tight text-white truncate">
                SparrowX AI
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                AI Gateway &amp; Guardrails
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SubdomainAuthChip nextPath="/ai" />
            <a
              href="https://agents.sparrowx.net"
              className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <Bot className="size-3.5 text-emerald-400" />
              <span>Agents Cloud</span>
            </a>
            <a
              href={buildMasterHref("/")}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <span>Portal</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setActiveTab("playground")}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md bg-white hover:bg-zinc-200 text-black px-3.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Play className="size-3.5" aria-hidden="true" />
              <span>Open Playground</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <nav aria-label="SparrowX AI Sections" className="flex items-center gap-1 -mb-px">
            {(
              [
                { id: "overview", label: "Overview & Models", icon: LayoutGrid },
                { id: "playground", label: "Model Playground", icon: Terminal },
                { id: "guardrails", label: "LLM Guardrails", icon: ShieldAlert },
                { id: "keys", label: "API Keys & Usage", icon: KeyRound },
                { id: "brain", label: "AI Brain & Intel", icon: Brain },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "border-white text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-mono text-violet-300">
                  <Sparkles className="size-3.5" />
                  <span>ai.sparrowx.net • Unified OpenAI-Compatible AI Gateway</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  One Gateway for Every LLM — Protected by Inline Guardrails.
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                  Route Gemini, Llama, and sovereign models through a single OpenAI-compatible endpoint with real-time prompt-injection blocking, PII redaction, and predictable INR/USD metering.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("playground")}
                    className="rounded-md bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Test in Playground
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("guardrails")}
                    className="rounded-md border border-[#262626] bg-[#111] hover:bg-[#1a1a1a] text-white px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    Try Guardrail Firewall
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("keys")}
                    className="rounded-md border border-[#262626] bg-[#111] hover:bg-[#1a1a1a] text-white px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    Manage API Keys
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-xl border border-[#262626] bg-[#000] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    {(["ts", "py", "curl"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSdkLang(lang)}
                        className={`px-2 py-1 rounded uppercase cursor-pointer ${
                          sdkLang === lang
                            ? "bg-white text-black font-bold"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText("sdk", sdkSnippets[sdkLang])}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    {copiedKey === "sdk" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedKey === "sdk" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-64">
                  {sdkSnippets[sdkLang]}
                </pre>
              </div>
            </section>

            {/* Model Catalog Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {AI_MODELS.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 flex flex-col justify-between gap-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Cpu className="size-4 text-violet-400" />
                      <span className="rounded-full border border-[#262626] bg-[#111] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                        {m.tier}
                      </span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white break-all">{m.id}</div>
                    <div className="text-[11px] text-zinc-400">{m.provider}</div>
                  </div>
                  <div className="pt-3 border-t border-[#1f1f1f] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>{m.context}</span>
                      <span className="text-emerald-400">{m.latency}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setActiveTab("playground");
                      }}
                      className="w-full rounded-md border border-[#262626] bg-[#000] hover:bg-white hover:text-black py-1.5 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Launch in Playground
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* MODEL PLAYGROUND TAB */}
        {activeTab === "playground" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Playground Configuration</h2>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforceGuardrail}
                    onChange={(e) => setEnforceGuardrail(e.target.checked)}
                    className="accent-emerald-400"
                  />
                  <span>Inline Guardrail</span>
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">Target Model</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white font-mono"
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} ({m.tier})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">System Prompt</span>
                <textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                />
              </label>

              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">User Prompt</span>
                <textarea
                  rows={5}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                />
              </label>

              <button
                type="button"
                disabled={running}
                onClick={() => void handleRunPlayground()}
                className="w-full rounded-md bg-white hover:bg-zinc-200 disabled:opacity-50 text-black py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                <span>{running ? "Running via SparrowX AI Gateway..." : "Run Completion"}</span>
              </button>
            </div>

            <div className="lg:col-span-7 rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Code2 className="size-4 text-violet-400" />
                  <span className="text-white font-semibold">{selectedModel}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {lastGuardVerdict && (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        lastGuardVerdict.blocked
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {lastGuardVerdict.blocked
                        ? `GUARDRAIL BLOCKED (${lastGuardVerdict.riskScore}/100)`
                        : `GUARDRAIL CLEAN (${lastGuardVerdict.riskScore}/100)`}
                    </span>
                  )}
                  {lastLatencyMs !== null && (
                    <span className="text-zinc-400">{lastLatencyMs}ms</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-[300px] rounded-lg border border-[#262626] bg-[#000] p-4 font-mono text-xs text-zinc-200 whitespace-pre-wrap overflow-y-auto">
                {outputText || "Click 'Run Completion' to execute your prompt through the SparrowX AI Gateway with live guardrail inspection."}
              </div>
            </div>
          </div>
        )}

        {/* LLM GUARDRAILS TAB */}
        {activeTab === "guardrails" && (
          <AiGuardrailSandbox
            showToast={(msg) => emitEngineToast(msg, "info")}
          />
        )}

        {/* API KEYS & USAGE TAB */}
        {activeTab === "keys" && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateKey}
              className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-4 flex flex-col sm:flex-row gap-3"
            >
              <input
                required
                placeholder="Key label (e.g. Production Backend)"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                className="flex-1 rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <select
                value={newKeyScope}
                onChange={(e) => setNewKeyScope(e.target.value as AiApiKey["scope"])}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              >
                <option value="all-models">Scope: All Models</option>
                <option value="guardrails-only">Scope: Guardrails Only</option>
                <option value="embeddings">Scope: pgvector Embeddings</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" /> Create API Key
              </button>
            </form>

            <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] divide-y divide-[#1f1f1f]">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{k.label}</span>
                      <span className="rounded border border-[#262626] bg-[#111] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                        {k.scope}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-zinc-400">
                      {k.secret.slice(0, 18)}•••••••••••• • {k.rpmLimit} RPM • Created {k.createdAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(k.id, k.secret)}
                      className="rounded-md border border-[#262626] bg-[#111] hover:bg-[#1a1a1a] px-3 py-1.5 text-xs text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === k.id ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      <span>{copiedKey === k.id ? "Copied" : "Copy Secret"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => persistKeys(keys.filter((x) => x.id !== k.id))}
                      aria-label="Revoke API key"
                      className="p-2 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between text-xs">
                <span className="font-semibold text-white inline-flex items-center gap-1.5">
                  <Activity className="size-3.5 text-emerald-400" /> Recent Gateway Requests ({logs.length})
                </span>
                <span className="text-zinc-500 font-mono">Live Playground &amp; Guardrail Ledger</span>
              </div>
              {logs.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No completions executed yet. Run a prompt in the Playground tab to record telemetry here.
                </div>
              ) : (
                <div className="divide-y divide-[#1f1f1f]">
                  {logs.map((l) => (
                    <div key={l.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            l.guardrailStatus === "BLOCKED"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {l.guardrailStatus}
                        </span>
                        <span className="text-white truncate max-w-md">{l.promptPreview}</span>
                      </div>
                      <div className="text-zinc-400 flex items-center gap-3">
                        <span>{l.model}</span>
                        <span>~{l.tokensEst} tok</span>
                        <span className="text-emerald-400">{l.latencyMs}ms</span>
                        <span>{l.at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI BRAIN TAB */}
        {activeTab === "brain" && (
          <SparrowxAiBrainCenter
            activeNav="SparrowX AI Brain"
            portalMode="client"
            incidents={[]}
            threatIndicators={[]}
            assets={[]}
            vulnerabilities={[]}
            protectedServices={[]}
            clientTenants={[]}
            auditLogs={[]}
            onEnforceGlobalAutoBlock={async (count) => {
              emitEngineToast(`Enforced ${count} learned AI defense pattern(s).`, "success");
            }}
            showToast={(msg, type) =>
              emitEngineToast(msg, type === "cooking" ? "info" : (type ?? "info"))
            }
          />
        )}
      </main>

      <SparrowxFooter />
    </div>
  );
}
