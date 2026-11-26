import crypto from "node:crypto";
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDeployDb } from "@/db/deploy-db.server";
import {
  deployAuditLogs,
  deployDeployments,
  deployDeploymentLogs,
  deployDomains,
  deployEnvVars,
  deployOauthAccounts,
  deployProjects,
  deployUsageMetrics,
  deployUsers,
  deployWebhookEvents,
  deployWorkspaces,
} from "@/db/deploy-schema";
import {
  createProjectSchema,
  decryptSecret,
  DEPLOY_TIERS,
  encryptSecret,
  envVarInputSchema,
  redactSecretsFromLog,
  updateProjectSettingsSchema,
  type DeployTierId,
} from "@/lib/server/deploy-crypto.server";
import {
  enqueueDeployJob,
  publishDeployLog,
  type StreamedDeployLog,
} from "@/lib/server/deploy-queue.server";
import {
  createDeployProject as createFallbackDeployProject,
  deleteDeployProject as deleteFallbackDeployProject,
  DeployQuotaExceededError,
  FREE_DEPLOY_PROJECT_LIMIT,
  listDeployProjects as listFallbackDeployProjects,
  redeployProject as redeployFallbackProject,
  sanitizeSlug,
} from "@/lib/server/deploy.server";

const execFileAsync = promisify(execFile);

export interface DeployActor {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
}

export interface SerializedDeployProject {
  id: string;
  workspaceId: string;
  ownerEmail: string;
  name: string;
  slug: string;
  repoUrl: string;
  branch: string;
  framework: string;
  buildMethod: "railpack" | "dockerfile";
  buildCommand: string;
  startCommand: string;
  outputDir: string;
  rootDir: string;
  port: number;
  healthcheckPath: string;
  region: "Mumbai IN-1" | "Chennai IN-2" | "Singapore SG-1";
  tier: DeployTierId;
  status: "Ready" | "Building" | "Queued" | "Stopped" | "Failed";
  autoDeploy: boolean;
  webhookSecret?: string | null;
  activeDeploymentId?: string | null;
  activeContainerName?: string | null;
  activeImageTag?: string | null;
  livePath?: string | null;
  customDomain?: string | null;
  commitSha?: string | null;
  commitMessage: string;
  managedPostgresAttached: boolean;
  createdAt: string;
  lastDeployedAt: string;
  envVars: Array<{
    id: string;
    key: string;
    value: string;
    target: "Production" | "Preview" | "Development";
  }>;
  logs: string[];
  latestCpuPct?: number;
  latestMemoryMb?: number;
}

export function getDeployHostDomain(): string {
  return process.env.SPARROWX_DOMAIN?.trim() || "sparrowx.net";
}

async function ensureUserAndWorkspace(actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return null;
  const { db } = conn;
  const emailClean = actor.email.trim().toLowerCase();
  const userId =
    actor.id || `usr_${crypto.createHash("sha256").update(emailClean).digest("hex").slice(0, 12)}`;

  const [existingUser] = await db
    .select()
    .from(deployUsers)
    .where(eq(deployUsers.email, emailClean))
    .limit(1);

  const resolvedUserId = existingUser?.id ?? userId;
  if (!existingUser) {
    await db
      .insert(deployUsers)
      .values({
        id: resolvedUserId,
        email: emailClean,
        fullName: actor.fullName || emailClean.split("@")[0] || "Developer",
        role: actor.role,
      })
      .onConflictDoNothing();
  }

  const [existingWs] = await db
    .select()
    .from(deployWorkspaces)
    .where(eq(deployWorkspaces.ownerUserId, resolvedUserId))
    .limit(1);

  if (existingWs) {
    return { db, userId: resolvedUserId, workspace: existingWs };
  }

  const wsId = `ws_${crypto.randomBytes(6).toString("hex")}`;
  const wsSlug = `personal-${resolvedUserId
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 10)}`;
  const [createdWs] = await db
    .insert(deployWorkspaces)
    .values({
      id: wsId,
      ownerUserId: resolvedUserId,
      name: "Personal",
      slug: wsSlug,
      plan: "starter",
      projectLimit: FREE_DEPLOY_PROJECT_LIMIT,
      monthlyTransferLimitGb: DEPLOY_TIERS.starter.monthlyTransferGb,
    })
    .returning();

  return {
    db,
    userId: resolvedUserId,
    workspace: createdWs ?? {
      id: wsId,
      ownerUserId: resolvedUserId,
      name: "Personal",
      slug: wsSlug,
      plan: "starter",
      projectLimit: FREE_DEPLOY_PROJECT_LIMIT,
      monthlyTransferLimitGb: DEPLOY_TIERS.starter.monthlyTransferGb,
      createdAt: new Date(),
    },
  };
}

export async function saveGithubOAuthToken(params: {
  email: string;
  fullName: string;
  userId: string;
  providerAccountId: string;
  username?: string;
  accessToken: string;
  scope?: string;
}): Promise<void> {
  const ctx = await ensureUserAndWorkspace({
    id: params.userId,
    email: params.email,
    fullName: params.fullName,
    role: "client",
  });
  if (!ctx) return;
  const { db, userId } = ctx;
  const encToken = encryptSecret(params.accessToken);
  const existing = await db
    .select()
    .from(deployOauthAccounts)
    .where(and(eq(deployOauthAccounts.userId, userId), eq(deployOauthAccounts.provider, "github")))
    .limit(1);

  if (existing[0]) {
    await db
      .update(deployOauthAccounts)
      .set({
        providerAccountId: params.providerAccountId,
        username: params.username ?? existing[0].username,
        accessTokenEnc: encToken,
        scope: params.scope ?? existing[0].scope,
        updatedAt: new Date(),
      })
      .where(eq(deployOauthAccounts.id, existing[0].id));
  } else {
    await db.insert(deployOauthAccounts).values({
      id: `oauth_${crypto.randomBytes(6).toString("hex")}`,
      userId,
      provider: "github",
      providerAccountId: params.providerAccountId,
      username: params.username ?? null,
      accessTokenEnc: encToken,
      scope: params.scope ?? null,
    });
  }
}

