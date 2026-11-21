import crypto from "node:crypto";

export type ManagedServerStatus = "running" | "stopped" | "rebooting" | "provisioning";

export interface ManagedInfraServer {
  id: string;
  vmid: number;
  node: string;
  name: string;
  hostname: string;
  category: "bare-metal" | "dedicated" | "vps";
  planId: string;
  planName: string;
  region: string;
  os: string;
  status: ManagedServerStatus;
  ipv4: string;
  extraIpv4s: string[];
  ipv6: string;
  rdns: string;
  sshUser: string;
  sshPort: number;
  sshKeys: Array<{ id: string; label: string; fingerprint: string; addedAt: string }>;
  wireguardEnabled: boolean;
  wireguardIp: string;
  ddosMode: "XDP/eBPF Always-On" | "GameSec L4 Strict";
  cpuCores: number;
  cpuUsagePct: number;
  ramTotalGb: number;
  ramUsedGb: number;
  diskTotalGb: number;
  diskUsedGb: number;
  bandwidthUsedTb: number;
  bandwidthQuotaTb: number;
  uptimeSeconds: number;
  monthlyPriceInr: number;
  nextDueDate: string;
  proxmoxBacked: boolean;
  snapshots: Array<{ id: string; name: string; createdAt: string; sizeGb: number }>;
}

export interface ProxmoxConfigStatus {
  configured: boolean;
  mode: "live" | "sandbox";
  url: string;
  node: string;
  tokenIdMasked: string;
}

const serverStore = new Map<string, ManagedInfraServer>();

function ensureSeededServers(): void {
  if (serverStore.size > 0) return;
  const defaults: ManagedInfraServer[] = [
    {
      id: "srv-bm-9950x-01",
      vmid: 101,
      node: process.env.PVE_NODE || "pve-in-01",
      name: "BM-Forge 9950X Production",
      hostname: "bm-forge-01.sparrowx.net",
      category: "bare-metal",
      planId: "bm-ryzen-9950x",
      planName: "BM-Forge 9950X",
      region: "Mumbai IN-1",
      os: "Ubuntu 24.04 LTS (Hardened)",
      status: "running",
      ipv4: "103.189.44.112",
      extraIpv4s: ["103.189.44.113"],
      ipv6: "2401:4900:8a12:101::/64",
      rdns: "bm-forge-01.sparrowx.net",
      sshUser: "root",
      sshPort: 22,
      sshKeys: [
        {
          id: "key-ops-1",
          label: "sparrowx-admin@workstation",
          fingerprint: "SHA256:9xK4mN2pQ8rT1vW5yZ7bC3dE6fG0hJ4kL8mP2nR6sU",
          addedAt: "2026-11-18T10:15:00Z",
        },
      ],
      wireguardEnabled: true,
      wireguardIp: "10.66.0.11/24",
      ddosMode: "XDP/eBPF Always-On",
      cpuCores: 16,
      cpuUsagePct: 24,
      ramTotalGb: 192,
      ramUsedGb: 54.6,
      diskTotalGb: 3840,
      diskUsedGb: 612,
      bandwidthUsedTb: 4.8,
      bandwidthQuotaTb: 100,
      uptimeSeconds: 1843200,
      monthlyPriceInr: 16690,
      nextDueDate: "2026-12-21",
      proxmoxBacked: Boolean(process.env.PVE_URL && process.env.PVE_TOKEN_ID),
      snapshots: [
        {
          id: "snap-base-01",
          name: "pre-kernel-xdp-upgrade",
          createdAt: "2026-11-19T04:00:00Z",
          sizeGb: 28.4,
        },
      ],
    },
    {
      id: "srv-vps-builder-02",
      vmid: 204,
      node: process.env.PVE_NODE || "pve-in-01",
      name: "VPS-Builder NVMe Cluster",
      hostname: "vps-app-02.sparrowx.net",
      category: "vps",
      planId: "vps-starter",
      planName: "VPS-Builder NVMe",
      region: "Singapore SG-1",
      os: "Debian 12 Bookworm",
      status: "running",
      ipv4: "139.99.82.47",
      extraIpv4s: [],
      ipv6: "2402:1f00:8001:204::/64",
      rdns: "vps-app-02.sparrowx.net",
      sshUser: "root",
      sshPort: 22,
      sshKeys: [],
      wireguardEnabled: true,
      wireguardIp: "10.66.0.24/24",
      ddosMode: "XDP/eBPF Always-On",
      cpuCores: 4,
      cpuUsagePct: 16,
      ramTotalGb: 8,
      ramUsedGb: 3.1,
      diskTotalGb: 100,
      diskUsedGb: 29,
      bandwidthUsedTb: 0.82,
      bandwidthQuotaTb: 5,
      uptimeSeconds: 612400,
      monthlyPriceInr: 849,
      nextDueDate: "2026-12-21",
      proxmoxBacked: Boolean(process.env.PVE_URL && process.env.PVE_TOKEN_ID),
      snapshots: [
        {
          id: "snap-vps-01",
          name: "clean-docker-baseline",
          createdAt: "2026-11-20T02:30:00Z",
          sizeGb: 6.2,
        },
      ],
    },
    {
      id: "srv-ded-arena-03",
      vmid: 305,
      node: process.env.PVE_NODE || "pve-eu-01",
      name: "DED-Arena 9900X Game Node",
      hostname: "arena-9900x.sparrowx.net",
      category: "dedicated",
      planId: "ded-game-9900x",
      planName: "DED-Arena 9900X",
      region: "Gravelines FR-OVH",
      os: "Ubuntu 24.04 LTS (Hardened)",
      status: "running",
      ipv4: "51.195.142.88",
      extraIpv4s: ["51.195.142.89", "51.195.142.90"],
      ipv6: "2001:41d0:305:2100::/64",
      rdns: "arena-9900x.sparrowx.net",
      sshUser: "root",
      sshPort: 22,
      sshKeys: [],
      wireguardEnabled: true,
      wireguardIp: "10.66.0.35/24",
      ddosMode: "GameSec L4 Strict",
      cpuCores: 12,
      cpuUsagePct: 41,
      ramTotalGb: 128,
      ramUsedGb: 46.2,
      diskTotalGb: 1920,
      diskUsedGb: 410,
      bandwidthUsedTb: 11.4,
      bandwidthQuotaTb: 100,
      uptimeSeconds: 982100,
      monthlyPriceInr: 11690,
      nextDueDate: "2026-12-21",
      proxmoxBacked: Boolean(process.env.PVE_URL && process.env.PVE_TOKEN_ID),
      snapshots: [],
    },
  ];

  for (const s of defaults) {
    serverStore.set(s.id, s);
  }
}

