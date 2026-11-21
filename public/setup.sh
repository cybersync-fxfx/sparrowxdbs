#!/usr/bin/env bash
# ==============================================================================
# SPARROWX UNIFIED SINGLE-ENTRYPOINT INSTALLER (https://sparrowx.net/setup.sh)
# ==============================================================================
# Bootstraps /opt/sparrowxdbs from GitHub, links all setup/update/DDoS/XDP CLIs,
# and executes the full A-to-Z setup + build + L3/L4/L7 DDoS defense pipeline.
#
# Usage:
#   curl -sSL https://sparrowx.net/setup.sh | sudo bash
#   curl -sSL https://sparrowx.net/setup.sh | sudo bash -s -- --auto --ptero --xdp
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[-] Please run as root / sudo:" >&2
  echo "    curl -sSL https://sparrowx.net/setup.sh | sudo bash" >&2
  exit 1
fi

REPO_URL="${SPARROWX_REPO_URL:-https://github.com/cybersync-fxfx/sparrowxdbs.git}"
INSTALL_DIR="/opt/sparrowxdbs"

if [ -f "./setup.sh" ] && [ -f "./docker-compose.ovh.yml" ]; then
  INSTALL_DIR="$(pwd)"
elif [ -f "/opt/sparrowxdbs/setup.sh" ] && [ -f "/opt/sparrowxdbs/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -f "/opt/sparrowx/setup.sh" ] && [ -f "/opt/sparrowx/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowx"
fi

if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq git curl ca-certificates
  fi
fi

if [ ! -f "${INSTALL_DIR}/setup.sh" ]; then
  rm -rf "${INSTALL_DIR}.bak" 2>/dev/null || true
  if [ -d "${INSTALL_DIR}" ] && [ ! -d "${INSTALL_DIR}/.git" ]; then
    mv "${INSTALL_DIR}" "${INSTALL_DIR}.bak" 2>/dev/null || true
  fi
  git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
elif [ -d "${INSTALL_DIR}/.git" ]; then
  git -C "${INSTALL_DIR}" fetch origin main --depth 1 >/dev/null 2>&1 || true
  git -C "${INSTALL_DIR}" pull --ff-only >/dev/null 2>&1 || true
fi

if [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
fi

cd "${INSTALL_DIR}" || exit 1
sed -i 's/\r$//' "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/deploy/*.sh "${INSTALL_DIR}"/deploy/xdp/*.sh "${INSTALL_DIR}"/ovh/*.sh "${INSTALL_DIR}"/public/*.sh 2>/dev/null || true
chmod +x "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/deploy/*.sh "${INSTALL_DIR}"/deploy/xdp/*.sh "${INSTALL_DIR}"/ovh/*.sh "${INSTALL_DIR}"/public/*.sh "${INSTALL_DIR}"/public/xdp/*.sh 2>/dev/null || true

exec bash "${INSTALL_DIR}/setup.sh" "$@"
