/**
 * Coordinates the signed cross-subdomain Master SSO session (`spx_master_sso`)
 * and automatic PostgreSQL Developer Database connection provisioning when a
 * developer logs in or registers on the Master Page (`sparrowx.net`).
 */

export interface DeveloperDbConnectionInfo {
  id?: string;
  tenantId?: string;
  userEmail?: string;
  projectName?: string;
  planId?: string;
  planName?: string;
  dbName: string;
  dbUser: string;
  dbPassword?: string;
  dbHost: string;
  dbPort: number;
  connectionString?: string;
  sizePretty?: string;
  activeConnections?: number;
  maxConnections?: number;
  storageLimitMb?: number;
  status?: string;
  apiEndpoint?: string;
}

export const DEVELOPER_CONNECTION_EVENT = "sparrowx:developer-connection";
const CONNECTION_STORAGE_PREFIX = "sparrowx_provisioned_db_";

function emitConnectionUpdate(info: DeveloperDbConnectionInfo | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEVELOPER_CONNECTION_EVENT, { detail: info }));
}

export function getCachedDeveloperConnection(
  tenantId?: string | null,
  email?: string | null,
): DeveloperDbConnectionInfo | null {
  if (typeof window === "undefined") return null;
  const candidates = [
    tenantId ? `${CONNECTION_STORAGE_PREFIX}${tenantId}` : "",
    email ? `${CONNECTION_STORAGE_PREFIX}${email.trim().toLowerCase()}` : "",
  ].filter(Boolean);

  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DeveloperDbConnectionInfo;
        if (parsed && parsed.dbName) return parsed;
      }
    } catch {
      // Ignore malformed cache entries
    }
  }
  return null;
}

export function cacheDeveloperConnection(
  info: DeveloperDbConnectionInfo,
  tenantId?: string | null,
  email?: string | null,
): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(info);
  const keys = new Set<string>();
  if (tenantId) keys.add(`${CONNECTION_STORAGE_PREFIX}${tenantId}`);
  if (info.tenantId && info.tenantId !== "-") keys.add(`${CONNECTION_STORAGE_PREFIX}${info.tenantId}`);
  if (email) keys.add(`${CONNECTION_STORAGE_PREFIX}${email.trim().toLowerCase()}`);

  for (const key of keys) {
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      // Ignore storage quota errors
    }
  }
  emitConnectionUpdate(info);
}

/** Issues an HttpOnly `.sparrowx.net` Master SSO cookie bound to the verified PostgreSQL account. */
export async function syncMasterSsoSession(input: {
  email: string;
  password: string;
  mode?: "signin" | "register";
  id?: string;
  fullName?: string;
  tenantId?: string | null;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/auth/master-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Revokes the `.sparrowx.net` Master SSO cookie on sign out. */
export async function clearMasterSsoSession(): Promise<void> {
  if (typeof window === "undefined") return;
  emitConnectionUpdate(null);
  try {
    await fetch("/api/auth/master-sso", {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Best-effort cookie clear
  }
}

export interface HydratedMasterSsoUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  tenantId: string | null;
}

/** Reads the active `.sparrowx.net` HttpOnly Master SSO session (e.g. after Google OAuth sign-in). */
export async function fetchMasterSsoUser(): Promise<HydratedMasterSsoUser | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/master-sso", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      authenticated?: boolean;
      user?: HydratedMasterSsoUser;
    };
    if (data.ok && data.authenticated && data.user?.email) {
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches the signed-in developer's live PostgreSQL connection via `/api/db/summary`
 * or automatically provisions a dedicated PostgreSQL database via `/api/db/provision`
 * when none exists yet for their tenant/email.
 */
export async function ensureDeveloperConnection(user: {
  id: string;
  email: string;
  fullName?: string | null;
  tenantId?: string | null;
  projectName?: string;
}): Promise<DeveloperDbConnectionInfo | null> {
  if (typeof window === "undefined") return null;
  const cleanEmail = user.email.trim().toLowerCase();
  if (!cleanEmail) return null;

  const tenantId =
    user.tenantId?.trim() ||
    `TNT-${cleanEmail.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "DEV"}`;
  const existingCached = getCachedDeveloperConnection(tenantId, cleanEmail);

  try {
    const summaryUrl = `/api/db/summary?email=${encodeURIComponent(cleanEmail)}&tenantId=${encodeURIComponent(tenantId)}`;
    const summaryRes = await fetch(summaryUrl, {
      credentials: "include",
      cache: "no-store",
    });

    if (summaryRes.ok) {
      const summaryData = (await summaryRes.json()) as {
        ok?: boolean;
        databases?: DeveloperDbConnectionInfo[];
      };
      const match =
        summaryData.databases?.find(
          (db) =>
            db.userEmail?.toLowerCase() === cleanEmail || db.tenantId === tenantId,
        ) || summaryData.databases?.[0];

      if (match) {
        const merged: DeveloperDbConnectionInfo = {
          ...existingCached,
          ...match,
          connectionString:
            existingCached?.dbName === match.dbName && existingCached?.connectionString
              ? existingCached.connectionString
              : `postgresql://${match.dbUser}@${match.dbHost}:${match.dbPort}/${match.dbName}?sslmode=require`,
          apiEndpoint: `${window.location.origin}/rest/v1`,
        };
        cacheDeveloperConnection(merged, tenantId, cleanEmail);
        return merged;
      }
    }

    const provisionRes = await fetch("/api/db/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        tenantId,
        userId: user.id || `USR-${Date.now().toString().slice(-6)}`,
        email: cleanEmail,
        projectName: user.projectName || `${user.fullName || cleanEmail.split("@")[0]} Workspace`,
      }),
    });

    if (provisionRes.ok) {
      const provData = (await provisionRes.json()) as {
        ok?: boolean;
        database?: DeveloperDbConnectionInfo;
      };
      if (provData.ok && provData.database) {
        const connected: DeveloperDbConnectionInfo = {
          ...provData.database,
          tenantId,
          userEmail: cleanEmail,
          apiEndpoint: `${window.location.origin}/rest/v1`,
        };
        cacheDeveloperConnection(connected, tenantId, cleanEmail);
        return connected;
      }
    }
  } catch {
    // Preserve cached developer connection metadata when cluster is temporarily unreachable
  }

  return existingCached;
}

/** Builds the launch URL for the NetSec DDoS dashboard (`netsec.sparrowx.net`) with SSO handoff. */
export function getNetsecSsoUrl(options?: { autoSso?: boolean }): string {
  const autoSso = options?.autoSso !== false;
  const suffix = autoSso ? "/login?sso=master" : "/login";
  if (typeof window === "undefined") {
    return `https://netsec.sparrowx.net${suffix}`;
  }
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return `http://localhost:3006${suffix}`;
  }
  const rootDomain = host.replace(/^(www|db|studio|sec|shield|game|game-web|game-dash|api|rest|file|drop|share|password|passwd|pass|keys|netsec|gamesec)\./, "");
  return `https://netsec.${rootDomain || "sparrowx.net"}${suffix}`;
}
