import { createFileRoute } from "@tanstack/react-router";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const EDGE_CNAME_TARGET = "edge.sparrowx.net";
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

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

function isSafePublicDomain(host: string): boolean {
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

async function cfRequest<T>(
  apiToken: string,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareApiResponse<T>> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
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
  // Walk up from full domain to apex (e.g. sub.example.co.in -> example.co.in -> co.in)
  for (let i = 0; i <= labels.length - 2; i += 1) {
    const candidate = labels.slice(i).join(".");
    const res = await cfRequest<CloudflareZone[]>(
      apiToken,
      `/zones?name=${encodeURIComponent(candidate)}&per_page=5`,
    );
    const active = res.result.find((z) => z.name.toLowerCase() === candidate && z.status === "active")
      ?? res.result.find((z) => z.name.toLowerCase() === candidate);
    if (active) return active;
  }

  // Fallback: list accessible zones in token scope and find longest domain suffix match
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
  status: "created" | "updated";
  record: CloudflareDnsRecord;
  replacedRecords: Array<{ type: string; name: string; content: string; proxied?: boolean }>;
}> {
  const { apiToken, zoneId, type, name, content, ttl, proxied, replaceExistingA } = params;
  const replacedRecords: Array<{ type: string; name: string; content: string; proxied?: boolean }> = [];

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
    if (!replaceExistingA) {
      throw new Error(
        `Existing ${conflictingAddr.map((r) => `${r.type} (${r.content})`).join(", ")} record found on ${name}. Enable "Replace existing A/AAAA record" or remove it manually in Cloudflare first.`,
      );
    }

    // Back up existing A/AAAA records before removing them so we can roll back if CNAME creation fails
    for (const rec of conflictingAddr) {
      replacedRecords.push({
        type: rec.type,
        name: rec.name,
        content: rec.content,
        proxied: rec.proxied,
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
      // Transactional rollback: restore deleted A/AAAA records
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
          const payload = (await request.json().catch(() => null)) as {
            apiToken?: string;
            domain?: string;
            verifyToken?: string;
            replaceExistingA?: boolean;
            includeWww?: boolean;
          } | null;

          const apiToken = String(payload?.apiToken || "").trim();
          const domain = normalizeDomain(String(payload?.domain || ""));
          const verifyToken = String(payload?.verifyToken || "").trim();
          const replaceExistingA = payload?.replaceExistingA !== false;
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

          if (!VALID_VERIFY_TOKEN_RE.test(verifyToken)) {
            return Response.json(
              { ok: false, error: "Invalid verification token format." },
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

          const txtHost = `_sparrowx-verify.${domain}`;
          const txtResult = await upsertDnsRecord({
            apiToken,
            zoneId: zone.id,
            type: "TXT",
            name: txtHost,
            content: verifyToken,
            ttl: 120,
          });

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

          const actions: Array<{
            type: "TXT" | "CNAME";
            name: string;
            target: string;
            status: "created" | "updated";
            proxied: boolean;
          }> = [
            {
              type: "TXT",
              name: txtHost,
              target: verifyToken,
              status: txtResult.status,
              proxied: false,
            },
            {
              type: "CNAME",
              name: domain,
              target: EDGE_CNAME_TARGET,
              status: cnameResult.status,
              proxied: false,
            },
          ];

          const replacedRecords = [...cnameResult.replacedRecords];

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

          return Response.json(
            {
              ok: true,
              zone: { id: zone.id, name: zone.name },
              actions,
              replacedRecords,
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
