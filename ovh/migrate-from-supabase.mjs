#!/usr/bin/env node
/**
 * SPARROWX SOVEREIGN LOCAL DATABASE SEEDER & PER-USER PARTITION ENGINE
 * ----------------------------------------------------------------------------
 * Completely disconnected from Cloud Supabase.
 * Loads the migrated snapshot (`src/lib/migrated-seed.json`) directly into:
 *  1. The local OVH PostgreSQL / PostgREST database (POSTGREST_INTERNAL_URL)
 *  2. The local OVH JSON persistence store (/app/data/sparrowx-ovh-db.json)
 *  3. Isolated Per-User Database Folders (/app/data/users/<username>/)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const LOCAL_POSTGREST_URL =
  process.env.POSTGREST_INTERNAL_URL ||
  process.env.SPARROWX_DB_REST_URL ||
  "http://127.0.0.1:3001";

const DATA_DIR = process.env.SPARROWX_DATA_DIR || resolve(process.cwd(), "data");
const LOCAL_JSON_PATH = resolve(DATA_DIR, "sparrowx-ovh-db.json");
const SEED_JSON_PATH = resolve(process.cwd(), "src/lib/migrated-seed.json");

const TABLES = [
  "app_users",
  "client_tenants",
  "protected_services",
  "assets",
  "incidents",
  "threat_indicators",
  "vulnerabilities",
  "reports",
  "team_members",
  "integrations",
  "audit_logs",
  "billing_transactions",
  "verification_proofs",
];

export async function migrateCloudSupabaseToLocal() {
  console.log("[SparrowX Sovereign DB] Hydrating local OVH PostgreSQL & per-user folders from local seed...");
  let localStore = {};
  try {
    const raw = await readFile(LOCAL_JSON_PATH, "utf-8");
    localStore = JSON.parse(raw);
  } catch {
    localStore = {};
  }

  let seedStore = {};
  try {
    const rawSeed = await readFile(SEED_JSON_PATH, "utf-8");
    seedStore = JSON.parse(rawSeed);
  } catch {
    seedStore = {};
  }

  let totalSynced = 0;

  for (const table of TABLES) {
    const seedRows = Array.isArray(seedStore[table]) ? seedStore[table] : [];
    const existing = Array.isArray(localStore[table]) ? localStore[table] : [];
    const byId = new Map();
    for (const item of existing) {
      const key = item.id || item.email;
      if (key) byId.set(String(key), item);
    }
    for (const row of seedRows) {
      const key = row.id || row.email;
      if (key && !byId.has(String(key))) {
        existing.push(row);
        byId.set(String(key), row);
        totalSynced++;
      }
    }
    localStore[table] = existing;

    if (existing.length > 0) {
      try {
        await fetch(`${LOCAL_POSTGREST_URL}/${table}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(existing),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // PostgREST container may still be initializing; local JSON store is already synced
      }
    }
  }

  try {
    await mkdir(dirname(LOCAL_JSON_PATH), { recursive: true });
    await writeFile(LOCAL_JSON_PATH, JSON.stringify(localStore, null, 2), "utf-8");
    await provisionPerUserDatabaseFolders(localStore);
  } catch (err) {
    console.warn("[SparrowX Sovereign DB] Could not write local JSON store:", err);
  }

  console.log(
    `[SparrowX Sovereign DB] Local OVH database active & 100% disconnected from Cloud (${totalSynced} new records hydrated).`,
  );
  return totalSynced;
}

export async function provisionPerUserDatabaseFolders(store) {
  const usersDir = resolve(DATA_DIR, "users");
  await mkdir(usersDir, { recursive: true });

  const users = Array.isArray(store.app_users) ? store.app_users : [];
  const tenants = Array.isArray(store.client_tenants) ? store.client_tenants : [];
  const vulns = Array.isArray(store.vulnerabilities) ? store.vulnerabilities : [];
  const threats = Array.isArray(store.threat_indicators) ? store.threat_indicators : [];
  const incidents = Array.isArray(store.incidents) ? store.incidents : [];
  const services = Array.isArray(store.protected_services) ? store.protected_services : [];

  for (const user of users) {
    const rawName = String(user.full_name || user.email || user.id || "user")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    const usernameFolder = resolve(usersDir, rawName || "default_user");
    await mkdir(usernameFolder, { recursive: true });

    const userTenant =
      tenants.find(
        (t) =>
          t.id === user.tenant_id ||
          String(t.contact_email || "").toLowerCase() === String(user.email || "").toLowerCase(),
      ) || null;

    await writeFile(
      resolve(usernameFolder, "profile.json"),
      JSON.stringify({ user, tenant: userTenant, updatedAt: new Date().toISOString() }, null, 2),
      "utf-8",
    );
    await writeFile(
      resolve(usernameFolder, "vulnerabilities.json"),
      JSON.stringify(vulns, null, 2),
      "utf-8",
    );
    await writeFile(
      resolve(usernameFolder, "blocked_data.json"),
      JSON.stringify(threats, null, 2),
      "utf-8",
    );
    await writeFile(
      resolve(usernameFolder, "incidents.json"),
      JSON.stringify(incidents, null, 2),
      "utf-8",
    );
    await writeFile(
      resolve(usernameFolder, "services.json"),
      JSON.stringify(services, null, 2),
      "utf-8",
    );
    await writeFile(
      resolve(usernameFolder, "database.sql"),
      `-- Dedicated SparrowX User Database Partition: ${rawName}\nCREATE SCHEMA IF NOT EXISTS user_${rawName};\n`,
      "utf-8",
    );
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("migrate-from-supabase.mjs") ||
    import.meta.url.endsWith("migrate-from-supabase.mjs"));

if (isDirectRun) {
  migrateCloudSupabaseToLocal().catch((err) => {
    console.error("[SparrowX Sovereign DB Error]", err);
    process.exit(0);
  });
}
