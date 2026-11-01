import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Eye,
  Check,
  Download,
  AlertCircle,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  computeErrorMetricSummary,
  getDiagnosticEvents,
  toggleEventResolution,
  type DiagnosticEvent,
  type ErrorMetricSummary,
} from "@/lib/diagnostics";
import { docsUrlFor } from "@/lib/error-registry";

interface AdminErrorMonitoringProps {
  onNavigateToDoc?: (code: string, refId?: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

export function AdminErrorMonitoring({ onNavigateToDoc, showToast }: AdminErrorMonitoringProps) {
  const [summary, setSummary] = useState<ErrorMetricSummary>(computeErrorMetricSummary);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unresolved" | "resolved">("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<DiagnosticEvent | null>(null);

  const refreshMetrics = () => {
    const updated = computeErrorMetricSummary();
    setSummary(updated);
    if (selectedEvent) {
      const refreshedSelected = updated.recentEvents.find(
        (e) => e.referenceId === selectedEvent.referenceId,
      );
      if (refreshedSelected) setSelectedEvent(refreshedSelected);
    }
  };

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return summary.recentEvents.filter((ev) => {
      const matchStatus =
        statusFilter === "all" || (statusFilter === "resolved" ? ev.resolved : !ev.resolved);
      const matchSeverity = severityFilter === "all" || ev.severity === severityFilter;
      const matchQuery =
        !query ||
        ev.referenceId.toLowerCase().includes(query) ||
        ev.title.toLowerCase().includes(query) ||
        ev.code.toLowerCase().includes(query) ||
        ev.module.toLowerCase().includes(query) ||
        ev.message.toLowerCase().includes(query);
      return matchStatus && matchSeverity && matchQuery;
    });
  }, [summary.recentEvents, search, statusFilter, severityFilter]);

  const handleToggleResolve = (referenceId: string) => {
    const changed = toggleEventResolution(referenceId, "Admin Operator");
    if (changed) {
      refreshMetrics();
      showToast("Incident resolution status updated", "info");
    }
  };

  const handleExportDiagnostics = () => {
    const jsonStr = JSON.stringify(summary.recentEvents, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported diagnostic incident telemetry", "success");
  };

  return (
    <div className="space-y-6 text-foreground font-sans animate-in fade-in-50 duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold uppercase tracking-wide">
              ADMIN ONLY
            </span>
            <span className="text-xs text-muted-foreground font-mono">Live Diagnostic Mesh</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 text-white">
            SOC Error Monitoring & Health Telemetry
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time tracking of application exceptions, API failures, background job health, and
            triage resolution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshMetrics}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="size-3" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportDiagnostics}
            className="h-8 text-xs font-semibold gap-1.5 border border-white/10"
          >
            <Download className="size-3 text-primary" /> Export Log
          </Button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-card/70 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Captured Errors</span>
            <Activity className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">{summary.totalErrors}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Across all client tenants</div>
        </div>

        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-red-300">
            <span>Critical Errors</span>
            <AlertTriangle className="size-4 text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-red-400">
            {summary.criticalErrors}
          </div>
          <div className="mt-1 text-[11px] text-red-300/80">High priority containment</div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span>Unresolved Incidents</span>
            <AlertCircle className="size-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {summary.unresolvedCount}
          </div>
          <div className="mt-1 text-[11px] text-amber-300/80">Awaiting triage confirmation</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Resolved Incidents</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {summary.resolvedCount}
          </div>
          <div className="mt-1 text-[11px] text-emerald-300/80">Closed by SOC operators</div>
        </div>
      </div>

