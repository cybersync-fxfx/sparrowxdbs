#!/usr/bin/env python3
"""
================================================================================
 SPARROWX INTERACTIVE EDGE PROXY, GAME SERVER & VPS PROTECTION GENERATOR (v2.0)
================================================================================
 Places YOUR SparrowX Linux Edge Server IN FRONT of a client's server so all
 incoming traffic hits SparrowX first (XDP + nftables L3/L4 scrubbing + live
 monitoring in `sparrowx-noc`), then forwards clean traffic to the client.

 Supports BOTH:
   • Full Linux VPS Protection (with WireGuard / Origin-Lockdown `.sh` installer)
   • Third-Party Game Hosting (NO root access needed!) — generates ready-to-drop
     configuration files for:
       [1] Full Linux VPS (Root Lockdown + Kernel + UFW + Fail2Ban + Heartbeat)
       [2] Minecraft (Java TCP 25565 / Bedrock UDP 19132 — Paper/Spigot/Velocity)
       [3] FiveM / RedM (Cfx.re TCP+UDP 30120 — drop-in `sparrowx-fivem-shield.cfg`)
       [4] SA-MP / open.mp (UDP 7777 — drop-in `sparrowx-samp-shield.cfg` & JSON)
       [5] MTA:SA (UDP 22003 + TCP 22005 + ASE 22126 — `sparrowx-mtasa-shield.xml`)
       [6] Custom TCP/UDP Backend Service

 Usage:
   sudo sparrowx-gen-client              # Launches aesthetic interactive wizard
   sudo sparrowx-gen-client --list       # Shows all active client proxies & VPS
   sudo sparrowx-gen-client --remove <agent_id>  # Removes a client edge proxy
   sudo sparrowx-gen-client --username benny --email benny@mail.com \
        --profile fivem --client-ip 203.0.113.55 --ports 30120 --apply-edge
================================================================================
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import ipaddress
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


VERSION = "2.0.0"
DEFAULT_REGISTRY = Path("/opt/sparrowx/clients/registry.json")
DEFAULT_OUT_DIR = Path("/opt/sparrowx/clients/bundles")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SLUG_RE = re.compile(r"[^a-z0-9_-]+")

# Server Profiles: key -> (label, default_ports_with_proto, description)
PROFILES: Dict[str, Dict[str, Any]] = {
    "vps": {
        "num": "1",
        "label": "Full Linux VPS",
        "kind": "CLIENT-VPS",
        "default_ports": "80/tcp,443/tcp",
        "needs_vps_script": True,
        "desc": "Full VPS protection + Edge reverse-proxy + origin lockdown .sh",
    },
    "minecraft": {
        "num": "2",
        "label": "Minecraft (Java / Bedrock)",
        "kind": "MINECRAFT",
        "default_ports": "25565/tcp,19132/udp",
        "needs_vps_script": False,
        "desc": "Works with ANY hoster — drop-in config + Edge IP:Port & SRV record",
    },
    "fivem": {
        "num": "3",
        "label": "FiveM / RedM (Cfx.re)",
        "kind": "FIVEM",
        "default_ports": "30120/tcp,30120/udp",
        "needs_vps_script": False,
        "desc": "Drop-in sparrowx-fivem-shield.cfg (sv_proxyIPRanges + listing override)",
    },
    "samp": {
        "num": "4",
        "label": "SA-MP / open.mp",
        "kind": "SAMP",
        "default_ports": "7777/udp",
        "needs_vps_script": False,
        "desc": "Drop-in sparrowx-samp-shield.cfg + open.mp JSON + UDP flood shield",
    },
    "mtasa": {
        "num": "5",
        "label": "MTA:SA",
        "kind": "MTASA",
        "default_ports": "22003/udp,22005/tcp,22126/udp",
        "needs_vps_script": False,
        "desc": "Drop-in sparrowx-mtasa-shield.xml (Game + HTTP + ASE ports proxied)",
    },
    "custom": {
        "num": "6",
        "label": "Custom TCP/UDP Service",
        "kind": "CUSTOM-SVC",
        "default_ports": "80/tcp,443/tcp",
        "needs_vps_script": False,
        "desc": "Any custom game, database, API, or self-hosted server port(s)",
    },
}

PROFILE_BY_NUM = {v["num"]: k for k, v in PROFILES.items()}


def sanitize_slug(raw: str) -> str:
    cleaned = SLUG_RE.sub("_", raw.strip().lower()).strip("_-")
    return (cleaned or "client")[:32]


def is_valid_ipv4(val: str) -> bool:
    try:
        ipaddress.IPv4Address(val.strip())
        return True
    except ValueError:
        return False


def parse_port_specs(raw: str, default_proto: str = "both") -> List[Tuple[int, str]]:
    """
    Parses port specs like '25565/tcp,19132/udp' or '30120' -> [(30120, 'tcp'), (30120, 'udp')].
    """
    specs: List[Tuple[int, str]] = []
    seen = set()
    for token in re.split(r"[\s,;]+", raw.strip()):
        if not token:
            continue
        if "/" in token:
            p_str, proto = token.split("/", 1)
            proto = proto.strip().lower()
            if proto not in ("tcp", "udp", "both"):
                proto = "tcp"
        else:
            p_str, proto = token, default_proto
        if not p_str.isdigit():
            continue
        port = int(p_str)
        if not (1 <= port <= 65535):
            continue
        protos = ("tcp", "udp") if proto == "both" else (proto,)
        for pr in protos:
            if (port, pr) not in seen:
                specs.append((port, pr))
                seen.add((port, pr))
    return specs or [(80, "tcp"), (443, "tcp")]


def run_cmd(cmd: List[str], timeout: float = 4.0) -> Tuple[int, str, str]:
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


def detect_master_public_ip() -> str:
    env_ip = os.environ.get("SPARROWX_PUBLIC_IP", "").strip()
    if env_ip and is_valid_ipv4(env_ip) and env_ip != "127.0.0.1":
        return env_ip
    rc, out, _ = run_cmd(["curl", "-4", "-fsS", "--max-time", "3", "https://api.ipify.org"])
    if rc == 0 and is_valid_ipv4(out):
        return out
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if is_valid_ipv4(ip) and not ip.startswith("127."):
            return ip
    except OSError:
        pass
    return "YOUR_SPARROWX_EDGE_IP"


def generate_wg_keypair() -> Tuple[str, str]:
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


# ------------------------------------------------------------------------------
# Edge Reverse-Proxy Script Builder (Runs on YOUR SparrowX OVH Filtering Server)
# ------------------------------------------------------------------------------

def build_edge_proxy_scripts(bundle: Dict[str, Any]) -> Tuple[str, str]:
    """
    Produces:
      1. apply_script  -> Installs kernel-speed nftables DNAT/MASQUERADE + flood limits
                          on YOUR SparrowX Edge Server in front of the client IP:Port.
      2. remove_script -> Cleanly removes this client's nftables edge proxy rules.
    """
    agent_id = bundle["agent_id"]
    username = bundle["username"]
    email = bundle["email"]
    profile = bundle["profile"]
    client_ip = bundle["client_ip"]
    port_maps: List[Dict[str, Any]] = bundle["port_maps"]
    comment_tag = f"spx_{agent_id}"

    apply_lines = [
        "#!/usr/bin/env bash",
        "# ==============================================================================",
        f"#  SPARROWX EDGE REVERSE-PROXY RULE INSTALLER — {username} ({profile.upper()})",
        "# ==============================================================================",
        f"#  Bound Client : {username} <{email}>",
        f"#  Agent ID     : {agent_id}",
        f"#  Backend IP   : {client_ip}",
        "#  Run this on YOUR SparrowX OVH Edge Filtering Server (as root).",
        "# ==============================================================================",
        "set -euo pipefail",
        "",
        'if [ "$(id -u)" -ne 0 ]; then',
        '  echo "[ERR] Run as root on your SparrowX Edge Server: sudo bash $0" >&2',
        "  exit 1",
        "fi",
        "",
        "sysctl -w net.ipv4.ip_forward=1 >/dev/null",
        'grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.d/99-sparrowx-edge.conf 2>/dev/null || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/99-sparrowx-edge.conf',
        "",
        "# Ensure SparrowX Edge NAT & Filter tables exist in nftables",
        "nft list table ip sparrowx_edge_nat >/dev/null 2>&1 || nft add table ip sparrowx_edge_nat",
        "nft list chain ip sparrowx_edge_nat prerouting >/dev/null 2>&1 || nft add chain ip sparrowx_edge_nat prerouting '{ type nat hook prerouting priority dstnat; policy accept; }'",
        "nft list chain ip sparrowx_edge_nat postrouting >/dev/null 2>&1 || nft add chain ip sparrowx_edge_nat postrouting '{ type nat hook postrouting priority srcnat; policy accept; }'",
        "",
        "nft list table inet sparrowx_edge_filter >/dev/null 2>&1 || nft add table inet sparrowx_edge_filter",
        "nft list chain inet sparrowx_edge_filter forward >/dev/null 2>&1 || nft add chain inet sparrowx_edge_filter forward '{ type filter hook forward priority 0; policy accept; }'",
        "",
        f'echo "[SPARROWX EDGE] Binding public scrubbing proxy -> {client_ip} ({profile.upper()})..."',
    ]

    for pm in port_maps:
        proto = pm["proto"]
        e_port = pm["edge_port"]
        b_port = pm["backend_port"]
        # Rate-limit / flood protection + counter + DNAT + MASQUERADE
        if proto == "tcp":
            apply_lines.append(
                f'nft add rule inet sparrowx_edge_filter forward ip daddr {client_ip} tcp dport {b_port} tcp flags syn limit rate over 120/second burst 240 packets counter drop comment "{comment_tag}"'
            )
        else:
            apply_lines.append(
                f'nft add rule inet sparrowx_edge_filter forward ip daddr {client_ip} udp dport {b_port} limit rate over 1500/second burst 3000 packets counter drop comment "{comment_tag}"'
            )
        apply_lines.append(
            f'nft add rule ip sparrowx_edge_nat prerouting {proto} dport {e_port} counter dnat to {client_ip}:{b_port} comment "{comment_tag}"'
        )
        apply_lines.append(
            f'nft add rule ip sparrowx_edge_nat postrouting ip daddr {client_ip} {proto} dport {b_port} counter masquerade comment "{comment_tag}"'
        )
        apply_lines.append(
            f'command -v ufw >/dev/null 2>&1 && ufw allow {e_port}/{proto} comment "SparrowX Edge Proxy {username}" >/dev/null 2>&1 || true'
        )

    apply_lines.extend([
        "",
        f'echo "[OK] SparrowX Edge Proxy LIVE for {username} ({agent_id}) -> {client_ip}"',
        'echo "     Monitor live packets in: sudo sparrowx-noc"',
        "",
    ])

    remove_lines = [
        "#!/usr/bin/env bash",
        f"# Remove SparrowX Edge Proxy rules for {username} ({agent_id})",
        "set -euo pipefail",
        'for tbl_chain in "ip sparrowx_edge_nat prerouting" "ip sparrowx_edge_nat postrouting" "inet sparrowx_edge_filter forward"; do',
        "  read -r fam tbl chn <<< \"$tbl_chain\"",
        f'  nft -a list chain "$fam" "$tbl" "$chn" 2>/dev/null | awk \'/{comment_tag}/ {{print $NF}}\' | while read -r handle; do',
        '    [ -n "$handle" ] && nft delete rule "$fam" "$tbl" "$chn" handle "$handle" 2>/dev/null || true',
        "  done",
        "done",
        f'echo "[OK] Removed SparrowX Edge Proxy rules for {agent_id}"',
        "",
    ]

    return "\n".join(apply_lines), "\n".join(remove_lines)


# ------------------------------------------------------------------------------
# Drop-In Game Server & Client VPS Configuration File Builders
# ------------------------------------------------------------------------------

def build_game_dropin_files(bundle: Dict[str, Any]) -> Dict[str, str]:
    """Returns {filename: content} of drop-in configs tailored to the selected server profile."""
    profile = bundle["profile"]
    username = bundle["username"]
    email = bundle["email"]
    agent_id = bundle["agent_id"]
    edge_ip = bundle["guard_ip"]
    client_ip = bundle["client_ip"]
    port_maps = bundle["port_maps"]
    master_domain = bundle["master_domain"]
    primary_edge_port = port_maps[0]["edge_port"]
    primary_backend_port = port_maps[0]["backend_port"]
    files: Dict[str, str] = {}

    if profile == "minecraft":
        java_pm = next((p for p in port_maps if p["proto"] == "tcp"), port_maps[0])
        bedrock_pm = next((p for p in port_maps if p["proto"] == "udp"), None)
        files["sparrowx-minecraft-shield.yml"] = (
            f"# ======================================================================\n"
            f"# SPARROWX MINECRAFT PROTECTION CONFIG — Drop into your server folder\n"
            f"# Bound Account : {username} <{email}>\n"
            f"# Agent ID      : {agent_id}\n"
            f"# ======================================================================\n"
            f"sparrowx_shield:\n"
            f"  enabled: true\n"
            f"  agent_id: \"{agent_id}\"\n"
            f"  account_email: \"{email}\"\n"
            f"  protected_connect_address: \"{edge_ip}:{java_pm['edge_port']}\"\n"
            + (f"  protected_bedrock_address: \"{edge_ip}:{bedrock_pm['edge_port']}\"\n" if bedrock_pm else "")
            + f"  trusted_edge_proxy_ips:\n"
            f"    - \"{edge_ip}\"\n"
            f"  origin_hidden_backend: \"{client_ip}:{java_pm['backend_port']}\"\n"
            f"  anti_bot:\n"
            f"    max_connections_per_ip: 4\n"
            f"    syn_flood_scrubbing: \"sparrowx-edge-xdp\"\n"
            f"    block_direct_origin_bypass: true\n"
        )
        files["sparrowx-minecraft-dns-and-panel-guide.txt"] = (
            f"========================================================================\n"
            f" SPARROWX MINECRAFT DDoS PROTECTION — CLIENT SETUP (ANY HOSTER!)\n"
            f"========================================================================\n"
            f" Works even on shared hosting / Pterodactyl (Apex, Shockbyte, Bisect,\n"
            f" PebbleHost, etc.) with ZERO root access needed!\n\n"
            f" 1. GIVE PLAYERS YOUR PROTECTED ADDRESS (NEVER share {client_ip}!):\n"
            f"    • Java Edition Connect    : {edge_ip}:{java_pm['edge_port']}\n"
            + (f"    • Bedrock Edition Connect : {edge_ip}:{bedrock_pm['edge_port']}\n" if bedrock_pm else "")
            + f"\n 2. OPTIONAL CUSTOM DOMAIN DNS (Cloudflare / Registrar, DNS-Only):\n"
            f"    • A Record   : play  ->  {edge_ip}\n"
            f"    • SRV Record : _minecraft._tcp.play  Priority=0 Weight=5 Port={java_pm['edge_port']} Target=play.yourdomain.com\n\n"
            f" 3. DROP-IN CONFIG:\n"
            f"    • Upload `sparrowx-minecraft-shield.yml` into your server root or /plugins/ folder.\n"
            f"    • In `server.properties`, keep `server-port={java_pm['backend_port']}` and `prevent-proxy-connections=false`.\n"
            f"    • If using Velocity/BungeeCord behind SparrowX, trust proxy IP: {edge_ip}\n"
            f"    • If using PaperMC + IPWhitelist / OnlyProxyJoin plugin, whitelist ONLY: {edge_ip}\n"
            f"      (This blocks attackers even if they somehow leak your old hoster IP!)\n"
        )

    elif profile == "fivem":
        files["sparrowx-fivem-shield.cfg"] = (
            f"# ======================================================================\n"
            f"# SPARROWX FIVEM / REDM ANTI-DDOS EDGE CONFIG (DROP-IN FILE)\n"
            f"# Bound Account : {username} <{email}>\n"
            f"# Agent ID      : {agent_id}\n"
            f"# ======================================================================\n"
            f"# HOW TO INSTALL (Works on ANY FiveM hoster / txAdmin / Pterodactyl):\n"
            f"#   1. Upload this file into the same folder as your `server.cfg`.\n"
            f"#   2. Add this single line at the BOTTOM of your `server.cfg`:\n"
            f"#          exec sparrowx-fivem-shield.cfg\n"
            f"#   3. Restart your FiveM server. Players now connect via SparrowX Edge!\n"
            f"# ======================================================================\n\n"
            f"# Route Cfx.re server list & player connections through SparrowX Scrubbing Edge\n"
            f"set sv_listingIpOverride \"{edge_ip}:{primary_edge_port}\"\n"
            f"set sv_endpoints \"{edge_ip}:{primary_edge_port}\"\n"
            f"set sv_proxyIPRanges \"{edge_ip}/32\"\n"
            f"set sv_forceIndirectListing true\n"
            f"set sv_endpointprivacy true\n\n"
            f"# Hardened FiveM L7 / StateBag / NetCommand Anti-Flood Rate Limiters\n"
            f"set sv_requestParanoia 3\n"
            f"set rateLimiter_stateBag_rate 100\n"
            f"set rateLimiter_stateBag_burst 200\n"
            f"set rateLimiter_netCommand_rate 80\n"
            f"set rateLimiter_netCommand_burst 160\n"
            f"set rateLimiter_netCommandSize_rate 512000\n"
            f"set sv_filterRequestControl 2\n"
            f"set sv_enableNetworkedSounds false\n"
        )

    elif profile == "samp":
        files["sparrowx-samp-shield.cfg"] = (
            f"# ======================================================================\n"
            f"# SPARROWX SA-MP ANTI-DDOS CONFIG SNIPPET (Append to server.cfg)\n"
            f"# Bound Account     : {username} <{email}>\n"
            f"# Agent ID          : {agent_id}\n"
            f"# Protected Connect : {edge_ip}:{primary_edge_port}\n"
            f"# ======================================================================\n"
            f"port {primary_backend_port}\n"
            f"ackslimit 3000\n"
            f"minconnectiontime 1000\n"
            f"connseedtime 300000\n"
            f"messageslimit 500\n"
            f"messageholelimit 3000\n"
            f"conncookies 1\n"
            f"cookielogging 0\n"
            f"query 1\n"
            f"rcon 0\n"
        )
        files["sparrowx-openmp-shield.json"] = json.dumps(
            {
                "_sparrowx_shield": {
                    "agent_id": agent_id,
                    "account_email": email,
                    "protected_connect": f"{edge_ip}:{primary_edge_port}",
                    "trusted_edge_ip": edge_ip,
                },
                "network": {
                    "port": primary_backend_port,
                    "use_lan_mode": False,
                    "acks_limit": 3000,
                    "message_hole_limit": 3000,
                    "messages_limit": 500,
                    "minimum_connection_time": 1000,
                    "cookie_reseed_time": 300000,
                    "allow_queries": True,
                },
                "rcon": {"enable": False},
            },
            indent=2,
        ) + "\n"

    elif profile == "mtasa":
        game_p = port_maps[0]["backend_port"]
        http_p = port_maps[1]["backend_port"] if len(port_maps) > 1 else 22005
        files["sparrowx-mtasa-shield.xml"] = (
            f"<!-- ======================================================================\n"
            f"     SPARROWX MTA:SA ANTI-DDOS DROP-IN SNIPPET (Merge into mtaserver.conf)\n"
            f"     Bound Account     : {username} <{email}>\n"
            f"     Agent ID          : {agent_id}\n"
            f"     Protected Connect : mtasa://{edge_ip}:{primary_edge_port}\n"
            f"     ====================================================================== -->\n"
            f"<config>\n"
            f"    <serverport>{game_p}</serverport>\n"
            f"    <httpport>{http_p}</httpport>\n"
            f"    <ase>1</ase>\n"
            f"    <bandwidth_reduction>medium</bandwidth_reduction>\n"
            f"    <player_sync_interval>100</player_sync_interval>\n"
            f"    <lightweight_sync_interval>1500</lightweight_sync_interval>\n"
            f"    <minclientversion_auto_update>1</minclientversion_auto_update>\n"
            f"    <disableac></disableac>\n"
            f"    <!-- Share ONLY mtasa://{edge_ip}:{primary_edge_port} with players! -->\n"
            f"</config>\n"
        )

    # Always generate a clean Client VPS Lockdown & Protection `.sh` installer
    # (Mandatory for Full VPS, optional bonus if a game server owner ALSO has root on their VPS!)
    files[f"sparrowx-protect-{username}-{bundle['short_rand']}.sh"] = build_client_vps_installer_script(bundle)

    # Universal branded Client Setup Instructions
    ports_summary = "\n".join(
        f"    • {pm['proto'].upper():<3}  PUBLIC EDGE {edge_ip}:{pm['edge_port']}  --->  ORIGIN {client_ip}:{pm['backend_port']}"
        for pm in port_maps
    )
    files["README-CLIENT-SETUP.txt"] = (
        f"========================================================================\n"
        f"  SPARROWX SHIELD — CLIENT PROTECTION ACTIVATION PACK\n"
        f"========================================================================\n"
        f"  Client Account : {username} <{email}>\n"
        f"  Server Type    : {PROFILES[profile]['label']}\n"
        f"  Agent ID       : {agent_id}\n"
        f"  Master Portal  : https://{master_domain}\n\n"
        f"  PROTECTED SPARROWX EDGE ENDPOINT(S) — Share ONLY these publicly:\n"
        f"{ports_summary}\n\n"
        f"  FILES INCLUDED IN THIS PACK:\n"
        + "\n".join(f"    - {fname}" for fname in sorted(files.keys()))
        + "\n\n"
        f"  QUICK ACTIVATION:\n"
        f"    • If you use a Game Panel / Third-Party Hoster (No root access):\n"
        f"      Upload the drop-in config file for {PROFILES[profile]['label']} and tell\n"
        f"      your players/users to connect to {edge_ip}:{primary_edge_port}.\n"
        f"    • If you have Root SSH access on your Linux VPS:\n"
        f"      Upload & run `sudo bash sparrowx-protect-{username}-{bundle['short_rand']}.sh`\n"
        f"      to lock your VPS firewall so ONLY SparrowX Edge ({edge_ip}) can reach\n"
        f"      your service ports (prevents direct-IP bypass attacks!).\n"
    )
    return files


def build_client_vps_installer_script(bundle: Dict[str, Any]) -> str:
    username = bundle["username"]
    email = bundle["email"]
    agent_id = bundle["agent_id"]
    tenant_id = bundle["tenant_id"]
    client_token = bundle["client_token"]
    token_fingerprint = bundle["token_fingerprint"]
    master_domain = bundle["master_domain"]
    guard_ip = bundle["guard_ip"]
    profile = bundle["profile"]
    port_maps = bundle["port_maps"]
    ports_csv = ",".join(f"{pm['backend_port']}/{pm['proto']}" for pm in port_maps)
    lock_to_edge = "1" if bundle.get("lock_origin_to_edge", True) and is_valid_ipv4(guard_ip) else "0"
    created_at = bundle["created_at"]

    return f"""#!/usr/bin/env bash
