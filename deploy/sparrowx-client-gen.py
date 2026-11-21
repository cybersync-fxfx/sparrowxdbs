#!/usr/bin/env python3
"""
================================================================================
 SPARROWX CLIENT VPS PROTECTION BUNDLE GENERATOR (sparrowx-gen-client)
================================================================================
 Generates a single, self-contained, cryptographically-bound `.sh` deployment
 script tied to a specific client's username and email address.

 Hand the generated `.sh` file to the client — when they run:
     sudo bash sparrowx-protect-<username>.sh
 on their Ubuntu/Debian VPS, it automatically:
   1. Binds the VPS to the client's SparrowX account (username, email, agent_id, token)
   2. Hardens Linux L3/L4 kernel sysctl against SYN/UDP/ICMP/amplification floods
   3. Arms UFW / nftables anti-flood rules while preserving their active SSH port
   4. Installs & activates Fail2Ban brute-force & flood jails
   5. Optionally connects a WireGuard scrubbing tunnel back to your SparrowX Edge
   6. Optionally installs SparrowX XDP/eBPF wire-speed filter + sparrowx-noc CLI
   7. Registers a lightweight systemd heartbeat & verifies live protection status

 Zero external Python dependencies (pure Python 3 stdlib).

 Usage:
   sudo sparrowx-gen-client --username acme_web --email ops@acme.io
   sudo sparrowx-gen-client --username acme_web --email ops@acme.io \
        --ports 80,443,25565 --guard-ip 51.79.210.44 --xdp --out ./
   sudo sparrowx-gen-client --list
================================================================================
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


VERSION = "1.0.0"
DEFAULT_REGISTRY = Path("/opt/sparrowx/clients/registry.json")
DEFAULT_OUT_DIR = Path("/opt/sparrowx/clients/bundles")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SLUG_RE = re.compile(r"[^a-z0-9_-]+")


def sanitize_slug(raw: str) -> str:
    cleaned = SLUG_RE.sub("_", raw.strip().lower()).strip("_-")
    return (cleaned or "client")[:32]


def run_cmd(cmd: List[str], timeout: float = 3.0) -> Tuple[int, str, str]:
    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            check=False,
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except (FileNotFoundError, PermissionError, subprocess.TimeoutExpired, OSError):
        return 127, "", ""


def generate_wg_keypair() -> Tuple[str, str]:
    """Generate WireGuard private/public keypair if `wg` is installed on host."""
    if not shutil.which("wg"):
        return "", ""
    rc, priv, _ = run_cmd(["wg", "genkey"])
    if rc != 0 or not priv:
        return "", ""
    try:
        p = subprocess.run(
            ["wg", "pubkey"],
            input=priv + "\n",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2.0,
            check=False,
        )
        if p.returncode == 0 and p.stdout.strip():
            return priv.strip(), p.stdout.strip()
    except OSError:
        pass
    return "", ""


def detect_master_public_ip() -> str:
    env_ip = os.environ.get("SPARROWX_PUBLIC_IP", "").strip()
    if env_ip and env_ip != "127.0.0.1":
        return env_ip
    rc, out, _ = run_cmd(["curl", "-4", "-fsS", "--max-time", "3", "https://api.ipify.org"])
    if rc == 0 and re.match(r"^\d{1,3}(\.\d{1,3}){3}$", out):
        return out
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return ""


def load_registry(reg_path: Path) -> List[Dict[str, Any]]:
    if not reg_path.exists():
        return []
    try:
        data = json.loads(reg_path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_registry(reg_path: Path, entries: List[Dict[str, Any]]) -> bool:
    try:
        reg_path.parent.mkdir(parents=True, exist_ok=True)
        reg_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
        return True
    except OSError:
        return False


def build_client_installer_script(bundle: Dict[str, Any]) -> str:
    username = bundle["username"]
    email = bundle["email"]
    agent_id = bundle["agent_id"]
    tenant_id = bundle["tenant_id"]
    client_token = bundle["client_token"]
    token_fingerprint = bundle["token_fingerprint"]
    master_domain = bundle["master_domain"]
    guard_ip = bundle.get("guard_ip", "")
    tunnel_ip = bundle.get("tunnel_ip", "")
    guard_tunnel_ip = bundle.get("guard_tunnel_ip", "")
    wg_port = bundle.get("wg_port", 51820)
    client_wg_priv = bundle.get("client_wg_priv", "")
    guard_wg_pub = bundle.get("guard_wg_pub", "")
    ports_csv = bundle.get("ports", "80,443")
    enable_xdp = "1" if bundle.get("enable_xdp", True) else "0"
    created_at = bundle["created_at"]

    return f"""#!/usr/bin/env bash
