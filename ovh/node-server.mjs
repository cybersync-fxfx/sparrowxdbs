import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import serverModule from "../.output/server/index.mjs";
import { migrateCloudSupabaseToLocal } from "./migrate-from-supabase.mjs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
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

const server = createServer(async (req, res) => {
  try {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];

    // Block hidden dotfile probes (/.env, /.git, etc.) except .well-known
    if (pathname.startsWith("/.") && !pathname.startsWith("/.well-known")) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Forbidden: dotfile access denied by SparrowX WAF" }));
      return;
    }

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
    const host = req.headers.host || `${HOST}:${PORT}`;
    const fullUrl = `${protocol}://${host}${reqUrl}`;

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
  } catch (err) {
    console.error("[SparrowX OVH Node Server Error]", err);
    res.writeHead(500, { "Content-Type": "application/json", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "Internal Server Error", detail: String(err) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[SparrowX Sovereign Server] Listening on http://${HOST}:${PORT} (Self-Hosted OVH Mode)`,
  );
  // Automatically shift/sync existing cloud Supabase records into local OVH DB on boot
  migrateCloudSupabaseToLocal().catch(() => {});
});
