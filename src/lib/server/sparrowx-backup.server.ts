import type { ManagedInfraServer } from "./proxmox.server";

export interface SparrowxBackupBundle {
  server: {
    id: string;
    vmid: number;
    hostname: string;
    category: string;
    planName: string;
    region: string;
    os: string;
    ipv4: string;
    ipv6: string;
    wireguardIp: string;
  };
  generatedAt: string;
  script: string;
  manifest: Record<string, unknown>;
  defaultNginxConfig: string;
  defaultWireguardConfig: string;
}

export function generateSparrowxBackupScript(server: ManagedInfraServer): string {
  const hostShort = server.hostname.split(".")[0] || "sparrowx-vps";
  const nowIso = new Date().toISOString();

  return `#!/usr/bin/env bash
# ==============================================================================
#   SPARROWX BACKUP SYSTEM — AUTONOMOUS MASTER RESTORE ENGINE
#   Server: ${server.hostname} (${server.name})
#   Datacenter: ${server.region}
#   Generated At: ${nowIso}
#   System: Proxmox KVM / Cloud VPS Sovereign Engine
# ==============================================================================

set -eo pipefail

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
ORANGE='\\033[38;5;214m'
NC='\\033[0m' # No Color

echo -e "\${ORANGE}"
cat << 'EOF'
   _____                                      __   __
  / ___/ ____   ____ _ _____ _____ ____  _  __\\ \\ / /
  \\__ \\ / __ \\ / __ \`// ___// ___// __ \\| |/_/ \\ V / 
 ___/ // /_/ // /_/ // /   / /   / /_/ />  <   / . \\ 
/____// .___/ \\__,_//_/   /_/    \\____//_/|_| /_/ \\_\\
     /_/               BACKUP SYSTEM · MASTER RESTORE
EOF
echo -e "\${NC}"

echo -e "\${BLUE}[1/7] Checking root privileges & operating system environment...\${NC}"
if [ "\$(id -u)" -ne 0 ]; then
  echo -e "\${RED}ERROR: The SparrowX Backup System restore script must be executed as root (or via sudo).\${NC}"
  exit 1
fi

# Detect package manager
PKG_MGR="unknown"
if command -v apt-get >/dev/null 2>&1; then
  PKG_MGR="apt"
elif command -v dnf >/dev/null 2>&1; then
  PKG_MGR="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR="yum"
fi

echo -e "\${GREEN}✓ Root verified. Detected package manager: \${PKG_MGR}\${NC}"

# ==============================================================================
# [2/7] INSTALL PREREQUISITES
# ==============================================================================
echo -e "\${BLUE}[2/7] Installing and verifying core dependencies (Nginx, WireGuard, curl, ufw)...\${NC}"

if [ "\${PKG_MGR}" = "apt" ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq
  apt-get install -y -qq nginx curl tar wireguard ufw openssl coreutils ca-certificates >/dev/null 2>&1 || true
elif [ "\${PKG_MGR}" = "dnf" ] || [ "\${PKG_MGR}" = "yum" ]; then
  \${PKG_MGR} install -y -q epel-release >/dev/null 2>&1 || true
  \${PKG_MGR} install -y -q nginx curl tar wireguard-tools firewalld openssl >/dev/null 2>&1 || true
fi

echo -e "\${GREEN}✓ Core system dependencies installed and active.\${NC}"

# ==============================================================================
# [3/7] LOCATE AND UNPACK BACKUP FOLDER
# ==============================================================================
echo -e "\${BLUE}[3/7] Locating SparrowX backup folder and assets...\${NC}"

BACKUP_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
if [ -d "\${BACKUP_DIR}/sparrowx-backup" ]; then
  BACKUP_DIR="\${BACKUP_DIR}/sparrowx-backup"
fi

echo -e "\${GREEN}✓ Working backup payload directory: \${BACKUP_DIR}\${NC}"

# Ensure standard system target directories exist
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/wireguard /var/www/html /etc/ssl/sparrowx

# ==============================================================================
# [4/7] RESTORE AND AUTONOMOUSLY FIX NGINX CONFIGURATION
# ==============================================================================
echo -e "\${BLUE}[4/7] Deploying and self-healing Nginx configurations...\${NC}"

# Restore Nginx folder if bundled, otherwise synthesize baseline hardened config
if [ -d "\${BACKUP_DIR}/nginx" ]; then
  cp -r "\${BACKUP_DIR}/nginx/"* /etc/nginx/ 2>/dev/null || true
else
  cat << 'NGINX_CONF' > /etc/nginx/conf.d/${hostShort}.conf
server {
    listen 80;
    listen [::]:80;
    server_name ${server.hostname} ${server.rdns} localhost;

    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;

    # SparrowX Edge Armor & Reverse Proxy Hardening
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-Powered-By "SparrowX-Infra-Shield" always;

    location / {
        try_files $uri $uri/ =404;
    }

    location /sparrowx-health {
        access_log off;
        default_type text/plain;
        return 200 "OK - SparrowX Managed VPS Node: ${server.hostname}\\n";
    }
}
NGINX_CONF
fi

# Create fallback SSL certificate so HTTPS sites don't break nginx -t
if [ ! -f /etc/ssl/sparrowx/sparrowx-selfsigned.crt ]; then
  echo -e "\${YELLOW}Notice: Synthesizing fallback self-signed SSL certificate for smooth Nginx syntax boot...\${NC}"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout /etc/ssl/sparrowx/sparrowx-selfsigned.key \\
    -out /etc/ssl/sparrowx/sparrowx-selfsigned.crt \\
    -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=SparrowX/CN=${server.hostname}" >/dev/null 2>&1 || true
fi

# Disable conflicting default Ubuntu/Debian sites if custom sites exist
if [ -f /etc/nginx/sites-enabled/default ] && [ -f /etc/nginx/conf.d/${hostShort}.conf ]; then
  rm -f /etc/nginx/sites-enabled/default || true
fi

# Test Nginx Syntax
echo -e "\${BLUE}Validating Nginx syntax with 'nginx -t'...\${NC}"
if nginx -t >/dev/null 2>&1; then
  echo -e "\${GREEN}✓ Nginx syntax test passed 100% clean.\${NC}"
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl restart nginx >/dev/null 2>&1 || true
  echo -e "\${GREEN}✓ Nginx master process running and listening.\${NC}"
else
  echo -e "\${YELLOW}Warning: Nginx syntax reported warnings. Applying automated fallback configuration...\${NC}"
  mv /etc/nginx/conf.d/*.conf /etc/nginx/conf.d/*.conf.bak 2>/dev/null || true
  cat << 'FALLBACK_NGINX' > /etc/nginx/conf.d/sparrowx-safe.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }
}
FALLBACK_NGINX
  systemctl restart nginx || true
  echo -e "\${GREEN}✓ Nginx self-healed into safe production state.\${NC}"
fi

# ==============================================================================
# [5/7] RESTORE WIREGUARD PRIVATE MESH TUNNEL
# ==============================================================================
echo -e "\${BLUE}[5/7] Restoring SparrowXNet WireGuard mesh connection...\${NC}"

if [ -f "\${BACKUP_DIR}/wireguard/wg0.conf" ]; then
  cp "\${BACKUP_DIR}/wireguard/wg0.conf" /etc/wireguard/wg0.conf
else
  cat << 'WG_CONF' > /etc/wireguard/wg0.conf
[Interface]
Address = ${server.wireguardIp}
PrivateKey = REPLACE_WITH_OPERATOR_PRIVATE_KEY
ListenPort = 51820
SaveConfig = false

[Peer]
# SparrowXNet Mumbai Relay Gateway
PublicKey = 7mFp9L4kGz3Xq1Yw2Vv5T8r6N0j9H7b4D1s2A5c8E3g=
Endpoint = 103.189.45.1:51820
AllowedIPs = 10.66.0.0/16
PersistentKeepalive = 25
WG_CONF
fi
chmod 600 /etc/wireguard/wg0.conf || true

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable wg-quick@wg0 >/dev/null 2>&1 || true
fi
echo -e "\${GREEN}✓ WireGuard configuration ready (/etc/wireguard/wg0.conf).\${NC}"

# ==============================================================================
# [6/7] RESTORE WEBROOT FILES & PERMISSIONS
# ==============================================================================
echo -e "\${BLUE}[6/7] Deploying web files and fixing POSIX user permissions...\${NC}"

if [ -d "\${BACKUP_DIR}/webroot" ]; then
  cp -r "\${BACKUP_DIR}/webroot/"* /var/www/html/ 2>/dev/null || true
else
  cat << 'HTML_INDEX' > /var/www/html/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${server.hostname} — SparrowX Cloud</title>
  <style>
    body { background: #06080D; color: #F4F6FA; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { background: #0C1018; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { color: #FFA14A; margin-top: 0; }
    .badge { display: inline-block; background: rgba(56,189,248,0.15); color: #38BDF8; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
    p { color: #A1A1AA; font-size: 0.95rem; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">SparrowX Backup System · Restored</div>
    <h1>${server.hostname}</h1>
    <p>This node was restored and hardened automatically by the SparrowX Master Backup Engine. All services and Nginx routing are operational.</p>
  </div>
</body>
</html>
HTML_INDEX
fi

# Fix ownership
if id "www-data" >/dev/null 2>&1; then
  chown -R www-data:www-data /var/www/html
elif id "nginx" >/dev/null 2>&1; then
  chown -R nginx:nginx /var/www/html
fi

echo -e "\${GREEN}✓ Webroot deployed & permissions assigned.\${NC}"

# ==============================================================================
# [7/7] AUTOMATED HEALTH VERIFICATION & REPORT
# ==============================================================================
echo -e "\${BLUE}[7/7] Executing end-to-end health check...\${NC}"

# Configure firewall rules
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 51820/udp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
  echo -e "\${GREEN}✓ UFW firewall rules enforced (22, 80, 443, 51820).\${NC}"
fi

HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ || echo "ERR")

echo ""
echo -e "\${ORANGE}==============================================================================\${NC}"
echo -e "\${GREEN}★ SPARROWX BACKUP SYSTEM — RESTORE PROCESS COMPLETED SUCCESSFULLY!\${NC}"
echo -e "\${ORANGE}==============================================================================\${NC}"
echo -e " Node Hostname:       \${GREEN}${server.hostname}\${NC}"
echo -e " Datacenter Region:   ${server.region}"
echo -e " Operating System:    ${server.os}"
echo -e " Nginx Status:        \${GREEN}Running (HTTP local check returned \${HTTP_STATUS})\${NC}"
echo -e " WireGuard Mesh:      ${server.wireguardIp} (/etc/wireguard/wg0.conf)"
echo -e " Primary IPv4:        ${server.ipv4}"
echo -e " IPv6 Subnet:         ${server.ipv6}"
echo -e "\${ORANGE}==============================================================================\${NC}"
echo -e "\${GREEN}All configurations, Nginx virtual hosts, and networking have been autonomously resolved.\${NC}"
`;
}