export async function getGithubConnectionForActor(actor: DeployActor): Promise<{
  connected: boolean;
  username: string | null;
  accessToken: string | null;
}> {
  const ctx = await ensureUserAndWorkspace(actor);
  if (!ctx) return { connected: false, username: null, accessToken: null };
  const [acct] = await ctx.db
    .select()
    .from(deployOauthAccounts)
    .where(
      and(eq(deployOauthAccounts.userId, ctx.userId), eq(deployOauthAccounts.provider, "github")),
    )
    .limit(1);
  if (!acct) return { connected: false, username: null, accessToken: null };
  try {
    return {
      connected: true,
      username: acct.username,
      accessToken: decryptSecret(acct.accessTokenEnc),
    };
  } catch {
    return { connected: false, username: acct.username, accessToken: null };
  }
}

async function recordAudit(
  workspaceId: string | null,
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  const conn = await getDeployDb();
  if (!conn) return;
  await conn.db
    .insert(deployAuditLogs)
    .values({
      id: `aud_${crypto.randomBytes(6).toString("hex")}`,
      workspaceId,
      actorEmail: actorEmail.toLowerCase(),
      action,
      targetType,
      targetId,
      metadata: metadata ?? null,
    })
    .catch(() => {});
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const clean = sanitizeSlug(slug);
  const conn = await getDeployDb();
  if (!conn) return true;
  const [found] = await conn.db
    .select({ id: deployProjects.id })
    .from(deployProjects)
    .where(eq(deployProjects.slug, clean))
    .limit(1);
  return !found;
}

