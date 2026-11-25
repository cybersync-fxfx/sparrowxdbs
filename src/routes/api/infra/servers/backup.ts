import { createFileRoute } from "@tanstack/react-router";

function sanitizeServerId(raw: string | null | undefined): string {
  const cleaned = String(raw || "default").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return cleaned || "default";
}

async function resolveBackupServerForRequest(request: Request, rawServerId: string | null | undefined) {
  const serverId = sanitizeServerId(rawServerId);
  const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
  const { hasValidAdminKey } = await import("@/lib/server/db-auth.server");
  const isAuthed = hasValidAdminKey(request) || Boolean(await readMasterSsoFromRequest(request));

  if (isAuthed) {
    const { listManagedInfraServers } = await import("@/lib/server/proxmox.server");
    const list = await listManagedInfraServers();
    const matched = list.servers.find((s) => s.id === serverId) || list.servers[0];
    if (matched) return matched;
  }

  // Unauthenticated callers only receive a sanitized template (never live fleet inventory)
  const safeHostLabel =
    serverId !== "default" && serverId !== "YOUR_SERVER_ID" ? serverId.toLowerCase() : "node-01";
  return {
    id: serverId,
    vmid: 401,
    node: "pve-in-mum",
    name: "SparrowX Managed VPS",
    hostname: `${safeHostLabel}.sparrowx.net`,
    category: "vps" as const,
    planId: "vps-ryzen-9950x-16gb",
    planName: "Ryzen 9 9950X — 16GB",
    region: "Tier IV Mumbai Node",
    os: "Ubuntu 24.04 LTS (Hardened)",
    status: "running" as const,
    ipv4: "103.189.45.142",
    extraIpv4s: [],
    ipv6: "2401:4900:8a12:401::/64",
    rdns: `${safeHostLabel}.sparrowx.net`,
    sshUser: "root",
    sshPort: 22,
    sshKeys: [],
    wireguardEnabled: true,
    wireguardIp: "10.66.1.142/24",
    ddosMode: "XDP/eBPF Always-On" as const,
    cpuCores: 8,
    cpuUsagePct: 18,
    ramTotalGb: 16,
    ramUsedGb: 4.2,
    diskTotalGb: 250,
    diskUsedGb: 34,
    bandwidthUsedTb: 1.2,
    bandwidthQuotaTb: 100,
    uptimeSeconds: 123456,
    monthlyPriceInr: 2599,
    nextDueDate: "2026-12-22",
    proxmoxBacked: true,
    snapshots: [],
  };
}

export const Route = createFileRoute("/api/infra/servers/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const download = url.searchParams.get("download") || "script";
          const server = await resolveBackupServerForRequest(request, url.searchParams.get("serverId"));
          const { generateSparrowxBackupBundle, generateSparrowxBackupScript } = await import(
            "@/lib/server/sparrowx-backup.server"
          );

          if (download === "script" || download === "sh" || url.searchParams.has("download")) {
            const script = generateSparrowxBackupScript(server);
            const safeFileHost = (server.hostname.split(".")[0] || "node").replace(/[^a-z0-9-]/gi, "");
            return new Response(script, {
              status: 200,
              headers: {
                "Content-Type": "text/x-shellscript; charset=utf-8",
                "Content-Disposition": `attachment; filename="sparrowx-restore-${safeFileHost}.sh"`,
                "Cache-Control": "no-store, no-cache, must-revalidate",
              },
            });
          }

          const bundle = generateSparrowxBackupBundle(server);
          return Response.json({ ok: true, bundle }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { ok: false, error: "Backup generation failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let body: { serverId?: string } = {};
          try {
            body = await request.json();
          } catch {
            // allow empty body
          }
          const server = await resolveBackupServerForRequest(
            request,
            body.serverId || url.searchParams.get("serverId"),
          );
          const { generateSparrowxBackupBundle } = await import(
            "@/lib/server/sparrowx-backup.server"
          );

          const bundle = generateSparrowxBackupBundle(server);
          return Response.json({ ok: true, bundle }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { ok: false, error: "Backup generation failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
