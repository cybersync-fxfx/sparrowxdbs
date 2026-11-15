import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import {
  computeStorageUsagePct,
  resolveDbPlan,
  type DbPlanId,
} from "../sparrowx-db-plans";

const { Pool } = pg;

const SAFE_PG_IDENTIFIER_RE = /^[a-z][a-z0-9_]{2,54}$/;
const DANGEROUS_SQL_RE =
  /\b(alter\s+system|drop\s+database|create\s+database|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink)\b|copy\s+.+\s+program\b|\bsuperuser\b/i;

export interface ProvisionDbRequest {
  tenantId: string;
  userId: string;
  email: string;
  projectName?: string | undefined;
  planId?: DbPlanId | string | undefined;
  isAdminOverride?: boolean | undefined;
  actorIp?: string | undefined;
}

export interface ProvisionedDbResult {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  projectName: string;
  planId: DbPlanId;
  planName: string;
  storageLimitMb: number;
  maxConnections: number;
  statementTimeoutMs: number;
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
  projectName: string;
  planId: DbPlanId;
  planName: string;
  dbName: string;
  dbUser: string;
  dbHost: string;
  dbPort: number;
  sizeBytes: number;
  sizePretty: string;
  storageLimitMb: number;
  usagePct: number;
  maxConnections: number;
  activeConnections: number;
  backupCount: number;
  lastBackupAt: string | null;
  status: string;
  createdAt: string;
}

export interface ProvisionedDbSummaryResponse {
  totalUsers: number;
  totalProvisionedDbs: number;
  totalStorageBytes: number;
  databases: ProvisionedDbSummaryItem[];
}

export interface DbSnapshotItem {
  id: string;
  dbName: string;
  tenantId: string;
  label: string;
  sizeBytes: number;
  sizePretty: string;
  tableCount: number;
  checksumSha256: string;
  retentionDays: number;
  expiresAt: string;
  createdAt: string;
}

export interface DbAuditLogItem {
  id: string;
  action: string;
  dbName: string;
  tenantId: string;
  actor: string;
  status: string;
  detail: string;
  createdAt: string;
}

export interface DbClusterHealth {
  ok: boolean;
  engine: string;
  version: string;
  pgvectorAvailable: boolean;
  pgcryptoAvailable: boolean;
  uptimeSeconds: number;
  totalDatabases: number;
  activeConnections: number;
  clusterSizePretty: string;
  latencyMs: number;
  sslMode: string;
  checkedAt: string;
}

export interface TenantQueryResult {
  ok: boolean;
  command: string;
  rowCount: number;
  fields: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
}

export class DbProvisionerError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "DbProvisionerError";
  }
}

export function sanitizePgSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 32) || "tenant";
}

export function assertSafePgIdentifier(name: string): string {
  if (!SAFE_PG_IDENTIFIER_RE.test(name)) {
    throw new DbProvisionerError(400, `Unsafe PostgreSQL identifier: ${name}`);
  }
  return name;
}

export function validateTenantSqlSafety(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new DbProvisionerError(400, "SQL query cannot be empty.");
  }
  if (trimmed.length > 32_000) {
    throw new DbProvisionerError(400, "SQL query exceeds 32 KB limit.");
  }
  if (DANGEROUS_SQL_RE.test(trimmed)) {
    throw new DbProvisionerError(
      403,
      "Cluster-level or filesystem PostgreSQL commands are blocked in tenant SQL runner.",
    );
  }
  return trimmed;
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

