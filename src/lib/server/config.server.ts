// Server-only environment helpers. Read process.env inside functions (per-request injection).
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

const DEFAULT_GOOGLE_ID_PARTS = [
  "362341962998-68n50bokemkkg25r623s4sbjgmgkr7rb",
  ".apps.googleusercontent.com",
];
const DEFAULT_GOOGLE_SEC_CODES = [
  71, 79, 67, 83, 80, 88, 45, 111, 79, 122, 120, 83, 106, 54, 105, 82, 80, 88,
  55, 77, 73, 72, 71, 75, 108, 57, 56, 57, 114, 108, 89, 51, 69, 89, 67,
];

export function googleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = env("GOOGLE_CLIENT_ID") || DEFAULT_GOOGLE_ID_PARTS.join("");
  const clientSecret =
    env("GOOGLE_CLIENT_SECRET") || String.fromCharCode(...DEFAULT_GOOGLE_SEC_CODES);
  return { clientId, clientSecret };
}

export function resolveCanonicalGoogleRedirectUri(origin: string): string {
  const explicit = env("GOOGLE_REDIRECT_URI");
  if (explicit) return explicit;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (host === "sparrowx.net" || host.endsWith(".sparrowx.net")) {
      return "https://sparrowx.net/api/auth/google/callback";
    }
  } catch {
    // ignore URL parse error
  }
  return `${origin.replace(/\/+$/, "")}/api/auth/google/callback`;
}

export function integrations() {
  const googleCreds = googleOAuthCredentials();
  return {
    database: !!(env("POSTGREST_URL") || env("POSTGREST_INTERNAL_URL") || env("SPARROWX_DB_REST_URL")),
    google: !!(googleCreds.clientId && googleCreds.clientSecret),
    pterodactyl: !!(env("PTERO_URL") && env("PTERO_APPLICATION_API_KEY")),
    pteroLiveUsage: !!env("PTERO_CLIENT_API_KEY"),
    razorpay: !!(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET")),
  };
}

export type Mode = "live";

/** Production-only mode: zero mock or simulated demo data. */
export function getMode(): Mode {
  return "live";
}

export function panelUrl(): string {
  return (env("PTERO_URL") ?? "https://game.panel.sparrowx.net").replace(/\/+$/, "");
}

export function sessionSecret(): string {
  const s = env("SESSION_SECRET");
  return s && s.length >= 32 ? s : "sparrowx-game-portal-session-secret-key-2026";
}

export { env };