# ==============================================================================
#  SPARROWX CLIENT VPS ANTI-DDOS & ORIGIN LOCKDOWN INSTALLER
# ==============================================================================
#  Bound Account  : {username} <{email}>
#  Server Profile : {PROFILES[profile]['label']}
#  Agent ID       : {agent_id}
#  Tenant ID      : {tenant_id}
#  Token SHA-256  : {token_fingerprint}
#  SparrowX Edge  : {guard_ip}
#  Generated At   : {created_at}
#
#  Run on the client's Linux VPS (Ubuntu/Debian) as root:
#      sudo bash "$(basename "$0")"
# ==============================================================================
set -euo pipefail

SPARROWX_CLIENT_USERNAME="{username}"
SPARROWX_CLIENT_EMAIL="{email}"
SPARROWX_AGENT_ID="{agent_id}"
SPARROWX_TENANT_ID="{tenant_id}"
SPARROWX_CLIENT_TOKEN="{client_token}"
SPARROWX_MASTER_DOMAIN="{master_domain}"
SPARROWX_GUARD_IP="{guard_ip}"
SPARROWX_SERVER_PROFILE="{profile}"
SPARROWX_PROTECTED_PORTS="{ports_csv}"
SPARROWX_LOCK_ORIGIN_TO_EDGE="{lock_to_edge}"

