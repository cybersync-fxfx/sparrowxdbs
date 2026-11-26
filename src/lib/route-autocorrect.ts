/**
 * SparrowX Subdomain-Aware Path & Domain Auto-Correction Engine.
 *
 * Automatically fixes mistyped paths, docs slugs, and SparrowX subdomains while
 * strictly respecting the active service subdomain (e.g. a typo on db.sparrowx.net
 * stays inside Cloud DB / /docs/db rather than falling through to 404 or SOC).
 */

export type SubdomainKey =
  | "master"
  | "db"
  | "infra"
  | "shield"
  | "game"
  | "game-dash"
  | "drop"
  | "keys"
  | "api"
  | "deploy"
  | "ai"
  | "agents"
  | "dpdp";

export interface SubdomainProfile {
  key: SubdomainKey;
  canonicalHost: string;
  homePath: string;
  dashboardPath: string;
  docsPath: string;
}

export const SUBDOMAIN_PROFILES: Record<SubdomainKey, SubdomainProfile> = {
  master: {
    key: "master",
    canonicalHost: "sparrowx.net",
    homePath: "/",
    dashboardPath: "/",
    docsPath: "/docs",
  },
  db: {
    key: "db",
    canonicalHost: "db.sparrowx.net",
    homePath: "/db",
    dashboardPath: "/db",
    docsPath: "/docs/db",
  },
  infra: {
    key: "infra",
    canonicalHost: "infra.sparrowx.net",
    homePath: "/infra",
    dashboardPath: "/infra/dashboard",
    docsPath: "/docs/infra",
  },
  shield: {
    key: "shield",
    canonicalHost: "sec.sparrowx.net",
    homePath: "/shield",
    dashboardPath: "/shield",
    docsPath: "/docs/shield",
  },
  game: {
    key: "game",
    canonicalHost: "game.sparrowx.net",
    homePath: "/game",
    dashboardPath: "/game/dashboard",
    docsPath: "/docs/game",
  },
  "game-dash": {
    key: "game-dash",
    canonicalHost: "game.dash.sparrowx.net",
    homePath: "/game/dashboard",
    dashboardPath: "/game/dashboard",
    docsPath: "/docs/game",
  },
  drop: {
    key: "drop",
    canonicalHost: "file.sparrowx.net",
    homePath: "/drop",
    dashboardPath: "/drop",
    docsPath: "/docs/drop",
  },
  keys: {
    key: "keys",
    canonicalHost: "password.sparrowx.net",
    homePath: "/keys",
    dashboardPath: "/keys",
    docsPath: "/docs/keys",
  },
  api: {
    key: "api",
    canonicalHost: "api.sparrowx.net",
    homePath: "/gateway",
    dashboardPath: "/gateway",
    docsPath: "/docs/api",
  },
  deploy: {
    key: "deploy",
    canonicalHost: "deploy.sparrowx.net",
    homePath: "/deploy",
    dashboardPath: "/deploy",
    docsPath: "/docs/infra",
  },
  ai: {
    key: "ai",
    canonicalHost: "ai.sparrowx.net",
    homePath: "/ai",
    dashboardPath: "/ai",
    docsPath: "/docs",
  },
  agents: {
    key: "agents",
    canonicalHost: "agents.sparrowx.net",
    homePath: "/agents",
    dashboardPath: "/agents",
    docsPath: "/docs",
  },
  dpdp: {
    key: "dpdp",
    canonicalHost: "dpdp.sparrowx.net",
    homePath: "/dpdp",
    dashboardPath: "/dpdp",
    docsPath: "/docs/shield",
  },
};

export const VALID_STATIC_PATHS = new Set<string>([
  "/",
  "/db",
  "/infra",
  "/infra/configure",
  "/infra/dashboard",
  "/game",
  "/game/dashboard",
  "/game/panel-launch",
  "/shield",
  "/drop",
  "/keys",
  "/gateway",
  "/docs",
  "/docs/errors",
  "/docs/db",
  "/docs/infra",
  "/docs/shield",
  "/docs/game",
  "/docs/drop",
  "/docs/keys",
  "/docs/api",
  "/errors",
  "/story",
  "/terms",
  "/refund",
  "/security",
  "/deploy",
  "/deploy/new",
  "/deployments",
  "/domains",
  "/usage",
  "/login",
  "/ai",
  "/agents",
  "/dpdp",
  "/f",
]);

const VALID_DOC_SLUGS = ["db", "infra", "shield", "game", "drop", "keys", "api", "errors"] as const;

