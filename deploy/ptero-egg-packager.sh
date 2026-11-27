#!/usr/bin/env bash
# ==============================================================================
# SPARROWX PTERODACTYL EGG UPGRADE PACKAGER (PANEL + CLIENT CATALOG SYNC)
# ==============================================================================
# Imports & incrementally upgrades ALL official Pterodactyl eggs across 3 clean
# separate sections (3 separate Nests in Panel + 3 separate tabs in Client Area):
#   1. games        -> https://github.com/pterodactyl/game-eggs
#                      Nest: "SparrowX Game Servers"
#   2. applications -> https://github.com/pterodactyl/application-eggs
#                      Nest: "SparrowX Applications & Bots"
#   3. generic      -> https://github.com/pterodactyl/generic-eggs
#                      Nest: "SparrowX Generic Runtimes"
#
# Usage:
#   sudo sparrowx-eggs sync                                 # Sync & upgrade ALL 3 sections (Panel + Client)
#   sudo sparrowx-eggs sync --section games                 # Sync only Game Servers
#   sudo sparrowx-eggs sync --section applications          # Sync only Applications & Bots
#   sudo sparrowx-eggs sync --section generic               # Sync only Generic Runtimes
#   sudo sparrowx-eggs sync --panel-only                    # Update Pterodactyl Panel only
#   sudo sparrowx-eggs sync --client-only                   # Update Client Area catalog only
#   sudo sparrowx-eggs sync --force                         # Re-apply even unchanged egg JSONs
#   sudo sparrowx-eggs check-updates                        # Check upstream GitHub commits vs installed
#   sudo sparrowx-eggs status                               # Show installed counts & lockfile status
#   sudo sparrowx-eggs install-timer                        # Enable automatic weekly egg upgrade timer
# ==============================================================================
set -uo pipefail
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=never

SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PTERO_DIR="${PTERO_DIR:-/var/www/pterodactyl}"
CACHE_ROOT="${EGG_CACHE_ROOT:-/opt/sparrowx-eggs-cache}"
LOCK_JSON="${CACHE_ROOT}/egg-lock.json"
CATALOG_DATA_PATH="${INSTALL_DIR}/data/ptero-eggs-catalog.json"
CATALOG_PUBLIC_PATH="${INSTALL_DIR}/public/data/ptero-eggs-catalog.json"
EGG_SYNC_LOCK="/var/run/sparrowx-eggs.lock"

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info() { echo -e "  ${C_CYAN}[EGGS]${C_RESET} $*"; }
log_ok()   { echo -e "  ${C_GREEN}[ OK ]${C_RESET} $*"; }
log_warn() { echo -e "  ${C_YELLOW}[WARN]${C_RESET} $*"; }
log_err()  { echo -e "  ${C_RED}[ERR ]${C_RESET} $*" >&2; }

declare -A REPO_URLS=(
  ["games"]="https://github.com/pterodactyl/game-eggs.git"
  ["applications"]="https://github.com/pterodactyl/application-eggs.git"
  ["generic"]="https://github.com/pterodactyl/generic-eggs.git"
)

declare -A SECTION_TITLES=(
  ["games"]="Game Servers"
  ["applications"]="Applications & Bots"
  ["generic"]="Generic Runtimes"
)

declare -A NEST_NAMES=(
  ["games"]="SparrowX Game Servers"
  ["applications"]="SparrowX Applications & Bots"
  ["generic"]="SparrowX Generic Runtimes"
)

declare -A NEST_DESCRIPTIONS=(
  ["games"]="Official Pterodactyl Game Server Eggs (github.com/pterodactyl/game-eggs)"
  ["applications"]="Official Pterodactyl Application, Bot & Database Eggs (github.com/pterodactyl/application-eggs)"
  ["generic"]="Official Pterodactyl Generic Language Runtime Eggs (github.com/pterodactyl/generic-eggs)"
)

ALL_SECTIONS=("games" "applications" "generic")

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
      exec sudo -E bash "${SCRIPT_SOURCE}" "$@"
    else
      log_err "Run with sudo/root privileges."
      exit 1
    fi
  fi
}

