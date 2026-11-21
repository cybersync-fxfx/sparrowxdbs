#!/usr/bin/env bash
# ==============================================================================
# SPARROWX REMOTE UPDATER BOOTSTRAPPER (https://sparrowx.net/update.sh)
# ==============================================================================
# Usage:
#   curl -sSL https://sparrowx.net/update.sh | sudo bash
#   curl -sSL https://sparrowx.net/update.sh | sudo bash -s -- --auto --ddos
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[-] Please run with root/sudo: curl -sSL https://sparrowx.net/update.sh | sudo bash" >&2
  exit 1
fi

REPO_URL="${SPARROWX_REPO_URL:-https://github.com/cybersync-fxfx/sparrowxdbs.git}"
INSTALL_DIR=""

for candidate in "${SPARROWX_INSTALL_DIR:-}" "$(pwd)" "/opt/sparrowxdbs" "/opt/sparrowx"; do
  if [ -n "${candidate}" ] && [ -f "${candidate}/update.sh" ]; then
    INSTALL_DIR="${candidate}"
    break
  fi
done

if [ -z "${INSTALL_DIR}" ]; then
  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq git curl ca-certificates
  fi
  INSTALL_DIR="/opt/sparrowxdbs"
  git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
fi

cd "${INSTALL_DIR}" || exit 1
sed -i 's/\r$//' "${INSTALL_DIR}/update.sh" "${INSTALL_DIR}/setup.sh" "${INSTALL_DIR}/fix.sh" "${INSTALL_DIR}/deploy/ddos-setup.sh" "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" 2>/dev/null || true
chmod +x "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/deploy/*.sh "${INSTALL_DIR}"/deploy/xdp/*.sh "${INSTALL_DIR}"/ovh/*.sh "${INSTALL_DIR}"/public/*.sh 2>/dev/null || true
exec bash "${INSTALL_DIR}/update.sh" "$@"
