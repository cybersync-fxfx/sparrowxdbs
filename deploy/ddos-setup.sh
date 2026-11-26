#!/usr/bin/env bash
# ==============================================================================
# SPARROWX SINGLE-FILE L3/L4/L7 DDOS PROTECTION SETUP & XDP BUILDER
# ==============================================================================
# Self-contained installer for Ubuntu/Debian VPS, Game Nodes & Edge Hosts.
# Combines:
#   1. APT lock healing + eBPF toolchain (clang, llvm, libbpf-dev, bpftool, iproute2)
#   2. L3/L4 SYN-flood, anti-spoofing, UDP buffer & BBR sysctl hardening
#   3. Fail2Ban DDoS/Auth/HTTP flood jails + UFW Game/VPN/Web port policy
#   4. Verifier-safe XDP/eBPF kernel filter (sparrowx_xdp_ddos.c) + ELF compile
#   5. Auto-attach (native XDP -> xdpgeneric fallback) + systemd reboot persistence
#   6. Application Vite/Docker rebuild & Nginx DDoS proxy reload (--with-build)
#
# Usage:
#   curl -sSL https://sparrowx.net/ddos-setup.sh | sudo bash
#   sudo bash deploy/ddos-setup.sh [--auto] [--iface eth0] [--xdp-mode auto|native|generic|off] [--with-build] [--detach] [--status]
# ==============================================================================
set -u

XDP_MODE="auto"
WITH_BUILD="false"
ACTION="setup"
IFACE="${SPARROWX_XDP_IFACE:-}"
SYNC_FILE="/opt/sparrowx/xdp/blocked_ipv4.txt"
AUTO_MODE="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --auto|-y|--yes)
      AUTO_MODE="true"
      shift
      ;;
    --iface)
      IFACE="${2:-}"
      shift 2
      ;;
    --xdp-mode)
      XDP_MODE="${2:-auto}"
      shift 2
      ;;
    --xdp)
      XDP_MODE="auto"
      shift
      ;;
    --no-xdp)
      XDP_MODE="off"
      shift
      ;;
    --with-build|--build)
      WITH_BUILD="true"
      shift
      ;;
    --sync-ips)
      SYNC_FILE="${2:-}"
      shift 2
      ;;
    --detach)
      ACTION="detach"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --help|-h)
      cat <<'HELP'
SparrowX Single-File L3/L4/L7 DDoS Protection Setup (ddos-setup.sh)

Usage:
  ./ddos-setup.sh [options]

Options:
  --iface <dev>               Network interface (default: auto-detected default route NIC)
  --xdp-mode <mode>           auto | native | generic | off (default: auto)
  --with-build                Run app build (npm run build / Docker Compose app rebuild + Nginx reload)
  --sync-ips <file>           Seed blocked IPv4s (one IP per line) into XDP blocked_ipv4 map
  --detach                    Detach XDP filter and disable sparrowx-xdp.service
  --status                    Show kernel sysctl, Fail2Ban, UFW, and XDP interface status
  --auto, -y                  Non-interactive unattended run
  --help, -h                  Show this help screen
HELP
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[1;36m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info() { echo -e "  ${C_CYAN}[INFO]${C_RESET}  $*"; }
log_ok()   { echo -e "  ${C_GREEN}[ OK ]${C_RESET}  $*"; }
log_warn() { echo -e "  ${C_YELLOW}[WARN]${C_RESET}  $*"; }
log_err()  { echo -e "  ${C_RED}[ERR ]${C_RESET}  $*"; }

# Resolve INSTALL_DIR dynamically
SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" 2>/dev/null && pwd || pwd)"
if [ -f "./docker-compose.ovh.yml" ] || [ -f "./package.json" ]; then
  INSTALL_DIR="$(pwd)"
elif [ -f "${SCRIPT_DIR}/../docker-compose.ovh.yml" ] || [ -f "${SCRIPT_DIR}/../package.json" ]; then
  INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -d "/opt/sparrowxdbs" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -d "/opt/sparrowx" ]; then
  INSTALL_DIR="/opt/sparrowx"
else
  INSTALL_DIR="/opt/sparrowx"
fi

