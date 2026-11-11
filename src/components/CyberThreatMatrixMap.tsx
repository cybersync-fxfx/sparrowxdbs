import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTINENTS_GEO } from "@/components/globe/EarthTextures";
import { CountryFlag } from "@/components/ui/CountryFlag";
import {
  ShieldAlert,
  Radio,
  Crosshair,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RefreshCw,
  Search,
  ExternalLink,
  Target,
  Server,
  Network,
  Activity,
  CheckCircle2,
} from "lucide-react";

export interface ThreatMapCity {
  name: string;
  lat: number;
  lon: number;
  country: string;
  countryCode?: string;
  isOrigin?: boolean;
  hostingHub?: string;
  threatLevel?: "nominal" | "elevated" | "critical";
  ip?: string;
}

export interface LiveThreatArc {
  id: string;
  time: string;
  type: string;
  severity: "critical" | "high" | "med" | "low";
  src: ThreatMapCity;
  dst: ThreatMapCity;
  status: "BLOCKED" | "INTERCEPTED" | "QUARANTINED" | "RATE_LIMITED";
  progress: number;
  bornTime: number;
  durationMs: number;
  color: string;
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  protocol: string;
  countryName: string;
  countryCode?: string;
}

export const MAP_DEFAULT_CITIES: ThreatMapCity[] = [
  { name: "Roubaix (OVH Host)", lat: 50.69, lon: 3.17, isOrigin: true, country: "France", countryCode: "FR", ip: "51.68.21.44", hostingHub: "OVHcloud EU-West Core" },
  { name: "Chennai", lat: 13.08, lon: 80.27, isOrigin: true, country: "India", countryCode: "IN", ip: "103.159.214.18", hostingHub: "AP-South Origin Host" },
  { name: "Dubai", lat: 25.2, lon: 55.27, isOrigin: true, country: "United Arab Emirates", countryCode: "AE", ip: "185.190.140.6", hostingHub: "ME-Central Host" },
  { name: "Frankfurt", lat: 50.11, lon: 8.68, isOrigin: true, country: "Germany", countryCode: "DE", ip: "159.69.112.5", hostingHub: "EU-Central Host" },
  { name: "Singapore", lat: 1.35, lon: 103.82, isOrigin: true, country: "Singapore", countryCode: "SG", ip: "139.99.120.4", hostingHub: "OVHcloud AP-South Host" },
  { name: "New York", lat: 40.71, lon: -74.0, isOrigin: true, country: "United States", countryCode: "US", ip: "198.51.100.75", hostingHub: "US-East Host" },
  { name: "Mumbai", lat: 19.07, lon: 72.87, isOrigin: true, country: "India", countryCode: "IN", ip: "103.138.22.8", hostingHub: "OVHcloud Mumbai Host" },
  { name: "London", lat: 51.5, lon: -0.12, country: "United Kingdom", countryCode: "GB", ip: "185.220.101.5", hostingHub: "UK Edge Relay" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, country: "Japan", countryCode: "JP", ip: "133.242.18.2", hostingHub: "AP-Northeast Relay" },
  { name: "São Paulo", lat: -23.55, lon: -46.63, country: "Brazil", countryCode: "BR", ip: "177.18.204.30", hostingHub: "SA-East Edge Node" },
  { name: "Sydney", lat: -33.87, lon: 151.2, country: "Australia", countryCode: "AU", ip: "139.130.4.5", hostingHub: "AP-Southeast Host" },
  { name: "Moscow", lat: 55.75, lon: 37.62, country: "Russia", countryCode: "RU", ip: "95.173.136.72", hostingHub: "Eastern Ingress" },
  { name: "Beijing", lat: 39.9, lon: 116.4, country: "China", countryCode: "CN", ip: "123.125.114.144", hostingHub: "CN-North Ingress" },
  { name: "Seoul", lat: 37.56, lon: 126.97, country: "South Korea", countryCode: "KR", ip: "175.208.44.12", hostingHub: "KR-Central Relay" },
  { name: "Lagos", lat: 6.52, lon: 3.38, country: "Nigeria", countryCode: "NG", ip: "197.210.226.41", hostingHub: "AF-West Relay" },
];

export interface CyberThreatMatrixMapProps {
  className?: string;
  height?: number | string;
  customCities?: ThreatMapCity[];
  showControls?: boolean;
  showFeed?: boolean;
  showStats?: boolean;
  enableSimulation?: boolean;
  simIntervalMs?: number;
  maxFeed?: number;
}

