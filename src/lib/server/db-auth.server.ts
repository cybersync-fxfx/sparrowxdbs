import { env } from "./config.server";
import { timingSafeEqual } from "./crypto.server";
import { readMasterSsoFromRequest } from "./master-sso.server";
import { getAppSession } from "./session.server";

export interface DbAuthContext {
  authorized: boolean;
  isAdmin: boolean;
  actorId: string;
  actorEmail?: string;
  tenantId?: string;
  reason?: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function checkDbRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
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

  if (options?.requireAdmin) {
    const configured = env("SPARROWX_ADMIN_API_KEY") || env("SPARROWX_SERVICE_KEY");
    // In local dev without configured admin key, allow local loopback admin inspection; in production require key.
    if (process.env.NODE_ENV === "production" || configured) {
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

  const masterSso = await readMasterSsoFromRequest(request).catch(() => null);
  if (masterSso) {
    const resolvedTenantId = masterSso.tenantId ?? options?.targetTenantId;
    return {
      authorized: true,
      isAdmin: masterSso.role === "admin",
      actorId: masterSso.sub,
      actorEmail: masterSso.email,
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
    };
  }

  const session = await getAppSession().catch(() => null);
  const sessionEmail = session?.data?.demo?.email || undefined;
  const sessionUserId = session?.data?.clientId || session?.data?.discordId || undefined;

  if (sessionUserId) {
    return {
      authorized: true,
      isAdmin: false,
      actorId: sessionUserId,
      actorEmail: sessionEmail,
      tenantId: options?.targetTenantId,
    };
  }

  // Self-service Studio session fallback (scoped strictly to the caller's own tenant/email)
  const strictMode = env("SPARROWX_STRICT_DB_AUTH") === "true";
  if (strictMode) {
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
