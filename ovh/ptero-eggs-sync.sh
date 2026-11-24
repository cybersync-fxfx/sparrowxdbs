#!/usr/bin/env bash
# ==============================================================================
# SPARROWX PTERODACTYL EGG IMPORTER & MIDNIGHT THEME INSTALLER
# Installs official Pelican/Pterodactyl eggs (FiveM, SA-MP/open.mp, Minecraft
# Paper/Purpur/Forge/Fabric/Velocity, Discord Bots Node.js/Python/Lavalink)
# and applies the SparrowX Midnight Black per-server dynamic theme + toasts.
# ==============================================================================
set -euo pipefail

PTERO_DIR="${PTERO_DIR:-/var/www/pterodactyl}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EGG_CACHE_DIR="/tmp/sparrowx-ptero-eggs"

echo "[SparrowX Ptero] Syncing official eggs and Midnight Dark Black theme..."

if [ ! -d "${PTERO_DIR}" ]; then
  echo "[!] Pterodactyl directory not found at ${PTERO_DIR}; skipping."
  exit 0
fi

# 1. Copy Midnight Dark Black CSS & Per-Server Dynamic Bridge JS into Pterodactyl public assets
mkdir -p "${PTERO_DIR}/public/sparrowx"
cp -f "${SCRIPT_DIR}/ptero-midnight-theme.css" "${PTERO_DIR}/public/sparrowx/ptero-midnight-theme.css"
cp -f "${SCRIPT_DIR}/ptero-sparrowx-bridge.js" "${PTERO_DIR}/public/sparrowx/ptero-sparrowx-bridge.js"
chown -R www-data:www-data "${PTERO_DIR}/public/sparrowx" 2>/dev/null || true

# 2. Inject theme & smart toast bridge idempotently into Pterodactyl wrapper template
WRAPPER="${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
if [ -f "${WRAPPER}" ] && ! grep -q "ptero-midnight-theme.css" "${WRAPPER}"; then
  sed -i 's|</head>|    <link rel="stylesheet" href="/sparrowx/ptero-midnight-theme.css?v=2026" />\n    <script defer src="/sparrowx/ptero-sparrowx-bridge.js?v=2026"></script>\n    </head>|' "${WRAPPER}"
  echo "[ok] Injected SparrowX Midnight Black Theme + Per-Server Toast Bridge into ${WRAPPER}"
fi

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

  (cd "${PTERO_DIR}" && php artisan view:clear >/dev/null 2>&1 || true)
fi

echo "[SparrowX Ptero] Egg sync & Midnight Dark Black theme installation complete."
