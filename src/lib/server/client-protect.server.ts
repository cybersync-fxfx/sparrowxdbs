/**
 * Server-side SparrowX Client VPS Protection Bundle Generator & Heartbeat Registry.
 * Binds client username + email to a unique Agent ID and cryptographically hashed VPS token,
 * and produces a self-contained Ubuntu/Debian protection script the client runs on their VPS.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "./config.server";
import { timingSafeEqual } from "./crypto.server";

export interface RegisteredClientVps {
  agentId: string;
  tenantId: string;
  username: string;
  email: string;
  tokenHash: string;
  tokenFingerprint: string;
  ports: string;
  guardIp: string;
  status: "PROVISIONED" | "PROTECTED" | "OFFLINE";
  hostname?: string | undefined;
  publicIp?: string | undefined;
  load1m?: string | undefined;
  synRecv?: number | undefined;
  createdAt: string;
  lastSeen?: string | undefined;
}

// Strict allowlist prevents shell metacharacters (", $, `, \) inside generated bash scripts
const EMAIL_RE = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,190}\.[a-zA-Z]{2,24}$/;

let registryLock: Promise<unknown> = Promise.resolve();
function withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = registryLock.then(fn, fn);
  registryLock = next.catch(() => {});
  return next;
}

function getRegistryPath(): string {
  const dataDir = env("SPARROWX_DATA_DIR") || resolve(process.cwd(), "data");
  return resolve(dataDir, "client-vps-registry.json");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sanitizeClientUsername(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  return (slug || "client").slice(0, 32);
}

export function sanitizePortsCsv(raw?: string): string {
  const items = String(raw || "80,443")
    .split(",")
    .map((s) => s.trim().replace(/[^0-9a-zA-Z/]/g, ""))
    .filter((s) => /^\d{1,5}(\/(tcp|udp))?$/i.test(s));
  return items.length > 0 ? items.slice(0, 20).join(",") : "80,443";
}

export async function readClientVpsRegistry(): Promise<RegisteredClientVps[]> {
  try {
    const raw = await readFile(getRegistryPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RegisteredClientVps[]) : [];
  } catch {
    return [];
  }
}

export async function writeClientVpsRegistry(entries: RegisteredClientVps[]): Promise<void> {
  const filePath = getRegistryPath();
  await mkdir(resolve(filePath, ".."), { recursive: true });
  await writeFile(filePath, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

export function renderClientProtectionScript(input: {
  username: string;
  email: string;
  agentId: string;
  tenantId: string;
  clientToken: string;
  tokenFingerprint: string;
  masterDomain: string;
  guardIp: string;
  ports: string;
  enableXdp: boolean;
  createdAt: string;
}): string {
  const enableXdpFlag = input.enableXdp ? "1" : "0";
  return [
    "#!/usr/bin/env bash",
    "# ==============================================================================",
    "#  SPARROWX CLIENT VPS ANTI-DDOS & CYBERSECURITY PROTECTION INSTALLER",
    "# ==============================================================================",
    `#  Bound Account  : ${input.username} <${input.email}>`,
    `#  Agent ID       : ${input.agentId}`,
    `#  Tenant ID      : ${input.tenantId}`,
    `#  Token SHA-256  : ${input.tokenFingerprint}`,
    `#  Master Network : https://${input.masterDomain}`,
    `#  Generated At   : ${input.createdAt}`,
    "#",
    "#  Run on the client Linux VPS (Ubuntu/Debian) as root:",
    '#      sudo bash "$(basename "$0")"',
    "# ==============================================================================",
    "set -euo pipefail",
    "",
    `SPARROWX_CLIENT_USERNAME="${input.username}"`,
    `SPARROWX_CLIENT_EMAIL="${input.email}"`,
    `SPARROWX_AGENT_ID="${input.agentId}"`,
    `SPARROWX_TENANT_ID="${input.tenantId}"`,
    `SPARROWX_CLIENT_TOKEN="${input.clientToken}"`,
    `SPARROWX_MASTER_DOMAIN="${input.masterDomain}"`,
    `SPARROWX_GUARD_IP="${input.guardIp}"`,
    `SPARROWX_PROTECTED_PORTS="${input.ports}"`,
    `SPARROWX_ENABLE_XDP="${enableXdpFlag}"`,
    "",
    'if [ "$(id -u)" -ne 0 ]; then',
    '  echo "[ERR] Please run as root: sudo bash $0" >&2',
    "  exit 1",
    "fi",
    "",
    'PRIMARY_IFACE="$(ip route show default 2>/dev/null | awk \'/default/ {print $5; exit}\' || echo eth0)"',
    'VPS_PUBLIC_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk \'{print $1}\' || echo unknown)"',
    'SSH_PORT="$(sshd -T 2>/dev/null | awk \'/^port / {print $2; exit}\' || echo 22)"',
    '[ -z "${SSH_PORT}" ] && SSH_PORT="22"',
    "",
    'echo "[1/5] Binding VPS identity (${SPARROWX_CLIENT_USERNAME} <${SPARROWX_CLIENT_EMAIL}>)..."',
    "mkdir -p /etc/sparrowx /opt/sparrowx/xdp /var/log/sparrowx",
    "chmod 700 /etc/sparrowx",
    "cat > /etc/sparrowx/client.conf <<EOF_CONF",
    'SPARROWX_CLIENT_USERNAME="${SPARROWX_CLIENT_USERNAME}"',
    'SPARROWX_CLIENT_EMAIL="${SPARROWX_CLIENT_EMAIL}"',
    'SPARROWX_AGENT_ID="${SPARROWX_AGENT_ID}"',
    'SPARROWX_TENANT_ID="${SPARROWX_TENANT_ID}"',
    'SPARROWX_CLIENT_TOKEN="${SPARROWX_CLIENT_TOKEN}"',
    'SPARROWX_MASTER_DOMAIN="${SPARROWX_MASTER_DOMAIN}"',
    'SPARROWX_GUARD_IP="${SPARROWX_GUARD_IP}"',
    'SPARROWX_PRIMARY_IFACE="${PRIMARY_IFACE}"',
    'SPARROWX_VPS_PUBLIC_IP="${VPS_PUBLIC_IP}"',
    'SPARROWX_PROTECTED_PORTS="${SPARROWX_PROTECTED_PORTS}"',
    "EOF_CONF",
    "chmod 600 /etc/sparrowx/client.conf",
    "",
    'echo "[2/5] Installing firewall & intrusion prevention tools..."',
    "if command -v apt-get >/dev/null 2>&1; then",
    "  export DEBIAN_FRONTEND=noninteractive",
    "  apt-get update -qq >/dev/null 2>&1 || true",
    "  apt-get install -y -qq ufw fail2ban nftables iproute2 curl ca-certificates python3 >/dev/null 2>&1 || true",
    "fi",
    "",
    'echo "[3/5] Applying Linux kernel L3/L4 SYN-flood & anti-spoofing sysctl hardening..."',
    "cat > /etc/sysctl.d/99-sparrowx-ddos.conf <<'EOF_SYSCTL'",
    "net.ipv4.tcp_syncookies = 1",
    "net.ipv4.tcp_max_syn_backlog = 16384",
    "net.ipv4.tcp_synack_retries = 2",
    "net.ipv4.tcp_rfc1337 = 1",
    "net.ipv4.conf.all.rp_filter = 1",
    "net.ipv4.conf.default.rp_filter = 1",
    "net.ipv4.icmp_echo_ignore_broadcasts = 1",
    "net.core.somaxconn = 65535",
    "net.netfilter.nf_conntrack_max = 524288",
    "EOF_SYSCTL",
    "sysctl --system >/dev/null 2>&1 || true",
    "",
    'echo "[4/5] Arming UFW firewall & Fail2Ban jails (preserving SSH :${SSH_PORT})..."',
    "if command -v ufw >/dev/null 2>&1; then",
    "  ufw --force default deny incoming >/dev/null 2>&1 || true",
    "  ufw --force default allow outgoing >/dev/null 2>&1 || true",
    '  ufw limit "${SSH_PORT}/tcp" comment "SparrowX rate-limited SSH" >/dev/null 2>&1 || true',
    '  IFS=\',\' read -ra PORT_LIST <<< "${SPARROWX_PROTECTED_PORTS}"',
    '  for p in "${PORT_LIST[@]}"; do',
    '    p_clean="$(echo "$p" | tr -dc \'0-9a-zA-Z/\')"',
    '    [ -z "${p_clean}" ] && continue',
    '    [[ "${p_clean}" == *"/"* ]] && ufw allow "${p_clean}" >/dev/null 2>&1 || ufw allow "${p_clean}/tcp" >/dev/null 2>&1 || true',
    "  done",
    '  if [ -n "${SPARROWX_GUARD_IP}" ]; then',
    '    ufw insert 1 allow from "${SPARROWX_GUARD_IP}" to any comment "SparrowX Edge Guard" >/dev/null 2>&1 || true',
    "  fi",
    "  ufw --force enable >/dev/null 2>&1 || true",
    "fi",
    "if command -v fail2ban-client >/dev/null 2>&1; then",
    "  mkdir -p /etc/fail2ban/jail.d",
    "  cat > /etc/fail2ban/jail.d/sparrowx-client.local <<EOF_F2B",
    "[sshd]",
    "enabled = true",
    'port = ${SSH_PORT}',
    "maxretry = 4",
    "bantime = 2h",
    "EOF_F2B",
    "  systemctl enable --now fail2ban >/dev/null 2>&1 || systemctl restart fail2ban >/dev/null 2>&1 || true",
    "fi",
    "",
    'echo "[5/5] Installing SparrowX live NOC CLI & 60s heartbeat agent..."',
    'if [ "${SPARROWX_ENABLE_XDP}" = "1" ]; then',
    '  curl -fsSL --max-time 8 "https://${SPARROWX_MASTER_DOMAIN}/sparrowx-noc.py" -o /usr/local/bin/sparrowx-noc 2>/dev/null && chmod +x /usr/local/bin/sparrowx-noc || true',
    "fi",
    "cat > /usr/local/bin/sparrowx-client-heartbeat <<'EOF_HB'",
    "#!/usr/bin/env bash",
    "set -u",
    "[ -f /etc/sparrowx/client.conf ] && source /etc/sparrowx/client.conf",
    'HOSTNAME_NOW="$(hostname -f 2>/dev/null || hostname)"',
    'LOAD_NOW="$(awk \'{print $1}\' /proc/loadavg 2>/dev/null || echo 0)"',
    'SYN_NOW="$(ss -tan state syn-recv 2>/dev/null | tail -n +2 | wc -l | tr -d \' \' || echo 0)"',
    'curl -fsS --max-time 5 -X POST "https://${SPARROWX_MASTER_DOMAIN}/api/client-protect/heartbeat" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "X-SparrowX-Client-Token: ${SPARROWX_CLIENT_TOKEN}" \\',
    '  -d "{\\"agentId\\":\\"${SPARROWX_AGENT_ID}\\",\\"username\\":\\"${SPARROWX_CLIENT_USERNAME}\\",\\"email\\":\\"${SPARROWX_CLIENT_EMAIL}\\",\\"hostname\\":\\"${HOSTNAME_NOW}\\",\\"publicIp\\":\\"${SPARROWX_VPS_PUBLIC_IP}\\",\\"load1m\\":\\"${LOAD_NOW}\\",\\"synRecv\\":${SYN_NOW},\\"status\\":\\"PROTECTED\\"}" >/dev/null 2>&1 || true',
    "EOF_HB",
    "chmod +x /usr/local/bin/sparrowx-client-heartbeat",
    "if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then",
    "  cat > /etc/systemd/system/sparrowx-shield-heartbeat.service <<'EOF_SVC'",
    "[Unit]",
    "Description=SparrowX Client VPS Protection Heartbeat",
    "After=network-online.target",
    "[Service]",
    "Type=oneshot",
    "ExecStart=/usr/local/bin/sparrowx-client-heartbeat",
    "EOF_SVC",
    "  cat > /etc/systemd/system/sparrowx-shield-heartbeat.timer <<'EOF_TMR'",
    "[Unit]",
    "Description=SparrowX Client VPS Heartbeat Timer",
    "[Timer]",
    "OnBootSec=15s",
    "OnUnitActiveSec=60s",
    "Unit=sparrowx-shield-heartbeat.service",
    "[Install]",
    "WantedBy=timers.target",
    "EOF_TMR",
    "  systemctl daemon-reload >/dev/null 2>&1 || true",
    "  systemctl enable --now sparrowx-shield-heartbeat.timer >/dev/null 2>&1 || true",
    "  /usr/local/bin/sparrowx-client-heartbeat || true",
    "fi",
    "",
    'echo ""',
    'echo "✓ VPS PROTECTED BY SPARROWX — Agent ${SPARROWX_AGENT_ID} (${SPARROWX_CLIENT_USERNAME} <${SPARROWX_CLIENT_EMAIL}>)"',
    'echo "  Run: sudo sparrowx-noc  to view live traffic & filtration."',
    "",
  ].join("\n");
}

export async function createBoundClientVpsBundle(input: {
  username: string;
  email: string;
  ports?: string | undefined;
  guardIp?: string | undefined;
  enableXdp?: boolean | undefined;
}): Promise<{
  record: RegisteredClientVps;
  filename: string;
  script: string;
}> {
  const emailClean = String(input.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(emailClean)) {
    throw new Error("A valid client account email address is required.");
  }
  const username = sanitizeClientUsername(input.username || emailClean.split("@")[0] || "client");
  const shortRand = randomBytes(4).toString("hex");
  const agentId = `spx_${username.slice(0, 8)}_${shortRand}`;
  const tenantId = `TNT-${username.slice(0, 8).toUpperCase()}-${shortRand.slice(0, 4).toUpperCase()}`;
  const clientToken = `spx_vps_${randomBytes(24).toString("base64url")}`;
  const tokenHash = sha256Hex(clientToken);
  const tokenFingerprint = tokenHash.slice(0, 16);
  const createdAt = new Date().toISOString();
  const ports = sanitizePortsCsv(input.ports);
  const guardIp = String(input.guardIp || env("SPARROWX_PUBLIC_IP") || "").replace(/[^0-9.]/g, "");
  const masterDomain = env("SPARROWX_DOMAIN") || "sparrowx.net";
  const enableXdp = input.enableXdp !== false;

  const record: RegisteredClientVps = {
    agentId,
    tenantId,
    username,
    email: emailClean,
    tokenHash,
    tokenFingerprint,
    ports,
    guardIp,
    status: "PROVISIONED",
    createdAt,
  };

  await withRegistryLock(async () => {
    const existing = await readClientVpsRegistry();
    existing.unshift(record);
    await writeClientVpsRegistry(existing.slice(0, 500));
  });

  const filename = `sparrowx-protect-${username}-${shortRand}.sh`;
  const script = renderClientProtectionScript({
    username,
    email: emailClean,
    agentId,
    tenantId,
    clientToken,
    tokenFingerprint,
    masterDomain,
    guardIp,
    ports,
    enableXdp,
    createdAt,
  });

  return { record, filename, script };
}

export async function recordClientVpsHeartbeat(input: {
  token: string;
  agentId: string;
  hostname?: string | undefined;
  publicIp?: string | undefined;
  load1m?: string | undefined;
  synRecv?: number | undefined;
}): Promise<RegisteredClientVps | null> {
  if (!input.token || !input.agentId) return null;
  const incomingHash = sha256Hex(input.token.trim());
  return withRegistryLock(async () => {
    const entries = await readClientVpsRegistry();
    const idx = entries.findIndex(
      (e) => e.agentId === input.agentId && timingSafeEqual(e.tokenHash, incomingHash),
    );
    if (idx === -1) return null;

    const updated: RegisteredClientVps = {
      ...entries[idx]!,
      status: "PROTECTED",
      hostname: input.hostname ? String(input.hostname).slice(0, 120) : entries[idx]!.hostname,
      publicIp: input.publicIp ? String(input.publicIp).slice(0, 64) : entries[idx]!.publicIp,
      load1m: input.load1m ? String(input.load1m).slice(0, 16) : entries[idx]!.load1m,
      synRecv: typeof input.synRecv === "number" ? input.synRecv : entries[idx]!.synRecv,
      lastSeen: new Date().toISOString(),
    };
    entries[idx] = updated;
    await writeClientVpsRegistry(entries);
    return updated;
  });
}
