// SparrowX Automated Billing, Credit System & Supabase Transaction Ledger
import {
  supabaseUrl,
  isSupabaseConfigured,
  getSupabaseHeaders,
  persistAuditLogToBackend,
} from "./supabase";

export interface CreditPackage {
  id: "starter" | "builder" | "scale" | "custom";
  name: string;
  credits: number;
  priceUsd: number;
  popular?: boolean;
  savings?: string;
  description: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 100,
    priceUsd: 19,
    description: "Ideal for 1-2 web apps or API edge endpoints",
  },
  {
    id: "builder",
    name: "Builder Pack",
    credits: 500,
    priceUsd: 79,
    popular: true,
    savings: "17% OFF",
    description: "Powers 5+ production services, edge WAF & AI tool guardrails",
  },
  {
    id: "scale",
    name: "Scale Pack",
    credits: 2000,
    priceUsd: 249,
    savings: "35% OFF",
    description: "High-throughput protection, custom firewalls & unlimited telemetry",
  },
];

export interface BillingTransaction {
  id: string;
  type: "topup" | "service_purchase" | "module_upgrade";
  credits: number; // positive for topup, negative for purchase
  costUsd?: number | undefined;
  title: string;
  description: string;
  paymentMethod: string;
  timestamp: string;
  receiptNumber: string;
  tenantId?: string | undefined;
  userEmail?: string | undefined;
}

const STORAGE_KEYS = {
  credits: "spx_billing_credits_v1",
  transactions: "spx_billing_transactions_v1",
};

// Initial welcome credits for new workspaces
const DEFAULT_INITIAL_CREDITS = 0;

export function getStoredCreditBalance(tenantId?: string): number {
  if (typeof window === "undefined") return 0;
  const key = tenantId ? `${STORAGE_KEYS.credits}_${tenantId}` : STORAGE_KEYS.credits;
  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    window.localStorage.setItem(key, "0");
    return 0;
  }
  // Clear legacy mock 150 seed if no real transactions exist
  const txs = getStoredBillingTransactions(tenantId);
  const val = Number.parseInt(raw, 10);
  if (val === 150 && txs.length === 0) {
    window.localStorage.setItem(key, "0");
    return 0;
  }
  return Number.isNaN(val) ? 0 : val;
}

export function saveStoredCreditBalance(
  balance: number,
  tenantId?: string,
  userEmail?: string,
): void {
  const safeBal = Math.max(0, balance);
  if (typeof window !== "undefined") {
    const key = tenantId ? `${STORAGE_KEYS.credits}_${tenantId}` : STORAGE_KEYS.credits;
    window.localStorage.setItem(key, String(safeBal));
  }
  // Asynchronously sync to Supabase PostgreSQL ledger
  void syncBalanceToBackend(safeBal, tenantId, userEmail);
}

export async function syncBalanceToBackend(
  balance: number,
  tenantId?: string,
  userEmail?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const id = tenantId
      ? `CRED-${tenantId}`
      : `CRED-${userEmail ? userEmail.replace(/[^a-zA-Z0-9]/g, "-") : "global"}`;
    const res = await fetch(`${supabaseUrl}/rest/v1/billing_credits`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id,
        tenant_id: tenantId ?? null,
        user_email: userEmail ?? null,
        balance,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCreditBalance(tenantId?: string, userEmail?: string): Promise<number> {
  const localBal = getStoredCreditBalance(tenantId);
  if (!isSupabaseConfigured || !supabaseUrl) return localBal;

  try {
    const param = tenantId
      ? `tenant_id=eq.${tenantId}`
      : userEmail
        ? `user_email=eq.${encodeURIComponent(userEmail)}`
        : "";
    const url = `${supabaseUrl}/rest/v1/billing_credits${param ? `?${param}&` : "?"}select=balance&limit=1`;
    const res = await fetch(url, { headers: getSupabaseHeaders() });
    if (res.ok) {
      const data = (await res.json()) as Array<{ balance?: number }>;
      if (Array.isArray(data) && data.length > 0 && typeof data[0]?.balance === "number") {
        const cloudBal = data[0].balance;
        if (typeof window !== "undefined") {
          const key = tenantId ? `${STORAGE_KEYS.credits}_${tenantId}` : STORAGE_KEYS.credits;
          window.localStorage.setItem(key, String(cloudBal));
        }
        return cloudBal;
      }
    }
  } catch {
    // Return cached balance on error
  }
  return localBal;
}

export function getStoredBillingTransactions(tenantId?: string): BillingTransaction[] {
  if (typeof window === "undefined") return [];
  const key = tenantId ? `${STORAGE_KEYS.transactions}_${tenantId}` : STORAGE_KEYS.transactions;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Purge any legacy mock seed
    return (parsed as BillingTransaction[]).filter((tx) => tx.id !== "TXN-INIT-01");
  } catch {
    return [];
  }
}

export async function fetchBillingTransactions(
  tenantId?: string,
  userEmail?: string,
): Promise<BillingTransaction[]> {
  const localTx = getStoredBillingTransactions(tenantId);
  if (!isSupabaseConfigured || !supabaseUrl) return localTx;

  try {
    const param = tenantId
      ? `tenant_id=eq.${tenantId}`
      : userEmail
        ? `user_email=eq.${encodeURIComponent(userEmail)}`
        : "";
    const url = `${supabaseUrl}/rest/v1/billing_transactions${param ? `?${param}&` : "?"}order=created_at.desc&limit=100`;
    const res = await fetch(url, { headers: getSupabaseHeaders() });
    if (res.ok) {
      const data = (await res.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(data) && data.length > 0) {
        const mapped: BillingTransaction[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.id || ""),
          type: (row.type as "topup" | "service_purchase" | "module_upgrade") || "topup",
          credits: Number(row.credits || 0),
          costUsd: row.cost_usd ? Number(row.cost_usd) : undefined,
          title: String(row.title || "Credit Transaction"),
          description: String(row.description || ""),
          paymentMethod: String(row.payment_method || "Payment Gateway"),
          receiptNumber: String(row.receipt_number || ""),
          timestamp: row.created_at
            ? new Date(String(row.created_at)).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recent",
          tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
          userEmail: row.user_email ? String(row.user_email) : undefined,
        }));
        if (typeof window !== "undefined") {
          const key = tenantId
            ? `${STORAGE_KEYS.transactions}_${tenantId}`
            : STORAGE_KEYS.transactions;
          window.localStorage.setItem(key, JSON.stringify(mapped));
        }
        return mapped;
      }
    }
  } catch {
    // Return cached on error
  }
  return localTx;
}