const DOC_SLUG_ALIASES: Record<string, string> = {
  db: "db",
  dbs: "db",
  database: "db",
  databases: "db",
  postgres: "db",
  postgresql: "db",
  studio: "db",
  sql: "db",
  supabase: "db",
  infra: "infra",
  infrastructure: "infra",
  vps: "infra",
  cloud: "infra",
  metal: "infra",
  baremetal: "infra",
  proxmox: "infra",
  hpanel: "infra",
  server: "infra",
  servers: "infra",
  shield: "shield",
  sec: "shield",
  security: "shield",
  waf: "shield",
  soc: "shield",
  ddos: "shield",
  xdp: "shield",
  noc: "shield",
  netsec: "shield",
  game: "game",
  games: "game",
  gaming: "game",
  fivem: "game",
  minecraft: "game",
  mc: "game",
  samp: "game",
  ptero: "game",
  pterodactyl: "game",
  drop: "drop",
  file: "drop",
  files: "drop",
  vault: "drop",
  share: "drop",
  upload: "drop",
  keys: "keys",
  key: "keys",
  password: "keys",
  passwords: "keys",
  passwd: "keys",
  pass: "keys",
  api: "api",
  apis: "api",
  gateway: "api",
  rest: "api",
  postgrest: "api",
  error: "errors",
  errors: "errors",
  troubleshoot: "errors",
  troubleshooting: "errors",
  codes: "errors",
  deploy: "infra",
  paas: "infra",
  ai: "api",
  llm: "api",
  agents: "api",
  dpdp: "shield",
  compliance: "shield",
};

const SUBDOMAIN_ALIASES: Record<string, SubdomainKey> = {
  db: "db",
  dbs: "db",
  database: "db",
  databases: "db",
  studio: "db",
  postgres: "db",
  supabase: "db",
  sparrowbase: "db",
  infra: "infra",
  infr: "infra",
  infar: "infra",
  vps: "infra",
  cloud: "infra",
  metal: "infra",
  dedicated: "infra",
  proxmox: "infra",
  sec: "shield",
  shield: "shield",
  sheild: "shield",
  security: "shield",
  waf: "shield",
  soc: "shield",
  ddos: "shield",
  game: "game",
  games: "game",
  gmae: "game",
  play: "game",
  "game.dash": "game-dash",
  "game-dash": "game-dash",
  gamedash: "game-dash",
  file: "drop",
  files: "drop",
  fiel: "drop",
  drop: "drop",
  drops: "drop",
  share: "drop",
  vault: "drop",
  password: "keys",
  passwords: "keys",
  passwd: "keys",
  pass: "keys",
  keys: "keys",
  key: "keys",
  api: "api",
  apis: "api",
  rest: "api",
  gateway: "api",
  deploy: "deploy",
  ai: "ai",
  agents: "agents",
  dpdp: "dpdp",
  www: "master",
};

const PATH_ALIASES: Record<string, string> = {
  "/db": "/db",
  "/dbs": "/db",
  "/database": "/db",
  "/databases": "/db",
  "/studio": "/db",
  "/postgres": "/db",
  "/sql": "/db",
  "/infra": "/infra",
  "/infrastructure": "/infra",
  "/cloud": "/infra",
  "/vps": "/infra",
  "/baremetal": "/infra",
  "/bare-metal": "/infra",
  "/dedicated": "/infra",
  "/infra/configure": "/infra/configure",
  "/infra/config": "/infra/configure",
  "/configure": "/infra/configure",
  "/infra/dashboard": "/infra/dashboard",
  "/infra-dashboard": "/infra/dashboard",
  "/infra/panel": "/infra/dashboard",
  "/infra/hpanel": "/infra/dashboard",
  "/hpanel": "/infra/dashboard",
  "/proxmox": "/infra/dashboard",
  "/shield": "/shield",
  "/sec": "/shield",
  "/security": "/security",
  "/waf": "/shield",
  "/soc": "/shield",
  "/ddos": "/shield",
  "/terms": "/terms",
  "/term": "/terms",
  "/tos": "/terms",
  "/refund": "/refund",
  "/refunds": "/refund",
  "/game": "/game",
  "/games": "/game",
  "/gaming": "/game",
  "/fivem": "/game",
  "/minecraft": "/game",
  "/game/dashboard": "/game/dashboard",
  "/game-dashboard": "/game/dashboard",
  "/game/client": "/game/dashboard",
  "/game/panel": "/game/panel-launch",
  "/game/panel-launch": "/game/panel-launch",
  "/ptero": "/game/panel-launch",
  "/pterodactyl": "/game/panel-launch",
  "/drop": "/drop",
  "/file": "/drop",
  "/files": "/drop",
  "/vault": "/drop",
  "/share": "/drop",
  "/upload": "/drop",
  "/keys": "/keys",
  "/key": "/keys",
  "/password": "/keys",
  "/passwords": "/keys",
  "/pass": "/keys",
  "/passwd": "/keys",
  "/gateway": "/gateway",
  "/api": "/gateway",
  "/api-gateway": "/gateway",
  "/rest": "/gateway",
  "/docs": "/docs",
  "/doc": "/docs",
  "/documentation": "/docs",
  "/guide": "/docs",
  "/guides": "/docs",
  "/help": "/docs",
  "/errors": "/docs/errors",
  "/error": "/docs/errors",
  "/docs/errors": "/docs/errors",
  "/docs/error": "/docs/errors",
  "/story": "/story",
  "/about": "/story",
  "/deploy": "/deploy",
  "/ai": "/ai",
  "/agents": "/agents",
  "/dpdp": "/dpdp",
};

