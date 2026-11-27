import { createFileRoute } from "@tanstack/react-router";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
export const EDGE_CNAME_TARGET = "edge.sparrowx.net";
const PROTECTED_PLATFORM_HOSTS = new Set([
  "sparrowx.net",
  "www.sparrowx.net",
  "edge.sparrowx.net",
  "sec.sparrowx.net",
  "db.sparrowx.net",
  "api.sparrowx.net",
  "ai.sparrowx.net",
  "deploy.sparrowx.net",
  "infra.sparrowx.net",
]);
const VALID_DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const VALID_VERIFY_TOKEN_RE = /^spx-verify=[a-zA-Z0-9_-]{6,64}$/;

interface CloudflareApiError {
  code?: number;
  message?: string;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  result: T;
  errors?: CloudflareApiError[];
}

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
}

export interface ReplacedDnsBackup {
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

export function normalizeCloudflareDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function isProtectedPlatformHost(domain: string): boolean {
  const clean = normalizeCloudflareDomain(domain);
  return PROTECTED_PLATFORM_HOSTS.has(clean);
}

export function isSafePublicDomain(host: string): boolean {
  if (!host || host.length > 253) return false;
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  ) {
    return false;
  }
  return VALID_DOMAIN_RE.test(host);
}

/**
 * Pre-flight DNS liveness verification: ensures `edge.sparrowx.net` resolves to a valid public IPv4
 * BEFORE touching any customer's live A/AAAA record. Prevents dangling-CNAME customer outages!
 */
export async function verifyEdgeTargetResolvable(
  edgeHost = EDGE_CNAME_TARGET,
  fetchFn: typeof fetch = fetch,
): Promise<{ healthy: boolean; resolvedIps: string[]; reason?: string }> {
  try {
    const res = await fetchFn(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(edgeHost)}&type=A`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) {
      return {
        healthy: false,
        resolvedIps: [],
        reason: `DoH lookup for ${edgeHost} returned HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };
    const ips = (json.Answer ?? [])
      .filter((a) => a.type === 1 && typeof a.data === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(a.data))
      .map((a) => a.data!);
    if (ips.length === 0) {
      return {
        healthy: false,
        resolvedIps: [],
        reason: `${edgeHost} has no live A record in DNS yet. Aborted CNAME cutover to protect customer uptime.`,
      };
    }
    return { healthy: true, resolvedIps: ips };
  } catch (err) {
    return {
      healthy: false,
      resolvedIps: [],
      reason: err instanceof Error ? err.message : `Failed to verify ${edgeHost} DNS liveness`,
    };
  }
}

async function cfRequest<T>(
  apiToken: string,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareApiResponse<T>> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = (await res.json().catch(() => null)) as CloudflareApiResponse<T> | null;
  if (!data || typeof data.success !== "boolean") {
    throw new Error(`Unexpected response from Cloudflare API (HTTP ${res.status}).`);
  }
  if (!res.ok || !data.success) {
    const firstErr = data.errors?.[0];
    const msg = firstErr?.message || `Cloudflare API error (HTTP ${res.status})`;
    const code = firstErr?.code ? ` [code ${firstErr.code}]` : "";
    throw new Error(`${msg}${code}`);
  }
  return data;
}

async function findMatchingZone(apiToken: string, domain: string): Promise<CloudflareZone | null> {
  const labels = domain.split(".");
  for (let i = 0; i <= labels.length - 2; i += 1) {
    const candidate = labels.slice(i).join(".");
    const res = await cfRequest<CloudflareZone[]>(
      apiToken,
      `/zones?name=${encodeURIComponent(candidate)}&per_page=5`,
    );
    const active =
      res.result.find((z) => z.name.toLowerCase() === candidate && z.status === "active") ??
      res.result.find((z) => z.name.toLowerCase() === candidate);
    if (active) return active;
  }

  const listRes = await cfRequest<CloudflareZone[]>(apiToken, `/zones?per_page=50`);
  const matches = listRes.result
    .filter((z) => {
      const zn = z.name.toLowerCase();
      return domain === zn || domain.endsWith(`.${zn}`);
    })
    .sort((a, b) => b.name.length - a.name.length);
  return matches[0] ?? null;
}

