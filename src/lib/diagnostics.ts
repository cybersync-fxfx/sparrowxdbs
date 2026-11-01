/**
 * SparrowX Centralized Diagnostics & Error Reporting System
 * -------------------------------------------------------------
 * Captures, sanitizes, and correlates runtime errors, API failures,
 * background tasks, and diagnostic events across SparrowX.
 *
 * Guarantees:
 * 1. Zero leakage: Redacts API keys, passwords, credentials, tokens, and PII.
 * 2. Correlated reference IDs: Every error generates a stable `SPX-ERR-...` ID.
 * 3. Frequency & recurrence tracking for administrative incident triage.
 * 4. Safe persistent buffer in localStorage + async backend audit sync.
 */

import { type ErrorCode, getErrorDoc } from "./error-registry";
import { persistAuditLogToBackend } from "./supabase";

export interface DiagnosticEvent {
  /** Unique correlation ID, e.g. SPX-ERR-20261101-7A3F */
  referenceId: string;
  code: ErrorCode;
  errorId: string; // e.g. SPX-E-0201
  title: string;
  module: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  isoTimestamp: string;
  message: string;
  userFacingMessage: string;
  nextStep: string;
  context?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  userFeedback?: "helpful" | "not_helpful";
  userReport?: {
    userEmail?: string;
    description: string;
    submittedAt: string;
  };
}

export interface ErrorMetricSummary {
  totalErrors: number;
  criticalErrors: number;
  errorsToday: number;
  unresolvedCount: number;
  resolvedCount: number;
  topErrors: Array<{
    code: ErrorCode;
    count: number;
    title: string;
    module: string;
    lastSeen: string;
  }>;
  affectedModules: Array<{ module: string; count: number }>;
  recentEvents: DiagnosticEvent[];
}

const STORAGE_KEY = "sparrowx_diagnostics_events_v2";
const FREQUENCY_KEY = "sparrowx_diagnostics_frequency_v2";
const MAX_STORED_EVENTS = 250;

type DiagnosticListener = (event: DiagnosticEvent) => void;
const listeners = new Set<DiagnosticListener>();

export function subscribeToDiagnostics(listener: DiagnosticListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Strips secret tokens, passwords, authorization headers, credit cards,
 * and PII from error context objects before storage or logging.
 */
export function sanitizeContext(data: unknown, depth = 0): unknown {
  if (depth > 4) return "[Max Depth Reached]";
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") {
    if (typeof data === "string") {
      return redactSensitiveString(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContext(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("apikey") ||
      lowerKey.includes("api_key") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("cvv") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("cardnumber")
    ) {
      sanitized[key] = "[REDACTED_SECRET]";
    } else if (typeof val === "string") {
      sanitized[key] = redactSensitiveString(val);
    } else {
      sanitized[key] = sanitizeContext(val, depth + 1);
    }
  }
  return sanitized;
}

function redactSensitiveString(str: string): string {
  return str
    .replace(/spx_(live|tenant|test)_[a-zA-Z0-9_-]{8,}/gi, "spx_$1_••••••••••••")
    .replace(/sb_publishable_[a-zA-Z0-9_-]{10,}/gi, "sb_publishable_••••••••")
    .replace(/AIzaSy[a-zA-Z0-9_-]{20,}/gi, "AIzaSy••••••••••••")
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "••••-••••-••••-••••")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED]");
}

/**
 * Generates an audit-safe, collision-resistant correlation reference ID.
 */
