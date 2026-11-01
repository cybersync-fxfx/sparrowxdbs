import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  Globe2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ThreatCity {
  name: string;
  lat: number;
  lon: number;
  isOrigin?: boolean;
}

export interface ThreatEvent {
  id: string;
  time: string;
  type: string;
  severity: "high" | "low";
  src: ThreatCity;
  dst: ThreatCity;
}

export interface CyberThreatGlobeProps {
  className?: string;
  height?: string | number;
  liveWsUrl?: string | null;
  simIntervalMs?: number;
  maxFeed?: number;
  customCities?: ThreatCity[];
  showControls?: boolean;
  showFeed?: boolean;
  showStats?: boolean;
  onEventIntercepted?: (event: ThreatEvent) => void;
}

export const DEFAULT_CITIES: ThreatCity[] = [
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "New York", lat: 40.71, lon: -74.0 },
  { name: "London", lat: 51.5, lon: -0.12 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Sydney", lat: -33.87, lon: 151.2 },
  { name: "Moscow", lat: 55.75, lon: 37.62 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Beijing", lat: 39.9, lon: 116.4 },
  { name: "Dubai", lat: 25.2, lon: 55.27 },
  { name: "Toronto", lat: 43.65, lon: -79.38 },
];

export const DEFAULT_ATTACK_TYPES = [
  "Port scan",
  "Brute force",
  "SQL injection",
  "DDoS burst",
  "Malware beacon",
  "Phishing callback",
  "Credential stuffing",
  "API zero-day probe",
];

// lat/lon (degrees) -> 3D unit vector
function toVec(lat: number, lon: number): [number, number, number] {
  const p = (lat * Math.PI) / 180;
  const l = (lon * Math.PI) / 180;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
}

// spherical interpolation between two unit vectors
function slerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(d);
  if (om < 1e-6) return a;
  const s = Math.sin(om);
  const k1 = Math.sin((1 - t) * om) / s;
  const k2 = Math.sin(t * om) / s;
  return [
    a[0] * k1 + b[0] * k2,
    a[1] * k1 + b[1] * k2,
    a[2] * k1 + b[2] * k2,
  ];
}

// Precomputed sphere grid dots
const SPHERE_DOTS: [number, number, number][] = [];
for (let lat = -80; lat <= 80; lat += 5) {
  for (let lon = 0; lon < 360; lon += 5) {
    SPHERE_DOTS.push(toVec(lat, lon));
  }
}

interface ArcTrajectory {
  a: [number, number, number];
  b: [number, number, number];
  born: number;
  dur: number;
  severity: "high" | "low";
  pulsed: boolean;
}

interface PulseWave {
  vec: [number, number, number];
  born: number;
  severity: "high" | "low";
}

