/**
 * SparrowX Live Latency Probe & GeoIP Routing Engine
 * Measures real-time client round-trip latency and calculates
 * exact Great-Circle fiber optic transit times to SparrowX datacenters.
 */

export interface LatencyTargetRegion {
  id: string;
  name: string;
  code: string;
  flag: string;
  country: string;
  city: string;
  hub: "India" | "Singapore" | "United Kingdom" | "Europe";
  coordinates: { lat: number; lon: number };
  description: string;
  tier: string;
  transitRoutes: string[];
}

export const SPARROWX_PRIMARY_REGIONS: Record<string, LatencyTargetRegion> = {
  "in-mum": {
    id: "in-mum",
    name: "Mumbai IN-1",
    code: "BOM",
    flag: "🇮🇳",
    country: "India",
    city: "Mumbai, Maharashtra",
    hub: "India",
    coordinates: { lat: 19.076, lon: 72.8777 },
    description: "Financial & Enterprise Hub • NIXI / Extreme IX Peering",
    tier: "Tier IV Datacenter",
    transitRoutes: ["NIXI-Mumbai", "Tata TGN-TIC", "Airtel Global", "BBG"],
  },
  "in-maa": {
    id: "in-maa",
    name: "Tamil Nadu IN-2",
    code: "MAA",
    flag: "🇮🇳",
    country: "India",
    city: "Chennai, Tamil Nadu",
    hub: "India",
    coordinates: { lat: 13.0827, lon: 80.2707 },
    description: "Subsea Cable Landing Station • Bay of Bengal Direct Fiber",
    tier: "Tier III+ Landing Station",
    transitRoutes: ["SeaMeWe-4", "i2i Submarine Cable", "Chennai-Andaman Subsea", "NIXI-Chennai"],
  },
  "sg-sin": {
    id: "sg-sin",
    name: "Singapore SG-1",
    code: "SIN",
    flag: "🇸🇬",
    country: "Singapore",
    city: "Singapore",
    hub: "Singapore",
    coordinates: { lat: 1.3521, lon: 103.8198 },
    description: "Equinix SG1 / Global Switch • APAC High-Throughput Peering",
    tier: "Tier IV Hyperscale",
    transitRoutes: ["Singtel IX", "Equinix Internet Exchange", "SEA-H2X", "Indigo-Central"],
  },
  "uk-lon": {
    id: "uk-lon",
    name: "London UK-1",
    code: "LON",
    flag: "🇬🇧",
    country: "United Kingdom",
    city: "London",
    hub: "United Kingdom",
    coordinates: { lat: 51.5074, lon: -0.1278 },
    description: "Telehouse North / LINX • Low-Jitter Transatlantic & European Edge",
    tier: "Tier IV Docklands",
    transitRoutes: ["LINX London", "LONAP", "Colt Fiber", "Lumen Transatlantic"],
  },
};

export interface ClientGeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  isp?: string;
}

/**
 * Calculates Great-Circle distance in kilometers between two lat/lon coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface LatencyEstimate {
  distanceKm: number;
  minMs: number;
  maxMs: number;
  typicalMs: number;
  cableTransit: string;
  quality: "ultra-low" | "optimal" | "transcontinental" | "global";
}

/**
 * Computes realistic round-trip fiber optic latency based on:
 * - Speed of light in single-mode fiber (approx 200 km / ms)
 * - Two-way transit (distance * 2 / 200 = distance / 100 ms)
 * - Physical cable detour / curvature multiplier (1.25x - 1.45x)
 * - Last-mile access overhead (GPON/FTTH, 5G, or BGP routing: 3ms - 8ms)
 */
export function estimateFiberLatency(
  clientCoords: { lat: number; lon: number },
  targetRegionId: string,
): LatencyEstimate {
  const target = SPARROWX_PRIMARY_REGIONS[targetRegionId] || SPARROWX_PRIMARY_REGIONS["in-mum"]!;
  const distance = calculateHaversineDistanceKm(
    clientCoords.lat,
    clientCoords.lon,
    target.coordinates.lat,
    target.coordinates.lon,
  );

  // Metro / Local peering (e.g. Chennai to Chennai or Mumbai to Mumbai)
  if (distance < 60) {
    return {
      distanceKm: distance,
      minMs: 2,
      maxMs: 5,
      typicalMs: 3,
      cableTransit: "Metro Dark Fiber Direct Cross-Connect",
      quality: "ultra-low",
    };
  }

  // Domestic Indian regional peering (e.g. Tamil Nadu to Mumbai ~1000km)
  if (distance < 1500) {
    const rawRtt = (distance * 2) / 200; // fiber speed
    const routed = rawRtt * 1.35 + 4;
    return {
      distanceKm: distance,
      minMs: Math.max(8, Math.round(routed * 0.9)),
      maxMs: Math.round(routed * 1.2),
      typicalMs: Math.round(routed),
      cableTransit: "Terrestrial DWDM Backbone via NIXI Ring",
      quality: "optimal",
    };
  }

  // Regional Subsea (e.g. India to Singapore ~2900km - 3900km)
  if (distance < 5000) {
    const rawRtt = (distance * 2) / 200;
    const routed = rawRtt * 1.28 + 6;
    return {
      distanceKm: distance,
      minMs: Math.max(18, Math.round(routed * 0.92)),
      maxMs: Math.round(routed * 1.15),
      typicalMs: Math.round(routed),
      cableTransit: "Submarine Cable Direct (SeaMeWe-4 / BBG / i2i)",
      quality: "optimal",
    };
  }

  // Intercontinental (e.g. India/Singapore to UK ~7000km - 11000km)
  const rawRtt = (distance * 2) / 200;
  const routed = rawRtt * 1.32 + 8;
  return {
    distanceKm: distance,
    minMs: Math.round(routed * 0.92),
    maxMs: Math.round(routed * 1.12),
    typicalMs: Math.round(routed),
    cableTransit: "Global Submarine & Transcontinental Transit",
    quality: distance > 8000 ? "global" : "transcontinental",
  };
}

/**
 * Executes a live client-side HTTP micro-ping against the regional probe endpoint
 * and records round-trip precision timings.
 */
export async function measureLiveHttpPing(
  endpointUrl: string,
  iterations = 2,
): Promise<{ rttMs: number; jitterMs: number; status: "success" | "fallback" }> {
  const timings: number[] = [];

  for (let i = 0; i < iterations; i++) {
    try {
      const start = performance.now();
      const sep = endpointUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${endpointUrl}${sep}_t=${Date.now()}_${i}`, {
        method: "HEAD",
        cache: "no-store",
      });
      const end = performance.now();
      if (res.ok) {
        timings.push(Math.round(end - start));
      }
    } catch {
      // Continue to next probe iteration
    }
  }

  if (timings.length === 0) {
    return { rttMs: 0, jitterMs: 0, status: "fallback" };
  }

  const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  const jitter = timings.length > 1 ? Math.abs(timings[0]! - timings[1]!) : 1;

  return { rttMs: Math.max(1, avg), jitterMs: jitter, status: "success" };
}
