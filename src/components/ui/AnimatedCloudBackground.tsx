import React, { useEffect, useRef } from "react";

interface AnimatedCloudBackgroundProps {
  variant?: "sky" | "emerald" | "monochrome" | "lime" | "purple";
  intensity?: "full" | "subtle";
}

interface CloudNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  useSecondary: boolean;
}

const PALETTES = {
  sky: {
    orb1Full: "rgba(56, 189, 248, 0.14)",
    orb1Subtle: "rgba(56, 189, 248, 0.06)",
    orb2Full: "rgba(14, 165, 233, 0.10)",
    orb2Subtle: "rgba(14, 165, 233, 0.05)",
    orb3Full: "rgba(16, 185, 129, 0.08)",
    orb3Subtle: "rgba(16, 185, 129, 0.04)",
    gridFull: "rgba(56, 189, 248, 0.07)",
    gridSubtle: "rgba(56, 189, 248, 0.035)",
    dotFull: "rgba(148, 163, 184, 0.16)",
    dotSubtle: "rgba(148, 163, 184, 0.09)",
    beamX:
      "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.72), rgba(16, 185, 129, 0.45), transparent)",
    beamY:
      "linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.58), transparent)",
    nodeRgb: "56, 189, 248",
    secondaryRgb: "16, 185, 129",
  },
  emerald: {
    orb1Full: "rgba(62, 207, 142, 0.14)",
    orb1Subtle: "rgba(62, 207, 142, 0.06)",
    orb2Full: "rgba(16, 185, 129, 0.10)",
    orb2Subtle: "rgba(16, 185, 129, 0.045)",
    orb3Full: "rgba(6, 182, 212, 0.09)",
    orb3Subtle: "rgba(6, 182, 212, 0.04)",
    gridFull: "rgba(62, 207, 142, 0.07)",
    gridSubtle: "rgba(62, 207, 142, 0.035)",
    dotFull: "rgba(62, 207, 142, 0.18)",
    dotSubtle: "rgba(62, 207, 142, 0.09)",
    beamX:
      "linear-gradient(90deg, transparent, rgba(62, 207, 142, 0.75), rgba(6, 182, 212, 0.48), transparent)",
    beamY:
      "linear-gradient(180deg, transparent, rgba(62, 207, 142, 0.60), transparent)",
    nodeRgb: "62, 207, 142",
    secondaryRgb: "6, 182, 212",
  },
  monochrome: {
    orb1Full: "rgba(255, 255, 255, 0.08)",
    orb1Subtle: "rgba(255, 255, 255, 0.04)",
    orb2Full: "rgba(228, 228, 231, 0.06)",
    orb2Subtle: "rgba(228, 228, 231, 0.03)",
    orb3Full: "rgba(161, 161, 170, 0.05)",
    orb3Subtle: "rgba(161, 161, 170, 0.025)",
    gridFull: "rgba(255, 255, 255, 0.06)",
    gridSubtle: "rgba(255, 255, 255, 0.03)",
    dotFull: "rgba(255, 255, 255, 0.16)",
    dotSubtle: "rgba(255, 255, 255, 0.08)",
    beamX:
      "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.72), rgba(212, 212, 216, 0.42), transparent)",
    beamY:
      "linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.58), transparent)",
    nodeRgb: "255, 255, 255",
    secondaryRgb: "212, 212, 216",
  },
  lime: {
    orb1Full: "rgba(163, 230, 53, 0.14)",
    orb1Subtle: "rgba(163, 230, 53, 0.06)",
    orb2Full: "rgba(132, 204, 22, 0.10)",
    orb2Subtle: "rgba(132, 204, 22, 0.045)",
    orb3Full: "rgba(255, 255, 255, 0.07)",
    orb3Subtle: "rgba(255, 255, 255, 0.035)",
    gridFull: "rgba(163, 230, 53, 0.08)",
    gridSubtle: "rgba(163, 230, 53, 0.04)",
    dotFull: "rgba(255, 255, 255, 0.16)",
    dotSubtle: "rgba(255, 255, 255, 0.08)",
    beamX:
      "linear-gradient(90deg, transparent, rgba(163, 230, 53, 0.78), rgba(255, 255, 255, 0.45), transparent)",
    beamY:
      "linear-gradient(180deg, transparent, rgba(163, 230, 53, 0.62), transparent)",
    nodeRgb: "163, 230, 53",
    secondaryRgb: "255, 255, 255",
  },
  purple: {
    orb1Full: "rgba(168, 85, 247, 0.15)",
    orb1Subtle: "rgba(168, 85, 247, 0.065)",
    orb2Full: "rgba(147, 51, 234, 0.11)",
    orb2Subtle: "rgba(147, 51, 234, 0.05)",
    orb3Full: "rgba(192, 132, 252, 0.09)",
    orb3Subtle: "rgba(192, 132, 252, 0.04)",
    gridFull: "rgba(168, 85, 247, 0.08)",
    gridSubtle: "rgba(168, 85, 247, 0.04)",
    dotFull: "rgba(192, 132, 252, 0.18)",
    dotSubtle: "rgba(192, 132, 252, 0.09)",
    beamX:
      "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.78), rgba(192, 132, 252, 0.48), transparent)",
    beamY:
      "linear-gradient(180deg, transparent, rgba(168, 85, 247, 0.62), transparent)",
    nodeRgb: "168, 85, 247",
    secondaryRgb: "192, 132, 252",
  },
} as const;

const HORIZONTAL_BEAMS = [
  { top: "16%", duration: "8.5s", delay: "-2s" },
  { top: "38%", duration: "11s", delay: "-5s" },
  { top: "64%", duration: "9.5s", delay: "-7s" },
  { top: "84%", duration: "12.5s", delay: "-1.5s" },
];