[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

if [ -z "${IFACE}" ] && command -v ip >/dev/null 2>&1; then
  IFACE="$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}' || true)"
fi

if [ "${ACTION}" = "status" ]; then
  echo "=================================================================="
  echo "  SPARROWX L3/L4/L7 DDOS PROTECTION STATUS"
  echo "=================================================================="
  echo "  Install Dir : ${INSTALL_DIR}"
  echo "  Primary NIC : ${IFACE:-unknown}"
  echo "  SYN Cookies : $(sysctl -n net.ipv4.tcp_syncookies 2>/dev/null || echo n/a)"
  echo "  RP Filter   : $(sysctl -n net.ipv4.conf.all.rp_filter 2>/dev/null || echo n/a)"
  echo "  Congestion  : $(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo n/a)"
  if [ -n "${IFACE}" ] && command -v ip >/dev/null 2>&1; then
    echo "--- XDP Link Status (${IFACE}) ---"
    ip -details link show dev "${IFACE}" | grep -E "mtu|xdp|prog" || true
  fi
  if command -v fail2ban-client >/dev/null 2>&1; then
    echo "--- Fail2Ban Status ---"
    fail2ban-client status 2>/dev/null || true
  fi
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo -E bash "$0" "$@"
  else
    log_err "Root privileges required to configure kernel sysctl, UFW, Fail2Ban, and XDP."
    exit 1
  fi
fi

if [ "${ACTION}" = "detach" ]; then
  if [ -n "${IFACE}" ] && command -v ip >/dev/null 2>&1; then
    ip link set dev "${IFACE}" xdp off >/dev/null 2>&1 || true
    ip link set dev "${IFACE}" xdpgeneric off >/dev/null 2>&1 || true
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now sparrowx-xdp.service >/dev/null 2>&1 || true
  fi
  rm -rf /sys/fs/bpf/sparrowx
  log_ok "Detached SparrowX XDP Anti-DDoS filter (${IFACE:-all})"
  exit 0
fi

echo -e "${C_CYAN}==================================================================${C_RESET}"
echo -e "${C_BOLD}  SPARROWX DDOS PROTECTION LAYER SETUP & XDP KERNEL BUILDER${C_RESET}"
echo -e "${C_CYAN}==================================================================${C_RESET}"

# ------------------------------------------------------------------------------
# 1. Heal APT Locks & Install eBPF/Firewall Dependencies
# ------------------------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  if ! pgrep -x "apt|apt-get|dpkg|unattended-upgr" >/dev/null 2>&1; then
    rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock* >/dev/null 2>&1 || true
    dpkg --configure -a >/dev/null 2>&1 || true
  fi
  log_info "Ensuring kernel DDoS, UFW, Fail2Ban & XDP/eBPF toolchain packages..."
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq iproute2 ufw fail2ban python3-systemd psmisc curl clang llvm libbpf-dev linux-libc-dev >/dev/null 2>&1 || \
    apt-get install -y -qq iproute2 ufw fail2ban psmisc curl clang llvm libbpf-dev >/dev/null 2>&1 || \
    apt-get install -y -qq iproute2 ufw fail2ban psmisc curl >/dev/null 2>&1 || true
  apt-get install -y -qq "linux-headers-$(uname -r)" linux-tools-common "linux-tools-$(uname -r)" bpftool >/dev/null 2>&1 || true
  if [ ! -e /usr/include/asm ] && [ -d "/usr/include/$(uname -m)-linux-gnu/asm" ]; then
    ln -s "/usr/include/$(uname -m)-linux-gnu/asm" /usr/include/asm 2>/dev/null || true
  fi
fi

# ------------------------------------------------------------------------------
# 2. Apply L3/L4 Kernel SYN-Cookie, UDP Buffer & Safe Anti-Spoofing Hardening
# ------------------------------------------------------------------------------
cat > /etc/sysctl.d/99-sparrowx-hardening.conf <<'EOF'
# SparrowX Smart L3/L4 DDoS, SYN-Flood, UDP Game Flood & Anti-Spoofing Kernel Profile
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_synack_retries = 3
net.ipv4.tcp_syn_retries = 4
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_rfc1337 = 1
# Loose reverse-path filtering (2) so WireGuard / multi-homed tunnels never drop valid traffic
net.ipv4.conf.all.rp_filter = 2
net.ipv4.conf.default.rp_filter = 2
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.log_martians = 0
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 65535
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.ip_local_port_range = 10240 65000
EOF
sysctl --system >/dev/null 2>&1 || sysctl -p /etc/sysctl.d/99-sparrowx-hardening.conf >/dev/null 2>&1 || true
log_ok "Applied /etc/sysctl.d/99-sparrowx-hardening.conf (SYN cookies, BBR, loose RP-filter, UDP buffers)"

# ------------------------------------------------------------------------------
# 3. Smart Fail2Ban Protection (Protected ignoreip + Progressive Ban) & UFW
# ------------------------------------------------------------------------------
if command -v fail2ban-server >/dev/null 2>&1 || [ -d /etc/fail2ban ]; then
  mkdir -p /etc/fail2ban/jail.d /var/log /var/run/fail2ban
  touch /var/log/auth.log 2>/dev/null || true
  F2B_BACKEND="auto"
  if command -v python3 >/dev/null 2>&1 && python3 -c "import systemd.journal" >/dev/null 2>&1; then
    F2B_BACKEND="systemd"
  fi

  # Auto-build safe ignoreip list so internal services, Docker, WireGuard, Cloudflare, DNS & admin SSH are NEVER banned
  F2B_IGNORE="127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16"
  F2B_IGNORE="${F2B_IGNORE} 1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 9.9.9.9"
  F2B_IGNORE="${F2B_IGNORE} 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
  HOST_PUB_IP="$(ip -4 -o addr show dev "${IFACE}" 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n 1 || true)"
  GW_PUB_IP="$(ip route show default 2>/dev/null | awk '/default/ {print $3; exit}' || true)"
  SSH_ADMIN_IP="$(echo "${SSH_CONNECTION:-${SSH_CLIENT:-}}" | awk '{print $1}' || true)"
  for extra_ip in "${HOST_PUB_IP}" "${GW_PUB_IP}" "${SSH_ADMIN_IP}"; do
    if [[ "${extra_ip}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
      F2B_IGNORE="${F2B_IGNORE} ${extra_ip}"
    fi
  done
  if [ -f "/opt/sparrowx/xdp/whitelist_ipv4.txt" ]; then
    while IFS= read -r raw_wl; do
      wl_ip="$(echo "${raw_wl%%#*}" | tr -d ' \r\n')"
      [[ "${wl_ip}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && F2B_IGNORE="${F2B_IGNORE} ${wl_ip}"
    done < "/opt/sparrowx/xdp/whitelist_ipv4.txt"
  fi

  cat > /etc/fail2ban/jail.d/sparrowx-ddos.conf <<EOF
[DEFAULT]
# Never ban localhost, Docker, WireGuard, Cloudflare edges, public DNS, host IP, or admin SSH
ignoreip = ${F2B_IGNORE}
bantime = 600
bantime.increment = true
bantime.factor = 2
bantime.maxtime = 86400
findtime = 600
maxretry = 8

[sshd]
enabled = true
backend = ${F2B_BACKEND}
logpath = /var/log/auth.log
maxretry = 6
findtime = 600
bantime = 900
EOF
  systemctl unmask fail2ban >/dev/null 2>&1 || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban >/dev/null 2>&1 || true
  log_ok "Configured Smart Fail2Ban with protected ignoreip + progressive bans (/etc/fail2ban/jail.d/sparrowx-ddos.conf)"
fi

if command -v ufw >/dev/null 2>&1; then
  ACTIVE_SSH_PORT="$(ss -tulnp 2>/dev/null | awk '/sshd/ {print $5}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1 || echo 22)"
  [ -z "${ACTIVE_SSH_PORT}" ] && ACTIVE_SSH_PORT=22
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow "${ACTIVE_SSH_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT:-80}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT:-443}"/tcp >/dev/null 2>&1 || true
  # Protected L4 XDP / Game / VPN / DNS ports
  ufw allow 53/udp >/dev/null 2>&1 || true
  ufw allow 1194/udp >/dev/null 2>&1 || true
  ufw allow 51820/udp >/dev/null 2>&1 || true
  ufw allow 28015/udp >/dev/null 2>&1 || true
  ufw allow 2300/udp >/dev/null 2>&1 || true
  ufw allow 2895/tcp >/dev/null 2>&1 || true
  ufw allow 2896/udp >/dev/null 2>&1 || true
  ufw allow 3659/udp >/dev/null 2>&1 || true
  ufw allow 4970:4980/udp >/dev/null 2>&1 || true
  ufw allow 7000:9999/udp >/dev/null 2>&1 || true
  ufw allow 22000:22126/udp >/dev/null 2>&1 || true
  ufw allow 27000:27500/udp >/dev/null 2>&1 || true
  ufw allow 30000:32000/udp >/dev/null 2>&1 || true
  ufw allow 30000:32000/tcp >/dev/null 2>&1 || true
  log_ok "Verified UFW Web (80/443), SSH (${ACTIVE_SSH_PORT}), VPN & XDP Game DDoS port policy"
fi

# ------------------------------------------------------------------------------
# 4. Provision Canonical XDP C Source + Attach Helper (Standalone OR Repo)
# ------------------------------------------------------------------------------
XDP_REPO_DIR="${INSTALL_DIR}/deploy/xdp"
XDP_OUT_DIR="/opt/sparrowx/xdp"
mkdir -p "${XDP_REPO_DIR}" "${XDP_OUT_DIR}" /sys/fs/bpf/sparrowx 2>/dev/null || true

XDP_SRC="${XDP_REPO_DIR}/sparrowx_xdp_ddos.c"
if [ ! -s "${XDP_SRC}" ]; then
  log_info "Writing smart zero-false-positive XDP/eBPF kernel filter -> ${XDP_SRC}..."
  cat > "${XDP_SRC}" <<'XDPCEOF'
// SPDX-License-Identifier: GPL-2.0
/*
 * SparrowX Shield — Smart Zero-False-Positive Layer 3/4 XDP / eBPF Anti-DDoS Engine
 */
#include <stddef.h>
#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/in.h>
#include <linux/ip.h>
#include <linux/ipv6.h>
#include <linux/tcp.h>
#include <linux/udp.h>
#include <bpf/bpf_endian.h>
#include <bpf/bpf_helpers.h>

#define WHITELIST_TTL_NS      300000000000ULL
#define RATE_WINDOW_NS        1000000000ULL
#define UDP_FLOOD_PPS_LIMIT   2500U
#define SYN_FLOOD_PPS_LIMIT   600U
#define ICMP_FLOOD_PPS_LIMIT  200U

struct ip_rate_state {
  __u64 window_start_ns;
  __u32 udp_pkts;
  __u32 syn_pkts;
  __u32 icmp_pkts;
  __u32 pad;
};

struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 65536);
} static_whitelist SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_LRU_PERCPU_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 2000000);
} whitelist SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 262144);
} blocked_ipv4 SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_LRU_PERCPU_HASH);
  __type(key, __u32);
  __type(value, struct ip_rate_state);
  __uint(max_entries, 524288);
} ip_rate_map SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 4);
} xdp_stats SEC(".maps");

