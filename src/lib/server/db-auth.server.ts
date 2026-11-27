import { env } from "./config.server";
import { timingSafeEqual } from "./crypto.server";
import { readMasterSsoFromRequest } from "./master-sso.server";
import { getAppSession } from "./session.server";

export interface DbAuthContext {
  authorized: boolean;
  isAdmin: boolean;
  actorId: string;
  actorEmail?: string | undefined;
  tenantId?: string | undefined;
  reason?: string | undefined;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const MAX_RATE_BUCKETS = 10_000;

function isLoopbackRequest(request: Request): boolean {
  try {
    const reqHost = new URL(request.url).hostname.toLowerCase();
    const hdrHost = (request.headers.get("host") || "").split(":")[0]?.toLowerCase() || "";
    const effective = hdrHost || reqHost;
    return effective === "localhost" || effective === "127.0.0.1" || effective === "::1" || effective === "[::1]";
  } catch {
    return false;
  }
}

export function extractClientIp(request: Request): string {
  // Only trust CF-Connecting-IP when explicitly configured behind Cloudflare proxy;
  // otherwise prefer X-Real-IP set authoritatively by Nginx $remote_addr to prevent rate-limit spoofing.
  const trustCf = env("SPARROWX_TRUST_CLOUDFLARE") === "true";
  const cfIp = request.headers.get("cf-connecting-ip");
  if (trustCf && cfIp?.trim()) return cfIp.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  if (cfIp?.trim()) return cfIp.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }
  return "127.0.0.1";
}

export function checkDbRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (rateBuckets.size > 2000) {
    for (const [bucketKey, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    if (rateBuckets.size > MAX_RATE_BUCKETS) {
      const firstKey = rateBuckets.keys().next().value;
      if (firstKey !== undefined) rateBuckets.delete(firstKey);
    }
  }
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function hasValidAdminKey(request: Request): boolean {
  const configured = env("SPARROWX_ADMIN_API_KEY") || env("SPARROWX_SERVICE_KEY");
  if (!configured) return false;

  const headerKey = (request.headers.get("x-sparrowx-admin-key") || "").trim();
  const authHeader = (request.headers.get("authorization") || "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (headerKey && timingSafeEqual(headerKey, configured)) return true;
  if (bearer && timingSafeEqual(bearer, configured)) return true;
  return false;
}

export async function authorizeDbRequest(
  request: Request,
  options?: {
    requireAdmin?: boolean;
    targetTenantId?: string;
    targetEmail?: string;
  },
): Promise<DbAuthContext> {
  if (hasValidAdminKey(request)) {
    return {
      authorized: true,
      isAdmin: true,
      actorId: "sparrowx-admin",
      tenantId: options?.targetTenantId,
      actorEmail: options?.targetEmail,
    };
  }

  const masterSso = await readMasterSsoFromRequest(request).catch(() => null);

  if (options?.requireAdmin) {
    if (masterSso && masterSso.role === "admin") {
      return {
        authorized: true,
        isAdmin: true,
        actorId: masterSso.sub,
        actorEmail: masterSso.email,
        tenantId: masterSso.tenantId ?? undefined,
      };
    }
    const configured = env("SPARROWX_ADMIN_API_KEY") || env("SPARROWX_SERVICE_KEY");
    // Only allow unauthenticated admin inspection on non-production loopback dev without a configured admin key.
    if (process.env.NODE_ENV === "production" || configured || !isLoopbackRequest(request)) {
      return {
        authorized: false,
        isAdmin: false,
        actorId: "anonymous",
        reason: "Admin API key required (x-sparrowx-admin-key)",
      };
    }
    return {
      authorized: true,
      isAdmin: true,
      actorId: "local-dev-admin",
    };
  }

  if (masterSso) {
    const isAdmin = masterSso.role === "admin";
    if (!isAdmin) {
      if (
        options?.targetEmail &&
        options.targetEmail.trim().toLowerCase() !== masterSso.email.trim().toLowerCase()
      ) {
        return {
          authorized: false,
          isAdmin: false,
          actorId: masterSso.sub,
          reason: "Forbidden: target email does not match authenticated Master SSO account.",
        };
      }
      if (
        options?.targetTenantId &&
        masterSso.tenantId &&
        options.targetTenantId.trim() !== masterSso.tenantId.trim()
      ) {
        return {
          authorized: false,
          isAdmin: false,
          actorId: masterSso.sub,
          reason: "Forbidden: target tenant does not match authenticated Master SSO tenant.",
        };
      }
    }
    const resolvedTenantId = isAdmin
      ? options?.targetTenantId ?? masterSso.tenantId ?? undefined
      : masterSso.tenantId ?? undefined;
    return {
      authorized: true,
      isAdmin,
      actorId: masterSso.sub,
      actorEmail: masterSso.email,
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
    };
  }

  const session = await getAppSession().catch(() => null);
  const sessionEmail = session?.data?.demo?.email || undefined;
  const sessionUserId = session?.data?.clientId || session?.data?.discordId || undefined;

  if (sessionUserId) {
    if (
      sessionEmail &&
      options?.targetEmail &&
      options.targetEmail.trim().toLowerCase() !== sessionEmail.trim().toLowerCase()
    ) {
      return {
        authorized: false,
        isAdmin: false,
        actorId: sessionUserId,
        reason: "Forbidden: target email does not match authenticated session.",
      };
    }
    return {
      authorized: true,
      isAdmin: false,
      actorId: sessionUserId,
      actorEmail: sessionEmail,
    };
  }

  // Fail closed in production (never allow env override to disable auth in production).
  const strictFlag = env("SPARROWX_STRICT_DB_AUTH");
  const isLocalDevOverride =
    process.env.NODE_ENV !== "production" &&
    (strictFlag === "false" || (strictFlag !== "true" && isLoopbackRequest(request)));

  if (!isLocalDevOverride) {
    return {
      authorized: false,
      isAdmin: false,
      actorId: "anonymous",
      reason: "Authentication required for SparrowX DB API",
    };
  }

  return {
    authorized: true,
    isAdmin: false,
    actorId: options?.targetEmail || options?.targetTenantId || "studio-user",
    actorEmail: options?.targetEmail,
    tenantId: options?.targetTenantId,
  };
}
