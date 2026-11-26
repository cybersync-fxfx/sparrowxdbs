import crypto from "node:crypto";
import { z } from "zod";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let ephemeralKey: Buffer | null = null;

function resolveEncryptionKey(): Buffer {
  const raw =
    process.env.SPARROWX_ENCRYPTION_KEY?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.SPARROWX_JWT_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (raw) {
    return crypto.createHash("sha256").update(raw, "utf8").digest();
  }
  if (!ephemeralKey) {
    ephemeralKey = crypto.randomBytes(32);
  }
  return ephemeralKey;
}

/**
 * Encrypts a plaintext secret using AES-256-GCM with a random 12-byte IV.
 * Output format: `v1:<ivHex>:<authTagHex>:<cipherHex>`
 */
export function encryptSecret(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a `v1:<ivHex>:<authTagHex>:<cipherHex>` AES-256-GCM ciphertext.
 */
export function decryptSecret(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted secret format.");
  }
  const [, ivHex, tagHex, cipherHex] = parts as [string, string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Corrupted secret envelope.");
  }
  const key = resolveEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Redacts all known secret values from build/runtime log lines before storage or SSE streaming.
 */
export function redactSecretsFromLog(line: string, secretValues: string[]): string {
  let out = line;
  for (const secret of secretValues) {
    const trimmed = secret.trim();
    if (trimmed.length >= 4) {
      out = out.split(trimmed).join("[REDACTED]");
    }
  }
  // Redact embedded credentials in URLs (https://user:token@github.com)
  out = out.replace(/(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, "$1$2:[REDACTED]@");
  return out;
}

/**
 * Strictly verifies GitHub's `X-Hub-Signature-256` HMAC-SHA256 webhook signature.
 */
export function verifyGithubWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const trimmed = signatureHeader.trim();
  if (!trimmed.startsWith("sha256=")) return false;
  const providedHex = trimmed.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(providedHex)) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(providedHex.toLowerCase(), "hex");
  const b = Buffer.from(expectedHex.toLowerCase(), "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ============================================================================
// STRICT ZOD VALIDATION SCHEMAS (Zero Shell Injection)
// ============================================================================

const SAFE_SHELL_FREE_CMD_RE = /^[a-zA-Z0-9._:/@\-=+\s]*$/;
const SAFE_BRANCH_RE = /^[a-zA-Z0-9._/-]{1,120}$/;
const SAFE_ROOT_DIR_RE = /^\.?\/?[a-zA-Z0-9._/-]{0,120}$/;
const SAFE_ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

export const BLOCKED_DEPLOY_ENV_KEYS =
  /^(PATH|LD_.*|DYLD_.*|NODE_OPTIONS|NODE_EXTRA_CA_CERTS|BASH_ENV|ENV|SHELL|GIT_.*|NPM_CONFIG_.*|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|POSTGRES_.*|PG.*|PVE_.*|PTERO_.*|RAZORPAY_.*|GOOGLE_.*|SPARROWX_.*|JWT_SECRET|SESSION_SECRET|SUPABASE_.*)$/i;

export const DEPLOY_FRAMEWORKS = [
  "nextjs",
  "vite",
  "tanstack",
  "node",
  "python",
  "static",
  "docker",
] as const;

export const DEPLOY_TIERS = {
  starter: {
    id: "starter",
    label: "Starter",
    vcpu: 1,
    ramMb: 1024,
    bandwidthMbps: 100,
    monthlyTransferGb: 100,
    priceInr: 0,
    badge: "Free Tier (Up to 3 Projects)",
  },
  growth: {
    id: "growth",
    label: "Growth",
    vcpu: 2,
    ramMb: 4096,
    bandwidthMbps: 200,
    monthlyTransferGb: 500,
    priceInr: 799,
    badge: "Production Apps",
  },
  scale: {
    id: "scale",
    label: "Scale",
    vcpu: 4,
    ramMb: 8192,
    bandwidthMbps: 300,
    monthlyTransferGb: 2000,
    priceInr: 1999,
    badge: "High Throughput",
  },
} as const;

export type DeployTierId = keyof typeof DEPLOY_TIERS;

export const envVarInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(128)
    .regex(SAFE_ENV_KEY_RE, "Key must be valid UPPER_SNAKE_CASE identifier")
    .refine((k) => !BLOCKED_DEPLOY_ENV_KEYS.test(k), "Restricted system environment variable key"),
  value: z.string().max(16_384),
  target: z.enum(["Production", "Preview", "Development"]).default("Production"),
});

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9 ._-]+$/, "Project name contains invalid characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,31}$/, "Subdomain slug must be lowercase alphanumeric and hyphens")
    .optional(),
  repoUrl: z
    .string()
    .trim()
    .url("Must be a valid HTTPS Git repository URL")
    .refine((u) => u.startsWith("https://"), "Only HTTPS Git repositories are allowed"),
  branch: z
    .string()
    .trim()
    .regex(SAFE_BRANCH_RE, "Invalid git branch name")
    .refine((b) => !b.startsWith("-") && !b.includes(".."), "Unsafe git branch name")
    .default("main"),
  framework: z.enum(DEPLOY_FRAMEWORKS).default("nextjs"),
  buildMethod: z.enum(["railpack", "dockerfile"]).default("railpack"),
  buildCommand: z
    .string()
    .trim()
    .max(200)
    .refine(
      (c) => SAFE_SHELL_FREE_CMD_RE.test(c),
      "Build command contains disallowed shell metacharacters",
    )
    .default(""),
  startCommand: z
    .string()
    .trim()
    .max(200)
    .refine(
      (c) => SAFE_SHELL_FREE_CMD_RE.test(c),
      "Start command contains disallowed shell metacharacters",
    )
    .default(""),
  outputDir: z
    .string()
    .trim()
    .max(120)
    .refine((d) => !d.includes(".."), "Output directory cannot traverse parent directories")
    .default("dist"),
  rootDir: z
    .string()
    .trim()
    .regex(SAFE_ROOT_DIR_RE, "Invalid root directory")
    .refine((d) => !d.includes(".."), "Root directory cannot traverse parent directories")
    .default("./"),
  port: z.coerce.number().int().min(80).max(65535).default(3000),
  healthcheckPath: z.string().trim().startsWith("/").max(120).default("/"),
  region: z.enum(["Mumbai IN-1", "Chennai IN-2", "Singapore SG-1"]).default("Mumbai IN-1"),
  tier: z.enum(["starter", "growth", "scale"]).default("starter"),
  attachManagedPostgres: z.boolean().default(false),
  autoDeploy: z.boolean().default(true),
  envVars: z.array(envVarInputSchema).max(64).default([]),
});

