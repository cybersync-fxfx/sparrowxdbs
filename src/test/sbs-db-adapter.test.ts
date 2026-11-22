import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  createSparrowxDb,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
} = require('../../sbs/sparrowx-db-adapter.js');

type MockQueryResult = {
  rows: Record<string, unknown>[];
  rowCount?: number;
};

type MockQueryFn = (sql: string, params?: unknown[]) => Promise<MockQueryResult>;

function makeMockPool(queryImpl?: MockQueryFn) {
  return {
    query: vi.fn(queryImpl ?? (async () => ({ rows: [], rowCount: 0 }))),
  };
}

describe('SparrowX SBS PostgreSQL DB Adapter', () => {
  it('validates allowed tables and rejects SQL injection identifiers', async () => {
    const pool = makeMockPool();
    const db = createSparrowxDb({ pool, jwtSecret: 'test-secret-key' });

    expect(() => db.from('users; DROP TABLE sbs_users;--')).toThrow(/Disallowed table name/);
    expect(() => db.from('user_profiles').eq('id; --', '123')).toThrow(/Invalid SQL identifier/);
  });

  it('builds parameterized SELECT queries with count and head options', async () => {
    const pool = makeMockPool(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ total: 42 }], rowCount: 1 };
      }
      return { rows: [{ id: 1, ip: '1.2.3.4' }], rowCount: 1 };
    });

    const db = createSparrowxDb({ pool, jwtSecret: 'test-secret-key' });

    const headRes = await db
      .from('threat_radar')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'banned')
      .gte('detected_at', '2026-01-01T00:00:00Z');

    expect(headRes.error).toBeNull();
    expect(headRes.data).toBeNull();
    expect(headRes.count).toBe(42);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*)::int AS total FROM "threat_radar" WHERE "action" = $1 AND "detected_at" >= $2'),
      ['banned', '2026-01-01T00:00:00Z']
    );

    const listRes = await db
      .from('threat_radar')
      .select('id, ip')
      .eq('ip', '1.2.3.4')
      .order('detected_at', { ascending: false })
      .limit(20);

    expect(listRes.error).toBeNull();
    expect(listRes.data).toEqual([{ id: 1, ip: '1.2.3.4' }]);
  });

  it('registers, hashes password with bcrypt, logs in, and verifies JWT via getUser', async () => {
    const users = new Map<
      unknown,
      {
        id: unknown;
        email: string;
        password_hash: string;
        raw_user_meta_data: unknown;
        created_at: string;
      }
    >();
    const profiles = new Map<unknown, Record<string, unknown>>();

    const pool = makeMockPool(async (sql: string, params: unknown[] = []) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM sbs_users WHERE LOWER(email)')) {
        const target = String(params[0] ?? '').toLowerCase();
        const found = [...users.values()].find((u) => u.email === target);
        return { rows: found ? [found] : [] };
      }
      if (sql.includes('SELECT COUNT(*)::int AS total FROM user_profiles')) {
        return { rows: [{ total: profiles.size }] };
      }
      if (sql.startsWith('INSERT INTO sbs_users')) {
        const [id, email, password_hash, rawMeta] = params;
        users.set(id, {
          id,
          email: String(email ?? ''),
          password_hash: String(password_hash ?? ''),
          raw_user_meta_data: JSON.parse(String(rawMeta ?? '{}')),
          created_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO user_profiles')) {
        const [id, username, email, api_key, agent_id, role, status] = params;
        profiles.set(id, { id, username, email, api_key, agent_id, role, status });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM sbs_users u') && sql.includes('LEFT JOIN user_profiles p')) {
        const target = String(params[0] ?? '').toLowerCase();
        const u = [...users.values()].find((x) => {
          const p = profiles.get(x.id);
          return x.email === target || String(p?.username ?? '').toLowerCase() === target;
        });
        if (!u) return { rows: [] };
        const p = profiles.get(u.id);
        return { rows: [{ ...u, role: p?.role, status: p?.status }] };
      }
      if (sql.startsWith('UPDATE sbs_users SET last_sign_in_at')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM sbs_users WHERE id = $1')) {
        const u = users.get(params[0]);
        return { rows: u ? [u] : [] };
      }
      return { rows: [] };
    });

    const db = createSparrowxDb({ pool, jwtSecret: 'unit-test-secret' });

    const reg = await db.auth.signUp({
      email: 'operator@sparrowx.sbs',
      password: 'StrongPassword123!',
      options: { data: { username: 'operator' } },
    });

    expect(reg.error).toBeNull();
    expect(reg.data.user.email).toBe('operator@sparrowx.sbs');
    // First user is automatically promoted to approved admin
    expect(reg.data.session?.access_token).toBeTruthy();

    const storedUser = [...users.values()][0];
    expect(storedUser).toBeDefined();
    expect(storedUser!.password_hash).not.toBe('StrongPassword123!');
    expect(storedUser!.password_hash.startsWith('$2')).toBe(true);

    const badLogin = await db.auth.signInWithPassword({
      email: 'operator@sparrowx.sbs',
      password: 'WrongPassword!',
    });
    expect(badLogin.error?.message).toBe('Invalid login credentials');

    const goodLogin = await db.auth.signInWithPassword({
      email: 'operator@sparrowx.sbs',
      password: 'StrongPassword123!',
    });
    expect(goodLogin.error).toBeNull();
    expect(goodLogin.data.session?.access_token).toBeTruthy();

    const usernameLogin = await db.auth.signInWithPassword({
      email: 'operator',
      password: 'StrongPassword123!',
    });
    expect(usernameLogin.error).toBeNull();
    expect(usernameLogin.data.session?.access_token).toBeTruthy();

    const verified = await db.auth.getUser(goodLogin.data.session?.access_token ?? '');
    expect(verified.error).toBeNull();
    expect(verified.data.user.email).toBe('operator@sparrowx.sbs');
  });

  it('seeds the default approved admin account idempotently', async () => {
    const inserted: Array<{ id: unknown; username: unknown; email: unknown; role: string; status: string }> = [];
    const pool = makeMockPool(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('WHERE LOWER(u.email)')) {
        return { rows: inserted[0] ? [inserted[0]] : [] };
      }
      if (sql.startsWith('INSERT INTO user_profiles')) {
        inserted.push({ id: params[0], username: params[1], email: params[2], role: 'admin', status: 'approved' });
      }
      return { rows: [] };
    });

    const db = createSparrowxDb({ pool, jwtSecret: 'unit-test-secret' });

    const first = await db.seedAdminAccount();
    expect(first.created).toBe(true);
    expect(first.user.email).toBe(DEFAULT_ADMIN_EMAIL);
    expect(first.user.role).toBe('admin');
    expect(first.user.status).toBe('approved');
    expect(DEFAULT_ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(12);

    const second = await db.seedAdminAccount();
    expect(second.created).toBe(false);
  });

  it('reports healthCheck ok when PostgreSQL responds', async () => {
    const pool = makeMockPool(async () => ({ rows: [{ '?column?': 1 }] }));
    const db = createSparrowxDb({ pool, jwtSecret: 'unit-test-secret' });

    const health = await db.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.engine).toBe('sparrowx-postgresql');
  });
});
