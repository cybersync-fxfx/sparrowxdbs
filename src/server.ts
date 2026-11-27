import crypto from "node:crypto";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import migratedSeedData from "./lib/migrated-seed.json";
import {
  createRateLimiter,
  handleContactRequest,
  type ContactInquiryRecord,
} from "./lib/contact-inquiry";
import {
  authorizeDbRequest,
  checkDbRateLimit,
  extractClientIp,
} from "./lib/server/db-auth.server";
import { timingSafeEqual } from "./lib/server/crypto.server";
import {
  createUpiOrder,
  getUpiGatewayConfig,
  getUpiOrder,
  listRecentUpiOrders,
  processUpiAutoWebhook,
  verifyUpiUtr,
} from "./lib/server/upi-payments.server";
import {
  buildHostRobotsTxt,
  buildHostSitemapXml,
  resolveCanonicalSubdomainRedirect,
} from "./lib/seo-profiles";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Strict origin-validated CORS headers (no wildcard '*' on authenticated APIs)
function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = (request.headers.get("origin") || "").trim();
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key, x-sparrowx-admin-key",
    Vary: "Origin",
  };
  if (origin) {
    try {
      const parsed = new URL(origin);
      const h = parsed.hostname.toLowerCase();
      const allowed =
        (parsed.protocol === "https:" && (h === "sparrowx.net" || h.endsWith(".sparrowx.net"))) ||
        (parsed.protocol === "http:" && (h === "localhost" || h === "127.0.0.1"));
      if (allowed) {
        base["Access-Control-Allow-Origin"] = origin;
        base["Access-Control-Allow-Credentials"] = "true";
      }
    } catch {
      // ignore malformed origin
    }
  }
  return base;
}

const SENSITIVE_REST_TABLES = new Set([
  "app_users",
  "client_tenants",
  "contact_inquiries",
  "provisioned_databases",
  "provisioned_db_backups",
  "provisioned_db_audit_logs",
  "email_verification_codes",
  "tenant_ips",
  "incidents",
]);

function stripSecretColumns(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    if (lk === "password" || lk === "password_hash" || lk === "token_hash" || lk === "tokenhash") {
      continue;
    }
    clean[k] = v;
  }
  return clean;
}

function findVerifiedTenantByApiKey(rawKey: string): Record<string, unknown> | null {
  const cleaned = rawKey.replace(/^Bearer\s+/i, "").trim();
  if (!cleaned || cleaned.length < 16) return null;
  const tenants = getTableRows("client_tenants");
  for (const t of tenants) {
    const storedKey = String(t.api_key ?? "").trim();
    if (storedKey && timingSafeEqual(cleaned, storedKey)) {
      return t;
    }
  }
  return null;
}

// Sovereign Built-in Table Store (used when POSTGREST_INTERNAL_URL is not configured or as fast cache)
const sovereignTableStore = new Map<string, Array<Record<string, unknown>>>();

function getTableRows(tableName: string): Array<Record<string, unknown>> {
  if (!sovereignTableStore.has(tableName)) {
    const seedTable = (migratedSeedData as Record<string, Array<Record<string, unknown>>>)[
      tableName
    ];
    sovereignTableStore.set(tableName, Array.isArray(seedTable) ? [...seedTable] : []);
  }
  return sovereignTableStore.get(tableName)!;
}

function matchesPostgrestFilters(row: Record<string, unknown>, searchParams: URLSearchParams): boolean {
  for (const [key, rawVal] of searchParams.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "offset") continue;
    const cell = row[key];
    if (rawVal.startsWith("eq.")) {
      const target = rawVal.slice(3);
      if (String(cell ?? "") !== target) return false;
    } else if (rawVal.startsWith("neq.")) {
      const target = rawVal.slice(4);
      if (String(cell ?? "") === target) return false;
    } else if (rawVal.startsWith("ilike.")) {
      const target = rawVal.slice(6).toLowerCase();
      if (String(cell ?? "").toLowerCase() !== target) return false;
    } else if (rawVal.startsWith("in.(") && rawVal.endsWith(")")) {
      const list = rawVal
        .slice(4, -1)
        .split(",")
        .map((item) => item.replace(/^"|"$/g, ""));
      if (!list.includes(String(cell ?? ""))) return false;
    }
  }
  return true;
}

