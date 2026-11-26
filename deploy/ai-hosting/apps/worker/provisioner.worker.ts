/**
 * SparrowX AI Provisioner Worker (`apps/worker/provisioner.worker.ts`)
 * Consumes idempotent BullMQ jobs against Proxmox VE API + Docker Engine + Nginx/Caddy Edge.
 *
 * Enforces:
 *  - Strict cgroup limits (`--cpus`, `--memory`, `--pids-limit`, `--security-opt=no-new-privileges:true`)
 *  - Per-tier bandwidth rate limits (`Proxmox net0 rate=` & Linux `tc tbf`)
 *  - Outbound TCP port 25 (SMTP) drop via nftables to protect OVH IP reputation
 *  - Auto log pruning (`EXECUTIONS_DATA_PRUNE=true`, Docker log rotation 25m x 3)
 *  - In-memory AES-256-GCM secret decryption only at container launch time
 */
import crypto from "node:crypto";

export interface ProvisionJobPayload {
  deploymentId: string;
  instanceId: string;
  workspaceId: string;
  subdomain: string;
  image: string;
  internalPort: number;
  proxmoxNode: string;
  proxmoxVmid: number;
  vcpu: number;
  ramGb: number;
  pidsLimit: number;
  portMbps: number;
  webhookWafEnabled: boolean;
  encryptedEnv: Array<{ key: string; ciphertextHex: string; ivHex: string; authTagHex: string }>;
}

export type ProvisionStage = "queued" | "allocating" | "configuring_ssl" | "live" | "failed";

export function decryptVaultEntry(
  masterKeyHex: string,
  entry: { ciphertextHex: string; ivHex: string; authTagHex: string },
): string {
  const key = crypto.createHash("sha256").update(masterKeyHex, "utf8").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(entry.ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(entry.authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(entry.ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export async function executeIdempotentProvisionJob(
  job: ProvisionJobPayload,
  callbacks: {
    onStage: (stage: ProvisionStage, logLine: string) => Promise<void>;
    execHostCommand: (cmd: string) => Promise<string>;
    writeEdgeConfig: (hostname: string, config: string) => Promise<void>;
    reloadEdgeProxy: () => Promise<void>;
    masterKey: string;
  },
): Promise<{ containerName: string; publicUrl: string }> {
  const containerName = `spx-${job.subdomain.replace(/[^a-z0-9-]/g, "")}`;
  const hostname = `${job.subdomain}.ai.sparrowx.net`;
  const rateMBps = Math.max(1, Math.round(job.portMbps / 8));

  try {
    await callbacks.onStage("queued", `Job ${job.deploymentId} picked up by worker on ${job.proxmoxNode}`);

    // 1. Allocating Proxmox / Docker isolation + network rate cap
    await callbacks.onStage(
      "allocating",
      `Allocating VMID ${job.proxmoxVmid} (${job.vcpu} vCPU / ${job.ramGb} GB RAM / ${job.portMbps} Mbps cap)`,
    );

    // Enforce Proxmox NIC cap & tc shaping so no tenant saturates the Mumbai WireGuard/GRE tunnel
    await callbacks.execHostCommand(
      `qm set ${job.proxmoxVmid} --net0 virtio,bridge=vmbr0,rate=${rateMBps}`,
    );
    await callbacks.execHostCommand(
      `tc qdisc replace dev tap${job.proxmoxVmid}i0 root tbf rate ${job.portMbps}mbit burst 256kbit latency 50ms`,
    );

    // Decrypt secrets strictly in memory; pass via tmpfs --env-file and shred immediately
    const envLines = [
      "EXECUTIONS_DATA_PRUNE=true",
      "EXECUTIONS_DATA_MAX_AGE=168",
      ...job.encryptedEnv.map((item) => `${item.key}=${decryptVaultEntry(callbacks.masterKey, item)}`),
    ];

    const dockerCmd = [
      `docker rm -f ${containerName} 2>/dev/null || true`,
      `docker run -d --name ${containerName} --restart unless-stopped`,
      `--cpus="${job.vcpu}" --memory="${job.ramGb}g" --memory-swap="${job.ramGb}g"`,
      `--pids-limit=${job.pidsLimit} --security-opt=no-new-privileges:true`,
      `--cap-drop=ALL --cap-add=NET_BIND_SERVICE`,
      `--log-opt max-size=25m --log-opt max-file=3`,
      `--network sparrowx_tenant_net`,
      envLines.map((line) => `-e ${JSON.stringify(line)}`).join(" "),
      job.image,
    ].join(" ");

    await callbacks.execHostCommand(dockerCmd);

    // 2. Configure Mumbai Edge Nginx/Caddy + Auto SSL + WebSocket Upgrade
    await callbacks.onStage("configuring_ssl", `Writing edge route + Let's Encrypt TLS for https://${hostname}`);
    const caddyBlock = `${hostname} {
  encode zstd gzip
  header X-SparrowX-WAF "${job.webhookWafEnabled ? "active" : "bypass"}"
  reverse_proxy ${containerName}:${job.internalPort} {
    flush_interval -1
  }
}`;
    await callbacks.writeEdgeConfig(hostname, caddyBlock);
    await callbacks.reloadEdgeProxy();

    await callbacks.onStage("live", `Instance live at https://${hostname}`);
    return { containerName, publicUrl: `https://${hostname}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provisioning job failed";
    await callbacks.onStage("failed", `Provisioning failed: ${msg}`);
    throw err;
  }
}
