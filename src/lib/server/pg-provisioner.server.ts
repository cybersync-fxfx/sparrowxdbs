import { randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const SAFE_PG_IDENTIFIER_RE = /^[a-z][a-z0-9_]{2,54}$/;

export interface ProvisionDbRequest {
  tenantId: string;
  userId: string;
  email: string;
  projectName?: string | undefined;
}

export interface ProvisionedDbResult {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  dbPort: number;
  connectionString: string;
  createdAt: string;
}

export interface ProvisionedDbSummaryItem {
  id: string;
  tenantId: string;
  userEmail: string;
  dbName: string;
  dbUser: string;
  dbHost: string;
  dbPort: number;
  sizePretty: string;
  activeConnections: number;
  status: string;
  createdAt: string;
}

export interface ProvisionedDbSummaryResponse {
  totalUsers: number;
  totalProvisionedDbs: number;
  databases: ProvisionedDbSummaryItem[];
}

function sanitizePgSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 32) || "tenant";
}

function assertSafePgIdentifier(name: string): string {
  if (!SAFE_PG_IDENTIFIER_RE.test(name)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${name}`);
  }
  return name;
}

function escapeSqlLiteral(val: string): string {
  return val.replace(/'/g, "''");
}

function getPgAdminConfig() {
  const host =
    process.env.POSTGRES_HOST ||
    process.env.PGHOST ||
    (process.env.NODE_ENV === "production" ? "postgres" : "127.0.0.1");
  const port = Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432);
  const user = process.env.POSTGRES_USER || process.env.PGUSER || "sparrowx";
  const password =
    process.env.POSTGRES_PASSWORD ||
    process.env.PGPASSWORD ||
    "sparrowx_ovh_secret_2026";
  const database =
    process.env.POSTGRES_DB || process.env.PGDATABASE || "sparrowx_db";

  return { host, port, user, password, database };
}

function getPublicDbEndpoint() {
  const domain = process.env.SPARROWX_DOMAIN || "sparrowx.net";
  const host =
    process.env.SPARROWX_DB_PUBLIC_HOST ||
    (domain !== "localhost" ? `db.${domain}` : "127.0.0.1");
  const port = Number(process.env.PG_HOST_PORT || 5432);
  return { host, port };
}

async function openAdminPool(targetDatabase?: string): Promise<pg.Pool> {
  const cfg = getPgAdminConfig();
  const db = targetDatabase || cfg.database;
  const primary = new Pool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: db,
    connectionTimeoutMillis: 3000,
    max: 4,
  });

  try {
    await primary.query("SELECT 1");
    return primary;
  } catch (err) {
    await primary.end().catch(() => {});
    if (cfg.host !== "127.0.0.1") {
      const fallback = new Pool({
        host: "127.0.0.1",
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: db,
        connectionTimeoutMillis: 3000,
        max: 4,
      });
      try {
        await fallback.query("SELECT 1");
        return fallback;
      } catch {
        await fallback.end().catch(() => {});
      }
    }
    throw err;
  }
}

async function ensureProvisionRegistryTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.provisioned_databases (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      db_name TEXT UNIQUE NOT NULL,
      db_user TEXT UNIQUE NOT NULL,
      db_host TEXT NOT NULL,
      db_port INTEGER NOT NULL DEFAULT 5432,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function provisionSeparateUserDatabase(
  input: ProvisionDbRequest,
): Promise<ProvisionedDbResult> {
  const slug = sanitizePgSlug(input.tenantId || input.userId || input.email);
  const dbName = assertSafePgIdentifier(`spx_db_${slug}`);
  const dbUser = assertSafePgIdentifier(`spx_u_${slug}`);
  const dbPassword = randomBytes(18).toString("base64url");
  const escapedPass = escapeSqlLiteral(dbPassword);

  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTable(adminPool);

    // 1. Create or update dedicated PostgreSQL login role (least privilege)
    const roleCheck = await adminPool.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [dbUser],
    );
    if (roleCheck.rowCount === 0) {
      await adminPool.query(
        `CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${escapedPass}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`,
      );
    } else {
      await adminPool.query(
        `ALTER ROLE "${dbUser}" WITH PASSWORD '${escapedPass}';`,
      );
    }

    // 2. Create dedicated PostgreSQL database owned by that role
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (dbCheck.rowCount === 0) {
      await adminPool.query(
        `CREATE DATABASE "${dbName}" OWNER "${dbUser}";`,
      );
    }

    // 3. Isolate database so other roles cannot connect or inspect it
    await adminPool.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC;`);
    await adminPool.query(
      `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`,
    );

    // 4. Enable pgvector & grant schema privileges inside the newly created database
    const userDbPool = await openAdminPool(dbName).catch(() => null);
    if (userDbPool) {
      try {
        await userDbPool.query(`CREATE EXTENSION IF NOT EXISTS vector;`).catch(() => {});
        await userDbPool.query(`GRANT ALL ON SCHEMA public TO "${dbUser}";`);
        await userDbPool.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${dbUser}";`,
        );
      } finally {
        await userDbPool.end().catch(() => {});
      }
    }

    const endpoint = getPublicDbEndpoint();
    const recordId = `PDB-${Date.now().toString(36).toUpperCase()}`;

    await adminPool.query(
      `
      INSERT INTO public.provisioned_databases (
        id, tenant_id, user_id, user_email, db_name, db_user, db_host, db_port, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')
      ON CONFLICT (db_name) DO UPDATE
        SET user_email = EXCLUDED.user_email,
            tenant_id = EXCLUDED.tenant_id,
            db_host = EXCLUDED.db_host,
            db_port = EXCLUDED.db_port,
            status = 'Active';
      `,
      [
        recordId,
        input.tenantId,
        input.userId,
        input.email.toLowerCase(),
        dbName,
        dbUser,
        endpoint.host,
        endpoint.port,
      ],
    );

    const connectionString = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${endpoint.host}:${endpoint.port}/${dbName}?sslmode=prefer`;

    return {
      id: recordId,
      tenantId: input.tenantId,
      userId: input.userId,
      userEmail: input.email.toLowerCase(),
      dbName,
      dbUser,
      dbPassword,
      dbHost: endpoint.host,
      dbPort: endpoint.port,
      connectionString,
      createdAt: new Date().toISOString(),
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function listProvisionedDatabases(): Promise<ProvisionedDbSummaryResponse> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTable(adminPool);

    const usersRes = await adminPool
      .query<{ cnt: string }>("SELECT COUNT(*)::text AS cnt FROM public.app_users")
      .catch(() => ({ rows: [{ cnt: "0" }] }));
    const totalUsers = Number(usersRes.rows[0]?.cnt ?? 0);

    const dbsRes = await adminPool.query<{
      id: string | null;
      tenant_id: string | null;
      user_email: string | null;
      db_name: string;
      db_user: string;
      db_host: string | null;
      db_port: number | null;
      size_pretty: string;
      active_connections: number;
      status: string | null;
      created_at: string | null;
    }>(`
      SELECT
        p.id,
        p.tenant_id,
        p.user_email,
        d.datname AS db_name,
        COALESCE(p.db_user, pg_get_userbyid(d.datdba)) AS db_user,
        p.db_host,
        p.db_port,
        pg_size_pretty(pg_database_size(d.datname)) AS size_pretty,
        (
          SELECT COUNT(*)::int
          FROM pg_stat_activity a
          WHERE a.datname = d.datname
        ) AS active_connections,
        COALESCE(p.status, 'Active') AS status,
        p.created_at::text AS created_at
      FROM pg_database d
      LEFT JOIN public.provisioned_databases p ON p.db_name = d.datname
      WHERE d.datname LIKE 'spx_db_%'
      ORDER BY p.created_at DESC NULLS LAST, d.datname ASC;
    `);

    const endpoint = getPublicDbEndpoint();
    const databases: ProvisionedDbSummaryItem[] = dbsRes.rows.map((r) => ({
      id: r.id || r.db_name,
      tenantId: r.tenant_id || "-",
      userEmail: r.user_email || "-",
      dbName: r.db_name,
      dbUser: r.db_user,
      dbHost: r.db_host || endpoint.host,
      dbPort: r.db_port || endpoint.port,
      sizePretty: r.size_pretty,
      activeConnections: r.active_connections,
      status: r.status || "Active",
      createdAt: r.created_at || "",
    }));

    return {
      totalUsers,
      totalProvisionedDbs: databases.length,
      databases,
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}
