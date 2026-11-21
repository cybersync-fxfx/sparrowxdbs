#!/usr/bin/env bash
# ==============================================================================
# SPARROWX LAYER 3/4 XDP / eBPF ANTI-DDOS LOADER & MAP MANAGER
# ==============================================================================
# Compiles deploy/xdp/sparrowx_xdp_ddos.c to eBPF bytecode with clang and
# attaches it cleanly to the primary NIC with native -> generic fallback.
#
# Usage:
#   sudo bash deploy/xdp/attach-xdp.sh [--iface eth0] [--attach|--detach|--status] [--sync-ips ips.txt]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="${SCRIPT_DIR}/sparrowx_xdp_ddos.c"
OUT_DIR="/opt/sparrowx/xdp"
OBJ_FILE="${OUT_DIR}/sparrowx_xdp_ddos.o"
PIN_DIR="/sys/fs/bpf/sparrowx"
ACTION="attach"
IFACE="${SPARROWX_XDP_IFACE:-}"
SYNC_FILE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --iface)
      IFACE="${2:-}"
      shift 2
      ;;
    --attach)
      ACTION="attach"
      shift
      ;;
    --detach)
      ACTION="detach"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --sync-ips)
      SYNC_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "${IFACE}" ]; then
  IFACE="$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}' || true)"
fi

if [ -z "${IFACE}" ]; then
  echo "[-] Unable to detect default network interface; pass --iface <dev>" >&2
  exit 1
fi

if [ "${ACTION}" = "status" ]; then
  ip -details link show dev "${IFACE}"
  if [ -d "${PIN_DIR}" ]; then
    ls -la "${PIN_DIR}" || true
  fi
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "[-] Must run as root to manage XDP programs on ${IFACE}" >&2
  exit 1
fi

if [ "${ACTION}" = "detach" ]; then
  ip link set dev "${IFACE}" xdp off >/dev/null 2>&1 || true
  ip link set dev "${IFACE}" xdpgeneric off >/dev/null 2>&1 || true
  rm -rf "${PIN_DIR}"
  echo "[+] Detached SparrowX XDP Anti-DDoS from ${IFACE}"
  exit 0
fi

for cmd in clang ip; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[-] Missing required tool: ${cmd} (install clang, llvm, libbpf-dev, iproute2, linux-headers)" >&2
    exit 1
  fi
done

mkdir -p "${OUT_DIR}" "${PIN_DIR}"

ARCH_INC="/usr/include/$(uname -m)-linux-gnu"
CFLAGS=("-O2" "-g" "-Wall" "-Wextra" "-target" "bpf" "-D__TARGET_ARCH_$(uname -m | sed 's/x86_64/x86/; s/aarch64/arm64/')")
if [ -d "${ARCH_INC}" ]; then
  CFLAGS+=("-I${ARCH_INC}")
fi

echo "[+] Compiling ${SRC_FILE} -> ${OBJ_FILE}..."
clang "${CFLAGS[@]}" -c "${SRC_FILE}" -o "${OBJ_FILE}"

# Detach any previous instance before re-attaching
ip link set dev "${IFACE}" xdp off >/dev/null 2>&1 || true
ip link set dev "${IFACE}" xdpgeneric off >/dev/null 2>&1 || true

if ip link set dev "${IFACE}" xdp obj "${OBJ_FILE}" sec xdp 2>/dev/null; then
  echo "[+] Attached SparrowX XDP Anti-DDoS in native XDP driver mode on ${IFACE}"
else
  echo "[!] Native XDP not supported by ${IFACE} driver; attaching in xdpgeneric mode..."
  ip link set dev "${IFACE}" xdpgeneric obj "${OBJ_FILE}" sec xdp
  echo "[+] Attached SparrowX XDP Anti-DDoS in xdpgeneric mode on ${IFACE}"
fi

if [ -n "${SYNC_FILE}" ] && [ -f "${SYNC_FILE}" ] && command -v bpftool >/dev/null 2>&1; then
  MAP_ID="$(bpftool map show | awk -F: '/blocked_ipv4/ {print $1; exit}')"
  if [ -n "${MAP_ID}" ]; then
    while IFS= read -r ip_addr; do
      ip_clean="$(echo "${ip_addr}" | tr -d ' \r\n')"
      [[ "${ip_clean}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || continue
      IFS='.' read -r o1 o2 o3 o4 <<<"${ip_clean}"
      hex_bytes="$(printf '%02x %02x %02x %02x' "${o1}" "${o2}" "${o3}" "${o4}")"
      bpftool map update id "${MAP_ID}" key hex ${hex_bytes} value hex 01 00 00 00 00 00 00 00 >/dev/null 2>&1 || true
    done < "${SYNC_FILE}"
    echo "[+] Synced IPv4 blocklist entries into XDP map blocked_ipv4 (id=${MAP_ID})"
  fi
fi
