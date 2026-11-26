import React, { useEffect, useState } from "react";

export type DeployFrameworkId =
  "nextjs" | "tanstack" | "vite" | "node" | "python" | "static" | "docker";

export interface DeploySessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  tenantId: string | null;
}

export interface StarterTemplate {
  id: string;
  name: string;
  framework: DeployFrameworkId;
  badge: string;
  description: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  outputDir: string;
  port: number;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "nextjs-app",
    name: "Next.js App Router",
    framework: "nextjs",
    badge: "SSR / Edge",
    description: "Production React full-stack template with Railpack zero-config.",
    repoUrl: "https://github.com/vercel/next-learn",
    branch: "main",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    outputDir: ".next",
    port: 3000,
  },
  {
    id: "tanstack-start",
    name: "TanStack Start",
    framework: "tanstack",
    badge: "Full-Stack",
    description: "Type-safe SSR routing and server functions on Nitro.",
    repoUrl: "https://github.com/TanStack/router",
    branch: "main",
    buildCommand: "npm run build",
    startCommand: "node .output/server/index.mjs",
    outputDir: ".output",
    port: 3000,
  },
  {
    id: "vite-react",
    name: "Vite / React",
    framework: "vite",
    badge: "SPA / Static",
    description: "Fast single-page frontend built and served on Mumbai Edge.",
    repoUrl: "https://github.com/vitejs/vite",
    branch: "main",
    buildCommand: "npm run build",
    startCommand: "npx serve -s dist",
    outputDir: "dist",
    port: 3000,
  },
  {
    id: "node-express",
    name: "Node.js / Express",
    framework: "node",
    badge: "API / Worker",
    description: "REST API, webhook service, or Discord/Telegram bot runtime.",
    repoUrl: "https://github.com/expressjs/express",
    branch: "master",
    buildCommand: "npm install",
    startCommand: "npm start",
    outputDir: ".",
    port: 3000,
  },
  {
    id: "python-fastapi",
    name: "Python / FastAPI",
    framework: "python",
    badge: "ASGI / AI",
    description: "Async Python API server powered by Uvicorn and Railpack.",
    repoUrl: "https://github.com/fastapi/full-stack-fastapi-template",
    branch: "master",
    buildCommand: "pip install -r requirements.txt",
    startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000",
    outputDir: ".",
    port: 8000,
  },
  {
    id: "dockerfile-app",
    name: "Dockerfile Container",
    framework: "docker",
    badge: "BuildKit OCI",
    description: "Bring any Go, Rust, Bun, or custom Dockerfile image.",
    repoUrl: "https://github.com/docker/getting-started-app",
    branch: "main",
    buildCommand: "docker build .",
    startCommand: "",
    outputDir: ".",
    port: 3000,
  },
];

export function FrameworkIcon({
  framework,
  className = "size-5",
}: {
  framework: string;
  className?: string;
}) {
  switch (framework) {
    case "nextjs":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="#E2E8F0" strokeWidth="1.5" />
          <path
            d="M8.5 16V8.5L16.5 18.2"
            stroke="#F3F6FA"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M15.5 8.5V13.5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "tanstack":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path
            d="M4 16.5L12 5L20 16.5H4Z"
            stroke="#38BDF8"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 16.5L12 11.2L15.5 16.5"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="19" r="1.4" fill="#10B981" />
        </svg>
      );
    case "vite":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path
            d="M4 5.5L12 19.5L20 5.5L12 8.2L4 5.5Z"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12.8 4L10 11.2H13.2L11.4 16.2"
            stroke="#F59E0B"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "node":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path
            d="M12 3L19.5 7.3V16.7L12 21L4.5 16.7V7.3L12 3Z"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 14.5V9.5L14.5 14.5V9.5"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "python":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path
            d="M12 4C8.8 4 8.8 5.8 8.8 5.8V8H13.5V9H7.2C5.2 9 4.5 10.6 4.5 12.2C4.5 13.8 5.2 15.2 7.2 15.2H8.8V13.2C8.8 11.7 10 10.6 11.6 10.6H15C16.3 10.6 17.2 9.7 17.2 8.4V5.8C17.2 4.6 15.4 4 12 4Z"
            stroke="#38BDF8"
            strokeWidth="1.4"
          />
          <path
            d="M12 20C15.2 20 15.2 18.2 15.2 18.2V16H10.5V15H16.8C18.8 15 19.5 13.4 19.5 11.8C19.5 10.2 18.8 8.8 16.8 8.8H15.2V10.8C15.2 12.3 14 13.4 12.4 13.4H9C7.7 13.4 6.8 14.3 6.8 15.6V18.2C6.8 19.4 8.6 20 12 20Z"
            stroke="#F59E0B"
            strokeWidth="1.4"
          />
        </svg>
      );
    case "docker":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <rect x="4" y="11" width="3" height="3" stroke="#38BDF8" strokeWidth="1.3" />
          <rect x="8" y="11" width="3" height="3" stroke="#38BDF8" strokeWidth="1.3" />
          <rect x="12" y="11" width="3" height="3" stroke="#38BDF8" strokeWidth="1.3" />
          <rect x="8" y="7" width="3" height="3" stroke="#E2E8F0" strokeWidth="1.3" />
          <rect x="12" y="7" width="3" height="3" stroke="#E2E8F0" strokeWidth="1.3" />
          <path
            d="M3 15.2H18.5C19.8 15.2 21 14 21 12.6C19.8 12.4 19 13 18.5 13.5C18 17.8 14.2 19.5 9.8 19.5C5.6 19.5 3.3 17.5 3 15.2Z"
            stroke="#38BDF8"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="#94A3B8" strokeWidth="1.5" />
          <path
            d="M9 10L7 12L9 14M15 10L17 12L15 14M13 8.5L11 15.5"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "ready" || s === "live" || s === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{status === "Ready" ? "Live" : status}</span>
      </span>
    );
  }
  if (s === "building" || s === "queued" || s === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>{status}</span>
      </span>
    );
  }
  if (s === "failed" || s === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
        <span className="size-1.5 rounded-full bg-red-400" />
        <span>{status}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
      <span className="size-1.5 rounded-full bg-zinc-500" />
      <span>{status}</span>
    </span>
  );
}

/**
 * Verifies the real HttpOnly `spx_master_sso` server session via `GET /api/auth/master-sso`.
 * When `redirectOnUnauth` is true (default), routes cleanly to `/login?next=<path>` so the
 * console never renders a broken page with a raw "Authentication required." bar.
 */
export function useDeploySession(redirectOnUnauth = true) {
  const [user, setUser] = useState<DeploySessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const res = await fetch("/api/auth/master-sso", { credentials: "include" });
        if (!active) return;
        if (res.status === 401) {
          setUser(null);
          setChecking(false);
          if (redirectOnUnauth && typeof window !== "undefined") {
            const current = `${window.location.pathname}${window.location.search}`;
            window.location.replace(`/login?next=${encodeURIComponent(current || "/deploy")}`);
          }
          return;
        }
        if (!res.ok) {
          setNetworkError(`Control plane returned HTTP ${res.status}`);
          setChecking(false);
          return;
        }
        const data = (await res.json()) as { ok?: boolean; user?: DeploySessionUser };
        if (data?.ok && data.user) {
          setUser(data.user);
        } else if (redirectOnUnauth && typeof window !== "undefined") {
          const current = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(current || "/deploy")}`);
        }
      } catch {
        if (active) setNetworkError("Unable to reach SparrowX control plane. Retrying...");
      } finally {
        if (active) setChecking(false);
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [redirectOnUnauth]);

  return { user, checking, networkError };
}

export function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
