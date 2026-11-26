import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  Box,
  CreditCard,
  Database,
  Globe,
  KeyRound,
  Plus,
  Search,
  Server,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import type { AiInstanceRecord } from "@/lib/ai/contracts";

export interface CommandPaletteAction {
  id: string;
  group: "Navigation" | "Instances" | "Quick Actions";
  title: string;
  subtitle: string;
  shortcut?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface AiCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  instances: AiInstanceRecord[];
  onNavigate: (target: string, instanceId?: string) => void;
}

/**
 * Native `<dialog>` modal command palette (`Cmd/Ctrl + K`).
 * Follows modern-web-guidance `dialog`:
 * - Uses native `showModal()` (no `role="dialog"`, no `aria-modal`, no manual Esc/focus trap)
 * - Uses `closedby="any"` with pointerdown/pointerup outside-click fallback for Safari
 * - Clears `returnValue` on close
 */
export function AiCommandPalette({
  open,
  onClose,
  instances,
  onNavigate,
}: AiCommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setQuery("");
      dlg.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  const actions = useMemo<CommandPaletteAction[]>(() => {
    const nav: CommandPaletteAction[] = [
      {
        id: "new-deploy",
        group: "Quick Actions",
        title: "Deploy New AI Agent / MCP Server",
        subtitle: "Launch 3-step deployment wizard in 60 seconds",
        shortcut: "N",
        icon: <Plus className="size-4 text-[#10B981]" />,
        onSelect: () => onNavigate("new"),
      },
      {
        id: "overview",
        group: "Navigation",
        title: "Console Overview",
        subtitle: "Active instances, RAM/CPU pool & bandwidth meter",
        icon: <Activity className="size-4 text-zinc-300" />,
        onSelect: () => onNavigate("overview"),
      },
      {
        id: "templates",
        group: "Navigation",
        title: "1-Click Template Gallery",
        subtitle: "Langflow MIT, MCP Runtime, Private RAG & Workflow VPS",
        icon: <Box className="size-4 text-zinc-300" />,
        onSelect: () => onNavigate("templates"),
      },
      {
        id: "billing",
        group: "Navigation",
        title: "Billing & UPI AutoPay Center",
        subtitle: "INR wallet, UPI QR checkout & GST invoices",
        icon: <CreditCard className="size-4 text-[#38BDF8]" />,
        onSelect: () => onNavigate("billing"),
      },
      {
        id: "security",
        group: "Navigation",
        title: "Security & Webhook WAF (sec.sparrowx.net)",
        subtitle: "Prompt guardrails, L7 WAF & egress firewall",
        icon: <Shield className="size-4 text-[#F59E0B]" />,
        onSelect: () => onNavigate("security"),
      },
      {
        id: "vectordb",
        group: "Navigation",
        title: "Managed Vector DBs (db.sparrowx.net)",
        subtitle: "Auto-linked PostgreSQL 16 + pgvector clusters",
        icon: <Database className="size-4 text-zinc-300" />,
        onSelect: () => onNavigate("vectordb"),
      },
      {
        id: "domains",
        group: "Navigation",
        title: "Domains & Auto-SSL",
        subtitle: "Wildcard *.ai.sparrowx.net & custom CNAME routes",
        icon: <Globe className="size-4 text-zinc-300" />,
        onSelect: () => onNavigate("domains"),
      },
      {
        id: "keys",
        group: "Navigation",
        title: "API Keys & Audit Logs",
        subtitle: "Scoped platform tokens & immutable audit trail",
        icon: <KeyRound className="size-4 text-zinc-300" />,
        onSelect: () => onNavigate("keys"),
      },
      {
        id: "admin",
        group: "Navigation",
        title: "Founder Admin Panel (Proxmox + vnstat)",
        subtitle: "40-core Xeon host, 256 GB RAM pool & abuse monitor",
        icon: <Server className="size-4 text-[#EF4444]" />,
        onSelect: () => onNavigate("admin"),
      },
    ];

    const instActions: CommandPaletteAction[] = instances.map((inst) => ({
      id: `inst-${inst.id}`,
      group: "Instances",
      title: inst.name,
      subtitle: `${inst.publicUrl} • ${inst.vcpu} vCPU / ${inst.ramGb} GB RAM`,
      icon: <Terminal className="size-4 text-[#38BDF8]" />,
      onSelect: () => onNavigate("instance", inst.id),
    }));

    return [...nav.slice(0, 1), ...instActions, ...nav.slice(1)];
  }, [instances, onNavigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={(e) => {
        e.currentTarget.returnValue = "";
        onClose();
      }}
      onPointerDown={(e) => {
        if (!("closedBy" in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutsideDialog(e);
        }
      }}
      onPointerUp={(e) => {
        if (
          !("closedBy" in HTMLDialogElement.prototype) &&
          pressedOutsideRef.current &&
          isOutsideDialog(e)
        ) {
          e.currentTarget.close();
        }
        pressedOutsideRef.current = false;
      }}
      className="spx-ai-dialog m-auto w-[min(620px,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#090B11] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <Search className="size-4 text-zinc-400 shrink-0" aria-hidden="true" />
        <h1 id={titleId} className="sr-only">
          SparrowX AI Command Palette
        </h1>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to instance, deploy template, billing, or Proxmox admin..."
          aria-label="Search commands and instances"
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
        <form method="dialog">
          <button
            type="submit"
            value="close"
            aria-label="Close command palette"
            className="inline-flex min-w-[28px] min-h-[28px] items-center justify-center rounded-md border border-white/10 bg-[#10131C] text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>

      <div className="max-h-[62vh] overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs font-mono text-zinc-500">
            No matching commands or instances for "{query}".
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.onSelect();
                dialogRef.current?.close();
              }}
              className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#10131C] focus-visible:bg-[#10131C] focus-visible:outline-none border border-transparent hover:border-white/[0.08] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#05060A]">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100 truncate">{item.title}</div>
                  <div className="text-xs font-mono text-zinc-500 truncate">{item.subtitle}</div>
                </div>
              </div>
              <span className="shrink-0 rounded border border-white/[0.08] bg-[#05060A] px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                {item.shortcut ?? item.group}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2 text-[11px] font-mono text-zinc-500">
        <span>ai.sparrowx.net • Mumbai BOM1 Control Plane</span>
        <span>ESC to close</span>
      </div>
    </dialog>
  );
}