export function CyberThreatMatrixMap({
  className = "",
  height = 640,
  customCities,
  showControls = true,
  showFeed = true,
  showStats = true,
  enableSimulation = false,
  simIntervalMs = 2800,
  maxFeed = 20,
}: CyberThreatMatrixMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [focusedCity, setFocusedCity] = useState<ThreatMapCity | null>(() => {
    return MAP_DEFAULT_CITIES.find((c) => c.name === "Roubaix (OVH Host)") || MAP_DEFAULT_CITIES[0];
  });
  const [hoveredCity, setHoveredCity] = useState<{ city: ThreatMapCity; x: number; y: number } | null>(null);

  const [activeEvents, setActiveEvents] = useState<LiveThreatArc[]>([]);
  const arcsListRef = useRef<LiveThreatArc[]>([]);
  const totalCountRef = useRef(0);
  const highCountRef = useRef(0);
  const criticalCountRef = useRef(0);

  const cities = useMemo(() => customCities || MAP_DEFAULT_CITIES, [customCities]);

  // Coordinate projection helper: lat/lon -> [x, y] on canvas
  const project = useCallback((lat: number, lon: number, w: number, h: number): [number, number] => {
    const x = ((lon + 180) / 360) * w;
    const y = ((85 - lat) / 170) * h;
    return [x, y];
  }, []);

  // Point in polygon test for dot-matrix rasterization
  const isPointInPolygon = (pt: [number, number], poly: [number, number][]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Pre-generate dot matrix cache on offscreen canvas
  const landDotsCacheRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const cacheSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // High-visibility dot-matrix continent rasterizer
  const generateDotGrid = useCallback((w: number, h: number) => {
    const dots: { x: number; y: number; alpha: number }[] = [];
    const step = 4.6; // High density grid for crisp, well-defined continent silhouettes

    const polygons = CONTINENTS_GEO.map((c) => ({
      coords: c.coords,
      minLat: Math.min(...c.coords.map((p) => p[0])),
      maxLat: Math.max(...c.coords.map((p) => p[0])),
      minLon: Math.min(...c.coords.map((p) => p[1])),
      maxLon: Math.max(...c.coords.map((p) => p[1])),
    }));

    for (let x = 4; x < w; x += step) {
      const lon = (x / w) * 360 - 180;
      for (let y = 4; y < h; y += step) {
        const lat = 85 - (y / h) * 170;

        let inLand = false;
        for (const poly of polygons) {
          if (lat < poly.minLat || lat > poly.maxLat || lon < poly.minLon || lon > poly.maxLon) {
            continue;
          }
          if (isPointInPolygon([lat, lon], poly.coords)) {
            inLand = true;
            break;
          }
        }

        if (inLand) {
          // Vivid, bright tactical alpha for clear continental silhouettes
          const dAlpha = 0.65 + 0.28 * Math.sin(x * 0.04) * Math.cos(y * 0.04);
          dots.push({ x, y, alpha: dAlpha });
        }
      }
    }
    return dots;
  }, []);

  // Poll live telemetry from local PostgreSQL rest/v1/incidents
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const seenEventIds = new Set<string>();

    const pollLiveIncidents = async () => {
      try {
        const res = await fetch(`${window.location.origin}/rest/v1/incidents?select=*`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(rows) || rows.length === 0 || cancelled) return;

        rows.slice(0, 30).forEach((r, idx) => {
          const id = String(r.id || `inc-${idx}`);
          if (seenEventIds.has(id)) return;
          seenEventIds.add(id);

          const originHubs = cities.filter((c) => c.isOrigin);
          const dst = originHubs.length > 0 ? originHubs[idx % originHubs.length] : cities[0];
          const srcPool = cities.filter((c) => !c.isOrigin);
          const src = srcPool.length > 0 ? srcPool[idx % srcPool.length] : cities[1] || cities[0];

          const sevRaw = String(r.severity || "med").toLowerCase();
          const severity: "critical" | "high" | "med" | "low" =
            sevRaw === "critical" ? "critical" : sevRaw === "high" ? "high" : sevRaw === "low" ? "low" : "med";

          const title = String(r.title || "Inbound Telemetry Event");
          const status = severity === "critical" ? "QUARANTINED" : severity === "high" ? "BLOCKED" : "INTERCEPTED";

          let color = "#00e5ff";
          if (severity === "critical") color = "#ff3366";
          else if (severity === "high") color = "#ffaa00";

          // Calculate port and protocol connecting to the host
          let dstPort = 443;
          let protocol = "TLS/HTTPS";
          if (title.toLowerCase().includes("ssh") || title.toLowerCase().includes("brute")) {
            dstPort = 22;
            protocol = "SSH/2.0";
          } else if (title.toLowerCase().includes("sql") || title.toLowerCase().includes("injection")) {
            dstPort = 5432;
            protocol = "TCP/Postgres";
          } else if (title.toLowerCase().includes("waf") || title.toLowerCase().includes("shield") || title.toLowerCase().includes("prompt")) {
            dstPort = 8443;
            protocol = "TLS/WAF";
          } else if (title.toLowerCase().includes("http") || title.toLowerCase().includes("redirect")) {
            dstPort = 80;
            protocol = "TCP/HTTP";
          }

          const srcPort = 30000 + ((idx * 1789) % 32000);

          const arc: LiveThreatArc = {
            id,
            time: String(r.time || new Date().toLocaleTimeString([], { hour12: false })),
            type: title,
            severity,
            src,
            dst,
            status,
            progress: 0,
            bornTime: performance.now(),
            durationMs: 2400,
            color,
            srcIp: src.ip || `198.51.100.${(idx * 7) % 250 + 2}`,
            srcPort,
            dstIp: dst.ip || "51.68.21.44",
            dstPort,
            protocol,
            countryName: src.country,
            countryCode: src.countryCode,
          };

          totalCountRef.current++;
          if (severity === "critical") criticalCountRef.current++;
          if (severity === "high" || severity === "critical") highCountRef.current++;

          arcsListRef.current = [arc, ...arcsListRef.current.slice(0, 24)];
          if (!isFeedPaused) {
            setActiveEvents((prev) => [arc, ...prev.slice(0, 7)]);
          }
        });
      } catch {
        // offline / waiting
      }
    };

    void pollLiveIncidents();
    const interval = window.setInterval(pollLiveIncidents, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cities, isFeedPaused]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isPlaying) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Re-cache dots if dimension changed
      if (cacheSizeRef.current.w !== w || cacheSizeRef.current.h !== h) {
        landDotsCacheRef.current = generateDotGrid(w, h);
        cacheSizeRef.current = { w, h };
      }

      const now = performance.now();

      // 1. Tactical Deep Cyber Background & Coordinate Grid
      ctx.fillStyle = "#06070a";
      ctx.fillRect(0, 0, w, h);

      // Cyber Matrix Grid Lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      ctx.lineWidth = 1;
      const gridPitch = 44;
      ctx.beginPath();
      for (let gx = 0; gx < w; gx += gridPitch) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
      }
      for (let gy = 0; gy < h; gy += gridPitch) {
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
      }
      ctx.stroke();

      // 2. High-Visibility Dot-Matrix Continents (Crisp Silver-Slate)
      const dots = landDotsCacheRef.current;
      ctx.fillStyle = "#94a3b8"; // High-visibility light slate
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 3. Permanent Backbone / Inter-Cluster Host Mesh Lines
      const originHubs = cities.filter((c) => c.isOrigin);
      ctx.strokeStyle = "rgba(255, 170, 0, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < originHubs.length; i++) {
        const a = originHubs[i];
        const b = originHubs[(i + 1) % originHubs.length];
        if (!a || !b) continue;
        const [ax, ay] = project(a.lat, a.lon, w, h);
        const [bx, by] = project(b.lat, b.lon, w, h);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 4. Render Active Live Threat & Connection Arcs
      const arcs = arcsListRef.current;
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const elapsed = now - arc.bornTime;
        const progress = Math.min(1, elapsed / arc.durationMs);

        const [sx, sy] = project(arc.src.lat, arc.src.lon, w, h);
        const [dx, dy] = project(arc.dst.lat, arc.dst.lon, w, h);

        // Curvature elevates parabolic laser upwards
        const mx = (sx + dx) / 2;
        const dist = Math.hypot(dx - sx, dy - sy);
        const my = Math.min(sy, dy) - Math.min(150, Math.max(45, dist * 0.3));

        // Draw parabolic curve laser trail
        ctx.save();
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 2.0;
        ctx.globalAlpha = 0.9 * (1 - progress * 0.35);
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, dx, dy);
        ctx.stroke();
        ctx.restore();

        // Projectile head
        const t = progress;
        const headX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * dx;
        const headY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * dy;

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(headX, headY, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tactical Live Connection Badge (Shows Country, IP, and Connecting Port!)
        if (progress > 0.12 && progress < 0.88) {
          ctx.save();
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          const tag = `${arc.countryName} (${arc.srcIp}) ➔ HOST:${arc.dstPort} [${arc.protocol}]`;
          const textW = ctx.measureText(tag).width;

          ctx.fillStyle = "rgba(6, 8, 14, 0.92)";
          ctx.strokeStyle = arc.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(headX - textW / 2 - 6, headY - 22, textW + 12, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(tag, headX, headY - 10);
          ctx.restore();
        }

        // Remove expired arcs
        if (elapsed > arc.durationMs + 1000) {
          arcs.splice(i, 1);
        }
      }

      // 5. Render Origin Hosts & Tactical Target Beacons
      cities.forEach((city) => {
        const [cx, cy] = project(city.lat, city.lon, w, h);
        const isOrigin = Boolean(city.isOrigin);
        const isFocused = focusedCity?.name === city.name;

        // Dedicated Radar Waves for Host Locations
        if (isOrigin) {
          ctx.save();
          const phase = (now * 0.0016) % 1;
          const rRadius = 6 + phase * 32;
          const rAlpha = Math.max(0, 1 - phase);

          ctx.beginPath();
          ctx.arc(cx, cy, rRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 170, 0, ${rAlpha * 0.85})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Second wave
          const phase2 = (now * 0.0016 + 0.5) % 1;
          const rRadius2 = 6 + phase2 * 32;
          const rAlpha2 = Math.max(0, 1 - phase2);
          ctx.beginPath();
          ctx.arc(cx, cy, rRadius2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(16, 185, 129, ${rAlpha2 * 0.65})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();

          // Golden Host Node
          ctx.fillStyle = "#ffaa00";
          ctx.shadowColor = "#ffaa00";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Standard Visitor / Ingress Node
          ctx.save();
          ctx.fillStyle = "#00e5ff";
          ctx.shadowColor = "#00e5ff";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Tactical Target Pin on the Focused Location (Shows Where Your Host is Located!)
        if (isFocused) {
          ctx.save();
          const pinColor = isOrigin ? "#ffaa00" : "#00e5ff";
          ctx.fillStyle = pinColor;
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;

          // Teardrop map pin
          const pinY = cy - 10;
          ctx.beginPath();
          ctx.arc(cx, pinY - 8, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx - 6, pinY - 5);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + 6, pinY - 5);
          ctx.fill();
          ctx.stroke();

          // Inner pin eye
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(cx, pinY - 8, 3, 0, Math.PI * 2);
          ctx.fill();

          // Host Location Label & Port Metadata Tag
          const headerTag = isOrigin ? `⭐ YOUR HOST: ${city.country} (${city.name})` : city.country;
          const subTag = `IP: ${city.ip || "Direct Host"} · Ports: 80, 443, 8443, 22, 5432`;

          ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          const tw = Math.max(ctx.measureText(headerTag).width, 180);

          // Tag Box Background
          ctx.fillStyle = "rgba(6, 8, 14, 0.94)";
          ctx.strokeStyle = pinColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(cx - tw / 2 - 8, cy - 50, tw + 16, 28, 4);
          ctx.fill();
          ctx.stroke();

          // Text Render
          ctx.fillStyle = pinColor;
          ctx.fillText(headerTag, cx, cy - 36);

          ctx.font = "9px monospace";
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(subTag, cx, cy - 25);

          ctx.restore();
        }
      });

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cities, focusedCity, project, generateDotGrid, isPlaying]);

  // Handle Mouse Hover / Click on Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: ThreatMapCity | null = null;
    for (const city of cities) {
      const [cx, cy] = project(city.lat, city.lon, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      if (Math.hypot(cx - x, cy - y) < 16) {
        found = city;
        break;
      }
    }

    if (found) {
      setHoveredCity({ city: found, x, y });
    } else {
      setHoveredCity(null);
    }
  };

  const handleCanvasClick = () => {
    if (hoveredCity) {
      setFocusedCity(hoveredCity.city);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-[#1f242e] bg-[#06070a] shadow-2xl select-none ${className}`}
      style={{ height }}
    >
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
        className="block size-full cursor-crosshair relative z-10"
      />

      {/* TOP HEADER HUD: Active Host Server & Ports Banner */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex justify-center px-4">
        <div className="flex flex-wrap items-center gap-3 rounded-full border border-amber-500/40 bg-[#090b12]/95 px-4 py-1.5 backdrop-blur-md text-xs font-mono shadow-2xl">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <Server className="size-3.5" />
            <span>HOST SERVER:</span>
          </div>
          <span className="text-white font-semibold flex items-center gap-1.5">
            {focusedCity?.isOrigin && <span className="text-emerald-400 font-bold">●</span>}
            {focusedCity ? `${focusedCity.country} (${focusedCity.name})` : "SparrowX Host Mesh"}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-300">
            IP: <strong className="text-amber-300">{focusedCity?.ip || "51.68.21.44"}</strong>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            <span>Active Ports: 80, 443, 8443, 22, 5432</span>
          </span>
        </div>
      </div>

      {/* City Tooltip on Hover */}
      {hoveredCity && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/95 p-2.5 shadow-2xl backdrop-blur-md text-xs leading-tight min-w-52"
          style={{ left: hoveredCity.x, top: hoveredCity.y }}
        >
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-1.5 mb-1.5">
            <span className="font-bold text-white tracking-wide flex items-center gap-1.5">
              {hoveredCity.city.isOrigin ? <Server className="size-3 text-amber-400" /> : <Network className="size-3 text-cyan-400" />}
              {hoveredCity.city.name}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              hoveredCity.city.isOrigin ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
            }`}>
              {hoveredCity.city.isOrigin ? "YOUR HOST" : "EDGE RELAY"}
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-zinc-400 font-mono">
            <div className="flex justify-between gap-2">
              <span>Country:</span>
              <span className="text-white font-semibold">{hoveredCity.city.country}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Host IP:</span>
              <span className="text-amber-300 font-bold">{hoveredCity.city.ip || "Direct Network"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Hub / Datacenter:</span>
              <span className="text-zinc-300">{hoveredCity.city.hostingHub || "Autonomous Edge"}</span>
            </div>
            {hoveredCity.city.isOrigin && (
              <div className="flex justify-between gap-2 text-emerald-400 pt-1 border-t border-[#1f1f1f]">
                <span>Inbound Ports:</span>
                <span>80, 443, 8443, 22</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP-LEFT HUD: Realtime Threat Monitor (Decongested with Collapse Toggle) */}
      {showStats && (
        isStatsCollapsed ? (
          <button
            type="button"
            onClick={() => setIsStatsCollapsed(false)}
            className="absolute left-3 sm:left-4 top-3 z-20 pointer-events-auto flex items-center gap-2 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white backdrop-blur-md shadow-xl transition-all cursor-pointer"
          >
            <Radio className="size-3 text-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">Threat Monitor</span>
            <span className="text-[10px] text-zinc-400">({totalCountRef.current} events)</span>
            <span className="text-[10px] text-amber-400 font-bold ml-1">Expand ▾</span>
          </button>
        ) : (
          <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-20 pointer-events-auto rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/92 p-3.5 backdrop-blur-xl shadow-2xl text-xs max-w-[240px]">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-2 mb-2 font-bold text-white tracking-wider">
              <div className="flex items-center gap-2">
                <Radio className="size-3 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-extrabold font-mono">REALTIME THREAT MONITOR</span>
              </div>
              <button
                type="button"
                onClick={() => setIsStatsCollapsed(true)}
                className="text-[9px] text-zinc-400 hover:text-white transition-colors cursor-pointer underline"
              >
                Hide
              </button>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">TOTAL EVENTS:</span>
                <span className="font-bold text-white text-sm">{totalCountRef.current}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">HIGH SEVERITY:</span>
                <span className="font-bold text-[#FF354F]">{highCountRef.current}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">CRITICAL THREATS:</span>
                <span className="font-bold text-red-500">{criticalCountRef.current}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">ACTIVE ARCS:</span>
                <span className="font-bold text-cyan-400">{activeEvents.length}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[#1F1F1F] pt-1.5 mt-1">
                <span className="text-zinc-400">ACTIVE ORIGINS:</span>
                <span className="font-bold text-amber-400">
                  {cities.filter((c) => c.isOrigin).length} active hosts
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#1F1F1F] flex items-center justify-between text-[9px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                2D DOT-MATRIX LIVE
              </span>
              <span className="text-zinc-400">PERIMETER NOMINAL</span>
            </div>
          </div>
        )
      )}

      {/* TOP-RIGHT FEED: Real-Time Host Connections (Decongested with Collapse Toggle) */}
      {showFeed && (
        isFeedCollapsed ? (
          <button
            type="button"
            onClick={() => setIsFeedCollapsed(false)}
            className="absolute right-3 sm:right-4 top-3 z-20 pointer-events-auto flex items-center gap-2 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white backdrop-blur-md shadow-xl transition-all cursor-pointer"
          >
            <ShieldAlert className="size-3.5 text-amber-400" />
            <span className="font-semibold text-white">Live Host Feed</span>
            <span className="text-[10px] text-emerald-400 font-bold">({activeEvents.length})</span>
            <span className="text-[10px] text-amber-400 font-bold ml-1">Expand ▾</span>
          </button>
        ) : (
          <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-20 w-[calc(100vw-24px)] sm:w-80 md:w-96 max-w-sm flex flex-col gap-1.5 pointer-events-none">
            <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-200 px-3 py-2 flex items-center justify-between bg-[#0A0A0A]/95 rounded-lg border border-[#1F1F1F] backdrop-blur-md shadow-xl">
              <span className="flex items-center gap-1.5 text-amber-400">
                <ShieldAlert className="size-3.5 text-amber-400" />
                <span className="font-bold text-white">REAL-TIME HOST CONNECTIONS</span>
              </span>
              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setIsFeedPaused(!isFeedPaused)}
                  className="text-[9px] text-zinc-400 hover:text-white transition-colors underline cursor-pointer"
                >
                  {isFeedPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFeedCollapsed(true)}
                  className="text-[9px] text-zinc-400 hover:text-white transition-colors underline cursor-pointer"
                >
                  Hide
                </button>
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto no-scrollbar pointer-events-auto">
              {activeEvents.length === 0 ? (
                <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A]/90 p-3 text-[11px] text-zinc-400 backdrop-blur-md space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>Telemetry Feed Active · Listening</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-zinc-400">
                    Monitoring live host connections with remote IP, origin country, and destination port.
                  </p>
                </div>
              ) : (
                activeEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setFocusedCity(evt.dst)}
                    className="group cursor-pointer rounded-lg px-3 py-2 text-[11px] font-mono transition-all border border-l-4 border-l-amber-400 bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F] backdrop-blur-xl hover:border-zinc-700 shadow-lg"
                  >
                    <div className="flex items-center justify-between text-[9px] text-zinc-400 pb-1 border-b border-zinc-800/80">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <span>{evt.time}</span>
                        <span>·</span>
                        <CountryFlag code={evt.countryCode || "UN"} className="size-3 inline-block" />
                        <strong className="text-white">{evt.countryName}</strong>
                        <span className="text-zinc-500">({evt.srcIp}:{evt.srcPort})</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded font-bold font-mono text-[9px] border bg-amber-500/10 text-amber-300 border-amber-500/40">
                        PORT {evt.dstPort} / {evt.protocol}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-white text-xs group-hover:text-amber-300 transition-colors">
                        ➔ HOST: {evt.dst.name} <span className="text-[10px] text-zinc-400 font-normal">[{evt.dstIp}]</span>
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        evt.status === "BLOCKED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : evt.status === "QUARANTINED"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}>
                        {evt.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-0.5">
                      <span className="truncate text-zinc-400">{evt.type}</span>
                      <span className="text-[9px] text-zinc-500">
                        Edge Transit Nominal
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      )}

      {/* BOTTOM ORIGIN SELECTOR BAR */}
      <div className="absolute bottom-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/92 px-3.5 py-2 backdrop-blur-xl shadow-2xl text-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-0.5 max-w-full">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Target className="size-3 text-amber-400" /> Focus Host:
          </span>
          {cities
            .filter((c) => c.isOrigin)
            .map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setFocusedCity(c)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  focusedCity?.name === c.name
                    ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                    : "border border-[#2a2a2a] bg-[#141414] text-zinc-300 hover:text-white hover:bg-[#1f1f1f]"
                }`}
              >
                <CountryFlag code={c.countryCode || "UN"} className="size-3 inline-block" />
                <span>{c.country} ({c.name})</span>
              </button>
            ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Telemetry Ports: 80, 443, 8443, 22</span>
          </span>
        </div>
      </div>
    </div>
  );
}
