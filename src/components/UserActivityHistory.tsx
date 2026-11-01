import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getUserActivityHistory,
  subscribeToActivityHistory,
  type UserOperationRecord,
  type OperationStatus,
} from "@/lib/activity-history";

interface UserActivityHistoryProps {
  onNavigateToDocs?: (code: string, refId?: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

export function UserActivityHistory({ onNavigateToDocs, showToast }: UserActivityHistoryProps) {
  const [history, setHistory] = useState<UserOperationRecord[]>(getUserActivityHistory);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OperationStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    setHistory(getUserActivityHistory());
    const unsub = subscribeToActivityHistory((newRecord) => {
      setHistory((prev) => [newRecord, ...prev]);
    });
    return unsub;
  }, []);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.affectedResource.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        (item.errorReferenceId && item.errorReferenceId.toLowerCase().includes(q));
      return matchStatus && matchCategory && matchQuery;
    });
  }, [history, search, statusFilter, categoryFilter]);

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Time",
      "Category",
      "Title",
      "Affected Resource",
      "Status",
      "Details",
      "Error Ref",
    ];
    const rows = filteredHistory.map((item) => [
      item.id,
      item.timestamp,
      item.category,
      item.title,
      item.affectedResource,
      item.status,
      item.details.replace(/"/g, '""'),
      item.errorReferenceId || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-activity-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported user operation history to CSV", "success");
  };

  const statusIcons: Record<OperationStatus, React.ReactNode> = {
    successful: <CheckCircle2 className="size-4 text-emerald-400" />,
    failed: <AlertTriangle className="size-4 text-red-400" />,
    pending: <Loader2 className="size-4 text-amber-400 animate-spin" />,
    cancelled: <XCircle className="size-4 text-muted-foreground" />,
    retried: <RefreshCw className="size-4 text-blue-400" />,
  };

  const statusColors: Record<OperationStatus, string> = {
    successful: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    cancelled: "bg-white/10 text-muted-foreground border-white/10",
    retried: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };

  return (
    <div className="space-y-6 text-foreground font-sans animate-in fade-in-50 duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold uppercase tracking-wide">
              TRANSPARENCY RECORD
            </span>
            <span className="text-xs text-muted-foreground font-mono">Zero Guesswork</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 text-white">
            Activity & Operation History
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Transparent record of what SparrowX has actually done: successful actions, pending jobs,
            recoverable failures, and error reference IDs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHistory(getUserActivityHistory())}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="size-3" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportCsv}
            className="h-8 text-xs font-semibold gap-1.5 border border-white/10"
          >
            <Download className="size-3 text-primary" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search operations, affected resource, error ID..."
            className="w-full rounded-xl border border-white/15 bg-black/60 pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-muted-foreground/70 outline-none focus:border-primary"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {(["all", "successful", "failed", "pending", "retried"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg font-medium capitalize transition-all ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-black/40 text-muted-foreground hover:text-white border border-white/[0.08]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline List */}
      <div className="rounded-2xl border border-white/10 bg-card/70 p-5 sm:p-6 backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-white/10 pb-3">
          <span>Operations Stream ({filteredHistory.length})</span>
          <span>Logged In Real Time</span>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs space-y-1">
            <Clock className="size-8 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-white">No activity records match your filter.</p>
            <p>Every important user action is recorded here as it runs.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-white/[0.08] bg-black/40 hover:border-white/20 transition-all space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusIcons[item.status]}
                    <span className="font-semibold text-sm text-white/95">{item.title}</span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold ${
                        statusColors[item.status]
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    {item.latencyMs !== undefined && (
                      <span className="text-emerald-400">({item.latencyMs}ms)</span>
                    )}
                    <span>{item.timestamp}</span>
                  </div>
                </div>

                <p className="text-xs text-white/80 leading-relaxed">{item.details}</p>

                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      Target: <strong className="text-white">{item.affectedResource}</strong>
                    </span>
                    <span className="text-[11px]">•</span>
                    <span className="text-[11px]">{item.category}</span>
                  </div>

                  {item.errorReferenceId && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-red-400">
                        Ref: {item.errorReferenceId}
                      </span>
                      {onNavigateToDocs && item.errorCode && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocs(item.errorCode!, item.errorReferenceId)}
                          className="inline-flex items-center gap-1 font-semibold text-xs text-primary hover:underline"
                        >
                          <span>Troubleshoot & Fix</span>
                          <ArrowRight className="size-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
