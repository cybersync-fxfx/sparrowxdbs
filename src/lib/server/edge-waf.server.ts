import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type EdgeWafMode = "balanced" | "strict" | "monitor";
export type EdgeWafAction = "ALLOW" | "CHALLENGE" | "VERIFIED" | "BLOCKED" | "MONITOR";

export interface DomainWafPolicy {
  domain: string;
  wafMode: EdgeWafMode;
  edgeCheckEnabled: boolean;
  sensorKey?: string | undefined;
  updatedAt: string;
}

export interface PublicDomainWafPolicy {
  domain: string;
  wafMode: EdgeWafMode;
  edgeCheckEnabled: boolean;
  hasSensorKey: boolean;
  updatedAt: string;
}

export interface LiveEdgeEvent {
  id: string;
  rayId: string;
  timestamp: string;
  domain: string;
  ip: string;
  method: string;
  path: string;
  action: EdgeWafAction;
  rule: string;
  statusCode: number;
  userAgent: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
}

export interface LiveEdgeTelemetrySnapshot {
  ok: true;
  domain: string;
  domainProtected: boolean;
  policy: PublicDomainWafPolicy;
  connectedDomains: PublicDomainWafPolicy[];
  uptimeSec: number;
  totalInspected: number;
  requestsPerMin: number;
  blockedCount: number;
  challengesIssued: number;
  challengesPassed: number;
  uniqueIps: number;
  lastEventAt: string | null;
  recentEvents: LiveEdgeEvent[];
}

export interface EdgeWafGateResult {
  rayId: string;
  edgeStatus: EdgeWafAction | "BYPASS";
  wafMode: EdgeWafMode;
  response?: Response | undefined;
}

const BOOT_TS = Date.now();
const MAX_EVENTS = 120;
const CLEARANCE_COOKIE_NAME = "__spx_edge_clearance";
const CLEARANCE_TTL_SEC = 1800; // 30 minutes
const CHALLENGE_TTL_SEC = 180; // 3 minutes

const policiesMap = new Map<string, DomainWafPolicy>();
const recentEvents: LiveEdgeEvent[] = [];
const ipHitWindows = new Map<string, { count: number; windowStart: number }>();
const recentTimestamps: number[] = [];
const uniqueIpSet = new Set<string>();

let totalInspected = 0;
let totalBlocked = 0;
let totalChallengesIssued = 0;
let totalChallengesPassed = 0;
let lastTenantSyncTs = 0;
let policiesLoadedFromDisk = false;

const POLICY_STORE_PATH = path.resolve(
  process.env.SPARROWX_DATA_DIR || "./data",
  "shield-waf-policies.json",
);

