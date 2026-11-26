#!/usr/bin/env bash
# ==============================================================================
# SPARROWX PTERODACTYL EGG IMPORTER & LIGHTWEIGHT STELLAR MIDNIGHT PALETTE
# ==============================================================================
# 1. Strips all old heavy/overlapping theme & JS injections (sparrowx-theme.css,
#    sparrowx-brand.js MutationObserver, ptero-sparrowx-bridge.js toast layer).
# 2. Installs ONE single lightweight pure-CSS Midnight Black palette layer
#    (/sparrowx/ptero-midnight-theme.css) that keeps Stellar's native UI intact.
# 3. Imports official curated Pelican/Pterodactyl game & bot eggs.
# ==============================================================================
set -euo pipefail

PTERO_DIR="${PTERO_DIR:-/var/www/pterodactyl}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EGG_CACHE_DIR="/tmp/sparrowx-ptero-eggs"
THEME_VERSION="2026-midnight-v2"

echo "[SparrowX Ptero] Syncing curated eggs & lightweight Stellar Midnight Black palette..."

if [ ! -d "${PTERO_DIR}" ]; then
  echo "[!] Pterodactyl directory not found at ${PTERO_DIR}; skipping."
  exit 0
fi

# 1. Clean legacy heavy theme files & copy single lightweight pure-CSS Midnight Black palette
mkdir -p "${PTERO_DIR}/public/sparrowx"
rm -f \
  "${PTERO_DIR}/public/sparrowx/sparrowx-theme.css" \
  "${PTERO_DIR}/public/sparrowx/sparrowx-brand.js" \
  "${PTERO_DIR}/public/sparrowx/ptero-sparrowx-bridge.js"
cp -f "${SCRIPT_DIR}/ptero-midnight-theme.css" "${PTERO_DIR}/public/sparrowx/ptero-midnight-theme.css"
chown -R www-data:www-data "${PTERO_DIR}/public/sparrowx" 2>/dev/null || true

# 2. Strip ALL overlapping legacy injections & inject single pure-CSS Midnight Black link
inject_clean_midnight_css() {
  local tpl="$1"
  [ -f "${tpl}" ] || return 0
  python3 - "${tpl}" "${THEME_VERSION}" <<'PY'
import re, sys

path, ver = sys.argv[1], sys.argv[2]
txt = open(path, "r", encoding="utf-8").read()

# Strip all old overlapping SparrowX theme / brand / bridge blocks and tags
txt = re.sub(r"\n?<!-- SPARROWX-BRAND:START -->.*?<!-- SPARROWX-BRAND:END -->\n?", "\n", txt, flags=re.S)
txt = re.sub(r"\n?<!-- SPARROWX-STELLAR-MIDNIGHT:START -->.*?<!-- SPARROWX-STELLAR-MIDNIGHT:END -->\n?", "\n", txt, flags=re.S)
txt = re.sub(r'^[ \t]*<link[^>]+/sparrowx/(?:sparrowx-theme|ptero-midnight-theme)\.css[^>]*>\s*\n?', "", txt, flags=re.M)
txt = re.sub(r'^[ \t]*<script[^>]+/sparrowx/(?:sparrowx-brand|ptero-sparrowx-bridge)\.js[^>]*></script>\s*\n?', "", txt, flags=re.M)

snippet = (
    "<!-- SPARROWX-STELLAR-MIDNIGHT:START -->\n"
    f'    <link rel="stylesheet" href="/sparrowx/ptero-midnight-theme.css?v={ver}" />\n'
    "<!-- SPARROWX-STELLAR-MIDNIGHT:END -->\n"
)

if "</head>" in txt:
    txt = txt.replace("</head>", snippet + "</head>", 1)
else:
    txt = txt + "\n" + snippet

open(path, "w", encoding="utf-8").write(txt)
PY
  echo "[ok] Cleaned legacy theme overlays & linked lightweight Midnight Black CSS in ${tpl}"
}

inject_clean_midnight_css "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
inject_clean_midnight_css "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"

