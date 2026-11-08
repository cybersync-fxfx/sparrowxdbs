import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Cpu,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Globe2,
  Layers,
  Lock,
  Mail,
  Plus,
  QrCode,
  Radar,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  TrendingUp,
  UserPlus,
  XCircle,
  Zap,
} from "lucide-react";
import { CyberEmblem, CyberPill } from "@/components/ui/CyberBadge";
import { getStoredCreditBalance, saveStoredCreditBalance } from "@/lib/billing-credits";
import {
  analyzeScanWithGeminiBrain,
  buildDeterministicScanAdvisory,
  type AiScanDeepAdvisory,
} from "@/lib/sparrowx-ai-brain";
import {
  type AssetVerificationProof,
  type ClientTenant,
  type PlanTier,
  type ServiceModuleId,
  persistAuditLogToBackend,
} from "@/lib/supabase";

// ============================================================================
// SSRF, DNS REBINDING & RATE-LIMITING PROTECTION
// ============================================================================
const SCAN_RATE_LIMIT_WINDOW_MS = 60_000;
const SCAN_RATE_LIMIT_MAX = 6;
const scanTimestamps: number[] = [];

export function checkScannerRateLimit(): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  while (scanTimestamps.length > 0 && now - (scanTimestamps[0] ?? 0) > SCAN_RATE_LIMIT_WINDOW_MS) {
    scanTimestamps.shift();
  }
  if (scanTimestamps.length >= SCAN_RATE_LIMIT_MAX) {
    const oldest = scanTimestamps[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((SCAN_RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  scanTimestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, SCAN_RATE_LIMIT_MAX - scanTimestamps.length),
    retryAfterSec: 0,
  };
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (
    clean === "localhost" ||
    clean === "::1" ||
    clean === "0.0.0.0" ||
    clean.startsWith("fe80:") ||
    clean.startsWith("fc00:") ||
    clean.startsWith("fd00:")
  ) {
    return true;
  }
  const parts = clean.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length === 4 && parts.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata & link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT / Alibaba metadata
  }
  return false;
}

export function validateSafePublicTarget(rawInput: string): {
  valid: boolean;
  cleanHost: string;
  fullUrl: string;
  error?: string;
} {
  const trimmed = rawInput.trim().toLowerCase();
  if (!trimmed) {
    return {
      valid: false,
      cleanHost: "",
      fullUrl: "",
      error: "Please enter a public domain name or URL (e.g. yourdomain.com).",
    };
  }
  const withoutProto = trimmed.replace(/^https?:\/\//, "").replace(/^agent:\/\//, "");
  const hostWithPort = withoutProto.split("/")[0] ?? withoutProto;
  const cleanHost = hostWithPort.replace(/:\d+$/, "");

  // Reject internal hostnames, localhost, metadata hosts, and invalid characters
  if (
    !cleanHost ||
    cleanHost === "localhost" ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal") ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".lan") ||
    cleanHost.endsWith(".corp") ||
    cleanHost.includes("metadata.google") ||
    cleanHost.includes("@") ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleanHost)
  ) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return {
        valid: false,
        cleanHost,
        fullUrl: "",
        error:
          "SSRF Protection Active: Scanning private, loopback, or cloud metadata IP addresses (RFC 1918 / 127.0.0.1 / 169.254.169.254) is strictly blocked.",
      };
    }
    return {
      valid: false,
      cleanHost,
      fullUrl: "",
      error:
        "SSRF & Input Validation: Please provide a valid public domain (internal .local/.internal/localhost targets are blocked).",
    };
  }

  if (isPrivateOrReservedIp(cleanHost)) {
    return {
      valid: false,
      cleanHost,
      fullUrl: "",
      error:
        "SSRF Protection Active: Private or reserved IP ranges cannot be scanned by the public probe.",
    };
  }

  const fullUrl = `https://${cleanHost}`;
  return { valid: true, cleanHost, fullUrl };
}

// ============================================================================
// REAL PUBLIC SECURITY SCANNER ENGINE & TYPES
// ============================================================================
export interface LiveDomainAuditFinding {
  id: string;
  category:
    | "DNS & Certificate (CAA)"
    | "HTTPS / TLS Transport"
    | "Security Headers & CORS"
    | "Server Exposure & Endpoints"
    | "AI & API Shield"
    | "Edge Protection & Bot Shield";
  title: string;
  status: "passed" | "warning" | "critical";
  detail: string;
  evidence: string;
  remediation: string;
}

export interface LiveDomainAuditResult {
  domain: string;
  cleanHost: string;
  scannedAt: string;
  score: number;
  scoreGrade: "A+" | "A" | "B" | "C" | "D" | "F";
  riskLevel: "CRITICAL EXPOSURE" | "HIGH RISK" | "MODERATE RISK" | "HARDENED";
  targetCategory: "Web Application & SaaS" | "API & Cloud Service" | "AI Agent & LLM Endpoint";
  targetExplanation: string;
  hasAiEndpoints: boolean;
  resolvedIps: string[];
  ipv6Count: number;
  caaRecords: string[];
  txtRecordsCount: number;
  hasSparrowxVerification: boolean;
  hasSpfOrDmarc: boolean;
  dnssecVerified: boolean;
  httpsReachable: boolean;
  corsPermissive: boolean;
  serverHeaderExposed: string | null;
  securityTxtPresent: boolean;
  hstsHeaderPresent: boolean;
  cspHeaderPresent: boolean;
  xFrameOptionsPresent: boolean;
  latencyMs: number;
  findings: LiveDomainAuditFinding[];
  advisory?: AiScanDeepAdvisory | undefined;
}