export async function listProjectsForActor(actor: DeployActor) {
  const hostDomain = getDeployHostDomain();
  const ctx = await ensureUserAndWorkspace(actor);

  if (!ctx) {
    const fb = await listFallbackDeployProjects(actor.email, actor.role === "admin");
    return {
      workspace: {
        id: "ws_local",
        name: "Personal",
        plan: "starter",
        projectLimit: fb.projectLimit,
        projectsUsed: fb.projectsUsed,
        remainingSlots: fb.remainingSlots,
        monthlyTransferLimitGb: 100,
        monthlyTransferUsedGb: 0,
      },
      githubConnected: false,
      githubUsername: null as string | null,
      hostDomain: fb.hostDomain,
      projects: fb.projects.map((p) => ({
        ...p,
        workspaceId: "ws_local",
        ownerEmail: p.ownerEmail || actor.email,
        buildMethod: "railpack" as const,
        startCommand: "",
        port: 3000,
        healthcheckPath: "/",
        tier: "starter" as const,
        autoDeploy: true,
        managedPostgresAttached: false,
      })),
      projectLimit: fb.projectLimit,
      projectsUsed: fb.projectsUsed,
      remainingSlots: fb.remainingSlots,
    };
  }

  const { db, workspace } = ctx;
  const rows =
    actor.role === "admin"
      ? await db.select().from(deployProjects).orderBy(desc(deployProjects.lastDeployedAt))
      : await db
          .select()
          .from(deployProjects)
          .where(eq(deployProjects.ownerEmail, actor.email.toLowerCase()))
          .orderBy(desc(deployProjects.lastDeployedAt));

  const projectIds = rows.map((r) => r.id);
  const [envRows, metricRows, ghConn] = await Promise.all([
    projectIds.length > 0
      ? db.select().from(deployEnvVars).where(inArray(deployEnvVars.projectId, projectIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db
          .select()
          .from(deployUsageMetrics)
          .where(inArray(deployUsageMetrics.projectId, projectIds))
          .orderBy(desc(deployUsageMetrics.recordedAt))
          .limit(projectIds.length * 4)
      : Promise.resolve([]),
    getGithubConnectionForActor(actor),
  ]);

  const envMap = new Map<string, typeof envRows>();
  for (const e of envRows) {
    const list = envMap.get(e.projectId) ?? [];
    list.push(e);
    envMap.set(e.projectId, list);
  }

  const latestMetricMap = new Map<string, (typeof metricRows)[number]>();
  let totalTransferMb = 0;
  for (const m of metricRows) {
    if (!latestMetricMap.has(m.projectId)) {
      latestMetricMap.set(m.projectId, m);
    }
    totalTransferMb += (m.networkRxMb || 0) + (m.networkTxMb || 0);
  }

  const ownedCount = rows.filter(
    (r) => r.ownerEmail.toLowerCase() === actor.email.toLowerCase(),
  ).length;
  const projectLimit = workspace.projectLimit || FREE_DEPLOY_PROJECT_LIMIT;

  const projects: SerializedDeployProject[] = rows.map((r) => {
    const m = latestMetricMap.get(r.id);
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      ownerEmail: r.ownerEmail,
      name: r.name,
      slug: r.slug,
      repoUrl: r.repoUrl,
      branch: r.branch,
      framework: r.framework,
      buildMethod: r.buildMethod === "dockerfile" ? "dockerfile" : "railpack",
      buildCommand: r.buildCommand,
      startCommand: r.startCommand,
      outputDir: r.outputDir,
      rootDir: r.rootDir,
      port: r.port,
      healthcheckPath: r.healthcheckPath,
      region: (r.region as SerializedDeployProject["region"]) || "Mumbai IN-1",
      tier: ((r.tier as DeployTierId) in DEPLOY_TIERS ? r.tier : "starter") as DeployTierId,
      status: (r.status as SerializedDeployProject["status"]) || "Queued",
      autoDeploy: r.autoDeploy,
      webhookSecret: r.webhookSecret ? "••••••••" : null,
      activeDeploymentId: r.activeDeploymentId,
      activeContainerName: r.activeContainerName,
      activeImageTag: r.activeImageTag,
      livePath: r.livePath,
      customDomain: r.customDomain,
      commitSha: r.commitSha,
      commitMessage: r.commitMessage,
      managedPostgresAttached: r.managedPostgresAttached,
      createdAt: r.createdAt.toISOString(),
      lastDeployedAt: r.lastDeployedAt.toISOString(),
      envVars: (envMap.get(r.id) ?? []).map((v) => ({
        id: v.id,
        key: v.key,
        value: "••••••••••••",
        target: (v.target as "Production" | "Preview" | "Development") || "Production",
      })),
      logs: [],
      ...(m
        ? { latestCpuPct: Number(m.cpuPct.toFixed(1)), latestMemoryMb: Math.round(m.memoryMb) }
        : {}),
    };
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      projectLimit,
      projectsUsed: ownedCount,
      remainingSlots: Math.max(0, projectLimit - ownedCount),
      monthlyTransferLimitGb: workspace.monthlyTransferLimitGb,
      monthlyTransferUsedGb: Number((totalTransferMb / 1024).toFixed(2)),
    },
    githubConnected: ghConn.connected,
    githubUsername: ghConn.username,
    hostDomain,
    projects,
    projectLimit,
    projectsUsed: ownedCount,
    remainingSlots: Math.max(0, projectLimit - ownedCount),
  };
}

export async function createProjectForActor(rawInput: unknown, actor: DeployActor) {
  const parsed = createProjectSchema.parse(rawInput);
  const ctx = await ensureUserAndWorkspace(actor);

  if (!ctx) {
    const created = await createFallbackDeployProject({
      ownerEmail: actor.email,
      ...(parsed.name ? { name: parsed.name } : {}),
      repoUrl: parsed.repoUrl,
      branch: parsed.branch,
      framework: parsed.framework,
      buildCommand: parsed.buildCommand,
      outputDir: parsed.outputDir,
      rootDir: parsed.rootDir,
      region: parsed.region,
      envVars: parsed.envVars,
    });
    return {
      project: {
        ...created,
        workspaceId: "ws_local",
        ownerEmail: actor.email,
        buildMethod: parsed.buildMethod,
        startCommand: parsed.startCommand,
        port: parsed.port,
        healthcheckPath: parsed.healthcheckPath,
        tier: parsed.tier,
        autoDeploy: parsed.autoDeploy,
        managedPostgresAttached: parsed.attachManagedPostgres,
      },
      deploymentId: `dep_${crypto.randomBytes(6).toString("hex")}`,
      queued: false,
    };
  }

  const { db, workspace } = ctx;
  const emailClean = actor.email.toLowerCase();
  const ownedProjects = await db
    .select({ id: deployProjects.id })
    .from(deployProjects)
    .where(eq(deployProjects.ownerEmail, emailClean));

  const limit = workspace.projectLimit || FREE_DEPLOY_PROJECT_LIMIT;
  if (workspace.plan === "starter" && ownedProjects.length >= limit) {
    throw new DeployQuotaExceededError(ownedProjects.length, limit);
  }

  const name = parsed.name || sanitizeSlug(parsed.repoUrl);
  let slug = sanitizeSlug(parsed.slug || name);
  const slugConflict = await db
    .select({ id: deployProjects.id })
    .from(deployProjects)
    .where(eq(deployProjects.slug, slug))
    .limit(1);
  if (slugConflict[0]) {
    slug = `${slug.slice(0, 24)}-${crypto.randomBytes(3).toString("hex")}`;
  }

  const projectId = `prj_${crypto.randomBytes(6).toString("hex")}`;
  const deploymentId = `dep_${crypto.randomBytes(6).toString("hex")}`;
  const webhookSecret = crypto.randomBytes(24).toString("hex");
  const hostDomain = getDeployHostDomain();
  const defaultSubdomain = `${slug}.deploy.${hostDomain}`;

  const [inserted] = await db
    .insert(deployProjects)
    .values({
      id: projectId,
      workspaceId: workspace.id,
      ownerEmail: emailClean,
      name,
      slug,
      repoUrl: parsed.repoUrl,
      branch: parsed.branch,
      framework: parsed.framework,
      buildMethod: parsed.buildMethod,
      buildCommand: parsed.buildCommand,
      startCommand: parsed.startCommand,
      outputDir: parsed.outputDir,
      rootDir: parsed.rootDir,
      port: parsed.port,
      healthcheckPath: parsed.healthcheckPath,
      region: parsed.region,
      tier: parsed.tier,
      status: "Queued",
      autoDeploy: parsed.autoDeploy,
      webhookSecret,
      activeDeploymentId: deploymentId,
      livePath: `/api/deploy/site?slug=${encodeURIComponent(slug)}`,
      commitMessage: `Queued initial build from ${parsed.branch}`,
      managedPostgresAttached: parsed.attachManagedPostgres,
    })
    .returning();

  await db.insert(deployDomains).values({
    id: `dom_${crypto.randomBytes(6).toString("hex")}`,
    projectId,
    domain: defaultSubdomain,
    isDefault: true,
    verified: true,
    tlsStatus: "active",
    verificationTarget: `deploy.${hostDomain}`,
    lastCheckedAt: new Date(),
  });

  // Encrypt and persist environment variables (+ Managed Postgres DATABASE_URL if toggled)
  const envToInsert = [...parsed.envVars];
  if (parsed.attachManagedPostgres && !envToInsert.some((v) => v.key === "DATABASE_URL")) {
    const dbHost = `db.${hostDomain}`;
    const pgUser = `spx_${slug.replace(/-/g, "_").slice(0, 16)}`;
    const pgPass = crypto.randomBytes(12).toString("hex");
    envToInsert.push({
      key: "DATABASE_URL",
      value: `postgresql://${pgUser}:${pgPass}@${dbHost}:5432/${pgUser}_db?sslmode=require`,
      target: "Production",
    });
  }

  for (const v of envToInsert) {
    await db
      .insert(deployEnvVars)
      .values({
        id: `env_${crypto.randomBytes(6).toString("hex")}`,
        projectId,
        key: v.key,
        valueEnc: encryptSecret(v.value),
        target: v.target,
      })
      .onConflictDoNothing();
  }

  await db.insert(deployDeployments).values({
    id: deploymentId,
    projectId,
    status: "Queued",
    triggerSource: "manual",
    branch: parsed.branch,
    commitMessage: `Initial deploy from ${parsed.branch}`,
    commitAuthor: actor.fullName || emailClean,
  });

  const initialLog: StreamedDeployLog = {
    id: `log_${crypto.randomBytes(6).toString("hex")}`,
    deploymentId,
    projectId,
    stage: "clone",
    level: "info",
    message: `Queued ${parsed.buildMethod} build for ${name} (${parsed.repoUrl} @ ${parsed.branch})`,
    createdAt: new Date().toISOString(),
  };
  await db.insert(deployDeploymentLogs).values({
    id: initialLog.id,
    deploymentId,
    projectId,
    stage: initialLog.stage,
    level: initialLog.level,
    message: initialLog.message,
  });
  await publishDeployLog(initialLog);

  await recordAudit(workspace.id, emailClean, "project.created", "project", projectId, {
    slug,
    framework: parsed.framework,
    tier: parsed.tier,
    buildMethod: parsed.buildMethod,
  });

  const enq = await enqueueDeployJob({
    kind: "build",
    projectId,
    deploymentId,
    actorEmail: emailClean,
    triggerSource: "manual",
  });

  return {
    project: {
      id: inserted!.id,
      workspaceId: inserted!.workspaceId,
      ownerEmail: inserted!.ownerEmail,
      name: inserted!.name,
      slug: inserted!.slug,
      repoUrl: inserted!.repoUrl,
      branch: inserted!.branch,
      framework: inserted!.framework,
      buildMethod: inserted!.buildMethod as "railpack" | "dockerfile",
      buildCommand: inserted!.buildCommand,
      startCommand: inserted!.startCommand,
      outputDir: inserted!.outputDir,
      rootDir: inserted!.rootDir,
      port: inserted!.port,
      healthcheckPath: inserted!.healthcheckPath,
      region: inserted!.region as SerializedDeployProject["region"],
      tier: inserted!.tier as DeployTierId,
      status: inserted!.status as SerializedDeployProject["status"],
      autoDeploy: inserted!.autoDeploy,
      activeDeploymentId: deploymentId,
      livePath: inserted!.livePath,
      customDomain: inserted!.customDomain,
      commitSha: inserted!.commitSha,
      commitMessage: inserted!.commitMessage,
      managedPostgresAttached: inserted!.managedPostgresAttached,
      createdAt: inserted!.createdAt.toISOString(),
      lastDeployedAt: inserted!.lastDeployedAt.toISOString(),
      envVars: envToInsert.map((v, idx) => ({
        id: `env_${idx}`,
        key: v.key,
        value: "••••••••••••",
        target: v.target,
      })),
      logs: [initialLog.message],
    },
    deploymentId,
    queued: enq.queued,
  };
}

async function assertProjectAccess(projectId: string, actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return null;
  const [proj] = await conn.db
    .select()
    .from(deployProjects)
    .where(eq(deployProjects.id, projectId))
    .limit(1);
  if (!proj) return null;
  if (actor.role !== "admin" && proj.ownerEmail.toLowerCase() !== actor.email.toLowerCase()) {
    return null;
  }
  return { db: conn.db, project: proj };
}

export async function getProjectControlPlane(projectId: string, actor: DeployActor) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) return null;
  const { db, project } = access;

  const [deployments, envVars, domains, metrics] = await Promise.all([
    db
      .select()
      .from(deployDeployments)
      .where(eq(deployDeployments.projectId, project.id))
      .orderBy(desc(deployDeployments.createdAt))
      .limit(30),
    db
      .select()
      .from(deployEnvVars)
      .where(eq(deployEnvVars.projectId, project.id))
      .orderBy(deployEnvVars.key),
    db
      .select()
      .from(deployDomains)
      .where(eq(deployDomains.projectId, project.id))
      .orderBy(desc(deployDomains.isDefault), deployDomains.createdAt),
    db
      .select()
      .from(deployUsageMetrics)
      .where(eq(deployUsageMetrics.projectId, project.id))
      .orderBy(desc(deployUsageMetrics.recordedAt))
      .limit(24),
  ]);

  const activeDepId = project.activeDeploymentId || deployments[0]?.id;
  const logs = activeDepId
    ? await db
        .select()
        .from(deployDeploymentLogs)
        .where(eq(deployDeploymentLogs.deploymentId, activeDepId))
        .orderBy(deployDeploymentLogs.createdAt)
        .limit(400)
    : [];

  return {
    project: {
      ...project,
      createdAt: project.createdAt.toISOString(),
      lastDeployedAt: project.lastDeployedAt.toISOString(),
    },
    deployments: deployments.map((d) => ({
      ...d,
      startedAt: d.startedAt.toISOString(),
      finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    })),
    logs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    envVars: envVars.map((v) => ({
      id: v.id,
      key: v.key,
      value: "••••••••••••",
      target: v.target as "Production" | "Preview" | "Development",
      updatedAt: v.updatedAt.toISOString(),
    })),
    domains: domains.map((d) => ({
      ...d,
      lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    })),
    metrics: metrics
      .slice()
      .reverse()
      .map((m) => ({
        cpuPct: Number(m.cpuPct.toFixed(1)),
        memoryMb: Math.round(m.memoryMb),
        networkRxMb: Number(m.networkRxMb.toFixed(2)),
        networkTxMb: Number(m.networkTxMb.toFixed(2)),
        recordedAt: m.recordedAt.toISOString(),
      })),
    hostDomain: getDeployHostDomain(),
  };
}