async function upsertDnsRecord(params: {
  apiToken: string;
  zoneId: string;
  type: "CNAME" | "TXT";
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  replaceExistingA?: boolean;
}): Promise<{
  status: "created" | "updated" | "skipped_safe_mode";
  record?: CloudflareDnsRecord;
  replacedRecords: ReplacedDnsBackup[];
}> {
  const { apiToken, zoneId, type, name, content, ttl, proxied, replaceExistingA } = params;
  const replacedRecords: ReplacedDnsBackup[] = [];

  if (type === "TXT") {
    const existingRes = await cfRequest<CloudflareDnsRecord[]>(
      apiToken,
      `/zones/${encodeURIComponent(zoneId)}/dns_records?type=TXT&name=${encodeURIComponent(name)}`,
    );
    const existing = existingRes.result.find((r) => r.content.includes("spx-verify=")) ?? existingRes.result[0];
    const body = JSON.stringify({
      type: "TXT",
      name,
      content,
      ttl,
      comment: "SparrowX Shield WAF domain ownership verification",
    });

    if (existing) {
      const updated = await cfRequest<CloudflareDnsRecord>(
        apiToken,
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existing.id)}`,
        { method: "PUT", body },
      );
      return { status: "updated", record: updated.result, replacedRecords };
    }
    const created = await cfRequest<CloudflareDnsRecord>(
      apiToken,
      `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      { method: "POST", body },
    );
    return { status: "created", record: created.result, replacedRecords };
  }

  // CNAME upsert — check existing records on this exact hostname
  const existingRes = await cfRequest<CloudflareDnsRecord[]>(
    apiToken,
    `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(name)}`,
  );

  const existingCname = existingRes.result.find((r) => r.type === "CNAME");
  const conflictingAddr = existingRes.result.filter((r) => r.type === "A" || r.type === "AAAA");

  const cnameBody = JSON.stringify({
    type: "CNAME",
    name,
    content,
    ttl,
    proxied: Boolean(proxied),
    comment: "SparrowX Shield Edge WAF routing (DNS Only)",
  });

  if (existingCname && conflictingAddr.length === 0) {
    const updated = await cfRequest<CloudflareDnsRecord>(
      apiToken,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existingCname.id)}`,
      { method: "PUT", body: cnameBody },
    );
    return { status: "updated", record: updated.result, replacedRecords };
  }

  if (conflictingAddr.length > 0) {
    // Zero-downtime safety default: preserve live A/AAAA records unless operator explicitly opts in
    if (!replaceExistingA) {
      return { status: "skipped_safe_mode", replacedRecords };
    }

    for (const rec of conflictingAddr) {
      replacedRecords.push({
        type: rec.type,
        name: rec.name,
        content: rec.content,
        proxied: Boolean(rec.proxied),
      });
      await cfRequest<{ id: string }>(
        apiToken,
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(rec.id)}`,
        { method: "DELETE" },
      );
    }

    try {
      const created = await cfRequest<CloudflareDnsRecord>(
        apiToken,
        `/zones/${encodeURIComponent(zoneId)}/dns_records`,
        { method: "POST", body: cnameBody },
      );
      return { status: "updated", record: created.result, replacedRecords };
    } catch (err) {
      // Transactional rollback: immediately restore deleted A/AAAA records
      for (const backup of replacedRecords) {
        await cfRequest<CloudflareDnsRecord>(
          apiToken,
          `/zones/${encodeURIComponent(zoneId)}/dns_records`,
          {
            method: "POST",
            body: JSON.stringify({
              type: backup.type,
              name: backup.name,
              content: backup.content,
              ttl: 1,
              proxied: Boolean(backup.proxied),
            }),
          },
        ).catch(() => {});
      }
      throw err;
    }
  }

  const created = await cfRequest<CloudflareDnsRecord>(
    apiToken,
    `/zones/${encodeURIComponent(zoneId)}/dns_records`,
    { method: "POST", body: cnameBody },
  );
  return { status: "created", record: created.result, replacedRecords };
}