/** Standard Levenshtein edit distance for short route/subdomain tokens. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n]!;
}

function findClosestKey(input: string, candidates: readonly string[], maxDist = 2): string | null {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const cand of candidates) {
    const d = editDistance(clean, cand);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return bestDist <= maxDist ? best : null;
}

/** Strips port and lowercases a hostname header/value. */
export function cleanHostname(rawHost?: string | null): string {
  if (!rawHost) return "";
  return rawHost.split(",")[0]!.trim().split(":")[0]!.toLowerCase().replace(/\.+$/, "");
}

/** Detects which SparrowX service subdomain a hostname belongs to (including fuzzy typos). */
export function detectSubdomainContext(rawHost?: string | null): SubdomainProfile {
  const host = cleanHostname(rawHost);
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "sparrowx.net") {
    return SUBDOMAIN_PROFILES.master;
  }

  // Extract left prefix before `.sparrowx.net` (or first label on custom/local test hosts)
  let prefix = "";
  if (host.endsWith(".sparrowx.net")) {
    prefix = host.slice(0, -".sparrowx.net".length);
  } else if (host.includes(".")) {
    prefix = host.split(".")[0] ?? "";
  }
  if (!prefix || prefix === "www") return SUBDOMAIN_PROFILES.master;

  // Never override external/dedicated platform & wildcard tenant hostnames
  if (
    prefix === "game.panel" ||
    prefix === "panel" ||
    prefix === "netsec" ||
    prefix === "gamesec" ||
    prefix === "php" ||
    prefix === "admin" ||
    prefix === "console" ||
    prefix === "ingest.sec" ||
    prefix === "ingest.dpdp" ||
    prefix.endsWith(".ai") ||
    prefix.endsWith(".deploy")
  ) {
    return SUBDOMAIN_PROFILES.master;
  }

  const exactAlias = SUBDOMAIN_ALIASES[prefix];
  if (exactAlias) return SUBDOMAIN_PROFILES[exactAlias];

  // Fuzzy match typoed subdomain prefix (e.g. `infar`, `sheild`, `gmae`, `dbs`, `keyz`, `pasword`)
  const closestPrefix = findClosestKey(prefix, Object.keys(SUBDOMAIN_ALIASES), prefix.length >= 5 ? 2 : 1);
  if (closestPrefix) {
    return SUBDOMAIN_PROFILES[SUBDOMAIN_ALIASES[closestPrefix]!];
  }

  return SUBDOMAIN_PROFILES.master;
}

/**
 * If a visitor hit a typoed `*.sparrowx.net` subdomain (like `dbs.sparrowx.net`,
 * `infar.sparrowx.net`, `sheild.sparrowx.net`, `docs.sparrowx.net`, `www.sparrowx.net`),
 * returns the canonical full redirect URL (`https://<canonicalHost><correctedPath>`).
 * Returns `null` when the hostname is already canonical or not a `sparrowx.net` host.
 */
