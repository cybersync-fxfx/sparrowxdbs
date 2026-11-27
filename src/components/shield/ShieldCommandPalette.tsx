import React, { useEffect } from "react";
import {
  Activity,
  ArrowLeft,
  Copy,
  FileCode2,
  Gamepad2,
  Globe,
  KeyRound,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { normalizeShieldDomain, type ClientTenant } from "@/lib/supabase";

export type ShieldSectionId =
  | "soc-overview"
  | "shield-soc-workbench"
  | "shield-threat-map"
  | "shield-ai-firewall"
  | "single-server-armor"
  | "shield-defense-tools";

export interface ShieldCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: ClientTenant[];
  activeDomainId: string;
  drillActive: boolean;
  onNavigateSection: (sectionId: ShieldSectionId) => void;
  onSelectDomain: (domainId: string) => void;
  onRunOriginAudit: () => void;
  onCheckDnsLive: () => void;
  onToggleDrill: () => void;
  onCopySensorKey: () => void;
  onPreviewCheckingPage: () => void;
  onConnectDomain?: (() => void) | undefined;
  onBackToClientArea: () => void;
  gameSecUrl: string;
}

export function ShieldCommandPalette({
  open,
  onOpenChange,
  tenants,
  activeDomainId,
  drillActive,
  onNavigateSection,
  onSelectDomain,
  onRunOriginAudit,
  onCheckDnsLive,
  onToggleDrill,
  onCopySensorKey,
  onPreviewCheckingPage,
  onConnectDomain,
  onBackToClientArea,
  gameSecUrl,
}: ShieldCommandPaletteProps) {
  // Global Cmd+K / Ctrl+K shortcut listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const runAndClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">SparrowX Shield Command Palette</DialogTitle>
      <div className="bg-[#080B12] text-[#F4F6FA] border border-white/[0.12] rounded-xl overflow-hidden">
        <CommandInput
          placeholder="Search SOC modules, domains, run audit, toggle attack drill…"
          className="text-xs font-mono text-[#F4F6FA] placeholder:text-[#64748B]"
        />
        <CommandList className="max-h-[360px] bg-[#080B12]">
          <CommandEmpty className="py-8 text-center text-xs font-mono text-[#8A94A6]">
            No matching SOC command or domain found.
          </CommandEmpty>

          <CommandGroup heading="Tactical Actions">
            <CommandItem onSelect={() => runAndClose(onToggleDrill)} className="text-xs">
              <Zap className="size-3.5 text-[#F43F5E]" aria-hidden="true" />
              <span>{drillActive ? "Stop Sandbox Attack Drill" : "Run Sandbox Attack Drill"}</span>
              <CommandShortcut>SIM</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(onRunOriginAudit)} className="text-xs">
              <RefreshCw className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Run Live Origin Security Audit</span>
              <CommandShortcut>AUD</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(onCheckDnsLive)} className="text-xs">
              <Globe className="size-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Check DNS Propagation Live</span>
              <CommandShortcut>DNS</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(onCopySensorKey)} className="text-xs">
              <KeyRound className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Copy Edge WAF Sensor Key</span>
              <CommandShortcut>KEY</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(onPreviewCheckingPage)} className="text-xs">
              <ShieldCheck className="size-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Preview Edge Browser Checking Page</span>
            </CommandItem>
            {onConnectDomain ? (
              <CommandItem onSelect={() => runAndClose(onConnectDomain)} className="text-xs">
                <Plus className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
                <span>Connect New Domain to Edge WAF</span>
              </CommandItem>
            ) : null}
          </CommandGroup>

          <CommandSeparator className="bg-white/[0.08]" />

          <CommandGroup heading="Jump to Module">
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("soc-overview"))} className="text-xs">
              <LayoutDashboard className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Command Overview</span>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("shield-soc-workbench"))} className="text-xs">
              <ShieldAlert className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>SOC Triage &amp; Attack Path</span>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("shield-threat-map"))} className="text-xs">
              <Activity className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Perimeter &amp; DNS Origin Audit</span>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("shield-ai-firewall"))} className="text-xs">
              <Sparkles className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>AI Prompt Firewall &amp; Copilot</span>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("single-server-armor"))} className="text-xs">
              <Server className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Reverse Proxy Armor (Nginx / Caddy)</span>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("shield-defense-tools"))} className="text-xs">
              <FileCode2 className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Firewall Blocklist &amp; Webhooks</span>
            </CommandItem>
          </CommandGroup>

          {tenants.length > 0 ? (
            <>
              <CommandSeparator className="bg-white/[0.08]" />
              <CommandGroup heading="Switch Monitored Domain">
                {tenants.length > 1 ? (
                  <CommandItem onSelect={() => runAndClose(() => onSelectDomain("all"))} className="text-xs font-mono">
                    <Globe className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
                    <span>All Connected Domains ({tenants.length})</span>
                    {activeDomainId === "all" ? <CommandShortcut>ACTIVE</CommandShortcut> : null}
                  </CommandItem>
                ) : null}
                {tenants.map((t) => {
                  const host = normalizeShieldDomain(t.primaryDomain);
                  return (
                    <CommandItem
                      key={t.id}
                      onSelect={() => runAndClose(() => onSelectDomain(t.id))}
                      className="text-xs font-mono"
                    >
                      <Copy className="size-3.5 text-[#10B981]" aria-hidden="true" />
                      <span>{host}</span>
                      {activeDomainId === t.id ? <CommandShortcut>ACTIVE</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : null}

          <CommandSeparator className="bg-white/[0.08]" />

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runAndClose(onBackToClientArea)} className="text-xs">
              <ArrowLeft className="size-3.5 text-[#8A94A6]" aria-hidden="true" />
              <span>Back to Shield Client Area</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runAndClose(() => {
                  window.open(gameSecUrl, "_blank", "noopener,noreferrer");
                })
              }
              className="text-xs"
            >
              <Gamepad2 className="size-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Open L4 Game DDoS Portal (gamesec.sparrowx.net)</span>
              <CommandShortcut>EXT</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAndClose(() => onNavigateSection("shield-defense-tools"))} className="text-xs">
              <Webhook className="size-3.5 text-[#CBD5E1]" aria-hidden="true" />
              <span>Manage Incident Webhooks</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
}
