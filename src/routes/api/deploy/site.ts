import fs from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

export const Route = createFileRoute("/api/deploy/site")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const slug = url.searchParams.get("slug") || "";
          const file = (url.searchParams.get("file") || "index.html").replace(/^\/+/, "");
          if (!slug) {
            return new Response("Missing slug", { status: 400 });
          }
          const { getDeploySiteDir } = await import("@/lib/server/deploy.server");
          const siteDir = path.resolve(getDeploySiteDir(slug));
          if (!fs.existsSync(siteDir)) {
            return new Response("Deployed site artifact not found", { status: 404 });
          }
          const realSiteDir = fs.realpathSync(siteDir);
          const resolved = path.resolve(realSiteDir, file);
          if (
            !resolved.startsWith(realSiteDir + path.sep) ||
            !fs.existsSync(resolved) ||
            !fs.statSync(resolved).isFile()
          ) {
            return new Response("Deployed site artifact not found", { status: 404 });
          }
          const realResolved = fs.realpathSync(resolved);
          if (!realResolved.startsWith(realSiteDir + path.sep)) {
            return new Response("Deployed site artifact not found", { status: 404 });
          }
          const ext = path.extname(realResolved).toLowerCase();
          const contentType = MIME_TYPES[ext] || "application/octet-stream";
          const bytes = fs.readFileSync(realResolved);
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "sandbox allow-scripts allow-forms",
            },
          });
        } catch {
          return new Response("Failed to serve deployed site", { status: 500 });
        }
      },
    },
  },
});