export function resolveCanonicalSubdomainRedirect(
  rawHost: string | null | undefined,
  pathname: string,
  search = "",
  protocol = "https",
): string | null {
  const host = cleanHostname(rawHost);
  if (!host || !host.endsWith(".sparrowx.net")) return null;

  const prefix = host.slice(0, -".sparrowx.net".length);
  if (
    prefix === "game.panel" ||
    prefix === "panel" ||
    prefix === "netsec" ||
    prefix === "gamesec" ||
    prefix === "php" ||
    prefix === "admin" ||
    prefix === "console" ||
    prefix === "ingest.sec" ||
    prefix === "ingest.dpdp" ||
    prefix.endsWith(".ai") ||
    prefix.endsWith(".deploy")
  ) {
    return null;
  }

  // Special case: `docs.sparrowx.net` / `doc.sparrowx.net` -> `https://sparrowx.net/docs`
  if (prefix === "docs" || prefix === "doc" || editDistance(prefix, "docs") <= 1) {
    const cleanPath = pathname.replace(/\/+$/, "") || "/";
    const destPath = cleanPath === "/" ? "/docs" : cleanPath.startsWith("/docs") ? cleanPath : `/docs${cleanPath}`;
    return `${protocol}://sparrowx.net${destPath}${search}`;
  }

  const profile = detectSubdomainContext(host);
  if (host === profile.canonicalHost) return null;

  const correctedPath =
    resolveAutoCorrectedPath(pathname, profile.canonicalHost) ?? (pathname || "/");
  return `${protocol}://${profile.canonicalHost}${correctedPath}${search}`;
}

/** Resolves a typoed `/docs/<slug>` segment (e.g. `dbs` -> `db`, `sheild` -> `shield`, `erros` -> `errors`). */
export function resolveAutoCorrectedDocSlug(
  rawSlug: string,
  rawHost?: string | null,
): string {
  const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!slug) {
    const ctx = detectSubdomainContext(rawHost);
    return ctx.docsPath.startsWith("/docs/") ? ctx.docsPath.slice("/docs/".length) : "db";
  }

  if (DOC_SLUG_ALIASES[slug]) return DOC_SLUG_ALIASES[slug]!;

  // Fuzzy match against known doc slugs and aliases
  const directClosest = findClosestKey(slug, VALID_DOC_SLUGS, slug.length >= 4 ? 2 : 1);
  if (directClosest) return directClosest;

  const aliasClosest = findClosestKey(slug, Object.keys(DOC_SLUG_ALIASES), slug.length >= 5 ? 2 : 1);
  if (aliasClosest) return DOC_SLUG_ALIASES[aliasClosest]!;

  // Fall back to the respected active subdomain's docs
  const ctx = detectSubdomainContext(rawHost);
  if (ctx.docsPath.startsWith("/docs/")) {
    return ctx.docsPath.slice("/docs/".length);
  }
  return "db";
}

function isDashboardIntent(normalized: string): boolean {
  const seg = normalized.split("/").filter(Boolean).pop() ?? "";
  return (
    seg.includes("dash") ||
    seg.includes("panel") ||
    seg.includes("console") ||
    seg.includes("portal") ||
    editDistance(seg, "dashboard") <= 3
  );
}

function isDocsIntent(normalized: string): boolean {
  const segs = normalized.split("/").filter(Boolean);
  const first = segs[0] ?? "";
  return (
    first === "doc" ||
    first === "docs" ||
    first === "documentation" ||
    first === "guide" ||
    first === "guides" ||
    first === "help" ||
    editDistance(first, "docs") <= 1 ||
    editDistance(first, "documentation") <= 3
  );
}

function isErrorIntent(normalized: string): boolean {
  const seg = normalized.split("/").filter(Boolean).pop() ?? "";
  return seg.includes("err") || seg.includes("trouble") || editDistance(seg, "errors") <= 2;
}

/**
 * Given a requested pathname and active hostname, returns the auto-corrected path
 * if the path is invalid/typoed, or `null` if the path is already valid and needs no redirect.
 */
