import { z } from "zod";

export const AI_TEMPLATE_CATEGORIES = [
  "all",
  "visual-builder",
  "mcp-server",
  "custom-agent",
  "rag-stack",
  "workflow-vps",
] as const;

export type AiTemplateCategory = (typeof AI_TEMPLATE_CATEGORIES)[number];

export interface AiTemplateSpec {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Exclude<AiTemplateCategory, "all">;
  runtime: "docker" | "python" | "node" | "multi-container";
  image: string;
  defaultPort: number;
  minRamGb: number;
  minVcpu: number;
  startingInr: number;
  supportsPgVector: boolean;
  websocketReady: boolean;
  defaultEnvKeys: string[];
  badge: string;
  highlights: string[];
}

export interface AiComputePlan {
  id: "starter" | "growth" | "scale" | "dedicated-agent";
  name: string;
  tagline: string;
  vcpu: number;
  ramGb: number;
  ssdGb: number;
  portMbps: number;
  transferGb: number;
  monthlyInr: number;
  usdPaaSCompareInr: number;
  pidsLimit: number;
  isolation: "Docker + Proxmox Tenant VM" | "Dedicated KVM Micro-VM";
  sla: "99.5% Uptime SLA";
  recommended?: boolean;
}

export const AI_COMPUTE_PLANS: readonly AiComputePlan[] = [
  {
    id: "starter",
    name: "Starter Agent",
    tagline: "Indie bots, MCP tools & staging workflows",
    vcpu: 2,
    ramGb: 4,
    ssdGb: 40,
    portMbps: 100,
    transferGb: 500,
    monthlyInr: 799,
    usdPaaSCompareInr: 2450,
    pidsLimit: 256,
    isolation: "Docker + Proxmox Tenant VM",
    sla: "99.5% Uptime SLA",
  },
  {
    id: "growth",
    name: "Growth Runtime",
    tagline: "24/7 Langflow, CrewAI & production RAG",
    vcpu: 4,
    ramGb: 8,
    ssdGb: 80,
    portMbps: 200,
    transferGb: 1000,
    monthlyInr: 1499,
    usdPaaSCompareInr: 4900,
    pidsLimit: 512,
    isolation: "Docker + Proxmox Tenant VM",
    sla: "99.5% Uptime SLA",
    recommended: true,
  },
  {
    id: "scale",
    name: "Scale Cluster",
    tagline: "Multi-agent fleets & high-concurrency webhooks",
    vcpu: 8,
    ramGb: 16,
    ssdGb: 160,
    portMbps: 300,
    transferGb: 2000,
    monthlyInr: 2899,
    usdPaaSCompareInr: 9600,
    pidsLimit: 1024,
    isolation: "Dedicated KVM Micro-VM",
    sla: "99.5% Uptime SLA",
  },
  {
    id: "dedicated-agent",
    name: "Dedicated Agent Node",
    tagline: "Heavy local embeddings, OCR & isolated enterprise",
    vcpu: 16,
    ramGb: 32,
    ssdGb: 320,
    portMbps: 500,
    transferGb: 4000,
    monthlyInr: 5499,
    usdPaaSCompareInr: 18500,
    pidsLimit: 2048,
    isolation: "Dedicated KVM Micro-VM",
    sla: "99.5% Uptime SLA",
  },
] as const;

