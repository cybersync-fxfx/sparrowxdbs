import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { OAuthSignInButtons } from "@/components/GoogleSignInButton";
import { fetchMasterSsoUser } from "@/lib/developer-connection";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Database,
  Lock,
  Menu,
  Search,
  Shield,
  Terminal,
  User,
  X,
} from "lucide-react";
import { ContactSection } from "./landing/ContactSection";
import {
  DotGridMiniIcon,
  DotMatrixSparrowBackdrop,
  DotMatrixTelemetryBoard,
  DotMatrixWash,
  HalftoneHorizonArc,
  IsolationSchematicArt,
  type DotAccentTone,
} from "./landing/DotMatrixArt";
import { SparrowxCoinIcon } from "@/components/SparrowxCoinVisuals";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AppUser } from "@/lib/supabase";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";
import {
  clearMasterSsoSession,
  DEVELOPER_CONNECTION_EVENT,
  ensureDeveloperConnection,
  getCachedDeveloperConnection,
  getNetsecSsoUrl,
  type DeveloperDbConnectionInfo,
} from "@/lib/developer-connection";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { buildWhatsAppSupportUrl } from "@/lib/whatsapp-support";

interface SparrowxMasterLandingProps {
  onOpenLogin: () => void;
  onDirectNav?: (destination: string) => void;
  onUserAuthenticated?: (user: AppUser) => void;
}

type PlatformCategory = "all" | "infrastructure" | "security" | "ai-utilities";

interface PlatformEntry {
  id: string;
  name: string;
  shortName: string;
  domain: string;
  prodUrl: string;
  desc: string;
  badge: string;
  category: Exclude<PlatformCategory, "all">;
  logo: string;
  isNetsec?: boolean;
}

const SPARROWX_PLATFORMS: PlatformEntry[] = [
  {
    id: "infra",
    name: "SparrowX Cloud Infra",
    shortName: "Cloud Infra",
    domain: "infra.sparrowx.net",
    prodUrl: "https://infra.sparrowx.net",
    desc: "Single-tenant AMD Ryzen & EPYC bare metal, dedicated nodes, and NVMe KVM VPS.",
    badge: "BARE METAL",
    category: "infrastructure",
    logo: "/logos/sparrowx-silver.png",
  },
  {
    id: "deploy",
    name: "SparrowX Deploy",
    shortName: "Deploy PaaS",
    domain: "deploy.sparrowx.net",
    prodUrl: "https://deploy.sparrowx.net",
    desc: "Zero-config Git-to-Edge web app & container platform with instant SSL.",
    badge: "GIT PAAS",
    category: "infrastructure",
    logo: "/logos/sparrowx-network.png",
  },
  {
    id: "db",
    name: "SparrowX Cloud DB",
    shortName: "Cloud DB",
    domain: "db.sparrowx.net",
    prodUrl: "https://db.sparrowx.net",
    desc: "Managed PostgreSQL 16 + pgvector studio with pooling and zero egress shocks.",
    badge: "POSTGRES 16",
    category: "infrastructure",
    logo: "/logos/sparrowx-db.png",
  },
  {
    id: "game",
    name: "SparrowX Game Hosting",
    shortName: "Game Hosting",
    domain: "game.sparrowx.net",
    prodUrl: "https://sparrowx.net/game",
    desc: "High-clock Ryzen nodes for FiveM, Minecraft, SA-MP, and Discord bots in India.",
    badge: "LOW PING",
    category: "infrastructure",
    logo: "/logos/sparrowx-main.png",
  },
  {
    id: "sec",
    name: "SparrowX Shield",
    shortName: "Shield WAF",
    domain: "sec.sparrowx.net",
    prodUrl: "https://sec.sparrowx.net",
    desc: "Autonomous Edge WAF, L7 DDoS scrubbing, bot defense, and live SOC telemetry.",
    badge: "EDGE WAF",
    category: "security",
    logo: "/logos/sparrowx-shield.png",
  },
  {
    id: "netsec",
    name: "SparrowX NetSec Guard",
    shortName: "NetSec Guard",
    domain: "netsec.sparrowx.net",
    prodUrl: "https://netsec.sparrowx.net",
    desc: "Linux firewall agent, WireGuard Guard tunnels, and real-time IP threat radar.",
    badge: "WIREGUARD",
    category: "security",
    logo: "/logos/sparrowx-netsec-3d.png",
    isNetsec: true,
  },
  {
    id: "dpdp",
    name: "SparrowX DPDP",
    shortName: "DPDP 2023",
    domain: "dpdp.sparrowx.net",
    prodUrl: "https://dpdp.sparrowx.net",
    desc: "India DPDP Act 2023 consent vault, DSAR automation, and audit trails.",
    badge: "COMPLIANCE",
    category: "security",
    logo: "/logos/sparrowx-shield.png",
  },
  {
    id: "password",
    name: "SparrowX Keys",
    shortName: "Keys",
    domain: "password.sparrowx.net",
    prodUrl: "https://password.sparrowx.net",
    desc: "100% offline CSPRNG cryptographic key & password generator with zero telemetry.",
    badge: "FREE · OFFLINE",
    category: "security",
    logo: "/logos/sparrowx-keys.png",
  },
  {
    id: "ai",
    name: "SparrowX AI Gateway",
    shortName: "AI Gateway",
    domain: "ai.sparrowx.net",
    prodUrl: "https://ai.sparrowx.net",
    desc: "Unified LLM gateway with inline prompt-injection guardrails and usage meters.",
    badge: "AI GATEWAY",
    category: "ai-utilities",
    logo: "/logos/sparrowx-main.png",
  },
  {
    id: "agents",
    name: "SparrowX Agents",
    shortName: "Agents Fleet",
    domain: "agents.sparrowx.net",
    prodUrl: "https://agents.sparrowx.net",
    desc: "Autonomous AI agent orchestration, live execution traces, and vector memory.",
    badge: "AGENTICS",
    category: "ai-utilities",
    logo: "/logos/sparrowx-main.png",
  },
  {
    id: "api",
    name: "SparrowX API Gateway",
    shortName: "API Gateway",
    domain: "api.sparrowx.net",
    prodUrl: "https://api.sparrowx.net",
    desc: "Instant PostgREST endpoints over PostgreSQL schemas with scoped API keys.",
    badge: "REST + SDKS",
    category: "ai-utilities",
    logo: "/logos/sparrowx-network.png",
  },
  {
    id: "file",
    name: "SparrowX Drop",
    shortName: "Drop Vault",
    domain: "file.sparrowx.net",
    prodUrl: "https://file.sparrowx.net",
    desc: "Zero-login AES-256-GCM ephemeral RAM drops plus a persistent 10 GB vault.",
    badge: "FREE · AES-256",
    category: "ai-utilities",
    logo: "/logos/sparrowx-drop.png",
  },
];

const CHAPTERS: Array<{ id: string; label: string; tone: DotAccentTone; dotClass: string }> = [
  { id: "chapter-isolation", label: "Isolation", tone: "violet", dotClass: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.85)]" },
  { id: "chapter-security", label: "Security", tone: "emerald", dotClass: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" },
  { id: "chapter-deploy", label: "Deploy & APIs", tone: "blue", dotClass: "bg-[#5B87FF] shadow-[0_0_10px_rgba(91,135,255,0.9)]" },
  { id: "chapter-workloads", label: "Every workload", tone: "amber", dotClass: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.85)]" },
  { id: "story", label: "Sovereign cloud", tone: "rose", dotClass: "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.85)]" },
];

