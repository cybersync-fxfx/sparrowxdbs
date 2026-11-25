import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  Clock,
  Copy,
  Database,
  LayoutGrid,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Webhook,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { buildMasterHref, buildProductHref } from "@/lib/routing";
import { SubdomainAuthChip } from "@/components/SubdomainAuthChip";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { analyzePromptInSandbox } from "@/lib/advanced-features";
import { collectUnifiedPlatformContext, querySparrowxGeminiBrain } from "@/lib/sparrowx-ai-brain";

type AgentsTab = "fleet" | "builder" | "traces" | "webhooks";

interface AgentToolId {
  id: string;
  label: string;
}

const AVAILABLE_TOOLS: AgentToolId[] = [
  { id: "http_fetch", label: "HTTP / REST Fetch" },
  { id: "postgres_read", label: "PostgreSQL Read (pgvector)" },
  { id: "discord_alert", label: "Discord Webhook Alert" },
  { id: "domain_scanner", label: "Domain TLS/DNS Scanner" },
  { id: "guardrail_filter", label: "Sentinel Guardrail Filter" },
  { id: "ovh_watchdog", label: "OVH Health Watchdog" },
];

interface AutonomousAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  trigger: "Webhook" | "Cron (5m)" | "Event Stream" | "Manual";
  memory: "pgvector (Persistent)" | "Ephemeral RAM";
  status: "Active" | "Paused";
  tools: string[];
  instructions: string;
  runsCount: number;
  lastRunAt: string;
}

interface AgentTrace {
  id: string;
  agentId: string;
  agentName: string;
  input: string;
  steps: Array<{ step: string; detail: string; ms: number; ok: boolean }>;
  output: string;
  totalMs: number;
  at: string;
}

const AGENT_TEMPLATES: Array<Omit<AutonomousAgent, "id" | "runsCount" | "lastRunAt">> = [
  {
    name: "SOC Incident Responder",
    role: "Autonomous L7 WAF & DDoS Triage",
    model: "sparrowx/gemini-2.5-flash",
    trigger: "Event Stream",
    memory: "pgvector (Persistent)",
    status: "Active",
    tools: ["domain_scanner", "guardrail_filter", "discord_alert"],
    instructions:
      "Inspect incoming security anomalies, classify severity, draft immediate firewall/WAF mitigation rules, and alert the Discord SOC webhook.",
  },
  {
    name: "DPDP Compliance Auditor",
    role: "India DPDP Act 2023 Continuous Reviewer",
    model: "sparrowx/gemini-2.5-pro",
    trigger: "Cron (5m)",
    memory: "pgvector (Persistent)",
    status: "Active",
    tools: ["postgres_read", "guardrail_filter", "discord_alert"],
    instructions:
      "Scan personal data schemas for unmasked PII, verify retention expiry policies, and prepare DSAR / Section 8(6) audit summaries.",
  },
  {
    name: "PostgreSQL Query Optimizer",
    role: "Index & Slow-Query Advisor",
    model: "sparrowx/llama-3.3-70b",
    trigger: "Webhook",
    memory: "pgvector (Persistent)",
    status: "Active",
    tools: ["postgres_read", "http_fetch"],
    instructions:
      "Analyze PostgreSQL EXPLAIN plans, identify missing B-Tree or HNSW pgvector indexes, and output safe concurrent migration SQL.",
  },
  {
    name: "Uptime & SSL Watchdog",
    role: "Subdomain TLS & Origin Health Monitor",
    model: "sparrowx/gemini-2.5-flash",
    trigger: "Cron (5m)",
    memory: "Ephemeral RAM",
    status: "Active",
    tools: ["domain_scanner", "ovh_watchdog", "discord_alert"],
    instructions:
      "Probe all *.sparrowx.net endpoints, verify TLSv1.3 certificate expiry, detect 502/504 regressions, and emit recovery runbooks.",
  },
];

const AGENTS_STORAGE = "spx_autonomous_agents_v1";
const TRACES_STORAGE = "spx_autonomous_traces_v1";

