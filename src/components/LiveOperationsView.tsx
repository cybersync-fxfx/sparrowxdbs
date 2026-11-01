import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Globe2,
  Layers3,
  LockKeyhole,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Incident,
  type ThreatIndicator,
  type Asset,
  type ProtectedService,
  type TeamMember,
  type AuditLogEntry,
  supabaseUrl,
  getSupabaseHeaders,
} from "@/lib/supabase";

export function LiveOperationsView({
  incidents,
  threats,
  assets,
  protectedServices,
  teamMembers,
  auditLogs,
  onResolveIncident,
  onToggleAssetIsolation,
  onNavigate,
  showToast,
}: {
  incidents: Incident[];
  threats: ThreatIndicator[];
  assets: Asset[];
  protectedServices: ProtectedService[];
  teamMembers: TeamMember[];
  auditLogs: AuditLogEntry[];
  onResolveIncident: (id: string) => Promise<void>;
  onToggleAssetIsolation: (id: string) => Promise<void>;
  onNavigate: (nav: string) => void;
  showToast: (msg: string) => void;
}) {
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Measure true network roundtrip to SparrowX Cloud Telemetry Engine
  const checkLiveLatency = async () => {
    setIsPinging(true);
    const t0 = performance.now();
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/incidents?select=id&limit=1`,
        {
          headers: getSupabaseHeaders(),
        },
      );
      if (res.ok) {
        const ms = Math.round(performance.now() - t0);
        setLiveLatency(ms);
      } else {
        setLiveLatency(null);
      }
    } catch {
      setLiveLatency(null);
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    void checkLiveLatency();
    const interval = setInterval(() => void checkLiveLatency(), 15000);
    return () => clearInterval(interval);
  }, []);

  const openIncidents = incidents.filter((i) => i.status !== "Contained");
  const onDutyOfficers = teamMembers.filter((m) => m.onCall);
  const blockedThreats = threats.filter((t) => t.blocked);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-primary tracking-wider">
            <Radio className="size-4 animate-pulse" />
            Live Security Operations Command
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
            Live Operational Monitoring
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Real-time operational status, perimeter threat drops, active on-duty personnel, and
            direct latency telemetry to the SparrowX Sovereign Cloud Engine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono">
            <span
              className={`size-2 rounded-full ${
                liveLatency === null
                  ? "bg-destructive"
                  : liveLatency < 80
                    ? "bg-success"
                    : liveLatency < 200
                      ? "bg-warning"
                      : "bg-destructive"
              }`}
            />
            <span className="text-muted-foreground">Cloud API Ping:</span>
            {liveLatency !== null ? (
              <span className="font-bold text-foreground">{liveLatency}ms</span>
            ) : (
              <span className="font-semibold text-destructive">Offline</span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={isPinging}
            onClick={() => void checkLiveLatency()}
            className="h-8 px-2.5 text-xs gap-1"
          >
            <RefreshCw className={`size-3.5 ${isPinging ? "animate-spin" : ""}`} />
            <span>Ping</span>
          </Button>
        </div>
      </section>

      {/* 4 Status Gauge Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Open Incident Queue</span>
            <Siren className="size-4 text-destructive" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">
            {openIncidents.length}
          </div>
          <span className="mt-1 block text-[11px] font-medium text-destructive">
            {incidents.filter((i) => i.severity === "Critical" && i.status !== "Contained").length}{" "}
            Critical priority
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>On-Duty Responders</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">
            {onDutyOfficers.length} / {teamMembers.length}
          </div>
          <span className="mt-1 block text-[11px] text-success font-medium">
            Shift coverage active
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Blocked Threats at Edge</span>
            <Globe2 className="size-4 text-info" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">
            {blockedThreats.length}
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground font-mono">
            Edge WAF filter enforced
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Monitored Endpoints</span>
            <Server className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">
            {protectedServices.length + assets.length}
          </div>
          <span className="mt-1 block text-[11px] text-success font-medium">
            {assets.filter((a) => a.status === "Protected").length} Protected ·{" "}
            {assets.filter((a) => a.status === "Isolated").length} Isolated
          </span>
        </div>
      </section>

      {/* 2-Column Operational Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Real-time Incident Triage Stream */}
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Siren className="size-4 text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">
                Active Incident Response Feed
              </h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate("Incidents")}
              className="h-7 text-xs text-primary"
            >
              All Incidents →
            </Button>
          </div>

          <div className="divide-y divide-border">
            {openIncidents.length > 0 ? (
              openIncidents.slice(0, 5).map((inc) => (
                <div
                  key={inc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4 text-xs hover:bg-secondary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{inc.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                          inc.severity === "Critical"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>{inc.id}</span>
                      <span>·</span>
                      <span>Source: {inc.source}</span>
                      <span>·</span>
                      <span>Assignee: {inc.assignee}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onResolveIncident(inc.id)}
                    className="h-7 px-2.5 text-[11px] gap-1 self-start sm:self-auto shrink-0"
                  >
                    <CheckCircle2 className="size-3 text-success" /> Contain
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto size-6 text-success mb-2" />
                No uncontained incidents. All perimeter signals nominal.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Infrastructure Hosts & Network Isolation */}
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Infrastructure Host Status & Isolation
              </h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate("Sites & Locations")}
              className="h-7 text-xs text-primary"
            >
              All Assets →
            </Button>
          </div>

          <div className="divide-y divide-border">
            {assets.slice(0, 5).map((asset) => {
              const isIsolated = asset.status === "Isolated";
              return (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4 text-xs hover:bg-secondary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{asset.hostname}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                          isIsolated
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-success/30 bg-success/10 text-success"
                        }`}
                      >
                        {asset.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>IP: {asset.ip}</span>
                      <span>·</span>
                      <span>Env: {asset.environment}</span>
                      <span>·</span>
                      <span>Risk Score: {asset.riskScore}/100</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isIsolated ? "default" : "outline"}
                    onClick={() => void onToggleAssetIsolation(asset.id)}
                    className="h-7 px-2.5 text-[11px] gap-1 self-start sm:self-auto shrink-0"
                  >
                    <LockKeyhole className="size-3" />
                    <span>{isIsolated ? "Reconnect" : "Isolate"}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Telemetry & Audit Stream */}
      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Live Immutable Audit Telemetry Stream
            </h2>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {auditLogs.length} Events Synced
          </span>
        </div>

        <div className="divide-y divide-border/60 max-h-60 overflow-y-auto">
          {auditLogs.slice(0, 10).map((aud) => (
            <div
              key={aud.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-mono hover:bg-secondary/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground shrink-0">{aud.timestamp}</span>
                <span className="text-primary font-semibold shrink-0">[{aud.actor}]</span>
                <span className="text-foreground truncate">{aud.action}</span>
              </div>
              <span className="text-muted-foreground shrink-0">{aud.target}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
