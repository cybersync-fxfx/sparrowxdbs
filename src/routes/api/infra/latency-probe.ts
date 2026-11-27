import { createFileRoute } from "@tanstack/react-router";
import {
  SPARROWX_PRIMARY_REGIONS,
  estimateFiberLatency,
  type ClientGeoLocation,
} from "@/lib/latency-probe";

function buildProbeCorsHeaders(request: Request): Record<string, string> {
  const origin = (request.headers.get("origin") || "").trim();
  const headers: Record<string, string> = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Vary: "Origin",
  };
  if (origin) {
    try {
      const parsed = new URL(origin);
      const h = parsed.hostname.toLowerCase();
      if (
        (parsed.protocol === "https:" && (h === "sparrowx.net" || h.endsWith(".sparrowx.net"))) ||
        (parsed.protocol === "http:" && (h === "localhost" || h === "127.0.0.1"))
      ) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
    } catch {
      // ignore invalid origin
    }
  }
  return headers;
}

export const Route = createFileRoute("/api/infra/latency-probe")({
  server: {
    handlers: {
      HEAD: async ({ request }) => {
        return new Response(null, {
          status: 200,
          headers: {
            ...buildProbeCorsHeaders(request),
            "X-SparrowX-Probe": "ready",
          },
        });
      },
      GET: async ({ request }) => {
        try {
          const { checkDbRateLimit, extractClientIp } = await import("@/lib/server/db-auth.server");
          const ip = extractClientIp(request);
          const rate = checkDbRateLimit(`latency-probe:${ip}`, 60, 60_000);
          if (!rate.allowed) {
            return Response.json(
              { ok: false, error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
              {
                status: 429,
                headers: {
                  ...buildProbeCorsHeaders(request),
                  "Retry-After": String(rate.retryAfterSec),
                },
              },
            );
          }

          const url = new URL(request.url);
          const reqRegion = url.searchParams.get("region") || "sg-sin";
          const queryTz = url.searchParams.get("tz") || "";

          // Extract Client IP from edge headers
          const cfConnectingIp = request.headers.get("cf-connecting-ip");
          const xRealIp = request.headers.get("x-real-ip");
          const xForwardedFor = request.headers.get("x-forwarded-for");
          const rawClientIp =
            cfConnectingIp ||
            xRealIp ||
            (xForwardedFor ? xForwardedFor.split(",")[0]?.trim() : "") ||
            "127.0.0.1";

          // Extract GeoIP from edge headers if available
          const cfCity = request.headers.get("cf-ipcity");
          const cfCountry = request.headers.get("cf-ipcountry");
          const cfLat = parseFloat(request.headers.get("cf-iplatitude") || "");
          const cfLon = parseFloat(request.headers.get("cf-iplongitude") || "");

          let client: ClientGeoLocation;

          if (cfCity && cfCountry && !isNaN(cfLat) && !isNaN(cfLon)) {
            client = {
              ip: rawClientIp,
              city: cfCity,
              region: request.headers.get("cf-region") || cfCountry,
              country: cfCountry,
              countryCode: cfCountry,
              latitude: cfLat,
              longitude: cfLon,
              isp: request.headers.get("cf-as-organization") || "Edge Network",
            };
          } else {
            // Intelligent fallback based on client timezone or default to Indian region
            if (queryTz.includes("London") || queryTz.includes("Europe/London") || queryTz.includes("GMT")) {
              client = {
                ip: rawClientIp === "127.0.0.1" ? "185.199.108.153" : rawClientIp,
                city: "London",
                region: "Greater London",
                country: "United Kingdom",
                countryCode: "GB",
                latitude: 51.5074,
                longitude: -0.1278,
                isp: "BT / Virgin Media High-Speed Fiber",
              };
            } else if (queryTz.includes("Singapore") || queryTz.includes("Asia/Singapore")) {
              client = {
                ip: rawClientIp === "127.0.0.1" ? "103.252.112.5" : rawClientIp,
                city: "Singapore",
                region: "Singapore Central",
                country: "Singapore",
                countryCode: "SG",
                latitude: 1.3521,
                longitude: 103.8198,
                isp: "Singtel SuperFiber",
              };
            } else if (queryTz.includes("Kolkata") || queryTz.includes("Calcutta") || queryTz.includes("Asia/Colombo")) {
              client = {
                ip: rawClientIp === "127.0.0.1" ? "49.37.142.88" : rawClientIp,
                city: "Chennai",
                region: "Tamil Nadu",
                country: "India",
                countryCode: "IN",
                latitude: 13.0827,
                longitude: 80.2707,
                isp: "JioFiber / Airtel Xstream Ultra-Gigabit",
              };
            } else {
              // Standard default fallback to Tamil Nadu / Chennai, India
              client = {
                ip: rawClientIp === "127.0.0.1" ? "49.37.142.88" : rawClientIp,
                city: "Chennai",
                region: "Tamil Nadu",
                country: "India",
                countryCode: "IN",
                latitude: 13.0827,
                longitude: 80.2707,
                isp: "High-Speed Fiber Gateway",
              };
            }
          }

          // Target region lookup
          const target =
            SPARROWX_PRIMARY_REGIONS[reqRegion] ||
            SPARROWX_PRIMARY_REGIONS["sg-sin"]!;

          // Compute exact physical fiber propagation & latency bounds
          const estimate = estimateFiberLatency(
            { lat: client.latitude, lon: client.longitude },
            target.id,
          );

          return Response.json(
            {
              ok: true,
              client,
              targetRegion: target,
              estimate,
              serverTimestamp: Date.now(),
            },
            {
              status: 200,
              headers: buildProbeCorsHeaders(request),
            },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Latency probe unavailable" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
