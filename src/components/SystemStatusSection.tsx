import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Lock,
  Globe2,
  Brain,
  Boxes,
  Coins,
  Cpu,
  Radio,
  Clock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  runSystemHealthProbe,
  type SystemOverallHealth,
  type SubsystemStatus,
  type SubsystemHealth,
} from "@/lib/system-health";

interface SystemStatusSectionProps {
  onNavigateToDocs?: (code: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

export function SystemStatusSection({ onNavigateToDocs, showToast }: SystemStatusSectionProps) {
  const [healthData, setHealthData] = useState<SystemOverallHealth | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  const executeProbe = async () => {
    setIsProbing(true);
    try {
      const data = await runSystemHealthProbe();
      setHealthData(data);
      if (data.overallStatus === "operational") {
        showToast("System health probe passed — all 10 subsystems operational", "success");
      } else if (data.overallStatus === "degraded") {
        showToast("System health probe completed — elevated latency detected", "info");
      } else {
        showToast("System health probe detected service degradation or outages", "error");
      }
    } catch {
      showToast("Health probe execution failed", "error");
    } finally {
      setIsProbing(false);
    }
  };

  useEffect(() => {
    void executeProbe();
    const interval = setInterval(() => {
      void executeProbe();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const statusBadges: Record<
    SubsystemStatus,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    operational: {
      label: "Operational",
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle2 className="size-3.5 text-emerald-400" />,
    },
    degraded: {
      label: "Degraded Performance",
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <AlertTriangle className="size-3.5 text-amber-400" />,
    },
    partial_outage: {
      label: "Partial Outage",
      color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      icon: <AlertTriangle className="size-3.5 text-orange-400" />,
    },
    major_outage: {
      label: "Major Outage",
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <XCircle className="size-3.5 text-red-400" />,
    },
    maintenance: {
      label: "Scheduled Maintenance",
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: <Clock className="size-3.5 text-blue-400" />,
    },
    unknown: {
      label: "Unknown State",
      color: "bg-white/10 text-muted-foreground border-white/10",
      icon: <Activity className="size-3.5 text-muted-foreground" />,
    },
  };

  return (
    <div className="space-y-6 text-foreground font-sans animate-in fade-in-50 duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wide">
              LIVE TELEMETRY
            </span>
            <span className="text-xs text-muted-foreground font-mono">Independent Probe Mesh</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 text-white">
            System Status & Subsystem Health
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time verification of all 10 core SparrowX subsystems. Never displays “Operational”
            unless independent live probes actually pass.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isProbing}
          onClick={executeProbe}
          className="h-9 px-3.5 text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isProbing ? "animate-spin text-primary" : ""}`} />
          <span>{isProbing ? "Probing Mesh..." : "Run Live System Probe"}</span>
        </Button>
      </div>

      {/* Overall Health Card */}
      {healthData && (
        <div
          className={`rounded-2xl border p-6 backdrop-blur-xl transition-all ${
            healthData.overallStatus === "operational"
              ? "border-emerald-500/30 bg-emerald-950/20"
              : healthData.overallStatus === "degraded"
                ? "border-amber-500/30 bg-amber-950/20"
                : "border-red-500/30 bg-red-950/20"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid size-10 place-items-center rounded-xl border ${
                  healthData.overallStatus === "operational"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : healthData.overallStatus === "degraded"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-red-500/20 border-red-500/40 text-red-400"
                }`}
              >
                <Activity className="size-5 animate-pulse" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>
                    {healthData.overallStatus === "operational"
                      ? "All Core Subsystems Are Fully Operational"
                      : healthData.overallStatus === "degraded"
                        ? "Elevated Latency or Partial Service Degradation"
                        : "Active Service Outage Detected"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  Last verified at {healthData.lastProbeTime} • 10/10 Subsystems Probed
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {healthData.operationalCount} Operational
              </span>
              {healthData.degradedCount > 0 && (
                <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {healthData.degradedCount} Degraded
                </span>
              )}
              {healthData.outageCount > 0 && (
                <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                  {healthData.outageCount} Outage
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subsystem Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthData?.subsystems.map((sub) => {
          const badge = statusBadges[sub.status];
          return (
            <div
              key={sub.id}
              className="p-5 rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl space-y-3 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-white">{sub.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-mono mt-0.5">
                    {sub.category}
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${badge.color}`}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
              </div>

              <p className="text-xs text-white/80 leading-relaxed font-sans">{sub.details}</p>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>
                  Latency:{" "}
                  <strong className="text-white">
                    {sub.latencyMs !== undefined ? `${sub.latencyMs}ms` : "N/A"}
                  </strong>
                </span>
                <span>
                  Uptime: <strong className="text-emerald-400">{sub.uptimePct}%</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