const VERTICAL_BEAMS = [
  { left: "20%", duration: "10s", delay: "-3s" },
  { left: "52%", duration: "13s", delay: "-6.5s" },
  { left: "80%", duration: "11.5s", delay: "-4s" },
];

export const AnimatedCloudBackground: React.FC<AnimatedCloudBackgroundProps> = ({
  variant = "sky",
  intensity = "full",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const palette = PALETTES[variant];
  const isSubtle = intensity === "subtle";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;

    let width = window.innerWidth || 1280;
    let height = window.innerHeight || 720;
    let rafId = 0;

    const updateSize = () => {
      width = window.innerWidth || 1280;
      height = window.innerHeight || 720;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();

    const nodeCount = isSubtle ? 18 : 36;
    const nodes: CloudNode[] = Array.from({ length: nodeCount }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * (isSubtle ? 0.25 : 0.42),
      vy: (Math.random() - 0.5) * (isSubtle ? 0.25 : 0.42),
      radius: 1.2 + Math.random() * 1.8,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.025,
      useSecondary: idx % 3 === 0,
    }));

    const pointer = { x: -9999, y: -9999, active: false };
    const maxLinkDist = 150;
    const pointerRadius = 170;

    const onMouseMove = (e: MouseEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };

    const onMouseLeave = () => {
      pointer.active = false;
    };

    window.addEventListener("resize", updateSize, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });

    const renderFrame = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.pulsePhase += node.pulseSpeed;

        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 1 && distSq < pointerRadius * pointerRadius) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / pointerRadius) * 0.16;
            node.vx += (dx / dist) * force * 0.18;
            node.vy += (dy / dist) * force * 0.18;
          }
        }

        // Clamp velocity so interactive repels settle gently back to calm drift
        const speed = Math.hypot(node.vx, node.vy);
        const maxSpeed = isSubtle ? 0.45 : 0.72;
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }

        node.x += node.vx;
        node.y += node.vy;

        if (node.x < -10) node.x = width + 10;
        else if (node.x > width + 10) node.x = -10;
        if (node.y < -10) node.y = height + 10;
        else if (node.y > height + 10) node.y = -10;
      }

      // Draw faint constellation filaments
      const lineAlphaBase = isSubtle ? 0.08 : 0.14;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!a) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxLinkDist * maxLinkDist) {
            const alpha = (1 - Math.sqrt(distSq) / maxLinkDist) * lineAlphaBase;
            ctx.strokeStyle = `rgba(${palette.nodeRgb}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        if (pointer.active) {
          const pdx = a.x - pointer.x;
          const pdy = a.y - pointer.y;
          const pDistSq = pdx * pdx + pdy * pdy;
          if (pDistSq < pointerRadius * pointerRadius) {
            const pAlpha = (1 - Math.sqrt(pDistSq) / pointerRadius) * (isSubtle ? 0.15 : 0.28);
            ctx.strokeStyle = `rgba(${palette.secondaryRgb}, ${pAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      // Draw pulsing nodes
      for (const node of nodes) {
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(node.pulsePhase));
        const alpha = (isSubtle ? 0.35 : 0.65) * pulse;
        const rgb = node.useSecondary ? palette.secondaryRgb : palette.nodeRgb;

        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [palette.nodeRgb, palette.secondaryRgb, isSubtle]);

  const gridLineColor = isSubtle ? palette.gridSubtle : palette.gridFull;
  const dotColor = isSubtle ? palette.dotSubtle : palette.dotFull;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Layer 1: Drifting Ambient Light Orbs */}
      <div
        className="animate-spx-orb-1 absolute -top-28 left-[12%] h-[420px] w-[420px] rounded-full blur-[110px]"
        style={{ background: isSubtle ? palette.orb1Subtle : palette.orb1Full }}
      />
      <div
        className="animate-spx-orb-2 absolute top-[32%] -right-24 h-[380px] w-[380px] rounded-full blur-[115px]"
        style={{ background: isSubtle ? palette.orb2Subtle : palette.orb2Full }}
      />
      <div
        className="animate-spx-orb-3 absolute -bottom-24 left-[28%] h-[400px] w-[400px] rounded-full blur-[120px]"
        style={{ background: isSubtle ? palette.orb3Subtle : palette.orb3Full }}
      />

      {/* Layer 2: Panning Blueprint Grid & Technical Dot Matrix */}
      <div
        className="animate-spx-grid-pan absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${gridLineColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse 85% 75% at 50% 35%, black 35%, transparent 98%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 75% at 50% 35%, black 35%, transparent 98%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 40%, black 25%, transparent 95%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 40%, black 25%, transparent 95%)",
        }}
      />

      {/* Layer 3: Fiber-Optic Data Stream Beams */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: isSubtle ? 0.35 : 0.75 }}
      >
        {HORIZONTAL_BEAMS.slice(0, isSubtle ? 2 : 4).map((beam, idx) => (
          <div
            key={`hx-${idx}`}
            className="animate-spx-beam-x absolute left-0 h-[1px] w-[180px]"
            style={
              {
                top: beam.top,
                background: palette.beamX,
                animationDelay: beam.delay,
                "--beam-duration": beam.duration,
              } as React.CSSProperties
            }
          />
        ))}
        {VERTICAL_BEAMS.slice(0, isSubtle ? 2 : 3).map((beam, idx) => (
          <div
            key={`vy-${idx}`}
            className="animate-spx-beam-y absolute top-0 w-[1px] h-[160px]"
            style={
              {
                left: beam.left,
                background: palette.beamY,
                animationDelay: beam.delay,
                "--beam-duration": beam.duration,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Layer 4: Interactive 60fps Canvas Constellation */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};
