import React, { useState, useMemo } from "react";
import {
  Bell,
  X,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Siren,
  Globe2,
  LockKeyhole,
  CheckCircle2,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Incident,
  type ThreatIndicator,
  type Vulnerability,
  type AuditLogEntry,
} from "@/lib/supabase";

export interface SecurityNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: "Critical" | "High" | "Medium" | "Info";
  category: "Incident" | "Threat" | "Vulnerability" | "Audit";
  read: boolean;
  targetNav?: string;
  targetId?: string;
}

export function NotificationCenterDrawer({
  isOpen,
  onClose,
  incidents,
  threats,
  vulnerabilities,
  auditLogs,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  threats: ThreatIndicator[];
  vulnerabilities: Vulnerability[];
  auditLogs: AuditLogEntry[];
  onNavigate: (nav: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  // Derive real notifications from actual backend records
  const notifications: SecurityNotification[] = useMemo(() => {
    const list: SecurityNotification[] = [];

    // Critical and High Incidents
    incidents.slice(0, 8).forEach((inc) => {
      list.push({
        id: `notif-inc-${inc.id}`,
        title: `Incident ${inc.id}: ${inc.title}`,
        description: `${inc.severity} priority incident reported on ${inc.source}. Status: ${inc.status}.`,
        timestamp: inc.time || "Recent",
        severity:
          inc.severity === "Critical" ? "Critical" : inc.severity === "High" ? "High" : "Medium",
        category: "Incident",
        read: readIds.has(`notif-inc-${inc.id}`),
        targetNav: "Incidents",
        targetId: inc.id,
      });
    });

    // Threat Indicators
    threats
      .filter((t) => t.blocked)
      .slice(0, 5)
      .forEach((thr) => {
        list.push({
          id: `notif-thr-${thr.id}`,
          title: `Perimeter Block: ${thr.indicator}`,
          description: `Actor attribution: ${thr.actor}. Confidence score: ${thr.confidence}%. Region: ${thr.region}.`,
          timestamp: thr.lastSeen || "Live",
          severity:
            thr.severity === "Critical" ? "Critical" : thr.severity === "High" ? "High" : "Medium",
          category: "Threat",
          read: readIds.has(`notif-thr-${thr.id}`),
          targetNav: "Alerts & Threats",
          targetId: thr.id,
        });
      });

    // Open CVEs
    vulnerabilities
      .filter((v) => v.status === "Open")
      .slice(0, 4)
      .forEach((vuln) => {
        list.push({
          id: `notif-vuln-${vuln.id}`,
          title: `Vulnerability: ${vuln.cve} (${vuln.packageName})`,
          description: `CVSS Score ${vuln.cvss} (${vuln.severity}). Affects ${vuln.affectedHosts} registered host(s).`,
          timestamp: "Action Required",
          severity:
            vuln.severity === "Critical"
              ? "Critical"
              : vuln.severity === "High"
                ? "High"
                : "Medium",
          category: "Vulnerability",
          read: readIds.has(`notif-vuln-${vuln.id}`),
          targetNav: "Vulnerabilities",
          targetId: vuln.id,
        });
      });

    // Recent Audit Logs
    auditLogs.slice(0, 4).forEach((aud) => {
      list.push({
        id: `notif-aud-${aud.id}`,
        title: `Audit: ${aud.action}`,
        description: `Operator: ${aud.actor} (${aud.role}) targeting ${aud.target}.`,
        timestamp: aud.timestamp || "Recent",
        severity:
          aud.severity === "Critical" ? "Critical" : aud.severity === "Warning" ? "High" : "Info",
        category: "Audit",
        read: readIds.has(`notif-aud-${aud.id}`),
        targetNav: "Activity & Forensic Logs",
        targetId: aud.id,
      });
    });

    return list;
  }, [incidents, threats, vulnerabilities, auditLogs, readIds]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread") return !n.read;
      if (filter === "critical") return n.severity === "Critical";
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  const markOneRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-title"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Bell className="size-4" />
            </span>
            <div>
              <h2 id="notification-center-title" className="text-sm font-semibold text-foreground">
                Security Operations Notifications
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                {unreadCount} unread operational alert(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                title="Mark all notifications as read"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Close notification center"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/30 px-4 py-2 text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
            <SlidersHorizontal className="size-3" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filter === "all"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filter === "unread"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("critical")}
            className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filter === "critical"
                ? "bg-destructive text-destructive-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Critical ({notifications.filter((n) => n.severity === "Critical").length})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const isCrit = item.severity === "Critical";
              const isHigh = item.severity === "High";
              return (
                <div
                  key={item.id}
                  className={`group relative p-3.5 text-xs transition-colors hover:bg-secondary/40 ${
                    !item.read ? "bg-primary/[0.04]" : ""
                  }`}
                  onClick={() => markOneRead(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          isCrit
                            ? "bg-destructive ring-2 ring-destructive/20"
                            : isHigh
                              ? "bg-warning ring-2 ring-warning/20"
                              : "bg-primary ring-2 ring-primary/20"
                        }`}
                      />
                      <span className="font-semibold text-foreground tracking-tight">
                        {item.title}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {item.timestamp}
                    </span>
                  </div>

                  <p className="mt-1.5 text-muted-foreground leading-relaxed pl-4">
                    {item.description}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pl-4 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                        isCrit
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : isHigh
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-primary/30 bg-primary/10 text-primary"
                      }`}
                    >
                      {isCrit ? (
                        <ShieldAlert className="size-2.5" />
                      ) : isHigh ? (
                        <AlertTriangle className="size-2.5" />
                      ) : (
                        <CheckCircle2 className="size-2.5" />
                      )}
                      {item.severity} · {item.category}
                    </span>

                    {item.targetNav && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markOneRead(item.id);
                          onNavigate(item.targetNav!);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <span>Investigate</span>
                        <ExternalLink className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto size-8 text-success/60 mb-2" />
              <p className="text-xs font-medium text-foreground">All clear</p>
              <p className="text-[11px] mt-0.5">No notifications matching the selected filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card p-3 text-center text-[11px] text-muted-foreground font-mono">
          SparrowX Cloud Operational Alert Telemetry Stream
        </div>
      </div>
    </div>
  );
}