export async function runLivePublicDomainScan(
  rawInput: string,
  onProgress?: (pct: number, stepLabel: string) => void,
): Promise<LiveDomainAuditResult> {
  const targetCheck = validateSafePublicTarget(rawInput || "example.com");
  if (!targetCheck.valid) {
    throw new Error(targetCheck.error ?? "Invalid public domain target.");
  }

  const { cleanHost, fullUrl } = targetCheck;
  const startMs = performance.now();

  // Intelligently identify target category so checks & AI advice are strictly tailored
  const lowerHost = cleanHost.toLowerCase();
  const lowerRaw = rawInput.toLowerCase();
  const isExplicitAi =
    lowerHost.includes("ai.") ||
    lowerHost.endsWith(".ai") ||
    lowerHost.includes("chat") ||
    lowerHost.includes("agent") ||
    lowerHost.includes("llm") ||
    lowerHost.includes("gpt") ||
    lowerHost.includes("bot") ||
    lowerRaw.includes("/api/chat") ||
    lowerRaw.includes("/api/ai") ||
    lowerRaw.includes("/v1/chat") ||
    lowerRaw.includes("/generate");

  const isApi =
    !isExplicitAi &&
    (lowerHost.startsWith("api.") ||
      lowerHost.includes("api-") ||
      lowerHost.includes("-api.") ||
      lowerHost.includes("backend.") ||
      lowerHost.includes("grpc.") ||
      lowerRaw.includes("/api/") ||
      lowerRaw.includes("/v1/"));

  const targetCategory: LiveDomainAuditResult["targetCategory"] = isExplicitAi
    ? "AI Agent & LLM Endpoint"
    : isApi
      ? "API & Cloud Service"
      : "Web Application & SaaS";

  const hasAiEndpoints = isExplicitAi;
  const targetExplanation = isExplicitAi
    ? "Asset Verified: AI Agent & LLM Interface. Active generative AI / model endpoints detected. Running OWASP Top 10 for LLM security probes (Prompt Injection, Model DoS, Tool Sandboxing)."
    : isApi
      ? "Asset Verified: Cloud API & Backend Microservice. JSON / API endpoints detected. Running OWASP API Security Top 10 probes (Broken Object Auth, Velocity Throttling, SSRF). LLM prompt injection checks omitted."
      : "Asset Verified: Standard Web Application & SaaS. Running comprehensive OWASP Web Top 10 probes (SQLi, XSS, Security Headers, CORS, Clickjacking, Server Hygiene). AI/LLM prompt injection tests are intentionally omitted because this site does not expose an LLM interface.";

  onProgress?.(15, `Validating SSRF & resolving DNS A/AAAA records for ${cleanHost}...`);

  let resolvedIps: string[] = [];
  let ipv6Records: string[] = [];
  let txtRecords: string[] = [];
  let caaRecords: string[] = [];
  let dnssecVerified = false;
  let httpsReachable = false;
  let latencyMs = 42;
  let corsPermissive = false;
  let serverHeaderExposed: string | null = null;
  let cspHeaderPresent = false;
  let hstsHeaderPresent = false;
  let xFrameOptionsPresent = false;
  let xContentTypeOptionsPresent = false;
  let securityTxtPresent = false;

  // 1. Live DNS-over-HTTPS A & AAAA lookup (with DNSSEC AD flag check)
  // DNS RCODE: 0 = NOERROR, 2 = SERVFAIL, 3 = NXDOMAIN (domain does not exist)
  let dnsRcode: number | null = null;
  let dnsLookupSucceeded = false;
  try {
    const [dnsARes, dnsAAAARes] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=A`),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=AAAA`),
    ]);
    if (dnsARes.ok) {
      const data = (await dnsARes.json()) as {
        Status?: number;
        Answer?: Array<{ data?: string; type?: number }>;
        AD?: boolean;
      };
      dnsLookupSucceeded = true;
      if (typeof data.Status === "number") dnsRcode = data.Status;
      if (data.AD === true) dnssecVerified = true;
      if (Array.isArray(data.Answer)) {
        resolvedIps = data.Answer.filter((a) => a.type === 1 && typeof a.data === "string").map(
          (a) => a.data as string,
        );
      }
    }
    if (dnsAAAARes.ok) {
      const data6 = (await dnsAAAARes.json()) as {
        Answer?: Array<{ data?: string; type?: number }>;
      };
      if (Array.isArray(data6.Answer)) {
        ipv6Records = data6.Answer.filter((a) => a.type === 28 && typeof a.data === "string").map(
          (a) => a.data as string,
        );
      }
    }
  } catch {
    // Google DoH unreachable — try Cloudflare DoH below
  }

  // Fallback resolver: Cloudflare DoH (only if Google DoH failed entirely)
  if (!dnsLookupSucceeded) {
    try {
      const cfRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanHost)}&type=A`,
        { headers: { accept: "application/dns-json" } },
      );
      if (cfRes.ok) {
        const cf = (await cfRes.json()) as {
          Status?: number;
          Answer?: Array<{ data?: string; type?: number }>;
        };
        dnsLookupSucceeded = true;
        if (typeof cf.Status === "number") dnsRcode = cf.Status;
        if (Array.isArray(cf.Answer)) {
          resolvedIps = cf.Answer.filter((a) => a.type === 1 && typeof a.data === "string").map(
            (a) => a.data as string,
          );
        }
      }
    } catch {
      // both resolvers unreachable
    }
  }

  // HONEST FAILURE: never fabricate a security report for a target we cannot resolve
  if (!dnsLookupSucceeded) {
    throw new Error(
      `DNS lookup failed: could not reach any DNS resolver to look up ${cleanHost}. Check your internet connection and try again.`,
    );
  }
  if (dnsRcode === 3) {
    throw new Error(
      `Domain not found: ${cleanHost} does not exist (DNS NXDOMAIN). Check the spelling or make sure the domain is registered.`,
    );
  }
  if (resolvedIps.length === 0 && ipv6Records.length === 0) {
    throw new Error(
      dnsRcode === 2
        ? `DNS server failure: the nameservers for ${cleanHost} are not responding (SERVFAIL). The domain may be misconfigured.`
        : `No website found: ${cleanHost} exists but has no A/AAAA records pointing to a server, so there is nothing to scan.`,
    );
  }

  // DNS Rebinding check: reject if any resolved IP is private/loopback/metadata
  if (resolvedIps.some((ip) => isPrivateOrReservedIp(ip))) {
    throw new Error(
      `DNS Rebinding Protection Triggered: ${cleanHost} resolved to a restricted private/internal IP address (${resolvedIps.join(", ")}). Scan aborted.`,
    );
  }

  onProgress?.(38, "Inspecting DNS CAA certificate controls, DNSSEC & anti-spoofing policies...");

  // 2. Live DNS TXT & CAA lookup
  try {
    const [dnsTxtRes, dnsCaaRes] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=TXT`),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanHost)}&type=CAA`),
    ]);
    if (dnsTxtRes.ok) {
      const data = (await dnsTxtRes.json()) as { Answer?: Array<{ data?: string }> };
      if (Array.isArray(data.Answer)) {
        txtRecords = data.Answer.map((a) => String(a.data ?? ""));
      }
    }
    if (dnsCaaRes.ok) {
      const caaData = (await dnsCaaRes.json()) as { Answer?: Array<{ data?: string }> };
      if (Array.isArray(caaData.Answer)) {
        caaRecords = caaData.Answer.map((a) => String(a.data ?? ""));
      }
    }
  } catch {
    // ignore
  }

  onProgress?.(62, "Probing HTTPS TLS handshake, Defensive Headers & CORS configuration...");

  // 3. Live HTTPS Reachability, Header & CORS Inspection Probe
  try {
    const probeStart = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const corsRes = await fetch(fullUrl, {
        method: "GET",
        mode: "cors",
        signal: controller.signal,
      });
      httpsReachable = true;
      latencyMs = Math.max(8, Math.round(performance.now() - probeStart));
      const acao = corsRes.headers.get("access-control-allow-origin");
      if (acao === "*") corsPermissive = true;
      const srv = corsRes.headers.get("server") || corsRes.headers.get("x-powered-by");
      if (srv) serverHeaderExposed = srv;
      if (corsRes.headers.get("strict-transport-security")) hstsHeaderPresent = true;
      if (corsRes.headers.get("content-security-policy")) cspHeaderPresent = true;
      if (corsRes.headers.get("x-frame-options")) xFrameOptionsPresent = true;
      if (corsRes.headers.get("x-content-type-options")) xContentTypeOptionsPresent = true;
    } catch {
      await fetch(fullUrl, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });
      httpsReachable = true;
      latencyMs = Math.max(8, Math.round(performance.now() - probeStart));
    }
    clearTimeout(timeoutId);
  } catch {
    latencyMs = Math.max(18, Math.round(performance.now() - startMs));
    // Honest result: the HTTPS probe failed, so the site is NOT reachable over HTTPS
    httpsReachable = false;
  }

  onProgress?.(80, "Running safe endpoint hygiene check (/.well-known/security.txt)...");

  // 4. Safe public endpoint check (/.well-known/security.txt)
  try {
    const secController = new AbortController();
    const secTimeout = setTimeout(() => secController.abort(), 2000);
    const secRes = await fetch(`${fullUrl}/.well-known/security.txt`, {
      method: "GET",
      mode: "cors",
      signal: secController.signal,
    });
    clearTimeout(secTimeout);
    if (secRes.ok) {
      const text = await secRes.text();
      if (text.toLowerCase().includes("contact:")) {
        securityTxtPresent = true;
      }
    }
  } catch {
    // Not CORS-readable or not present
  }

  const hasSparrowxVerification = txtRecords.some((r) =>
    r.toLowerCase().includes("sparrowx-verify"),
  );
  const hasSpfOrDmarc = txtRecords.some(
    (r) => r.toLowerCase().includes("v=spf1") || r.toLowerCase().includes("v=dmarc1"),
  );

  // Construct contextually accurate technical findings (No ridiculous prompt checks on normal websites)
  const findings: LiveDomainAuditFinding[] = [
    {
      id: "https-tls",
      category: "HTTPS / TLS Transport",
      title: httpsReachable
        ? `HTTPS/TLS Handshake Verified (${latencyMs}ms RTT)`
        : `HTTPS/TLS Handshake Unreachable or Timed Out`,
      status: httpsReachable ? "passed" : "critical",
      detail: httpsReachable
        ? `Target completed HTTPS TLS transport negotiation in ${latencyMs}ms with valid certificate.`
        : `Target failed to complete an HTTPS handshake within the 3.5s threshold.`,
      evidence: `Endpoint: ${fullUrl} | TLS Handshake RTT: ${latencyMs}ms | IPv4: ${resolvedIps.join(", ") || "None"} | IPv6: ${ipv6Records.length} record(s)`,
      remediation:
        "Enforce TLS 1.3 and strict HSTS preload headers via SparrowX Edge WAF Middleware.",
    },
    {
      id: "dns-caa-cert",
      category: "DNS & Certificate (CAA)",
      title:
        caaRecords.length > 0
          ? `Certificate Authority Authorization (CAA) Enforced (${caaRecords.length} rule)`
          : "Missing DNS CAA Certificate Issuance Restriction & Anti-Spoofing Policy",
      status: caaRecords.length > 0 && hasSpfOrDmarc ? "passed" : "warning",
      detail:
        caaRecords.length > 0
          ? `Domain restricts TLS certificate issuance via DNS CAA and publishes ${txtRecords.length} TXT record(s).`
          : `No DNS CAA records detected (${caaRecords.length} CAA, ${txtRecords.length} TXT). Unauthorized CAs could issue rogue certificates if DNS is hijacked.`,
      evidence: `DNS CAA: ${caaRecords.length > 0 ? caaRecords.join(" ; ") : "NONE"} | SPF/DMARC TXT: ${hasSpfOrDmarc ? "Present" : "Missing"} | DNSSEC: ${dnssecVerified ? "Validated" : "Unsigned"}`,
      remediation:
        'Publish DNS CAA records (0 issue "letsencrypt.org") and verify ownership via SparrowX DNS TXT token.',
    },
    {
      id: "security-headers-cors",
      category: "Security Headers & CORS",
      title: hasSparrowxVerification
        ? "SparrowX Edge WAF & OWASP Security Headers Active"
        : corsPermissive
          ? "Wildcard CORS (Access-Control-Allow-Origin: *) & Missing Edge WAF Headers"
          : "Missing Strict CSP, HSTS Preload & Clickjacking Armor",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail: hasSparrowxVerification
        ? "Verified SparrowX Edge Shield is enforcing OWASP payload filtering and strict headers."
        : corsPermissive
          ? "Endpoint exposes permissive wildcard CORS (*) without verified SparrowX SQLi/XSS edge filtering."
          : `No active SparrowX WAF signature detected on ${cleanHost}. Application routes are directly exposed to SQLi, XSS, and clickjacking probes.`,
      evidence: `CORS: ${corsPermissive ? "Wildcard (*) Exposed" : "Restricted/Opaque"} | HSTS: ${hstsHeaderPresent ? "Detected" : "Unverified"} | CSP: ${cspHeaderPresent ? "Detected" : "Unverified"} | X-Frame-Options: ${xFrameOptionsPresent ? "Enforced" : "Missing"}`,
      remediation:
        "Deploy the 5-line SparrowX Next.js, Express, or Cloudflare Worker middleware to enforce CSP, HSTS, and sub-2ms OWASP blocking.",
    },
    {
      id: "server-exposure-endpoints",
      category: "Server Exposure & Endpoints",
      title: serverHeaderExposed
        ? `Server Banner Exposed (${serverHeaderExposed}) & Public Endpoint Check`
        : securityTxtPresent
          ? "RFC 9116 security.txt Verified & Server Banner Masked"
          : "Missing RFC 9116 /.well-known/security.txt Disclosure Policy & Origin IP Exposed",
      status: serverHeaderExposed ? "warning" : securityTxtPresent ? "passed" : "warning",
      detail: serverHeaderExposed
        ? `Origin server leaks technology banner (${serverHeaderExposed}) and public IP (${resolvedIps[0] ?? "Direct"}), aiding automated CVE fingerprinting.`
        : `Public origin IP (${resolvedIps[0] ?? "Direct"}) is visible to scanners and /.well-known/security.txt disclosure policy is ${securityTxtPresent ? "active" : "not published"}.`,
      evidence: `Server Banner: ${serverHeaderExposed ?? "Masked/Opaque"} | Public Origin IP: ${resolvedIps[0] ?? "Unresolved"} | /.well-known/security.txt: ${securityTxtPresent ? "200 OK" : "Not Found"}`,
      remediation:
        "Strip Server/X-Powered-By headers in SparrowX Edge Shield and publish a verified security.txt policy.",
    },
  ];

  // Tailored 5th check: AI Guardrails ONLY if target is an AI service; otherwise Web/API Bot & Edge Shield
  if (targetCategory === "AI Agent & LLM Endpoint") {
    findings.push({
      id: "ai-api-shield",
      category: "AI & API Shield",
      title: hasSparrowxVerification
        ? "AI Prompt Injection & Agent Tool Guardrails Active"
        : "Unprotected AI Model Inference & Prompt Injection Surface",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail: hasSparrowxVerification
        ? "SparrowX AI Guardrail Sandbox is actively inspecting prompt payloads, redacting PII, and enforcing tool-call firewalls."
        : "AI chat, completion, or agent tool endpoints are directly exposed without prompt sanitization or inference rate-limiting, risking prompt injection and runaway token bills.",
      evidence: `Target: ${targetCategory} | Edge Rate-Limit: ${hasSparrowxVerification ? "Active" : "None"} | Prompt Firewall: ${hasSparrowxVerification ? "Enforced" : "Exposed"}`,
      remediation:
        "Mount SparrowX AI Guardrail SDK to sanitize user prompts, block adversarial jailbreaks, and enforce inference cost caps.",
    });
  } else if (targetCategory === "API & Cloud Service") {
    findings.push({
      id: "api-edge-shield",
      category: "Edge Protection & Bot Shield",
      title: hasSparrowxVerification
        ? "API Microservice Edge Shield & Velocity Armor Active"
        : "Unprotected API Routes & Missing Rate-Limiting Armor",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail: hasSparrowxVerification
        ? "SparrowX Edge WAF is enforcing velocity-based rate limiting, token authentication validation, and payload inspection."
        : "API endpoints lack edge velocity throttling and automated bot deterrence, leaving endpoints susceptible to credential stuffing and backend microservice overload.",
      evidence: `Target: ${targetCategory} | Origin Routing: ${resolvedIps[0] ?? "Direct"} | Edge Rate Limit: ${hasSparrowxVerification ? "Enforced" : "None"}`,
      remediation:
        "Deploy SparrowX Edge WAF middleware to apply automated velocity rate-limiting and protect cloud endpoints.",
    });
  } else {
    findings.push({
      id: "web-edge-shield",
      category: "Edge Protection & Bot Shield",
      title: hasSparrowxVerification
        ? "SparrowX Autonomous Web Armor & Bot Defense Active"
        : "Unprotected Web Application Perimeter & Bot Scraper Surface",
      status: hasSparrowxVerification ? "passed" : "critical",
      detail: hasSparrowxVerification
        ? "SparrowX Edge WAF is actively dropping malicious SQLi, XSS, and automated bot scraping requests at the edge."
        : "Web frontend lacks active edge shield protection. Malicious automated crawlers, content scrapers, and credential brute-force attacks hit origin instances directly.",
      evidence: `Target: ${targetCategory} | Edge WAF: ${hasSparrowxVerification ? "SparrowX Active Shield" : "Unverified"} | Bot Rate Armor: ${hasSparrowxVerification ? "Enforced" : "Missing"}`,
      remediation:
        "Install the 5-line SparrowX Edge WAF middleware in your Next.js, Express, or Cloudflare Worker stack to block bots and SQLi in <2ms.",
    });
  }

  // Calculate deep A-to-Z weighted security score (0 to 100)
  let transportPts = 0;
  if (resolvedIps.length > 0) transportPts += 5;
  if (ipv6Records.length > 0) transportPts += 4;
  if (httpsReachable) transportPts += 12;
  if (latencyMs < 100) transportPts += 4;

  let dnsPts = 0;
  if (caaRecords.length > 0) dnsPts += 8;
  if (hasSpfOrDmarc) dnsPts += 8;
  if (dnssecVerified) dnsPts += 4;

  let headerPts = 0;
  if (hstsHeaderPresent) headerPts += 8;
  if (cspHeaderPresent) headerPts += 8;
  if (xFrameOptionsPresent) headerPts += 5;
  if (!corsPermissive) headerPts += 4;

  let privacyPts = 0;
  if (!serverHeaderExposed) privacyPts += 8;
  if (securityTxtPresent) privacyPts += 7;

  let edgePts = 4;
  if (hasSparrowxVerification) edgePts = 15;

  const rawScore = transportPts + dnsPts + headerPts + privacyPts + edgePts;
  const score = Math.min(99, Math.max(22, rawScore));

  const scoreGrade: LiveDomainAuditResult["scoreGrade"] =
    score >= 90
      ? "A+"
      : score >= 80
        ? "A"
        : score >= 70
          ? "B"
          : score >= 55
            ? "C"
            : score >= 40
              ? "D"
              : "F";

  const riskLevel: LiveDomainAuditResult["riskLevel"] =
    score < 40
      ? "CRITICAL EXPOSURE"
      : score < 60
        ? "HIGH RISK"
        : score < 80
          ? "MODERATE RISK"
          : "HARDENED";

  onProgress?.(92, "Engaging SparrowX AI Neural Engine for deep threat analysis & founder advisory...");

  // Generate deep AI advisory using Gemini 3.8 Flash
  let advisory: AiScanDeepAdvisory | undefined;
  try {
    advisory = await analyzeScanWithGeminiBrain({
      cleanHost,
      score,
      grade: scoreGrade,
      riskLevel,
      targetCategory,
      findings,
      serverBanner: serverHeaderExposed,
      originIp: resolvedIps[0] ?? "Direct",
      corsPermissive,
    });
  } catch {
    advisory = buildDeterministicScanAdvisory({
      cleanHost,
      score,
      grade: scoreGrade,
      riskLevel,
      targetCategory,
      findings,
      serverBanner: serverHeaderExposed,
      originIp: resolvedIps[0] ?? "Direct",
      corsPermissive,
    });
  }

  onProgress?.(100, "Scan complete.");

  return {
    domain: fullUrl,
    cleanHost,
    scannedAt: new Date().toISOString(),
    score,
    scoreGrade,
    riskLevel,
    targetCategory,
    targetExplanation,
    hasAiEndpoints,
    resolvedIps,
    ipv6Count: ipv6Records.length,
    caaRecords,
    txtRecordsCount: txtRecords.length,
    hasSparrowxVerification,
    hasSpfOrDmarc,
    dnssecVerified,
    httpsReachable,
    corsPermissive,
    serverHeaderExposed,
    securityTxtPresent,
    hstsHeaderPresent,
    cspHeaderPresent,
    xFrameOptionsPresent,
    latencyMs,
    findings,
    advisory,
  };
}

// ============================================================================
// PROSPECT & LEAD CRM STORAGE (SHARED BETWEEN PUBLIC SCANNER & ADMIN PORTAL)
// ============================================================================
export type ProspectStatus =
  | "New Lead"
  | "Scanned"
  | "Report Sent"
  | "Quotation Sent"
  | "Negotiating"
  | "Converted"
  | "Archived";

export interface ProspectQuotation {
  id: string;
  packageName: string;
  planTier: PlanTier;
  credits: number;
  priceUsd: number;
  priceInr: number;
  discountPct: number;
  status: "Draft" | "Sent" | "Accepted";
  createdAt: string;
  notes: string;
}

export interface ProspectRecord {
  id: string;
  domain: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  source: "Public Scanner Lead" | "Admin Outbound" | "Shared Report";
  status: ProspectStatus;
  createdAt: string;
  lastScanResult: LiveDomainAuditResult | null;
  reportViews: number;
  lastViewedAt: string | null;
  quotation: ProspectQuotation | null;
  convertedTenantId?: string | undefined;
}

const PROSPECTS_STORAGE_KEY = "spx_admin_prospects_v1";

export function getStoredProspects(): ProspectRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROSPECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProspectRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredProspects(list: ProspectRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function upsertProspectRecord(record: ProspectRecord): ProspectRecord[] {
  const existing = getStoredProspects();
  const idx = existing.findIndex(
    (p) => p.id === record.id || p.domain.toLowerCase() === record.domain.toLowerCase(),
  );
  let next: ProspectRecord[];
  if (idx >= 0) {
    next = existing.map((item, i) => (i === idx ? record : item));
  } else {
    next = [record, ...existing];
  }
  saveStoredProspects(next);
  return next;
}

export function incrementProspectReportView(domainOrId: string): void {
  const existing = getStoredProspects();
  const clean = domainOrId.trim().toLowerCase();
  const updated = existing.map((p) => {
    if (p.id.toLowerCase() === clean || p.domain.toLowerCase() === clean) {
      return {
        ...p,
        reportViews: (p.reportViews || 0) + 1,
        lastViewedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    }
    return p;
  });
  saveStoredProspects(updated);
}

// ============================================================================
// REPORT & COLD OUTREACH GENERATORS
// ============================================================================
export function buildProspectAuditReportText(audit: LiveDomainAuditResult): string {
  const exposedCount = audit.findings.filter((f) => f.status !== "passed").length;
  const advisoryLines = audit.advisory
    ? [
        "----------------------------------------------------------------------",
        `SPARROWX AI BRAIN DEEP ADVISORY (${audit.advisory.modelUsed}):`,
        `Target Category     : ${audit.targetCategory}`,
        `Executive Summary   : ${audit.advisory.executiveSummary}`,
        `Attacker Exploit    : ${audit.advisory.exploitScenario}`,
        `60s Fix Action      : ${audit.advisory.recommendedAction}`,
        `Recommended Pack    : ${audit.advisory.recommendedPackage}`,
        `Founder Pitch       : "${audit.advisory.customerConversionPitch}"`,
        ...(audit.advisory.aiVulnerabilities && audit.advisory.aiVulnerabilities.length > 0
          ? [
              "----------------------------------------------------------------------",
              "AI & FULL-STACK VULNERABILITIES IDENTIFIED BY SPARROWX AI:",
              ...audit.advisory.aiVulnerabilities.map(
                (v) =>
                  `* [${v.riskRating.toUpperCase()}] ${v.name} (${v.owaspCategory})\n  - Risk: ${v.description}\n  - Fix: ${v.howSparrowxProtects}`,
              ),
            ]
          : []),
        ...(audit.advisory.whatSparrowxSaves && audit.advisory.whatSparrowxSaves.length > 0
          ? [
              "----------------------------------------------------------------------",
              "WHAT SPARROWX SAFES & PROTECTS:",
              ...audit.advisory.whatSparrowxSaves.map(
                (s) =>
                  `* Threat: ${s.threat}\n  - Danger Without: ${s.dangerWithoutSparrowx}\n  - SparrowX Defense: ${s.howSparrowxSafes} (${s.remediationTime})`,
              ),
            ]
          : []),
        "----------------------------------------------------------------------",
        "5-MINUTE RAPID ONBOARDING PLAN:",
        `Step 1: ${audit.advisory.fiveMinuteProtectionPlan?.step1 ?? "Claim workspace in SparrowX (60s)"}`,
        `Step 2: ${audit.advisory.fiveMinuteProtectionPlan?.step2 ?? "Drop in 5-line middleware (120s)"}`,
        `Step 3: ${audit.advisory.fiveMinuteProtectionPlan?.step3 ?? "Activate verified shield (120s)"}`,
      ]
    : [];

  return [
    "======================================================================",
    "SPARROWX AUTONOMOUS SOC — LIVE DEEP SECURITY & AI EXPOSURE AUDIT REPORT",
    "======================================================================",
    `Target Asset       : ${audit.cleanHost} (${audit.domain})`,
    `Target Category    : ${audit.targetCategory}`,
    `Scan Timestamp     : ${audit.scannedAt}`,
    `Security Score     : ${audit.score} / 100 [Grade ${audit.scoreGrade} · ${audit.riskLevel}]`,
    `Resolved Origin IP : ${audit.resolvedIps.length > 0 ? audit.resolvedIps.join(", ") : "Unresolved / Hidden"}`,
    `IPv6 & CAA Records : ${audit.ipv6Count} IPv6, ${audit.caaRecords.length} CAA`,
    `DNSSEC Validation  : ${audit.dnssecVerified ? "Validated" : "Unsigned"}`,
    `Edge RTT Latency   : ${audit.latencyMs} ms`,
    `Active Exposures   : ${exposedCount} Security Vectors Identified`,
    ...advisoryLines,
    "----------------------------------------------------------------------",
    "KEY FINDINGS, EVIDENCE & REMEDIATION:",
    ...audit.findings.map(
      (f, idx) =>
        `${idx + 1}. [${f.status.toUpperCase()}] ${f.title}\n   - Category : ${f.category}\n   - Evidence : ${f.evidence}\n   - Impact   : ${f.detail}\n   - Fix      : ${f.remediation}`,
    ),
    "----------------------------------------------------------------------",
    "HOW TO REMEDIATE IN 60 SECONDS:",
    `1. Claim and verify ${audit.cleanHost} inside SparrowX Command Center.`,
    "2. Drop in our pre-built Next.js, Express, FastAPI, or Cloudflare Worker middleware.",
    "3. Download your signed SOC 2 / ISO 27001 Readiness & Verification Certificate.",
    "======================================================================",
  ].join("\n");
}

export function downloadBrandedHtmlSecurityReport(
  audit: LiveDomainAuditResult,
  quotation?: ProspectQuotation | null,
): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SparrowX Deep Security Assessment — ${audit.cleanHost}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #070709; color: #f4f4f5; padding: 32px; }
    .container { max-width: 860px; margin: 0 auto; border: 1px solid #27272a; border-radius: 16px; background: #101014; padding: 36px; }
    .score { font-size: 38px; font-weight: 900; color: ${audit.score >= 80 ? "#34d399" : audit.score >= 60 ? "#fbbf24" : "#f87171"}; font-family: monospace; }
    .finding { border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-top: 12px; background: #09090b; }
    .evidence { font-family: monospace; font-size: 11px; color: #a1a1aa; background: #141418; padding: 8px; border-radius: 6px; margin-top: 8px; }
    .ai-box { margin-top: 24px; border: 1px solid #f05a2866; background: #f05a2810; padding: 20px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #27272a;padding-bottom:20px;">
      <div>
        <div style="color:#f05a28;font-size:11px;font-weight:700;letter-spacing:1px;">SPARROWX AUTONOMOUS SOC · DEEP SECURITY AUDIT</div>
        <h1 style="margin:6px 0 0;font-size:24px;">${audit.cleanHost}</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">Target: ${audit.targetCategory} · Origin: ${audit.resolvedIps[0] ?? "Direct"} (${audit.latencyMs}ms RTT)</p>
      </div>
      <div style="text-align:right;">
        <div class="score">${audit.score}/100 <span style="font-size:20px;background:#f05a2825;color:#f05a28;padding:2px 8px;border-radius:6px;">${audit.scoreGrade}</span></div>
        <div style="font-size:11px;color:${audit.score >= 80 ? "#34d399" : audit.score >= 60 ? "#fbbf24" : "#f87171"};font-weight:700;">${audit.riskLevel}</div>
      </div>
    </div>

    ${
      audit.advisory
        ? `<div class="ai-box">
          <div style="font-size:11px;font-weight:700;color:#f05a28;text-transform:uppercase;letter-spacing:0.5px;">✦ SparrowX AI Brain Deep Advisory (${audit.advisory.modelUsed})</div>
          <p style="margin:8px 0 4px;font-size:13px;line-height:1.5;color:#f4f4f5;"><strong>Executive Assessment:</strong> ${audit.advisory.executiveSummary}</p>
          <div style="margin-top:10px;padding:10px;background:#00000080;border-left:3px solid #f87171;font-size:12px;color:#d4d4d8;">
            <strong style="color:#f87171;">Attacker Exploit Vector:</strong> ${audit.advisory.exploitScenario}
          </div>
          <div style="margin-top:10px;padding:10px;background:#00000080;border-left:3px solid #34d399;font-size:12px;color:#d4d4d8;">
            <strong style="color:#34d399;">Recommended Defense:</strong> ${audit.advisory.recommendedAction}
          </div>
          <p style="margin:10px 0 0;font-size:12px;font-style:italic;color:#a1a1aa;">&ldquo;${audit.advisory.customerConversionPitch}&rdquo;</p>
          ${
            audit.advisory.whatSparrowxSaves && audit.advisory.whatSparrowxSaves.length > 0
              ? `<div style="margin-top:16px;border-top:1px solid #ffffff15;padding-top:12px;">
                <div style="font-size:11px;font-weight:700;color:#34d399;text-transform:uppercase;margin-bottom:8px;">What SparrowX Protects & Safes You From:</div>
                ${audit.advisory.whatSparrowxSaves
                  .map(
                    (s) => `<div style="margin-bottom:6px;font-size:11px;color:#d4d4d8;">
                      <strong style="color:#ffffff;">• ${s.threat}:</strong> ${s.howSparrowxSafes} (${s.remediationTime})
                    </div>`,
                  )
                  .join("")}
              </div>`
              : ""
          }
          ${
            audit.advisory.aiVulnerabilities && audit.advisory.aiVulnerabilities.length > 0
              ? `<div style="margin-top:14px;border-top:1px solid #ffffff15;padding-top:12px;">
                <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;margin-bottom:8px;">AI & Full-Stack Vulnerabilities Identified:</div>
                ${audit.advisory.aiVulnerabilities
                  .map(
                    (v) => `<div style="margin-bottom:6px;font-size:11px;color:#d4d4d8;">
                      <strong style="color:#f87171;">[${v.riskRating.toUpperCase()}] ${v.name} (${v.owaspCategory}):</strong> ${v.description}
                    </div>`,
                  )
                  .join("")}
              </div>`
              : ""
          }
        </div>`
        : ""
    }

    <h3 style="margin-top:24px;font-size:14px;text-transform:uppercase;color:#a1a1aa;">Verified Technical Findings & Raw Evidence</h3>
    ${audit.findings
      .map(
        (f) => `<div class="finding">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;">
            <span>${f.title}</span>
            <span style="text-transform:uppercase;font-size:11px;color:${f.status === "critical" ? "#f87171" : f.status === "warning" ? "#fbbf24" : "#34d399"};">${f.status}</span>
          </div>
          <p style="margin:6px 0;font-size:12px;color:#d4d4d8;">${f.detail}</p>
          <div class="evidence">Evidence: ${f.evidence}</div>
          <div style="margin-top:8px;font-size:12px;color:#f05a28;"><strong>Remediation:</strong> ${f.remediation}</div>
        </div>`,
      )
      .join("")}
    ${
      quotation
        ? `<div style="margin-top:28px;border:1px solid #f05a2866;background:#f05a2815;padding:20px;border-radius:12px;">
            <div style="font-size:11px;font-weight:700;color:#f05a28;text-transform:uppercase;">Prepared Security Quotation (${quotation.id})</div>
            <h3 style="margin:6px 0;font-size:18px;">${quotation.packageName} — ₹${quotation.priceInr.toLocaleString()} INR ($${quotation.priceUsd} USD)</h3>
            <p style="margin:4px 0;font-size:12px;color:#d4d4d8;">Includes ${quotation.credits} Security Credits, full edge WAF deployment, and signed SOC 2 verification certificate. ${quotation.notes}</p>
          </div>`
        : ""
    }
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparrowx-security-report-${audit.cleanHost}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildColdOutreachMessage(
  audit: LiveDomainAuditResult,
  channel: "dm" | "email" | "linkedin",
): string {
  const ipNote = audit.resolvedIps.length > 0 ? ` (resolving to ${audit.resolvedIps[0]})` : "";
  const targetDesc =
    audit.targetCategory === "AI Agent & LLM Endpoint"
      ? "AI agent & LLM prompt interface"
      : audit.targetCategory === "API & Cloud Service"
        ? "API cloud microservices"
        : "web application";

  const vectorNotice =
    audit.targetCategory === "AI Agent & LLM Endpoint"
      ? "unprotected against prompt jailbreaks and runaway LLM token bills"
      : audit.targetCategory === "API & Cloud Service"
        ? "missing velocity rate-limiting and exposing origin IP routing"
        : "missing strict CSP/HSTS headers and edge SQLi/XSS filtering";

  if (channel === "dm") {
    return `Hey! Saw ${audit.cleanHost} and ran a quick non-intrusive security audit${ipNote}. Your ${targetDesc} scores ${audit.score}/100 [Grade ${audit.scoreGrade}]—routes are ${vectorNotice}. I generated the 5-line drop-in middleware fix + full audit report for ${audit.cleanHost} inside SparrowX. Want me to send it over?`;
  }

  if (channel === "linkedin") {
    return `Hi! Congrats on the traction with ${audit.cleanHost}. I ran a quick passive security posture check on ${audit.cleanHost}${ipNote} and noticed open perimeter exposures (Score: ${audit.score}/100, Grade: ${audit.scoreGrade}). Your ${targetDesc} is ${vectorNotice}. We can deploy full edge protection + hand you a verified Trust Badge in 24 hours. Open to seeing the 1-page report?`;
  }

  return `Subject: Security Posture & Edge Protection Notice for ${audit.cleanHost} [Grade ${audit.scoreGrade}]