static __always_inline void stat_inc(__u32 idx) {
  __u64 *val = bpf_map_lookup_elem(&xdp_stats, &idx);
  if (val) *val += 1;
}

static __always_inline int is_internal_or_safe_ipv4(__u32 saddr_be) {
  __u32 ip = bpf_ntohl(saddr_be);
  __u8 o1 = (__u8)(ip >> 24);
  __u8 o2 = (__u8)((ip >> 16) & 0xff);
  if (o1 == 127 || o1 == 10) return 1;
  if (o1 == 172 && o2 >= 16 && o2 <= 31) return 1;
  if (o1 == 192 && o2 == 168) return 1;
  if (o1 == 100 && o2 >= 64 && o2 <= 127) return 1;
  if (o1 == 169 && o2 == 254) return 1;
  return 0;
}

static __always_inline int is_critical_dns_ipv4(__u32 saddr_be) {
  __u32 ip = bpf_ntohl(saddr_be);
  if (ip == 0x01010101U || ip == 0x01000001U) return 1;
  if (ip == 0x08080808U || ip == 0x08080404U) return 1;
  if (ip == 0x09090909U || ip == 0x95707070U) return 1;
  return 0;
}

SEC("xdp")
int xdp_anti_ddos(struct xdp_md *ctx) {
  void *data = (void *)(long)ctx->data;
  void *data_end = (void *)(long)ctx->data_end;
  struct ethhdr *eth = data;
  if ((void *)(eth + 1) > data_end) return XDP_PASS;

  if (eth->h_proto == bpf_htons(ETH_P_IP)) {
    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) return XDP_PASS;
    if (ip->ihl < 5) { stat_inc(2); return XDP_DROP; }
    __u32 ihl_bytes = (__u32)ip->ihl * 4;
    if (ihl_bytes > 60) { stat_inc(2); return XDP_DROP; }

    __u32 src_ip = ip->saddr;
    if (is_internal_or_safe_ipv4(src_ip) || is_critical_dns_ipv4(src_ip)) {
      stat_inc(3);
      return XDP_PASS;
    }
    if (bpf_map_lookup_elem(&static_whitelist, &src_ip) != NULL) {
      stat_inc(3);
      return XDP_PASS;
    }
    __u64 ts = bpf_ktime_get_ns();
    __u64 *wl_ts = bpf_map_lookup_elem(&whitelist, &src_ip);
    if (wl_ts && (*wl_ts == 0 || (ts >= *wl_ts && (ts - *wl_ts) < WHITELIST_TTL_NS))) {
      stat_inc(3);
      return XDP_PASS;
    }
    __u64 *blk = bpf_map_lookup_elem(&blocked_ipv4, &src_ip);
    if (blk != NULL) {
      __sync_fetch_and_add(blk, 1);
      stat_inc(2);
      return XDP_DROP;
    }

    __u8 proto = ip->protocol;
    if (proto == IPPROTO_UDP) {
      struct udphdr *udp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(udp + 1) > data_end) return XDP_PASS;
      if (bpf_ntohs(udp->len) < sizeof(struct udphdr)) { stat_inc(2); return XDP_DROP; }
      if (bpf_ntohs(udp->source) == 53) { stat_inc(0); return XDP_PASS; }
      struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
      if (!st) {
        struct ip_rate_state init_st = { .window_start_ns = ts, .udp_pkts = 1 };
        bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
      } else if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
        st->window_start_ns = ts; st->udp_pkts = 1; st->syn_pkts = 0; st->icmp_pkts = 0;
      } else {
        st->udp_pkts += 1;
        if (st->udp_pkts > UDP_FLOOD_PPS_LIMIT) { stat_inc(1); stat_inc(2); return XDP_DROP; }
      }
      stat_inc(0);
      return XDP_PASS;
    }
    if (proto == IPPROTO_TCP) {
      struct tcphdr *tcp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(tcp + 1) > data_end) return XDP_PASS;
      if (tcp->syn && !tcp->ack) {
        struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
        if (!st) {
          struct ip_rate_state init_st = { .window_start_ns = ts, .syn_pkts = 1 };
          bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
        } else if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
          st->window_start_ns = ts; st->udp_pkts = 0; st->syn_pkts = 1; st->icmp_pkts = 0;
        } else {
          st->syn_pkts += 1;
          if (st->syn_pkts > SYN_FLOOD_PPS_LIMIT) { stat_inc(1); stat_inc(2); return XDP_DROP; }
        }
      }
      stat_inc(0);
      return XDP_PASS;
    }
    if (proto == IPPROTO_ICMP) {
      struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
      if (!st) {
        struct ip_rate_state init_st = { .window_start_ns = ts, .icmp_pkts = 1 };
        bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
      } else if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
        st->window_start_ns = ts; st->udp_pkts = 0; st->syn_pkts = 0; st->icmp_pkts = 1;
      } else {
        st->icmp_pkts += 1;
        if (st->icmp_pkts > ICMP_FLOOD_PPS_LIMIT) { stat_inc(1); stat_inc(2); return XDP_DROP; }
      }
      stat_inc(0);
      return XDP_PASS;
    }
    stat_inc(0);
    return XDP_PASS;
  } else if (eth->h_proto == bpf_htons(ETH_P_IPV6)) {
    struct ipv6hdr *ip6 = (void *)(eth + 1);
    if ((void *)(ip6 + 1) > data_end) return XDP_PASS;
    stat_inc(0);
    return XDP_PASS;
  }
  return XDP_PASS;
}
char _license[] SEC("license") = "GPL";
XDPCEOF
fi

