/**
 * Pure PostgreSQL SQL & schema introspection builders for SparrowX Cloud DB Studio.
 * Every Table Editor and Schema Inspector action uses these helpers to generate
 * real PostgreSQL 16 statements executed against the tenant's isolated database via /api/db/query.
 */

export interface LiveStudioColumn {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimary: boolean;
}

export interface LiveStudioTable {
  name: string;
  label: string;
  description: string;
  primaryKey: string;
  columns: LiveStudioColumn[];
  estimatedRows: number;
  sizePretty: string;
  defaultRow: Record<string, unknown>;
}

const PG_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_$]{0,62}$/;

/** Safely double-quotes a PostgreSQL identifier. */
export function quotePgIdent(identifier: string): string {
  const cleaned = identifier.trim();
  if (!cleaned) {
    throw new Error("PostgreSQL identifier cannot be empty.");
  }
  return `"${cleaned.replace(/"/g, '""')}"`;
}

/** Validates and normalizes a user-supplied table or column name. */
export function sanitizePgObjectName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+/, "");
  if (!cleaned || !PG_IDENT_RE.test(cleaned)) {
    throw new Error(`Invalid PostgreSQL identifier "${raw}". Use lowercase letters, digits, and underscores starting with a letter.`);
  }
  return cleaned;
}

/** Formats a JavaScript value as a safe PostgreSQL literal. */
export function formatPgLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Introspects all user tables in the `public` schema of the active PostgreSQL database
 * along with exact column metadata, primary keys, estimated row counts, and relation sizes.
 */
export function buildSchemaIntrospectionSql(): string {
  return `
SELECT
  t.table_name,
  COALESCE(
    (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = t.table_name
      ORDER BY kcu.ordinal_position
      LIMIT 1
    ),
    ''
  ) AS primary_key,
  COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) AS size_pretty,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'name', c.column_name,
          'dataType', c.data_type,
          'udtName', c.udt_name,
          'isNullable', (c.is_nullable = 'YES'),
          'defaultValue', c.column_default
        )
        ORDER BY c.ordinal_position
      )
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
    ),
    '[]'::json
  ) AS columns_json
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s
  ON s.schemaname = t.table_schema
 AND s.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name ASC;
`.trim();
}

/** Builds a default insert template object from real PostgreSQL column definitions. */
export function buildDefaultRowFromColumns(columns: LiveStudioColumn[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of columns) {
    // Skip columns that have a server-side default like gen_random_uuid(), nextval(), or now()
    if (col.defaultValue && col.defaultValue.trim().length > 0) {
      continue;
    }
    const lowerType = `${col.dataType} ${col.udtName}`.toLowerCase();
    if (lowerType.includes("bool")) row[col.name] = false;
    else if (lowerType.includes("int") || lowerType.includes("numeric") || lowerType.includes("double") || lowerType.includes("real")) {
      row[col.name] = 0;
    } else if (lowerType.includes("json")) {
      row[col.name] = {};
    } else if (lowerType.includes("timestamp") || lowerType.includes("date")) {
      row[col.name] = new Date().toISOString();
    } else if (lowerType.includes("vector")) {
      row[col.name] = "[0.1, 0.2, 0.3]";
    } else {
      row[col.name] = "";
    }
  }
  return row;
}

/** Parses rows returned by `buildSchemaIntrospectionSql()` into typed LiveStudioTable entries. */
export function parseIntrospectedTables(rows: Array<Record<string, unknown>>): LiveStudioTable[] {
  return rows
    .filter((r) => typeof r.table_name === "string" && r.table_name.trim().length > 0)
    .map((r) => {
      const tableName = String(r.table_name);
      const rawCols = Array.isArray(r.columns_json)
        ? r.columns_json
        : typeof r.columns_json === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(r.columns_json);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];
      const pkFromConstraint = typeof r.primary_key === "string" ? r.primary_key.trim() : "";
      const columns: LiveStudioColumn[] = rawCols.map((c: Record<string, unknown>) => {
        const name = String(c.name || "");
        return {
          name,
          dataType: String(c.dataType || "text"),
          udtName: String(c.udtName || c.dataType || "text"),
          isNullable: Boolean(c.isNullable),
          defaultValue: c.defaultValue === null || c.defaultValue === undefined ? null : String(c.defaultValue),
          isPrimary: pkFromConstraint ? name === pkFromConstraint : false,
        };
      });
      const resolvedPk = pkFromConstraint || columns[0]?.name || "id";
      const finalCols = columns.map((c) => ({
        ...c,
        isPrimary: pkFromConstraint ? c.name === pkFromConstraint : c.name === resolvedPk,
      }));
      return {
        name: tableName,
        label: tableName,
        description: `${finalCols.length} column${finalCols.length === 1 ? "" : "s"} · ${String(r.size_pretty || "0 bytes")}`,
        primaryKey: resolvedPk,
        columns: finalCols,
        estimatedRows: Number(r.estimated_rows ?? 0) || 0,
        sizePretty: String(r.size_pretty || "0 bytes"),
        defaultRow: buildDefaultRowFromColumns(finalCols),
      };
    });
}

export function buildSelectTableSql(tableName: string, limit = 100): string {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  return `SELECT * FROM "public".${quotePgIdent(tableName)} LIMIT ${safeLimit};`;
}