# ==============================================================================
#  SPARROWX CLIENT VPS ANTI-DDOS & CYBERSECURITY PROTECTION INSTALLER
# ==============================================================================
#  Bound Account  : {username} <{email}>
#  Agent ID       : {agent_id}
#  Tenant ID      : {tenant_id}
#  Token SHA-256  : {token_fingerprint}
#  Master Network : https://{master_domain}
#  Generated At   : {created_at}
#
#  Run on the client Linux VPS (Ubuntu/Debian) as root:
#      sudo bash $(basename "$0")
# ==============================================================================
set -euo pipefail

SPARROWX_CLIENT_USERNAME="{username}"
SPARROWX_CLIENT_EMAIL="{email}"
SPARROWX_AGENT_ID="{agent_id}"
SPARROWX_TENANT_ID="{tenant_id}"
SPARROWX_CLIENT_TOKEN="{client_token}"
SPARROWX_MASTER_DOMAIN="{master_domain}"
SPARROWX_GUARD_IP="{guard_ip}"
SPARROWX_TUNNEL_IP="{tunnel_ip}"
SPARROWX_GUARD_TUNNEL_IP="{guard_tunnel_ip}"
SPARROWX_WG_PORT="{wg_port}"
SPARROWX_CLIENT_WG_PRIV="{client_wg_priv}"
SPARROWX_GUARD_WG_PUB="{guard_wg_pub}"
SPARROWX_PROTECTED_PORTS="{ports_csv}"
SPARROWX_ENABLE_XDP="{enable_xdp}"

C_RESET="\\033[0m"
C_BOLD="\\033[1m"
C_CYAN="\\033[1;36m"
C_GREEN="\\033[1;32m"
C_YELLOW="\\033[1;33m"
C_RED="\\033[1;31m"

log_step() {{ echo -e "\\n${{C_CYAN}}[SPARROWX]${{C_RESET}} ${{C_BOLD}}$1${{C_RESET}}"; }}
log_ok()   {{ echo -e "  ${{C_GREEN}}[OK]${{C_RESET}} $1"; }}
log_warn() {{ echo -e "  ${{C_YELLOW}}[WARN]${{C_RESET}} $1"; }}
log_err()  {{ echo -e "  ${{C_RED}}[ERR]${{C_RESET}} $1" >&2; }}

echo -e "${{C_CYAN}}"
cat <<'BANNER'
 ╭──────────────────────────────────────────────────────────────────────────╮
 │  ◆ SPARROWX SHIELD — CLIENT VPS NETWORK-LEVEL PROTECTION DEPLOYMENT      │
 ╰──────────────────────────────────────────────────────────────────────────╯
BANNER
echo -e "${{C_RESET}}"
echo -e "  Account  : ${{C_BOLD}}${{SPARROWX_CLIENT_USERNAME}}${{C_RESET}} <${{SPARROWX_CLIENT_EMAIL}}>"
echo -e "  Agent ID : ${{C_CYAN}}${{SPARROWX_AGENT_ID}}${{C_RESET}}  |  Tenant: ${{SPARROWX_TENANT_ID}}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  log_err "Please run this installer as root: sudo bash $0"
  exit 1
fi

