import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DB_PLAN_LIST,
  SPARROWX_DB_PLANS,
  computeStorageUsagePct,
  resolveDbPlan,
} from "../lib/sparrowx-db-plans";
import {
  assertSafePgIdentifier,
  sanitizePgSlug,
  validateTenantSqlSafety,
} from "../lib/server/pg-provisioner.server";
import {
  checkDbRateLimit,
  hasValidAdminKey,
} from "../lib/server/db-auth.server";

describe("SparrowX DBaaS Business Model & Backend Hardening", () => {
  const prevAdminKey = process.env.SPARROWX_ADMIN_API_KEY;

  beforeEach(() => {
    process.env.SPARROWX_ADMIN_API_KEY = "spx_test_admin_key_1234567890";
  });

  afterEach(() => {
    if (prevAdminKey === undefined) delete process.env.SPARROWX_ADMIN_API_KEY;
    else process.env.SPARROWX_ADMIN_API_KEY = prevAdminKey;
  });

  it("defines 4 sustainable DBaaS tiers with >= 80% gross margin on paid plans", () => {
    expect(DB_PLAN_LIST).toHaveLength(4);
    for (const plan of DB_PLAN_LIST) {
      expect(plan.pgvectorEnabled).toBe(true);
      expect(plan.maxConnections).toBeGreaterThanOrEqual(10);
      expect(plan.storageLimitMb).toBeGreaterThanOrEqual(500);
      if (plan.priceUsdMonthly > 0) {
        expect(plan.costAnalysis.grossMarginPct).toBeGreaterThanOrEqual(80);
      }
    }
    expect(resolveDbPlan("db-pro").id).toBe("db-pro");
    expect(resolveDbPlan("unknown-tier").id).toBe("db-free");
    expect(SPARROWX_DB_PLANS["db-enterprise"].maxConnections).toBe(300);
  });

  it("computes storage quota utilization percentage accurately", () => {
    expect(computeStorageUsagePct(250 * 1024 * 1024, 500)).toBe(50);
    expect(computeStorageUsagePct(900 * 1024 * 1024, 500)).toBe(100);
    expect(computeStorageUsagePct(0, 500)).toBe(0);
  });

  it("sanitizes tenant slugs and rejects unsafe PostgreSQL identifiers", () => {
    expect(sanitizePgSlug("Acme Corp! @# 2026")).toBe("acme_corp_2026");
    expect(assertSafePgIdentifier("spx_db_acme_2026")).toBe("spx_db_acme_2026");
    expect(() => assertSafePgIdentifier("spx_db_bad; DROP TABLE users;--")).toThrow();
    expect(() => assertSafePgIdentifier("123_starts_with_digit")).toThrow();
  });

  it("blocks dangerous cluster-level SQL commands while allowing normal tenant SQL", () => {
    expect(validateTenantSqlSafety("SELECT id, name FROM public.users LIMIT 20;")).toContain("SELECT");
    expect(validateTenantSqlSafety("CREATE TABLE items (id serial PRIMARY KEY, emb vector(1536));")).toContain("vector");

    expect(() => validateTenantSqlSafety("ALTER SYSTEM SET shared_buffers = '8GB';")).toThrow();
    expect(() => validateTenantSqlSafety("DROP DATABASE spx_db_other;")).toThrow();
    expect(() => validateTenantSqlSafety("COPY t FROM PROGRAM 'cat /etc/passwd';")).toThrow();
    expect(() => validateTenantSqlSafety("SELECT pg_read_file('/etc/shadow');")).toThrow();
    expect(() => validateTenantSqlSafety("CREATE ROLE hacker WITH SUPERUSER;")).toThrow();
  });

  it("authenticates admin keys with timing-safe comparison and enforces rate limits", () => {
    const validReq = new Request("https://db.sparrowx.net/api/db/summary", {
      headers: { "x-sparrowx-admin-key": "spx_test_admin_key_1234567890" },
    });
    const invalidReq = new Request("https://db.sparrowx.net/api/db/summary", {
      headers: { "x-sparrowx-admin-key": "wrong_key" },
    });
    expect(hasValidAdminKey(validReq)).toBe(true);
    expect(hasValidAdminKey(invalidReq)).toBe(false);

    const key = `test-rate-${Date.now()}`;
    expect(checkDbRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkDbRateLimit(key, 2, 60_000).allowed).toBe(true);
    const blocked = checkDbRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});