async function ensureProvisionRegistryTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.provisioned_databases (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT 'Default Project',
      plan_id TEXT NOT NULL DEFAULT 'db-free',
      storage_limit_mb INTEGER NOT NULL DEFAULT 500,
      max_connections INTEGER NOT NULL DEFAULT 10,
      statement_timeout_ms INTEGER NOT NULL DEFAULT 10000,
      db_name TEXT UNIQUE NOT NULL,
      db_user TEXT UNIQUE NOT NULL,
      db_host TEXT NOT NULL,
      db_port INTEGER NOT NULL DEFAULT 5432,
      status TEXT NOT NULL DEFAULT 'Active',
      last_backup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Backward-compatible schema migrations for existing OVH installations
  await pool.query(`
    ALTER TABLE public.provisioned_databases
      ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT 'Default Project',
      ADD COLUMN IF NOT EXISTS plan_id TEXT NOT NULL DEFAULT 'db-free',
      ADD COLUMN IF NOT EXISTS storage_limit_mb INTEGER NOT NULL DEFAULT 500,
      ADD COLUMN IF NOT EXISTS max_connections INTEGER NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS statement_timeout_ms INTEGER NOT NULL DEFAULT 10000,
      ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.provisioned_db_backups (
      id TEXT PRIMARY KEY,
      db_name TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'Manual Snapshot',
      size_bytes BIGINT NOT NULL DEFAULT 0,
      size_pretty TEXT NOT NULL DEFAULT '0 bytes',
      table_count INTEGER NOT NULL DEFAULT 0,
      checksum_sha256 TEXT NOT NULL,
      retention_days INTEGER NOT NULL DEFAULT 7,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.provisioned_db_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      db_name TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Success',
      detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function recordAuditLog(
  pool: pg.Pool,
  entry: {
    action: string;
    dbName: string;
    tenantId: string;
    actor: string;
    status?: string;
    detail?: string;
  },
): Promise<void> {
  const id = `AUD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  await pool
    .query(
      `
      INSERT INTO public.provisioned_db_audit_logs (id, action, db_name, tenant_id, actor, status, detail)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        id,
        entry.action,
        entry.dbName,
        entry.tenantId,
        entry.actor,
        entry.status || "Success",
        entry.detail || "",
      ],
    )
    .catch(() => {});
}

async function applyRoleResourceLimits(
  pool: pg.Pool,
  dbUser: string,
  plan: ReturnType<typeof resolveDbPlan>,
): Promise<void> {
  await pool.query(
    `ALTER ROLE "${dbUser}" CONNECTION LIMIT ${plan.maxConnections};`,
  );
  await pool.query(
    `ALTER ROLE "${dbUser}" SET statement_timeout = '${plan.statementTimeoutMs}ms';`,
  );
  await pool.query(
    `ALTER ROLE "${dbUser}" SET idle_in_transaction_session_timeout = '30000ms';`,
  );
  await pool.query(
    `ALTER ROLE "${dbUser}" SET work_mem = '${plan.workMemMb}MB';`,
  );
}

export async function provisionSeparateUserDatabase(
  input: ProvisionDbRequest,
): Promise<ProvisionedDbResult> {
  const email = input.email.trim().toLowerCase();
  const slug = sanitizePgSlug(input.tenantId || input.userId || email);
  const dbName = assertSafePgIdentifier(`spx_db_${slug}`);
  const dbUser = assertSafePgIdentifier(`spx_u_${slug}`);
  const plan = resolveDbPlan(input.planId);
  const projectName = (input.projectName || "Default Project").trim().slice(0, 64);
  const dbPassword = randomBytes(20).toString("base64url");
  const escapedPass = escapeSqlLiteral(dbPassword);

  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);

    // Ownership collision guard: prevent another user/email from hijacking an existing tenant DB
    const existingReg = await adminPool.query<{
      user_email: string;
      user_id: string;
      tenant_id: string;
    }>(
      "SELECT user_email, user_id, tenant_id FROM public.provisioned_databases WHERE db_name = $1",
      [dbName],
    );

    if (existingReg.rowCount && existingReg.rowCount > 0 && !input.isAdminOverride) {
      const owner = existingReg.rows[0];
      const sameOwner =
        owner.user_email.toLowerCase() === email ||
        owner.user_id === input.userId;
      if (!sameOwner) {
        await recordAuditLog(adminPool, {
          action: "provision_blocked",
          dbName,
          tenantId: input.tenantId,
          actor: email,
          status: "Denied",
          detail: `Ownership mismatch against existing tenant ${owner.tenant_id}`,
        });
        throw new DbProvisionerError(
          409,
          `Database ${dbName} is already owned by another account. Choose a unique tenant/project ID.`,
        );
      }
    }

    // 1. Create or update dedicated least-privilege PostgreSQL login role
    const roleCheck = await adminPool.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [dbUser],
    );
    if (roleCheck.rowCount === 0) {
      await adminPool.query(
        `CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${escapedPass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT ${plan.maxConnections};`,
      );
    } else {
      await adminPool.query(
        `ALTER ROLE "${dbUser}" WITH LOGIN PASSWORD '${escapedPass}';`,
      );
    }
    await applyRoleResourceLimits(adminPool, dbUser, plan);

    // 2. Create dedicated PostgreSQL database owned by that role
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (dbCheck.rowCount === 0) {
      await adminPool.query(
        `CREATE DATABASE "${dbName}" OWNER "${dbUser}" CONNECTION LIMIT ${plan.maxConnections};`,
      );
    } else {
      await adminPool.query(
        `ALTER DATABASE "${dbName}" CONNECTION LIMIT ${plan.maxConnections};`,
      );
    }

    // 3. Isolate database so other roles cannot connect or inspect it
    await adminPool.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC;`);
    await adminPool.query(
      `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`,
    );

    // 4. Harden schema public & enable pgvector + pgcrypto inside the isolated database
    const userDbPool = await openAdminPool(dbName).catch(() => null);
    if (userDbPool) {
      try {
        await userDbPool.query(`CREATE EXTENSION IF NOT EXISTS vector;`).catch(() => {});
        await userDbPool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`).catch(() => {});
        await userDbPool.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;`).catch(() => {});
        await userDbPool.query(`GRANT ALL ON SCHEMA public TO "${dbUser}";`);
        await userDbPool.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${dbUser}";`,
        );
        await userDbPool.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${dbUser}";`,
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
        id, tenant_id, user_id, user_email, project_name, plan_id,
        storage_limit_mb, max_connections, statement_timeout_ms,
        db_name, db_user, db_host, db_port, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Active', NOW())
      ON CONFLICT (db_name) DO UPDATE
        SET user_email = EXCLUDED.user_email,
            tenant_id = EXCLUDED.tenant_id,
            project_name = EXCLUDED.project_name,
            plan_id = EXCLUDED.plan_id,
            storage_limit_mb = EXCLUDED.storage_limit_mb,
            max_connections = EXCLUDED.max_connections,
            statement_timeout_ms = EXCLUDED.statement_timeout_ms,
            db_host = EXCLUDED.db_host,
            db_port = EXCLUDED.db_port,
            status = 'Active',
            updated_at = NOW();
      `,
      [
        recordId,
        input.tenantId,
        input.userId,
        email,
        projectName,
        plan.id,
        plan.storageLimitMb,
        plan.maxConnections,
        plan.statementTimeoutMs,
        dbName,
        dbUser,
        endpoint.host,
        endpoint.port,
      ],
    );

    await recordAuditLog(adminPool, {
      action: "provision",
      dbName,
      tenantId: input.tenantId,
      actor: email,
      status: "Success",
      detail: `Provisioned plan ${plan.id} (${plan.storageLimitMb}MB, ${plan.maxConnections} conns)`,
    });

    const connectionString = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${endpoint.host}:${endpoint.port}/${dbName}?sslmode=prefer`;

    return {
      id: recordId,
      tenantId: input.tenantId,
      userId: input.userId,
      userEmail: email,
      projectName,
      planId: plan.id,
      planName: plan.name,
      storageLimitMb: plan.storageLimitMb,
      maxConnections: plan.maxConnections,
      statementTimeoutMs: plan.statementTimeoutMs,
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

async function assertDatabaseOwnership(
  adminPool: pg.Pool,
  dbName: string,
  actorEmail?: string,
  isAdmin?: boolean,
) {
  const safeDb = assertSafePgIdentifier(dbName);
  const res = await adminPool.query<{
    id: string;
    tenant_id: string;
    user_id: string;
    user_email: string;
    db_user: string;
    plan_id: string;
    status: string;
  }>(
    `SELECT id, tenant_id, user_id, user_email, db_user, plan_id, status
     FROM public.provisioned_databases
     WHERE db_name = $1`,
    [safeDb],
  );
  if (res.rowCount === 0) {
    throw new DbProvisionerError(404, `Database ${safeDb} not found in SparrowX registry.`);
  }
  const row = res.rows[0];
  if (!isAdmin && actorEmail && row.user_email.toLowerCase() !== actorEmail.toLowerCase()) {
    throw new DbProvisionerError(403, `Forbidden: you do not own database ${safeDb}.`);
  }
  return row;
}

export async function rotateProvisionedDbPassword(
  dbName: string,
  actor: string,
  isAdmin = false,
): Promise<{ dbName: string; dbUser: string; dbPassword: string; connectionString: string }> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    const row = await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    const dbUser = assertSafePgIdentifier(row.db_user);
    const newPassword = randomBytes(20).toString("base64url");
    await adminPool.query(
      `ALTER ROLE "${dbUser}" WITH PASSWORD '${escapeSqlLiteral(newPassword)}';`,
    );
    await adminPool.query(
      `UPDATE public.provisioned_databases SET updated_at = NOW() WHERE db_name = $1`,
      [dbName],
    );
    await recordAuditLog(adminPool, {
      action: "rotate_password",
      dbName,
      tenantId: row.tenant_id,
      actor,
      detail: `Rotated credentials for role ${dbUser}`,
    });
    const endpoint = getPublicDbEndpoint();
    return {
      dbName,
      dbUser,
      dbPassword: newPassword,
      connectionString: `postgresql://${dbUser}:${encodeURIComponent(newPassword)}@${endpoint.host}:${endpoint.port}/${dbName}?sslmode=prefer`,
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function createDatabaseSnapshot(
  dbName: string,
  actor: string,
  label = "Manual Snapshot",
  isAdmin = false,
): Promise<DbSnapshotItem> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    const row = await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    const plan = resolveDbPlan(row.plan_id);

    const sizeRes = await adminPool.query<{ bytes: string; pretty: string }>(
      `SELECT pg_database_size($1)::text AS bytes, pg_size_pretty(pg_database_size($1)) AS pretty`,
      [dbName],
    );
    const sizeBytes = Number(sizeRes.rows[0]?.bytes ?? 0);
    const sizePretty = sizeRes.rows[0]?.pretty ?? "0 bytes";

    let tableCount = 0;
    let schemaDigestInput = `${dbName}:${sizeBytes}:${Date.now()}`;
    const targetPool = await openAdminPool(dbName).catch(() => null);
    if (targetPool) {
      try {
        const tblRes = await targetPool.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
        );
        tableCount = tblRes.rowCount || 0;
        schemaDigestInput += `:${tblRes.rows.map((r) => r.table_name).join(",")}`;
      } finally {
        await targetPool.end().catch(() => {});
      }
    }

    const checksumSha256 = createHash("sha256").update(schemaDigestInput).digest("hex");
    const id = `SNP-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date(
      Date.now() + plan.backupRetentionDays * 86_400_000,
    ).toISOString();

    await adminPool.query(
      `
      INSERT INTO public.provisioned_db_backups (
        id, db_name, tenant_id, label, size_bytes, size_pretty,
        table_count, checksum_sha256, retention_days, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        id,
        dbName,
        row.tenant_id,
        label.trim().slice(0, 64) || "Manual Snapshot",
        sizeBytes,
        sizePretty,
        tableCount,
        checksumSha256,
        plan.backupRetentionDays,
        expiresAt,
      ],
    );

    await adminPool.query(
      `UPDATE public.provisioned_databases SET last_backup_at = NOW(), updated_at = NOW() WHERE db_name = $1`,
      [dbName],
    );

    await recordAuditLog(adminPool, {
      action: "backup_snapshot",
      dbName,
      tenantId: row.tenant_id,
      actor,
      detail: `Created snapshot ${id} (${sizePretty}, ${tableCount} tables)`,
    });

    return {
      id,
      dbName,
      tenantId: row.tenant_id,
      label,
      sizeBytes,
      sizePretty,
      tableCount,
      checksumSha256,
      retentionDays: plan.backupRetentionDays,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function updateDatabasePlanOrStatus(
  dbName: string,
  updates: { planId?: string; status?: "Active" | "Suspended" },
  actor: string,
  isAdmin = false,
) {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    const row = await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    const dbUser = assertSafePgIdentifier(row.db_user);
    const nextPlan = resolveDbPlan(updates.planId || row.plan_id);
    const nextStatus = updates.status || (row.status as "Active" | "Suspended");

    if (updates.planId) {
      await applyRoleResourceLimits(adminPool, dbUser, nextPlan);
      await adminPool.query(
        `ALTER DATABASE "${dbName}" CONNECTION LIMIT ${nextPlan.maxConnections};`,
      );
    }

    if (updates.status === "Suspended") {
      await adminPool.query(`ALTER ROLE "${dbUser}" NOLOGIN;`);
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
    } else if (updates.status === "Active") {
      await adminPool.query(`ALTER ROLE "${dbUser}" LOGIN;`);
    }

    await adminPool.query(
      `
      UPDATE public.provisioned_databases
      SET plan_id = $2,
          storage_limit_mb = $3,
          max_connections = $4,
          statement_timeout_ms = $5,
          status = $6,
          updated_at = NOW()
      WHERE db_name = $1
      `,
      [
        dbName,
        nextPlan.id,
        nextPlan.storageLimitMb,
        nextPlan.maxConnections,
        nextPlan.statementTimeoutMs,
        nextStatus,
      ],
    );

    await recordAuditLog(adminPool, {
      action: updates.planId ? "upgrade_plan" : `status_${nextStatus.toLowerCase()}`,
      dbName,
      tenantId: row.tenant_id,
      actor,
      detail: `Plan=${nextPlan.id}, Status=${nextStatus}`,
    });

    return {
      dbName,
      planId: nextPlan.id,
      planName: nextPlan.name,
      storageLimitMb: nextPlan.storageLimitMb,
      maxConnections: nextPlan.maxConnections,
      status: nextStatus,
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function deprovisionDatabase(
  dbName: string,
  actor: string,
  isAdmin = false,
): Promise<{ dbName: string; deleted: boolean }> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    const row = await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    const safeDb = assertSafePgIdentifier(dbName);
    const safeUser = assertSafePgIdentifier(row.db_user);

    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [safeDb],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${safeDb}";`);
    await adminPool.query(`DROP ROLE IF EXISTS "${safeUser}";`);
    await adminPool.query(
      `DELETE FROM public.provisioned_databases WHERE db_name = $1`,
      [safeDb],
    );

    await recordAuditLog(adminPool, {
      action: "deprovision",
      dbName: safeDb,
      tenantId: row.tenant_id,
      actor,
      detail: `Dropped database ${safeDb} and role ${safeUser}`,
    });

    return { dbName: safeDb, deleted: true };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function executeTenantSqlQuery(
  dbName: string,
  sql: string,
  actor: string,
  isAdmin = false,
): Promise<TenantQueryResult> {
  const safeSql = validateTenantSqlSafety(sql);
  const adminPool = await openAdminPool();
  let row;
  try {
    await ensureProvisionRegistryTables(adminPool);
    row = await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    if (row.status === "Suspended") {
      throw new DbProvisionerError(403, `Database ${dbName} is currently suspended.`);
    }
  } finally {
    await adminPool.end().catch(() => {});
  }

  const plan = resolveDbPlan(row.plan_id);
  const tenantPool = await openAdminPool(dbName);
  const started = Date.now();
  try {
    await tenantPool.query(`SET statement_timeout = '${plan.statementTimeoutMs}ms';`);
    const result = await tenantPool.query(safeSql);
    const durationMs = Date.now() - started;
    const allRows = Array.isArray(result.rows) ? result.rows : [];
    const truncated = allRows.length > 500;
    const rows = truncated ? allRows.slice(0, 500) : allRows;
    const fields = Array.isArray(result.fields)
      ? result.fields.map((f) => f.name)
      : [];

    return {
      ok: true,
      command: result.command || "QUERY",
      rowCount: result.rowCount ?? rows.length,
      fields,
      rows,
      truncated,
      durationMs,
    };
  } finally {
    await tenantPool.end().catch(() => {});
  }
}

export async function listDatabaseSnapshots(
  dbName: string,
  actor: string,
  isAdmin = false,
): Promise<DbSnapshotItem[]> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    await assertDatabaseOwnership(adminPool, dbName, actor, isAdmin);
    const res = await adminPool.query<{
      id: string;
      db_name: string;
      tenant_id: string;
      label: string;
      size_bytes: string;
      size_pretty: string;
      table_count: number;
      checksum_sha256: string;
      retention_days: number;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, db_name, tenant_id, label, size_bytes::text, size_pretty,
              table_count, checksum_sha256, retention_days, expires_at::text, created_at::text
       FROM public.provisioned_db_backups
       WHERE db_name = $1
       ORDER BY created_at DESC
       LIMIT 25`,
      [dbName],
    );
    return res.rows.map((r) => ({
      id: r.id,
      dbName: r.db_name,
      tenantId: r.tenant_id,
      label: r.label,
      sizeBytes: Number(r.size_bytes),
      sizePretty: r.size_pretty,
      tableCount: r.table_count,
      checksumSha256: r.checksum_sha256,
      retentionDays: r.retention_days,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function listDbAuditLogs(
  dbName?: string,
  limit = 50,
): Promise<DbAuditLogItem[]> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);
    const res = await adminPool.query<{
      id: string;
      action: string;
      db_name: string;
      tenant_id: string;
      actor: string;
      status: string;
      detail: string;
      created_at: string;
    }>(
      dbName
        ? `SELECT id, action, db_name, tenant_id, actor, status, detail, created_at::text
           FROM public.provisioned_db_audit_logs
           WHERE db_name = $1
           ORDER BY created_at DESC LIMIT $2`
        : `SELECT id, action, db_name, tenant_id, actor, status, detail, created_at::text
           FROM public.provisioned_db_audit_logs
           ORDER BY created_at DESC LIMIT $1`,
      dbName ? [dbName, limit] : [limit],
    );
    return res.rows.map((r) => ({
      id: r.id,
      action: r.action,
      dbName: r.db_name,
      tenantId: r.tenant_id,
      actor: r.actor,
      status: r.status,
      detail: r.detail,
      createdAt: r.created_at,
    }));
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function getDbClusterHealth(): Promise<DbClusterHealth> {
  const started = Date.now();
  const adminPool = await openAdminPool();
  try {
    const [verRes, uptimeRes, extRes, statsRes] = await Promise.all([
      adminPool.query<{ version: string }>("SELECT version() AS version"),
      adminPool.query<{ uptime: number }>(
        "SELECT EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time()))::int AS uptime",
      ),
      adminPool.query<{ name: string }>(
        "SELECT name FROM pg_available_extensions WHERE name IN ('vector', 'pgcrypto')",
      ),
      adminPool.query<{
        db_count: string;
        active_conns: string;
        cluster_size: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::text FROM pg_database WHERE datname LIKE 'spx_db_%') AS db_count,
          (SELECT COUNT(*)::text FROM pg_stat_activity) AS active_conns,
          (SELECT pg_size_pretty(COALESCE(SUM(pg_database_size(datname)), 0)) FROM pg_database WHERE NOT datistemplate) AS cluster_size
      `),
    ]);

    const exts = new Set(extRes.rows.map((r) => r.name));
    return {
      ok: true,
      engine: "PostgreSQL Sovereign Cluster",
      version: verRes.rows[0]?.version?.split(" on ")[0] || "PostgreSQL",
      pgvectorAvailable: exts.has("vector"),
      pgcryptoAvailable: exts.has("pgcrypto"),
      uptimeSeconds: uptimeRes.rows[0]?.uptime ?? 0,
      totalDatabases: Number(statsRes.rows[0]?.db_count ?? 0),
      activeConnections: Number(statsRes.rows[0]?.active_conns ?? 0),
      clusterSizePretty: statsRes.rows[0]?.cluster_size || "0 bytes",
      latencyMs: Date.now() - started,
      sslMode: process.env.NODE_ENV === "production" ? "prefer" : "local",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function listProvisionedDatabases(filter?: {
  userEmail?: string;
  tenantId?: string;
  isAdmin?: boolean;
}): Promise<ProvisionedDbSummaryResponse> {
  const adminPool = await openAdminPool();
  try {
    await ensureProvisionRegistryTables(adminPool);

    const usersRes = await adminPool
      .query<{ cnt: string }>("SELECT COUNT(*)::text AS cnt FROM public.app_users")
      .catch(() => ({ rows: [{ cnt: "0" }] }));
    const totalUsers = Number(usersRes.rows[0]?.cnt ?? 0);

    const scopedEmail = !filter?.isAdmin && filter?.userEmail ? filter.userEmail.toLowerCase() : null;
    const scopedTenant = !filter?.isAdmin && filter?.tenantId ? filter.tenantId : null;

    const whereClauses = [`d.datname LIKE 'spx_db_%'`];
    const params: string[] = [];
    if (scopedEmail) {
      params.push(scopedEmail);
      whereClauses.push(`LOWER(p.user_email) = $${params.length}`);
    } else if (scopedTenant) {
      params.push(scopedTenant);
      whereClauses.push(`p.tenant_id = $${params.length}`);
    }

    const dbsRes = await adminPool.query<{
      id: string | null;
      tenant_id: string | null;
      user_email: string | null;
      project_name: string | null;
      plan_id: string | null;
      storage_limit_mb: number | null;
      max_connections: number | null;
      db_name: string;
      db_user: string;
      db_host: string | null;
      db_port: number | null;
      size_bytes: string;
      size_pretty: string;
      active_connections: number;
      backup_count: number;
      last_backup_at: string | null;
      status: string | null;
      created_at: string | null;
    }>(
      `
      SELECT
        p.id,
        p.tenant_id,
        p.user_email,
        p.project_name,
        p.plan_id,
        p.storage_limit_mb,
        p.max_connections,
        d.datname AS db_name,
        COALESCE(p.db_user, pg_get_userbyid(d.datdba)) AS db_user,
        p.db_host,
        p.db_port,
        pg_database_size(d.datname)::text AS size_bytes,
        pg_size_pretty(pg_database_size(d.datname)) AS size_pretty,
        (
          SELECT COUNT(*)::int
          FROM pg_stat_activity a
          WHERE a.datname = d.datname
        ) AS active_connections,
        (
          SELECT COUNT(*)::int
          FROM public.provisioned_db_backups b
          WHERE b.db_name = d.datname
        ) AS backup_count,
        p.last_backup_at::text AS last_backup_at,
        COALESCE(p.status, 'Active') AS status,
        p.created_at::text AS created_at
      FROM pg_database d
      LEFT JOIN public.provisioned_databases p ON p.db_name = d.datname
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY p.created_at DESC NULLS LAST, d.datname ASC;
      `,
      params,
    );

    const endpoint = getPublicDbEndpoint();
    let totalStorageBytes = 0;

    const databases: ProvisionedDbSummaryItem[] = dbsRes.rows.map((r) => {
      const plan = resolveDbPlan(r.plan_id);
      const sizeBytes = Number(r.size_bytes ?? 0);
      totalStorageBytes += sizeBytes;
      const storageLimitMb = r.storage_limit_mb || plan.storageLimitMb;
      return {
        id: r.id || r.db_name,
        tenantId: r.tenant_id || "-",
        userEmail: r.user_email || "-",
        projectName: r.project_name || "Default Project",
        planId: plan.id,
        planName: plan.name,
        dbName: r.db_name,
        dbUser: r.db_user,
        dbHost: r.db_host || endpoint.host,
        dbPort: r.db_port || endpoint.port,
        sizeBytes,
        sizePretty: r.size_pretty,
        storageLimitMb,
        usagePct: computeStorageUsagePct(sizeBytes, storageLimitMb),
        maxConnections: r.max_connections || plan.maxConnections,
        activeConnections: r.active_connections,
        backupCount: r.backup_count,
        lastBackupAt: r.last_backup_at,
        status: r.status || "Active",
        createdAt: r.created_at || "",
      };
    });

    return {
      totalUsers,
      totalProvisionedDbs: databases.length,
      totalStorageBytes,
      databases,
    };
  } finally {
    await adminPool.end().catch(() => {});
  }
}
