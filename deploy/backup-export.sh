#!/usr/bin/env bash
# Wrapper delegating to SparrowX Universal VPS Mirror Packager (mirror.sh)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
exec bash "${ROOT_DIR}/mirror.sh" pack "$@"
