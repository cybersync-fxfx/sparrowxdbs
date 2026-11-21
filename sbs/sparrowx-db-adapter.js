const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const ALLOWED_TABLES = new Set(['sbs_users', 'user_profiles', 'threat_radar']);
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const DEFAULT_ADMIN_EMAIL = process.env.SBS_ADMIN_EMAIL || 'admin@sparrowx.sbs';
const DEFAULT_ADMIN_USERNAME = process.env.SBS_ADMIN_USERNAME || 'sparrowx_admin';
const DEFAULT_ADMIN_PASSWORD = process.env.SBS_ADMIN_PASSWORD || 'SparrowX!Admin2026#';

function validateTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Disallowed table name: ${table}`);
  }
  return table;
}

function validateIdentifier(name) {
  const trimmed = String(name || '').trim();
  if (!IDENTIFIER_RE.test(trimmed)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return trimmed;
}

function parseSelectColumns(columns) {
  if (!columns || String(columns).trim() === '*') return '*';
  const parts = String(columns)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (parts.length === 0) return '*';
  return parts.map((col) => `"${validateIdentifier(col)}"`).join(', ');
}

function resolvePoolConfig() {
  const connectionString =
    process.env.SBS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    null;

  if (connectionString) {
    return {
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 15),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  return {
    host: process.env.PGHOST || process.env.POSTGRES_HOST || process.env.SPARROWX_PG_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || process.env.SPARROWX_PG_PORT || 5432),
    database: process.env.SBS_PGDATABASE || process.env.PGDATABASE || process.env.POSTGRES_DB || 'sparrowx_db',
    user: process.env.PGUSER || process.env.POSTGRES_USER || process.env.SPARROWX_PG_USER || 'sparrowx',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.SPARROWX_PG_PASSWORD || '',
    max: Number(process.env.PG_POOL_MAX || 15),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

class SparrowxQueryBuilder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = validateTable(table);
    this.op = 'select';
    this.selectCols = '*';
    this.selectOptions = {};
    this.payload = null;
    this.upsertConflict = null;
    this.filters = [];
    this.orderClauses = [];
    this.limitVal = null;
    this.singleMode = null; // 'single' | 'maybeSingle'
    this.returnSelected = false;
  }

  select(columns = '*', options = {}) {
    if (this.op === 'insert' || this.op === 'update' || this.op === 'upsert' || this.op === 'delete') {
      this.returnSelected = true;
    } else {
      this.op = 'select';
    }
    this.selectCols = parseSelectColumns(columns);
    this.selectOptions = options || {};
    return this;
  }

  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.op = 'upsert';
    this.payload = payload;
    this.upsertConflict = options.onConflict ? validateIdentifier(options.onConflict) : null;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '=', val });
    return this;
  }

  neq(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '<>', val });
    return this;
  }

  gte(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '>=', val });
    return this;
  }

  lte(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '<=', val });
    return this;
  }

  gt(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '>', val });
    return this;
  }

  lt(col, val) {
    this.filters.push({ col: validateIdentifier(col), op: '<', val });
    return this;
  }

  in(col, vals) {
    this.filters.push({ col: validateIdentifier(col), op: 'IN', val: Array.isArray(vals) ? vals : [] });
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderClauses.push(`"${validateIdentifier(col)}" ${ascending ? 'ASC' : 'DESC'}`);
    return this;
  }

  limit(n) {
    const parsed = Number(n);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`Invalid LIMIT value: ${n}`);
    }
    this.limitVal = parsed;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  _buildWhere(params) {
    if (this.filters.length === 0) return '';
    const clauses = this.filters.map((f) => {
      if (f.op === 'IN') {
        if (f.val.length === 0) return 'FALSE';
        const placeholders = f.val.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        return `"${f.col}" IN (${placeholders.join(', ')})`;
      }
      if (f.val === null && f.op === '=') {
        return `"${f.col}" IS NULL`;
      }
      if (f.val === null && f.op === '<>') {
        return `"${f.col}" IS NOT NULL`;
      }
      params.push(f.val);
      return `"${f.col}" ${f.op} $${params.length}`;
    });
    return `WHERE ${clauses.join(' AND ')}`;
  }

  async execute() {
    try {
      const params = [];

      if (this.op === 'select') {
        const whereSql = this._buildWhere(params);
        const orderSql = this.orderClauses.length ? `ORDER BY ${this.orderClauses.join(', ')}` : '';
        const limitSql = this.limitVal !== null ? `LIMIT ${this.limitVal}` : '';
        const wantCount = this.selectOptions && this.selectOptions.count === 'exact';
        const headOnly = Boolean(this.selectOptions && this.selectOptions.head);

        let count = null;
        if (wantCount) {
          const countRes = await this.pool.query(
            `SELECT COUNT(*)::int AS total FROM "${this.table}" ${whereSql}`,
            params
          );
          count = countRes.rows[0]?.total ?? 0;
        }

        if (headOnly) {
          return { data: null, count, error: null };
        }

        const res = await this.pool.query(
          `SELECT ${this.selectCols} FROM "${this.table}" ${whereSql} ${orderSql} ${limitSql}`.trim(),
          params
        );

        if (this.singleMode === 'single') {
          if (res.rows.length === 0) {
            return { data: null, count, error: { message: 'Row not found', code: 'PGRST116' } };
          }
          return { data: res.rows[0], count, error: null };
        }
        if (this.singleMode === 'maybeSingle') {
          return { data: res.rows[0] || null, count, error: null };
        }
        return { data: res.rows, count, error: null };
      }

      if (this.op === 'insert' || this.op === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (rows.length === 0) return { data: [], error: null };
        const cols = Object.keys(rows[0]).map(validateIdentifier);
        const valueGroups = rows.map((row) => {
          const placeholders = cols.map((col) => {
            params.push(row[col] === undefined ? null : row[col]);
            return `$${params.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });
        const colList = cols.map((c) => `"${c}"`).join(', ');
        let conflictSql = '';
        if (this.op === 'upsert' && this.upsertConflict) {
          const updates = cols
            .filter((c) => c !== this.upsertConflict)
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');
          conflictSql = updates
            ? `ON CONFLICT ("${this.upsertConflict}") DO UPDATE SET ${updates}`
            : `ON CONFLICT ("${this.upsertConflict}") DO NOTHING`;
        }
        const returningSql = this.returnSelected ? `RETURNING ${this.selectCols}` : 'RETURNING *';
        const res = await this.pool.query(
          `INSERT INTO "${this.table}" (${colList}) VALUES ${valueGroups.join(', ')} ${conflictSql} ${returningSql}`.trim(),
          params
        );
        const out = this.singleMode ? (res.rows[0] || null) : res.rows;
        return { data: out, error: null };
      }

      if (this.op === 'update') {
        const keys = Object.keys(this.payload || {}).map(validateIdentifier);
        if (keys.length === 0) return { data: [], error: null };
        const setClauses = keys.map((k) => {
          params.push(this.payload[k] === undefined ? null : this.payload[k]);
          return `"${k}" = $${params.length}`;
        });
        const whereSql = this._buildWhere(params);
        const returningSql = this.returnSelected ? `RETURNING ${this.selectCols}` : 'RETURNING *';
        const res = await this.pool.query(
          `UPDATE "${this.table}" SET ${setClauses.join(', ')} ${whereSql} ${returningSql}`.trim(),
          params
        );
        const out = this.singleMode ? (res.rows[0] || null) : res.rows;
        return { data: out, error: null };
      }

      if (this.op === 'delete') {
        const whereSql = this._buildWhere(params);
        const returningSql = this.returnSelected ? `RETURNING ${this.selectCols}` : '';
        const res = await this.pool.query(
          `DELETE FROM "${this.table}" ${whereSql} ${returningSql}`.trim(),
          params
        );
        return { data: res.rows, error: null };
      }

      return { data: null, error: { message: `Unsupported operation: ${this.op}` } };
    } catch (err) {
      return {
        data: null,
        count: null,
        error: {
          message: err.message || 'Database error',
          code: err.code || 'PG_ERROR',
        },
      };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function createSparrowxDb({ pool: customPool, jwtSecret: customJwtSecret } = {}) {
  const pool = customPool || new Pool(resolvePoolConfig());
  const jwtSecret =
    customJwtSecret ||
    process.env.JWT_SECRET ||
    process.env.SPARROWX_JWT_SECRET ||
    'sparrowx-sbs-production-secret-change-me';

  async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sbs_users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_sign_in_at TIMESTAMPTZ
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY REFERENCES sbs_users(id) ON DELETE CASCADE,
        username TEXT UNIQUE,
        email TEXT,
        api_key TEXT UNIQUE NOT NULL,
        agent_id TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'pending',
        tunnel_status TEXT NOT NULL DEFAULT 'disconnected',
        client_ip TEXT,
        tunnel_created_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS threat_radar (
        id BIGSERIAL PRIMARY KEY,
        ip TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        country TEXT,
        abuseipdb_score INTEGER DEFAULT 0,
        action TEXT NOT NULL DEFAULT 'watched',
        target_agent_id TEXT,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threat_radar_ip ON threat_radar (ip);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threat_radar_detected_at ON threat_radar (detected_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threat_radar_target_agent ON threat_radar (target_agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_agent_id ON user_profiles (agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_api_key ON user_profiles (api_key);`);
  }

  async function seedAdminAccount({
    email = DEFAULT_ADMIN_EMAIL,
    username = DEFAULT_ADMIN_USERNAME,
    password = DEFAULT_ADMIN_PASSWORD,
  } = {}) {
    const existing = await pool.query(
      `SELECT u.id, u.email, p.username, p.role, p.status
       FROM sbs_users u
       LEFT JOIN user_profiles p ON p.id = u.id
       WHERE LOWER(u.email) = LOWER($1) OR p.role = 'admin'
       LIMIT 1`,
      [email]
    );

    if (existing.rows.length > 0) {
      return { created: false, user: existing.rows[0] };
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = `spx_${crypto.randomBytes(20).toString('hex')}`;
    const agentId = `spx-${crypto.randomBytes(6).toString('hex')}`;

    await pool.query('BEGIN');
    try {
      await pool.query(
        `INSERT INTO sbs_users (id, email, password_hash, raw_user_meta_data)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [userId, email.toLowerCase(), passwordHash, JSON.stringify({ username })]
      );

      await pool.query(
        `INSERT INTO user_profiles (id, username, email, api_key, agent_id, role, status)
         VALUES ($1, $2, $3, $4, $5, 'admin', 'approved')`,
        [userId, username, email.toLowerCase(), apiKey, agentId]
      );
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    return {
      created: true,
      user: { id: userId, email: email.toLowerCase(), username, role: 'admin', status: 'approved' },
    };
  }

  const auth = {
    async getUser(token) {
      try {
        if (!token) {
          return { data: { user: null }, error: { message: 'Missing access token' } };
        }
        const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
        const decoded = jwt.verify(cleanToken, jwtSecret);
        const res = await pool.query(
          `SELECT id, email, raw_user_meta_data, created_at, last_sign_in_at
           FROM sbs_users WHERE id = $1 LIMIT 1`,
          [decoded.sub]
        );
        if (res.rows.length === 0) {
          return { data: { user: null }, error: { message: 'User not found' } };
        }
        const row = res.rows[0];
        return {
          data: {
            user: {
              id: row.id,
              email: row.email,
              user_metadata: row.raw_user_meta_data || {},
              created_at: row.created_at,
              last_sign_in_at: row.last_sign_in_at,
            },
          },
          error: null,
        };
      } catch (err) {
        return { data: { user: null }, error: { message: err.message || 'Invalid token' } };
      }
    },

    async signUp({ email, password, options = {} }) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { data: { user: null, session: null }, error: { message: 'Valid email address is required.' } };
      }
      if (!password || String(password).length < 6) {
        return { data: { user: null, session: null }, error: { message: 'Password must be at least 6 characters.' } };
      }

      const requestedUsername = String(options?.data?.username || normalizedEmail.split('@')[0])
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 48);

      const passwordHash = await bcrypt.hash(String(password), 12);
      const userId = crypto.randomUUID();
      const apiKey = `sparrow_${crypto.randomBytes(20).toString('hex')}`;
      const agentId = `spx-${crypto.randomBytes(6).toString('hex')}`;

      await pool.query('BEGIN');
      try {
        const dup = await pool.query(
          `SELECT id FROM sbs_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [normalizedEmail]
        );
        if (dup.rows.length > 0) {
          await pool.query('ROLLBACK');
          return { data: { user: null, session: null }, error: { message: 'User already registered with this email.' } };
        }

        const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM user_profiles`);
        const isFirstUser = (countRes.rows[0]?.total ?? 0) === 0;
        const autoApprove = String(process.env.NETSEC_AUTO_APPROVE || '').toLowerCase() === 'true';
        const role = isFirstUser ? 'admin' : 'user';
        const status = (isFirstUser || autoApprove) ? 'approved' : 'pending';

        await pool.query(
          `INSERT INTO sbs_users (id, email, password_hash, raw_user_meta_data)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [userId, normalizedEmail, passwordHash, JSON.stringify({ username: requestedUsername })]
        );

        await pool.query(
          `INSERT INTO user_profiles (id, username, email, api_key, agent_id, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, requestedUsername, normalizedEmail, apiKey, agentId, role, status]
        );
        await pool.query('COMMIT');

        const user = {
          id: userId,
          email: normalizedEmail,
          user_metadata: { username: requestedUsername },
        };

        const session = status === 'approved'
          ? {
              access_token: jwt.sign(
                { sub: userId, email: normalizedEmail, role },
                jwtSecret,
                { expiresIn: '7d', issuer: 'sparrowx-db' }
              ),
              token_type: 'bearer',
              user,
            }
          : null;

        return { data: { user, session }, error: null };
      } catch (err) {
        await pool.query('ROLLBACK');
        return { data: { user: null, session: null }, error: { message: err.message || 'Registration failed.' } };
      }
    },

    async signInWithPassword({ email, password }) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return { data: { user: null, session: null }, error: { message: 'Email and password are required.' } };
      }

      try {
        const res = await pool.query(
          `SELECT u.id, u.email, u.password_hash, u.raw_user_meta_data, p.role, p.status
           FROM sbs_users u
           LEFT JOIN user_profiles p ON p.id = u.id
           WHERE LOWER(u.email) = LOWER($1) OR LOWER(p.username) = LOWER($1)
           LIMIT 1`,
          [normalizedEmail]
        );

        if (res.rows.length === 0) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }

        const row = res.rows[0];
        const valid = await bcrypt.compare(String(password), row.password_hash);
        if (!valid) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }

        await pool.query(`UPDATE sbs_users SET last_sign_in_at = NOW() WHERE id = $1`, [row.id]);

        const user = {
          id: row.id,
          email: row.email,
          user_metadata: row.raw_user_meta_data || {},
        };

        const accessToken = jwt.sign(
          { sub: row.id, email: row.email, role: row.role || 'user' },
          jwtSecret,
          { expiresIn: '7d', issuer: 'sparrowx-db' }
        );

        return {
          data: {
            user,
            session: {
              access_token: accessToken,
              token_type: 'bearer',
              user,
            },
          },
          error: null,
        };
      } catch (err) {
        return { data: { user: null, session: null }, error: { message: err.message || 'Login failed.' } };
      }
    },
  };

  function from(table) {
    return new SparrowxQueryBuilder(pool, table);
  }

  async function healthCheck() {
    const start = Date.now();
    await pool.query('SELECT 1');
    return {
      ok: true,
      engine: 'sparrowx-postgresql',
      latencyMs: Date.now() - start,
    };
  }

  return {
    pool,
    auth,
    from,
    ensureSchema,
    seedAdminAccount,
    healthCheck,
  };
}

module.exports = {
  createSparrowxDb,
  SparrowxQueryBuilder,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
};
