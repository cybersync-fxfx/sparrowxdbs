/**
 * SparrowX DBaaS — Business Model, Tiered PostgreSQL Plans & Unit Economics
 * Enforces real PostgreSQL role/database limits (CONNECTION LIMIT, statement_timeout,
 * work_mem, storage quotas, and snapshot retention) with transparent INR & USD pricing.
 */

export type DbPlanId = "db-free" | "db-starter" | "db-pro" | "db-enterprise";

export interface DbPlanCostBreakdown {
  nvmeStorageCostUsd: number;
  computePoolCostUsd: number;
  backupAndWalUsd: number;
  egressAndProxyUsd: number;
  totalMonthlyCostUsd: number;
  grossMarginPct: number;
}

export interface SparrowxDbPlan {
  id: DbPlanId;
  code: string;
  name: string;
  badge?: string;
  popular?: boolean;
  tagline: string;
  priceInrMonthly: number;
  priceUsdMonthly: number;
  storageLimitMb: number;
  maxConnections: number;
  statementTimeoutMs: number;
  workMemMb: number;
  backupRetentionDays: number;
  dedicatedProxy: boolean;
  pgvectorEnabled: boolean;
  features: string[];
  costAnalysis: DbPlanCostBreakdown;
}

export const SPARROWX_DB_PLANS: Record<DbPlanId, SparrowxDbPlan> = {
  "db-free": {
    id: "db-free",
    code: "DB_SANDBOX",
    name: "Developer Sandbox",
    badge: "FREE FOREVER",
    tagline: "Instant isolated PostgreSQL + pgvector database for prototyping, students, and side projects.",
    priceInrMonthly: 0,
    priceUsdMonthly: 0,
    storageLimitMb: 500,
    maxConnections: 10,
    statementTimeoutMs: 10_000,
    workMemMb: 4,
    backupRetentionDays: 1,
    dedicatedProxy: false,
    pgvectorEnabled: true,
    features: [
      "500 MB NVMe Gen4 isolated database",
      "10 concurrent PostgreSQL connections",
      "pgvector & pgcrypto extensions enabled",
      "Instant PostgREST REST API + SQL Studio",
      "10s query timeout protection",
      "24-hour snapshot metadata retention",
    ],
    costAnalysis: {
      nvmeStorageCostUsd: 0.08,
      computePoolCostUsd: 0.12,
      backupAndWalUsd: 0.02,
      egressAndProxyUsd: 0.03,
      totalMonthlyCostUsd: 0.25,
      grossMarginPct: 0,
    },
  },
  "db-starter": {
    id: "db-starter",
    code: "DB_STARTER",
    name: "Startup Postgres",
    tagline: "Production-ready isolated PostgreSQL instance with SSL, daily snapshots, and zero egress shock.",
    priceInrMonthly: 399,
    priceUsdMonthly: 5,
    storageLimitMb: 10_240, // 10 GB
    maxConnections: 35,
    statementTimeoutMs: 30_000,
    workMemMb: 16,
    backupRetentionDays: 7,
    dedicatedProxy: true,
    pgvectorEnabled: true,
    features: [
      "10 GB NVMe Gen4 isolated database",
      "35 concurrent PostgreSQL connections",
      "pgvector AI embeddings + PostgREST API",
      "7-day automated snapshot retention",
      "30s query timeout & 16 MB work_mem",
      "Zero surprise bandwidth overage fees",
    ],
    costAnalysis: {
      nvmeStorageCostUsd: 0.35,
      computePoolCostUsd: 0.45,
      backupAndWalUsd: 0.12,
      egressAndProxyUsd: 0.08,
      totalMonthlyCostUsd: 1.0,
      grossMarginPct: 80.0,
    },
  },
  "db-pro": {
    id: "db-pro",
    code: "DB_PRO_VECTOR",
    name: "Pro Vector Cluster",
    badge: "MOST POPULAR",
    popular: true,
    tagline: "High-throughput PostgreSQL + HNSW pgvector cluster for scaling SaaS apps and AI agents.",
    priceInrMonthly: 1199,
    priceUsdMonthly: 15,
    storageLimitMb: 51_200, // 50 GB
    maxConnections: 100,
    statementTimeoutMs: 60_000,
    workMemMb: 32,
    backupRetentionDays: 30,
    dedicatedProxy: true,
    pgvectorEnabled: true,
    features: [
      "50 GB NVMe Gen4 isolated database",
      "100 concurrent PostgreSQL connections",
      "32 MB work_mem for fast HNSW vector & JOIN queries",
      "30-day snapshot retention & instant password rotation",
      "Custom db.yourdomain.com reverse proxy",
      "Priority email & SOC incident SLA",
    ],
    costAnalysis: {
      nvmeStorageCostUsd: 1.1,
      computePoolCostUsd: 0.95,
      backupAndWalUsd: 0.3,
      egressAndProxyUsd: 0.25,
      totalMonthlyCostUsd: 2.6,
      grossMarginPct: 82.7,
    },
  },
  "db-enterprise": {
    id: "db-enterprise",
    code: "DB_ENTERPRISE",
    name: "Enterprise Sovereign",
    badge: "DEDICATED SLA",
    tagline: "High-concurrency bare-metal PostgreSQL with 250 GB NVMe, 300 connections, and 90-day audit retention.",
    priceInrMonthly: 3999,
    priceUsdMonthly: 49,
    storageLimitMb: 256_000, // 250 GB
    maxConnections: 300,
    statementTimeoutMs: 120_000,
    workMemMb: 64,
    backupRetentionDays: 90,
    dedicatedProxy: true,
    pgvectorEnabled: true,
    features: [
      "250 GB NVMe Gen4 isolated database",
      "300 concurrent PostgreSQL connections",
      "64 MB work_mem & 120s analytical query budget",
      "90-day snapshot & compliance audit trail",
      "Dedicated reverse proxy + IP allowlist support",
      "24/7 sovereign engineering SLA",
    ],
    costAnalysis: {
      nvmeStorageCostUsd: 3.8,
      computePoolCostUsd: 2.6,
      backupAndWalUsd: 0.85,
      egressAndProxyUsd: 0.65,
      totalMonthlyCostUsd: 7.9,
      grossMarginPct: 83.9,
    },
  },
};

export const DB_PLAN_LIST: SparrowxDbPlan[] = [
  SPARROWX_DB_PLANS["db-free"],
  SPARROWX_DB_PLANS["db-starter"],
  SPARROWX_DB_PLANS["db-pro"],
  SPARROWX_DB_PLANS["db-enterprise"],
];

export function resolveDbPlan(planId?: string | null): SparrowxDbPlan {
  if (planId && planId in SPARROWX_DB_PLANS) {
    return SPARROWX_DB_PLANS[planId as DbPlanId];
  }
  return SPARROWX_DB_PLANS["db-free"];
}

export function computeStorageUsagePct(usedBytes: number, limitMb: number): number {
  if (limitMb <= 0) return 0;
  const limitBytes = limitMb * 1024 * 1024;
  return Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10);
}