sync_git_repo() {
  local sec="$1"
  local url="${REPO_URLS[$sec]}"
  local dir="${CACHE_ROOT}/${sec}"
  mkdir -p "${CACHE_ROOT}"

  if [ ! -d "${dir}/.git" ]; then
    rm -rf "${dir}"
    log_info "Cloning ${sec} (${url})..."
    git clone --depth=1 --branch main "${url}" "${dir}" >/dev/null 2>&1 || git clone --depth=1 "${url}" "${dir}" >/dev/null 2>&1
  else
    git config --global --add safe.directory "${dir}" >/dev/null 2>&1 || true
    log_info "Pulling latest upstream commits for ${sec}..."
    git -C "${dir}" fetch origin main --depth=1 >/dev/null 2>&1 || git -C "${dir}" fetch origin --depth=1 >/dev/null 2>&1
    git -C "${dir}" reset --hard FETCH_HEAD >/dev/null 2>&1 || true
  fi

  local sha count
  sha="$(git -C "${dir}" rev-parse --short=7 HEAD 2>/dev/null || echo 'unknown')"
  count="$(find "${dir}" -type f -name 'egg-*.json' | wc -l | tr -d ' ')"
  log_ok "${SECTION_TITLES[$sec]} synced @ ${sha} (${count} egg package(s) available)"
}

