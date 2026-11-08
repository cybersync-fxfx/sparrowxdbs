#!/usr/bin/env node
/**
 * SPARROWX CLOUD-TO-LOCAL OVH DATABASE MIGRATION ENGINE
 * ----------------------------------------------------------------------------
 * Automatically shifts all existing data from the cloud Supabase instance into:
 *  1. The local OVH PostgreSQL / PostgREST database (POSTGREST_INTERNAL_URL)
 *  2. The local OVH JSON persistence store (/app/data/sparrowx-ovh-db.json)
 *
 * Safe & idempotent: preserves all local records and upserts missing rows.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CLOUD_URL =
  process.env.SPARROWX_CLOUD_SUPABASE_URL || "https://yidqdgufjgfyxflgvbqq.supabase.co";
const CLOUD_KEY =
  process.env.SPARROWX_CLOUD_SUPABASE_KEY ||
  "sb_publishable_cbDXcwqJTmMt3Bb_BtY75w_9dIhf9Y-";

const LOCAL_POSTGREST_URL =
  process.env.POSTGREST_INTERNAL_URL ||
  process.env.SPARROWX_DB_REST_URL ||
  "http://127.0.0.1:3001";

const DATA_DIR = process.env.SPARROWX_DATA_DIR || resolve(process.cwd(), "data");
const LOCAL_JSON_PATH = resolve(DATA_DIR, "sparrowx-ovh-db.json");

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
  console.log("[SparrowX DB Shift] Starting Cloud -> Local OVH Database synchronization...");
  let localStore = {};
  try {
    const raw = await readFile(LOCAL_JSON_PATH, "utf-8");
    localStore = JSON.parse(raw);
  } catch {
    localStore = {};
  }

  let totalMigrated = 0;

  for (const table of TABLES) {
    try {
      const res = await fetch(`${CLOUD_URL}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: CLOUD_KEY,
          Authorization: `Bearer ${CLOUD_KEY}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;

      // 1. Merge into local JSON store
      const existing = Array.isArray(localStore[table]) ? localStore[table] : [];
      const byId = new Map();
      for (const item of existing) {
        const key = item.id || item.email;
        if (key) byId.set(String(key), item);
      }
      for (const row of rows) {
        const key = row.id || row.email;
        if (key && !byId.has(String(key))) {
          existing.push(row);
          byId.set(String(key), row);
          totalMigrated++;
        }
      }
      localStore[table] = existing;

      // 2. Upsert into local PostgREST / PostgreSQL if reachable
      try {
        await fetch(`${LOCAL_POSTGREST_URL}/${table}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(rows),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // PostgREST container may still be initializing or running in native mode; JSON store is already synced
      }
    } catch {
      // Ignore individual table timeout
    }
  }

  try {
    await mkdir(dirname(LOCAL_JSON_PATH), { recursive: true });
    await writeFile(LOCAL_JSON_PATH, JSON.stringify(localStore, null, 2), "utf-8");
    await provisionPerUserDatabaseFolders(localStore);
  } catch (err) {
    console.warn("[SparrowX DB Shift] Could not write local JSON store:", err);
  }

  console.log(
    `[SparrowX DB Shift] Local OVH database ready (${totalMigrated} new records synced to local storage).`,
  );
  return totalMigrated;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCloudSupabaseToLocal().catch((err) => {
    console.error("[SparrowX DB Shift Error]", err);
    process.exit(0);
  });
}
