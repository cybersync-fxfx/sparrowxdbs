export type RootRedirectTarget = {
  to:
    | "/db"
    | "/shield"
    | "/drop"
    | "/keys"
    | "/gateway"
    | "/game"
    | "/game/dashboard"
    | "/infra"
    | "/deploy"
    | "/ai"
    | "/agents"
    | "/dpdp"
    | "/security";
  search: Record<string, unknown>;
  hash?: string;
};

export type SubdomainProduct =
  | "db"
  | "shield"
  | "drop"
  | "keys"
  | "api"
  | "game"
  | "game-dash"
  | "game-panel"
  | "infra"
  | "deploy"
  | "ai"
  | "agents"
  | "dpdp"
  | "console";

/**
 * Prefix rules ordered from most-specific multi-label hosts (e.g. `game.dash.`)
 * to single-label prefixes so `game.dash.` and `game.panel.` are never shadowed by `game.`.
 */
const SUBDOMAIN_RULES: ReadonlyArray<{
  prefixes: readonly string[];
  product: SubdomainProduct;
  route: RootRedirectTarget["to"] | null;
}> = [
  { prefixes: ["game.panel.", "panel."], product: "game-panel", route: null },
  { prefixes: ["console."], product: "console", route: null },
  { prefixes: ["game.dash.", "game-dash."], product: "game-dash", route: "/game/dashboard" },
  { prefixes: ["game.", "game-"], product: "game", route: "/game" },
  { prefixes: ["infra.", "metal.", "vps.", "cloud."], product: "infra", route: "/infra" },
  { prefixes: ["deploy."], product: "deploy", route: "/deploy" },
  { prefixes: ["ai."], product: "ai", route: "/ai" },
  { prefixes: ["agents."], product: "agents", route: "/agents" },
  { prefixes: ["dpdp."], product: "dpdp", route: "/dpdp" },
  { prefixes: ["db.", "studio.", "supabase.", "sparrowbase."], product: "db", route: "/db" },
  { prefixes: ["sec.", "shield."], product: "shield", route: "/shield" },
  { prefixes: ["file.", "drop.", "share."], product: "drop", route: "/drop" },
  { prefixes: ["password.", "passwd.", "pass.", "keys."], product: "keys", route: "/keys" },
  { prefixes: ["api.", "rest."], product: "api", route: "/gateway" },
];

const ROUTING_FLAG_KEYS = new Set([
  "db",
  "studio",
  "sparrowbase",
  "shield",
  "sec",
  "file",
  "password",
  "passwd",
  "pass",
  "keys",
  "api",
  "gateway",
  "game",
  "infra",
  "metal",
  "vps",
  "deploy",
  "ai",
  "agents",
  "dpdp",
]);

/**
 * Classifies which SparrowX standalone product a hostname belongs to, if any.
 */
export function matchProductSubdomain(
  hostname: string,
): { product: SubdomainProduct; prefix: string; route: RootRedirectTarget["to"] | null } | null {
  const host = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (!host) return null;

  for (const rule of SUBDOMAIN_RULES) {
    for (const prefix of rule.prefixes) {
      if (host.startsWith(prefix)) {
        const remainder = host.slice(prefix.length);
        if (remainder === "localhost" || remainder.includes(".")) {
          return { product: rule.product, prefix, route: rule.route };
        }
      }
    }
  }
  return null;
}

export function isProductSubdomain(hostname: string): boolean {
  return matchProductSubdomain(hostname) !== null;
}

/**
 * Returns the origin of the master portal (e.g. `https://sparrowx.net`) when the user
 * is currently on a product subdomain (`db.sparrowx.net`, `sec.sparrowx.net`, etc.), or
 * `""` when already on the root domain, `localhost`, or a preview host.
 */
export function getMasterRootOrigin(
  loc?: Pick<Location, "hostname" | "protocol" | "port">,
): string {
  const targetLoc =
    loc ?? (typeof window !== "undefined" ? window.location : undefined);
  if (!targetLoc) return "";

  const matched = matchProductSubdomain(targetLoc.hostname);
  if (!matched) return "";

  const rootHost = targetLoc.hostname.trim().toLowerCase().slice(matched.prefix.length);
  const protocol = targetLoc.protocol || "https:";
  const port = targetLoc.port ? `:${targetLoc.port}` : "";
  return `${protocol}//${rootHost}${port}`;
}

/**
 * Builds an href pointing to a root-domain page or section (such as `/` or `/#vps`).
 * On product subdomains (`db.`, `sec.`, `file.`, etc.), resolves to the master domain so
 * clicking Home or `#vps` does not loop back into the subdomain's `beforeLoad` redirect.
 */
export function buildMasterHref(
  pathOrAnchor: string,
  loc?: Pick<Location, "hostname" | "protocol" | "port">,
): string {
  const normalized = pathOrAnchor.startsWith("/") ? pathOrAnchor : `/${pathOrAnchor}`;
  const origin = getMasterRootOrigin(loc);
  return origin ? `${origin}${normalized}` : normalized;
}

export type CanonicalProductKey =
  | "db"
  | "shield"
  | "drop"
  | "keys"
  | "api"
  | "infra"
  | "deploy"
  | "ai"
  | "agents"
  | "dpdp"
  | "game"
  | "game-dash"
  | "netsec"
  | "gamesec";

const CANONICAL_PRODUCT_TARGETS: Record<
  CanonicalProductKey,
  { prodBase: string; localPath: string }