C_RESET="\\033[0m"
C_BOLD="\\033[1m"
C_CYAN="\\033[1;36m"
C_GREEN="\\033[1;32m"
C_RED="\\033[1;31m"

log_step() {{ echo -e "\\n${{C_CYAN}}[SPARROWX]${{C_RESET}} ${{C_BOLD}}$1${{C_RESET}}"; }}
log_ok()   {{ echo -e "  ${{C_GREEN}}[OK]${{C_RESET}} $1"; }}
log_err()  {{ echo -e "  ${{C_RED}}[ERR]${{C_RESET}} $1" >&2; }}

if [ "$(id -u)" -ne 0 ]; then
  log_err "Run as root: sudo bash $0"
  exit 1
fi

PRIMARY_IFACE="$(ip route show default 2>/dev/null | awk '/default/ {{print $5; exit}}' || echo eth0)"
VPS_PUBLIC_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{{print $1}}' || echo unknown)"
SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port / {{print $2; exit}}' || echo 22)"
[ -z "${{SSH_PORT}}" ] && SSH_PORT="22"

log_step "1/5 Binding VPS identity (${{SPARROWX_CLIENT_USERNAME}} <${{SPARROWX_CLIENT_EMAIL}}>)..."
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
SPARROWX_SERVER_PROFILE="${{SPARROWX_SERVER_PROFILE}}"
SPARROWX_PROTECTED_PORTS="${{SPARROWX_PROTECTED_PORTS}}"
SPARROWX_VPS_PUBLIC_IP="${{VPS_PUBLIC_IP}}"
EOF_CONF
chmod 600 /etc/sparrowx/client.conf
log_ok "Saved bound credentials -> /etc/sparrowx/client.conf"

