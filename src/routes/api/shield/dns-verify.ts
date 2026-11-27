import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import { createFileRoute } from "@tanstack/react-router";

const EDGE_CNAME_TARGET = "edge.sparrowx.net";
const VALID_DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

interface DohAnswer {
  type: number;
  data: string;
}

async function queryDoh(name: string, type: "A" | "CNAME" | "TXT"): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { Answer?: DohAnswer[] };
    return (data.Answer ?? []).map((a) => String(a.data || "").replace(/^"|"$/g, "").replace(/\.$/, ""));
  } catch {
    return [];
  }
}

function isSafePublicDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (
    domain === "localhost" ||
    domain.endsWith(".local") ||
    domain.endsWith(".internal") ||
    domain.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)
  ) {
    return false;
  }
  return VALID_DOMAIN_RE.test(domain);
}

export const Route = createFileRoute("/api/shield/dns-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`shield-dns-verify:${ip}`, 20, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              {
                status: 429,
                headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" },
              },
            );
          }

          const payload = (await request.json().catch(() => null)) as {
            domain?: string;
            verifyToken?: string;
          } | null;

          const domain = normalizeDomain(String(payload?.domain || ""));
          const verifyToken = String(payload?.verifyToken || "").trim().slice(0, 96);

          if (!isSafePublicDomain(domain)) {
            return Response.json(
              { ok: false, error: "Invalid public domain name." },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }

          const txtHost = `_sparrowx-verify.${domain}`;

          // Run Node DNS + Cloudflare DoH in parallel for reliable live propagation detection
          const [
            nodeCnames,
            dohCnames,
            nodeIps,
            dohIps,
            edgeIpsNode,
            edgeIpsDoh,
            nodeTxts,
            dohTxts,
          ] = await Promise.all([
            resolveCname(domain).catch(() => [] as string[]),
            queryDoh(domain, "CNAME"),
            resolve4(domain).catch(() => [] as string[]),
            queryDoh(domain, "A"),
            resolve4(EDGE_CNAME_TARGET).catch(() => [] as string[]),
            queryDoh(EDGE_CNAME_TARGET, "A"),
            resolveTxt(txtHost)
              .then((rows) => rows.map((parts) => parts.join("")))
              .catch(() => [] as string[]),
            queryDoh(txtHost, "TXT"),
          ]);

          const observedCnames = Array.from(
            new Set(
              [...nodeCnames, ...dohCnames]
                .map((c) => c.toLowerCase().replace(/\.$/, ""))
                .filter(Boolean),
            ),
          );
          const observedIps = Array.from(new Set([...nodeIps, ...dohIps].filter(Boolean)));
          const edgeIps = Array.from(new Set([...edgeIpsNode, ...edgeIpsDoh].filter(Boolean)));
          const observedTxts = Array.from(new Set([...nodeTxts, ...dohTxts].filter(Boolean)));

          const directCnameMatch = observedCnames.some((c) => c === EDGE_CNAME_TARGET);
          // Cloudflare flattens apex (@) CNAME records into the target's IPv4 A records
          const flattenedMatch =
            !directCnameMatch &&
            edgeIps.length > 0 &&
            observedIps.some((ip) => edgeIps.includes(ip));

          const cnameVerified = directCnameMatch || flattenedMatch;
          const txtVerified = verifyToken
            ? observedTxts.some((entry) => entry.includes(verifyToken))
            : observedTxts.some((entry) => entry.includes("spx-verify="));

          return Response.json(
            {
              ok: true,
              domain,
              cnameVerified,
              txtVerified,
              flattenedMatch,
              observedCnames,
              observedIps,
              observedTxts,
              checkedAt: new Date().toISOString(),
            },
            {
              status: 200,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch {
          return Response.json(
            {
              ok: false,
              error: "Live DNS lookup failed. Please retry shortly.",
            },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
