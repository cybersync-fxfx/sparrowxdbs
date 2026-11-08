import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  Compass,
  Crosshair,
  ExternalLink,
  Globe2,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Minus,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  generateEarthDayTexture,
  generateEarthNightTexture,
  generateEarthCloudTexture,
  generateEarthSpecularTexture,
} from "./globe/EarthTextures";
import {
  createAtmosphereMaterial,
  createInnerAtmosphereMaterial,
} from "./globe/EarthAtmosphereShader";
import { emitEngineToast } from "./BackgroundEngineToaster";

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

// Helper: Convert lat/lon in degrees to 3D unit vector on sphere of radius R
export function latLonToVector3(lat: number, lon: number, radius = 100): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Spherical linear interpolation between two unit vectors
function slerpVector3(v1: THREE.Vector3, v2: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = Math.min(1, Math.max(-1, v1.dot(v2)));
  const theta = Math.acos(dot);
  if (theta < 1e-5) return v1.clone();
  const sinTheta = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinTheta;
  const w2 = Math.sin(t * theta) / sinTheta;
  return new THREE.Vector3(
    v1.x * w1 + v2.x * w2,
    v1.y * w1 + v2.y * w2,
    v1.z * w1 + v2.z * w2,
  ).normalize();
}

interface ActiveArc {
  id: string;
  curve: THREE.CatmullRomCurve3;
  line: THREE.Line;
  headMesh: THREE.Mesh;
  particles: THREE.Points;
  particlePos: Float32Array;
  srcCity: ThreatCity;
  dstCity: ThreatCity;
  bornTime: number;
  durationMs: number;
  severity: "critical" | "high" | "med" | "low";
  pulsed: boolean;
}

interface ImpactPulse {
  mesh: THREE.Mesh;
  bornTime: number;
  durationMs: number;
  color: THREE.Color;
}

// Helper to create glowing 3D city name labels
function createTextSprite(text: string, isOrigin = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 160, 40);
    ctx.font = "bold 13px 'SF Mono', 'JetBrains Mono', monospace";
    ctx.fillStyle = isOrigin ? "#ffaa33" : "#7fe8ff";
    ctx.shadowColor = isOrigin ? "rgba(255, 120, 0, 0.6)" : "rgba(0, 229, 255, 0.6)";
    ctx.shadowBlur = 3;
    ctx.fillText(text, 6, 24);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.5, 1.6, 1);
  return sprite;
}