# Sync selected sections into Pterodactyl Panel using official NestCreationService,
# EggImporterService (new eggs), and EggUpdateImporterService (safe in-place upgrades).
sync_panel_eggs() {
  local force_flag="$1"
  shift
  local sections=("$@")

  if [ ! -d "${PTERO_DIR}" ] || [ ! -f "${PTERO_DIR}/artisan" ]; then
    log_warn "Pterodactyl Panel not found at ${PTERO_DIR} — skipping Panel import."
    return 0
  fi

  local php_bin
  php_bin="$(command -v php8.4 || command -v php8.3 || command -v php8.2 || command -v php8.1 || command -v php || true)"
  if [ -z "${php_bin}" ]; then
    log_err "PHP CLI not found — cannot import eggs into Pterodactyl Panel."
    return 1
  fi

  local sections_csv
  sections_csv="$(IFS=','; echo "${sections[*]}")"

  log_info "Running Pterodactyl Panel Egg Importer & Upgrade Packager (${sections_csv})..."
  "${php_bin}" -r '
    $pteroDir   = $argv[1];
    $cacheRoot  = $argv[2];
    $lockPath   = $argv[3];
    $sections   = array_filter(explode(",", $argv[4]));
    $force      = ($argv[5] === "true");

    require $pteroDir . "/vendor/autoload.php";
    $app = require_once $pteroDir . "/bootstrap/app.php";
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();

    $nestMeta = [
      "games" => [
        "name" => "SparrowX Game Servers",
        "desc" => "Official Pterodactyl Game Server Eggs (github.com/pterodactyl/game-eggs)",
      ],
      "applications" => [
        "name" => "SparrowX Applications & Bots",
        "desc" => "Official Pterodactyl Application, Bot & Database Eggs (github.com/pterodactyl/application-eggs)",
      ],
      "generic" => [
        "name" => "SparrowX Generic Runtimes",
        "desc" => "Official Pterodactyl Generic Language Runtime Eggs (github.com/pterodactyl/generic-eggs)",
      ],
    ];

    $lock = ["updatedAt" => gmdate("c"), "repos" => [], "eggs" => []];
    if (file_exists($lockPath)) {
      $decodedLock = json_decode((string) file_get_contents($lockPath), true);
      if (is_array($decodedLock)) {
        $lock = array_merge($lock, $decodedLock);
        if (!isset($lock["eggs"]) || !is_array($lock["eggs"])) $lock["eggs"] = [];
        if (!isset($lock["repos"]) || !is_array($lock["repos"])) $lock["repos"] = [];
      }
    }

    $importer = $app->make(Pterodactyl\Services\Eggs\Sharing\EggImporterService::class);
    $updater  = class_exists(Pterodactyl\Services\Eggs\Sharing\EggUpdateImporterService::class)
      ? $app->make(Pterodactyl\Services\Eggs\Sharing\EggUpdateImporterService::class)
      : null;

    $ensureNest = function (string $name, string $desc) use ($app) {
      $nest = Pterodactyl\Models\Nest::where("name", $name)->first();
      if ($nest) return $nest;
      if (class_exists(Pterodactyl\Services\Nests\NestCreationService::class)) {
        return $app->make(Pterodactyl\Services\Nests\NestCreationService::class)->handle(
          ["name" => $name, "description" => $desc],
          "ops@sparrowx.net"
        );
      }
      $nest = new Pterodactyl\Models\Nest();
      $nest->uuid = Ramsey\Uuid\Uuid::uuid4()->toString();
      $nest->author = "ops@sparrowx.net";
      $nest->name = $name;
      $nest->description = $desc;
      $nest->save();
      return $nest;
    };

    $totals = ["imported" => 0, "upgraded" => 0, "unchanged" => 0, "skipped" => 0];

    foreach ($sections as $sec) {
      if (!isset($nestMeta[$sec])) continue;
      $secDir = $cacheRoot . "/" . $sec;
      if (!is_dir($secDir)) continue;

      $nest = $ensureNest($nestMeta[$sec]["name"], $nestMeta[$sec]["desc"]);
      $sha  = trim((string) shell_exec("git -C " . escapeshellarg($secDir) . " rev-parse --short=7 HEAD 2>/dev/null"));
      $lock["repos"][$sec] = [
        "commit" => $sha ?: "unknown",
        "nestId" => (int) $nest->id,
        "nestName" => $nest->name,
        "syncedAt" => gmdate("c"),
      ];

      $secStats = ["imported" => 0, "upgraded" => 0, "unchanged" => 0, "skipped" => 0];
      $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($secDir, FilesystemIterator::SKIP_DOTS));
      $files = [];
      foreach ($it as $f) {
        if ($f->isFile() && preg_match("/^egg-.*\.json$/i", $f->getFilename())) {
          $files[] = $f->getPathname();
        }
      }
      sort($files);

      foreach ($files as $file) {
        $relPath = ltrim(str_replace($secDir, "", $file), "/");
        $raw = @file_get_contents($file);
        if (!$raw) { $secStats["skipped"]++; continue; }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || empty($decoded["name"]) || empty($decoded["meta"]["version"])) {
          $secStats["skipped"]++;
          continue;
        }

        $eggName = trim((string) $decoded["name"]);
        $hash    = hash("sha256", $raw);
        $lockKey = $sec . ":" . $relPath;
        $prevHash = $lock["eggs"][$lockKey]["sha256"] ?? null;

        $existing = Pterodactyl\Models\Egg::where("nest_id", $nest->id)
          ->where("name", $eggName)
          ->first();

        if ($existing && !$force && $prevHash === $hash) {
          $secStats["unchanged"]++;
          $lock["eggs"][$lockKey] = [
            "sha256" => $hash,
            "eggId" => (int) $existing->id,
            "nestId" => (int) $nest->id,
            "name" => $eggName,
            "updatedAt" => $lock["eggs"][$lockKey]["updatedAt"] ?? gmdate("c"),
          ];
          continue;
        }

        try {
          $uploaded = new Illuminate\Http\UploadedFile($file, basename($file), "application/json", null, true);
          if ($existing && $updater) {
            // Pterodactyl 1.x signature: EggUpdateImporterService::handle(Egg $egg, UploadedFile $file)
            $saved = $updater->handle($existing, $uploaded);
            $secStats["upgraded"]++;
            $eggId = (int) $saved->id;
          } elseif ($existing) {
            $secStats["unchanged"]++;
            $eggId = (int) $existing->id;
          } else {
            // Pterodactyl 1.x signature: EggImporterService::handle(UploadedFile $file, int $nest)
            $saved = $importer->handle($uploaded, (int) $nest->id);
            $secStats["imported"]++;
            $eggId = (int) $saved->id;
          }
          $lock["eggs"][$lockKey] = [
            "sha256" => $hash,
            "eggId" => $eggId,
            "nestId" => (int) $nest->id,
            "name" => $eggName,
            "updatedAt" => gmdate("c"),
          ];
        } catch (Throwable $e) {
          $secStats["skipped"]++;
          fwrite(STDERR, "  [skip] {$sec}/{$eggName}: " . substr($e->getMessage(), 0, 140) . "\n");
        }
      }

      foreach ($secStats as $k => $v) $totals[$k] += $v;
      echo sprintf(
        "  [ OK ] Section %-12s -> Nest #%d (%s): +%d imported, ^%d upgraded, =%d up-to-date, !%d skipped\n",
        $sec, $nest->id, $nest->name,
        $secStats["imported"], $secStats["upgraded"], $secStats["unchanged"], $secStats["skipped"]
      );
    }

    $lock["updatedAt"] = gmdate("c");
    @file_put_contents($lockPath, json_encode($lock, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    echo sprintf(
      "  [ OK ] Panel Sync Total: +%d imported, ^%d upgraded, =%d up-to-date, !%d skipped\n",
      $totals["imported"], $totals["upgraded"], $totals["unchanged"], $totals["skipped"]
    );
  ' "${PTERO_DIR}" "${CACHE_ROOT}" "${LOCK_JSON}" "${sections_csv}" "${force_flag}"

  (cd "${PTERO_DIR}" && sudo -u www-data env HOME=/tmp "${php_bin}" artisan view:clear >/dev/null 2>&1 || true)
  (cd "${PTERO_DIR}" && sudo -u www-data env HOME=/tmp "${php_bin}" artisan cache:clear >/dev/null 2>&1 || true)
}

# Build synchronized Client Area JSON catalog from all 3 cached repos + egg-lock.json
# and copy live into sparrowx-app container so Client Area reflects updates immediately!
sync_client_catalog() {
  mkdir -p "${INSTALL_DIR}/data" "${INSTALL_DIR}/public/data" "${CACHE_ROOT}"
  log_info "Generating synchronized Client Area egg catalog JSON..."

  python3 - "${CACHE_ROOT}" "${LOCK_JSON}" "${CATALOG_DATA_PATH}" "${CATALOG_PUBLIC_PATH}" <<'PY'
import datetime, json, os, re, subprocess, sys

cache_root, lock_path, out_data, out_public = sys.argv[1:5]

sections_meta = [
    ("games", "Game Servers", "SparrowX Game Servers", "https://github.com/pterodactyl/game-eggs"),
    ("applications", "Applications & Bots", "SparrowX Applications & Bots", "https://github.com/pterodactyl/application-eggs"),
    ("generic", "Generic Runtimes", "SparrowX Generic Runtimes", "https://github.com/pterodactyl/generic-eggs"),
]

lock = {}
if os.path.isfile(lock_path):
    try:
        lock = json.load(open(lock_path, "r", encoding="utf-8"))
    except Exception:
        lock = {}

lock_eggs = lock.get("eggs", {}) if isinstance(lock, dict) else {}
lock_repos = lock.get("repos", {}) if isinstance(lock, dict) else {}

def pretty_category(rel_path: str) -> str:
    parts = [p for p in rel_path.replace("\\", "/").split("/")[:-1] if p]
    if not parts:
        return "General"
    top = parts[0]
    if len(parts) >= 2 and top.lower() in ("bots", "voice", "database", "databases", "software", "web", "minecraft", "gta", "steamcmd_servers", "source_engine"):
        raw = f"{parts[0]} / {parts[1]}"
    else:
        raw = top
    return re.sub(r"[_-]+", " ", raw).strip().title()

sections_out = []
eggs_out = []

for sec_id, title, nest_name, repo_url in sections_meta:
    sec_dir = os.path.join(cache_root, sec_id)
    commit_sha = (lock_repos.get(sec_id, {}) or {}).get("commit", "unknown")
    nest_id = (lock_repos.get(sec_id, {}) or {}).get("nestId")
    sec_count = 0

    if os.path.isdir(sec_dir):
        try:
            sha = subprocess.check_output(
                ["git", "-C", sec_dir, "rev-parse", "--short=7", "HEAD"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
            if sha:
                commit_sha = sha
        except Exception:
            pass

        egg_files = []
        for root, dirs, files in os.walk(sec_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fn in files:
                if re.match(r"^egg-.*\.json$", fn, re.I):
                    egg_files.append(os.path.join(root, fn))
        egg_files.sort()

        for full_path in egg_files:
            rel_path = os.path.relpath(full_path, sec_dir).replace("\\", "/")
            try:
                data = json.load(open(full_path, "r", encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(data, dict) or not data.get("name"):
                continue

            name = str(data.get("name", "")).strip()
            desc = re.sub(r"\s+", " ", str(data.get("description") or "")).strip()[:220]
            author = str(data.get("author") or "").strip()
            docker_images = data.get("docker_images")
            primary_image = ""
            if isinstance(docker_images, dict) and docker_images:
                primary_image = str(next(iter(docker_images.values())))
            elif isinstance(data.get("image"), str):
                primary_image = data["image"]

            lock_entry = lock_eggs.get(f"{sec_id}:{rel_path}", {}) or {}
            egg_id = lock_entry.get("eggId")
            entry_nest_id = lock_entry.get("nestId") or nest_id

            eggs_out.append({
                "id": f"{sec_id}:{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}-{sec_count + 1}",
                "section": sec_id,
                "nestName": nest_name,
                "nestId": entry_nest_id,
                "eggId": egg_id,
                "installed": bool(egg_id),
                "name": name,
                "category": pretty_category(rel_path),
                "description": desc,
                "author": author,
                "dockerImage": primary_image,
                "repoPath": rel_path,
            })
            sec_count += 1

    sections_out.append({
        "id": sec_id,
        "title": title,
        "nestName": nest_name,
        "nestId": nest_id,
        "repoUrl": repo_url,
        "commit": commit_sha,
        "count": sec_count,
    })

payload = {
    "version": "2.0.0",
    "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "totalEggs": len(eggs_out),
    "sections": sections_out,
    "eggs": eggs_out,
}

for target in (out_data, out_public):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = target + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    os.replace(tmp, target)

print(f"  [ OK ] Client catalog written ({len(eggs_out)} eggs across {len(sections_out)} sections)")
PY

  # Push catalog directly into running sparrowx-app container volume (zero rebuild needed!)
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
    docker exec sparrowx-app mkdir -p /app/data >/dev/null 2>&1 || true
    docker cp "${CATALOG_DATA_PATH}" sparrowx-app:/app/data/ptero-eggs-catalog.json >/dev/null 2>&1 \
      && log_ok "Live Client Area catalog synced into sparrowx-app (zero downtime, zero rebuild)." \
      || log_warn "Could not copy catalog into sparrowx-app container."
  fi
}

cmd_sync() {
  local target_section="all"
  local panel_enabled="true"
  local client_enabled="true"
  local force_flag="false"

  while [ $# -gt 0 ]; do
    case "$1" in
      --section)     shift; target_section="${1:-all}" ;;
      --panel-only)  client_enabled="false" ;;
      --client-only) panel_enabled="false" ;;
      --force)       force_flag="true" ;;
    esac
    shift || true
  done

  if command -v flock >/dev/null 2>&1; then
    exec 7>"${EGG_SYNC_LOCK}"
    flock 7
  fi

  local selected=()
  if [ "${target_section}" = "all" ]; then
    selected=("${ALL_SECTIONS[@]}")
  elif [ -n "${REPO_URLS[$target_section]+x}" ]; then
    selected=("${target_section}")
  else
    log_err "Invalid --section '${target_section}'. Use: all | games | applications | generic"
    exit 1
  fi

  echo -e "${C_CYAN}========================================================================${C_RESET}"
  echo -e "${C_BOLD}  SPARROWX PTERODACTYL EGG UPGRADE PACKAGER (PANEL + CLIENT SYNC)${C_RESET}"
  echo -e "${C_CYAN}========================================================================${C_RESET}"

  for sec in "${selected[@]}"; do
    sync_git_repo "${sec}"
  done

  if [ "${panel_enabled}" = "true" ]; then
    sync_panel_eggs "${force_flag}" "${selected[@]}"
  fi

  if [ "${client_enabled}" = "true" ]; then
    # Always ensure cached dirs exist for complete 3-section client catalog
    for sec in "${ALL_SECTIONS[@]}"; do
      [ -d "${CACHE_ROOT}/${sec}/.git" ] || sync_git_repo "${sec}"
    done
    sync_client_catalog
  fi

  # Keep global CLI symlink fresh
  ln -sf "${SCRIPT_SOURCE}" /usr/local/bin/sparrowx-eggs 2>/dev/null || true
  echo ""
  log_ok "Egg upgrade packager finished cleanly!"
}

cmd_check_updates() {
  echo -e "${C_CYAN}=== Checking Upstream Pterodactyl Egg Repositories ===${C_RESET}"
  local updates_found=0
  for sec in "${ALL_SECTIONS[@]}"; do
    local remote_sha local_sha
    remote_sha="$(git ls-remote "${REPO_URLS[$sec]}" refs/heads/main 2>/dev/null | awk '{print substr($1,1,7)}' || echo 'error')"
    local_sha="$(git -C "${CACHE_ROOT}/${sec}" rev-parse --short=7 HEAD 2>/dev/null || echo 'not-installed')"
    if [ "${remote_sha}" != "${local_sha}" ]; then
      printf "  ${C_YELLOW}[UPDATE]${C_RESET} %-14s installed=%s -> upstream=%s\n" "${sec}" "${local_sha}" "${remote_sha}"
      updates_found=$((updates_found + 1))
    else
      printf "  ${C_GREEN}[FRESH ]${C_RESET} %-14s up-to-date @ %s\n" "${sec}" "${local_sha}"
    fi
  done
  if [ "${updates_found}" -gt 0 ]; then
    echo ""
    echo "  Run 'sudo sparrowx-eggs sync' to upgrade Panel + Client Area."
  fi
}

cmd_status() {
  echo -e "${C_CYAN}=== SparrowX Egg Upgrade Packager Status ===${C_RESET}"
  echo "  Cache Root       : ${CACHE_ROOT}"
  echo "  Lockfile         : ${LOCK_JSON}"
  echo "  Client Catalog   : ${CATALOG_DATA_PATH}"
  if command -v systemctl >/dev/null 2>&1; then
    echo "  Auto-Upgrade Tmr : $(systemctl is-active sparrowx-eggs-upgrade.timer 2>/dev/null || echo inactive)"
  fi
  if [ -f "${CATALOG_DATA_PATH}" ]; then
    python3 - "${CATALOG_DATA_PATH}" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(f"  Last Synced UTC  : {d.get('generatedAt', 'unknown')}")
print(f"  Total Synced Eggs: {d.get('totalEggs', 0)}")
for s in d.get("sections", []):
    print(f"    - {s['title']:<22} ({s['id']:<12}): {s['count']:>3} eggs @ {s.get('commit','?')} -> Nest: {s['nestName']}")
PY
  else
    echo "  Catalog Status   : Not synced yet (run: sudo sparrowx-eggs sync)"
  fi
}

cmd_install_timer() {
  ln -sf "${SCRIPT_SOURCE}" /usr/local/bin/sparrowx-eggs 2>/dev/null || true
  if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    cat > /etc/systemd/system/sparrowx-eggs-upgrade.service <<EOF
[Unit]
Description=SparrowX Pterodactyl Egg Package Upgrade (Panel + Client Sync)
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env bash ${SCRIPT_SOURCE} sync
Nice=15
EOF
    cat > /etc/systemd/system/sparrowx-eggs-upgrade.timer <<'EOF'
[Unit]
Description=Weekly SparrowX Pterodactyl Egg Upgrade Packager

[Timer]
OnCalendar=Sun *-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload
    systemctl enable --now sparrowx-eggs-upgrade.timer
    log_ok "Installed weekly auto-upgrade timer (sparrowx-eggs-upgrade.timer) + CLI 'sparrowx-eggs'."
  else
    log_warn "systemd not available; run 'sudo sparrowx-eggs sync' manually or via cron."
  fi
}

CMD="${1:-help}"
shift || true

case "${CMD}" in
  sync|upgrade|install) require_root sync "$@"; cmd_sync "$@" ;;
  check-updates|check)  cmd_check_updates ;;
  status)               cmd_status ;;
  install-timer)        require_root install-timer "$@"; cmd_install_timer ;;
  help|--help|-h)       sed -n '2,25p' "${SCRIPT_SOURCE}" | sed 's/^# \{0,1\}//' ;;
  *)
    log_err "Unknown command: ${CMD}. Run 'sparrowx-eggs --help'."
    exit 1
    ;;
esac
