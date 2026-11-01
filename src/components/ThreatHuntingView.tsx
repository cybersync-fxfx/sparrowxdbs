import React, { useState, useMemo } from "react";
import {
  Search,
  Crosshair,
  Filter,
  ShieldAlert,
  Globe2,
  Server,
  Layers,
  Terminal,
  Clock,
  ArrowRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileSearch,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Incident,
  type ThreatIndicator,
  type Asset,
  type Vulnerability,
  type ProtectedService,
  type AuditLogEntry,
  type Severity,
} from "@/lib/supabase";

interface ThreatHuntingViewProps {
  incidents: Incident[];
  threats: ThreatIndicator[];
  assets: Asset[];
  vulnerabilities: Vulnerability[];
  protectedServices: ProtectedService[];
  auditLogs: AuditLogEntry[];
  onNavigate: (nav: string) => void;
  showToast: (msg: string) => void;
  onCreateIncidentFromHunt?: (title: string, source: string, severity: Severity) => void;
}

export function ThreatHuntingView({
  incidents,
  threats,
  assets,
  vulnerabilities,
  protectedServices,
  auditLogs,
  onNavigate,
  showToast,
  onCreateIncidentFromHunt,
}: ThreatHuntingViewProps) {
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [selectedTactic, setSelectedTactic] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // MITRE ATT&CK Tactics
  const mitreTactics = [
    {
      id: "T1190",
      name: "Exploit Public-Facing App",
      tactic: "Initial Access",
      color: "text-red-400",
    },
    {
      id: "AML.T0054",
      name: "LLM Prompt Injection",
      tactic: "Perimeter Bypass",
      color: "text-purple-400",
    },
    {
      id: "T1059",
      name: "Command and Scripting Interpreter",
      tactic: "Execution",
      color: "text-orange-400",
    },
    {
      id: "T1110",
      name: "Brute Force & Credential Stuffing",
      tactic: "Credential Access",
      color: "text-yellow-400",
    },
    {
      id: "T1071",
      name: "Application Layer Protocol (C2)",
      tactic: "Command & Control",
      color: "text-cyan-400",
    },
    {
      id: "T1048",
      name: "Exfiltration Over Alternative Protocol",
      tactic: "Exfiltration",
      color: "text-emerald-400",
    },
  ];

  // Quick Hunt presets
  const quickHunts = [
    { label: "LLM Prompt Injections", query: "prompt" },
    { label: "Active C2 Indicators", query: "actor" },
    { label: "Isolated Hosts", query: "Isolated" },
    { label: "Critical CVEs (>8.0)", query: "Critical" },
    { label: "Production Assets", query: "Production" },
  ];

  // Correlate real telemetry records into huntable events
  const huntCorrelatedEvents = useMemo(() => {
    const events: Array<{
      id: string;
      timestamp: string;
      type: "Incident" | "Threat Feed" | "Host Asset" | "Vulnerability" | "Audit Log";
      title: string;
      source: string;
      severity: Severity;
      mitreTactic: string;
      mitreId: string;
      details: string;
      rawObject: unknown;
    }> = [];

    // Map Incidents
    incidents.forEach((inc) => {
      let tactic = "Exploit Public-Facing App";
      let tacticId = "T1190";
      const txt = (inc.title + " " + inc.summary).toLowerCase();
      if (txt.includes("prompt") || txt.includes("jailbreak") || txt.includes("injection")) {
        tactic = "LLM Prompt Injection";
        tacticId = "AML.T0054";
      } else if (txt.includes("tool") || txt.includes("command") || txt.includes("shell")) {
        tactic = "Command and Scripting Interpreter";
        tacticId = "T1059";
      } else if (txt.includes("auth") || txt.includes("credential") || txt.includes("token")) {
        tactic = "Brute Force & Credential Stuffing";
        tacticId = "T1110";
      } else if (txt.includes("c2") || txt.includes("beacon") || txt.includes("dns")) {
        tactic = "Application Layer Protocol (C2)";
        tacticId = "T1071";
      }

      events.push({
        id: inc.id,
        timestamp: inc.time,
        type: "Incident",
        title: inc.title,
        source: inc.source,
        severity: inc.severity,
        mitreTactic: tactic,
        mitreId: tacticId,
        details: inc.summary,
        rawObject: inc,
      });
    });

    // Map Threat Indicators
    threats.forEach((ioc) => {
      events.push({
        id: ioc.id,
        timestamp: ioc.lastSeen,
        type: "Threat Feed",
        title: `IOC: ${ioc.indicator} (${ioc.type})`,
        source: `${ioc.actor} · ${ioc.region}`,
        severity: ioc.severity,
        mitreTactic: "Application Layer Protocol (C2)",
        mitreId: "T1071",
        details: `Confidence ${ioc.confidence}% · ${ioc.blocked ? "Actively Blocked" : "Monitored"}`,
        rawObject: ioc,
      });
    });

    // Map Vulnerabilities
    vulnerabilities.forEach((vuln) => {
      events.push({
        id: vuln.id,
        timestamp: "Active CVE",
        type: "Vulnerability",
        title: `${vuln.cve} in ${vuln.packageName}`,
        source: `CVSS ${vuln.cvss}`,
        severity: vuln.severity,
        mitreTactic: "Exploit Public-Facing App",
        mitreId: "T1190",
        details: `Fix: ${vuln.fixVersion || "Under review"} · Status: ${vuln.status} (${vuln.affectedHosts} host(s) affected)`,
        rawObject: vuln,
      });
    });

    // Map Critical Assets
    assets
      .filter((a) => a.status === "Isolated" || a.riskScore > 50)
      .forEach((asset) => {
        events.push({
          id: asset.id,
          timestamp: asset.lastCheckin,
          type: "Host Asset",
          title: `Asset Risk Alert: ${asset.hostname}`,
          source: `${asset.ip} · ${asset.environment}`,
          severity: asset.riskScore > 75 ? "Critical" : "High",
          mitreTactic: "Command and Scripting Interpreter",
          mitreId: "T1059",
          details: `Type: ${asset.type} · Status: ${asset.status} · Owner: ${asset.owner}`,
          rawObject: asset,
        });
      });

    // Filter by query and tactic
    return events.filter((ev) => {
      const matchTactic =
        selectedTactic === "All" ||
        ev.mitreId === selectedTactic ||
        ev.mitreTactic === selectedTactic;
      const q = query.trim().toLowerCase();
      if (!q) return matchTactic;

      const matchText =
        ev.id.toLowerCase().includes(q) ||
        ev.title.toLowerCase().includes(q) ||
        ev.source.toLowerCase().includes(q) ||
        ev.details.toLowerCase().includes(q) ||
        ev.mitreId.toLowerCase().includes(q) ||
        ev.type.toLowerCase().includes(q);

      return matchTactic && matchText;
    });
  }, [incidents, threats, assets, vulnerabilities, query, selectedTactic]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Copied ${id} to clipboard`);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Workspace Header */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Crosshair className="size-4 text-cyan-400" />
            Threat Hunting & Telemetry Correlation
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Autonomous Threat Hunting Workspace
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Correlate raw telemetry, live IOC indicators, CVEs, and host infrastructure across MITRE
            ATT&CK tactics with zero simulated records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none"
            onChange={(e) => setTimeRange(e.target.value as "1h" | "24h" | "7d" | "30d")}
            value={timeRange}
          >
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setQuery("");
              setSelectedTactic("All");
              showToast("Hunting query reset to global feed");
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-3.5" /> Reset
          </Button>
        </div>
      </section>

      {/* Query Search Bar & Presets */}
      <section className="border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              aria-label="Query hunting telemetry"
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-4 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. prompt, T1190, actor:APT29, Production, Critical, k8s-prod..."
              value={query}
            />
            {query && (
              <button
                className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tactic:</span>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
              onChange={(e) => setSelectedTactic(e.target.value)}
              value={selectedTactic}
            >
              <option value="All">All MITRE Tactics</option>
              {mitreTactics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Hunt Presets */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Quick Hunts:</span>
          {quickHunts.map((qh) => (
            <button
              className={`rounded-sm border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                query === qh.query
                  ? "border-primary bg-primary/20 text-primary-foreground font-semibold"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              key={qh.label}
              onClick={() => setQuery(qh.query)}
              type="button"
            >
              {qh.label}
            </button>
          ))}
        </div>
      </section>

      {/* MITRE ATT&CK Matrix Tactical Banner */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {mitreTactics.map((t) => {
          const matchCount = huntCorrelatedEvents.filter((ev) => ev.mitreId === t.id).length;
          const isSelected = selectedTactic === t.id;
          return (
            <button
              className={`flex flex-col justify-between rounded-md border p-3 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-primary/50"
              }`}
              key={t.id}
              onClick={() => setSelectedTactic(isSelected ? "All" : t.id)}
              type="button"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  {t.tactic}
                </span>
                <div className="mt-0.5 text-xs font-semibold text-foreground leading-snug line-clamp-2">
                  {t.name}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-[11px] font-mono font-bold ${t.color}`}>{t.id}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    matchCount > 0
                      ? "bg-destructive/20 text-destructive font-bold"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {matchCount}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Correlated Event Telemetry Table */}
      <section className="border border-border bg-card">
        <div className="flex flex-col justify-between gap-2 border-b border-border px-5 py-3.5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Terminal className="size-4 text-cyan-400" /> Correlated Threat Telemetry Stream
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                {huntCorrelatedEvents.length} events correlated
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Live events extracted from backend incidents, active threat feeds, vulnerable
              packages, and host risk telemetry.
            </p>
          </div>
        </div>

        {huntCorrelatedEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Event ID & Type</th>
                  <th className="px-4 py-2.5 font-semibold">Detection & Indicators</th>
                  <th className="px-4 py-2.5 font-semibold">Telemetry Source</th>
                  <th className="px-4 py-2.5 font-semibold">MITRE Technique</th>
                  <th className="px-4 py-2.5 font-semibold">Severity</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Forensic Pivot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {huntCorrelatedEvents.map((ev) => (
                  <tr className="hover:bg-secondary/30 transition-colors" key={ev.id}>
                    <td className="px-4 py-3 align-top font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        {ev.id}
                        <button
                          aria-label="Copy event ID"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(ev.id, ev.id)}
                        >
                          {copiedId === ev.id ? (
                            <CheckCircle2 className="size-3 text-success" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">{ev.type}</span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-foreground">{ev.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                        {ev.details}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">
                      <div>{ev.source}</div>
                      <div className="text-[10px] text-muted-foreground/70">{ev.timestamp}</div>
                    </td>

                    <td className="px-4 py-3 align-top font-mono">
                      <div className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-cyan-300 font-semibold">
                        {ev.mitreId}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground truncate max-w-[140px]">
                        {ev.mitreTactic}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                          ev.severity === "Critical"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : ev.severity === "High"
                              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                              : "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {ev.severity}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top text-right">
                      {ev.type === "Incident" ? (
                        <Button
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onNavigate("Incidents")}
                          size="sm"
                          variant="ghost"
                        >
                          View Case <ArrowRight className="size-3" />
                        </Button>
                      ) : ev.type === "Threat Feed" ? (
                        <Button
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onNavigate("Threat intel")}
                          size="sm"
                          variant="ghost"
                        >
                          Inspect IOC <ArrowRight className="size-3" />
                        </Button>
                      ) : (
                        <Button
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            if (onCreateIncidentFromHunt) {
                              onCreateIncidentFromHunt(
                                `[Threat Hunt Pivot] Investigation of ${ev.title}`,
                                ev.source,
                                ev.severity,
                              );
                            } else {
                              onNavigate("Incidents");
                            }
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Pivot to Incident
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-xs text-muted-foreground">
            <Search className="mx-auto size-8 text-muted-foreground/40 mb-2" />
            <div className="font-semibold text-foreground">No correlated threat records found</div>
            <p className="mt-1 max-w-sm mx-auto">
              Your query didn't match any active incidents, threat indicators, CVEs, or high-risk
              host telemetry. Try clearing query filters or adjusting the time window.
            </p>
            <Button
              className="mt-4 h-8"
              onClick={() => {
                setQuery("");
                setSelectedTactic("All");
              }}
              size="sm"
              variant="outline"
            >
              Reset Hunt Filters
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
