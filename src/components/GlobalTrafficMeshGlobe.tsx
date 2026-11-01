import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Crosshair,
  Download,
  Eye,
  Filter,
  Globe2,
  Lock,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClientTenant, ProtectedService } from "@/lib/supabase";

// ==========================================
// Types & Telemetry Models
// ==========================================

export type ConnectionStatus = "ALLOWED" | "BLOCKED" | "RATE_LIMITED" | "AI_GUARDED";

export interface GeoLocation {
  lat: number;
  lng: number;
  country: string;
  countryCode: string;
  city: string;
  flag: string;
}

export interface OriginHostConfig {
  id: string;
  name: string;
  domain: string;
  ip: string;
  provider: string;
  region: string;
  geo: GeoLocation;
  status: "Protected & Active" | "Monitoring" | "Under High Load";
  wafMode: "Active Shield" | "Monitor Only";
  uptimePct: number;
  baseLatencyMs: number;
}

export interface LiveConnectionPacket {
  id: string;
  timestamp: string;
  rawTime: number;
  clientIp: string;
  clientGeo: GeoLocation;
  originIp: string;
  originName: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS";
  path: string;
  status: ConnectionStatus;
  httpCode: number;
  latencyMs: number;
  bytes: number;
  userAgent: string;
  threatDetails?: string | undefined;
  guardrailAction?: string | undefined;
}

export interface ConnectionArc {
  id: string;
  packet: LiveConnectionPacket;
  startGeo: GeoLocation;
  endGeo: GeoLocation;
  progress: number; // 0 to 1
  duration: number; // in frames
  color: string;
  glowColor: string;
}

// Preset Origin Servers (where customer webapps and sites are hosted)
export const PRESET_ORIGINS: OriginHostConfig[] = [
  {
    id: "origin-us-east",
    name: "Production Gateway (US-East)",
    domain: "app.novapay.io",
    ip: "54.210.12.89",
    provider: "AWS us-east-1",
    region: "Ashburn, Virginia, US",
    geo: {
      lat: 39.0438,
      lng: -77.4874,
      country: "United States",
      countryCode: "US",
      city: "Ashburn, VA",
      flag: "🇺🇸",
    },
    status: "Protected & Active",
    wafMode: "Active Shield",
    uptimePct: 99.98,
    baseLatencyMs: 14,
  },
  {
    id: "origin-eu-central",
    name: "EU Financial Core (Frankfurt)",
    domain: "api.cloudscale.dev",
    ip: "18.192.88.42",
    provider: "AWS eu-central-1",
    region: "Frankfurt, Germany",
    geo: {
      lat: 50.1109,
      lng: 8.6821,
      country: "Germany",
      countryCode: "DE",
      city: "Frankfurt",
      flag: "🇩🇪",
    },
    status: "Protected & Active",
    wafMode: "Active Shield",
    uptimePct: 99.99,
    baseLatencyMs: 18,
  },
  {
    id: "origin-ap-south",
    name: "APAC Microservices (Mumbai)",
    domain: "vault.acmepay.in",
    ip: "13.232.190.15",
    provider: "AWS ap-south-1",
    region: "Mumbai, India",
    geo: {
      lat: 19.076,
      lng: 72.8777,
      country: "India",
      countryCode: "IN",
      city: "Mumbai",
      flag: "🇮🇳",
    },
    status: "Protected & Active",
    wafMode: "Active Shield",
    uptimePct: 99.95,
    baseLatencyMs: 22,
  },
  {
    id: "origin-ap-east",
    name: "East Asia AI Gateway (Tokyo)",
    domain: "ai-mesh.hyperflux.tech",
    ip: "35.78.204.101",
    provider: "GCP asia-northeast1",
    region: "Tokyo, Japan",
    geo: {
      lat: 35.6762,
      lng: 139.6503,
      country: "Japan",
      countryCode: "JP",
      city: "Tokyo",
      flag: "🇯🇵",
    },
    status: "Protected & Active",
    wafMode: "Active Shield",
    uptimePct: 99.99,
    baseLatencyMs: 12,
  },
];

