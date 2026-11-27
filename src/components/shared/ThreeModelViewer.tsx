import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type ThreeModelVariant =
  | "sparrow-coin"
  | "server-rack"
  | "neural-mesh"
  | "shield-dome"
  | "database-cluster"
  | "voxel-game-node";

export interface ThreeModelViewerProps {
  variant: ThreeModelVariant;
  modelUrl?: string;
  className?: string;
  heightClass?: string;
  interactive?: boolean;
  label?: string;
}

const ACCENT_PALETTE: Record<
  ThreeModelVariant,
  { primary: string; secondary: string; glow: string; tag: string }
> = {
  "sparrow-coin": {
    primary: "#8F9CFF",
    secondary: "#06B6D4",
    glow: "rgba(143, 156, 255, 0.28)",
    tag: "SPARROWX · BARE-METAL COIN",
  },
  "server-rack": {
    primary: "#8F9CFF",
    secondary: "#06B6D4",
    glow: "rgba(6, 182, 212, 0.24)",
    tag: "DEPLOY CLUSTER · MUMBAI EDGE",
  },
  "neural-mesh": {
    primary: "#8F9CFF",
    secondary: "#10B981",
    glow: "rgba(143, 156, 255, 0.26)",
    tag: "AI NEURAL MESH · MCP RUNTIME",
  },
  "shield-dome": {
    primary: "#06B6D4",
    secondary: "#F43F5E",
    glow: "rgba(6, 182, 212, 0.24)",
    tag: "SHIELD L3/L4/L7 · WAF ACTIVE",
  },
  "database-cluster": {
    primary: "#10B981",
    secondary: "#8F9CFF",
    glow: "rgba(16, 185, 129, 0.26)",
    tag: "POSTGRESQL 16 · PGVECTOR",
  },
  "voxel-game-node": {
    primary: "#F59E0B",
    secondary: "#8F9CFF",
    glow: "rgba(245, 158, 11, 0.24)",
    tag: "RYZEN 9 9950X · GAME NODE",
  },
};

function canUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Interactive WebGL 3D Viewer built on Three.js (and React Three Fiber compatible geometry)
 * with 6 handcrafted procedural hardware scenes, optional GLTF/GLB loading, pointer drag
 * orbit & parallax, IntersectionObserver visibility pausing, and crisp SVG fallback for
 * SSR / jsdom / reduced-motion / non-WebGL devices.
 */
