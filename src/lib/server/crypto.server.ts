const enc = new TextEncoder();
const dec = new TextDecoder();

function secret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is not configured");
  return s;
}

async function aesKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`${secret()}:ptero-password:v1`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const toB64 = (buf: Uint8Array) => btoa(String.fromCharCode(...buf));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptText(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptText(stored: string): Promise<string> {
  const buf = fromB64(stored);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, await aesKey(), buf.slice(12));
  return dec.decode(pt);
}

export function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Strong panel password: 20 chars mixing upper, lower, digits and symbols. */
export function generatePassword(length = 20): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_+="];
  const all = sets.join("");
  const rnd = crypto.getRandomValues(new Uint32Array(length));
  const chars = Array.from(rnd, (n, i) => (i < sets.length ? sets[i][n % sets[i].length] : all[n % all.length]));
  // shuffle
  const sh = crypto.getRandomValues(new Uint32Array(length));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sh[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return Array.from(sig, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Pterodactyl usernames: lowercase letters, digits, dot, dash, underscore; must start alphanumeric. */
export function sanitizeUsername(name: string, discordId: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 20);
  return `${base || "player"}_${discordId.slice(-4)}`;
}
