import React, { useState } from "react";
import { Download, Shield, Copy, Check, FileCode, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportFirewallBlocklist, type FirewallFormat } from "@/lib/advanced-features";

export function FirewallRuleExporter({
  indicators,
  showToast,
}: {
  indicators: Array<{ indicator: string; type: string; blocked: boolean; actor?: string }>;
  showToast: (msg: string) => void;
}) {
  const [selectedFormat, setSelectedFormat] = useState<FirewallFormat>("cloudflare");
  const [copied, setCopied] = useState(false);

  const activeBlocked = indicators.filter((i) => i.blocked);
  const exported = exportFirewallBlocklist(indicators, selectedFormat);

  const handleDownload = () => {
    const blob = new Blob([exported.content], { type: exported.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exported.filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${activeBlocked.length} rules to ${exported.filename}`);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(exported.content);
    setCopied(true);
    showToast(`Copied ${selectedFormat.toUpperCase()} firewall rules to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-info/10 text-info">
              <Shield className="size-3.5" />
            </span>
            <h2 className="text-base font-semibold">Perimeter WAF & Firewall Exporter</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Synchronize {activeBlocked.length} actively blocked threat IOCs with your external edge
            firewalls and load balancers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleCopy} size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            Copy Rules
          </Button>
          <Button onClick={handleDownload} size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="size-3.5" />
            Download Rule Config
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Target Engine:</span>
          {(
            [
              { id: "cloudflare", label: "Cloudflare WAF (JSON)" },
              { id: "aws_waf", label: "AWS WAF IPSet" },
              { id: "nginx", label: "NGINX conf" },
              { id: "iptables", label: "Linux iptables" },
              { id: "csv", label: "SIEM CSV" },
            ] as const
          ).map((fmt) => (
            <Button
              key={fmt.id}
              onClick={() => setSelectedFormat(fmt.id)}
              size="sm"
              variant={selectedFormat === fmt.id ? "secondary" : "outline"}
              className="h-7 px-2.5 text-[11px]"
            >
              {fmt.label}
            </Button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{exported.filename}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-[11px] text-muted-foreground font-mono">
          <span>Format: {selectedFormat.toUpperCase()}</span>
          <span>{activeBlocked.length} Active Drops</span>
        </div>
        <pre className="max-h-48 overflow-y-auto p-3 font-mono text-[11px] text-foreground leading-relaxed">
          {exported.content}
        </pre>
      </div>
    </section>
  );
}
