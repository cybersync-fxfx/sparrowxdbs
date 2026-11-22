import { describe, expect, it } from "vitest";
import {
  SPARROWX_PRIMARY_REGIONS,
  calculateHaversineDistanceKm,
  estimateFiberLatency,
} from "@/lib/latency-probe";
import { INFRA_REGIONS, INFRA_PLANS } from "@/lib/infra-plans";

describe("SparrowX Datacenter Regions & Live Latency Probe Engine", () => {
  it("defines the 3 core geographical hubs: India (Mumbai & Tamil Nadu), Singapore, and UK", () => {
    // 1. India Hub
    const mum = INFRA_REGIONS.find((r) => r.id === "in-mum")!;
    const maa = INFRA_REGIONS.find((r) => r.id === "in-maa")!;
    expect(mum).toBeDefined();
    expect(mum.country).toBe("India");
    expect(mum.code).toBe("BOM");
    expect(mum.hub).toBe("India");

    expect(maa).toBeDefined();
    expect(maa.country).toBe("India");
    expect(maa.code).toBe("MAA");
    expect(maa.hub).toBe("India");

    // 2. Singapore Hub
    const sin = INFRA_REGIONS.find((r) => r.id === "sg-sin")!;
    expect(sin).toBeDefined();
    expect(sin.country).toBe("Singapore");
    expect(sin.code).toBe("SIN");
    expect(sin.hub).toBe("Singapore");

    // 3. United Kingdom Hub
    const lon = INFRA_REGIONS.find((r) => r.id === "uk-lon")!;
    expect(lon).toBeDefined();
    expect(lon.country).toBe("United Kingdom");
    expect(lon.code).toBe("LON");
    expect(lon.hub).toBe("United Kingdom");
  });

  it("verifies all Cloud VPS, Dedicated VDS, and Bare Metal plans are deployable across the 3 hubs", () => {
    for (const plan of INFRA_PLANS) {
      expect(plan.regions).toContain("in-mum");
      expect(plan.regions).toContain("in-maa");
      expect(plan.regions).toContain("sg-sin");
      expect(plan.regions).toContain("uk-lon");
    }
  });

  it("calculates accurate Great-Circle distances using the Haversine formula", () => {
    // Chennai (13.0827, 80.2707) to Singapore (1.3521, 103.8198) ~2,920 km
    const distChennaiToSingapore = calculateHaversineDistanceKm(
      13.0827,
      80.2707,
      1.3521,
      103.8198,
    );
    expect(distChennaiToSingapore).toBeGreaterThan(2850);
    expect(distChennaiToSingapore).toBeLessThan(3000);

    // Chennai to Mumbai ~1,030 km
    const distChennaiToMumbai = calculateHaversineDistanceKm(
      13.0827,
      80.2707,
      19.076,
      72.8777,
    );
    expect(distChennaiToMumbai).toBeGreaterThan(1000);
    expect(distChennaiToMumbai).toBeLessThan(1100);

    // Chennai to London ~8,200 km
    const distChennaiToLondon = calculateHaversineDistanceKm(
      13.0827,
      80.2707,
      51.5074,
      -0.1278,
    );
    expect(distChennaiToLondon).toBeGreaterThan(8100);
    expect(distChennaiToLondon).toBeLessThan(8350);
  });

  it("computes realistic physics-based fiber propagation latency ranges", () => {
    // Chennai visitor to Singapore node (~2,920 km subsea fiber)
    const chennaiCoords = { lat: 13.0827, lon: 80.2707 };
    const estSingapore = estimateFiberLatency(chennaiCoords, "sg-sin");

    expect(estSingapore.typicalMs).toBeGreaterThanOrEqual(20);
    expect(estSingapore.typicalMs).toBeLessThanOrEqual(50);
    expect(estSingapore.quality).toBe("optimal");
    expect(estSingapore.cableTransit).toContain("Submarine Cable Direct");

    // Chennai visitor to Tamil Nadu / Chennai node (< 60 km metro)
    const estChennaiLocal = estimateFiberLatency(chennaiCoords, "in-maa");
    expect(estChennaiLocal.typicalMs).toBeLessThanOrEqual(5);
    expect(estChennaiLocal.quality).toBe("ultra-low");

    // Chennai visitor to London UK node (~8,200 km intercontinental)
    const estLondon = estimateFiberLatency(chennaiCoords, "uk-lon");
    expect(estLondon.typicalMs).toBeGreaterThan(90);
    expect(estLondon.typicalMs).toBeLessThan(145);
    expect(estLondon.quality).toBe("global");
  });
});
