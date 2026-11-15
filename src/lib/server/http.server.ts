/**
 * HTTP helpers for server API routes and auth redirects.
 */

/**
 * Returns a 302 redirect Response with MUTABLE headers so H3/Nitro can merge
 * `Set-Cookie` headers written by `useSession().update(...)` without throwing
 * `TypeError: immutable` (which `Response.redirect()` causes).
 */
export function redirect302(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Resolves the external request origin, honoring reverse-proxy headers
 * (`X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`) when present.
 */
export function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim();

  if (forwardedHost && /^[a-z0-9.-]+(:\d+)?$/i.test(forwardedHost)) {
    const proto = forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}

/**
 * Validates that an internal redirect path is a safe relative path (prevents open redirects).
 */
export function sanitizeRelativePath(nextPath: string | null | undefined, fallback = "/"): string {
  if (!nextPath) return fallback;
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}