> = {
  db: { prodBase: "https://db.sparrowx.net", localPath: "/db" },
  shield: { prodBase: "https://sec.sparrowx.net", localPath: "/shield" },
  drop: { prodBase: "https://file.sparrowx.net", localPath: "/drop" },
  keys: { prodBase: "https://password.sparrowx.net", localPath: "/keys" },
  api: { prodBase: "https://api.sparrowx.net", localPath: "/gateway" },
  infra: { prodBase: "https://infra.sparrowx.net", localPath: "/infra" },
  deploy: { prodBase: "https://deploy.sparrowx.net", localPath: "/deploy" },
  ai: { prodBase: "https://ai.sparrowx.net", localPath: "/ai" },
  agents: { prodBase: "https://agents.sparrowx.net", localPath: "/agents" },
  dpdp: { prodBase: "https://dpdp.sparrowx.net", localPath: "/dpdp" },
  game: { prodBase: "https://sparrowx.net/game", localPath: "/game" },
  "game-dash": { prodBase: "https://sparrowx.net/game/dashboard", localPath: "/game/dashboard" },
  netsec: { prodBase: "https://netsec.sparrowx.net", localPath: "https://netsec.sparrowx.net" },
  gamesec: { prodBase: "https://gamesec.sparrowx.net", localPath: "https://gamesec.sparrowx.net" },
};

/**
 * Resolves a product link cleanly for both production (`*.sparrowx.net`) and local dev (`localhost`).
 * Prevents cross-subdomain path leakage (e.g. clicking Cloud DB from `api.sparrowx.net` always goes
 * to `https://db.sparrowx.net` in production and `/db` on localhost).
 */
export function buildProductHref(
  product: CanonicalProductKey,
  subPath = "",
  loc?: Pick<Location, "hostname" | "protocol" | "port">,
): string {
  const spec = CANONICAL_PRODUCT_TARGETS[product];
  const suffix = subPath ? (subPath.startsWith("/") || subPath.startsWith("#") || subPath.startsWith("?") ? subPath : `/${subPath}`) : "";
  const targetLoc =
    loc ?? (typeof window !== "undefined" ? window.location : undefined);
  const host = (targetLoc?.hostname ?? "").trim().toLowerCase().split(":")[0] ?? "";
  const isSparrowxProd = host === "sparrowx.net" || host.endsWith(".sparrowx.net");

  if (isSparrowxProd) {
    return `${spec.prodBase}${suffix}`;
  }
  if (spec.localPath.startsWith("http")) {
    return `${spec.localPath}${suffix}`;
  }
  return `${spec.localPath}${suffix}`;
}

function stripRoutingFlags(
  search: Record<string, unknown>,
  preserveDropValue: boolean,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    if (ROUTING_FLAG_KEYS.has(key)) continue;
    // `?drop=1` is a navigation shortcut and would otherwise look like dropId="1" in DropEngine.
    if (key === "drop" && !preserveDropValue) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Computes the destination when visiting `/` on a product subdomain or via query/hash shortcut,
 * while preserving payload parameters (`?drop=<id>`, `?f=<id>`, `?service=`, `?deploy=`,
 * `?auth_error=`, and URL fragments like `#key=...`).
 */
export function resolveRootRedirectTarget(input: {
  hostname?: string;
  search?: Record<string, unknown>;
  hash?: string;
}): RootRedirectTarget | null {
  const hostname = input.hostname ?? "";
  const search = input.search ?? {};
  const cleanHash = (input.hash ?? "").replace(/^#/, "");

  const dropVal = typeof search.drop === "string" ? search.drop.trim() : "";
  const fVal = typeof search.f === "string" ? search.f.trim() : "";
  const hasRealDropId = dropVal.length > 0 && dropVal !== "1";
  const hasKeyFragment = cleanHash.includes("key=");

  let destination: RootRedirectTarget["to"] | null = null;
  const sub = matchProductSubdomain(hostname);
  if (sub?.route) {
    destination = sub.route;
  } else if (
    search.db === "1" ||
    search.studio === "1" ||
    search.studio === "true" ||
    search.sparrowbase === "1"
  ) {
    destination = "/db";
  } else if (search.shield === "1" || search.sec === "1") {
    destination = "/shield";
  } else if (
    search.file === "1" ||
    search.drop === "1" ||
    hasRealDropId ||
    fVal.length > 0 ||
    hasKeyFragment
  ) {
    destination = "/drop";
  } else if (
    search.keys === "1" ||
    search.password === "1" ||
    search.passwd === "1" ||
    search.pass === "1"
  ) {
    destination = "/keys";
  } else if (search.api === "1" || search.gateway === "1") {
    destination = "/gateway";
  } else if (search.game === "1") {
    destination = "/game";
  } else if (search.infra === "1" || search.metal === "1" || search.vps === "1") {
    destination = "/infra";
  } else if (search.deploy === "1") {
    destination = "/deploy";
  } else if (search.ai === "1") {
    destination = "/ai";
  } else if (search.agents === "1") {
    destination = "/agents";
  } else if (search.dpdp === "1") {
    destination = "/dpdp";
  }

  if (!destination) return null;

  const preserveDropValue = hasRealDropId;
  const cleanedSearch = stripRoutingFlags(search, preserveDropValue);

  return {
    to: destination,
    search: cleanedSearch,
    ...(cleanHash ? { hash: cleanHash } : {}),
  };
}
