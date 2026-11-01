import React, { useState, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  KeyRound,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AiBrainChatTurn,
  type LearnedThreatPattern,
  type SparrowxBrainModel,
  analyzeAndLearnCustomThreatPayload,
  collectUnifiedPlatformContext,
  getAiBrainConfig,
  getLearnedThreatPatterns,
  getMaskedBrainKeyStatus,
  getStoredBrainChat,
  harvestTelemetryIntoAiMemory,
  querySparrowxGeminiBrain,
  saveAiBrainConfig,
  saveLearnedThreatPatterns,
  saveStoredBrainChat,
} from "@/lib/sparrowx-ai-brain";
import type {
  Asset,
  AuditLogEntry,
  ClientTenant,
  Incident,
  ProtectedService,
  ThreatIndicator,
  Vulnerability,
} from "@/lib/supabase";

export interface SparrowxAiBrainProps {
  activeNav: string;
  portalMode: "client" | "soc" | "admin";
  incidents: Incident[];
  threatIndicators: ThreatIndicator[];
  assets: Asset[];
  vulnerabilities: Vulnerability[];
  protectedServices: ProtectedService[];
  clientTenants: ClientTenant[];
  auditLogs: AuditLogEntry[];
  onEnforceGlobalAutoBlock: (learnedCount: number) => Promise<void>;
  onNavigate?: (nav: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

export function SparrowxAiBrainCenter({
  activeNav,
  portalMode,
  incidents,
  threatIndicators,
  assets,
  vulnerabilities,
  protectedServices,
  clientTenants,
  auditLogs,
  onEnforceGlobalAutoBlock,
  showToast,
}: SparrowxAiBrainProps) {
  const [config, setConfig] = useState(() => getAiBrainConfig());
  const [patterns, setPatterns] = useState<LearnedThreatPattern[]>(() =>
    getLearnedThreatPatterns(),
  );
  const [chatHistory, setChatHistory] = useState<AiBrainChatTurn[]>(() => getStoredBrainChat());
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);

  // Custom Payload / Log Learning Analyzer
  const [rawPayloadInput, setRawPayloadInput] = useState("");
  const [targetEndpointInput, setTargetEndpointInput] = useState("/api/v1/checkout");
  const [isAnalyzingPayload, setIsAnalyzingPayload] = useState(false);
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);

  // Key Vault Config
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState("");

  const keyStatus = useMemo(() => getMaskedBrainKeyStatus(), [config]);

  const digest = useMemo(
    () =>
      collectUnifiedPlatformContext({
        activeNav,
        portalMode,
        incidents,
        threatIndicators,
        assets,
        vulnerabilities,
        protectedServices,
        clientTenants,
        auditLogs,
      }),
    [
      activeNav,
      portalMode,
      incidents,
      threatIndicators,
      assets,
      vulnerabilities,
      protectedServices,
      clientTenants,
      auditLogs,
    ],
  );

  const totalPreventedHits = useMemo(
    () => patterns.reduce((acc, p) => acc + p.preventedFutureHits, 0),
    [patterns],
  );

  const handleModelSwitch = (model: SparrowxBrainModel) => {
    const next = saveAiBrainConfig({ model });
    setConfig(next);
    showToast(`SparrowX AI Brain switched to ${model}`, "info");
  };

  const handleToggleAutoBlock = () => {
    const next = saveAiBrainConfig({
      autoBlockFutureThreats: !config.autoBlockFutureThreats,
    });
    setConfig(next);
    showToast(
      next.autoBlockFutureThreats
        ? "Autonomous Future-Threat Auto-Blocking ENABLED across all dashboards"
        : "Autonomous Future-Threat Auto-Blocking set to Advisory mode",
      "info",
    );
  };