const CODE_SNIPPETS = [
  {
    id: "deploy",
    filename: "sparrowx.deploy.ts",
    pathHint: "apps/api/sparrowx.deploy.ts",
    lines: [
      { ln: 1, code: `import { defineDeployment } from '@sparrowx/deploy';`, tone: "text-sky-300" },
      { ln: 2, code: `import { attachDatabase } from '@sparrowx/db';`, tone: "text-sky-300" },
      { ln: 3, code: ``, tone: "text-zinc-500" },
      { ln: 4, code: `export default defineDeployment({`, tone: "text-zinc-100" },
      { ln: 5, code: `  project: 'checkout-edge-in',`, tone: "text-emerald-300" },
      { ln: 6, code: `  region: 'bom-in',`, tone: "text-emerald-300" },
      { ln: 7, code: `  runtime: 'railpack-zero-config',`, tone: "text-amber-200" },
      { ln: 8, code: `  compute: { vcpu: 2, ramGb: 4, nvmeGb: 40 },`, tone: "text-zinc-300" },
      { ln: 9, code: `  shield: { xdpDdos: true, wafMode: 'strict' },`, tone: "text-violet-300" },
      { ln: 10, code: `  database: attachDatabase('pg16-mumbai-primary'),`, tone: "text-sky-300" },
      { ln: 11, code: `});`, tone: "text-zinc-100" },
    ],
  },
  {
    id: "postgres",
    filename: "pgvector.sql",
    pathHint: "db/migrations/004_agent_memory.sql",
    lines: [
      { ln: 1, code: `CREATE EXTENSION IF NOT EXISTS vector;`, tone: "text-sky-300" },
      { ln: 2, code: ``, tone: "text-zinc-500" },
      { ln: 3, code: `CREATE TABLE agent_embeddings (`, tone: "text-zinc-100" },
      { ln: 4, code: `  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),`, tone: "text-zinc-300" },
      { ln: 5, code: `  tenant_id   text NOT NULL,`, tone: "text-emerald-300" },
      { ln: 6, code: `  chunk       text NOT NULL,`, tone: "text-zinc-300" },
      { ln: 7, code: `  embedding   vector(1536) NOT NULL,`, tone: "text-violet-300" },
      { ln: 8, code: `  created_at  timestamptz DEFAULT now()`, tone: "text-zinc-400" },
      { ln: 9, code: `);`, tone: "text-zinc-100" },
      { ln: 10, code: ``, tone: "text-zinc-500" },
      { ln: 11, code: `CREATE INDEX ON agent_embeddings USING hnsw (embedding vector_cosine_ops);`, tone: "text-amber-200" },
    ],
  },
  {
    id: "shield",
    filename: "shield.policy.json",
    pathHint: "edge/shield.policy.json",
    lines: [
      { ln: 1, code: `{`, tone: "text-zinc-300" },
      { ln: 2, code: `  "zone": "api.yourdomain.in",`, tone: "text-emerald-300" },
      { ln: 3, code: `  "edgePop": ["BOM", "MAA", "SIN"],`, tone: "text-sky-300" },
      { ln: 4, code: `  "originCloaking": "wireguard-mesh",`, tone: "text-violet-300" },
      { ln: 5, code: `  "rateLimit": { "rpm": 1200, "burst": 180 },`, tone: "text-amber-200" },
      { ln: 6, code: `  "aiGuardrails": {`, tone: "text-zinc-200" },
      { ln: 7, code: `    "blockPromptInjection": true,`, tone: "text-emerald-300" },
      { ln: 8, code: `    "redactIndianPii": ["PAN", "AADHAAR", "UPI"]`, tone: "text-emerald-300" },
      { ln: 9, code: `  },`, tone: "text-zinc-200" },
      { ln: 10, code: `  "autoSsl": "letsencrypt-tls13"`, tone: "text-sky-300" },
      { ln: 11, code: `}`, tone: "text-zinc-300" },
    ],
  },
] as const;

const WORKLOAD_CONSOLES = [
  {
    id: "paas",
    label: "Deploy PaaS",
    instance: "storefront-bom · Railpack",
    metrics: "cpu 12%   mem 412 MB   ssl TLS 1.3",
    logs: [
      "[09:42:01] Cloning github.com/acme-in/storefront@4f8a21c",
      "[09:42:04] Railpack detected TanStack Start + Node 22",
      "[09:42:14] Built immutable OCI layer in 9.8s (cache hit)",
      "[09:42:16] Healthcheck /api/health -> 200 OK (6ms)",
      "[09:42:17] Edge SSL live -> https://storefront.deploy.sparrowx.net",
      "[09:42:18] NetSec Shield attached (0% egress overhead)",
    ],
  },
  {
    id: "db",
    label: "PostgreSQL 16",
    instance: "pg-mumbai-01 · pgvector 0.8",
    metrics: "cpu 9%    mem 1.4 GB   iops 18.2k",
    logs: [
      "[09:41:12] pgBouncer transaction pool ready (max 400 conns)",
      "[09:41:14] WAL streaming standby synced -> 0.3ms lag",
      "[09:41:28] HNSW cosine query (1.2M vectors) -> 4.1ms",
      "[09:41:45] Encrypted NVMe snapshot uploaded to vault",
      "[09:42:02] TLS 1.3 SCRAM-SHA-256 connection verified",
      "[09:42:15] Zero slow queries in last 60m window",
    ],
  },
  {
    id: "game",
    label: "Game Server",
    instance: "mumbai-rp-01 · Paper / FiveM",
    metrics: "cpu 18%   mem 3.2 GB   players 64 / 128",
    logs: [
      "[09:40:01] Starting Ryzen 9 9950X dedicated container",
      "[09:40:03] Loading map & voice resources (NVMe Gen4)",
      "[09:40:06] Done (2.84s)! Tickrate locked at 20.0 TPS",
      "[09:40:14] Player connected via Mumbai edge (9ms RTT)",
      "[09:40:31] XDP scrubbed 42.8k UDP flood pps seamlessly",
      "[09:41:00] Zero packet loss · auto-backup checkpoint saved",
    ],
  },
  {
    id: "agents",
    label: "AI Agent",
    instance: "support-copilot · Guardrails",
    metrics: "cpu 6%    mem 680 MB   tokens 142/s",
    logs: [
      "[09:42:05] Incoming request routed via ai.sparrowx.net",
      "[09:42:05] Prompt-injection score: 0.01 (clean)",
      "[09:42:06] Retrieved 6 pgvector chunks from db.sparrowx.net",
      "[09:42:07] PII redaction filter checked (DPDP 2023 active)",
      "[09:42:08] Streamed 318 tokens · billed 0.14 SparrowX Coins",
      "[09:42:08] Trace archived -> agents.sparrowx.net/traces/99c",
    ],
  },
] as const;

const INFRA_STACK_LABELS = [
  "PostgreSQL 16 + pgvector",
  "AMD Ryzen 9 & EPYC Bare Metal",
  "eBPF / XDP DDoS Scrubbing",
  "WireGuard Mesh Tunnels",
  "Railpack Git-to-Edge PaaS",
  "DPDP 2023 India Compliance",
  "Zero-Login AES-256 Drop",
  "1:1 INR SparrowX Coins",
];

// -----------------------------------------------------------------------------
// Workspace Sign In Modal (Passwordless Google & GitHub Master SSO)
// -----------------------------------------------------------------------------
function OperatorLoginDialog({
  open,
  onOpenChange,
  externalAuthError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (user: AppUser) => void;
  externalAuthError?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080A10]/95 backdrop-blur-xl border border-white/15 text-white sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-xl font-sans shadow-[0_24px_80px_rgba(0,0,0,0.92)]">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#5B87FF]/75 to-transparent" />

        <DialogHeader className="relative px-6 pt-6 pb-4 pr-12 text-left space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg grid place-items-center shrink-0 border bg-[#5B87FF]/12 border-[#5B87FF]/35 text-[#93B4FF]">
              <Lock className="size-4" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              sparrowx.net · Master SSO
            </span>
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold text-white tracking-tight font-display">
              Sign In to SparrowX
            </DialogTitle>
            <DialogDescription className="text-[13px] text-zinc-400 leading-relaxed font-sans">
              Continue with Google or GitHub for instant Single Sign-On across all 12 SparrowX platforms and your SparrowX Coins wallet.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {externalAuthError && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 leading-relaxed"
            >
              {externalAuthError}
            </div>
          )}
          <OAuthSignInButtons nextPath="/" />
          <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
            Passwordless OAuth 2.0 SSO — your isolated workspace, PostgreSQL database, and coin vault provision automatically on first sign-in.
          </p>
        </div>

        <div className="bg-[#050609] border-t border-white/[0.08] px-6 py-3.5 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="text-zinc-300 font-mono text-[11px]">Google &amp; GitHub SSO</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Flagship Master Company Portal (sparrowx.net)
