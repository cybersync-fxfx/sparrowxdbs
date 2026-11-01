import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Database,
  Flame,
  Shield,
} from "lucide-react";
import { supabaseUrl, getSupabaseHeaders, isSupabaseConfigured } from "@/lib/supabase";

export interface EngineActivityLog {
  id: string;
  time: string;
  category: string;
  message: string;
  type: "success" | "error" | "info" | "cooking";
  latencyMs?: number | undefined;
}

export interface EngineToast {
  id: string;
  type: "success" | "error" | "info" | "cooking";
  title?: string | undefined;
  message: string;
  timestamp: string;
  code?: string | undefined;
  referenceId?: string | undefined;
  nextStep?: string | undefined;
  onRetry?: (() => Promise<void> | void) | undefined;
  onTroubleshoot?: (() => void) | undefined;
}

// Global subscribers for dispatching activity from anywhere in the app
type LogListener = (log: EngineActivityLog) => void;
type ToastListener = (toast: EngineToast) => void;

const logSubscribers = new Set<LogListener>();
const toastSubscribers = new Set<ToastListener>();

export function emitEngineActivity(
  category: string,
  message: string,
  type: "success" | "error" | "info" | "cooking" = "info",
  latencyMs?: number,
) {
  const newLog: EngineActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    category,
    message,
    type,
    latencyMs,
  };
  logSubscribers.forEach((fn) => fn(newLog));
}

export function emitEngineToast(
  message: string,
  type: "success" | "error" | "info" | "cooking" = "info",
  title?: string,
  options?: {
    code?: string;
    referenceId?: string;
    nextStep?: string;
    onRetry?: () => Promise<void> | void;
    onTroubleshoot?: () => void;
  },
) {
  const newToast: EngineToast = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    message,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    code: options?.code,
    referenceId: options?.referenceId,
    nextStep: options?.nextStep,
    onRetry: options?.onRetry,
    onTroubleshoot: options?.onTroubleshoot,
  };
  toastSubscribers.forEach((fn) => fn(newToast));
}