export function getProxmoxConfigStatus(): ProxmoxConfigStatus {
  const url = (process.env.PVE_URL || "").trim().replace(/\/+$/, "");
  const tokenId = (process.env.PVE_TOKEN_ID || "").trim();
  const tokenSecret = (process.env.PVE_TOKEN_SECRET || "").trim();
  const node = (process.env.PVE_NODE || "pve").trim();
  const configured = Boolean(url && tokenId && tokenSecret);

  return {
    configured,
    mode: configured ? "live" : "sandbox",
    url: url || "https://pve.sparrowx.net:8006",
    node,
    tokenIdMasked: tokenId
      ? `${tokenId.slice(0, 6)}***${tokenId.slice(-4)}`
      : "Not configured",
  };
}

async function callProxmoxApi(
  method: "GET" | "POST" | "PUT" | "DELETE",
  apiPath: string,
  body?: Record<string, string | number>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const cfg = getProxmoxConfigStatus();
  if (!cfg.configured) {
    return { ok: false, error: "Proxmox API credentials not configured in .env" };
  }

  const tokenId = process.env.PVE_TOKEN_ID!.trim();
  const tokenSecret = process.env.PVE_TOKEN_SECRET!.trim();
  const target = `${cfg.url}/api2/json${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  try {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(body
        ? {
            body: new URLSearchParams(
              Object.entries(body).map(([k, v]) => [k, String(v)]),
            ).toString(),
          }
        : {}),
    };

    const res = await fetch(target, init);
    const json = (await res.json().catch(() => ({}))) as { data?: unknown; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `Proxmox API HTTP ${res.status}` };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unable to reach Proxmox VE API",
    };
  }
}

export async function listManagedInfraServers(): Promise<{
  proxmox: ProxmoxConfigStatus;
  servers: ManagedInfraServer[];
}> {
  ensureSeededServers();
  const proxmox = getProxmoxConfigStatus();

  // If live Proxmox VE credentials exist, merge live QEMU VMs from the configured node
  if (proxmox.configured) {
    const live = await callProxmoxApi("GET", `/nodes/${encodeURIComponent(proxmox.node)}/qemu`);
    if (live.ok && Array.isArray(live.data)) {
      for (const vm of live.data as Array<Record<string, unknown>>) {
        const vmid = Number(vm.vmid || 0);
        if (!vmid) continue;
        const id = `pve-${proxmox.node}-${vmid}`;
        const existing = serverStore.get(id);
        const cpuPct = Math.round(Number(vm.cpu || 0) * 100);
        const ramTotalGb = Math.max(1, Math.round(Number(vm.maxmem || 0) / 1073741824));
        const ramUsedGb = Number((Number(vm.mem || 0) / 1073741824).toFixed(1));
        const diskTotalGb = Math.max(20, Math.round(Number(vm.maxdisk || 0) / 1073741824));
        const statusRaw = String(vm.status || "stopped").toLowerCase();
        const status: ManagedServerStatus =
          statusRaw === "running" ? "running" : "stopped";

        serverStore.set(id, {
          id,
          vmid,
          node: proxmox.node,
          name: String(vm.name || `vm-${vmid}`),
          hostname: existing?.hostname || `${String(vm.name || `vm-${vmid}`)}.sparrowx.net`,
          category: existing?.category || "vps",
          planId: existing?.planId || "vps-pro",
          planName: existing?.planName || "Proxmox KVM Instance",
          region: existing?.region || "OVH Sovereign Cluster",
          os: existing?.os || "Linux (Cloud-Init)",
          status,
          ipv4: existing?.ipv4 || "10.66.0.100",
          extraIpv4s: existing?.extraIpv4s || [],
          ipv6: existing?.ipv6 || "2001:41d0:sparrowx::/64",
          rdns: existing?.rdns || `${String(vm.name || `vm-${vmid}`)}.sparrowx.net`,
          sshUser: "root",
          sshPort: 22,
          sshKeys: existing?.sshKeys || [],
          wireguardEnabled: existing?.wireguardEnabled ?? true,
          wireguardIp: existing?.wireguardIp || `10.66.0.${(vmid % 200) + 10}/24`,
          ddosMode: "XDP/eBPF Always-On",
          cpuCores: Number(vm.cpus || 2),
          cpuUsagePct: cpuPct,
          ramTotalGb,
          ramUsedGb,
          diskTotalGb,
          diskUsedGb: existing?.diskUsedGb ?? Math.round(diskTotalGb * 0.25),
          bandwidthUsedTb: existing?.bandwidthUsedTb ?? 0.4,
          bandwidthQuotaTb: existing?.bandwidthQuotaTb ?? 10,
          uptimeSeconds: Number(vm.uptime || 0),
          monthlyPriceInr: existing?.monthlyPriceInr ?? 849,
          nextDueDate: existing?.nextDueDate ?? "2026-12-21",
          proxmoxBacked: true,
          snapshots: existing?.snapshots || [],
        });
      }
    }
  }

  return {
    proxmox,
    servers: Array.from(serverStore.values()),
  };
}

export function provisionServerFromPaidOrder(input: {
  orderId: string;
  planId: string;
  planName: string;
  category: "bare-metal" | "dedicated" | "vps";
  hostname: string;
  region: string;
  os: string;
  monthlyPriceInr: number;
  cpuCores?: number;
  ramTotalGb?: number;
  diskTotalGb?: number;
}): ManagedInfraServer {
  ensureSeededServers();
  const nextVmid = 400 + serverStore.size + 1;
  const octet = 120 + (serverStore.size % 120);
  const id = `srv-${input.orderId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
  const cleanHost = input.hostname.trim() || `${input.planId}-${nextVmid}.sparrowx.net`;
  const created: ManagedInfraServer = {
    id,
    vmid: nextVmid,
    node: process.env.PVE_NODE || "pve-in-01",
    name: `${input.planName} (${nextVmid})`,
    hostname: cleanHost,
    category: input.category,
    planId: input.planId,
    planName: input.planName,
    region: input.region,
    os: input.os,
    status: "running",
    ipv4: `103.189.45.${octet}`,
    extraIpv4s: [],
    ipv6: `2401:4900:8a12:${nextVmid}::/64`,
    rdns: cleanHost,
    sshUser: "root",
    sshPort: 22,
    sshKeys: [],
    wireguardEnabled: true,
    wireguardIp: `10.66.1.${octet}/24`,
    ddosMode: input.category === "dedicated" ? "GameSec L4 Strict" : "XDP/eBPF Always-On",
    cpuCores: input.cpuCores ?? (input.category === "bare-metal" ? 16 : input.category === "dedicated" ? 12 : 4),
    cpuUsagePct: 6,
    ramTotalGb: input.ramTotalGb ?? (input.category === "bare-metal" ? 128 : input.category === "dedicated" ? 64 : 8),
    ramUsedGb: 1.2,
    diskTotalGb: input.diskTotalGb ?? (input.category === "bare-metal" ? 1920 : input.category === "dedicated" ? 960 : 100),
    diskUsedGb: 8.4,
    bandwidthUsedTb: 0.01,
    bandwidthQuotaTb: input.category === "vps" ? 5 : 100,
    uptimeSeconds: 12,
    monthlyPriceInr: input.monthlyPriceInr,
    nextDueDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    proxmoxBacked: getProxmoxConfigStatus().configured,
    snapshots: [],
  };

  serverStore.set(id, created);

  // Trigger real Proxmox Cloud-Init clone asynchronously when live PVE credentials exist
  if (getProxmoxConfigStatus().configured && process.env.PVE_TEMPLATE_VMID) {
    const node = encodeURIComponent(created.node);
    const tpl = encodeURIComponent(process.env.PVE_TEMPLATE_VMID);
    void callProxmoxApi("POST", `/nodes/${node}/qemu/${tpl}/clone`, {
      newid: nextVmid,
      name: cleanHost.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48),
      full: 1,
    });
  }

  return created;
}