export async function runProjectLifecycleAction(
  projectId: string,
  action: "redeploy" | "rollback" | "start" | "stop" | "restart",
  actor: DeployActor,
  targetDeploymentId?: string,
) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) {
    if (action === "redeploy") {
      const p = await redeployFallbackProject(projectId, actor.email, actor.role === "admin");
      return { ok: true, project: p };
    }
    throw new Error("Project not found.");
  }

  const { db, project } = access;
  const deploymentId = `dep_${crypto.randomBytes(6).toString("hex")}`;

  if (action === "start" || action === "stop" || action === "restart") {
    const enq = await enqueueDeployJob({
      kind: action,
      projectId: project.id,
      deploymentId,
      actorEmail: actor.email,
      triggerSource: "manual",
    });
    if (!enq.queued && project.activeContainerName) {
      await execFileAsync("docker", [action, project.activeContainerName], {
        timeout: 15_000,
      }).catch(() => {});
    }
    const nextStatus = action === "stop" ? "Stopped" : "Ready";
    await db
      .update(deployProjects)
      .set({ status: nextStatus })
      .where(eq(deployProjects.id, project.id));
    await recordAudit(project.workspaceId, actor.email, `project.${action}`, "project", project.id);
    return { ok: true, status: nextStatus, queued: enq.queued };
  }

  if (action === "rollback") {
    if (!targetDeploymentId) throw new Error("targetDeploymentId is required for rollback.");
    const [targetDep] = await db
      .select()
      .from(deployDeployments)
      .where(
        and(
          eq(deployDeployments.id, targetDeploymentId),
          eq(deployDeployments.projectId, project.id),
        ),
      )
      .limit(1);
    if (!targetDep || !targetDep.imageTag) {
      throw new Error("Selected deployment does not have an immutable image tag for rollback.");
    }

    await db.insert(deployDeployments).values({
      id: deploymentId,
      projectId: project.id,
      status: "Queued",
      triggerSource: "rollback",
      branch: targetDep.branch,
      commitSha: targetDep.commitSha,
      commitMessage: `Rollback to ${targetDep.commitSha || targetDep.id}`,
      commitAuthor: actor.fullName || actor.email,
      imageTag: targetDep.imageTag,
    });

    await db
      .update(deployProjects)
      .set({ status: "Building", activeDeploymentId: deploymentId })
      .where(eq(deployProjects.id, project.id));

    const enq = await enqueueDeployJob({
      kind: "rollback",
      projectId: project.id,
      deploymentId,
      targetImageTag: targetDep.imageTag,
      actorEmail: actor.email,
      triggerSource: "rollback",
    });

    await recordAudit(project.workspaceId, actor.email, "project.rollback", "project", project.id, {
      targetDeploymentId,
      imageTag: targetDep.imageTag,
    });
    return { ok: true, deploymentId, queued: enq.queued };
  }

  // Redeploy
  await db.insert(deployDeployments).values({
    id: deploymentId,
    projectId: project.id,
    status: "Queued",
    triggerSource: "manual",
    branch: project.branch,
    commitMessage: `Manual redeploy on ${project.branch}`,
    commitAuthor: actor.fullName || actor.email,
  });

  await db
    .update(deployProjects)
    .set({ status: "Queued", activeDeploymentId: deploymentId })
    .where(eq(deployProjects.id, project.id));

  const logEntry: StreamedDeployLog = {
    id: `log_${crypto.randomBytes(6).toString("hex")}`,
    deploymentId,
    projectId: project.id,
    stage: "clone",
    level: "info",
    message: `Redeploy queued by ${actor.email} on branch ${project.branch}`,
    createdAt: new Date().toISOString(),
  };
  await db.insert(deployDeploymentLogs).values({
    id: logEntry.id,
    deploymentId,
    projectId: project.id,
    stage: logEntry.stage,
    level: logEntry.level,
    message: logEntry.message,
  });
  await publishDeployLog(logEntry);

  const enq = await enqueueDeployJob({
    kind: "build",
    projectId: project.id,
    deploymentId,
    actorEmail: actor.email,
    triggerSource: "manual",
  });

  await recordAudit(project.workspaceId, actor.email, "project.redeploy", "project", project.id, {
    deploymentId,
  });
  return { ok: true, deploymentId, queued: enq.queued };
}

