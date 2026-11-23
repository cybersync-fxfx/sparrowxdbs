/**
 * Unified Email Verification Engine (PostgreSQL + In-Memory Fallback)
 * Generates CSPRNG 6-digit OTPs & signed magic-link tokens, stores only SHA-256 hashes,
 * enforces 60s resend cooldown + max 5 attempts + 15-minute TTL, and updates `public.app_users`.
 */
import crypto from "node:crypto";
import pg from "pg";
import { env } from "./config.server";
import { timingSafeEqual } from "./crypto.server";
import {
  buildVerificationEmailTemplate,
  getSmtpConfig,
  sendSmtpEmail,
} from "./email.server";

const { Pool } = pg;

export const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const MAX_VERIFICATION_ATTEMPTS = 5;

interface MemoryVerificationRecord {
  id: string;
  userId: string | null;
  email: string;
  codeHash: string;
  tokenHash: string;
  expiresAt: number;
  consumedAt: number | null;
  attempts: number;
  createdAt: number;
}

const memoryRecords = new Map<string, MemoryVerificationRecord>();
const memoryVerifiedEmails = new Set<string>();

let verifPool: pg.Pool | null = null;
let verifSchemaEnsured = false;

function getVerifPgPool(): pg.Pool | null {
  const host = env("POSTGRES_HOST") || "";
  const user = env("POSTGRES_USER") || "";
  const password = env("POSTGRES_PASSWORD") || "";
  const database = env("POSTGRES_DB") || "";
  if (!host && !env("DATABASE_URL")) return null;

  if (!verifPool) {
    const connStr = env("DATABASE_URL");
    verifPool = connStr
      ? new Pool({ connectionString: connStr, max: 4, connectionTimeoutMillis: 3000 })
      : new Pool({
          host: host || "127.0.0.1",
          port: Number(env("POSTGRES_PORT") || env("PG_HOST_PORT") || 5432),
          user: user || "sparrowx",
          password: password || "",
          database: database || "sparrowx_db",
          max: 4,
          connectionTimeoutMillis: 3000,
        });
  }
  return verifPool;
}

async function ensureVerificationSchema(pool: pg.Pool): Promise<void> {
  if (verifSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE public.app_users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS public.email_verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT NULL,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ DEFAULT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_email_verif_email_created
      ON public.email_verification_codes (LOWER(email), created_at DESC);
  `);
  verifSchemaEnsured = true;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isEmailVerifiedInDb(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  if (memoryVerifiedEmails.has(email)) return true;

  const pool = getVerifPgPool();
  if (!pool) return false;
  try {
    await ensureVerificationSchema(pool);
    const res = await pool.query<{ email_verified: boolean }>(
      `SELECT email_verified FROM public.app_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    const verified = Boolean(res.rows[0]?.email_verified);
    if (verified) memoryVerifiedEmails.add(email);
    return verified;
  } catch {
    return false;
  }
}

