/**
 * SparrowX Centralized Feedback & User Notification Engine
 * -------------------------------------------------------------
 * Guarantees the CORE PRINCIPLE: NEVER LEAVE USERS GUESSING.
 *
 * Whenever something works: tell the user it worked.
 * Whenever something fails: tell what failed, why it failed, and how to fix it.
 * Whenever something is processing: display real-time status.
 *
 * No silent failures, no dead buttons, no endless loading states.
 */

import { type ErrorCode, getErrorDoc, isErrorCode, docsUrlFor } from "./error-registry";
import { recordDiagnosticError } from "./diagnostics";
import { recordUserOperation, type OperationCategory } from "./activity-history";
import {
  emitEngineActivity,
  emitEngineToast,
  type EngineToast,
} from "@/components/BackgroundEngineToaster";

export interface FeedbackOptions {
  title?: string;
  module?: string;
  target?: string;
  category?: OperationCategory;
  context?: Record<string, unknown>;
  error?: unknown;
  retryAction?: () => Promise<void> | void;
  onNavigateToDocs?: (code: ErrorCode, refId?: string) => void;
  customMessage?: string;
  customNextStep?: string;
  latencyMs?: number;
}

// Global hook for in-app navigation to docs
let globalDocsNavigator: ((code: string, refId?: string) => void) | null = null;

export function registerGlobalDocsNavigator(
  navigator: (code: string, refId?: string) => void,
): void {
  globalDocsNavigator = navigator;
}

/**
 * Dispatches a genuine, backend-confirmed Success notification.
 */
export function notifySuccess(
  message: string,
  options?: {
    title?: string;
    category?: OperationCategory;
    target?: string;
    details?: string;
    latencyMs?: number;
  },
): void {
  const title = options?.title ?? "Operation Confirmed";
  const category = options?.category ?? "System Operation";
  const target = options?.target ?? "SparrowX";

  // 1. Log to visible Activity History
  recordUserOperation({
    category,
    title,
    affectedResource: target,
    status: "successful",
    details: options?.details ?? message,
    latencyMs: options?.latencyMs,
  });

  // 2. Emit engine activity log
  emitEngineActivity(category, message, "success", options?.latencyMs);

  // 3. Emit toast
  emitEngineToast(message, "success", title);
}

/**
 * Dispatches a detailed, transparent Error notification.
 * Generates an audit reference ID, actionable next step, and docs link.
 */