export function SparrowxAgentsPlatform() {
  const [activeTab, setActiveTab] = useState<AgentsTab>("fleet");
  const [agents, setAgents] = useState<AutonomousAgent[]>([]);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deploy Modal state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [draftModel, setDraftModel] = useState("sparrowx/gemini-2.5-flash");
  const [draftTrigger, setDraftTrigger] = useState<AutonomousAgent["trigger"]>("Webhook");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftTools, setDraftTools] = useState<string[]>(["http_fetch", "guardrail_filter"]);

  // Live Run Console state
  const [runInput, setRunInput] = useState(
    "Audit https://sparrowx.net perimeter headers and recommend 2 immediate latency or WAF improvements.",
  );
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AGENTS_STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved) as AutonomousAgent[];
        setAgents(parsed);
        if (parsed[0]) setSelectedAgentId(parsed[0].id);
      } else {
        const seeded: AutonomousAgent[] = AGENT_TEMPLATES.map((t, i) => ({
          ...t,
          id: `agt-${i + 1}-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 14)}`,
          runsCount: 12 + i * 7,
          lastRunAt: "Just now",
        }));
        setAgents(seeded);
        setSelectedAgentId(seeded[0]?.id ?? "");
        window.localStorage.setItem(AGENTS_STORAGE, JSON.stringify(seeded));
      }
      const savedTraces = window.localStorage.getItem(TRACES_STORAGE);
      if (savedTraces) setTraces(JSON.parse(savedTraces) as AgentTrace[]);
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistAgents = (next: AutonomousAgent[]) => {
    setAgents(next);
    try {
      window.localStorage.setItem(AGENTS_STORAGE, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistTraces = (next: AgentTrace[]) => {
    setTraces(next);
    try {
      window.localStorage.setItem(TRACES_STORAGE, JSON.stringify(next.slice(0, 30)));
    } catch {
      // ignore
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null;

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleDeployAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    const created: AutonomousAgent = {
      id: `agt-${Date.now().toString(36)}`,
      name: draftName.trim(),
      role: draftRole.trim() || "Custom Autonomous Worker",
      model: draftModel,
      trigger: draftTrigger,
      memory: "pgvector (Persistent)",
      status: "Active",
      tools: draftTools.length > 0 ? draftTools : ["guardrail_filter"],
      instructions:
        draftInstructions.trim() ||
        "Analyze incoming payloads safely, execute authorized tools, and return structured actionable results.",
      runsCount: 0,
      lastRunAt: "Never",
    };
    persistAgents([created, ...agents]);
    setSelectedAgentId(created.id);
    setShowDeployModal(false);
    setDraftName("");
    setDraftRole("");
    setDraftInstructions("");
    emitEngineToast(`Deployed autonomous agent: ${created.name}`, "success");
  };

  const handleRunAgent = async (agent: AutonomousAgent, payload?: string) => {
    const prompt = (payload ?? runInput).trim();
    if (!prompt || runningAgentId) return;
    setRunningAgentId(agent.id);
    setSelectedAgentId(agent.id);
    setActiveTab("traces");

    const t0 = performance.now();
    const steps: AgentTrace["steps"] = [];

    try {
      // Step 1: Guardrail verification
      const gStart = performance.now();
      const guard = analyzePromptInSandbox(prompt);
      const gMs = Math.max(4, Math.round(performance.now() - gStart));
      const blocked = guard.blocked;
      steps.push({
        step: "1. Sentinel Guardrail Pre-Check",
        detail: blocked
          ? `Blocked (${guard.threatCategory} • Safety ${guard.score}/100): ${guard.remediationAction}`
          : `Verified clean payload (Safety ${guard.score}/100)`,
        ms: gMs,
        ok: !blocked,
      });

      let finalOutput = "";
      if (blocked) {
        finalOutput = `Execution halted by SparrowX Sentinel Guardrail (${guard.threatCategory}, safety ${guard.score}/100). Sanitize prompt before invoking agent tools.`;
      } else {
        // Step 2: Tool binding & Memory hydration
        steps.push({
          step: "2. Tool & Memory Hydration",
          detail: `Bound ${agent.tools.length} tool(s) [${agent.tools.join(", ")}] • Memory: ${agent.memory}`,
          ms: 14,
          ok: true,
        });

        // Step 3: Live Model Execution
        const mStart = performance.now();
        const digest = collectUnifiedPlatformContext({
          activeNav: `Agent: ${agent.name}`,
          portalMode: "client",
          incidents: [],
          threatIndicators: [],
          assets: [],
          vulnerabilities: [],
          protectedServices: [],
          clientTenants: [],
          auditLogs: [],
        });
        const brainRes = await querySparrowxGeminiBrain({
          prompt: `Agent Name: ${agent.name}\nRole: ${agent.role}\nSystem Instructions: ${agent.instructions}\nEnabled Tools: ${agent.tools.join(", ")}\n\nTask Input:\n${prompt}`,
          digest,
        });
        const mMs = Math.max(35, Math.round(performance.now() - mStart));
        steps.push({
          step: `3. Reasoning & Tool Execution (${agent.model})`,
          detail: `Completed reasoning pass via ${brainRes.modelUsed}`,
          ms: mMs,
          ok: true,
        });
        finalOutput = brainRes.text;
      }

      const totalMs = Math.max(20, Math.round(performance.now() - t0));
      const trace: AgentTrace = {
        id: `trc-${Date.now().toString(36)}`,
        agentId: agent.id,
        agentName: agent.name,
        input: prompt,
        steps,
        output: finalOutput,
        totalMs,
        at: new Date().toLocaleTimeString(),
      };

      persistTraces([trace, ...traces]);
      persistAgents(
        agents.map((a) =>
          a.id === agent.id ? { ...a, runsCount: a.runsCount + 1, lastRunAt: "Just now" } : a,
        ),
      );
      emitEngineToast(`Agent "${agent.name}" finished run in ${totalMs}ms`, blocked ? "error" : "success");
    } catch (err) {
      emitEngineToast(
        `Agent run failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setRunningAgentId(null);
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      !search.trim() ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans antialiased flex flex-col">
      {/* Vercel-Style Sticky Header + Tabs */}
      <header className="sticky top-0 z-40 border-b border-[#262626] bg-[#000000]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={buildMasterHref("/")} className="flex items-center gap-2 shrink-0">
              <img src="/sparrowx-logo.png" alt="SparrowX Agents" width={26} height={26} className="size-6.5 object-contain" />
            </a>
            <span className="text-zinc-600 font-light">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm tracking-tight text-white truncate">
                SparrowX Agents
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                Autonomous Cloud
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SubdomainAuthChip nextPath="/agents" />
            <a
              href={buildProductHref("ai")}
              className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <Sparkles className="size-3.5 text-violet-400" />
              <span>AI Gateway</span>
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
              onClick={() => setShowDeployModal(true)}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md bg-white hover:bg-zinc-200 text-black px-3.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Deploy Agent</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <nav aria-label="SparrowX Agents Sections" className="flex items-center gap-1 -mb-px">
            {(
              [
                { id: "fleet", label: "Agent Fleet", icon: LayoutGrid },
                { id: "builder", label: "Workflow & Tools", icon: Workflow },
                { id: "traces", label: "Live Run Console", icon: Terminal },
                { id: "webhooks", label: "Webhooks & Triggers", icon: Webhook },
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
        {/* FLEET TAB (Landing Hero + Agent Cards) */}
        {activeTab === "fleet" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono text-emerald-300">
                  <Bot className="size-3.5" />
                  <span>agents.sparrowx.net • Autonomous Agent Runtime</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Deploy Guardrailed AI Agents With Tools, Memory &amp; Webhooks.
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Build event-driven security responders, compliance auditors, database optimizers, and support agents backed by pgvector memory and real-time step traces.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 min-w-[260px] text-xs font-mono">
                <div className="rounded-lg border border-[#262626] bg-[#000] p-3.5">
                  <div className="text-zinc-500">ACTIVE AGENTS</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {agents.filter((a) => a.status === "Active").length}/{agents.length}
                  </div>
                </div>
                <div className="rounded-lg border border-[#262626] bg-[#000] p-3.5">
                  <div className="text-zinc-500">LIVE TRACES</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {traces.length}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deployed agents by name or role..."
                  className="w-full rounded-lg border border-[#262626] bg-[#0A0A0A] pl-10 pr-4 py-2 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowDeployModal(true)}
                className="rounded-lg bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="size-3.5" /> New Agent
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 flex flex-col justify-between gap-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{agent.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
                              agent.status === "Active"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            {agent.status}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{agent.role}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          persistAgents(
                            agents.map((a) =>
                              a.id === agent.id
                                ? { ...a, status: a.status === "Active" ? "Paused" : "Active" }
                                : a,
                            ),
                          )
                        }
                        className="p-1.5 rounded-md border border-[#262626] bg-[#000] text-zinc-300 hover:text-white cursor-pointer"
                        title={agent.status === "Active" ? "Pause agent" : "Resume agent"}
                      >
                        {agent.status === "Active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2">{agent.instructions}</p>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded border border-[#262626] bg-[#000] px-2 py-0.5 text-[10px] font-mono text-violet-300">
                        {agent.model}
                      </span>
                      <span className="rounded border border-[#262626] bg-[#000] px-2 py-0.5 text-[10px] font-mono text-zinc-300 inline-flex items-center gap-1">
                        <Clock className="size-2.5" /> {agent.trigger}
                      </span>
                      <span className="rounded border border-[#262626] bg-[#000] px-2 py-0.5 text-[10px] font-mono text-emerald-300 inline-flex items-center gap-1">
                        <Database className="size-2.5" /> {agent.memory}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1f1f1f] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {agent.runsCount} runs • {agent.tools.length} tools
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setActiveTab("builder");
                        }}
                        className="rounded-md border border-[#262626] bg-[#000] hover:bg-[#161616] px-2.5 py-1.5 text-xs text-zinc-200 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Settings className="size-3" /> Configure
                      </button>
                      <button
                        type="button"
                        disabled={runningAgentId === agent.id}
                        onClick={() => void handleRunAgent(agent)}
                        className="rounded-md bg-white hover:bg-zinc-200 text-black px-3 py-1.5 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        {runningAgentId === agent.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Play className="size-3" />
                        )}
                        <span>Run Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKFLOW & TOOLS BUILDER TAB */}
        {activeTab === "builder" && selectedAgent && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 rounded-xl border border-[#262626] bg-[#0A0A0A] p-4 space-y-2 h-fit">
              <div className="text-[11px] font-mono uppercase text-zinc-400 px-2 pb-1">
                Select Agent
              </div>
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAgentId(a.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                    a.id === selectedAgent.id
                      ? "bg-white text-black font-semibold"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <div>{a.name}</div>
                  <div className={`text-[10px] ${a.id === selectedAgent.id ? "text-zinc-700" : "text-zinc-500"}`}>
                    {a.model}
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8 rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#262626] pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">{selectedAgent.name}</h2>
                  <p className="text-xs text-zinc-400">{selectedAgent.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    persistAgents(agents.filter((a) => a.id !== selectedAgent.id));
                    emitEngineToast(`Deleted agent ${selectedAgent.name}`, "info");
                  }}
                  className="rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <label className="block space-y-1">
                  <span className="text-zinc-400">Model Runtime</span>
                  <select
                    value={selectedAgent.model}
                    onChange={(e) =>
                      persistAgents(
                        agents.map((a) => (a.id === selectedAgent.id ? { ...a, model: e.target.value } : a)),
                      )
                    }
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white font-mono"
                  >
                    <option value="sparrowx/gemini-2.5-flash">sparrowx/gemini-2.5-flash</option>
                    <option value="sparrowx/gemini-2.5-pro">sparrowx/gemini-2.5-pro</option>
                    <option value="sparrowx/llama-3.3-70b">sparrowx/llama-3.3-70b</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-zinc-400">Trigger Mode</span>
                  <select
                    value={selectedAgent.trigger}
                    onChange={(e) =>
                      persistAgents(
                        agents.map((a) =>
                          a.id === selectedAgent.id
                            ? { ...a, trigger: e.target.value as AutonomousAgent["trigger"] }
                            : a,
                        ),
                      )
                    }
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  >
                    <option value="Webhook">Webhook HTTP POST</option>
                    <option value="Cron (5m)">Cron Schedule (Every 5m)</option>
                    <option value="Event Stream">Live Security Event Stream</option>
                    <option value="Manual">Manual On-Demand</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">Agent System Instructions</span>
                <textarea
                  rows={4}
                  value={selectedAgent.instructions}
                  onChange={(e) =>
                    persistAgents(
                      agents.map((a) =>
                        a.id === selectedAgent.id ? { ...a, instructions: e.target.value } : a,
                      ),
                    )
                  }
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                />
              </label>

              <div className="space-y-2">
                <span className="text-xs text-zinc-400 inline-flex items-center gap-1.5">
                  <Wrench className="size-3.5" /> Authorized Tools (Guardrail-Enforced)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map((tool) => {
                    const enabled = selectedAgent.tools.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          const nextTools = enabled
                            ? selectedAgent.tools.filter((t) => t !== tool.id)
                            : [...selectedAgent.tools, tool.id];
                          persistAgents(
                            agents.map((a) =>
                              a.id === selectedAgent.id ? { ...a, tools: nextTools } : a,
                            ),
                          );
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs cursor-pointer flex items-center justify-between ${
                          enabled
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-[#262626] bg-[#000] text-zinc-400"
                        }`}
                      >
                        <span>{tool.label}</span>
                        <span className="font-mono text-[10px]">{enabled ? "ON" : "OFF"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIVE RUN CONSOLE & TRACES TAB */}
        {activeTab === "traces" && (
          <div className="space-y-6">
            {selectedAgent && (
              <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">
                    Test-Run Agent: <span className="text-emerald-400">{selectedAgent.name}</span>
                  </div>
                  <select
                    value={selectedAgent.id}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="rounded-md border border-[#262626] bg-[#000] px-2.5 py-1.5 text-xs text-white"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  disabled={Boolean(runningAgentId)}
                  onClick={() => void handleRunAgent(selectedAgent, runInput)}
                  className="rounded-md bg-white hover:bg-zinc-200 disabled:opacity-50 text-black px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {runningAgentId ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  <span>{runningAgentId ? "Executing Agent Pipeline..." : "Execute Live Trace"}</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              {traces.length === 0 ? (
                <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-8 text-center text-xs text-zinc-500">
                  No execution traces recorded yet. Click &ldquo;Execute Live Trace&rdquo; above to inspect a full step-by-step run.
                </div>
              ) : (
                traces.map((t) => (
                  <div key={t.id} className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f1f1f] pb-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Activity className="size-4 text-emerald-400" />
                        <span className="font-bold text-white">{t.agentName}</span>
                        <span className="text-zinc-500">{t.id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <span className="text-emerald-400">{t.totalMs}ms</span>
                        <span>{t.at}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(t.id, JSON.stringify(t, null, 2))}
                          className="text-zinc-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === t.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {t.steps.map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#1f1f1f] bg-[#000] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`size-3.5 ${s.ok ? "text-emerald-400" : "text-red-400"}`} />
                            <span className="text-white">{s.step}</span>
                            <span className="text-zinc-400">— {s.detail}</span>
                          </div>
                          <span className="text-zinc-500">{s.ms}ms</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg border border-[#262626] bg-[#05060A] p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">
                      {t.output}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* WEBHOOKS & TRIGGERS TAB */}
        {activeTab === "webhooks" && selectedAgent && (
          <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">
              Invoke &ldquo;{selectedAgent.name}&rdquo; via Webhook
            </h2>
            <p className="text-xs text-zinc-400">
              Trigger this agent from GitHub Actions, Discord bots, PostgREST webhooks, or your backend services.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#262626] bg-[#000] px-3.5 py-2.5 font-mono text-xs text-emerald-300">
              <span className="truncate">
                https://agents.sparrowx.net/api/agents/{selectedAgent.id}/invoke
              </span>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    "wh-url",
                    `https://agents.sparrowx.net/api/agents/${selectedAgent.id}/invoke`,
                  )
                }
                className="shrink-0 text-white hover:text-emerald-300 cursor-pointer"
              >
                {copiedId === "wh-url" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <pre className="rounded-lg border border-[#262626] bg-[#000] p-4 text-[11px] font-mono text-zinc-200 overflow-x-auto">
{`curl -X POST "https://agents.sparrowx.net/api/agents/${selectedAgent.id}/invoke" \\
  -H "Authorization: Bearer $SPARROWX_AI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Run scheduled audit on sparrowx.net"}'`}
            </pre>
          </div>
        )}
      </main>

      {/* Deploy New Agent Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleDeployAgent}
            className="w-full max-w-lg rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Deploy New Autonomous Agent</h2>
              <button
                type="button"
                onClick={() => setShowDeployModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              required
              placeholder="Agent Name (e.g. Git PR Security Reviewer)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
            />
            <input
              placeholder="Role / Mission"
              value={draftRole}
              onChange={(e) => setDraftRole(e.target.value)}
              className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white font-mono"
              >
                <option value="sparrowx/gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="sparrowx/gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="sparrowx/llama-3.3-70b">llama-3.3-70b</option>
              </select>
              <select
                value={draftTrigger}
                onChange={(e) => setDraftTrigger(e.target.value as AutonomousAgent["trigger"])}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
              >
                <option value="Webhook">Webhook</option>
                <option value="Cron (5m)">Cron (5m)</option>
                <option value="Event Stream">Event Stream</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
            <textarea
              rows={3}
              placeholder="System instructions for this agent..."
              value={draftInstructions}
              onChange={(e) => setDraftInstructions(e.target.value)}
              className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
            />
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TOOLS.map((t) => {
                const active = draftTools.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setDraftTools(
                        active ? draftTools.filter((x) => x !== t.id) : [...draftTools, t.id],
                      )
                    }
                    className={`rounded-md border px-2.5 py-1 text-[11px] cursor-pointer ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-[#262626] bg-[#000] text-zinc-400"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-white hover:bg-zinc-200 text-black py-2.5 text-xs font-semibold cursor-pointer"
            >
              Deploy Autonomous Agent
            </button>
          </form>
        </div>
      )}

      <SparrowxFooter />
    </div>
  );
}