export const Route = createFileRoute("/api/shield/cloudflare-autoconfig")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp, hasValidAdminKey } = await import(
            "@/lib/server/db-auth.server"
          );
          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");

          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`cf-autoconfig:${ip}`, 10, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              {
                status: 429,
                headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" },
              },
            );
          }

          const isAdminKey = hasValidAdminKey(request);
          const claims = isAdminKey ? null : await readMasterSsoFromRequest(request);
          if (!isAdminKey && !claims) {
            return Response.json(
              { ok: false, error: "Authentication required to configure Cloudflare DNS." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const payload = (await request.json().catch(() => null)) as {
            mode?: "configure" | "rollback";
            apiToken?: string;
            domain?: string;
            verifyToken?: string;
            replaceExistingA?: boolean;
            includeWww?: boolean;
            restoreRecords?: ReplacedDnsBackup[];
          } | null;

          const apiToken = String(payload?.apiToken || "").trim();
          const domain = normalizeCloudflareDomain(String(payload?.domain || ""));
          const verifyToken = String(payload?.verifyToken || "").trim();
          // HARDENED DEFAULT: never overwrite live customer A/AAAA records unless explicitly opted in
          const replaceExistingA = payload?.replaceExistingA === true;
          const includeWww = Boolean(payload?.includeWww);

          if (!apiToken || apiToken.length < 20) {
            return Response.json(
              {
                ok: false,
                error: "Please paste a valid Cloudflare API Token with Zone → DNS → Edit permission.",
              },
              { status: 400 },
            );
          }

          if (!isSafePublicDomain(domain)) {
            return Response.json(
              { ok: false, error: "Invalid public domain name." },
              { status: 400 },
            );
          }

          const zone = await findMatchingZone(apiToken, domain);
          if (!zone) {
            return Response.json(
              {
                ok: false,
                error: `Domain "${domain}" was not found in your Cloudflare account, or your API token does not have access to this zone. Make sure the token includes Zone → Zone → Read and Zone → DNS → Edit.`,
              },
              { status: 404 },
            );
          }

          // 1-Click Emergency Rollback mode: deletes CNAME and restores previous A/AAAA records
          if (payload?.mode === "rollback" && Array.isArray(payload.restoreRecords)) {
            const restored: ReplacedDnsBackup[] = [];
            for (const rec of payload.restoreRecords) {
              const targetName = normalizeCloudflareDomain(rec.name);
              const existingRes = await cfRequest<CloudflareDnsRecord[]>(
                apiToken,
                `/zones/${encodeURIComponent(zone.id)}/dns_records?type=CNAME&name=${encodeURIComponent(targetName)}`,
              );
              for (const cname of existingRes.result) {
                await cfRequest<{ id: string }>(
                  apiToken,
                  `/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(cname.id)}`,
                  { method: "DELETE" },
                );
              }
              await cfRequest<CloudflareDnsRecord>(
                apiToken,
                `/zones/${encodeURIComponent(zone.id)}/dns_records`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    type: rec.type,
                    name: targetName,
                    content: rec.content,
                    ttl: 1,
                    proxied: Boolean(rec.proxied),
                  }),
                },
              );
              restored.push(rec);
            }
            return Response.json({ ok: true, restored });
          }

          if (!VALID_VERIFY_TOKEN_RE.test(verifyToken)) {
            return Response.json(
              { ok: false, error: "Invalid verification token format." },
              { status: 400 },
            );
          }

          // Always safe: create/update TXT ownership record first (zero downtime impact)
          const txtHost = `_sparrowx-verify.${domain}`;
          const txtResult = await upsertDnsRecord({
            apiToken,
            zoneId: zone.id,
            type: "TXT",
            name: txtHost,
            content: verifyToken,
            ttl: 120,
          });

          const actions: Array<{
            type: "TXT" | "CNAME";
            name: string;
            target: string;
            status: "created" | "updated" | "skipped_safe_mode";
            proxied: boolean;
          }> = [
            {
              type: "TXT",
              name: txtHost,
              target: verifyToken,
              status: txtResult.status,
              proxied: false,
            },
          ];

          // SAFETY GUARD 1: Never point SparrowX's own apex/platform hosts to a circular CNAME
          if (isProtectedPlatformHost(domain)) {
            return Response.json(
              {
                ok: true,
                zone: { id: zone.id, name: zone.name },
                actions,
                replacedRecords: [],
                safetyNotice: `${domain} is already hosted directly on SparrowX Edge. Verified TXT ownership safely without modifying its A record.`,
              },
              { status: 200, headers: { "Cache-Control": "no-store" } },
            );
          }

          // SAFETY GUARD 2: Pre-flight verify edge.sparrowx.net resolves BEFORE any CNAME cutover!
          if (replaceExistingA) {
            const edgeCheck = await verifyEdgeTargetResolvable(EDGE_CNAME_TARGET);
            if (!edgeCheck.healthy) {
              return Response.json(
                {
                  ok: false,
                  error: `Zero-Downtime Safety Guard blocked CNAME cutover: ${edgeCheck.reason} Your existing A/AAAA records were NOT touched (TXT verification record was still added safely).`,
                  actions,
                },
                { status: 503, headers: { "Cache-Control": "no-store" } },
              );
            }
          }

          const cnameResult = await upsertDnsRecord({
            apiToken,
            zoneId: zone.id,
            type: "CNAME",
            name: domain,
            content: EDGE_CNAME_TARGET,
            ttl: 1,
            proxied: false,
            replaceExistingA,
          });

          actions.push({
            type: "CNAME",
            name: domain,
            target: EDGE_CNAME_TARGET,
            status: cnameResult.status,
            proxied: false,
          });

          const replacedRecords: ReplacedDnsBackup[] = [...cnameResult.replacedRecords];

          if (includeWww && domain === zone.name.toLowerCase() && !domain.startsWith("www.")) {
            const wwwHost = `www.${domain}`;
            const wwwResult = await upsertDnsRecord({
              apiToken,
              zoneId: zone.id,
              type: "CNAME",
              name: wwwHost,
              content: EDGE_CNAME_TARGET,
              ttl: 1,
              proxied: false,
              replaceExistingA,
            });
            actions.push({
              type: "CNAME",
              name: wwwHost,
              target: EDGE_CNAME_TARGET,
              status: wwwResult.status,
              proxied: false,
            });
            replacedRecords.push(...wwwResult.replacedRecords);
          }

          const safetyNotice =
            cnameResult.status === "skipped_safe_mode"
              ? `Zero-Downtime Safe Mode: Verified TXT ownership without overwriting ${domain}'s live A/AAAA record. Your website stayed 100% online. Use the 1-line Edge Script or enable CNAME cutover once origin routing is tested.`
              : undefined;

          return Response.json(
            {
              ok: true,
              zone: { id: zone.id, name: zone.name },
              actions,
              replacedRecords,
              ...(safetyNotice ? { safetyNotice } : {}),
            },
            {
              status: 200,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to configure DNS records via Cloudflare API.";
          return Response.json(
            { ok: false, error: message },
            { status: 502, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
