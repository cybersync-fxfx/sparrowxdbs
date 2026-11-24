import React, { useEffect, useRef, useState } from "react";

export type ProcessorChipVariant = "xeon" | "ryzen";

export interface Real3DProcessorChipProps {
  variant: ProcessorChipVariant;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VARIANT_CONFIG: Record<
  ProcessorChipVariant,
  {
    textureSrc: string;
    width: number;
    height: number;
    pcbDepth: number;
    ihsDepth: number;
    accentHex: number;
    rimHex: number;
    glowCss: string;
    ringCss: string;
    pcbColor: number;
  }
> = {
  xeon: {
    textureSrc: "/3d/intel-xeon-processor.png",
    width: 1.92,
    height: 2.58,
    pcbDepth: 0.11,
    ihsDepth: 0.14,
    accentHex: 0x38bdf8,
    rimHex: 0x60a5fa,
    glowCss: "rgba(56, 189, 248, 0.28)",
    ringCss: "rgba(56, 189, 248, 0.36)",
    pcbColor: 0x0c4a58,
  },
  ryzen: {
    textureSrc: "/3d/amd-ryzen-processor.png",
    width: 2.22,
    height: 2.22,
    pcbDepth: 0.11,
    ihsDepth: 0.15,
    accentHex: 0xf43f5e,
    rimHex: 0xfb923c,
    glowCss: "rgba(244, 63, 94, 0.28)",
    ringCss: "rgba(249, 115, 22, 0.36)",
    pcbColor: 0x0b4b5c,
  },
};

function createLgaBackplateCanvas(variant: ProcessorChipVariant): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = variant === "xeon" ? 688 : 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;

  // Deep teal server PCB base
  ctx.fillStyle = "#0a3b47";
  ctx.fillRect(0, 0, w, h);

  // Subtle metallic gold LGA contact pad matrix
  const cols = variant === "xeon" ? 36 : 34;
  const rows = variant === "xeon" ? 48 : 34;
  const padMarginX = w * 0.065;
  const padMarginY = h * 0.065;
  const cellW = (w - padMarginX * 2) / cols;
  const cellH = (h - padMarginY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Leave central SMD capacitor cavity authentic to real LGA CPUs
      const nx = (c + 0.5) / cols;
      const ny = (r + 0.5) / rows;
      const inCenterCavity =
        variant === "xeon"
          ? nx > 0.34 && nx < 0.66 && ny > 0.26 && ny < 0.74
          : nx > 0.33 && nx < 0.67 && ny > 0.33 && ny < 0.67;

      const x = padMarginX + c * cellW;
      const y = padMarginY + r * cellH;

      if (inCenterCavity) {
        if ((r + c) % 3 === 0) {
          ctx.fillStyle = "#8a6d3b";
          ctx.fillRect(x + cellW * 0.15, y + cellH * 0.22, cellW * 0.7, cellH * 0.56);
          ctx.fillStyle = "#d4d4d8";
          ctx.fillRect(x + cellW * 0.15, y + cellH * 0.22, cellW * 0.16, cellH * 0.56);
          ctx.fillRect(x + cellW * 0.69, y + cellH * 0.22, cellW * 0.16, cellH * 0.56);
        }
        continue;
      }

      // Gold contact pad with subtle sheen variation
      ctx.fillStyle = (r + c) % 2 === 0 ? "#d9a938" : "#c79424";
      ctx.fillRect(x + cellW * 0.16, y + cellH * 0.16, cellW * 0.68, cellH * 0.68);
    }
  }

  // Pin-1 gold corner triangle
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(w - 16, h - 16);
  ctx.lineTo(w - 50, h - 16);
  ctx.lineTo(w - 16, h - 50);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

