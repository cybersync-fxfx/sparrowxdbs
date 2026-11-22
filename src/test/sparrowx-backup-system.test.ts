import { describe, expect, it } from "vitest";
import {
  generateSparrowxBackupBundle,
  generateSparrowxBackupScript,
} from "@/lib/server/sparrowx-backup.server";
import type { ManagedInfraServer } from "@/lib/server/proxmox.server";

describe("SparrowX Backup System — Master Autonomous Restore Engine", () => {
  const mockServer: ManagedInfraServer = {
    id: "srv-mumbai-01",
    vmid: 401,
    node: "pve-in-mum",
    name: "Ryzen 9 9950X (401)",
    hostname: "spx-ryzen9-mum01.sparrowx.net",
    category: "vps",
    planId: "vps-ryzen-9950x-16gb",
    planName: "Ryzen 9 9950X — 16GB",
    region: "Tier IV Mumbai Node",
    os: "Ubuntu 24.04 LTS (Hardened)",
    status: "running",
    ipv4: "103.189.45.142",
    extraIpv4s: [],
    ipv6: "2401:4900:8a12:401::/64",
    rdns: "spx-ryzen9-mum01.sparrowx.net",
    sshUser: "root",
    sshPort: 22,
    sshKeys: [],
    wireguardEnabled: true,
    wireguardIp: "10.66.1.142/24",
    ddosMode: "XDP/eBPF Always-On",
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

  it("generates an executable, branded sparrowx-restore.sh script with Nginx auto-healing", () => {
    const script = generateSparrowxBackupScript(mockServer);

    // Assert branding
    expect(script).toContain("SPARROWX BACKUP SYSTEM — AUTONOMOUS MASTER RESTORE ENGINE");
    expect(script).toContain("BACKUP SYSTEM · MASTER RESTORE");

    // Assert root privilege check
    expect(script).toContain('if [ "$(id -u)" -ne 0 ]; then');

    // Assert package auto-installation
    expect(script).toContain("apt-get install -y -qq nginx curl tar wireguard ufw");
    expect(script).toContain("install -y -q nginx curl tar wireguard-tools");

    // Assert Nginx auto-fix and self-signed fallback certificate generation
    expect(script).toContain("/etc/ssl/sparrowx/sparrowx-selfsigned.crt");
    expect(script).toContain("nginx -t");
    expect(script).toContain("Nginx syntax test passed");
    expect(script).toContain("Nginx self-healed into safe production state");

    // Assert WireGuard mesh restoration
    expect(script).toContain("/etc/wireguard/wg0.conf");
    expect(script).toContain(mockServer.wireguardIp);

    // Assert Firewall rules and ports
    expect(script).toContain("ufw allow 22/tcp");
    expect(script).toContain("ufw allow 80/tcp");
    expect(script).toContain("ufw allow 443/tcp");
    expect(script).toContain("ufw allow 51820/udp");

    // Assert final health check
    expect(script).toContain("RESTORE PROCESS COMPLETED SUCCESSFULLY");
    expect(script).toContain(mockServer.hostname);
  });

  it("generates a complete backup bundle with manifest, Nginx config, and WireGuard peer settings", () => {
    const bundle = generateSparrowxBackupBundle(mockServer);

    expect(bundle.manifest.system).toBe("SparrowX Backup System");
    expect(bundle.server.hostname).toBe("spx-ryzen9-mum01.sparrowx.net");
    expect(bundle.defaultNginxConfig).toContain("listen 80;");
    expect(bundle.defaultNginxConfig).toContain("server_name spx-ryzen9-mum01.sparrowx.net");
    expect(bundle.defaultWireguardConfig).toContain("Address = 10.66.1.142/24");
    expect(bundle.script.length).toBeGreaterThan(500);
  });

  it("serves executable shell script via /api/infra/servers/backup route handler", async () => {
    const { Route } = await import("@/routes/api/infra/servers/backup");
    const getHandler = (Route.options.server as any)?.handlers?.GET;
    expect(getHandler).toBeDefined();

    const req = new Request(
      "https://infra.sparrowx.net/api/infra/servers/backup?serverId=srv-mumbai-01&download=script",
    );
    const res = await getHandler({ request: req });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("shellscript");
    const text = await res.text();
    expect(text).toContain("SPARROWX BACKUP SYSTEM");
    expect(text).toContain("#!/usr/bin/env bash");
  });
});
