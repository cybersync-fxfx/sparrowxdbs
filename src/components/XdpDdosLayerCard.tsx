import React, { useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, Shield, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SPARROWX_XDP_PROTECTED_PROFILES,
  generateSparrowxXdpProgram,
} from "@/lib/xdp-ddos-layer";

const XDP_SETUP_SCRIPTS = [
  {
    id: "ddos-setup",
    label: "1-Command DDoS + XDP Setup",
    command: "curl -sSL https://sparrowx.net/ddos-setup.sh | sudo bash",
    href: "/ddos-setup.sh",
  },
  {
    id: "full-setup",
    label: "Full Server A-to-Z Setup",
    command: "curl -sSL https://sparrowx.net/setup.sh | sudo bash",
    href: "/setup.sh",
  },
  {
    id: "update",
    label: "Stack Updater + Rebuild",
    command: "curl -sSL https://sparrowx.net/update.sh | sudo bash",
    href: "/update.sh",
  },
  {
    id: "fix",
    label: "Auto-Heal Doctor",
    command: "curl -sSL https://sparrowx.net/fix.sh | sudo bash -s -- --auto",
    href: "/fix.sh",
  },
  {
    id: "verify",
    label: "11-Layer Infra Verification",
    command: "curl -sSL https://sparrowx.net/verification.sh | sudo bash",
    href: "/verification.sh",
  },
] as const;

export function XdpDdosLayerCard({
  serviceName,
  endpoint,
  blockedIpv4s = [],
  showToast,
}: {
  serviceName?: string | undefined;
  endpoint?: string | undefined;
  blockedIpv4s?: string[] | undefined;
  showToast: (msg: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"source" | "deploy">("source");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const xdpBundle = useMemo(
    () =>
      generateSparrowxXdpProgram({
        ...(serviceName ? { serviceName } : {}),
        ...(endpoint ? { endpoint } : {}),
        blockedIpv4s,
      }),
    [serviceName, endpoint, blockedIpv4s],
  );

  const displayedText =
    viewMode === "source" ? xdpBundle.cSource : xdpBundle.deployCommands;

  const copyText = async (text: string, label: string, id: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setStatusMessage(`Copied ${label}`);
      showToast(`Copied ${label} to clipboard`);
      setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
        setStatusMessage("");
      }, 2000);
    } catch {
      setStatusMessage("Copy failed");
      showToast("Unable to access clipboard; copy or download the XDP script directly.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([xdpBundle.cSource], { type: "text/x-c;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sparrowx_xdp_ddos.c";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded sparrowx_xdp_ddos.c");
  };

  return (
    <section className="border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Shield className="size-3.5" />
            </span>
            <h3 className="text-base font-semibold">
              Layer 3/4 XDP / eBPF Kernel Anti-DDoS Scrubber
            </h3>
            <span className="rounded-sm border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-success">
              sparrowx_xdp_ddos.c
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Wire-speed NIC XDP filter with UDP 5s cookie challenge (<code className="text-foreground">XDP_TX</code>),
            180s per-CPU LRU whitelist, L4 payload signature validation, and TCP game SYN fast-path.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              copyText(
                displayedText,
                viewMode === "source" ? "sparrowx_xdp_ddos.c" : "XDP attach commands",
                "main-code",
              )
            }
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
          >
            {copiedId === "main-code" ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5" />
            )}
            Copy {viewMode === "source" ? "XDP C Layer" : "Commands"}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {statusMessage}
          </span>
          <Button
            type="button"
            onClick={handleDownload}
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Download .c
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {XDP_SETUP_SCRIPTS.map((script) => (
          <div
            key={script.id}
            className="flex items-center justify-between gap-2 border border-border bg-background px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground">{script.label}</span>
                <a
                  href={script.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-mono text-[10px] text-primary hover:underline"
                >
                  {script.href}
                  <ExternalLink className="size-2.5" />
                </a>
              </div>
              <code className="block truncate font-mono text-[10px] text-muted-foreground">
                {script.command}
              </code>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px] shrink-0"
              onClick={() => copyText(script.command, script.label, script.id)}
            >
              {copiedId === script.id ? (
                <Check className="size-3 text-success" />
              ) : (
                <Copy className="size-3" />
              )}
              Copy
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
        <span>Direct XDP Files:</span>
        <a
          href="/xdp/sparrowx_xdp_ddos.c"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          /xdp/sparrowx_xdp_ddos.c
        </a>
        <a
          href="/xdp/attach-xdp.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          /xdp/attach-xdp.sh
        </a>
        <a
          href="/setup-manifest.json"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          /setup-manifest.json
        </a>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SPARROWX_XDP_PROTECTED_PROFILES.map((profile) => (
          <div key={profile.name} className="border border-border bg-background p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{profile.name}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {profile.protocol}
              </span>
            </div>
            <div className="font-mono text-[11px] text-primary">Ports: {profile.ports}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {profile.inspection}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "source" ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setViewMode("source")}
            >
              sparrowx_xdp_ddos.c
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "deploy" ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px] gap-1"
              onClick={() => setViewMode("deploy")}
            >
              <Terminal className="size-3" /> clang / iproute2 Attach
            </Button>
          </div>
          <span className="text-muted-foreground">
            {xdpBundle.validIpv4s.length} IPv4 IOC(s) queued for blocked_ipv4 map
          </span>
        </div>
        <pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] text-foreground leading-relaxed">
          {displayedText}
        </pre>
      </div>
    </section>
  );
}
