/**
 * Sovereign PostgreSQL compatibility & Master SSO bridge for SparrowX NetSec.
 * Replaces unreachable cloud Supabase REST/GoTrue calls when PostgreSQL env
 * vars are present, while keeping the exact `.from(...)` and `.auth.*` surface
 * used across `server.js` and `radar-scanner.js`.
 */
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const MASTER_SSO_COOKIE_NAME = 'spx_master_sso';
const DEFAULT_SHARED_SECRET = 'sparrowx_jwt_secret_key_32_characters_2026';
const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;

let activePool = null;
let schemaReadyPromise = null;

function isPgConfigured(env = process.env) {
  return Boolean(
    env.DATABASE_URL ||
    env.POSTGRES_HOST ||
    env.PGHOST ||
    env.POSTGRES_DB ||
    env.PGDATABASE
  );
}

function getJwtSecret(env = process.env) {
  return (
    env.SPARROWX_JWT_SECRET ||
    env.JWT_SECRET ||
    env.SESSION_SECRET ||
    env.SUPABASE_JWT_SECRET ||
    DEFAULT_SHARED_SECRET
  );
}

function getMasterSsoSecret(env = process.env) {
  return env.SPARROWX_MASTER_SSO_SECRET || getJwtSecret(env);
}

function shouldAutoApprove(env = process.env) {
  if (String(env.NETSEC_REQUIRE_APPROVAL || '').toLowerCase() === 'true') return false;
  if (String(env.NETSEC_AUTO_APPROVE || '').toLowerCase() === 'false') return false;
  return true;
}

/** Matches `hashSecretPassword` in `sparrowxdbs/src/lib/password-digest.ts`. */
function hashSecretPassword(password) {
  if (!password) return '';
  if (password.startsWith('spx_digest$')) return password;
  const salted = `sparrowx_zero_trust_salt_v1::${password}`;
  let h1 = 0xdeadbeef ^ salted.length;
  let h2 = 0x41c6ce57 ^ salted.length;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const digest = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return `spx_digest$${digest}`;
}

function verifyMasterDigestMatch(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  const cleanInput = String(inputPassword).trim();
  const cleanStored = String(storedPassword).trim();
  return (
    cleanStored === hashSecretPassword(inputPassword) ||
    cleanStored === hashSecretPassword(cleanInput) ||
    cleanStored === inputPassword ||
    cleanStored === cleanInput
  );
}

async function verifyAnyPassword(inputPassword, candidates = []) {
  for (const stored of candidates) {
    if (!stored || typeof stored !== 'string') continue;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      try {
        if (await bcrypt.compare(inputPassword, stored)) return true;
      } catch {
        // Ignore malformed bcrypt hash and continue checking fallbacks
      }
    } else if (verifyMasterDigestMatch(inputPassword, stored)) {
      return true;
    }
  }
  return false;
}

function buildPoolCandidates(env = process.env) {
  const useSsl =
    String(env.PGSSLMODE || '').toLowerCase() === 'require' ||
    String(env.POSTGRES_SSL || '').toLowerCase() === 'true';
  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  if (env.DATABASE_URL) {
    return [{ connectionString: env.DATABASE_URL, ssl, connectionTimeoutMillis: 4000, max: 10 }];
  }

  const primaryHost = env.POSTGRES_HOST || env.PGHOST || 'sparrowx-postgres';
  const port = Number(env.POSTGRES_PORT || env.PGPORT || 5432);
  const user = env.POSTGRES_USER || env.PGUSER || 'sparrowx';
  const password = env.POSTGRES_PASSWORD || env.PGPASSWORD || 'sparrowx_ovh_secret_2026';
  const database = env.POSTGRES_DB || env.PGDATABASE || 'sparrowx_db';

  const hosts = [primaryHost];
  if (primaryHost === 'sparrowx-postgres') hosts.push('postgres');
  if (primaryHost !== 'host.docker.internal' && primaryHost !== '127.0.0.1' && primaryHost !== 'localhost') {
    hosts.push('host.docker.internal');
  }
  if (primaryHost !== '127.0.0.1' && primaryHost !== 'localhost') hosts.push('127.0.0.1');

  return hosts.map((host) => ({
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectionTimeoutMillis: 4000,
    max: 10,
  }));
}