export const updateProjectSettingsSchema = z.object({
  branch: z
    .string()
    .trim()
    .regex(SAFE_BRANCH_RE)
    .refine((b) => !b.startsWith("-") && !b.includes(".."))
    .optional(),
  rootDir: z
    .string()
    .trim()
    .regex(SAFE_ROOT_DIR_RE)
    .refine((d) => !d.includes(".."))
    .optional(),
  buildMethod: z.enum(["railpack", "dockerfile"]).optional(),
  buildCommand: z
    .string()
    .trim()
    .max(200)
    .refine((c) => SAFE_SHELL_FREE_CMD_RE.test(c))
    .optional(),
  startCommand: z
    .string()
    .trim()
    .max(200)
    .refine((c) => SAFE_SHELL_FREE_CMD_RE.test(c))
    .optional(),
  outputDir: z
    .string()
    .trim()
    .max(120)
    .refine((d) => !d.includes(".."))
    .optional(),
  port: z.coerce.number().int().min(80).max(65535).optional(),
  healthcheckPath: z.string().trim().startsWith("/").max(120).optional(),
  autoDeploy: z.boolean().optional(),
  tier: z.enum(["starter", "growth", "scale"]).optional(),
});

export const attachDomainSchema = z.object({
  projectId: z.string().trim().min(1),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .refine((d) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d), {
      message: "Enter a valid domain name (e.g. app.yourdomain.in)",
    }),
});
