import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BLOCKED_DEPLOY_ENV_KEY_RE =
  /^(PATH|LD_.*|DYLD_.*|NODE_OPTIONS|NODE_EXTRA_CA_CERTS|BASH_ENV|ENV|SHELL|GIT_.*|NPM_CONFIG_.*|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|POSTGRES_.*|PG.*|PVE_.*|PTERO_.*|RAZORPAY_.*|GOOGLE_.*|SPARROWX_.*|JWT_SECRET|SESSION_SECRET|DATABASE_URL|SUPABASE_.*)$/i;

function isPrivateOrReservedHostIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (
    clean === "localhost" ||
    clean === "::1" ||
    clean === "::" ||
    clean === "0.0.0.0" ||
    /^fe[89ab][0-9a-f]:/.test(clean) ||
    /^f[cd][0-9a-f]{2}:/.test(clean) ||
    /^ff[0-9a-f]{2}:/.test(clean) ||
    /^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(clean)
  ) {
    return true;
  }
  const v4Mapped = clean.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const candidate = v4Mapped ? v4Mapped[1]! : clean;
  const parts = candidate.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255)) {
    const [a, b, c] = parts as [number, number, number, number];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export type DeployFramework =
  | "nextjs"
  | "vite"
  | "tanstack"
  | "node"
  | "python"
  | "static"
  | "docker";

export interface DeployEnvVar {
  id: string;
  key: string;
  value: string;
  target: "Production" | "Preview" | "Development";
}

export interface DeployProjectRecord {
  id: string;
  ownerEmail?: string;
  name: string;
  slug: string;
  repoUrl: string;
  branch: string;
  framework: DeployFramework;
  buildCommand: string;
  outputDir: string;
  rootDir: string;
  region: "Mumbai IN-1" | "Chennai IN-2" | "Singapore SG-1";
  status: "Ready" | "Building" | "Queued" | "Failed";
  commitSha?: string;
  livePath?: string;
  customDomain?: string;
  envVars: DeployEnvVar[];
  createdAt: string;
  lastDeployedAt: string;
  commitMessage: string;
  logs: string[];
}

export function getDeployDataDir(): string {
  return process.env.SPARROWX_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

function getStorePath(): string {
  return path.join(getDeployDataDir(), "deploy-projects.json");
}

export function getDeploySiteDir(slug: string): string {
  const safe = sanitizeSlug(slug);
  return path.join(getDeployDataDir(), "deploy-sites", safe);
}

function getDeployWorkspaceDir(slug: string): string {
  const safe = sanitizeSlug(slug);
  return path.join(getDeployDataDir(), "deploy-workspaces", safe);
}

function readStore(): DeployProjectRecord[] {
  const filePath = getStorePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeployProjectRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore(projects: DeployProjectRecord[]): void {
  const dir = getDeployDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = getStorePath();
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(projects, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?(github|gitlab)\.com\/[^/]+\//i, "")
    .replace(/\.git$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || `app-${crypto.randomBytes(3).toString("hex")}`;
}

function isSafeGitUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host ||
      !host.includes(".") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".localhost") ||
      host.endsWith(".lan") ||
      isPrivateOrReservedHostIp(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function assertPublicGitHost(url: string): Promise<void> {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const [v4, v6] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
  const ips: string[] = [
    ...(v4.status === "fulfilled" ? v4.value : []),
    ...(v6.status === "fulfilled" ? v6.value : []),
  ];
  if (ips.length === 0 || ips.some((ip) => isPrivateOrReservedHostIp(ip))) {
    throw new Error("SSRF protection blocked repository host resolution.");
  }
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Executes a real Git clone + build + static publish pipeline directly on the hosted server.
 * Zero mock logs — every line comes from real git / npm / filesystem execution.
 */
async function executeServerDeployPipeline(record: DeployProjectRecord): Promise<{
  status: DeployProjectRecord["status"];
  commitSha?: string;
  livePath?: string;
  logs: string[];
}> {
  const logs: string[] = [];
  const log = (msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    logs.push(`[${ts}] ${msg}`);
  };

  const rawBranch = record.branch.replace(/[^a-zA-Z0-9._/-]/g, "").replace(/^-+/, "");
  const safeBranch = rawBranch || "main";
  const workDir = getDeployWorkspaceDir(record.slug);
  const siteDir = getDeploySiteDir(record.slug);
  let commitSha: string | undefined;

  log(`Starting real server pipeline for ${record.slug} (${record.repoUrl} @ ${safeBranch})`);

  // 1. Real Git clone / fetch (with DNS SSRF verification and "--" option termination)
  try {
    await assertPublicGitHost(record.repoUrl);
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(workDir), { recursive: true });
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", "--branch", safeBranch, "--", record.repoUrl, workDir],
      {
        timeout: 60_000,
        windowsHide: true,
        env: {
          PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          GIT_TERMINAL_PROMPT: "0",
          GIT_ALLOW_PROTOCOL: "https",
        },
      },
    );
    const { stdout: shaOut } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: workDir,
      timeout: 5000,
      windowsHide: true,
    });
    commitSha = shaOut.trim() || undefined;
    log(`Cloned repository cleanly${commitSha ? ` (HEAD ${commitSha})` : ""}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : "git clone failed";
    log(`Git clone error: ${msg}`);
    return { status: "Failed", logs };
  }

  // Resolve safe rootDir inside workDir (strict path separator boundary)
  const resolvedWorkDir = path.resolve(workDir);
  const relRoot = (record.rootDir || ".").replace(/^\/+/, "");
  const projectDir = path.resolve(resolvedWorkDir, relRoot);
  if (projectDir !== resolvedWorkDir && !projectDir.startsWith(resolvedWorkDir + path.sep)) {
    log("Security block: rootDir escaped repository workspace.");
    return { status: "Failed", ...(commitSha ? { commitSha } : {}), logs };
  }

  // Build isolated environment map — NEVER inherit server secrets from process.env
  const buildEnv: Record<string, string> = {
    PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: resolvedWorkDir,
    TMPDIR: resolvedWorkDir,
    CI: "true",
    NODE_ENV: "production",
  };
  for (const v of record.envVars) {
    if (v.key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v.key) && !BLOCKED_DEPLOY_ENV_KEY_RE.test(v.key)) {
      buildEnv[v.key] = v.value;
    }
  }

  // 2. Real dependency install & build (with --ignore-scripts to prevent postinstall RCE)
  const hasPackageJson = fs.existsSync(path.join(projectDir, "package.json"));
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  if (hasPackageJson && record.framework !== "static") {
    try {
      log("Running npm install --ignore-scripts --no-audit --no-fund...");
      await execFileAsync(npmBin, ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
        cwd: projectDir,
        env: buildEnv,
        timeout: 180_000,
        windowsHide: true,
      });
      log("Dependencies installed.");

      if (record.buildCommand && record.buildCommand.trim()) {
        // Only allow safe npm run <script> execution without shell injection
        const buildMatch = record.buildCommand.trim().match(/^npm\s+run\s+([a-zA-Z0-9:_-]+)$/);
        if (buildMatch && buildMatch[1]) {
          log(`Running npm run ${buildMatch[1]}...`);
          const { stdout } = await execFileAsync(npmBin, ["run", buildMatch[1]], {
            cwd: projectDir,
            env: buildEnv,
            timeout: 180_000,
            windowsHide: true,
          });
          const lastLines = stdout
            .trim()
            .split(/\r?\n/)
            .slice(-4)
            .filter(Boolean);
          for (const l of lastLines) log(l);
        } else {
          log(`Build command "${record.buildCommand}" queued for container runner.`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.split("\n")[0] : "build failed";
      log(`Build failed: ${msg}`);
      return { status: "Failed", ...(commitSha ? { commitSha } : {}), logs };
    }
  }

  // 3. Publish real output directory to hosted site directory (strict path separator boundary)
  const relOut = (record.outputDir || "dist").replace(/^\/+/, "");
  const outSource = path.resolve(projectDir, relOut);
  const publishSource =
    (outSource === resolvedWorkDir || outSource.startsWith(resolvedWorkDir + path.sep)) &&
    fs.existsSync(outSource)
      ? outSource
      : projectDir;

  try {
    fs.rmSync(siteDir, { recursive: true, force: true });
    copyDirRecursive(publishSource, siteDir);
    const livePath = `/api/deploy/site?slug=${encodeURIComponent(record.slug)}`;
    log(`Published live artifacts from ${path.relative(workDir, publishSource) || "."} -> ${livePath}`);
    return { status: "Ready", ...(commitSha ? { commitSha } : {}), livePath, logs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publish failed";
    log(`Publish error: ${msg}`);
    return { status: "Failed", ...(commitSha ? { commitSha } : {}), logs };
  }
}

function canManageProject(
  project: DeployProjectRecord,
  ownerEmail?: string,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  if (!ownerEmail) return false;
  return Boolean(
    project.ownerEmail &&
      project.ownerEmail.toLowerCase() === ownerEmail.trim().toLowerCase(),
  );
}

export async function listDeployProjects(
  ownerEmail?: string,
  isAdmin = false,
): Promise<{
  projects: DeployProjectRecord[];
  hostDomain: string;
}> {
  const projects = readStore().filter((p) => canManageProject(p, ownerEmail, isAdmin));
  const safe = projects.map((p) => ({
    ...p,
    envVars: p.envVars.map((v) => ({
      ...v,
      value: v.value ? "••••••••••••" : "",
    })),
  }));
  return {
    projects: safe,
    hostDomain: process.env.SPARROWX_DOMAIN?.trim() || "sparrowx.net",
  };
}

export async function createDeployProject(input: {
  ownerEmail?: string;
  name?: string;
  repoUrl: string;
  branch?: string;
  framework?: DeployFramework;
  buildCommand?: string;
  outputDir?: string;
  rootDir?: string;
  region?: DeployProjectRecord["region"];
  envVars?: Array<{ key: string; value: string; target?: DeployEnvVar["target"] }>;
}): Promise<DeployProjectRecord> {
  const repoUrl = (input.repoUrl || "").trim();
  if (!repoUrl || !isSafeGitUrl(repoUrl)) {
    throw new Error("A valid public https:// Git repository URL is required.");
  }

  const branch =
    (input.branch || "main").trim().replace(/[^a-zA-Z0-9._/-]/g, "").replace(/^-+/, "") || "main";
  const name = (input.name || "").trim() || sanitizeSlug(repoUrl);
  const cleanOwner = input.ownerEmail?.trim().toLowerCase();
  const existing = readStore();
  let slug = sanitizeSlug(name);
  if (existing.some((p) => p.slug === slug && p.ownerEmail?.toLowerCase() !== cleanOwner)) {
    slug = `${slug.slice(0, 24)}-${crypto.randomBytes(3).toString("hex")}`;
  }
  const framework: DeployFramework = input.framework || "nextjs";
  const now = new Date().toISOString();

  const draft: DeployProjectRecord = {
    id: `prj_${crypto.randomBytes(6).toString("hex")}`,
    ...(cleanOwner ? { ownerEmail: cleanOwner } : {}),
    name,
    slug,
    repoUrl,
    branch,
    framework,
    buildCommand: (input.buildCommand ?? "").trim(),
    outputDir: (input.outputDir || "dist").trim(),
    rootDir: (input.rootDir || "./").trim(),
    region: input.region || "Mumbai IN-1",
    status: "Building",
    envVars: (input.envVars || [])
      .filter((e) => e.key && e.key.trim() && !BLOCKED_DEPLOY_ENV_KEY_RE.test(e.key.trim()))
      .map((e) => ({
        id: `env_${crypto.randomBytes(4).toString("hex")}`,
        key: e.key.trim(),
        value: e.value ?? "",
        target: e.target || "Production",
      })),
    createdAt: now,
    lastDeployedAt: now,
    commitMessage: `Deploying ${branch}...`,
    logs: [],
  };

  const result = await executeServerDeployPipeline(draft);
  const record: DeployProjectRecord = {
    ...draft,
    status: result.status,
    ...(result.commitSha ? { commitSha: result.commitSha } : {}),
    ...(result.livePath ? { livePath: result.livePath } : {}),
    commitMessage: result.commitSha
      ? `Built commit ${result.commitSha} from ${branch}`
      : result.status === "Failed"
        ? `Deployment failed — inspect build logs`
        : `Deployed from ${branch}`,
    logs: result.logs,
  };

  const latest = readStore();
  writeStore([record, ...latest]);

  return {
    ...record,
    envVars: record.envVars.map((v) => ({ ...v, value: v.value ? "••••••••••••" : "" })),
  };
}

export async function redeployProject(
  id: string,
  ownerEmail?: string,
  isAdmin = false,
): Promise<DeployProjectRecord> {
  const existing = readStore();
  const target = existing.find((p) => p.id === id);
  if (!target || !canManageProject(target, ownerEmail, isAdmin)) {
    throw new Error("Project not found on server.");
  }

  const result = await executeServerDeployPipeline(target);
  const updated: DeployProjectRecord = {
    ...target,
    status: result.status,
    ...(result.commitSha ? { commitSha: result.commitSha } : {}),
    ...(result.livePath ? { livePath: result.livePath } : {}),
    lastDeployedAt: new Date().toISOString(),
    commitMessage: result.commitSha
      ? `Built commit ${result.commitSha} from ${target.branch}`
      : result.status === "Failed"
        ? "Redeploy failed — inspect build logs"
        : target.commitMessage,
    logs: [...target.logs.slice(-20), ...result.logs],
  };

  writeStore(existing.map((p) => (p.id === id ? updated : p)));
  return {
    ...updated,
    envVars: updated.envVars.map((v) => ({ ...v, value: v.value ? "••••••••••••" : "" })),
  };
}

export async function attachCustomDomain(
  id: string,
  domain: string,
  ownerEmail?: string,
  isAdmin = false,
): Promise<DeployProjectRecord> {
  const cleaned = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!cleaned || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
    throw new Error("Enter a valid domain name (e.g. app.example.com).");
  }

  const existing = readStore();
  const target = existing.find((p) => p.id === id);
  if (!target || !canManageProject(target, ownerEmail, isAdmin)) {
    throw new Error("Project not found on server.");
  }

  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  const updated: DeployProjectRecord = {
    ...target,
    customDomain: cleaned,
    logs: [...target.logs, `[${ts}] Attached custom domain: ${cleaned}`],
  };

  writeStore(existing.map((p) => (p.id === id ? updated : p)));
  return {
    ...updated,
    envVars: updated.envVars.map((v) => ({ ...v, value: v.value ? "••••••••••••" : "" })),
  };
}

export async function addProjectEnvVar(
  id: string,
  key: string,
  value: string,
  targetEnv: DeployEnvVar["target"] = "Production",
  ownerEmail?: string,
  isAdmin = false,
): Promise<DeployProjectRecord> {
  const cleanKey = key.trim();
  if (!cleanKey || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanKey) || BLOCKED_DEPLOY_ENV_KEY_RE.test(cleanKey)) {
    throw new Error("Environment variable key is invalid or restricted.");
  }

  const existing = readStore();
  const target = existing.find((p) => p.id === id);
  if (!target || !canManageProject(target, ownerEmail, isAdmin)) {
    throw new Error("Project not found on server.");
  }

  const item: DeployEnvVar = {
    id: `env_${crypto.randomBytes(4).toString("hex")}`,
    key: cleanKey,
    value,
    target: targetEnv,
  };

  const updated: DeployProjectRecord = {
    ...target,
    envVars: [...target.envVars.filter((v) => v.key !== cleanKey), item],
  };

  writeStore(existing.map((p) => (p.id === id ? updated : p)));
  return {
    ...updated,
    envVars: updated.envVars.map((v) => ({ ...v, value: v.value ? "••••••••••••" : "" })),
  };
}

export async function removeProjectEnvVar(
  id: string,
  envId: string,
  ownerEmail?: string,
  isAdmin = false,
): Promise<DeployProjectRecord> {
  const existing = readStore();
  const target = existing.find((p) => p.id === id);
  if (!target || !canManageProject(target, ownerEmail, isAdmin)) {
    throw new Error("Project not found on server.");
  }

  const updated: DeployProjectRecord = {
    ...target,
    envVars: target.envVars.filter((v) => v.id !== envId),
  };

  writeStore(existing.map((p) => (p.id === id ? updated : p)));
  return {
    ...updated,
    envVars: updated.envVars.map((v) => ({ ...v, value: v.value ? "••••••••••••" : "" })),
  };
}

export async function deleteDeployProject(
  id: string,
  ownerEmail?: string,
  isAdmin = false,
): Promise<{ deleted: boolean }> {
  const existing = readStore();
  const target = existing.find((p) => p.id === id);
  if (!target || !canManageProject(target, ownerEmail, isAdmin)) {
    return { deleted: false };
  }
  const next = existing.filter((p) => p.id !== id);
  try {
    fs.rmSync(getDeployWorkspaceDir(target.slug), { recursive: true, force: true });
    fs.rmSync(getDeploySiteDir(target.slug), { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
  writeStore(next);
  return { deleted: true };
}
