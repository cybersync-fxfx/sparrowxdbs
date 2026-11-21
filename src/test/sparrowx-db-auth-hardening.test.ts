import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as dbAuth from "@/lib/server/db-auth.server";
import {
  MASTER_SSO_COOKIE_NAME,
  authenticateMasterCredentialsInDb,
  createMasterSsoToken,
} from "@/lib/server/master-sso.server";
import * as pgProvisioner from "@/lib/server/pg-provisioner.server";
import { Route as SummaryRoute } from "@/routes/api/db/summary";

type QueryResultShape = { rowCount: number; rows: Array<Record<string, unknown>> };

const { mockPgQuery } = vi.hoisted(() => ({
  mockPgQuery: vi.fn(
    async (sql: string, _params?: unknown[]): Promise<QueryResultShape> => {
      if (sql.trim() === "SELECT 1") return { rowCount: 1, rows: [{ ok: 1 }] };
      return { rowCount: 0, rows: [] };
    },
  ),
}));

vi.mock("pg", () => {
  class MockPool {
    query(sql: string, params?: unknown[]) {
      return mockPgQuery(sql, params);
    }
    end() {
      return Promise.resolve();
    }
  }
  return {
    default: { Pool: MockPool },
    Pool: MockPool,
  };
});

type RouteWithServerHandlers = {
  options: {
    server?: {
      handlers?: {
        GET?: (ctx: { request: Request }) => Promise<Response>;
      };
    };
  };
};

function getSummaryGetHandler(): (ctx: { request: Request }) => Promise<Response> {
  const typedRoute = SummaryRoute as unknown as RouteWithServerHandlers;
  const handler = typedRoute.options.server?.handlers?.GET;
  if (!handler) {
    throw new Error("/api/db/summary GET handler is not registered on Route.options.server");
  }
  return handler;
}