export const AI_TEMPLATES: readonly AiTemplateSpec[] = [
  {
    id: "tpl-langflow",
    slug: "langflow-mit",
    name: "Langflow (MIT)",
    tagline: "Visual AI agent & RAG pipeline builder",
    description:
      "Drag-and-drop multi-agent orchestration canvas with native Gemini, OpenAI, and pgvector connectors, automatic execution pruning, and HTTPS webhooks.",
    category: "visual-builder",
    runtime: "docker",
    image: "langflowai/langflow:latest",
    defaultPort: 7860,
    minRamGb: 4,
    minVcpu: 2,
    startingInr: 799,
    supportsPgVector: true,
    websocketReady: true,
    defaultEnvKeys: ["GEMINI_API_KEY", "OPENAI_API_KEY", "LANGFLOW_DATABASE_URL"],
    badge: "MIT Open Source",
    highlights: ["Auto-linked pgvector", "WebSocket streaming", "Log pruning enabled"],
  },
  {
    id: "tpl-mcp-runtime",
    slug: "mcp-server-runtime",
    name: "MCP Server Runtime",
    tagline: "Node.js / Python Model Context Protocol server",
    description:
      "Production Streamable HTTP & SSE runtime for Claude, Cursor, and Antigravity MCP tool servers with bearer auth, zero-downtime reloads, and Mumbai edge TLS.",
    category: "mcp-server",
    runtime: "node",
    image: "ghcr.io/sparrowxtech/mcp-runtime:node22-py312",
    defaultPort: 8080,
    minRamGb: 4,
    minVcpu: 2,
    startingInr: 799,
    supportsPgVector: true,
    websocketReady: true,
    defaultEnvKeys: ["MCP_AUTH_TOKEN", "GEMINI_API_KEY", "MCP_TRANSPORT"],
    badge: "SSE + Streamable HTTP",
    highlights: ["<40ms Mumbai RTT", "OAuth / Bearer middleware", "Zero cold starts"],
  },
  {
    id: "tpl-custom-agent",
    slug: "custom-python-node-agent",
    name: "Custom Python / Node AI Agent",
    tagline: "LangGraph, CrewAI, WhatsApp, Discord & Telegram bots",
    description:
      "Connect any GitHub repo with auto-detected Dockerfile, Python pyproject, or Node.js package.json. Built for 24/7 stateful agents without serverless timeouts.",
    category: "custom-agent",
    runtime: "python",
    image: "ghcr.io/sparrowxtech/agent-runner:3.12",
    defaultPort: 8000,
    minRamGb: 4,
    minVcpu: 2,
    startingInr: 799,
    supportsPgVector: true,
    websocketReady: true,
    defaultEnvKeys: ["GEMINI_API_KEY", "WHATSAPP_TOKEN", "DISCORD_BOT_TOKEN"],
    badge: "Git Auto-Detect",
    highlights: ["No 60s serverless cutoff", "Outbound SMTP blocked", "Persistent SSD volume"],
  },
  {
    id: "tpl-private-rag",
    slug: "private-rag-stack",
    name: "Private RAG Stack",
    tagline: "Document ingestion + auto-linked db.sparrowx.net pgvector",
    description:
      "Hybrid dense + BM25 retrieval API with PDF/DOCX chunking workers and an isolated PostgreSQL 16 + pgvector database provisioned on db.sparrowx.net.",
    category: "rag-stack",
    runtime: "multi-container",
    image: "ghcr.io/sparrowxtech/private-rag:1.4",
    defaultPort: 8090,
    minRamGb: 8,
    minVcpu: 4,
    startingInr: 1499,
    supportsPgVector: true,
    websocketReady: true,
    defaultEnvKeys: ["GEMINI_API_KEY", "DATABASE_URL", "EMBEDDING_MODEL"],
    badge: "1-Click pgvector",
    highlights: ["DPDP India data residency", "Hybrid vector search", "AES-256-GCM vault"],
  },
  {
    id: "tpl-workflow-vps",
    slug: "self-hosted-workflow-vps",
    name: "Self-Hosted Workflow VPS",
    tagline: "Isolated single-tenant automation container",
    description:
      "Customer-owned single-tenant workflow container with queue mode, automatic execution log pruning (EXECUTIONS_DATA_PRUNE=true), and sec.sparrowx.net webhook WAF.",
    category: "workflow-vps",
    runtime: "docker",
    image: "ghcr.io/sparrowxtech/workflow-runner:latest",
    defaultPort: 5678,
    minRamGb: 4,
    minVcpu: 2,
    startingInr: 799,
    supportsPgVector: true,
    websocketReady: true,
    defaultEnvKeys: [
      "WEBHOOK_URL",
      "EXECUTIONS_DATA_PRUNE",
      "EXECUTIONS_DATA_MAX_AGE",
      "GENERIC_TIMEZONE",
    ],
    badge: "Single-Tenant VPS",
    highlights: ["Auto execution pruning", "sec.sparrowx.net WAF", "Daily NVMe snapshots"],
  },
] as const;

export interface RegionalLatencyPoint {
  city: string;
  region: string;
  ispRoute: string;
  avgMs: number;
  jitterMs: number;
  status: "optimal" | "healthy";
}

export const MUMBAI_LOOKING_GLASS_IP = "103.174.10.24";
export const MUMBAI_LOOKING_GLASS_HOST = "lg-bom1.ai.sparrowx.net";