log_step "2/5 Installing firewall & intrusion prevention tools..."
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq ufw fail2ban nftables iproute2 curl ca-certificates python3 >/dev/null 2>&1 || true
fi
log_ok "Firewall toolchain ready"

log_step "3/5 Hardening Linux kernel L3/L4 stack against SYN/UDP/amplification floods..."
cat > /etc/sysctl.d/99-sparrowx-ddos.conf <<'EOF_SYSCTL'
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 16384
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.core.somaxconn = 65535
net.netfilter.nf_conntrack_max = 524288
EOF_SYSCTL
sysctl --system >/dev/null 2>&1 || true
log_ok "Kernel L3/L4 sysctl profile applied"

log_step "4/5 Locking service ports behind SparrowX Edge (${{SPARROWX_GUARD_IP}}) & arming Fail2Ban..."
if command -v ufw >/dev/null 2>&1; then
  ufw --force default deny incoming >/dev/null 2>&1 || true
  ufw --force default allow outgoing >/dev/null 2>&1 || true
  ufw limit "${{SSH_PORT}}/tcp" comment "SparrowX rate-limited SSH" >/dev/null 2>&1 || true
  IFS=',' read -ra PORT_LIST <<< "${{SPARROWX_PROTECTED_PORTS}}"
  for p in "${{PORT_LIST[@]}}"; do
    p_clean="$(echo "$p" | tr -dc '0-9a-zA-Z/')"
    [ -z "${{p_clean}}" ] && continue
    p_num="${{p_clean%%/*}}"
    p_proto="${{p_clean##*/}}"
    [ "${{p_proto}}" = "${{p_num}}" ] && p_proto="tcp"
    if [ "${{SPARROWX_LOCK_ORIGIN_TO_EDGE}}" = "1" ]; then
      # Strictly allow ONLY SparrowX Filtering Edge IP on protected service ports (anti-bypass!)
      ufw allow from "${{SPARROWX_GUARD_IP}}" to any port "${{p_num}}" proto "${{p_proto}}" comment "SparrowX Edge Only" >/dev/null 2>&1 || true
    else
      ufw allow "${{p_num}}/${{p_proto}}" comment "SparrowX Protected Port" >/dev/null 2>&1 || true
    fi
  done
  ufw --force enable >/dev/null 2>&1 || true
  if [ "${{SPARROWX_LOCK_ORIGIN_TO_EDGE}}" = "1" ]; then
    log_ok "ORIGIN LOCKED: Ports (${{SPARROWX_PROTECTED_PORTS}}) accept traffic ONLY from SparrowX Edge (${{SPARROWX_GUARD_IP}})"
  else
    log_ok "UFW armed for ports (${{SPARROWX_PROTECTED_PORTS}}) + rate-limited SSH :${{SSH_PORT}}"
  fi
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
  log_ok "Fail2Ban armed (SSH protected)"
