import net from "node:net";
import { createFileRoute } from "@tanstack/react-router";

async function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

async function probeHttp(url: string, timeoutMs = 2000): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.status > 0 && res.status < 500, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const Route = createFileRoute("/api/system/backbone")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
        const { hasValidAdminKey } = await import("@/lib/server/db-auth.server");
        const isAdminKey = hasValidAdminKey(request);
        const claims = await readMasterSsoFromRequest(request);
        const isAdmin = isAdminKey || claims?.role === "admin";

        const pgHost = process.env.POSTGRES_HOST || "127.0.0.1";
        const pgPort = Number(process.env.POSTGRES_PORT || 5432);
        const postgrestUrl = process.env.POSTGREST_INTERNAL_URL || "http://127.0.0.1:3001";
        const smtpHost = process.env.SMTP_HOST || "127.0.0.1";
        const smtpPort = Number(process.env.SMTP_PORT || 587);
        const pteroUrl = process.env.PTERO_URL || "";
        const pveUrl = process.env.PVE_URL || "";

        const [pgUp, postgrest, smtpUp, pma] = await Promise.all([
          probeTcp(pgHost, pgPort),
          probeHttp(postgrestUrl),
          probeTcp(smtpHost, smtpPort),
          probeHttp("http://sparrowx-phpmyadmin:80"),
        ]);

        const googleOAuthConfigured = Boolean(
          process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
        );

        // Non-admin callers only see high-level operational booleans (never internal hostnames/ports/paths)
        if (!isAdmin) {
          return Response.json(
            {
              ok: true,
              timestamp: new Date().toISOString(),
              backbone: {
                postgres: { connected: pgUp },
                postgrest: { connected: postgrest.ok },
                smtp: { connected: smtpUp },
                googleOAuth: { configured: googleOAuthConfigured },
              },
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        return Response.json(
          {
            ok: true,
            timestamp: new Date().toISOString(),
            backbone: {
              postgres: { connected: pgUp, host: `${pgHost}:${pgPort}` },
              postgrest: { connected: postgrest.ok, status: postgrest.status },
              phpmyadmin: { connected: pma.ok, status: pma.status },
              smtp: { connected: smtpUp, host: `${smtpHost}:${smtpPort}` },
              proxmox: { configured: Boolean(pveUrl && process.env.PVE_TOKEN_ID) },
              pterodactyl: { configured: Boolean(pteroUrl && process.env.PTERO_APPLICATION_API_KEY) },
              googleOAuth: { configured: googleOAuthConfigured },
              deployRunner: { active: true },
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
