import { z } from "zod";

/**
 * Reserved subdomain slugs that customers are strictly forbidden from registering
 * on *.ai.sparrowx.net, *.deploy.sparrowx.net, or any SparrowX tenant namespace.
 */
export const RESERVED_SUBDOMAINS = new Set<string>([
  "www",
  "api",
  "admin",
  "console",
  "panel",
  "db",
  "sec",
  "dpdp",
  "ingest",
  "file",
  "password",
  "ai",
  "deploy",
  "agents",
  "mail",
  "smtp",
  "status",
  "auth",
  "billing",
  "support",
  "sparrowx",
  "root",
  "system",
  "game",
  "infra",
  "netsec",
  "gamesec",
  "php",
]);

/**
 * Strict tenant slug pattern:
 * - Lowercase ASCII alphanumeric + internal hyphens only
 * - Must start and end with [a-z0-9]
 * - Total length between 4 and 32 characters
 */
export const TENANT_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/;

export const tenantSlugSchema = z
  .string()
  .trim()
  .regex(
    TENANT_SLUG_REGEX,
    "Subdomain slug must be 4–32 characters, lowercase letters/numbers/hyphens, starting and ending with a letter or digit",
  )
  .refine(
    (slug) => !RESERVED_SUBDOMAINS.has(slug),
    "This subdomain name is reserved by SparrowX Technologies",
  );

export type TenantSlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export function validateTenantSlug(rawSlug: string): TenantSlugValidationResult {
  const parsed = tenantSlugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid subdomain slug",
    };
  }
  return { ok: true, slug: parsed.data };
}

/**
 * Allowed CORS origins for api.sparrowx.net.
 * Wildcard '*' is NEVER allowed with credentials, and customer tenant subdomains
 * (*.ai.sparrowx.net, *.deploy.sparrowx.net) are strictly excluded.
 */
export const API_ALLOWED_ORIGINS = new Set<string>([
  "https://console.sparrowx.net",
  "https://admin.sparrowx.net",
]);

export function resolveApiCorsHeaders(
  origin: string | null | undefined,
): Record<string, string> | null {
  if (!origin) return null;
  const clean = origin.trim();
  if (!API_ALLOWED_ORIGINS.has(clean)) return null;
  return {
    "Access-Control-Allow-Origin": clean,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Requested-With, X-CSRF-Token, X-SparrowX-API-Key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/**
 * Builds a strict `__Host-` prefixed session cookie for console.sparrowx.net
 * and admin.sparrowx.net.
 *
 * Security invariants guaranteed by the `__Host-` prefix specification:
 *  - Must begin with `__Host-`
 *  - Must include `Secure` and `HttpOnly`
 *  - Must include `Path=/`
 *  - Must NEVER include a `Domain=` attribute (prevents cookie leakage to *.ai.sparrowx.net / *.deploy.sparrowx.net)
 */
export function buildHostOnlySessionCookie(
  cookieName: string,
  value: string,
  options?: {
    maxAgeSeconds?: number;
    sameSite?: "Lax" | "Strict";
  },
): string {
  const normalizedName = cookieName.startsWith("__Host-")
    ? cookieName
    : `__Host-${cookieName.replace(/^_+/, "")}`;
  const maxAge = options?.maxAgeSeconds ?? 60 * 60 * 24 * 7; // 7 days
  const sameSite = options?.sameSite ?? "Lax";

  return [
    `${normalizedName}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    "HttpOnly",
    "Secure",
    `SameSite=${sameSite}`,
  ].join("; ");
}

/**
 * Determines whether a hostname must carry `X-Robots-Tag: noindex, nofollow`.
 */
export function isNoIndexHost(rawHost: string): boolean {
  const host = rawHost.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!host) return true;
  if (
    host === "console.sparrowx.net" ||
    host === "admin.sparrowx.net" ||
    host === "panel.sparrowx.net" ||
    host === "api.sparrowx.net" ||
    host === "ingest.sec.sparrowx.net" ||
    host === "ingest.dpdp.sparrowx.net" ||
    host === "php.sparrowx.net"
  ) {
    return true;
  }
  if (host.endsWith(".ai.sparrowx.net") || host.endsWith(".deploy.sparrowx.net")) {
    return true;
  }
  return false;
}

export type TenantRoutingZone = "ai" | "deploy";

/**
 * Generates validated Coolify / Traefik v3 container labels for isolated tenant workloads
 * under `<slug>.ai.sparrowx.net` or `<slug>.deploy.sparrowx.net`.
 */
export function buildCoolifyTenantTraefikLabels(
  zone: TenantRoutingZone,
  rawSlug: string,
  containerPort = 3000,
): Record<string, string> {
  const check = validateTenantSlug(rawSlug);
  if (!check.ok) {
    throw new Error(`Rejected tenant slug "${rawSlug}": ${check.error}`);
  }
  const routerName = `tenant-${zone}-${check.slug}`;
  const fqdn = `${check.slug}.${zone}.sparrowx.net`;

  return {
    "traefik.enable": "true",
    "traefik.docker.network": "sparrowx_net",
    [`traefik.http.routers.${routerName}.rule`]: `Host(\`${fqdn}\`)`,
    [`traefik.http.routers.${routerName}.entrypoints`]: "websecure",
    [`traefik.http.routers.${routerName}.tls`]: "true",
    [`traefik.http.routers.${routerName}.tls.certresolver`]: "letsencrypt",
    [`traefik.http.routers.${routerName}.middlewares`]:
      "tenant-security-headers@file,noindex@file,streaming-headers@file",
    [`traefik.http.services.${routerName}.loadbalancer.server.port`]:
      String(containerPort),
    [`traefik.http.services.${routerName}.loadbalancer.responseforwarding.flushinterval`]:
      "-1",
  };
}