export function ThreeModelViewer({
  variant,
  modelUrl,
  className = "",
  heightClass = "h-[320px] sm:h-[400px]",
  interactive = true,
  label,
}: ThreeModelViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglActive, setWebglActive] = useState(false);
  const palette = useMemo(() => ACCENT_PALETTE[variant], [variant]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !canUseWebGL()) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let rafId = 0;
    let isVisible = true;
    let cleanup: (() => void) | null = null;

    const boot = async () => {
      try {
        const width = Math.max(240, host.clientWidth || 380);
        const height = Math.max(220, host.clientHeight || 360);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 640 ? 1.5 : 2));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.cursor = interactive ? "grab" : "default";

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        camera.position.set(0, 0.35, 5.4);

        // Studio PBR Lighting Rig
        const ambient = new THREE.AmbientLight(0xdbe4ff, 0.9);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
        keyLight.position.set(4, 5, 5);
        scene.add(keyLight);

        const rimLightA = new THREE.PointLight(new THREE.Color(palette.primary), 4.5, 14);
        rimLightA.position.set(-3.5, 2.2, 2.5);
        scene.add(rimLightA);

        const rimLightB = new THREE.PointLight(new THREE.Color(palette.secondary), 3.6, 14);
        rimLightB.position.set(3.5, -2.0, 2.0);
        scene.add(rimLightB);

        const root = new THREE.Group();
        scene.add(root);

        const primaryCol = new THREE.Color(palette.primary);
        const secondaryCol = new THREE.Color(palette.secondary);
        const animatedObjects: Array<{
          mesh: THREE.Object3D;
          speedY?: number;
          speedX?: number;
          bobAmp?: number;
          bobPhase?: number;
          pulseEmissive?: boolean;
        }> = [];

        const buildProceduralScene = () => {
          const darkMetal = new THREE.MeshStandardMaterial({
            color: 0x0b101d,
            metalness: 0.85,
            roughness: 0.24,
          });
          const silverMetal = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            metalness: 0.92,
            roughness: 0.18,
          });
          const primaryGlow = new THREE.MeshStandardMaterial({
            color: primaryCol,
            emissive: primaryCol,
            emissiveIntensity: 0.85,
            metalness: 0.45,
            roughness: 0.2,
          });
          const secondaryGlow = new THREE.MeshStandardMaterial({
            color: secondaryCol,
            emissive: secondaryCol,
            emissiveIntensity: 0.9,
            metalness: 0.4,
            roughness: 0.2,
          });

          if (variant === "sparrow-coin") {
            // Iconic Floating Periwinkle SparrowX Sovereign Coin
            const coinBody = new THREE.Mesh(
              new THREE.CylinderGeometry(1.42, 1.42, 0.22, 64),
              new THREE.MeshStandardMaterial({
                color: 0x161d34,
                metalness: 0.92,
                roughness: 0.16,
              }),
            );
            coinBody.rotation.x = Math.PI / 2;
            root.add(coinBody);

            const outerRim = new THREE.Mesh(
              new THREE.TorusGeometry(1.43, 0.085, 24, 72),
              primaryGlow,
            );
            root.add(outerRim);

            const innerRing = new THREE.Mesh(
              new THREE.TorusGeometry(1.06, 0.032, 16, 64),
              silverMetal,
            );
            innerRing.position.z = 0.115;
            root.add(innerRing);

            const innerRingBack = innerRing.clone();
            innerRingBack.position.z = -0.115;
            root.add(innerRingBack);

            // Stylized faceted Sparrow Emblem centerpiece
            const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.56, 0), secondaryGlow);
            emblem.scale.set(1.15, 0.72, 0.32);
            root.add(emblem);
            animatedObjects.push({ mesh: emblem, speedY: 0.9 });

            // Orbiting periwinkle halo rings
            const orbit1 = new THREE.Mesh(
              new THREE.TorusGeometry(1.92, 0.016, 12, 80),
              new THREE.MeshBasicMaterial({ color: primaryCol, transparent: true, opacity: 0.55 }),
            );
            orbit1.rotation.set(Math.PI / 3, 0.4, 0);
            root.add(orbit1);
            animatedObjects.push({ mesh: orbit1, speedY: 0.45, speedX: 0.25 });

            const orbit2 = new THREE.Mesh(
              new THREE.TorusGeometry(2.15, 0.012, 12, 80),
              new THREE.MeshBasicMaterial({ color: secondaryCol, transparent: true, opacity: 0.4 }),
            );
            orbit2.rotation.set(-Math.PI / 4, -0.5, 0.3);
            root.add(orbit2);
            animatedObjects.push({ mesh: orbit2, speedY: -0.35, speedX: 0.18 });
          } else if (variant === "server-rack") {
            // 3D Bare-Metal Server Rack Cluster with Blinking Status LEDs
            const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.75, 1.35), darkMetal);
            root.add(chassis);

            const frameWire = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(2.14, 2.79, 1.39)),
              new THREE.LineBasicMaterial({ color: primaryCol, transparent: true, opacity: 0.45 }),
            );
            root.add(frameWire);

            for (let i = 0; i < 6; i++) {
              const y = -1.0 + i * 0.4;
              const blade = new THREE.Mesh(
                new THREE.BoxGeometry(1.88, 0.28, 1.42),
                new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.3 }),
              );
              blade.position.set(0, y, 0.02);
              root.add(blade);

              // Glowing LED bars on each blade
              const ledMat = i % 2 === 0 ? primaryGlow.clone() : secondaryGlow.clone();
              const led = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.04), ledMat);
              led.position.set(-0.6, y, 0.75);
              root.add(led);
              animatedObjects.push({ mesh: led, bobPhase: i * 1.1, pulseEmissive: true });

              const dot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), secondaryGlow);
              dot.position.set(0.72, y, 0.75);
              root.add(dot);
            }
          } else if (variant === "neural-mesh") {
            // Kinetic 3D AI Neural Network Mesh with Orbiting Pulse Nodes
            const core = new THREE.Mesh(
              new THREE.IcosahedronGeometry(1.15, 1),
              new THREE.MeshStandardMaterial({
                color: 0x11172a,
                wireframe: true,
                emissive: primaryCol,
                emissiveIntensity: 0.55,
              }),
            );
            root.add(core);
            animatedObjects.push({ mesh: core, speedY: 0.35, speedX: 0.14 });

            const innerCore = new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.55, 2),
              primaryGlow,
            );
            root.add(innerCore);
            animatedObjects.push({ mesh: innerCore, speedY: -0.6 });

            const nodePositions = [
              [1.7, 0.7, 0.5],
              [-1.7, 0.5, 0.6],
              [0.9, -1.35, 0.7],
              [-1.1, -1.1, -0.8],
              [0.1, 1.65, -0.5],
              [1.3, -0.4, -1.2],
              [-1.4, 1.1, -0.6],
            ];
            nodePositions.forEach(([x, y, z], idx) => {
              const node = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 18, 18),
                idx % 2 === 0 ? secondaryGlow : primaryGlow,
              );
              node.position.set(x!, y!, z!);
              root.add(node);
              animatedObjects.push({ mesh: node, bobAmp: 0.12, bobPhase: idx * 0.9 });

              const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(x!, y!, z!),
              ]);
              const line = new THREE.Line(
                lineGeo,
                new THREE.LineBasicMaterial({
                  color: idx % 2 === 0 ? secondaryCol : primaryCol,
                  transparent: true,
                  opacity: 0.45,
                }),
              );
              root.add(line);
            });
          } else if (variant === "shield-dome") {
            // 3D Holographic WAF Shield Dome with Laser Threat Intercept Rings
            const dome = new THREE.Mesh(
              new THREE.IcosahedronGeometry(1.42, 2),
              new THREE.MeshStandardMaterial({
                color: 0x06b6d4,
                wireframe: true,
                transparent: true,
                opacity: 0.55,
                emissive: 0x06b6d4,
                emissiveIntensity: 0.6,
              }),
            );
            root.add(dome);
            animatedObjects.push({ mesh: dome, speedY: 0.28 });

            const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), silverMetal);
            root.add(coreGem);
            animatedObjects.push({ mesh: coreGem, speedY: -0.55, bobAmp: 0.08, bobPhase: 0 });

            const interceptRing = new THREE.Mesh(
              new THREE.TorusGeometry(1.78, 0.035, 16, 72),
              primaryGlow,
            );
            interceptRing.rotation.x = Math.PI / 2.4;
            root.add(interceptRing);
            animatedObjects.push({ mesh: interceptRing, speedY: 0.7, speedX: 0.25 });

            // Blocked red threat darts deflected at perimeter
            for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2;
              const threat = new THREE.Mesh(
                new THREE.ConeGeometry(0.11, 0.34, 8),
                secondaryGlow,
              );
              threat.position.set(Math.cos(angle) * 2.05, Math.sin(angle) * 0.85, Math.sin(angle) * 1.1);
              threat.lookAt(0, 0, 0);
              root.add(threat);
              animatedObjects.push({ mesh: threat, bobAmp: 0.14, bobPhase: i * 1.5 });
            }
          } else if (variant === "database-cluster") {
            // 3D Glowing PostgreSQL + pgvector Cylinder Stack
            for (let i = 0; i < 3; i++) {
              const y = -0.82 + i * 0.82;
              const platter = new THREE.Mesh(
                new THREE.CylinderGeometry(1.28, 1.28, 0.44, 48),
                darkMetal,
              );
              platter.position.y = y;
              root.add(platter);

              const glowBand = new THREE.Mesh(
                new THREE.TorusGeometry(1.3, 0.036, 16, 64),
                i === 1 ? secondaryGlow : primaryGlow,
              );
              glowBand.rotation.x = Math.PI / 2;
              glowBand.position.y = y;
              root.add(glowBand);
              animatedObjects.push({ mesh: glowBand, bobPhase: i * 1.3, pulseEmissive: true });
            }

            // Orbiting pgvector embedding cubes
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2;
              const cube = new THREE.Mesh(
                new THREE.BoxGeometry(0.24, 0.24, 0.24),
                i % 2 === 0 ? primaryGlow : secondaryGlow,
              );
              cube.position.set(Math.cos(a) * 1.88, (i - 2) * 0.35, Math.sin(a) * 1.45);
              root.add(cube);
              animatedObjects.push({ mesh: cube, speedY: 1.1, speedX: 0.6, bobAmp: 0.1, bobPhase: i });
            }
          } else {
            // 3D Isometric Voxel Game Server World Cluster
            const voxelMatA = new THREE.MeshStandardMaterial({
              color: 0x161f33,
              metalness: 0.72,
              roughness: 0.28,
            });
            const coords = [
              [0, 0, 0],
              [0.68, 0, 0],
              [-0.68, 0, 0],
              [0, 0, 0.68],
              [0, 0, -0.68],
              [0, 0.68, 0],
              [0.68, 0.68, -0.68],
              [-0.68, 0.68, 0.68],
              [0, -0.68, 0],
            ];
            coords.forEach(([x, y, z], i) => {
              const isAccent = i === 5 || i === 6 || i === 7;
              const voxel = new THREE.Mesh(
                new THREE.BoxGeometry(0.58, 0.58, 0.58),
                isAccent ? (i === 5 ? primaryGlow : secondaryGlow) : voxelMatA,
              );
              voxel.position.set(x!, y!, z!);
              root.add(voxel);
              animatedObjects.push({ mesh: voxel, bobAmp: isAccent ? 0.14 : 0.04, bobPhase: i * 0.7 });
            });
            root.rotation.set(0.45, Math.PI / 4, 0);
          }
        };

        // Optional remote GLB/GLTF load with graceful procedural fallback
        let loadedExternal = false;
        if (modelUrl) {
          try {
            const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(modelUrl);
            if (!disposed) {
              root.add(gltf.scene);
              loadedExternal = true;
            }
          } catch {
            // Gracefully fall back to procedural geometry
          }
        }
        if (!loadedExternal) {
          buildProceduralScene();
        }

        if (disposed) {
          renderer.dispose();
          return;
        }

        host.innerHTML = "";
        host.appendChild(renderer.domElement);
        setWebglActive(true);

        // Pointer drag orbit + smooth mouse parallax
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let targetRotY = root.rotation.y;
        let targetRotX = root.rotation.x;

        const onPointerDown = (e: PointerEvent) => {
          if (!interactive) return;
          isDragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          renderer.domElement.style.cursor = "grabbing";
        };
        const onPointerMove = (e: PointerEvent) => {
          if (!interactive) return;
          if (isDragging) {
            targetRotY += (e.clientX - lastX) * 0.008;
            targetRotX = Math.max(-0.7, Math.min(0.7, targetRotX + (e.clientY - lastY) * 0.006));
            lastX = e.clientX;
            lastY = e.clientY;
          } else {
            const rect = host.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
            const ny = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
            targetRotX = -ny * 0.32;
            targetRotY += nx * 0.004;
          }
        };
        const onPointerUp = () => {
          isDragging = false;
          renderer.domElement.style.cursor = interactive ? "grab" : "default";
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerup", onPointerUp);

        const onResize = () => {
          if (!host) return;
          const w = Math.max(240, host.clientWidth || 380);
          const h = Math.max(220, host.clientHeight || 360);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        const io =
          typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(
                (entries) => {
                  isVisible = Boolean(entries[0]?.isIntersecting);
                },
                { threshold: 0.05 },
              )
            : null;
        io?.observe(host);

        const clock = new THREE.Clock();
        const baseYMap = new WeakMap<THREE.Object3D, number>();
        animatedObjects.forEach((a) => baseYMap.set(a.mesh, a.mesh.position.y));

        const renderLoop = () => {
          if (disposed) return;
          if (isVisible && !document.hidden) {
            const elapsed = clock.getElapsedTime();
            if (!prefersReduced) {
              if (!isDragging) targetRotY += 0.0045;
              root.rotation.y += (targetRotY - root.rotation.y) * 0.07;
              root.rotation.x += (targetRotX - root.rotation.x) * 0.07;
              root.position.y = Math.sin(elapsed * 1.4) * 0.08;

              for (const item of animatedObjects) {
                if (item.speedY) item.mesh.rotation.y += item.speedY * 0.012;
                if (item.speedX) item.mesh.rotation.x += item.speedX * 0.012;
                if (item.bobAmp) {
                  const base = baseYMap.get(item.mesh) ?? 0;
                  item.mesh.position.y = base + Math.sin(elapsed * 1.9 + (item.bobPhase ?? 0)) * item.bobAmp;
                }
                if (item.pulseEmissive && item.mesh instanceof THREE.Mesh) {
                  const mat = item.mesh.material as THREE.MeshStandardMaterial;
                  if ("emissiveIntensity" in mat) {
                    mat.emissiveIntensity = 0.55 + Math.sin(elapsed * 3.2 + (item.bobPhase ?? 0)) * 0.4;
                  }
                }
              }
            }
            renderer.render(scene, camera);
          }
          rafId = window.requestAnimationFrame(renderLoop);
        };
        renderLoop();

        cleanup = () => {
          window.cancelAnimationFrame(rafId);
          io?.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("resize", onResize);
          renderer.dispose();
        };
      } catch {
        setWebglActive(false);
      }
    };

    void boot();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [variant, modelUrl, interactive, palette.primary, palette.secondary]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-[#141A29] bg-[#080B12]/70 backdrop-blur-md ${heightClass} ${className}`}
      aria-label={label ?? palette.tag}
    >
      {/* Radial spatial aura behind 3D canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 48%, ${palette.glow}, transparent 68%)`,
        }}
      />

      {/* WebGL Canvas Host */}
      <div ref={hostRef} className="relative z-10 h-full w-full" />

      {/* Crisp Kinetic SVG Fallback (SSR / jsdom / reduced-motion / non-WebGL) */}
      {!webglActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6"
        >
          <div className="spx-animate-float relative grid size-36 place-items-center">
            <svg viewBox="0 0 160 160" className="size-full">
              <defs>
                <linearGradient id={`spx-3d-fb-${variant}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={palette.primary} />
                  <stop offset="100%" stopColor={palette.secondary} />
                </linearGradient>
              </defs>
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke={`url(#spx-3d-fb-${variant})`}
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.65"
              />
              <polygon
                points="80,22 130,52 130,108 80,138 30,108 30,52"
                fill="rgba(8,11,18,0.85)"
                stroke={`url(#spx-3d-fb-${variant})`}
                strokeWidth="2"
              />
              <polygon
                points="80,44 112,62 112,98 80,116 48,98 48,62"
                fill={`url(#spx-3d-fb-${variant})`}
                fillOpacity="0.18"
                stroke={palette.primary}
                strokeWidth="1.5"
              />
              <circle cx="80" cy="80" r="10" fill={palette.secondary} />
            </svg>
          </div>
        </div>
      )}

      {/* Subtle corner HUD pill */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#030407]/85 px-2.5 py-1 font-mono text-[10px] tracking-wider text-zinc-300 backdrop-blur-md">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: palette.primary }}
        />
        <span>{label ?? palette.tag}</span>
      </div>

      {interactive && (
        <span className="pointer-events-none absolute bottom-3 right-3 z-20 hidden sm:inline-flex rounded-full border border-white/10 bg-[#030407]/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
          Drag 3D
        </span>
      )}
    </div>
  );
}