export async function deleteProjectForActor(projectId: string, actor: DeployActor) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) {
    return deleteFallbackDeployProject(projectId, actor.email, actor.role === "admin");
  }
  const { db, project } = access;
  await enqueueDeployJob({
    kind: "delete",
    projectId: project.id,
    deploymentId: `del_${crypto.randomBytes(4).toString("hex")}`,
    actorEmail: actor.email,
    triggerSource: "manual",
  });
  await db.delete(deployProjects).where(eq(deployProjects.id, project.id));
  await recordAudit(project.workspaceId, actor.email, "project.deleted", "project", project.id, {
    slug: project.slug,
  });
  return { deleted: true };
}

export async function updateProjectSettingsForActor(
  projectId: string,
  rawPatch: unknown,
  actor: DeployActor,
) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) throw new Error("Project not found.");
  const patch = updateProjectSettingsSchema.parse(rawPatch);
  const { db, project } = access;

  const updates: Partial<typeof deployProjects.$inferInsert> = {};
  if (patch.branch !== undefined) updates.branch = patch.branch;
  if (patch.rootDir !== undefined) updates.rootDir = patch.rootDir;
  if (patch.buildMethod !== undefined) updates.buildMethod = patch.buildMethod;
  if (patch.buildCommand !== undefined) updates.buildCommand = patch.buildCommand;
  if (patch.startCommand !== undefined) updates.startCommand = patch.startCommand;
  if (patch.outputDir !== undefined) updates.outputDir = patch.outputDir;
  if (patch.port !== undefined) updates.port = patch.port;
  if (patch.healthcheckPath !== undefined) updates.healthcheckPath = patch.healthcheckPath;
  if (patch.autoDeploy !== undefined) updates.autoDeploy = patch.autoDeploy;
  if (patch.tier !== undefined) updates.tier = patch.tier;

  const [updated] = await db
    .update(deployProjects)
    .set(updates)
    .where(eq(deployProjects.id, project.id))
    .returning();

  await recordAudit(
    project.workspaceId,
    actor.email,
    "project.settings_updated",
    "project",
    project.id,
    {
      keys: Object.keys(updates),
    },
  );
  return updated;
}