function createMaterialMapsFromImage(img: HTMLImageElement): {
  bumpCanvas: HTMLCanvasElement;
  roughnessCanvas: HTMLCanvasElement;
} {
  const w = 512;
  const h = Math.max(256, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w));

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bctx = bumpCanvas.getContext("2d");

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = w;
  roughnessCanvas.height = h;
  const rctx = roughnessCanvas.getContext("2d");

  if (!sctx || !bctx || !rctx) {
    return { bumpCanvas, roughnessCanvas };
  }

  sctx.drawImage(img, 0, 0, w, h);
  const srcData = sctx.getImageData(0, 0, w, h);
  const bumpImg = bctx.createImageData(w, h);
  const roughImg = rctx.createImageData(w, h);

  const d = srcData.data;
  const bd = bumpImg.data;
  const rd = roughImg.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);

    // Bright low-saturation pixels = raised brushed nickel IHS metal
    const isMetal = lum > 115 && sat < 45;
    const heightVal = isMetal ? Math.min(255, Math.round(150 + lum * 0.42)) : Math.round(lum * 0.45);
    const roughVal = isMetal ? 66 : 168;

    bd[i] = heightVal;
    bd[i + 1] = heightVal;
    bd[i + 2] = heightVal;
    bd[i + 3] = 255;

    rd[i] = roughVal;
    rd[i + 1] = roughVal;
    rd[i + 2] = roughVal;
    rd[i + 3] = 255;
  }

  bctx.putImageData(bumpImg, 0, 0);
  rctx.putImageData(roughImg, 0, 0);

  return { bumpCanvas, roughnessCanvas };
}

/**
 * Interactive WebGL Three.js 3D Processor Chip rendered from real hardware photography
 * (Wikimedia Commons Intel Xeon LGA 3647 & AMD Ryzen 9 9950X AM5) mapped onto a true
 * multi-layer beveled 3D silicon package with metallic IHS relief and gold LGA pads.
 * Automatically falls back to the transparent real-photo PNG during SSR or without WebGL.
 */