describe("SparrowX DB Auth, Provisioner SQL Policy, Summary IDOR & Master SSO Hardening", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevStrict = process.env.SPARROWX_STRICT_DB_AUTH;
  const prevAdminKey = process.env.SPARROWX_ADMIN_API_KEY;
  const prevServiceKey = process.env.SPARROWX_SERVICE_KEY;
  const prevSecret = process.env.SPARROWX_MASTER_SSO_SECRET;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPgQuery.mockReset();
    mockPgQuery.mockImplementation(async (sql: string) => {
      if (sql.trim() === "SELECT 1") return { rowCount: 1, rows: [{ ok: 1 }] };
      return { rowCount: 0, rows: [] };
    });

    process.env.SPARROWX_MASTER_SSO_SECRET = "spx_test_hardening_sso_secret_2026_v1";
    delete process.env.SPARROWX_STRICT_DB_AUTH;
    delete process.env.SPARROWX_ADMIN_API_KEY;
    delete process.env.SPARROWX_SERVICE_KEY;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;

    if (prevStrict === undefined) delete process.env.SPARROWX_STRICT_DB_AUTH;
    else process.env.SPARROWX_STRICT_DB_AUTH = prevStrict;

    if (prevAdminKey === undefined) delete process.env.SPARROWX_ADMIN_API_KEY;
    else process.env.SPARROWX_ADMIN_API_KEY = prevAdminKey;

    if (prevServiceKey === undefined) delete process.env.SPARROWX_SERVICE_KEY;
    else process.env.SPARROWX_SERVICE_KEY = prevServiceKey;

    if (prevSecret === undefined) delete process.env.SPARROWX_MASTER_SSO_SECRET;
    else process.env.SPARROWX_MASTER_SSO_SECRET = prevSecret;
  });

  describe("extractClientIp trusted header precedence", () => {
    it("prefers cf-connecting-ip, then x-real-ip, and uses last hop in x-forwarded-for", () => {
      const withCf = new Request("https://db.sparrowx.net/api/db/query", {
        headers: {
          "cf-connecting-ip": "198.51.100.10",
          "x-real-ip": "203.0.113.20",
          "x-forwarded-for": "10.0.0.1, 192.0.2.30",
        },
      });
      expect(dbAuth.extractClientIp(withCf)).toBe("198.51.100.10");

      const withRealIp = new Request("https://db.sparrowx.net/api/db/query", {
        headers: {
          "x-real-ip": "203.0.113.20",
          "x-forwarded-for": "1.2.3.4, 203.0.113.99",
        },
      });
      expect(dbAuth.extractClientIp(withRealIp)).toBe("203.0.113.20");

      const withXffOnly = new Request("https://db.sparrowx.net/api/db/query", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 192.0.2.44",
        },
      });
      expect(dbAuth.extractClientIp(withXffOnly)).toBe("192.0.2.44");
    });
  });

  describe("authorizeDbRequest fail-closed defaults & admin privilege enforcement", () => {
    it("fails closed on non-loopback hosts even when SPARROWX_STRICT_DB_AUTH is unset", async () => {
      const req = new Request("https://db.sparrowx.net/api/db/summary", {
        headers: { host: "db.sparrowx.net" },
      });
      const auth = await dbAuth.authorizeDbRequest(req);
      expect(auth.authorized).toBe(false);
      expect(auth.isAdmin).toBe(false);
    });

    it("fails closed in NODE_ENV=production even on loopback requests unless explicitly disabled", async () => {
      process.env.NODE_ENV = "production";
      const req = new Request("http://localhost:3000/api/db/summary", {
        headers: { host: "localhost:3000" },
      });
      const auth = await dbAuth.authorizeDbRequest(req);
      expect(auth.authorized).toBe(false);
    });

    it("blocks anonymous and client SSO callers when requireAdmin=true and allows admin SSO", async () => {
      process.env.SPARROWX_ADMIN_API_KEY = "spx_configured_admin_secret_1234";

      const localUnauth = new Request("http://localhost:3000/api/db/summary", {
        headers: { host: "localhost:3000" },
      });
      expect((await dbAuth.authorizeDbRequest(localUnauth, { requireAdmin: true })).authorized).toBe(
        false,
      );

      const clientToken = await createMasterSsoToken({
        id: "usr-client-1",
        email: "client@sparrowx.net",
        fullName: "Client User",
        role: "client",
        tenantId: "TNT-CLIENT1",
      });
      const clientReq = new Request("https://db.sparrowx.net/api/db/summary", {
        headers: {
          host: "db.sparrowx.net",
          cookie: `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(clientToken)}`,
        },
      });
      expect((await dbAuth.authorizeDbRequest(clientReq, { requireAdmin: true })).authorized).toBe(
        false,
      );

      const adminToken = await createMasterSsoToken({
        id: "usr-admin-1",
        email: "admin@sparrowx.net",
        fullName: "Admin Operator",
        role: "admin",
        tenantId: null,
      });
      const adminReq = new Request("https://db.sparrowx.net/api/db/summary", {
        headers: {
          host: "db.sparrowx.net",
          cookie: `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(adminToken)}`,
        },
      });
      const adminAuth = await dbAuth.authorizeDbRequest(adminReq, { requireAdmin: true });
      expect(adminAuth.authorized).toBe(true);
      expect(adminAuth.isAdmin).toBe(true);
    });
  });

  describe("validateTenantSqlSafety comment obfuscation & role escape protection", () => {
    it("blocks comment-obfuscated dangerous SQL, RESET ROLE, SET SESSION AUTHORIZATION, and DO blocks", () => {
      expect(() =>
        pgProvisioner.validateTenantSqlSafety("ALTER /* bypass */ SYSTEM SET shared_buffers = '8GB';"),
      ).toThrow();
      expect(() =>
        pgProvisioner.validateTenantSqlSafety("CREATE -- bypass\n ROLE hacker WITH SUPERUSER;"),
      ).toThrow();
      expect(() => pgProvisioner.validateTenantSqlSafety("RESET ROLE;")).toThrow();
      expect(() => pgProvisioner.validateTenantSqlSafety("RESET ALL;")).toThrow();
      expect(() => pgProvisioner.validateTenantSqlSafety("DISCARD ALL;")).toThrow();
      expect(() =>
        pgProvisioner.validateTenantSqlSafety("SET SESSION AUTHORIZATION postgres;"),
      ).toThrow();
      expect(() =>
        pgProvisioner.validateTenantSqlSafety("DO $$ BEGIN RAISE NOTICE 'escape'; END $$;"),
      ).toThrow();
      expect(() =>
        pgProvisioner.validateTenantSqlSafety(
          "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;",
        ),
      ).toThrow();

      expect(
        pgProvisioner.validateTenantSqlSafety("SELECT id, email FROM public.users WHERE id = 1;"),
      ).toContain("SELECT");
    });
  });

  describe("/api/db/summary IDOR & unscoped caller guard", () => {
    it("rejects mismatched email/tenantId query parameters for non-admin sessions with 401/403", async () => {
      const getHandler = getSummaryGetHandler();
      const listSpy = vi.spyOn(pgProvisioner, "listProvisionedDatabases");

      const aliceToken = await createMasterSsoToken({
        id: "usr-alice",
        email: "alice@sparrowx.net",
        fullName: "Alice",
        role: "client",
        tenantId: "TNT-ALICE1",
      });

      // Unauthenticated production request -> 401
      const unauthRes = await getHandler({
        request: new Request("https://db.sparrowx.net/api/db/summary?email=victim@sparrowx.net", {
          headers: { host: "db.sparrowx.net" },
        }),
      });
      expect(unauthRes.status).toBe(401);

      // Authenticated non-admin trying cross-account email via real SSO cookie -> 401 at auth gate
      const crossEmailRes = await getHandler({
        request: new Request("https://db.sparrowx.net/api/db/summary?email=victim@sparrowx.net", {
          headers: {
            host: "db.sparrowx.net",
            cookie: `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(aliceToken)}`,
          },
        }),
      });
      expect(crossEmailRes.status).toBe(401);
      expect(listSpy).not.toHaveBeenCalled();

      // When authorizeDbRequest yields a non-admin session and caller injects cross-tenant query -> 403
      vi.spyOn(dbAuth, "authorizeDbRequest").mockResolvedValueOnce({
        authorized: true,
        isAdmin: false,
        actorId: "usr-alice",
        actorEmail: "alice@sparrowx.net",
        tenantId: "TNT-ALICE1",
      });
      const crossTenant403 = await getHandler({
        request: new Request("https://db.sparrowx.net/api/db/summary?tenantId=TNT-VICTIM", {
          headers: { host: "db.sparrowx.net" },
        }),
      });
      expect(crossTenant403.status).toBe(403);
      expect(listSpy).not.toHaveBeenCalled();

      // When authorizeDbRequest yields non-admin email and caller injects cross-email query -> 403
      vi.spyOn(dbAuth, "authorizeDbRequest").mockResolvedValueOnce({
        authorized: true,
        isAdmin: false,
        actorId: "usr-alice",
        actorEmail: "alice@sparrowx.net",
        tenantId: "TNT-ALICE1",
      });
      const crossEmail403 = await getHandler({
        request: new Request("https://db.sparrowx.net/api/db/summary?email=victim@sparrowx.net", {
          headers: { host: "db.sparrowx.net" },
        }),
      });
      expect(crossEmail403.status).toBe(403);
      expect(listSpy).not.toHaveBeenCalled();

      // Unscoped non-admin session with no email/tenantId anywhere -> 401
      vi.spyOn(dbAuth, "authorizeDbRequest").mockResolvedValueOnce({
        authorized: true,
        isAdmin: false,
        actorId: "opaque-session-id",
      });
      const unscopedRes = await getHandler({
        request: new Request("https://db.sparrowx.net/api/db/summary", {
          headers: { host: "db.sparrowx.net" },
        }),
      });
      expect(unscopedRes.status).toBe(401);
      expect(listSpy).not.toHaveBeenCalled();
    });
  });

  describe("master-sso no-auto-admin and tenant IDOR rejection", () => {
    it("rejects registering onto another user's existing tenantId", async () => {
      mockPgQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM public.app_users") && sql.includes("tenant_id = $1")) {
          return { rowCount: 1, rows: [{ email: "owner@victim.io" }] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await authenticateMasterCredentialsInDb({
        email: "attacker@evil.io",
        password: "StrongPassword!2026",
        registerIfMissing: {
          fullName: "Attacker",
          tenantId: "TNT-VICTIM99",
        },
      });

      expect(res.user).toBeNull();
    });

    it("never auto-grants admin on empty app_users table and replaces TENANT-SPARROWX placeholder", async () => {
      let capturedInsertParams: unknown[] = [];
      mockPgQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO public.app_users")) {
          capturedInsertParams = params ?? [];
          return {
            rowCount: 1,
            rows: [
              {
                id: String(params?.[0] ?? "USR-NEW"),
                email: String(params?.[1] ?? "firstuser@sparrowx.net"),
                full_name: String(params?.[3] ?? "First User"),
                admin: String(params?.[4] ?? "no"),
                tenant_id: String(params?.[5] ?? "TNT-GENERATED"),
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await authenticateMasterCredentialsInDb({
        email: "firstuser@sparrowx.net",
        password: "StrongPassword!2026",
        registerIfMissing: {
          fullName: "First User",
          tenantId: "TENANT-SPARROWX",
        },
      });

      expect(capturedInsertParams[4]).toBe("no");
      expect(String(capturedInsertParams[5])).toMatch(/^TNT-/);
      expect(capturedInsertParams[5]).not.toBe("TENANT-SPARROWX");
      expect(res.user).not.toBeNull();
      expect(res.user?.role).toBe("client");
    });
  });
});
