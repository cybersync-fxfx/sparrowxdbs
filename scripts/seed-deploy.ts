#!/usr/bin/env tsx
/**
 * Idempotent PostgreSQL 16 Drizzle seed script for SparrowX Deploy.
 * Usage: npx tsx scripts/seed-deploy.ts
 */
import crypto from "node:crypto";
import { getDeployDb, closeDeployDb } from "../src/db/deploy-db.server";
import { deployUsers, deployWorkspaces, deployAuditLogs } from "../src/db/deploy-schema";

async function main() {
  const conn = await getDeployDb();
  if (!conn) {
    console.error("[seed-deploy] Unable to connect to PostgreSQL. Check DATABASE_URL / POSTGRES_* env vars.");
    process.exit(1);
  }

  const { db } = conn;
  const adminEmail = (process.env.SPARROWX_ADMIN_EMAIL || "admin@sparrowx.net").trim().toLowerCase();
  const userId = "usr_sparrowx_admin";
  const workspaceId = "ws_sparrowx_personal";

  await db
    .insert(deployUsers)
    .values({
      id: userId,
      email: adminEmail,
      fullName: "SparrowX Platform Admin",
      role: "admin",
    })
    .onConflictDoNothing();

  await db
    .insert(deployWorkspaces)
    .values({
      id: workspaceId,
      ownerUserId: userId,
      name: "Personal",
      slug: "personal",
      plan: "starter",
      projectLimit: 3,
      monthlyTransferLimitGb: 100,
    })
    .onConflictDoNothing();

  await db.insert(deployAuditLogs).values({
    id: `aud_${crypto.randomBytes(6).toString("hex")}`,
    workspaceId,
    actorEmail: adminEmail,
    action: "seed.initialized",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { version: "2.0.0", region: "Mumbai IN-1" },
  });

  console.log(`[seed-deploy] Verified schema & default workspace (${workspaceId}) for ${adminEmail}`);
  await closeDeployDb();
}

main().catch((err) => {
  console.error("[seed-deploy] Failed:", err);
  process.exit(1);
});
