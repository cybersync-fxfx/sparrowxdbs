import type { EggVariableView } from "./portal-types";

export type VariablePriority = "required" | "recommended" | "advanced";
export type VariableControlKind = "password" | "secret-key" | "boolean" | "select" | "radio" | "numeric" | "text";

export interface AnalyzedEggVariable {
  variable: EggVariableView;
  priority: VariablePriority;
  controlKind: VariableControlKind;
  isRequired: boolean;
  wasPlaceholderDefault: boolean;
  canGeneratePassword: boolean;
  initialValue: string;
  options?: string[];
  booleanFormat?: { trueVal: string; falseVal: string };
  min?: number;
  max?: number;
  helperLink?: { label: string; url: string };
  smartHint: string;
}

const UNSAFE_PLACEHOLDER_PATTERNS = [
  /^changeme$/i,
  /^change[_-]?me$/i,
  /^change[_-]?this$/i,
  /^youshallnotpass$/i,
  /^password$/i,
  /^admin123$/i,
  /^secret$/i,
  /^your[_ -]?(token|key|license|password|secret|api[_ -]?key)/i,
  /^paste[_ -]?your/i,
  /^put[_ -]?your/i,
  /^replace[_ -]?me$/i,
  /^example$/i,
  /^insert[_ -]?here$/i,
  /^<.*>$/,
];

const GENERIC_DEFAULT_HOSTNAMES = [
  /^sa-?mp\s*0\.3/i,
  /^a\s+minecraft\s+server/i,
  /^my\s+(server|rust|valheim|fivem|ark)/i,
  /^default\s+server/i,
  /^pterodactyl\s+server/i,
  /^unnamed\s+server/i,
];

function isUnsafePlaceholder(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return UNSAFE_PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed));
}

function isGenericHostnameDefault(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return GENERIC_DEFAULT_HOSTNAMES.some((re) => re.test(trimmed));
}

function parseRuleParts(rules: string): string[] {
  return rules
    .split("|")
    .map((r) => r.trim())
    .filter(Boolean);
}

function extractInOptions(ruleParts: string[]): string[] | null {
  const inRule = ruleParts.find((r) => /^in:/i.test(r));
  if (!inRule) return null;
  const opts = inRule
    .slice(3)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return opts.length >= 2 ? opts : null;
}

function extractMinMax(ruleParts: string[]): { min?: number; max?: number } {
  const out: { min?: number; max?: number } = {};
  for (const r of ruleParts) {
    const minMatch = r.match(/^min:(\d+)$/i);
    if (minMatch) out.min = Number(minMatch[1]);
    const maxMatch = r.match(/^max:(\d+)$/i);
    if (maxMatch) out.max = Number(maxMatch[1]);
    const betweenMatch = r.match(/^between:(\d+),(\d+)$/i);
    if (betweenMatch) {
      out.min = Number(betweenMatch[1]);
      out.max = Number(betweenMatch[2]);
    }
  }
  return out;
}

function detectHelperLink(envKey: string): { label: string; url: string } | undefined {
  if (/FIVEM_LICENSE|LICENSE_KEY|CFX/i.test(envKey)) {
    return { label: "Get free key at Cfx.re Portal", url: "https://portal.cfx.re/servers/registration-keys" };
  }
  if (/STEAM_WEBAPI|STEAM_API/i.test(envKey)) {
    return { label: "Get Steam Web API Key", url: "https://steamcommunity.com/dev/apikey" };
  }
  if (/SRCDS_TOKEN|GSLT|STEAM_ACC/i.test(envKey)) {
    return { label: "Create Steam GSLT Token", url: "https://steamcommunity.com/dev/managegameservers" };
  }
  if (/(DISCORD_TOKEN|BOT_TOKEN)/i.test(envKey)) {
    return { label: "Copy from Discord Developer Portal", url: "https://discord.com/developers/applications" };
  }
  return undefined;
}

/**
 * Generates a cryptographically strong, URL/config-safe password (no quotes or shell-breaking chars)
 * for RCON, Admin, Database, Redis, or Lavalink passwords.
 */
export function generateStrongConfigPassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#_-";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i]! % charset.length];
  }
  return result;
}

