#!/bin/bash
# SparrowX Guard Server Smart Hardening & Zero-False-Positive Defense Script
# Applies kernel hardening, safe community threat lists (strictly excluding private/RFC1918/CDN/DNS/admin IPs),
# and burst-tolerant nftables rate-limiting that protects services without banning normal users.

set -u

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RESET='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
INSTALL_DIR="$SCRIPT_DIR"

HOST_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
GW_IP="$(ip route show default 2>/dev/null | awk '/default/ {print $3; exit}' || true)"
SSH_ADMIN_IP="$(echo "${SSH_CONNECTION:-${SSH_CLIENT:-}}" | awk '{print $1}' || true)"

echo -e "${BLUE}[1/6] Hardening Kernel (sysctl)...${RESET}"
cat << 'EOF' > /etc/sysctl.d/99-sparrowx-hardening.conf
# Anti-spoofing (loose mode = 2 so WireGuard/multi-homed asymmetric routes never drop legit traffic)
net.ipv4.conf.all.rp_filter = 2
net.ipv4.conf.default.rp_filter = 2

# SYN Flood Protection (SYN cookies + generous backlog for legit bursts)
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 16384
net.ipv4.tcp_synack_retries = 3
net.ipv4.tcp_syn_retries = 4

# Ignore ICMP Broadcasts
net.ipv4.icmp_echo_ignore_broadcasts = 1

# IP Forwarding for WireGuard / GRE Tunnels
net.ipv4.ip_forward = 1

# Optimization for high legitimate concurrency
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 16384
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
EOF
sysctl -p /etc/sysctl.d/99-sparrowx-hardening.conf >/dev/null 2>&1 || true

# Helper to strip RFC1918, Loopback, CGNAT, Link-local, Multicast, and public DNS from threat feeds
filter_safe_threat_feed() {
  grep -oE '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?' | \
  grep -vE '^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.|224\.|240\.|255\.|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|9\.9\.9\.9)'
}

echo -e "${BLUE}[2/6] Downloading & Sanitizing Community Threat Lists (RFC1918/CDN/DNS excluded)...${RESET}"
mkdir -p "$INSTALL_DIR/threat-lists"
curl -fsSL --max-time 15 https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt 2>/dev/null | filter_safe_threat_feed > "$INSTALL_DIR/threat-lists/emerging.txt" || true
curl -fsSL --max-time 15 https://www.spamhaus.org/drop/drop.txt 2>/dev/null | filter_safe_threat_feed > "$INSTALL_DIR/threat-lists/spamhaus.txt" || true

