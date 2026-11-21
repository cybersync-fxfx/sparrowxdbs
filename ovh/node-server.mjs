import { createServer, request as httpRequest } from "node:http";
import { readFile, stat, writeFile, mkdir, unlink } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import serverModule from "../.output/server/index.mjs";
import { migrateCloudSupabaseToLocal } from "./migrate-from-supabase.mjs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const POSTGREST_HOST = process.env.POSTGREST_HOST || "sparrowx-postgrest";
const POSTGREST_PORT = Number(process.env.POSTGREST_PORT || 3001);
const PUBLIC_DIR = resolve(process.cwd(), ".output/public");
const STORAGE_DIR = resolve(process.cwd(), "data/storage");
const STORAGE_INDEX_FILE = resolve(STORAGE_DIR, "index.json");
const SAFE_STORAGE_ID_RE = /^[a-zA-Z0-9_-]{3,96}$/;
const MAX_EPHEMERAL_DROPS = 500;
const MAX_STORAGE_FILE_BYTES = 100 * 1024 * 1024;

let storageIndexQueue = Promise.resolve();
function withStorageLock(fn) {
  const run = storageIndexQueue.then(fn, fn);
  storageIndexQueue = run.catch(() => {});
  return run;
}

function resolveSafeStoragePath(fileId) {
  if (!SAFE_STORAGE_ID_RE.test(fileId) || fileId === "index" || fileId === "metadata") {
    return null;
  }
  const candidate = resolve(STORAGE_DIR, fileId);
  const basePrefix = STORAGE_DIR.endsWith(sep) ? STORAGE_DIR : `${STORAGE_DIR}${sep}`;
  if (!candidate.startsWith(basePrefix)) {
    return null;
  }
  return candidate;
}

// Ensure persistent storage directory and index file exist
async function ensureStorageDir() {
  await mkdir(STORAGE_DIR, { recursive: true }).catch(() => {});
  try {
    await stat(STORAGE_INDEX_FILE);
  } catch {
    await writeFile(STORAGE_INDEX_FILE, JSON.stringify([], null, 2));
  }
}
ensureStorageDir().catch(() => {});