export function notifyError(
  codeOrMessage: ErrorCode | string,
  options?: FeedbackOptions,
): { referenceId: string; code: ErrorCode } {
  const code: ErrorCode = isErrorCode(codeOrMessage)
    ? codeOrMessage
    : detectErrorCodeFromString(codeOrMessage);

  const doc = getErrorDoc(code);

  // 1. Centralized Diagnostic Record
  const diagnosticEvent = recordDiagnosticError(code, {
    error: options?.error,
    module: options?.module ?? doc.module,
    target: options?.target,
    context: options?.context,
    customMessage:
      options?.customMessage ?? (!isErrorCode(codeOrMessage) ? codeOrMessage : undefined),
    customNextStep: options?.customNextStep,
  });

  const refId = diagnosticEvent.referenceId;
  const userMessage =
    options?.customMessage || (!isErrorCode(codeOrMessage) ? codeOrMessage : doc.userMessage);
  const nextStep = options?.customNextStep || doc.nextStep;
  const category = options?.category ?? "System Operation";

  // 2. Log to Activity History
  recordUserOperation({
    category,
    title: doc.title,
    affectedResource: options?.target ?? doc.module,
    status: "failed",
    details: `${userMessage} — ${nextStep}`,
    errorCode: code,
    errorReferenceId: refId,
    retryable: doc.retryable && Boolean(options?.retryAction),
  });

  // 3. Emit Engine Activity log
  emitEngineActivity(doc.module, `[${doc.id}] ${userMessage} (${refId})`, "error");

  // 4. Emit Enhanced Toast
  const toastTitle = `${doc.title} (${doc.id})`;
  const toastMessage = `${userMessage}\n\nNext step: ${nextStep}\nRef: ${refId}`;

  emitEngineToast(toastMessage, "error", toastTitle, {
    code,
    referenceId: refId,
    nextStep,
    onRetry: options?.retryAction
      ? async () => {
          try {
            emitEngineToast("Retrying operation...", "cooking", "Retry in Progress");
            await options.retryAction!();
            notifySuccess(`Retried action succeeded for ${doc.title}`, {
              category,
              target: options?.target,
            });
          } catch (retryErr) {
            notifyError(code, {
              ...options,
              error: retryErr,
              customMessage: `Retry attempt failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
            });
          }
        }
      : undefined,
    onTroubleshoot: () => {
      if (options?.onNavigateToDocs) {
        options.onNavigateToDocs(code, refId);
      } else if (globalDocsNavigator) {
        globalDocsNavigator(code, refId);
      } else if (typeof window !== "undefined") {
        window.location.href = docsUrlFor(code, refId);
      }
    },
  });

  return { referenceId: refId, code };
}

/**
 * Dispatches a Warning notification when user attention is required.
 */
export function notifyWarning(
  message: string,
  options?: {
    title?: string;
    nextStep?: string;
    category?: OperationCategory;
    target?: string;
  },
): void {
  const title = options?.title ?? "Attention Required";
  const category = options?.category ?? "System Operation";

  recordUserOperation({
    category,
    title,
    affectedResource: options?.target ?? "Configuration",
    status: "pending",
    details: options?.nextStep ? `${message} Next: ${options.nextStep}` : message,
  });

  emitEngineActivity(category, message, "info");
  emitEngineToast(
    options?.nextStep ? `${message}\n\nRecommended: ${options.nextStep}` : message,
    "info",
    title,
  );
}

/**
 * Dispatches an Informational message.
 */
export function notifyInfo(
  message: string,
  options?: { title?: string; category?: OperationCategory; target?: string },
): void {
  const category = options?.category ?? "System Operation";
  emitEngineActivity(category, message, "info");
  emitEngineToast(message, "info", options?.title);
}

/**
 * Handles long-running or multi-stage tasks with an active spinner.
 */
export function notifyLoading(
  message: string,
  options?: {
    title?: string;
    category?: OperationCategory;
    target?: string;
  },
): {
  id: string;
  success: (finalMessage: string, details?: string) => void;
  error: (codeOrErr: ErrorCode | Error | string, errorOptions?: FeedbackOptions) => void;
  update: (progressMessage: string) => void;
} {
  const start = performance.now();
  const title = options?.title ?? "Processing";
  const category = options?.category ?? "System Operation";
  const target = options?.target ?? "SparrowX Core";

  const opRecord = recordUserOperation({
    category,
    title,
    affectedResource: target,
    status: "pending",
    details: message,
  });

  emitEngineActivity(category, `${message}...`, "cooking");
  emitEngineToast(message, "cooking", title);

  return {
    id: opRecord.id,
    success: (finalMessage: string, details?: string) => {
      const latency = Math.round(performance.now() - start);
      notifySuccess(finalMessage, {
        title,
        category,
        target,
        details,
        latencyMs: latency,
      });
    },
    error: (codeOrErr: ErrorCode | Error | string, errorOptions?: FeedbackOptions) => {
      const code: ErrorCode =
        typeof codeOrErr === "string" && isErrorCode(codeOrErr)
          ? codeOrErr
          : codeOrErr instanceof Error
            ? detectErrorCodeFromString(codeOrErr.message)
            : detectErrorCodeFromString(String(codeOrErr));

      notifyError(code, {
        ...errorOptions,
        category,
        target,
        error: codeOrErr instanceof Error ? codeOrErr : undefined,
      });
    },
    update: (progressMessage: string) => {
      emitEngineActivity(category, progressMessage, "cooking");
      emitEngineToast(progressMessage, "cooking", title);
    },
  };
}

function detectErrorCodeFromString(msg: string): ErrorCode {
  const lower = msg.toLowerCase();
  if (lower.includes("dns") || lower.includes("txt")) return "DOMAIN_VERIFICATION_FAILED";
  if (lower.includes("handshake") || lower.includes("sdk")) return "SDK_HANDSHAKE_FAILED";
  if (lower.includes("unreachable") || lower.includes("timeout")) return "WEBSITE_UNREACHABLE";
  if (lower.includes("card") || lower.includes("payment")) return "PAYMENT_CARD_DECLINED";
  if (lower.includes("password") || lower.includes("credential")) return "AUTH_INVALID_CREDENTIALS";
  if (lower.includes("not found") || lower.includes("no account")) return "AUTH_ACCOUNT_NOT_FOUND";
  if (lower.includes("offline") || lower.includes("network")) return "NETWORK_OFFLINE";
  if (lower.includes("save") || lower.includes("database") || lower.includes("persisted"))
    return "DB_WRITE_FAILED";
  if (lower.includes("deploy") || lower.includes("unconfirmed"))
    return "FIREWALL_DEPLOY_UNCONFIRMED";
  if (lower.includes("firewall") || lower.includes("rule")) return "FIREWALL_RULE_SAVE_FAILED";
  if (lower.includes("guardrail") || lower.includes("policy"))
    return "GUARDRAIL_POLICY_SAVE_FAILED";
  if (lower.includes("credit") || lower.includes("balance")) return "CREDITS_INSUFFICIENT";
  if (lower.includes("module")) return "MODULE_MINIMUM_REQUIRED";
  return "UNEXPECTED_ERROR";
}
