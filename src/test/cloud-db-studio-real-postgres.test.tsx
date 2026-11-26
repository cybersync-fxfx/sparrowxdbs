import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCreateTableSql,
  buildDeleteRowSql,
  buildDropTableSql,
  buildInsertRowSql,
  buildSchemaDdlFromTables,
  buildSchemaIntrospectionSql,
  buildUpdateRowSql,
  isSchemaMutatingSql,
  parseIntrospectedTables,
} from "@/lib/studio-sql";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { validateTenantSqlSafety } from "@/lib/server/pg-provisioner.server";

describe("SparrowX Cloud DB Studio — Real PostgreSQL Wiring & Zero AI Copilot / Zero Mock Fallback", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("generates safe, real PostgreSQL DDL/DML and introspection SQL that passes tenant SQL safety policy", () => {
    const introspectSql = buildSchemaIntrospectionSql();
    expect(() => validateTenantSqlSafety(introspectSql)).not.toThrow();

    const createSql = buildCreateTableSql(
      "Customer Orders",
      [
        { name: "id", type: "UUID", isPrimary: true, isNullable: false, defaultValue: "gen_random_uuid()" },
        { name: "email", type: "TEXT", isPrimary: false, isNullable: false, defaultValue: "" },
        { name: "meta", type: "JSONB", isPrimary: false, isNullable: true, defaultValue: "'{}'::jsonb" },
      ],
      true,
    );
    expect(createSql).toContain('CREATE TABLE "public"."customer_orders"');
    expect(createSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(() => validateTenantSqlSafety(createSql)).not.toThrow();

    const insertSql = buildInsertRowSql("customer_orders", {
      email: "o'reilly@example.com",
      meta: { tier: "pro" },
    });
    expect(insertSql).toContain("'o''reilly@example.com'");
    expect(insertSql).toContain('::jsonb');
    expect(() => validateTenantSqlSafety(insertSql)).not.toThrow();

    const updateSql = buildUpdateRowSql("customer_orders", "id", "abc-1", { email: "new@example.com" });
    expect(updateSql).toContain('UPDATE "public"."customer_orders" SET "email" = \'new@example.com\' WHERE "id" = \'abc-1\'');
    expect(() => validateTenantSqlSafety(updateSql)).not.toThrow();

    const deleteSql = buildDeleteRowSql("customer_orders", "id", "abc-1");
    expect(deleteSql).toContain('DELETE FROM "public"."customer_orders" WHERE "id" = \'abc-1\'');
    expect(() => validateTenantSqlSafety(deleteSql)).not.toThrow();

    const dropSql = buildDropTableSql("customer_orders");
    expect(dropSql).toBe('DROP TABLE IF EXISTS "public"."customer_orders";');
    expect(() => validateTenantSqlSafety(dropSql)).not.toThrow();

    expect(isSchemaMutatingSql("CREATE TABLE foo (id int);")).toBe(true);
    expect(isSchemaMutatingSql("SELECT * FROM foo;")).toBe(false);
  });

  it("parses introspected PostgreSQL table rows into typed columns and generates clean schema DDL", () => {
    const tables = parseIntrospectedTables([
      {
        table_name: "notes",
        primary_key: "id",
        estimated_rows: "4",
        size_pretty: "16 kB",
        columns_json: [
          { name: "id", dataType: "uuid", udtName: "uuid", isNullable: false, defaultValue: "gen_random_uuid()" },
          { name: "title", dataType: "text", udtName: "text", isNullable: false, defaultValue: null },
        ],
      },
    ]);
    expect(tables).toHaveLength(1);
    expect(tables[0]?.primaryKey).toBe("id");
    expect(tables[0]?.columns[0]?.isPrimary).toBe(true);
    expect(tables[0]?.defaultRow).toEqual({ title: "" });

    const ddl = buildSchemaDdlFromTables(tables, "spx_db_demo");
    expect(ddl).toContain("Database: spx_db_demo");
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "public"."notes"');
  });

  it("removes AI SQL Copilot completely and executes SQL directly against /api/db/query with real PostgreSQL errors", async () => {
    const queryCalls: Array<{ dbName: string; sql: string }> = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/db/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            engine: "PostgreSQL Sovereign Cluster",
            version: "PostgreSQL 16.4",
            pgvectorAvailable: true,
            pgcryptoAvailable: true,
            uptimeSeconds: 1200,
            totalDatabases: 1,
            activeConnections: 2,
            clusterSizePretty: "24 MB",
            latencyMs: 3,
            sslMode: "local",
            originRegion: "ap-southeast-2",
            originLocation: "Sydney, Australia",
            originDatacenter: "SparrowX SYD-1",
            checkedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/api/db/summary")) {
        return new Response(
          JSON.stringify({
            ok: true,
            totalUsers: 1,
            totalProvisionedDbs: 1,
            totalStorageBytes: 8_000_000,
            databases: [
              {
                id: "PDB-TEST1",
                tenantId: "TNT-5638",
                userEmail: "sam@sparrowx.net",
                projectName: "Sam Workspace",
                planId: "db-free",
                planName: "Sandbox",
                dbName: "spx_db_tnt_5638",
                dbUser: "spx_u_tnt_5638",
                dbHost: "db.sparrowx.net",
                dbPort: 5432,
                sizeBytes: 8_000_000,
                sizePretty: "8 MB",
                storageLimitMb: 500,
                usagePct: 2,
                maxConnections: 10,
                activeConnections: 1,
                backupCount: 0,
                lastBackupAt: null,
                status: "Active",
                createdAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/api/db/lifecycle")) {
        return new Response(JSON.stringify({ ok: true, snapshots: [], logs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/db/query")) {
        const parsed = JSON.parse(String(init?.body || "{}")) as { dbName: string; sql: string };
        queryCalls.push(parsed);

        // Introspection query
        if (parsed.sql.includes("information_schema.tables")) {
          return new Response(
            JSON.stringify({ ok: true, command: "SELECT", rowCount: 0, fields: [], rows: [], truncated: false, durationMs: 2 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Broken SQL syntax test (just like the user's screenshot!)
        if (parsed.sql.includes("dsad")) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: 'syntax error at or near "dsad"',
              pgCode: "42601",
              position: "1",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Valid SQL query
        return new Response(
          JSON.stringify({
            ok: true,
            command: "SELECT",
            rowCount: 1,
            fields: ["database_name", "answer"],
            rows: [{ database_name: "spx_db_tnt_5638", answer: 42 }],
            truncated: false,
            durationMs: 4,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    });

    render(
      <SovereignDatabaseStudio
        isStandaloneDomain={true}
        currentUser={{
          id: "USR-5638",
          email: "sam@sparrowx.net",
          fullName: "sam",
          password: "",
          admin: "no",
          tenantId: "TNT-5638",
        }}
      />,
    );

    // Wait for real provisioned DB name to hydrate
    await waitFor(() => {
      expect(screen.getAllByText(/spx_db_tnt_5638/i).length).toBeGreaterThan(0);
    });

    // Switch to SQL Editor tab
    fireEvent.click(screen.getByRole("button", { name: /^SQL Editor$/i }));

    // Assert AI SQL Copilot is completely gone
    expect(screen.queryByText(/AI SQL Copilot/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Synthesize SQL/i })).not.toBeInTheDocument();

    // 1. Run invalid SQL ("dsad") and verify REAL Postgres error is shown, NOT fake app_users seed rows!
    const editor = screen.getByPlaceholderText(/Write PostgreSQL 16/i);
    fireEvent.change(editor, { target: { value: "SELECT 1; dsad" } });
    fireEvent.click(screen.getByRole("button", { name: /Run Ctrl/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/syntax error at or near "dsad"/i);
      expect(screen.getByRole("alert")).toHaveTextContent(/SQLSTATE 42601/i);
    });
    expect(screen.queryByText(/USR-SPX-MASTER/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/master-db@sparrowx\.net/i)).not.toBeInTheDocument();

    // 2. Run valid SQL and verify real query rows appear
    fireEvent.change(editor, { target: { value: "SELECT current_database() AS database_name, 42 AS answer;" } });
    fireEvent.click(screen.getByRole("button", { name: /Run Ctrl/i }));

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
    expect(queryCalls.some((c) => c.dbName === "spx_db_tnt_5638" && c.sql.includes("42 AS answer"))).toBe(true);
  });
});