/**
 * Analyzes every Pterodactyl egg variable to classify required setup inputs, clear insecure
 * placeholder defaults (e.g. RCON_PASSWORD="changeme"), infer optimal input controls,
 * and pre-fill sensible plan-aware values (like server hostname or max slots).
 */
export function analyzeEggVariables(
  variables: EggVariableView[],
  context: { serverName?: string; planSlots?: number; eggName?: string } = {},
): AnalyzedEggVariable[] {
  const editableVars = variables.filter((v) => v.userEditable && v.userViewable);

  const analyzed = editableVars.map((v): AnalyzedEggVariable => {
    const key = v.envVariable;
    const ruleParts = parseRuleParts(v.rules);
    const hasRequiredRule = ruleParts.some((r) => /^required$/i.test(r));
    const hasNullableRule = ruleParts.some((r) => /^nullable$/i.test(r));
    const isNumericRule = ruleParts.some((r) => /^(numeric|integer|digits)$/i.test(r));
    const isBooleanRule = ruleParts.some((r) => /^boolean$/i.test(r));
    const inOptions = extractInOptions(ruleParts);
    const { min, max } = isNumericRule ? extractMinMax(ruleParts) : {};

    const rawDefault = (v.serverValue || v.defaultValue || "").trim();
    const isPasswordKey = /(RCON_PASS|RCON_PW|PASSWORD|PASSWD|ADMIN_PASS|DB_PASS|MYSQL_ROOT|POSTGRES_PASS|MONGO_.*PASS|REDIS_PASS|LAVALINK_PASS|SERVER_PASS|TXADMIN_PASS)/i.test(
      key,
    );
    const isExternalKey = /(FIVEM_LICENSE|LICENSE_KEY|BOT_TOKEN|DISCORD_TOKEN|API_KEY|WEBAPIKEY|SRCDS_TOKEN|GSLT|AUTH_KEY|SECRET_KEY|CLIENT_SECRET)/i.test(
      key,
    );
    const isHostnameKey = /(^HOSTNAME$|^SERVER_NAME$|^SV_HOSTNAME$|^WORLD_NAME$|^MOTD$|^SERVER_TITLE$)/i.test(key);
    const isSlotKey = /(^MAX_PLAYERS$|^MAX_CLIENTS$|^SERVER_SLOTS$|^MAXPLAYERS$|^SV_MAXCLIENTS$)/i.test(key);
    const isCoreEntryKey = /(^GAMEMODE|^MAIN_FILE$|^JS_FILE$|^PY_FILE$|^BOT_JS_FILE$|^BOT_PY_FILE$|^GIT_ADDRESS$|^DATABASE$|^POSTGRES_DB$|^MYSQL_DATABASE$|^MYSQL_USER$|^POSTGRES_USER$)/i.test(
      key,
    );
    const isVersionOrBranchKey = /(VERSION|BUILD_NUMBER|BRANCH|MC_VERSION|MINECRAFT_VERSION|FORGE_VERSION|FABRIC_VERSION|PAPER_VERSION|NODE_VERSION|PYTHON_VERSION)/i.test(
      key,
    );
    const isBoolKey =
      isBooleanRule ||
      (inOptions &&
        inOptions.length === 2 &&
        ((inOptions.includes("0") && inOptions.includes("1")) ||
          (inOptions.map((o) => o.toLowerCase()).includes("true") &&
            inOptions.map((o) => o.toLowerCase()).includes("false")))) ||
      /(^EULA$|^AUTO_UPDATE$|^TXADMIN_ENABLE$|^ONLINE_MODE$|^ENABLE_)/i.test(key);

    const placeholderFlag = isUnsafePlaceholder(rawDefault);

    // Determine control kind (following modern-web-guidance selection matrix)
    let controlKind: VariableControlKind = "text";
    let booleanFormat: { trueVal: string; falseVal: string } | undefined;

    if (isBoolKey) {
      controlKind = "boolean";
      const usesTrueFalse =
        inOptions?.some((o) => /^true$/i.test(o)) || /^(true|false)$/i.test(rawDefault) || /^EULA$/i.test(key);
      booleanFormat = usesTrueFalse ? { trueVal: "true", falseVal: "false" } : { trueVal: "1", falseVal: "0" };
    } else if (isPasswordKey) {
      controlKind = "password";
    } else if (isExternalKey) {
      controlKind = "secret-key";
    } else if (inOptions) {
      controlKind = inOptions.length <= 5 ? "radio" : "select";
    } else if (isNumericRule) {
      controlKind = "numeric";
    }

    // Never keep insecure placeholder defaults like RCON_PASSWORD="changeme" or "youshallnotpass"!
    let initialValue = rawDefault;
    if (placeholderFlag) {
      initialValue = "";
    } else if (isHostnameKey && (!rawDefault || isGenericHostnameDefault(rawDefault)) && context.serverName) {
      initialValue = context.serverName;
    } else if (isSlotKey && context.planSlots && context.planSlots > 0) {
      initialValue = String(context.planSlots);
    }

    // Decide whether user MUST configure this before launch
    const mustAskSecret =
      (isPasswordKey && (hasRequiredRule || placeholderFlag || /RCON|ADMIN|ROOT|POSTGRES|MYSQL|MONGO|REDIS|LAVALINK/i.test(key))) ||
      (isExternalKey && (hasRequiredRule || /FIVEM_LICENSE|LICENSE_KEY|BOT_TOKEN|DISCORD_TOKEN/i.test(key)));

    const isRequired = Boolean(
      mustAskSecret ||
        (hasRequiredRule && !hasNullableRule && (!initialValue || placeholderFlag || isHostnameKey || isCoreEntryKey)),
    );

    let priority: VariablePriority = "advanced";
    if (isRequired || placeholderFlag || (hasRequiredRule && !hasNullableRule && !initialValue)) {
      priority = "required";
    } else if (isHostnameKey || isSlotKey || isCoreEntryKey || isVersionOrBranchKey || isPasswordKey || isExternalKey || isBoolKey) {
      priority = "recommended";
    }

    let smartHint = v.description || `Configure ${v.name} (${key}).`;
    if (placeholderFlag) {
      smartHint = `Default "${rawDefault}" is unsafe — enter your own secure value or click Generate.`;
    } else if (/RCON/i.test(key) && !rawDefault) {
      smartHint = "Set a strong RCON admin password so nobody can hijack server commands.";
    } else if (/FIVEM_LICENSE|LICENSE_KEY/i.test(key)) {
      smartHint = "Required Cfx.re server license key — FiveM/RedM will not start without it.";
    } else if (/BOT_TOKEN|DISCORD_TOKEN/i.test(key)) {
      smartHint = "Paste your Discord bot token so your bot connects immediately on first boot.";
    }

    return {
      variable: v,
      priority,
      controlKind,
      isRequired,
      wasPlaceholderDefault: placeholderFlag,
      canGeneratePassword: controlKind === "password",
      initialValue,
      ...(inOptions ? { options: inOptions } : {}),
      ...(booleanFormat ? { booleanFormat } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      helperLink: detectHelperLink(key),
      smartHint,
    };
  });

  // Sort: Required first, then Recommended, then Advanced
  const order: Record<VariablePriority, number> = { required: 0, recommended: 1, advanced: 2 };
  return analyzed.sort((a, b) => order[a.priority] - order[b.priority]);
}

export function validateAnalyzedVariables(
  analyzed: AnalyzedEggVariable[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const item of analyzed) {
    const key = item.variable.envVariable;
    const val = (values[key] ?? "").trim();

    if (item.isRequired && !val) {
      errors[key] = `${item.variable.name} is required before creating your server.`;
      continue;
    }
    if (val && isUnsafePlaceholder(val)) {
      errors[key] = `Do not leave "${val}" as default — enter a real value or click Generate.`;
      continue;
    }
    if (item.controlKind === "password" && item.isRequired && val.length < 6) {
      errors[key] = `${item.variable.name} should be at least 6 characters long.`;
      continue;
    }
    if (item.controlKind === "numeric" && val) {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        errors[key] = `${item.variable.name} must be a valid number.`;
      } else if (item.min !== undefined && n < item.min) {
        errors[key] = `Must be at least ${item.min}.`;
      } else if (item.max !== undefined && n > item.max) {
        errors[key] = `Must be at most ${item.max}.`;
      }
    }
  }
  return errors;
}