// Sample Global Inbound Visitor Nodes (Cities across all continents)
const GLOBAL_VISITOR_NODES: Array<{
  ipPrefix: string;
  country: string;
  countryCode: string;
  city: string;
  flag: string;
  lat: number;
  lng: number;
  isp: string;
}> = [
  { ipPrefix: "198.51.100", country: "United States", countryCode: "US", city: "San Francisco", flag: "🇺🇸", lat: 37.7749, lng: -122.4194, isp: "Cloudflare" },
  { ipPrefix: "185.220.101", country: "Germany", countryCode: "DE", city: "Berlin", flag: "🇩🇪", lat: 52.52, lng: 13.405, isp: "Deutsche Telekom" },
  { ipPrefix: "133.242.18", country: "Japan", countryCode: "JP", city: "Osaka", flag: "🇯🇵", lat: 34.6937, lng: 135.5023, isp: "NTT Communications" },
  { ipPrefix: "103.21.244", country: "India", countryCode: "IN", city: "Bengaluru", flag: "🇮🇳", lat: 12.9716, lng: 77.5946, isp: "Airtel Enterprise" },
  { ipPrefix: "51.15.42", country: "United Kingdom", countryCode: "GB", city: "London", flag: "🇬🇧", lat: 51.5074, lng: -0.1278, isp: "Vodafone UK" },
  { ipPrefix: "177.18.230", country: "Brazil", countryCode: "BR", city: "São Paulo", flag: "🇧🇷", lat: -23.5505, lng: -46.6333, isp: "Claro Brasil" },
  { ipPrefix: "139.130.4", country: "Australia", countryCode: "AU", city: "Sydney", flag: "🇦🇺", lat: -33.8688, lng: 151.2093, isp: "Telstra" },
  { ipPrefix: "105.112.33", country: "Nigeria", countryCode: "NG", city: "Lagos", flag: "🇳🇬", lat: 6.5244, lng: 3.3792, isp: "MTN Nigeria" },
  { ipPrefix: "146.190.11", country: "Singapore", countryCode: "SG", city: "Singapore", flag: "🇸🇬", lat: 1.3521, lng: 103.8198, isp: "Singtel Fiber" },
  { ipPrefix: "142.250.80", country: "Canada", countryCode: "CA", city: "Toronto", flag: "🇨🇦", lat: 43.6532, lng: -79.3832, isp: "Rogers Cable" },
  { ipPrefix: "194.67.210", country: "Netherlands", countryCode: "NL", city: "Amsterdam", flag: "🇳🇱", lat: 52.3676, lng: 4.9041, isp: "KPN Internet" },
  { ipPrefix: "185.190.141", country: "France", countryCode: "FR", city: "Paris", flag: "🇫🇷", lat: 48.8566, lng: 2.3522, isp: "Orange Telecom" },
  { ipPrefix: "122.11.170", country: "South Korea", countryCode: "KR", city: "Seoul", flag: "🇰🇷", lat: 37.5665, lng: 126.978, isp: "SK Broadband" },
  { ipPrefix: "200.89.70", country: "Chile", countryCode: "CL", city: "Santiago", flag: "🇨🇱", lat: -33.4489, lng: -70.6693, isp: "Entel Chile" },
  { ipPrefix: "102.164.21", country: "South Africa", countryCode: "ZA", city: "Cape Town", flag: "🇿🇦", lat: -33.9249, lng: 18.4241, isp: "Liquid Telecom" },
  { ipPrefix: "190.2.144", country: "Mexico", countryCode: "MX", city: "Mexico City", flag: "🇲🇽", lat: 19.4326, lng: -99.1332, isp: "Telmex" },
  { ipPrefix: "82.165.197", country: "Spain", countryCode: "ES", city: "Madrid", flag: "🇪🇸", lat: 40.4168, lng: -3.7038, isp: "Telefonica" },
  { ipPrefix: "175.45.176", country: "Taiwan", countryCode: "TW", city: "Taipei", flag: "🇹🇼", lat: 25.033, lng: 121.5654, isp: "Chunghwa Telecom" },
  { ipPrefix: "188.166.19", country: "Sweden", countryCode: "SE", city: "Stockholm", flag: "🇸🇪", lat: 59.3293, lng: 18.0686, isp: "Telia Company" },
  { ipPrefix: "80.249.160", country: "UAE", countryCode: "AE", city: "Dubai", flag: "🇦🇪", lat: 25.2048, lng: 55.2708, isp: "Du Telecom" },
];

// Coastline / Land outline clusters for the 3D Sphere projection
const CONTINENT_POINTS: Array<[number, number]> = [
  // North America
  [45, -100], [40, -105], [35, -115], [38, -122], [47, -122], [55, -125], [60, -140], [64, -150], [58, -100], [50, -85], [45, -75], [42, -71], [30, -85], [25, -80], [30, -95], [20, -100], [15, -90], [10, -84],
  // South America
  [5, -75], [-5, -80], [-15, -75], [-25, -70], [-35, -72], [-45, -74], [-53, -70], [-45, -65], [-35, -55], [-22, -43], [-10, -37], [-3, -40], [2, -50], [8, -60],
  // Europe
  [36, -5], [40, -4], [43, -8], [48, -4], [51, 1], [53, 5], [54, 10], [57, 10], [60, 11], [65, 14], [70, 25], [60, 30], [52, 21], [48, 17], [45, 12], [42, 13], [38, 15], [38, 23], [41, 28],
  // Africa
  [35, -5], [32, 10], [31, 31], [22, 37], [12, 44], [0, 42], [-10, 40], [-25, 33], [-34, 18], [-25, 14], [-15, 12], [0, 9], [5, 0], [15, -17], [25, -15],
  // Asia
  [42, 50], [35, 52], [25, 55], [24, 68], [15, 74], [10, 78], [22, 88], [22, 91], [15, 100], [5, 103], [10, 107], [20, 107], [22, 114], [32, 120], [38, 122], [40, 129], [45, 135], [52, 140], [60, 150], [65, 170], [70, 130], [72, 90], [68, 60],
  // Australia & New Zealand
  [-15, 130], [-20, 115], [-30, 115], [-35, 117], [-38, 145], [-33, 151], [-25, 152], [-15, 145], [-12, 135], [-40, 175], [-45, 170],
];