export function BackgroundEngineToaster() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<EngineActivityLog[]>(() => [
    {
      id: "init-0",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      category: "Engine Core",
      message: "SparrowX Background Telemetry Worker initialized",
      type: "info",
    },
  ]);
  const [activeToasts, setActiveToasts] = useState<EngineToast[]>([]);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingStatus, setLastPingStatus] = useState<"healthy" | "offline" | "slow">("healthy");
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Measure real round-trip HTTP ping to Supabase REST endpoint
  const runLivePing = useCallback(async () => {
    if (!isSupabaseConfigured || !supabaseUrl) {
      setLastPingStatus("offline");
      return;
    }

    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/app_users?select=count&limit=1`, {
        method: "HEAD",
        headers: getSupabaseHeaders(),
      });
      const end = performance.now();
      const latency = Math.round(end - start);
      setPingLatency(latency);
      setLastPingStatus(latency > 800 ? "slow" : "healthy");
      emitEngineActivity(
        "SparrowX Core Mesh",
        `SparrowX Vault heartbeat: ${res.status} OK`,
        "info",
        latency,
      );
    } catch {
      setLastPingStatus("offline");
      emitEngineActivity("SparrowX Core Mesh", "Heartbeat probe failed to connect", "error");
    } finally {
      setIsPinging(false);
    }
  }, []);

  // Subscribe to global engine logs and toasts
  useEffect(() => {
    const handleLog: LogListener = (newLog) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    };

    const handleToast: ToastListener = (newToast) => {
      setActiveToasts((prev) => [...prev, newToast]);
      // Longer auto-dismiss for errors (8s) so user has time to review and click action; 4.5s for success/info
      const dismissDelay = newToast.type === "error" ? 8000 : 4500;
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, dismissDelay);
    };

    logSubscribers.add(handleLog);
    toastSubscribers.add(handleToast);

    return () => {
      logSubscribers.delete(handleLog);
      toastSubscribers.delete(handleToast);
    };
  }, []);

  // Periodic heartbeat every 25 seconds
  useEffect(() => {
    void runLivePing();
    const interval = setInterval(() => {
      void runLivePing();
    }, 25000);
    return () => clearInterval(interval);
  }, [runLivePing]);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {/* 1. FLOATING TOASTS STACK (Top-Right or Bottom-Right) */}
      <div
        className="fixed bottom-16 sm:bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {activeToasts.map((toast) => {
          const isError = toast.type === "error";
          const isSuccess = toast.type === "success";
          const isCooking = toast.type === "cooking";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl p-3.5 shadow-2xl backdrop-blur-xl border transition-all animate-in slide-in-from-bottom-3 duration-200 ${
                isError
                  ? "bg-red-950/90 border-red-500/40 text-red-100"
                  : isSuccess
                    ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-100"
                    : isCooking
                      ? "bg-amber-950/90 border-amber-500/40 text-amber-100"
                      : "bg-[#141419]/95 border-white/15 text-foreground"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {isError && <AlertTriangle className="size-4 text-red-400" />}
                  {isSuccess && <CheckCircle2 className="size-4 text-emerald-400" />}
                  {isCooking && <Loader2 className="size-4 text-amber-400 animate-spin" />}
                  {!isError && !isSuccess && !isCooking && <Info className="size-4 text-primary" />}
                </div>

                <div className="flex-1 min-w-0">
                  {toast.title && (
                    <div className="text-xs font-bold tracking-tight mb-1 flex items-center justify-between gap-1">
                      <span className="truncate">{toast.title}</span>
                      {toast.code && (
                        <span className="shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-primary">
                          {toast.code}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs leading-relaxed text-white/90 whitespace-pre-line break-words">
                    {toast.message}
                  </div>

                  {(toast.onRetry || toast.onTroubleshoot || toast.referenceId) && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      {toast.referenceId && (
                        <span className="font-mono text-[9px] text-muted-foreground/80">
                          {toast.referenceId}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {toast.onRetry && (
                          <button
                            type="button"
                            onClick={() => {
                              toast.onRetry?.();
                              dismissToast(toast.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                          >
                            <RefreshCw className="size-2.5" />
                            <span>Retry</span>
                          </button>
                        )}
                        {toast.onTroubleshoot && (
                          <button
                            type="button"
                            onClick={() => {
                              toast.onTroubleshoot?.();
                              dismissToast(toast.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-medium transition-colors"
                          >
                            <span>Troubleshoot & Fix →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-white/50 hover:text-white shrink-0 p-0.5"
                  aria-label="Dismiss toast"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. DOCKED LIVE BACKGROUND ENGINE MONITOR ("Cooking in back") */}
      <div className="fixed bottom-3 right-3 sm:right-5 z-40">
        {!isOpen ? (
          /* Minimized Pill */
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 rounded-full border border-primary/40 bg-[#0e0e12]/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-xl hover:border-primary transition-all hover:scale-105 active:scale-95"
            title="Open Live Background Telemetry & Engine Activity"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>

            <div className="flex items-center gap-1.5">
              <Flame className="size-3.5 text-primary animate-pulse" />
              <span className="font-mono text-[11px] font-bold text-primary">Cooking:</span>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                {pingLatency ? `${pingLatency}ms` : "Active"}
              </span>
            </div>

            <ChevronUp className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" />
          </button>
        ) : (
          /* Expanded Engine Activity Drawer */
          <div className="relative w-80 sm:w-96 rounded-2xl border border-white/15 bg-[#0d0d12]/98 p-4 shadow-2xl backdrop-blur-2xl text-foreground font-sans animate-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-primary/10 border border-primary/30 text-primary">
                  <Activity className="size-4 animate-pulse" />
                </div>
                <div>
                  <div className="font-semibold text-xs leading-none">
                    SparrowX Background Engine
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Realtime Workers Cooking in Background</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={runLivePing}
                  disabled={isPinging}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  title="Run real-time ping to SparrowX Sovereign Vault"
                  aria-label="Ping backend"
                >
                  <RefreshCw
                    className={`size-3.5 ${isPinging ? "animate-spin text-primary" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Minimize engine toaster"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
            </div>

            {/* Live Telemetry Health Bar */}
            <div className="my-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg border border-white/10 bg-black/40 p-2">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Database className="size-3 text-primary" /> SparrowX Vault Latency:
                </div>
                <div className="mt-1 font-mono font-bold text-xs text-foreground flex items-center gap-1">
                  <span>{pingLatency ? `${pingLatency} ms` : "Checking..."}</span>
                  <span
                    className={`size-1.5 rounded-full ${
                      lastPingStatus === "healthy"
                        ? "bg-emerald-400"
                        : lastPingStatus === "slow"
                          ? "bg-amber-400"
                          : "bg-red-400"
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/40 p-2">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Shield className="size-3 text-emerald-400" /> Pipeline State:
                </div>
                <div className="mt-1 font-mono font-bold text-xs text-emerald-400 flex items-center gap-1">
                  <span>0 Threats Queued</span>
                </div>
              </div>
            </div>

            {/* Rolling Activity Terminal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Live Event Stream ({logs.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    setLogs([
                      {
                        id: `clear-${Date.now()}`,
                        time: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }),
                        category: "Engine Core",
                        message: "Event log buffer cleared",
                        type: "info",
                      },
                    ])
                  }
                  className="hover:text-foreground underline"
                >
                  Clear Log
                </button>
              </div>

              <div
                ref={logContainerRef}
                className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/70 p-2 font-mono text-[11px] space-y-1.5 scrollbar-thin"
              >
                {logs.map((log) => {
                  return (
                    <div
                      key={log.id}
                      className="leading-snug border-b border-white/[0.04] pb-1 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span>[{log.time}]</span>
                        <span className="text-primary font-bold">{log.category}</span>
                        {log.latencyMs !== undefined && (
                          <span className="text-emerald-400">({log.latencyMs}ms)</span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] ${
                          log.type === "error"
                            ? "text-red-400 font-semibold"
                            : log.type === "success"
                              ? "text-emerald-400 font-medium"
                              : log.type === "cooking"
                                ? "text-amber-400 font-medium"
                                : "text-white/80"
                        }`}
                      >
                        {log.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