export function CyberThreatGlobe({
  className = "",
  height = 560,
  liveWsUrl = null,
  enableSimulation = true,
  simIntervalMs = 700,
  maxFeed = 7,
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
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const [activeEvents, setActiveEvents] = useState<ThreatEvent[]>([]);
  const [hoveredCity, setHoveredCity] = useState<{
    city: ThreatCity;
    x: number;
    y: number;
  } | null>(null);

  const [stats, setStats] = useState({
    totalEvents: 0,
    highEvents: 0,
    criticalEvents: 0,
    activeArcs: 0,
    protectedAssets: 0,
  });

  const cities = useMemo(
    () => (customCities && customCities.length > 0 ? customCities : DEFAULT_CITIES),
    [customCities],
  );

  // References for WebGL Scene & Interaction
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const arcsGroupRef = useRef<THREE.Group | null>(null);
  const pulsesGroupRef = useRef<THREE.Group | null>(null);
  const cityPinsGroupRef = useRef<THREE.Group | null>(null);

  const activeArcsListRef = useRef<ActiveArc[]>([]);
  const activePulsesListRef = useRef<ImpactPulse[]>([]);
  const totalCountRef = useRef(0);
  const highCountRef = useRef(0);
  const criticalCountRef = useRef(0);

  // Dragging, Orbit & Inertia
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const rotVelocityRef = useRef({ x: 0, y: 0.0012 });
  const targetCameraDistanceRef = useRef(280);
  const currentCameraDistanceRef = useRef(280);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseNdcRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999));

  // Severity color mapping
  const getSeverityColor = (sev: "critical" | "high" | "med" | "low"): number => {
    switch (sev) {
      case "critical":
        return 0xdc2626; // Deep red
      case "high":
        return 0xff354f; // Bright red
      case "med":
        return 0xffb547; // Amber
      case "low":
      default:
        return 0x00e5ff; // Cyan
    }
  };

  // Add 3D Great-Circle Threat Arc
  const addThreatArc = useCallback(
    (src: ThreatCity, dst: ThreatCity, severity: "critical" | "high" | "med" | "low") => {
      const arcsGroup = arcsGroupRef.current;
      if (!arcsGroup) return;

      const R = 100;
      const srcVec = latLonToVector3(src.lat, src.lon, R);
      const dstVec = latLonToVector3(dst.lat, dst.lon, R);
      const dist = srcVec.distanceTo(dstVec);

      // Arc height curves naturally above Earth (higher for longer distances)
      const arcHeight = Math.min(36, Math.max(8, dist * 0.26));
      const steps = 64;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const slerped = slerpVector3(srcVec, dstVec, t);
        const altitude = R + Math.sin(Math.PI * t) * arcHeight;
        points.push(slerped.multiplyScalar(altitude));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const hexColor = getSeverityColor(severity);

      // 1. High-brightness Call-of-Duty tactical arc line trail
      const lineMaterial = new THREE.LineBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geometry, lineMaterial);
      arcsGroup.add(line);

      // 2. Glowing leading projectile head
      const headGeom = new THREE.SphereGeometry(1.15, 14, 14);
      const headMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
      });
      const headMesh = new THREE.Mesh(headGeom, headMat);
      headMesh.position.copy(points[0]);
      arcsGroup.add(headMesh);

      // 3. Trailing photon sparks
      const sparkCount = 8;
      const sparkGeom = new THREE.BufferGeometry();
      const sparkPositions = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount * 3; i++) sparkPositions[i] = 0;
      sparkGeom.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));

      const sparkMat = new THREE.PointsMaterial({
        color: hexColor,
        size: 2.8,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
      });
      const sparkPoints = new THREE.Points(sparkGeom, sparkMat);
      arcsGroup.add(sparkPoints);

      const durationMs = (2400 + Math.random() * 800) / speedMultiplier;
      activeArcsListRef.current.push({
        id: `arc-${Date.now()}-${Math.random()}`,
        curve,
        line,
        headMesh,
        particles: sparkPoints,
        particlePos: sparkPositions,
        srcCity: src,
        dstCity: dst,
        bornTime: performance.now(),
        durationMs,
        severity,
        pulsed: false,
      });
    },
    [speedMultiplier],
  );

  // Trigger Target Impact Ripple Shockwave
  const triggerImpactPulse = useCallback(
    (dst: ThreatCity, severity: "critical" | "high" | "med" | "low") => {
      const pulsesGroup = pulsesGroupRef.current;
      if (!pulsesGroup) return;

      const pos = latLonToVector3(dst.lat, dst.lon, 100.4);
      const ringGeom = new THREE.RingGeometry(0.3, 0.8, 28);
      const hexColor = getSeverityColor(severity);
      const ringMat = new THREE.MeshBasicMaterial({
        color: hexColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const pulseMesh = new THREE.Mesh(ringGeom, ringMat);
      pulseMesh.position.copy(pos);
      pulseMesh.lookAt(pos.clone().multiplyScalar(2)); // Align perpendicular to surface normal
      pulsesGroup.add(pulseMesh);

      activePulsesListRef.current.push({
        mesh: pulseMesh,
        bornTime: performance.now(),
        durationMs: 1400,
        color: new THREE.Color(hexColor),
      });
    },
    [],
  );

  // Dispatch live connection / threat event jumping toward Hosting Origin hubs
  const triggerAttackEvent = useCallback(
    (forcedSeverity?: "critical" | "high" | "med" | "low", forcedType?: string) => {
      if (cities.length < 2) return;
      const originHubs = cities.filter((c) => c.isOrigin);
      const dstPool = originHubs.length > 0 ? originHubs : cities;
      const dst = dstPool[Math.floor(Math.random() * dstPool.length)];
      let src = cities[Math.floor(Math.random() * cities.length)];
      let tries = 0;
      while (src.name === dst.name && tries < 10) {
        src = cities[Math.floor(Math.random() * cities.length)];
        tries++;
      }

      const r = Math.random();
      const severity: "critical" | "high" | "med" | "low" =
        forcedSeverity ?? (r < 0.15 ? "critical" : r < 0.4 ? "high" : r < 0.7 ? "med" : "low");

      const type =
        forcedType ??
        DEFAULT_ATTACK_TYPES[Math.floor(Math.random() * DEFAULT_ATTACK_TYPES.length)];

      const status =
        severity === "critical"
          ? "QUARANTINED"
          : severity === "high"
            ? "BLOCKED"
            : "INTERCEPTED";

      const evt: ThreatEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString([], { hour12: false }),
        type,
        severity,
        src,
        dst,
        status,
      };

      totalCountRef.current++;
      if (severity === "critical") criticalCountRef.current++;
      if (severity === "high" || severity === "critical") highCountRef.current++;

      addThreatArc(src, dst, severity);

      if (!isFeedPaused) {
        setActiveEvents((prev) => [evt, ...prev.slice(0, maxFeed - 1)]);
      }

      onEventIntercepted?.(evt);
    },
    [cities, maxFeed, isFeedPaused, addThreatArc, onEventIntercepted],
  );

  // Manual Test Alert Trigger
  const handleTestAlert = () => {
    triggerAttackEvent("high", "DDoS burst");
    emitEngineToast("Simulated threat attack arc deployed and intercepted across Edge SOC", "warning");
  };

  // Center camera on chosen city
  const focusOnCity = (targetCity: ThreatCity) => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup) return;

    // Convert city lat/lon to target rotation angles
    const phi = (targetCity.lat * Math.PI) / 180;
    const theta = ((targetCity.lon + 90) * Math.PI) / 180;

    earthGroup.rotation.x = phi * 0.5;
    earthGroup.rotation.y = -theta;
    rotVelocityRef.current = { x: 0, y: 0 };
  };

  // Threat Loop (runs initial burst + continuous rapid connection jumps)
  useEffect(() => {
    if (!enableSimulation || !isPlaying || liveWsUrl) return;

    // Immediate Call-of-Duty multi-connection burst on mount
    const burstTimers = [60, 180, 320, 480].map((delay) =>
      window.setTimeout(() => triggerAttackEvent(), delay),
    );

    const interval = window.setInterval(() => {
      triggerAttackEvent();
    }, simIntervalMs / speedMultiplier);

    return () => {
      burstTimers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(interval);
    };
  }, [enableSimulation, isPlaying, liveWsUrl, simIntervalMs, speedMultiplier, triggerAttackEvent]);

  // WebSocket Live Feed Integration
  useEffect(() => {
    if (!liveWsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;

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
                severity: data.severity || "high",
                src: data.src,
                dst: data.dst,
                status: data.status || "BLOCKED",
              };
              totalCountRef.current++;
              if (evt.severity === "high" || evt.severity === "critical") highCountRef.current++;
              addThreatArc(evt.src, evt.dst, evt.severity);
              if (!isFeedPaused) {
                setActiveEvents((prev) => [evt, ...prev.slice(0, maxFeed - 1)]);
              }
              onEventIntercepted?.(evt);
            }
          } catch {
            // invalid json
          }
        };
        ws.onclose = () => {
          reconnectTimer = window.setTimeout(connect, 3000);
        };
      } catch {
        reconnectTimer = window.setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [liveWsUrl, maxFeed, isFeedPaused, addThreatArc, onEventIntercepted]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Detect WebGL support gracefully (handles headless/vitest jsdom cleanly)
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // WebGL not supported or headless test environment without GPU context
      return;
    }

    if (!renderer) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.55;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const rect = container.getBoundingClientRect();
    const width = rect.width || 800;
    const heightPx = rect.height || (typeof height === "number" ? height : 560);
    renderer.setSize(width, heightPx);

    const camera = new THREE.PerspectiveCamera(38, width / heightPx, 1, 2000);
    camera.position.set(0, 30, currentCameraDistanceRef.current);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // High-contrast Call-of-Duty Satellite Lighting
    const sunLight = new THREE.DirectionalLight(0xfff6ea, 3.4);
    sunLight.position.set(-320, 180, 220);
    scene.add(sunLight);

    const frontFillLight = new THREE.DirectionalLight(0xffe0b2, 1.85);
    frontFillLight.position.set(220, 90, 260);
    scene.add(frontFillLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    // Root Earth Pivot Group
    const earthGroup = new THREE.Group();
    earthGroup.rotation.x = 0.28; // Subtle natural axial tilt
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // Load authentic NASA satellite maps
    const textureLoader = new THREE.TextureLoader();
    const earthDayTex = textureLoader.load("/textures/globe/earth_day.jpg");
    const earthNightTex = textureLoader.load("/textures/globe/earth_lights.png");
    const earthSpecTex = textureLoader.load("/textures/globe/earth_specular.jpg");
    const cloudTex = textureLoader.load("/textures/globe/earth_clouds.png");
    const earthNormalTex = textureLoader.load("/textures/globe/earth_normal.jpg");

    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    // 1. Earth Surface Mesh with High-Brightness Specular & Golden Night City Lights
    const R = 100;
    const earthGeom = new THREE.SphereGeometry(R, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthDayTex,
      normalMap: earthNormalTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: earthSpecTex,
      roughness: 0.52,
      metalness: 0.12,
      emissiveMap: earthNightTex,
      emissive: new THREE.Color(0xffb84d),
      emissiveIntensity: 2.6,
    });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthGroup.add(earthMesh);

    // 1b. Call-of-Duty Tactical Satellite Lat/Lon Grid Overlay
    const gridGeom = new THREE.SphereGeometry(R + 0.18, 36, 20);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0xff9900,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const gridMesh = new THREE.Mesh(gridGeom, gridMat);
    earthGroup.add(gridMesh);

    // 2. Atmospheric Clouds Layer (rotates independently)
    const cloudGeom = new THREE.SphereGeometry(R + 0.65, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.35,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudGeom, cloudMat);
    earthGroup.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    // 2b. Permanent Glowing Backbone Mesh Lines Connecting All Hosting Origins
    const originHubs = cities.filter((c) => c.isOrigin);
    for (let i = 0; i < originHubs.length; i++) {
      const a = originHubs[i];
      const b = originHubs[(i + 1) % originHubs.length];
      if (!a || !b || a.name === b.name) continue;
      const vA = latLonToVector3(a.lat, a.lon, R);
      const vB = latLonToVector3(b.lat, b.lon, R);
      const backbonePts: THREE.Vector3[] = [];
      for (let s = 0; s <= 40; s++) {
        const t = s / 40;
        const sl = slerpVector3(vA, vB, t);
        backbonePts.push(sl.multiplyScalar(R + Math.sin(Math.PI * t) * 14));
      }
      const bbGeom = new THREE.BufferGeometry().setFromPoints(backbonePts);
      const bbMat = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
      });
      earthGroup.add(new THREE.Line(bbGeom, bbMat));
    }

    // 3. City Pins & Hosting Origin Beacons Layer
    const cityPinsGroup = new THREE.Group();
    earthGroup.add(cityPinsGroup);
    cityPinsGroupRef.current = cityPinsGroup;

    const pinMeshes: { mesh: THREE.Mesh; city: ThreatCity }[] = [];
    const cityLabelSprites: { sprite: THREE.Sprite; normal: THREE.Vector3 }[] = [];

    cities.forEach((city) => {
      const pos = latLonToVector3(city.lat, city.lon, R + 0.3);
      const isOrigin = city.isOrigin;
      const normal = pos.clone().normalize();

      // Core illuminated micro-beacon pin
      const pinGeom = new THREE.SphereGeometry(isOrigin ? 0.9 : 0.6, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({
        color: isOrigin ? 0xff7700 : 0x00e5ff,
      });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = { city };
      cityPinsGroup.add(pinMesh);
      pinMeshes.push({ mesh: pinMesh, city });

      // Tactical vertical beacon needle
      const spikeLen = isOrigin ? 3.2 : 2.2;
      const spikeGeom = new THREE.CylinderGeometry(0.06, 0.06, spikeLen, 8);
      spikeGeom.translate(0, spikeLen / 2, 0);
      const spikeMat = new THREE.MeshBasicMaterial({
        color: isOrigin ? 0xff9922 : 0x00d4ff,
        transparent: true,
        opacity: 0.75,
      });
      const spikeMesh = new THREE.Mesh(spikeGeom, spikeMat);
      spikeMesh.position.copy(pos);
      spikeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      cityPinsGroup.add(spikeMesh);

      // Subtle ground radar micro-ring
      const radarGeom = new THREE.RingGeometry(0.3, isOrigin ? 1.3 : 0.8, 24);
      const radarMat = new THREE.MeshBasicMaterial({
        color: isOrigin ? 0xff7700 : 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const radarMesh = new THREE.Mesh(radarGeom, radarMat);
      radarMesh.position.copy(pos);
      radarMesh.lookAt(pos.clone().multiplyScalar(2));
      cityPinsGroup.add(radarMesh);

      // Floating 3D City Name Label Sprite
      const labelSprite = createTextSprite(city.name, isOrigin);
      const labelPos = pos.clone().add(normal.clone().multiplyScalar(spikeLen + 1.2));
      labelSprite.position.copy(labelPos);
      cityPinsGroup.add(labelSprite);
      cityLabelSprites.push({ sprite: labelSprite, normal });
    });

    // 6. Groups for Arcs & Impact Shockwaves
    const arcsGroup = new THREE.Group();
    earthGroup.add(arcsGroup);
    arcsGroupRef.current = arcsGroup;

    const pulsesGroup = new THREE.Group();
    earthGroup.add(pulsesGroup);
    pulsesGroupRef.current = pulsesGroup;

    // Animation & Render Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);

      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Smooth camera zoom interpolation
      currentCameraDistanceRef.current +=
        (targetCameraDistanceRef.current - currentCameraDistanceRef.current) * 0.1;
      camera.position.z = currentCameraDistanceRef.current;

      // Globe auto-rotation & inertia damping
      if (!isDraggingRef.current) {
        if (isPlaying) {
          earthGroup.rotation.y += rotVelocityRef.current.y * speedMultiplier;
          earthGroup.rotation.x += rotVelocityRef.current.x * speedMultiplier;
        }
        // Damping towards baseline slow spin
        rotVelocityRef.current.x *= 0.94;
        rotVelocityRef.current.y =
          rotVelocityRef.current.y * 0.96 + (isPlaying ? 0.0014 * 0.04 : 0);
      }

      // Clouds rotate slowly and independently from Earth
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.00045 * speedMultiplier;
      }

      // Animate Active Threat Arcs & Traveling Photons
      const arcs = activeArcsListRef.current;
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const elapsed = now - arc.bornTime;
        const progress = Math.min(1, elapsed / arc.durationMs);

        // Leading missile/projectile position
        const headPoint = arc.curve.getPointAt(progress);
        arc.headMesh.position.copy(headPoint);

        // Trailing sparks along the curve
        const sparkPos = arc.particlePos;
        for (let s = 0; s < 8; s++) {
          const sparkT = Math.max(0, progress - (s + 1) * 0.025);
          const p = arc.curve.getPointAt(sparkT);
          sparkPos[s * 3] = p.x;
          sparkPos[s * 3 + 1] = p.y;
          sparkPos[s * 3 + 2] = p.z;
        }
        arc.particles.geometry.attributes.position.needsUpdate = true;

        // On Impact (reaches destination)
        if (progress >= 1 && !arc.pulsed) {
          arc.pulsed = true;
          triggerImpactPulse(arc.dstCity, arc.severity);
        }

        // Fade out and remove after completion
        if (elapsed > arc.durationMs + 900) {
          arcsGroup.remove(arc.line);
          arcsGroup.remove(arc.headMesh);
          arcsGroup.remove(arc.particles);
          arc.line.geometry.dispose();
          arc.headMesh.geometry.dispose();
          arc.particles.geometry.dispose();
          arcs.splice(i, 1);
        }
      }

      // Animate Target Impact Shockwaves
      const pulses = activePulsesListRef.current;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const age = (now - p.bornTime) / p.durationMs;
        if (age >= 1) {
          pulsesGroup.remove(p.mesh);
          p.mesh.geometry.dispose();
          pulses.splice(i, 1);
          continue;
        }
        const scale = 1 + age * 8.5;
        p.mesh.scale.set(scale, scale, scale);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.95 * (1 - age);
      }

      // Dynamic LOD / Horizon Occlusion for City Label Sprites
      const rot = earthGroup.rotation;
      cityLabelSprites.forEach(({ sprite, normal }) => {
        const worldNormal = normal.clone().applyEuler(rot);
        // Only visible when on the front hemisphere facing camera
        sprite.visible = worldNormal.z > 0.15;
      });

      // City Hover Raycasting
      raycasterRef.current.setFromCamera(mouseNdcRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        pinMeshes.map((p) => p.mesh),
      );

      if (intersects.length > 0) {
        const hit = intersects[0];
        const cityData = hit.object.userData.city as ThreatCity;
        // Project 3D vector to screen space
        const worldPos = hit.object.position.clone();
        hit.object.getWorldPosition(worldPos);
        worldPos.project(camera);
        const sx = ((worldPos.x + 1) * width) / 2;
        const sy = ((-worldPos.y + 1) * heightPx) / 2;
        setHoveredCity({ city: cityData, x: sx, y: sy });
      } else {
        setHoveredCity(null);
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Periodic HUD Stats synchronization
    const statsInterval = setInterval(() => {
      setStats({
        totalEvents: totalCountRef.current,
        highEvents: highCountRef.current,
        criticalEvents: criticalCountRef.current,
        activeArcs: activeArcsListRef.current.length,
        protectedAssets: cities.length * 3 + 3,
      });
    }, 400);

    // Dynamic ResizeObserver for responsive fluid scaling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height || (typeof height === "number" ? height : 560);
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        }
      }
    });
    resizeObserver.observe(container);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newRect = container.getBoundingClientRect();
      const newW = newRect.width;
      const newH = newRect.height || (typeof height === "number" ? height : 560);
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup WebGL resources on unmount
    return () => {
      cancelAnimationFrame(animId);
      clearInterval(statsInterval);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);

      // Dispose city label sprites & textures
      cityLabelSprites.forEach(({ sprite }) => {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });

      // Dispose textures
      earthDayTex.dispose();
      earthNightTex.dispose();
      cloudTex.dispose();
      earthSpecTex.dispose();
      earthNormalTex.dispose();

      // Dispose geometries & materials
      earthGeom.dispose();
      earthMat.dispose();
      cloudGeom.dispose();
      cloudMat.dispose();

      renderer.dispose();
    };
  }, [cities, isPlaying, speedMultiplier, height, triggerImpactPulse]);

  // Pointer Drag Handlers (Interactive Smooth Rotation)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    if (!isDraggingRef.current || !earthGroupRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const earthGroup = earthGroupRef.current;
    earthGroup.rotation.y += dx * 0.005;
    earthGroup.rotation.x = Math.max(
      -1.1,
      Math.min(1.1, earthGroup.rotation.x + dy * 0.005),
    );

    rotVelocityRef.current = {
      x: dy * 0.001,
      y: dx * 0.001,
    };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    targetCameraDistanceRef.current = Math.max(
      150,
      Math.min(420, targetCameraDistanceRef.current + e.deltaY * 0.15),
    );
  };

  // Zoom controls
  const handleZoom = (direction: "in" | "out") => {
    const delta = direction === "in" ? -45 : 45;
    targetCameraDistanceRef.current = Math.max(
      150,
      Math.min(420, targetCameraDistanceRef.current + delta),
    );
  };

  // Reset Camera View
  const handleResetCamera = () => {
    targetCameraDistanceRef.current = 235;
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.x = 0.28;
      earthGroupRef.current.rotation.y = 0;
      rotVelocityRef.current = { x: 0, y: 0.0015 };
    }
  };

  // Fullscreen toggle
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

  const activeHostCity =
    activeEvents[0]?.dst ?? cities.find((c) => c.isOrigin) ?? cities[0];
  const activeSourceCity = activeEvents[0]?.src ?? cities[cities.length - 1] ?? cities[0];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative w-full overflow-hidden rounded-2xl border border-[#1F1F1F] bg-black text-zinc-200 font-mono select-none transition-all ${className}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* Pure Black Space Backdrop matching the page */}
      <div className="pointer-events-none absolute inset-0 bg-black" />

      {/* Call-of-Duty Tactical Top-Center Satellite Connection & Host Overlay */}
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 hidden lg:flex items-center gap-3 rounded-lg border border-amber-500/30 bg-[#0A0A0A]/90 px-4 py-1.5 text-[11px] backdrop-blur-xl shadow-[0_0_25px_rgba(245,158,11,0.15)]">
        <span className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Crosshair className="size-3.5 animate-spin" />
          <span>SAT-LINK</span>
        </span>
        <span className="text-zinc-500">|</span>
        <span className="text-zinc-300">
          FROM: <strong className="text-cyan-300">{activeSourceCity?.name}</strong>{" "}
          <span className="text-zinc-500 text-[10px]">
            ({activeSourceCity?.lat.toFixed(1)}°, {activeSourceCity?.lon.toFixed(1)}°)
          </span>
        </span>
        <span className="text-amber-400 font-bold">━━━►</span>
        <span className="text-zinc-300">
          HOST: <strong className="text-amber-400">{activeHostCity?.name}</strong>{" "}
          <span className="text-emerald-400 text-[10px]">
            [{activeHostCity?.hostingHub ?? "OVH Origin Host"}]
          </span>
        </span>
      </div>

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          mouseNdcRef.current.set(-999, -999);
          setHoveredCity(null);
        }}
        className="block size-full cursor-grab active:cursor-grabbing relative z-10"
      />

      {/* City Hover Interactive Tooltip */}
      {hoveredCity && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]/95 p-2.5 shadow-2xl backdrop-blur-md text-xs leading-tight animate-in fade-in-50 duration-150 min-w-48"
          style={{ left: hoveredCity.x, top: hoveredCity.y }}
        >
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-1.5 mb-1.5">
            <span className="font-bold text-white tracking-wide">{hoveredCity.city.name}</span>
            <span className="text-[10px] text-amber-400 font-mono">
              {hoveredCity.city.isOrigin ? "HOSTING ORIGIN" : "EDGE NODE"}
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-zinc-400">
            <div className="flex justify-between gap-3">
              <span>HOSTING HUB:</span>
              <span className="text-white font-semibold">
                {hoveredCity.city.hostingHub ?? "Global Edge Relay"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>COORDINATES:</span>
              <span className="text-zinc-300">
                {hoveredCity.city.lat.toFixed(2)}°, {hoveredCity.city.lon.toFixed(2)}°
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>HOST STATUS:</span>
              <span className="text-emerald-400 font-semibold">ONLINE · 0.8ms</span>
            </div>
          </div>
          <div className="mt-1.5 text-[9px] text-zinc-400 italic flex items-center gap-1">
            <Crosshair className="size-2.5" />
            <span>Click connection card to jump camera to host</span>
          </div>
        </div>
      )}

      {/* TOP-LEFT: Realtime Threat & Hosting Monitor HUD */}
      {showStats && (
        <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-20 pointer-events-auto rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 p-3.5 backdrop-blur-xl shadow-2xl text-xs leading-relaxed max-w-[250px] sm:max-w-[285px]">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-2 mb-2">
            <div className="flex items-center gap-2 font-bold text-white tracking-wider">
              <Radio className="size-3 text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-extrabold">REALTIME THREAT MONITOR</span>
            </div>
          </div>

          <div className="mb-2.5 rounded-lg border border-[#1F1F1F] bg-black px-2.5 py-2 text-[10px]">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">
              ACTIVE HOSTING LOCATION
            </div>
            <div className="mt-0.5 font-bold text-amber-400 truncate">
              {activeHostCity?.name ?? "Roubaix (OVH Host)"} ·{" "}
              <span className="text-zinc-300 font-normal">
                {activeHostCity?.hostingHub ?? "OVHcloud EU-West Host"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">TOTAL EVENTS:</span>
              <span className="font-bold text-white text-sm">
                {stats.totalEvents.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">HIGH SEVERITY:</span>
              <span className="font-bold text-[#FF354F]">{stats.highEvents}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">CRITICAL THREATS:</span>
              <span className="font-bold text-red-500">{stats.criticalEvents}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">ACTIVE ARCS:</span>
              <span className="font-bold text-emerald-400">{stats.activeArcs}</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#1F1F1F] pt-1.5 mt-1">
              <span className="text-zinc-400">HOSTING ORIGINS:</span>
              <span className="font-bold text-amber-400">
                {cities.filter((c) => c.isOrigin).length} active hosts
              </span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#1F1F1F] flex items-center justify-between text-[9px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              REAL-TIME CONNECTIONS
            </span>
            <span>HOST ONLINE</span>
          </div>
        </div>
      )}

      {/* TOP-RIGHT: Real-Time Jumping Connections & Host Routing Feed */}
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
                title={isFeedPaused ? "Resume Live Feed" : "Pause Live Feed"}
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
                  <span>Host Connection Ready</span>
                </div>
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Streaming real-time connection jumps across global edge relays and your sovereign host.
                </p>
              </div>
            ) : (
              activeEvents.map((evt) => {
                const isCrit = evt.severity === "critical";
                const isHigh = evt.severity === "high";
                const isMed = evt.severity === "med";

                const borderClass = isCrit
                  ? "border-l-red-500 bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F]"
                  : isHigh
                    ? "border-l-[#FF354F] bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F]"
                    : isMed
                      ? "border-l-amber-400 bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F]"
                      : "border-l-emerald-400 bg-[#0A0A0A]/95 text-zinc-200 border-[#1F1F1F]";

                return (
                  <div
                    key={evt.id}
                    onClick={() => focusOnCity(evt.dst)}
                    className={`group cursor-pointer rounded-lg px-3 py-2 text-[11px] font-mono transition-all animate-in slide-in-from-right-4 duration-200 border border-l-4 backdrop-blur-xl hover:translate-x-[-2px] hover:border-zinc-700 ${borderClass}`}
                    title="Click to jump globe camera to this hosting location"
                  >
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-zinc-500">{evt.time}</span>
                      <span className="font-semibold text-amber-400 truncate max-w-[175px]">
                        HOST: {evt.dst.hostingHub ?? evt.dst.name}
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
                );
              })
            )}
          </div>
        </div>
      )}

      {/* BOTTOM-BAR: Playback Controls, Camera Tools & Manual Connection Jump */}
      {showControls && (
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 px-3.5 py-2 backdrop-blur-xl shadow-2xl">
          {/* Left Actions: Play/Pause & Jump Connection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#1F1F1F] hover:text-white transition-all"
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
              onClick={handleTestAlert}
              className="group flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-[#1F1F1F] hover:text-amber-300 transition-all"
              title="Trigger real-time connection jump to host"
            >
              <Zap className="size-3 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Test Alert</span>
            </button>
          </div>

          {/* Center: Rotation Speed Controls */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="hidden sm:inline font-mono">Speed:</span>
            {[0.5, 1, 2].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSpeedMultiplier(sp)}
                className={`rounded-md px-2 py-1 text-[11px] font-mono transition-all ${
                  speedMultiplier === sp
                    ? "bg-white text-black font-bold"
                    : "border border-[#2A2A2A] bg-[#141414] text-zinc-400 hover:text-white"
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>

          {/* Right: Camera Tools, Zoom & Fullscreen */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleZoom("in")}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-1.5 text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleZoom("out")}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-1.5 text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetCamera}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-1.5 text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
              title="Reset Camera View"
              aria-label="Reset camera view"
            >
              <RotateCcw className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-1.5 text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