fi

log_step "5/5 Installing SparrowX NOC CLI & 60s health heartbeat..."
curl -fsSL --max-time 8 "https://${{SPARROWX_MASTER_DOMAIN}}/sparrowx-noc.py" -o /usr/local/bin/sparrowx-noc 2>/dev/null && chmod +x /usr/local/bin/sparrowx-noc || true
cat > /usr/local/bin/sparrowx-client-heartbeat <<'EOF_HB'
#!/usr/bin/env bash
set -u
[ -f /etc/sparrowx/client.conf ] && source /etc/sparrowx/client.conf
HOSTNAME_NOW="$(hostname -f 2>/dev/null || hostname)"
LOAD_NOW="$(awk '{{print $1}}' /proc/loadavg 2>/dev/null || echo 0)"
SYN_NOW="$(ss -tan state syn-recv 2>/dev/null | tail -n +2 | wc -l | tr -d ' ' || echo 0)"
curl -fsS --max-time 5 -X POST "https://${{SPARROWX_MASTER_DOMAIN}}/api/client-protect/heartbeat" \\
  -H "Content-Type: application/json" \\
  -H "X-SparrowX-Client-Token: ${{SPARROWX_CLIENT_TOKEN}}" \\
  -d "{{\\"agentId\\":\\"${{SPARROWX_AGENT_ID}}\\",\\"username\\":\\"${{SPARROWX_CLIENT_USERNAME}}\\",\\"email\\":\\"${{SPARROWX_CLIENT_EMAIL}}\\",\\"hostname\\":\\"${{HOSTNAME_NOW}}\\",\\"publicIp\\":\\"${{SPARROWX_VPS_PUBLIC_IP}}\\",\\"load1m\\":\\"${{LOAD_NOW}}\\",\\"synRecv\\":${{SYN_NOW}},\\"status\\":\\"PROTECTED\\"}}" >/dev/null 2>&1 || true
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
  log_ok "Systemd heartbeat armed"
