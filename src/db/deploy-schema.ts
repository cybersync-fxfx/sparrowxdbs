import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const deployUsers = pgTable("deploy_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("client"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deploySessions = pgTable(
  "deploy_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => deployUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_sessions_user").on(table.userId)],
);

export const deployOauthAccounts = pgTable(
  "deploy_oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => deployUsers.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "github" | "google"
    providerAccountId: text("provider_account_id").notNull(),
    username: text("username"),
    accessTokenEnc: text("access_token_enc").notNull(), // AES-256-GCM
    refreshTokenEnc: text("refresh_token_enc"),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_deploy_oauth_user_provider").on(table.userId, table.provider)],
);

export const deployWorkspaces = pgTable(
  "deploy_workspaces",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => deployUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: text("plan").notNull().default("starter"), // starter | growth | scale
    projectLimit: integer("project_limit").notNull().default(3),
    monthlyTransferLimitGb: integer("monthly_transfer_limit_gb").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_workspaces_owner").on(table.ownerUserId)],
);

export const deployProjects = pgTable(
  "deploy_projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => deployWorkspaces.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    repoUrl: text("repo_url").notNull(),
    branch: text("branch").notNull().default("main"),
    framework: text("framework").notNull().default("nextjs"),
    buildMethod: text("build_method").notNull().default("railpack"), // railpack | dockerfile
    buildCommand: text("build_command").notNull().default(""),
    startCommand: text("start_command").notNull().default(""),
    outputDir: text("output_dir").notNull().default("dist"),
    rootDir: text("root_dir").notNull().default("./"),
    port: integer("port").notNull().default(3000),
    healthcheckPath: text("healthcheck_path").notNull().default("/"),
    region: text("region").notNull().default("Mumbai IN-1"),
    tier: text("tier").notNull().default("starter"),
    status: text("status").notNull().default("Queued"), // Ready | Building | Queued | Stopped | Failed
    autoDeploy: boolean("auto_deploy").notNull().default(true),
    webhookSecret: text("webhook_secret"),
    activeDeploymentId: text("active_deployment_id"),
    activeContainerName: text("active_container_name"),
    activeImageTag: text("active_image_tag"),
    livePath: text("live_path"),
    customDomain: text("custom_domain"),
    commitSha: text("commit_sha"),
    commitMessage: text("commit_message").notNull().default("Initial deployment"),
    managedPostgresAttached: boolean("managed_postgres_attached").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastDeployedAt: timestamp("last_deployed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deploy_projects_owner").on(table.ownerEmail),
    index("idx_deploy_projects_workspace").on(table.workspaceId),
  ],
);

export const deployDeployments = pgTable(
  "deploy_deployments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => deployProjects.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("Queued"), // Queued | Building | Live | Failed | RolledBack | Cancelled
    triggerSource: text("trigger_source").notNull().default("manual"), // manual | git_push | rollback | webhook
    branch: text("branch").notNull().default("main"),
    commitSha: text("commit_sha"),
    commitMessage: text("commit_message").notNull().default(""),
    commitAuthor: text("commit_author"),
    imageTag: text("image_tag"),
    containerName: text("container_name"),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_deployments_project").on(table.projectId, table.createdAt)],
);

export const deployDeploymentLogs = pgTable(
  "deploy_deployment_logs",
  {
    id: text("id").primaryKey(),
    deploymentId: text("deployment_id")
      .notNull()
      .references(() => deployDeployments.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => deployProjects.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("build"), // clone | build | healthcheck | route | runtime
    level: text("level").notNull().default("info"), // info | warn | error | success
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_logs_deployment").on(table.deploymentId, table.createdAt)],
);

export const deployEnvVars = pgTable(
  "deploy_env_vars",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => deployProjects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueEnc: text("value_enc").notNull(), // AES-256-GCM
    target: text("target").notNull().default("Production"), // Production | Preview | Development
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_deploy_env_project_key_target").on(table.projectId, table.key, table.target),
  ],
);

export const deployDomains = pgTable(
  "deploy_domains",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => deployProjects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull().unique(),
    isDefault: boolean("is_default").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    tlsStatus: text("tls_status").notNull().default("pending"), // pending | active | error
    verificationTarget: text("verification_target").notNull().default("deploy.sparrowx.net"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_domains_project").on(table.projectId)],
);

export const deployUsageMetrics = pgTable(
  "deploy_usage_metrics",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => deployProjects.id, { onDelete: "cascade" }),
    cpuPct: real("cpu_pct").notNull().default(0),
    memoryMb: real("memory_mb").notNull().default(0),
    networkRxMb: real("network_rx_mb").notNull().default(0),
    networkTxMb: real("network_tx_mb").notNull().default(0),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_usage_project_time").on(table.projectId, table.recordedAt)],
);

export const deployWebhookEvents = pgTable(
  "deploy_webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("github"),
    deliveryId: text("delivery_id"),
    eventType: text("event_type").notNull(),
    repoUrl: text("repo_url"),
    branch: text("branch"),
    signatureValid: boolean("signature_valid").notNull().default(false),
    status: text("status").notNull().default("received"), // received | enqueued | ignored | rejected
    payloadSummary: jsonb("payload_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_webhooks_created").on(table.createdAt)],
);

export const deployAuditLogs = pgTable(
  "deploy_audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_deploy_audit_actor").on(table.actorEmail, table.createdAt)],
);
