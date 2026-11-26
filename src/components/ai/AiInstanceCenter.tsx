import React, { useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Square,
  Terminal,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiInstanceRecord } from "@/lib/ai/contracts";
import { AiCopyButton } from "./AiCopyButton";

type ControlTab = "metrics" | "logs" | "terminal" | "vault" | "networking" | "backups";

const CONTROL_TABS: Array<{ id: ControlTab; label: string; icon: React.ReactNode }> = [
  { id: "metrics", label: "Metrics", icon: <Activity className="size-3.5" aria-hidden="true" /> },
  { id: "logs", label: "Live Logs", icon: <Search className="size-3.5" aria-hidden="true" /> },
  { id: "terminal", label: "Web Terminal", icon: <Terminal className="size-3.5" aria-hidden="true" /> },
  { id: "vault", label: "Env Vault", icon: <KeyRound className="size-3.5" aria-hidden="true" /> },
  { id: "networking", label: "Networking & Domains", icon: <Globe className="size-3.5" aria-hidden="true" /> },
  { id: "backups", label: "Backups", icon: <HardDrive className="size-3.5" aria-hidden="true" /> },
];

interface AiInstanceCenterProps {
  instance: AiInstanceRecord;
  userEmail: string;
  onBack: () => void;
  onUpdated: (next: AiInstanceRecord) => void;
}