export function Real3DProcessorChip({
  variant,
  alt,
  size = "md",
  className = "",
}: Real3DProcessorChipProps) {
  const cfg = VARIANT_CONFIG[variant];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);

  const sizeClass =
    size === "sm"
      ? "h-36 sm:h-40"
      : size === "lg"
        ? "h-64 sm:h-80"
        : "h-52 sm:h-60";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = canvasHostRef.current;
    if (!host) return;

    // Skip WebGL in headless test environments (jsdom) where getContext is unimplemented
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;
    const testCanvas = document.createElement("canvas");
    const gl =
      testCanvas.getContext("webgl2") ||
      testCanvas.getContext("webgl") ||
      testCanvas.getContext("experimental-webgl");
    if (!gl) return;

    let disposed = false;
    let rafId = 0;
    let cleanupFn: (() => void) | null = null;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import(
          "three/examples/jsm/environments/RoomEnvironment.js"
        );
        if (disposed || !canvasHostRef.current) return;

        const width = Math.max(200, host.clientWidth || 280);
        const height = Math.max(180, host.clientHeight || 240);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.cursor = "grab";

        host.innerHTML = "";
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        // Studio PBR metallic environment reflections
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;

        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);
        camera.position.set(0, 0.35, 5.25);
        camera.lookAt(0, 0, 0);

        // Dramatic hardware studio 3-point lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.55);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
        keyLight.position.set(3.5, 4.5, 5.0);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(cfg.accentHex, 1.65);
        rimLight.position.set(-4.2, -1.8, 3.2);
        scene.add(rimLight);

        const backAccent = new THREE.PointLight(cfg.rimHex, 2.2, 12);
        backAccent.position.set(2.4, -2.5, -2.5);
        scene.add(backAccent);

        // Root 3D chip assembly
        const chipGroup = new THREE.Group();
        scene.add(chipGroup);

        // Load real Wikimedia Commons CPU photo texture
        const img = new Image();
        img.crossOrigin = "anonymous";
        const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = reject;
        });
        img.src = cfg.textureSrc;

        const loadedImg = await loadPromise;
        if (disposed) {
          pmrem.dispose();
          envTex.dispose();
          renderer.dispose();
          return;
        }

        const topTex = new THREE.Texture(loadedImg);
        topTex.colorSpace = THREE.SRGBColorSpace;
        topTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        topTex.needsUpdate = true;

        const { bumpCanvas, roughnessCanvas } = createMaterialMapsFromImage(loadedImg);
        const bumpTex = new THREE.CanvasTexture(bumpCanvas);
        const roughTex = new THREE.CanvasTexture(roughnessCanvas);
        const lgaTex = new THREE.CanvasTexture(createLgaBackplateCanvas(variant));
        lgaTex.colorSpace = THREE.SRGBColorSpace;
        lgaTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

        // 1. Multi-layer fiberglass PCB body (6 faces: side edges + top photo + bottom gold LGA)
        const pcbEdgeMat = new THREE.MeshStandardMaterial({
          color: cfg.pcbColor,
          metalness: 0.32,
          roughness: 0.42,
        });

        const topPhotoMat = new THREE.MeshPhysicalMaterial({
          map: topTex,
          bumpMap: bumpTex,
          bumpScale: 0.045,
          roughnessMap: roughTex,
          roughness: 0.52,
          metalness: 0.58,
          clearcoat: 0.35,
          clearcoatRoughness: 0.25,
          envMapIntensity: 1.15,
        });

        const bottomLgaMat = new THREE.MeshStandardMaterial({
          map: lgaTex,
          metalness: 0.78,
          roughness: 0.28,
          envMapIntensity: 1.2,
        });

        const pcbGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.pcbDepth);
        const pcbMesh = new THREE.Mesh(pcbGeo, [
          pcbEdgeMat,
          pcbEdgeMat,
          pcbEdgeMat,
          pcbEdgeMat,
          topPhotoMat,
          bottomLgaMat,
        ]);
        chipGroup.add(pcbMesh);

        // 2. Thin copper internal substrate laminate stripe along the PCB perimeter
        const copperStripeGeo = new THREE.BoxGeometry(
          cfg.width + 0.008,
          cfg.height + 0.008,
          0.022,
        );
        const copperStripeMat = new THREE.MeshStandardMaterial({
          color: 0xd99b38,
          metalness: 0.88,
          roughness: 0.28,
        });
        const copperStripe = new THREE.Mesh(copperStripeGeo, copperStripeMat);
        chipGroup.add(copperStripe);

        // 3. Physically raised brushed-nickel IHS perimeter frame giving authentic 3D thickness
        const ihsShape = new THREE.Shape();
        if (variant === "ryzen") {
          // Authentic Socket AM5 Ryzen 9000 "octopus" 8-cutout IHS silhouette
          const o = (cfg.width * 0.89) / 2; // outer leg edge
          const inn = (cfg.width * 0.67) / 2; // recessed cutout depth
          const leg = (cfg.width * 0.56) / 2; // inner edge of corner legs
          const mid = (cfg.width * 0.16) / 2; // half-width of center tabs

          ihsShape.moveTo(-o, -leg);
          // Bottom-left corner leg -> bottom edge with 2 cutouts + center tab
          ihsShape.lineTo(-o, -o);
          ihsShape.lineTo(-leg, -o);
          ihsShape.lineTo(-leg, -inn);
          ihsShape.lineTo(-mid, -inn);
          ihsShape.lineTo(-mid, -o);
          ihsShape.lineTo(mid, -o);
          ihsShape.lineTo(mid, -inn);
          ihsShape.lineTo(leg, -inn);
          ihsShape.lineTo(leg, -o);
          ihsShape.lineTo(o, -o);
          // Right edge with 2 cutouts + center tab
          ihsShape.lineTo(o, -leg);
          ihsShape.lineTo(inn, -leg);
          ihsShape.lineTo(inn, -mid);
          ihsShape.lineTo(o, -mid);
          ihsShape.lineTo(o, mid);
          ihsShape.lineTo(inn, mid);
          ihsShape.lineTo(inn, leg);
          ihsShape.lineTo(o, leg);
          ihsShape.lineTo(o, o);
          // Top edge with 2 cutouts + center tab
          ihsShape.lineTo(leg, o);
          ihsShape.lineTo(leg, inn);
          ihsShape.lineTo(mid, inn);
          ihsShape.lineTo(mid, o);
          ihsShape.lineTo(-mid, o);
          ihsShape.lineTo(-mid, inn);
          ihsShape.lineTo(-leg, inn);
          ihsShape.lineTo(-leg, o);
          ihsShape.lineTo(-o, o);
          // Left edge with 2 cutouts + center tab
          ihsShape.lineTo(-o, leg);
          ihsShape.lineTo(-inn, leg);
          ihsShape.lineTo(-inn, mid);
          ihsShape.lineTo(-o, mid);
          ihsShape.lineTo(-o, -mid);
          ihsShape.lineTo(-inn, -mid);
          ihsShape.lineTo(-inn, -leg);
          ihsShape.closePath();
        } else {
          // Authentic LGA 3647 / LGA 4677 stepped rectangular Intel Xeon IHS silhouette
          const ihsW = cfg.width * 0.85;
          const ihsH = cfg.height * 0.89;
          const ihsRadius = 0.08;
          const hw = ihsW / 2;
          const hh = ihsH / 2;
          ihsShape.moveTo(-hw + ihsRadius, -hh);
          ihsShape.lineTo(hw - ihsRadius, -hh);
          ihsShape.quadraticCurveTo(hw, -hh, hw, -hh + ihsRadius);
          ihsShape.lineTo(hw, hh - ihsRadius);
          ihsShape.quadraticCurveTo(hw, hh, hw - ihsRadius, hh);
          ihsShape.lineTo(-hw + ihsRadius, hh);
          ihsShape.quadraticCurveTo(-hw, hh, -hw, hh - ihsRadius);
          ihsShape.lineTo(-hw, -hh + ihsRadius);
          ihsShape.quadraticCurveTo(-hw, -hh, -hw + ihsRadius, -hh);
        }

        const ihsGeo = new THREE.ExtrudeGeometry(ihsShape, {
          depth: cfg.ihsDepth,
          bevelEnabled: true,
          bevelThickness: 0.028,
          bevelSize: 0.024,
          bevelSegments: 3,
        });

        // Compute planar UVs for the extruded IHS top face so the real photo aligns cleanly
        const pos = ihsGeo.attributes.position;
        const uvs = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          uvs[i * 2] = (x + cfg.width / 2) / cfg.width;
          uvs[i * 2 + 1] = (y + cfg.height / 2) / cfg.height;
        }
        ihsGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

        const ihsSideMat = new THREE.MeshStandardMaterial({
          color: 0xcbd2d9,
          metalness: 0.9,
          roughness: 0.24,
          envMapIntensity: 1.35,
        });

        const ihsTopMat = new THREE.MeshPhysicalMaterial({
          map: topTex,
          bumpMap: bumpTex,
          bumpScale: 0.032,
          roughnessMap: roughTex,
          roughness: 0.34,
          metalness: 0.72,
          clearcoat: 0.4,
          clearcoatRoughness: 0.2,
          envMapIntensity: 1.25,
        });

        const ihsMesh = new THREE.Mesh(ihsGeo, [ihsTopMat, ihsSideMat]);
        ihsMesh.position.z = cfg.pcbDepth / 2 - 0.01;
        chipGroup.add(ihsMesh);

        // Initial iconic 3/4 isometric hardware presentation angle
        const baseRotX = -0.34;
        const baseRotY = variant === "xeon" ? 0.38 : -0.38;
        const baseRotZ = variant === "xeon" ? -0.1 : 0.1;

        let targetRotX = baseRotX;
        let targetRotY = baseRotY;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragRotX = baseRotX;
        let dragRotY = baseRotY;

        chipGroup.rotation.set(baseRotX, baseRotY, baseRotZ);

        const onPointerDown = (e: PointerEvent) => {
          isDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          dragRotX = targetRotX;
          dragRotY = targetRotY;
          renderer.domElement.style.cursor = "grabbing";
          renderer.domElement.setPointerCapture?.(e.pointerId);
        };

        const onPointerMove = (e: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          if (isDragging) {
            const dx = (e.clientX - dragStartX) / rect.width;
            const dy = (e.clientY - dragStartY) / rect.height;
            targetRotY = dragRotY + dx * 4.2;
            targetRotX = Math.max(-1.4, Math.min(1.4, dragRotX + dy * 3.0));
          } else if (e.pointerType !== "touch") {
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            targetRotY = baseRotY + nx * 0.65;
            targetRotX = baseRotX + ny * 0.5;
          }
        };

        const onPointerUp = (e: PointerEvent) => {
          if (!isDragging) return;
          isDragging = false;
          renderer.domElement.style.cursor = "grab";
          try {
            renderer.domElement.releasePointerCapture?.(e.pointerId);
          } catch {
            // ignore
          }
        };

        const onPointerLeave = () => {
          if (!isDragging) {
            targetRotX = baseRotX;
            targetRotY = baseRotY;
          }
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointerleave", onPointerLeave);

        const resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          const nw = Math.max(160, Math.round(entry.contentRect.width));
          const nh = Math.max(140, Math.round(entry.contentRect.height));
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        });
        resizeObserver.observe(host);

        setWebglReady(true);

        const startTime = performance.now();
        const animate = (now: number) => {
          if (disposed) return;
          const t = (now - startTime) * 0.001;

          const floatY = prefersReducedMotion ? 0 : Math.sin(t * 1.45) * 0.09;
          const idleSwayY = prefersReducedMotion || isDragging ? 0 : Math.sin(t * 0.75) * 0.16;
          const idleSwayX = prefersReducedMotion || isDragging ? 0 : Math.cos(t * 0.6) * 0.06;

          chipGroup.position.y = floatY;
          chipGroup.rotation.x += (targetRotX + idleSwayX - chipGroup.rotation.x) * 0.08;
          chipGroup.rotation.y += (targetRotY + idleSwayY - chipGroup.rotation.y) * 0.08;
          chipGroup.rotation.z = baseRotZ + (prefersReducedMotion ? 0 : Math.sin(t * 0.5) * 0.03);

          renderer.render(scene, camera);
          rafId = requestAnimationFrame(animate);
        };
        rafId = requestAnimationFrame(animate);

        cleanupFn = () => {
          cancelAnimationFrame(rafId);
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
          pcbGeo.dispose();
          copperStripeGeo.dispose();
          ihsGeo.dispose();
          pcbEdgeMat.dispose();
          topPhotoMat.dispose();
          bottomLgaMat.dispose();
          copperStripeMat.dispose();
          ihsSideMat.dispose();
          ihsTopMat.dispose();
          topTex.dispose();
          bumpTex.dispose();
          roughTex.dispose();
          lgaTex.dispose();
          envTex.dispose();
          pmrem.dispose();
          renderer.dispose();
        };
      } catch {
        // Fallback image stays visible automatically if WebGL fails
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      cleanupFn?.();
    };
  }, [cfg.accentHex, cfg.height, cfg.ihsDepth, cfg.pcbColor, cfg.pcbDepth, cfg.rimHex, cfg.textureSrc, cfg.width, variant]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={alt}
      className={`relative select-none overflow-visible bg-transparent ${sizeClass} ${className}`}
    >
      {/* Ambient radial hardware glow behind floating 3D CPU */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${cfg.glowCss}, transparent 64%)`,
        }}
      />

      {/* Levitation floor shadow under floating 3D chip */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 w-[54%] h-5 rounded-full blur-md"
        style={{
          background: `radial-gradient(ellipse at center, ${cfg.ringCss} 0%, transparent 72%)`,
        }}
      />

      {/* Live interactive Three.js WebGL 3D hardware stage */}
      <div
        ref={canvasHostRef}
        aria-hidden="true"
        className={`relative z-10 size-full transition-opacity duration-300 ${
          webglReady ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Instant SSR / non-WebGL real-photo 3D perspective fallback */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-3 transition-opacity duration-300 ${
          webglReady ? "opacity-0" : "opacity-100"
        }`}
        style={{ perspective: "900px" }}
      >
        <img
          src={cfg.textureSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.72)]"
          style={{
            transform:
              variant === "xeon"
                ? "rotateX(20deg) rotateY(22deg) rotateZ(-6deg)"
                : "rotateX(20deg) rotateY(-22deg) rotateZ(6deg)",
          }}
        />
      </div>
    </div>
  );
}