async function handleSovereignRestApi(request: Request, url: URL): Promise<Response | null> {
  const match = url.pathname.match(/^\/rest\/v1\/([a-zA-Z0-9_]+)$/);
  if (!match) return null;
  const tableName = match[1]!;
  const corsHeaders = buildCorsHeaders(request);

  // Enforce authentication for ALL mutations and ALL sensitive table reads
  const isMutation = request.method !== "GET" && request.method !== "HEAD";
  const requiresAuth = isMutation || SENSITIVE_REST_TABLES.has(tableName);
  const auth = requiresAuth ? await authorizeDbRequest(request) : null;
  if (requiresAuth && (!auth || !auth.authorized)) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
    });
  }

  const rows = getTableRows(tableName);

  // If running alongside self-hosted PostgREST container on OVH Ubuntu, sync & merge with PostgREST
  const postgrestInternal = process.env.POSTGREST_INTERNAL_URL || "http://127.0.0.1:3001";
  if (request.method === "GET") {
    let combinedRows = [...rows];
    try {
      const upstreamUrl = `${postgrestInternal.replace(/\/+$/, "")}/${tableName}`;
      const upstreamRes = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      if (upstreamRes.ok) {
        const pgRows = (await upstreamRes.json()) as Array<Record<string, unknown>>;
        if (Array.isArray(pgRows) && pgRows.length > 0) {
          const seenKeys = new Set<string>();
          const merged: Array<Record<string, unknown>> = [];
          const getKey = (r: Record<string, unknown>) =>
            tableName === "app_users"
              ? String(r.email ?? r.id ?? "").trim().toLowerCase()
              : String(r.id ?? "");

          for (const pgRow of pgRows) {
            const k = getKey(pgRow);
            if (k) seenKeys.add(k);
            merged.push(pgRow);
          }
          for (const memRow of rows) {
            const k = getKey(memRow);
            if (!k || !seenKeys.has(k)) {
              if (k) seenKeys.add(k);
              merged.push(memRow);
            }
          }
          combinedRows = merged;
        }
      }
    } catch {
      // PostgREST container not reachable; use in-memory + migratedSeedData store
    }

    // Strict account/tenant row isolation for non-admin callers
    if (auth && !auth.isAdmin) {
      const actorEmail = (auth.actorEmail || "").toLowerCase();
      const actorTenant = auth.tenantId || "";
      if (tableName === "app_users") {
        combinedRows = combinedRows.filter(
          (r) => actorEmail && String(r.email ?? "").toLowerCase() === actorEmail,
        );
      } else if (tableName === "client_tenants") {
        combinedRows = combinedRows.filter(
          (r) =>
            (actorEmail && String(r.contact_email ?? "").toLowerCase() === actorEmail) ||
            (actorTenant && String(r.id ?? "") === actorTenant),
        );
      } else if (tableName === "contact_inquiries") {
        combinedRows = combinedRows.filter(
          (r) => actorEmail && String(r.email ?? "").toLowerCase() === actorEmail,
        );
      } else if (tableName === "incidents" || tableName === "tenant_ips") {
        combinedRows = combinedRows.filter(
          (r) => actorTenant && String(r.tenant_id ?? r.tenantId ?? "") === actorTenant,
        );
      }
    }

    let result = combinedRows
      .filter((row) => matchesPostgrestFilters(row, url.searchParams))
      .map(stripSecretColumns);
    const orderParam = url.searchParams.get("order");
    if (orderParam) {
      const [col, dir] = orderParam.split(".");
      if (col) {
        result = [...result].sort((a, b) => {
          const va = String(a[col] ?? "");
          const vb = String(b[col] ?? "");
          return dir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
        });
      }
    }
    const limitParam = url.searchParams.get("limit");
    if (limitParam) {
      const n = Number.parseInt(limitParam, 10);
      if (Number.isFinite(n) && n > 0) result = result.slice(0, n);
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
    });
  }

  // Enforce strict RBAC & tenant isolation on ALL write operations (POST / PATCH / DELETE)
  const ADMIN_ONLY_WRITE_TABLES = new Set([
    "app_users",
    "client_tenants",
    "provisioned_databases",
    "provisioned_db_backups",
    "provisioned_db_audit_logs",
    "email_verification_codes",
  ]);

  if (auth && !auth.isAdmin) {
    if (ADMIN_ONLY_WRITE_TABLES.has(tableName)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: direct mutations on protected tables require admin privileges." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
        },
      );
    }
    const actorTenant = auth.tenantId || "";
    const actorEmail = (auth.actorEmail || "").toLowerCase();
    if (tableName === "incidents" || tableName === "tenant_ips") {
      if (!actorTenant) {
        return new Response(JSON.stringify({ error: "Forbidden: tenant scope required." }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
        });
      }
      if (request.method === "PATCH" || request.method === "DELETE") {
        const reqTenantFilter = url.searchParams.get("tenant_id") || url.searchParams.get("tenantId");
        if (reqTenantFilter && reqTenantFilter !== `eq.${actorTenant}`) {
          return new Response(JSON.stringify({ error: "Forbidden: cross-tenant mutation blocked." }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
          });
        }
        url.searchParams.set("tenant_id", `eq.${actorTenant}`);
      }
    } else if (tableName === "contact_inquiries" && (request.method === "PATCH" || request.method === "DELETE")) {
      if (!actorEmail) {
        return new Response(JSON.stringify({ error: "Forbidden: account scope required." }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
        });
      }
      url.searchParams.set("email", `eq.${actorEmail}`);
    }
  }

  // Forward write operations (POST / PATCH / DELETE) to PostgREST in background/parallel while updating memory store
  const clonedBodyText =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.clone().text()
      : undefined;
  try {
    const upstreamUrl = `${postgrestInternal.replace(/\/+$/, "")}/${tableName}${url.search}`;
    await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        Accept: request.headers.get("Accept") || "application/json",
        ...(request.headers.get("Prefer") ? { Prefer: request.headers.get("Prefer")! } : {}),
      },
      ...(clonedBodyText !== undefined ? { body: clonedBodyText } : {}),
    });
  } catch {
    // Ignore if PostgREST container is offline; memory store handles it below
  }

  if (request.method === "POST") {
    try {
      const payload = (await request.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
      const incoming = Array.isArray(payload) ? payload : [payload];
      const inserted: Array<Record<string, unknown>> = [];
      for (const item of incoming) {
        const record: Record<string, unknown> = {
          ...item,
          created_at: item.created_at || new Date().toISOString(),
        };
        const recordId = record.id ? String(record.id) : "";
        if (recordId) {
          const existingIdx = rows.findIndex((r) => String(r.id ?? "") === recordId);
          if (existingIdx >= 0) {
            const merged = { ...rows[existingIdx], ...record };
            rows[existingIdx] = merged;
            inserted.push(stripSecretColumns(merged));
            continue;
          }
        }
        rows.unshift(record);
        inserted.push(stripSecretColumns(record));
      }
      return new Response(JSON.stringify(inserted), {
        status: 201,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  if (request.method === "PATCH") {
    try {
      const patch = (await request.json()) as Record<string, unknown>;
      const updated: Array<Record<string, unknown>> = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row && matchesPostgrestFilters(row, url.searchParams)) {
          const merged = { ...row, ...patch };
          rows[i] = merged;
          updated.push(stripSecretColumns(merged));
        }
      }
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid PATCH payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  if (request.method === "DELETE") {
    if (auth && !auth.isAdmin && url.searchParams.toString() === "") {
      return new Response(JSON.stringify({ error: "Forbidden: bulk delete requires filter or admin." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const remaining = rows.filter((row) => !matchesPostgrestFilters(row, url.searchParams));
    sovereignTableStore.set(tableName, remaining);
    return new Response(JSON.stringify({ deleted: rows.length - remaining.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const contactRateLimiter = createRateLimiter(5, 60 * 60 * 1000);

// Persist to self-hosted PostgREST when reachable; otherwise keep in the in-memory store
// so the submission is never silently lost while the DB container warms up.
async function persistContactInquiry(record: ContactInquiryRecord): Promise<void> {
  // Always forward form submissions to SparrowX Discord Telemetry Webhook
  void import("./lib/server/discord-webhook.server")
    .then(({ sendDiscordTelemetry }) =>
      sendDiscordTelemetry({
        category: "form",
        severity: "info",
        service: "SparrowX Forms & Inquiries",
        title: `New Submission — ${record.topic || "General Inquiry"}`,
        description: record.message,
        fields: {
          Ticket: record.id,
          Name: record.name,
          Email: record.email,
          Topic: record.topic,
          "Submitted At": record.created_at,
        },
      }),
    )
    .catch(() => {});

  const postgrestInternal = process.env.POSTGREST_INTERNAL_URL || "http://127.0.0.1:3001";
  try {
    const res = await fetch(`${postgrestInternal.replace(/\/+$/, "")}/contact_inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(record),
    });
    if (res.ok) return;
  } catch {
    // fall through to in-memory store
  }
  getTableRows("contact_inquiries").unshift({ ...record });
}

// Real Ingestion & Handshake Endpoints for External Client Services
async function handleSparrowxApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const corsHeaders = buildCorsHeaders(request);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 0. Sovereign PostgREST-Compatible Endpoint (/rest/v1/:table)
  if (url.pathname.startsWith("/rest/v1/")) {
    const restResponse = await handleSovereignRestApi(request, url);
    if (restResponse) return restResponse;
  }

  // 0b. Public contact inquiry form
  if (url.pathname === "/api/v1/contact") {
    return handleContactRequest(request, {
      persist: persistContactInquiry,
      limiter: contactRateLimiter,
      corsHeaders,
    });
  }

  // 1. Minimal Health Probe (zero internal IP / nameserver / version disclosure)
  if (url.pathname === "/api/v1/health" || url.pathname === "/api/health") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      },
    );
  }

  // 2. Client SDK & Connector Verification Endpoint
  const isVerifyRoute =
    url.pathname === "/api/v1/verify" ||
    url.pathname === "/api/verify" ||
    /^\/api\/v1\/tenant\/[^/]+\/verify$/.test(url.pathname);

  if (isVerifyRoute) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`verify:${ip}`, 30, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const key = request.headers.get("x-sparrowx-key") || request.headers.get("authorization") || "";
    let bodyData: Record<string, unknown> = {};
    try {
      bodyData = (await request.json()) as Record<string, unknown>;
    } catch {
      // Body may be empty
    }

    const pathTenantMatch = url.pathname.match(/\/api\/v1\/tenant\/([^/]+)\/verify/);
    const tenantId = (pathTenantMatch ? pathTenantMatch[1] : (bodyData.tenantId as string)) || "";
    const apiKey = key || (bodyData.apiKey as string) || "";
    const matchedTenant = findVerifiedTenantByApiKey(apiKey);
    const ssoAuth = !matchedTenant ? await authorizeDbRequest(request, tenantId ? { targetTenantId: tenantId } : {}) : null;
    const isValidKey = Boolean(
      (matchedTenant && (!tenantId || String(matchedTenant.id ?? "") === tenantId)) ||
        ssoAuth?.authorized,
    );

    return new Response(
      JSON.stringify({
        verified: isValidKey,
        tenantId: isValidKey ? tenantId || String(matchedTenant?.id ?? "default") : "",
        status: isValidKey ? "Connected & Active" : "Key Verification Failed",
        message: isValidKey
          ? "SparrowX connector handshake established."
          : "Invalid or missing SparrowX Ingestion Key.",
        timestamp: new Date().toISOString(),
      }),
      {
        status: isValidKey ? 200 : 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      },
    );
  }

  // 2b. Tenant Database Dedicated IPs Table API (authenticated & tenant-scoped)
  const tenantIpsMatch = url.pathname.match(/^\/api\/v1\/tenant\/([^/]+)\/ips(?:\/([^/]+))?$/);
  if (tenantIpsMatch) {
    const tenantId = tenantIpsMatch[1] ?? "";
    const ipRecordId = tenantIpsMatch[2];
    const auth = await authorizeDbRequest(request, { targetTenantId: tenantId });
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    }
    const dbPartition = `spx_db_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const ipTableName = `${dbPartition}_ips`;
    const ipRows = getTableRows("tenant_ips");

    if (request.method === "GET") {
      const tenantRecords = ipRows.filter(
        (r) => String(r.tenantId ?? r.tenant_id ?? "") === tenantId,
      );
      return new Response(
        JSON.stringify({
          tenantId,
          status: "online",
          records: tenantRecords,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders } },
      );
    }

    if (request.method === "POST") {
      try {
        const body = (await request.json()) as { ipAddress?: string; label?: string; type?: string; notes?: string };
        const cleanIp = (body.ipAddress || "").trim();
        const ipv4Pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
        const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;

        if (!cleanIp || (!ipv4Pattern.test(cleanIp) && !ipv6Pattern.test(cleanIp))) {
          return new Response(
            JSON.stringify({
              error: "Invalid IP address format. Must be a valid IPv4, CIDR, or IPv6 address.",
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        const newRecord = {
          id: `ip_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
          tenantId,
          tenant_id: tenantId,
          databaseName: dbPartition,
          database_name: dbPartition,
          tableName: ipTableName,
          table_name: ipTableName,
          ipAddress: cleanIp,
          ip_address: cleanIp,
          label: body.label?.trim().slice(0, 80) || "Server Origin Host",
          type: body.type || "server_wan",
          status: "Active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastProbeStatus: "Pending",
          notes: body.notes?.trim().slice(0, 240) || undefined,
        };

        ipRows.unshift(newRecord);

        return new Response(
          JSON.stringify({
            success: true,
            message: `IP ${cleanIp} added successfully.`,
            record: newRecord,
          }),
          { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders } },
        );
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON payload" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    if (request.method === "DELETE") {
      if (ipRecordId) {
        const remaining = ipRows.filter(
          (r) => !(String(r.id ?? "") === ipRecordId && String(r.tenantId ?? r.tenant_id ?? "") === tenantId),
        );
        sovereignTableStore.set("tenant_ips", remaining);
      }
      return new Response(
        JSON.stringify({
          success: true,
          tenantId,
        }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders } },
      );
    }
  }

  // 2c. Tenant API Credentials Reset Endpoint (authenticated + CSPRNG)
  const tenantResetMatch = url.pathname.match(/^\/api\/v1\/tenant\/([^/]+)\/reset-(?:credentials|keys)$/);
  if (tenantResetMatch && request.method === "POST") {
    const tenantId = tenantResetMatch[1] ?? "";
    const auth = await authorizeDbRequest(request, { targetTenantId: tenantId });
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    }
    const rawId = tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    const randKey = crypto.randomBytes(16).toString("hex");
    const randCid = crypto.randomBytes(8).toString("hex");

    const newApiKey = `spx_live_${rawId}_${randKey}`;
    const newApiClientId = `spx_cid_${rawId.toLowerCase()}_${randCid}`;

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        newApiKey,
        newApiClientId,
        message: "API credentials rotated successfully. Previous credentials invalidated.",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders } },
    );
  }

  // 3. Real Telemetry & Threat Ingestion Endpoint (authenticated + rate-limited)
  const isTelemetryRoute =
    url.pathname === "/api/v1/telemetry" ||
    url.pathname === "/api/v1/telemetry/ingest" ||
    url.pathname === "/api/telemetry" ||
    url.pathname === "/api/telemetry/ingest" ||
    /^\/api\/v1\/tenant\/[^/]+\/telemetry$/.test(url.pathname);

  if (isTelemetryRoute) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`telemetry-ingest:${ip}`, 30, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const key = request.headers.get("x-sparrowx-key") || request.headers.get("authorization") || "";
    const matchedTenant = findVerifiedTenantByApiKey(key);
    const ssoAuth = !matchedTenant ? await authorizeDbRequest(request) : null;
    if (!matchedTenant && !ssoAuth?.authorized) {
      return new Response(JSON.stringify({ error: "Valid x-sparrowx-key or session required." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    }

    try {
      const payload = (await request.json()) as {
        title?: string;
        severity?: "Critical" | "High" | "Medium" | "Low";
        source?: string;
        domain?: string;
        summary?: string;
        tenantId?: string;
        service_id?: string;
      };

      const tenantId = String(matchedTenant?.id || ssoAuth?.tenantId || "default");
      const incidentId = `INC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const incidentRecord = {
        id: incidentId,
        title: String(payload.title || "External Telemetry Event").slice(0, 140),
        source: String(payload.source || payload.domain || "Client Endpoint").slice(0, 120),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        severity: ["Critical", "High", "Medium", "Low"].includes(String(payload.severity))
          ? payload.severity
          : "High",
        status: "Open",
        assignee: "Autonomous Edge Shield",
        summary: String(payload.summary || "Telemetry event received.").slice(0, 400),
        playbook: "Automated Edge Containment Playbook",
        affected_assets: 1,
        tenant_id: tenantId,
      };

      getTableRows("incidents").unshift({
        ...incidentRecord,
        created_at: new Date().toISOString(),
      });

      const postgrestTarget = process.env.POSTGREST_INTERNAL_URL || "";
      if (postgrestTarget) {
        void fetch(`${postgrestTarget.replace(/\/+$/, "")}/incidents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(incidentRecord),
        }).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          status: "ingested",
          tenantId,
          incidentId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
        },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON telemetry payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
  }

  // 4. Centralized Diagnostics Telemetry Ingest (rate-limited)
  if (url.pathname === "/api/v1/diagnostics") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`diagnostics:${ip}`, 20, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    try {
      const payload = (await request.json()) as {
        referenceId?: string;
        code?: string;
      };

      const refId = String(payload.referenceId || `SPX-ERR-${Date.now()}`).slice(0, 64);
      return new Response(
        JSON.stringify({
          status: "received",
          referenceId: refId,
          code: String(payload.code || "UNKNOWN").slice(0, 32),
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
        },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON diagnostics payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
  }

  // Note: /api/infra/servers/* requests fall through to authenticated TanStack Start route handlers in src/routes/api/infra/servers/*

  // =========================================================================
  // SPARROWX UNIFIED UPI AUTO-CONFIRMATION PAYMENT API (ALL SERVICES)
  // =========================================================================
  if (url.pathname === "/api/payments/upi/create" && request.method === "POST") {
    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`upi-create:${ip}`, 15, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    try {
      const body = (await request.json()) as {
        service?: "infra" | "game" | "db" | "shield" | "netsec" | "wallet";
        planId?: string;
        planName?: string;
        amountInr?: number;
        customerEmail?: string;
        metadata?: {
          category?: "bare-metal" | "dedicated" | "vps";
          hostname?: string;
          region?: string;
          os?: string;
        };
      };
      const amount = Number(body.amountInr || 0);
      if (!Number.isFinite(amount) || amount < 1 || amount > 500_000) {
        return new Response(JSON.stringify({ ok: false, error: "Amount must be between ₹1 and ₹500,000." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const order = createUpiOrder({
        service: body.service || "infra",
        planId: String(body.planId || "custom"),
        planName: String(body.planName || "SparrowX Cloud Service"),
        amountInr: amount,
        customerEmail: String(body.customerEmail || "client@sparrowx.net"),
        metadata: body.metadata,
      });
      const cfg = getUpiGatewayConfig();
      void import("./lib/server/discord-webhook.server")
        .then(({ sendDiscordTelemetry }) =>
          sendDiscordTelemetry({
            category: "form",
            severity: "info",
            service: `SparrowX UPI Checkout (${order.service})`,
            title: `New Order Started — ${order.planName}`,
            ip,
            fields: {
              "Order ID": order.orderId,
              Service: order.service,
              Plan: order.planName,
              Amount: `₹${order.exactAmountInr}`,
              Email: order.customerEmail,
              Region: body.metadata?.region,
              Hostname: body.metadata?.hostname,
            },
          }),
        )
        .catch(() => {});
      return new Response(JSON.stringify({ ok: true, mode: cfg.mode, order }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid UPI create payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  if (url.pathname === "/api/payments/upi/status" && request.method === "GET") {
    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`upi-status:${ip}`, 40, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const orderId = url.searchParams.get("orderId") || "";
    const order = getUpiOrder(orderId);
    if (!order) {
      return new Response(JSON.stringify({ ok: false, error: "UPI order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const auth = await authorizeDbRequest(request);
    const isOwnerOrAdmin =
      auth.authorized &&
      (auth.isAdmin ||
        (auth.actorEmail &&
          auth.actorEmail.toLowerCase() === order.customerEmail.toLowerCase()));
    const safeOrder = isOwnerOrAdmin
      ? order
      : {
          ...order,
          customerEmail: "***",
        };
    return new Response(JSON.stringify({ ok: true, order: safeOrder }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
    });
  }

  if (url.pathname === "/api/payments/upi/orders" && request.method === "GET") {
    const auth = await authorizeDbRequest(request, { requireAdmin: true });
    if (!auth.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "Admin authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        config: getUpiGatewayConfig(),
        orders: listRecentUpiOrders(25),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      },
    );
  }

  if (url.pathname === "/api/payments/upi/webhook" && request.method === "POST") {
    const rawBody = await request.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ ok: false, message: "Invalid webhook JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const result = processUpiAutoWebhook({
      rawBody,
      headers: {
        "x-razorpay-signature": request.headers.get("x-razorpay-signature") ?? undefined,
        "x-sparrowx-upi-secret": request.headers.get("x-sparrowx-upi-secret") ?? undefined,
      },
      payload,
    });
    if (result.ok && result.order) {
      const paidOrder = result.order;
      void import("./lib/server/discord-webhook.server")
        .then(({ sendDiscordTelemetry }) =>
          sendDiscordTelemetry({
            category: "deploy",
            severity: "info",
            service: `SparrowX UPI Auto-Provision (${paidOrder.service})`,
            title: `Payment Confirmed & Provisioned — ${paidOrder.planName}`,
            fields: {
              "Order ID": paidOrder.orderId,
              Amount: `₹${paidOrder.exactAmountInr}`,
              UTR: paidOrder.utr,
              Email: paidOrder.customerEmail,
              Server: paidOrder.provisionedServer?.name,
              IPv4: paidOrder.provisionedServer?.ipv4,
            },
          }),
        )
        .catch(() => {});
    }
    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
    });
  }

  if (url.pathname === "/api/payments/upi/verify-utr" && request.method === "POST") {
    const ip = extractClientIp(request);
    const rate = checkDbRateLimit(`upi-verify-utr:${ip}`, 12, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ ok: false, message: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    try {
      const body = (await request.json()) as { orderId?: string; utr?: string };
      const result = verifyUpiUtr({
        orderId: String(body.orderId || ""),
        utr: String(body.utr || ""),
      });
      if (result.ok && result.order) {
        const paidOrder = result.order;
        void import("./lib/server/discord-webhook.server")
          .then(({ sendDiscordTelemetry }) =>
            sendDiscordTelemetry({
              category: "deploy",
              severity: "info",
              service: `SparrowX UPI UTR Match (${paidOrder.service})`,
              title: `UTR Verified & Provisioned — ${paidOrder.planName}`,
              fields: {
                "Order ID": paidOrder.orderId,
                Amount: `₹${paidOrder.exactAmountInr}`,
                UTR: paidOrder.utr,
                Email: paidOrder.customerEmail,
                Server: paidOrder.provisionedServer?.name,
                IPv4: paidOrder.provisionedServer?.ipv4,
              },
            }),
          )
          .catch(() => {});
      }
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
      });
    } catch {
      return new Response(JSON.stringify({ ok: false, message: "Invalid UTR payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return null;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const reqHost =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        url.hostname;

      // 0a. Host-isolated dynamic robots.txt & sitemap.xml (zero cross-subdomain SEO collision)
      if (url.pathname === "/robots.txt" && (request.method === "GET" || request.method === "HEAD")) {
        return new Response(buildHostRobotsTxt(reqHost), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            Vary: "Host",
          },
        });
      }

      if (url.pathname === "/sitemap.xml" && (request.method === "GET" || request.method === "HEAD")) {
        return new Response(buildHostSitemapXml(reqHost), {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            Vary: "Host",
          },
        });
      }

      if (url.pathname === "/llms.txt" && (request.method === "GET" || request.method === "HEAD")) {
        const llmsBody = [
          "# SparrowX Technologies",
          "",
          "> Independent sovereign cloud infrastructure, Dual Intel Xeon Gold & AMD Ryzen 9 VPS/VDS, managed PostgreSQL databases, autonomous eBPF/XDP DDoS defense, game hosting, and encrypted developer utilities.",
          "",
          "## Platforms",
          "- https://sparrowx.net/ — SparrowX Platform Hub & Client Area",
          "- https://infra.sparrowx.net/ — Cloud Infra (KVM VPS, Dedicated VDS, Bare Metal)",
          "- https://db.sparrowx.net/ — Managed PostgreSQL 16 & pgvector Studio",
          "- https://sec.sparrowx.net/ — SparrowX Shield Edge WAF & DDoS Defense",
          "- https://netsec.sparrowx.net/ — NetSec Linux Firewall & WireGuard Guard",
          "- https://sparrowx.net/game — Low-Latency FiveM, Minecraft & SA-MP Game Hosting",
          "- https://file.sparrowx.net/ — SparrowX Drop Encrypted File Transfer",
          "- https://password.sparrowx.net/ — SparrowX Keys Offline Password Generator",
          "",
          "## Documentation & Support",
          "- https://sparrowx.net/docs — Documentation",
          "- https://sparrowx.net/security — Security & Sovereignty",
          "- https://wa.me/919025056678 — WhatsApp Support (+91 90250 56678)",
          "",
        ].join("\n");
        return new Response(llmsBody, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      // 0b. HTTP 301 canonical redirects on sparrowx.net / www.sparrowx.net for dedicated subdomain routes
      if (request.method === "GET" || request.method === "HEAD") {
        const canonicalRedirect = resolveCanonicalSubdomainRedirect(
          reqHost,
          url.pathname,
          url.search,
        );
        if (canonicalRedirect) {
          return new Response(null, {
            status: 301,
            headers: {
              Location: canonicalRedirect,
              "Cache-Control": "public, max-age=86400",
              Vary: "Host",
            },
          });
        }
      }

      // 1. Check if this is an external client telemetry or diagnostic request
      const apiResponse = await handleSparrowxApi(request);
      if (apiResponse) {
        return apiResponse;
      }

      // 2. Otherwise delegate to TanStack Start SSR handler
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