async function getPool() {
  if (activePool) return activePool;
  const candidates = buildPoolCandidates();
  let lastError = null;
  for (const cfg of candidates) {
    const pool = new Pool(cfg);
    try {
      await pool.query('SELECT 1');
      activePool = pool;
      return activePool;
    } catch (err) {
      lastError = err;
      await pool.end().catch(() => {});
    }
  }
  throw lastError || new Error('Unable to connect to PostgreSQL');
}

async function query(sql, params = []) {
  const pool = await getPool();
  return pool.query(sql, params);
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const pool = await getPool();
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;').catch(() => {});

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        master_user_id TEXT,
        tenant_id TEXT,
        api_key TEXT UNIQUE NOT NULL,
        agent_id TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'approved',
        tunnel_status TEXT DEFAULT 'inactive',
        client_ip TEXT,
        tunnel_created_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE public.user_profiles
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS master_user_id TEXT,
        ADD COLUMN IF NOT EXISTS tenant_id TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (LOWER(email));`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_agent_id ON public.user_profiles (agent_id);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.threat_radar (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        reason TEXT DEFAULT '',
        country TEXT DEFAULT '',
        abuseipdb_score INTEGER DEFAULT 0,
        action TEXT DEFAULT 'watched',
        target_ip TEXT,
        target_agent_id TEXT,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE public.threat_radar
        ADD COLUMN IF NOT EXISTS target_ip TEXT,
        ADD COLUMN IF NOT EXISTS target_agent_id TEXT;
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threat_radar_ip ON public.threat_radar (ip);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threat_radar_detected_at ON public.threat_radar (detected_at DESC);`);

    // Idempotently seed the default approved admin account so operator sign-in works immediately
    try {
      const adminEmail = String(process.env.SPARROWX_ADMIN_EMAIL || 'cybersync790@gmail.com').trim().toLowerCase();
      const adminUser = String(process.env.SPARROWX_ADMIN_USERNAME || 'cybersync').trim();
      const adminPass = String(process.env.SPARROWX_ADMIN_PASSWORD || 'SparrowX#Admin2026!').trim();
      if (adminEmail && adminPass) {
        const existingAdmin = await pool.query(
          `SELECT id, role, status, password_hash FROM public.user_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1`,
          [adminEmail, adminUser]
        );
        if (existingAdmin.rowCount === 0) {
          const hash = await bcrypt.hash(adminPass, 10);
          const apiKey = 'spx_' + crypto.randomBytes(16).toString('hex');
          const agentId = 'agent_' + crypto.randomBytes(6).toString('hex');
          await pool.query(
            `INSERT INTO public.user_profiles (username, email, password_hash, api_key, agent_id, role, status)
             VALUES ($1, $2, $3, $4, $5, 'admin', 'approved')
             ON CONFLICT DO NOTHING`,
            [adminUser, adminEmail, hash, apiKey, agentId]
          );
        } else {
          const row = existingAdmin.rows[0];
          if (row.role !== 'admin' || row.status !== 'approved' || !row.password_hash) {
            const hash = row.password_hash || (await bcrypt.hash(adminPass, 10));
            await pool.query(
              `UPDATE public.user_profiles SET role = 'admin', status = 'approved', email = COALESCE(email, $1), password_hash = $2, updated_at = NOW() WHERE id = $3`,
              [adminEmail, hash, row.id]
            );
          }
        }
      }
    } catch {
      // Non-fatal seed check
    }
    return true;
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}

