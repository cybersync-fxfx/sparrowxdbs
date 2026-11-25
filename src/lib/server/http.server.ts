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
 * Resolves the external request origin safely against Host Header Injection.
 * Only honors reverse-proxy headers for allowlisted SparrowX / loopback hosts.
 */
function isAllowedOriginHost(rawHost: string): boolean {
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(rawHost)) return false;
  const hostname = rawHost.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "sparrowx.net" ||
    hostname.endsWith(".sparrowx.net") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

export function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim();

  if (forwardedHost && isAllowedOriginHost(forwardedHost)) {
    const isLocal =
      forwardedHost.toLowerCase().startsWith("localhost") ||
      forwardedHost.toLowerCase().startsWith("127.0.0.1");
    const proto =
      forwardedProto === "https" || (forwardedProto === "http" && isLocal)
        ? forwardedProto
        : isLocal
          ? url.protocol.replace(":", "")
          : "https";
    return `${proto}://${forwardedHost}`;
  }
  if (isAllowedOriginHost(url.host)) {
    return url.origin;
  }
  return "https://sparrowx.net";
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
