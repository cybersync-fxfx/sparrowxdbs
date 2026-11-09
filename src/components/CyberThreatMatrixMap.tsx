import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTINENTS_GEO } from "@/components/globe/EarthTextures";
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
} from "lucide-react";

export interface ThreatMapCity {
  name: string;
  lat: number;
  lon: number;
  country: string;
  isOrigin?: boolean;
  hostingHub?: string;
  threatLevel?: "nominal" | "elevated" | "critical";
}

export interface LiveThreatArc {
  id: string;
  time: string;
  type: string;
  severity: "critical" | "high" | "med" | "low";
  src: ThreatMapCity;
  dst: ThreatMapCity;
  status: "BLOCKED" | "INTERCEPTED" | "QUARANTINED" | "RATE_LIMITED";
  progress: number; // 0 to 1
  bornTime: number;
  durationMs: number;
  color: string;
}

export const MAP_DEFAULT_CITIES: ThreatMapCity[] = [
  { name: "Roubaix (OVH)", lat: 50.69, lon: 3.17, isOrigin: true, country: "France", hostingHub: "OVHcloud EU-West Host" },
  { name: "Chennai", lat: 13.08, lon: 80.27, isOrigin: true, country: "India", hostingHub: "AP-South Origin Host" },
  { name: "Dubai", lat: 25.2, lon: 55.27, isOrigin: true, country: "United Arab Emirates", hostingHub: "ME-Central Host" },
  { name: "Frankfurt", lat: 50.11, lon: 8.68, isOrigin: true, country: "Germany", hostingHub: "EU-Central Host" },
  { name: "Singapore", lat: 1.35, lon: 103.82, isOrigin: true, country: "Singapore", hostingHub: "OVHcloud AP-South Host" },
  { name: "New York", lat: 40.71, lon: -74.0, isOrigin: true, country: "United States", hostingHub: "US-East Host" },
  { name: "London", lat: 51.5, lon: -0.12, country: "United Kingdom", hostingHub: "UK Edge Relay" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, country: "Japan", hostingHub: "AP-Northeast Relay" },
  { name: "São Paulo", lat: -23.55, lon: -46.63, country: "Brazil", hostingHub: "SA-East Edge Node" },
  { name: "Sydney", lat: -33.87, lon: 151.2, country: "Australia", hostingHub: "AP-Southeast Host" },
  { name: "Moscow", lat: 55.75, lon: 37.62, country: "Russia", hostingHub: "Eastern Ingress" },
  { name: "Beijing", lat: 39.9, lon: 116.4, country: "China", hostingHub: "CN-North Ingress" },
  { name: "Seoul", lat: 37.56, lon: 126.97, country: "South Korea", hostingHub: "KR-Central Relay" },
  { name: "Mumbai", lat: 19.07, lon: 72.87, isOrigin: true, country: "India", hostingHub: "OVHcloud Mumbai Host" },
  { name: "Lagos", lat: 6.52, lon: 3.38, country: "Nigeria", hostingHub: "AF-West Relay" },
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
  height = 560,
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
  const [focusedCity, setFocusedCity] = useState<ThreatMapCity | null>(() => {
    return MAP_DEFAULT_CITIES.find((c) => c.name === "Dubai") || MAP_DEFAULT_CITIES[0];
  });
  const [hoveredCity, setHoveredCity] = useState<{ city: ThreatMapCity; x: number; y: number } | null>(null);

  const [activeEvents, setActiveEvents] = useState<LiveThreatArc[]>([]);
  const arcsListRef = useRef<LiveThreatArc[]>([]);
  const totalCountRef = useRef(0);
  const highCountRef = useRef(0);
  const criticalCountRef = useRef(0);
  const [stats, setStats] = useState({ totalEvents: 0, highEvents: 0, criticalEvents: 0, activeArcs: 0 });

  const cities = useMemo(() => customCities || MAP_DEFAULT_CITIES, [customCities]);

  // Coordinate projection helper: lat/lon -> [x, y] on canvas
  const project = useCallback((lat: number, lon: number, w: number, h: number): [number, number] => {
    // Equirectangular / Miller-like mapping adjusted for comfortable continental aspect
    const x = ((lon + 180) / 360) * w;
    // Compress polar distortion slightly so landmasses sit centered
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

  const generateDotGrid = useCallback((w: number, h: number) => {
    const dots: { x: number; y: number; alpha: number }[] = [];
    const step = 6; // Grid pitch (dots density)

    // Pre-calculate polygon bounds in lat/lon for fast discard
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
          // Subtle variance in dot brightness for tactile depth
          const dAlpha = 0.25 + 0.15 * Math.sin(x * 0.05) * Math.cos(y * 0.05);
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
            durationMs: 2200,
            color,
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

      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width || 800);
      const h = Math.floor(typeof height === "number" ? height : 560);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Re-generate dot grid on resize
      if (cacheSizeRef.current.w !== w || cacheSizeRef.current.h !== h) {
        landDotsCacheRef.current = generateDotGrid(w, h);
        cacheSizeRef.current = { w, h };
      }

      const now = performance.now();

      // 1. Background Fill & Cyber Grid Overlay
      ctx.fillStyle = "#07070b";
      ctx.fillRect(0, 0, w, h);

      // Subtle background grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
      ctx.lineWidth = 1;
      const gridPitch = 48;
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

      // 2. Render Dot-Matrix Continents
      const dots = landDotsCacheRef.current;
      ctx.fillStyle = "#3a4150";
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        ctx.globalAlpha = d.alpha;
        ctx.fillRect(d.x, d.y, 2.2, 2.2);
      }
      ctx.globalAlpha = 1.0;

      // 3. Draw Permanent Backbone / Inter-Cluster Host Lines
      const originHubs = cities.filter((c) => c.isOrigin);
      ctx.strokeStyle = "rgba(255, 170, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
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

      // 4. Render Active Live Threat Arcs (Parabolic Curved Laser Trajectories)
      const arcs = arcsListRef.current;
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const elapsed = now - arc.bornTime;
        const progress = Math.min(1, elapsed / arc.durationMs);

        const [sx, sy] = project(arc.src.lat, arc.src.lon, w, h);
        const [dx, dy] = project(arc.dst.lat, arc.dst.lon, w, h);

        // Control point for arc curvature (curves upwards like an ICBM trajectory)
        const mx = (sx + dx) / 2;
        const dist = Math.hypot(dx - sx, dy - sy);
        const my = Math.min(sy, dy) - Math.min(140, Math.max(40, dist * 0.28));

        // Draw parabolic curve trail
        ctx.save();
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.85 * (1 - progress * 0.4);
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, dx, dy);
        ctx.stroke();
        ctx.restore();

        // Projectile head
        const t = progress;
        // Quadratic bezier position formula: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
        const headX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * dx;
        const headY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * dy;

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(headX, headY, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Remove expired arcs
        if (elapsed > arc.durationMs + 1000) {
          arcs.splice(i, 1);
        }
      }

      // 5. Render City Nodes & Beacons (Radar Ripples + Country Tags)
      cities.forEach((city) => {
        const [cx, cy] = project(city.lat, city.lon, w, h);
        const isOrigin = Boolean(city.isOrigin);
        const isFocused = focusedCity?.name === city.name;

        // Radar Ripple Effect for Origins & Focused Target
        if (isOrigin || isFocused) {
          const ripplePhase = (now * 0.002) % 1;
          const rRadius = 4 + ripplePhase * 24;
          const rAlpha = Math.max(0, 1 - ripplePhase);

          ctx.save();
          ctx.strokeStyle = isFocused ? "#ffaa00" : isOrigin ? "rgba(255, 170, 0, 0.8)" : "rgba(0, 229, 255, 0.8)";
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = rAlpha * 0.6;
          ctx.beginPath();
          ctx.arc(cx, cy, rRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Inner Core Dot
        ctx.save();
        ctx.fillStyle = isOrigin ? "#ffaa00" : "#00e5ff";
        ctx.shadowColor = isOrigin ? "#ffaa00" : "#00e5ff";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, isOrigin ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tactical Target Pin on the Focused Country (Like in the User's Screenshot!)
        if (isFocused) {
          ctx.save();
          ctx.fillStyle = "#ffaa00";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;

          // Teardrop map pin
          const pinY = cy - 8;
          ctx.beginPath();
          ctx.arc(cx, pinY - 8, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx - 5, pinY - 5);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + 5, pinY - 5);
          ctx.fill();
          ctx.stroke();

          // Inner pin eye
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(cx, pinY - 8, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Country Label Tag (Exact match to screenshot style)
          const tagText = city.country || city.name;
          ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 4;
          ctx.fillText(tagText, cx, cy - 22);
          ctx.restore();
        }
      });
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cities, focusedCity, project, generateDotGrid, height]);

  // Handle Mouse Hover / Click on Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: ThreatMapCity | null = null;
    for (const city of cities) {
      const [cx, cy] = project(city.lat, city.lon, canvas.width, canvas.height);
      if (Math.hypot(cx - x, cy - y) < 14) {
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredCity) {
      setFocusedCity(hoveredCity.city);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-[#1f242e] bg-[#07070b] shadow-2xl select-none ${className}`}
      style={{ height }}
    >
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
        className="block size-full cursor-crosshair relative z-10"
      />

      {/* TOP HEADER HUD: Current Attack Trajectory Header (Matching Screenshot) */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-amber-500/30 bg-[#0c0d14]/90 px-4 py-1.5 backdrop-blur-md text-xs font-mono shadow-xl">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span>TARGET REGION:</span>
          </div>
          <span className="text-white font-semibold">
            {focusedCity ? `${focusedCity.country} (${focusedCity.name})` : "Global Threat Matrix"}
          </span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">
            {focusedCity?.hostingHub || "Autonomous Edge Perimeter Active"}
          </span>
        </div>
      </div>

      {/* City Tooltip on Hover */}
      {hoveredCity && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/95 p-2.5 shadow-2xl backdrop-blur-md text-xs leading-tight min-w-44"
          style={{ left: hoveredCity.x, top: hoveredCity.y }}
        >
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-1.5 mb-1.5">
            <span className="font-bold text-white tracking-wide">{hoveredCity.city.name}</span>
            <span className="text-[10px] text-amber-400 font-mono">
              {hoveredCity.city.isOrigin ? "ORIGIN HOST" : "EDGE RELAY"}
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-zinc-400">
            <div className="flex justify-between gap-2">
              <span>Country:</span>
              <span className="text-white font-semibold">{hoveredCity.city.country}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Coordinates:</span>
              <span className="text-zinc-300">
                {hoveredCity.city.lat.toFixed(1)}°, {hoveredCity.city.lon.toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TOP-LEFT HUD: Realtime Threat Monitor */}
      {showStats && (
        <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-20 pointer-events-auto rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 p-3.5 backdrop-blur-xl shadow-2xl text-xs max-w-[240px]">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-2 mb-2 font-bold text-white tracking-wider">
            <div className="flex items-center gap-2">
              <Radio className="size-3 text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-extrabold font-mono">REALTIME THREAT MONITOR</span>
            </div>
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
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              2D DOT-MATRIX LIVE
            </span>
            <span>PERIMETER NOMINAL</span>
          </div>
        </div>
      )}

      {/* TOP-RIGHT FEED: Real-Time Host Connections */}
      {showFeed && (
        <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-20 w-72 sm:w-80 flex flex-col gap-1.5 pointer-events-none">
          <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-200 px-2.5 py-1.5 flex items-center justify-between bg-[#0A0A0A]/90 rounded-lg border border-[#1F1F1F] backdrop-blur-md">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="size-3 text-amber-400" />
              <span>REAL-TIME HOST CONNECTIONS</span>
            </span>
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setIsFeedPaused(!isFeedPaused)}
                className="text-[9px] text-zinc-400 hover:text-white transition-colors underline cursor-pointer"
              >
                {isFeedPaused ? "Resume" : "Pause"}
              </button>
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto no-scrollbar pointer-events-auto">
            {activeEvents.length === 0 ? (
              <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A]/90 p-3 text-[11px] text-zinc-400 backdrop-blur-md space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>Telemetry Feed Ready</span>
                </div>
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Streaming genuine WAF &amp; threat telemetry directly from your PostgreSQL cluster.
                </p>
              </div>
            ) : (
              activeEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setFocusedCity(evt.dst)}
                  className="group cursor-pointer rounded-lg px-3 py-2 text-[11px] font-mono transition-all border border-l-4 border-l-amber-400 bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F] backdrop-blur-xl hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-500">{evt.time}</span>
                    <span className="font-semibold text-amber-400 truncate max-w-[170px]">
                      HOST: {evt.dst.hostingHub || evt.dst.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-white text-xs group-hover:text-amber-300 transition-colors">
                      {evt.src.name} → {evt.dst.name}
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-400 shrink-0">
                      {evt.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-0.5">
                    <span className="truncate">{evt.type}</span>
                    <span className="text-[9px] uppercase text-zinc-500">
                      {evt.dst.lat.toFixed(1)}°, {evt.dst.lon.toFixed(1)}°
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BOTTOM ORIGIN SELECTOR BAR */}
      <div className="absolute bottom-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 px-3.5 py-2 backdrop-blur-xl shadow-2xl text-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Target className="size-3 text-amber-400" /> Focus Target:
          </span>
          {cities
            .filter((c) => c.isOrigin)
            .map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setFocusedCity(c)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  focusedCity?.name === c.name
                    ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                    : "border border-[#2a2a2a] bg-[#141414] text-zinc-300 hover:text-white hover:bg-[#1f1f1f]"
                }`}
              >
                {c.country} ({c.name})
              </button>
            ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span>Equirectangular Dot-Matrix Grid</span>
        </div>
      </div>
    </div>
  );
}
