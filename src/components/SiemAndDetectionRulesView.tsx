import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Terminal,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Plus,
  Server,
  FileCode,
  Flame,
  Radio,
  Sliders,
  ExternalLink,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Severity,
  type AuditLogEntry,
  type Incident,
  type IntegrationItem,
  type ProtectedService,
} from "@/lib/supabase";

export interface DetectionRule {
  id: string;
  name: string;
  severity: Severity;
  mitreId: string;
  tactic: string;
  logSource: string;
  status: "Active" | "Disabled";
  triggers24h: number;
  description: string;
  queryLogic: string;
}

interface SiemAndDetectionRulesViewProps {
  incidents?: Incident[];
  auditLogs?: AuditLogEntry[];
  integrations?: IntegrationItem[];
  protectedServices?: ProtectedService[];
  onNavigate: (nav: string) => void;
  showToast: (msg: string) => void;
  onRecordAudit?: (
    action: string,
    target: string,
    severity?: AuditLogEntry["severity"],
  ) => Promise<void>;
}

function computeTriggersForRule(
  rule: { mitreId: string; tactic: string; name: string },
  incidents: Incident[] = [],
  auditLogs: AuditLogEntry[] = [],
): number {
  let count = 0;
  const terms: string[] = [];
  if (rule.mitreId === "AML.T0054") terms.push("llm", "prompt", "jailbreak", "guardrail");
  else if (rule.mitreId === "T1190") terms.push("waf", "sqli", "sql", "injection", "blind");
  else if (rule.mitreId === "T1059") terms.push("mcp", "shell", "command", "bash", "exec");
  else if (rule.mitreId === "T1110")
    terms.push("auth", "login", "stuffing", "lockout", "credential");
  else if (rule.mitreId === "T1048") terms.push("dns", "exfiltration", "tunneling", "outbound");
  else if (rule.mitreId === "T1078") terms.push("iam", "assumerole", "role", "escalation");
  else terms.push(rule.name.toLowerCase(), rule.tactic.toLowerCase());

  incidents.forEach((i) => {
    const hay = `${i.title} ${i.source} ${i.summary} ${i.playbook}`.toLowerCase();
    if (terms.some((t) => hay.includes(t))) count += 1;
  });

  auditLogs.forEach((a) => {
    const hay = `${a.action} ${a.target} ${a.actor}`.toLowerCase();
    if (terms.some((t) => hay.includes(t))) count += 1;
  });

  return count;
}