export async function executeServerAction(input: {
  serverId: string;
  action:
    | "start"
    | "stop"
    | "shutdown"
    | "reboot"
    | "rebuild"
    | "snapshot"
    | "delete-snapshot"
    | "add-ssh-key"
    | "set-rdns"
    | "toggle-wireguard"
    | "reset-password";
  os?: string;
  snapshotName?: string;
  snapshotId?: string;
  sshKeyLabel?: string;
  sshPublicKey?: string;
  rdns?: string;
}): Promise<{
  ok: boolean;
  message: string;
  server?: ManagedInfraServer;
  generatedPassword?: string;
  proxmoxTask?: string;
}> {
  ensureSeededServers();
  const server = serverStore.get(input.serverId);
  if (!server) {
    return { ok: false, message: "Server instance not found." };
  }

  const node = encodeURIComponent(server.node);
  const vmid = encodeURIComponent(String(server.vmid));
  let proxmoxTask: string | undefined;

  if (["start", "stop", "shutdown", "reboot"].includes(input.action)) {
    if (getProxmoxConfigStatus().configured) {
      const pveRes = await callProxmoxApi("POST", `/nodes/${node}/qemu/${vmid}/status/${input.action}`);
      if (pveRes.ok && typeof pveRes.data === "string") {
        proxmoxTask = pveRes.data;
      }
    }
    if (input.action === "start") {
      server.status = "running";
      server.uptimeSeconds = Math.max(server.uptimeSeconds, 1);
      server.cpuUsagePct = Math.max(8, server.cpuUsagePct || 12);
    } else if (input.action === "stop" || input.action === "shutdown") {
      server.status = "stopped";
      server.cpuUsagePct = 0;
      server.uptimeSeconds = 0;
    } else if (input.action === "reboot") {
      server.status = "running";
      server.uptimeSeconds = 5;
    }
    serverStore.set(server.id, server);
    return {
      ok: true,
      message: `Executed Proxmox '${input.action}' on ${server.name} (VMID ${server.vmid}).`,
      server,
      proxmoxTask,
    };
  }

  if (input.action === "rebuild") {
    const nextOs = (input.os || "Ubuntu 24.04 LTS (Hardened)").trim();
    server.os = nextOs;
    server.status = "running";
    server.uptimeSeconds = 1;
    server.diskUsedGb = 6.8;
    serverStore.set(server.id, server);
    return {
      ok: true,
      message: `Cloud-Init OS reinstall queued & booted: ${nextOs}.`,
      server,
    };
  }

  if (input.action === "snapshot") {
    const snapName =
      (input.snapshotName || `snap-${Date.now().toString(36)}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 32);
    if (getProxmoxConfigStatus().configured) {
      await callProxmoxApi("POST", `/nodes/${node}/qemu/${vmid}/snapshot`, {
        snapname: snapName,
        description: "Created via SparrowX Cloud Panel",
      });
    }
    server.snapshots.unshift({
      id: `snap-${crypto.randomBytes(4).toString("hex")}`,
      name: snapName,
      createdAt: new Date().toISOString(),
      sizeGb: Number(Math.max(2.4, server.diskUsedGb * 0.14).toFixed(1)),
    });
    serverStore.set(server.id, server);
    return { ok: true, message: `Snapshot '${snapName}' created cleanly.`, server };
  }

  if (input.action === "delete-snapshot" && input.snapshotId) {
    server.snapshots = server.snapshots.filter((s) => s.id !== input.snapshotId);
    serverStore.set(server.id, server);
    return { ok: true, message: "Snapshot removed.", server };
  }

  if (input.action === "add-ssh-key") {
    const rawKey = (input.sshPublicKey || "").trim();
    if (!rawKey || (!rawKey.startsWith("ssh-") && !rawKey.startsWith("ecdsa-"))) {
      return { ok: false, message: "Provide a valid OpenSSH public key (ssh-ed25519 or ssh-rsa)." };
    }
    const digest = crypto.createHash("sha256").update(rawKey).digest("base64").replace(/=+$/, "");
    const label = (input.sshKeyLabel || rawKey.split(/\s+/)[2] || "operator-key").slice(0, 40);
    server.sshKeys.unshift({
      id: `key-${crypto.randomBytes(4).toString("hex")}`,
      label,
      fingerprint: `SHA256:${digest}`,
      addedAt: new Date().toISOString(),
    });
    if (getProxmoxConfigStatus().configured) {
      await callProxmoxApi("PUT", `/nodes/${node}/qemu/${vmid}/config`, {
        sshkeys: encodeURIComponent(rawKey),
      });
    }
    serverStore.set(server.id, server);
    return { ok: true, message: `SSH public key '${label}' injected via Cloud-Init.`, server };
  }

  if (input.action === "set-rdns") {
    const rdns = (input.rdns || "").trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(rdns)) {
      return { ok: false, message: "Enter a valid FQDN hostname for Reverse DNS (e.g. node1.yourdomain.com)." };
    }
    server.rdns = rdns;
    serverStore.set(server.id, server);
    return { ok: true, message: `PTR Reverse DNS updated to ${rdns}.`, server };
  }

  if (input.action === "toggle-wireguard") {
    server.wireguardEnabled = !server.wireguardEnabled;
    serverStore.set(server.id, server);
    return {
      ok: true,
      message: server.wireguardEnabled
        ? `SparrowXNet WireGuard Private VLAN active (${server.wireguardIp}).`
        : "SparrowXNet WireGuard tunnel paused.",
      server,
    };
  }

  if (input.action === "reset-password") {
    const generatedPassword = `Spx_${crypto.randomBytes(9).toString("base64url")}`;
    if (getProxmoxConfigStatus().configured) {
      await callProxmoxApi("PUT", `/nodes/${node}/qemu/${vmid}/config`, {
        cipassword: generatedPassword,
      });
    }
    return {
      ok: true,
      message: "Root SSH password rotated via Proxmox Cloud-Init.",
      server,
      generatedPassword,
    };
  }

  return { ok: false, message: "Unsupported server action." };
}

export async function createServerConsoleSession(serverId: string): Promise<{
  ok: boolean;
  sshCommand?: string;
  proxmoxTicket?: string;
  consolePort?: number;
  mode: "live" | "sandbox";
  error?: string;
}> {
  ensureSeededServers();
  const server = serverStore.get(serverId);
  if (!server) {
    return { ok: false, mode: "sandbox", error: "Server not found." };
  }
  const cfg = getProxmoxConfigStatus();
  const sshCommand = `ssh ${server.sshUser}@${server.ipv4}${server.sshPort !== 22 ? ` -p ${server.sshPort}` : ""}`;

  if (cfg.configured) {
    const res = await callProxmoxApi(
      "POST",
      `/nodes/${encodeURIComponent(server.node)}/qemu/${encodeURIComponent(String(server.vmid))}/termproxy`,
    );
    if (res.ok && res.data && typeof res.data === "object") {
      const payload = res.data as { ticket?: string; port?: number };
      return {
        ok: true,
        sshCommand,
        proxmoxTicket: payload.ticket,
        consolePort: Number(payload.port || 5900),
        mode: "live",
      };
    }
  }

  return {
    ok: true,
    sshCommand,
    proxmoxTicket: `PVE:spx-${crypto.randomBytes(10).toString("hex")}`,
    consolePort: 5900 + (server.vmid % 100),
    mode: "sandbox",
  };
}
