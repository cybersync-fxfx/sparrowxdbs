/**
 * Complete Drizzle ORM PostgreSQL 16 + pgvector schema for SparrowX AI (`ai.sparrowx.net`)
 * Standalone monorepo package: `packages/db/schema.ts`
 *
 * Covers all 13 required tables:
 * users, workspaces, plans, templates, instances, env_secrets, domains,
 * deployments, snapshots, usage_metrics, invoices, ip_allocations, audit_logs
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  timestamp,
  numeric,
  bigint,
  bigserial,
  jsonb,
  date,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("ai_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  oauthProvider: text("oauth_provider", { enum: ["google", "github"] }).notNull(),
  oauthSubject: text("oauth_subject").notNull(),
  role: text("role", { enum: ["developer", "founder_admin"] }).notNull().default("developer"),
  kycPhoneHash: text("kyc_phone_hash"),
  kycVerifiedAt: timestamp("kyc_verified_at", { withTimezone: true }),
  walletBalanceInr: integer("wallet_balance_inr").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("ai_workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  gstin: text("gstin"),
  billingEmail: text("billing_email").notNull(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("ai_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  vcpu: integer("vcpu").notNull(),
  ramGb: integer("ram_gb").notNull(),
  ssdGb: integer("ssd_gb").notNull(),
  portMbps: integer("port_mbps").notNull(),
  transferQuotaGb: integer("transfer_quota_gb").notNull(),
  pidsLimit: integer("pids_limit").notNull().default(512),
  monthlyInr: integer("monthly_inr").notNull(),
  isolationMode: text("isolation_mode").notNull(),
  active: boolean("active").notNull().default(true),
});

export const templates = pgTable("ai_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  dockerImage: text("docker_image").notNull(),
  defaultPort: integer("default_port").notNull().default(8080),
  minVcpu: integer("min_vcpu").notNull().default(2),
  minRamGb: integer("min_ram_gb").notNull().default(4),
  supportsPgVector: boolean("supports_pgvector").notNull().default(true),
  websocketReady: boolean("websocket_ready").notNull().default(true),
  defaultEnvJson: jsonb("default_env_json").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instances = pgTable(
  "ai_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    templateId: text("template_id").references(() => templates.id),
    name: text("name").notNull(),
    subdomain: text("subdomain").notNull().unique(),
    sourceType: text("source_type", { enum: ["template", "github"] }).notNull(),
    gitRepoUrl: text("git_repo_url"),
    gitBranch: text("git_branch").notNull().default("main"),
    detectedRuntime: text("detected_runtime").notNull().default("docker"),
    status: text("status", {
      enum: ["queued", "allocating", "configuring_ssl", "live", "stopped", "failed", "paused"],
    })
      .notNull()
      .default("queued"),
    proxmoxNode: text("proxmox_node").notNull().default("pve-in-01"),
    proxmoxVmid: integer("proxmox_vmid"),
    containerId: text("container_id"),
    internalIp: inet("internal_ip"),
    internalPort: integer("internal_port").notNull().default(8080),
    pgVectorDbName: text("pgvector_db_name"),
    webhookWafEnabled: boolean("webhook_waf_enabled").notNull().default(true),
    smtpBlocked: boolean("smtp_blocked").notNull().default(true),
    executionPruneEnabled: boolean("execution_prune_enabled").notNull().default(true),
    transferUsedGb: numeric("transfer_used_gb", { precision: 10, scale: 2 }).notNull().default("0"),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_instances_workspace").on(t.workspaceId)],
);

export const envSecrets = pgTable(
  "ai_env_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    secretKey: text("secret_key").notNull(),
    ciphertextAes256Gcm: text("ciphertext_aes256gcm").notNull(),
    ivHex: text("iv_hex").notNull(),
    authTagHex: text("auth_tag_hex").notNull(),
    keyVersion: smallint("key_version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_ai_env_instance_key").on(t.instanceId, t.secretKey)],
);

export const domains = pgTable("ai_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: uuid("instance_id")
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  cnameTarget: text("cname_target").notNull().default("edge.ai.sparrowx.net"),
  sslStatus: text("ssl_status", { enum: ["pending_dns", "issuing", "active", "failed"] })
    .notNull()
    .default("pending_dns"),
  websocketEnabled: boolean("websocket_enabled").notNull().default(true),
  certExpiresAt: timestamp("cert_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deployments = pgTable("ai_deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: uuid("instance_id")
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  bullmqJobId: text("bullmq_job_id").notNull(),
  stage: text("stage", { enum: ["queued", "allocating", "configuring_ssl", "live", "failed"] }).notNull(),
  gitCommitSha: text("git_commit_sha"),
  buildLogTail: text("build_log_tail"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const snapshots = pgTable("ai_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: uuid("instance_id")
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  snapshotType: text("snapshot_type", { enum: ["daily-auto", "manual"] }).notNull(),
  storageUri: text("storage_uri").notNull(),
  sizeMb: integer("size_mb").notNull().default(0),
  status: text("status", { enum: ["ready", "restoring", "failed"] }).notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageMetrics = pgTable(
  "ai_usage_metrics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    bucketHour: timestamp("bucket_hour", { withTimezone: true }).notNull(),
    avgCpuPct: numeric("avg_cpu_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    peakRamMb: integer("peak_ram_mb").notNull().default(0),
    diskIoMb: numeric("disk_io_mb", { precision: 10, scale: 2 }).notNull().default("0"),
    rxBytes: bigint("rx_bytes", { mode: "number" }).notNull().default(0),
    txBytes: bigint("tx_bytes", { mode: "number" }).notNull().default(0),
  },
  (t) => [uniqueIndex("uq_ai_usage_instance_hour").on(t.instanceId, t.bucketHour)],
);

export const invoices = pgTable("ai_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id").unique(),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  subtotalInr: integer("subtotal_inr").notNull(),
  gstInr: integer("gst_inr").notNull(),
  totalInr: integer("total_inr").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status", { enum: ["OPEN", "PAID", "FAILED", "VOID"] }).notNull(),
  billingPeriodStart: date("billing_period_start").notNull(),
  billingPeriodEnd: date("billing_period_end").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const ipAllocations = pgTable("ai_ip_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ipv4: inet("ipv4").notNull().unique(),
  cidr: smallint("cidr").notNull().default(32),
  gatewayRegion: text("gateway_region").notNull().default("ovh-bom1"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  instanceId: uuid("instance_id").references(() => instances.id, { onDelete: "set null" }),
  portCapMbps: integer("port_cap_mbps").notNull().default(100),
  smtpBlocked: boolean("smtp_blocked").notNull().default(true),
  status: text("status", { enum: ["active", "reserved", "throttled"] }).notNull().default("reserved"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "ai_audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    clientIp: inet("client_ip"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_audit_workspace_time").on(t.workspaceId, t.createdAt)],
);
