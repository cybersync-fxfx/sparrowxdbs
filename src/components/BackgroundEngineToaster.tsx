import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";

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
  const [activeToasts, setActiveToasts] = useState<EngineToast[]>([]);

  // Subscribe to global engine toasts
  useEffect(() => {
    const handleToast: ToastListener = (newToast) => {
      setActiveToasts((prev) => [...prev, newToast]);
      // Longer auto-dismiss for errors (8s), 4.5s for success/info/loading
      const dismissDelay = newToast.type === "error" ? 8000 : 4500;
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, dismissDelay);
    };

    toastSubscribers.add(handleToast);

    return () => {
      toastSubscribers.delete(handleToast);
    };
  }, []);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
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
                {!isError && !isSuccess && !isCooking && <Info className="size-4 text-sky-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="text-xs font-bold tracking-tight mb-1 flex items-center justify-between gap-1">
                    <span className="truncate">{toast.title}</span>
                    {toast.code && (
                      <span className="shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-sky-400">
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-medium transition-colors cursor-pointer"
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
                className="text-white/50 hover:text-white shrink-0 p-0.5 cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
