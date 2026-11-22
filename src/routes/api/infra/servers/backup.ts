import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const serverId = url.searchParams.get("serverId") || "default";
          const download = url.searchParams.get("download") || "script";

          const { listManagedInfraServers } = await import(
            "@/lib/server/proxmox.server"
          );
          const {
            generateSparrowxBackupBundle,
            generateSparrowxBackupScript,
          } = await import("@/lib/server/sparrowx-backup.server");

          const list = await listManagedInfraServers();
          const server =
            list.servers.find((s) => s.id === serverId) ||
            list.servers[0] || {
              id: serverId,
              vmid: 401,
              node: "pve-in-mum",
              name: "Ryzen 9 9950X (401)",
              hostname: serverId && serverId !== "YOUR_SERVER_ID" ? `${serverId}.sparrowx.net` : "node-01.sparrowx.net",
              category: "vps" as const,
              planId: "vps-ryzen-9950x-16gb",
              planName: "Ryzen 9 9950X — 16GB",
              region: "Tier IV Mumbai Node",
              os: "Ubuntu 24.04 LTS (Hardened)",
              status: "running" as const,
              ipv4: "103.189.45.142",
              extraIpv4s: [],
              ipv6: "2401:4900:8a12:401::/64",
              rdns: "node-01.sparrowx.net",
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

          if (download === "script" || download === "sh" || url.searchParams.has("download")) {
            const script = generateSparrowxBackupScript(server);
            return new Response(script, {
              status: 200,
              headers: {
                "Content-Type": "text/x-shellscript; charset=utf-8",
                "Content-Disposition": `attachment; filename="sparrowx-restore-${server.hostname.split(".")[0]}.sh"`,
                "Cache-Control": "no-store, no-cache, must-revalidate",
              },
            });
          }

          const bundle = generateSparrowxBackupBundle(server);
          return Response.json({ ok: true, bundle });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Backup generation failed";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let body: { serverId?: string; download?: string } = {};
          try {
            body = await request.json();
          } catch {
            // allow empty body
          }
          const serverId = body.serverId || url.searchParams.get("serverId") || "default";

          const { listManagedInfraServers } = await import(
            "@/lib/server/proxmox.server"
          );
          const {
            generateSparrowxBackupBundle,
            generateSparrowxBackupScript,
          } = await import("@/lib/server/sparrowx-backup.server");

          const list = await listManagedInfraServers();
          const server =
            list.servers.find((s) => s.id === serverId) ||
            list.servers[0] || {
              id: serverId,
              vmid: 401,
              node: "pve-in-mum",
              name: "Ryzen 9 9950X (401)",
              hostname: serverId && serverId !== "YOUR_SERVER_ID" ? `${serverId}.sparrowx.net` : "node-01.sparrowx.net",
              category: "vps" as const,
              planId: "vps-ryzen-9950x-16gb",
              planName: "Ryzen 9 9950X — 16GB",
              region: "Tier IV Mumbai Node",
              os: "Ubuntu 24.04 LTS (Hardened)",
              status: "running" as const,
              ipv4: "103.189.45.142",
              extraIpv4s: [],
              ipv6: "2401:4900:8a12:401::/64",
              rdns: "node-01.sparrowx.net",
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

          const bundle = generateSparrowxBackupBundle(server);
          return Response.json({ ok: true, bundle });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Backup generation failed";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