export const INDIA_LATENCY_TABLE: readonly RegionalLatencyPoint[] = [
  { city: "Mumbai", region: "Maharashtra (Gateway)", ispRoute: "OVH BOM1 / Direct IX", avgMs: 12, jitterMs: 1.4, status: "optimal" },
  { city: "Bengaluru", region: "Karnataka", ispRoute: "Airtel / Jio Fiber", avgMs: 36, jitterMs: 2.1, status: "optimal" },
  { city: "Chennai", region: "Tamil Nadu", ispRoute: "Tata Comm / Jio", avgMs: 44, jitterMs: 2.6, status: "optimal" },
  { city: "Delhi NCR", region: "Haryana / Delhi", ispRoute: "NIXI / Airtel Backbone", avgMs: 52, jitterMs: 3.1, status: "healthy" },
  { city: "Kolkata", region: "West Bengal", ispRoute: "BSNL / Jio East", avgMs: 68, jitterMs: 3.8, status: "healthy" },
] as const;

export const DeployStageSchema = z.enum([
  "queued",
  "allocating",
  "configuring_ssl",
  "live",
  "stopped",
  "failed",
  "paused",
]);
export type DeployStage = z.infer<typeof DeployStageSchema>;

export const EnvEntryInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Env key is required")
    .max(64, "Env key too long")
    .regex(/^[A-Z_][A-Z0-9_]*$/i, "Use letters, numbers, and underscores only"),
  value: z.string().max(4096, "Secret value exceeds 4KB"),
  isSecret: z.boolean().default(true),
});

export const CreateInstanceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Instance name must be at least 2 characters")
    .max(48, "Instance name must be 48 characters or less"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Subdomain must be at least 3 characters")
    .max(36, "Subdomain must be 36 characters or less")
    .regex(/^[a-z0-9]([a-z0-9-]{1,34}[a-z0-9])?$/, "Lowercase letters, numbers, and single hyphens only"),
  sourceType: z.enum(["template", "github"]).default("template"),
  templateId: z.string().trim().min(1).default("tpl-langflow"),
  gitRepoUrl: z
    .string()
    .trim()
    .url("Enter a valid GitHub repository URL")
    .optional()
    .or(z.literal("")),
  gitBranch: z.string().trim().min(1).max(64).default("main"),
  detectedRuntime: z.enum(["docker", "python", "node", "multi-container"]).default("docker"),
  planId: z.enum(["starter", "growth", "scale", "dedicated-agent"]).default("growth"),
  autoProvisionPgVector: z.boolean().default(true),
  webhookWafEnabled: z.boolean().default(true),
  kycPhoneVerified: z.boolean().default(false),
  envVars: z.array(EnvEntryInputSchema).max(60).default([]),
});

export type CreateInstanceInput = z.infer<typeof CreateInstanceInputSchema>;

export const InstanceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["start", "stop", "restart", "rebuild", "suspend", "resume"]),
    instanceId: z.string().min(1),
  }),
  z.object({
    action: z.literal("snapshot"),
    instanceId: z.string().min(1),
    label: z.string().trim().min(2).max(48).optional(),
  }),
  z.object({
    action: z.literal("restore_snapshot"),
    instanceId: z.string().min(1),
    snapshotId: z.string().min(1),
  }),
  z.object({
    action: z.literal("upsert_env"),
    instanceId: z.string().min(1),
    envVars: z.array(EnvEntryInputSchema).min(1).max(60),
    redeploy: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("reveal_env"),
    instanceId: z.string().min(1),
    key: z.string().min(1),
  }),
  z.object({
    action: z.literal("add_domain"),
    instanceId: z.string().min(1),
    hostname: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "Enter a valid FQDN (e.g. agent.company.in)"),
  }),
  z.object({
    action: z.literal("toggle_waf"),
    instanceId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("terminal_exec"),
    instanceId: z.string().min(1),
    command: z.string().trim().min(1).max(240),
  }),
]);

export type InstanceActionInput = z.infer<typeof InstanceActionSchema>;

export interface InstanceMetricPoint {
  ts: string;
  cpuPct: number;
  ramMb: number;
  diskIoMb: number;
  netRxMbps: number;
  netTxMbps: number;
}

export interface InstanceLogLine {
  id: string;
  ts: string;
  level: "INFO" | "WARN" | "ERROR" | "SYSTEM";
  source: "orchestrator" | "container" | "edge-proxy" | "waf";
  message: string;
}

export interface InstanceSnapshot {
  id: string;
  label: string;
  sizeMb: number;
  createdAt: string;
  type: "daily-auto" | "manual";
  status: "ready" | "restoring";
}

export interface InstanceCustomDomain {
  id: string;
  hostname: string;
  cnameTarget: string;
  sslStatus: "active" | "issuing" | "pending_dns";
  websocketEnabled: boolean;
  addedAt: string;
}

export interface MaskedEnvSecret {
  key: string;
  maskedValue: string;
  algorithm: "AES-256-GCM";
  updatedAt: string;
}

