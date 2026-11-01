import React, { useMemo } from "react";
import {
  BarChart3,
  Download,
  FileText,
  PieChart,
  Siren,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Activity,
  Layers3,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Incident, type Vulnerability, type ThreatIndicator } from "@/lib/supabase";

export function IncidentStatisticsView({
  incidents,
  vulnerabilities,
  threats,
  onNavigate,
  showToast,
}: {
  incidents: Incident[];
  vulnerabilities: Vulnerability[];
  threats: ThreatIndicator[];
  onNavigate: (nav: string) => void;
  showToast: (msg: string) => void;
}) {
  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter((i) => i.severity === "Critical").length;
    const high = incidents.filter((i) => i.severity === "High").length;
    const medium = incidents.filter((i) => i.severity === "Medium").length;
    const contained = incidents.filter((i) => i.status === "Contained").length;
    const open = total - contained;
    const containmentRate = total > 0 ? Math.round((contained / total) * 100) : 100;

    // Categorization heuristics based on title/summary
    const categories: Record<string, number> = {
      "Unauthorized Access / Auth": 0,
      "Perimeter & Injection Attack": 0,
      "Rogue Tool / Shell Execution": 0,
      "Data Exfiltration / PII": 0,
      "Infrastructure & Network": 0,
    };

    incidents.forEach((inc) => {
      const text = `${inc.title} ${inc.summary} ${inc.source}`.toLowerCase();
      let cat = "Infrastructure & Network";
      if (text.includes("auth") || text.includes("login") || text.includes("token")) {
        cat = "Unauthorized Access / Auth";
      } else if (
        text.includes("sqli") ||
        text.includes("xss") ||
        text.includes("injection") ||
        text.includes("prompt")
      ) {
        cat = "Perimeter & Injection Attack";
      } else if (text.includes("tool") || text.includes("mcp") || text.includes("command")) {
        cat = "Rogue Tool / Shell Execution";
      } else if (text.includes("pii") || text.includes("leak") || text.includes("secret")) {
        cat = "Data Exfiltration / PII";
      }
      categories[cat] = (categories[cat] ?? 0) + 1;
    });

    return {
      total,
      critical,
      high,
      medium,
      contained,
      open,
      containmentRate,
      categories,
    };
  }, [incidents]);

  const handleExportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Incidents Logged", String(stats.total)],
      ["Critical Incidents", String(stats.critical)],
      ["High Incidents", String(stats.high)],
      ["Medium Incidents", String(stats.medium)],
      ["Contained Incidents", String(stats.contained)],
      ["Open Incidents", String(stats.open)],
      ["Containment Resolution Rate", `${stats.containmentRate}%`],
      [],
      ["Category", "Incident Count"],
      ...Object.entries(stats.categories).map(([k, v]) => [k, String(v)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-incident-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported incident statistics to CSV");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary tracking-wider">
            <BarChart3 className="size-4" />
            Operational Incident Intelligence
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
            Incident Statistics & Performance Analytics
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Forensic breakdown of incident severity, category distributions, containment velocity,
            and exposure trends computed from your live Supabase cloud records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="size-3.5" /> Export Analytics CSV
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate("Reports & Compliance")}
            className="h-8 gap-1.5 text-xs"
          >
            <FileText className="size-3.5" /> Compliance Reports
          </Button>
        </div>
      </section>

      {/* 4 Summary Stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Total Incidents Recorded</span>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">{stats.total}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Live database history
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Containment Resolution Rate</span>
          <div className="mt-2 font-display text-2xl font-bold text-success">
            {stats.containmentRate}%
          </div>
          <span className="mt-1 block text-[11px] text-success">
            {stats.contained} contained · {stats.open} open
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Critical Vulnerabilities</span>
          <div className="mt-2 font-display text-2xl font-bold text-destructive">
            {vulnerabilities.filter((v) => v.severity === "Critical").length}
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground font-mono">
            {vulnerabilities.length} CVEs tracked
          </span>
        </div>

        <div className="border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Threat IOCs Dropped</span>
          <div className="mt-2 font-display text-2xl font-bold text-primary">
            {threats.filter((t) => t.blocked).length}
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground font-mono">
            Active perimeter filter
          </span>
        </div>
      </section>

      {/* 2-Column Detailed Analytics Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Severity Distribution */}
        <div className="border border-border bg-card p-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Incident Severity Breakdown</h2>
            <p className="text-xs text-muted-foreground">
              Proportion of Critical, High, and Medium triage events
            </p>
          </div>

          <div className="mt-5 space-y-3.5">
            {[
              {
                label: "Critical",
                count: stats.critical,
                color: "bg-destructive",
                textColor: "text-destructive",
              },
              { label: "High", count: stats.high, color: "bg-warning", textColor: "text-warning" },
              {
                label: "Medium",
                count: stats.medium,
                color: "bg-primary",
                textColor: "text-primary",
              },
            ].map((sev) => {
              const pct = stats.total > 0 ? Math.round((sev.count / stats.total) * 100) : 0;
              return (
                <div key={sev.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{sev.label}</span>
                    <span className="font-mono text-muted-foreground">
                      {sev.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${sev.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Threat Category Breakdown */}
        <div className="border border-border bg-card p-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Incident Categories Distribution
            </h2>
            <p className="text-xs text-muted-foreground">
              Classification across identity, perimeter, and AI pipelines
            </p>
          </div>

          <div className="mt-5 space-y-3.5">
            {Object.entries(stats.categories).map(([cat, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate pr-2">{cat}</span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
