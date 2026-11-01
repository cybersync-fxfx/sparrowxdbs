import React, { useState, useMemo, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
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
import {
  fetchInternetThreatIntel,
  applyThreatIntelToDefenseSystem,
  getDefenseUpdateBulletins,
  getCurrentDefenseVersion,
  formatBulletinMarkdown,
  CURATED_INTERNET_THREAT_FEEDS,
  type InternetThreatItem,
  type DefenseSystemUpdateBulletin,
} from "@/lib/threat-intel-harvester";
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
  initialTab?: "copilot" | "intel_updates" | "memory_ledger";
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
  initialTab,
}: SparrowxAiBrainProps) {
  const [activeTab, setActiveTab] = useState<"copilot" | "intel_updates" | "memory_ledger">(() => {
    if (initialTab) return initialTab;
    if (activeNav.toLowerCase().includes("defense")) return "intel_updates";
    return "copilot";
  });

  const [config, setConfig] = useState(() => getAiBrainConfig());
  const [patterns, setPatterns] = useState<LearnedThreatPattern[]>(() =>
    getLearnedThreatPatterns(),
  );
  const [chatHistory, setChatHistory] = useState<AiBrainChatTurn[]>(() => getStoredBrainChat());
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);

  // Internet Threat Intel & Defense Updates State
  const [bulletins, setBulletins] = useState<DefenseSystemUpdateBulletin[]>(() =>
    getDefenseUpdateBulletins(),
  );
  const [currentDefenseVersion, setCurrentDefenseVersion] = useState<string>(() =>
    getCurrentDefenseVersion(),
  );
  const [internetThreats, setInternetThreats] = useState<InternetThreatItem[]>(
    () => CURATED_INTERNET_THREAT_FEEDS,
  );
  const [selectedFeedFilter, setSelectedFeedFilter] = useState<string>("All Feeds");
  const [threatSearchQuery, setThreatSearchQuery] = useState("");
  const [isSyncingInternetIntel, setIsSyncingInternetIntel] = useState(false);
  const [activeBulletinModal, setActiveBulletinModal] =
    useState<DefenseSystemUpdateBulletin | null>(null);
  const [copiedBulletinId, setCopiedBulletinId] = useState<string | null>(null);

  // Custom Payload / Log Learning Analyzer
  const [rawPayloadInput, setRawPayloadInput] = useState("");
  const [targetEndpointInput, setTargetEndpointInput] = useState("/api/v1/checkout");
  const [isAnalyzingPayload, setIsAnalyzingPayload] = useState(false);
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);

  // Key Vault Config
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState("");

  const keyStatus = useMemo(() => getMaskedBrainKeyStatus(), [config]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (activeNav.toLowerCase().includes("defense")) {
      setActiveTab("intel_updates");
    }
  }, [initialTab, activeNav]);

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

  const handleSyncInternetThreatIntelAndDeploy = async () => {
    setIsSyncingInternetIntel(true);
    try {
      const fetchedThreats = await fetchInternetThreatIntel({ forceRefresh: true });
      setInternetThreats(fetchedThreats);

      const { bulletin, newPatterns } = await applyThreatIntelToDefenseSystem({
        threatItems: fetchedThreats,
        existingThreatIndicators: threatIndicators,
        protectedServices,
        clientTenants,
      });

      setBulletins(getDefenseUpdateBulletins());
      setPatterns(getLearnedThreatPatterns());
      setCurrentDefenseVersion(bulletin.version);
      await onEnforceGlobalAutoBlock(newPatterns.length);

      showToast(
        `Defense System updated to ${bulletin.version}! ${bulletin.threatsHarvestedCount} internet threats harvested, +${bulletin.wafSignaturesAddedCount} WAF block rules added.`,
        "success",
      );
    } catch {
      showToast("Internet threat intel sync failed. Retrying with local feed snapshot.", "error");
    } finally {
      setIsSyncingInternetIntel(false);
    }
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

  const handleCopyBulletin = (bulletin: DefenseSystemUpdateBulletin) => {
    const md = formatBulletinMarkdown(bulletin);
    void navigator.clipboard.writeText(md);
    setCopiedBulletinId(bulletin.id);
    showToast(`Defense System Update ${bulletin.version} bulletin copied to clipboard`, "info");
    setTimeout(() => setCopiedBulletinId(null), 2500);
  };

  const handleDownloadBulletin = (bulletin: DefenseSystemUpdateBulletin) => {
    const md = formatBulletinMarkdown(bulletin);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-defense-update-${bulletin.version}.md`;
    a.click();
    showToast(`Downloaded release report for ${bulletin.version}`, "success");
  };

  const filteredThreats = useMemo(() => {
    const q = threatSearchQuery.trim().toLowerCase();
    return internetThreats.filter((item) => {
      const matchFeed = selectedFeedFilter === "All Feeds" || item.sourceFeed === selectedFeedFilter;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.cveId && item.cveId.toLowerCase().includes(q)) ||
        item.adversary.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.iocs.some((ioc) => ioc.toLowerCase().includes(q));
      return matchFeed && matchQuery;
    });
  }, [internetThreats, selectedFeedFilter, threatSearchQuery]);

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
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300 font-bold">
                Defense Mesh: <strong>{currentDefenseVersion}</strong>
              </span>
              <span className="rounded-full border border-[#262626] bg-black px-2.5 py-0.5 text-[11px] font-mono text-zinc-300">
                Model: <strong className="text-primary">{config.model}</strong>
              </span>
              <span className="rounded-full border border-[#262626] bg-black px-2.5 py-0.5 text-[11px] font-mono text-zinc-400">
                Vault Key: <code className="text-emerald-400">{keyStatus.maskedKey}</code>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Brain className="size-7 text-primary shrink-0" />
              <span>SparrowX Autonomous AI Brain & Threat Intel Blocker</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Continuously harvests live threat intelligence from internet feeds (CISA KEV, AbuseIPDB,
              OWASP GenAI RedTeam), synthesizes proactive edge block rules into our defense system,
              and publishes transparent update bulletins to all customer workspaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleSyncInternetThreatIntelAndDeploy()}
              disabled={isSyncingInternetIntel}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Globe className={`size-4 ${isSyncingInternetIntel ? "animate-spin" : ""}`} />
              <span>
                {isSyncingInternetIntel
                  ? "Harvesting & Updating..."
                  : "Sync Threat Intel & Update Defenses"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleRunNeuralHarvestAndAutoBlock()}
              disabled={isHarvesting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`size-4 ${isHarvesting ? "animate-spin" : ""}`} />
              <span>{isHarvesting ? "Analyzing..." : "Learn Dashboard Telemetry"}</span>
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
              <span>Defense System Version</span>
              <Globe className="size-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-emerald-400 font-mono">
              {currentDefenseVersion}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Live Intel Sync · {bulletins.length} bulletins published
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Internet Threat Feeds</span>
              <ShieldAlert className="size-4 text-primary" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-white font-mono">
              {internetThreats.length}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              CISA KEV, AbuseIPDB, OWASP GenAI
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Future Attacks Auto-Blocked</span>
              <ShieldCheck className="size-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-white font-mono">
              {totalPreventedHits.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Pre-emptively dropped by defense rules
            </div>
          </div>

          <div className="rounded-xl border border-[#1F1F1F] bg-black/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Inoculation Posture</span>
              <Lock className="size-4 text-primary" />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {config.autoBlockFutureThreats ? "Auto-Block Enforced" : "Advisory Mode"}
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
              Enforced on {clientTenants.length} customer workspaces
            </div>
          </div>
        </div>
      </section>

      {/* 3 HIGH-LEVEL NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1F1F1F] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("intel_updates")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "intel_updates"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
              : "border border-[#262626] bg-[#0A0A0A] text-zinc-400 hover:text-white"
          }`}
        >
          <Globe className="size-4 text-emerald-300" />
          <span>Internet Threat Intel & Defense Updates</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-200 font-extrabold animate-pulse">
            {currentDefenseVersion} · LIVE
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("copilot")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "copilot"
              ? "bg-primary text-white shadow-lg shadow-primary/25"
              : "border border-[#262626] bg-[#0A0A0A] text-zinc-400 hover:text-white"
          }`}
        >
          <Bot className="size-4" />
          <span>Gemini Security Copilot & Payload Learner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memory_ledger")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "memory_ledger"
              ? "bg-primary text-white shadow-lg shadow-primary/25"
              : "border border-[#262626] bg-[#0A0A0A] text-zinc-400 hover:text-white"
          }`}
        >
          <Cpu className="size-4" />
          <span>Adaptive Threat Memory Ledger</span>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary font-bold">
            {patterns.length}
          </span>
        </button>
      </div>

      {/* TAB 1: INTERNET THREAT INTEL & DEFENSE UPDATES (CORE FEATURE) */}
      {activeTab === "intel_updates" && (
        <div className="space-y-6">
          {/* Defense Update Live Status Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-black to-[#0A0A0A] p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Autonomous Defense System Ingest Active
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  Global Threat Intelligence Feeds Synchronized & Deployed
                </h2>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  SparrowX AI Brain continuously scans CISA Known Exploited Vulnerabilities, NIST NVD,
                  AbuseIPDB C2 botnets, and OWASP GenAI RedTeam repositories. New threats are
                  quarantined and converted into edge block rules, virtual CVE patches, and prompt
                  guardrails in real-time.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleSyncInternetThreatIntelAndDeploy()}
                  disabled={isSyncingInternetIntel}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isSyncingInternetIntel ? "animate-spin" : ""}`} />
                  <span>
                    {isSyncingInternetIntel
                      ? "Fetching Threat Intel & Updating..."
                      : "Collect Internet Threat Intel Now"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* MAIN SPLIT: LEFT = HARVESTED THREAT FEEDS | RIGHT = DEFENSE BULLETINS & RELEASE NOTES */}
          <div className="grid gap-6 xl:grid-cols-12 items-start">
            {/* Left 7 Cols: Harvested Internet Threat Intelligence Stream */}
            <div className="xl:col-span-7 space-y-4">
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F1F1F] pb-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="size-4 text-emerald-400" />
                      <span>
                        Harvested Internet Threats ({filteredThreats.length} Active Feeds)
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Threats collected from global feeds, automatically added to our blocking system.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="size-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                      <input
                        type="text"
                        value={threatSearchQuery}
                        onChange={(e) => setThreatSearchQuery(e.target.value)}
                        placeholder="Search CVE, IP, adversary..."
                        className="h-8 w-44 rounded-lg border border-[#262626] bg-black pl-8 pr-3 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "All Feeds",
                    "CISA KEV Catalog",
                    "NIST NVD",
                    "AbuseIPDB Global C2",
                    "OWASP GenAI RedTeam",
                    "Feodo Botnet Tracker",
                  ].map((feedName) => (
                    <button
                      key={feedName}
                      type="button"
                      onClick={() => setSelectedFeedFilter(feedName)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                        selectedFeedFilter === feedName
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "border border-[#262626] bg-black text-zinc-400 hover:text-white"
                      }`}
                    >
                      {feedName}
                    </button>
                  ))}
                </div>

                {/* Threat Items Stream */}
                <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                  {filteredThreats.map((threat) => (
                    <div
                      key={threat.id}
                      className="rounded-xl border border-[#1F1F1F] bg-black p-4 space-y-2.5 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                            {threat.sourceFeed}
                          </span>
                          {threat.cveId && (
                            <span className="rounded bg-primary/20 border border-primary/30 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                              {threat.cveId}
                            </span>
                          )}
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                              threat.severity === "Critical"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : threat.severity === "High"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            }`}
                          >
                            {threat.severity}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {threat.mitreTechnique}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                          <ShieldCheck className="size-3" />
                          QUARANTINED & BLOCKED
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                          <span>{threat.title}</span>
                        </h4>
                        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                          {threat.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 font-mono">
                        <span>
                          Adversary: <strong className="text-zinc-200">{threat.adversary}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Target Scope: <strong className="text-primary">{threat.targetScope}</strong>
                        </span>
                      </div>

                      {/* Extracted IOCs */}
                      <div className="rounded-lg border border-[#1F1F1F] bg-[#080808] p-2.5 space-y-1.5 font-mono text-[11px]">
                        <div className="text-[10px] uppercase font-bold text-zinc-400">
                          Extracted IOCs & Blocking Signatures:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {threat.iocs.map((ioc) => (
                            <span
                              key={ioc}
                              className="rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-[10px] text-emerald-300"
                            >
                              {ioc}
                            </span>
                          ))}
                        </div>
                        <div className="pt-1 border-t border-[#1F1F1F] flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="truncate max-w-[420px] text-zinc-300">
                            Rule: {threat.wafRuleTemplate || threat.cloudflareExpression}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyRule(
                                threat.id,
                                `${threat.wafRuleTemplate}\n# Cloudflare: ${threat.cloudflareExpression}\n# UFW: ${threat.ufwRule}`,
                              )
                            }
                            className="text-primary hover:underline cursor-pointer shrink-0"
                          >
                            {copiedRuleId === threat.id ? "Copied" : "Copy Block Rule"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Defense System Update Bulletins & User Reports */}
            <div className="xl:col-span-5 space-y-4">
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <span>Defense System Update Bulletins ({bulletins.length})</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Transparent release notes dispatched to users when defenses are updated.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                  {bulletins.map((bulletin, idx) => (
                    <div
                      key={bulletin.id}
                      className="rounded-xl border border-[#1F1F1F] bg-black p-4 space-y-3 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                            {bulletin.version}
                          </span>
                          {idx === 0 && (
                            <span className="rounded bg-primary/20 border border-primary/40 px-1.5 py-0.2 text-[9px] font-mono text-primary font-bold">
                              LATEST RELEASE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {bulletin.timestamp}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-white">{bulletin.title}</h4>
                        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                          {bulletin.summary}
                        </p>
                      </div>

                      {/* Defense Metrics Pills */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="rounded bg-[#080808] border border-[#1F1F1F] p-2 text-zinc-300">
                          <span className="text-zinc-500 block">Harvested Feeds</span>
                          <strong className="text-emerald-400 text-xs">
                            +{bulletin.threatsHarvestedCount}
                          </strong>{" "}
                          Threat Sources
                        </div>
                        <div className="rounded bg-[#080808] border border-[#1F1F1F] p-2 text-zinc-300">
                          <span className="text-zinc-500 block">WAF Edge Signatures</span>
                          <strong className="text-primary text-xs">
                            +{bulletin.wafSignaturesAddedCount}
                          </strong>{" "}
                          Deployed Rules
                        </div>
                        <div className="rounded bg-[#080808] border border-[#1F1F1F] p-2 text-zinc-300">
                          <span className="text-zinc-500 block">Perimeter Quarantine</span>
                          <strong className="text-red-400 text-xs">
                            +{bulletin.iocsBlockedCount}
                          </strong>{" "}
                          Blocked C2 IPs
                        </div>
                        <div className="rounded bg-[#080808] border border-[#1F1F1F] p-2 text-zinc-300">
                          <span className="text-zinc-500 block">Virtual CVE Patches</span>
                          <strong className="text-cyan-400 text-xs">
                            +{bulletin.virtualPatchesDeployedCount}
                          </strong>{" "}
                          Active Shields
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F1F1F]">
                        <button
                          type="button"
                          onClick={() => handleCopyBulletin(bulletin)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#262626] bg-[#0A0A0A] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          {copiedBulletinId === bulletin.id ? (
                            <>
                              <Check className="size-3 text-emerald-400" />
                              <span>Copied Markdown</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy Bulletin</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadBulletin(bulletin)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#262626] bg-[#0A0A0A] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          <Download className="size-3" />
                          <span>Download Report</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveBulletinModal(bulletin)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/30 cursor-pointer"
                        >
                          <ExternalLink className="size-3" />
                          <span>Inspect Report</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE GEMINI SECURITY COPILOT & PAYLOAD LEARNER */}
      {activeTab === "copilot" && (
        <div className="grid gap-6 xl:grid-cols-12 items-start">
          {/* Left 6 Cols: Interactive Gemini AI Brain Copilot & Custom Threat Learner */}
          <div className="xl:col-span-6 space-y-6">
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

          {/* Right 6 Cols: Quick Summary of Adaptive Rules */}
          <div className="xl:col-span-6 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span>Adaptive Threat Memory Ledger ({patterns.length} Active Signatures)</span>
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Every pattern below was learned from your dashboards and is actively blocking repeat
                  adversary waves.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 max-h-[680px] overflow-y-auto pr-1">
              {patterns.slice(0, 10).map((pat) => (
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
                        Target: <strong className="text-white">{pat.targetScope}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyRule(
                            pat.id,
                            `${pat.wafBlockRule}\n# Cloudflare: ${pat.cloudflareExpression}\n# UFW: ${pat.ufwRule}`,
                          )
                        }
                        className="text-primary hover:underline cursor-pointer"
                      >
                        {copiedRuleId === pat.id ? "Copied" : "Copy Rule"}
                      </button>
                    </div>
                    <div className="truncate text-emerald-300">{pat.wafBlockRule}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADAPTIVE THREAT MEMORY LEDGER (FULL EXPANDED VIEW) */}
      {activeTab === "memory_ledger" && (
        <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3.5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="size-5 text-primary" />
                <span>Complete Adaptive Threat Memory Ledger ({patterns.length} Signatures)</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Full immutable ledger of threat vectors learned by the AI Brain, actively shielding
                Cloudflare, Linux UFW, Edge WAF, and AI Prompt Sandboxes.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {patterns.map((pat) => (
              <div
                key={pat.id}
                className="rounded-xl border border-[#1F1F1F] bg-black p-4 space-y-3 hover:border-primary/50 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/20 border border-primary/40 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                      {pat.id}
                    </span>
                    <span className="rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      {pat.sourceDashboard}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {pat.mitreTechnique}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {pat.status} ({pat.preventedFutureHits} blocked)
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">{pat.vectorName}</h3>
                  <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                    {pat.predictiveAnalysis}
                  </p>
                </div>

                <div className="rounded-lg border border-[#1F1F1F] bg-[#070707] p-3 font-mono text-[11px] text-zinc-300 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-[#1F1F1F] pb-1">
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
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {copiedRuleId === pat.id ? "Copied" : "Copy All Rules"}
                    </button>
                  </div>
                  <div className="text-emerald-300">WAF: {pat.wafBlockRule}</div>
                  <div className="text-zinc-400">Cloudflare: {pat.cloudflareExpression}</div>
                  <div className="text-amber-300/80">UFW: {pat.ufwRule}</div>
                  <div className="text-cyan-300/80">AI Policy: {pat.aiShieldPolicy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INSPECT REPORT MODAL */}
      {activeBulletinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-primary/50 bg-[#0A0A0A] p-6 text-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3">
              <div className="flex items-center gap-2.5">
                <Globe className="size-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {activeBulletinModal.title} ({activeBulletinModal.version})
                  </h3>
                  <div className="text-xs text-zinc-400">
                    Release ID: {activeBulletinModal.id} · Timestamp:{" "}
                    {activeBulletinModal.timestamp}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveBulletinModal(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-zinc-300 leading-relaxed">
              <strong className="text-white block mb-1">Executive Summary:</strong>
              {activeBulletinModal.summary}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Threats Harvested from Internet Feeds:
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeBulletinModal.threatItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#1F1F1F] bg-black p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{item.title}</span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {item.sourceFeed}
                      </span>
                    </div>
                    <div className="text-zinc-400 text-[11px]">{item.description}</div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      Target: {item.targetScope} · IOCs: {item.iocs.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1F1F1F]">
              <button
                type="button"
                onClick={() => handleCopyBulletin(activeBulletinModal)}
                className="rounded-xl border border-[#262626] bg-black px-4 py-2 text-xs font-bold text-white hover:border-zinc-500 cursor-pointer"
              >
                Copy Markdown
              </button>
              <button
                type="button"
                onClick={() => handleDownloadBulletin(activeBulletinModal)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-95 cursor-pointer"
              >
                Download Release Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating Neural Brain Bar & Quick Drawer visible across ALL dashboards
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
  const currentDefenseVersion = useMemo(() => getCurrentDefenseVersion(), [isOpen, isAutoBlocking]);

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
          <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 font-bold">
            {currentDefenseVersion}
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
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 font-bold">
                    {currentDefenseVersion}
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
              <strong className="text-white">{patterns.length}</strong> active block rules ·{" "}
              <strong className="text-amber-400">{digest.unblockedIocsCount}</strong> unblocked IOCs
            </div>
            <button
              type="button"
              onClick={() => void handleQuickAutoBlock()}
              disabled={isAutoBlocking}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-95 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Zap className="size-3" />
              <span>{isAutoBlocking ? "Blocking..." : "Auto-Block"}</span>
            </button>
          </div>

          {/* Quick tactical chips */}
          <div className="flex flex-wrap gap-1">
            {[
              "Synthesize block rules for open incidents",
              "What zero-days from internet feeds threaten us?",
              "Generate AI prompt injection guardrails",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => void handleQuickAsk(undefined, preset)}
                className="rounded-md border border-[#262626] bg-black px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white hover:border-primary/50 cursor-pointer text-left"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Quick Answer Area */}
          {isQuerying && (
            <div className="rounded-xl border border-primary/30 bg-black p-3 text-xs text-zinc-300 flex items-center gap-2">
              <RefreshCw className="size-3.5 text-primary animate-spin" />
              <span>Gemini Brain is querying telemetry & threat memory...</span>
            </div>
          )}

          {quickAnswer && (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-[#1F1F1F] bg-black p-3 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {quickAnswer}
            </div>
          )}

          {/* Quick Input */}
          <form onSubmit={handleQuickAsk} className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Ask AI Brain anything about your security..."
              className="h-8 flex-1 rounded-lg border border-[#262626] bg-black px-2.5 text-xs text-white outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={isQuerying || !quickPrompt.trim()}
              className="rounded-lg bg-primary px-3 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
