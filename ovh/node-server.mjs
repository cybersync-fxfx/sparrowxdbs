import { createServer, request as httpRequest } from "node:http";
import { randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, stat, writeFile, mkdir, unlink } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

// Load gitignored .env.local (if present) without overriding existing process.env vars
try {
  const localEnvRaw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of localEnvRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local is optional
}

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
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-ancestors 'self'; base-uri 'self'",
};

function getSafeCorsHeaders(req) {
  const origin = String(req.headers.origin || "").trim();
  const base = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key, x-sparrowx-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
  if (origin) {
    try {
      const parsed = new URL(origin);
      const h = parsed.hostname.toLowerCase();
      const allowed =
        (parsed.protocol === "https:" && (h === "sparrowx.net" || h.endsWith(".sparrowx.net"))) ||
        (parsed.protocol === "http:" && (h === "localhost" || h === "127.0.0.1"));
      if (allowed) {
        base["Access-Control-Allow-Origin"] = origin;
        base["Access-Control-Allow-Credentials"] = "true";
      }
    } catch {
      // ignore malformed origin
    }
  }
  return base;
}

function safeEqualStrings(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return cryptoTimingSafeEqual(ba, bb);
}

function hasValidAdminHeader(req) {
  const configured = (process.env.SPARROWX_ADMIN_API_KEY || process.env.SPARROWX_SERVICE_KEY || "").trim();
  if (!configured) return false;
  const headerKey = String(req.headers["x-sparrowx-admin-key"] || "").trim();
  const authHeader = String(req.headers.authorization || "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  return safeEqualStrings(headerKey, configured) || safeEqualStrings(bearer, configured);
}

function hasMasterSsoCookie(req) {
  const cookie = String(req.headers.cookie || "");
  return /(?:^|;\s*)spx_master_sso=[^;\s]+/.test(cookie);
}

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
      ...getSafeCorsHeaders(req),
    };
    res.writeHead(proxyRes.statusCode || 200, resHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    if (fallbackFn) {
      fallbackFn();
    } else if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(
        JSON.stringify({
          error: "Service temporarily unavailable",
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
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const safeForwardedHost = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(forwardedHost) ? forwardedHost : "";
    const rawHost = safeForwardedHost || req.headers.host || `${HOST}:${PORT}`;
    const host = rawHost.split(":")[0].toLowerCase();
    const isHealthRoute =
      pathname === "/health" || pathname === "/api/health" || pathname === "/api/v1/health";

    const corsHeaders = getSafeCorsHeaders(req);

    // CORS preflight handling
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...corsHeaders,
        ...SECURITY_HEADERS,
      });
      res.end();
      return;
    }

    // Block hidden dotfile probes (/.env, /api/.git, etc.) except .well-known
    if (/(?:^|\/)\.(?!well-known(?:\/|$))/i.test(pathname)) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // Block null-byte / path-traversal / raw exploit probes at edge
    const rawUrl = req.url || "/";
    if (
      rawUrl.includes("%00") ||
      rawUrl.includes("\0") ||
      /[\r\n]/.test(rawUrl) ||
      /(?:^|[\\/]|%2f|%5c)(?:\.\.|%2e%2e)(?:[\\/]|%2f|%5c|$)/i.test(rawUrl) ||
      /(?:\.\.[/\\]|%2e%2e(?:%2f|%5c|\/)|\.{2}(?:%2f|%5c))/i.test(rawUrl)
    ) {
      res.writeHead(403, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // Fast-path <1ms health check (no version/service banner disclosure)
    if (isHealthRoute && (req.method === "GET" || req.method === "HEAD")) {
      const payload = JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders,
        ...SECURITY_HEADERS,
      });
      res.end(req.method === "HEAD" ? undefined : payload);
      return;
    }

    // =========================================================================
    // 1. CRITICAL: SERVE STATIC ASSETS (.css, .js, .png, etc.) FOR ALL DOMAINS
    // =========================================================================
    if (req.method === "GET" || req.method === "HEAD") {
      const publicPrefix = PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : `${PUBLIC_DIR}${sep}`;
      const safePath = resolve(PUBLIC_DIR, pathname.replace(/^\/+/, ""));
      if (safePath.startsWith(publicPrefix) && pathname !== "/") {
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
        const generatedDropId = `spx_drop_${randomBytes(12).toString("hex")}`;
        const rawDropId = dropUploadMatch[1] || parsed.id || generatedDropId;
        const dropId = SAFE_STORAGE_ID_RE.test(String(rawDropId))
          ? String(rawDropId)
          : generatedDropId;
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
            ...corsHeaders,
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
          ...corsHeaders,
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
        ...corsHeaders,
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
            ...corsHeaders,
          });
          res.end(req.method === "HEAD" ? undefined : content);
          return;
        } catch {
          // fall through to 404
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
          ...corsHeaders,
          ...SECURITY_HEADERS,
        });
        res.end(JSON.stringify(item));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }

    // 3. List all stored files: GET /api/storage/files (authenticated only)
    if (pathname === "/api/storage/files" && req.method === "GET") {
      if (!hasValidAdminHeader(req) && !hasMasterSsoCookie(req)) {
        res.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders,
          ...SECURITY_HEADERS,
        });
        res.end(JSON.stringify({ error: "Authentication required" }));
        return;
      }
      const files = await getStoredFiles();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders,
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(files));
      return;
    }

    // 3b. Upload file to persistent disk: POST /api/storage/upload (CSPRNG fileId)
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
          const fileId = `spx_f_${randomBytes(12).toString("hex")}`;
          const safePath = resolveSafeStoragePath(fileId);
          const buffer = Buffer.from(String(parsed.base64Data), "base64");
          if (!safePath || buffer.byteLength > MAX_STORAGE_FILE_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
            res.end(JSON.stringify({ error: "Payload exceeds 100MB limit" }));
            return;
          }
          await writeFile(safePath, buffer);

          const rawProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim().toLowerCase();
          const proto = rawProto === "http" ? "http" : "https";
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
            ...corsHeaders,
            ...SECURITY_HEADERS,
          });
          res.end(JSON.stringify({ success: true, file: record }));
          return;
        }
      } catch {
        // invalid upload format
      }

      res.writeHead(400, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Invalid upload request format" }));
      return;
    }

    // 4. Delete file from persistent disk: DELETE /api/storage/files/:id (authenticated only)
    if ((pathname.startsWith("/api/storage/files/") || pathname === "/api/storage/files") && req.method === "DELETE") {
      if (!hasValidAdminHeader(req) && !hasMasterSsoCookie(req)) {
        res.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders,
          ...SECURITY_HEADERS,
        });
        res.end(JSON.stringify({ error: "Authentication required" }));
        return;
      }
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
          ...corsHeaders,
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
    const isInfraHost =
      host.startsWith("infra.") ||
      host.startsWith("metal.") ||
      host.startsWith("vps.") ||
      host.startsWith("cloud.");
    const isDeployHost = host.startsWith("deploy.");
    const isAiHost = host.startsWith("ai.");
    const isAgentsHost = host.startsWith("agents.");
    const isDpdpHost = host.startsWith("dpdp.");

    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/") {
      const qs = reqUrl.includes("?") ? reqUrl.slice(reqUrl.indexOf("?")) : "";
      let redirectDest = null;
      if (isGameDashHost) redirectDest = `/game/dashboard${qs}`;
      else if (isGameWebHost) redirectDest = `/game${qs}`;
      else if (isInfraHost) redirectDest = `/infra${qs}`;
      else if (isDeployHost) redirectDest = `/deploy${qs}`;
      else if (isAiHost) redirectDest = `/ai${qs}`;
      else if (isAgentsHost) redirectDest = `/agents${qs}`;
      else if (isDpdpHost) redirectDest = `/dpdp${qs}`;
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

    // Subdomain-Aware Wrong-Path & Typoed-Subdomain Auto-Correction (HTML browser GET only)
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/rest/v1") &&
      !pathname.startsWith("/_serverFn") &&
      !pathname.startsWith("/assets/") &&
      !pathname.startsWith("/logos/") &&
      !pathname.startsWith("/3d/") &&
      !pathname.startsWith("/xdp/") &&
      !pathname.startsWith("/f/") &&
      !/\.[a-z0-9]{1,8}$/i.test(pathname) &&
      (acceptsHtml || !req.headers["apikey"])
    ) {
      const qs = (reqUrl.includes("?") ? reqUrl.slice(reqUrl.indexOf("?")) : "").replace(/[\r\n]/g, "");
      const rawProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim().toLowerCase();
      const proto = rawProto === "http" ? "http" : "https";
      const safeRelPath = `/${pathname.replace(/^\/+/, "").replace(/[\r\n]/g, "")}`;

      // 1. Typoed *.sparrowx.net subdomains -> canonical subdomain redirect
      if (host.endsWith(".sparrowx.net")) {
        const sub = host.slice(0, -".sparrowx.net".length);
        const canonicalSubMap = {
          www: "sparrowx.net",
          dbs: "db.sparrowx.net",
          database: "db.sparrowx.net",
          databases: "db.sparrowx.net",
          studio: "db.sparrowx.net",
          postgres: "db.sparrowx.net",
          infr: "infra.sparrowx.net",
          infar: "infra.sparrowx.net",
          cloud: "infra.sparrowx.net",
          vps: "infra.sparrowx.net",
          metal: "infra.sparrowx.net",
          sheild: "sec.sparrowx.net",
          shield: "sec.sparrowx.net",
          security: "sec.sparrowx.net",
          waf: "sec.sparrowx.net",
          games: "game.sparrowx.net",
          gmae: "game.sparrowx.net",
          play: "game.sparrowx.net",
          files: "file.sparrowx.net",
          fiel: "file.sparrowx.net",
          drop: "file.sparrowx.net",
          drops: "file.sparrowx.net",
          vault: "file.sparrowx.net",
          keys: "password.sparrowx.net",
          pass: "password.sparrowx.net",
          passwd: "password.sparrowx.net",
          passwords: "password.sparrowx.net",
          apis: "api.sparrowx.net",
          rest: "api.sparrowx.net",
          gateway: "api.sparrowx.net",
        };
        if (sub === "docs" || sub === "doc") {
          const cleanP = pathname.replace(/\/+$/, "") || "/";
          const docDest = cleanP === "/" ? "/docs" : cleanP.startsWith("/docs") ? cleanP : `/docs${cleanP}`;
          res.writeHead(302, { Location: `${proto}://sparrowx.net${docDest}${qs}`, ...SECURITY_HEADERS });
          res.end();
          return;
        }
        if (canonicalSubMap[sub]) {
          res.writeHead(302, { Location: `${proto}://${canonicalSubMap[sub]}${safeRelPath}${qs}`, ...SECURITY_HEADERS });
          res.end();
          return;
        }
      }

      // 2. Wrong / typoed path auto-correction respecting active subdomain
      const validPaths = new Set([
        "/", "/db", "/infra", "/infra/dashboard", "/infra/configure", "/game", "/game/dashboard", "/game/panel-launch",
        "/shield", "/drop", "/keys", "/gateway", "/docs", "/docs/errors",
        "/docs/db", "/docs/infra", "/docs/shield", "/docs/game", "/docs/drop", "/docs/keys", "/docs/api",
        "/errors", "/story", "/terms", "/refund", "/security", "/deploy", "/ai", "/agents", "/dpdp", "/f",
      ]);
      const normPath = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "").toLowerCase() || "/";
      if (!validPaths.has(normPath)) {
        const lev = (a, b) => {
          const m = a.length, n = b.length;
          const dp = Array.from({ length: n + 1 }, (_, i) => i);
          for (let i = 1; i <= m; i++) {
            let prev = dp[0]; dp[0] = i;
            for (let j = 1; j <= n; j++) {
              const t = dp[j];
              dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
              prev = t;
            }
          }
          return dp[n];
        };
        const activeDocs = isDbHost ? "/docs/db" : isInfraHost ? "/docs/infra" : isShieldHost ? "/docs/shield"
          : (isGameWebHost || isGameDashHost) ? "/docs/game" : isDropHost ? "/docs/drop"
          : isKeysHost ? "/docs/keys" : isApiHost ? "/docs/api" : "/docs";
        const activeDash = isInfraHost ? "/infra/dashboard" : (isGameWebHost || isGameDashHost) ? "/game/dashboard"
          : isDbHost ? "/db" : isShieldHost ? "/shield" : isDropHost ? "/drop"
          : isKeysHost ? "/keys" : isApiHost ? "/gateway" : "/";
        const activeHome = isGameDashHost ? "/game/dashboard" : isGameWebHost ? "/game" : isInfraHost ? "/infra"
          : isDbHost ? "/db" : isShieldHost ? "/shield" : isDropHost ? "/drop"
          : isKeysHost ? "/keys" : isApiHost ? "/gateway" : "/";

        const segs = normPath.split("/").filter(Boolean);
        const first = segs[0] || "";
        const last = segs[segs.length - 1] || "";
        const isDashLike = last.includes("dash") || last.includes("panel") || last.includes("console") || lev(last, "dashboard") <= 3;
        const isDocLike = first === "doc" || first === "docs" || first === "documentation" || first === "guide" || first === "help" || lev(first, "docs") <= 1;

        let fixedPath = null;
        if (isDocLike) {
          const docAliases = { db: "db", dbs: "db", database: "db", infra: "infra", vps: "infra", cloud: "infra", shield: "shield", sec: "shield", waf: "shield", game: "game", games: "game", drop: "drop", file: "drop", vault: "drop", keys: "keys", password: "keys", api: "api", gateway: "api", error: "errors", errors: "errors" };
          if (!segs[1]) {
            fixedPath = activeDocs;
          } else if (docAliases[segs[1]]) {
            fixedPath = `/docs/${docAliases[segs[1]]}`;
          } else {
            const docCands = Object.keys(docAliases);
            let best = null, bestD = 3;
            for (const c of docCands) { const d = lev(segs[1], c); if (d < bestD) { bestD = d; best = c; } }
            fixedPath = best ? `/docs/${docAliases[best]}` : activeDocs;
          }
        } else if (activeHome !== "/" && isDashLike) {
          fixedPath = activeDash;
        } else if (activeHome !== "/" && (last.includes("err") || lev(last, "errors") <= 2)) {
          fixedPath = "/docs/errors";
        } else if (segs.length >= 2) {
          const roots = ["infra", "game", "db", "shield", "drop", "keys", "gateway"];
          let bestRoot = null, bestD = 3;
          for (const r of roots) { const d = lev(first, r); if (d < bestD) { bestD = d; bestRoot = r; } }
          if (bestRoot === "infra" && isDashLike) fixedPath = "/infra/dashboard";
          else if (bestRoot === "game" && isDashLike) fixedPath = "/game/dashboard";
          else if (bestRoot === "game" && (last.includes("ptero") || last.includes("panel") || last.includes("launch"))) fixedPath = "/game/panel-launch";
          else if (bestRoot) fixedPath = `/${bestRoot}`;
        }

        if (!fixedPath) {
          const pathMap = {
            "/db": "/db", "/database": "/db", "/studio": "/db", "/postgres": "/db",
            "/infra": "/infra", "/cloud": "/infra", "/vps": "/infra", "/infra-dashboard": "/infra/dashboard", "/hpanel": "/infra/dashboard",
            "/shield": "/shield", "/sec": "/shield", "/security": "/security", "/waf": "/shield", "/soc": "/shield",
            "/terms": "/terms", "/term": "/terms", "/tos": "/terms", "/refund": "/refund", "/refunds": "/refund",
            "/game": "/game", "/games": "/game", "/game-dashboard": "/game/dashboard", "/ptero": "/game/panel-launch",
            "/drop": "/drop", "/file": "/drop", "/files": "/drop", "/vault": "/drop",
            "/keys": "/keys", "/password": "/keys", "/passwords": "/keys",
            "/gateway": "/gateway", "/api": "/gateway",
            "/errors": "/docs/errors", "/error": "/docs/errors", "/story": "/story", "/about": "/story",
          };
          if (pathMap[normPath]) {
            fixedPath = pathMap[normPath];
          } else {
            let best = null, bestD = normPath.length >= 6 ? 3 : 2;
            for (const cand of Object.keys(pathMap)) {
              const d = lev(normPath, cand);
              if (d < bestD) { bestD = d; best = cand; }
            }
            fixedPath = best ? pathMap[best] : activeHome;
          }
        }

        if (fixedPath && fixedPath !== pathname) {
          res.writeHead(302, { Location: `${fixedPath}${qs}`, ...SECURITY_HEADERS });
          res.end();
          return;
        }
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
    // 1.5. SOVEREIGN LOCAL DB SYNC ENDPOINT (Admin Key Required)
    // =========================================================================
    if (pathname === "/api/shift-cloud-to-local" && req.method === "POST") {
      if (!hasValidAdminHeader(req)) {
        res.writeHead(401, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(JSON.stringify({ success: false, error: "Admin API key required" }));
        return;
      }
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
      } catch {
        res.writeHead(500, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(
          JSON.stringify({
            success: false,
            error: "Database synchronization failed",
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
      pathname === "/deploy" ||
      pathname === "/ai" ||
      pathname === "/agents" ||
      pathname === "/dpdp" ||
      pathname === "/security" ||
      pathname === "/terms" ||
      pathname === "/refund" ||
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

      const configuredServiceKey = (
        process.env.SPARROWX_ADMIN_API_KEY ||
        process.env.SPARROWX_SERVICE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ""
      ).trim();
      const isAuthorizedGateway =
        hasValidAdminHeader(req) ||
        hasMasterSsoCookie(req) ||
        (configuredServiceKey && safeEqualStrings(apiKey, configuredServiceKey)) ||
        (apiKey.split(".").length === 3 && apiKey.length >= 64);

      if (req.method !== "HEAD" && !isAuthorizedGateway) {
        res.writeHead(401, { "Content-Type": "application/json", ...SECURITY_HEADERS });
        res.end(
          JSON.stringify({
            error: "Unauthorized: valid API key or authenticated session required.",
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

    // Default: Render via SSR
    await handleViaAppEngine();
  } catch {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
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