async function getStoredFiles() {
  try {
    const raw = await readFile(STORAGE_INDEX_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStoredFiles(files) {
  await writeFile(STORAGE_INDEX_FILE, JSON.stringify(files, null, 2));
}

// In-Memory Ephemeral Drop Store (15-min RAM Burn, Zero Disk)
const ephemeralDropStore = new Map();

function storeEphemeralDrop(id, payload) {
  const now = Date.now();
  if (!ephemeralDropStore.has(id) && ephemeralDropStore.size >= MAX_EPHEMERAL_DROPS) {
    for (const [k, v] of ephemeralDropStore.entries()) {
      if (v.expiresAt <= now) {
        if (v.timer) clearTimeout(v.timer);
        ephemeralDropStore.delete(k);
      }
    }
    while (ephemeralDropStore.size >= MAX_EPHEMERAL_DROPS) {
      const oldestKey = ephemeralDropStore.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = ephemeralDropStore.get(oldestKey);
      if (oldest?.timer) clearTimeout(oldest.timer);
      ephemeralDropStore.delete(oldestKey);
    }
  }

  const existing = ephemeralDropStore.get(id);
  if (existing && existing.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    ephemeralDropStore.delete(id);
  }, 15 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();

  ephemeralDropStore.set(id, {
    ...payload,
    expiresAt: now + 15 * 60 * 1000,
    timer,
  });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".sh": "text/x-shellscript; charset=utf-8",
  ".c": "text/x-c; charset=utf-8",
  ".conf": "text/plain; charset=utf-8",
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
  "Content-Security-Policy":
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-ancestors 'self'; base-uri 'self'",
  "X-SparrowX-WAF": "ACTIVE",
  "X-SparrowX-Shield": "PROTECTED",
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
    console.warn(
      `[PostgREST Gateway Note] PostgREST (${POSTGREST_HOST}:${POSTGREST_PORT}) not ready: ${err.message}. Falling back to internal engine.`,
    );
    if (fallbackFn) {
      fallbackFn();
    } else if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(
        JSON.stringify({
          error: "PostgREST Gateway Starting",
          detail: "PostgREST container is warming up. Please retry in a few seconds.",
        }),
      );
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = createServer(async (req, res) => {
  try {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];
    const rawHost = req.headers.host || `${HOST}:${PORT}`;
    const host = rawHost.split(":")[0].toLowerCase();
    const isHealthRoute =
      pathname === "/health" || pathname === "/api/health" || pathname === "/api/v1/health";

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

    // Block hidden dotfile probes (/.env, /api/.git, etc.) except .well-known
    if (/(?:^|\/)\.(?!well-known(?:\/|$))/i.test(pathname)) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Forbidden: dotfile access denied by SparrowX WAF" }));
      return;
    }

    // Block null-byte / path-traversal / raw exploit probes at edge
    const rawUrl = req.url || "/";
    if (
      rawUrl.includes("%00") ||
      rawUrl.includes("\0") ||
      /(?:^|[\\/]|%2f|%5c)(?:\.\.|%2e%2e)(?:[\\/]|%2f|%5c|$)/i.test(rawUrl) ||
      /(?:\.\.[/\\]|%2e%2e(?:%2f|%5c|\/)|\.{2}(?:%2f|%5c))/i.test(rawUrl)
    ) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Blocked: malicious path traversal payload rejected by SparrowX WAF" }));
      return;
    }

    // Fast-path <1ms health check before SSR / upstream checks
    if (isHealthRoute && (req.method === "GET" || req.method === "HEAD")) {
      const payload = JSON.stringify({
        status: "healthy",
        service: "SparrowX Autonomous Edge Shield",
        version: "2.4.0",
        domain: process.env.SPARROWX_DOMAIN || host,
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...SECURITY_HEADERS,
      });
      res.end(req.method === "HEAD" ? undefined : payload);
      return;
    }

    // =========================================================================
    // 1. CRITICAL: SERVE STATIC ASSETS (.css, .js, .png, etc.) FOR ALL DOMAINS
    // This MUST run before any API proxying, so api.sparrowx.net loads styles & scripts!
    // =========================================================================
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
          // Not a static file on disk, continue to router / API handler
        }
      }
    }

    // =========================================================================
    // EPHEMERAL ZERO-DISK DROP RELAY (15-MINUTE RAM CACHE)
    // =========================================================================
    // 1. Post encrypted payload into RAM: POST /api/drop/payload/:id or POST /api/drop/payload
    const dropUploadMatch = pathname.match(/^\/api\/drop\/payload(?:\/([a-zA-Z0-9_-]+))?$/);
    if (dropUploadMatch && req.method === "POST") {
      const chunks = [];
      let totalBytes = 0;
      for await (const chunk of req) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        totalBytes += buf.byteLength;
        if (totalBytes > 100 * 1024 * 1024) {
          res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify({ error: "Payload exceeds 100MB RAM limit" }));
          return;
        }
        chunks.push(buf);
      }
      const rawBody = Buffer.concat(chunks);
      try {
        const parsed = JSON.parse(rawBody.toString("utf-8"));
        const rawDropId =
          dropUploadMatch[1] ||
          parsed.id ||
          `spx_drop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const dropId = SAFE_STORAGE_ID_RE.test(String(rawDropId))
          ? String(rawDropId)
          : `spx_drop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        if (parsed.ciphertext) {
          storeEphemeralDrop(dropId, {
            id: dropId,
            ciphertext: parsed.ciphertext,
            filename: parsed.filename || "file",
            type: parsed.type || "application/octet-stream",
            size: parsed.size || 0,
          });

          res.writeHead(201, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            ...SECURITY_HEADERS,
          });
          res.end(JSON.stringify({ success: true, dropId, expiresAt: Date.now() + 15 * 60 * 1000 }));
          return;
        }
      } catch {
        // Ignored
      }
      res.writeHead(400, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Invalid drop payload format" }));
      return;
    }

    // 2. Fetch encrypted payload from RAM: GET /api/drop/payload/:id
    const dropGetMatch = pathname.match(/^\/api\/drop\/payload\/([a-zA-Z0-9_-]+)$/);
    if (dropGetMatch && (req.method === "GET" || req.method === "HEAD")) {
      const dropId = dropGetMatch[1];
      const drop = ephemeralDropStore.get(dropId);
      if (drop) {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...SECURITY_HEADERS,
        });
        res.end(
          req.method === "HEAD"
            ? undefined
            : JSON.stringify({
                id: drop.id,
                ciphertext: drop.ciphertext,
                filename: drop.filename,
                type: drop.type,
                size: drop.size,
                expiresAt: drop.expiresAt,
              })
        );
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Drop expired or not found in RAM" }));
      return;
    }

    // 3. Purge drop from RAM immediately: DELETE /api/drop/payload/:id
    const dropDeleteMatch = pathname.match(/^\/api\/drop\/payload\/([a-zA-Z0-9_-]+)$/);
    if (dropDeleteMatch && req.method === "DELETE") {
      const dropId = dropDeleteMatch[1];
      const drop = ephemeralDropStore.get(dropId);
      if (drop && drop.timer) clearTimeout(drop.timer);
      ephemeralDropStore.delete(dropId);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify({ success: true, purgedId: dropId }));
      return;
    }

    // =========================================================================
    // PERSISTENT STORAGE ENGINE (MEDIAFIRE / FILE STORE ON NVME DISK)
    // =========================================================================
    // 1. Download file by unique ID: /api/storage/download/:id or /f/:id?download=1
    const isApiDownload = pathname.match(/^\/api\/storage\/download\/([a-zA-Z0-9_-]+)/);
    const isDirectF = pathname.match(/^\/f\/([a-zA-Z0-9_-]+)/);
    const storageUrlObj = new URL(reqUrl, "http://localhost");
    const wantsRawDownload =
      isApiDownload ||
      (isDirectF &&
        (storageUrlObj.searchParams.has("download") ||
          storageUrlObj.searchParams.has("raw") ||
          !req.headers.accept?.includes("text/html")));

    if (wantsRawDownload && (req.method === "GET" || req.method === "HEAD")) {
      const fileId = (isApiDownload || isDirectF)[1];
      const filePath = resolveSafeStoragePath(fileId);
      const files = await getStoredFiles();
      const item = files.find((f) => f.id === fileId);
      if (item && filePath) {
        try {
          const content = await readFile(filePath);
          await withStorageLock(async () => {
            const latestFiles = await getStoredFiles();
            const target = latestFiles.find((f) => f.id === fileId);
            if (target) {
              target.downloads = (target.downloads || 0) + 1;
              await saveStoredFiles(latestFiles);
            }
          });

          const rawType = String(item.type || "application/octet-stream");
          const safeType = /html|svg|javascript|ecmascript|xml/i.test(rawType)
            ? "application/octet-stream"
            : rawType;
          const safeFilename = String(item.name || "download")
            .replace(/[\r\n"\\/]/g, "_");

          res.writeHead(200, {
            ...SECURITY_HEADERS,
            "X-Content-Type-Options": "nosniff",
            "Content-Type": safeType,
            "Content-Length": content.byteLength,
            "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(String(item.name || "download"))}`,
            "Access-Control-Allow-Origin": "*",
          });
          res.end(req.method === "HEAD" ? undefined : content);
          return;
        } catch (err) {
          console.warn("[Storage Download Note]", err.message);
        }
      }
    }

    // 2. Fetch single file metadata: GET /api/storage/file/:id
    const singleFileMatch = pathname.match(/^\/api\/storage\/file\/([a-zA-Z0-9_-]+)$/);
    if (singleFileMatch && (req.method === "GET" || req.method === "HEAD")) {
      const fileId = singleFileMatch[1];
      const files = await getStoredFiles();
      const item = files.find((f) => f.id === fileId);
      if (item) {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...SECURITY_HEADERS,
        });
        res.end(JSON.stringify(item));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }

    // 3. List all stored files: GET /api/storage/files
    if (pathname === "/api/storage/files" && req.method === "GET") {
      const files = await getStoredFiles();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(files));
      return;
    }

    // 3. Upload file to persistent disk: POST /api/storage/upload
    if (pathname === "/api/storage/upload" && req.method === "POST") {
      const chunks = [];
      let totalBytes = 0;
      for await (const chunk of req) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        totalBytes += buf.byteLength;
        if (totalBytes > 100 * 1024 * 1024) {
          res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify({ error: "Payload exceeds 100MB limit" }));
          return;
        }
        chunks.push(buf);
      }
      const rawBody = Buffer.concat(chunks);

      try {
        const parsed = JSON.parse(rawBody.toString("utf-8"));
        if (parsed.filename && parsed.base64Data) {
          await mkdir(STORAGE_DIR, { recursive: true }).catch(() => {});
          const fileId = `spx_f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          const safePath = resolveSafeStoragePath(fileId);
          const buffer = Buffer.from(String(parsed.base64Data), "base64");
          if (!safePath || buffer.byteLength > MAX_STORAGE_FILE_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
            res.end(JSON.stringify({ error: "Payload exceeds 100MB limit" }));
            return;
          }
          await writeFile(safePath, buffer);

          const proto = req.headers["x-forwarded-proto"] || "https";
          const fileDomain = host.includes("file.") ? host : "file.sparrowx.net";
          const record = {
            id: fileId,
            name: String(parsed.filename).slice(0, 240),
            size: buffer.byteLength,
            type: String(parsed.type || "application/octet-stream").slice(0, 120),
            createdAt: new Date().toISOString(),
            downloads: 0,
            url: `${proto}://${fileDomain}/f/${fileId}`,
          };

          await withStorageLock(async () => {
            const files = await getStoredFiles();
            files.unshift(record);
            await saveStoredFiles(files);
          });

          res.writeHead(201, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            ...SECURITY_HEADERS,
          });
          res.end(JSON.stringify({ success: true, file: record }));
          return;
        }
      } catch (err) {
        console.error("[Storage Upload Error]", err);
      }

      res.writeHead(400, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Invalid upload request format" }));
      return;
    }

    // 4. Delete file from persistent disk: DELETE /api/storage/files/:id
    if ((pathname.startsWith("/api/storage/files/") || pathname === "/api/storage/files") && req.method === "DELETE") {
      const urlObj = new URL(reqUrl, "http://localhost");
      const rawFileId = pathname.replace(/^\/api\/storage\/files\/?/, "") || urlObj.searchParams.get("id");
      const fileId = rawFileId ? rawFileId.trim() : "";
      const safePath = fileId ? resolveSafeStoragePath(fileId) : null;
      if (fileId && safePath) {
        await withStorageLock(async () => {
          const files = await getStoredFiles();
          const updated = files.filter((f) => f.id !== fileId);
          await saveStoredFiles(updated);
        });
        await unlink(safePath).catch(() => {});
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...SECURITY_HEADERS,
        });
        res.end(JSON.stringify({ success: true, deletedId: fileId }));
        return;
      }
      if (fileId && !safePath) {
        res.writeHead(400, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: "Invalid file identifier" }));
        return;
      }
    }

    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    const isApiHost = host.startsWith("api.") || host.startsWith("api-") || host.startsWith("rest.");
    const isRestPath = pathname.startsWith("/rest/v1");
    const isDbHost =
      host.startsWith("db.") ||
      host.startsWith("studio.") ||
      host.startsWith("supabase.") ||
      host.startsWith("sparrowbase.");
    const isShieldHost = host.startsWith("sec.") || host.startsWith("shield.");
    const isDropHost = host.startsWith("file.") || host.startsWith("drop.") || host.startsWith("share.");
    const isKeysHost =
      host.startsWith("password.") ||
      host.startsWith("passwd.") ||
      host.startsWith("pass.") ||
      host.startsWith("keys.");
    const isGameDashHost = host.startsWith("game.dash.") || host.startsWith("game-dash.");
    const isGameWebHost =
      !isGameDashHost &&
      !host.startsWith("game.panel.") &&
      (host.startsWith("game.") || host.startsWith("game-"));

    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/") {
      const qs = reqUrl.includes("?") ? reqUrl.slice(reqUrl.indexOf("?")) : "";
      let redirectDest = null;
      if (isGameDashHost) redirectDest = `/game/dashboard${qs}`;
      else if (isGameWebHost) redirectDest = `/game${qs}`;
      else if (isDbHost) redirectDest = `/db${qs}`;
      else if (isShieldHost) redirectDest = `/shield${qs}`;
      else if (isDropHost) redirectDest = `/drop${qs}`;
      else if (isKeysHost) redirectDest = `/keys${qs}`;
      else if (isApiHost && acceptsHtml && !req.headers["apikey"] && !req.headers["authorization"]) {
        redirectDest = `/gateway${qs}`;
      }

      if (redirectDest) {
        res.writeHead(302, { Location: redirectDest, ...SECURITY_HEADERS });
        res.end();
        return;
      }
    }

    // Unified SSR / TanStack Start renderer
    const handleViaAppEngine = async () => {
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
        if (key.toLowerCase() === "set-cookie") return;
        resHeaders[key] = val;
      });
      if (typeof webResponse.headers.getSetCookie === "function") {
        const setCookies = webResponse.headers.getSetCookie();
        if (setCookies.length > 0) {
          resHeaders["set-cookie"] = setCookies;
        }
      } else {
        const singleCookie = webResponse.headers.get("set-cookie");
        if (singleCookie) resHeaders["set-cookie"] = singleCookie;
      }

      res.writeHead(webResponse.status, resHeaders);
      const arrayBuf = await webResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    };

    // =========================================================================
    // 1.5. SOVEREIGN LOCAL DB SYNC ENDPOINT (POST /api/shift-cloud-to-local)
    // =========================================================================
    if (pathname === "/api/shift-cloud-to-local" && req.method === "POST") {
      try {
        const totalRows = await migrateCloudSupabaseToLocal();
        res.writeHead(200, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(
          JSON.stringify({
            success: true,
            syncedTables: 13,
            totalRows: Number(totalRows) || 0,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (syncErr) {
        res.writeHead(500, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(
          JSON.stringify({
            success: false,
            error: syncErr instanceof Error ? syncErr.message : String(syncErr),
          }),
        );
      }
      return;
    }

    // =========================================================================
    // 2. PostgREST Proxy vs. Web UI Ingress for api.sparrowx.net
    // =========================================================================
    const isInternalAppApi =
      pathname.startsWith("/api/") || pathname.startsWith("/_serverFn");
    const hasExplicitApiAuthHeader = Boolean(
      req.headers["apikey"] || req.headers["authorization"],
    );
    const isApiWebPortalRoute =
      pathname === "/" ||
      pathname === "/gateway" ||
      pathname === "/docs" ||
      pathname.startsWith("/docs/") ||
      pathname === "/errors" ||
      pathname === "/story" ||
      pathname === "/db" ||
      pathname === "/drop" ||
      pathname === "/keys" ||
      pathname === "/shield" ||
      pathname === "/infra" ||
      pathname.startsWith("/infra/") ||
      pathname === "/game" ||
      pathname.startsWith("/game/") ||
      pathname.startsWith("/f/");
    const isBrowserNavigationToApiHtmlRoute =
      isApiHost &&
      isApiWebPortalRoute &&
      (acceptsHtml || !hasExplicitApiAuthHeader);

    // If it's a programmatic query to PostgREST (/rest/v1 or api domain table queries)
    if (
      !isHealthRoute &&
      !isInternalAppApi &&
      !isBrowserNavigationToApiHtmlRoute &&
      (isApiHost || isRestPath)
    ) {
      const apiKey = String(
        req.headers["apikey"] ||
          String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "")
      ).trim();

      const hasValidKeyFormat =
        apiKey.startsWith("spx_") || apiKey.split(".").length === 3;

      if (req.method !== "HEAD" && !hasValidKeyFormat) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              "Unauthorized: Private Database API requires a valid personal API key. Sign in to your SparrowX Dashboard -> Settings to generate your key.",
          })
        );
        return;
      }

      let targetPath = reqUrl;
      if (isRestPath) {
        targetPath = reqUrl.replace(/^\/rest\/v1/, "") || "/";
      }
      forwardToPostgrest(req, res, targetPath, handleViaAppEngine);
      return;
    }

    // Default: Render via SSR (SparrowxApiGatewayPortal for api., DB Studio for db., Security for sec.)
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
