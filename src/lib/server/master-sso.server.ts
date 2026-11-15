/**
 * Server-side Master Portal SSO and PostgreSQL user verification.
 * Signs and validates HMAC-SHA256 `spx_master_sso` cookies scoped to `.sparrowx.net`
 * so logging in on the Master Portal authenticates linked subdomains (`netsec.sparrowx.net`,
 * `db.sparrowx.net`, etc.) and binds the caller to their Developer Connection.
 */
import pg from "pg";
import { env } from "./config.server";
import { hmacSha256Hex, timingSafeEqual } from "./crypto.server";
import { hashSecretPassword, verifyPasswordMatch } from "../password-digest";

const { Pool } = pg;

export const MASTER_SSO_COOKIE_NAME = "spx_master_sso";
export const MASTER_SSO_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface MasterSsoUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  tenantId: string | null;
}

export interface MasterSsoClaims {
  sub: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  tenantId: string | null;
  iat: number;
  exp: number;
}

function getMasterSsoSecret(): string {
  return (
    env("SPARROWX_MASTER_SSO_SECRET") ||
    env("SPARROWX_JWT_SECRET") ||
    env("JWT_SECRET") ||
    env("SESSION_SECRET") ||
    "sparrowx_jwt_secret_key_32_characters_2026"
  );
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Creates an HMAC-SHA256 signed Master SSO token (`<payloadB64Url>.<sigHex>`). */
export async function createMasterSsoToken(
  user: MasterSsoUser,
  ttlSeconds = MASTER_SSO_TTL_SECONDS,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: MasterSsoClaims = {
    sub: user.id,
    email: user.email.trim().toLowerCase(),
    fullName: user.fullName || user.email.split("@")[0] || "Developer",
    role: user.role === "admin" ? "admin" : "client",
    tenantId: user.tenantId ?? null,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const payloadB64 = toBase64Url(JSON.stringify(claims));
  const sig = await hmacSha256Hex(getMasterSsoSecret(), payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Verifies an HMAC-SHA256 Master SSO token and enforces expiration. */
export async function verifyMasterSsoToken(token: string | null | undefined): Promise<MasterSsoClaims | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !sigHex) return null;

  const expectedSig = await hmacSha256Hex(getMasterSsoSecret(), payloadB64);
  if (!timingSafeEqual(sigHex.toLowerCase(), expectedSig.toLowerCase())) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64)) as Partial<MasterSsoClaims>;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed.sub || !parsed.email || typeof parsed.exp !== "number" || parsed.exp <= nowSec) {
      return null;
    }
    return {
      sub: String(parsed.sub),
      email: String(parsed.email).trim().toLowerCase(),
      fullName: String(parsed.fullName || parsed.email.split("@")[0] || "Developer"),
      role: parsed.role === "admin" ? "admin" : "client",
      tenantId: parsed.tenantId ? String(parsed.tenantId) : null,
      iat: typeof parsed.iat === "number" ? parsed.iat : nowSec,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function extractCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key !== name) continue;
    const raw = part.slice(eqIdx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Reads and validates `spx_master_sso` from Cookie, Authorization Bearer, or `sso_token` query param. */
export async function readMasterSsoFromRequest(request: Request): Promise<MasterSsoClaims | null> {
  const cookieToken = extractCookieValue(request.headers.get("cookie"), MASTER_SSO_COOKIE_NAME);
  if (cookieToken) {
    const claims = await verifyMasterSsoToken(cookieToken);
    if (claims) return claims;
  }

  const headerToken = request.headers.get("x-sparrowx-master-sso")?.trim();
  if (headerToken) {
    const claims = await verifyMasterSsoToken(headerToken);
    if (claims) return claims;
  }

  return null;
}

export function resolveMasterCookieDomain(request: Request): string | undefined {
  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    new URL(request.url).hostname;
  const host = rawHost.split(":")[0]?.toLowerCase() ?? "";
  if (host === "sparrowx.net" || host.endsWith(".sparrowx.net")) {
    return ".sparrowx.net";
  }
  return undefined;
}

export function buildMasterSsoCookieHeader(
  request: Request,
  token: string,
  maxAgeSeconds = MASTER_SSO_TTL_SECONDS,
): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = forwardedProto === "https" || new URL(request.url).protocol === "https:";
  const domain = resolveMasterCookieDomain(request);
  const attrs = [
    `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (domain) attrs.push(`Domain=${domain}`);
  if (isHttps) attrs.push("Secure");
  return attrs.join("; ");
}

async function openMasterAuthPool(): Promise<pg.Pool> {
  const host =
    env("POSTGRES_HOST") ||
    env("PGHOST") ||
    (process.env.NODE_ENV === "production" ? "postgres" : "127.0.0.1");
  const port = Number(env("POSTGRES_PORT") || env("PGPORT") || 5432);
  const user = env("POSTGRES_USER") || env("PGUSER") || "sparrowx";
  const password = env("POSTGRES_PASSWORD") || env("PGPASSWORD") || "sparrowx_ovh_secret_2026";
  const database = env("POSTGRES_DB") || env("PGDATABASE") || "sparrowx_db";

  const primary = new Pool({ host, port, user, password, database, connectionTimeoutMillis: 2500, max: 3 });
  try {
    await primary.query("SELECT 1");
    return primary;
  } catch (err) {
    await primary.end().catch(() => {});
    if (host !== "127.0.0.1") {
      const fallback = new Pool({
        host: "127.0.0.1",
        port,
        user,
        password,
        database,
        connectionTimeoutMillis: 2500,
        max: 3,
      });
      await fallback.query("SELECT 1");
      return fallback;
    }
    throw err;
  }
}

async function ensureAppUsersTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.app_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      admin TEXT NOT NULL DEFAULT 'no',
      tenant_id TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/**
 * Verifies credentials directly against PostgreSQL (`public.app_users` and, if present,
 * `public.user_profiles` created on NetSec) so Master Portal login and NetSec login
 * share one sovereign PostgreSQL credential store.
 */
export async function authenticateMasterCredentialsInDb(input: {
  email: string;
  password: string;
  registerIfMissing?: {
    id?: string;
    fullName?: string;
    tenantId?: string | null;
  };
}): Promise<{ user: MasterSsoUser | null; source: "postgres" | "postgrest" | "none" }> {
  const emailClean = input.email.trim().toLowerCase();
  if (!emailClean || !input.password) return { user: null, source: "none" };

  try {
    const pool = await openMasterAuthPool();
    try {
      await ensureAppUsersTable(pool);

      const appRes = await pool.query<{
        id: string;
        email: string;
        password: string;
        full_name: string | null;
        admin: string | null;
        tenant_id: string | null;
      }>(
        `SELECT id, email, password, full_name, admin, tenant_id
           FROM public.app_users
          WHERE LOWER(email) = $1
          LIMIT 1`,
        [emailClean],
      );

      const row = appRes.rows[0];
      if (row) {
        let verified = verifyPasswordMatch(input.password, row.password || "");
        if (!verified && isBcryptHash(row.password || "")) {
          const cryptCheck = await pool
            .query<{ ok: boolean }>(`SELECT (crypt($1, $2) = $2) AS ok`, [input.password, row.password])
            .catch(() => ({ rows: [{ ok: false }] }));
          verified = Boolean(cryptCheck.rows[0]?.ok);
        }
        if (verified) {
          return {
            source: "postgres",
            user: {
              id: row.id,
              email: row.email.trim().toLowerCase(),
              fullName: row.full_name || row.email.split("@")[0] || "Developer",
              role: String(row.admin || "no").toLowerCase() === "yes" ? "admin" : "client",
              tenantId: row.tenant_id || null,
            },
          };
        }
      }

      // Check NetSec user_profiles in PostgreSQL so NetSec-registered accounts also authenticate on Master
      const profileCheck = await pool
        .query<{
          id: string;
          username: string;
          email: string | null;
          password_hash: string | null;
          master_user_id: string | null;
          tenant_id: string | null;
          role: string | null;
          status: string | null;
        }>(
          `SELECT id::text, username, email, password_hash, master_user_id, tenant_id, role, status
             FROM public.user_profiles
            WHERE LOWER(COALESCE(email, '')) = $1 OR LOWER(username) = $1
            LIMIT 1`,
          [emailClean],
        )
        .catch(() => ({ rows: [] }));

      const profile = profileCheck.rows[0];
      if (profile && profile.status !== "rejected" && profile.password_hash) {
        let ok = verifyPasswordMatch(input.password, profile.password_hash);
        if (!ok && isBcryptHash(profile.password_hash)) {
          const cryptCheck = await pool
            .query<{ ok: boolean }>(`SELECT (crypt($1, $2) = $2) AS ok`, [
              input.password,
              profile.password_hash,
            ])
            .catch(() => ({ rows: [{ ok: false }] }));
          ok = Boolean(cryptCheck.rows[0]?.ok);
        }
        if (ok) {
          return {
            source: "postgres",
            user: {
              id: profile.master_user_id || profile.id,
              email: (profile.email || emailClean).toLowerCase(),
              fullName: profile.username,
              role: profile.role === "admin" ? "admin" : "client",
              tenantId: profile.tenant_id || null,
            },
          };
        }
      }

      // If client-side registration just created the account and browser PostgREST sync hasn't landed yet,
      // persist into public.app_users when no conflicting email exists.
      if (!row && input.registerIfMissing) {
        const anyExisting = await pool.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt FROM public.app_users`,
        );
        const isFirstUser = Number(anyExisting.rows[0]?.cnt ?? 0) === 0;
        const userId =
          input.registerIfMissing.id || `USR-${Date.now().toString().slice(-6)}`;
        const fullName =
          input.registerIfMissing.fullName?.trim() || emailClean.split("@")[0] || "Developer";
        const roleAdmin = isFirstUser ? "yes" : "no";
        const digest = hashSecretPassword(input.password);
        const inserted = await pool.query<{
          id: string;
          email: string;
          full_name: string;
          admin: string;
          tenant_id: string | null;
        }>(
          `INSERT INTO public.app_users (id, email, password, full_name, admin, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO NOTHING
           RETURNING id, email, full_name, admin, tenant_id`,
          [userId, emailClean, digest, fullName, roleAdmin, input.registerIfMissing.tenantId ?? null],
        );
        const created = inserted.rows[0];
        if (created) {
          return {
            source: "postgres",
            user: {
              id: created.id,
              email: created.email,
              fullName: created.full_name,
              role: created.admin === "yes" ? "admin" : "client",
              tenantId: created.tenant_id,
            },
          };
        }
      }
    } finally {
      await pool.end().catch(() => {});
    }
  } catch {
    // Fallback to PostgREST when direct Postgres socket is unreachable (e.g. REST-only edge worker)
  }

  const pgrstUrl = env("POSTGREST_INTERNAL_URL") || env("POSTGREST_URL") || env("SPARROWX_DB_REST_URL");
  if (pgrstUrl) {
    try {
      const res = await fetch(
        `${pgrstUrl.replace(/\/+$/, "")}/app_users?email=ilike.${encodeURIComponent(emailClean)}&limit=1`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(2000) },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        const r = rows[0];
        if (r && verifyPasswordMatch(input.password, String(r.password ?? ""))) {
          return {
            source: "postgrest",
            user: {
              id: String(r.id ?? ""),
              email: String(r.email ?? emailClean).toLowerCase(),
              fullName: String(r.full_name ?? emailClean.split("@")[0] ?? "Developer"),
              role: String(r.admin ?? "no").toLowerCase() === "yes" ? "admin" : "client",
              tenantId: r.tenant_id ? String(r.tenant_id) : null,
            },
          };
        }
      }
    } catch {
      // Ignore unreachable PostgREST
    }
  }

  return { user: null, source: "none" };
}