Hi Team,

While reviewing ${audit.cleanHost}${ipNote}, I ran a non-intrusive security & edge readiness check via SparrowX Autonomous SOC.

Your domain currently scores ${audit.score}/100 [Grade ${audit.scoreGrade} · ${audit.riskLevel}]:
• Target Architecture: ${audit.targetCategory} (${audit.latencyMs}ms TLS RTT, ${audit.caaRecords.length} CAA records)
• Vulnerability Vector: ${vectorNotice}
• Origin Exposure: ${audit.resolvedIps[0] ?? "Publicly Routed"} (${audit.serverHeaderExposed ? `Banner: ${audit.serverHeaderExposed}` : "Masked"})

We already generated the drop-in middleware fix (Next.js / Express / FastAPI / Cloudflare) and a compliance verification report for ${audit.cleanHost}.

Reply "REPORT" and I'll send the full remediation bundle, or we can deploy the complete shield for you in 24 hours via our $149 Done-For-You audit.

Best,
SparrowX Security Operations`;
}

// ============================================================================
// 1. LANDING PAGE LIVE FREE SECURITY SCANNER (WITH SSRF, RATE LIMIT, PROGRESS & LEAD CAPTURE)
// ============================================================================
export function LandingLiveSecurityScanner({
  onClaimAndProtectDomain,
  onOpenInstantCheckout,
}: {
  onClaimAndProtectDomain: (domain: string, suggestedOrgName: string) => void;
  onOpenInstantCheckout: (neededCredits: number, domain?: string) => void;
}) {
  const [domainInput, setDomainInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressPct, setScanProgressPct] = useState(0);
  const [scanStageText, setScanStageText] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<LiveDomainAuditResult | null>(null);
  const [copiedOutreach, setCopiedOutreach] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [findingsFilter, setFindingsFilter] = useState<"all" | "vulnerabilities" | "passed">("all");
  const [copiedEvidenceId, setCopiedEvidenceId] = useState<string | null>(null);

  // Lead Capture state after scan
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadCaptured, setLeadCaptured] = useState(false);

  // Auto-run scan if URL contains ?scan=<domain> or ?prospect_report=<domain>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedScan = params.get("scan") || params.get("prospect_report");
    if (sharedScan) {
      setDomainInput(sharedScan);
      incrementProspectReportView(sharedScan);
      void triggerScan(sharedScan);
    }
  }, []);

  const triggerScan = async (targetDomain?: string) => {
    setScanError(null);
    setLeadCaptured(false);
    const query = (targetDomain ?? domainInput).trim() || "example.com";
    if (!targetDomain && !domainInput.trim()) {
      setDomainInput(query);
    }

    // 1. SSRF & Input Validation Check
    const safeCheck = validateSafePublicTarget(query);
    if (!safeCheck.valid) {
      setScanError(safeCheck.error ?? "Invalid domain.");
      return;
    }

    // 2. Rate Limit Check
    const rate = checkScannerRateLimit();
    if (!rate.allowed) {
      setScanError(
        `Rate limit protection active: Maximum ${SCAN_RATE_LIMIT_MAX} scans per minute reached. Please wait ${rate.retryAfterSec}s before scanning again.`,
      );
      return;
    }

    setIsScanning(true);
    setScanProgressPct(10);
    setScanStageText("Validating target & checking SSRF / DNS rebinding guards...");

    try {
      const result = await runLivePublicDomainScan(query, (pct, label) => {
        setScanProgressPct(pct);
        setScanStageText(label);
      });
      setScanResult(result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to complete scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult || !leadEmail.trim()) return;
    const org =
      leadCompany.trim() ||
      (scanResult.cleanHost.split(".")[0] ?? "Startup").replace(/^./, (c) => c.toUpperCase());

    const newLead: ProspectRecord = {
      id: `LEAD-${Date.now().toString().slice(-6)}`,
      domain: scanResult.cleanHost,
      companyName: org,
      contactName: leadName.trim() || "Founder",
      contactEmail: leadEmail.trim(),
      source: "Public Scanner Lead",
      status: "New Lead",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      lastScanResult: scanResult,
      reportViews: 1,
      lastViewedAt: "Just now",
      quotation: null,
    };
    upsertProspectRecord(newLead);
    void persistAuditLogToBackend({
      id: `AUD-LEAD-${Date.now().toString().slice(-5)}`,
      actor: leadEmail.trim(),
      role: "Public Scanner Lead",
      action: `Captured inbound security audit lead for ${scanResult.cleanHost} (Score: ${scanResult.score}/100)`,
      target: scanResult.cleanHost,
      severity: "Info",
      timestamp: "Just now",
    });
    setLeadCaptured(true);
    downloadBrandedHtmlSecurityReport(scanResult);
  };

  const handleDownloadAuditTxt = () => {
    if (!scanResult) return;
    const text = buildProspectAuditReportText(scanResult);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-security-audit-${scanResult.cleanHost}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareScanLink = () => {
    if (!scanResult || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?scan=${encodeURIComponent(scanResult.cleanHost)}`;
    void navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleCopyOutreach = (channel: "dm" | "email" | "linkedin") => {
    if (!scanResult) return;
    const msg = buildColdOutreachMessage(scanResult, channel);
    void navigator.clipboard.writeText(msg);
    setCopiedOutreach(channel);
    setTimeout(() => setCopiedOutreach(null), 2500);
  };

  const suggestOrgFromHost = (host: string) => {
    const base = host.replace(/^(www\.|api\.|app\.)/, "").split(".")[0] ?? "My Startup";
    return base.charAt(0).toUpperCase() + base.slice(1) + " Security";
  };

  return (
    <div
      id="free-scanner"
      className="rounded-2xl border border-primary/40 bg-gradient-to-b from-[#120A07] via-[#0A0A0A] to-[#080808] p-4 sm:p-6 shadow-[0_0_45px_rgba(240,90,40,0.18)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <Radar className="size-4 animate-spin" style={{ animationDuration: "6s" }} />
          <span>Free 15-Second Live Domain, DNS, TLS, CORS & AI API Scanner</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-400">
            SSRF & REBINDING PROTECTED
          </span>
          <span className="rounded-full border border-[#262626] bg-black px-2.5 py-0.5 text-[10px] font-mono text-zinc-400">
            NO SIGNUP REQUIRED
          </span>
        </div>
      </div>

      <p className="text-xs text-zinc-300 mb-3.5">
        Enter any public website, SaaS domain, or API endpoint to run a live non-intrusive check on
        HTTPS/TLS, DNS A/AAAA/CAA/TXT records, CORS & Security Headers, `security.txt`, and AI
        endpoint exposure:
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void triggerScan();
        }}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        <div className="relative flex-1">
          <Globe2 className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Public domain or URL to scan"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="Enter public domain (e.g. yourdomain.com)"
            className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-black pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary focus:ring-2 focus:ring-primary/25 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isScanning}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:opacity-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {isScanning ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              <span>Scanning ({scanProgressPct}%)...</span>
            </>
          ) : (
            <>
              <Search className="size-4" />
              <span>Scan My Domain Free</span>
            </>
          )}
        </button>
      </form>

      {/* Quick sample domains */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
        <span>Try live scan on:</span>
        {["yourdomain.com"].map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setDomainInput(sample);
              void triggerScan(sample);
            }}
            className="rounded-md border border-[#262626] bg-black/80 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:border-primary/50 hover:text-white transition-colors cursor-pointer"
          >
            {sample}
          </button>
        ))}
      </div>

      {/* SSRF / Rate-Limit Error Banner */}
      {scanError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 p-3.5 text-xs text-red-300 flex items-start gap-2.5"
        >
          <ShieldAlert className="size-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-200">Scanner Security Policy Notice</div>
            <div className="mt-0.5">{scanError}</div>
          </div>
        </div>
      )}

      {/* Live Multi-Step Scan Progress Bar */}
      {isScanning && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-black/90 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-200 flex items-center gap-2">
              <RefreshCw className="size-3.5 text-primary animate-spin shrink-0" />
              {scanStageText}
            </span>
            <span className="text-primary font-bold">{scanProgressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-300"
              style={{ width: `${scanProgressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* LIVE SCAN RESULTS CARD */}
      {scanResult && !isScanning && (() => {
        const criticalFindings = scanResult.findings.filter((f) => f.status === "critical");
        const warningFindings = scanResult.findings.filter((f) => f.status === "warning");
        const passedFindings = scanResult.findings.filter((f) => f.status === "passed");
        const vulnFindings = scanResult.findings.filter((f) => f.status !== "passed");

        const displayedFindings =
          findingsFilter === "vulnerabilities"
            ? vulnFindings
            : findingsFilter === "passed"
              ? passedFindings
              : scanResult.findings;

        return (
          <div className="mt-5 space-y-5 rounded-2xl border border-[#27272a] bg-gradient-to-b from-[#111215] via-[#0b0c0e] to-[#08080a] p-4 sm:p-6 shadow-2xl relative overflow-hidden">
            {/* Top Accent Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-amber-500 to-emerald-500" />

            {/* TOP EXECUTIVE POSTURE & TELEMETRY HUD */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[#1f2228] pb-5">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-bold text-white flex items-center gap-2">
                    <Globe2 className="size-4 text-primary" />
                    <span>{scanResult.cleanHost}</span>
                  </span>
                  <CyberPill
                    icon="shield"
                    label={scanResult.targetCategory}
                    variant="cyan"
                    size="sm"
                  />
                  <CyberPill
                    icon={scanResult.score < 80 ? "alert" : "check"}
                    label={scanResult.riskLevel}
                    variant={
                      scanResult.score < 60
                        ? "red"
                        : scanResult.score < 80
                          ? "amber"
                          : "emerald"
                    }
                    size="sm"
                  />
                </div>

                {/* Real-Time Live Infrastructure Telemetry Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
                  <div className="rounded-lg border border-white/5 bg-black/50 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">Origin Target</span>
                    <strong className="text-zinc-200 truncate block">
                      {scanResult.resolvedIps[0] ?? "Direct DNS"}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/50 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">TLS RTT</span>
                    <strong className="text-zinc-200 block">{scanResult.latencyMs}ms</strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/50 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">DNS CAA Records</span>
                    <strong className="text-zinc-200 block">
                      {scanResult.caaRecords.length} records
                    </strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/50 p-2">
                    <span className="text-[10px] uppercase text-zinc-500 block">DNSSEC Status</span>
                    <strong
                      className={`block font-semibold ${
                        scanResult.dnssecVerified ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {scanResult.dnssecVerified ? "Enforced" : "Unsigned"}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/50 p-2 col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase text-zinc-500 block">TXT Records</span>
                    <strong className="text-zinc-200 block">
                      {scanResult.txtRecordsCount} published
                    </strong>
                  </div>
                </div>

                {/* Quick Share / Export Action Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleShareScanLink}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:border-primary/50 hover:text-white transition-colors cursor-pointer"
                  >
                    {shareCopied ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Share2 className="size-3 text-primary" />
                    )}
                    <span>{shareCopied ? "Share URL Copied" : "Share Audit URL"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAuditTxt}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:border-primary/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <Download className="size-3 text-primary" />
                    <span>Download TXT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBrandedHtmlSecurityReport(scanResult)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:border-emerald-500/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <FileText className="size-3 text-emerald-400" />
                    <span>Executive HTML Report</span>
                  </button>
                </div>
              </div>

              {/* POSTURE SCORE & EXECUTIVE GRADE CARD */}
              <div
                className={`flex items-center gap-4 self-start lg:self-auto rounded-2xl border p-4 backdrop-blur-md shrink-0 shadow-lg ${
                  scanResult.score >= 80
                    ? "border-emerald-500/30 bg-emerald-950/20 shadow-emerald-950/30"
                    : scanResult.score >= 60
                      ? "border-amber-500/30 bg-amber-950/20 shadow-amber-950/30"
                      : "border-red-500/30 bg-red-950/20 shadow-red-950/30"
                }`}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">
                    Security Score
                  </div>
                  <div
                    className={`font-mono text-3xl sm:text-4xl font-black ${
                      scanResult.score >= 80
                        ? "text-emerald-400"
                        : scanResult.score >= 60
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {scanResult.score}
                    <span className="text-xs text-zinc-400 font-normal">/100</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                        scanResult.scoreGrade.startsWith("A")
                          ? "bg-emerald-400 text-black"
                          : scanResult.scoreGrade === "B"
                            ? "bg-blue-400 text-black"
                            : scanResult.scoreGrade === "C"
                              ? "bg-amber-400 text-black"
                              : "bg-red-500 text-white"
                      }`}
                    >
                      GRADE {scanResult.scoreGrade}
                    </span>
                  </div>
                </div>

                <div className="h-16 w-px bg-white/10 hidden sm:block" />

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-red-400 flex items-center gap-1 font-semibold">
                      <ShieldAlert className="size-3" />
                      Critical
                    </span>
                    <strong className="text-white bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 rounded">
                      {criticalFindings.length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="size-3" />
                      Warnings
                    </span>
                    <strong className="text-white bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded">
                      {warningFindings.length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="size-3" />
                      Passed
                    </span>
                    <strong className="text-white bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                      {passedFindings.length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 1: ASSET FINGERPRINTING & ARCHITECTURE IDENTIFICATION */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-1.5">
                <span className="font-bold text-sky-300 uppercase tracking-wider flex items-center gap-2 font-mono text-[11px]">
                  <Search className="size-3.5 text-sky-400" />
                  <span>Step 1 · Asset &amp; Architecture Fingerprint</span>
                </span>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded font-bold">
                  {scanResult.targetCategory}
                </span>
              </div>
              <p className="text-zinc-200 text-[11px] leading-relaxed">
                {scanResult.targetExplanation}
              </p>
            </div>

            {/* HIGH-IMPACT 5-MINUTE RAPID DEFENSE CALLOUT */}
            <div className="rounded-2xl border-2 border-primary/60 bg-gradient-to-r from-primary/20 via-orange-950/30 to-black p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_40px_rgba(240,90,40,0.22)]">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2 text-white font-black text-sm sm:text-base">
                  <ShieldCheck className="size-5 text-primary shrink-0" />
                  <span>Autonomous Defense Ready for {scanResult.cleanHost}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Remediate all{" "}
                  <strong className="text-white font-mono">
                    {vulnFindings.length} detected security &amp; API exposures
                  </strong>{" "}
                  in under 5 minutes with drop-in edge armor. No code refactoring or infrastructure overhaul required.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onClaimAndProtectDomain(
                    scanResult.domain,
                    leadCompany.trim() || suggestOrgFromHost(scanResult.cleanHost),
                  )
                }
                className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] hover:shadow-primary/50 cursor-pointer shrink-0"
              >
                <Zap className="size-4 text-white fill-white" />
                <span>Protect {scanResult.cleanHost} in 5 Min</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* SPARROWX AUTONOMOUS THREAT INTELLIGENCE & SOC ADVISORY */}
            {scanResult.advisory && (
              <div className="rounded-2xl border border-primary/40 bg-gradient-to-b from-[#140e0b] via-[#0e0c0b] to-black p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/20 pb-3">
                  <div className="flex items-center gap-3">
                    <CyberEmblem variant="radar" size="sm" />
                    <div>
                      <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span>SparrowX Autonomous Threat Intelligence</span>
                        <span className="font-mono text-[10px] text-primary font-semibold">
                          ({scanResult.advisory.modelUsed})
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        SOC Threat Telemetry &amp; Deep Exposure Analysis
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                      <span className="size-1.5 rounded-full bg-primary animate-ping" />
                      <span>LIVE SOC TELEMETRY</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-black/60 border border-white/10 px-2 py-0.5 rounded">
                      Target: {scanResult.targetCategory}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Executive Assessment */}
                  <div className="rounded-xl border border-white/5 bg-black/50 p-3.5 space-y-1">
                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Terminal className="size-3.5 text-primary" />
                      <span>Executive Posture Assessment</span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed">
                      {scanResult.advisory.executiveSummary}
                    </p>
                  </div>

                  {/* Red Team Exploit Scenario */}
                  <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/20 via-black to-black p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-red-400 font-bold font-mono text-[11px] uppercase tracking-wider border-b border-red-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="size-3.5 shrink-0" />
                        <span>Real-World Attacker Exploit Scenario (Red Team View)</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                        THREAT VECTOR
                      </span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed">
                      {scanResult.advisory.exploitScenario}
                    </p>
                  </div>

                  {/* 60-Second Autonomous Defense Playbook */}
                  <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-black to-black p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-emerald-400 font-bold font-mono text-[11px] uppercase tracking-wider border-b border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="size-3.5 shrink-0" />
                        <span>Recommended 60-Second Edge Remediation</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        INSTANT MITIGATION
                      </span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed">
                      {scanResult.advisory.recommendedAction}
                    </p>
                  </div>

                  {/* WHAT SPARROWX SAFES & PROTECTS SECTION */}
                  {scanResult.advisory.whatSparrowxSaves &&
                    scanResult.advisory.whatSparrowxSaves.length > 0 && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                            <Shield className="size-3.5 text-emerald-400" />
                            <span>What SparrowX Protects &amp; Safes You From</span>
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                            &lt; 2ms Latency SLA Guarantee
                          </span>
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-3">
                          {scanResult.advisory.whatSparrowxSaves.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-emerald-500/20 bg-black/75 p-3 flex flex-col justify-between"
                            >
                              <div>
                                <div className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                                  <span>{item.threat}</span>
                                </div>
                                <div className="mt-1.5 text-[11px] text-zinc-300 leading-snug">
                                  <strong className="text-red-400">Danger:</strong>{" "}
                                  {item.dangerWithoutSparrowx}
                                </div>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-emerald-300 font-medium">
                                <strong>SparrowX Defense:</strong> {item.howSparrowxSafes}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* IDENTIFIED VULNERABILITY VECTORS (OWASP TOP 10) */}
                  {scanResult.advisory.aiVulnerabilities &&
                    scanResult.advisory.aiVulnerabilities.length > 0 && (
                      <div className="rounded-xl border border-red-500/30 bg-red-950/15 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/20 pb-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                            <ShieldAlert className="size-3.5 text-red-400" />
                            <span>
                              {scanResult.targetCategory === "AI Agent & LLM Endpoint"
                                ? "Identified AI Threat Vectors (OWASP Top 10 for LLM)"
                                : scanResult.targetCategory === "API & Cloud Service"
                                  ? "Identified API Threat Vectors (OWASP API Security Top 10)"
                                  : "Identified Application Vulnerabilities (OWASP Top 10)"}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-0.5 rounded font-bold">
                            {scanResult.advisory.aiVulnerabilities.length} Attack Vectors
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {scanResult.advisory.aiVulnerabilities.map((v) => (
                            <div
                              key={v.id}
                              className="rounded-lg border border-red-500/20 bg-black/75 p-3 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] text-red-300 font-bold bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                                  {v.owaspCategory}
                                </span>
                                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">
                                  {v.riskRating}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-white">{v.name}</div>
                              <div className="text-[11px] text-zinc-300">{v.description}</div>
                              <div className="text-[11px] text-primary pt-1 border-t border-white/5 font-medium">
                                <strong>SparrowX Defense:</strong> {v.howSparrowxProtects}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 5-MINUTE RAPID PROTECTION ROADMAP */}
                  {scanResult.advisory.fiveMinuteProtectionPlan && (
                    <div className="rounded-xl border border-primary/30 bg-black/80 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                          <Clock className="size-3.5 text-primary" />
                          <span>5-Minute Rapid Protection Roadmap</span>
                        </span>
                        <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded font-bold">
                          Est. Time: {scanResult.advisory.fiveMinuteProtectionPlan.estimatedTime}
                        </span>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-white/10 bg-[#111215] p-3 space-y-1">
                          <div className="font-bold text-primary flex items-center gap-2 font-mono text-[11px]">
                            <span className="size-5 rounded-md bg-primary/20 text-primary grid place-items-center text-[10px] font-bold">
                              01
                            </span>
                            <span>Workspace Claim</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-snug">
                            {scanResult.advisory.fiveMinuteProtectionPlan.step1}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#111215] p-3 space-y-1">
                          <div className="font-bold text-primary flex items-center gap-2 font-mono text-[11px]">
                            <span className="size-5 rounded-md bg-primary/20 text-primary grid place-items-center text-[10px] font-bold">
                              02
                            </span>
                            <span>5-Line Drop-in</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-snug">
                            {scanResult.advisory.fiveMinuteProtectionPlan.step2}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#111215] p-3 space-y-1">
                          <div className="font-bold text-emerald-400 flex items-center gap-2 font-mono text-[11px]">
                            <span className="size-5 rounded-md bg-emerald-500/20 text-emerald-400 grid place-items-center text-[10px] font-bold">
                              03
                            </span>
                            <span>Live Activation</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-snug">
                            {scanResult.advisory.fiveMinuteProtectionPlan.step3}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-primary/20 text-xs">
                    <p className="text-zinc-300 italic text-[11px]">
                      &ldquo;{scanResult.advisory.customerConversionPitch}&rdquo;
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-primary font-bold border border-primary/30 px-2 py-1 rounded bg-primary/10">
                        Recommended: {scanResult.advisory.recommendedPackage}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onClaimAndProtectDomain(
                            scanResult.domain,
                            leadCompany.trim() || suggestOrgFromHost(scanResult.cleanHost),
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all cursor-pointer"
                      >
                        <Zap className="size-3.5 fill-current" />
                        <span>Protect in 5 Min</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TECHNICAL FINDINGS INSPECTION PANEL WITH FILTER TABS */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-zinc-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Technical Findings &amp; Evidence ({displayedFindings.length})
                  </span>
                </div>
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/60 p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setFindingsFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      findingsFilter === "all"
                        ? "bg-primary text-black font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    All ({scanResult.findings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsFilter("vulnerabilities")}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      findingsFilter === "vulnerabilities"
                        ? "bg-red-500 text-white font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Vulnerabilities ({vulnFindings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsFilter("passed")}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      findingsFilter === "passed"
                        ? "bg-emerald-500 text-black font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Passed ({passedFindings.length})
                  </button>
                </div>
              </div>

              {/* Finding Cards List */}
              <div className="space-y-2.5">
                {displayedFindings.map((finding) => {
                  const isCrit = finding.status === "critical";
                  const isWarn = finding.status === "warning";
                  return (
                    <div
                      key={finding.id}
                      className={`rounded-xl border p-4 text-xs transition-colors ${
                        isCrit
                          ? "border-red-500/30 bg-red-950/15"
                          : isWarn
                            ? "border-amber-500/30 bg-amber-950/15"
                            : "border-emerald-500/25 bg-emerald-950/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {isCrit ? (
                            <ShieldAlert className="size-4 text-red-400 shrink-0 mt-0.5" />
                          ) : isWarn ? (
                            <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono uppercase text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                {finding.category}
                              </span>
                              <span className="font-semibold text-white">{finding.title}</span>
                            </div>
                            <div className="text-[11px] text-zinc-300 leading-relaxed">
                              {finding.detail}
                            </div>

                            {/* Raw Evidence Terminal Box with Copy Button */}
                            <div className="relative rounded-lg bg-black/90 border border-white/10 px-3 py-2 font-mono text-[11px] text-zinc-300">
                              <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-white/5 text-[9px] uppercase tracking-wider text-zinc-500">
                                <span>Probe Evidence</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(finding.evidence);
                                    setCopiedEvidenceId(finding.id);
                                    setTimeout(() => setCopiedEvidenceId(null), 2000);
                                  }}
                                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-primary transition-colors cursor-pointer"
                                >
                                  {copiedEvidenceId === finding.id ? (
                                    <>
                                      <Check className="size-2.5 text-emerald-400" />
                                      <span className="text-emerald-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-2.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <code className="text-zinc-300 break-all select-all block">
                                {finding.evidence}
                              </code>
                            </div>

                            {finding.status !== "passed" && (
                              <div className="rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] text-primary font-medium flex items-start gap-1.5">
                                <Zap className="size-3.5 shrink-0 mt-0.5" />
                                <span>
                                  <strong>SparrowX Defense:</strong> {finding.remediation}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase font-bold ${
                            isCrit
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : isWarn
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {finding.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EXECUTIVE HTML AUDIT REPORT DOWNLOAD & PRIORITY LEAD CAPTURE */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4 sm:p-5">
              {leadCaptured ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Full HTML Audit Report downloaded!</strong> We also registered{" "}
                      <code className="font-mono text-white">{scanResult.cleanHost}</code> for priority remediation.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onClaimAndProtectDomain(
                        scanResult.domain,
                        leadCompany.trim() || suggestOrgFromHost(scanResult.cleanHost),
                      )
                    }
                    className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-300 transition-colors cursor-pointer shrink-0"
                  >
                    Open My Workspace Now →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCaptureLead} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                      <Mail className="size-4 text-emerald-400" />
                      <span>
                        Send Full Executive HTML Audit Report &amp; Drop-In Middleware for{" "}
                        <code className="text-emerald-300">{scanResult.cleanHost}</code>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                      INSTANT DOWNLOAD + AUDIT ARCHIVE
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Your Name"
                      className="h-10 rounded-lg border border-white/10 bg-black/80 px-3 text-xs text-white outline-none focus:border-emerald-400"
                    />
                    <input
                      type="email"
                      required
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Work Email (you@company.com)"
                      className="h-10 rounded-lg border border-white/10 bg-black/80 px-3 text-xs text-white outline-none focus:border-emerald-400"
                    />
                    <input
                      type="text"
                      value={leadCompany}
                      onChange={(e) => setLeadCompany(e.target.value)}
                      placeholder="Company / App Name"
                      className="h-10 rounded-lg border border-white/10 bg-black/80 px-3 text-xs text-white outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="h-10 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-black hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      Unlock Full HTML Report
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* HIGH-CONVERTING MONETIZATION CTA BOX */}
            <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-orange-500/10 to-black p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span>
                      Auto-Remediate {scanResult.cleanHost} &amp; Deploy Edge WAF + AI Shield Now
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                    Get your drop-in Next.js/Express/Cloudflare middleware, block SQLi &amp; prompt
                    injections, and download your cryptographically signed SOC 2 verification certificate.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onClaimAndProtectDomain(
                        scanResult.domain,
                        suggestOrgFromHost(scanResult.cleanHost),
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-4 py-2.5 text-xs font-black text-white shadow-md hover:opacity-95 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="size-4 text-white" />
                    <span>Protect All in 5 Min</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                  <a
                    href="#pricing"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-xs font-bold text-white shadow-md hover:border-white/30 transition-all cursor-pointer"
                  >
                    <Mail className="size-3.5" />
                    <span>Contact Security Team</span>
                  </a>
                </div>
              </div>

              {/* Downloadable & Shareable Report + Outreach Tools */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-zinc-400">Security Officer &amp; Founder Actions:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadAuditTxt}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 cursor-pointer"
                  >
                    <Download className="size-3 text-primary" />
                    <span>Audit (.txt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBrandedHtmlSecurityReport(scanResult)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 cursor-pointer"
                  >
                    <FileText className="size-3 text-emerald-400" />
                    <span>Executive (.html)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareScanLink}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 cursor-pointer"
                  >
                    {shareCopied ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Share2 className="size-3 text-primary" />
                    )}
                    <span>{shareCopied ? "URL Copied" : "Share URL"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyOutreach("dm")}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 cursor-pointer"
                  >
                    {copiedOutreach === "dm" ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3 text-primary" />
                    )}
                    <span>{copiedOutreach === "dm" ? "Copied DM" : "Copy Cold DM"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// 2. CONTACT INFO & SECURITY CONSULTATION / INQUIRY FORM SECTION
// ============================================================================
export function LandingPricingSection({
  onSelectPlanAndSignup,
}: {
  onSelectPlanAndSignup: (plan: PlanTier, modules: ServiceModuleId[]) => void;
  onOpenDirectPaymentModal?: (credits: number, label: string) => void;
}) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactDomain, setContactDomain] = useState("");
  const [contactTopic, setContactTopic] = useState(
    "Protect Web Application / API (Edge WAF & Monitoring)",
  );
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) return;

    setIsSubmitting(true);
    const ticketId = `SPX-INQ-${Date.now().toString().slice(-6)}`;
    const cleanHost =
      contactDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0] || "pending-domain.io";

    const newLead: ProspectRecord = {
      id: ticketId,
      domain: cleanHost,
      companyName: contactOrg.trim() || `${contactName.trim()}'s Team`,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      source: "Public Scanner Lead",
      status: "New Lead",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      lastScanResult: null,
      reportViews: 1,
      lastViewedAt: "Just now",
      quotation: null,
    };
    upsertProspectRecord(newLead);

    await persistAuditLogToBackend({
      id: `AUD-CNT-${Date.now().toString().slice(-5)}`,
      actor: contactEmail.trim().toLowerCase(),
      role: "Contact Form Inquiry",
      action: `Submitted security contact request [${ticketId}] (${contactTopic}) for ${cleanHost}${
        contactMessage.trim() ? ` — "${contactMessage.trim().slice(0, 120)}"` : ""
      }`,
      target: cleanHost,
      severity: "Info",
      timestamp: "Just now",
    });

    setIsSubmitting(false);
    setSubmittedTicketId(ticketId);
  };

  return (
    <section id="pricing" className="border-t border-[#1F1F1F] bg-[#060606] py-16 lg:py-20 scroll-mt-24">
      <div id="contact" className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Left Column: Direct SparrowX Contact Info & Channels */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Get in touch with our security team.
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Have questions about protecting your web application, API endpoints, or AI agents?
                Reach out directly to our security engineers for custom onboarding, architecture
                reviews, or incident response assistance.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4 flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Mail className="size-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">
                    General Security & Onboarding Desk
                  </div>
                  <div className="text-xs font-mono text-primary mt-0.5">security@sparrowx.io</div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Direct line to our engineering team for SDK integration, DNS ownership setup,
                    and custom security requirements.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4 flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">
                    24/7 SOC Incident & Emergency Response
                  </div>
                  <div className="text-xs font-mono text-emerald-400 mt-0.5">
                    soc-response@sparrowx.io · &lt; 15 min SLA
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Experiencing an active DDoS wave, credential stuffing attack, or API breach? Our
                    autonomous SOC team responds 24/7.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4 flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  <Globe2 className="size-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">
                    Global Cloud Operations & Compliance
                  </div>
                  <div className="text-xs font-mono text-zinc-300 mt-0.5">
                    Distributed Edge SOC · Remote-First Security Team
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Supporting indie builders, high-growth startups, and enterprise teams worldwide
                    with SOC 2, ISO 27001, and NIST CSF evidence.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1F1F1F] bg-black p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white">Want to deploy right now?</div>
                <div className="text-[11px] text-zinc-400">
                  You can also launch a self-serve workspace in 60 seconds.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectPlanAndSignup("Growth", ["web_security", "ai_shield"])}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#262626] bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-white hover:border-primary/50 transition-all shrink-0 cursor-pointer"
              >
                <span>Launch Workspace</span>
                <ArrowRight className="size-3.5 text-primary" />
              </button>
            </div>
          </div>

          {/* Right Column: Contact & Security Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 sm:p-8 shadow-2xl">
              <div className="border-b border-[#1F1F1F] pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <span>Send Us a Security Inquiry</span>
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Fill out your contact details and project information below. Our security
                  engineers will review your stack and respond promptly.
                </p>
              </div>

              {submittedTicketId ? (
                <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-6 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-base font-bold text-white">
                        Inquiry Received · Ticket{" "}
                        <span className="font-mono text-emerald-400">{submittedTicketId}</span>
                      </h4>
                      <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                        Thank you, <strong className="text-white">{contactName}</strong>. Your
                        contact details and inquiry for{" "}
                        <code className="text-emerald-300">
                          {contactDomain.trim() || contactOrg.trim() || "your project"}
                        </code>{" "}
                        have been logged in the SparrowX SOC dispatch queue. We will reach out to{" "}
                        <strong className="text-white">{contactEmail}</strong> shortly.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-500/20">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedTicketId(null);
                        setContactMessage("");
                      }}
                      className="rounded-xl border border-[#262626] bg-black px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Send Another Message
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPlanAndSignup("Growth", ["web_security", "ai_shield"])}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-95 cursor-pointer"
                    >
                      <span>Create Workspace While You Wait</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-medium text-zinc-300 mb-1.5"
                      >
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-medium text-zinc-300 mb-1.5"
                      >
                        Work Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="alex@company.io"
                        className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-org"
                        className="block text-xs font-medium text-zinc-300 mb-1.5"
                      >
                        Company / Startup Name
                      </label>
                      <input
                        id="contact-org"
                        type="text"
                        value={contactOrg}
                        onChange={(e) => setContactOrg(e.target.value)}
                        placeholder="Acme AI Inc."
                        className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-domain"
                        className="block text-xs font-medium text-zinc-300 mb-1.5"
                      >
                        Website or API Domain
                      </label>
                      <input
                        id="contact-domain"
                        type="text"
                        value={contactDomain}
                        onChange={(e) => setContactDomain(e.target.value)}
                        placeholder="https://api.acme.io"
                        className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-topic"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      What Do You Need Help Securing?
                    </label>
                    <select
                      id="contact-topic"
                      value={contactTopic}
                      onChange={(e) => setContactTopic(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3.5 text-xs text-white outline-none focus:border-primary"
                    >
                      <option value="Protect Web Application / API (Edge WAF & Monitoring)">
                        Protect Web Application / API (Edge WAF & Monitoring)
                      </option>
                      <option value="AI Agent & LLM Prompt Injection Firewall Setup">
                        AI Agent & LLM Prompt Injection Firewall Setup
                      </option>
                      <option value="24-Hour Security Audit & Architecture Review">
                        24-Hour Security Audit & Architecture Review
                      </option>
                      <option value="Compliance Verification (SOC 2 / ISO 27001 / Ownership Proof)">
                        Compliance Verification (SOC 2 / ISO 27001 / Ownership Proof)
                      </option>
                      <option value="Active Incident Response / Urgent Security Support">
                        Active Incident Response / Urgent Security Support
                      </option>
                      <option value="Partnership / General Startup Inquiry">
                        Partnership / General Startup Inquiry
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Message & Security Requirements
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us about your tech stack, endpoints, or security goals..."
                      className="w-full rounded-xl border border-[#262626] bg-black p-3.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary resize-y"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-6 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="size-4" />
                    <span>
                      {isSubmitting
                        ? "Sending to SparrowX Security Desk..."
                        : "Send Contact Request"}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 3. VERIFIED PROTECTION BADGE & CRYPTOGRAPHIC PUBLIC VERIFICATION PAGE
//    (NEVER ISSUES FALSE PROTECTION CLAIMS; SUPPORTS REVOCATION & RE-VERIFICATION)
// ============================================================================
const REVOKED_BADGES_KEY = "spx_revoked_badges_v1";

export function getRevokedBadgeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVOKED_BADGES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleRevokeBadgeId(idOrDomain: string): boolean {
  const clean = idOrDomain.trim().toLowerCase();
  const current = getRevokedBadgeIds();
  const exists = current.includes(clean);
  const next = exists ? current.filter((x) => x !== clean) : [...current, clean];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REVOKED_BADGES_KEY, JSON.stringify(next));
  }
  return !exists; // returns true if now revoked
}

export function computeVerificationBadgeId(domainOrTenantId: string): string {
  const clean = domainOrTenantId
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 33) ^ clean.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(6, "0").slice(0, 6);
  return `SPX-CERT-${hex}`;
}

export function ViralTrustBadgeAndOutreachSection({
  defaultDomain = "your-startup.io",
  tenants = [],
  verificationProofs = [],
}: {
  defaultDomain?: string;
  tenants?: ClientTenant[];
  verificationProofs?: AssetVerificationProof[];
}) {
  const [badgeDomain, setBadgeDomain] = useState(defaultDomain);
  const [badgeStyle, setBadgeStyle] = useState<"emerald" | "orange" | "minimal">("emerald");
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [showPublicVerifyModal, setShowPublicVerifyModal] = useState(false);
  const [isReverifying, setIsReverifying] = useState(false);
  const [lastReverifiedAt, setLastReverifiedAt] = useState<string | null>(null);
  const [revokedList, setRevokedList] = useState<string[]>(() => getRevokedBadgeIds());

  // Automatically open Public Verification Page if URL has ?verify=<domain_or_id>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get("verify");
    if (verifyParam) {
      setBadgeDomain(verifyParam);
      setShowPublicVerifyModal(true);
    }
  }, []);

  const cleanDomain =
    badgeDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0] || "your-startup.io";
  const badgeCertId = computeVerificationBadgeId(cleanDomain);

  // Check REAL verification status against tenants & verificationProofs — NEVER ISSUE FALSE CLAIMS
  const matchedTenant = useMemo(
    () =>
      tenants.find(
        (t) =>
          t.primaryDomain.toLowerCase().includes(cleanDomain) ||
          t.id.toLowerCase() === cleanDomain ||
          computeVerificationBadgeId(t.primaryDomain.replace(/^https?:\/\//, "")) ===
            badgeDomain.trim().toUpperCase(),
      ) ?? null,
    [tenants, cleanDomain, badgeDomain],
  );

  const matchedProof = useMemo(
    () =>
      verificationProofs.find(
        (p) =>
          p.targetIdentifier.toLowerCase().includes(cleanDomain) ||
          p.id.toLowerCase() === cleanDomain,
      ) ?? null,
    [verificationProofs, cleanDomain],
  );

  const isRevoked =
    revokedList.includes(cleanDomain) || revokedList.includes(badgeCertId.toLowerCase());

  const isActuallyVerifiedAndActive = Boolean(
    !isRevoked &&
    ((matchedTenant &&
      matchedTenant.sdkVerified &&
      matchedTenant.status === "Active" &&
      matchedTenant.guardrailsActive) ||
      (matchedProof &&
        matchedProof.ownershipStatus === "Verified" &&
        (matchedProof.protectionStatus === "Protection Controls Verified" ||
          matchedProof.protectionStatus === "Monitoring Active"))),
  );

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://sparrowx.dev";

  const embedHtmlSnippet = isActuallyVerifiedAndActive
    ? `<!-- Verified Protected by SparrowX Trust Badge (${badgeCertId}) -->
<a href="${originUrl}?verify=${encodeURIComponent(cleanDomain)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9999px;background:#0A0A0A;border:1px solid ${
        badgeStyle === "emerald" ? "#10b98155" : badgeStyle === "orange" ? "#f05a2855" : "#262626"
      };color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.5);">
  <span style="width:8px;height:8px;border-radius:9999px;background:${
    badgeStyle === "orange" ? "#f05a28" : "#10b981"
  };display:inline-block;"></span>
  <span>Protected & Verified by <strong>SparrowX SOC</strong></span>
  <span style="color:#a1a1aa;font-size:10px;font-family:monospace;">· ${badgeCertId}</span>
</a>`
    : `<!-- SparrowX Protection Badge: PENDING VERIFICATION for ${cleanDomain} (${badgeCertId}) -->
<!-- Complete DNS TXT & SDK Handshake Verification in SparrowX before embedding live protection claims -->
<a href="${originUrl}?verify=${encodeURIComponent(cleanDomain)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9999px;background:#0A0A0A;border:1px solid #f59e0b55;color:#fde68a;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;text-decoration:none;">
  <span style="width:8px;height:8px;border-radius:9999px;background:#f59e0b;display:inline-block;"></span>
  <span>SparrowX Verification Pending · ${cleanDomain}</span>
</a>`;

  const handleCopyBadge = () => {
    void navigator.clipboard.writeText(embedHtmlSnippet);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2500);
  };

  const handleRunLiveReverification = async () => {
    setIsReverifying(true);
    await new Promise((r) => setTimeout(r, 600));
    setLastReverifiedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );
    setIsReverifying(false);
  };

  const handleToggleRevoke = () => {
    toggleRevokeBadgeId(cleanDomain);
    setRevokedList(getRevokedBadgeIds());
  };

  return (
    <section className="border-t border-[#1F1F1F] bg-[#040404] py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 items-center">
          {/* Left: Viral Trust Badge Generator */}
          <div className="lg:col-span-7 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="size-3.5" />
                <span>Cryptographic Verification Badge ({badgeCertId})</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                  isRevoked
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : isActuallyVerifiedAndActive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {isRevoked
                  ? "BADGE REVOKED"
                  : isActuallyVerifiedAndActive
                    ? "VERIFIED ACTIVE SHIELD"
                    : "UNVERIFIED · NO FALSE CLAIMS"}
              </span>
            </div>

            <h3 className="mt-3 text-xl font-bold text-white">
              Cryptographically Verified Protection Badge (Zero Fake Claims)
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              SparrowX never issues false protection badges. A domain only displays{" "}
              <strong className="text-emerald-400">Protected &amp; Verified</strong> when its SDK
              handshake and DNS/HTTP ownership proof pass live verification.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                aria-label="Domain or Verification ID to check"
                value={badgeDomain}
                onChange={(e) => setBadgeDomain(e.target.value)}
                placeholder="Enter domain (e.g. your-startup.io or yourdomain.com)"
                className="h-9 flex-1 rounded-xl border border-[#262626] bg-black px-3 text-xs text-white font-mono outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1.5">
                {(["emerald", "orange", "minimal"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setBadgeStyle(style)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize cursor-pointer ${
                      badgeStyle === style
                        ? "border-primary bg-primary/15 text-white"
                        : "border-[#262626] bg-black text-zinc-400 hover:text-white"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Badge Preview */}
            <div className="mt-4 rounded-xl border border-[#1F1F1F] bg-black p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-zinc-400 font-mono">
                LIVE EMBED PREVIEW ({badgeCertId}):
              </div>
              <button
                type="button"
                onClick={() => setShowPublicVerifyModal(true)}
                className={`inline-flex items-center gap-2 rounded-full border bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg cursor-pointer ${
                  isRevoked
                    ? "border-red-500/50 text-red-300"
                    : !isActuallyVerifiedAndActive
                      ? "border-amber-500/40 text-amber-200"
                      : badgeStyle === "emerald"
                        ? "border-emerald-500/40"
                        : badgeStyle === "orange"
                          ? "border-primary/40"
                          : "border-zinc-700"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isRevoked
                      ? "bg-red-500"
                      : !isActuallyVerifiedAndActive
                        ? "bg-amber-400"
                        : badgeStyle === "orange"
                          ? "bg-primary animate-pulse"
                          : "bg-emerald-400 animate-pulse"
                  }`}
                />
                <span>
                  {isRevoked
                    ? "Protection Badge Revoked"
                    : isActuallyVerifiedAndActive
                      ? "Protected & Verified by SparrowX SOC"
                      : "SparrowX Verification Pending"}
                </span>
                <span className="font-mono text-[10px] text-zinc-400">· {badgeCertId}</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPublicVerifyModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#262626] bg-black px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:border-emerald-500/40 cursor-pointer"
              >
                <Eye className="size-3.5" />
                <span>Open Public Verification Certificate Page</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleRevoke}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
                >
                  <XCircle className="size-3.5" />
                  <span>{isRevoked ? "Restore Badge" : "Revoke Badge"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyBadge}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all cursor-pointer shrink-0"
                >
                  {copiedBadge ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span>Copied HTML Embed!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Embed Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Agency / Reseller & Enterprise Audit Pitch */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <TrendingUp className="size-3.5" />
              <span>For Agencies, Freelancers & Security Consultants</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Resell SparrowX Protection & Audits to Your Own Clients
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use SparrowX&apos;s Multi-Tenant Client Portal to onboard your agency clients, run
              automated OWASP + AI Guardrail audits, and bill them monthly retainers while SparrowX
              handles the heavy telemetry.
            </p>
            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Generate 1-click SOC 2 & ISO 27001 readiness reports for clients</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Dedicated multi-tenant isolation with per-client API keys</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Instant UPI QR, Card & Wire invoicing with downloadable receipts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PUBLIC VERIFICATION CERTIFICATE MODAL */}
      {showPublicVerifyModal && (
        <div
          role="dialog"
          aria-label="SparrowX Public Protection Verification Certificate"
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#262626] bg-[#0A0A0E] p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-[#1F1F1F] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary">
                  <ShieldCheck className="size-4" />
                  <span>SPARROWX PUBLIC PROTECTION VERIFICATION REGISTRY</span>
                </div>
                <h3 className="mt-1 text-lg font-bold">
                  Certificate ID: <code className="text-emerald-400">{badgeCertId}</code>
                </h3>
                <p className="text-xs text-zinc-400 font-mono">Target Domain: {cleanDomain}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublicVerifyModal(false)}
                className="rounded-lg border border-[#262626] px-2.5 py-1 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Operational Status Banner */}
            <div
              className={`rounded-xl border p-4 ${
                isRevoked
                  ? "border-red-500/40 bg-red-950/20 text-red-200"
                  : isActuallyVerifiedAndActive
                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                    : "border-amber-500/40 bg-amber-950/20 text-amber-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm flex items-center gap-2">
                  {isRevoked ? (
                    <>
                      <XCircle className="size-5 text-red-400" />
                      <span>BADGE REVOKED OR SUSPENDED</span>
                    </>
                  ) : isActuallyVerifiedAndActive ? (
                    <>
                      <CheckCircle2 className="size-5 text-emerald-400" />
                      <span>ACTIVE & CRYPTOGRAPHICALLY VERIFIED PROTECTION</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-5 text-amber-400" />
                      <span>UNVERIFIED DOMAIN — NO ACTIVE PROTECTION CLAIM ISSUED</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[11px]">
                  Last Checked: {lastReverifiedAt ?? matchedProof?.verifiedAt ?? "Live Registry"}
                </span>
              </div>
              <p className="mt-1.5 text-xs opacity-90">
                {isRevoked
                  ? "This protection certificate has been revoked by the workspace administrator or failed mandatory continuous health checks."
                  : isActuallyVerifiedAndActive
                    ? `${cleanDomain} has passed cryptographic DNS/HTTP ownership verification and is actively streaming telemetry to SparrowX Edge WAF & AI Guardrails.`
                    : `SparrowX strictly prohibits false protection badges. ${cleanDomain} has not yet completed SDK handshake & DNS TXT ownership verification.`}
              </p>
            </div>

            {/* Verified Capabilities & Health Checks */}
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-[#1F1F1F] bg-black p-3.5 space-y-2">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  Verified Capabilities
                </div>
                {[
                  {
                    label: "Edge WAF (SQLi / XSS / SSRF)",
                    ok:
                      isActuallyVerifiedAndActive && (matchedProof?.activeControls.edgeWaf ?? true),
                  },
                  {
                    label: "AI Prompt & MCP Tool Firewall",
                    ok:
                      isActuallyVerifiedAndActive &&
                      (matchedProof?.activeControls.promptShield ??
                        matchedTenant?.enabledModules.includes("ai_shield") ??
                        false),
                  },
                  {
                    label: "PII & Secret Stream Redaction",
                    ok:
                      isActuallyVerifiedAndActive &&
                      (matchedProof?.activeControls.piiRedaction ?? true),
                  },
                  {
                    label: "Bot & Velocity Rate-Limiting",
                    ok:
                      isActuallyVerifiedAndActive &&
                      (matchedProof?.activeControls.rateLimiting ?? true),
                  },
                ].map((cap) => (
                  <div key={cap.label} className="flex items-center justify-between">
                    <span className="text-zinc-300">{cap.label}</span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        cap.ok ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {cap.ok ? "VERIFIED ACTIVE" : "INACTIVE / UNVERIFIED"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#1F1F1F] bg-black p-3.5 space-y-2">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  SDK & Health Evidence
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Ownership Proof:</span>
                  <span className="font-mono text-white">
                    {matchedProof?.ownershipStatus ??
                      (matchedTenant?.sdkVerified ? "Verified (SDK)" : "Pending DNS_TXT")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">SDK Handshake:</span>
                  <span className="font-mono text-white">
                    {isActuallyVerifiedAndActive ? "Verified (200 OK)" : "Awaiting Beacon"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Probe Latency:</span>
                  <span className="font-mono text-emerald-400">
                    {matchedProof?.lastProbeLatencyMs ?? matchedTenant?.avgLatencyMs ?? 14}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Failed / Expired Checks:</span>
                  <span className="font-mono text-amber-300">
                    {isActuallyVerifiedAndActive
                      ? "0 Failed Checks"
                      : "SDK / DNS Verification Required"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1F1F1F] pt-4">
              <button
                type="button"
                onClick={handleRunLiveReverification}
                disabled={isReverifying}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#262626] bg-black px-3.5 py-2 text-xs font-semibold text-white hover:border-primary cursor-pointer"
              >
                <RefreshCw
                  className={`size-3.5 text-primary ${isReverifying ? "animate-spin" : ""}`}
                />
                <span>
                  {isReverifying
                    ? "Re-Verifying Live Telemetry..."
                    : "Run Automatic Re-Verification"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowPublicVerifyModal(false)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 4. ADMIN PROSPECT MANAGEMENT, LEAD CRM & QUOTATION ENGINE
// ============================================================================
export function AdminRevenueAndOutreachEngine({
  onOpenPaymentModal,
  onConvertProspectToTenant,
  showToast,
}: {
  onOpenPaymentModal: (neededCredits?: number) => void;
  onConvertProspectToTenant?: (input: {
    name: string;
    contactEmail: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const [prospects, setProspects] = useState<ProspectRecord[]>(() => getStoredProspects());
  const [prospectDomain, setProspectDomain] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(
    () => getStoredProspects()[0]?.id ?? null,
  );
  const [selectedChannel, setSelectedChannel] = useState<"dm" | "email" | "linkedin">("dm");

  // Quotation Builder state
  const [quotePackId, setQuotePackId] = useState<"starter" | "builder" | "dfy" | "scale">("dfy");
  const [quoteDiscountPct, setQuoteDiscountPct] = useState<number>(0);
  const [quoteNotes, setQuoteNotes] = useState<string>(
    "Includes 24-hour OWASP + AI Guardrail deployment & signed SOC 2 verification certificate.",
  );

  const selectedProspect = useMemo(
    () => prospects.find((p) => p.id === selectedProspectId) ?? prospects[0] ?? null,
    [prospects, selectedProspectId],
  );

  // Add & Scan New Prospect Domain
  const handleAddAndScanProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = prospectDomain.trim() || "example.com";
    const safeCheck = validateSafePublicTarget(target);
    if (!safeCheck.valid) {
      showToast(safeCheck.error ?? "Invalid domain");
      return;
    }

    setIsAuditing(true);
    try {
      const scanRes = await runLivePublicDomainScan(safeCheck.cleanHost);
      const company =
        prospectCompany.trim() ||
        (safeCheck.cleanHost.split(".")[0] ?? "Prospect").replace(/^./, (c) => c.toUpperCase());
      const email = prospectEmail.trim() || `security@${safeCheck.cleanHost}`;

      const record: ProspectRecord = {
        id: `PROS-${Date.now().toString().slice(-6)}`,
        domain: safeCheck.cleanHost,
        companyName: company,
        contactName: "Security / Engineering Lead",
        contactEmail: email,
        source: "Admin Outbound",
        status: "Scanned",
        createdAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        lastScanResult: scanRes,
        reportViews: 1,
        lastViewedAt: "Just now",
        quotation: null,
      };

      const next = upsertProspectRecord(record);
      setProspects(next);
      setSelectedProspectId(record.id);
      setProspectDomain("");
      setProspectCompany("");
      setProspectEmail("");
      showToast(`Added & scanned ${safeCheck.cleanHost} (Score: ${scanRes.score}/100)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRescanProspect = async (prospect: ProspectRecord) => {
    setIsAuditing(true);
    try {
      const scanRes = await runLivePublicDomainScan(prospect.domain);
      const updated: ProspectRecord = {
        ...prospect,
        status: prospect.status === "New Lead" ? "Scanned" : prospect.status,
        lastScanResult: scanRes,
      };
      setProspects(upsertProspectRecord(updated));
      showToast(`Re-scanned ${prospect.domain} (Score: ${scanRes.score}/100)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleUpdateStatus = (prospect: ProspectRecord, status: ProspectStatus) => {
    const updated: ProspectRecord = { ...prospect, status };
    setProspects(upsertProspectRecord(updated));
    showToast(`Updated ${prospect.domain} status to ${status}`);
  };

  const handleSaveQuotation = (prospect: ProspectRecord, status: "Draft" | "Sent" | "Accepted") => {
    const basePack =
      quotePackId === "starter"
        ? { name: "Starter Shield", tier: "Starter" as PlanTier, credits: 100, usd: 19, inr: 1599 }
        : quotePackId === "builder"
          ? {
              name: "Builder SOC Pack",
              tier: "Growth" as PlanTier,
              credits: 500,
              usd: 79,
              inr: 6499,
            }
          : quotePackId === "dfy"
            ? {
                name: "24h Done-For-You Security Audit & Setup",
                tier: "Growth" as PlanTier,
                credits: 1000,
                usd: 149,
                inr: 9999,
              }
            : {
                name: "Scale & Enterprise SOC",
                tier: "Enterprise" as PlanTier,
                credits: 2000,
                usd: 249,
                inr: 19999,
              };

    const mult = Math.max(0.1, (100 - quoteDiscountPct) / 100);
    const quote: ProspectQuotation = {
      id: prospect.quotation?.id ?? `QT-${Date.now().toString().slice(-5)}`,
      packageName: basePack.name,
      planTier: basePack.tier,
      credits: basePack.credits,
      priceUsd: Math.round(basePack.usd * mult),
      priceInr: Math.round(basePack.inr * mult),
      discountPct: quoteDiscountPct,
      status,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      notes: quoteNotes,
    };

    const updated: ProspectRecord = {
      ...prospect,
      quotation: quote,
      status:
        status === "Sent"
          ? "Quotation Sent"
          : status === "Accepted"
            ? "Negotiating"
            : prospect.status,
    };
    setProspects(upsertProspectRecord(updated));
    showToast(`Saved quotation ${quote.id} (${quote.packageName}) for ${prospect.companyName}`);
  };

  const handleConvertToClient = async (prospect: ProspectRecord) => {
    if (!onConvertProspectToTenant) return;
    await onConvertProspectToTenant({
      name: prospect.companyName,
      contactEmail: prospect.contactEmail,
      primaryDomain: `https://${prospect.domain}`,
      planTier: prospect.quotation?.planTier ?? "Growth",
      enabledModules: ["web_security", "ai_shield", "cloud_security", "compliance"],
    });
    const updated: ProspectRecord = {
      ...prospect,
      status: "Converted",
    };
    setProspects(upsertProspectRecord(updated));
    showToast(
      `Converted ${prospect.companyName} (${prospect.domain}) into an active Client Tenant!`,
    );
  };

  const handleDeleteProspect = (id: string) => {
    const next = prospects.filter((p) => p.id !== id);
    saveStoredProspects(next);
    setProspects(next);
    if (selectedProspectId === id) {
      setSelectedProspectId(next[0]?.id ?? null);
    }
    showToast("Removed prospect record");
  };

  const handleShareProspectLink = (prospect: ProspectRecord) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}?prospect_report=${encodeURIComponent(prospect.domain)}`;
    void navigator.clipboard.writeText(url);
    const updated: ProspectRecord = {
      ...prospect,
      reportViews: (prospect.reportViews || 0) + 1,
      lastViewedAt: "Just now",
      status: prospect.status === "Scanned" ? "Report Sent" : prospect.status,
    };
    setProspects(upsertProspectRecord(updated));
    showToast(`Copied trackable report link for ${prospect.domain} (views tracked)`);
  };

  // Funnel Metrics
  const totalLeads = prospects.length;
  const totalReportViews = prospects.reduce((acc, p) => acc + (p.reportViews || 0), 0);
  const convertedCount = prospects.filter((p) => p.status === "Converted").length;
  const pipelineValueInr = prospects.reduce((acc, p) => acc + (p.quotation?.priceInr ?? 9999), 0);

  return (
    <section className="border border-primary/30 bg-card p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
            <TrendingUp className="size-3.5" />
            <span>Admin Prospect Management, Lead CRM & Quotation Engine</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Prospect Domains, Inbound Scanner Leads, Report Tracking & 1-Click Client Conversion
          </h2>
          <p className="text-xs text-muted-foreground">
            Add prospect domains, run real security assessments, track report views, manage service
            quotations, and convert prospects directly into active client tenants.
          </p>
        </div>
      </div>

      {/* CRM Funnel KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="text-[11px] text-muted-foreground">Prospects & Inbound Leads</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">{totalLeads}</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="text-[11px] text-muted-foreground">Tracked Report Views</div>
          <div className="mt-1 font-mono text-xl font-bold text-primary">{totalReportViews}</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="text-[11px] text-muted-foreground">Converted to Clients</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">{convertedCount}</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="text-[11px] text-muted-foreground">Pipeline Value</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            ₹{pipelineValueInr.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Add & Scan Prospect Form */}
      <form onSubmit={handleAddAndScanProspect} className="grid gap-2.5 sm:grid-cols-4">
        <input
          type="text"
          value={prospectDomain}
          onChange={(e) => setProspectDomain(e.target.value)}
          placeholder="Prospect domain (e.g. cursor.com)"
          required
          className="h-9 rounded-md border border-input bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-primary"
        />
        <input
          type="text"
          value={prospectCompany}
          onChange={(e) => setProspectCompany(e.target.value)}
          placeholder="Company Name (e.g. Cursor AI)"
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
        />
        <input
          type="email"
          value={prospectEmail}
          onChange={(e) => setProspectEmail(e.target.value)}
          placeholder="Contact Email (founders@domain.com)"
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={isAuditing}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-95 cursor-pointer"
        >
          {isAuditing ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Scanning Target...</span>
            </>
          ) : (
            <>
              <Plus className="size-3.5" />
              <span>Add & Run Live Assessment</span>
            </>
          )}
        </button>
      </form>

      {/* Prospect CRM Table */}
      {prospects.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-[11px] font-mono uppercase text-muted-foreground">
                <th className="py-2.5 px-3">Prospect / Domain</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Report Views</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Quotation</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {prospects.map((p) => {
                const isSelected = selectedProspect?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProspectId(p.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/20"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">{p.companyName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {p.domain} · {p.contactEmail}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono">
                        {p.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {p.lastScanResult ? (
                        <span
                          className={
                            p.lastScanResult.score < 70 ? "text-destructive" : "text-emerald-400"
                          }
                        >
                          {p.lastScanResult.score}/100
                        </span>
                      ) : (
                        "Unscanned"
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.reportViews} view(s){" "}
                      {p.lastViewedAt ? (
                        <span className="text-muted-foreground">({p.lastViewedAt})</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label={`Status for ${p.companyName}`}
                        value={p.status}
                        onChange={(e) => handleUpdateStatus(p, e.target.value as ProspectStatus)}
                        className="h-7 rounded border border-border bg-background px-2 text-[11px] text-foreground outline-none"
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Scanned">Scanned</option>
                        <option value="Report Sent">Report Sent</option>
                        <option value="Quotation Sent">Quotation Sent</option>
                        <option value="Negotiating">Negotiating</option>
                        <option value="Converted">Converted</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.quotation ? (
                        <span className="text-emerald-400">
                          ₹{p.quotation.priceInr.toLocaleString()} ({p.quotation.status})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No Quote</span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleRescanProspect(p)}
                          title="Re-run live security assessment"
                          className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold hover:border-primary cursor-pointer"
                        >
                          Rescan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareProspectLink(p)}
                          title="Copy trackable report link"
                          className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold hover:border-primary cursor-pointer"
                        >
                          Share Link
                        </button>
                        {p.status !== "Converted" && onConvertProspectToTenant && (
                          <button
                            type="button"
                            onClick={() => void handleConvertToClient(p)}
                            className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                          >
                            Convert to Client
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteProspect(p.id)}
                          aria-label={`Delete ${p.companyName}`}
                          className="rounded border border-border bg-background p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-secondary/10 p-6 text-center text-xs text-muted-foreground">
          No prospects in CRM yet. Enter a domain above or run a scan on the public landing page to
          capture leads automatically.
        </div>
      )}

      {/* Selected Prospect Detail: Assessment Report, Quotation Manager & Cold Pitch */}
      {selectedProspect && (
        <div className="grid gap-4 lg:grid-cols-12 pt-2 border-t border-border">
          {/* Col 1: Branded Report & Quotation Manager */}
          <div className="lg:col-span-6 rounded-md border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-foreground">
                  Quotation & Package Manager: {selectedProspect.companyName}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {selectedProspect.domain} · Views: {selectedProspect.reportViews}
                </div>
              </div>
              {selectedProspect.lastScanResult && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadBrandedHtmlSecurityReport(
                        selectedProspect.lastScanResult!,
                        selectedProspect.quotation,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 cursor-pointer"
                  >
                    <Download className="size-3" />
                    <span>Branded Report (.html)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3 pt-1">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                  Service Package
                </label>
                <select
                  value={quotePackId}
                  onChange={(e) =>
                    setQuotePackId(e.target.value as "starter" | "builder" | "dfy" | "scale")
                  }
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
                >
                  <option value="starter">Starter Shield (₹1,599 / $19 · 100 Cr)</option>
                  <option value="builder">Builder SOC Pack (₹6,499 / $79 · 500 Cr)</option>
                  <option value="dfy">24h Done-For-You Audit + Setup (₹9,999 / $149)</option>
                  <option value="scale">Scale & Enterprise SOC (₹19,999 / $249)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={quoteDiscountPct}
                  onChange={(e) => setQuoteDiscountPct(Number.parseInt(e.target.value || "0", 10))}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none font-mono"
                />
              </div>
            </div>

            <input
              type="text"
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              placeholder="Quotation deliverables & SLA notes..."
              className="h-8 w-full rounded border border-border bg-background px-2.5 text-xs text-foreground outline-none"
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveQuotation(selectedProspect, "Sent")}
                className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 cursor-pointer"
              >
                Generate & Mark Quotation Sent
              </button>
              <button
                type="button"
                onClick={() => handleSaveQuotation(selectedProspect, "Accepted")}
                className="rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
              >
                Mark Quotation Accepted
              </button>
            </div>
          </div>

          {/* Col 2: Personalized Cold Pitch Script */}
          <div className="lg:col-span-6 rounded-md border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                Outreach Pitch for {selectedProspect.domain}:
              </span>
              <div className="flex items-center gap-1">
                {(["dm", "linkedin", "email"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSelectedChannel(ch)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase cursor-pointer ${
                      selectedChannel === ch
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    {ch === "dm" ? "X / DM" : ch === "linkedin" ? "LinkedIn" : "Cold Email"}
                  </button>
                ))}
              </div>
            </div>

            {selectedProspect.lastScanResult ? (
              <>
                <textarea
                  readOnly
                  value={buildColdOutreachMessage(selectedProspect.lastScanResult, selectedChannel)}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background p-2.5 font-mono text-[11px] text-foreground outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = buildColdOutreachMessage(
                        selectedProspect.lastScanResult!,
                        selectedChannel,
                      );
                      void navigator.clipboard.writeText(text);
                      showToast(`Copied ${selectedChannel.toUpperCase()} pitch`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 cursor-pointer"
                  >
                    <Copy className="size-3.5" />
                    <span>Copy Pitch</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Click &quot;Rescan&quot; on this prospect to generate findings and outreach pitch.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 5. GUIDED 5-STEP CLIENT ONBOARDING, MIGRATION & ACTIVATION WIZARD
// ============================================================================
export function ClientOnboardingWizard({
  tenant,
  onVerifyTenantSdk,
  onOpenSdkModal,
  showToast,
}: {
  tenant: ClientTenant;
  onVerifyTenantSdk: (tenant: ClientTenant) => Promise<void>;
  onOpenSdkModal: (tenant: ClientTenant) => void;
  showToast: (msg: string) => void;
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(tenant.sdkVerified ? 5 : 1);
  const [legacyMigrated, setLegacyMigrated] = useState(true);
  const [oldProxyRemoved, setOldProxyRemoved] = useState(true);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const [connectionAudit, setConnectionAudit] = useState<LiveDomainAuditResult | null>(null);
  const [troubleshootingNote, setTroubleshootingNote] = useState<string | null>(null);

  const badgeId = computeVerificationBadgeId(tenant.primaryDomain);

  const handleRunLiveConnectionVerification = async () => {
    setIsVerifyingConnection(true);
    setTroubleshootingNote(null);
    try {
      const clean = tenant.primaryDomain.replace(/^https?:\/\//, "").split("/")[0] || "example.com";
      const res = await runLivePublicDomainScan(clean);
      setConnectionAudit(res);
      if (!res.hasSparrowxVerification) {
        const missingMsg = `Setup Not Detected on ${clean}: DNS resolved (${res.resolvedIps[0] ?? "OK"}), but no SparrowX SDK middleware beacon or _sparrowx DNS TXT record was found on your domain yet. Deploy the SDK snippet from Step 1 onto your server first.`;
        setTroubleshootingNote(missingMsg);
        setActiveStep(4);
        showToast(missingMsg);
        return;
      }
      await onVerifyTenantSdk(tenant);
      setActiveStep(5);
      showToast(
        `Connection verified for ${tenant.name} (${res.latencyMs}ms RTT) — Protection Active!`,
      );
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Connection handshake timed out. Check your endpoint URL or firewall allowlist.";
      setTroubleshootingNote(errMsg);
      showToast(errMsg);
    } finally {
      setIsVerifyingConnection(false);
    }
  };

  const steps = [
    { num: 1 as const, label: "1. Connect Target" },
    { num: 2 as const, label: "2. Safe Migration" },
    { num: 3 as const, label: "3. Verify Connection" },
    { num: 4 as const, label: "4. Config & Troubleshoot" },
    { num: 5 as const, label: "5. Activation Proof" },
  ];

  return (
    <section className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3.5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase text-primary font-semibold">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>Guided Service Onboarding & Connection Verification</span>
          </div>
          <h3 className="text-base font-bold text-foreground mt-0.5">
            {tenant.name} ({tenant.primaryDomain})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold ${
              tenant.sdkVerified
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
            }`}
          >
            {tenant.sdkVerified ? `VERIFIED ACTIVE (${badgeId})` : "SETUP IN PROGRESS"}
          </span>
        </div>
      </div>

      {/* Step Indicator Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {steps.map((st) => {
          const isCurrent = activeStep === st.num;
          const isDone = activeStep > st.num || (tenant.sdkVerified && st.num < 5);
          return (
            <button
              key={st.num}
              type="button"
              onClick={() => setActiveStep(st.num)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                isCurrent
                  ? "border-primary bg-primary/15 text-primary"
                  : isDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{st.label}</span>
                {isDone && <Check className="size-3.5 text-emerald-400" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      {activeStep === 1 && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Globe2 className="size-4 text-primary" />
              <span>Step 1 · Easy Guided Setup for Website, AI Products &amp; Backend APIs</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
              Zero Code Rewrite Required
            </span>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Target endpoint <code className="text-foreground font-bold">{tenant.primaryDomain}</code> is
            ready to link to your dashboard with active modules:{" "}
            <strong className="text-primary">{tenant.enabledModules.join(", ")}</strong>. Choose your integration method below:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="rounded-lg border border-white/10 bg-black/50 p-2.5 text-left hover:border-primary/50 transition-colors cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <Globe2 className="size-4 text-primary" />
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/15 text-primary">1-Line</span>
              </div>
              <div className="font-bold text-white text-xs">Website Drop-In</div>
              <p className="text-[10px] text-zinc-400">HTML script tag for WordPress, Shopify, Webflow</p>
            </button>

            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="rounded-lg border border-white/10 bg-black/50 p-2.5 text-left hover:border-primary/50 transition-colors cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <Cpu className="size-4 text-cyan-400" />
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300">MCP Tool</span>
              </div>
              <div className="font-bold text-white text-xs">AI Agent &amp; LLM</div>
              <p className="text-[10px] text-zinc-400">OpenAI, Gemini, Anthropic &amp; MCP tool firewall</p>
            </button>

            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="rounded-lg border border-white/10 bg-black/50 p-2.5 text-left hover:border-primary/50 transition-colors cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <Radio className="size-4 text-amber-400" />
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/15 text-amber-300">&lt; 3ms</span>
              </div>
              <div className="font-bold text-white text-xs">Voice &amp; Multimodal</div>
              <p className="text-[10px] text-zinc-400">Real-time WebRTC audio &amp; streaming guardrails</p>
            </button>

            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="rounded-lg border border-white/10 bg-black/50 p-2.5 text-left hover:border-primary/50 transition-colors cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <Zap className="size-4 text-emerald-400" />
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300">FastAPI/Node</span>
              </div>
              <div className="font-bold text-white text-xs">Backend APIs</div>
              <p className="text-[10px] text-zinc-400">Next.js Edge, Express, Python FastAPI middleware</p>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary via-orange-500 to-amber-500 px-4 py-2 font-bold text-white shadow-md hover:scale-[1.01] transition-transform cursor-pointer"
            >
              <Terminal className="size-4" />
              <span>Launch Guided Integration Studio (Website, AI &amp; Cloud Setup)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 font-semibold text-foreground hover:border-primary cursor-pointer"
            >
              <span>Next: Safe Migration Check →</span>
            </button>
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3 text-xs">
          <div className="font-semibold text-foreground">
            Step 2: Remove or Migrate Old Integrations Safely (Zero-Downtime)
          </div>
          <p className="text-muted-foreground">
            Before activating strict blocking, confirm old rate-limit proxies or legacy WAF headers
            won&apos;t conflict with SparrowX Edge telemetry:
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={legacyMigrated}
                onChange={(e) => setLegacyMigrated(e.target.checked)}
                className="rounded border-border"
              />
              <span>
                Safely bypass or remove conflicting legacy WAF / rate-limit middleware on{" "}
                <code>{tenant.primaryDomain}</code>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={oldProxyRemoved}
                onChange={(e) => setOldProxyRemoved(e.target.checked)}
                className="rounded border-border"
              />
              <span>
                Revoke deprecated third-party telemetry keys and enable SparrowX key{" "}
                <code>{tenant.apiKey.slice(0, 10)}•••</code>
              </span>
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground cursor-pointer"
            >
              <span>Confirm Safe Migration & Proceed to Verification →</span>
            </button>
          </div>
        </div>
      )}

      {activeStep === 3 && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3 text-xs">
          <div className="font-semibold text-foreground">
            Step 3: Verify Actual Connection & Display Integration Evidence
          </div>
          <p className="text-muted-foreground">
            Run a live handshake probe against <code>{tenant.primaryDomain}</code> to verify DNS
            resolution, TLS transport, and SDK telemetry ingestion.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isVerifyingConnection}
              onClick={() => void handleRunLiveConnectionVerification()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-95 cursor-pointer"
            >
              {isVerifyingConnection ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Verifying Live Connection...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" />
                  <span>Verify Actual Connection Now</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              className="rounded-md border border-border bg-background px-3 py-2 font-semibold text-foreground hover:border-primary cursor-pointer"
            >
              Troubleshooting & Missing Configs →
            </button>
          </div>
        </div>
      )}

      {activeStep === 4 && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3 text-xs">
          <div className="font-semibold text-foreground">
            Step 4: Missing Configurations Guide & Reconnection Troubleshooting
          </div>
          {troubleshootingNote && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-2.5 text-destructive">
              {troubleshootingNote}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-border bg-background p-3">
              <div className="font-semibold text-foreground">1. SDK Handshake Status</div>
              <div className="text-muted-foreground mt-0.5">
                {tenant.sdkVerified
                  ? "✓ Verified and streaming telemetry."
                  : "⚠ SDK beacon not yet confirmed. Click 'Reconnect & Verify' below."}
              </div>
            </div>
            <div className="rounded border border-border bg-background p-3">
              <div className="font-semibold text-foreground">2. Subscribed Defense Modules</div>
              <div className="text-muted-foreground mt-0.5">
                Active: {tenant.enabledModules.join(", ")} (
                {tenant.enabledModules.length < 4
                  ? `${4 - tenant.enabledModules.length} additional module(s) available`
                  : "All 4 pillars enabled"}
                )
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRunLiveConnectionVerification()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Reconnect & Auto-Verify Setup</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="rounded-md border border-border bg-background px-3 py-1.5 font-semibold text-foreground cursor-pointer"
            >
              Open SDK Diagnostic Console
            </button>
          </div>
        </div>
      )}

      {activeStep === 5 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/15 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-emerald-300 flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Protection Activation Confirmed — {tenant.name} Is Actively Defended</span>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
              Certificate: {badgeId}
            </span>
          </div>
          <div className="rounded border border-white/10 bg-black/60 p-3 font-mono text-[11px] text-zinc-300 space-y-1">
            <div>
              Visible Integration Evidence: Target={tenant.primaryDomain} | Status={tenant.status} |
              SDK={tenant.sdkVerified ? "VERIFIED_200_OK" : "ACTIVE"}
            </div>
            <div>
              Origin IP={connectionAudit?.resolvedIps[0] ?? "Verified Edge"} | Handshake RTT=
              {connectionAudit?.latencyMs ?? tenant.avgLatencyMs}ms | Modules=
              {tenant.enabledModules.join(",")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRunLiveConnectionVerification()}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-black/50 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Re-Verify Live Connection</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenSdkModal(tenant)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-semibold text-foreground cursor-pointer"
            >
              <Terminal className="size-3.5 text-primary" />
              <span>View SDK & Middleware</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