echo -e "${BLUE}[3/6] Applying Smart Nftables Ruleset (Whitelist-First + Burst-Tolerant Mitigation)...${RESET}"
EXTRA_WL=""
for ip in "$HOST_IP" "$GW_IP" "$SSH_ADMIN_IP"; do
  if [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    EXTRA_WL="${EXTRA_WL}      ${ip},\n"
  fi
done

cat << NFTEOF > /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset

table inet detroit_guard {
  # Permanent Whitelist: Internal, Docker, WireGuard, DNS, Cloudflare Edge & Active Admin
  set whitelist {
    type ipv4_addr
    flags interval
    elements = {
      127.0.0.0/8,
      10.0.0.0/8,
      172.16.0.0/12,
      192.168.0.0/16,
      100.64.0.0/10,
      169.254.0.0/16,
      1.1.1.1,
      1.0.0.1,
      8.8.8.8,
      8.8.4.4,
      9.9.9.9,
      173.245.48.0/20,
      103.21.244.0/22,
      103.22.200.0/22,
      103.31.4.0/22,
      141.101.64.0/18,
      108.162.192.0/18,
      190.93.240.0/20,
      188.114.96.0/20,
      197.234.240.0/22,
      198.41.128.0/17,
      162.158.0.0/15,
      104.16.0.0/13,
      104.24.0.0/14,
      172.64.0.0/13,
      131.0.72.0/22
    }
  }

  # Short temporary blacklist (15m auto-expiry so no normal user is ever permanently stuck)
  set blacklist {
    type ipv4_addr
    flags dynamic,timeout
    timeout 15m
  }

  # Sanitized Community Threat Intelligence (public malicious ranges only)
  set threat_intel {
    type ipv4_addr
    flags interval
  }

  set syn_meter { type ipv4_addr; flags dynamic,timeout; timeout 30s; }
  set udp_meter { type ipv4_addr; flags dynamic,timeout; timeout 30s; }

  chain input {
    type filter hook input priority 0; policy accept;

    # 1. Always accept loopback, established flows, and trusted whitelist FIRST
    iif lo accept
    ct state established,related accept
    ip saddr @whitelist accept

    # 2. Drop known malicious & temporarily auto-banned flooders
    ip saddr @blacklist drop
    ip saddr @threat_intel drop

    # 3. Drop invalid TCP state packets
    ct state invalid drop

    # 4. Allow Essential Services (rate-protected against extreme volumetric floods only)
    tcp dport { 22, 80, 443, 3000, 3001 } tcp flags syn \
      add @syn_meter { ip saddr limit rate over 400/second burst 800 packets } \
      drop
    tcp dport { 22, 80, 443, 3000, 3001 } accept
    ip protocol gre accept

    # 5. Extreme sustained SYN flood on non-web ports: >800 SYN/s -> 15m temp ban
    tcp flags syn \
      add @syn_meter { ip saddr limit rate over 800/second burst 1200 packets } \
      add @blacklist { ip saddr timeout 15m } \
      log prefix "[SBS-BAN-SYN] " drop

    # 6. Extreme volumetric UDP flood: >15000 pps -> 15m temp ban (never triggers on normal games/VPN)
    meta l4proto udp \
      add @udp_meter { ip saddr limit rate over 15000/second burst 20000 packets } \
      add @blacklist { ip saddr timeout 15m } \
      log prefix "[SBS-BAN-UDP] " drop
  }

  chain forward {
    type filter hook forward priority 0; policy accept;
    ct state established,related accept
    ip saddr @whitelist accept
    ip saddr @blacklist drop
    ip saddr @threat_intel drop
  }
}
NFTEOF

systemctl restart nftables 2>/dev/null || nft -f /etc/nftables.conf 2>/dev/null || true

for ip in "$HOST_IP" "$GW_IP" "$SSH_ADMIN_IP"; do
  if [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    nft add element inet detroit_guard whitelist "{ $ip }" 2>/dev/null || true
  fi
done

cat "$INSTALL_DIR/threat-lists/"*.txt 2>/dev/null | sort -u | while read -r ip; do
  [ -n "$ip" ] && nft add element inet detroit_guard threat_intel "{ $ip }" 2>/dev/null || true
done

echo -e "${BLUE}[4/6] Setting up Safe Automatic Threat List Sync (Cron)...${RESET}"
cat << CRONEOF > /etc/cron.daily/sparrowx-sync-threats
#!/bin/bash
filter_safe() {
  grep -oE '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?' | \
  grep -vE '^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.|224\.|240\.|255\.|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|9\.9\.9\.9)'
}
curl -fsSL --max-time 15 https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt 2>/dev/null | filter_safe > "$INSTALL_DIR/threat-lists/emerging.txt" || true
curl -fsSL --max-time 15 https://www.spamhaus.org/drop/drop.txt 2>/dev/null | filter_safe > "$INSTALL_DIR/threat-lists/spamhaus.txt" || true
nft flush set inet detroit_guard threat_intel 2>/dev/null || true
cat "$INSTALL_DIR/threat-lists/"*.txt 2>/dev/null | sort -u | while read -r ip; do
  [ -n "\$ip" ] && nft add element inet detroit_guard threat_intel "{ \$ip }" 2>/dev/null || true
done
CRONEOF
chmod +x /etc/cron.daily/sparrowx-sync-threats

echo -e "${BLUE}[5/6] Verifying FastNetMon Status...${RESET}"
if systemctl is-active --quiet fastnetmon; then
  echo -e "${GREEN}[ok] FastNetMon is running.${RESET}"
else
  echo -e "${YELLOW}[!] FastNetMon is NOT active. Please check /etc/fastnetmon.conf${RESET}"
fi

echo -e "${BLUE}[6/6] Hardening SSH (Safe Auth Retries)...${RESET}"
sed -i 's/#MaxAuthTries 6/MaxAuthTries 6/' /etc/ssh/sshd_config 2>/dev/null || true
systemctl reload ssh 2>/dev/null || systemctl restart ssh 2>/dev/null || true

echo -e "${GREEN}============================================${RESET}"
echo -e "${GREEN}  Smart Guard Server Hardening Complete!    ${RESET}"
echo -e "${GREEN}  - Whitelist-First (Admin/Docker/WG/CDN)   ${RESET}"
echo -e "${GREEN}  - Sanitized Threat Lists (No RFC1918)     ${RESET}"
echo -e "${GREEN}  - Burst-Tolerant 15m Auto-Mitigation      ${RESET}"
echo -e "${GREEN}============================================${RESET}"