  const handleSaveCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyInput.trim()) return;
    const next = saveAiBrainConfig({ customApiKey: newKeyInput.trim() });
    setConfig(next);
    setNewKeyInput("");
    setShowKeyConfig(false);
    showToast("Gemini API Key securely updated and masked in SparrowX Brain Vault", "success");
  };

  const handleRunNeuralHarvestAndAutoBlock = async () => {
    setIsHarvesting(true);
    const { newlyLearned, allPatterns } = harvestTelemetryIntoAiMemory({
      incidents,
      threatIndicators,
      vulnerabilities,
      protectedServices,
    });
    setPatterns(allPatterns);
    await onEnforceGlobalAutoBlock(newlyLearned.length);
    setIsHarvesting(false);
    showToast(
      newlyLearned.length > 0
        ? `AI Brain learned ${newlyLearned.length} new threat signature(s) & deployed global block rules!`
        : `All ${allPatterns.length} threat signatures verified & actively blocking future attacks!`,
      "success",
    );
  };

  const handleAnalyzeCustomPayload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPayloadInput.trim()) return;
    setIsAnalyzingPayload(true);
    const learned = await analyzeAndLearnCustomThreatPayload({
      rawInput: rawPayloadInput,
      targetEndpoint: targetEndpointInput,
      digest,
    });
    setPatterns(getLearnedThreatPatterns());
    setRawPayloadInput("");
    setIsAnalyzingPayload(false);
    showToast(
      `Learned signature ${learned.id} (${learned.vectorName}) — now auto-blocking future matches!`,
      "success",
    );
  };

  const handleSendPrompt = async (promptText?: string) => {
    const query = (promptText ?? chatInput).trim();
    if (!query || isThinking) return;
    if (!promptText) setChatInput("");

    const userTurn: AiBrainChatTurn = {
      id: `turn-u-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updatedWithUser = [...chatHistory, userTurn];
    setChatHistory(updatedWithUser);
    saveStoredBrainChat(updatedWithUser);

    setIsThinking(true);
    // Also harvest any new telemetry into memory while thinking
    const { newlyLearned, allPatterns } = harvestTelemetryIntoAiMemory({
      incidents,
      threatIndicators,
      vulnerabilities,
      protectedServices,
    });
    if (newlyLearned.length > 0) {
      setPatterns(allPatterns);
    }

    const response = await querySparrowxGeminiBrain({
      prompt: query,
      digest,
      model: config.model,
      previousInteractionId: config.lastInteractionId,
    });

    const aiTurn: AiBrainChatTurn = {
      id: `turn-a-${Date.now()}`,
      role: "assistant",
      content: response.text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      modelUsed: response.modelUsed,
      interactionId: response.interactionId,
      learnedPatternsCount: newlyLearned.length,
    };

    const finalHistory = [...updatedWithUser, aiTurn];
    setChatHistory(finalHistory);
    saveStoredBrainChat(finalHistory);
    setIsThinking(false);
  };

  const handleCopyRule = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedRuleId(id);
    showToast("Predictive block rule copied to clipboard", "info");
    setTimeout(() => setCopiedRuleId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* TOP NEURAL COMMAND HEADER */}
      <section className="rounded-2xl border border-primary/40 bg-gradient-to-r from-[#140A06] via-[#0A0A0A] to-[#080808] p-5 sm:p-6 shadow-[0_0_45px_rgba(240,90,40,0.12)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-mono font-bold text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                GEMINI NEURAL BRAIN ONLINE
              </span>
              <span className="rounded-full border border-[#262626] bg-black px-2.5 py-0.5 text-[11px] font-mono text-zinc-300">
                Model: <strong className="text-primary">{config.model}</strong> (Current SDK
                substitute for legacy Gemini Pro)
              </span>
              <span className="rounded-full border border-[#262626] bg-black px-2.5 py-0.5 text-[11px] font-mono text-zinc-400">
                Vault Key: <code className="text-emerald-400">{keyStatus.maskedKey}</code>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Brain className="size-7 text-primary shrink-0" />
              <span>SparrowX Autonomous AI Brain & Predictive Threat Blocker</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Connected across all dashboards (Incidents, SIEM, Threat Intel, Vulnerabilities, Web &
              AI Shield, and Client Verification). Continuously collects live attack telemetry,
              learns adversary signatures, and deploys proactive block rules to stop future breaches
              before they execute.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleRunNeuralHarvestAndAutoBlock()}
              disabled={isHarvesting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`size-4 ${isHarvesting ? "animate-spin" : ""}`} />
              <span>
                {isHarvesting ? "Learning & Blocking..." : "Learn Telemetry & Block Future Threats"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#262626] bg-[#0A0A0A] px-3.5 py-2.5 text-xs font-semibold text-zinc-200 hover:border-zinc-600 cursor-pointer"
            >
              <KeyRound className="size-3.5 text-primary" />
              <span>AI Vault & Model</span>
            </button>
          </div>
        </div>

        {/* Collapsible AI Key & Model Selector Bar */}
        {showKeyConfig && (
          <div className="mt-5 pt-4 border-t border-[#1F1F1F] grid gap-4 lg:grid-cols-12 items-end">
            <div className="lg:col-span-5 space-y-1.5">
              <span className="text-xs font-semibold text-white block">
                Select Active Gemini Neural Model (`@google/genai`)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleModelSwitch("gemini-3.8-flash")}
                  className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                    config.model === "gemini-3.8-flash"
                      ? "border-primary bg-primary/15 text-white"
                      : "border-[#262626] bg-black text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">gemini-3.8-flash</div>
                  <div className="text-[10px] text-zinc-400">
                    1M Context · Sub-second Agentic SOC Brain
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleModelSwitch("gemini-4-argon")}
                  className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                    config.model === "gemini-4-argon"
                      ? "border-primary bg-primary/15 text-white"
                      : "border-[#262626] bg-black text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">gemini-4-argon</div>
                  <div className="text-[10px] text-zinc-400">
                    1M Context · Deep Threat Reasoning & Research
                  </div>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSaveCustomKey}
              className="lg:col-span-7 flex flex-col sm:flex-row gap-2"
            >
              <div className="flex-1">
                <label
                  htmlFor="gemini-vault-key"
                  className="text-xs font-semibold text-zinc-300 block mb-1"
                >
                  Update Gemini API Key (Stored Masked in SparrowX Vault · Active:{" "}
                  <code className="text-emerald-400">{keyStatus.maskedKey}</code>)
                </label>
                <input
                  id="gemini-vault-key"
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="Paste Gemini API key to rotate vault credential..."
                  className="h-9 w-full rounded-xl border border-[#262626] bg-black px-3 text-xs text-white outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                className="h-9 self-end rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer shrink-0"
              >
                Save to Vault
              </button>
            </form>
          </div>
        )}

        {/* 4 Live Neural Brain KPI Cards */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Learned Threat Signatures</span>
              <Cpu className="size-4 text-primary" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-white font-mono">{patterns.length}</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              Collected from live incidents, IOCs & CVEs
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Future Attacks Auto-Blocked</span>
              <ShieldCheck className="size-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-emerald-400 font-mono">
              {totalPreventedHits.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Pre-emptively dropped by learned rules
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Cross-Dashboard Signals</span>
              <Activity className="size-4 text-cyan-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-white font-mono">
              {digest.totalIncidents +
                digest.blockedIocsCount +
                digest.unblockedIocsCount +
                digest.openVulnerabilities +
                digest.protectedServicesCount}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Correlated across 7 security modules
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Autonomous Defense Mode</span>
              <Lock className="size-4 text-primary" />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {config.autoBlockFutureThreats ? "Auto-Block Active" : "Advisory Mode"}
              </span>
              <button
                type="button"
                onClick={handleToggleAutoBlock}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold cursor-pointer ${
                  config.autoBlockFutureThreats
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {config.autoBlockFutureThreats ? "ENABLED" : "PAUSED"}
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Instantly inoculates all client endpoints
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID: LEFT = MULTI-TURN GEMINI COPILOT + PAYLOAD LEARNER | RIGHT = ADAPTIVE THREAT MEMORY LEDGER */}
      <div className="grid gap-6 xl:grid-cols-12 items-start">
        {/* Left 6 Cols: Interactive Gemini AI Brain Copilot & Custom Threat Learner */}
        <div className="xl:col-span-6 space-y-6">
          {/* Stateful Gemini Copilot */}
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 flex flex-col h-[560px]">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Gemini Security Copilot (All-Dashboard Context)
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Stateful `interactions.create` session with live access to Incidents, SIEM,
                    Assets & CVEs
                  </p>
                </div>
              </div>
              {chatHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setChatHistory([]);
                    saveStoredBrainChat([]);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  Clear History
                </button>
              )}
            </div>

            {/* Quick Tactical Prompts */}
            <div className="flex flex-wrap gap-1.5 py-3 border-b border-[#1F1F1F]">
              {[
                "Analyze all open incidents & generate block rules for future attacks",
                "What vulnerabilities & unblocked IOCs pose the highest risk right now?",
                "Synthesize AI Agent prompt-injection guardrails for our endpoints",
                "Verify client protection coverage & identify monitoring gaps",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleSendPrompt(preset)}
                  className="rounded-lg border border-[#262626] bg-black px-2.5 py-1 text-[11px] text-zinc-300 hover:border-primary/50 hover:text-white transition-all cursor-pointer text-left"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {chatHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#262626] bg-black/50 p-5 text-xs text-zinc-400 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Bot className="size-4 text-primary" />
                    <span>SparrowX Gemini AI Brain Ready</span>
                  </div>
                  <p className="leading-relaxed">
                    I am actively monitoring <strong>{digest.totalIncidents} incident(s)</strong>,{" "}
                    <strong>
                      {digest.blockedIocsCount + digest.unblockedIocsCount} threat indicator(s)
                    </strong>
                    , <strong>{digest.openVulnerabilities} open CVE(s)</strong>, and{" "}
                    <strong>{digest.protectedServicesCount} protected Web/AI service(s)</strong>.
                    Ask me anything or click a tactical prompt above to generate predictive block
                    rules.
                  </p>
                </div>
              ) : (
                chatHistory.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-xl p-3.5 text-xs leading-relaxed ${
                      turn.role === "user"
                        ? "ml-8 border border-primary/30 bg-primary/10 text-white"
                        : "mr-4 border border-[#1F1F1F] bg-black text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1.5">
                      <span className="font-bold uppercase text-primary">
                        {turn.role === "user"
                          ? "SOC Operator"
                          : `SparrowX Brain (${turn.modelUsed ?? config.model})`}
                      </span>
                      <span>{turn.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap font-sans">{turn.content}</div>
                  </div>
                ))
              )}
              {isThinking && (
                <div className="rounded-xl border border-primary/30 bg-black p-3.5 text-xs text-zinc-300 flex items-center gap-2.5">
                  <RefreshCw className="size-4 text-primary animate-spin shrink-0" />
                  <span>
                    Gemini Brain (`{config.model}`) is correlating multi-dashboard telemetry and
                    synthesizing predictive block rules...
                  </span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendPrompt();
              }}
              className="pt-3 border-t border-[#1F1F1F] flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Gemini Brain to analyze telemetry, hunt threats, or write block rules..."
                className="h-10 flex-1 rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={isThinking || !chatInput.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="size-3.5" />
                <span>Ask Brain</span>
              </button>
            </form>
          </div>

          {/* Neural Payload & Log Learner Box */}
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="size-4 text-primary" />
                  <span>Teach AI Brain a New Attack Payload or Suspicious Log</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Paste any suspicious HTTP request, SQLi/XSS string, or LLM prompt injection. The
                  AI Brain will extract its signature and block all future variants automatically.
                </p>
              </div>
            </div>

            <form onSubmit={handleAnalyzeCustomPayload} className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={rawPayloadInput}
                    onChange={(e) => setRawPayloadInput(e.target.value)}
                    placeholder={`e.g. GET /api/users?id=1' UNION SELECT password FROM users-- or "Ignore prior instructions..."`}
                    className="h-9 w-full rounded-xl border border-[#262626] bg-black px-3 text-xs text-white outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={targetEndpointInput}
                    onChange={(e) => setTargetEndpointInput(e.target.value)}
                    placeholder="Target (/api/v1/*)"
                    className="h-9 w-full rounded-xl border border-[#262626] bg-black px-3 text-xs text-white outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isAnalyzingPayload}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
              >
                <Brain className="size-3.5 text-primary" />
                <span>
                  {isAnalyzingPayload
                    ? "Extracting Signature & Deploying Rule..."
                    : "Analyze, Learn Signature & Auto-Block Future Hits"}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 6 Cols: Adaptive Threat Memory Ledger (Learned Block Rules) */}
        <div className="xl:col-span-6 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>Adaptive Threat Memory Ledger ({patterns.length} Active Signatures)</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Every pattern below was learned from your dashboards and is actively blocking repeat
                adversary waves across Edge WAF, Cloudflare, UFW & AI Shield.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 max-h-[700px] overflow-y-auto pr-1">
            {patterns.map((pat) => (
              <div
                key={pat.id}
                className="rounded-xl border border-[#1F1F1F] bg-black p-4 space-y-2.5 hover:border-zinc-700 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/15 border border-primary/30 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                      {pat.id}
                    </span>
                    <span className="rounded bg-zinc-900 border border-[#262626] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      {pat.sourceDashboard}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {pat.mitreTechnique}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {pat.status} ({pat.preventedFutureHits} blocked)
                  </span>
                </div>

                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">{pat.vectorName}</h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    {pat.predictiveAnalysis}
                  </p>
                </div>

                <div className="rounded-lg border border-[#1F1F1F] bg-[#070707] p-2.5 font-mono text-[11px] text-zinc-300 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>
                      Target: <strong className="text-white">{pat.targetScope}</strong> · Indicator:{" "}
                      <code className="text-primary">{pat.indicatorValue}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyRule(
                          pat.id,
                          `${pat.wafBlockRule}\n# Cloudflare: ${pat.cloudflareExpression}\n# UFW: ${pat.ufwRule}`,
                        )
                      }
                      className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                    >
                      {copiedRuleId === pat.id ? (
                        <>
                          <Check className="size-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copy Block Rule
                        </>
                      )}
                    </button>
                  </div>
                  <div className="truncate text-emerald-300">{pat.wafBlockRule}</div>
                  <div className="truncate text-zinc-400">CF: {pat.cloudflareExpression}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating Neural Brain Bar & Quick Drawer visible across ALL dashboards
 * (SOC views, Client Portal, and Admin Command Center) so the Gemini AI Brain
 * is always 1 click away.
 */
export function GlobalAiBrainFloatingDock(
  props: SparrowxAiBrainProps & { onOpenFullBrainView?: () => void },
) {
  const [isOpen, setIsOpen] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickAnswer, setQuickAnswer] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isAutoBlocking, setIsAutoBlocking] = useState(false);

  const patterns = useMemo(() => getLearnedThreatPatterns(), [isOpen, isAutoBlocking]);
  const digest = useMemo(
    () =>
      collectUnifiedPlatformContext({
        activeNav: props.activeNav,
        portalMode: props.portalMode,
        incidents: props.incidents,
        threatIndicators: props.threatIndicators,
        assets: props.assets,
        vulnerabilities: props.vulnerabilities,
        protectedServices: props.protectedServices,
        clientTenants: props.clientTenants,
        auditLogs: props.auditLogs,
      }),
    [
      props.activeNav,
      props.portalMode,
      props.incidents,
      props.threatIndicators,
      props.assets,
      props.vulnerabilities,
      props.protectedServices,
      props.clientTenants,
      props.auditLogs,
    ],
  );

  const handleQuickAsk = async (e?: React.FormEvent, preset?: string) => {
    e?.preventDefault();
    const q = (preset ?? quickPrompt).trim();
    if (!q || isQuerying) return;
    if (!preset) setQuickPrompt("");
    setIsQuerying(true);
    const res = await querySparrowxGeminiBrain({
      prompt: q,
      digest,
    });
    setQuickAnswer(res.text);
    setIsQuerying(false);
  };

  const handleQuickAutoBlock = async () => {
    setIsAutoBlocking(true);
    const { newlyLearned } = harvestTelemetryIntoAiMemory({
      incidents: props.incidents,
      threatIndicators: props.threatIndicators,
      vulnerabilities: props.vulnerabilities,
      protectedServices: props.protectedServices,
    });
    await props.onEnforceGlobalAutoBlock(newlyLearned.length);
    setIsAutoBlocking(false);
    setQuickAnswer(
      `✅ **AI Brain Auto-Block Executed on \`${props.activeNav}\`**: Learned **${newlyLearned.length}** new threat signature(s), quarantined unblocked IOCs, and enforced **${getLearnedThreatPatterns().length}** predictive rules across all endpoints.`,
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 rounded-2xl border border-primary/50 bg-[#0A0A0A]/95 px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_30px_rgba(240,90,40,0.3)] backdrop-blur-xl hover:border-primary transition-all cursor-pointer"
        >
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-400" />
          </span>
          <Brain className="size-4 text-primary" />
          <span>SparrowX AI Brain</span>
          <span className="rounded-md bg-primary/20 border border-primary/30 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            {patterns.length} Rules Active
          </span>
        </button>
      ) : (
        <div className="w-[360px] sm:w-[430px] rounded-2xl border border-primary/40 bg-[#0A0A0A]/98 p-4 text-white shadow-[0_0_50px_rgba(0,0,0,0.95)] backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-2.5">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>SparrowX Gemini AI Brain</span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400">
                    LIVE
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  Monitoring: {props.portalMode.toUpperCase()} · {props.activeNav}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {props.onOpenFullBrainView && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    props.onOpenFullBrainView?.();
                  }}
                  className="rounded-lg border border-[#262626] bg-black px-2 py-1 text-[10px] font-semibold text-primary hover:border-primary/50 cursor-pointer"
                >
                  Full Console →
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* 1-Click Auto-Learn & Block Button */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1F1F1F] bg-black p-2.5">
            <div className="text-[11px] text-zinc-300">
              <strong className="text-white">{patterns.length}</strong> learned block rules ·{" "}
              <strong className="text-amber-400">{digest.unblockedIocsCount}</strong> unblocked IOCs
            </div>
            <button
              type="button"
              onClick={() => void handleQuickAutoBlock()}
              disabled={isAutoBlocking}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-95 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Zap className="size-3" />
              <span>{isAutoBlocking ? "Blocking..." : "Auto-Block Future Threats"}</span>
            </button>
          </div>

          {/* Quick Preset Pills */}
          <div className="flex flex-wrap gap-1">
            {[
              `Summarize ${props.activeNav} risks`,
              "Predict & block next attack",
              "Generate WAF rule",
            ].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void handleQuickAsk(undefined, p)}
                className="rounded-lg border border-[#262626] bg-black px-2 py-1 text-[10px] text-zinc-300 hover:border-primary/50 hover:text-white cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Output Area */}
          {isQuerying ? (
            <div className="rounded-xl border border-[#1F1F1F] bg-black p-3 text-xs text-zinc-300 flex items-center gap-2">
              <RefreshCw className="size-3.5 text-primary animate-spin shrink-0" />
              <span>Gemini Brain analyzing `{props.activeNav}` telemetry...</span>
            </div>
          ) : (
            quickAnswer && (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-[#1F1F1F] bg-black p-3 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {quickAnswer}
              </div>
            )
          )}

          {/* Input */}
          <form onSubmit={(e) => void handleQuickAsk(e)} className="flex gap-1.5">
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder={`Ask AI Brain about ${props.activeNav}...`}
              className="h-9 flex-1 rounded-xl border border-[#262626] bg-black px-3 text-xs text-white outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={isQuerying || !quickPrompt.trim()}
              className="rounded-xl bg-primary px-3 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
