// PostgREST data access (HTTP), safe for the edge runtime. Configure POSTGREST_URL (+ POSTGREST_API_KEY JWT).
import { env } from "./config.server";
import type { Subscription, Transaction, TxType } from "../portal-types";
import type { ServiceId } from "../services";

export type ClientRow = {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  email: string | null;
  ptero_user_id: number | null;
  ptero_username: string | null;
  ptero_password_enc: string | null;
  coins: number;
  created_at: string;
};

type SubRow = {
  id: string;
  client_id: string;
  ptero_server_id: number | null;
  service_type: ServiceId;
  plan_name: string;
  price_coins: number;
  status: Subscription["status"];
  expires_at: string;
  created_at: string;
};

type TxRow = { id: string; client_id: string; amount: number; type: TxType; description: string; created_at: string };

export class DbError extends Error {
  constructor(public status: number, public body: string) {
    super(`Database request failed [${status}]: ${body}`);
  }
}

async function pg<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const base = env("POSTGREST_URL");
  if (!base) throw new Error("POSTGREST_URL is not configured");
  const key = env("POSTGREST_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${base.replace(/\/+$/, "")}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PostgREST ${init.method ?? "GET"} ${path} [${res.status}]: ${text}`);
    throw new DbError(res.status, text);
  }
  return (text ? JSON.parse(text) : null) as T;
}

const q = encodeURIComponent;

export async function findClientByDiscordId(discordId: string): Promise<ClientRow | null> {
  const rows = await pg<ClientRow[]>(`/clients?discord_id=eq.${q(discordId)}&limit=1`);
  return rows[0] ?? null;
}

export async function getClient(id: string): Promise<ClientRow | null> {
  const rows = await pg<ClientRow[]>(`/clients?id=eq.${q(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function insertClient(row: Omit<ClientRow, "id" | "created_at" | "coins">): Promise<ClientRow> {
  const rows = await pg<ClientRow[]>(`/clients`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation",
  });
  const first = rows[0];
  if (!first) throw new Error("Failed to insert client row");
  return first;
}

export async function updateClient(id: string, patch: Partial<ClientRow>): Promise<ClientRow> {
  const rows = await pg<ClientRow[]>(`/clients?id=eq.${q(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    prefer: "return=representation",
  });
  const first = rows[0];
  if (!first) throw new Error("Failed to update client row");
  return first;
}

/** Atomic debit (SQL function). Throws DbError with "insufficient_coins" when the balance is too low. */
export async function spendCoins(clientId: string, amount: number, description: string): Promise<number> {
  return pg<number>(`/rpc/spend_coins`, {
    method: "POST",
    body: JSON.stringify({ p_client_id: clientId, p_amount: amount, p_description: description }),
  });
}

/** Idempotent credit: a repeated reference is ignored. Returns the balance and whether it was applied. */
export async function creditCoins(
  clientId: string,
  amount: number,
  type: TxType,
  description: string,
  reference: string | null,
): Promise<{ balance: number; applied: boolean }> {
  const rows = await pg<{ balance: number; applied: boolean }[]>(`/rpc/credit_coins`, {
    method: "POST",
    body: JSON.stringify({
      p_client_id: clientId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_reference: reference,
    }),
  });
  if (Array.isArray(rows)) {
    const first = rows[0];
    if (!first) throw new Error("credit_coins returned empty array");
    return first;
  }
  return rows as unknown as { balance: number; applied: boolean };
}

export async function listTransactions(clientId: string, limit = 25): Promise<Transaction[]> {
  const rows = await pg<TxRow[]>(`/coin_transactions?client_id=eq.${q(clientId)}&order=created_at.desc&limit=${limit}`);
  return rows.map((r) => ({ id: r.id, amount: r.amount, type: r.type, description: r.description, createdAt: r.created_at }));
}

export async function listSubscriptions(clientId: string): Promise<Subscription[]> {
  const rows = await pg<SubRow[]>(`/subscriptions?client_id=eq.${q(clientId)}&order=created_at.desc`);
  return rows.map(subFromRow);
}

export async function insertSubscription(row: Omit<SubRow, "id" | "created_at">): Promise<Subscription> {
  const rows = await pg<SubRow[]>(`/subscriptions`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation",
  });
  const first = rows[0];
  if (!first) throw new Error("Failed to insert subscription row");
  return subFromRow(first);
}

export async function findPromo(code: string): Promise<{ code: string; coins: number } | null> {
  const rows = await pg<{ code: string; coins: number }[]>(
    `/promo_codes?code=eq.${q(code)}&active=is.true&select=code,coins&limit=1`,
  );
  return rows[0] ?? null;
}

function subFromRow(r: SubRow): Subscription {
  return {
    id: r.id,
    pteroServerId: r.ptero_server_id,
    serviceType: r.service_type,
    planName: r.plan_name,
    priceCoins: r.price_coins,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}