fi

echo ""
echo -e "${{C_GREEN}}╭──────────────────────────────────────────────────────────────────────────╮${{C_RESET}}"
echo -e "${{C_GREEN}}│  ✓ VPS LOCKED BEHIND SPARROWX EDGE & PROTECTED                           │${{C_RESET}}"
echo -e "${{C_GREEN}}╰──────────────────────────────────────────────────────────────────────────╯${{C_RESET}}"
echo -e "  Bound Account : ${{SPARROWX_CLIENT_USERNAME}} <${{SPARROWX_CLIENT_EMAIL}}>"
echo -e "  Agent ID      : ${{SPARROWX_AGENT_ID}}  |  Profile: ${{SPARROWX_SERVER_PROFILE}}"
echo -e "  SparrowX Edge : ${{SPARROWX_GUARD_IP}}"
echo -e "  Live Monitor  : sudo sparrowx-noc"
echo ""
"""


# ------------------------------------------------------------------------------
# Core Bundle Generator
# ------------------------------------------------------------------------------

def generate_client_bundle(
    username: str,
    email: str,
    client_ip: str = "",
    profile: str = "vps",
    ports: str = "",
    edge_port_offset: int = 0,
    master_domain: str = "sparrowx.net",
    guard_ip: str = "",
    lock_origin_to_edge: bool = True,
    apply_edge_now: bool = False,
    out_dir: Optional[Path] = None,
    registry_path: Path = DEFAULT_REGISTRY,
) -> Tuple[Dict[str, Any], Path, List[Path]]:
    email_clean = email.strip().lower()
    if not EMAIL_RE.match(email_clean):
        raise ValueError(f"Invalid email address: {email}")
    profile = profile.strip().lower()
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile '{profile}'. Valid: {', '.join(PROFILES.keys())}")
    client_ip_clean = client_ip.strip()
    if client_ip_clean and not is_valid_ipv4(client_ip_clean):
        raise ValueError(f"Invalid client server IPv4 address: {client_ip_clean}")

    slug = sanitize_slug(username)
    short_rand = secrets.token_hex(4)
    agent_id = f"spx_{slug[:8]}_{short_rand}"
    tenant_id = f"TNT-{slug[:8].upper()}-{short_rand[:4].upper()}"
    client_token = f"spx_vps_{secrets.token_urlsafe(24)}"
    token_fp = hashlib.sha256(client_token.encode("utf-8")).hexdigest()[:16]
    created_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    effective_guard_ip = guard_ip.strip() or detect_master_public_ip()
    raw_ports = ports.strip() or PROFILES[profile]["default_ports"]
    default_proto = "udp" if profile == "samp" else ("both" if profile in ("fivem", "custom") else "tcp")
    parsed_ports = parse_port_specs(raw_ports, default_proto=default_proto)

    port_maps = [
        {
            "proto": pr,
            "backend_port": pt,
            "edge_port": min(65535, pt + edge_port_offset),
        }
        for pt, pr in parsed_ports
    ]

    bundle: Dict[str, Any] = {
        "username": slug,
        "email": email_clean,
        "profile": profile,
        "kind": PROFILES[profile]["kind"],
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "short_rand": short_rand,
        "client_token": client_token,
        "token_fingerprint": token_fp,
        "master_domain": master_domain.strip() or "sparrowx.net",
        "guard_ip": effective_guard_ip,
        "client_ip": client_ip_clean or "CLIENT_BACKEND_IP",
        "port_maps": port_maps,
        "ports": ",".join(f"{pm['backend_port']}/{pm['proto']}" for pm in port_maps),
        "edge_ports": ",".join(f"{pm['edge_port']}/{pm['proto']}" for pm in port_maps),
        "lock_origin_to_edge": lock_origin_to_edge,
        "status": "PROVISIONED",
        "created_at": created_at,
    }

    base_out = out_dir or DEFAULT_OUT_DIR
    bundle_dir = base_out / f"{slug}-{profile}-{short_rand}"
    try:
        bundle_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        bundle_dir = Path.cwd() / f"sparrowx-pack-{slug}-{short_rand}"
        bundle_dir.mkdir(parents=True, exist_ok=True)

    written: List[Path] = []

    # 1. Edge Reverse-Proxy Apply & Remove scripts (run on YOUR SparrowX Edge Server)
    if client_ip_clean:
        apply_sh, remove_sh = build_edge_proxy_scripts(bundle)
        p_apply = bundle_dir / "01-edge-apply-on-sparrowx.sh"
        p_remove = bundle_dir / "01-edge-remove-from-sparrowx.sh"
        p_apply.write_bytes(apply_sh.replace("\r\n", "\n").encode("utf-8"))
        p_remove.write_bytes(remove_sh.replace("\r\n", "\n").encode("utf-8"))
        for fp in (p_apply, p_remove):
            try:
                os.chmod(fp, 0o750)
            except OSError:
                pass
            written.append(fp)

        if apply_edge_now and sys.platform.startswith("linux") and os.geteuid() == 0:
            rc, _, err = run_cmd(["bash", str(p_apply)], timeout=10.0)
            if rc == 0:
                bundle["status"] = "PROTECTED"
            else:
                print(f"[WARN] Could not auto-apply edge rule: {err}", file=sys.stderr)

    # 2. Client Drop-In Config Files & VPS Protection Script
    client_files = build_game_dropin_files(bundle)
    for fname, content in client_files.items():
        fp = bundle_dir / fname
        fp.write_bytes(content.replace("\r\n", "\n").encode("utf-8"))
        if fname.endswith(".sh"):
            try:
                os.chmod(fp, 0o750)
            except OSError:
                pass
        written.append(fp)

    # 3. Persist redacted entry to SparrowX Master Registry (displayed live in `sparrowx-noc` Pane 2!)
    entries = load_registry(registry_path)
    entries.insert(
        0,
        {
            "username": bundle["username"],
            "email": bundle["email"],
            "profile": bundle["profile"],
            "kind": bundle["kind"],
            "agent_id": bundle["agent_id"],
            "tenant_id": bundle["tenant_id"],
            "token_fingerprint": bundle["token_fingerprint"],
            "client_ip": bundle["client_ip"],
            "guard_ip": bundle["guard_ip"],
            "ports": bundle["ports"],
            "edge_ports": bundle["edge_ports"],
            "bundle_dir": str(bundle_dir),
            "status": bundle["status"],
            "created_at": created_at,
        },
    )
    save_registry(registry_path, entries)
    return bundle, bundle_dir, written


# ------------------------------------------------------------------------------
# Interactive Terminal Wizard
# ------------------------------------------------------------------------------

def run_interactive_wizard(args: argparse.Namespace) -> int:
    C_CYAN = "\033[1;36m"
    C_GREEN = "\033[1;32m"
    C_YELLOW = "\033[1;33m"
    C_DIM = "\033[2m"
    C_BOLD = "\033[1m"
    C_RST = "\033[0m"

    print(f"\n{C_CYAN}╭──────────────────────────────────────────────────────────────────────────────╮{C_RST}")
    print(f"{C_CYAN}│  ◆ SPARROWX EDGE PROTECTION & GAME/VPS BUNDLE GENERATOR v{VERSION}               │{C_RST}")
    print(f"{C_CYAN}╰──────────────────────────────────────────────────────────────────────────────╯{C_RST}")
    print(f"  {C_DIM}Places your SparrowX scrubbing edge in front of any client VPS or game server.{C_RST}\n")

    username = args.username or input(f"  {C_BOLD}1. Client Username / Server Name{C_RST} (e.g. benny_rp): ").strip()
    email = args.email or input(f"  {C_BOLD}2. Client Account Email{C_RST} (e.g. benny@example.com): ").strip()

    print(f"\n  {C_BOLD}3. What type of server are we protecting?{C_RST}")
    for key, meta in PROFILES.items():
        print(f"     {C_CYAN}[{meta['num']}]{C_RST} {meta['label']:<28} {C_DIM}({meta['default_ports']}) — {meta['desc']}{C_RST}")
    sel = args.profile or input(f"\n     Select profile [1-6] (default 1): ").strip() or "1"
    profile = PROFILE_BY_NUM.get(sel, sel.lower())
    if profile not in PROFILES:
        print(f"{C_YELLOW}Invalid selection '{sel}', defaulting to Full VPS.{C_RST}")
        profile = "vps"

    meta = PROFILES[profile]
    client_ip = args.client_ip or input(
        f"\n  {C_BOLD}4. Client Real Server IPv4{C_RST} (VPS IP or third-party host IP, e.g. 203.0.113.55): "
    ).strip()

    default_ports = meta["default_ports"]
    ports = args.ports or input(
        f"  {C_BOLD}5. Server Port(s) to Protect{C_RST} [default: {default_ports}]: "
    ).strip() or default_ports

    edge_offset_raw = str(args.edge_port_offset) if args.edge_port_offset else input(
        f"  {C_BOLD}6. Edge Public Port Offset{C_RST} (0 = keep same port, e.g. 100 maps 25565->25665) [0]: "
    ).strip() or "0"
    edge_offset = int(edge_offset_raw) if edge_offset_raw.isdigit() else 0

    detected_edge = args.guard_ip or detect_master_public_ip()
    guard_ip = args.guard_ip or input(
        f"  {C_BOLD}7. YOUR SparrowX Filtering Edge IPv4{C_RST} [default: {detected_edge}]: "
    ).strip() or detected_edge

    apply_edge = args.apply_edge
    if not apply_edge and sys.platform.startswith("linux") and os.geteuid() == 0 and client_ip:
        ans = input(f"\n  {C_BOLD}8. Activate live nftables Edge Proxy on THIS server right now? [Y/n]: {C_RST}").strip().lower()
        apply_edge = ans in ("", "y", "yes")

    out_dir = Path(args.out).resolve() if args.out else None
    reg_path = Path(args.registry)
    try:
        bundle, bundle_dir, written = generate_client_bundle(
            username=username,
            email=email,
            client_ip=client_ip,
            profile=profile,
            ports=ports,
            edge_port_offset=edge_offset,
            master_domain=args.domain,
            guard_ip=guard_ip,
            apply_edge_now=apply_edge,
            out_dir=out_dir,
            registry_path=reg_path,
        )
    except ValueError as exc:
        print(f"\n[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"\n{C_GREEN}╭──────────────────────────────────────────────────────────────────────────────╮{C_RST}")
    print(f"{C_GREEN}│  ✓ PROTECTION PACK GENERATED — READY FOR CLIENT DEPLOYMENT                   │{C_RST}")
    print(f"{C_GREEN}╰──────────────────────────────────────────────────────────────────────────────╯{C_RST}")
    print(f"  Bound Client   : {C_BOLD}{bundle['username']}{C_RST} <{bundle['email']}>")
    print(f"  Server Profile : {C_CYAN}{PROFILES[profile]['label']}{C_RST}  |  Agent ID: {bundle['agent_id']}")
    print(f"  Traffic Flow   : {C_GREEN}{bundle['guard_ip']} ({bundle['edge_ports']}){C_RST}  --->  {bundle['client_ip']} ({bundle['ports']})")
    print(f"  Edge Status    : {bundle['status']}")
    print(f"  Bundle Folder  : {bundle_dir}\n")
    print("  Generated Files:")
    for fp in written:
        print(f"    • {fp.name}")
    print(f"\n  Monitor live filtered traffic in: {C_BOLD}sudo sparrowx-noc{C_RST}\n")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sparrowx-gen-client",
        description="SparrowX Interactive Edge Proxy, Game Server (MC/FiveM/SAMP/MTA) & VPS Protection Generator",
    )
    parser.add_argument("--username", "-u", default="", help="Client username / server label")
    parser.add_argument("--email", "-e", default="", help="Client SparrowX account email")
    parser.add_argument("--profile", "-t", default="", choices=("", *PROFILES.keys()), help="Server profile (vps|minecraft|fivem|samp|mtasa|custom)")
    parser.add_argument("--client-ip", default="", help="Client backend server IPv4 address")
    parser.add_argument("--ports", "-p", default="", help="Backend ports to protect (e.g. 25565/tcp,19132/udp or 30120)")
    parser.add_argument("--edge-port-offset", type=int, default=0, help="Optional offset added to public edge ports")
    parser.add_argument("--guard-ip", default="", help="Your SparrowX Edge server public IPv4")
    parser.add_argument("--domain", "-d", default="sparrowx.net", help="SparrowX master domain")
    parser.add_argument("--apply-edge", action="store_true", help="Apply nftables Edge Proxy rule immediately on this Linux server")
    parser.add_argument("--out", "-o", default="", help="Output directory for generated pack")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Path to client registry JSON")
    parser.add_argument("--list", action="store_true", help="List all registered protected client servers")
    parser.add_argument("--remove", metavar="AGENT_ID", default="", help="Remove a client edge proxy by Agent ID")
    args = parser.parse_args(argv)

    reg_path = Path(args.registry)
    if args.list:
        entries = load_registry(reg_path)
        if not entries:
            print("No protected client servers registered yet.")
            return 0
        print(f"{'AGENT ID':<22} {'TYPE':<11} {'USER':<14} {'EDGE PORTS':<20} {'BACKEND IP':<16} {'STATUS'}")
        print("-" * 100)
        for item in entries:
            print(
                f"{str(item.get('agent_id', '')):<22} {str(item.get('kind', item.get('profile', 'VPS'))):<11} "
                f"{str(item.get('username', '')):<14} {str(item.get('edge_ports', item.get('ports', ''))):<20} "
                f"{str(item.get('client_ip', '-')):<16} {str(item.get('status', ''))}"
            )
        return 0

    if args.remove:
        entries = load_registry(reg_path)
        target = next((e for e in entries if e.get("agent_id") == args.remove), None)
        if target and target.get("bundle_dir"):
            rm_sh = Path(target["bundle_dir"]) / "01-edge-remove-from-sparrowx.sh"
            if rm_sh.exists() and sys.platform.startswith("linux") and os.geteuid() == 0:
                run_cmd(["bash", str(rm_sh)], timeout=5.0)
        kept = [e for e in entries if e.get("agent_id") != args.remove]
        save_registry(reg_path, kept)
        print(f"[OK] Removed client proxy {args.remove}")
        return 0

    # Non-interactive mode if required flags are all provided
    if args.username and args.email and args.profile:
        out_dir = Path(args.out).resolve() if args.out else None
        try:
            bundle, bundle_dir, written = generate_client_bundle(
                username=args.username,
                email=args.email,
                client_ip=args.client_ip,
                profile=args.profile,
                ports=args.ports,
                edge_port_offset=args.edge_port_offset,
                master_domain=args.domain,
                guard_ip=args.guard_ip,
                apply_edge_now=args.apply_edge,
                out_dir=out_dir,
                registry_path=reg_path,
            )
            print(f"[OK] Generated {bundle['kind']} protection pack in {bundle_dir} ({len(written)} files)")
            return 0
        except ValueError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            return 1

    return run_interactive_wizard(args)


if __name__ == "__main__":
    raise SystemExit(main())