      {/* 3. Top Recurring Errors & Module Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Most Frequent Errors */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-card/70 p-5 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold tracking-tight">Most Frequent Error Signatures</h3>
            <span className="text-[11px] text-muted-foreground font-mono">Top Occurrence</span>
          </div>

          <div className="space-y-2">
            {summary.topErrors.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No error occurrences recorded yet. Systems operating cleanly.
              </div>
            ) : (
              summary.topErrors.map((item) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06] bg-black/40 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="font-semibold text-white/95 truncate">{item.title}</div>
                    <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                      <span className="text-primary font-bold">{item.code}</span>
                      <span>•</span>
                      <span>{item.module}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {item.count}x
                    </span>
                    {onNavigateToDoc && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDoc(item.code)}
                        className="block text-[10px] text-muted-foreground hover:text-white underline mt-1"
                      >
                        View Doc →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Affected Modules Breakdown */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-card/70 p-5 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold tracking-tight">Affected Modules Breakdown</h3>
            <span className="text-[11px] text-muted-foreground font-mono">Distribution</span>
          </div>

          <div className="space-y-2.5">
            {summary.affectedModules.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No module failures recorded.
              </div>
            ) : (
              summary.affectedModules.map((m) => {
                const pct =
                  summary.totalErrors > 0 ? Math.round((m.count / summary.totalErrors) * 100) : 0;
                return (
                  <div key={m.module} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/90 font-medium">{m.module}</span>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {m.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Live Diagnostic Incident Log */}
      <div className="rounded-2xl border border-white/10 bg-card/70 p-5 sm:p-6 backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold tracking-tight">
              Diagnostic Event Stream ({filteredEvents.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Click any incident to inspect safe diagnostic parameters without exposing credentials.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference ID, code..."
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs text-white placeholder:text-muted-foreground outline-none focus:border-primary"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs text-white outline-none"
            >
              <option value="all">All Status</option>
              <option value="unresolved">Unresolved Only</option>
              <option value="resolved">Resolved Only</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs text-white outline-none"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground uppercase text-[10px] font-mono">
                <th className="py-2.5 px-3">Reference ID</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Error Signature</th>
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No diagnostic events match current filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr
                    key={ev.referenceId}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-primary">
                      {ev.referenceId}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {ev.timestamp}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-semibold capitalize px-2 py-0.5 rounded text-[10px] ${
                          ev.severity === "critical"
                            ? "bg-red-500/20 text-red-400"
                            : ev.severity === "high"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white/90">
                      <div>{ev.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {ev.code} ({ev.errorId})
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{ev.module}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          ev.resolved ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {ev.resolved ? (
                          <>
                            <CheckCircle2 className="size-3" /> Resolved
                          </>
                        ) : (
                          <>
                            <AlertCircle className="size-3" /> Unresolved
                          </>
                        )}
                      </span>
                    </td>
                    <td
                      className="py-2.5 px-3 text-right space-x-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleResolve(ev.referenceId)}
                        className="h-6 px-2 text-[10px]"
                      >
                        {ev.resolved ? "Reopen" : "Resolve"}
                      </Button>
                      {onNavigateToDoc && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigateToDoc(ev.code, ev.referenceId)}
                          className="h-6 px-2 text-[10px]"
                        >
                          Docs →
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Safe Diagnostic Detail Modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0f0f13] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto font-sans">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {selectedEvent.referenceId}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/90">
                    {selectedEvent.errorId}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">{selectedEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-muted-foreground hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-white/10 bg-black/40">
                <div>
                  <span className="text-muted-foreground">Recorded:</span>{" "}
                  <strong className="text-white">{selectedEvent.timestamp}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Module:</span>{" "}
                  <strong className="text-white">{selectedEvent.module}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Severity:</span>{" "}
                  <span className="capitalize font-semibold text-primary">
                    {selectedEvent.severity}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <strong
                    className={selectedEvent.resolved ? "text-emerald-400" : "text-amber-400"}
                  >
                    {selectedEvent.resolved
                      ? `Resolved by ${selectedEvent.resolvedBy || "Admin"}`
                      : "Unresolved"}
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  User-Facing Message
                </label>
                <div className="p-3 rounded-xl border border-white/10 bg-black/60 text-white font-sans mt-1">
                  {selectedEvent.userFacingMessage}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Recommended Action / Next Step
                </label>
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-200 mt-1">
                  {selectedEvent.nextStep}
                </div>
              </div>

              {selectedEvent.context && (
                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center justify-between">
                    <span>Safe Diagnostic Context (Sanitized)</span>
                    <span className="text-primary font-mono text-[9px] flex items-center gap-1">
                      <Lock className="size-2.5" /> SECRETS REDACTED
                    </span>
                  </label>
                  <pre className="p-3 rounded-xl border border-white/10 bg-black/70 text-[11px] font-mono text-emerald-300 overflow-x-auto mt-1 max-h-40">
                    {JSON.stringify(selectedEvent.context, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.userReport && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-amber-400">
                    <span>User Problem Report Attached</span>
                  </div>
                  <div className="mt-1 text-xs">{selectedEvent.userReport.description}</div>
                  <div className="mt-1 text-[10px] text-amber-400 font-mono">
                    From: {selectedEvent.userReport.userEmail || "Anonymous"} at{" "}
                    {selectedEvent.userReport.submittedAt}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleResolve(selectedEvent.referenceId)}
              >
                {selectedEvent.resolved ? "Reopen Incident" : "Mark as Resolved"}
              </Button>

              <div className="flex items-center gap-2">
                {onNavigateToDoc && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onNavigateToDoc(selectedEvent.code, selectedEvent.referenceId);
                      setSelectedEvent(null);
                    }}
                  >
                    Open Troubleshooting Article →
                  </Button>
                )}
                <Button size="sm" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