export async function issueAndSendEmailVerification(params: {
  email: string;
  fullName?: string | undefined;
  userId?: string | null | undefined;
  serviceName?: string | undefined;
  origin?: string | undefined;
  force?: boolean | undefined;
}): Promise<{
  ok: boolean;
  delivered: boolean;
  smtpConfigured: boolean;
  expiresInSeconds: number;
  retryAfterSeconds?: number | undefined;
  error?: string | undefined;
}> {
  const email = normalizeEmail(params.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      delivered: false,
      smtpConfigured: getSmtpConfig().configured,
      expiresInSeconds: 0,
      error: "Please enter a valid email address.",
    };
  }

  const now = Date.now();
  const existingMem = memoryRecords.get(email);
  if (!params.force && existingMem && now - existingMem.createdAt < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existingMem.createdAt)) / 1000);
    return {
      ok: false,
      delivered: false,
      smtpConfigured: getSmtpConfig().configured,
      expiresInSeconds: Math.max(0, Math.floor((existingMem.expiresAt - now) / 1000)),
      retryAfterSeconds,
      error: `Verification email already sent. Please wait ${retryAfterSeconds}s before resending.`,
    };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const token = crypto.randomBytes(24).toString("hex");
  const codeHash = sha256Hex(`${email}:${code}`);
  const tokenHash = sha256Hex(`${email}:${token}`);
  const id = `ev_${crypto.randomBytes(10).toString("hex")}`;
  const expiresAt = now + VERIFICATION_TTL_MS;

  const memRec: MemoryVerificationRecord = {
    id,
    userId: params.userId ?? null,
    email,
    codeHash,
    tokenHash,
    expiresAt,
    consumedAt: null,
    attempts: 0,
    createdAt: now,
  };
  memoryRecords.set(email, memRec);

  const pool = getVerifPgPool();
  if (pool) {
    try {
      await ensureVerificationSchema(pool);
      if (!params.force) {
        const recent = await pool.query<{ created_at: Date }>(
          `SELECT created_at FROM public.email_verification_codes
           WHERE LOWER(email) = LOWER($1) AND consumed_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [email],
        );
        const lastTs = recent.rows[0]?.created_at?.getTime() ?? 0;
        if (lastTs > 0 && now - lastTs < RESEND_COOLDOWN_MS) {
          const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastTs)) / 1000);
          return {
            ok: false,
            delivered: false,
            smtpConfigured: getSmtpConfig().configured,
            expiresInSeconds: Math.floor(VERIFICATION_TTL_MS / 1000),
            retryAfterSeconds,
            error: `Verification email already sent. Please wait ${retryAfterSeconds}s before resending.`,
          };
        }
      }

      await pool.query(
        `INSERT INTO public.email_verification_codes (id, user_id, email, code_hash, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6 / 1000.0))`,
        [id, params.userId ?? null, email, codeHash, tokenHash, expiresAt],
      );
    } catch (dbErr) {
      console.warn("[EmailVerification] PostgreSQL store unavailable, using memory store:", dbErr);
    }
  }

  const domain = env("SPARROWX_DOMAIN") || "sparrowx.net";
  const baseOrigin = (params.origin || `https://${domain}`).replace(/\/+$/, "");
  const verifyUrl = `${baseOrigin}/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const tpl = buildVerificationEmailTemplate({
    fullName: params.fullName || email.split("@")[0] || "Developer",
    code,
    verifyUrl,
    serviceName: params.serviceName || "SparrowX Sovereign Cloud",
    domain,
  });

  const mailRes = await sendSmtpEmail({
    to: email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });

  return {
    ok: true,
    delivered: mailRes.delivered,
    smtpConfigured: mailRes.smtpConfigured,
    expiresInSeconds: Math.floor(VERIFICATION_TTL_MS / 1000),
    retryAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    ...(mailRes.error ? { error: mailRes.error } : {}),
  };
}

export async function verifyEmailCodeOrToken(params: {
  email: string;
  code?: string | undefined;
  token?: string | undefined;
}): Promise<{ ok: boolean; verified: boolean; email: string; error?: string }> {
  const email = normalizeEmail(params.email);
  const cleanCode = (params.code || "").replace(/\s+/g, "");
  const cleanToken = (params.token || "").trim();

  if (!email || (!cleanCode && !cleanToken)) {
    return {
      ok: false,
      verified: false,
      email,
      error: "Email and verification code (or link token) are required.",
    };
  }

  const expectedHash = cleanCode
    ? sha256Hex(`${email}:${cleanCode}`)
    : sha256Hex(`${email}:${cleanToken}`);
  const now = Date.now();

  const pool = getVerifPgPool();
  if (pool) {
    try {
      await ensureVerificationSchema(pool);
      const res = await pool.query<{
        id: string;
        code_hash: string;
        token_hash: string;
        expires_at: Date;
        attempts: number;
      }>(
        `SELECT id, code_hash, token_hash, expires_at, attempts
         FROM public.email_verification_codes
         WHERE LOWER(email) = LOWER($1) AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [email],
      );
      const row = res.rows[0];
      if (row) {
        if (row.expires_at.getTime() < now) {
          return {
            ok: false,
            verified: false,
            email,
            error: "Verification code expired. Please request a new code.",
          };
        }
        if (row.attempts >= MAX_VERIFICATION_ATTEMPTS) {
          return {
            ok: false,
            verified: false,
            email,
            error: "Too many failed attempts. Please request a fresh verification code.",
          };
        }
        const storedHash = cleanCode ? row.code_hash : row.token_hash;
        if (!timingSafeEqual(storedHash, expectedHash)) {
          await pool.query(
            `UPDATE public.email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
            [row.id],
          );
          return {
            ok: false,
            verified: false,
            email,
            error: "Invalid verification code. Please check your inbox and try again.",
          };
        }

        await pool.query(
          `UPDATE public.email_verification_codes SET consumed_at = NOW() WHERE id = $1`,
          [row.id],
        );
        await pool.query(
          `UPDATE public.app_users
           SET email_verified = TRUE, email_verified_at = NOW()
           WHERE LOWER(email) = LOWER($1)`,
          [email],
        );
        memoryVerifiedEmails.add(email);
        memoryRecords.delete(email);
        return { ok: true, verified: true, email };
      }
    } catch (dbErr) {
      console.warn("[EmailVerification] Falling back to memory verifier:", dbErr);
    }
  }

  // Fallback to in-memory verification store (dev/test or PG offline)
  const mem = memoryRecords.get(email);
  if (!mem || mem.consumedAt !== null) {
    return {
      ok: false,
      verified: false,
      email,
      error: "No active verification code found. Please click Resend Code.",
    };
  }
  if (mem.expiresAt < now) {
    return {
      ok: false,
      verified: false,
      email,
      error: "Verification code expired. Please request a new code.",
    };
  }
  if (mem.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return {
      ok: false,
      verified: false,
      email,
      error: "Too many failed attempts. Please request a fresh verification code.",
    };
  }
  const storedHash = cleanCode ? mem.codeHash : mem.tokenHash;
  if (!timingSafeEqual(storedHash, expectedHash)) {
    mem.attempts += 1;
    return {
      ok: false,
      verified: false,
      email,
      error: "Invalid verification code. Please check your inbox and try again.",
    };
  }

  mem.consumedAt = now;
  memoryVerifiedEmails.add(email);
  return { ok: true, verified: true, email };
}

/** Test-only helper to clear memory store cleanly between test runs. */
export function resetEmailVerificationMemoryForTests(): void {
  memoryRecords.clear();
  memoryVerifiedEmails.clear();
}