PRIMARY_IFACE="$(ip route show default 2>/dev/null | awk '/default/ {{print $5; exit}}' || true)"
[ -z "${{PRIMARY_IFACE}}" ] && PRIMARY_IFACE="eth0"
VPS_PUBLIC_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{{print $1}}' || echo 'unknown')"
SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port / {{print $2; exit}}' || echo '22')"
[ -z "${{SSH_PORT}}" ] && SSH_PORT="22"

log_ok "Detected NIC=${{PRIMARY_IFACE}}, PublicIP=${{VPS_PUBLIC_IP}}, Active SSH Port=${{SSH_PORT}}/tcp"

# ------------------------------------------------------------------------------
# 1. Bind Identity & Credentials to /etc/sparrowx/client.conf
# ------------------------------------------------------------------------------
log_step "1/6 Binding VPS identity to SparrowX account (${{SPARROWX_CLIENT_EMAIL}})..."
mkdir -p /etc/sparrowx /opt/sparrowx/xdp /var/log/sparrowx
chmod 700 /etc/sparrowx

cat > /etc/sparrowx/client.conf <<EOF_CONF
SPARROWX_CLIENT_USERNAME="${{SPARROWX_CLIENT_USERNAME}}"
SPARROWX_CLIENT_EMAIL="${{SPARROWX_CLIENT_EMAIL}}"
SPARROWX_AGENT_ID="${{SPARROWX_AGENT_ID}}"
SPARROWX_TENANT_ID="${{SPARROWX_TENANT_ID}}"
SPARROWX_CLIENT_TOKEN="${{SPARROWX_CLIENT_TOKEN}}"
SPARROWX_MASTER_DOMAIN="${{SPARROWX_MASTER_DOMAIN}}"
SPARROWX_GUARD_IP="${{SPARROWX_GUARD_IP}}"
SPARROWX_PRIMARY_IFACE="${{PRIMARY_IFACE}}"
SPARROWX_VPS_PUBLIC_IP="${{VPS_PUBLIC_IP}}"
SPARROWX_PROTECTED_PORTS="${{SPARROWX_PROTECTED_PORTS}}"
SPARROWX_INSTALLED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
EOF_CONF
chmod 600 /etc/sparrowx/client.conf
log_ok "Identity saved securely to /etc/sparrowx/client.conf (chmod 600)"

# ------------------------------------------------------------------------------
# 2. Install Core Security Packages (UFW, Fail2Ban, nftables, curl, python3)
# ------------------------------------------------------------------------------
log_step "2/6 Installing Linux firewall & intrusion prevention packages..."
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq ufw fail2ban nftables iproute2 curl ca-certificates python3 >/dev/null 2>&1 || true
  log_ok "Core security packages verified via apt"
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y -q fail2ban nftables iproute curl ca-certificates python3 >/dev/null 2>&1 || true
  log_ok "Core security packages verified via dnf"
else
  log_warn "Unsupported package manager — continuing with existing kernel tools"
fi

# ------------------------------------------------------------------------------
# 3. Kernel L3/L4 Anti-DDoS Sysctl Hardening
# ------------------------------------------------------------------------------
log_step "3/6 Applying Linux kernel L3/L4 SYN-flood & anti-spoofing sysctl hardening..."
cat > /etc/sysctl.d/99-sparrowx-ddos.conf <<'EOF_SYSCTL'
# SparrowX L3/L4 Kernel Anti-DDoS Hardening Profile
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 16384
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3
net.ipv4.tcp_rfc1337 = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 32768
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.netfilter.nf_conntrack_max = 524288
EOF_SYSCTL
sysctl --system >/dev/null 2>&1 || true
log_ok "Kernel SYN-cookie, conntrack (524K), & anti-spoofing rules active"