export async function upsertEnvVarsForProject(
  projectId: string,
  items: unknown[],
  actor: DeployActor,
) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) throw new Error("Project not found.");
  const { db, project } = access;
  const validated = items.map((item) => envVarInputSchema.parse(item));

  for (const v of validated) {
    const enc = encryptSecret(v.value);
    const existing = await db
      .select()
      .from(deployEnvVars)
      .where(
        and(
          eq(deployEnvVars.projectId, project.id),
          eq(deployEnvVars.key, v.key),
          eq(deployEnvVars.target, v.target),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(deployEnvVars)
        .set({ valueEnc: enc, updatedAt: new Date() })
        .where(eq(deployEnvVars.id, existing[0].id));
    } else {
      await db.insert(deployEnvVars).values({
        id: `env_${crypto.randomBytes(6).toString("hex")}`,
        projectId: project.id,
        key: v.key,
        valueEnc: enc,
        target: v.target,
      });
    }
  }

  await recordAudit(project.workspaceId, actor.email, "env.upserted", "project", project.id, {
    count: validated.length,
  });

  const rows = await db
    .select()
    .from(deployEnvVars)
    .where(eq(deployEnvVars.projectId, project.id))
    .orderBy(deployEnvVars.key);
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    value: "••••••••••••",
    target: r.target,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function revealEnvVarForProject(
  projectId: string,
  envId: string,
  actor: DeployActor,
): Promise<{ id: string; key: string; value: string } | null> {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) return null;
  const [row] = await access.db
    .select()
    .from(deployEnvVars)
    .where(and(eq(deployEnvVars.id, envId), eq(deployEnvVars.projectId, projectId)))
    .limit(1);
  if (!row) return null;
  return { id: row.id, key: row.key, value: decryptSecret(row.valueEnc) };
}

export async function removeEnvVarForProject(
  projectId: string,
  envId: string,
  actor: DeployActor,
): Promise<boolean> {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) return false;
  await access.db
    .delete(deployEnvVars)
    .where(and(eq(deployEnvVars.id, envId), eq(deployEnvVars.projectId, projectId)));
  await recordAudit(access.project.workspaceId, actor.email, "env.deleted", "env_var", envId);
  return true;
}