export function resolveAutoCorrectedPath(
  rawPathname: string,
  rawHost?: string | null,
): string | null {
  if (!rawPathname) return null;

  // Never touch API routes, PostgREST, server functions, static assets, or file drops
  if (
    rawPathname.startsWith("/api/") ||
    rawPathname.startsWith("/rest/v1") ||
    rawPathname.startsWith("/_serverFn") ||
    rawPathname.startsWith("/assets/") ||
    rawPathname.startsWith("/logos/") ||
    rawPathname.startsWith("/3d/") ||
    rawPathname.startsWith("/xdp/") ||
    rawPathname.startsWith("/f/") ||
    rawPathname.startsWith("/projects/") ||
    /\.[a-z0-9]{1,8}$/i.test(rawPathname)
  ) {
    return null;
  }

  // Normalize repeated slashes, trailing slashes, and uppercase letters
  const normalized =
    rawPathname
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase() || "/";

  // Already a valid canonical route (check case/slash normalization too)
  if (VALID_STATIC_PATHS.has(normalized)) {
    return normalized !== rawPathname.replace(/\/+$/, "") || (rawPathname.length > 1 && rawPathname.endsWith("/"))
      ? normalized
      : null;
  }

  const ctx = detectSubdomainContext(rawHost);

  // 1. Handle `/docs/<typo>` or `/doc/<slug>` anywhere
  const docMatch = normalized.match(/^\/(?:documentation|docs|doc|guides|guide|help)(?:\/([^/]+))?$/);
  if (docMatch) {
    const rawSub = docMatch[1];
    if (!rawSub) {
      return ctx.docsPath;
    }
    const fixedSlug = resolveAutoCorrectedDocSlug(rawSub, rawHost);
    return `/docs/${fixedSlug}`;
  }

  // 2. Respect active service subdomain first when the path looks like a subdomain-relative typo
  if (ctx.key !== "master") {
    if (isDocsIntent(normalized)) return ctx.docsPath;
    if (isErrorIntent(normalized)) return "/docs/errors";
    if (isDashboardIntent(normalized)) return ctx.dashboardPath;
    if (ctx.key === "game" && (normalized.includes("ptero") || normalized.includes("launch"))) {
      return "/game/panel-launch";
    }
  }

  // 3. Exact alias lookup (e.g. `/infra-dashboard`, `/database`, `/sheild`, `/bare-metal`)
  if (PATH_ALIASES[normalized]) {
    const mapped = PATH_ALIASES[normalized]!;
    return mapped === "/docs" ? ctx.docsPath : mapped;
  }

  // 4. Multi-segment compound typo handling (e.g. `/infar/dashbord`, `/gmae/dashbaord`)
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const second = parts[1]!;
    const closestRoot = findClosestKey(
      first,
      ["infra", "game", "db", "shield", "drop", "keys", "gateway", "docs", "deploy", "ai", "agents", "dpdp"],
      2,
    );
    if (closestRoot === "docs") {
      return `/docs/${resolveAutoCorrectedDocSlug(second, rawHost)}`;
    }
    if (closestRoot === "infra") {
      if (isDashboardIntent(`/${second}`)) return "/infra/dashboard";
      if (second.includes("config") || editDistance(second, "configure") <= 2) {
        return "/infra/configure";
      }
      return "/infra";
    }
    if (closestRoot === "game") {
      if (isDashboardIntent(`/${second}`)) return "/game/dashboard";
      if (second.includes("panel") || second.includes("ptero") || second.includes("launch")) {
        return "/game/panel-launch";
      }
      return "/game";
    }
    if (closestRoot && PATH_ALIASES[`/${closestRoot}`]) {
      return PATH_ALIASES[`/${closestRoot}`]!;
    }
  }

  // 5. Fuzzy single-segment match across known paths & aliases
  const singleKey = parts.length === 1 ? `/${parts[0]}` : normalized;
  const closestAlias = findClosestKey(
    singleKey,
    Object.keys(PATH_ALIASES),
    singleKey.length >= 6 ? 2 : 1,
  );
  if (closestAlias) {
    const mapped = PATH_ALIASES[closestAlias]!;
    return mapped === "/docs" ? ctx.docsPath : mapped;
  }

  // 6. Subdomain-respecting safe fallback (never strands user on dead 404)
  return ctx.homePath;
}

/**
 * Cleans and auto-corrects a user-typed domain or URL input (used in onboarding & forms).
 * Fixes whitespace, double schemes (`https://https://`), missing dots, and common TLD typos
 * like `.sparrowx.ne` -> `.sparrowx.net`.
 */
export function normalizeUserDomainInput(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/\s+/g, "");
  v = v.replace(/^(https?:\/\/)+/i, "");
  v = v.replace(/\/.*$/, "");
  v = v.replace(/\.sparrowx\.ne$/i, ".sparrowx.net");
  v = v.replace(/\.sparrowx\.nt$/i, ".sparrowx.net");
  v = v.replace(/\.sparrowx\.nett$/i, ".sparrowx.net");
  v = v.replace(/\.cmo$/i, ".com");
  v = v.replace(/\.con$/i, ".com");
  v = v.replace(/\.ogr$/i, ".org");
  return v.replace(/^\.+|\.+$/g, "");
}