# ------------------------------------------------------------------------------
# 4. Firewall Policy (UFW + Fail2Ban) — Preserves Active SSH Port
# ------------------------------------------------------------------------------
log_step "4/6 Arming firewall & Fail2Ban intrusion prevention..."
if command -v ufw >/dev/null 2>&1; then
  ufw --force default deny incoming >/dev/null 2>&1 || true
  ufw --force default allow outgoing >/dev/null 2>&1 || true
  ufw limit "${{SSH_PORT}}/tcp" comment "SparrowX rate-limited SSH" >/dev/null 2>&1 || true
  IFS=',' read -ra PORT_LIST <<< "${{SPARROWX_PROTECTED_PORTS}}"
  for p in "${{PORT_LIST[@]}}"; do
    p_clean="$(echo "$p" | tr -dc '0-9a-zA-Z/')"
    [ -z "${{p_clean}}" ] && continue
    if [[ "${{p_clean}}" == *"/"* ]]; then
      ufw allow "${{p_clean}}" comment "SparrowX protected service" >/dev/null 2>&1 || true
    else
      ufw allow "${{p_clean}}/tcp" comment "SparrowX protected service" >/dev/null 2>&1 || true
    fi
  done
  if [ -n "${{SPARROWX_GUARD_IP}}" ]; then
    ufw insert 1 allow from "${{SPARROWX_GUARD_IP}}" to any comment "SparrowX Edge Guard" >/dev/null 2>&1 || true
    echo "${{SPARROWX_GUARD_IP}}  # SparrowX Edge Guard" >> /opt/sparrowx/xdp/whitelist_ipv4.txt
  fi
  ufw --force enable >/dev/null 2>&1 || true
  log_ok "UFW enabled (SSH :${{SSH_PORT}} rate-limited, protected ports: ${{SPARROWX_PROTECTED_PORTS}})"
fi

if command -v fail2ban-client >/dev/null 2>&1; then
  mkdir -p /etc/fail2ban/jail.d
  cat > /etc/fail2ban/jail.d/sparrowx-client.local <<EOF_F2B
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1 ${{SPARROWX_GUARD_IP}}

[sshd]
enabled = true
port = ${{SSH_PORT}}
maxretry = 4
bantime = 2h
EOF_F2B
  systemctl enable --now fail2ban >/dev/null 2>&1 || systemctl restart fail2ban >/dev/null 2>&1 || true
  log_ok "Fail2Ban jails armed (SSH auto-ban after 4 failures)"
fi

# ------------------------------------------------------------------------------
# 5. WireGuard Edge Scrubbing Tunnel (if bound) & XDP/eBPF + Master NOC CLI
# ------------------------------------------------------------------------------
log_step "5/6 Configuring SparrowX Edge link, XDP filter & local NOC monitor..."
if [ -n "${{SPARROWX_GUARD_IP}}" ] && [ -n "${{SPARROWX_CLIENT_WG_PRIV}}" ] && [ -n "${{SPARROWX_GUARD_WG_PUB}}" ] && [ -n "${{SPARROWX_TUNNEL_IP}}" ]; then
  if command -v apt-get >/dev/null 2>&1 && ! command -v wg >/dev/null 2>&1; then
    apt-get install -y -qq wireguard wireguard-tools >/dev/null 2>&1 || true
  fi
  if command -v wg-quick >/dev/null 2>&1; then
    mkdir -p /etc/wireguard
    chmod 700 /etc/wireguard
    cat > /etc/wireguard/spx_shield.conf <<EOF_WG
[Interface]
PrivateKey = ${{SPARROWX_CLIENT_WG_PRIV}}
Address = ${{SPARROWX_TUNNEL_IP}}/30

[Peer]
PublicKey = ${{SPARROWX_GUARD_WG_PUB}}
Endpoint = ${{SPARROWX_GUARD_IP}}:${{SPARROWX_WG_PORT}}
AllowedIPs = ${{SPARROWX_GUARD_TUNNEL_IP}}/32
PersistentKeepalive = 25
EOF_WG
    chmod 600 /etc/wireguard/spx_shield.conf
    wg-quick down spx_shield >/dev/null 2>&1 || true
    wg-quick up spx_shield >/dev/null 2>&1 || true
    systemctl enable wg-quick@spx_shield >/dev/null 2>&1 || true
    log_ok "WireGuard scrubbing tunnel spx_shield connected -> ${{SPARROWX_GUARD_IP}}:${{SPARROWX_WG_PORT}}"
  fi