export function buildInsertRowSql(
  tableName: string,
  values: Record<string, unknown>,
): string {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return `INSERT INTO "public".${quotePgIdent(tableName)} DEFAULT VALUES RETURNING *;`;
  }
  const colsSql = entries.map(([k]) => quotePgIdent(k)).join(", ");
  const valsSql = entries.map(([, v]) => formatPgLiteral(v)).join(", ");
  return `INSERT INTO "public".${quotePgIdent(tableName)} (${colsSql}) VALUES (${valsSql}) RETURNING *;`;
}

export function buildUpdateRowSql(
  tableName: string,
  pkCol: string,
  pkVal: unknown,
  patch: Record<string, unknown>,
): string {
  const entries = Object.entries(patch).filter(([k]) => k !== pkCol);
  if (entries.length === 0) {
    throw new Error("No editable columns provided to update.");
  }
  const setClauses = entries
    .map(([k, v]) => `${quotePgIdent(k)} = ${formatPgLiteral(v)}`)
    .join(", ");
  const whereClause =
    pkVal === null || pkVal === undefined
      ? `${quotePgIdent(pkCol)} IS NULL`
      : `${quotePgIdent(pkCol)} = ${formatPgLiteral(pkVal)}`;
  return `UPDATE "public".${quotePgIdent(tableName)} SET ${setClauses} WHERE ${whereClause} RETURNING *;`;
}

export function buildDeleteRowSql(
  tableName: string,
  pkCol: string,
  pkVal: unknown,
): string {
  const whereClause =
    pkVal === null || pkVal === undefined
      ? `${quotePgIdent(pkCol)} IS NULL`
      : `${quotePgIdent(pkCol)} = ${formatPgLiteral(pkVal)}`;
  return `DELETE FROM "public".${quotePgIdent(tableName)} WHERE ${whereClause} RETURNING *;`;
}

const ALLOWED_COLUMN_TYPES = new Set([
  "UUID",
  "TEXT",
  "VARCHAR(255)",
  "INTEGER",
  "BIGINT",
  "NUMERIC(12,2)",
  "BOOLEAN",
  "TIMESTAMPTZ",
  "DATE",
  "JSONB",
  "vector(3)",
  "vector(384)",
  "vector(1536)",
]);

export function buildCreateTableSql(
  rawTableName: string,
  columns: Array<{
    name: string;
    type: string;
    isPrimary: boolean;
    isNullable: boolean;
    defaultValue: string;
  }>,
  enableRls: boolean,
): string {
  const safeTable = sanitizePgObjectName(rawTableName);
  if (!columns.length) {
    throw new Error("At least one column is required.");
  }

  const colDefs = columns.map((col) => {
    const safeCol = sanitizePgObjectName(col.name || "column_name");
    const safeType = ALLOWED_COLUMN_TYPES.has(col.type) ? col.type : "TEXT";
    let def = `  ${quotePgIdent(safeCol)} ${safeType}`;
    if (col.isPrimary) def += " PRIMARY KEY";
    if (!col.isNullable && !col.isPrimary) def += " NOT NULL";
    if (col.defaultValue && col.defaultValue.trim()) {
      def += ` DEFAULT ${col.defaultValue.trim()}`;
    }
    return def;
  });

  let ddl = `CREATE TABLE "public".${quotePgIdent(safeTable)} (\n${colDefs.join(",\n")}\n);`;
  if (enableRls) {
    ddl += `\n\nALTER TABLE "public".${quotePgIdent(safeTable)} ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY ${quotePgIdent(`${safeTable}_allow_all`)} ON "public".${quotePgIdent(safeTable)}\nFOR ALL USING (true) WITH CHECK (true);`;
  }
  return ddl;
}

export function buildDropTableSql(tableName: string): string {
  return `DROP TABLE IF EXISTS "public".${quotePgIdent(tableName)};`;
}

export function buildSchemaDdlFromTables(tables: LiveStudioTable[], dbName: string): string {
  let ddl = `-- =====================================================================\n`;
  ddl += `-- SPARROWX CLOUD DB — LIVE POSTGRESQL SCHEMA EXPORT\n`;
  ddl += `-- Database: ${dbName}\n`;
  ddl += `-- Exported at: ${new Date().toISOString()}\n`;
  ddl += `-- =====================================================================\n\n`;

  if (tables.length === 0) {
    ddl += `-- No tables exist in schema "public" yet.\n`;
    return ddl;
  }

  for (const tbl of tables) {
    ddl += `-- Table: public.${tbl.name} (${tbl.sizePretty})\n`;
    const colDefs = tbl.columns.map((c) => {
      const typeLabel = c.udtName === "vector" ? "vector" : c.dataType.toUpperCase();
      let line = `  ${quotePgIdent(c.name)} ${typeLabel}`;
      if (c.isPrimary) line += " PRIMARY KEY";
      if (!c.isNullable && !c.isPrimary) line += " NOT NULL";
      if (c.defaultValue) line += ` DEFAULT ${c.defaultValue}`;
      return line;
    });
    ddl += `CREATE TABLE IF NOT EXISTS "public".${quotePgIdent(tbl.name)} (\n${colDefs.join(",\n")}\n);\n\n`;
  }
  return ddl;
}

/** Detects whether a SQL script mutates schema or table rows so Studio refreshes metadata automatically. */
export function isSchemaMutatingSql(sql: string): boolean {
  return /\b(create|alter|drop|truncate|insert|update|delete|comment|grant|revoke)\b/i.test(sql);
}
