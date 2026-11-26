import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./deploy-schema";

const { Pool } = pg;

export type DeployDb = NodePgDatabase<typeof schema>;

let cachedPool: pg.Pool | null = null;
let cachedDb: DeployDb | null = null;
let schemaReady = false;

function buildPgConfig(): pg.PoolConfig {
  if (process.env.DATABASE_URL?.trim()) {
    return {
      connectionString: process.env.DATABASE_URL.trim(),
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30_000,
    };
  }
  const host =
    process.env.POSTGRES_HOST?.trim() ||
    process.env.PGHOST?.trim() ||
    (process.env.NODE_ENV === "production" ? "postgres" : "127.0.0.1");
  return {
    host,
    port: Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432),
    user: process.env.POSTGRES_USER || process.env.PGUSER || "sparrowx",
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "",
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || "sparrowx_db",
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30_000,
  };
}

export async function getDeployDb(): Promise<{ db: DeployDb; pool: pg.Pool } | null> {
  if (cachedDb && cachedPool) {
    if (!schemaReady) {
      await ensureDeploySchema(cachedPool).catch(() => {});
    }
    return { db: cachedDb, pool: cachedPool };
  }

  const primaryPool = new Pool(buildPgConfig());
  try {
    await primaryPool.query("SELECT 1");
    cachedPool = primaryPool;
    cachedDb = drizzle(primaryPool, { schema });
    await ensureDeploySchema(primaryPool);
    return { db: cachedDb, pool: cachedPool };
  } catch {
    await primaryPool.end().catch(() => {});
    // Try localhost fallback if Docker hostname `postgres` isn't resolvable in local dev
    const cfg = buildPgConfig();
    if (!cfg.connectionString && cfg.host && cfg.host !== "127.0.0.1") {
      const fallbackPool = new Pool({ ...cfg, host: "127.0.0.1" });
      try {
        await fallbackPool.query("SELECT 1");
        cachedPool = fallbackPool;
        cachedDb = drizzle(fallbackPool, { schema });
        await ensureDeploySchema(fallbackPool);
        return { db: cachedDb, pool: cachedPool };
      } catch {
        await fallbackPool.end().catch(() => {});
      }
    }
    return null;
  }
}

export async function ensureDeploySchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  const migrationFile = path.resolve(process.cwd(), "drizzle", "0001_sparrowx_deploy_init.sql");
  if (fs.existsSync(migrationFile)) {
    const sql = fs.readFileSync(migrationFile, "utf8");
    await pool.query(sql);
  }
  schemaReady = true;
}

export async function closeDeployDb(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end().catch(() => {});
    cachedPool = null;
    cachedDb = null;
    schemaReady = false;
  }
}