// Architectural Obsidian Carbon + Crisp 1px Structural Grid + Dot-Matrix Art
// -----------------------------------------------------------------------------
export function SparrowxMasterLanding({
  onOpenLogin,
  onUserAuthenticated,
}: SparrowxMasterLandingProps) {
  const uid = useId();
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [oauthAuthError, setOauthAuthError] = useState("");
  const [platformsPanelOpen, setPlatformsPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string>("chapter-isolation");
  const [activeCodeTab, setActiveCodeTab] = useState<(typeof CODE_SNIPPETS)[number]["id"]>("deploy");
  const [activeWorkloadTab, setActiveWorkloadTab] =
    useState<(typeof WORKLOAD_CONSOLES)[number]["id"]>("paas");
  const [platformSearch, setPlatformSearch] = useState("");
  const [platformCategory, setPlatformCategory] = useState<PlatformCategory>("all");

  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [devConnection, setDevConnection] = useState<DeveloperDbConnectionInfo | null>(null);
  const [connectingDb, setConnectingDb] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const platformsNavRef = useRef<HTMLDivElement | null>(null);
  const codeTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const workloadTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onUserAuthenticatedRef = useRef(onUserAuthenticated);
  onUserAuthenticatedRef.current = onUserAuthenticated;

  // Surface OAuth callback/configuration errors (?auth_error=...) inside the Sign In modal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const errMsg = url.searchParams.get("auth_error")?.trim();
    if (errMsg) {
      setOauthAuthError(errMsg);
      setOperatorModalOpen(true);
      url.searchParams.delete("auth_error");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, []);

  // Hydrate authenticated session on client mount (local JWT or Google/Master SSO cookie)
  useEffect(() => {
    const verified = verifySessionToken();
    if (verified) {
      const hydrated: AppUser = {
        id: verified.sub,
        email: verified.email,
        fullName: verified.fullName || verified.email.split("@")[0] || "Operator",
        password: "",
        admin: verified.role === "admin" ? "yes" : "no",
        tenantId: verified.tenantId,
      };
      setSessionUser(hydrated);
      const cached = getCachedDeveloperConnection(verified.tenantId, verified.email);
      if (cached) setDevConnection(cached);
      if (onUserAuthenticatedRef.current) {
        onUserAuthenticatedRef.current(hydrated);
      }
      return undefined;
    }
    let active = true;
    void fetchMasterSsoUser().then((ssoUser) => {
      if (!active || !ssoUser) return;
      issueSignedSessionToken({
        id: ssoUser.id,
        email: ssoUser.email,
        fullName: ssoUser.fullName,
        role: ssoUser.role,
        tenantId: ssoUser.tenantId,
      });
      const hydrated: AppUser = {
        id: ssoUser.id,
        email: ssoUser.email,
        fullName: ssoUser.fullName,
        password: "",
        admin: ssoUser.role === "admin" ? "yes" : "no",
        tenantId: ssoUser.tenantId,
      };
      setSessionUser(hydrated);
      if (onUserAuthenticatedRef.current) {
        onUserAuthenticatedRef.current(hydrated);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setDevConnection(null);
      return;
    }
    let active = true;
    setConnectingDb(true);
    void ensureDeveloperConnection({
      id: sessionUser.id,
      email: sessionUser.email,
      fullName: sessionUser.fullName,
      tenantId: sessionUser.tenantId,
    }).then((info) => {
      if (!active) return;
      if (info) setDevConnection(info);
      setConnectingDb(false);
    });

    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<DeveloperDbConnectionInfo | null>).detail;
      if (detail) setDevConnection(detail);
    };
    window.addEventListener(DEVELOPER_CONNECTION_EVENT, onUpdate);
    return () => {
      active = false;
      window.removeEventListener(DEVELOPER_CONNECTION_EVENT, onUpdate);
    };
  }, [sessionUser]);

  // Dismiss desktop Platforms disclosure on Escape or outside pointer press
  useEffect(() => {
    if (!platformsPanelOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlatformsPanelOpen(false);
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (
        platformsNavRef.current &&
        e.target instanceof Node &&
        !platformsNavRef.current.contains(e.target)
      ) {
        setPlatformsPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [platformsPanelOpen]);

  // Scroll-spy for the sticky 5-chapter rail
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id);
          }
        }
      },
      { rootMargin: "-32% 0px -52% 0px" },
    );
    CHAPTERS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const directRoutes: Record<string, string> = {
    db: "/db",
    file: "/drop",
    drop: "/drop",
    password: "/keys",
    keys: "/keys",
    sec: "/shield",
    shield: "/shield",
    api: "/gateway",
    game: "/game",
    infra: "/infra",
    deploy: "/deploy",
    ai: "/ai",
    agents: "/agents",
    dpdp: "/dpdp",
  };

  const resolveServiceHref = (targetId: string, url: string) => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1") {
        const directPath = directRoutes[targetId];
        if (directPath) return directPath;
      }
    }
    return url;
  };

  const getPlatformHref = (svc: PlatformEntry) =>
    svc.isNetsec
      ? getNetsecSsoUrl({ autoSso: Boolean(sessionUser) })
      : resolveServiceHref(svc.id, svc.prodUrl);

  const handleLaunch = (targetId: string, url: string, _param?: string) => {
    if (typeof window === "undefined") return;
    window.location.href = resolveServiceHref(targetId, url);
  };

  const handleLandingSignOut = () => {
    clearSessionToken();
    void clearMasterSsoSession();
    setDevConnection(null);
    setSessionUser(null);
  };

  const handleCopyDbUri = async () => {
    const uri =
      devConnection?.connectionString ||
      (devConnection
        ? `postgresql://${devConnection.dbUser}@${devConnection.dbHost}:${devConnection.dbPort}/${devConnection.dbName}`
        : "");
    if (!uri || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // Clipboard blocked in non-secure context
    }
  };

  const openConsoleOrSignIn = () => {
    if (sessionUser) {
      onOpenLogin();
    } else {
      setOperatorModalOpen(true);
    }
  };

  // Filtered platforms for the interactive Bento Hub directory
  const filteredPlatforms = useMemo(() => {
    const q = platformSearch.trim().toLowerCase();
    return SPARROWX_PLATFORMS.filter((item) => {
      if (platformCategory !== "all" && item.category !== platformCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q)
      );
    });
  }, [platformCategory, platformSearch]);

  // Selection-follows-focus keyboard handler for WAI-ARIA tablists
  const handleTabKeyDown = <T extends string>(
    e: React.KeyboardEvent,
    items: readonly { id: T }[],
    currentId: T,
    onSelect: (id: T) => void,
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  ) => {
    const idx = items.findIndex((item) => item.id === currentId);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = items.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const target = items[nextIdx];
      if (target) {
        onSelect(target.id);
        refs.current[nextIdx]?.focus();
      }
    }
  };

  const platformsPanelId = `${uid}-platforms-panel`;
  const whatsAppUrl = buildWhatsAppSupportUrl(
    "Hi SparrowX Support, I want to talk with the engineering team about SparrowX Cloud.",
  );

  return (
    <div className="min-h-screen bg-[#06070A] text-[#F4F6FA] font-sans antialiased selection:bg-[#5B87FF]/35 selection:text-white flex flex-col relative overflow-x-clip">
      {/* =====================================================================
          1. MINIMAL ARCHITECTURAL TOP NAVBAR
          Semantic site navigation (natural Tab order; disclosure button, not ARIA menu)
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#06070A]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-x border-white/[0.08]">
          {/* Left: Brand + Primary Nav */}
          <div className="flex items-center gap-7 min-w-0">
            <a href="/" className="flex items-center gap-2.5 shrink-0 group">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Technologies Logo"
                width={28}
                height={28}
                fetchPriority="high"
                decoding="async"
                className="size-7 object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              <span className="font-display font-bold text-[13px] tracking-[0.14em] text-white uppercase">
                SPARROWX
              </span>
            </a>

            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6 text-[13px] text-zinc-400">
              {/* Semantic Disclosure for Platforms */}
              <div
                ref={platformsNavRef}
                className="relative"
                onBlur={(e) => {
                  if (
                    platformsNavRef.current &&
                    e.relatedTarget instanceof Node &&
                    !platformsNavRef.current.contains(e.relatedTarget)
                  ) {
                    setPlatformsPanelOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  aria-expanded={platformsPanelOpen}
                  aria-controls={platformsPanelId}
                  onClick={() => setPlatformsPanelOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1 py-1 transition-colors cursor-pointer ${
                    platformsPanelOpen ? "text-white" : "hover:text-white"
                  }`}
                >
                  <span>Platforms</span>
                  <ChevronDown
                    className={`size-3.5 text-zinc-500 transition-transform duration-150 ${
                      platformsPanelOpen ? "rotate-180 text-zinc-200" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {platformsPanelOpen && (
                  <div
                    id={platformsPanelId}
                    className="absolute left-0 mt-3 w-[560px] rounded-xl border border-white/[0.12] bg-[#080A10]/98 backdrop-blur-xl p-3 z-50 shadow-[0_24px_64px_rgba(0,0,0,0.88)]"
                  >
                    <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/[0.07]">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                        12 Sovereign Subdomains · Single SSO
                      </span>
                      <a
                        href="#products"
                        onClick={() => setPlatformsPanelOpen(false)}
                        className="text-[11px] font-mono text-[#93B4FF] hover:text-white inline-flex items-center gap-1"
                      >
                        <span>Directory</span>
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </a>
                    </div>
                    <ul className="grid grid-cols-2 gap-1 list-none m-0 p-0">
                      {SPARROWX_PLATFORMS.map((svc) => (
                        <li key={svc.id}>
                          <a
                            href={getPlatformHref(svc)}
                            onClick={() => setPlatformsPanelOpen(false)}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
                          >
                            <img
                              src={svc.logo}
                              alt=""
                              aria-hidden="true"
                              width={24}
                              height={24}
                              loading="lazy"
                              decoding="async"
                              className="size-6 rounded object-contain shrink-0 border border-white/[0.12] bg-[#0B0E17] p-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-zinc-100 group-hover:text-white truncate">
                                {svc.shortName}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 truncate">
                                {svc.domain}
                              </div>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <a href="#architecture" className="hover:text-white transition-colors">
                Architecture
              </a>
              <a href="#coins" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                <SparrowxCoinIcon className="size-3.5" size={14} />
                <span>Coins</span>
              </a>
              <a href="/docs" className="hover:text-white transition-colors">
                Docs
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Contact
              </a>
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {sessionUser ? (
              <>
                <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.12] text-zinc-200 text-xs max-w-[165px] truncate">
                  <User className="size-3.5 shrink-0 text-[#93B4FF]" aria-hidden="true" />
                  <span className="truncate">{sessionUser.fullName || sessionUser.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenLogin()}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-xs transition-colors items-center gap-1.5 cursor-pointer"
                >
                  <span>Console</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleLandingSignOut}
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setOperatorModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.24] text-xs font-medium text-zinc-100 transition-colors cursor-pointer min-h-[34px]"
              >
                <Lock className="size-3 text-[#93B4FF]" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden size-9 rounded-md bg-[#0B0D14] border border-white/[0.14] text-white flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#06070A] px-4 pt-3 pb-6 space-y-4 max-h-[calc(100dvh-56px)] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SPARROWX_PLATFORMS.map((svc) => (
                <a
                  key={svc.id}
                  href={getPlatformHref(svc)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-lg bg-[#0A0C12] border border-white/[0.08] hover:border-white/[0.2] flex items-center gap-3"
                >
                  <img
                    src={svc.logo}
                    alt=""
                    aria-hidden="true"
                    width={24}
                    height={24}
                    loading="lazy"
                    className="size-6 rounded object-contain shrink-0 border border-white/[0.1] bg-[#060810] p-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{svc.shortName}</div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">{svc.domain}</div>
                  </div>
                  <ArrowUpRight className="size-3.5 text-zinc-500 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2 text-xs font-mono">
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-md bg-[#0A0C12] border border-white/[0.08] text-zinc-200 flex items-center justify-between"
              >
                <span>Architecture</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
              <a
                href="#coins"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-md bg-[#0A0C12] border border-white/[0.08] text-zinc-200 flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <SparrowxCoinIcon className="size-4" size={16} />
                  <span>SparrowX Coins</span>
                </span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
              <a
                href="/docs"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-md bg-[#0A0C12] border border-white/[0.08] text-zinc-200 flex items-center justify-between"
              >
                <span>Documentation</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-md bg-[#0A0C12] border border-white/[0.08] text-zinc-200 flex items-center justify-between"
              >
                <span>Contact Engineering</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>

              {sessionUser ? (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full min-h-[42px] rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Open Console</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLandingSignOut();
                    }}
                    className="w-full min-h-[38px] rounded-md border border-white/[0.12] text-zinc-300 text-xs cursor-pointer"
                  >
                    Sign Out ({sessionUser.email})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setOperatorModalOpen(true);
                  }}
                  className="w-full min-h-[42px] rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ACTIVE DEVELOPER CONNECTION STRIP WHEN SIGNED IN */}
      {sessionUser && (
        <section
          aria-label="Active Developer Connection"
          className="relative z-20 border-b border-white/[0.08] bg-[#080A10]"
        >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 border-x border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 spx-dot-breathe" aria-hidden="true" />
                DEVELOPER CONNECTED
              </span>
              <span className="font-semibold text-white">
                {sessionUser.fullName || sessionUser.email}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">{sessionUser.email}</span>
              {devConnection ? (
                <span className="inline-flex items-center gap-1.5 rounded bg-white/[0.04] border border-white/[0.1] px-2.5 py-1 font-mono text-[11px] text-zinc-200">
                  <Database className="size-3.5 text-emerald-400" aria-hidden="true" />
                  <span>
                    {devConnection.dbName} @ {devConnection.dbHost}:{devConnection.dbPort}
                  </span>
                </span>
              ) : (
                <span className="font-mono text-[11px] text-zinc-400">
                  {connectingDb ? "Connecting PostgreSQL instance..." : "PostgreSQL Workspace Ready"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {devConnection && (
                <button
                  type="button"
                  onClick={handleCopyDbUri}
                  className="px-3 py-1.5 rounded-md border border-white/[0.14] bg-[#06070A] hover:border-white/35 text-[11px] font-mono text-zinc-200 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedUri ? (
                    <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedUri ? "URI Copied" : "Copy Postgres URI"}</span>
                </button>
              )}
              <a
                href={resolveServiceHref("db", "https://db.sparrowx.net")}
                className="px-3 py-1.5 rounded-md border border-white/[0.14] bg-[#06070A] hover:border-white/35 text-[11px] font-mono text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <Database className="size-3.5" aria-hidden="true" />
                <span>DB Studio</span>
              </a>
              <a
                href={getNetsecSsoUrl({ autoSso: true })}
                className="px-3 py-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-mono font-semibold text-emerald-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <Shield className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>NetSec Panel</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => onOpenLogin()}
                className="px-3.5 py-1.5 rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>Open Console</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      <main className="flex-1">
        {/* ===================================================================
            2. CENTERED ARCHITECTURAL HERO + HALFTONE HORIZON ARC
           =================================================================== */}
        <section
          id="status"
          className="relative border-b border-white/[0.08] bg-[#06070A] overflow-hidden"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] relative pt-20 sm:pt-28 pb-36 sm:pb-48 px-4 sm:px-8">
            {/* Subtle Dot-Matrix Sparrow Silhouette Backdrop */}
            <DotMatrixSparrowBackdrop className="absolute inset-x-0 top-6 mx-auto w-full max-w-[680px] h-[360px] opacity-90" />

            {/* Centered Editorial Hero Copy */}
            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0B0D14]/85 px-3 py-1 text-[11px] font-mono text-zinc-300">
                <span className="size-1.5 rounded-full bg-emerald-400 spx-dot-breathe" aria-hidden="true" />
                <span>BOM · MAA · SIN EDGE ONLINE</span>
                <span className="text-zinc-600" aria-hidden="true">/</span>
                <span className="text-[#93B4FF]">12 SOVEREIGN PLATFORMS</span>
              </div>

              <h1 className="font-display text-4xl sm:text-6xl md:text-[68px] font-bold tracking-[-0.035em] leading-[1.03] text-balance">
                <span className="block text-white">Build sovereign</span>
                <span className="block text-[#5B87FF]">with SparrowX.</span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
                Bare-metal Ryzen compute, managed PostgreSQL with pgvector, Git-to-Edge PaaS,
                autonomous XDP defense, and agentic AI—unified under one Indian developer cloud.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openConsoleOrSignIn}
                  className="px-5 py-2.5 rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-[13px] transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>{sessionUser ? "Open Console" : "Launch Console"}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
                <a
                  href="#products"
                  className="px-5 py-2.5 rounded-md border border-white/[0.14] bg-[#0B0D14]/90 hover:bg-[#131723] hover:border-white/[0.24] text-zinc-200 hover:text-white font-medium text-[13px] transition-colors inline-flex items-center gap-2"
                >
                  <span>Explore 12 Platforms</span>
                </a>
              </div>
            </div>

            {/* Signature Glowing Blue Halftone Planetary Horizon Arc */}
            <HalftoneHorizonArc className="absolute inset-x-0 bottom-0 h-[150px] sm:h-[205px]" />
          </div>
        </section>

        {/* ===================================================================
            3. CRISP 1PX ARCHITECTURAL INFRASTRUCTURE CAPABILITIES STRIP
           =================================================================== */}
        <section
          aria-label="Core Platform Foundations"
          className="border-b border-white/[0.08] bg-[#06070A]"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] px-4 sm:px-6 py-4">
            <div className="flex flex-wrap items-center justify-center lg:justify-between gap-x-6 gap-y-2.5 text-[11px] font-mono text-zinc-500">
              {INFRA_STACK_LABELS.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 text-zinc-400">
                  <span className="size-1 rounded-full bg-[#5B87FF]/75" aria-hidden="true" />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            4. STICKY LEFT-RAIL 5-CHAPTER ENGINEERING DEEP-DIVE
           =================================================================== */}
        <section
          id="architecture"
          aria-label="Platform Engineering Deep Dive"
          className="border-b border-white/[0.08] bg-[#06070A] scroll-mt-14"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] grid grid-cols-1 lg:grid-cols-[200px_1fr]">
            {/* Sticky Left Chapter Rail */}
            <aside className="hidden lg:block border-r border-white/[0.08] bg-[#06070A]">
              <nav
                aria-label="Architecture Chapters"
                className="sticky top-24 px-5 py-8 space-y-1"
              >
                {CHAPTERS.map((chapter) => {
                  const isActive = activeChapter === chapter.id;
                  return (
                    <a
                      key={chapter.id}
                      href={`#${chapter.id}`}
                      onClick={() => setActiveChapter(chapter.id)}
                      aria-current={isActive ? "location" : undefined}
                      className={`group flex items-center gap-3 py-2 text-[13px] transition-colors ${
                        isActive ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 transition-all duration-200 ${
                          isActive
                            ? `rotate-45 rounded-[1px] ${chapter.dotClass}`
                            : "rounded-[1px] border border-zinc-700 group-hover:border-zinc-500 bg-transparent"
                        }`}
                      />
                      <span>{chapter.label}</span>
                    </a>
                  );
                })}
              </nav>
            </aside>

            {/* Mobile Horizontal Chapter Jump Bar */}
            <div className="lg:hidden border-b border-white/[0.08] px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {CHAPTERS.map((chapter) => {
                const isActive = activeChapter === chapter.id;
                return (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    onClick={() => setActiveChapter(chapter.id)}
                    className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
                      isActive
                        ? "border-white/25 bg-white/[0.07] text-white"
                        : "border-white/[0.08] bg-[#090B11] text-zinc-400"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 ${
                        isActive ? `rotate-45 ${chapter.dotClass}` : "bg-zinc-600"
                      }`}
                    />
                    <span>{chapter.label}</span>
                  </a>
                );
              })}
            </div>

            {/* 5 Stacked Architectural Split Chapters */}
            <div className="divide-y divide-white/[0.08] min-w-0">
              {/* -------------------------------------------------------------
                  CHAPTER 1: ISOLATION (Violet)
                 ------------------------------------------------------------- */}
              <article
                id="chapter-isolation"
                className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-12 min-h-[520px]"
              >
                <div className="xl:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5 xl:border-r border-white/[0.08]">
                  <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.08]">
                    <span className="block text-white">Noisy neighbours,</span>
                    <span className="block text-zinc-500">contained.</span>
                  </h2>
                  <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                    Every PostgreSQL cluster, KVM VPS, and game node runs inside strict hardware and
                    cgroups v2 limits: dedicated AMD Ryzen &amp; EPYC cores, hard memory ceilings,
                    and isolated NVMe I/O queues.
                  </p>
                  <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
                    A tenant that hits its quota is throttled cleanly at that line. Everything else
                    on the rack keeps its full share—with predictable flat monthly rates and zero
                    surprise egress charges.
                  </p>
                  <div className="pt-2">
                    <a
                      href={resolveServiceHref("infra", "https://infra.sparrowx.net")}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.25] text-xs font-medium text-zinc-100 transition-colors"
                    >
                      <span>Inspect Cloud Infra</span>
                      <ArrowUpRight className="size-3.5 text-violet-400" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="xl:col-span-7 min-w-0">
                  <IsolationSchematicArt />
                </div>
              </article>

              {/* -------------------------------------------------------------
                  CHAPTER 2: SECURITY (Emerald) — Alternated Visual Left
                 ------------------------------------------------------------- */}
              <article
                id="chapter-security"
                className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-12 min-h-[540px]"
              >
                <div className="order-2 xl:order-1 xl:col-span-7 relative bg-[#07090D] p-6 sm:p-10 flex items-center justify-center overflow-hidden xl:border-r border-white/[0.08]">
                  <DotMatrixWash tone="emerald" variant="radial" className="absolute inset-0" />

                  {/* Multi-Hop Security Verification Trace Card */}
                  <div className="relative z-10 w-full max-w-[540px] rounded-xl border border-white/[0.12] bg-[#070A0F]/95 shadow-[0_24px_60px_rgba(0,0,0,0.75)] overflow-hidden font-mono">
                    {/* Top command bar */}
                    <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-semibold">
                          shield
                        </span>
                        <span className="text-zinc-200 truncate">POST /api/v1/deploy</span>
                      </div>
                      <span className="text-zinc-500 shrink-0">bom-edge-01 · mTLS</span>
                    </div>

                    {/* Vertical Hop Timeline */}
                    <div className="p-5 space-y-5">
                      {[
                        {
                          hop: "Edge WAF & XDP",
                          endpoint: "sec.sparrowx.net",
                          checks: ["eBPF/XDP L3/L4 clean", "OWASP CRS verified", "bot score 0.02"],
                          note: "request scrubbed in 0.4ms",
                        },
                        {
                          hop: "WireGuard Mesh",
                          endpoint: "wg0://bom-core:51820",
                          checks: ["Curve25519 key", "HMAC-SHA256 SSO", "origin cloaked"],
                          note: "encrypted frame accepted",
                        },
                        {
                          hop: "Isolated Runtime",
                          endpoint: "tenant-prod-01",
                          checks: ["unprivileged uid", "read-only rootfs", "no-new-privileges"],
                          note: "200 OK · isolated execution",
                        },
                      ].map((step, idx, arr) => (
                        <div key={step.hop} className="relative pl-6">
                          {idx < arr.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="absolute left-[4px] top-3 bottom-[-22px] w-px bg-emerald-500/35"
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.75)]"
                          />
                          <div className="flex flex-wrap items-baseline gap-2 text-xs">
                            <span className="text-white font-semibold">{step.hop}</span>
                            <span className="text-zinc-500 text-[11px]">{step.endpoint}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                            {step.checks.map((chk) => (
                              <span
                                key={chk}
                                className="inline-flex items-center gap-1 rounded bg-white/[0.03] border border-white/[0.07] px-1.5 py-0.5 text-zinc-300"
                              >
                                <Check className="size-2.5 text-emerald-400 shrink-0" aria-hidden="true" />
                                <span>{chk}</span>
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 text-[10px] text-emerald-400/90">{step.note}</div>
                        </div>
                      ))}
                    </div>

                    {/* Signed Token Claim Footer */}
                    <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#05070B] text-[10px] text-zinc-400 space-y-1 tabular-nums">
                      <div className="grid grid-cols-[96px_1fr] gap-2">
                        <span className="text-zinc-500">tenant_id</span>
                        <span className="text-zinc-300">&quot;TNT-BOM-4920&quot;</span>
                      </div>
                      <div className="grid grid-cols-[96px_1fr] gap-2">
                        <span className="text-zinc-500">scopes</span>
                        <span className="text-zinc-300 truncate">
                          [&quot;db.query&quot;, &quot;deploy.push&quot;, &quot;shield.inspect&quot;]
                        </span>
                      </div>
                      <div className="grid grid-cols-[96px_1fr] gap-2">
                        <span className="text-zinc-500">transport</span>
                        <span className="text-emerald-300">TLSv1.3 · AEAD · zero-origin-leak</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="order-1 xl:order-2 xl:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5">
                  <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.08]">
                    <span className="block text-white">Locked down</span>
                    <span className="block text-zinc-500">at every hop.</span>
                  </h2>
                  <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                    Every account is protected by passwordless OAuth 2.0 SSO, HttpOnly HMAC-signed
                    session cookies, and scoped per-service API keys. No plaintext credentials ever
                    touch your browser or our logs.
                  </p>
                  <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
                    Origin servers sit cloaked behind SparrowX Shield WAF and NetSec WireGuard
                    tunnels—blocking L3/L4 floods at the kernel with eBPF/XDP and scrubbing prompt
                    injections at the AI edge.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <a
                      href={resolveServiceHref("sec", "https://sec.sparrowx.net")}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.25] text-xs font-medium text-zinc-100 transition-colors"
                    >
                      <span>Open Shield WAF</span>
                      <ArrowUpRight className="size-3.5 text-emerald-400" aria-hidden="true" />
                    </a>
                    <a
                      href="/security"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.1] hover:border-white/[0.22] text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Security Architecture</span>
                    </a>
                  </div>
                </div>
              </article>

              {/* -------------------------------------------------------------
                  CHAPTER 3: DEPLOY & APIS (Blue) — Accessible Tabs + CLI
                 ------------------------------------------------------------- */}
              <article
                id="chapter-deploy"
                className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-12 min-h-[540px]"
              >
                <div className="xl:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5 xl:border-r border-white/[0.08]">
                  <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.08]">
                    <span className="block text-white">Ship from Git</span>
                    <span className="block text-zinc-500">without lock-in.</span>
                  </h2>
                  <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                    Push any Next.js, TanStack Start, Node, FastAPI, or Dockerfile repo to{" "}
                    <code className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-zinc-200 text-[12px] font-mono">
                      deploy.sparrowx.net
                    </code>
                    . Railpack auto-detects your stack, provisions wildcard SSL, and binds your
                    managed PostgreSQL database in one click.
                  </p>
                  <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
                    Standard SQL, standard OCI containers, and instant PostgREST endpoints mean you
                    can migrate in or export out anytime—zero proprietary vendor traps.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <a
                      href={resolveServiceHref("deploy", "https://deploy.sparrowx.net")}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.25] text-xs font-medium text-zinc-100 transition-colors"
                    >
                      <span>Open Deploy PaaS</span>
                      <ArrowUpRight className="size-3.5 text-[#5B87FF]" aria-hidden="true" />
                    </a>
                    <a
                      href="/docs"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.1] hover:border-white/[0.22] text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Read the SDK docs</span>
                    </a>
                  </div>
                </div>

                {/* Right Visual: Accessible Code Tabs + CLI Output */}
                <div className="xl:col-span-7 relative bg-[#07090E] p-6 sm:p-10 flex flex-col justify-center gap-4 overflow-hidden">
                  <DotMatrixWash tone="blue" variant="diagonal" className="absolute inset-0" />

                  <div className="relative z-10 space-y-4 w-full max-w-[580px] mx-auto">
                    {/* Code Card */}
                    <div className="rounded-xl border border-white/[0.12] bg-[#080B12]/95 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
                      {/* Accessible Tablist (modern-web-guidance `tabs` compliant) */}
                      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3 bg-[#0A0D16]">
                        <div
                          role="tablist"
                          aria-label="SparrowX Configuration Examples"
                          className="flex items-center gap-1 overflow-x-auto no-scrollbar"
                        >
                          {CODE_SNIPPETS.map((snippet, index) => {
                            const selected = activeCodeTab === snippet.id;
                            const tabId = `${uid}-code-tab-${snippet.id}`;
                            return (
                              <button
                                key={snippet.id}
                                ref={(el) => {
                                  codeTabRefs.current[index] = el;
                                }}
                                id={tabId}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => setActiveCodeTab(snippet.id)}
                                onKeyDown={(e) =>
                                  handleTabKeyDown(
                                    e,
                                    CODE_SNIPPETS,
                                    activeCodeTab,
                                    setActiveCodeTab,
                                    codeTabRefs,
                                  )
                                }
                                className="spx-master-tab shrink-0 px-3 py-2.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                              >
                                {snippet.filename}
                              </button>
                            );
                          })}
                        </div>
                        <span className="hidden sm:inline text-[10px] font-mono text-zinc-600 truncate">
                          {CODE_SNIPPETS.find((s) => s.id === activeCodeTab)?.pathHint}
                        </span>
                      </div>

                      {/* Tab Panels (no padding/borders on role=tabpanel element itself) */}
                      <div className="grid">
                        {CODE_SNIPPETS.map((snippet) => {
                          const selected = activeCodeTab === snippet.id;
                          return (
                            <div
                              key={snippet.id}
                              role="tabpanel"
                              aria-labelledby={`${uid}-code-tab-${snippet.id}`}
                              tabIndex={selected ? 0 : undefined}
                              hidden={!selected}
                              className="col-start-1 row-start-1 min-w-0"
                            >
                              <div className="p-4 sm:p-5 overflow-x-auto font-mono text-[11px] sm:text-xs leading-[1.68]">
                                {snippet.lines.map((row) => (
                                  <div key={row.ln} className="flex gap-4 whitespace-pre">
                                    <span className="w-5 text-right select-none text-zinc-600 tabular-nums">
                                      {row.ln}
                                    </span>
                                    <span className={row.tone}>{row.code || " "}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CLI Deploy Output Card */}
                    <div className="rounded-xl border border-white/[0.1] bg-[#06080E]/95 p-4 font-mono text-[11px] space-y-2.5 shadow-lg">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <span className="text-[#5B87FF] font-bold">$</span>
                        <span>npx sparrowx deploy --region bom-in --attach-db</span>
                      </div>
                      <div className="overflow-x-auto text-[10px] sm:text-[11px] text-zinc-400 border-t border-white/[0.07] pt-2.5">
                        <div className="grid grid-cols-[1.2fr_1.5fr_0.7fr] gap-2 text-zinc-500 pb-1">
                          <span>SERVICE</span>
                          <span>ENDPOINT</span>
                          <span className="text-right">STATE</span>
                        </div>
                        <div className="grid grid-cols-[1.2fr_1.5fr_0.7fr] gap-2 py-0.5 text-zinc-200">
                          <span>checkout-edge</span>
                          <span className="text-zinc-400 truncate">checkout.deploy.sparrowx.net</span>
                          <span className="text-right text-emerald-400">live</span>
                        </div>
                        <div className="grid grid-cols-[1.2fr_1.5fr_0.7fr] gap-2 py-0.5 text-zinc-200">
                          <span>pg16-mumbai</span>
                          <span className="text-zinc-400 truncate">db.sparrowx.net:5432</span>
                          <span className="text-right text-emerald-400">pooled</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* -------------------------------------------------------------
                  CHAPTER 4: EVERY WORKLOAD (Amber) — Live Console Switcher
                 ------------------------------------------------------------- */}
              <article
                id="chapter-workloads"
                className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-12 min-h-[540px]"
              >
                <div className="order-2 xl:order-1 xl:col-span-7 relative bg-[#07090D] p-6 sm:p-10 flex items-center justify-center overflow-hidden xl:border-r border-white/[0.08]">
                  {/* Dithered geometric halftone field */}
                  <DotMatrixWash tone="amber" variant="streaks" className="absolute inset-0 opacity-75" />
                  <DotMatrixWash tone="blue" variant="radial" className="absolute inset-0 opacity-65" />

                  <div className="relative z-10 w-full max-w-[540px] space-y-3">
                    {/* Workload Selector Tabs */}
                    <div
                      role="tablist"
                      aria-label="Live Workload Console Preview"
                      className="flex items-center gap-1 overflow-x-auto no-scrollbar border border-white/[0.1] bg-[#070A10]/90 rounded-lg p-1"
                    >
                      {WORKLOAD_CONSOLES.map((item, idx) => {
                        const selected = activeWorkloadTab === item.id;
                        return (
                          <button
                            key={item.id}
                            ref={(el) => {
                              workloadTabRefs.current[idx] = el;
                            }}
                            id={`${uid}-workload-tab-${item.id}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setActiveWorkloadTab(item.id)}
                            onKeyDown={(e) =>
                              handleTabKeyDown(
                                e,
                                WORKLOAD_CONSOLES,
                                activeWorkloadTab,
                                setActiveWorkloadTab,
                                workloadTabRefs,
                              )
                            }
                            className="spx-master-tab shrink-0 px-3 py-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Floating Glass-Obsidian Console Card */}
                    <div className="rounded-xl border border-white/[0.14] bg-[#070A10]/92 backdrop-blur-md shadow-[0_28px_70px_rgba(0,0,0,0.85)] overflow-hidden">
                      <div className="grid">
                        {WORKLOAD_CONSOLES.map((item) => {
                          const selected = activeWorkloadTab === item.id;
                          return (
                            <div
                              key={item.id}
                              role="tabpanel"
                              aria-labelledby={`${uid}-workload-tab-${item.id}`}
                              tabIndex={selected ? 0 : undefined}
                              hidden={!selected}
                              className="col-start-1 row-start-1 min-w-0"
                            >
                              <div className="font-mono">
                                <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                                  <span className="text-zinc-200 truncate">{item.instance}</span>
                                  <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] shrink-0">
                                    <DotGridMiniIcon tone="emerald" className="size-2.5" />
                                    <span>running</span>
                                  </span>
                                </div>
                                <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] text-[10px] sm:text-[11px] text-zinc-400 tabular-nums whitespace-pre overflow-x-auto">
                                  {item.metrics}
                                </div>
                                <div className="p-4 sm:p-5 space-y-1.5 text-[11px] text-zinc-300 leading-relaxed overflow-x-auto">
                                  {item.logs.map((line) => (
                                    <div key={line} className="whitespace-nowrap">
                                      <span className="text-zinc-500">{line.slice(0, 10)}</span>
                                      <span className="text-zinc-200">{line.slice(10)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="order-1 xl:order-2 xl:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5">
                  <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.08]">
                    <span className="block text-white">One platform.</span>
                    <span className="block text-zinc-500">Every workload.</span>
                  </h2>
                  <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                    Whether you&apos;re deploying a full-stack web app, scaling a pgvector AI agent,
                    hosting a 128-slot Mumbai FiveM or Minecraft community, or dropping an encrypted
                    file without creating an account—everything speaks the same SSO and coin wallet.
                  </p>
                  <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
                    Live logs, instant rollbacks, backups, firewall controls, and billing live side
                    by side without juggling six different cloud providers.
                  </p>
                  <div className="pt-2">
                    <a
                      href="#products"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.25] text-xs font-medium text-zinc-100 transition-colors"
                    >
                      <span>Browse All Platforms</span>
                      <ArrowRight className="size-3.5 text-amber-400" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>

              {/* -------------------------------------------------------------
                  CHAPTER 5: SOVEREIGN CLOUD / OUR STORY (Rose)
                 ------------------------------------------------------------- */}
              <article
                id="story"
                className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-12 min-h-[500px]"
              >
                <div className="xl:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5 xl:border-r border-white/[0.08]">
                  <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.08]">
                    <span className="block text-white">Built in India,</span>
                    <span className="block text-zinc-500">priced honestly.</span>
                  </h2>
                  <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                    We started SparrowX after watching independent builders get hit with surprise
                    bandwidth invoices, $2,000/month security paywalls, and everyday tools that
                    demand a login just to share a file.
                  </p>
                  <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
                    Today SparrowX runs 12 sovereign developer services on transparent INR &amp; USD
                    flat rates, DPDP 2023 ready out of the box, with engineers you can actually talk
                    to.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <a
                      href="/story"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.14] bg-[#0B0D14] hover:bg-[#131723] hover:border-white/[0.25] text-xs font-medium text-zinc-100 transition-colors"
                    >
                      <span>Read Our Story</span>
                      <ArrowRight className="size-3.5 text-rose-400" aria-hidden="true" />
                    </a>
                    <a
                      href="/security"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.1] hover:border-white/[0.22] text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Data Security</span>
                    </a>
                  </div>
                </div>

                <div className="xl:col-span-7 relative bg-[#07080D] p-6 sm:p-10 flex flex-col justify-center gap-4 overflow-hidden">
                  <DotMatrixWash tone="rose" variant="diagonal" className="absolute inset-0" />

                  <div className="relative z-10 w-full max-w-[560px] mx-auto space-y-4 font-mono">
                    {/* Sovereign Core Status Card */}
                    <div className="rounded-xl border border-white/[0.12] bg-[#090B11]/92 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-200">
                          sparrowx/cloud-core <span className="text-zinc-600">·</span>{" "}
                          <span className="text-rose-300">production-bom</span>
                        </span>
                        <span className="text-zinc-500 text-[11px] tabular-nums">
                          99.99% edge SLA
                        </span>
                      </div>

                      {/* Architectural dotted activity pulse bar */}
                      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1 py-2" aria-hidden="true">
                        {Array.from({ length: 48 }).map((_, idx) => {
                          const intensity = (idx * 17 + 11) % 7;
                          return (
                            <span
                              key={idx}
                              className={`h-2 rounded-[2px] ${
                                intensity >= 5
                                  ? "bg-rose-400/80"
                                  : intensity >= 3
                                    ? "bg-rose-500/35"
                                    : "bg-white/[0.06]"
                              }`}
                            />
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <span>Zero egress surcharges · Full GST invoicing</span>
                        <span className="text-emerald-400">All 12 zones healthy</span>
                      </div>
                    </div>

                    {/* Two Side-by-Side Spec Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <a
                        href={resolveServiceHref("file", "https://file.sparrowx.net")}
                        className="group rounded-xl border border-white/[0.1] hover:border-white/[0.24] bg-[#090B11]/92 p-4 space-y-2.5 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs text-white font-semibold">
                          <span>file.sparrowx.net</span>
                          <ArrowUpRight className="size-3.5 text-zinc-500 group-hover:text-white transition-colors" aria-hidden="true" />
                        </div>
                        <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                          Zero-login AES-256-GCM drops burned straight from RAM, plus 10 GB persistent vault.
                        </p>
                        <div className="text-[10px] text-zinc-500 pt-1">
                          Free · No account required
                        </div>
                      </a>

                      <a
                        href={resolveServiceHref("password", "https://password.sparrowx.net")}
                        className="group rounded-xl border border-white/[0.1] hover:border-white/[0.24] bg-[#090B11]/92 p-4 space-y-2.5 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs text-white font-semibold">
                          <span>password.sparrowx.net</span>
                          <ArrowUpRight className="size-3.5 text-zinc-500 group-hover:text-white transition-colors" aria-hidden="true" />
                        </div>
                        <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                          100% client-side CSPRNG key &amp; password engine. Zero network requests ever leave your tab.
                        </p>
                        <div className="text-[10px] text-zinc-500 pt-1">
                          Offline · WebCrypto API
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ===================================================================
            5. JUMBO DOT-MATRIX LED SCALE TELEMETRY BAND
           =================================================================== */}
        <section
          aria-label="Platform Scale Telemetry"
          className="spx-master-defer border-b border-white/[0.08] bg-[#06070A]"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] px-5 sm:px-10 py-16 sm:py-24 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-400">
                Platform Traffic &amp; Mitigations
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                SparrowX Global Edge · BOM / MAA / SIN / FRA
              </span>
            </div>

            <DotMatrixTelemetryBoard
              value="14,820,490"
              primaryLabel="Edge & DB Requests"
              primaryCount="9,412,840"
              secondaryLabel="Threats Scrubbed"
              secondaryCount="5,407,650"
            />
          </div>
        </section>

        {/* ===================================================================
            6. ARCHITECTURAL MULTI-CELL BENTO ECOSYSTEM HUB (#products & #coins)
           =================================================================== */}
        <section
          id="products"
          aria-label="SparrowX Ecosystem Hub"
          className="spx-master-defer scroll-mt-16 border-b border-white/[0.08] bg-[#06070A]"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] pt-16 sm:pt-24">
            {/* Two-tone Editorial Header */}
            <div className="px-5 sm:px-10 pb-10 sm:pb-12 space-y-3">
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.06]">
                <span className="block text-white">Everything you need</span>
                <span className="block text-zinc-500">to run it.</span>
              </h2>
            </div>

            {/* Crisp 1px Hairline-Divided Asymmetric Bento Matrix */}
            <div className="border-t border-white/[0.08] grid grid-cols-1 lg:grid-cols-12">
              {/* CELL A (Left Tall): DOCUMENTATION */}
              <div className="lg:col-span-4 lg:row-span-2 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#070910] flex flex-col justify-between min-h-[420px]">
                <DotMatrixWash tone="blue" variant="radial" className="absolute inset-0 opacity-85" />

                <div className="relative z-10 p-6 sm:p-8 space-y-2">
                  <div className="text-[11px] font-mono text-zinc-400">sparrowx.net/docs</div>
                  <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                    Documentation
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-[28ch] pt-1">
                    Guides, architecture playbooks, API schemas, and troubleshooting references for
                    every SparrowX service.
                  </p>
                </div>

                <ul className="relative z-10 list-none m-0 p-0 border-t border-white/[0.08] divide-y divide-white/[0.08] bg-[#06080E]/80 backdrop-blur-sm">
                  {[
                    { label: "Quickstart & Platform Docs", href: "/docs" },
                    { label: "Cloud DB & pgvector Guide", href: "/docs/db" },
                    { label: "Shield WAF & NetSec Setup", href: "/docs/shield" },
                    { label: "Cloud Infra & Bare Metal", href: "/docs/infra" },
                    { label: "Error Reference & Codes", href: "/docs/errors" },
                  ].map((docLink) => (
                    <li key={docLink.href}>
                      <a
                        href={docLink.href}
                        className="group px-6 sm:px-8 py-3.5 flex items-center justify-between gap-3 text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.03] transition-colors"
                      >
                        <span>{docLink.label}</span>
                        <ArrowRight
                          className="size-3.5 text-zinc-500 group-hover:text-[#5B87FF] group-hover:translate-x-0.5 transition-all"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CELL B (Top-Right Wide): INTERACTIVE PLATFORMS DIRECTORY */}
              <div className="lg:col-span-8 relative overflow-hidden border-b border-white/[0.08] bg-[#060A09] p-6 sm:p-8 space-y-5">
                <DotMatrixWash
                  tone="emerald"
                  variant="streaks"
                  className="absolute inset-y-0 right-0 w-3/4 opacity-70"
                />

                <div className="relative z-10 space-y-1.5">
                  <div className="text-[11px] font-mono text-zinc-400">
                    *.sparrowx.net · 12 dedicated subdomains
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                    Platforms
                  </h3>
                  <p className="text-xs sm:text-[13px] text-zinc-400 max-w-xl">
                    Every SparrowX product runs on its own isolated subdomain—covering databases,
                    compute, deployment, DDoS defense, AI agents, and zero-login utilities.
                  </p>
                </div>

                {/* Live Interactive Search Input */}
                <div className="relative z-10 max-w-lg">
                  <Search
                    className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={platformSearch}
                    onChange={(e) => setPlatformSearch(e.target.value)}
                    aria-label="Search 12 SparrowX platforms"
                    placeholder="Search 12 platforms — postgres, waf, deploy, game, ai..."
                    className="w-full rounded-lg border border-white/[0.12] bg-[#07090E]/90 pl-10 pr-4 py-2.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-500 focus:outline-none focus-visible:border-emerald-400/60 focus-visible:ring-2 focus-visible:ring-emerald-400/20 transition-colors"
                  />
                </div>

                {/* Category Filter Pills with Colored Dot-Grid Icons */}
                <div className="relative z-10 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  {(
                    [
                      { key: "all", label: "12 all services", tone: "blue" as DotAccentTone },
                      { key: "infrastructure", label: "4 infrastructure", tone: "emerald" as DotAccentTone },
                      { key: "security", label: "4 security", tone: "violet" as DotAccentTone },
                      { key: "ai-utilities", label: "4 ai & utilities", tone: "amber" as DotAccentTone },
                    ] as const
                  ).map((cat) => {
                    const active = platformCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setPlatformCategory(cat.key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                          active
                            ? "border-white/25 bg-white/[0.08] text-white"
                            : "border-white/[0.07] bg-black/30 text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]"
                        }`}
                      >
                        <DotGridMiniIcon tone={cat.tone} className="size-2.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Compact Clickable Platform Grid */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-1">
                  {filteredPlatforms.length > 0 ? (
                    filteredPlatforms.map((svc) => (
                      <a
                        key={svc.id}
                        href={getPlatformHref(svc)}
                        className="group rounded-lg border border-white/[0.09] hover:border-emerald-400/40 bg-[#070A0F]/90 hover:bg-[#0C1118] p-3 flex items-start gap-2.5 transition-colors"
                      >
                        <img
                          src={svc.logo}
                          alt=""
                          aria-hidden="true"
                          width={24}
                          height={24}
                          loading="lazy"
                          decoding="async"
                          className="size-6 rounded object-contain shrink-0 border border-white/[0.1] bg-[#05070B] p-0.5 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-zinc-100 group-hover:text-white truncate">
                              {svc.shortName}
                            </span>
                            <ArrowUpRight
                              className="size-3 text-zinc-600 group-hover:text-emerald-400 shrink-0 transition-colors"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 truncate">
                            {svc.domain}
                          </div>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="col-span-full py-6 text-center text-xs font-mono text-zinc-500 border border-dashed border-white/[0.1] rounded-lg">
                      No SparrowX platform matches &quot;{platformSearch}&quot;.
                    </div>
                  )}
                </div>
              </div>

              {/* CELL C (Bottom-Middle): SPARROWX COINS TREASURY (#coins) */}
              <div
                id="coins"
                className="lg:col-span-4 scroll-mt-20 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#080712] p-6 sm:p-8 flex flex-col justify-between gap-5"
              >
                <DotMatrixWash tone="indigo" variant="orbit" className="absolute inset-0 opacity-85" />

                <div className="relative z-10 space-y-3">
                  <div className="text-[11px] font-mono text-[#A5B4FC]">
                    sparrowx.net/coins · 1 Coin = ₹1 INR
                  </div>
                  <div className="flex items-center gap-2.5">
                    <SparrowxCoinIcon className="size-7" size={28} />
                    <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                      SparrowX Coins
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Fund one sovereign balance via 0%-fee UPI QR or Binance USDT and spend seamlessly
                    across Infra, Game Hosting, PostgreSQL, Shield, and AI Agents—credits never expire.
                  </p>

                  {/* Official Watermark-Free 3D Stacked Coins Visual */}
                  <div className="relative overflow-hidden rounded-lg border border-[#A5B4FC]/20 bg-[#050711] mt-2">
                    <picture>
                      <source type="image/webp" srcSet="/images/sparrowx-coins-stack.webp" />
                      <img
                        src="/images/sparrowx-coins-stack.jpg"
                        alt="3D metallic embossed SparrowX Coins stack"
                        width={960}
                        height={746}
                        loading="lazy"
                        decoding="async"
                        className="block w-full h-36 object-cover object-center"
                      />
                    </picture>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050711] via-[#050711]/70 to-transparent px-3 pb-2 pt-6 flex items-center justify-between text-[10px] font-mono text-[#C7D2FE]">
                      <span>BONUS PACKS: +100 · +300 · +1,500</span>
                      <span className="text-emerald-300">0% UPI</span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                    <DotGridMiniIcon tone="indigo" className="size-2.5" />
                    <span>Instant GST invoice</span>
                  </span>
                  <button
                    type="button"
                    onClick={openConsoleOrSignIn}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#C7D2FE] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>{sessionUser ? "Open Wallet" : "Claim Wallet"}</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* CELL D (Bottom-Right): COMMUNITY & DIRECT SUPPORT */}
              <div className="lg:col-span-4 relative overflow-hidden bg-[#0A0806] p-6 sm:p-8 flex flex-col justify-between gap-6">
                <DotMatrixWash tone="amber" variant="radial" className="absolute inset-0 opacity-75" />

                <div className="relative z-10 space-y-3">
                  <div className="text-[11px] font-mono text-amber-300/80">
                    founder@sparrowx.net · &lt; 4h SLA
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                    Community &amp; Support
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Direct founder and engineering access—India WhatsApp support, architecture
                    reviews, custom bare-metal quotes, and rapid incident response.
                  </p>
                  <div className="rounded-lg border border-white/[0.08] bg-[#07080C]/80 p-3.5 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span>Engineering Desk</span>
                      <span className="text-emerald-400">Online</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      APAC · EU · US on-call coverage · zero ticket bots
                    </div>
                  </div>
                </div>

                <div className="relative z-10 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono">
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-200 hover:text-amber-300 underline underline-offset-4 decoration-white/25 transition-colors"
                  >
                    WhatsApp
                  </a>
                  <a
                    href="#contact"
                    className="text-zinc-200 hover:text-amber-300 underline underline-offset-4 decoration-white/25 transition-colors"
                  >
                    Contact Form
                  </a>
                  <a
                    href="/story"
                    className="text-zinc-200 hover:text-amber-300 underline underline-offset-4 decoration-white/25 transition-colors"
                  >
                    Our Story
                  </a>
                  <a
                    href="/docs"
                    className="text-zinc-200 hover:text-amber-300 underline underline-offset-4 decoration-white/25 transition-colors"
                  >
                    Docs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            7. DIRECT ENGINEERING CONTACT SECTION (#contact)
           =================================================================== */}
        <div className="spx-master-defer border-b border-white/[0.08] bg-[#06070A]">
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08]">
            <ContactSection />
          </div>
        </div>

        {/* ===================================================================
            8. CLOSING CENTERED CTA OVER HALFTONE HORIZON ARC
           =================================================================== */}
        <section
          aria-label="Get Started with SparrowX"
          className="relative bg-[#06070A] overflow-hidden"
        >
          <div className="max-w-[1280px] mx-auto border-x border-white/[0.08] relative pt-24 sm:pt-32 pb-40 sm:pb-48 px-4 sm:px-8 text-center">
            <DotMatrixSparrowBackdrop className="absolute inset-x-0 top-6 mx-auto w-full max-w-[540px] h-[280px] opacity-60" />

            <div className="relative z-10 max-w-xl mx-auto space-y-5">
              <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-[-0.035em] leading-[1.04]">
                <span className="block text-white">Start building</span>
                <span className="block text-[#5B87FF]">with SparrowX.</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
                One passwordless SSO account provisions your workspace, isolated PostgreSQL
                database, Deploy PaaS, Shield WAF, and SparrowX Coins wallet in seconds.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openConsoleOrSignIn}
                  className="px-5 py-2.5 rounded-md bg-[#F4F4F5] hover:bg-white text-[#06070A] font-semibold text-[13px] transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Terminal className="size-3.5" aria-hidden="true" />
                  <span>{sessionUser ? "Open Console" : "Launch Free Workspace"}</span>
                </button>
                <a
                  href="/docs"
                  className="px-5 py-2.5 rounded-md border border-white/[0.14] bg-[#0B0D14]/90 hover:bg-[#131723] hover:border-white/[0.24] text-zinc-200 hover:text-white font-medium text-[13px] transition-colors"
                >
                  Read the Docs
                </a>
              </div>
            </div>

            <HalftoneHorizonArc compact className="absolute inset-x-0 bottom-0 h-[135px] sm:h-[165px]" />
          </div>
        </section>
      </main>

      {/* =====================================================================
          9. ARCHITECTURAL FOOTER
         ===================================================================== */}
      <SparrowxFooter
        onLaunchService={handleLaunch}
        isAuthenticated={Boolean(sessionUser)}
        onSignIn={() => setOperatorModalOpen(true)}
        onSignOut={handleLandingSignOut}
        inPageAnchors={true}
      />

      {/* Operator Sign In Dialog */}
      <OperatorLoginDialog
        open={operatorModalOpen}
        onOpenChange={(nextOpen) => {
          setOperatorModalOpen(nextOpen);
          if (!nextOpen) setOauthAuthError("");
        }}
        externalAuthError={oauthAuthError}
        onSuccess={(user) => {
          setOauthAuthError("");
          setSessionUser(user);
          if (onUserAuthenticated) {
            onUserAuthenticated(user);
          } else {
            onOpenLogin();
          }
        }}
      />
    </div>
  );
}