export async function listDomainsForActor(actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return [];
  const { db } = conn;
  const projects =
    actor.role === "admin"
      ? await db.select().from(deployProjects)
      : await db
          .select()
          .from(deployProjects)
          .where(eq(deployProjects.ownerEmail, actor.email.toLowerCase()));
  if (projects.length === 0) return [];

  const projMap = new Map(projects.map((p) => [p.id, p]));
  const domains = await db
    .select()
    .from(deployDomains)
    .where(
      inArray(
        deployDomains.projectId,
        projects.map((p) => p.id),
      ),
    )
    .orderBy(desc(deployDomains.createdAt));

  return domains.map((d) => ({
    ...d,
    projectName: projMap.get(d.projectId)?.name ?? "Project",
    projectSlug: projMap.get(d.projectId)?.slug ?? "",
    lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function attachDomainForActor(projectId: string, domain: string, actor: DeployActor) {
  const access = await assertProjectAccess(projectId, actor);
  if (!access) throw new Error("Project not found.");
  const { db, project } = access;
  const hostDomain = getDeployHostDomain();
  const cleanDomain = domain.trim().toLowerCase();

  const [created] = await db
    .insert(deployDomains)
    .values({
      id: `dom_${crypto.randomBytes(6).toString("hex")}`,
      projectId: project.id,
      domain: cleanDomain,
      isDefault: false,
      verified: false,
      tlsStatus: "pending",
      verificationTarget: `deploy.${hostDomain}`,
    })
    .returning();

  await db
    .update(deployProjects)
    .set({ customDomain: cleanDomain })
    .where(eq(deployProjects.id, project.id));

  await recordAudit(project.workspaceId, actor.email, "domain.attached", "domain", cleanDomain, {
    projectId: project.id,
  });

  return created;
}

export async function verifyDomainDnsForActor(domainId: string, actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) throw new Error("Database unavailable.");
  const { db } = conn;
  const [dom] = await db
    .select()
    .from(deployDomains)
    .where(eq(deployDomains.id, domainId))
    .limit(1);
  if (!dom) throw new Error("Domain not found.");
  const access = await assertProjectAccess(dom.projectId, actor);
  if (!access) throw new Error("Unauthorized domain access.");

  const expectedCname = dom.verificationTarget.toLowerCase();
  const expectedIp = process.env.SPARROWX_PUBLIC_IP?.trim() || "";
  let verified = dom.isDefault;
  let detail = dom.isDefault ? "Default SparrowX wildcard TLS active." : "";

  if (!verified) {
    const [cnameRes, aRes] = await Promise.allSettled([
      dns.resolveCname(dom.domain),
      dns.resolve4(dom.domain),
    ]);
    const cnames =
      cnameRes.status === "fulfilled"
        ? cnameRes.value.map((c) => c.toLowerCase().replace(/\.$/, ""))
        : [];
    const ips = aRes.status === "fulfilled" ? aRes.value : [];

    if (cnames.some((c) => c === expectedCname || c.endsWith(`.${expectedCname}`))) {
      verified = true;
      detail = `Verified CNAME -> ${cnames[0]}`;
    } else if (expectedIp && ips.includes(expectedIp)) {
      verified = true;
      detail = `Verified A record -> ${expectedIp}`;
    } else {
      detail = `DNS not pointed yet (found A: ${ips.join(", ") || "none"}, CNAME: ${cnames.join(", ") || "none"}). Point CNAME to ${expectedCname}${expectedIp ? ` or A to ${expectedIp}` : ""}.`;
    }
  }

  const [updated] = await db
    .update(deployDomains)
    .set({
      verified,
      tlsStatus: verified ? "active" : "pending",
      lastCheckedAt: new Date(),
    })
    .where(eq(deployDomains.id, dom.id))
    .returning();

  return { domain: updated, verified, detail };
}

export async function removeDomainForActor(domainId: string, actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return false;
  const [dom] = await conn.db
    .select()
    .from(deployDomains)
    .where(eq(deployDomains.id, domainId))
    .limit(1);
  if (!dom || dom.isDefault) return false;
  const access = await assertProjectAccess(dom.projectId, actor);
  if (!access) return false;
  await conn.db.delete(deployDomains).where(eq(deployDomains.id, dom.id));
  return true;
}

/**
 * Caddy On-Demand TLS `/api/deploy/internal/ask` domain check.
 * Allows certificate issuance ONLY for registered `*.deploy.sparrowx.net` or verified custom domains.
 */
export async function isDomainAllowedForTls(rawDomain: string): Promise<boolean> {
  const clean = rawDomain.trim().toLowerCase().replace(/\.$/, "");
  if (!clean) return false;
  const hostDomain = getDeployHostDomain().toLowerCase();
  if (clean === `deploy.${hostDomain}`) return true;

  const conn = await getDeployDb();
  if (!conn) return false;
  const [found] = await conn.db
    .select({
      id: deployDomains.id,
      isDefault: deployDomains.isDefault,
      verified: deployDomains.verified,
    })
    .from(deployDomains)
    .where(eq(deployDomains.domain, clean))
    .limit(1);
  return Boolean(found && (found.isDefault || found.verified));
}

export async function listGlobalDeploymentsForActor(actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return [];
  const { db } = conn;
  const projects =
    actor.role === "admin"
      ? await db.select().from(deployProjects)
      : await db
          .select()
          .from(deployProjects)
          .where(eq(deployProjects.ownerEmail, actor.email.toLowerCase()));
  if (projects.length === 0) return [];
  const projMap = new Map(projects.map((p) => [p.id, p]));
  const rows = await db
    .select()
    .from(deployDeployments)
    .where(
      inArray(
        deployDeployments.projectId,
        projects.map((p) => p.id),
      ),
    )
    .orderBy(desc(deployDeployments.createdAt))
    .limit(60);

  return rows.map((d) => ({
    ...d,
    projectName: projMap.get(d.projectId)?.name ?? "Project",
    projectSlug: projMap.get(d.projectId)?.slug ?? "",
    framework: projMap.get(d.projectId)?.framework ?? "nextjs",
    startedAt: d.startedAt.toISOString(),
    finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function getUsageSummaryForActor(actor: DeployActor) {
  const list = await listProjectsForActor(actor);
  const conn = await getDeployDb();
  const tierInfo =
    DEPLOY_TIERS[
      (list.workspace.plan as DeployTierId) in DEPLOY_TIERS
        ? (list.workspace.plan as DeployTierId)
        : "starter"
    ];

  let totalCpu = 0;
  let totalRamMb = 0;
  let totalRxMb = 0;
  let totalTxMb = 0;
  const perProject: Array<{
    projectId: string;
    name: string;
    slug: string;
    tier: string;
    status: string;
    cpuPct: number;
    memoryMb: number;
    transferGb: number;
  }> = [];

  if (conn && list.projects.length > 0) {
    const metrics = await conn.db
      .select()
      .from(deployUsageMetrics)
      .where(
        inArray(
          deployUsageMetrics.projectId,
          list.projects.map((p) => p.id),
        ),
      )
      .orderBy(desc(deployUsageMetrics.recordedAt))
      .limit(200);

    for (const p of list.projects) {
      const pMetrics = metrics.filter((m) => m.projectId === p.id);
      const latest = pMetrics[0];
      const rx = pMetrics.reduce((acc, m) => acc + (m.networkRxMb || 0), 0);
      const tx = pMetrics.reduce((acc, m) => acc + (m.networkTxMb || 0), 0);
      const cpu = latest ? latest.cpuPct : 0;
      const ram = latest ? latest.memoryMb : 0;
      totalCpu += cpu;
      totalRamMb += ram;
      totalRxMb += rx;
      totalTxMb += tx;
      perProject.push({
        projectId: p.id,
        name: p.name,
        slug: p.slug,
        tier: p.tier,
        status: p.status,
        cpuPct: Number(cpu.toFixed(1)),
        memoryMb: Math.round(ram),
        transferGb: Number(((rx + tx) / 1024).toFixed(3)),
      });
    }
  } else {
    for (const p of list.projects) {
      perProject.push({
        projectId: p.id,
        name: p.name,
        slug: p.slug,
        tier: p.tier,
        status: p.status,
        cpuPct: 0,
        memoryMb: 0,
        transferGb: 0,
      });
    }
  }

  return {
    workspace: list.workspace,
    tier: tierInfo,
    totals: {
      activeProjects: list.projects.filter((p) => p.status === "Ready").length,
      totalProjects: list.projects.length,
      avgCpuPct:
        list.projects.length > 0 ? Number((totalCpu / list.projects.length).toFixed(1)) : 0,
      memoryUsedMb: Math.round(totalRamMb),
      memoryLimitMb: tierInfo.ramMb * Math.max(1, list.workspace.projectLimit),
      transferUsedGb: Number(((totalRxMb + totalTxMb) / 1024).toFixed(2)),
      transferLimitGb: list.workspace.monthlyTransferLimitGb,
    },
    perProject,
    tiers: Object.values(DEPLOY_TIERS),
  };
}

export async function handleGithubPushWebhook(params: {
  deliveryId: string | null;
  eventType: string;
  repoUrl: string;
  branch: string;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  signatureValid: boolean;
}) {
  const conn = await getDeployDb();
  if (!conn) return { matched: 0, enqueued: 0 };
  const { db } = conn;

  const cleanRepo = params.repoUrl
    .trim()
    .replace(/\.git$/i, "")
    .toLowerCase();
  const projects = await db.select().from(deployProjects);
  const matching = projects.filter(
    (p) =>
      p.autoDeploy &&
      p.branch === params.branch &&
      p.repoUrl
        .trim()
        .replace(/\.git$/i, "")
        .toLowerCase() === cleanRepo,
  );

  let enqueued = 0;
  for (const proj of matching) {
    const deploymentId = `dep_${crypto.randomBytes(6).toString("hex")}`;
    await db.insert(deployDeployments).values({
      id: deploymentId,
      projectId: proj.id,
      status: "Queued",
      triggerSource: "git_push",
      branch: params.branch,
      commitSha: params.commitSha ?? null,
      commitMessage: redactSecretsFromLog(params.commitMessage || `Push to ${params.branch}`, []),
      commitAuthor: params.commitAuthor ?? "github",
    });
    await db
      .update(deployProjects)
      .set({ status: "Queued", activeDeploymentId: deploymentId })
      .where(eq(deployProjects.id, proj.id));

    const dedupeKey = `gh-push-${proj.id}-${params.commitSha || params.deliveryId || deploymentId}`;
    await enqueueDeployJob(
      {
        kind: "build",
        projectId: proj.id,
        deploymentId,
        actorEmail: proj.ownerEmail,
        triggerSource: "git_push",
      },
      dedupeKey,
    );
    enqueued++;
  }

  await db
    .insert(deployWebhookEvents)
    .values({
      id: `wh_${crypto.randomBytes(6).toString("hex")}`,
      provider: "github",
      deliveryId: params.deliveryId,
      eventType: params.eventType,
      repoUrl: params.repoUrl,
      branch: params.branch,
      signatureValid: params.signatureValid,
      status: enqueued > 0 ? "enqueued" : "ignored",
      payloadSummary: {
        commitSha: params.commitSha ?? null,
        matched: matching.length,
        enqueued,
      },
    })
    .catch(() => {});

  return { matched: matching.length, enqueued };
}

export async function getDeploymentHistoryLogs(deploymentId: string, actor: DeployActor) {
  const conn = await getDeployDb();
  if (!conn) return null;
  const [dep] = await conn.db
    .select()
    .from(deployDeployments)
    .where(eq(deployDeployments.id, deploymentId))
    .limit(1);
  if (!dep) return null;
  const access = await assertProjectAccess(dep.projectId, actor);
  if (!access) return null;

  const logs = await conn.db
    .select()
    .from(deployDeploymentLogs)
    .where(eq(deployDeploymentLogs.deploymentId, deploymentId))
    .orderBy(deployDeploymentLogs.createdAt)
    .limit(500);

  return {
    deployment: dep,
    logs: logs.map((l) => ({
      id: l.id,
      deploymentId: l.deploymentId,
      projectId: l.projectId,
      stage: l.stage,
      level: l.level,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}
