#!/usr/bin/env tsx
/**
 * SparrowX Deploy — Production BullMQ Build & Container Orchestration Worker
 *
 * Features:
 * - Zero shell injection: all git / docker / railpack calls use execFile / spawn argument arrays
 * - Railpack zero-config builds + Dockerfile Docker BuildKit builds with cache reuse
 * - Immutable OCI image tags (`sparrowx/<project-id>:<deployment-id>`) for 1-click rollback
 * - Isolated `sparrowx_apps` bridge network + CPU/RAM/PIDs/no-new-privileges guardrails
 * - 60s healthcheck verification + atomic zero-downtime blue-green proxy cutover
 * - Real-time secret-redacted log streaming via Redis Pub/Sub + PostgreSQL persistence
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { getDeployDb } from "../src/db/deploy-db.server";
import {
  deployDeployments,
  deployDeploymentLogs,
  deployDomains,
  deployEnvVars,
  deployOauthAccounts,
  deployProjects,
  deployUsers,
} from "../src/db/deploy-schema";
import {
  decryptSecret,
  DEPLOY_TIERS,
  redactSecretsFromLog,
  type DeployTierId,
} from "../src/lib/server/deploy-crypto.server";
import {
  DEPLOY_QUEUE_NAME,
  publishDeployLog,
  type DeployJobPayload,
  type StreamedDeployLog,
} from "../src/lib/server/deploy-queue.server";
import { removeProjectProxyRoute, upsertProjectProxyRoute } from "./proxy-manager";

const execFileAsync = promisify(execFile);
const APPS_NETWORK = process.env.SPARROWX_APPS_NETWORK || "sparrowx_apps";

async function appendLog(
  projectId: string,
  deploymentId: string,
  stage: StreamedDeployLog["stage"],
  level: StreamedDeployLog["level"],
  rawMessage: string,
  secrets: string[],
): Promise<void> {
  const message = redactSecretsFromLog(rawMessage, secrets);
  const entry: StreamedDeployLog = {
    id: `log_${crypto.randomBytes(6).toString("hex")}`,
    deploymentId,
    projectId,
    stage,
    level,
    message,
    createdAt: new Date().toISOString(),
  };

  await publishDeployLog(entry);
  const conn = await getDeployDb();
  if (conn) {
    await conn.db
      .insert(deployDeploymentLogs)
      .values({
        id: entry.id,
        deploymentId,
        projectId,
        stage,
        level,
        message,
      })
      .catch(() => {});
  }
}

function runStreamingCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    onLine: (line: string, isErr: boolean) => void;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Command timed out after ${Math.round((options.timeoutMs ?? 300_000) / 1000)}s`));
    }, options.timeoutMs ?? 300_000);

    const handleChunk = (buf: Buffer, isErr: boolean) => {
      const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
      for (const l of lines) options.onLine(l, isErr);
    };

    child.stdout?.on("data", (b: Buffer) => handleChunk(b, false));
    child.stderr?.on("data", (b: Buffer) => handleChunk(b, true));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? -1}`));
    });
  });
}

async function ensureAppsNetwork(): Promise<void> {
  await execFileAsync("docker", ["network", "inspect", APPS_NETWORK], { timeout: 5000 }).catch(
    async () => {
      await execFileAsync("docker", ["network", "create", "--driver", "bridge", APPS_NETWORK], {
        timeout: 10_000,
      }).catch(() => {});
    },
  );
}

async function waitForContainerHealth(
  containerName: string,
  port: number,
  healthcheckPath: string,
  maxWaitSec = 60,
): Promise<boolean> {
  const safePath = healthcheckPath.startsWith("/") ? healthcheckPath : `/${healthcheckPath}`;
  const deadline = Date.now() + maxWaitSec * 1000;
  while (Date.now() < deadline) {
    try {
      const { stdout: state } = await execFileAsync(
        "docker",
        ["inspect", "-f", "{{.State.Running}}", containerName],
        { timeout: 4000 },
      );
      if (state.trim() !== "true") return false;

      const { stdout: ipOut } = await execFileAsync(
        "docker",
        [
          "inspect",
          "-f",
          `{{with index .NetworkSettings.Networks "${APPS_NETWORK}"}}{{.IPAddress}}{{end}}`,
          containerName,
        ],
        { timeout: 4000 },
      );
      const ip = ipOut.trim();
      if (ip) {
        const res = await fetch(`http://${ip}:${port}${safePath}`, {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        if (res && res.status < 500) {
          return true;
        }
      }
    } catch {
      // retry until deadline
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function startBlueGreenContainer(params: {
  project: typeof deployProjects.$inferSelect;
  deploymentId: string;
  imageTag: string;
  domains: string[];
  envEntries: Array<{ key: string; value: string }>;
  secrets: string[];
}): Promise<{ containerName: string }> {
  const { project, deploymentId, imageTag, domains, envEntries, secrets } = params;
  const tier =
    DEPLOY_TIERS[(project.tier as DeployTierId) in DEPLOY_TIERS ? (project.tier as DeployTierId) : "starter"];
  const containerName = `spx-${project.slug.slice(0, 20)}-${deploymentId.slice(-6)}`.replace(
    /[^a-zA-Z0-9_.-]/g,
    "-",
  );

  await ensureAppsNetwork();

  // Write ephemeral 0600 env file for container launch, then unlink immediately
  const envFile = path.join(os.tmpdir(), `spx-env-${deploymentId}.env`);
  const envLines = [
    `PORT=${project.port}`,
    `NODE_ENV=production`,
    ...envEntries.map((e) => `${e.key}=${e.value.replace(/\r?\n/g, "")}`),
  ];
  fs.writeFileSync(envFile, envLines.join("\n") + "\n", { mode: 0o600 });

  try {
    await appendLog(
      project.id,
      deploymentId,
      "healthcheck",
      "info",
      `Launching isolated container ${containerName} (${tier.vcpu} vCPU, ${tier.ramMb}MB RAM, pids<=256)...`,
      secrets,
    );

    await execFileAsync(
      "docker",
      [
        "run",
        "-d",
        "--name",
        containerName,
        "--restart",
        "unless-stopped",
        "--network",
        APPS_NETWORK,
        "--memory",
        `${tier.ramMb}m`,
        "--cpus",
        String(tier.vcpu),
        "--pids-limit",
        "256",
        "--security-opt",
        "no-new-privileges:true",
        "--label",
        `sparrowx.project=${project.id}`,
        "--label",
        `sparrowx.deployment=${deploymentId}`,
        "--env-file",
        envFile,
        imageTag,
      ],
      { timeout: 30_000 },
    );
  } finally {
    fs.rmSync(envFile, { force: true });
  }

  await appendLog(
    project.id,
    deploymentId,
    "healthcheck",
    "info",
    `Probing healthcheck GET ${project.healthcheckPath} on port ${project.port} (timeout 60s)...`,
    secrets,
  );

  const healthy = await waitForContainerHealth(
    containerName,
    project.port,
    project.healthcheckPath,
    60,
  );
  if (!healthy) {
    await execFileAsync("docker", ["rm", "-f", containerName], { timeout: 10_000 }).catch(() => {});
    throw new Error(
      `Healthcheck failed on ${project.healthcheckPath}:${project.port}. Previous deployment remains active.`,
    );
  }

  await appendLog(
    project.id,
    deploymentId,
    "route",
    "info",
    `Healthcheck passed — cutting over reverse proxy route for ${domains.join(", ")}...`,
    secrets,
  );

  const routeRes = await upsertProjectProxyRoute({
    projectId: project.id,
    slug: project.slug,
    domains,
    upstreamHost: containerName,
    upstreamPort: project.port,
  });

  await appendLog(project.id, deploymentId, "route", "success", routeRes.detail, secrets);

  // Gracefully drain and remove old container AFTER atomic route cutover
  if (project.activeContainerName && project.activeContainerName !== containerName) {
    await new Promise((r) => setTimeout(r, 3000));
    await execFileAsync("docker", ["stop", "-t", "10", project.activeContainerName], {
      timeout: 20_000,
    }).catch(() => {});
    await execFileAsync("docker", ["rm", "-f", project.activeContainerName], {
      timeout: 10_000,
    }).catch(() => {});
    await appendLog(
      project.id,
      deploymentId,
      "route",
      "info",
      `Drained and retired previous container ${project.activeContainerName}.`,
      secrets,
    );
  }

  return { containerName };
}

export async function processDeployJob(payload: DeployJobPayload): Promise<void> {
  const startedAt = Date.now();
  const conn = await getDeployDb();
  if (!conn) throw new Error("PostgreSQL unavailable for deploy worker.");
  const { db } = conn;

  const [project] = await db
    .select()
    .from(deployProjects)
    .where(eq(deployProjects.id, payload.projectId))
    .limit(1);
  if (!project) throw new Error(`Project ${payload.projectId} not found.`);

  // Lifecycle-only container operations
  if (payload.kind === "stop" || payload.kind === "start" || payload.kind === "restart") {
    if (project.activeContainerName) {
      await execFileAsync("docker", [payload.kind, project.activeContainerName], {
        timeout: 25_000,
      }).catch(() => {});
    }
    await db
      .update(deployProjects)
      .set({ status: payload.kind === "stop" ? "Stopped" : "Ready" })
      .where(eq(deployProjects.id, project.id));
    return;
  }

  if (payload.kind === "delete") {
    await removeProjectProxyRoute(project.id, project.slug);
    if (project.activeContainerName) {
      await execFileAsync("docker", ["rm", "-f", project.activeContainerName], {
        timeout: 15_000,
      }).catch(() => {});
    }
    return;
  }

  // Decrypt env vars & collect secret values for redaction
  const rawEnvs = await db
    .select()
    .from(deployEnvVars)
    .where(eq(deployEnvVars.projectId, project.id));
  const envEntries: Array<{ key: string; value: string }> = [];
  const secrets: string[] = [];
  for (const row of rawEnvs) {
    try {
      const value = decryptSecret(row.valueEnc);
      envEntries.push({ key: row.key, value });
      if (value) secrets.push(value);
    } catch {
      // skip corrupted entry
    }
  }

  const domainRows = await db
    .select()
    .from(deployDomains)
    .where(eq(deployDomains.projectId, project.id));
  const hostDomain = process.env.SPARROWX_DOMAIN?.trim() || "sparrowx.net";
  const activeDomains = domainRows
    .filter((d) => d.isDefault || d.verified)
    .map((d) => d.domain);
  if (activeDomains.length === 0) {
    activeDomains.push(`${project.slug}.deploy.${hostDomain}`);
  }

  await db
    .update(deployDeployments)
    .set({ status: "Building", startedAt: new Date() })
    .where(eq(deployDeployments.id, payload.deploymentId));
  await db
    .update(deployProjects)
    .set({ status: "Building" })
    .where(eq(deployProjects.id, project.id));

  try {
    // 1-CLICK ROLLBACK PATH (reuses immutable image tag without rebuilding!)
    if (payload.kind === "rollback" && payload.targetImageTag) {
      await appendLog(
        project.id,
        payload.deploymentId,
        "build",
        "info",
        `Rolling back to immutable OCI image ${payload.targetImageTag} (zero rebuild)...`,
        secrets,
      );
      const { containerName } = await startBlueGreenContainer({
        project,
        deploymentId: payload.deploymentId,
        imageTag: payload.targetImageTag,
        domains: activeDomains,
        envEntries,
        secrets,
      });
      const durationMs = Date.now() - startedAt;
      await db
        .update(deployDeployments)
        .set({
          status: "Live",
          imageTag: payload.targetImageTag,
          containerName,
          durationMs,
          finishedAt: new Date(),
        })
        .where(eq(deployDeployments.id, payload.deploymentId));
      await db
        .update(deployProjects)
        .set({
          status: "Ready",
          activeDeploymentId: payload.deploymentId,
          activeContainerName: containerName,
          activeImageTag: payload.targetImageTag,
          lastDeployedAt: new Date(),
        })
        .where(eq(deployProjects.id, project.id));
      await appendLog(
        project.id,
        payload.deploymentId,
        "route",
        "success",
        `Rollback live in ${(durationMs / 1000).toFixed(1)}s.`,
        secrets,
      );
      return;
    }

    // FULL BUILD PATH: Clone -> Railpack/BuildKit -> Healthcheck -> Blue-Green Cutover
    const workDir = path.join(os.tmpdir(), `spx-build-${project.slug}-${payload.deploymentId}`);
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });

    // Optional encrypted GitHub token for private repositories
    let cloneUrl = project.repoUrl;
    const [ownerRow] = await db
      .select()
      .from(deployUsers)
      .where(eq(deployUsers.email, project.ownerEmail))
      .limit(1);
    if (ownerRow && cloneUrl.startsWith("https://github.com/")) {
      const [ghOauth] = await db
        .select()
        .from(deployOauthAccounts)
        .where(eq(deployOauthAccounts.userId, ownerRow.id))
        .limit(1);
      if (ghOauth && ghOauth.provider === "github") {
        try {
          const ghToken = decryptSecret(ghOauth.accessTokenEnc);
          if (ghToken) {
            secrets.push(ghToken);
            cloneUrl = cloneUrl.replace(
              "https://github.com/",
              `https://x-access-token:${encodeURIComponent(ghToken)}@github.com/`,
            );
          }
        } catch {
          // continue anonymously
        }
      }
    }

    try {
      await appendLog(
        project.id,
        payload.deploymentId,
        "clone",
        "info",
        `Cloning ${project.repoUrl} (branch: ${project.branch})...`,
        secrets,
      );

      await runStreamingCommand(
        "git",
        ["clone", "--depth", "1", "--branch", project.branch, "--", cloneUrl, workDir],
        {
          env: {
            PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            GIT_TERMINAL_PROMPT: "0",
            GIT_ALLOW_PROTOCOL: "https",
          },
          timeoutMs: 90_000,
          onLine: (line) => {
            void appendLog(project.id, payload.deploymentId, "clone", "info", line, secrets);
          },
        },
      );

      const { stdout: metaOut } = await execFileAsync(
        "git",
        ["log", "-1", "--format=%h|%an|%s"],
        { cwd: workDir, timeout: 5000 },
      );
      const [commitSha = "", commitAuthor = "", commitMessage = ""] = metaOut.trim().split("|");

      await appendLog(
        project.id,
        payload.deploymentId,
        "clone",
        "success",
        `Checked out ${commitSha || "HEAD"} by ${commitAuthor || "git"} — "${commitMessage || "push"}"`,
        secrets,
      );

      const relRoot = (project.rootDir || ".").replace(/^\/+/, "");
      const buildDir = path.resolve(workDir, relRoot);
      if (buildDir !== path.resolve(workDir) && !buildDir.startsWith(path.resolve(workDir) + path.sep)) {
        throw new Error("Root directory escaped build workspace.");
      }

      const imageTag = `sparrowx/${project.id.toLowerCase()}:${payload.deploymentId.toLowerCase()}`;
      const hasDockerfile = fs.existsSync(path.join(buildDir, "Dockerfile"));
      const useDockerfile = project.buildMethod === "dockerfile" || hasDockerfile;

      if (useDockerfile) {
        await appendLog(
          project.id,
          payload.deploymentId,
          "build",
          "info",
          `Building OCI image ${imageTag} with Docker BuildKit (Dockerfile)...`,
          secrets,
        );
        await runStreamingCommand(
          "docker",
          ["build", "--progress=plain", "-t", imageTag, buildDir],
          {
            env: {
              PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
              DOCKER_BUILDKIT: "1",
            },
            timeoutMs: 360_000,
            onLine: (line, isErr) => {
              void appendLog(
                project.id,
                payload.deploymentId,
                "build",
                isErr ? "info" : "info",
                line,
                secrets,
              );
            },
          },
        );
      } else {
        await appendLog(
          project.id,
          payload.deploymentId,
          "build",
          "info",
          `Building OCI image ${imageTag} with Railpack Zero-Config (BuildKit)...`,
          secrets,
        );
        // Generate Railpack plan or invoke railpack CLI when installed on host
        const railpackAvailable = await execFileAsync("railpack", ["--version"], { timeout: 3000 })
          .then(() => true)
          .catch(() => false);

        if (railpackAvailable) {
          await runStreamingCommand("railpack", ["build", "--name", imageTag, buildDir], {
            env: {
              PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
              DOCKER_BUILDKIT: "1",
            },
            timeoutMs: 360_000,
            onLine: (line) => {
              void appendLog(project.id, payload.deploymentId, "build", "info", line, secrets);
            },
          });
        } else {
          // Synthesize deterministic zero-config BuildKit Dockerfile for Node/Python/Static
          const autoDockerfile = path.join(buildDir, ".Dockerfile.sparrowx");
          const isPython =
            project.framework === "python" ||
            fs.existsSync(path.join(buildDir, "requirements.txt"));
          const isStatic = project.framework === "static";
          const dockerfileBody = isStatic
            ? `FROM nginx:1.27-alpine\nCOPY . /usr/share/nginx/html\nEXPOSE ${project.port}\n`
            : isPython
              ? `FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi\nEXPOSE ${project.port}\nCMD ${project.startCommand ? `["sh","-c","${project.startCommand}"]` : `["uvicorn","main:app","--host","0.0.0.0","--port","${project.port}"]`}\n`
              : `FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --no-audit --no-fund\nCOPY . .\n${project.buildCommand ? `RUN ${project.buildCommand}\n` : ""}EXPOSE ${project.port}\nCMD ${project.startCommand ? `["sh","-c","${project.startCommand}"]` : `["npm","run","start"]`}\n`;
          fs.writeFileSync(autoDockerfile, dockerfileBody, "utf8");
          await runStreamingCommand(
            "docker",
            ["build", "--progress=plain", "-f", autoDockerfile, "-t", imageTag, buildDir],
            {
              env: {
                PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                DOCKER_BUILDKIT: "1",
              },
              timeoutMs: 360_000,
              onLine: (line) => {
                void appendLog(project.id, payload.deploymentId, "build", "info", line, secrets);
              },
            },
          );
        }
      }

      const { containerName } = await startBlueGreenContainer({
        project,
        deploymentId: payload.deploymentId,
        imageTag,
        domains: activeDomains,
        envEntries,
        secrets,
      });

      const durationMs = Date.now() - startedAt;
      await db
        .update(deployDeployments)
        .set({
          status: "Live",
          commitSha: commitSha || null,
          commitMessage: commitMessage || `Deployed ${project.branch}`,
          commitAuthor: commitAuthor || null,
          imageTag,
          containerName,
          durationMs,
          finishedAt: new Date(),
        })
        .where(eq(deployDeployments.id, payload.deploymentId));

      await db
        .update(deployProjects)
        .set({
          status: "Ready",
          commitSha: commitSha || null,
          commitMessage: commitMessage || `Deployed ${project.branch}`,
          activeDeploymentId: payload.deploymentId,
          activeContainerName: containerName,
          activeImageTag: imageTag,
          lastDeployedAt: new Date(),
        })
        .where(eq(deployProjects.id, project.id));

      await appendLog(
        project.id,
        payload.deploymentId,
        "route",
        "success",
        `Deployment live at https://${activeDomains[0]} in ${(durationMs / 1000).toFixed(1)}s.`,
        secrets,
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errMsg = err instanceof Error ? err.message : "Build pipeline failed";
    await appendLog(project.id, payload.deploymentId, "build", "error", errMsg, secrets);
    await db
      .update(deployDeployments)
      .set({
        status: "Failed",
        errorMessage: redactSecretsFromLog(errMsg, secrets),
        durationMs,
        finishedAt: new Date(),
      })
      .where(eq(deployDeployments.id, payload.deploymentId));
    await db
      .update(deployProjects)
      .set({ status: project.activeContainerName ? "Ready" : "Failed" })
      .where(eq(deployProjects.id, project.id));
    throw err;
  }
}

// Start standalone BullMQ worker when executed directly via `tsx worker/deploy-worker.ts`
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("worker", "deploy-worker.ts"));

if (isDirectRun) {
  const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const worker = new Worker<DeployJobPayload>(
    DEPLOY_QUEUE_NAME,
    async (job) => {
      await processDeployJob(job.data);
    },
    {
      connection,
      concurrency: Number(process.env.SPARROWX_WORKER_CONCURRENCY || 2),
    },
  );

  worker.on("ready", () => {
    console.log(`[sparrowx-deploy-worker] Listening on BullMQ queue "${DEPLOY_QUEUE_NAME}"`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[sparrowx-deploy-worker] Job ${job?.id} failed:`, err.message);
  });
}