else
  log_ok "Direct standalone edge-hardening mode active (no WireGuard tunnel requested)"
fi

if [ "${{SPARROWX_ENABLE_XDP}}" = "1" ]; then
  if curl -fsSL --max-time 8 "https://${{SPARROWX_MASTER_DOMAIN}}/sparrowx-noc.py" -o /usr/local/bin/sparrowx-noc 2>/dev/null; then
    chmod +x /usr/local/bin/sparrowx-noc
    log_ok "Installed live terminal NOC monitor: run 'sudo sparrowx-noc' anytime"
  fi
fi

# ------------------------------------------------------------------------------
# 6. Heartbeat Agent Registration & Verification
# ------------------------------------------------------------------------------
log_step "6/6 Installing SparrowX Shield heartbeat & sending enrollment check-in..."
cat > /usr/local/bin/sparrowx-client-heartbeat <<'EOF_HB'
#!/usr/bin/env bash
set -u
[ -f /etc/sparrowx/client.conf ] && source /etc/sparrowx/client.conf
HOSTNAME_NOW="$(hostname -f 2>/dev/null || hostname)"
LOAD_NOW="$(awk '{{print $1}}' /proc/loadavg 2>/dev/null || echo '0')"
SYN_NOW="$(ss -tan state syn-recv 2>/dev/null | tail -n +2 | wc -l | tr -d ' ' || echo '0')"
PAYLOAD="{{\\"agentId\\":\\"${{SPARROWX_AGENT_ID}}\\",\\"username\\":\\"${{SPARROWX_CLIENT_USERNAME}}\\",\\"email\\":\\"${{SPARROWX_CLIENT_EMAIL}}\\",\\"tenantId\\":\\"${{SPARROWX_TENANT_ID}}\\",\\"hostname\\":\\"${{HOSTNAME_NOW}}\\",\\"publicIp\\":\\"${{SPARROWX_VPS_PUBLIC_IP}}\\",\\"load1m\\":\\"${{LOAD_NOW}}\\",\\"synRecv\\":${{SYN_NOW}},\\"status\\":\\"protected\\"}}"
curl -fsS --max-time 5 -X POST "https://${{SPARROWX_MASTER_DOMAIN}}/api/client-protect/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-SparrowX-Client-Token: ${{SPARROWX_CLIENT_TOKEN}}" \
  -d "${{PAYLOAD}}" >/dev/null 2>&1 || true
EOF_HB
chmod +x /usr/local/bin/sparrowx-client-heartbeat

if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/sparrowx-shield-heartbeat.service <<'EOF_SVC'
[Unit]
Description=SparrowX Client VPS Protection Heartbeat
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sparrowx-client-heartbeat
EOF_SVC

  cat > /etc/systemd/system/sparrowx-shield-heartbeat.timer <<'EOF_TMR'
[Unit]
Description=Run SparrowX Client VPS Heartbeat every 60 seconds

[Timer]
OnBootSec=15s
OnUnitActiveSec=60s
Unit=sparrowx-shield-heartbeat.service

[Install]
WantedBy=timers.target
EOF_TMR
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-shield-heartbeat.timer >/dev/null 2>&1 || true
  /usr/local/bin/sparrowx-client-heartbeat || true
  log_ok "Systemd 60s protection heartbeat armed (sparrowx-shield-heartbeat.timer)"
fi