export interface AiInstanceRecord {
  id: string;
  workspaceId: string;
  ownerEmail: string;
  name: string;
  subdomain: string;
  publicUrl: string;
  sourceType: "template" | "github";
  templateId: string;
  templateName: string;
  gitRepoUrl: string | null;
  gitBranch: string;
  detectedRuntime: "docker" | "python" | "node" | "multi-container";
  planId: AiComputePlan["id"];
  vcpu: number;
  ramGb: number;
  ssdGb: number;
  portMbps: number;
  transferQuotaGb: number;
  transferUsedGb: number;
  status: DeployStage;
  stageTimestamps: Partial<Record<"queued" | "allocating" | "configuring_ssl" | "live", string>>;
  containerId: string;
  proxmoxNode: string;
  proxmoxVmid: number;
  internalIp: string;
  internalPort: number;
  pgVectorProvisioned: boolean;
  pgVectorHost: string | null;
  webhookWafEnabled: boolean;
  smtpOutboundBlocked: boolean;
  executionPruneEnabled: boolean;
  kycVerified: boolean;
  monthlyInr: number;
  createdAt: string;
  updatedAt: string;
  envSecrets: MaskedEnvSecret[];
  domains: InstanceCustomDomain[];
  snapshots: InstanceSnapshot[];
  metrics: InstanceMetricPoint[];
  logs: InstanceLogLine[];
  nginxConfig: string;
  caddyConfig: string;
}

export interface AiAuditLogRecord {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  status: "ok" | "blocked" | "warning";
}

export interface AiInvoiceRecord {
  id: string;
  invoiceNumber: string;
  period: string;
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
  method: "UPI AutoPay" | "UPI QR" | "Razorpay";
  status: "PAID" | "OPEN";
  issuedAt: string;
  gstin: string;
}

export interface FounderAdminTelemetry {
  proxmox: {
    configured: boolean;
    mode: "live" | "local-cluster";
    node: string;
    cpuModel: string;
    totalCores: number;
    usedCores: number;
    cpuLoadPct: number;
    totalRamGb: number;
    allocatedRamGb: number;
    storagePool: string;
    storageTotalTb: number;
    storageUsedTb: number;
  };
  ovhGateway: {
    region: string;
    gatewayIp: string;
    tunnelType: string;
    monthlyQuotaTb: number;
    monthlyUsedTb: number;
    currentRxMbps: number;
    currentTxMbps: number;
    warningThresholdPct: number;
  };
  ipAllocations: Array<{
    ip: string;
    role: string;
    tenant: string;
    portCapMbps: number;
    smtpBlocked: boolean;
    status: "active" | "reserved" | "throttled";
  }>;
  abuseAlerts: Array<{
    id: string;
    severity: "high" | "medium" | "low";
    type: "SMTP_PORT_25_BLOCKED" | "SUSTAINED_CPU_SPIKE" | "UNUSUAL_EGRESS";
    tenant: string;
    instanceName: string;
    detail: string;
    detectedAt: string;
    actionTaken: string;
  }>;
}

/**
 * Parses a raw `.env` block (supports comments, `export KEY=VALUE`, and quoted values).
 */
export function parseBulkDotEnv(raw: string): Array<{ key: string; value: string; isSecret: boolean }> {
  const entries: Array<{ key: string; value: string; isSecret: boolean }> = [];
  const seen = new Set<string>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const cleaned = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIdx = cleaned.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = cleaned.slice(0, eqIdx).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key) || seen.has(key)) continue;
    let value = cleaned.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    seen.add(key);
    entries.push({ key, value, isSecret: true });
  }
  return entries;
}

/**
 * Auto-detects runtime from a GitHub repository URL or name heuristic.
 */
export function detectRuntimeFromRepo(repoUrl: string): "docker" | "python" | "node" {
  const lower = repoUrl.toLowerCase();
  if (lower.includes("docker") || lower.includes("compose") || lower.includes("langflow")) {
    return "docker";
  }
  if (
    lower.includes("py") ||
    lower.includes("langgraph") ||
    lower.includes("crewai") ||
    lower.includes("rag") ||
    lower.includes("fastapi")
  ) {
    return "python";
  }
  return "node";
}

export function getPlanById(planId: AiComputePlan["id"]): AiComputePlan {
  return AI_COMPUTE_PLANS.find((p) => p.id === planId) ?? AI_COMPUTE_PLANS[1]!;
}

export function getTemplateById(templateId: string): AiTemplateSpec {
  return AI_TEMPLATES.find((t) => t.id === templateId || t.slug === templateId) ?? AI_TEMPLATES[0]!;
}
