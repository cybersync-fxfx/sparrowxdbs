import { describe, it, expect, vi, beforeAll } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  CyberThreatGlobe,
  DEFAULT_CITIES,
  DEFAULT_ATTACK_TYPES,
} from "../components/CyberThreatGlobe";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
});

describe("CyberThreatGlobe Component & Geometry Math", () => {
  it("provides valid global coordinates for world threat telemetry hubs", () => {
    expect(DEFAULT_CITIES.length).toBeGreaterThanOrEqual(10);
    const chennai = DEFAULT_CITIES.find((c) => c.name === "Chennai");
    expect(chennai).toBeDefined();
    expect(chennai?.lat).toBeCloseTo(13.08, 1);
    expect(chennai?.lon).toBeCloseTo(80.27, 1);

    const ny = DEFAULT_CITIES.find((c) => c.name === "New York");
    expect(ny).toBeDefined();
    expect(ny?.lat).toBeCloseTo(40.71, 1);

    // Ensure all cities have valid geographic bounds
    DEFAULT_CITIES.forEach((city) => {
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
    });
  });

  it("contains core enterprise cyber attack types", () => {
    expect(DEFAULT_ATTACK_TYPES).toContain("SQL injection");
    expect(DEFAULT_ATTACK_TYPES).toContain("DDoS burst");
    expect(DEFAULT_ATTACK_TYPES).toContain("Port scan");
    expect(DEFAULT_ATTACK_TYPES).toContain("Brute force");
  });

  it("renders the canvas and realtime threat monitor stats HUD", () => {
    const { container } = render(
      React.createElement(CyberThreatGlobe, {
        showStats: true,
        showFeed: true,
        showControls: true,
        height: 400,
      }),
    );

    expect(screen.getByText(/REALTIME THREAT MONITOR/i)).toBeInTheDocument();
    expect(screen.getByText(/TOTAL EVENTS:/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH SEVERITY:/i)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE ARCS:/i)).toBeInTheDocument();

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