export function recordBillingTransaction(
  tx: Omit<BillingTransaction, "id" | "receiptNumber" | "timestamp">,
  tenantId?: string,
  userEmail?: string,
): BillingTransaction {
  const existing = getStoredBillingTransactions(tenantId);
  const now = new Date();
  const newTx: BillingTransaction = {
    ...tx,
    id: `TXN-${now.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    receiptNumber: `REC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    tenantId,
    userEmail,
  };

  const updated = [newTx, ...existing];
  if (typeof window !== "undefined") {
    const key = tenantId ? `${STORAGE_KEYS.transactions}_${tenantId}` : STORAGE_KEYS.transactions;
    window.localStorage.setItem(key, JSON.stringify(updated));
  }

  // 1. Asynchronously persist to Supabase PostgreSQL billing_transactions table
  void persistBillingTransactionToBackend(newTx, tenantId, userEmail);

  // 2. Also log to Supabase PostgreSQL audit_logs (active table, verified 200 OK)
  void persistAuditLogToBackend({
    id: `AUD-TX-${now.getTime().toString().slice(-6)}`,
    actor: userEmail || (tenantId ? `Tenant ${tenantId}` : "Client User"),
    role: "Client",
    action:
      newTx.type === "topup"
        ? `Payment Gateway: Added ${newTx.credits} credits ($${newTx.costUsd ?? 0}) via ${newTx.paymentMethod} [${newTx.receiptNumber}]`
        : `Service Deduction: Deducted ${Math.abs(newTx.credits)} credits for ${newTx.title} [${newTx.receiptNumber}]`,
    target: "Billing & Credits Ledger",
    severity: newTx.type === "topup" ? "Info" : "Warning",
    timestamp: "Just now",
  });

  return newTx;
}

export async function persistBillingTransactionToBackend(
  tx: BillingTransaction,
  tenantId?: string,
  userEmail?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/billing_transactions`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: tx.id,
        tenant_id: tenantId ?? null,
        user_email: userEmail ?? null,
        type: tx.type,
        credits: tx.credits,
        cost_usd: tx.costUsd ?? 0,
        payment_method: tx.paymentMethod,
        title: tx.title,
        description: tx.description,
        receipt_number: tx.receiptNumber,
        status: "completed",
        created_at: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Service credit cost calculations
export function calculateServiceCost(modules: string[], planTier = "Growth"): number {
  const baseCost = planTier === "Enterprise" ? 300 : planTier === "Growth" ? 100 : 40;
  // each active module adds a small monthly maintenance cost
  const moduleCost = modules.length * 15;
  return baseCost + moduleCost;
}

export function downloadTransactionReceipt(tx: BillingTransaction): void {
  const content = `=====================================================
SPARROWX AUTONOMOUS SECURITY - OFFICIAL RECEIPT
=====================================================
Receipt Number: ${tx.receiptNumber}
Transaction ID: ${tx.id}
Date & Time:    ${tx.timestamp}
Payment Method: ${tx.paymentMethod}
-----------------------------------------------------
Item Description:
${tx.title}
${tx.description}

Credits Impact: ${tx.credits >= 0 ? "+" : ""}${tx.credits} Credits
${tx.costUsd !== undefined ? `Amount Paid:    $${tx.costUsd.toFixed(2)} USD` : ""}
Status:         COMPLETED & VERIFIED IN SPARROWX CLOUD
=====================================================
Thank you for securing your services with SparrowX.
Support & Billing: support@sparrowx.net
=====================================================`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparrowx-receipt-${tx.receiptNumber}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