# 3. Download curated Pelican/Pterodactyl Egg JSONs for all SparrowX Game & Bot categories
mkdir -p "${EGG_CACHE_DIR}"
declare -A EGG_URLS=(
  ["fivem"]="https://raw.githubusercontent.com/pelican-eggs/games-standalone/main/gta/fivem/egg-five-m.json"
  ["samp-openmp"]="https://raw.githubusercontent.com/pelican-eggs/games-standalone/main/gta/openmp/egg-open-mp.json"
  ["minecraft-paper"]="https://raw.githubusercontent.com/pelican-eggs/minecraft/main/java/paper/egg-paper.json"
  ["minecraft-purpur"]="https://raw.githubusercontent.com/pelican-eggs/minecraft/main/java/purpur/egg-purpur.json"
  ["minecraft-fabric"]="https://raw.githubusercontent.com/pelican-eggs/minecraft/main/java/fabric/egg-fabric.json"
  ["minecraft-forge"]="https://raw.githubusercontent.com/pelican-eggs/minecraft/main/java/forge/egg-forge.json"
  ["minecraft-velocity"]="https://raw.githubusercontent.com/pelican-eggs/minecraft/main/java/velocity/egg-velocity.json"
  ["bot-nodejs"]="https://raw.githubusercontent.com/pelican-eggs/generic/main/nodejs/egg-node-js-generic.json"
  ["bot-python"]="https://raw.githubusercontent.com/pelican-eggs/generic/main/python/egg-python-generic.json"
  ["bot-lavalink"]="https://raw.githubusercontent.com/pelican-eggs/generic/main/lavalink/egg-lavalink.json"
)

for name in "${!EGG_URLS[@]}"; do
  url="${EGG_URLS[$name]}"
  out="${EGG_CACHE_DIR}/egg-${name}.json"
  if curl -fsSL --max-time 12 "${url}" -o "${out}" 2>/dev/null; then
    echo "[ok] Fetched egg: ${name}"
  else
    echo "[warn] Could not fetch ${name} from ${url} (skipping)"
  fi
done

# 4. Import downloaded eggs into Pterodactyl via Laravel EggImporterService
if command -v php >/dev/null 2>&1 && [ -f "${PTERO_DIR}/artisan" ]; then
  php -r '
    require $argv[1] . "/vendor/autoload.php";
    $app = require_once $argv[1] . "/bootstrap/app.php";
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();

    $nest = Pterodactyl\Models\Nest::firstOrCreate(
      ["name" => "SparrowX Curated"],
      ["author" => "ops@sparrowx.net", "description" => "Curated FiveM, SA-MP/open.mp, Minecraft, and Discord Bot eggs"]
    );
    $importer = $app->make(Pterodactyl\Services\Eggs\Sharing\EggImporterService::class);

    foreach (glob($argv[2] . "/egg-*.json") as $file) {
      $raw = file_get_contents($file);
      $decoded = json_decode($raw, true);
      if (!$decoded || empty($decoded["name"])) continue;
      $exists = Pterodactyl\Models\Egg::where("name", $decoded["name"])->first();
      if ($exists) {
        echo "[skip] Egg already installed: " . $decoded["name"] . "\n";
        continue;
      }
      try {
        $uploaded = new Illuminate\Http\UploadedFile($file, basename($file), "application/json", null, true);
        $importer->handle($uploaded, $nest->id);
        echo "[imported] " . $decoded["name"] . "\n";
      } catch (Throwable $e) {
        echo "[warn] Failed to import " . basename($file) . ": " . $e->getMessage() . "\n";
      }
    }
  ' "${PTERO_DIR}" "${EGG_CACHE_DIR}" || true

  (cd "${PTERO_DIR}" && sudo -u www-data env HOME=/tmp php artisan view:clear >/dev/null 2>&1 || php artisan view:clear >/dev/null 2>&1 || true)
  (cd "${PTERO_DIR}" && sudo -u www-data env HOME=/tmp php artisan view:cache >/dev/null 2>&1 || php artisan view:cache >/dev/null 2>&1 || true)
fi

echo "[SparrowX Ptero] Egg sync & lightweight Stellar Midnight Black palette complete."