export function AiInstanceCenter({
  instance,
  userEmail,
  onBack,
  onUpdated,
}: AiInstanceCenterProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>("metrics");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Logs state
  const [logQuery, setLogQuery] = useState("");
  const [logLevel, setLogLevel] = useState<"ALL" | "INFO" | "WARN" | "ERROR" | "SYSTEM">("ALL");
  const [logsPaused, setLogsPaused] = useState(false);

  // Terminal state
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState<Array<{ cmd: string; out: string }>>([
    {
      cmd: "uname -a && tc-limits",
      out: `Linux ${instance.containerId} 6.8.12-4-pve x86_64 GNU/Linux\nProxmox Node: ${instance.proxmoxNode} (VMID ${instance.proxmoxVmid}) • Port Cap: ${instance.portMbps} Mbps • Outbound SMTP TCP/25 DROPPED`,
    },
  ]);

  // Env vault state
  const [revealedMap, setRevealedMap] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  // Custom domain & proxy config state
  const [customHostname, setCustomHostname] = useState("");
  const [proxyFormat, setProxyFormat] = useState<"nginx" | "caddy">("nginx");

  const tabIdPrefix = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const dispatchAction = async (payload: Record<string, unknown>, label: string) => {
    setBusyAction(label);
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/instances", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-sparrowx-user-email": userEmail,
        },
        body: JSON.stringify({ instanceId: instance.id, ...payload }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        instance?: AiInstanceRecord;
        revealedSecret?: { key: string; value: string };
        terminalOutput?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.instance) {
        throw new Error(json.error || "Action failed");
      }
      onUpdated(json.instance);
      if (json.revealedSecret) {
        setRevealedMap((prev) => ({
          ...prev,
          [json.revealedSecret!.key]: json.revealedSecret!.value,
        }));
      }
      if (typeof json.terminalOutput === "string") {
        setTermHistory((prev) => [
          ...prev,
          { cmd: String(payload.command || ""), out: json.terminalOutput! },
        ]);
      } else {
        setFeedback(`${label} completed.`);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  };

  const filteredLogs = useMemo(() => {
    return instance.logs.filter((line) => {
      if (logLevel !== "ALL" && line.level !== logLevel) return false;
      if (logQuery.trim() && !line.message.toLowerCase().includes(logQuery.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [instance.logs, logLevel, logQuery]);

  const downloadLogs = () => {
    const content = filteredLogs
      .map((l) => `[${l.ts}] [${l.level}] [${l.source}] ${l.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${instance.subdomain}-logs.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = CONTROL_TABS.findIndex((t) => t.id === activeTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % CONTROL_TABS.length;
      setActiveTab(CONTROL_TABS[next]!.id);
      tabRefs.current[next]?.focus();
      tabRefs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + CONTROL_TABS.length) % CONTROL_TABS.length;
      setActiveTab(CONTROL_TABS[prev]!.id);
      tabRefs.current[prev]?.focus();
      tabRefs.current[prev]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const statusColor =
    instance.status === "live"
      ? "border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]"
      : instance.status === "paused" || instance.status === "stopped"
        ? "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#F59E0B]"
        : "border-[#38BDF8]/35 bg-[#38BDF8]/10 text-[#38BDF8]";

  const latestMetric = instance.metrics[instance.metrics.length - 1];

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>All Deployments</span>
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-white truncate">
                {instance.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase ${statusColor}`}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {instance.status}
              </span>
              <span className="rounded border border-white/[0.08] bg-[#05060A] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                {instance.vcpu} vCPU • {instance.ramGb} GB ECC • {instance.portMbps} Mbps Cap
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <a
                href={instance.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#38BDF8] hover:underline truncate"
              >
                {instance.publicUrl}
              </a>
              <AiCopyButton
                value={instance.publicUrl}
                ariaLabel={`Copy public URL ${instance.publicUrl}`}
              />
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500">
                Node {instance.proxmoxNode} (VMID {instance.proxmoxVmid})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {instance.status !== "live" ? (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void dispatchAction({ action: "start" }, "Start")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#10B981]/35 bg-[#10B981]/10 hover:bg-[#10B981]/20 px-3 py-1.5 text-xs font-medium text-[#10B981] cursor-pointer disabled:opacity-50"
              >
                <Play className="size-3.5" aria-hidden="true" />
                <span>Start</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void dispatchAction({ action: "stop" }, "Stop")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#05060A] hover:bg-[#10131C] px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-50"
              >
                <Square className="size-3.5 text-[#F59E0B]" aria-hidden="true" />
                <span>Stop</span>
              </button>
            )}
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void dispatchAction({ action: "restart" }, "Restart")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#05060A] hover:bg-[#10131C] px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>Restart</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void dispatchAction({ action: "rebuild" }, "Rebuild")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#05060A] hover:bg-[#10131C] px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-50"
            >
              <Wrench className="size-3.5" aria-hidden="true" />
              <span>Rebuild</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void dispatchAction({ action: "snapshot" }, "Create Snapshot")}
              className="spx-silver-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#05060A] cursor-pointer disabled:opacity-50"
            >
              <Camera className="size-3.5" aria-hidden="true" />
              <span>Create Snapshot</span>
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            role="status"
            className="rounded-md border border-white/10 bg-[#05060A] px-3 py-2 text-xs font-mono text-zinc-200"
          >
            {feedback}
          </div>
        ) : null}
      </div>

      {/* Accessible Single-Row Scrollable Tablist (modern-web-guidance `tabs`) */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] overflow-hidden">
        <div
          role="tablist"
          aria-label="Instance management views"
          onKeyDown={handleTabKeyDown}
          className="flex overflow-x-auto border-b border-white/[0.08] bg-[#05060A]/60 px-2 scroll-smooth"
        >
          {CONTROL_TABS.map((tab, i) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`${tabIdPrefix}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className="spx-ai-tab flex-none inline-flex items-center gap-2 px-4 py-3 text-xs font-medium text-zinc-400 hover:text-zinc-200 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* METRICS TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-metrics`}
          hidden={activeTab !== "metrics"}
        >
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "CPU Utilization",
                  value: `${latestMetric?.cpuPct ?? 14}%`,
                  sub: `${instance.vcpu} vCPU cgroup ceiling`,
                  color: "#38BDF8",
                },
                {
                  label: "ECC Memory",
                  value: `${latestMetric?.ramMb ?? 1024} MB`,
                  sub: `of ${instance.ramGb * 1024} MB allocated`,
                  color: "#10B981",
                },
                {
                  label: "Disk I/O",
                  value: `${latestMetric?.diskIoMb ?? 2.4} MB/s`,
                  sub: `${instance.ssdGb} GB ZFS NVMe`,
                  color: "#F59E0B",
                },
                {
                  label: "Monthly Transfer",
                  value: `${instance.transferUsedGb} GB`,
                  sub: `of ${instance.transferQuotaGb} GB (${instance.portMbps} Mbps cap)`,
                  color: "#B8C2D1",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4"
                >
                  <div className="text-[11px] font-mono text-zinc-500">{m.label}</div>
                  <div className="mt-1 text-xl font-mono font-semibold text-white">{m.value}</div>
                  <div className="mt-1 text-[11px] font-mono text-zinc-400">{m.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4">
                <div className="flex items-center justify-between mb-3 text-xs font-mono">
                  <span className="text-zinc-300">CPU % &amp; Memory MB (30s cAdvisor rollup)</span>
                  <span className="text-[#38BDF8]">Live Stream</span>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={instance.metrics}>
                      <XAxis dataKey="ts" stroke="#52525B" fontSize={10} />
                      <YAxis stroke="#52525B" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#090B11",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontSize: "11px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cpuPct"
                        name="CPU %"
                        stroke="#38BDF8"
                        fill="#38BDF8"
                        fillOpacity={0.14}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4">
                <div className="flex items-center justify-between mb-3 text-xs font-mono">
                  <span className="text-zinc-300">Network Rx / Tx Mbps (Mumbai Tunnel)</span>
                  <span className="text-[#10B981]">tc cap: {instance.portMbps} Mbps</span>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={instance.metrics}>
                      <XAxis dataKey="ts" stroke="#52525B" fontSize={10} />
                      <YAxis stroke="#52525B" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#090B11",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontSize: "11px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="netTxMbps"
                        name="Tx Mbps"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.14}
                      />
                      <Area
                        type="monotone"
                        dataKey="netRxMbps"
                        name="Rx Mbps"
                        stroke="#B8C2D1"
                        fill="#B8C2D1"
                        fillOpacity={0.1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIVE LOGS TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-logs`}
          hidden={activeTab !== "logs"}
        >
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="Filter container & WAF logs..."
                  aria-label="Filter container logs"
                  className="rounded-lg border border-white/12 bg-[#05060A] px-3 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                />
                {(["ALL", "INFO", "WARN", "ERROR", "SYSTEM"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLogLevel(lvl)}
                    className={`rounded border px-2 py-1 text-[11px] font-mono cursor-pointer ${
                      logLevel === lvl
                        ? "border-white/25 bg-[#10131C] text-white"
                        : "border-white/[0.08] bg-[#05060A] text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLogsPaused((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#05060A] px-2.5 py-1.5 text-xs font-mono text-zinc-300 cursor-pointer"
                >
                  {logsPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  <span>{logsPaused ? "Resume" : "Pause"}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadLogs}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#05060A] px-2.5 py-1.5 text-xs font-mono text-zinc-300 cursor-pointer"
                >
                  <Download className="size-3" aria-hidden="true" />
                  <span>Download .log</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1.5">
              {filteredLogs.map((l) => (
                <div key={l.id} className="flex gap-2.5 leading-relaxed">
                  <span className="shrink-0 text-zinc-600">{l.ts.slice(11, 19)}</span>
                  <span
                    className={`shrink-0 w-14 ${
                      l.level === "ERROR"
                        ? "text-[#EF4444]"
                        : l.level === "WARN"
                          ? "text-[#F59E0B]"
                          : l.level === "SYSTEM"
                            ? "text-[#38BDF8]"
                            : "text-[#10B981]"
                    }`}
                  >
                    [{l.level}]
                  </span>
                  <span className="text-zinc-500 shrink-0">[{l.source}]</span>
                  <span className="text-zinc-200 break-all">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WEB TERMINAL TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-terminal`}
          hidden={activeTab !== "terminal"}
        >
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-zinc-400">
                Authenticated WebSocket Shell • <span className="text-zinc-200">{instance.containerId}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {["ps aux", "free -m", "df -h", "tc-limits", "curl-health", "env"].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() =>
                      void dispatchAction({ action: "terminal_exec", command: quick }, quick)
                    }
                    className="rounded border border-white/10 bg-[#05060A] hover:bg-[#10131C] px-2 py-1 text-[11px] text-zinc-300 cursor-pointer"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 font-mono text-xs space-y-3 min-h-[260px] max-h-80 overflow-y-auto">
              {termHistory.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-[#38BDF8]">
                    spx@{instance.subdomain}:~$ <span className="text-white">{item.cmd}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">{item.out}</pre>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = termInput.trim();
                if (!clean) return;
                if (clean === "clear") {
                  setTermHistory([]);
                  setTermInput("");
                  return;
                }
                setTermInput("");
                void dispatchAction({ action: "terminal_exec", command: clean }, clean);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                placeholder="Type container command (help, ps aux, free -m, tc-limits)..."
                aria-label="Container terminal command"
                className="flex-1 rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                className="spx-silver-btn rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                Run
              </button>
            </form>
          </div>
        </div>

        {/* ENV VAULT TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-vault`}
          hidden={activeTab !== "vault"}
        >
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-400">
                Secrets are encrypted with <span className="font-mono text-zinc-200">AES-256-GCM</span> at rest and injected strictly in-memory on container start.
              </div>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#05060A]">
              {instance.envSecrets.map((sec) => {
                const revealed = revealedMap[sec.key];
                return (
                  <div
                    key={sec.key}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs font-mono"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold">{sec.key}</div>
                      <div className="text-zinc-400 break-all mt-0.5">
                        {revealed ?? sec.maskedValue}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#10131C] border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-400">
                        {sec.algorithm}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (revealed) {
                            setRevealedMap((prev) => {
                              const next = { ...prev };
                              delete next[sec.key];
                              return next;
                            });
                          } else {
                            void dispatchAction({ action: "reveal_env", key: sec.key }, `Reveal ${sec.key}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#090B11] px-2.5 py-1 text-[11px] text-zinc-200 cursor-pointer"
                      >
                        {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        <span>{revealed ? "Hide" : "Reveal"}</span>
                      </button>
                      {revealed ? (
                        <AiCopyButton value={revealed} ariaLabel={`Copy value of ${sec.key}`} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newEnvKey.trim() || !newEnvVal.trim()) return;
                void dispatchAction(
                  {
                    action: "upsert_env",
                    envVars: [{ key: newEnvKey.trim(), value: newEnvVal.trim(), isSecret: true }],
                    redeploy: true,
                  },
                  "Encrypt & Redeploy",
                );
                setNewEnvKey("");
                setNewEnvVal("");
              }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2"
            >
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="NEW_SECRET_KEY"
                aria-label="New environment secret key"
                className="sm:col-span-4 rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white"
              />
              <input
                type="password"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="Secret value (AES-256-GCM)"
                aria-label="New environment secret value"
                className="sm:col-span-5 rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white"
              />
              <button
                type="submit"
                className="sm:col-span-3 spx-silver-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Encrypt &amp; Redeploy</span>
              </button>
            </form>
          </div>
        </div>

        {/* NETWORKING & DOMAINS TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-networking`}
          hidden={activeTab !== "networking"}
        >
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#05060A] p-4">
              <div className="flex items-center gap-3">
                <Shield className="size-4 text-[#10B981]" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    sec.sparrowx.net Webhook Firewall &amp; L7 DDoS Protection
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    WebSocket Upgrade: Active • HTTP/2: Enabled • Outbound SMTP TCP/25: Blocked
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void dispatchAction(
                    { action: "toggle_waf", enabled: !instance.webhookWafEnabled },
                    "Toggle Webhook WAF",
                  )
                }
                className={`rounded-md border px-3 py-1.5 text-xs font-mono cursor-pointer ${
                  instance.webhookWafEnabled
                    ? "border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]"
                    : "border-white/12 bg-[#090B11] text-zinc-400"
                }`}
              >
                {instance.webhookWafEnabled ? "WAF ACTIVE" : "WAF BYPASSED"}
              </button>
            </div>

            <div className="space-y-2">
              {instance.domains.map((dom) => (
                <div
                  key={dom.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#05060A] px-4 py-3 text-xs font-mono"
                >
                  <div>
                    <div className="text-white font-semibold">{dom.hostname}</div>
                    <div className="text-zinc-500 mt-0.5">
                      CNAME → <span className="text-zinc-300">{dom.cnameTarget}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#10B981]/10 border border-[#10B981]/25 px-2 py-0.5 text-[10px] text-[#10B981]">
                      SSL: {dom.sslStatus}
                    </span>
                    <span className="rounded bg-[#38BDF8]/10 border border-[#38BDF8]/25 px-2 py-0.5 text-[10px] text-[#38BDF8]">
                      WSS OK
                    </span>
                    <AiCopyButton value={dom.cnameTarget} label="Copy CNAME" ariaLabel="Copy CNAME target" />
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!customHostname.trim()) return;
                void dispatchAction(
                  { action: "add_domain", hostname: customHostname.trim().toLowerCase() },
                  "Attach Custom Domain",
                );
                setCustomHostname("");
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={customHostname}
                onChange={(e) => setCustomHostname(e.target.value)}
                placeholder="agent.yourstartup.in"
                aria-label="Custom domain hostname"
                className="flex-1 rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white"
              />
              <button
                type="submit"
                className="spx-silver-btn rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                Attach Domain + Auto-SSL
              </button>
            </form>

            {/* Generated Dynamic Nginx / Caddy Config Preview */}
            <div className="rounded-lg border border-white/[0.08] bg-[#05060A] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setProxyFormat("nginx")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      proxyFormat === "nginx" ? "bg-[#10131C] text-white" : "text-zinc-500"
                    }`}
                  >
                    Nginx Dynamic Route
                  </button>
                  <button
                    type="button"
                    onClick={() => setProxyFormat("caddy")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      proxyFormat === "caddy" ? "bg-[#10131C] text-white" : "text-zinc-500"
                    }`}
                  >
                    Caddy v2 Auto-SSL
                  </button>
                </div>
                <AiCopyButton
                  value={proxyFormat === "nginx" ? instance.nginxConfig : instance.caddyConfig}
                  label="Copy Config"
                  ariaLabel="Copy generated reverse proxy config"
                />
              </div>
              <pre className="p-4 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                {proxyFormat === "nginx" ? instance.nginxConfig : instance.caddyConfig}
              </pre>
            </div>
          </div>
        </div>

        {/* BACKUPS TAB */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-backups`}
          hidden={activeTab !== "backups"}
        >
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-400">
                Automated daily ZFS NVMe snapshots at 03:00 IST with 7-day retention + 1-click point-in-time restore.
              </div>
              <button
                type="button"
                onClick={() => void dispatchAction({ action: "snapshot" }, "Create Snapshot")}
                className="spx-silver-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#05060A] cursor-pointer"
              >
                <Camera className="size-3.5" aria-hidden="true" />
                <span>Take Snapshot Now</span>
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#05060A]">
              {instance.snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-4 text-[#10B981]" aria-hidden="true" />
                    <div>
                      <div className="text-white font-semibold">{snap.label}</div>
                      <div className="text-zinc-500 mt-0.5">
                        {snap.createdAt.slice(0, 16).replace("T", " ")} UTC • {snap.sizeMb} MB • {snap.type}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void dispatchAction(
                        { action: "restore_snapshot", snapshotId: snap.id },
                        `Restore ${snap.label}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-[#090B11] hover:bg-[#10131C] px-3 py-1.5 text-xs text-zinc-200 cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    <span>1-Click Restore</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
