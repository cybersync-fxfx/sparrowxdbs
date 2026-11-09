import React from "react";
import * as THREE from "three";
import {
  CyberThreatMatrixMap,
  type ThreatMapCity,
  MAP_DEFAULT_CITIES,
} from "./CyberThreatMatrixMap";

export interface ThreatCity {
  name: string;
  lat: number;
  lon: number;
  isOrigin?: boolean;
  country?: string;
  hostingHub?: string;
  threatLevel?: "nominal" | "elevated" | "critical";
  activeThreats?: number;
}

export interface ThreatEvent {
  id: string;
  time: string;
  type: string;
  severity: "critical" | "high" | "med" | "low";
  src: ThreatCity;
  dst: ThreatCity;
  status: "BLOCKED" | "INTERCEPTED" | "QUARANTINED";
  vector?: string;
}

export interface CyberThreatGlobeProps {
  className?: string;
  height?: string | number;
  liveWsUrl?: string | null;
  enableSimulation?: boolean;
  simIntervalMs?: number;
  maxFeed?: number;
  customCities?: ThreatCity[];
  showControls?: boolean;
  showFeed?: boolean;
  showStats?: boolean;
  onEventIntercepted?: (event: ThreatEvent) => void;
}

export const DEFAULT_CITIES: ThreatCity[] = [
  { name: "Roubaix (OVH Host)", lat: 50.69, lon: 3.17, isOrigin: true, country: "France", hostingHub: "OVHcloud EU-West Host", threatLevel: "nominal", activeThreats: 19 },
  { name: "Chennai", lat: 13.08, lon: 80.27, isOrigin: true, country: "India", hostingHub: "AP-South Origin Host", threatLevel: "nominal", activeThreats: 14 },
  { name: "New York", lat: 40.71, lon: -74.0, isOrigin: true, country: "United States", hostingHub: "US-East Origin Host", threatLevel: "elevated", activeThreats: 82 },
  { name: "London", lat: 51.5, lon: -0.12, country: "United Kingdom", hostingHub: "UK Edge Relay", threatLevel: "nominal", activeThreats: 46 },
  { name: "Frankfurt", lat: 50.11, lon: 8.68, isOrigin: true, country: "Germany", hostingHub: "EU-Central Origin Host", threatLevel: "nominal", activeThreats: 38 },
  { name: "Tokyo", lat: 35.68, lon: 139.69, country: "Japan", hostingHub: "AP-Northeast Relay", threatLevel: "nominal", activeThreats: 52 },
  { name: "São Paulo", lat: -23.55, lon: -46.63, country: "Brazil", hostingHub: "SA-East Edge Node", threatLevel: "elevated", activeThreats: 67 },
  { name: "Sydney", lat: -33.87, lon: 151.2, country: "Australia", hostingHub: "AP-Southeast Host", threatLevel: "nominal", activeThreats: 21 },
  { name: "Moscow", lat: 55.75, lon: 37.62, country: "Russia", hostingHub: "Eastern Ingress", threatLevel: "critical", activeThreats: 94 },
  { name: "Lagos", lat: 6.52, lon: 3.38, country: "Nigeria", hostingHub: "AF-West Relay", threatLevel: "nominal", activeThreats: 18 },
  { name: "Singapore", lat: 1.35, lon: 103.82, isOrigin: true, country: "Singapore", hostingHub: "OVHcloud AP-South Host", threatLevel: "nominal", activeThreats: 34 },
  { name: "Beijing", lat: 39.9, lon: 116.4, country: "China", hostingHub: "CN-North Ingress", threatLevel: "critical", activeThreats: 112 },
  { name: "Dubai", lat: 25.2, lon: 55.27, country: "United Arab Emirates", hostingHub: "ME-Central Host", threatLevel: "nominal", activeThreats: 29 },
  { name: "Toronto", lat: 43.65, lon: -79.38, isOrigin: true, country: "Canada", hostingHub: "OVHcloud CA-East Host", threatLevel: "nominal", activeThreats: 24 },
  { name: "Mumbai", lat: 19.07, lon: 72.87, isOrigin: true, country: "India", hostingHub: "OVHcloud Mumbai Host", threatLevel: "nominal", activeThreats: 41 },
  { name: "Seoul", lat: 37.56, lon: 126.97, country: "South Korea", hostingHub: "KR-Central Relay", threatLevel: "nominal", activeThreats: 35 },
];

export const DEFAULT_ATTACK_TYPES = [
  "API zero-day probe",
  "DDoS burst",
  "SQL injection",
  "Phishing callback",
  "LLM prompt jailbreak",
  "Port scan",
  "Brute force",
  "Malware beacon",
  "Credential stuffing",
  "RCE shell probe",
];

// Helper: Convert lat/lon in degrees to 3D unit vector for geometry compatibility
export function latLonToVector3(lat: number, lon: number, radius = 100): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * CyberThreatGlobe: Replaced 3D sphere with 2D Dot-Matrix Equirectangular Threat Map.
 * Provides full backwards compatibility while rendering the flat tactical dot-matrix visualization.
 */
export function CyberThreatGlobe({
  className,
  height = 560,
  customCities,
  showControls = true,
  showFeed = true,
  showStats = true,
  enableSimulation = false,
  simIntervalMs = 2800,
  maxFeed = 20,
}: CyberThreatGlobeProps) {
  // Map customCities to ThreatMapCity format if provided
  const mappedCities: ThreatMapCity[] | undefined = customCities?.map((c) => ({
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    country: c.country || c.name,
    isOrigin: c.isOrigin,
    hostingHub: c.hostingHub,
    threatLevel: c.threatLevel,
  }));

  return (
    <CyberThreatMatrixMap
      className={className}
      height={height}
      customCities={mappedCities}
      showControls={showControls}
      showFeed={showFeed}
      showStats={showStats}
      enableSimulation={enableSimulation}
      simIntervalMs={simIntervalMs}
      maxFeed={maxFeed}
    />
  );
}