export function CyberThreatGlobe({
  className = "",
  height = 540,
  liveWsUrl = null,
  simIntervalMs = 700,
  maxFeed = 8,
  customCities,
  showControls = true,
  showFeed = true,
  showStats = true,
  onEventIntercepted,
}: CyberThreatGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeEvents, setActiveEvents] = useState<ThreatEvent[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    highEvents: 0,
    activeArcs: 0,
  });

  const cities = useMemo(
    () => customCities && customCities.length > 0 ? customCities : DEFAULT_CITIES,
    [customCities],
  );

  // Dragging & Interaction State
  const dragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
  }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const spinRef = useRef<number>(0);
  const tiltRef = useRef<number>(0.35);
  const arcsRef = useRef<ArcTrajectory[]>([]);
  const pulsesRef = useRef<PulseWave[]>([]);
  const totalCountRef = useRef<number>(0);
  const highCountRef = useRef<number>(0);

  const addArc = useCallback(
    (src: ThreatCity, dst: ThreatCity, severity: "high" | "low") => {
      arcsRef.current.push({
        a: toVec(src.lat, src.lon),
        b: toVec(dst.lat, dst.lon),
        born: performance.now(),
        dur: (1600 + Math.random() * 800) / speedMultiplier,
        severity,
        pulsed: false,
      });
    },
    [speedMultiplier],
  );

  const triggerAttackEvent = useCallback(
    (forcedSeverity?: "high" | "low", forcedType?: string) => {
      if (cities.length < 2) return;
      const src = cities[Math.floor(Math.random() * cities.length)];
      let dst: ThreatCity;
      do {
        dst = cities[Math.floor(Math.random() * cities.length)];
      } while (dst.name === src.name);

      const severity = forcedSeverity ?? (Math.random() < 0.28 ? "high" : "low");
      const type =
        forcedType ??
        DEFAULT_ATTACK_TYPES[
          Math.floor(Math.random() * DEFAULT_ATTACK_TYPES.length)
        ];

      const evt: ThreatEvent = {
        id: `evt-${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString([], { hour12: false }),
        type,
        severity,
        src,
        dst,
      };

      totalCountRef.current++;
      if (severity === "high") highCountRef.current++;

      addArc(src, dst, severity);

      setActiveEvents((prev) => [evt, ...prev.slice(0, maxFeed - 1)]);
      onEventIntercepted?.(evt);
    },
    [cities, maxFeed, addArc, onEventIntercepted],
  );

  // Automatic Simulation Loop
  useEffect(() => {
    if (!isPlaying || liveWsUrl) return;

    const interval = window.setInterval(() => {
      triggerAttackEvent();
    }, simIntervalMs / speedMultiplier);

    return () => window.clearInterval(interval);
  }, [isPlaying, liveWsUrl, simIntervalMs, speedMultiplier, triggerAttackEvent]);

  // WebSocket Live Hook
  useEffect(() => {
    if (!liveWsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: number | undefined;

    const connect = () => {
      try {
        ws = new WebSocket(liveWsUrl);
        ws.onmessage = (m) => {
          try {
            const data = JSON.parse(m.data);
            if (data.src && data.dst) {
              const evt: ThreatEvent = {
                id: data.id || `ws-${Date.now()}`,
                time: new Date().toLocaleTimeString([], { hour12: false }),
                type: data.type || "Live Inbound Probe",
                severity: data.severity === "high" ? "high" : "low",
                src: data.src,
                dst: data.dst,
              };
              totalCountRef.current++;
              if (evt.severity === "high") highCountRef.current++;
              addArc(evt.src, evt.dst, evt.severity);
              setActiveEvents((prev) => [evt, ...prev.slice(0, maxFeed - 1)]);
              onEventIntercepted?.(evt);
            }
          } catch {
            // invalid json payload
          }
        };
        ws.onclose = () => {
          reconnectTimeout = window.setTimeout(connect, 3000);
        };
      } catch {
        reconnectTimeout = window.setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
    };
  }, [liveWsUrl, maxFeed, addArc, onEventIntercepted]);

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      // Graceful fallback for non-browser/test environments without native canvas bindings
      return;
    }
    if (!ctx) return;

    let animId: number;
    let lastStatsTime = 0;

    const render = (now: number) => {
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect() || canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height || (typeof height === "number" ? height : 540));

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.38;

      if (!dragRef.current.isDragging && isPlaying) {
        spinRef.current += 0.0025 * speedMultiplier;
      }

      const spin = spinRef.current;
      const tilt = tiltRef.current;

      const view = ([x, y, z]: [number, number, number]) => {
        const cs = Math.cos(spin);
        const ss = Math.sin(spin);
        const x1 = x * cs + z * ss;
        const z1 = -x * ss + z * cs;

        const ct = Math.cos(tilt);
        const st = Math.sin(tilt);
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;

        return { x: cx + x1 * R, y: cy - y2 * R, z: z2 };
      };

      // 1. Clear Frame
      ctx.clearRect(0, 0, w, h);

      // 2. Draw Sphere Glow & Wireframe Rim
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      g.addColorStop(0, "rgba(0, 60, 90, 0.45)");
      g.addColorStop(0.6, "rgba(0, 30, 50, 0.2)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Outer Glow Ring
      ctx.strokeStyle = "rgba(0, 255, 255, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Draw Grid Dots on Sphere
      for (let i = 0; i < SPHERE_DOTS.length; i++) {
        const p = view(SPHERE_DOTS[i]);
        if (p.z <= 0) continue;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.12 + 0.6 * p.z})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }

      // 4. Draw Cities
      for (let i = 0; i < cities.length; i++) {
        const c = cities[i];
        const p = view(toVec(c.lat, c.lon));
        if (p.z <= 0) continue;

        if (c.isOrigin) {
          ctx.fillStyle = "rgba(255, 130, 40, 1)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(255, 130, 40, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(160, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // City labels when facing front
        if (p.z > 0.45) {
          ctx.font = "10px monospace";
          ctx.fillStyle = c.isOrigin
            ? "rgba(255, 160, 80, 0.9)"
            : "rgba(160, 255, 255, 0.75)";
          ctx.fillText(c.name, p.x + 5, p.y - 3);
        }
      }

      // 5. Draw Threat Arcs
      const currentArcs = arcsRef.current;
      for (let i = currentArcs.length - 1; i >= 0; i--) {
        const arc = currentArcs[i];
        const age = (now - arc.born) / arc.dur;
        if (age > 1.6) {
          currentArcs.splice(i, 1);
          continue;
        }

        const head = Math.min(1, age);
        const fade = age > 1 ? Math.max(0, 1 - (age - 1) / 0.6) : 1;
        const rgb = arc.severity === "high" ? "255, 70, 70" : "0, 255, 255";
        const steps = 60;

        ctx.beginPath();
        let lastPt: { x: number; y: number } | null = null;

        for (let s = 0; s <= steps * head; s++) {
          const t = s / steps;
          const p = slerp(arc.a, arc.b, t);
          const lift = 1 + 0.35 * Math.sin(Math.PI * t);
          const v = view([p[0] * lift, p[1] * lift, p[2] * lift]);
          if (s === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
          lastPt = v;
        }

        ctx.strokeStyle = `rgba(${rgb}, ${0.85 * fade})`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = `rgba(${rgb}, 0.9)`;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (lastPt) {
          ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
          ctx.beginPath();
          ctx.arc(lastPt.x, lastPt.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (age >= 1 && !arc.pulsed) {
          arc.pulsed = true;
          pulsesRef.current.push({
            vec: arc.b,
            born: now,
            severity: arc.severity,
          });
        }
      }

      // 6. Draw Target Impact Pulses
      const currentPulses = pulsesRef.current;
      for (let i = currentPulses.length - 1; i >= 0; i--) {
        const pl = currentPulses[i];
        const age = (now - pl.born) / 1000;
        if (age > 1.2) {
          currentPulses.splice(i, 1);
          continue;
        }

        const p = view(pl.vec);
        if (p.z <= 0) continue;

        const rgb = pl.severity === "high" ? "255, 70, 70" : "0, 255, 255";
        ctx.strokeStyle = `rgba(${rgb}, ${0.85 * (1 - age / 1.2)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + age * 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Periodic Stats Update
      if (now - lastStatsTime > 300) {
        setStats({
          totalEvents: totalCountRef.current,
          highEvents: highCountRef.current,
          activeArcs: arcsRef.current.length,
        });
        lastStatsTime = now;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cities, isPlaying, speedMultiplier, height]);

  // Pointer Drag Handlers (Interactive Rotation)
  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    spinRef.current += dx * 0.006;
    tiltRef.current = Math.max(
      -1.2,
      Math.min(1.2, tiltRef.current - dy * 0.006),
    );
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#040914] text-[#9ef] font-mono shadow-[0_0_50px_rgba(0,255,255,0.08)] select-none ${className}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* 3D WebGL / Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="block size-full cursor-grab active:cursor-grabbing"
      />

      {/* TOP-LEFT: Realtime Threat Monitor Stats HUD */}
      {showStats && (
        <div className="absolute left-4 top-4 z-20 pointer-events-none rounded-xl border border-cyan-500/25 bg-[#040914]/85 p-3.5 backdrop-blur-md shadow-[0_0_20px_rgba(0,255,255,0.1)] text-xs leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-cyan-300 tracking-wider">
            <Radio className="size-3 text-cyan-400 animate-pulse" />
            <span>REALTIME THREAT MONITOR</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">TOTAL EVENTS:</span>
              <span className="font-bold text-cyan-400">{stats.totalEvents}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">HIGH SEVERITY:</span>
              <span className="font-bold text-red-400">{stats.highEvents}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">ACTIVE ARCS:</span>
              <span className="font-bold text-emerald-400">{stats.activeArcs}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP-RIGHT: Live Sliding Attack Feed */}
      {showFeed && (
        <div className="absolute right-4 top-4 z-20 w-72 sm:w-80 flex flex-col gap-1.5 pointer-events-none">
          <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-400/80 px-1 flex items-center justify-between">
            <span>Live Threat Interceptions</span>
            <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
          </div>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-hidden">
            {activeEvents.map((evt) => {
              const isHigh = evt.severity === "high";
              return (
                <div
                  key={evt.id}
                  className={`pointer-events-auto rounded-md px-2.5 py-1.5 text-[11px] font-mono transition-all animate-in slide-in-from-right-4 duration-200 border-l-[3px] backdrop-blur-md shadow-sm ${
                    isHigh
                      ? "border-red-500 bg-red-500/10 text-red-300 shadow-[0_0_12px_rgba(255,70,70,0.2)]"
                      : "border-cyan-400 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(0,255,255,0.1)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] opacity-75">
                    <span>{evt.time}</span>
                    <span
                      className={`font-bold uppercase ${
                        isHigh ? "text-red-400" : "text-cyan-400"
                      }`}
                    >
                      {evt.severity}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-semibold">
                    {evt.type}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {evt.src.name} → {evt.dst.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTTOM-BAR: Playback Controls & Manual Injectors */}
      {showControls && (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/25 bg-[#040914]/90 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-3" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-3" /> Resume
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => triggerAttackEvent("high", "DDoS burst")}
              className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
              title="Simulate high-severity DDoS burst"
            >
              <Zap className="size-3" /> Test Alert
            </button>
          </div>

          {/* Speed Presets */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span>Speed:</span>
            {[0.5, 1, 2].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSpeedMultiplier(sp)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
                  speedMultiplier === sp
                    ? "bg-cyan-500 text-black font-bold"
                    : "hover:text-cyan-300"
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border border-cyan-500/30 p-1 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