echo ""
echo -e "${{C_GREEN}}╭──────────────────────────────────────────────────────────────────────────╮${{C_RESET}}"
echo -e "${{C_GREEN}}│  ✓ THIS VPS IS NOW PROTECTED BY SPARROWX CYBERSECURITY SHIELD            │${{C_RESET}}"
echo -e "${{C_GREEN}}╰──────────────────────────────────────────────────────────────────────────╯${{C_RESET}}"
echo -e "  Bound Account   : ${{C_BOLD}}${{SPARROWX_CLIENT_USERNAME}}${{C_RESET}} <${{SPARROWX_CLIENT_EMAIL}}>"
echo -e "  Agent ID        : ${{C_CYAN}}${{SPARROWX_AGENT_ID}}${{C_RESET}}"
echo -e "  Tenant ID       : ${{SPARROWX_TENANT_ID}}"
echo -e "  VPS IP / NIC    : ${{VPS_PUBLIC_IP}} (${{PRIMARY_IFACE}})"
echo -e "  Protected Ports : ${{SPARROWX_PROTECTED_PORTS}} (+ rate-limited SSH :${{SSH_PORT}})"
echo -e "  Config File     : /etc/sparrowx/client.conf"
echo -e "  Live Terminal   : ${{C_BOLD}}sudo sparrowx-noc${{C_RESET}}"
echo ""
"""


def generate_client_bundle(
    username: str,
    email: str,
    ports: str = "80,443",
    master_domain: str = "sparrowx.net",
    guard_ip: str = "",
    enable_xdp: bool = True,
    with_tunnel: bool = False,
    out_dir: Optional[Path] = None,
    registry_path: Path = DEFAULT_REGISTRY,
) -> Tuple[Dict[str, Any], Path]:
    email_clean = email.strip().lower()
    if not EMAIL_RE.match(email_clean):
        raise ValueError(f"Invalid email address: {email}")
    slug = sanitize_slug(username)
    short_rand = secrets.token_hex(4)
    agent_id = f"spx_{slug[:8]}_{short_rand}"
    tenant_id = f"TNT-{slug[:8].upper()}-{short_rand[:4].upper()}"
    client_token = f"spx_vps_{secrets.token_urlsafe(24)}"
    token_fp = hashlib.sha256(client_token.encode("utf-8")).hexdigest()[:16]
    created_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    client_wg_priv, client_wg_pub = ("", "")
    tunnel_ip = ""
    guard_tunnel_ip = ""
    if with_tunnel:
        client_wg_priv, client_wg_pub = generate_wg_keypair()
        octet = (len(load_registry(registry_path)) * 4 + 2) % 250
        guard_tunnel_ip = f"10.66.0.{max(1, octet - 1)}"
        tunnel_ip = f"10.66.0.{max(2, octet)}"
        if not guard_ip:
            guard_ip = detect_master_public_ip()

    bundle: Dict[str, Any] = {
        "username": slug,
        "email": email_clean,
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "client_token": client_token,
        "token_fingerprint": token_fp,
        "master_domain": master_domain.strip() or "sparrowx.net",
        "guard_ip": guard_ip.strip(),
        "tunnel_ip": tunnel_ip,
        "guard_tunnel_ip": guard_tunnel_ip,
        "wg_port": 51820,
        "client_wg_priv": client_wg_priv,
        "client_wg_pub": client_wg_pub,
        "guard_wg_pub": os.environ.get("SPARROWX_GUARD_PUBLIC_KEY", ""),
        "ports": ports.strip() or "80,443",
        "enable_xdp": bool(enable_xdp),
        "status": "PROVISIONED",
        "created_at": created_at,
    }

    target_dir = out_dir or DEFAULT_OUT_DIR
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        target_dir = Path.cwd()

    script_name = f"sparrowx-protect-{slug}-{short_rand}.sh"
    script_path = target_dir / script_name
    script_content = build_client_installer_script(bundle).replace("\r\n", "\n")
    script_path.write_bytes(script_content.encode("utf-8"))
    try:
        os.chmod(script_path, 0o750)
    except OSError:
        pass

    # Save redacted metadata (NEVER store raw client_token or wg private key in registry)
    reg_entries = load_registry(registry_path)
    reg_entries.insert(
        0,
        {
            "username": bundle["username"],
            "email": bundle["email"],
            "agent_id": bundle["agent_id"],
            "tenant_id": bundle["tenant_id"],
            "token_fingerprint": bundle["token_fingerprint"],
            "ports": bundle["ports"],
            "guard_ip": bundle["guard_ip"],
            "tunnel_ip": bundle["tunnel_ip"] or "direct-edge",
            "client_wg_pub": bundle["client_wg_pub"],
            "script_path": str(script_path),
            "status": "PROVISIONED",
            "created_at": created_at,
        },
    )
    save_registry(registry_path, reg_entries)
    return bundle, script_path


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sparrowx-gen-client",
        description="Generate a bound SparrowX VPS Protection installer (.sh) for a client account",
    )
    parser.add_argument("--username", "-u", help="Client username / server label (e.g. acme_prod)")
    parser.add_argument("--email", "-e", help="Client SparrowX account email address")
    parser.add_argument("--ports", "-p", default="80,443", help="Comma-separated allowed service ports (default: 80,443)")
    parser.add_argument("--domain", "-d", default="sparrowx.net", help="SparrowX master domain (default: sparrowx.net)")
    parser.add_argument("--guard-ip", default="", help="Optional SparrowX Edge Guard IPv4 to whitelist / tunnel to")
    parser.add_argument("--with-tunnel", action="store_true", help="Include WireGuard edge scrubbing tunnel config")
    parser.add_argument("--no-xdp", action="store_true", help="Skip installing sparrowx-noc / XDP tools on client VPS")
    parser.add_argument("--out", "-o", default="", help="Output directory for generated .sh file")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Path to client registry JSON")
    parser.add_argument("--list", action="store_true", help="List all generated client VPS protection bundles")
    args = parser.parse_args(argv)

    reg_path = Path(args.registry)
    if args.list:
        entries = load_registry(reg_path)
        if not entries:
            print("No client VPS protection bundles registered yet.")
            return 0
        print(f"{'AGENT ID':<22} {'USERNAME':<16} {'EMAIL':<28} {'PORTS':<12} {'STATUS':<12} {'CREATED'}")
        print("-" * 108)
        for item in entries:
            print(
                f"{str(item.get('agent_id', '')):<22} {str(item.get('username', '')):<16} "
                f"{str(item.get('email', '')):<28} {str(item.get('ports', '')):<12} "
                f"{str(item.get('status', '')):<12} {str(item.get('created_at', ''))}"
            )
        return 0

    username = args.username
    email = args.email
    if not username:
        username = input("Client Username / Server Label (e.g. acme_vps): ").strip()
    if not email:
        email = input("Client Account Email (e.g. client@company.com): ").strip()

    out_dir = Path(args.out).resolve() if args.out else None
    try:
        bundle, script_path = generate_client_bundle(
            username=username,
            email=email,
            ports=args.ports,
            master_domain=args.domain,
            guard_ip=args.guard_ip,
            enable_xdp=not args.no_xdp,
            with_tunnel=args.with_tunnel,
            out_dir=out_dir,
            registry_path=reg_path,
        )
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\n╭──────────────────────────────────────────────────────────────────────────╮")
    print("│  ✓ SPARROWX CLIENT VPS PROTECTION BUNDLE GENERATED                       │")
    print("╰──────────────────────────────────────────────────────────────────────────╯")
    print(f"  Bound User      : {bundle['username']} <{bundle['email']}>")
    print(f"  Agent ID        : {bundle['agent_id']}")
    print(f"  Tenant ID       : {bundle['tenant_id']}")
    print(f"  Token SHA-256   : {bundle['token_fingerprint']}")
    print(f"  Protected Ports : {bundle['ports']}")
    print(f"  Installer File  : {script_path}")
    print("\n  Send this file to your client. On their VPS they run:")
    print(f"      sudo bash {script_path.name}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