const WAF_SIGNATURES: ReadonlyArray<{
  rule: string;
  severity: "Critical" | "High" | "Medium";
  title: string;
  pattern: RegExp;
  target: "url" | "ua" | "both";
}> = [
  {
    rule: "SPX-WAF-TEST",
    severity: "High",
    title: "Live Edge WAF Verification Probe Blocked",
    pattern: /[?&]spx_waf_test=1(?:&|$)/i,
    target: "url",
  },
  {
    rule: "OWASP-SQLI-942",
    severity: "Critical",
    title: "SQL Injection Payload Blocked at Edge WAF",
    pattern:
      /(?:union(?:\s+all)?\s+select|(?:'|%27)\s*(?:or|and)\s+(?:1=1|'1'='1'|true)|pg_sleep\s*\(|sleep\s*\(\s*\d|benchmark\s*\(|information_schema\.(?:tables|columns)|;\s*drop\s+table)/i,
    target: "url",
  },
  {
    rule: "OWASP-XSS-941",
    severity: "High",
    title: "Cross-Site Scripting (XSS) Vector Blocked",
    pattern: /(?:<script\b|%3cscript\b|javascript:|onerror\s*=|onload\s*=|document\.cookie)/i,
    target: "url",
  },
  {
    rule: "OWASP-LFI-930",
    severity: "Critical",
    title: "Path Traversal / Sensitive File Probe Blocked",
    pattern:
      /(?:\.\.(?:\/|\\|%2f|%5c)|\/etc\/passwd|\/proc\/self|\/\.env(?:$|\/|\?)|\/\.git\/|\/wp-login\.php|\/wp-admin(?:\/|$)|\/xmlrpc\.php|\/shell\.php)/i,
    target: "url",
  },
  {
    rule: "SPX-SCANNER-913",
    severity: "Medium",
    title: "Automated Vulnerability Scanner Blocked",
    pattern: /\b(?:sqlmap|nikto|acunetix|nuclei|masscan|zgrab|dirbuster|gobuster|wpscan|nessus)\b/i,
    target: "ua",
  },
];

const GOOD_BOT_UA_RE =
  /(?:googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|slurp|facebookexternalhit|twitterbot|discordbot|slackbot|whatsapp|telegrambot|linkedinbot|uptimerobot|pingdom|curl\/|wget\/|node-fetch|undici)/i;

const EXEMPT_HOST_PREFIXES = [
  "sec.",
  "shield.",
  "admin.",
  "console.",
  "php.",
  "panel.",
  "game.panel.",
];

function getWafSecret(): string {
  return (
    process.env.SPARROWX_MASTER_SSO_SECRET ||
    process.env.SPARROWX_JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "sparrowx_edge_waf_default_signing_key_2026"
  );
}

export function normalizeWafDomain(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.+$/, "");
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "127.0.0.1";
}

function makeRayId(): string {
  return `spx_${randomBytes(6).toString("hex")}`;
}

function signToken(payload: string): string {
  return createHmac("sha256", getWafSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function uaHash(ua: string): string {
  return createHmac("sha256", getWafSecret())
    .update(ua.slice(0, 200))
    .digest("base64url")
    .slice(0, 12);
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function loadPoliciesFromDisk(): void {
  if (policiesLoadedFromDisk) return;
  policiesLoadedFromDisk = true;
  try {
    if (fs.existsSync(POLICY_STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(POLICY_STORE_PATH, "utf8")) as DomainWafPolicy[];
      if (Array.isArray(raw)) {
        for (const p of raw) {
          const dom = normalizeWafDomain(p.domain);
          if (dom) {
            policiesMap.set(dom, {
              domain: dom,
              wafMode: p.wafMode === "strict" || p.wafMode === "monitor" ? p.wafMode : "balanced",
              edgeCheckEnabled: Boolean(p.edgeCheckEnabled),
              sensorKey: p.sensorKey,
              updatedAt: p.updatedAt || new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {
    // ignore disk load issues
  }
}

function savePoliciesToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(POLICY_STORE_PATH), { recursive: true });
    fs.writeFileSync(
      POLICY_STORE_PATH,
      JSON.stringify(Array.from(policiesMap.values()), null, 2),
      "utf8",
    );
  } catch {
    // non-fatal if running on read-only FS
  }
}

export function upsertDomainWafPolicy(input: {
  domain: string;
  wafMode?: EdgeWafMode | undefined;
  edgeCheckEnabled?: boolean | undefined;
  sensorKey?: string | undefined;
}): DomainWafPolicy {
  loadPoliciesFromDisk();
  const dom = normalizeWafDomain(input.domain);
  const existing = policiesMap.get(dom);
  const next: DomainWafPolicy = {
    domain: dom,
    wafMode: input.wafMode ?? existing?.wafMode ?? "balanced",
    edgeCheckEnabled:
      input.edgeCheckEnabled !== undefined
        ? input.edgeCheckEnabled
        : existing?.edgeCheckEnabled ?? true,
    sensorKey: input.sensorKey ?? existing?.sensorKey,
    updatedAt: new Date().toISOString(),
  };
  policiesMap.set(dom, next);
  savePoliciesToDisk();
  return next;
}

async function syncConnectedTenantsFromDb(): Promise<void> {
  loadPoliciesFromDisk();
  const now = Date.now();
  if (now - lastTenantSyncTs < 30_000) return;
  lastTenantSyncTs = now;

  const pgrstBase = (
    process.env.POSTGREST_INTERNAL_URL ||
    process.env.SPARROWX_DB_REST_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/+$/, "");

  try {
    const res = await fetch(`${pgrstBase}/client_tenants?select=primary_domain,api_key,status`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{
      primary_domain?: string;
      api_key?: string;
      status?: string;
    }>;
    if (!Array.isArray(rows)) return;
    let changed = false;
    for (const row of rows) {
      const dom = normalizeWafDomain(row.primary_domain);
      if (!dom || dom.includes("localhost")) continue;
      if (!policiesMap.has(dom)) {
        policiesMap.set(dom, {
          domain: dom,
          wafMode: "balanced",
          edgeCheckEnabled: true,
          sensorKey: row.api_key,
          updatedAt: new Date().toISOString(),
        });
        changed = true;
      }
    }
    if (changed) savePoliciesToDisk();
  } catch {
    // PostgREST unreachable during dev/test; keep in-memory/disk policies
  }
}

export function isProtectedWafHost(rawHost: string): DomainWafPolicy | null {
  loadPoliciesFromDisk();
  const clean = normalizeWafDomain(rawHost);
  if (!clean) return null;
  if (EXEMPT_HOST_PREFIXES.some((p) => clean.startsWith(p))) return null;
  if (clean === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(clean)) return null;

  const exact = policiesMap.get(clean);
  if (exact) return exact;
  return null;
}

export function createEdgeChallengeToken(domain: string, ua: string): {
  token: string;
  rayId: string;
} {
  const rayId = makeRayId();
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SEC;
  const payload = `${normalizeWafDomain(domain)}|${uaHash(ua)}|${exp}|${rayId}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = signToken(encoded);
  return { token: `${encoded}.${sig}`, rayId };
}

export function verifyEdgeChallengeAndIssueClearance(
  token: string,
  expectedDomain: string,
  ua: string,
  ip: string,
): { ok: boolean; cookieHeader?: string; rayId?: string; error?: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Malformed challenge token" };
  const [encoded, sig] = parts as [string, string];
  if (!safeEqual(sig, signToken(encoded))) {
    return { ok: false, error: "Invalid challenge signature" };
  }
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  const [dom, uh, expStr, rayId] = decoded.split("|");
  const cleanExpDom = normalizeWafDomain(expectedDomain);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!dom || !rayId || Number(expStr) < nowSec) {
    return { ok: false, error: "Challenge expired" };
  }
  if (dom !== cleanExpDom && !cleanExpDom.endsWith(`.${dom}`)) {
    return { ok: false, error: "Domain mismatch" };
  }
  if (uh !== uaHash(ua)) {
    return { ok: false, error: "Browser fingerprint mismatch" };
  }

  const clearExp = nowSec + CLEARANCE_TTL_SEC;
  const clearPayload = Buffer.from(`${dom}|${uh}|${clearExp}|${rayId}`, "utf8").toString("base64url");
  const clearSig = signToken(clearPayload);
  const clearValue = `${clearPayload}.${clearSig}`;

  totalChallengesPassed += 1;
  recordEvent({
    rayId,
    domain: dom,
    ip,
    method: "POST",
    path: "/api/shield/edge-verify",
    action: "VERIFIED",
    rule: "EDGE_CLEARANCE_ISSUED",
    statusCode: 200,
    userAgent: ua,
    severity: "Info",
  });

  const secureAttr = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookieHeader = `${CLEARANCE_COOKIE_NAME}=${encodeURIComponent(clearValue)}; Path=/; Max-Age=${CLEARANCE_TTL_SEC}; HttpOnly; SameSite=Lax${secureAttr}`;
  return { ok: true, cookieHeader, rayId };
}

function hasValidClearanceCookie(request: Request, domain: string, ua: string): boolean {
  const raw = parseCookie(request.headers.get("cookie"), CLEARANCE_COOKIE_NAME);
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts as [string, string];
  if (!safeEqual(sig, signToken(encoded))) return false;
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const [dom, uh, expStr] = decoded.split("|");
    const nowSec = Math.floor(Date.now() / 1000);
    if (!dom || Number(expStr) < nowSec) return false;
    if (dom !== normalizeWafDomain(domain)) return false;
    if (uh !== uaHash(ua)) return false;
    return true;
  } catch {
    return false;
  }
}

function recordEvent(ev: Omit<LiveEdgeEvent, "id" | "timestamp">): LiveEdgeEvent {
  const now = Date.now();
  const entry: LiveEdgeEvent = {
    id: `ev_${now.toString(36)}_${randomBytes(3).toString("hex")}`,
    timestamp: new Date(now).toISOString(),
    ...ev,
  };
  recentEvents.unshift(entry);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.length = MAX_EVENTS;
  }
  totalInspected += 1;
  uniqueIpSet.add(ev.ip);
  if (uniqueIpSet.size > 5000) uniqueIpSet.clear();
  recentTimestamps.push(now);
  const cutoff = now - 60_000;
  while (recentTimestamps.length > 0 && recentTimestamps[0]! < cutoff) {
    recentTimestamps.shift();
  }
  return entry;
}

async function persistLiveWafIncident(params: {
  rayId: string;
  domain: string;
  ip: string;
  path: string;
  rule: string;
  title: string;
  severity: "Critical" | "High" | "Medium";
  action: "BLOCKED" | "MONITOR";
  userAgent: string;
}): Promise<{ id: string; persisted: boolean }> {
  const incId = `INC-${Date.now().toString().slice(-4)}${randomBytes(1).toString("hex").toUpperCase()}`;
  const timeStr = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const pgrstBase = (
    process.env.POSTGREST_INTERNAL_URL ||
    process.env.SPARROWX_DB_REST_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/+$/, "");

  const payload = {
    id: incId,
    title: params.title,
    source: `${params.domain} · Edge WAF (${params.ip})`,
    time: timeStr,
    severity: params.severity,
    status: params.action === "BLOCKED" ? "Open" : "Investigating",
    assignee: "SparrowX Edge WAF",
    summary: `[${params.action}] Rule ${params.rule} triggered on https://${params.domain}${params.path.slice(0, 140)} from ${params.ip} (Ray ID: ${params.rayId}, UA: ${params.userAgent.slice(0, 90)}).`,
    playbook: `Edge WAF ${params.rule} Containment & IP Block`,
    affected_assets: 1,
  };

  let persisted = false;
  try {
    const res = await fetch(`${pgrstBase}/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
    persisted = res.ok;
  } catch {
    persisted = false;
  }

  // Forward high/critical live WAF blocks to Discord telemetry asynchronously
  void import("./discord-webhook.server")
    .then(({ sendDiscordTelemetry }) =>
      sendDiscordTelemetry({
        category: "security",
        severity: params.severity === "Critical" ? "critical" : "high",
        service: "SparrowX Shield Edge WAF",
        title: `${params.title} (${params.domain})`,
        ip: params.ip,
        url: `https://${params.domain}${params.path.slice(0, 120)}`,
        userAgent: params.userAgent,
        fields: {
          Action: params.action,
          Rule: params.rule,
          RayID: params.rayId,
          IncidentID: incId,
        },
      }),
    )
    .catch(() => {});

  return { id: incId, persisted };
}

function renderBlockedHtml(params: {
  domain: string;
  rayId: string;
  rule: string;
  ip: string;
  title: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Access Blocked | SparrowX Shield Edge WAF</title>
<style>
  body{margin:0;min-height:100vh;background:#05060A;color:#F4F6FA;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
  .card{width:100%;max-width:540px;background:#090B11;border:1px solid rgba(249,16,58,.35);border-radius:16px;padding:32px;box-shadow:0 28px 90px rgba(0,0,0,.85)}
  .badge{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:999px;background:rgba(249,16,58,.12);border:1px solid rgba(249,16,58,.4);color:#FF6B84;font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
  h1{margin:18px 0 8px;font-size:22px;line-height:1.25}
  p{margin:0 0 20px;color:#A1A1AA;font-size:14px;line-height:1.6}
  .meta{background:#05060A;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;font:12px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;color:#D4D4D8}
  .meta span{color:#71717A}
  .foot{margin-top:20px;display:flex;justify-content:space-between;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717A}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">SparrowX Shield · Edge WAF Blocked</div>
    <h1>${esc(params.title)}</h1>
    <p>SparrowX Shield blocked this request to <strong style="color:#fff">${esc(params.domain)}</strong> because it matched an active OWASP / DDoS security policy. This event has been streamed to the Autonomous SOC Workbench.</p>
    <div class="meta">
      <div><span>Ray ID :</span> ${esc(params.rayId)}</div>
      <div><span>Rule   :</span> ${esc(params.rule)}</div>
      <div><span>IP     :</span> ${esc(params.ip)}</div>
      <div><span>Status :</span> 403 Forbidden (WAF Enforced)</div>
    </div>
    <div class="foot"><span>Protected by SparrowX Shield</span><span>OVH Edge WAF</span></div>
  </div>
</body>
</html>`;
}

function renderEdgeCheckingHtml(params: {
  domain: string;
  rayId: string;
  challengeToken: string;
  nextUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const jsToken = JSON.stringify(params.challengeToken);
  const jsDomain = JSON.stringify(params.domain);
  const jsNext = JSON.stringify(params.nextUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>Just a moment... | ${esc(params.domain)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:#05060A;color:#F4F6FA;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:520px;background:#090B11;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:30px;box-shadow:0 28px 90px rgba(0,0,0,.85)}
  .top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}
  .brand{display:flex;align-items:center;gap:12px}
  .logo{width:42px;height:42px;border-radius:12px;background:rgba(249,16,58,.12);border:1px solid rgba(249,16,58,.35);display:grid;place-items:center;font-weight:800;color:#FF6B84;font-size:18px}
  .kicker{font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em;text-transform:uppercase;color:#A1A1AA}
  .dom{font:600 15px ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;margin-top:2px}
  .tls{padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#10B981;font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace}
  h1{margin:0 0 8px;font-size:21px;letter-spacing:-.02em}
  p{margin:0 0 22px;color:#A1A1AA;font-size:13.5px;line-height:1.55}
  .box{display:flex;align-items:center;gap:14px;padding:15px 16px;border-radius:12px;background:#05060A;border:1px solid rgba(255,255,255,.08)}
  .spin{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(16,185,129,.22);border-top-color:#10B981;animation:sp .8s linear infinite;flex-shrink:0}
  @keyframes sp{to{transform:rotate(360deg)}}
  .ok{width:22px;height:22px;border-radius:50%;background:rgba(16,185,129,.2);color:#10B981;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0}
  .st{font-size:13.5px;font-weight:600;color:#fff}
  .sub{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717A;margin-top:2px}
  .bar{height:5px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:16px}
  .fill{height:100%;width:28%;background:linear-gradient(90deg,#F9103A,#10B981);transition:width .45s ease}
  .foot{margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717A}
</style>
</head>
<body>
  <div class="card">
    <div class="top">
      <div class="brand">
        <div class="logo">S</div>
        <div>
          <div class="kicker">SparrowX Shield · Edge Verification</div>
          <div class="dom">${esc(params.domain)}</div>
        </div>
      </div>
      <div class="tls">TLS 1.3 · WAF</div>
    </div>
    <h1>Checking if the site connection is secure</h1>
    <p><strong style="color:#E4E4E7">${esc(params.domain)}</strong> needs to review the security of your browser connection before proceeding.</p>
    <div class="box">
      <div id="ico" class="spin"></div>
      <div>
        <div id="st" class="st">Inspecting browser integrity &amp; edge route...</div>
        <div id="sub" class="sub">SparrowX Shield L7 anti-bot verification</div>
      </div>
    </div>
    <div class="bar"><div id="fill" class="fill"></div></div>
    <div class="foot"><span>Ray ID: ${esc(params.rayId)}</span><span>Protected by SparrowX Shield</span></div>
  </div>
  <noscript><p style="color:#FF6B84;text-align:center;margin-top:16px">Please enable JavaScript to pass SparrowX Shield security verification.</p></noscript>
  <script>
  (function(){
    var st = document.getElementById('st');
    var sub = document.getElementById('sub');
    var fill = document.getElementById('fill');
    var ico = document.getElementById('ico');
    setTimeout(function(){
      fill.style.width = '68%';
      st.textContent = 'Verifying clearance token with SparrowX Edge...';
      sub.textContent = 'Binding 30-minute signed session clearance';
      fetch('/api/shield/edge-verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ${jsToken}, domain: ${jsDomain} })
      }).then(function(r){ return r.json(); }).then(function(data){
        if (data && data.ok) {
          fill.style.width = '100%';
          ico.className = 'ok';
          ico.textContent = '✓';
          st.textContent = 'Connection verified — routing to origin';
          sub.textContent = 'Clearance issued · Redirecting now...';
          setTimeout(function(){ window.location.replace(${jsNext}); }, 350);
        } else {
          st.textContent = 'Verification retry required';
          sub.textContent = (data && data.error) ? data.error : 'Reloading challenge...';
          setTimeout(function(){ window.location.reload(); }, 1200);
        }
      }).catch(function(){
        setTimeout(function(){ window.location.reload(); }, 1200);
      });
    }, 550);
  })();
  </script>
</body>
</html>`;
}

export async function handleLiveEdgeWaf(request: Request): Promise<EdgeWafGateResult> {
  const url = new URL(request.url);
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.hostname;

  const pathname = url.pathname;
  // Never interfere with APIs, PostgREST, assets, serverFns, health checks, or ACME
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/rest/") ||
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/logos/") ||
    pathname.startsWith("/3d/") ||
    pathname.startsWith("/xdp/") ||
    pathname.startsWith("/.well-known/") ||
    pathname === "/health" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/llms.txt" ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|map|txt|xml|json)$/i.test(pathname)
  ) {
    return { rayId: makeRayId(), edgeStatus: "BYPASS", wafMode: "balanced" };
  }

  await syncConnectedTenantsFromDb();
  const policy = isProtectedWafHost(rawHost);
  if (!policy) {
    return { rayId: makeRayId(), edgeStatus: "BYPASS", wafMode: "balanced" };
  }

  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "";
  const fullTarget = `${pathname}${url.search}`;
  const rayId = makeRayId();

  // 1. Per-IP burst rate limit check (120 req / 15s)
  const now = Date.now();
  const rlKey = `${policy.domain}:${ip}`;
  const curWin = ipHitWindows.get(rlKey);
  if (!curWin || now - curWin.windowStart > 15_000) {
    ipHitWindows.set(rlKey, { count: 1, windowStart: now });
  } else {
    curWin.count += 1;
    const burstThreshold = policy.wafMode === "strict" ? 60 : 120;
    if (curWin.count > burstThreshold) {
      const action: "BLOCKED" | "MONITOR" = policy.wafMode === "monitor" ? "MONITOR" : "BLOCKED";
      if (action === "BLOCKED") totalBlocked += 1;
      recordEvent({
        rayId,
        domain: policy.domain,
        ip,
        method: request.method,
        path: fullTarget.slice(0, 180),
        action,
        rule: "SPX-RATE-LIMIT",
        statusCode: action === "BLOCKED" ? 429 : 200,
        userAgent: ua.slice(0, 120),
        severity: "High",
      });
      if (curWin.count === burstThreshold + 1) {
        void persistLiveWafIncident({
          rayId,
          domain: policy.domain,
          ip,
          path: fullTarget,
          rule: "SPX-RATE-LIMIT",
          title: "HTTP Request Flood Rate-Limited at Edge",
          severity: "High",
          action,
          userAgent: ua,
        });
      }
      if (action === "BLOCKED") {
        return {
          rayId,
          edgeStatus: "BLOCKED",
          wafMode: policy.wafMode,
          response: new Response(
            renderBlockedHtml({
              domain: policy.domain,
              rayId,
              rule: "SPX-RATE-LIMIT",
              ip,
              title: "Too Many Requests — Rate Limited",
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Retry-After": "15",
                "Cache-Control": "no-store",
                "X-SparrowX-WAF": "BLOCKED",
                "X-SparrowX-Rule": "SPX-RATE-LIMIT",
                "X-SparrowX-Ray": rayId,
              },
            },
          ),
        };
      }
    }
  }

  // 2. Real L7 OWASP / SQLi / XSS / LFI / Scanner signature inspection
  let decodedTarget = fullTarget;
  try {
    decodedTarget = decodeURIComponent(fullTarget);
  } catch {
    decodedTarget = fullTarget;
  }

  for (const sig of WAF_SIGNATURES) {
    const matched =
      (sig.target === "url" && (sig.pattern.test(fullTarget) || sig.pattern.test(decodedTarget))) ||
      (sig.target === "ua" && sig.pattern.test(ua)) ||
      (sig.target === "both" && (sig.pattern.test(decodedTarget) || sig.pattern.test(ua)));

    if (matched) {
      const action: "BLOCKED" | "MONITOR" = policy.wafMode === "monitor" ? "MONITOR" : "BLOCKED";
      if (action === "BLOCKED") totalBlocked += 1;

      recordEvent({
        rayId,
        domain: policy.domain,
        ip,
        method: request.method,
        path: fullTarget.slice(0, 180),
        action,
        rule: sig.rule,
        statusCode: action === "BLOCKED" ? 403 : 200,
        userAgent: ua.slice(0, 120),
        severity: sig.severity,
      });

      void persistLiveWafIncident({
        rayId,
        domain: policy.domain,
        ip,
        path: fullTarget,
        rule: sig.rule,
        title: sig.title,
        severity: sig.severity,
        action,
        userAgent: ua,
      });

      if (action === "BLOCKED") {
        const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
        const body = acceptsHtml
          ? renderBlockedHtml({
              domain: policy.domain,
              rayId,
              rule: sig.rule,
              ip,
              title: sig.title,
            })
          : JSON.stringify({
              ok: false,
              blocked: true,
              service: "SparrowX Shield Edge WAF",
              rule: sig.rule,
              rayId,
              domain: policy.domain,
            });
        return {
          rayId,
          edgeStatus: "BLOCKED",
          wafMode: policy.wafMode,
          response: new Response(body, {
            status: 403,
            headers: {
              "Content-Type": acceptsHtml ? "text/html; charset=utf-8" : "application/json",
              "Cache-Control": "no-store",
              "X-SparrowX-WAF": "BLOCKED",
              "X-SparrowX-Rule": sig.rule,
              "X-SparrowX-Ray": rayId,
            },
          }),
        };
      }
      break;
    }
  }

  // 3. Real Edge Browser Checking Gate (HTML browser GET without clearance cookie)
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  const isGoodBot = GOOD_BOT_UA_RE.test(ua);
  const needsCheck =
    policy.edgeCheckEnabled &&
    request.method === "GET" &&
    acceptsHtml &&
    !isGoodBot &&
    !hasValidClearanceCookie(request, policy.domain, ua);

  if (needsCheck) {
    const { token, rayId: challengeRay } = createEdgeChallengeToken(policy.domain, ua);
    totalChallengesIssued += 1;
    recordEvent({
      rayId: challengeRay,
      domain: policy.domain,
      ip,
      method: request.method,
      path: fullTarget.slice(0, 180),
      action: "CHALLENGE",
      rule: "EDGE_BROWSER_CHECK",
      statusCode: 200,
      userAgent: ua.slice(0, 120),
      severity: "Info",
    });

    const nextUrl = `${pathname}${url.search}`;
    return {
      rayId: challengeRay,
      edgeStatus: "CHALLENGE",
      wafMode: policy.wafMode,
      response: new Response(
        renderEdgeCheckingHtml({
          domain: policy.domain,
          rayId: challengeRay,
          challengeToken: token,
          nextUrl,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-SparrowX-WAF": "CHALLENGE",
            "X-SparrowX-Edge-Status": "CHALLENGE",
            "X-SparrowX-Ray": challengeRay,
          },
        },
      ),
    };
  }

  // 4. Clean verified request -> record live telemetry and let origin serve
  recordEvent({
    rayId,
    domain: policy.domain,
    ip,
    method: request.method,
    path: fullTarget.slice(0, 180),
    action: "ALLOW",
    rule: policy.edgeCheckEnabled ? "EDGE_CLEARANCE_OK" : "WAF_INSPECTED_OK",
    statusCode: 200,
    userAgent: ua.slice(0, 120),
    severity: "Info",
  });

  return {
    rayId,
    edgeStatus: "ALLOW",
    wafMode: policy.wafMode,
  };
}

export async function runLiveWafTestProbe(params: {
  domain: string;
  ip: string;
  userAgent: string;
}): Promise<{ rayId: string; incidentId: string; persisted: boolean; event: LiveEdgeEvent }> {
  const dom = normalizeWafDomain(params.domain) || "sparrowx.net";
  const policy = upsertDomainWafPolicy({ domain: dom });
  const rayId = makeRayId();
  const action: "BLOCKED" | "MONITOR" = policy.wafMode === "monitor" ? "MONITOR" : "BLOCKED";
  if (action === "BLOCKED") totalBlocked += 1;

  const event = recordEvent({
    rayId,
    domain: dom,
    ip: params.ip,
    method: "GET",
    path: "/?spx_waf_test=1&id=1' OR 1=1--",
    action,
    rule: "OWASP-SQLI-942",
    statusCode: action === "BLOCKED" ? 403 : 200,
    userAgent: params.userAgent.slice(0, 120),
    severity: "Critical",
  });

  const inc = await persistLiveWafIncident({
    rayId,
    domain: dom,
    ip: params.ip,
    path: "/?spx_waf_test=1&id=1' OR 1=1--",
    rule: "OWASP-SQLI-942",
    title: "SQL Injection Payload Blocked at Edge WAF (Live Probe)",
    severity: "Critical",
    action,
    userAgent: params.userAgent,
  });

  return { rayId, incidentId: inc.id, persisted: inc.persisted, event };
}

function toPublicPolicy(p: DomainWafPolicy): PublicDomainWafPolicy {
  return {
    domain: p.domain,
    wafMode: p.wafMode,
    edgeCheckEnabled: p.edgeCheckEnabled,
    hasSensorKey: Boolean(p.sensorKey),
    updatedAt: p.updatedAt,
  };
}

export async function getLiveWafTelemetry(rawDomain?: string | null): Promise<LiveEdgeTelemetrySnapshot> {
  await syncConnectedTenantsFromDb();
  const cleanDom = normalizeWafDomain(rawDomain);
  const connected = Array.from(policiesMap.values());
  const policy =
    (cleanDom && policiesMap.get(cleanDom)) ||
    connected[0] || {
      domain: cleanDom || "sparrowx.net",
      wafMode: "balanced" as const,
      edgeCheckEnabled: true,
      updatedAt: new Date().toISOString(),
    };

  const now = Date.now();
  const cutoff = now - 60_000;
  while (recentTimestamps.length > 0 && recentTimestamps[0]! < cutoff) {
    recentTimestamps.shift();
  }

  const scopedEvents = cleanDom
    ? recentEvents.filter((e) => e.domain === cleanDom)
    : recentEvents;

  return {
    ok: true,
    domain: cleanDom || policy.domain,
    domainProtected: Boolean(cleanDom ? policiesMap.has(cleanDom) : connected.length > 0),
    policy: toPublicPolicy(policy),
    connectedDomains: connected.map(toPublicPolicy),
    uptimeSec: Math.floor((now - BOOT_TS) / 1000),
    totalInspected: cleanDom ? scopedEvents.length : totalInspected,
    requestsPerMin: recentTimestamps.length,
    blockedCount: cleanDom
      ? scopedEvents.filter((e) => e.action === "BLOCKED").length
      : totalBlocked,
    challengesIssued: cleanDom
      ? scopedEvents.filter((e) => e.action === "CHALLENGE").length
      : totalChallengesIssued,
    challengesPassed: cleanDom
      ? scopedEvents.filter((e) => e.action === "VERIFIED").length
      : totalChallengesPassed,
    uniqueIps: cleanDom
      ? new Set(scopedEvents.map((e) => e.ip)).size
      : uniqueIpSet.size,
    lastEventAt: scopedEvents[0]?.timestamp ?? null,
    recentEvents: scopedEvents.slice(0, 40),
  };
}