// Generate an organic stream of legitimate and blocked network packets
function createSampleNetworkPacket(origin: OriginHostConfig): LiveConnectionPacket {
  const visitor = GLOBAL_VISITOR_NODES[Math.floor(Math.random() * GLOBAL_VISITOR_NODES.length)];
  const fourthOctet = Math.floor(2 + Math.random() * 250);
  const clientIp = `${visitor.ipPrefix}.${fourthOctet}`;

  // Traffic Distribution:
  // 75% Legitimate traffic (Allowed)
  // 15% WAF Intercepted Threats (Blocked)
  // 5% Rate-Limited bursts
  // 5% AI Agent / Prompt Firewall calls
  const roll = Math.random();
  let status: ConnectionStatus = "ALLOWED";
  let httpCode = 200;
  let threatDetails: string | undefined = undefined;
  let guardrailAction: string | undefined = undefined;
  let path = "/api/v1/auth/session";
  let method: LiveConnectionPacket["method"] = "GET";

  if (roll < 0.75) {
    status = "ALLOWED";
    const normalPaths = [
      "/dashboard",
      "/api/v1/user/profile",
      "/products/pricing",
      "/checkout/intent",
      "/static/bundle.min.js",
      "/graphql?query=GetWorkspace",
      "/api/v2/metrics",
    ];
    path = normalPaths[Math.floor(Math.random() * normalPaths.length)];
    method = path.includes("intent") || path.includes("session") ? "POST" : "GET";
    httpCode = method === "POST" ? 201 : 200;
  } else if (roll < 0.90) {
    status = "BLOCKED";
    const attackTypes = [
      { path: "/wp-login.php", details: "Unauthorized Probe / CMS Exploit Scan", code: 403, method: "POST" as const },
      { path: "/api/search?q=UNION+SELECT+null,password", details: "SQL Injection Vector (WAF Rule #942100)", code: 403, method: "GET" as const },
      { path: "/api/users/profile", details: "Cross-Site Scripting (XSS) Tag Injection", code: 403, method: "POST" as const },
      { path: "/.env", details: "Sensitive File & Credential Reconnaissance", code: 404, method: "GET" as const },
      { path: "/auth/login", details: "Brute-Force Credential Stuffing Burst", code: 401, method: "POST" as const },
      { path: "/internal/metadata", details: "SSRF Attack targeting Cloud IMDSv2", code: 403, method: "GET" as const },
    ];
    const picked = attackTypes[Math.floor(Math.random() * attackTypes.length)];
    path = picked.path;
    details: threatDetails = picked.details;
    httpCode = picked.code;
    method = picked.method;
  } else if (roll < 0.95) {
    status = "RATE_LIMITED";
    path = "/api/v1/ingest/telemetry";
    method = "POST";
    httpCode = 429;
    threatDetails = "High Velocity Burst (>180 req/s from single ASN)";
  } else {
    status = "AI_GUARDED";
    path = "/api/v1/ai/agent/execute";
    method = "POST";
    httpCode = 200;
    guardrailAction = "SparrowX LLM Prompt Shield Verified · 0 Data Leaks";
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return {
    id: `pkt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: timeStr,
    rawTime: Date.now(),
    clientIp,
    clientGeo: {
      lat: visitor.lat,
      lng: visitor.lng,
      country: visitor.country,
      countryCode: visitor.countryCode,
      city: visitor.city,
      flag: visitor.flag,
    },
    originIp: origin.ip,
    originName: origin.name,
    method,
    path,
    status,
    httpCode,
    latencyMs: Math.floor(origin.baseLatencyMs + Math.random() * 85),
    bytes: Math.floor(412 + Math.random() * 3200),
    userAgent: `${visitor.isp} Gateway`,
    threatDetails,
    guardrailAction,
  };
}

// ==========================================
// Main Component
// ==========================================

export function GlobalTrafficMeshGlobe({
  tenants = [],
  protectedServices = [],
  onNavigate,
  showToast,
}: {
  tenants?: ClientTenant[] | undefined;
  protectedServices?: ProtectedService[] | undefined;
  onNavigate?: ((nav: string) => void) | undefined;
  showToast?: ((msg: string) => void) | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Origin Server Host
  const [activeOriginId, setActiveOriginId] = useState<string>("origin-us-east");
  const [filterMode, setFilterMode] = useState<"ALL" | "ALLOWED" | "BLOCKED" | "AI">("ALL");
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamSpeedMs, setStreamSpeedMs] = useState<number>(650);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPacket, setSelectedPacket] = useState<LiveConnectionPacket | null>(null);
  const [showIntegrationGuide, setShowIntegrationGuide] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Combine preset origins with any real tenant primaryDomains
  const allOrigins: OriginHostConfig[] = useMemo(() => {
    const list = [...PRESET_ORIGINS];
    if (tenants && tenants.length > 0) {
      tenants.forEach((tenant, idx) => {
        if (!list.some((o) => o.domain === tenant.primaryDomain)) {
          list.push({
            id: `tenant-${tenant.id}`,
            name: `${tenant.name} (${tenant.planTier})`,
            domain: tenant.primaryDomain,
            ip: `76.76.21.${30 + idx}`,
            provider: "SparrowX Edge Mesh",
            region: "Global Anycast Edge",
            geo: {
              lat: 38.9 + idx * 2,
              lng: -77.0 - idx * 5,
              country: "United States",
              countryCode: "US",
              city: "Edge Point " + (idx + 1),
              flag: "🌐",
            },
            status: "Protected & Active",
            wafMode: tenant.guardrailsActive ? "Active Shield" : "Monitor Only",
            uptimePct: 99.98,
            baseLatencyMs: tenant.avgLatencyMs || 15,
          });
        }
      });
    }
    return list;
  }, [tenants]);

  const activeOrigin = useMemo(
    () => allOrigins.find((o) => o.id === activeOriginId) ?? allOrigins[0],
    [allOrigins, activeOriginId],
  );

  // Telemetry buffer & animation state
  const [packets, setPackets] = useState<LiveConnectionPacket[]>(() => {
    return Array.from({ length: 12 }, () => createSampleNetworkPacket(PRESET_ORIGINS[0]));
  });

  const arcsRef = useRef<ConnectionArc[]>([]);
  const rotationRef = useRef<{ x: number; y: number; dragStart: { x: number; y: number } | null; isDragging: boolean }>({
    x: 0.35,
    y: 1.1,
    dragStart: null,
    isDragging: false,
  });

  // 1. Packet Streaming Engine
  useEffect(() => {
    if (!isStreaming) return;
    const interval = window.setInterval(() => {
      const newPkt = createSampleNetworkPacket(activeOrigin);

      // Add to visible packets
      setPackets((prev) => [newPkt, ...prev.slice(0, 50)]);

      // Create animated 3D connection arc
      let color = "#10b981"; // Emerald / Green for Allowed
      let glowColor = "rgba(16, 185, 129, 0.45)";

      if (newPkt.status === "BLOCKED") {
        color = "#ef4444"; // Red / Coral
        glowColor = "rgba(239, 68, 68, 0.55)";
      } else if (newPkt.status === "RATE_LIMITED") {
        color = "#f59e0b"; // Amber
        glowColor = "rgba(245, 158, 11, 0.55)";
      } else if (newPkt.status === "AI_GUARDED") {
        color = "#06b6d4"; // Cyan
        glowColor = "rgba(6, 182, 212, 0.55)";
      }

      const arc: ConnectionArc = {
        id: `arc-${newPkt.id}`,
        packet: newPkt,
        startGeo: newPkt.clientGeo,
        endGeo: activeOrigin.geo,
        progress: 0,
        duration: Math.floor(45 + Math.random() * 30),
        color,
        glowColor,
      };

      arcsRef.current = [...arcsRef.current.slice(-24), arc];
    }, streamSpeedMs);

    return () => window.clearInterval(interval);
  }, [isStreaming, streamSpeedMs, activeOrigin]);

  // 2. 3D Canvas Rendering Loop (Spherical Projection)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Auto-rotation when not dragging
      if (!rotationRef.current.isDragging) {
        rotationRef.current.y += 0.0035;
      }

      const rotX = rotationRef.current.x;
      const rotY = rotationRef.current.y;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.40;

      ctx.clearRect(0, 0, width, height);

      // --- Background Glow ---
      const bgGrad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.35);
      bgGrad.addColorStop(0, "rgba(249, 115, 22, 0.04)");
      bgGrad.addColorStop(0.5, "rgba(15, 23, 42, 0.35)");
      bgGrad.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- 3D Sphere Background Glow & Shadow ---
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      sphereGrad.addColorStop(0, "#0f172a");
      sphereGrad.addColorStop(0.7, "#080e1a");
      sphereGrad.addColorStop(1, "#020617");
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Outer atmospheric rim
      ctx.strokeStyle = "rgba(249, 115, 22, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Atmospheric outer aura
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // --- Spherical Math Helper ---
      const projectGeo = (lat: number, lng: number, altitude = 0) => {
        const phi = (lat * Math.PI) / 180;
        const lambda = ((lng + (rotY * 180) / Math.PI) * Math.PI) / 180;
        const effectiveRadius = radius * (1 + altitude);

        // 3D Cartesian coordinates
        const x0 = Math.cos(phi) * Math.sin(lambda);
        const y0 = Math.sin(phi);
        const z0 = Math.cos(phi) * Math.cos(lambda);

        // Pitch rotation along X axis
        const y1 = y0 * Math.cos(rotX) - z0 * Math.sin(rotX);
        const z1 = y0 * Math.sin(rotX) + z0 * Math.cos(rotX);
        const x1 = x0;

        const screenX = cx + x1 * effectiveRadius;
        const screenY = cy - y1 * effectiveRadius;
        const isVisible = z1 > -0.05; // Visible if facing viewer

        return { x: screenX, y: screenY, z: z1, visible: isVisible };
      };

      // --- Latitude / Longitude Coordinate Grid ---
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 0.75;

      // Latitude circles
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let first = true;
        for (let lng = -180; lng <= 180; lng += 10) {
          const pt = projectGeo(lat, lng);
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      // --- Landmass Continents Points ---
      ctx.save();
      CONTINENT_POINTS.forEach(([lat, lng]) => {
        const pt = projectGeo(lat, lng);
        if (pt.visible) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
          ctx.fill();
        }
      });
      ctx.restore();

      // --- Animated 3D Great-Circle Flight Arcs ---
      const activeArcs = arcsRef.current;
      for (let i = activeArcs.length - 1; i >= 0; i--) {
        const arc = activeArcs[i];
        arc.progress += 1 / arc.duration;

        if (arc.progress >= 1.05) {
          activeArcs.splice(i, 1);
          continue;
        }

        // Draw curved ballistic trajectory arc from client country to origin server
        const steps = 24;
        let prevPt: { x: number; y: number; visible: boolean } | null = null;

        ctx.save();
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          if (t > arc.progress) break;

          // Slerp lat/lng
          const curLat = arc.startGeo.lat + (arc.endGeo.lat - arc.startGeo.lat) * t;
          const curLng = arc.startGeo.lng + (arc.endGeo.lng - arc.startGeo.lng) * t;
          // Arch upward in 3D parabolic elevation
          const altitude = Math.sin(t * Math.PI) * 0.22;

          const pt = projectGeo(curLat, curLng, altitude);

          if (pt.visible) {
            if (!prevPt) {
              ctx.moveTo(pt.x, pt.y);
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
            prevPt = pt;
          }
        }

        ctx.strokeStyle = arc.glowColor;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Draw animated projectile head / photon packet at current head
        const headT = Math.min(1, arc.progress);
        const headLat = arc.startGeo.lat + (arc.endGeo.lat - arc.startGeo.lat) * headT;
        const headLng = arc.startGeo.lng + (arc.endGeo.lng - arc.startGeo.lng) * headT;
        const headAlt = Math.sin(headT * Math.PI) * 0.22;
        const headPt = projectGeo(headLat, headLng, headAlt);

        if (headPt.visible) {
          ctx.beginPath();
          ctx.arc(headPt.x, headPt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(headPt.x, headPt.y, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = arc.color;
          ctx.globalAlpha = 0.6;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        ctx.restore();
      }

      // --- Visitor Inbound Nodes Markers ---
      GLOBAL_VISITOR_NODES.forEach((v) => {
        const pt = projectGeo(v.lat, v.lng);
        if (pt.visible) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56, 189, 248, 0.65)";
          ctx.fill();
        }
      });

      // --- ORIGIN SERVER HOST PIN (Where the user's webapp/site lives) ---
      const originPt = projectGeo(activeOrigin.geo.lat, activeOrigin.geo.lng);
      if (originPt.visible) {
        ctx.save();

        // Pulsing radar ripple rings around the Origin Host
        const pulse = (Date.now() % 1600) / 1600;
        ctx.beginPath();
        ctx.arc(originPt.x, originPt.y, 6 + pulse * 22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(249, 115, 22, ${1 - pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Origin Beacon Pin Core
        ctx.beginPath();
        ctx.arc(originPt.x, originPt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Origin Label Badge directly above pin
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(`📍 ${activeOrigin.domain}`, originPt.x, originPt.y - 14);

        ctx.font = "9px monospace";
        ctx.fillStyle = "#f97316";
        ctx.fillText(`${activeOrigin.ip} (${activeOrigin.region.split(",")[0]})`, originPt.x, originPt.y - 3);

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [activeOrigin]);

  // 3. Mouse / Touch Drag to Rotate Globe in 3D
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    rotationRef.current.isDragging = true;
    rotationRef.current.dragStart = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rotationRef.current.isDragging || !rotationRef.current.dragStart) return;
    const dx = e.clientX - rotationRef.current.dragStart.x;
    const dy = e.clientY - rotationRef.current.dragStart.y;

    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x = Math.max(-1.1, Math.min(1.1, rotationRef.current.x + dy * 0.005));

    rotationRef.current.dragStart = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    rotationRef.current.isDragging = false;
    rotationRef.current.dragStart = null;
  };

  // Filtered Packets for the Live Connection Stream
  const filteredPackets = useMemo(() => {
    return packets.filter((pkt) => {
      if (filterMode === "ALLOWED" && pkt.status !== "ALLOWED") return false;
      if (filterMode === "BLOCKED" && pkt.status !== "BLOCKED") return false;
      if (filterMode === "AI" && pkt.status !== "AI_GUARDED") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          pkt.clientIp.toLowerCase().includes(q) ||
          pkt.clientGeo.country.toLowerCase().includes(q) ||
          pkt.clientGeo.city.toLowerCase().includes(q) ||
          pkt.path.toLowerCase().includes(q) ||
          (pkt.threatDetails && pkt.threatDetails.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [packets, filterMode, searchQuery]);

  // Real-time Traffic Breakdown Counters
  const allowedCount = packets.filter((p) => p.status === "ALLOWED").length;
  const blockedCount = packets.filter((p) => p.status === "BLOCKED").length;
  const rateLimitCount = packets.filter((p) => p.status === "RATE_LIMITED").length;
  const aiCount = packets.filter((p) => p.status === "AI_GUARDED").length;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    if (showToast) showToast(`Copied integration snippet!`);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner */}
      <section className="flex flex-col justify-between gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Globe2 className="size-3.5" />
              Real-Time Global Traffic & Threat Mesh
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Inbound Stream Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
            Live Global Network Connections & Origin Host Mesh
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-3xl leading-relaxed">
            Visualizes every incoming connection from all countries in real time—including legitimate
            traffic (200 OK), WAF blocked attacks (403), rate-limited bursts (429), and AI agent calls.
            Curved 3D ballistic arcs stream directly into your webapp’s host origin server.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowIntegrationGuide(true)}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Terminal className="size-3.5 text-primary" />
            Connect Your Server SDK
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsStreaming((prev) => !prev)}
            className={`h-9 gap-1.5 text-xs font-semibold ${
              isStreaming
                ? "bg-secondary text-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="size-3.5" /> Pause Feed
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Resume Feed
              </>
            )}
          </Button>
        </div>
      </section>

      {/* 2. Target Webapp / Site Switcher + Origin Host Identity Card */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-8 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <label
                htmlFor="origin-host-select"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                1. Select Webapp / Site to Monitor:
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <select
                  id="origin-host-select"
                  aria-label="Select Target Webapp or Site"
                  value={activeOriginId}
                  onChange={(e) => setActiveOriginId(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                >
                  {allOrigins.map((origin) => (
                    <option key={origin.id} value={origin.id}>
                      {origin.name} — {origin.domain} ({origin.provider})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Stream Velocity:</span>
              {[
                { label: "Normal (1.2s)", ms: 1200 },
                { label: "Live (650ms)", ms: 650 },
                { label: "Stress (250ms)", ms: 250 },
              ].map((v) => (
                <button
                  key={v.ms}
                  type="button"
                  onClick={() => setStreamSpeedMs(v.ms)}
                  className={`rounded px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
                    streamSpeedMs === v.ms
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Origin Server Host Details Badge */}
          <div className="mt-3.5 grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">Origin Host IP</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-foreground">
                {activeOrigin.ip}
              </div>
              <div className="text-[10px] text-muted-foreground">{activeOrigin.domain}</div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">Host Datacenter</div>
              <div className="mt-0.5 text-xs font-semibold text-foreground flex items-center gap-1">
                <span>{activeOrigin.geo.flag}</span>
                <span>{activeOrigin.region}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{activeOrigin.provider}</div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">WAF & Defense Status</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="size-3.5" />
                <span>{activeOrigin.wafMode}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">Uptime {activeOrigin.uptimePct}%</div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">Geo Coordinates</div>
              <div className="mt-0.5 font-mono text-xs text-foreground">
                {activeOrigin.geo.lat.toFixed(4)}°, {activeOrigin.geo.lng.toFixed(4)}°
              </div>
              <div className="text-[10px] text-muted-foreground">{activeOrigin.baseLatencyMs}ms Base Ping</div>
            </div>
          </div>
        </div>

        {/* Live Counters Breakdown */}
        <div className="grid grid-cols-2 gap-2.5 lg:col-span-4 sm:grid-cols-4 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">All Traffic</span>
              <Activity className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {packets.length}
            </div>
            <div className="text-[10px] text-muted-foreground">Packets in active window</div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Allowed (200 OK)</span>
              <CheckCircle2 className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
              {allowedCount}
            </div>
            <div className="text-[10px] text-emerald-500/80">Legitimate visitor traffic</div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
            <div className="flex items-center justify-between text-destructive">
              <span className="text-[11px] font-medium uppercase tracking-wider">Blocked (403)</span>
              <ShieldAlert className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-destructive">
              {blockedCount}
            </div>
            <div className="text-[10px] text-destructive/80">SQLi, XSS, Probes stopped</div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5">
            <div className="flex items-center justify-between text-cyan-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">AI Guarded</span>
              <Sparkles className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
              {aiCount + rateLimitCount}
            </div>
            <div className="text-[10px] text-cyan-500/80">LLM tools & rate-limited</div>
          </div>
        </div>
      </div>

      {/* 3. The 3D Interactive Globe Canvas View */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-[#020617] to-card shadow-2xl">
        {/* Globe Overlay HUD: Rotation Tip & Legend */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-1.5 backdrop-blur-md">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <span className="text-[11px] font-semibold text-foreground">
              Drag to spin 3D Globe · Scroll to inspect continents
            </span>
          </div>

          {/* Color-Coded Arcs Legend */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-1 text-[10px] backdrop-blur-md">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="size-2 rounded-full bg-emerald-400" />
              Allowed (200 OK)
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <span className="size-2 rounded-full bg-rose-400" />
              Blocked Threat (403)
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <span className="size-2 rounded-full bg-amber-400" />
              Rate-Limited (429)
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <span className="size-2 rounded-full bg-cyan-400" />
              AI Prompt Shield
            </span>
          </div>
        </div>

        {/* Origin Target Pin HUD Overlay */}
        <div className="pointer-events-none absolute right-4 top-4 z-10 hidden sm:flex flex-col items-end gap-1">
          <div className="rounded-xl border border-primary/40 bg-card/90 p-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Host: {activeOrigin.name}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              IP: <span className="text-primary font-semibold">{activeOrigin.ip}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              Domain: {activeOrigin.domain}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="size-3" />
              <span>All Inbound Arcs Terminate Here</span>
            </div>
          </div>
        </div>

        {/* HTML5 Canvas Element */}
        <canvas
          ref={canvasRef}
          width={1000}
          height={540}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-[460px] w-full cursor-grab active:cursor-grabbing sm:h-[540px]"
          title="Drag mouse or finger to rotate the 3D globe"
        />

        {/* Bottom Ticker Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-card/90 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Radio className="size-3.5 text-primary animate-pulse" />
            <span className="font-semibold text-foreground">Latest Inbound Connection:</span>
            {packets[0] ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {packets[0].clientGeo.flag} {packets[0].clientGeo.country} ({packets[0].clientIp}) ───&gt;{" "}
                <span className="text-foreground font-semibold">{packets[0].path}</span> [
                <span
                  className={
                    packets[0].status === "ALLOWED"
                      ? "text-emerald-400 font-bold"
                      : packets[0].status === "BLOCKED"
                        ? "text-rose-400 font-bold"
                        : "text-amber-400 font-bold"
                  }
                >
                  {packets[0].httpCode} {packets[0].status}
                </span>
                ] · {packets[0].latencyMs}ms
              </span>
            ) : (
              <span className="text-muted-foreground">Listening for network packets...</span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span>Origin: {activeOrigin.ip} ({activeOrigin.region.split(",")[0]})</span>
          </div>
        </div>
      </section>

      {/* 4. Live Connection Packet Stream Table & Filter Bar */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground sm:text-base">
              Live Network Connection Stream (All Inbound Traffic)
            </h2>
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {filteredPackets.length} shown
            </span>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
              {(
                [
                  { id: "ALL", label: "All Traffic" },
                  { id: "ALLOWED", label: "Allowed Only" },
                  { id: "BLOCKED", label: "Blocked Threats" },
                  { id: "AI", label: "AI Guarded" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    filterMode === tab.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter IP, country, route..."
                className="h-8.5 w-44 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Live Table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pl-2">Time</th>
                <th className="py-2.5">Visitor Country & Flag</th>
                <th className="py-2.5">Client IP</th>
                <th className="py-2.5">Method & Route</th>
                <th className="py-2.5">Target Host (Origin)</th>
                <th className="py-2.5">Status & Defense Action</th>
                <th className="py-2.5">Latency</th>
                <th className="py-2.5 pr-2 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-xs">
              {filteredPackets.slice(0, 15).map((pkt) => (
                <tr
                  key={pkt.id}
                  className={`transition-colors hover:bg-secondary/40 ${
                    selectedPacket?.id === pkt.id ? "bg-primary/10" : ""
                  }`}
                >
                  <td className="py-2.5 pl-2 text-muted-foreground">{pkt.timestamp}</td>

                  <td className="py-2.5 font-sans">
                    <span className="mr-1.5 text-base">{pkt.clientGeo.flag}</span>
                    <span className="font-semibold text-foreground">{pkt.clientGeo.country}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">({pkt.clientGeo.city})</span>
                  </td>

                  <td className="py-2.5">
                    <span className="font-semibold text-foreground">{pkt.clientIp}</span>
                  </td>

                  <td className="py-2.5">
                    <span
                      className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        pkt.method === "POST"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-blue-500/15 text-blue-400"
                      }`}
                    >
                      {pkt.method}
                    </span>
                    <span className="truncate max-w-[200px] inline-block align-middle text-muted-foreground">
                      {pkt.path}
                    </span>
                  </td>

                  <td className="py-2.5 text-muted-foreground">
                    <span className="text-foreground">{pkt.originIp}</span> ({activeOrigin.region.split(",")[0]})
                  </td>

                  <td className="py-2.5 font-sans">
                    {pkt.status === "ALLOWED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        200 Allowed
                      </span>
                    )}

                    {pkt.status === "BLOCKED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400" title={pkt.threatDetails}>
                        <ShieldAlert className="size-3" />
                        403 {pkt.threatDetails?.split(" ")[0] || "Blocked"}
                      </span>
                    )}

                    {pkt.status === "RATE_LIMITED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                        <Activity className="size-3" />
                        429 Rate-Limited
                      </span>
                    )}

                    {pkt.status === "AI_GUARDED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-400">
                        <Sparkles className="size-3" />
                        200 AI Prompt Firewall
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 text-muted-foreground">
                    {pkt.latencyMs}ms
                  </td>

                  <td className="py-2.5 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPacket(pkt)}
                      className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/60 hover:text-primary transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Packet Inspection Drawer Modal */}
      {selectedPacket && (
        <div
          role="dialog"
          aria-label="Network packet inspection"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Packet Inspection: {selectedPacket.clientIp}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPacket(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-background p-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Client Location</span>
                  <div className="mt-0.5 font-bold text-foreground">
                    {selectedPacket.clientGeo.flag} {selectedPacket.clientGeo.city}, {selectedPacket.clientGeo.country}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Lat/Lng: {selectedPacket.clientGeo.lat}, {selectedPacket.clientGeo.lng}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Target Origin Host</span>
                  <div className="mt-0.5 font-bold text-primary">
                    {selectedPacket.originIp}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedPacket.originName}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-background p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HTTP Request:</span>
                  <span className="font-bold text-foreground">{selectedPacket.method} {selectedPacket.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Response Status:</span>
                  <span className={selectedPacket.status === "ALLOWED" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {selectedPacket.httpCode} {selectedPacket.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency & Payload:</span>
                  <span className="text-foreground">{selectedPacket.latencyMs}ms · {selectedPacket.bytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client ISP / Gateway:</span>
                  <span className="text-foreground">{selectedPacket.userAgent}</span>
                </div>
                {selectedPacket.threatDetails && (
                  <div className="border-t border-border pt-1.5 text-rose-400">
                    <span className="font-bold">WAF Action:</span> {selectedPacket.threatDetails}
                  </div>
                )}
                {selectedPacket.guardrailAction && (
                  <div className="border-t border-border pt-1.5 text-cyan-400">
                    <span className="font-bold">Guardrail:</span> {selectedPacket.guardrailAction}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setSelectedPacket(null)} size="sm">
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. "How to Connect Your Real Server" Integration Guide Modal */}
      {showIntegrationGuide && (
        <div
          role="dialog"
          aria-label="Connect Real Server SDK"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-primary/40 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="size-5 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    Stream Your Live Server Traffic to this 3D Globe
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Install our 3-line drop-in middleware on your webapp to stream real client IPs and origin traffic.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrationGuide(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Step 1: Install */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  1. Install SparrowX Middleware
                </div>
                <div className="relative rounded-lg bg-background p-3 font-mono text-xs text-foreground border border-border">
                  <code>npm install @sparrowx/shield</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("npm install @sparrowx/shield", "npm")}
                    className="absolute right-2.5 top-2.5 rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {copiedSnippet === "npm" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Step 2: Code for Node.js / Express / Next.js */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  2. Add to your Express / Next.js server
                </div>
                <div className="relative rounded-lg bg-background p-3.5 font-mono text-xs text-foreground border border-border overflow-x-auto">
                  <pre>{`import { sparrowxShield } from "@sparrowx/shield";

// Attach SparrowX Edge WAF & Live Telemetry Stream
app.use(sparrowxShield({
  apiKey: "spx_live_948201a",
  originIp: "${activeOrigin.ip}",      // Your server's public IP
  siteDomain: "${activeOrigin.domain}", // Your webapp domain
  streamAllConnections: true,          // Streams both allowed & blocked hits
}));`}</pre>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `import { sparrowxShield } from "@sparrowx/shield";\n\napp.use(sparrowxShield({\n  apiKey: "spx_live_948201a",\n  originIp: "${activeOrigin.ip}",\n  siteDomain: "${activeOrigin.domain}",\n  streamAllConnections: true,\n}));`,
                        "code",
                      )
                    }
                    className="absolute right-2.5 top-2.5 rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {copiedSnippet === "code" ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              </div>

              {/* Step 3: Python FastAPI / Flask Alternative */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  3. Python (FastAPI / Flask)
                </div>
                <div className="rounded-lg bg-background p-3 font-mono text-xs text-foreground border border-border">
                  <pre>{`from sparrowx_shield import SparrowxMiddleware

app.add_middleware(
    SparrowxMiddleware,
    api_key="spx_live_948201a",
    origin_ip="${activeOrigin.ip}"
)`}</pre>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setShowIntegrationGuide(false)}>
                Done & Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