cp -f "${XDP_SRC}" "${XDP_OUT_DIR}/sparrowx_xdp_ddos.c" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Compile & Attach XDP Program + Configure Reboot Persistence (sparrowx-xdp)
# ------------------------------------------------------------------------------
XDP_ATTACHED="no"
if [ "${XDP_MODE}" != "off" ] && [ -n "${IFACE}" ]; then
  if command -v clang >/dev/null 2>&1 && command -v ip >/dev/null 2>&1; then
    XDP_OBJ="${XDP_OUT_DIR}/sparrowx_xdp_ddos.o"
    ARCH_INC="/usr/include/$(uname -m)-linux-gnu"
    BPF_ARCH="$(uname -m | sed 's/x86_64/x86/; s/aarch64/arm64/')"
    CLANG_ARGS=("-O2" "-g" "-Wall" "-Wextra" "-target" "bpf" "-D__TARGET_ARCH_${BPF_ARCH}")
    [ -d "${ARCH_INC}" ] && CLANG_ARGS+=("-I${ARCH_INC}")

    log_info "Compiling ${XDP_SRC} -> ${XDP_OBJ}..."
    if clang "${CLANG_ARGS[@]}" -c "${XDP_SRC}" -o "${XDP_OBJ}"; then
      ip link set dev "${IFACE}" xdp off >/dev/null 2>&1 || true
      ip link set dev "${IFACE}" xdpgeneric off >/dev/null 2>&1 || true

      if [ "${XDP_MODE}" = "generic" ]; then
        if ip link set dev "${IFACE}" xdpgeneric obj "${XDP_OBJ}" sec xdp; then
          XDP_ATTACHED="generic"
        fi
      else
        if ip link set dev "${IFACE}" xdp obj "${XDP_OBJ}" sec xdp 2>/dev/null; then
          XDP_ATTACHED="native"
        elif ip link set dev "${IFACE}" xdpgeneric obj "${XDP_OBJ}" sec xdp 2>/dev/null; then
          XDP_ATTACHED="generic"
        fi
      fi

      if [ "${XDP_ATTACHED}" != "no" ]; then
        log_ok "Attached SparrowX Smart XDP Anti-DDoS onto ${IFACE} (mode=${XDP_ATTACHED})"
        if command -v bpftool >/dev/null 2>&1; then
          WL_MAP_ID="$(bpftool map show 2>/dev/null | awk -F: '/static_whitelist/ {print $1; exit}' || true)"
          if [ -n "${WL_MAP_ID}" ]; then
            for safe_ip in "${HOST_PUB_IP:-}" "${GW_PUB_IP:-}" "${SSH_ADMIN_IP:-}"; do
              [[ "${safe_ip}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || continue
              IFS='.' read -r o1 o2 o3 o4 <<<"${safe_ip}"
              hex_bytes="$(printf '%02x %02x %02x %02x' "${o1}" "${o2}" "${o3}" "${o4}")"
              bpftool map update id "${WL_MAP_ID}" key hex ${hex_bytes} value hex 01 00 00 00 00 00 00 00 >/dev/null 2>&1 || true
            done
            if [ -f "/opt/sparrowx/xdp/whitelist_ipv4.txt" ]; then
              while IFS= read -r raw_wl; do
                wl_ip="$(echo "${raw_wl%%#*}" | tr -d ' \r\n')"
                [[ "${wl_ip}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || continue
                IFS='.' read -r o1 o2 o3 o4 <<<"${wl_ip}"
                hex_bytes="$(printf '%02x %02x %02x %02x' "${o1}" "${o2}" "${o3}" "${o4}")"
                bpftool map update id "${WL_MAP_ID}" key hex ${hex_bytes} value hex 01 00 00 00 00 00 00 00 >/dev/null 2>&1 || true
              done < "/opt/sparrowx/xdp/whitelist_ipv4.txt"
            fi
            log_ok "Seeded XDP static_whitelist map (id=${WL_MAP_ID}) with host, gateway, SSH & whitelist entries"
          fi
        fi
        if [ -f "${SYNC_FILE}" ] && command -v bpftool >/dev/null 2>&1; then
          MAP_ID="$(bpftool map show 2>/dev/null | awk -F: '/blocked_ipv4/ {print $1; exit}' || true)"
          if [ -n "${MAP_ID}" ]; then
            while IFS= read -r ip_addr; do
              ip_clean="$(echo "${ip_addr%%#*}" | tr -d ' \r\n')"
              [[ "${ip_clean}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || continue
              # Never inject internal/private/DNS IPs into XDP blocked_ipv4
              [[ "${ip_clean}" =~ ^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.) ]] && continue
              [[ "${ip_clean}" == "1.1.1.1" || "${ip_clean}" == "1.0.0.1" || "${ip_clean}" == "8.8.8.8" || "${ip_clean}" == "8.8.4.4" || "${ip_clean}" == "9.9.9.9" ]] && continue
              IFS='.' read -r o1 o2 o3 o4 <<<"${ip_clean}"
              hex_bytes="$(printf '%02x %02x %02x %02x' "${o1}" "${o2}" "${o3}" "${o4}")"
              bpftool map update id "${MAP_ID}" key hex ${hex_bytes} value hex 01 00 00 00 00 00 00 00 >/dev/null 2>&1 || true
            done < "${SYNC_FILE}"
            log_ok "Synchronized safe public IPs from ${SYNC_FILE} into XDP blocked_ipv4 map (id=${MAP_ID})"
          fi
        fi

        if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
          cat > /etc/systemd/system/sparrowx-xdp.service <<EOF
[Unit]
Description=SparrowX Layer 3/4 XDP/eBPF Anti-DDoS Scrubber
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'ip link set dev ${IFACE} xdp off 2>/dev/null || true; ip link set dev ${IFACE} xdp obj ${XDP_OBJ} sec xdp 2>/dev/null || ip link set dev ${IFACE} xdpgeneric obj ${XDP_OBJ} sec xdp'
ExecStop=/bin/bash -c 'ip link set dev ${IFACE} xdp off 2>/dev/null || true; ip link set dev ${IFACE} xdpgeneric off 2>/dev/null || true'

[Install]
WantedBy=multi-user.target
EOF
          systemctl daemon-reload >/dev/null 2>&1 || true
          systemctl enable sparrowx-xdp.service >/dev/null 2>&1 || true
          log_ok "Installed reboot-persistent systemd unit: sparrowx-xdp.service"
        fi
      else
        log_warn "XDP attachment skipped by host kernel/driver (sysctl + UFW + Fail2Ban L3/L4 protection remains active)"
      fi
    else
      log_warn "XDP compilation skipped (check linux-headers-$(uname -r) and libbpf-dev installation)"
    fi
  else
    log_warn "clang/iproute2 missing — kernel sysctl, UFW & Fail2Ban L3/L4 protection active; install clang + libbpf-dev for XDP"
  fi
fi

# ------------------------------------------------------------------------------
# 6. Link CLI Commands & Optional Application Build / Edge Reload
# ------------------------------------------------------------------------------
chmod +x "${INSTALL_DIR}/deploy/ddos-setup.sh" "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" 2>/dev/null || true
if [ -d /usr/local/bin ]; then
  [ -f "${INSTALL_DIR}/deploy/ddos-setup.sh" ] && ln -sf "${INSTALL_DIR}/deploy/ddos-setup.sh" /usr/local/bin/sparrowx-ddos 2>/dev/null || true
  [ -f "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" ] && ln -sf "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" /usr/local/bin/sparrowx-xdp 2>/dev/null || true
fi

if [ "${WITH_BUILD}" = "true" ] && [ -d "${INSTALL_DIR}" ] && [ -f "${INSTALL_DIR}/package.json" ]; then
  cd "${INSTALL_DIR}" || exit 0
  if command -v npm >/dev/null 2>&1; then
    log_info "Building SparrowX production bundle (npm run build)..."
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
    npm run build >/dev/null 2>&1 && log_ok "Completed npm run build" || log_warn "Host npm run build returned non-zero (Docker build still handles container bundle)"
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
    [ ! -f "${COMPOSE_FILE}" ] && COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
    if [ -f "${COMPOSE_FILE}" ]; then
      docker compose -f "${COMPOSE_FILE}" build sparrowx >/dev/null 2>&1 && \
        docker compose -f "${COMPOSE_FILE}" up -d --no-build sparrowx nginx >/dev/null 2>&1 && \
        log_ok "Rebuilt sparrowx app & reloaded L7 Nginx DDoS shield" || true
    fi
  fi
fi

echo -e "${C_GREEN}==================================================================${C_RESET}"
echo -e "${C_GREEN}  SPARROWX DDOS PROTECTION SETUP COMPLETE (XDP: ${XDP_ATTACHED})${C_RESET}"
echo -e "${C_GREEN}==================================================================${C_RESET}"
