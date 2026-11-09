import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import serverModule from "../.output/server/index.mjs";
import { migrateCloudSupabaseToLocal } from "./migrate-from-supabase.mjs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const POSTGREST_HOST = process.env.POSTGREST_HOST || "sparrowx-postgrest";
const POSTGREST_PORT = Number(process.env.POSTGREST_PORT || 3000);
const PUBLIC_DIR = resolve(process.cwd(), ".output/public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const handler = serverModule?.default ?? serverModule;

const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB hard cap against memory exhaustion

/**
 * Forwards API requests directly to the internal PostgREST container.
 * This allows Nginx Proxy Manager to forward api.sparrowx.net to port 80 alongside sec and db!
 */
function forwardToPostgrest(req, res, targetPath, fallbackFn) {
  const cleanHeaders = { ...req.headers };
  delete cleanHeaders.host;

  const options = {
    hostname: POSTGREST_HOST,
    port: POSTGREST_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      ...cleanHeaders,
      host: `${POSTGREST_HOST}:${POSTGREST_PORT}`,
      "x-forwarded-for": req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1",
      "x-forwarded-proto": req.headers["x-forwarded-proto"] || "http",
    },
  };

  const proxyReq = httpRequest(options, (proxyRes) => {
    const resHeaders = {
      ...proxyRes.headers,
      ...SECURITY_HEADERS,
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    res.writeHead(proxyRes.statusCode || 200, resHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.warn(`[PostgREST Gateway Note] PostgREST (${POSTGREST_HOST}:${POSTGREST_PORT}) not ready: ${err.message}. Falling back to internal engine.`);
    if (fallbackFn) {
      fallbackFn();
    } else if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({
        error: "PostgREST Gateway Starting",
        detail: "PostgREST container is warming up. Please retry in a few seconds."
      }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = createServer(async (req, res) => {
  try {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];

    // CORS preflight handling
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        ...SECURITY_HEADERS,
      });
      res.end();
      return;
    }

    // Block hidden dotfile probes (/.env, /.git, etc.) except .well-known
    if (pathname.startsWith("/.") && !pathname.startsWith("/.well-known")) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Forbidden: dotfile access denied by SparrowX WAF" }));
      return;
    }

    const rawHost = req.headers.host || `${HOST}:${PORT}`;
    const host = rawHost.split(":")[0].toLowerCase();
    const isApiHost = host.startsWith("api.") || host.startsWith("api-");
    const isRestPath = pathname.startsWith("/rest/v1");

    // Unified SSR / internal handler fallback helper
    const handleViaAppEngine = async () => {
      // 1. Serve static files from .output/public if they exist
      if (req.method === "GET" || req.method === "HEAD") {
        const safePath = resolve(PUBLIC_DIR, pathname.replace(/^\/+/, ""));
        if (safePath.startsWith(PUBLIC_DIR) && pathname !== "/") {
          try {
            const info = await stat(safePath);
            if (info.isFile()) {
              const ext = extname(safePath).toLowerCase();
              const content = await readFile(safePath);
              res.writeHead(200, {
                ...SECURITY_HEADERS,
                "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
                "Content-Length": content.byteLength,
                "Cache-Control": pathname.startsWith("/assets/")
                  ? "public, max-age=31536000, immutable"
                  : "public, max-age=3600",
              });
              res.end(req.method === "HEAD" ? undefined : content);
              return;
            }
          } catch {
            // Not a static file, continue to SSR / API handler
          }
        }
      }

      // 2. Construct Web Fetch Request for Nitro / TanStack Start + SparrowX API
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const fullUrl = `${protocol}://${rawHost}${reqUrl}`;

      const chunks = [];
      let totalBytes = 0;
      for await (const chunk of req) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        totalBytes += buf.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify({ error: "Payload Too Large" }));
          return;
        }
        chunks.push(buf);
      }
      const bodyBuffer = Buffer.concat(chunks);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else if (typeof value === "string") {
          headers.set(key, value);
        }
      }

      const webRequest = new Request(fullUrl, {
        method: req.method || "GET",
        headers,
        body:
          req.method !== "GET" && req.method !== "HEAD" && bodyBuffer.byteLength > 0
            ? bodyBuffer
            : undefined,
      });

      const ctx = {
        waitUntil: (promise) => {
          Promise.resolve(promise).catch((err) => console.error("[waitUntil error]", err));
        },
      };

      const webResponse = await handler.fetch(webRequest, process.env, ctx);

      const resHeaders = { ...SECURITY_HEADERS };
      webResponse.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      res.writeHead(webResponse.status, resHeaders);
      const arrayBuf = await webResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    };

    // 3. Port 80 Unified Routing: Forward api.sparrowx.net or /rest/v1 to PostgREST
    // Exclude health routes so monitoring gets instant response
    // If a human visits api.sparrowx.net in a browser (text/html), render the interactive API Gateway Explorer UI
    const isHealthRoute = pathname === "/health" || pathname === "/api/health" || pathname === "/api/v1/health";
    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    const isBrowserNavigationToApiHome = isApiHost && acceptsHtml && (pathname === "/" || pathname === "/docs");

    if (!isHealthRoute && !isBrowserNavigationToApiHome && (isApiHost || isRestPath)) {
      let targetPath = reqUrl;
      if (isRestPath) {
        targetPath = reqUrl.replace(/^\/rest\/v1/, "") || "/";
      }
      forwardToPostgrest(req, res, targetPath, handleViaAppEngine);
      return;
    }

    // 4. Default: Render SparrowX Security or Sovereign DB platform based on hostname
    await handleViaAppEngine();
  } catch (err) {
    console.error("[SparrowX Sovereign Server Error]", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Internal Server Error", detail: String(err) }));
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[SparrowX Sovereign Server] Listening on http://${HOST}:${PORT} (Self-Hosted OVH Mode)`,
  );
  // Automatically shift/sync existing cloud Supabase records into local OVH DB on boot
  migrateCloudSupabaseToLocal().catch(() => {});
});