function assertIdent(name, kind = 'identifier') {
  const clean = String(name || '').trim();
  if (!IDENT_RE.test(clean)) {
    throw new Error(`Invalid SQL ${kind}: ${name}`);
  }
  return `"${clean}"`;
}

function formatSelectColumns(selectCols) {
  const raw = String(selectCols || '*').trim();
  if (!raw || raw === '*') return '*';
  return raw
    .split(',')
    .map((part) => assertIdent(part, 'column'))
    .join(', ');
}

function sanitizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  delete copy.password_hash;
  return copy;
}

class PgQueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.selectCols = '*';
    this.selectOpts = {};
    this.payload = null;
    this.returnRows = false;
    this.filters = [];
    this.orderBy = null;
    this.limitCount = null;
    this.singleMode = false;
    this.maybeSingleMode = false;
  }

  select(cols = '*', opts = {}) {
    if (this.action === 'insert' || this.action === 'update' || this.action === 'delete') {
      this.returnRows = true;
    } else {
      this.action = 'select';
    }
    this.selectCols = cols || '*';
    this.selectOpts = opts || {};
    return this;
  }

  insert(payload) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(col, val) {
    this.filters.push({ op: '=', col, val });
    return this;
  }

  neq(col, val) {
    this.filters.push({ op: '<>', col, val });
    return this;
  }

  gte(col, val) {
    this.filters.push({ op: '>=', col, val });
    return this;
  }

  gt(col, val) {
    this.filters.push({ op: '>', col, val });
    return this;
  }

  lte(col, val) {
    this.filters.push({ op: '<=', col, val });
    return this;
  }

  lt(col, val) {
    this.filters.push({ op: '<', col, val });
    return this;
  }

  order(col, opts = {}) {
    this.orderBy = { col, ascending: opts.ascending !== false };
    return this;
  }

  limit(n) {
    const parsed = Number(n);
    if (Number.isFinite(parsed) && parsed > 0) this.limitCount = Math.floor(parsed);
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    return this;
  }

  buildWhereClause(params) {
    if (this.filters.length === 0) return '';
    const parts = this.filters.map((f) => {
      const colSql = assertIdent(f.col, 'column');
      if (f.val === null) {
        return f.op === '<>' ? `${colSql} IS NOT NULL` : `${colSql} IS NULL`;
      }
      params.push(f.val);
      return `${colSql} ${f.op} $${params.length}`;
    });
    return ` WHERE ${parts.join(' AND ')}`;
  }

  async execute() {
    try {
      await ensureSchema();
      const tableSql = `public.${assertIdent(this.table, 'table')}`;
      const params = [];

      if (this.action === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const first = rows[0] || {};
        const cols = Object.keys(first);
        if (cols.length === 0) throw new Error('Insert payload cannot be empty');
        const colListSql = cols.map((c) => assertIdent(c, 'column')).join(', ');
        const valuesClauses = rows.map((row) => {
          const placeholders = cols.map((col) => {
            params.push(row[col] === undefined ? null : row[col]);
            return `$${params.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });
        const returningSql = this.returnRows ? ` RETURNING ${formatSelectColumns(this.selectCols)}` : '';
        const sql = `INSERT INTO ${tableSql} (${colListSql}) VALUES ${valuesClauses.join(', ')}${returningSql}`;
        const result = await query(sql, params);
        const sanitized = result.rows.map(sanitizeRow);
        if (this.singleMode || this.maybeSingleMode) {
          return { data: sanitized[0] || null, count: result.rowCount, error: null };
        }
        return { data: this.returnRows ? sanitized : null, count: result.rowCount, error: null };
      }

      if (this.action === 'update') {
        const entries = Object.entries(this.payload || {}).filter(([, v]) => v !== undefined);
        if (entries.length === 0) throw new Error('Update payload cannot be empty');
        const setClauses = entries.map(([col, val]) => {
          params.push(val);
          return `${assertIdent(col, 'column')} = $${params.length}`;
        });
        if (this.table === 'user_profiles' && !entries.some(([c]) => c === 'updated_at')) {
          setClauses.push(`"updated_at" = NOW()`);
        }
        const whereSql = this.buildWhereClause(params);
        const returningSql = this.returnRows ? ` RETURNING ${formatSelectColumns(this.selectCols)}` : '';
        const sql = `UPDATE ${tableSql} SET ${setClauses.join(', ')}${whereSql}${returningSql}`;
        const result = await query(sql, params);
        const sanitized = result.rows.map(sanitizeRow);
        if (this.singleMode || this.maybeSingleMode) {
          return { data: sanitized[0] || null, count: result.rowCount, error: null };
        }
        return { data: this.returnRows ? sanitized : null, count: result.rowCount, error: null };
      }

      if (this.action === 'delete') {
        const whereSql = this.buildWhereClause(params);
        const returningSql = this.returnRows ? ` RETURNING ${formatSelectColumns(this.selectCols)}` : '';
        const sql = `DELETE FROM ${tableSql}${whereSql}${returningSql}`;
        const result = await query(sql, params);
        const sanitized = result.rows.map(sanitizeRow);
        return { data: this.returnRows ? sanitized : null, count: result.rowCount, error: null };
      }

      // SELECT
      const whereSql = this.buildWhereClause(params);
      if (this.selectOpts.head === true) {
        const countSql = `SELECT COUNT(*)::int AS cnt FROM ${tableSql}${whereSql}`;
        const countRes = await query(countSql, params);
        return { data: null, count: Number(countRes.rows[0]?.cnt || 0), error: null };
      }

      const colListSql = formatSelectColumns(this.selectCols);
      const orderSql = this.orderBy
        ? ` ORDER BY ${assertIdent(this.orderBy.col, 'column')} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`
        : '';
      const limitSql = this.limitCount !== null ? ` LIMIT ${this.limitCount}` : '';
      const sql = `SELECT ${colListSql} FROM ${tableSql}${whereSql}${orderSql}${limitSql}`;
      const result = await query(sql, params);
      const sanitized = result.rows.map(sanitizeRow);

      let totalCount = null;
      if (this.selectOpts.count === 'exact') {
        const countRes = await query(`SELECT COUNT(*)::int AS cnt FROM ${tableSql}${whereSql}`, params);
        totalCount = Number(countRes.rows[0]?.cnt || 0);
      }

      if (this.singleMode) {
        if (sanitized.length === 0) {
          return { data: null, count: totalCount, error: { message: 'Row not found' } };
        }
        return { data: sanitized[0], count: totalCount, error: null };
      }
      if (this.maybeSingleMode) {
        return { data: sanitized[0] || null, count: totalCount, error: null };
      }
      return { data: sanitized, count: totalCount, error: null };
    } catch (err) {
      return { data: null, count: null, error: { message: err.message, code: err.code } };
    }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
}

function issueSessionToken(profile, extra = {}) {
  const payload = {
    sub: profile.id,
    email: profile.email || `${profile.username}@sparrowx.net`,
    username: profile.username,
    role: profile.role || 'user',
    tenantId: profile.tenant_id || extra.tenantId || null,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(rawVal);
    } catch {
      out[key] = rawVal;
    }
  }
  return out;
}

/**
 * Verifies the cross-subdomain `.sparrowx.net` HMAC-SHA256 cookie `spx_master_sso`
 * emitted by the Master Portal (`/api/auth/master-sso`).
 */
function verifyMasterSsoCookieValue(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !sigHex) return null;

  const expectedSig = crypto
    .createHmac('sha256', getMasterSsoSecret())
    .update(payloadB64)
    .digest('hex');

  const sigBuf = Buffer.from(sigHex.toLowerCase(), 'utf8');
  const expectedBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payloadB64.length + 3) % 4);
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed || !parsed.sub || !parsed.email || typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function generateAgentCredentials() {
  return {
    apiKey: 'spx_' + crypto.randomBytes(16).toString('hex'),
    agentId: 'agent_' + crypto.randomBytes(6).toString('hex'),
  };
}

function deriveSafeUsername(preferred, email) {
  const base = String(preferred || (email ? email.split('@')[0] : 'operator') || 'operator')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 32);
  return base || `user_${crypto.randomBytes(3).toString('hex')}`;
}

async function allocateUniqueUsername(baseUsername) {
  const clean = deriveSafeUsername(baseUsername, '');
  const existing = await query('SELECT 1 FROM public.user_profiles WHERE LOWER(username) = LOWER($1) LIMIT 1', [clean]);
  if (existing.rowCount === 0) return clean;
  return `${clean.slice(0, 24)}_${crypto.randomBytes(2).toString('hex')}`;
}

/**
 * Ensures an authenticated SparrowX Master user has an approved NetSec profile + agent credentials.
 */
async function resolveOrCreateMasterProfile(claims) {
  await ensureSchema();
  const cleanEmail = String(claims.email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Master SSO claims missing email');

  const existing = await query(
    `SELECT * FROM public.user_profiles WHERE LOWER(email) = LOWER($1) OR master_user_id = $2 LIMIT 1`,
    [cleanEmail, String(claims.sub)]
  );

  const desiredRole = claims.role === 'admin' ? 'admin' : null;
  if (existing.rows.length > 0) {
    let profile = existing.rows[0];
    const nextRole = desiredRole === 'admin' ? 'admin' : profile.role;
    const nextStatus = profile.status === 'rejected' ? 'rejected' : 'approved';
    const upd = await query(
      `UPDATE public.user_profiles
          SET master_user_id = COALESCE($1, master_user_id),
              tenant_id = COALESCE($2, tenant_id),
              email = COALESCE(email, $3),
              role = $4,
              status = $5,
              updated_at = NOW()
        WHERE id = $6
        RETURNING *`,
      [String(claims.sub), claims.tenantId || null, cleanEmail, nextRole, nextStatus, profile.id]
    );
    profile = upd.rows[0] || profile;
    if (profile.status === 'rejected') {
      const err = new Error('Account rejected.');
      err.statusCode = 403;
      throw err;
    }
    const sanitized = sanitizeRow(profile);
    return {
      profile: sanitized,
      token: issueSessionToken(sanitized, { tenantId: claims.tenantId || profile.tenant_id || null }),
    };
  }

  const countRes = await query('SELECT COUNT(*)::int AS cnt FROM public.user_profiles');
  const isFirst = Number(countRes.rows[0]?.cnt || 0) === 0;
  const role = isFirst || claims.role === 'admin' ? 'admin' : 'user';
  const username = await allocateUniqueUsername(claims.fullName || cleanEmail.split('@')[0]);
  const { apiKey, agentId } = generateAgentCredentials();

  const ins = await query(
    `INSERT INTO public.user_profiles
      (username, email, password_hash, master_user_id, tenant_id, api_key, agent_id, role, status)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'approved')
     RETURNING *`,
    [username, cleanEmail, String(claims.sub), claims.tenantId || null, apiKey, agentId, role]
  );
  const sanitized = sanitizeRow(ins.rows[0]);
  return {
    profile: sanitized,
    token: issueSessionToken(sanitized, { tenantId: claims.tenantId || null }),
  };
}

/** Reads the operator's linked Developer Database metadata from `public.provisioned_databases` if present. */
async function getDeveloperDbSummary(email, tenantId = null) {
  try {
    await ensureSchema();
    const regCheck = await query(`SELECT to_regclass('public.provisioned_databases') AS tbl`);
    if (!regCheck.rows[0]?.tbl) return null;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanTenant = tenantId ? String(tenantId).trim() : null;
    if (!cleanEmail && !cleanTenant) return null;

    const res = await query(
      `SELECT id, tenant_id, user_email, project_name, plan_id, storage_limit_mb,
              max_connections, db_name, db_user, db_host, db_port, status, updated_at
         FROM public.provisioned_databases
        WHERE ($1 <> '' AND LOWER(user_email) = LOWER($1))
           OR ($2 IS NOT NULL AND tenant_id = $2)
        ORDER BY created_at ASC`,
      [cleanEmail, cleanTenant]
    );

    if (res.rows.length === 0) {
      return { connected: false, count: 0, primary: null };
    }
    const row = res.rows[0];
    return {
      connected: true,
      count: res.rows.length,
      primary: {
        id: row.id,
        tenantId: row.tenant_id,
        projectName: row.project_name,
        planId: row.plan_id,
        dbName: row.db_name,
        dbUser: row.db_user,
        dbHost: row.db_host,
        dbPort: row.db_port,
        status: row.status,
        storageLimitMb: row.storage_limit_mb,
        maxConnections: row.max_connections,
      },
    };
  } catch {
    return null;
  }
}

async function syncMasterAppUser({ email, password, fullName, isAdmin, tenantId }) {
  try {
    const existing = await query('SELECT id, tenant_id, admin FROM public.app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    const digest = hashSecretPassword(password);
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (!row.password && digest) {
        await query('UPDATE public.app_users SET password = $1 WHERE id = $2', [digest, row.id]);
      }
      return { masterUserId: row.id, tenantId: row.tenant_id || tenantId || null };
    }
    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const resolvedTenant = tenantId || `ten_${crypto.randomBytes(4).toString('hex')}`;
    await query(
      `INSERT INTO public.app_users (id, email, password, full_name, admin, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [id, email, digest, fullName, isAdmin ? 'yes' : 'no', resolvedTenant]
    );
    return { masterUserId: id, tenantId: resolvedTenant };
  } catch {
    return { masterUserId: null, tenantId: tenantId || null };
  }
}

const pgAuth = {
  async signUp({ email, password, options = {} }) {
    try {
      await ensureSchema();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return { data: null, error: { message: 'Email and password are required.' } };
      }
      const preferredUsername = options?.data?.username || cleanEmail.split('@')[0];
      const safeUsername = deriveSafeUsername(preferredUsername, cleanEmail);

      const dup = await query(
        `SELECT email, username FROM public.user_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1`,
        [cleanEmail, safeUsername]
      );
      if (dup.rows.length > 0) {
        const conflict = dup.rows[0];
        const msg =
          conflict.email && conflict.email.toLowerCase() === cleanEmail
            ? 'An account with this email already exists.'
            : 'That operator username is already taken.';
        return { data: null, error: { message: msg } };
      }

      const countRes = await query('SELECT COUNT(*)::int AS cnt FROM public.user_profiles');
      const isFirstUser = Number(countRes.rows[0]?.cnt || 0) === 0;
      const role = isFirstUser ? 'admin' : 'user';
      const status = isFirstUser || shouldAutoApprove() ? 'approved' : 'pending';
      const passwordHash = await bcrypt.hash(String(password), 10);
      const { apiKey, agentId } = generateAgentCredentials();

      const masterLink = await syncMasterAppUser({
        email: cleanEmail,
        password: String(password),
        fullName: safeUsername,
        isAdmin: isFirstUser,
        tenantId: null,
      });

      const ins = await query(
        `INSERT INTO public.user_profiles
          (username, email, password_hash, master_user_id, tenant_id, api_key, agent_id, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          safeUsername,
          cleanEmail,
          passwordHash,
          masterLink.masterUserId,
          masterLink.tenantId,
          apiKey,
          agentId,
          role,
          status,
        ]
      );

      const profile = sanitizeRow(ins.rows[0]);
      const session = status === 'approved' ? { access_token: issueSessionToken(profile) } : null;
      return {
        data: {
          user: { id: profile.id, email: profile.email, user_metadata: { username: profile.username } },
          profile,
          session,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: { message: err.message || 'Registration failed' } };
    }
  },

  async signInWithPassword({ email, password }) {
    try {
      await ensureSchema();
      const identifier = String(email || '').trim();
      if (!identifier || !password) {
        return { data: null, error: { message: 'Email/username and password are required.' } };
      }

      const profileRes = await query(
        `SELECT * FROM public.user_profiles
          WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
          LIMIT 1`,
        [identifier]
      );

      if (profileRes.rows.length > 0) {
        const row = profileRes.rows[0];
        let masterRow = null;
        if (row.email) {
          const m = await query('SELECT id, email, password, full_name, admin, tenant_id FROM public.app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [row.email]);
          masterRow = m.rows[0] || null;
        }
        const ok = await verifyAnyPassword(String(password), [row.password_hash, masterRow?.password]);
        if (!ok) {
          return { data: null, error: { message: 'Invalid login credentials' } };
        }
        const profile = sanitizeRow(row);
        if (!profile.tenant_id && masterRow?.tenant_id) {
          await query('UPDATE public.user_profiles SET tenant_id = $1, master_user_id = COALESCE(master_user_id, $2) WHERE id = $3', [
            masterRow.tenant_id,
            masterRow.id,
            profile.id,
          ]);
          profile.tenant_id = masterRow.tenant_id;
        }
        const token = issueSessionToken(profile);
        return {
          data: {
            user: { id: profile.id, email: profile.email || `${profile.username}@sparrowx.net` },
            session: { access_token: token },
          },
          error: null,
        };
      }

      // Allow seamless first-time NetSec login using existing SparrowX Master (`app_users`) credentials
      const masterRes = await query(
        'SELECT id, email, password, full_name, admin, tenant_id FROM public.app_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [identifier]
      );
      if (masterRes.rows.length === 0) {
        return { data: null, error: { message: 'Invalid login credentials' } };
      }
      const mUser = masterRes.rows[0];
      const masterOk = await verifyAnyPassword(String(password), [mUser.password]);
      if (!masterOk) {
        return { data: null, error: { message: 'Invalid login credentials' } };
      }

      const provisioned = await resolveOrCreateMasterProfile({
        sub: mUser.id,
        email: mUser.email,
        fullName: mUser.full_name || mUser.email.split('@')[0],
        role: mUser.admin === 'yes' ? 'admin' : 'client',
        tenantId: mUser.tenant_id || null,
      });

      return {
        data: {
          user: { id: provisioned.profile.id, email: provisioned.profile.email },
          session: { access_token: provisioned.token },
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: { message: err.message || 'Authentication failed' } };
    }
  },

  async getUser(token) {
    try {
      await ensureSchema();
      if (!token) return { data: { user: null }, error: { message: 'No token provided' } };
      const decoded = jwt.verify(String(token), getJwtSecret());
      if (!decoded || !decoded.sub) {
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }
      const res = await query('SELECT id, email, username, role, tenant_id FROM public.user_profiles WHERE id = $1 LIMIT 1', [
        decoded.sub,
      ]);
      if (res.rows.length === 0) {
        return { data: { user: null }, error: { message: 'User not found' } };
      }
      const u = res.rows[0];
      return {
        data: {
          user: {
            id: u.id,
            email: u.email || `${u.username}@sparrowx.net`,
            username: u.username,
            role: u.role,
            tenantId: u.tenant_id || null,
          },
        },
        error: null,
      };
    } catch (err) {
      return { data: { user: null }, error: { message: err.message || 'Invalid token' } };
    }
  },
};

function createPgCompatClient() {
  return {
    from(table) {
      return new PgQueryBuilder(table);
    },
    auth: pgAuth,
  };
}

module.exports = {
  MASTER_SSO_COOKIE_NAME,
  isPgConfigured,
  getPool,
  ensureSchema,
  createPgCompatClient,
  hashSecretPassword,
  parseCookies,
  verifyMasterSsoCookieValue,
  resolveOrCreateMasterProfile,
  getDeveloperDbSummary,
};