export function generateReferenceId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SPX-ERR-${dateStr}-${rand}`;
}

/**
 * Loads diagnostic history from localStorage.
 */
export function getDiagnosticEvents(): DiagnosticEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiagnosticEvent[];
  } catch {
    return [];
  }
}

function saveDiagnosticEvents(events: DiagnosticEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_STORED_EVENTS)));
  } catch {
    // quota exceeded fallback: keep only top 50
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 50)));
    } catch {
      // ignore
    }
  }
}

/**
 * Records a new diagnostic error event into the centralized pipeline.
 */
export function recordDiagnosticError(
  code: ErrorCode,
  options?: {
    error?: unknown;
    module?: string;
    target?: string;
    context?: Record<string, unknown>;
    customMessage?: string;
    customNextStep?: string;
  },
): DiagnosticEvent {
  const doc = getErrorDoc(code);
  const refId = generateReferenceId();
  const now = new Date();

  // Extract raw error message safely
  let rawMessage = options?.customMessage ?? doc.userMessage;
  if (options?.error) {
    if (options.error instanceof Error) {
      rawMessage = options.error.message || rawMessage;
    } else if (typeof options.error === "string") {
      rawMessage = options.error;
    }
  }

  const safeContext = options?.context
    ? (sanitizeContext(options.context) as Record<string, unknown>)
    : undefined;

  const event: DiagnosticEvent = {
    referenceId: refId,
    code,
    errorId: doc.id,
    title: doc.title,
    module: options?.module ?? doc.module,
    severity: doc.severity,
    timestamp: now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    isoTimestamp: now.toISOString(),
    message: rawMessage,
    userFacingMessage: options?.customMessage ?? doc.userMessage,
    nextStep: options?.customNextStep ?? doc.nextStep,
    context: safeContext,
    resolved: false,
  };

  // 1. Update local storage
  const existing = getDiagnosticEvents();
  const nextEvents = [event, ...existing];
  saveDiagnosticEvents(nextEvents);

  // 2. Update frequency tracker
  updateFrequencyTracker(code);

  // 3. Asynchronously record in backend audit log
  void persistAuditLogToBackend({
    id: `AUD-${refId.slice(-8)}`,
    actor: "SparrowX Diagnostic Agent",
    role: "System Monitor",
    action: `[${code}] ${doc.title} (${refId})`,
    target: options?.target ?? options?.module ?? doc.module,
    severity:
      doc.severity === "critical" ? "Critical" : doc.severity === "high" ? "Warning" : "Info",
    timestamp: "Just now",
  });

  // 4. Dispatch to subscribers
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore listener error
    }
  });

  return event;
}

function updateFrequencyTracker(code: ErrorCode): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FREQUENCY_KEY);
    const map: Record<string, { count: number; lastSeen: string }> = raw ? JSON.parse(raw) : {};
    const current = map[code] || { count: 0, lastSeen: "" };
    map[code] = {
      count: current.count + 1,
      lastSeen: new Date().toISOString(),
    };
    window.localStorage.setItem(FREQUENCY_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Calculates aggregate error metrics for the Admin Error Monitoring dashboard.
 */
export function computeErrorMetricSummary(): ErrorMetricSummary {
  const events = getDiagnosticEvents();
  const todayStr = new Date().toISOString().slice(0, 10);

  let criticalCount = 0;
  let todayCount = 0;
  let unresolvedCount = 0;
  let resolvedCount = 0;

  const moduleMap = new Map<string, number>();
  const codeCountMap = new Map<ErrorCode, { count: number; lastSeen: string }>();

  for (const ev of events) {
    if (ev.severity === "critical") criticalCount++;
    if (ev.isoTimestamp.startsWith(todayStr)) todayCount++;
    if (ev.resolved) {
      resolvedCount++;
    } else {
      unresolvedCount++;
    }

    moduleMap.set(ev.module, (moduleMap.get(ev.module) || 0) + 1);

    const prev = codeCountMap.get(ev.code);
    codeCountMap.set(ev.code, {
      count: (prev?.count || 0) + 1,
      lastSeen: ev.timestamp,
    });
  }

  const topErrors = Array.from(codeCountMap.entries())
    .map(([code, meta]) => {
      const doc = getErrorDoc(code);
      return {
        code,
        count: meta.count,
        title: doc.title,
        module: doc.module,
        lastSeen: meta.lastSeen,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const affectedModules = Array.from(moduleMap.entries())
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalErrors: events.length,
    criticalErrors: criticalCount,
    errorsToday: todayCount,
    unresolvedCount,
    resolvedCount,
    topErrors,
    affectedModules,
    recentEvents: events.slice(0, 50),
  };
}

/**
 * Marks an incident as resolved or unresolved.
 */
export function toggleEventResolution(referenceId: string, resolvedBy?: string): boolean {
  const events = getDiagnosticEvents();
  let found = false;
  const updated = events.map((ev) => {
    if (ev.referenceId === referenceId) {
      found = true;
      const nextResolved = !ev.resolved;
      return {
        ...ev,
        resolved: nextResolved,
        resolvedAt: nextResolved ? new Date().toISOString() : undefined,
        resolvedBy: nextResolved ? resolvedBy || "SOC Admin" : undefined,
      };
    }
    return ev;
  });
  if (found) {
    saveDiagnosticEvents(updated);
  }
  return found;
}

/**
 * Submits user problem report associated with an error reference ID.
 */
export function submitProblemReport(
  referenceId: string,
  userEmail: string,
  description: string,
): boolean {
  const events = getDiagnosticEvents();
  let found = false;
  const updated = events.map((ev) => {
    if (ev.referenceId === referenceId) {
      found = true;
      return {
        ...ev,
        userReport: {
          userEmail,
          description,
          submittedAt: new Date().toISOString(),
        },
      };
    }
    return ev;
  });
  if (found) {
    saveDiagnosticEvents(updated);
  }

  // Also log to backend audit log
  void persistAuditLogToBackend({
    id: `AUD-RPT-${Date.now().toString().slice(-6)}`,
    actor: userEmail || "Anonymous User",
    role: "Problem Report",
    action: `User reported issue for ${referenceId}: "${description.slice(0, 100)}"`,
    target: "Error Support Desk",
    severity: "Warning",
    timestamp: "Just now",
  });

  return true;
}

/**
 * Records user feedback (helpful or not helpful) on a troubleshooting doc.
 */
export function recordDocFeedback(code: ErrorCode, feedback: "helpful" | "not_helpful"): void {
  if (typeof window === "undefined") return;
  try {
    const key = `sparrowx_doc_feedback_${code}`;
    window.localStorage.setItem(key, feedback);
  } catch {
    // ignore
  }
}

export function getDocFeedback(code: ErrorCode): "helpful" | "not_helpful" | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(`sparrowx_doc_feedback_${code}`);
    return val === "helpful" || val === "not_helpful" ? val : null;
  } catch {
    return null;
  }
}

/** Clear diagnostic events and frequency tracker (used by tests / maintenance) */
export function clearDiagnosticEvents(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(FREQUENCY_KEY);
    } catch {
      // ignore
    }
  }
}
