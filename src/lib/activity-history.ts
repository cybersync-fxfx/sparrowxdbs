/**
 * SparrowX Activity & Operation History System
 * -------------------------------------------------------------
 * Provides users and operators with a complete, transparent, and
 * searchable record of all actions performed in SparrowX.
 *
 * Supported operation statuses:
 * - successful
 * - failed
 * - pending
 * - cancelled
 * - retried
 */

import { type ErrorCode, docsUrlFor } from "./error-registry";

export type OperationStatus = "successful" | "failed" | "pending" | "cancelled" | "retried";

export type OperationCategory =
  | "Website & Domain"
  | "Firewall & WAF"
  | "AI Guardrails"
  | "SDK & Diagnostic"
  | "Billing & Payment"
  | "Authentication"
  | "Reports & Compliance"
  | "Access & Personnel"
  | "System Operation";

export interface UserOperationRecord {
  id: string;
  timestamp: string;
  isoTimestamp: string;
  category: OperationCategory;
  title: string;
  affectedResource: string;
  status: OperationStatus;
  details: string;
  errorCode?: ErrorCode;
  errorReferenceId?: string;
  troubleshootingUrl?: string;
  latencyMs?: number;
  retryable?: boolean;
}

const STORAGE_KEY = "sparrowx_user_activity_history_v1";
const MAX_HISTORY_RECORDS = 200;

type ActivityListener = (record: UserOperationRecord) => void;
const listeners = new Set<ActivityListener>();

export function subscribeToActivityHistory(listener: ActivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUserActivityHistory(): UserOperationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultActivityHistory();
    return JSON.parse(raw) as UserOperationRecord[];
  } catch {
    return getDefaultActivityHistory();
  }
}

function saveUserActivityHistory(records: UserOperationRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY_RECORDS)));
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
    } catch {
      // ignore
    }
  }
}

/**
 * Logs an operation into the activity history.
 */
export function recordUserOperation(input: {
  category: OperationCategory;
  title: string;
  affectedResource: string;
  status: OperationStatus;
  details: string;
  errorCode?: ErrorCode;
  errorReferenceId?: string;
  latencyMs?: number;
  retryable?: boolean;
}): UserOperationRecord {
  const now = new Date();
  const id = `ACT-${now.getTime().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const record: UserOperationRecord = {
    id,
    timestamp: now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    isoTimestamp: now.toISOString(),
    category: input.category,
    title: input.title,
    affectedResource: input.affectedResource,
    status: input.status,
    details: input.details,
    errorCode: input.errorCode,
    errorReferenceId: input.errorReferenceId,
    troubleshootingUrl: input.errorCode
      ? docsUrlFor(input.errorCode, input.errorReferenceId)
      : undefined,
    latencyMs: input.latencyMs,
    retryable: input.retryable,
  };

  const existing = getUserActivityHistory();
  const updated = [record, ...existing];
  saveUserActivityHistory(updated);

  listeners.forEach((fn) => {
    try {
      fn(record);
    } catch {
      // ignore
    }
  });

  return record;
}

/**
 * Updates the status of an existing operation (e.g. from pending to successful).
 */
export function updateOperationStatus(
  id: string,
  status: OperationStatus,
  updates?: Partial<
    Pick<UserOperationRecord, "details" | "errorCode" | "errorReferenceId" | "latencyMs">
  >,
): void {
  const history = getUserActivityHistory();
  const updated = history.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        status,
        ...updates,
        troubleshootingUrl: updates?.errorCode
          ? docsUrlFor(updates.errorCode, updates.errorReferenceId)
          : item.troubleshootingUrl,
      };
    }
    return item;
  });
  saveUserActivityHistory(updated);
}

/**
 * Default sample records if fresh user session.
 */
function getDefaultActivityHistory(): UserOperationRecord[] {
  const now = new Date();
  return [
    {
      id: "ACT-INIT-01",
      timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isoTimestamp: now.toISOString(),
      category: "System Operation",
      title: "SparrowX Core Telemetry Engine Initialized",
      affectedResource: "Autonomous Edge Shield",
      status: "successful",
      details: "Sovereign vault connected, real-time background workers active.",
      latencyMs: 14,
    },
  ];
}
