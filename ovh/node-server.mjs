import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import serverModule from "../.output/server/index.mjs";

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

const server = createServer(async (req, res) => {
  try {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];

    // 1. Serve static files from .output/public if they exist
    if (req.method === "GET" || req.method === "HEAD") {
      const safePath = join(PUBLIC_DIR, pathname.replace(/^\/+/, ""));
      if (safePath.startsWith(PUBLIC_DIR) && pathname !== "/") {
        try {
          const info = await stat(safePath);
          if (info.isFile()) {
            const ext = extname(safePath).toLowerCase();
            const content = await readFile(safePath);
            res.writeHead(200, {
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
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
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

    const resHeaders = {};
    webResponse.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    res.writeHead(webResponse.status, resHeaders);
    const arrayBuf = await webResponse.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  } catch (err) {
    console.error("[SparrowX OVH Node Server Error]", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error", detail: String(err) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[SparrowX Sovereign Server] Listening on http://${HOST}:${PORT} (Self-Hosted OVH Mode)`,
  );
});