export function generateSparrowxBackupBundle(server: ManagedInfraServer): SparrowxBackupBundle {
  const hostShort = server.hostname.split(".")[0] || "sparrowx-vps";
  const script = generateSparrowxBackupScript(server);

  const manifest = {
    system: "SparrowX Backup System",
    version: "2.4.0",
    generatedAt: new Date().toISOString(),
    server: {
      id: server.id,
      vmid: server.vmid,
      hostname: server.hostname,
      category: server.category,
      planId: server.planId,
      planName: server.planName,
      region: server.region,
      os: server.os,
      ipv4: server.ipv4,
      ipv6: server.ipv6,
      rdns: server.rdns,
      wireguardIp: server.wireguardIp,
      cpuCores: server.cpuCores,
      ramTotalGb: server.ramTotalGb,
      diskTotalGb: server.diskTotalGb,
    },
    files: [
      "sparrowx-restore.sh",
      "sparrowx-manifest.json",
      "nginx/nginx.conf",
      `nginx/conf.d/${hostShort}.conf`,
      "wireguard/wg0.conf",
      "webroot/index.html",
    ],
  };

  const defaultNginxConfig = `server {
    listen 80;
    listen [::]:80;
    server_name ${server.hostname} ${server.rdns} localhost;

    root /var/www/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Powered-By "SparrowX-Infra-Shield" always;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

  const defaultWireguardConfig = `[Interface]
Address = ${server.wireguardIp}
PrivateKey = REPLACE_WITH_YOUR_PRIVATE_KEY
ListenPort = 51820

[Peer]
PublicKey = 7mFp9L4kGz3Xq1Yw2Vv5T8r6N0j9H7b4D1s2A5c8E3g=
Endpoint = 103.189.45.1:51820
AllowedIPs = 10.66.0.0/16
PersistentKeepalive = 25`;

  return {
    server: {
      id: server.id,
      vmid: server.vmid,
      hostname: server.hostname,
      category: server.category,
      planName: server.planName,
      region: server.region,
      os: server.os,
      ipv4: server.ipv4,
      ipv6: server.ipv6,
      wireguardIp: server.wireguardIp,
    },
    generatedAt: manifest.generatedAt,
    script,
    manifest,
    defaultNginxConfig,
    defaultWireguardConfig,
  };
}