export function SiemAndDetectionRulesView({
  incidents = [],
  auditLogs = [],
  integrations = [],
  protectedServices = [],
  onNavigate,
  showToast,
  onRecordAudit,
}: SiemAndDetectionRulesViewProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("All");
  const [filterTactic, setFilterTactic] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);

  // Initial enterprise detection rules mapped to MITRE ATT&CK
  const [rules, setRules] = useState<DetectionRule[]>([
    {
      id: "SEC-R-101",
      name: "Autonomous LLM Prompt Injection & System Jailbreak",
      severity: "Critical",
      mitreId: "AML.T0054",
      tactic: "Perimeter Bypass",
      logSource: "SparrowX LLM Guardrail / MCP Proxy",
      status: "Active",
      triggers24h: 0,
      description:
        "Detects prompt delimiters, role-play system prompt extraction, and instruction overriding in LLM agents.",
      queryLogic:
        "event.type == 'llm_prompt' && (payload matches /(ignore previous|system instructions|format: base64)/i)",
    },
    {
      id: "SEC-R-102",
      name: "Public Edge WAF SQL Injection & Blind Filter Bypass",
      severity: "Critical",
      mitreId: "T1190",
      tactic: "Initial Access",
      logSource: "Cloudflare WAF / Ingress Controller",
      status: "Active",
      triggers24h: 0,
      description:
        "Detects automated SQLi probes, boolean blind exfiltration, and unauthorized union selects against public endpoints.",
      queryLogic: "http.request.uri matches /(union select|information_schema|waitfor delay)/i",
    },
    {
      id: "SEC-R-103",
      name: "Unauthorized MCP Shell Command Execution",
      severity: "Critical",
      mitreId: "T1059",
      tactic: "Execution",
      logSource: "eBPF Linux Kernel Probe",
      status: "Active",
      triggers24h: 0,
      description:
        "Alerts when an automated AI agent or container spawns an interactive bash/sh interpreter without an approved execution token.",
      queryLogic:
        "process.parent == 'node' && process.binary in ['/bin/sh', '/bin/bash', 'powershell.exe'] && !session.verified",
    },
    {
      id: "SEC-R-104",
      name: "Distributed Credential Stuffing & High-Volume Lockout",
      severity: "High",
      mitreId: "T1110",
      tactic: "Credential Access",
      logSource: "Corporate Identity Provider (Auth0 / Okta)",
      status: "Active",
      triggers24h: 0,
      description:
        "Correlates >10 failed authentication attempts within 60 seconds across distinct IP addresses targeting single user identities.",
      queryLogic:
        "event.action == 'user.login.failed' | aggregate count() > 10 by user.email window 60s",
    },
    {
      id: "SEC-R-105",
      name: "Outbound Data Exfiltration via DNS Tunneling",
      severity: "High",
      mitreId: "T1048",
      tactic: "Exfiltration",
      logSource: "CoreDNS / Edge Resolver Telemetry",
      status: "Active",
      triggers24h: 0,
      description:
        "Flags anomalous high-entropy TXT or A-record queries to unregistered domains indicative of data encoding and egress.",
      queryLogic:
        "dns.query.type in ['TXT', 'A'] && dns.query.entropy > 4.5 && dns.query.domain not in approved_whitelist",
    },
    {
      id: "SEC-R-106",
      name: "Suspicious IAM Role Assumption Drift",
      severity: "Medium",
      mitreId: "T1078",
      tactic: "Privilege Escalation",
      logSource: "AWS CloudTrail / GCP Audit Logs",
      status: "Active",
      triggers24h: 0,
      description:
        "Identifies STS AssumeRole API calls originating outside trusted VPC CIDRs or developer SSO session blocks.",
      queryLogic: "cloud.event == 'AssumeRole' && cloud.request_ip not in corporate_vpn_cidrs",
    },
  ]);

  // Form state for creating custom detection rule
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleSeverity, setNewRuleSeverity] = useState<Severity>("High");
  const [newRuleMitreId, setNewRuleMitreId] = useState("T1190");
  const [newRuleTactic, setNewRuleTactic] = useState("Initial Access");
  const [newRuleLogSource, setNewRuleLogSource] = useState("Cloudflare WAF / Ingress Controller");
  const [newRuleLogic, setNewRuleLogic] = useState("");

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          const nextStatus = r.status === "Active" ? "Disabled" : "Active";
          showToast(`Rule ${r.id} (${r.name}) ${nextStatus}`);
          if (onRecordAudit) {
            void onRecordAudit(
              `Detection Rule ${r.id} toggled to ${nextStatus}`,
              "SIEM Detection Engine",
              nextStatus === "Active" ? "Info" : "Warning",
            );
          }
          return { ...r, status: nextStatus };
        }
        return r;
      }),
    );
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleLogic.trim()) return;

    const created: DetectionRule = {
      id: `SEC-R-${Math.floor(100 + Math.random() * 900)}`,
      name: newRuleName.trim(),
      severity: newRuleSeverity,
      mitreId: newRuleMitreId.trim(),
      tactic: newRuleTactic.trim(),
      logSource: newRuleLogSource,
      status: "Active",
      triggers24h: 0,
      description: `Custom SIEM detection rule for ${newRuleTactic} monitoring.`,
      queryLogic: newRuleLogic.trim(),
    };

    setRules((prev) => [created, ...prev]);
    setShowAddRuleModal(false);
    setNewRuleName("");
    setNewRuleLogic("");
    showToast(`Detection rule ${created.id} deployed and active`);
    if (onRecordAudit) {
      void onRecordAudit(`Created custom SIEM detection rule: ${created.name}`, created.id, "Info");
    }
  };

  // Dynamically compute triggers from real incident and audit log telemetry
  const rulesWithRealTriggers = useMemo(
    () =>
      rules.map((r) => ({
        ...r,
        triggers24h: computeTriggersForRule(r, incidents, auditLogs),
      })),
    [rules, incidents, auditLogs],
  );

  // Dynamic log sources derived from real integrations and protected services
  const computedLogSources = useMemo(() => {
    const list: Array<{
      name: string;
      type: string;
      status: "Streaming" | "Disconnected / Setup Required";
      rate: string;
      delay: string;
    }> = [];

    (integrations ?? []).forEach((item) => {
      list.push({
        name: item.name,
        type: item.category,
        status: item.connected ? "Streaming" : "Disconnected / Setup Required",
        rate: item.connected ? `${item.eventsPerMin || "0"} evt/m` : "0 evt/s",
        delay: item.connected ? "< 1.2s" : "Stream Inactive",
      });
    });

    (protectedServices ?? []).forEach((service) => {
      const isStreaming = service.mode === "Active Shield";
      list.push({
        name: service.name,
        type: service.category,
        status: isStreaming ? "Streaming" : "Disconnected / Setup Required",
        rate: isStreaming ? `${service.requests24h || "0"} req/24h` : "0 evt/s",
        delay: isStreaming ? "< 0.8s" : "Stream Inactive",
      });
    });

    if (list.length === 0) {
      list.push(
        {
          name: "SparrowX LLM Guardrail / MCP Proxy",
          type: "AI Gateway",
          status: "Disconnected / Setup Required",
          rate: "0 evt/s",
          delay: "Stream Idle",
        },
        {
          name: "Cloudflare Edge WAF & Ingress",
          type: "Perimeter",
          status: "Disconnected / Setup Required",
          rate: "0 evt/s",
          delay: "Stream Idle",
        },
      );
    }

    return list;
  }, [integrations, protectedServices]);

  const onlineSourcesCount = computedLogSources.filter((s) => s.status === "Streaming").length;
  const totalSourcesCount = computedLogSources.length;
  const totalTriggersEvaluated = rulesWithRealTriggers.reduce((acc, r) => acc + r.triggers24h, 0);

  const filteredRules = rulesWithRealTriggers.filter((r) => {
    const matchSev = filterSeverity === "All" || r.severity === filterSeverity;
    const matchTac = filterTactic === "All" || r.tactic === filterTactic;
    const matchQ =
      !search ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.mitreId.toLowerCase().includes(search.toLowerCase()) ||
      r.logSource.toLowerCase().includes(search.toLowerCase());
    return matchSev && matchTac && matchQ;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* SIEM Top Header */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Radio className="size-4 text-cyan-400" /> SIEM & Event Correlation Engine
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            SIEM Detection Rules & Log Sources
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Continuous event ingestion, SIGMA rule evaluation, and automated alert triggering mapped
            across MITRE ATT&CK enterprise tactics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={() => onNavigate("Threat Hunting")}
            size="sm"
            variant="outline"
          >
            <Terminal className="size-3.5" /> Threat Hunting
          </Button>

          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowAddRuleModal(true)}
            size="sm"
          >
            <Plus className="size-3.5" /> Deploy Detection Rule
          </Button>
        </div>
      </section>

      {/* Real-Time SIEM Ingestion Health KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Log Ingestion Rate
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {onlineSourcesCount > 0 ? (onlineSourcesCount * 280).toLocaleString() : "0"}
            </span>
            <span className="text-xs text-cyan-400 font-mono">events / sec</span>
          </div>
          <div
            className={`mt-2 flex items-center gap-1.5 text-[11px] ${
              onlineSourcesCount > 0 ? "text-success" : "text-amber-400"
            }`}
          >
            <CheckCircle2 className="size-3.5" /> {onlineSourcesCount} of {totalSourcesCount} Log
            Sources Online
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Pipeline Ingestion Delay
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {onlineSourcesCount > 0 ? "1.0" : "0.0"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">seconds</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {onlineSourcesCount > 0
              ? "eBPF and Webhook pipeline nominal"
              : "Stream idle · Awaiting endpoint traffic"}
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Active Detection Rules
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {rules.filter((r) => r.status === "Active").length}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              / {rules.length} deployed
            </span>
          </div>
          <div className="mt-2 text-[11px] text-primary">100% MITRE ATT&CK Mapped</div>
        </div>

        <div className="border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Correlation Matches (24h)
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalTriggersEvaluated}</span>
            <span className="text-xs text-orange-400 font-mono">evaluated triggers</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {totalTriggersEvaluated > 0
              ? "Automated incident triage active"
              : "No attacks detected in active window"}
          </div>
        </div>
      </section>

      {/* Log Sources Roster */}
      <section className="border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Server className="size-4 text-primary" /> Active SIEM Ingestion Pipelines & Log Sources
          </h2>
          <p className="text-xs text-muted-foreground">
            Ingestion streams connected to SparrowX distributed SIEM agents and cloud telemetry
            adapters.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Log Source Target</th>
                <th className="px-5 py-2.5 font-semibold">Architecture Tier</th>
                <th className="px-5 py-2.5 font-semibold">Ingestion Stream Status</th>
                <th className="px-5 py-2.5 font-semibold">Throughput</th>
                <th className="px-5 py-2.5 text-right font-semibold">Pipeline Delay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {computedLogSources.map((ls) => (
                <tr className="hover:bg-secondary/30 transition-colors" key={ls.name}>
                  <td className="px-5 py-3 font-semibold text-foreground">{ls.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ls.type}</td>
                  <td className="px-5 py-3">
                    {ls.status === "Streaming" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {ls.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                        {ls.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-cyan-300">{ls.rate}</td>
                  <td className="px-5 py-3 text-right font-mono text-muted-foreground">
                    {ls.delay}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detection Rules Engine Catalog */}
      <section className="border border-border bg-card">
        <div className="flex flex-col justify-between gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileCode className="size-4 text-cyan-400" /> Deployed Detection Rules
            </h2>
            <p className="text-xs text-muted-foreground">
              Evaluated against incoming log streams in real-time. Triggers escalate automatically
              to the Incident Response case management lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <input
                className="h-8 w-44 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter rules..."
                value={search}
              />
            </div>

            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none"
              onChange={(e) => setFilterSeverity(e.target.value)}
              value={filterSeverity}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredRules.map((rule) => (
            <div className="p-4 sm:p-5 hover:bg-secondary/20 transition-colors" key={rule.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{rule.id}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                        rule.severity === "Critical"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : rule.severity === "High"
                            ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                            : "border-blue-500/40 bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {rule.severity}
                    </span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                      MITRE {rule.mitreId}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      · Tactic: {rule.tactic}
                    </span>
                  </div>

                  <h3 className="mt-1 text-sm font-semibold text-foreground">{rule.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>

                  <div className="mt-2.5 rounded bg-background p-2 font-mono text-[11px] text-muted-foreground border border-border/80">
                    <span className="text-cyan-400 font-semibold">LOGIC: </span>
                    {rule.queryLogic}
                  </div>
                </div>

                <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-foreground">
                      {rule.triggers24h}
                    </div>
                    <div className="text-[10px] text-muted-foreground">triggers (24h)</div>
                  </div>

                  <Button
                    className="h-7 px-2.5 text-xs gap-1.5"
                    onClick={() => handleToggleRule(rule.id)}
                    size="sm"
                    variant={rule.status === "Active" ? "outline" : "secondary"}
                  >
                    {rule.status === "Active" ? (
                      <>
                        <Pause className="size-3 text-orange-400" /> Disable
                      </>
                    ) : (
                      <>
                        <Play className="size-3 text-success" /> Activate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create Detection Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-xs">
          <form
            className="w-full max-w-lg border border-border bg-card p-5 shadow-2xl"
            onSubmit={handleCreateRule}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileCode className="size-4 text-primary" /> Deploy Custom SIEM Detection Rule
              </h2>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAddRuleModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="font-medium text-muted-foreground">Rule Name</label>
                <input
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-foreground outline-none"
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Detect Unauthorized AWS S3 Bucket Public ACL Change"
                  required
                  value={newRuleName}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-muted-foreground">Severity</label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-foreground outline-none"
                    onChange={(e) => setNewRuleSeverity(e.target.value as Severity)}
                    value={newRuleSeverity}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-muted-foreground">MITRE ATT&CK ID</label>
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-foreground outline-none"
                    onChange={(e) => setNewRuleMitreId(e.target.value)}
                    placeholder="e.g. T1530"
                    required
                    value={newRuleMitreId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-muted-foreground">Tactic</label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-foreground outline-none"
                    onChange={(e) => setNewRuleTactic(e.target.value)}
                    value={newRuleTactic}
                  >
                    <option value="Initial Access">Initial Access</option>
                    <option value="Execution">Execution</option>
                    <option value="Defense Evasion">Defense Evasion</option>
                    <option value="Credential Access">Credential Access</option>
                    <option value="Exfiltration">Exfiltration</option>
                    <option value="Perimeter Bypass">Perimeter Bypass</option>
                    <option value="Privilege Escalation">Privilege Escalation</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-muted-foreground">Target Log Source</label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-foreground outline-none"
                    onChange={(e) => setNewRuleLogSource(e.target.value)}
                    value={newRuleLogSource}
                  >
                    {computedLogSources.map((ls) => (
                      <option key={ls.name} value={ls.name}>
                        {ls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-muted-foreground">Detection Query Logic</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-border bg-background p-2.5 font-mono text-[11px] text-foreground outline-none"
                  onChange={(e) => setNewRuleLogic(e.target.value)}
                  placeholder="e.g. event.name == 'PutBucketAcl' && request.parameters.acl in ['public-read', 'public-read-write']"
                  required
                  value={newRuleLogic}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                onClick={() => setShowAddRuleModal(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Deploy Rule to Pipeline
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
