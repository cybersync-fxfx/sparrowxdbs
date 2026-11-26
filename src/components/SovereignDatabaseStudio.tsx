import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  authenticateAppUserFromBackend,
  fetchAppUserByEmailFromBackend,
  persistAppUserToBackend,
  persistClientTenantToBackend,
  generateSecureSparrowKey,
  type AppUser,
  type ClientTenant,
} from "@/lib/supabase";
import {
  issueSignedSessionToken,
  verifySessionToken,
  clearSessionToken,
} from "@/lib/advanced-features";
import {
  clearMasterSsoSession,
  ensureDeveloperConnection,
  fetchMasterSsoUser,
  syncMasterSsoSession,
} from "@/lib/developer-connection";
import {
  buildCreateTableSql,
  buildDeleteRowSql,
  buildDropTableSql,
  buildInsertRowSql,
  buildSchemaDdlFromTables,
  buildSchemaIntrospectionSql,
  buildSelectTableSql,
  buildUpdateRowSql,
  isSchemaMutatingSql,
  parseIntrospectedTables,
  sanitizePgObjectName,
  type LiveStudioColumn,
  type LiveStudioTable,
} from "@/lib/studio-sql";
import { OAuthSignInButtons } from "@/components/GoogleSignInButton";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { AnimatedCloudBackground } from "@/components/ui/AnimatedCloudBackground";
import { Floating3DVisual } from "@/components/ui/Floating3DVisual";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { buildMasterHref } from "@/lib/routing";
import { requestGlobalEmailVerification } from "@/components/EmailVerificationModal";
import {
  SiAstro,
  SiNextdotjs,
  SiNuxt,
  SiPostgresql,
  SiPython,
  SiReact,
  SiRedwoodjs,
  SiSolid,
  SiSvelte,
  SiTanstack,
  SiVuedotjs,
} from "react-icons/si";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Box,
  Boxes,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Cpu,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileCode,
  FileText,
  Filter,
  FolderPlus,
  GitBranch,
  Globe,
  HardDrive,
  HelpCircle,
  History,
  Home,
  Key,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  Terminal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

const DB_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROW_TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const DOT_GRID_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

export interface StudioTableMeta extends LiveStudioTable {}

// Empty by default — all Studio tables are loaded live from the user's real PostgreSQL database via information_schema.
export const INITIAL_STUDIO_TABLES: StudioTableMeta[] = [];

interface LiveDbSummaryItem {
  id: string;
  tenantId: string;
  userEmail: string;
  projectName: string;
  planId: string;
  planName: string;
  dbName: string;
  dbUser: string;
  dbHost: string;
  dbPort: number;
  sizeBytes: number;
  sizePretty: string;
  storageLimitMb: number;
  usagePct: number;
  maxConnections: number;
  activeConnections: number;
  backupCount: number;
  lastBackupAt: string | null;
  status: string;
  createdAt: string;
}

interface LiveClusterHealth {
  ok: boolean;
  engine: string;
  version: string;
  pgvectorAvailable: boolean;
  pgcryptoAvailable: boolean;
  uptimeSeconds: number;
  totalDatabases: number;
  activeConnections: number;
  clusterSizePretty: string;
  latencyMs: number;
  sslMode: string;
  originRegion: string;
  originLocation: string;
  originDatacenter: string;
  checkedAt: string;
  error?: string;
}

interface LiveDbSnapshot {
  id: string;
  dbName: string;
  tenantId: string;
  label: string;
  sizeBytes: number;
  sizePretty: string;
  tableCount: number;
  checksumSha256: string;
  retentionDays: number;
  expiresAt: string;
  createdAt: string;
}

interface LiveDbAuditLog {
  id: string;
  action: string;
  dbName: string;
  tenantId: string;
  actor: string;
  status: string;
  detail: string;
  createdAt: string;
}

interface SqlErrorDetails {
  message: string;
  pgCode?: string;
  detail?: string;
  hint?: string;
  position?: string;
}

const SQL_TEMPLATES = [
  {
    id: "verify_connection",
    label: "Verify Database & PostgreSQL Version",
    category: "Diagnostics",
    sql: `SELECT\n  current_database() AS database_name,\n  current_user AS active_role,\n  version() AS postgres_version,\n  now() AS server_time;`,
  },
  {
    id: "create_starter_table",
    label: "Create Table & Insert Sample Row",
    category: "Quickstart",
    sql: `CREATE TABLE IF NOT EXISTS public.notes (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  title TEXT NOT NULL,\n  body TEXT DEFAULT '',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nINSERT INTO public.notes (title, body)\nVALUES ('First Note', 'Stored directly in isolated PostgreSQL 16')\nRETURNING *;`,
  },
  {
    id: "list_tables_sizes",
    label: "List Public Tables & Disk Sizes",
    category: "Schema",
    sql: `SELECT\n  tablename AS table_name,\n  pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) AS total_size,\n  pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) AS data_size\nFROM pg_tables\nWHERE schemaname = 'public'\nORDER BY tablename ASC;`,
  },
  {
    id: "create_vector_table",
    label: "Create pgvector Embeddings Table",
    category: "pgvector",
    sql: `CREATE TABLE IF NOT EXISTS public.documents (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  title TEXT NOT NULL,\n  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,\n  embedding vector(3),\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nINSERT INTO public.documents (title, embedding)\nVALUES ('SparrowX Cloud DB Guide', '[0.12, 0.85, 0.44]')\nRETURNING id, title, embedding, created_at;`,
  },
  {
    id: "active_connections",
    label: "Active Connections (pg_stat_activity)",
    category: "Performance",
    sql: `SELECT\n  pid,\n  usename,\n  application_name,\n  state,\n  query_start,\n  LEFT(query, 120) AS query\nFROM pg_stat_activity\nWHERE datname = current_database()\nORDER BY query_start DESC NULLS LAST;`,
  },
  {
    id: "cache_hit_ratio",
    label: "Buffer Cache Hit Ratio",
    category: "Performance",
    sql: `SELECT\n  datname,\n  blks_hit,\n  blks_read,\n  CASE\n    WHEN (blks_hit + blks_read) = 0 THEN 100.00\n    ELSE ROUND((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)\n  END AS cache_hit_ratio_pct\nFROM pg_stat_database\nWHERE datname = current_database();`,
  },
  {
    id: "installed_extensions",
    label: "Inspect Installed Extensions",
    category: "Extensions",
    sql: `SELECT extname AS extension, extversion AS version\nFROM pg_extension\nORDER BY extname ASC;`,
  },
  {
    id: "rls_policy_template",
    label: "Enable Row-Level Security (RLS)",
    category: "Security",
    sql: `-- Ensure public.notes exists first, then enable RLS:\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS "allow_read_notes" ON public.notes;\nCREATE POLICY "allow_read_notes"\nON public.notes\nFOR SELECT\nUSING (true);`,
  },
];

function inferColumnType(col: string, pk: string, sampleVal: unknown): string {
  if (col === "embedding") return "vector(1536)";
  if (col === pk) return "text";
  if (col.endsWith("_at") || col === "timestamp" || col === "createdAt") return "timestamptz";
  if (typeof sampleVal === "number") return Number.isInteger(sampleVal) ? "int8" : "numeric";
  if (typeof sampleVal === "boolean") return "bool";
  if (Array.isArray(sampleVal) || (typeof sampleVal === "object" && sampleVal !== null)) return "jsonb";
  return "text";
}

interface FrameworkGuide {
  id:
    | "react"
    | "nextjs"
    | "tanstack"
    | "astro"
    | "vue"
    | "nuxt"
    | "sveltekit"
    | "solidjs"
    | "redwood"
    | "prisma"
    | "python";
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  snippet: (restBase: string, anonKey: string) => string;
}

const FRAMEWORK_GUIDES: [FrameworkGuide, ...FrameworkGuide[]] = [
  {
    id: "react",
    label: "React",
    badge: "Re",
    icon: SiReact,
    accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    snippet: (restBase, anonKey) =>
      `// src/lib/sparrowx-db.ts\nimport { createClient } from '@sparrowx/client'\n\nexport const db = createClient(\n  '${restBase.replace("/rest/v1", "")}',\n  '${anonKey}'\n)\n\n// Usage inside a React component:\nconst { data: users } = await db.from('app_users').select('id, email, full_name')`,
  },
  {
    id: "nextjs",
    label: "Next.js",
    badge: "Nx",
    icon: SiNextdotjs,
    accent: "text-white border-white/25 bg-white/10",
    snippet: (restBase, anonKey) =>
      `// app/api/health/route.ts (Server Route)\nimport { createClient } from '@sparrowx/client'\n\nconst client = createClient(\n  process.env.SPARROWX_URL ?? '${restBase.replace("/rest/v1", "")}',\n  process.env.SPARROWX_ANON_KEY ?? '${anonKey}'\n)\n\nexport async function GET() {\n  const { data } = await client.from('client_tenants').select('*').limit(10)\n  return Response.json({ data })\n}`,
  },
  {
    id: "tanstack",
    label: "TanStack Start",
    badge: "TS",
    icon: SiTanstack,
    accent: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    snippet: (restBase, anonKey) =>
      `// src/server/db.ts\nimport { createServerFn } from '@tanstack/react-start'\n\nexport const fetchAuditLogs = createServerFn({ method: 'GET' }).handler(async () => {\n  const res = await fetch('${restBase}/audit_logs?select=*&limit=25', {\n    headers: { apikey: '${anonKey}' },\n  })\n  return res.json()\n})`,
  },
  {
    id: "astro",
    label: "Astro",
    badge: "As",
    icon: SiAstro,
    accent: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    snippet: (restBase, anonKey) =>
      `---\n// src/pages/index.astro\nconst res = await fetch('${restBase}/protected_services?select=*', {\n  headers: { apikey: '${anonKey}' }\n});\nconst services = await res.json();\n---`,
  },
  {
    id: "vue",
    label: "Vue",
    badge: "Vu",
    icon: SiVuedotjs,
    accent: "text-lime-400 border-lime-500/30 bg-lime-500/10",
    snippet: (restBase, anonKey) =>
      `<!-- src/components/TenantList.vue -->\n<script setup lang="ts">\nimport { ref, onMounted } from 'vue'\nconst tenants = ref([])\nonMounted(async () => {\n  const r = await fetch('${restBase}/client_tenants?select=*', {\n    headers: { apikey: '${anonKey}' }\n  })\n  tenants.value = await r.json()\n})\n</script>`,
  },
  {
    id: "nuxt",
    label: "Nuxt",
    badge: "Nu",
    icon: SiNuxt,
    accent: "text-lime-300 border-lime-400/30 bg-lime-500/10",
    snippet: (restBase, anonKey) =>
      `// server/api/tenants.ts\nexport default defineEventHandler(async () => {\n  return await $fetch('${restBase}/client_tenants?select=*', {\n    headers: { apikey: '${anonKey}' }\n  })\n})`,
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    badge: "Sv",
    icon: SiSvelte,
    accent: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    snippet: (restBase, anonKey) =>
      `// src/routes/+page.server.ts\nexport async function load({ fetch }) {\n  const res = await fetch('${restBase}/ai_embeddings?select=*', {\n    headers: { apikey: '${anonKey}' }\n  });\n  return { embeddings: await res.json() };\n}`,
  },
  {
    id: "solidjs",
    label: "SolidJS",
    badge: "So",
    icon: SiSolid,
    accent: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    snippet: (restBase, anonKey) =>
      `// src/App.tsx\nimport { createResource } from 'solid-js'\nconst [rows] = createResource(() =>\n  fetch('${restBase}/app_users?select=id,email,full_name', {\n    headers: { apikey: '${anonKey}' }\n  }).then((r) => r.json())\n)`,
  },
  {
    id: "redwood",
    label: "RedwoodJS",
    badge: "Rw",
    icon: SiRedwoodjs,
    accent: "text-red-400 border-red-500/30 bg-red-500/10",
    snippet: (restBase, anonKey) =>
      `// api/src/lib/db.ts\nimport { PrismaClient } from '@prisma/client'\n// Direct PostgreSQL 16 (PgBouncer Port 6543):\n// DATABASE_URL="postgresql://spx_u_<user>:<password>@db.sparrowx.net:6543/spx_db_<user>?sslmode=require"\n// Or PostgREST: ${restBase} (apikey=${anonKey})\nexport const db = new PrismaClient()`,
  },
  {
    id: "prisma",
    label: "Prisma / Drizzle",
    badge: "ORM",
    icon: SiPostgresql,
    accent: "text-[#A3E635] border-[#A3E635]/30 bg-[#A3E635]/10",
    snippet: () =>
      `# .env (Direct PostgreSQL 16 + PgBouncer Port 6543)\nDATABASE_URL="postgresql://spx_u_<user>:<password>@db.sparrowx.net:6543/spx_db_<user>?sslmode=require"\n\n// Drizzle ORM:\nimport { drizzle } from 'drizzle-orm/node-postgres'\nexport const db = drizzle(process.env.DATABASE_URL!)`,
  },
  {
    id: "python",
    label: "Python (psycopg)",
    badge: "Py",
    icon: SiPython,
    accent: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    snippet: () =>
      `# pip install "psycopg[binary]"\nimport os, psycopg\n\nconn = psycopg.connect(\n    "postgresql://spx_u_<user>:<password>@db.sparrowx.net:6543/spx_db_<user>?sslmode=require"\n)\nprint(conn.execute("SELECT version();").fetchone())`,
  },
];

interface PricingTier {
  id: "Free" | "Pro" | "Team" | "Enterprise";
  name: string;
  badge?: string;
  tagline: string;
  cta: string;
  price: string;
  unit?: string;
  subPrice?: string;
  subHeader: string;
  features: Array<{ title: string; detail?: string }>;
  highlighted?: boolean;
}

const PRICING_PLANS: PricingTier[] = [
  {
    id: "Free",
    name: "FREE",
    tagline: "Perfect for passion projects & simple websites.",
    cta: "Start for Free",
    price: "$0",
    unit: "/ month",
    subHeader: "Get started with:",
    features: [
      { title: "Unlimited API requests" },
      { title: "50,000 monthly active users" },
      { title: "500 MB NVMe database size", detail: "Shared CPU • 500 MB RAM" },
      { title: "5 GB zero-tax egress" },
      { title: "5 GB cached egress" },
      { title: "Built-in Auth, pgvector & Studio" },
      { title: "99.5% Best-Effort Uptime" },
    ],
  },
  {
    id: "Pro",
    name: "PRO",
    badge: "Most Popular",
    tagline: "For production applications with the power to scale.",
    cta: "Get Started",
    price: "$9",
    unit: "/ month",
    subPrice: "First project included. Zero surprise egress bills.",
    subHeader: "Everything in the Free Plan, plus:",
    highlighted: true,
    features: [
      { title: "100,000 monthly active users", detail: "then $0.0025 per MAU" },
      { title: "8 GB NVMe disk size per project", detail: "then $0.10 per GB" },
      { title: "250 GB zero-tax egress", detail: "Unlimited cached reads" },
      { title: "Daily automated backups (14-day retention)" },
      { title: "Dedicated PgBouncer Port 6543 pooler" },
      { title: "99.9% Uptime SLA & founder support" },
    ],
  },
  {
    id: "Team",
    name: "TEAM",
    tagline: "Add features such as SSO, backup controls, and compliance certs.",
    cta: "Get Started",
    price: "$49",
    unit: "/ month",
    subPrice: "First project included. Additional environments $9/mo.",
    subHeader: "Everything in the Pro Plan, plus:",
    features: [
      { title: "SOC 2 & ISO 27001 readiness reports" },
      { title: "Project-scoped and read-only role access" },
      { title: "Point-in-time recovery (PITR)" },
      { title: "SSO & custom SAML providers" },
      { title: "99.95% Uptime SLA & priority engineering support" },
    ],
  },
  {
    id: "Enterprise",
    name: "ENTERPRISE",
    tagline: "For large-scale sovereign applications running bare-metal workloads.",
    cta: "Contact us",
    price: "Custom",
    subHeader: "Dedicated Sovereign Cloud:",
    features: [
      { title: "Dedicated bare-metal NVMe PostgreSQL clusters" },
      { title: "Custom uptime SLAs (99.99%)" },
      { title: "Private VPC peering & custom firewall rules" },
      { title: "24×7×365 direct engineer escalation" },
      { title: "Private Discord / Slack channel" },
      { title: "Custom Security Questionnaires" },
    ],
  },
];

// Live extensions, roles, indexes, policies, triggers & functions are queried directly from PostgreSQL catalogs via /api/db/query.

interface NativeDialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

function NativeDialog({
  open,
  onClose,
  titleId,
  maxWidthClass = "max-w-lg",
  children,
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef<boolean>(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open && typeof el.showModal === "function") {
        el.showModal();
      }
    } else if (el.open && typeof el.close === "function") {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>, el: HTMLDialogElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        const el = dialogRef.current;
        pressedOutsideRef.current = el ? isOutsideDialog(e, el) : false;
      }}
      onPointerUp={(e) => {
        const el = dialogRef.current;
        if (pressedOutsideRef.current && el && isOutsideDialog(e, el)) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      className={`m-auto w-[calc(100%-2rem)] ${maxWidthClass} rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-0 text-zinc-100 shadow-2xl overscroll-contain backdrop:bg-black/80 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain`}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      {children}
    </dialog>
  );
}

interface TopologyClusterPanelProps {
  region: string;
  envLabel: string;
  pingMs: number | null;
  tableCount?: number;
  totalRows?: number;
  host?: string;
}

function TopologyClusterPanel({
  region,
  envLabel,
  pingMs,
  tableCount = 0,
  totalRows = 0,
  host = "db.sparrowx.net",
}: TopologyClusterPanelProps) {
  const [topologyMode, setTopologyMode] = useState<"topology" | "metrics">("topology");
  const isLive = pingMs !== null;

  return (
    <div className="space-y-4">
      <div
        className="relative rounded-xl border border-[#2E2E2E] bg-[#05060A] p-6 min-h-[210px] flex items-center justify-center overflow-hidden"
        style={DOT_GRID_STYLE}
      >
        <div className="absolute right-3 top-3 flex items-center rounded-md border border-[#2E2E2E] bg-[#0C0F17] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTopologyMode("topology")}
            title="Cluster Node Topology"
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              topologyMode === "topology"
                ? "bg-[#262626] text-white"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Network className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTopologyMode("metrics")}
            title="Live Pooler Telemetry"
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              topologyMode === "metrics"
                ? "bg-[#262626] text-white"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Activity className="size-3.5" />
          </button>
        </div>

        <div className="w-full max-w-md rounded-lg border border-[#2E2E2E] bg-[#0C0F17]/95 backdrop-blur-md p-4 shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-md bg-[#A3E635]/15 border border-[#A3E635]/40 grid place-items-center text-[#A3E635] shrink-0">
                <Database className="size-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Primary Database</div>
                <div className="text-[11px] font-mono text-zinc-400">{host}</div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {region} • PostgREST • {envLabel}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-lime-500/10 border border-lime-500/30 text-[10px] font-mono text-[#A3E635]">
              <span className="size-1.5 rounded-full bg-[#A3E635] animate-pulse" />
              {isLive ? "LIVE" : "PROBING"}
            </span>
          </div>

          {/* Database Hosting Location & Node Info */}
          {(() => {
            const HOST_LOCATIONS: Record<string, { city: string; country: string; node: string }> = {
              "ap-southeast-2": {
                city: "Sydney",
                country: "Australia (Asia-Pacific)",
                node: "SparrowX SYD-1 · OVH Australia Origin Node",
              },
              "ap-south-1": {
                city: "Mumbai / Chennai",
                country: "India (South Asia)",
                node: "SparrowX IN-1 · Tier-IV Sovereign Node",
              },
              "eu-central-1": {
                city: "Frankfurt",
                country: "Germany (Central Europe)",
                node: "SparrowX EU-1 · Tier-IV Sovereign Node",
              },
            };
            const loc = HOST_LOCATIONS[region] ?? {
              city: region,
              country: "SparrowX Cloud",
              node: "SparrowX Sovereign PostgreSQL Node",
            };
            return (
              <div className="rounded-md border border-[#242424] bg-[#05060A]/90 px-3 py-2 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-zinc-500">
                    <Globe className="size-3 text-[#A3E635]" aria-hidden="true" />
                    <span>HOSTED IN</span>
                  </span>
                  <span className="text-zinc-100 font-semibold text-right">
                    {loc.city}, {loc.country}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-zinc-500">
                    <Server className="size-3 text-sky-400" aria-hidden="true" />
                    <span>DATACENTER</span>
                  </span>
                  <span className="text-zinc-300 text-right truncate">
                    {loc.node}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="border-t border-[#262626] pt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-300">
            <span>{tableCount} table(s)</span>
            <span className="text-zinc-600">•</span>
            <span>{totalRows.toLocaleString()} row(s)</span>
            <span className="text-zinc-600">•</span>
            <span>{pingMs !== null ? `RTT ${pingMs}ms` : "Checking RTT"}</span>
          </div>
        </div>
      </div>

      {/* Measured API Telemetry & Honest Host Metric Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              <span className="size-1.5 rounded-full bg-[#A3E635]" />
              <span>LIVE POSTGREST PROBE</span>
            </div>
            <span className="text-xs font-mono text-[#A3E635]">
              {pingMs !== null ? `${pingMs} ms` : "Checking..."}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
            <div className="rounded-lg border border-[#242424] bg-[#05060A] p-2.5">
              <div className="text-[10px] text-zinc-500">TABLES</div>
              <div className="text-sm font-semibold text-white mt-0.5">{tableCount}</div>
            </div>
            <div className="rounded-lg border border-[#242424] bg-[#05060A] p-2.5">
              <div className="text-[10px] text-zinc-500">LIVE ROWS</div>
              <div className="text-sm font-semibold text-white mt-0.5">{totalRows.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-[#242424] bg-[#05060A] p-2.5">
              <div className="text-[10px] text-zinc-500">REST STATUS</div>
              <div className="text-sm font-semibold text-white mt-0.5">{isLive ? "OK" : "—"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              <span>HOST OS METRICS</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Not exposed via REST</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Host CPU, RAM, Disk, and WAL metrics are not exposed over the public PostgREST API.
            Only live database tables, row counts, and measured REST latency are displayed here.
          </p>
        </div>
      </div>
    </div>
  );
}

interface SovereignDatabaseStudioProps {
  onClose?: () => void;
  isStandaloneDomain?: boolean;
  currentUser?: AppUser | null;
  onUserAuthenticated?: (user: AppUser) => void;
  onOpenClientArea?: () => void;
}

export function SovereignDatabaseStudio({
  onClose,
  isStandaloneDomain = false,
  currentUser,
  onUserAuthenticated,
  onOpenClientArea,
}: SovereignDatabaseStudioProps) {
  const connectDialogTitleId = useId();
  const rowDialogTitleId = useId();
  const tableDialogTitleId = useId();
  const bucketDialogTitleId = useId();

  // Resolve effective user safely for SSR; mount effect below hydrates browser token
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => currentUser ?? null);

  // Environment state: "production" | "staging" | "development"
  const [activeEnv, setActiveEnv] = useState<"production" | "staging" | "development">("production");

  // Navigation mode: "landing" (public) or "studio" (authenticated workspace)
  const [viewMode, setViewMode] = useState<"landing" | "studio">(() =>
    currentUser ? "studio" : "landing",
  );

  useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser);
      setViewMode("studio");
    } else {
      const verified = verifySessionToken();
      if (verified) {
        setSessionUser({
          id: verified.sub,
          email: verified.email,
          fullName: verified.fullName || verified.email.split("@")[0] || "Developer",
          password: "",
          admin: verified.role === "admin" ? "yes" : "no",
          tenantId: verified.tenantId,
        });
        setViewMode("studio");
      } else {
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
          setViewMode("studio");
          if (onUserAuthenticated) onUserAuthenticated(hydrated);
        });
        return () => {
          active = false;
        };
      }
    }
    return undefined;
  }, [currentUser]);

  // Auth Mode on Landing
  const [landingAuthMode, setLandingAuthMode] = useState<"signin" | "register">("signin");
  const [landingRegisterOrg, setLandingRegisterOrg] = useState<string>("");
  const [landingRegisterName, setLandingRegisterName] = useState<string>("");
  const [landingRegisterEmail, setLandingRegisterEmail] = useState<string>("");
  const [landingRegisterPassword, setLandingRegisterPassword] = useState<string>("");
  const [landingRegisterRegion, setLandingRegisterRegion] = useState<"apac-sgp" | "eu-fra">("apac-sgp");
  const [landingSqlCustomResult, setLandingSqlCustomResult] = useState<{
    columns: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [landingMobileMenuOpen, setLandingMobileMenuOpen] = useState<boolean>(false);

  // New Supabase-style Landing interactive states
  const [docSetupTab, setDocSetupTab] = useState<"agent" | "cli">("agent");
  const [selectedFramework, setSelectedFramework] = useState<FrameworkGuide["id"]>("react");
  const [selectedPricingPlan, setSelectedPricingPlan] = useState<PricingTier["id"]>("Pro");

  // Isolated Project Identification based on sessionUser and activeEnv
  const tenantSlug = useMemo(() => {
    if (!sessionUser) return "sparrowx";
    return (sessionUser.tenantId || sessionUser.email.split("@")[0] || "sparrowx")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
  }, [sessionUser]);

  const defaultStudioKey = `spx_live_${tenantSlug}_${(sessionUser?.id || "usr").slice(-6)}`;
  const [customAnonKey, setCustomAnonKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(`spx_studio_key_${tenantSlug}`) || defaultStudioKey;
      } catch {
        // Ignore storage read errors
      }
    }
    return defaultStudioKey;
  });

  useEffect(() => {
    const nextFallback = `spx_live_${tenantSlug}_${(sessionUser?.id || "usr").slice(-6)}`;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`spx_studio_key_${tenantSlug}`);
        setCustomAnonKey(stored || nextFallback);
        return;
      } catch {
        // Ignore storage read errors
      }
    }
    setCustomAnonKey(nextFallback);
  }, [tenantSlug, sessionUser?.id]);

  // Project General Settings state
  const [projectDisplayName, setProjectDisplayName] = useState<string>("sparrowx");
  const [projectRegion, setProjectRegion] = useState<"ap-southeast-2" | "ap-south-1" | "eu-central-1">("ap-southeast-2");
  const [projectRefId] = useState<string>("spxdgufjgfyxflgvboq");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedName = localStorage.getItem(`spx_project_name_${tenantSlug}`);
        const savedRegion = localStorage.getItem(`spx_project_region_${tenantSlug}`);
        if (savedName) setProjectDisplayName(savedName);
        else setProjectDisplayName(tenantSlug || "sparrowx");
        if (savedRegion === "ap-southeast-2" || savedRegion === "ap-south-1" || savedRegion === "eu-central-1") {
          setProjectRegion(savedRegion);
        }
      } catch {
        setProjectDisplayName(tenantSlug || "sparrowx");
      }
    }
  }, [tenantSlug]);

  // Primary & secondary studio navigation states
  type StudioSection =
    | "overview"
    | "tables"
    | "sql"
    | "database"
    | "auth"
    | "sandbox"
    | "pooler"
    | "backups"
    | "settings"
    | "api";

  const isPlatformAdmin = sessionUser?.admin === "yes";
  const [studioTables, setStudioTables] = useState<StudioTableMeta[]>([]);
  const [activeSection, setActiveSection] = useState<StudioSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableSidebarFilter, setTableSidebarFilter] = useState<string>("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [schemaLoading, setSchemaLoading] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Command search (Ctrl+K) & Connect modal
  const [studioSearchQuery, setStudioSearchQuery] = useState<string>("");
  const studioSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [connectTab, setConnectTab] = useState<"uri" | "pooler" | "nextjs" | "prisma" | "env">("uri");

  // Database sub-tabs (Schema Visualizer, Tables, Functions, Triggers, Extensions, Indexes, Policies, Roles, Backups)
  const [databaseSubTab, setDatabaseSubTab] = useState<
    "visualizer" | "tables" | "functions" | "triggers" | "extensions" | "indexes" | "policies" | "roles" | "backups"
  >("visualizer");
  const [schemaFindTable, setSchemaFindTable] = useState<string>("");

  // Authentication sub-tabs & user filter
  const [authSubTab, setAuthSubTab] = useState<
    "users" | "account" | "sessions" | "audit"
  >("account");
  const [authUserSearch, setAuthUserSearch] = useState<string>("");

  // Settings sub-tabs
  const [settingsSubTab, setSettingsSubTab] = useState<
    "general" | "infrastructure" | "api_keys" | "audit" | "billing"
  >("general");
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [publishableKeys, setPublishableKeys] = useState<
    Array<{ id: string; name: string; description: string; value: string }>
  >([
    {
      id: "default-pub",
      name: "default",
      description: "Publishable key for client apps",
      value: customAnonKey,
    },
  ]);

  // Ctrl+K shortcut for Studio top search bar
  useEffect(() => {
    if (viewMode !== "studio") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        studioSearchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode]);

  // Modal states for Insert / Edit Row & Create Table
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [savingRow, setSavingRow] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [showCreateTableModal, setShowCreateTableModal] = useState<boolean>(false);
  const [creatingTable, setCreatingTable] = useState<boolean>(false);
  const [newTableName, setNewTableName] = useState<string>("");
  const [newTableDescription, setNewTableDescription] = useState<string>("");
  const [newTableEnableRls, setNewTableEnableRls] = useState<boolean>(false);
  const [newTableColumns, setNewTableColumns] = useState<
    Array<{ name: string; type: string; isPrimary: boolean; isNullable: boolean; defaultValue: string }>
  >([
    { name: "id", type: "UUID", isPrimary: true, isNullable: false, defaultValue: "gen_random_uuid()" },
    { name: "created_at", type: "TIMESTAMPTZ", isPrimary: false, isNullable: false, defaultValue: "now()" },
    { name: "title", type: "TEXT", isPrimary: false, isNullable: true, defaultValue: "''" },
  ]);

  // Unauthenticated Product Landing Sandbox States
  const [landingTab, setLandingTab] = useState<"schema" | "sql" | "vector">("sql");
  const [landingSqlQuery, setLandingSqlQuery] = useState<string>(
    "SELECT id, email, full_name, role FROM app_users WHERE status = 'active' LIMIT 5;"
  );
  const [landingRunning, setLandingRunning] = useState<boolean>(false);
  const [landingLatency, setLandingLatency] = useState<string>("0.8ms");
  const [landingAuthEmail, setLandingAuthEmail] = useState<string>("");
  const [landingAuthPassword, setLandingAuthPassword] = useState<string>("");
  const [landingAuthLoading, setLandingAuthLoading] = useState<boolean>(false);
  const [landingAuthError, setLandingAuthError] = useState<string>("");

  // Authenticated Account, Real Provisioned PostgreSQL Databases, Health, Snapshots & Audit States
  const [accountDisplayName, setAccountDisplayName] = useState<string>("");
  const [accountNewPassword, setAccountNewPassword] = useState<string>("");
  const [savingAccount, setSavingAccount] = useState<boolean>(false);
  const [newUserFullName, setNewUserFullName] = useState<string>("");
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<"no" | "yes">("no");
  const [newUserTenantId, setNewUserTenantId] = useState<string>("");
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);
  const [provisioningDb, setProvisioningDb] = useState<boolean>(false);
  const [rotatingPassword, setRotatingPassword] = useState<boolean>(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<boolean>(false);
  const [selectedDbPlanId, setSelectedDbPlanId] = useState<string>("db-free");
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);
  const [snapshotLabel, setSnapshotLabel] = useState<string>("Manual Snapshot");
  const [clusterHealth, setClusterHealth] = useState<LiveClusterHealth | null>(null);
  const [provisionedDbsList, setProvisionedDbsList] = useState<LiveDbSummaryItem[]>([]);
  const [dbSnapshots, setDbSnapshots] = useState<LiveDbSnapshot[]>([]);
  const [dbAuditLogs, setDbAuditLogs] = useState<LiveDbAuditLog[]>([]);
  const [catalogRows, setCatalogRows] = useState<Array<Record<string, unknown>>>([]);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [liveDbStats, setLiveDbStats] = useState<{
    cacheHitPct: string | null;
    activeQueries: Array<Record<string, unknown>>;
    currentUser: string | null;
  }>({ cacheHitPct: null, activeQueries: [], currentUser: null });
  const [provisionedDb, setProvisionedDb] = useState<{
    dbName: string;
    dbUser: string;
    dbPassword: string;
    dbHost: string;
    dbPort: number;
    connectionString: string;
    planId?: string;
    planName?: string;
    storageLimitMb?: number;
    maxConnections?: number;
    sizePretty?: string;
    usagePct?: number;
    activeConnections?: number;
    status?: string;
  } | null>(null);

  const activeDbSummary = useMemo(() => {
    if (!provisionedDb) return null;
    return provisionedDbsList.find((d) => d.dbName === provisionedDb.dbName) ?? null;
  }, [provisionedDb, provisionedDbsList]);

  const activeProject = useMemo(() => {
    const dbName = provisionedDb?.dbName || "unprovisioned";
    const dbUser = provisionedDb?.dbUser || `spx_u_${tenantSlug.replace(/-/g, "_")}`;
    const host = provisionedDb?.dbHost || "db.sparrowx.net";
    const port = provisionedDb?.dbPort || 5432;
    const realConn =
      provisionedDb?.connectionString ||
      `postgresql://${dbUser}:[ROTATE-TO-REVEAL-PASSWORD]@${host}:${port}/${dbName}?sslmode=prefer`;
    const pooledUri = `postgresql://${dbUser}:${provisionedDb?.dbPassword ? encodeURIComponent(provisionedDb.dbPassword) : "[ROTATE-TO-REVEAL-PASSWORD]"}@${host}:6543/${dbName}?pgbouncer=true&sslmode=prefer`;

    return {
      id: activeDbSummary?.id || projectRefId,
      name: projectDisplayName || activeDbSummary?.projectName || "sparrowx",
      organization: sessionUser?.tenantId || "sparrowx",
      environment: (provisionedDb?.status || activeDbSummary?.status || "ACTIVE").toUpperCase(),
      cfg: {
        port,
        poolerPort: 6543,
        poolSize: provisionedDb?.maxConnections || activeDbSummary?.maxConnections || 10,
        label: provisionedDb ? provisionedDb.planName || activeDbSummary?.planName || "ISOLATED PG" : "NOT PROVISIONED",
        branch: provisionedDb ? provisionedDb.dbName : "unprovisioned",
      },
      dbName,
      dbUser,
      host,
      port,
      poolerPort: 6543,
      maxPoolSize: provisionedDb?.maxConnections || activeDbSummary?.maxConnections || 10,
      connectionUri: realConn,
      directUri: realConn,
      pooledUri,
      anonKey: customAnonKey,
      serviceRoleKey: provisionedDb?.dbPassword || "",
      restBaseUrl: "https://db.sparrowx.net/rest/v1",
    };
  }, [sessionUser, tenantSlug, provisionedDb, activeDbSummary, customAnonKey, projectDisplayName, projectRefId]);

  // Execute real PostgreSQL SQL against the user's active isolated database via /api/db/query
  const runTenantSql = useCallback(
    async (
      sql: string,
      overrideDbName?: string,
    ): Promise<
      | {
          ok: true;
          command: string;
          rowCount: number;
          fields: string[];
          rows: Array<Record<string, unknown>>;
          truncated: boolean;
          durationMs: number;
          statementCount?: number;
        }
      | {
          ok: false;
          error: string;
          pgCode?: string;
          detail?: string;
          hint?: string;
          position?: string;
        }
    > => {
      const targetDb = overrideDbName || provisionedDb?.dbName;
      if (!targetDb) {
        return {
          ok: false,
          error: "No PostgreSQL database is provisioned yet for this account. Click 'Provision Database' first.",
        };
      }
      try {
        const res = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dbName: targetDb,
            sql,
            email: sessionUser?.email,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          command?: string;
          rowCount?: number;
          fields?: string[];
          rows?: Array<Record<string, unknown>>;
          truncated?: boolean;
          durationMs?: number;
          statementCount?: number;
          error?: string;
          pgCode?: string;
          detail?: string;
          hint?: string;
          position?: string;
        };
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || `PostgreSQL query failed (HTTP ${res.status})`,
            ...(data.pgCode ? { pgCode: data.pgCode } : {}),
            ...(data.detail ? { detail: data.detail } : {}),
            ...(data.hint ? { hint: data.hint } : {}),
            ...(data.position ? { position: data.position } : {}),
          };
        }
        return {
          ok: true,
          command: data.command || "QUERY",
          rowCount: data.rowCount ?? (data.rows?.length ?? 0),
          fields: Array.isArray(data.fields) ? data.fields : [],
          rows: Array.isArray(data.rows) ? data.rows : [],
          truncated: Boolean(data.truncated),
          durationMs: data.durationMs ?? 0,
          ...(data.statementCount !== undefined ? { statementCount: data.statementCount } : {}),
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Network error reaching /api/db/query",
        };
      }
    },
    [provisionedDb?.dbName, sessionUser?.email],
  );

  const handleRotateStudioApiKey = () => {
    const freshKey = generateSecureSparrowKey("spx_publishable");
    setCustomAnonKey(freshKey);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`spx_studio_key_${tenantSlug}`, freshKey);
      } catch {
        // Ignore storage write errors
      }
    }
    setPublishableKeys((prev) => [
      { id: `key-${Date.now()}`, name: `key-${prev.length + 1}`, description: "Rotated key", value: freshKey },
      ...prev,
    ]);
    setStatusBanner({
      type: "success",
      message: "Generated new workspace display key.",
    });
  };

  const handleLockWorkspace = () => {
    clearSessionToken();
    void clearMasterSsoSession();
    setSessionUser(null);
    setViewMode("landing");
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const provisionIsolatedPgDatabase = async (payload: {
    tenantId: string;
    userId: string;
    email: string;
    projectName?: string;
    planId?: string;
  }) => {
    setProvisioningDb(true);
    try {
      const res = await fetch("/api/db/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...payload, planId: payload.planId || selectedDbPlanId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        database?: {
          dbName: string;
          dbUser: string;
          dbPassword: string;
          dbHost: string;
          dbPort: number;
          connectionString: string;
          planId?: string;
          planName?: string;
          storageLimitMb?: number;
          maxConnections?: number;
        };
      };
      if (!res.ok || !data.ok || !data.database) {
        setStatusBanner({
          type: "error",
          message: data.error || `PostgreSQL provisioning failed (HTTP ${res.status}).`,
        });
        return null;
      }
      setProvisionedDb({ ...data.database, status: "Active" });
      try {
        localStorage.setItem(
          `sparrowx_provisioned_db_${payload.tenantId}`,
          JSON.stringify(data.database),
        );
      } catch {
        // Ignore storage quota issues
      }
      return data.database;
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to reach PostgreSQL provisioner (/api/db/provision).",
      });
      return null;
    } finally {
      setProvisioningDb(false);
    }
  };

  // Load real /api/db/health + /api/db/summary from PostgreSQL cluster
  const loadRealDatabasesAndHealth = useCallback(async () => {
    if (!sessionUser) return;
    const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
    const cleanEmail = sessionUser.email.trim().toLowerCase();

    try {
      const healthRes = await fetch("/api/db/health", { credentials: "include", cache: "no-store" });
      const healthData = (await healthRes.json().catch(() => null)) as LiveClusterHealth | null;
      if (healthData) {
        setClusterHealth(healthData);
        setPingStatus({
          postgrest: healthData.ok ? healthData.latencyMs : null,
          pgbouncer: healthData.ok ? healthData.latencyMs : null,
          postgres: healthData.ok ? healthData.latencyMs : null,
          testing: false,
        });
      }
    } catch {
      setPingStatus((prev) => ({ ...prev, postgres: null, postgrest: null, testing: false }));
    }

    try {
      const summaryUrl = `/api/db/summary?email=${encodeURIComponent(cleanEmail)}&tenantId=${encodeURIComponent(tid)}`;
      const sumRes = await fetch(summaryUrl, { credentials: "include", cache: "no-store" });
      if (sumRes.ok) {
        const sumData = (await sumRes.json()) as { ok?: boolean; databases?: LiveDbSummaryItem[] };
        if (sumData.ok && Array.isArray(sumData.databases)) {
          setProvisionedDbsList(sumData.databases);
          const matched =
            sumData.databases.find(
              (d) => d.userEmail.toLowerCase() === cleanEmail || d.tenantId === tid,
            ) || sumData.databases[0];
          if (matched) {
            setSelectedDbPlanId(matched.planId || "db-free");
            setProvisionedDb((prev) => ({
              dbName: matched.dbName,
              dbUser: matched.dbUser,
              dbPassword: prev?.dbName === matched.dbName ? prev.dbPassword : "",
              dbHost: matched.dbHost,
              dbPort: matched.dbPort,
              connectionString:
                prev?.dbName === matched.dbName && prev.connectionString
                  ? prev.connectionString
                  : `postgresql://${matched.dbUser}:[ROTATE-TO-REVEAL]@${matched.dbHost}:${matched.dbPort}/${matched.dbName}?sslmode=prefer`,
              planId: matched.planId,
              planName: matched.planName,
              storageLimitMb: matched.storageLimitMb,
              maxConnections: matched.maxConnections,
              sizePretty: matched.sizePretty,
              usagePct: matched.usagePct,
              activeConnections: matched.activeConnections,
              status: matched.status,
            }));
            return;
          }
        }
      }
    } catch {
      // Fall through to ensureDeveloperConnection
    }

    const connected = await ensureDeveloperConnection({
      id: sessionUser.id,
      email: sessionUser.email,
      fullName: sessionUser.fullName,
      tenantId: sessionUser.tenantId,
    });
    if (connected) {
      setProvisionedDb((prev) => ({
        dbName: connected.dbName,
        dbUser: connected.dbUser,
        dbPassword: prev?.dbPassword || connected.dbPassword || "",
        dbHost: connected.dbHost,
        dbPort: connected.dbPort,
        connectionString:
          prev?.connectionString ||
          connected.connectionString ||
          `postgresql://${connected.dbUser}:[ROTATE-TO-REVEAL]@${connected.dbHost}:${connected.dbPort}/${connected.dbName}?sslmode=prefer`,
        ...(connected.planId !== undefined ? { planId: connected.planId } : {}),
        ...(connected.planName !== undefined ? { planName: connected.planName } : {}),
        ...(connected.storageLimitMb !== undefined ? { storageLimitMb: connected.storageLimitMb } : {}),
        ...(connected.maxConnections !== undefined ? { maxConnections: connected.maxConnections } : {}),
        ...(connected.status !== undefined ? { status: connected.status } : {}),
      }));
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    setAccountDisplayName(sessionUser.fullName || "");
    const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
    setNewUserTenantId((prev) => prev || tid);
    try {
      const cached = localStorage.getItem(`sparrowx_provisioned_db_${tid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.dbName === "string" && parsed.dbName.startsWith("spx_db_")) {
          setProvisionedDb(parsed);
        }
      }
    } catch {
      // Ignore malformed cache
    }
    void loadRealDatabasesAndHealth();
  }, [sessionUser, loadRealDatabasesAndHealth]);

  // Real lifecycle helpers (backups, audit logs, password rotation, suspend/resume, plan upgrade, delete)
  const loadBackupsAndAudit = useCallback(async () => {
    if (!provisionedDb?.dbName || !sessionUser) return;
    try {
      const [bRes, aRes] = await Promise.all([
        fetch("/api/db/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "list_backups",
            dbName: provisionedDb.dbName,
            email: sessionUser.email,
          }),
        }),
        fetch("/api/db/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "list_audit",
            dbName: provisionedDb.dbName,
            email: sessionUser.email,
          }),
        }),
      ]);
      if (bRes.ok) {
        const bData = (await bRes.json()) as { ok?: boolean; snapshots?: LiveDbSnapshot[] };
        if (bData.ok && Array.isArray(bData.snapshots)) setDbSnapshots(bData.snapshots);
      }
      if (aRes.ok) {
        const aData = (await aRes.json()) as { ok?: boolean; logs?: LiveDbAuditLog[] };
        if (aData.ok && Array.isArray(aData.logs)) setDbAuditLogs(aData.logs);
      }
    } catch {
      // Leave current lists unchanged if offline
    }
  }, [provisionedDb?.dbName, sessionUser]);

  const handleRotateDbPassword = async () => {
    if (!provisionedDb?.dbName || !sessionUser) return;
    setRotatingPassword(true);
    try {
      const res = await fetch("/api/db/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "rotate_password",
          dbName: provisionedDb.dbName,
          email: sessionUser.email,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        dbName?: string;
        dbUser?: string;
        dbPassword?: string;
        connectionString?: string;
      };
      if (!res.ok || !data.ok || !data.dbPassword) {
        setStatusBanner({
          type: "error",
          message: data.error || "Password rotation failed.",
        });
        return;
      }
      setProvisionedDb((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          dbPassword: data.dbPassword!,
          connectionString: data.connectionString || prev.connectionString,
        };
        try {
          const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
          localStorage.setItem(`sparrowx_provisioned_db_${tid}`, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      setStatusBanner({
        type: "success",
        message: `Rotated PostgreSQL password for role ${data.dbUser}. New connection URI is active immediately.`,
      });
      void loadBackupsAndAudit();
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to rotate password.",
      });
    } finally {
      setRotatingPassword(false);
    }
  };

  const handleCreateSnapshot = async (customLabel?: string) => {
    if (!provisionedDb?.dbName || !sessionUser) {
      setStatusBanner({ type: "error", message: "Provision a PostgreSQL database before creating snapshots." });
      return;
    }
    setCreatingSnapshot(true);
    try {
      const res = await fetch("/api/db/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "backup",
          dbName: provisionedDb.dbName,
          email: sessionUser.email,
          label: (customLabel || snapshotLabel || "Manual Snapshot").trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        snapshot?: LiveDbSnapshot;
      };
      if (!res.ok || !data.ok || !data.snapshot) {
        setStatusBanner({ type: "error", message: data.error || "Snapshot creation failed." });
        return;
      }
      setStatusBanner({
        type: "success",
        message: `Snapshot ${data.snapshot.id} recorded (${data.snapshot.sizePretty}, ${data.snapshot.tableCount} tables, SHA-256 verified).`,
      });
      await loadBackupsAndAudit();
      await loadRealDatabasesAndHealth();
    } catch {
      setStatusBanner({
        type: "error",
        message: "Unable to reach snapshot lifecycle API (/api/db/lifecycle).",
      });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDbLifecycleAction = async (
    action: "suspend" | "resume" | "upgrade_plan" | "deprovision",
    planId?: string,
  ) => {
    if (!provisionedDb?.dbName || !sessionUser) return;
    if (
      action === "deprovision" &&
      !confirm(`Permanently DROP PostgreSQL database "${provisionedDb.dbName}" and role "${provisionedDb.dbUser}"? This cannot be undone.`)
    ) {
      return;
    }
    setLifecycleBusy(true);
    try {
      const res = await fetch("/api/db/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          dbName: provisionedDb.dbName,
          email: sessionUser.email,
          ...(planId ? { planId } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatusBanner({ type: "error", message: data.error || `Lifecycle action "${action}" failed.` });
        return;
      }
      if (action === "deprovision") {
        setProvisionedDb(null);
        setStudioTables([]);
        setSelectedTable("");
        setRows([]);
        setDbSnapshots([]);
        try {
          const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
          localStorage.removeItem(`sparrowx_provisioned_db_${tid}`);
        } catch {
          // ignore
        }
        setStatusBanner({ type: "success", message: `Database ${provisionedDb.dbName} permanently dropped.` });
      } else {
        setStatusBanner({
          type: "success",
          message:
            action === "upgrade_plan"
              ? `Updated database plan & PostgreSQL resource limits to ${planId}.`
              : `Database ${provisionedDb.dbName} is now ${action === "suspend" ? "Suspended" : "Active"}.`,
        });
      }
      await loadRealDatabasesAndHealth();
      await loadBackupsAndAudit();
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : `Lifecycle action "${action}" failed.`,
      });
    } finally {
      setLifecycleBusy(false);
    }
  };

  // SQL Studio state (Pure Manual Supabase-style SQL Editor — Zero AI Copilot)
  const [activeSql, setActiveSql] = useState<string>(SQL_TEMPLATES[0]?.sql ?? "SELECT version();");
  const [sqlQueryFilter, setSqlQueryFilter] = useState<string>("");
  const [sqlResults, setSqlResults] = useState<Array<Record<string, unknown>> | null>(null);
  const [sqlResultFields, setSqlResultFields] = useState<string[]>([]);
  const [sqlError, setSqlError] = useState<SqlErrorDetails | null>(null);
  const [sqlResultViewMode, setSqlResultViewMode] = useState<"grid" | "chart" | "json">("grid");
  const [sqlExecutionStats, setSqlExecutionStats] = useState<{
    timeMs: number;
    rowCount: number;
    command: string;
    truncated?: boolean;
    statementCount?: number;
  } | null>(null);
  const [executingSql, setExecutingSql] = useState<boolean>(false);
  const [savedSqlQueries, setSavedSqlQueries] = useState<Array<{ id: string; name: string; sql: string }>>([]);
  const [sqlHistory, setSqlHistory] = useState<Array<{ id: string; sql: string; time: string; ok: boolean }>>([]);

  // Persist private saved queries per provisioned DB
  useEffect(() => {
    if (typeof window === "undefined" || !provisionedDb?.dbName) return;
    try {
      const raw = localStorage.getItem(`spx_saved_sql_${provisionedDb.dbName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedSqlQueries(parsed);
      }
    } catch {
      // ignore
    }
  }, [provisionedDb?.dbName]);

  // Interactive Connection & Live Query Test state
  const [sandboxSelectedTable, setSandboxSelectedTable] = useState<string>("");
  const [sandboxResponse, setSandboxResponse] = useState<string | null>(null);
  const [sandboxLatency, setSandboxLatency] = useState<number | null>(null);
  const [sandboxStatusOk, setSandboxStatusOk] = useState<boolean | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxTab, setSandboxTab] = useState<"node" | "psql" | "python" | "prisma">("node");

  // Diagnostics Ping State (starts null until real /api/db/health probe succeeds)
  const [pingStatus, setPingStatus] = useState<{
    postgrest: number | null;
    pgbouncer: number | null;
    postgres: number | null;
    testing: boolean;
  }>({
    postgrest: null,
    pgbouncer: null,
    postgres: null,
    testing: false,
  });

  // Calculate live DDL preview for New Table modal
  const generatedTableDdl = useMemo(() => {
    try {
      return buildCreateTableSql(newTableName || "new_table", newTableColumns, newTableEnableRls);
    } catch (err) {
      return `-- ${err instanceof Error ? err.message : "Invalid table definition"}`;
    }
  }, [newTableName, newTableColumns, newTableEnableRls]);

  // Fetch rows for a specific table from REAL PostgreSQL via /api/db/query
  const fetchTableRows = useCallback(
    async (tableName: string, overrideDbName?: string) => {
      const targetDb = overrideDbName || provisionedDb?.dbName;
      if (!tableName || !tableName.trim() || !targetDb) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await runTenantSql(buildSelectTableSql(tableName, 100), targetDb);
        if (res.ok) {
          setRows(res.rows);
          setTableCounts((prev) => ({ ...prev, [tableName]: res.rows.length }));
        } else {
          setRows([]);
          setStatusBanner({
            type: "error",
            message: `Failed to read table "${tableName}": ${res.error}`,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [provisionedDb?.dbName, runTenantSql],
  );

  // Introspect ALL real tables & columns in the user's isolated PostgreSQL database
  const refreshLiveSchema = useCallback(
    async (overrideDbName?: string) => {
      const targetDb = overrideDbName || provisionedDb?.dbName;
      if (!targetDb) {
        setStudioTables([]);
        setSelectedTable("");
        setRows([]);
        return [];
      }
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const res = await runTenantSql(buildSchemaIntrospectionSql(), targetDb);
        if (!res.ok) {
          setSchemaError(res.error);
          return [];
        }
        const parsedTables = parseIntrospectedTables(res.rows);
        setStudioTables(parsedTables);
        const nextCounts: Record<string, number> = {};
        for (const t of parsedTables) {
          nextCounts[t.name] = t.estimatedRows;
        }
        setTableCounts((prev) => ({ ...prev, ...nextCounts }));
        setSelectedTable((prev) => {
          if (prev && parsedTables.some((t) => t.name === prev)) return prev;
          return parsedTables[0]?.name ?? "";
        });
        setSandboxSelectedTable((prev) => {
          if (prev && parsedTables.some((t) => t.name === prev)) return prev;
          return parsedTables[0]?.name ?? "";
        });
        return parsedTables;
      } finally {
        setSchemaLoading(false);
      }
    },
    [provisionedDb?.dbName, runTenantSql],
  );

  // Load live PostgreSQL catalog data for Database sub-tabs (extensions, indexes, policies, functions, triggers, roles)
  const loadCatalogSubTab = useCallback(
    async (tab: string) => {
      if (!provisionedDb?.dbName) {
        setCatalogRows([]);
        setCatalogError("No PostgreSQL database provisioned yet.");
        return;
      }
      const queries: Record<string, string> = {
        extensions: `SELECT name, default_version, installed_version, comment FROM pg_available_extensions WHERE installed_version IS NOT NULL OR name IN ('vector', 'pgcrypto', 'uuid-ossp', 'pg_trgm', 'citext', 'hstore') ORDER BY (installed_version IS NULL), name ASC;`,
        indexes: `SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;`,
        policies: `SELECT tablename AS table_name, policyname AS policy_name, permissive, cmd AS command, qual AS using_expr FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;`,
        functions: `SELECT p.proname AS function_name, pg_get_function_result(p.oid) AS returns, pg_get_function_arguments(p.oid) AS arguments, l.lanname AS language FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname = 'public' ORDER BY p.proname;`,
        triggers: `SELECT trigger_name, event_object_table AS table_name, action_timing AS timing, event_manipulation AS event, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;`,
        roles: `SELECT current_database() AS database_name, current_user AS active_role, session_user AS session_role, inet_server_addr()::text AS server_addr, inet_server_port() AS server_port;`,
      };
      const sql = queries[tab];
      if (!sql) return;
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const res = await runTenantSql(sql);
        if (res.ok) {
          setCatalogRows(res.rows);
        } else {
          setCatalogRows([]);
          setCatalogError(res.error);
        }
      } finally {
        setCatalogLoading(false);
      }
    },
    [provisionedDb?.dbName, runTenantSql],
  );

  // Load live PostgreSQL observability metrics (cache hit ratio + pg_stat_activity)
  const loadLiveObservability = useCallback(async () => {
    if (!provisionedDb?.dbName) return;
    const [statRes, actRes] = await Promise.all([
      runTenantSql(
        `SELECT current_user AS role, blks_hit, blks_read, CASE WHEN (blks_hit + blks_read) = 0 THEN 100.00 ELSE ROUND((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2) END AS hit_ratio_pct FROM pg_stat_database WHERE datname = current_database();`,
      ),
      runTenantSql(
        `SELECT pid, usename, state, application_name, query_start::text AS started_at, LEFT(query, 120) AS query FROM pg_stat_activity WHERE datname = current_database() ORDER BY query_start DESC NULLS LAST LIMIT 20;`,
      ),
    ]);
    setLiveDbStats({
      cacheHitPct:
        statRes.ok && statRes.rows[0]?.hit_ratio_pct !== undefined
          ? `${String(statRes.rows[0].hit_ratio_pct)}%`
          : null,
      currentUser:
        statRes.ok && statRes.rows[0]?.role ? String(statRes.rows[0].role) : provisionedDb.dbUser,
      activeQueries: actRes.ok ? actRes.rows : [],
    });
  }, [provisionedDb?.dbName, provisionedDb?.dbUser, runTenantSql]);

  // Whenever active real PostgreSQL database changes, introspect schema & load backups/audit
  useEffect(() => {
    if (!provisionedDb?.dbName || viewMode !== "studio") return;
    void refreshLiveSchema(provisionedDb.dbName);
    void loadBackupsAndAudit();
  }, [provisionedDb?.dbName, viewMode, refreshLiveSchema, loadBackupsAndAudit]);

  // Whenever selectedTable changes, query real rows from PostgreSQL
  useEffect(() => {
    if (!provisionedDb?.dbName || !selectedTable || viewMode !== "studio") {
      setRows([]);
      return;
    }
    void fetchTableRows(selectedTable, provisionedDb.dbName);
  }, [selectedTable, provisionedDb?.dbName, viewMode, fetchTableRows]);

  // Load catalog data when switching Database sub-tabs or Observability
  useEffect(() => {
    if (viewMode !== "studio" || !provisionedDb?.dbName) return;
    if (
      activeSection === "database" &&
      ["extensions", "indexes", "policies", "functions", "triggers", "roles"].includes(databaseSubTab)
    ) {
      void loadCatalogSubTab(databaseSubTab);
    } else if (activeSection === "pooler" || activeSection === "overview") {
      void loadLiveObservability();
    } else if (activeSection === "backups" || databaseSubTab === "backups" || activeSection === "auth" || activeSection === "settings") {
      void loadBackupsAndAudit();
    }
  }, [activeSection, databaseSubTab, viewMode, provisionedDb?.dbName, loadCatalogSubTab, loadLiveObservability, loadBackupsAndAudit]);

  const activeTableMeta = useMemo<StudioTableMeta>(() => {
    return (
      studioTables.find((t) => t.name === selectedTable) || {
        name: selectedTable,
        label: selectedTable,
        description: "PostgreSQL table",
        primaryKey: "id",
        columns: [],
        estimatedRows: 0,
        sizePretty: "0 bytes",
        defaultRow: {},
      }
    );
  }, [studioTables, selectedTable]);

  // Navigate helper
  const navigateStudioSection = (sec: StudioSection) => {
    setActiveSection(sec);
    if (sec === "auth") {
      setAuthSubTab("account");
    } else if (sec === "api") {
      setSettingsSubTab("api_keys");
    } else if (sec === "backups") {
      setDatabaseSubTab("backups");
    }
  };

  // Refresh live PostgreSQL schema, cluster health, and database summary
  const handleSyncLiveDatabase = async () => {
    setSyncingCloud(true);
    try {
      await loadRealDatabasesAndHealth();
      if (provisionedDb?.dbName) {
        const refreshed = await refreshLiveSchema(provisionedDb.dbName);
        if (selectedTable) {
          await fetchTableRows(selectedTable, provisionedDb.dbName);
        }
        await loadBackupsAndAudit();
        setStatusBanner({
          type: "success",
          message: `Synced live PostgreSQL database ${provisionedDb.dbName} (${refreshed.length} public table${refreshed.length === 1 ? "" : "s"}).`,
        });
      } else {
        setStatusBanner({
          type: "info",
          message: "Cluster health checked. Provision a PostgreSQL database to start creating tables.",
        });
      }
    } finally {
      setSyncingCloud(false);
    }
  };

  // Run REAL latency & health diagnostics via GET /api/db/health
  const handleRunPingDiagnostics = async () => {
    setPingStatus((prev) => ({ ...prev, testing: true }));
    const t0 = performance.now();
    try {
      const res = await fetch("/api/db/health", { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as LiveClusterHealth | null;
      const roundTripMs = Math.max(1, Math.round(performance.now() - t0));
      if (res.ok && data?.ok) {
        setClusterHealth(data);
        setPingStatus({
          postgrest: roundTripMs,
          pgbouncer: data.latencyMs,
          postgres: data.latencyMs,
          testing: false,
        });
        setStatusBanner({
          type: "success",
          message: `${data.version} healthy — DB query latency ${data.latencyMs}ms (HTTP RTT ${roundTripMs}ms, ${data.activeConnections} active conns).`,
        });
      } else {
        setPingStatus({ postgrest: null, pgbouncer: null, postgres: null, testing: false });
        setStatusBanner({
          type: "error",
          message: data?.error || `PostgreSQL cluster health check failed (HTTP ${res.status}).`,
        });
      }
    } catch {
      setPingStatus({ postgrest: null, pgbouncer: null, postgres: null, testing: false });
      setStatusBanner({
        type: "error",
        message: "Unable to reach /api/db/health. Check PostgreSQL server connectivity.",
      });
    }
  };

  // Account Management: Update current user's display name and/or password
  const handleUpdateOwnAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) return;
    const cleanName = accountDisplayName.trim();
    if (!cleanName) {
      setStatusBanner({ type: "error", message: "Display name cannot be empty." });
      return;
    }
    if (accountNewPassword && accountNewPassword.length < 6) {
      setStatusBanner({
        type: "error",
        message: "New password must be at least 6 characters.",
      });
      return;
    }

    setSavingAccount(true);
    try {
      const updatedUser: AppUser = {
        id: sessionUser.id,
        email: sessionUser.email.trim().toLowerCase(),
        fullName: cleanName,
        password: accountNewPassword,
        admin: sessionUser.admin,
        tenantId: sessionUser.tenantId,
      };
      const syncedToPg = await persistAppUserToBackend(updatedUser);
      if (!syncedToPg) {
        setStatusBanner({
          type: "error",
          message: "Failed to persist account update to PostgreSQL backend.",
        });
        return;
      }
      const safeUser: AppUser = { ...updatedUser, password: "" };
      setSessionUser(safeUser);
      issueSignedSessionToken({
        id: safeUser.id,
        email: safeUser.email,
        fullName: safeUser.fullName,
        role: safeUser.admin === "yes" ? "admin" : "client",
        tenantId: safeUser.tenantId,
      });
      if (onUserAuthenticated) {
        onUserAuthenticated(safeUser);
      }
      setAccountNewPassword("");
      setStatusBanner({
        type: "success",
        message: "Account credentials saved to PostgreSQL.",
      });
    } catch {
      setStatusBanner({ type: "error", message: "Failed to save account changes." });
    } finally {
      setSavingAccount(false);
    }
  };

  // Account Management: Provision a new database account (Admin only)
  const handleProvisionDatabaseUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanName = newUserFullName.trim();
    if (!cleanName) {
      setStatusBanner({ type: "error", message: "Full name is required for the new database user." });
      return;
    }
    if (!DB_EMAIL_PATTERN.test(cleanEmail)) {
      setStatusBanner({ type: "error", message: "Please provide a valid developer email address." });
      return;
    }
    if (newUserPassword.length < 6) {
      setStatusBanner({
        type: "error",
        message: "Initial password must be at least 6 characters.",
      });
      return;
    }

    setCreatingAccount(true);
    try {
      const duplicate = await fetchAppUserByEmailFromBackend(cleanEmail);
      if (duplicate) {
        setStatusBanner({
          type: "error",
          message: `Account ${cleanEmail} already exists.`,
        });
        return;
      }

      const createdUser: AppUser = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        email: cleanEmail,
        password: newUserPassword,
        fullName: cleanName,
        admin: newUserRole,
        tenantId: newUserTenantId.trim() || `TNT-${Date.now().toString().slice(-4)}`,
      };
      const synced = await persistAppUserToBackend(createdUser);
      if (!synced) {
        setStatusBanner({ type: "error", message: "Backend rejected account creation." });
        return;
      }
      const provRes = await fetch("/api/db/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantId: createdUser.tenantId,
          userId: createdUser.id,
          email: createdUser.email,
          projectName: createdUser.fullName,
        }),
      });
      setNewUserFullName("");
      setNewUserEmail("");
      setNewUserPassword("");
      await loadRealDatabasesAndHealth();
      setStatusBanner({
        type: provRes.ok ? "success" : "info",
        message: provRes.ok
          ? `Provisioned account ${cleanEmail} and dedicated isolated PostgreSQL database.`
          : `Created account ${cleanEmail}, but isolated DB provisioning returned HTTP ${provRes.status}.`,
      });
    } catch {
      setStatusBanner({ type: "error", message: "Unable to create database user." });
    } finally {
      setCreatingAccount(false);
    }
  };

  // REAL Insert or Update Row directly against PostgreSQL via /api/db/query
  const handleSaveRow = async () => {
    if (!selectedTable || !provisionedDb?.dbName) {
      setStatusBanner({ type: "error", message: "Select a real table in your provisioned database first." });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonDraft);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Row payload must be a JSON object.");
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Invalid JSON format.",
      });
      return;
    }

    setSavingRow(true);
    try {
      let sql: string;
      if (editingRow) {
        const pkCol = activeTableMeta.primaryKey;
        const pkVal = editingRow[pkCol];
        sql = buildUpdateRowSql(selectedTable, pkCol, pkVal, parsed);
      } else {
        sql = buildInsertRowSql(selectedTable, parsed);
      }
      const res = await runTenantSql(sql);
      if (!res.ok) {
        setStatusBanner({
          type: "error",
          message: `PostgreSQL rejected ${editingRow ? "UPDATE" : "INSERT"}: ${res.error}${res.detail ? ` (${res.detail})` : ""}`,
        });
        return;
      }
      setShowInsertModal(false);
      setEditingRow(null);
      await fetchTableRows(selectedTable);
      setStatusBanner({
        type: "success",
        message: editingRow
          ? `Updated row in public.${selectedTable} (${res.durationMs}ms).`
          : `Inserted row into public.${selectedTable} (${res.durationMs}ms).`,
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save row.",
      });
    } finally {
      setSavingRow(false);
    }
  };

  // REAL Delete Row directly against PostgreSQL via /api/db/query
  const handleDeleteRow = async (row: Record<string, unknown>) => {
    if (!selectedTable || !provisionedDb?.dbName) return;
    const col = activeTableMeta.primaryKey;
    const val = row[col];
    if (!confirm(`Delete row from public.${selectedTable} where ${col} = ${String(val)}?`)) return;

    const sql = buildDeleteRowSql(selectedTable, col, val);
    const res = await runTenantSql(sql);
    if (!res.ok) {
      setStatusBanner({
        type: "error",
        message: `PostgreSQL DELETE failed: ${res.error}`,
      });
      return;
    }
    await fetchTableRows(selectedTable);
    setStatusBanner({
      type: "success",
      message: `Deleted ${res.rowCount} row(s) from public.${selectedTable} (${res.durationMs}ms).`,
    });
  };

  // REAL Create New Table via CREATE TABLE DDL against PostgreSQL
  const handleCreateNewTable = async () => {
    if (!provisionedDb?.dbName) {
      setStatusBanner({
        type: "error",
        message: "Provision your PostgreSQL database first before creating tables.",
      });
      return;
    }
    if (!newTableName.trim()) {
      setStatusBanner({ type: "error", message: "Table name is required." });
      return;
    }

    let safeTableName: string;
    let ddl: string;
    try {
      safeTableName = sanitizePgObjectName(newTableName);
      ddl = buildCreateTableSql(safeTableName, newTableColumns, newTableEnableRls);
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Invalid table definition.",
      });
      return;
    }

    setCreatingTable(true);
    try {
      const res = await runTenantSql(ddl);
      if (!res.ok) {
        setStatusBanner({
          type: "error",
          message: `CREATE TABLE failed: ${res.error}${res.detail ? ` (${res.detail})` : ""}`,
        });
        return;
      }
      await refreshLiveSchema();
      setSelectedTable(safeTableName);
      setShowCreateTableModal(false);
      setNewTableName("");
      setNewTableDescription("");
      setStatusBanner({
        type: "success",
        message: `Created real PostgreSQL table "public.${safeTableName}" in ${provisionedDb.dbName} (${res.durationMs}ms).`,
      });
    } finally {
      setCreatingTable(false);
    }
  };

  // REAL Drop Table via DROP TABLE against PostgreSQL
  const handleDropTable = async (tableName: string) => {
    if (!provisionedDb?.dbName) return;
    if (!confirm(`Permanently DROP table "public.${tableName}" and all its rows from ${provisionedDb.dbName}?`)) {
      return;
    }
    const res = await runTenantSql(buildDropTableSql(tableName));
    if (!res.ok) {
      setStatusBanner({ type: "error", message: `DROP TABLE failed: ${res.error}` });
      return;
    }
    const remaining = await refreshLiveSchema();
    setSelectedTable(remaining[0]?.name ?? "");
    setStatusBanner({
      type: "success",
      message: `Dropped table "public.${tableName}" from ${provisionedDb.dbName} (${res.durationMs}ms).`,
    });
  };

  // REAL SQL Execution directly against PostgreSQL via /api/db/query (Zero Mock Fallback!)
  const handleExecuteSql = async () => {
    const queryToRun = activeSql.trim();
    if (!queryToRun) {
      setSqlError({ message: "Enter a PostgreSQL query before clicking Run." });
      return;
    }
    setExecutingSql(true);
    setSqlExecutionStats(null);
    setSqlError(null);
    try {
      let targetDb = provisionedDb?.dbName;
      if (!targetDb && sessionUser) {
        const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
        const autoProv = await provisionIsolatedPgDatabase({
          tenantId: tid,
          userId: sessionUser.id,
          email: sessionUser.email,
          projectName: sessionUser.fullName,
          planId: selectedDbPlanId,
        });
        targetDb = autoProv?.dbName;
      }

      const res = await runTenantSql(queryToRun, targetDb);
      if (!res.ok) {
        setSqlResults(null);
        setSqlResultFields([]);
        setSqlError({
          message: res.error,
          ...(res.pgCode ? { pgCode: res.pgCode } : {}),
          ...(res.detail ? { detail: res.detail } : {}),
          ...(res.hint ? { hint: res.hint } : {}),
          ...(res.position ? { position: res.position } : {}),
        });
        setSqlHistory((prev) => [
          { id: `h-${Date.now()}`, sql: queryToRun, time: "Just now", ok: false },
          ...prev.slice(0, 14),
        ]);
        return;
      }

      setSqlResults(res.rows);
      setSqlResultFields(res.fields);
      setSqlExecutionStats({
        timeMs: res.durationMs,
        rowCount: res.rowCount,
        command: res.command,
        truncated: res.truncated,
        ...(res.statementCount !== undefined ? { statementCount: res.statementCount } : {}),
      });
      setSqlHistory((prev) => [
        { id: `h-${Date.now()}`, sql: queryToRun, time: "Just now", ok: true },
        ...prev.slice(0, 14),
      ]);

      // Auto-refresh live schema & table rows when DDL/DML ran
      if (isSchemaMutatingSql(queryToRun) && targetDb) {
        void refreshLiveSchema(targetDb).then((updatedTables) => {
          if (selectedTable && updatedTables.some((t) => t.name === selectedTable)) {
            void fetchTableRows(selectedTable, targetDb);
          }
        });
      }
    } finally {
      setExecutingSql(false);
    }
  };

  const handleSaveSqlQuery = () => {
    const snippetName = `query_${savedSqlQueries.length + 1}.sql`;
    setSavedSqlQueries((prev) => {
      const next = [{ id: `sq-${Date.now()}`, name: snippetName, sql: activeSql }, ...prev];
      if (typeof window !== "undefined" && provisionedDb?.dbName) {
        try {
          localStorage.setItem(`spx_saved_sql_${provisionedDb.dbName}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
    setStatusBanner({ type: "success", message: `Saved SQL snippet as ${snippetName} in Private folder.` });
  };

  const handleDeleteSavedSqlQuery = (id: string) => {
    setSavedSqlQueries((prev) => {
      const next = prev.filter((q) => q.id !== id);
      if (typeof window !== "undefined" && provisionedDb?.dbName) {
        try {
          localStorage.setItem(`spx_saved_sql_${provisionedDb.dbName}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleSqlKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleExecuteSql();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSaveSqlQuery();
    }
  };

  // REAL Live Database Query Test in Connection & SDK tab
  const handleTestSandboxEndpoint = async () => {
    setSandboxLoading(true);
    setSandboxStatusOk(null);
    const t0 = performance.now();
    try {
      const testSql = sandboxSelectedTable
        ? buildSelectTableSql(sandboxSelectedTable, 5)
        : `SELECT current_database() AS database, current_user AS role, version(), now() AS server_time;`;
      const res = await runTenantSql(testSql);
      const elapsed = res.ok ? res.durationMs : Math.round(performance.now() - t0);
      setSandboxLatency(elapsed);
      if (res.ok) {
        setSandboxStatusOk(true);
        setSandboxResponse(
          JSON.stringify(
            {
              database: provisionedDb?.dbName,
              command: res.command,
              rowCount: res.rowCount,
              durationMs: res.durationMs,
              rows: res.rows,
            },
            null,
            2,
          ),
        );
        setStatusBanner({
          type: "success",
          message: `Live PostgreSQL query succeeded (${res.rowCount} rows in ${res.durationMs}ms).`,
        });
      } else {
        setSandboxStatusOk(false);
        setSandboxResponse(
          JSON.stringify(
            {
              ok: false,
              error: res.error,
              ...(res.pgCode ? { pgCode: res.pgCode } : {}),
              ...(res.detail ? { detail: res.detail } : {}),
            },
            null,
            2,
          ),
        );
        setStatusBanner({ type: "error", message: `Live query failed: ${res.error}` });
      }
    } finally {
      setSandboxLoading(false);
    }
  };

  // Export current table as JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.dbName}-${selectedTable || "table"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({ type: "success", message: `Exported ${rows.length} rows as JSON.` });
  };

  // Export current table as CSV
  const handleExportCsv = () => {
    const firstRow = rows[0];
    if (!firstRow) {
      setStatusBanner({ type: "info", message: "No rows to export from this table." });
      return;
    }
    const headers = Object.keys(firstRow);
    const csvLines = [headers.join(",")];
    for (const r of rows) {
      const line = headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      csvLines.push(line.join(","));
    }
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.dbName}-${selectedTable || "table"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({ type: "success", message: `Exported ${rows.length} rows as CSV.` });
  };

  // Build Full DDL string from REAL introspected PostgreSQL tables
  const buildFullSchemaDdl = () => buildSchemaDdlFromTables(studioTables, activeProject.dbName);

  const handleExportFullSchemaSql = () => {
    const ddl = buildFullSchemaDdl();
    const blob = new Blob([ddl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.dbName}-schema-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({ type: "success", message: `Exported live PostgreSQL schema DDL (${studioTables.length} tables).` });
  };

  // Export live data dump of current database tables via real PostgreSQL queries
  const handleExportFullDatabaseJson = async () => {
    if (!provisionedDb?.dbName) {
      setStatusBanner({ type: "error", message: "No provisioned PostgreSQL database to export." });
      return;
    }
    const tablesDump: Record<string, unknown> = {};
    for (const t of studioTables) {
      const res = await runTenantSql(buildSelectTableSql(t.name, 500));
      tablesDump[t.name] = res.ok ? res.rows : [];
    }
    const fullDump = {
      database: provisionedDb.dbName,
      exported_at: new Date().toISOString(),
      table_count: studioTables.length,
      tables: tablesDump,
    };
    const blob = new Blob([JSON.stringify(fullDump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${provisionedDb.dbName}-dump-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({ type: "success", message: `Exported live JSON dump of ${studioTables.length} PostgreSQL table(s).` });
  };

  // Copy helper
  const copyText = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered & sorted rows
  const processedRows = useMemo(() => {
    let result = [...rows];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const comp =
          typeof valA === "number" && typeof valB === "number"
            ? valA - valB
            : ROW_TEXT_COLLATOR.compare(String(valA), String(valB));
        return sortDirection === "asc" ? comp : -comp;
      });
    }
    return result;
  }, [rows, searchFilter, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, currentPage, pageSize]);

  // Real PostgreSQL columns from information_schema (even when table has 0 rows!)
  const tableColumns = useMemo(() => {
    if (activeTableMeta.columns && activeTableMeta.columns.length > 0) {
      return activeTableMeta.columns.map((c: LiveStudioColumn) => ({
        name: c.name,
        type: c.udtName === "vector" ? "vector" : c.udtName || c.dataType,
        isPrimary: c.isPrimary,
      }));
    }
    const colSet = new Set<string>();
    paginatedRows.forEach((r) => {
      Object.keys(r).forEach((k) => colSet.add(k));
    });
    const cols = Array.from(colSet);
    const pk = activeTableMeta.primaryKey;
    const ordered = cols.includes(pk) ? [pk, ...cols.filter((c) => c !== pk)] : cols;
    const sampleRow = paginatedRows[0] || {};
    return ordered.map((col) => ({
      name: col,
      type: inferColumnType(col, pk, sampleRow[col]),
      isPrimary: col === pk,
    }));
  }, [paginatedRows, activeTableMeta]);

  // Real PostgreSQL connection snippets for Connection & SDK tab + Connect modal
  const sandboxSnippets = useMemo(() => {
    const tbl = sandboxSelectedTable || "notes";
    const uri = activeProject.directUri;
    return {
      node: `// Node.js (pg) — Direct PostgreSQL 16 Connection\nimport { Pool } from "pg";\n\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL, // ${uri}\n  ssl: { rejectUnauthorized: false },\n});\n\nconst { rows } = await pool.query('SELECT * FROM "public"."${tbl}" LIMIT 10;');\nconsole.log(rows);`,
      psql: `# Connect directly via PostgreSQL CLI (psql)\npsql "${uri}"\n\n# Inspect tables & query rows:\n\\dt public.*\nSELECT * FROM "public"."${tbl}" LIMIT 10;`,
      python: `# Python (psycopg 3)\nimport os, psycopg\n\nwith psycopg.connect("${uri}") as conn:\n    with conn.cursor() as cur:\n        cur.execute('SELECT * FROM "public"."${tbl}" LIMIT 10;')\n        print(cur.fetchall())`,
      prisma: `// prisma/schema.prisma\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n// .env\n// DATABASE_URL="${uri}"`,
      js: `// Node.js / Next.js Server Route (pg)\nimport { Pool } from "pg";\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL });\nconst { rows } = await pool.query('SELECT * FROM "public"."${tbl}" LIMIT 10;');`,
    };
  }, [sandboxSelectedTable, activeProject]);

  // =========================================================================
  // VIEW MODE 1: SUPABASE-INSPIRED PRODUCT LANDING PAGE (db.sparrowx.net)
  // =========================================================================
  if (viewMode === "landing") {
    const activeFramework = FRAMEWORK_GUIDES.find((f) => f.id === selectedFramework) || FRAMEWORK_GUIDES[0];

    const scrollToAuthCard = (mode: "signin" | "register") => {
      setLandingAuthMode(mode);
      setLandingAuthError("");
      setLandingMobileMenuOpen(false);
      const el = document.getElementById("db-auth-card");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    return (
      <div className="min-h-screen bg-[#05060A] text-white flex flex-col font-sans selection:bg-[#A3E635] selection:text-black relative overflow-x-hidden">
        <AnimatedCloudBackground variant="lime" intensity="subtle" />

        {/* ELEGANT DB NAVBAR (MIDNIGHT BLACK, PURE WHITE & LIME GREEN) */}
        <header className="border-b border-white/10 bg-[#05060A]/90 sticky top-0 z-40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logos/sparrowx-db.png"
                alt="SparrowX DB"
                width={34}
                height={34}
                className="size-8.5 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]"
              />
              <span className="font-bold text-sm tracking-tight text-white">SparrowX</span>
              <span className="px-2 py-0.5 rounded bg-[#A3E635]/15 border border-[#A3E635]/30 text-[10px] font-mono font-semibold text-[#A3E635]">
                DB
              </span>
            </div>

            <nav aria-label="Product Navigation" className="hidden lg:flex items-center gap-7 text-xs font-medium text-zinc-400">
              <a href="#db-bento" className="hover:text-white transition-colors">Features</a>
              <a href={buildMasterHref("/docs/db")} className="hover:text-white transition-colors">Docs</a>
              <a href="#db-sandbox" className="hover:text-white transition-colors">Sandbox</a>
              <a href="#db-pricing" className="hover:text-white transition-colors">Pricing</a>
            </nav>

            <div className="flex items-center gap-2.5">
              {sessionUser ? (
                <>
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0D14] border border-white/15 text-zinc-200 font-mono text-[11px]">
                    <span className="size-1.5 rounded-full bg-[#A3E635]" />
                    <span className="max-w-[130px] truncate">{sessionUser.fullName || sessionUser.email}</span>
                  </span>
                  {!isStandaloneDomain && onOpenClientArea && (
                    <button
                      type="button"
                      onClick={() => onOpenClientArea()}
                      className="hidden sm:inline-flex px-3 py-1.5 rounded-md border border-white/15 bg-[#0A0D14] hover:border-white/30 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                    >
                      Client Area
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewMode("studio")}
                    className="px-3.5 py-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Open Studio</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleLockWorkspace}
                    className="p-1.5 rounded-md border border-white/15 bg-[#0A0D14] hover:border-white/35 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  {!isStandaloneDomain && onClose && (
                    <button
                      type="button"
                      onClick={() => onClose()}
                      className="hidden sm:inline-flex px-2.5 py-1.5 rounded-md text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => scrollToAuthCard("signin")}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToAuthCard("register")}
                    className="px-3.5 py-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-black font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Start Project
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setLandingMobileMenuOpen((v) => !v)}
                className="lg:hidden p-1.5 rounded-md border border-white/15 bg-[#0A0D14] text-zinc-300 cursor-pointer"
                aria-label="Toggle Menu"
              >
                <Menu className="size-4" />
              </button>
            </div>
          </div>

          {landingMobileMenuOpen && (
            <div className="lg:hidden px-4 sm:px-6 py-3 border-t border-white/10 bg-[#05060A] flex flex-wrap gap-3 text-xs font-medium text-zinc-300">
              <a href="#db-bento" onClick={() => setLandingMobileMenuOpen(false)} className="px-2 py-1 rounded hover:bg-white/10">Features</a>
              <a href={buildMasterHref("/docs/db")} onClick={() => setLandingMobileMenuOpen(false)} className="px-2 py-1 rounded hover:bg-white/10">Docs</a>
              <a href="#db-sandbox" onClick={() => setLandingMobileMenuOpen(false)} className="px-2 py-1 rounded hover:bg-white/10">Sandbox</a>
              <a href="#db-pricing" onClick={() => setLandingMobileMenuOpen(false)} className="px-2 py-1 rounded hover:bg-white/10">Pricing</a>
            </div>
          )}
        </header>

        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-14">
          {/* HERO + STRICT AUTH CARD */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border border-[#262626] bg-[#0A0D14]/90 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-2xl">
            <div className="lg:col-span-7 space-y-5">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                Build in a weekend. <br />
                <span className="text-[#A3E635]">Scale to millions.</span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
                SparrowX Cloud DB is a managed PostgreSQL developer platform. Start every project with a full PostgreSQL database, Authentication with Row Level Security, Instant Data APIs, Storage, Edge Functions, and Vector embeddings — with flat, transparent pricing.
              </p>

              <div className="pt-1 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => (sessionUser ? setViewMode("studio") : scrollToAuthCard("register"))}
                  className="px-4 py-2 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-semibold text-xs transition-colors cursor-pointer"
                >
                  {sessionUser ? "Open Database Studio →" : "Start your project"}
                </button>
                <a
                  href="/docs/db"
                  className="px-4 py-2 rounded-md border border-[#2E2E2E] bg-[#1A1A1D] hover:bg-[#232327] text-zinc-200 font-medium text-xs transition-colors"
                >
                  Read Documentation
                </a>
              </div>

              <div className="pt-2 flex flex-wrap gap-5 text-xs font-mono text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-[#A3E635]" /> 100% Portable Postgres
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-[#A3E635]" /> Built-in Auth &amp; RLS
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-[#A3E635]" /> PgBouncer Port 6543 Pooler
                </span>
              </div>

              {/* Subtle floating 3D side accent */}
              <div className="hidden sm:block pointer-events-none max-w-[220px] pt-2 opacity-90">
                <Floating3DVisual
                  src="/3d/cloud-db-cluster.svg"
                  alt="3D floating PostgreSQL 16 sovereign database platters with orbiting pgvector glass cubes"
                  accent="lime"
                  size="sm"
                  priority="lazy"
                  width={240}
                  height={240}
                />
              </div>
            </div>

            {/* Right: Studio Strict Auth Card */}
            <div
              id="db-auth-card"
              className="lg:col-span-5 border border-[#2E2E2E] bg-[#0A0D14] rounded-xl p-5 space-y-4 shadow-xl scroll-mt-20"
            >
              <div className="relative z-10 flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-white">Studio Single Sign-On</h3>
                  <p className="text-[11px] text-zinc-400">
                    Sign in with Google or GitHub to launch your isolated PostgreSQL workspace.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#A3E635]/10 border border-[#A3E635]/30 text-[#A3E635] shrink-0">
                  {selectedPricingPlan}
                </span>
              </div>

              {landingAuthError && (
                <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                  {landingAuthError}
                </div>
              )}

              <div className="space-y-4 pt-1">
                <OAuthSignInButtons nextPath="/db" />
                <p className="text-[11px] text-center text-zinc-400 leading-relaxed">
                  Passwordless OAuth 2.0 authentication — your isolated PostgreSQL 16 database, REST API, and connection string provision automatically on first sign-in.
                </p>
              </div>
            </div>
          </section>

          {/* 7-CARD PRODUCT BENTO GRID (SCREENSHOT 11) */}
          <section id="db-bento" className="scroll-mt-20 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 1. Postgres Database (Wide 6 cols) */}
              <div className="lg:col-span-6 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between relative overflow-hidden min-h-[260px]">
                <div className="space-y-2 max-w-xs z-10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="size-4 text-zinc-400" />
                    <span>Postgres Database</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Every project is <strong className="text-white font-medium">a full Postgres 16 database</strong>, the world&apos;s most trusted relational database.
                  </p>
                </div>

                {/* Wireframe Postgres outline graphic */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 180 150"
                  className="hidden sm:block absolute right-6 top-1/2 -translate-y-1/2 w-44 h-36 opacity-50 pointer-events-none"
                >
                  <rect x="20" y="10" width="140" height="130" rx="18" fill="none" stroke="#2a2a2e" strokeWidth="1" />
                  <ellipse cx="90" cy="48" rx="44" ry="18" fill="none" stroke="#52525b" strokeWidth="1.4" />
                  <path d="M46 48 v46 c0 10 20 18 44 18 s44-8 44-18 V48" fill="none" stroke="#52525b" strokeWidth="1.4" />
                  <path d="M46 71 c0 10 20 18 44 18 s44-8 44-18" fill="none" stroke="#A3E635" strokeOpacity="0.45" strokeWidth="1.2" />
                  <circle cx="118" cy="44" r="3" fill="#A3E635" />
                </svg>

                <ul className="space-y-1.5 text-xs text-zinc-300 z-10 mt-6">
                  <li className="flex items-center gap-2"><Check className="size-3.5 text-[#A3E635]" /> 100% portable</li>
                  <li className="flex items-center gap-2"><Check className="size-3.5 text-[#A3E635]" /> Built-in Auth with RLS</li>
                  <li className="flex items-center gap-2"><Check className="size-3.5 text-[#A3E635]" /> Easy to extend</li>
                </ul>
              </div>

              {/* 2. Authentication (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[260px] overflow-hidden">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Lock className="size-4 text-zinc-400" />
                    <span>Authentication</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    <strong className="text-white font-medium">Add user sign ups and logins</strong>, securing your data with Row Level Security.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5 font-mono text-[10px]">
                  {[
                    "dev98@gmail.com",
                    "alex@sparrowx.net",
                    "••••••••••••",
                    "spx_rls_active",
                    "ops@acme.io",
                    "founder@dev.co",
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-[#262626] bg-[#19191C] px-2.5 py-2 text-zinc-400 truncate text-center"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Edge Functions (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[260px] relative overflow-hidden">
                <div className="space-y-2 z-10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Zap className="size-4 text-zinc-400" />
                    <span>Edge Functions</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Easily write custom code <strong className="text-white font-medium">without deploying or scaling servers.</strong>
                  </p>
                </div>

                <div className="relative mt-6 z-10 flex items-center justify-center">
                  <div className="rounded-full border border-[#2E2E2E] bg-[#101012]/95 px-3 py-1.5 font-mono text-[11px] text-zinc-300 shadow-lg flex items-center gap-2">
                    <span className="text-zinc-500">$</span>
                    <span>sparrowx</span>
                    <span className="text-[#A3E635]">functions deploy</span>
                  </div>
                </div>

                <svg
                  aria-hidden="true"
                  viewBox="0 0 240 110"
                  className="w-full h-24 -mb-6 opacity-45 pointer-events-none"
                >
                  <circle cx="120" cy="115" r="95" fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" />
                  <ellipse cx="120" cy="115" rx="95" ry="44" fill="none" stroke="#3f3f46" strokeWidth="1" />
                  <line x1="25" y1="95" x2="215" y2="95" stroke="#27272a" strokeWidth="1" />
                  <circle cx="105" cy="48" r="2.5" fill="#fff" />
                  <circle cx="182" cy="88" r="2.5" fill="#A3E635" />
                </svg>
              </div>

              {/* 4. Storage (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[210px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <HardDrive className="size-4 text-zinc-400" />
                    <span>Storage</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    <strong className="text-white font-medium">Store, organize, and serve</strong> large files, from backups to media assets.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-5">
                  {["PNG", "SQL", "JSON", "BIN"].map((ext) => (
                    <div
                      key={ext}
                      className="aspect-square rounded-lg border border-[#2A2A2E] bg-[#19191D] flex items-center justify-center text-[10px] font-mono text-zinc-400"
                    >
                      {ext}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Realtime (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[210px] overflow-hidden" style={DOT_GRID_STYLE}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Radio className="size-4 text-zinc-400" />
                    <span>Realtime</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    <strong className="text-white font-medium">Build multiplayer experiences</strong> with real-time data synchronization.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#A3E635]/40 bg-[#18181B] shadow-lg">
                    <span className="size-2 rounded-full bg-[#A3E635] animate-ping" />
                    <span className="text-xs font-mono text-zinc-200">ws://realtime • live sync</span>
                  </div>
                </div>
              </div>

              {/* 6. Vector (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[210px] relative overflow-hidden">
                <div className="space-y-2 z-10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Box className="size-4 text-zinc-400" />
                    <span>Vector</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Integrate ML models to <strong className="text-white font-medium">store, index and search vector embeddings.</strong>
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 z-10">
                  <span className="px-2.5 py-1 rounded border border-[#2E2E2E] bg-[#1A1A1E] text-[11px] font-mono text-zinc-300">
                    OpenAI
                  </span>
                  <span className="px-2.5 py-1 rounded border border-[#A3E635]/30 bg-[#A3E635]/10 text-[11px] font-mono text-[#A3E635]">
                    SparrowX 1536d
                  </span>
                </div>
              </div>

              {/* 7. Data APIs (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-[#262626] hover:border-[#A3E635]/40 transition-colors bg-[#0A0D14] p-6 flex flex-col justify-between min-h-[210px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BracesIconFallback />
                    <span>Data APIs</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Instant ready-to-use <strong className="text-white font-medium">REST APIs.</strong>
                  </p>
                </div>

                <div className="space-y-1.5 mt-4 font-mono text-[10px]">
                  {[
                    { tbl: "app_users", path: "/v1/app_users" },
                    { tbl: "client_tenants", path: "/v1/client_tenants" },
                    { tbl: "audit_logs", path: "/v1/audit_logs" },
                  ].map((r) => (
                    <div key={r.tbl} className="flex items-center justify-between gap-2">
                      <span className="px-2 py-1 rounded border border-[#262626] bg-[#19191C] text-zinc-400 truncate">
                        {r.tbl}
                      </span>
                      <span className="text-zinc-600">•••</span>
                      <span className="px-2 py-1 rounded border border-[#262626] bg-[#0A0D14] text-[#A3E635] truncate">
                        {r.path}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SPARROWX DOCUMENTATION & CONNECT A FRAMEWORK (SCREENSHOT 13) */}
          <section id="db-docs" className="scroll-mt-20 border-t border-b border-[#242424] py-10 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 flex items-start gap-5">
                <div className="size-16 rounded-xl border border-[#2A2A2E] bg-[#0A0D14] grid place-items-center shrink-0">
                  <BookOpen className="size-7 text-[#A3E635]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    SparrowX Documentation
                  </h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Learn how to get up and running with SparrowX DB through tutorials, APIs, and platform resources.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#2A2A2E] bg-[#151518] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setDocSetupTab("agent")}
                      className={`pb-1.5 -mb-2.5 border-b-2 transition-colors cursor-pointer ${
                        docSetupTab === "agent"
                          ? "border-white text-white"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Agent Prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocSetupTab("cli")}
                      className={`pb-1.5 -mb-2.5 border-b-2 transition-colors cursor-pointer ${
                        docSetupTab === "cli"
                          ? "border-white text-white"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      CLI
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "doc-setup",
                        docSetupTab === "agent"
                          ? `Help me set up SparrowX Cloud DB:\n1. npm install @sparrowx/client --save-dev\n2. Set SPARROWX_URL=https://db.sparrowx.net`
                          : `npx sparrowx-db init && sparrowx-db status --host https://db.sparrowx.net`
                      )
                    }
                    className="p-1.5 rounded border border-[#2E2E2E] bg-[#1D1D21] text-zinc-300 hover:text-white cursor-pointer"
                    title="Copy setup snippet"
                    aria-label="Copy setup snippet"
                  >
                    {copiedKey === "doc-setup" ? <Check className="size-3.5 text-[#A3E635]" /> : <Copy className="size-3.5" />}
                  </button>
                </div>

                {docSetupTab === "agent" ? (
                  <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                    <p>Help me get set up with SparrowX Cloud DB. Do the following:</p>
                    <p>
                      1. Install the client SDK as a project dependency with{" "}
                      <code className="px-1.5 py-0.5 rounded bg-[#07090E] border border-[#2A2A2E] text-[#A3E635] font-mono text-[11px]">
                        npm install @sparrowx/client
                      </code>
                    </p>
                    <p>
                      2. Point your client URL to{" "}
                      <code className="px-1.5 py-0.5 rounded bg-[#07090E] border border-[#2A2A2E] text-zinc-200 font-mono text-[11px]">
                        https://db.sparrowx.net
                      </code>{" "}
                      with your workspace API key.
                    </p>
                  </div>
                ) : (
                  <pre className="p-3 rounded-md bg-[#07090E] border border-[#262626] font-mono text-[11px] text-[#A3E635] overflow-x-auto leading-relaxed">
{`# Direct PostgreSQL 16 + PgBouncer (Port 6543) for psql, Prisma, Drizzle, psycopg
DATABASE_URL="postgresql://spx_u_<user>:<password>@db.sparrowx.net:6543/spx_db_<user>?sslmode=require"
psql "$DATABASE_URL" -c "SELECT version();"
curl -s "https://db.sparrowx.net/rest/v1/app_users?limit=5" -H "apikey: YOUR_KEY"`}
                  </pre>
                )}
              </div>
            </div>

            {/* Connect a framework grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-4 space-y-2">
                <h3 className="text-xl font-bold text-white">Connect a framework</h3>
                <p className="text-sm text-zinc-400">
                  Start with a quickstart guide to connect your project in minutes.
                </p>
                <div className="pt-2 rounded-lg border border-[#262626] bg-[#0A0D14] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A3E635] font-semibold">{activeFramework.label} Quickstart</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `fw-${activeFramework.id}`,
                          activeFramework.snippet(activeProject.restBaseUrl, activeProject.anonKey)
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {copiedKey === `fw-${activeFramework.id}` ? (
                        <>
                          <Check className="size-3 text-[#A3E635]" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    {activeFramework.snippet(activeProject.restBaseUrl, activeProject.anonKey)}
                  </pre>
                </div>
              </div>

              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FRAMEWORK_GUIDES.map((fw) => {
                  const selected = fw.id === selectedFramework;
                  return (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selected
                          ? "border-[#A3E635] bg-[#18221D]"
                          : "border-[#262626] bg-[#0A0D14] hover:border-zinc-600"
                      }`}
                    >
                      <span
                        className={`size-9 rounded-lg border grid place-items-center shrink-0 ${fw.accent}`}
                      >
                        <fw.icon className="size-4.5" />
                      </span>
                      <span className="text-sm font-medium text-white">{fw.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION: WHAT WE SOLVE & WHAT WE PROVIDE */}
          <section id="db-features" className="scroll-mt-20 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-red-500/20 bg-[#0A0D14] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-red-400 font-bold uppercase tracking-wider">
                <span className="size-2 rounded-full bg-red-500" />
                <span>What We Solve (The Problems We Hate)</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">Zero Shocking Cloud Bandwidth Invoices</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Legacy clouds surprise you with aggressive egress fees. SparrowX keeps egress transparent and developer-friendly.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">Clean Studio Instead of Bloated Menus</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Browse rows, inspect schemas visually, edit RLS policies, and execute SQL without nested legacy wizards.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">No Serverless Connection Exhaustion</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Built-in PgBouncer connection pooler on Port 6543 handles high-concurrency serverless bursts cleanly.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-[#A3E635]/25 bg-[#0A0D14] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#A3E635] font-bold uppercase tracking-wider">
                <span className="size-2 rounded-full bg-[#A3E635]" />
                <span>What We Provide (Built for Builders)</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">High-Capacity Pooler (Port 6543)</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Pre-configured transaction pooling for Node.js, Python, Prisma, and edge runtimes.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">Built-in AI Vector Search (pgvector v0.7.0)</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Store and query 1536-dimensional embeddings directly beside your relational tables.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#07090E] border border-[#242428] space-y-1">
                  <div className="text-white font-semibold">100% Open Data &amp; 1-Click Exports</div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Export complete PostgreSQL schemas (.sql), multi-table JSON dumps, or CSV snapshots anytime.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: HONEST PROS & CONS */}
          <section id="db-pros-cons" className="scroll-mt-20 border border-[#262626] bg-[#0A0D14] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242428] pb-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Honest Pros &amp; Cons
                </h2>
                <p className="text-xs text-zinc-400">
                  Total transparency on what makes SparrowX Cloud DB strong and where we focus.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-lg bg-[#07090E] border border-[#242428] space-y-2">
                <span className="text-[#A3E635] font-bold block text-sm">Our Plus Points (Pros):</span>
                <ul className="space-y-1.5 text-zinc-300">
                  <li>• Instant setup: PostgreSQL + PostgREST ready in under 30 seconds.</li>
                  <li>• Predictable flat pricing without billing shocks.</li>
                  <li>• High-speed NVMe storage with automated daily snapshots.</li>
                  <li>• Zero vendor lock-in: standard PostgreSQL 16 + Prisma + Drizzle compatible.</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-[#07090E] border border-[#242428] space-y-2">
                <span className="text-amber-400 font-bold block text-sm">Where We Stand (Cons):</span>
                <ul className="space-y-1.5 text-zinc-300">
                  <li>• Focused startup engineering team rather than a mega-conglomerate.</li>
                  <li>• Purpose-built for PostgreSQL + pgvector workloads, not 50 legacy DB engines.</li>
                  <li>• Primary compute cluster hosted in Sydney, Australia (OVH SYD-1) with global edge routing.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* INTERACTIVE TEST-DRIVE WORKBENCH */}
          <section id="db-sandbox" className="scroll-mt-20 border border-[#262626] bg-[#0A0D14] rounded-xl overflow-hidden shadow-lg">
            <div className="border-b border-[#262626] bg-[#19191D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                {[
                  { id: "schema" as const, label: "1. Visual Table Schema" },
                  { id: "sql" as const, label: "2. SQL Scratchpad" },
                  { id: "vector" as const, label: "3. Vector Embedding Search" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLandingTab(t.id)}
                    className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                      landingTab === t.id
                        ? "bg-[#A3E635] text-[#11181C] font-semibold"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-zinc-400">Interactive Preview // Test-Drive Workbench</span>
            </div>

            {landingTab === "schema" && (
              <div className="p-6 bg-[#07090E] space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px] uppercase">Table Schema: app_users</span>
                  <span className="text-[#A3E635] text-[10px] font-bold">ROW LEVEL SECURITY ACTIVE</span>
                </div>
                <div className="border border-[#262626] rounded overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#18181B] text-zinc-400 text-[10px] uppercase border-b border-[#262626]">
                      <tr>
                        <th className="p-2.5">Column</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Default</th>
                        <th className="p-2.5">Attributes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202024] text-zinc-300">
                      <tr>
                        <td className="p-2.5 text-white font-semibold">id</td>
                        <td className="p-2.5 text-[#A3E635]">uuid</td>
                        <td className="p-2.5 text-zinc-500">gen_random_uuid()</td>
                        <td className="p-2.5">PRIMARY KEY</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-white font-semibold">email</td>
                        <td className="p-2.5 text-amber-400">text</td>
                        <td className="p-2.5 text-zinc-500">NULL</td>
                        <td className="p-2.5">UNIQUE, NOT NULL</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-white font-semibold">embedding</td>
                        <td className="p-2.5 text-purple-400">vector(1536)</td>
                        <td className="p-2.5 text-zinc-500">NULL</td>
                        <td className="p-2.5">COSINE INDEXED</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {landingTab === "sql" && (
              <div className="p-6 bg-[#07090E] space-y-4 font-mono text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px] uppercase">SQL Query Scratchpad · Sample Output Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        setLandingRunning(true);
                        setTimeout(() => {
                          setLandingRunning(false);
                          setLandingLatency((0.6 + Math.random() * 0.4).toFixed(1) + "ms");
                          const q = landingSqlQuery.trim().replace(/;+$/, "");
                          const mathMatch = q.match(/^SELECT\s+(\d+)\s*([+\-*/])\s*(\d+)(?:\s+AS\s+([a-zA-Z_][a-zA-Z0-9_]*))?$/i);
                          if (mathMatch) {
                            const a = Number(mathMatch[1]);
                            const op = mathMatch[2];
                            const b = Number(mathMatch[3]);
                            const alias = mathMatch[4] || "?column?";
                            const val =
                              op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : b !== 0 ? a / b : "NaN";
                            setLandingSqlCustomResult({ columns: [alias], rows: [{ [alias]: String(val) }] });
                          } else if (/^SELECT\s+NOW\(\)/i.test(q)) {
                            setLandingSqlCustomResult({
                              columns: ["now"],
                              rows: [{ now: new Date().toISOString() }],
                            });
                          } else if (/^SELECT\s+VERSION\(\)/i.test(q)) {
                            setLandingSqlCustomResult({
                              columns: ["version"],
                              rows: [{ version: "PostgreSQL 16.4 (SparrowX Sovereign Cluster) + pgvector 0.7.0" }],
                            });
                          } else {
                            setLandingSqlCustomResult(null);
                          }
                        }, 180);
                      }}
                      className="px-3 py-1 rounded bg-[#A3E635] text-[#11181C] font-semibold text-xs hover:bg-[#84CC16] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {landingRunning ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3" />}
                      <span>{landingRunning ? "Running..." : "Run Query"}</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={landingSqlQuery}
                    onChange={(e) => setLandingSqlQuery(e.target.value)}
                    className="w-full p-3 rounded-md bg-[#18181B] border border-[#262626] text-[#A3E635] font-mono text-xs focus:outline-none focus:border-[#A3E635]"
                  />
                </div>

                <div className="border border-[#262626] rounded overflow-hidden">
                  <div className="bg-[#18181B] px-3 py-1.5 border-b border-[#262626] flex justify-between text-[10px] text-zinc-500">
                    <span>
                      {landingSqlCustomResult
                        ? `QUERY RESULTS (${landingSqlCustomResult.rows.length} ROW)`
                        : "SAMPLE OUTPUT PREVIEW (2 ROWS)"}
                    </span>
                    <span className="text-[#A3E635]">EXEC TIME: {landingLatency}</span>
                  </div>
                  <div className="p-3 bg-[#07090E] overflow-x-auto text-[11px] text-zinc-400">
                    {landingSqlCustomResult ? (
                      <div>
                        <div className="grid gap-2 text-white font-semibold border-b border-[#242428] pb-1.5 mb-1.5" style={{ gridTemplateColumns: `repeat(${landingSqlCustomResult.columns.length}, minmax(0, 1fr))` }}>
                          {landingSqlCustomResult.columns.map((col) => (
                            <span key={col}>{col}</span>
                          ))}
                        </div>
                        {landingSqlCustomResult.rows.map((row, rIdx) => (
                          <div key={rIdx} className="grid gap-2 py-1 text-[#A3E635]" style={{ gridTemplateColumns: `repeat(${landingSqlCustomResult.columns.length}, minmax(0, 1fr))` }}>
                            {landingSqlCustomResult.columns.map((col) => (
                              <span key={col} className="truncate">{row[col]}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 text-white font-semibold border-b border-[#242428] pb-1.5 mb-1.5">
                          <span>id</span>
                          <span>email</span>
                          <span>full_name</span>
                          <span>role</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-1">
                          <span className="truncate">usr_018f_492a</span>
                          <span className="truncate">founder@startup.io</span>
                          <span className="truncate">Sarah Chen</span>
                          <span className="text-[#A3E635]">admin</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 py-1">
                          <span className="truncate">usr_019c_88b1</span>
                          <span className="truncate">cto@fintech.co</span>
                          <span className="truncate">David Kumar</span>
                          <span className="text-[#A3E635]">operator</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {landingTab === "vector" && (
              <div className="p-6 bg-[#07090E] space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px] uppercase">Semantic Cosine Similarity (pgvector)</span>
                  <span className="text-purple-400 text-[10px]">DIMENSIONS: 1536</span>
                </div>
                <div className="p-3 rounded bg-[#18181B] border border-[#262626] space-y-1">
                  <code className="text-purple-400 block text-[11px]">
                    SELECT id, prompt_hash, 1 - (embedding &lt;=&gt; &apos;[0.012, -0.048, ...]&apos;) AS similarity FROM ai_embeddings ORDER BY embedding &lt;=&gt; &apos;[0.012, ...]&apos; LIMIT 2;
                  </code>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-[#18181B] border border-[#262626] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-white font-bold">Match #1 (vec-4891)</span>
                      <span className="text-[#A3E635] font-bold">98.4% Match</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">Cosine Distance: 0.016 • Latency: 1.1ms</p>
                  </div>
                  <div className="p-3 rounded bg-[#18181B] border border-[#262626] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-white font-bold">Match #2 (vec-2901)</span>
                      <span className="text-[#A3E635] font-bold">96.8% Match</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">Cosine Distance: 0.032 • Latency: 1.3ms</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 4-TIER PRICING SECTION (SCREENSHOT 12) */}
          <section id="db-pricing" className="scroll-mt-20 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Predictable Pricing. Zero Egress Shocks.
              </h2>
              <p className="text-sm text-zinc-400">
                Start free in seconds, or unlock dedicated bare-metal throughput for production workloads.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
              {PRICING_PLANS.map((tier) => {
                const isSelected = selectedPricingPlan === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`rounded-xl border p-6 flex flex-col justify-between transition-all ${
                      tier.highlighted
                        ? "border-[#A3E635]/60 bg-[#17191A] shadow-[0_0_40px_rgba(163,230,53,0.08)]"
                        : isSelected
                          ? "border-zinc-500 bg-[#161618]"
                          : "border-[#262626] bg-[#0A0D14]"
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white tracking-wider">
                            {tier.name}
                          </span>
                          {tier.badge && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-950 text-[10px] font-semibold">
                              {tier.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 min-h-[34px]">{tier.tagline}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPricingPlan(tier.id);
                          if (sessionUser) {
                            setActiveSection("settings");
                            setSettingsSubTab("billing");
                            setViewMode("studio");
                            emitEngineToast(
                              `Selected ${tier.name} plan (${tier.price}${tier.unit || ""}) — review in Subscription & Billing`,
                              "success",
                              "Plan Selected",
                            );
                          } else {
                            scrollToAuthCard("register");
                            emitEngineToast(
                              `Selected ${tier.name} plan — create your isolated account to continue`,
                              "info",
                              "Create Account",
                            );
                          }
                        }}
                        className={`w-full py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                          tier.id === "Enterprise"
                            ? "border border-[#2E2E2E] bg-[#1D1D21] hover:bg-[#26262B] text-white"
                            : "bg-[#65A30D] hover:bg-[#A3E635] hover:text-[#11181C] text-white border border-[#A3E635]/40"
                        }`}
                      >
                        {tier.cta}
                      </button>

                      <div className="border-b border-[#262626] pb-4 space-y-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold text-white font-mono">{tier.price}</span>
                          {tier.unit && <span className="text-xs text-zinc-400">{tier.unit}</span>}
                        </div>
                        {tier.subPrice && <p className="text-[11px] text-zinc-400">{tier.subPrice}</p>}
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="text-[11px] text-zinc-500">{tier.subHeader}</div>
                        <ul className="space-y-2">
                          {tier.features.map((feat, fIdx) => (
                            <li key={fIdx} className="flex items-start gap-2 text-zinc-200">
                              <Check className="size-3.5 text-[#A3E635] shrink-0 mt-0.5" />
                              <div>
                                <div>{feat.title}</div>
                                {feat.detail && (
                                  <div className="text-[11px] text-zinc-500">{feat.detail}</div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <PurchasePolicyNotice className="max-w-2xl mx-auto" />
          </section>
        </main>

        <SparrowxFooter />
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE 2: FULL SUPABASE STUDIO CONSOLE (studio)
  // STRICT AUTH GUARD: Studio console cannot be rendered without sessionUser
  // =========================================================================
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#05060A] text-[#F3F4F6] flex flex-col font-sans selection:bg-[#A3E635] selection:text-[#11181C] relative overflow-hidden">
        <AnimatedCloudBackground variant="emerald" intensity="subtle" />
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-red-500/30 bg-[#0A0D14] rounded-xl p-6 sm:p-8 space-y-5 text-center shadow-2xl">
            <div className="size-12 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 grid place-items-center mx-auto">
              <Lock className="size-6" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold">
                STRICT AUTHENTICATION REQUIRED
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Database Console Is Gated</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Anonymous access to PostgreSQL 16 clusters, schemas, and keys is prohibited. Please sign in to open your workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("landing")}
              className="w-full py-2.5 rounded-md bg-[#A3E635] text-[#11181C] font-semibold text-xs hover:bg-[#84CC16] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>Return to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar items — every single tab is backed by live PostgreSQL
  const PRIMARY_NAV_GROUPS: Array<{
    group: string;
    items: Array<{ id: StudioSection; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }>;
  }> = [
    {
      group: "Project",
      items: [
        { id: "overview", label: "Project Overview", icon: Home },
        { id: "tables", label: "Table Editor", icon: Table2 },
        { id: "sql", label: "SQL Editor", icon: Terminal },
      ],
    },
    {
      group: "Database",
      items: [
        { id: "database", label: "Database", icon: Database },
        { id: "backups", label: "Backups & DDL", icon: Archive },
        { id: "sandbox", label: "Connect & SDK", icon: Code2 },
      ],
    },
    {
      group: "Monitor",
      items: [
        { id: "pooler", label: "Observability", icon: Activity },
        { id: "auth", label: "Account & Access", icon: Users },
      ],
    },
    {
      group: "Settings",
      items: [
        { id: "settings", label: "Project Settings", icon: Settings },
      ],
    },
  ];

  // Filter tables by secondary search or top Ctrl+K search
  const visibleSidebarTables = studioTables.filter((t) => {
    const q = (tableSidebarFilter || studioSearchQuery).trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const isDatabaseOrBackups = activeSection === "database" || activeSection === "backups";
  const isSettingsOrApi = activeSection === "settings" || activeSection === "api";
  const effectiveSettingsTab = activeSection === "api" ? "api_keys" : settingsSubTab;
  const effectiveDatabaseTab = activeSection === "backups" ? "backups" : databaseSubTab;

  return (
    <div className="flex h-screen w-full flex-col bg-[#05060A] text-white font-sans selection:bg-[#A3E635] selection:text-black overflow-hidden">
      {/* STUDIO TOP BREADCRUMB & COMMAND HEADER */}
      <header className="h-12 border-b border-white/10 bg-[#05060A] px-3 sm:px-4 flex items-center justify-between shrink-0 gap-2 z-30">
        {/* Left Breadcrumbs + Real Database Selector + Connect */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setViewMode("landing")}
            className="flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-pointer shrink-0"
            title="SparrowX Cloud DB Landing"
          >
            <img src="/logos/sparrowx-db.png" alt="SparrowX Cloud DB — Managed PostgreSQL and pgvector Studio" width={30} height={30} className="size-7.5 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(62,207,142,0.3)]" />
          </button>

          <span className="text-zinc-600 font-light hidden sm:inline">/</span>

          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="font-medium text-zinc-200">{activeProject.organization}</span>
          </div>

          <span className="text-zinc-600 font-light hidden sm:inline">/</span>

          {/* Active Real PostgreSQL Database Selector / Status */}
          {provisionedDbsList.length > 1 ? (
            <select
              aria-label="Select provisioned PostgreSQL database"
              value={provisionedDb?.dbName || ""}
              onChange={(e) => {
                const picked = provisionedDbsList.find((d) => d.dbName === e.target.value);
                if (!picked) return;
                setProvisionedDb({
                  dbName: picked.dbName,
                  dbUser: picked.dbUser,
                  dbPassword: "",
                  dbHost: picked.dbHost,
                  dbPort: picked.dbPort,
                  connectionString: `postgresql://${picked.dbUser}:[ROTATE-TO-REVEAL]@${picked.dbHost}:${picked.dbPort}/${picked.dbName}?sslmode=prefer`,
                  planId: picked.planId,
                  planName: picked.planName,
                  storageLimitMb: picked.storageLimitMb,
                  maxConnections: picked.maxConnections,
                  sizePretty: picked.sizePretty,
                  usagePct: picked.usagePct,
                  activeConnections: picked.activeConnections,
                  status: picked.status,
                });
                setSelectedTable("");
                setRows([]);
                setSqlResults(null);
                setSqlError(null);
              }}
              className="h-7 rounded-md border border-[#A3E635]/40 bg-[#0A0D14] px-2 font-mono text-[11px] text-[#A3E635] focus:outline-none"
            >
              {provisionedDbsList.map((d) => (
                <option key={d.dbName} value={d.dbName}>
                  {d.dbName} ({d.sizePretty})
                </option>
              ))}
            </select>
          ) : provisionedDb ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A3E635]/35 bg-[#A3E635]/10 px-2.5 py-0.5 text-[11px] font-mono text-[#A3E635] truncate max-w-[200px]">
              <span className="size-1.5 rounded-full bg-[#A3E635]" />
              <span className="truncate">{provisionedDb.dbName}</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={provisioningDb}
              onClick={async () => {
                const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
                const created = await provisionIsolatedPgDatabase({
                  tenantId: tid,
                  userId: sessionUser.id,
                  email: sessionUser.email,
                  projectName: sessionUser.fullName,
                  planId: selectedDbPlanId,
                });
                if (created) {
                  await loadRealDatabasesAndHealth();
                  await refreshLiveSchema(created.dbName);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-0.5 text-[11px] font-mono text-amber-300 cursor-pointer disabled:opacity-50"
            >
              <Plus className="size-3" />
              <span>{provisioningDb ? "Provisioning..." : "Provision PostgreSQL DB"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#0A0D14] hover:border-[#A3E635]/40 px-2.5 py-1 text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
          >
            <Plug className="size-3.5 text-[#A3E635]" />
            <span>Connect</span>
          </button>
        </div>

        {/* Right Command Search & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden md:block">
            <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-2" />
            <input
              ref={studioSearchInputRef}
              type="text"
              value={studioSearchQuery}
              onChange={(e) => setStudioSearchQuery(e.target.value)}
              placeholder="Search tables..."
              aria-label="Search tables or press Ctrl+K"
              className="h-7 w-40 lg:w-48 rounded-md border border-white/15 bg-[#0A0D14] pl-8 pr-12 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#A3E635]"
            />
            <span className="absolute right-2 top-1.5 text-[10px] font-mono text-zinc-500 pointer-events-none">
              Ctrl K
            </span>
          </div>

          <button
            type="button"
            onClick={handleRunPingDiagnostics}
            disabled={pingStatus.testing}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#0A0D14] hover:border-white/30 px-2 py-1 text-xs text-zinc-300 cursor-pointer"
            title="Test live PostgreSQL cluster health (/api/db/health)"
          >
            <Activity className={`size-3.5 ${pingStatus.postgres !== null ? "text-[#A3E635]" : "text-amber-400"} ${pingStatus.testing ? "animate-spin" : ""}`} />
            <span className="font-mono text-[11px]">
              {pingStatus.postgres !== null ? `${pingStatus.postgres}ms` : "Probe PG"}
            </span>
          </button>

          {!isStandaloneDomain && onOpenClientArea && (
            <button
              type="button"
              onClick={() => onOpenClientArea()}
              className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/15 bg-[#0A0D14] hover:border-white/30 px-2.5 py-1 text-xs text-zinc-200 cursor-pointer"
            >
              <Boxes className="size-3.5 text-[#A3E635]" />
              <span>Client Area</span>
            </button>
          )}

          {/* Signed-in Avatar Pill */}
          <button
            type="button"
            onClick={() => navigateStudioSection("auth")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0A0D14] hover:border-[#A3E635]/50 px-2.5 py-1 text-xs cursor-pointer"
            title={`Signed in as ${sessionUser.email}`}
          >
            <span className="size-4 rounded-full bg-[#A3E635]/20 text-[#A3E635] font-mono text-[10px] font-bold grid place-items-center">
              {(sessionUser.fullName || sessionUser.email || "U").charAt(0).toUpperCase()}
            </span>
            <span className="hidden lg:inline font-mono text-[11px] text-zinc-200 max-w-[110px] truncate">
              {sessionUser.fullName || sessionUser.email}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLockWorkspace}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[#0A0D14] hover:border-white/35 px-2 py-1 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
            <span className="hidden xl:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* STATUS NOTIFICATION BAR */}
      {statusBanner && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b shrink-0 ${
            statusBanner.type === "success"
              ? "bg-[#A3E635]/10 border-[#A3E635]/30 text-[#A3E635]"
              : statusBanner.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === "success" ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 shrink-0" />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-zinc-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* PRIMARY LEFT NAVIGATION SIDEBAR (COLLAPSIBLE, SCREENSHOT 10 STYLE) */}
        <aside
          aria-label="Studio Navigation"
          className={`${
            sidebarCollapsed ? "w-13" : "w-13 md:w-52"
          } border-r border-[#2E2E2E] bg-[#080A10] flex flex-col justify-between shrink-0 transition-all`}
        >
          <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
            {PRIMARY_NAV_GROUPS.map((group, gIdx) => (
              <div
                key={group.group}
                className={gIdx > 0 ? "pt-2 border-t border-[#242424] space-y-0.5" : "space-y-0.5"}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    activeSection === item.id ||
                    (item.id === "settings" && activeSection === "api") ||
                    (item.id === "database" && activeSection === "backups");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateStudioSection(item.id)}
                      title={item.label}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-[#232326] text-white"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-[#1C1C1F]"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`size-4 shrink-0 ${active ? "text-[#A3E635]" : "text-zinc-400"}`} />
                        {!sidebarCollapsed && <span className="hidden md:inline truncate">{item.label}</span>}
                      </span>
                      {!sidebarCollapsed && item.badge && (
                        <span className="hidden md:inline-block px-1.5 py-0.2 rounded bg-lime-500/15 border border-lime-500/30 text-[9px] font-mono text-[#A3E635]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-[#242424] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-[#222222] cursor-pointer"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={handleSyncLiveDatabase}
                disabled={syncingCloud}
                className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-zinc-400 hover:text-[#A3E635] cursor-pointer"
                title="Refresh live PostgreSQL schema & health"
              >
                <RefreshCw className={`size-3 ${syncingCloud ? "animate-spin" : ""}`} />
                <span>Sync DB</span>
              </button>
            )}
          </div>
        </aside>

        {/* SECONDARY SIDEBARS */}
        {/* A. Table Editor Secondary Sidebar */}
        {activeSection === "tables" && (
          <aside className="hidden md:flex w-60 border-r border-[#2E2E2E] bg-[#080A10] flex-col shrink-0">
            <div className="p-3 border-b border-[#242424] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">Table Editor</span>
                <button
                  type="button"
                  onClick={() => {
                    void refreshLiveSchema();
                    if (selectedTable) void fetchTableRows(selectedTable);
                  }}
                  className="p-1 rounded hover:bg-[#242424] text-zinc-400 hover:text-white cursor-pointer"
                  title="Refresh live PostgreSQL schema"
                >
                  <RefreshCw className={`size-3.5 ${loading || schemaLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="rounded-md border border-[#2E2E2E] bg-[#1D1D1D] px-2.5 py-1.5 text-xs font-mono text-zinc-300 flex items-center justify-between">
                <span>schema public</span>
                <span className="text-[10px] text-zinc-500">{studioTables.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTableModal(true)}
                className="w-full flex items-center gap-1.5 rounded-md border border-[#2E2E2E] bg-[#1A1A1A] hover:bg-[#232323] px-2.5 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer"
              >
                <Plus className="size-3.5 text-[#A3E635]" />
                <span>New table</span>
              </button>
              <div className="relative">
                <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={tableSidebarFilter}
                  onChange={(e) => setTableSidebarFilter(e.target.value)}
                  placeholder="Search tables..."
                  className="w-full h-7 rounded-md border border-[#262626] bg-[#05060A] pl-8 pr-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#A3E635]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {visibleSidebarTables.length === 0 ? (
                <div className="p-3 text-[11px] font-mono text-zinc-500">
                  {schemaLoading
                    ? "Introspecting public schema..."
                    : provisionedDb
                      ? "No tables in public schema yet."
                      : "Provision a PostgreSQL database to view tables."}
                </div>
              ) : (
                visibleSidebarTables.map((t) => {
                  const count = tableCounts[t.name] ?? t.estimatedRows;
                  const isSelected = selectedTable === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setSelectedTable(t.name);
                        setCurrentPage(1);
                        setSearchFilter("");
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "bg-[#262629] text-white font-semibold border-l-2 border-[#A3E635]"
                          : "text-zinc-400 hover:bg-[#101520] hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table2 className={`size-3.5 shrink-0 ${isSelected ? "text-[#A3E635]" : "text-zinc-500"}`} />
                        <span className="truncate">{t.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0 ml-1">{count}</span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* B. SQL Editor Secondary Sidebar (Pure Manual Supabase Style) */}
        {activeSection === "sql" && (
          <aside className="hidden md:flex w-60 border-r border-[#2E2E2E] bg-[#080A10] flex-col shrink-0">
            <div className="p-3 border-b border-[#242424] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">SQL Editor</span>
                <span className="text-[10px] font-mono text-[#A3E635]">MANUAL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="size-3 text-zinc-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    value={sqlQueryFilter}
                    onChange={(e) => setSqlQueryFilter(e.target.value)}
                    placeholder="Search queries..."
                    className="w-full h-7 rounded-md border border-[#262626] bg-[#05060A] pl-7 pr-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#A3E635]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSql("-- Write manual PostgreSQL 16 SQL here\nSELECT current_database(), current_user, now();");
                    setSqlError(null);
                  }}
                  className="p-1.5 rounded-md border border-[#2E2E2E] bg-[#1D1D1D] hover:bg-[#262626] text-zinc-200 cursor-pointer"
                  title="New Query"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                  PRIVATE ({savedSqlQueries.length})
                </div>
                {savedSqlQueries.length === 0 ? (
                  <div className="rounded-lg border border-[#242428] bg-[#131315] p-3 text-[11px] text-zinc-500 space-y-1">
                    <div className="text-zinc-300 font-medium">No saved queries yet</div>
                    <p>Press Ctrl+S or click Save to pin a query here.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {savedSqlQueries.map((sq) => (
                      <div key={sq.id} className="flex items-center gap-1 group">
                        <button
                          type="button"
                          onClick={() => setActiveSql(sq.sql)}
                          className="flex-1 text-left px-2 py-1 rounded text-zinc-300 hover:bg-[#222222] font-mono text-[11px] truncate cursor-pointer"
                        >
                          {sq.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedSqlQuery(sq.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Delete saved query"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                  SQL QUICKSTART TEMPLATES
                </div>
                <div className="space-y-1">
                  {SQL_TEMPLATES.filter(
                    (t) =>
                      !sqlQueryFilter.trim() ||
                      t.label.toLowerCase().includes(sqlQueryFilter.toLowerCase()) ||
                      t.category.toLowerCase().includes(sqlQueryFilter.toLowerCase())
                  ).map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setActiveSql(tmpl.sql);
                        setSqlError(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-zinc-400 hover:text-white hover:bg-[#222222] cursor-pointer"
                    >
                      <FileText className="size-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{tmpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* C. Database Secondary Sidebar (Screenshot 8) */}
        {isDatabaseOrBackups && (
          <aside className="hidden md:flex w-56 border-r border-[#2E2E2E] bg-[#080A10] flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-[#242424] text-xs font-semibold text-white">
              Database
            </div>
            <div className="p-2.5 space-y-5 text-xs">
              <div>
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  DATABASE MANAGEMENT
                </div>
                {[
                  { id: "visualizer" as const, label: "Schema Visualizer" },
                  { id: "tables" as const, label: "Tables" },
                  { id: "functions" as const, label: "Functions" },
                  { id: "triggers" as const, label: "Triggers" },
                  { id: "extensions" as const, label: "Extensions" },
                  { id: "indexes" as const, label: "Indexes" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveSection("database");
                      setDatabaseSubTab(sub.id);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      effectiveDatabaseTab === sub.id
                        ? "bg-[#262629] text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101520]"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-[#242424] pt-3">
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  ACCESS CONTROL
                </div>
                {[
                  { id: "policies" as const, label: "Policies" },
                  { id: "roles" as const, label: "Roles" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveSection("database");
                      setDatabaseSubTab(sub.id);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      effectiveDatabaseTab === sub.id
                        ? "bg-[#262629] text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101520]"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-[#242424] pt-3">
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  PLATFORM
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("database");
                    setDatabaseSubTab("backups");
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                    effectiveDatabaseTab === "backups"
                      ? "bg-[#262629] text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101520]"
                  }`}
                >
                  Backups &amp; DDL Exports
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* D. Account & Access Secondary Sidebar */}
        {activeSection === "auth" && (
          <aside className="hidden md:flex w-56 border-r border-[#2E2E2E] bg-[#080A10] flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-[#242424] text-xs font-semibold text-white">
              Account &amp; Access
            </div>
            <div className="p-2.5 space-y-5 text-xs">
              <div>
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  INSTANCE &amp; PROFILE
                </div>
                {[
                  { id: "account" as const, label: "Database & Profile" },
                  { id: "sessions" as const, label: "Active Session" },
                  { id: "audit" as const, label: "PostgreSQL Audit Logs" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setAuthSubTab(sub.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      authSubTab === sub.id
                        ? "bg-[#262629] text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101520]"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* E. Settings Secondary Sidebar */}
        {isSettingsOrApi && (
          <aside className="hidden md:flex w-56 border-r border-[#2E2E2E] bg-[#080A10] flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-[#242424] text-xs font-semibold text-white">
              Settings
            </div>
            <div className="p-2.5 space-y-5 text-xs">
              <div>
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  CONFIGURATION
                </div>
                {[
                  { id: "general" as const, label: "General & Lifecycle" },
                  { id: "infrastructure" as const, label: "Infrastructure" },
                  { id: "api_keys" as const, label: "Credentials & URI" },
                  { id: "audit" as const, label: "Audit Trail" },
                  { id: "billing" as const, label: "Plan & Storage Quota" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveSection("settings");
                      setSettingsSubTab(sub.id);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      effectiveSettingsTab === sub.id
                        ? "bg-[#262629] text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101520]"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* MAIN CONTENT WORKSPACE */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#05060A] overflow-hidden">
          {/* =============================================================== */}
          {/* VIEW: PROJECT OVERVIEW (LIVE POSTGRESQL TELEMETRY)              */}
          {/* =============================================================== */}
          {activeSection === "overview" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!provisionedDb && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-amber-200">
                      Isolated PostgreSQL Database Not Provisioned Yet
                    </div>
                    <p className="text-xs text-zinc-300">
                      Provision your dedicated PostgreSQL 16 database and least-privilege role on the cluster to run SQL queries, create tables, and take snapshots.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={provisioningDb}
                    onClick={async () => {
                      const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
                      const created = await provisionIsolatedPgDatabase({
                        tenantId: tid,
                        userId: sessionUser.id,
                        email: sessionUser.email,
                        projectName: sessionUser.fullName,
                        planId: selectedDbPlanId,
                      });
                      if (created) {
                        await loadRealDatabasesAndHealth();
                        await refreshLiveSchema(created.dbName);
                        setStatusBanner({
                          type: "success",
                          message: `Provisioned dedicated PostgreSQL database ${created.dbName} (role: ${created.dbUser}).`,
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {provisioningDb ? "Provisioning PostgreSQL..." : "Provision PostgreSQL Database"}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {provisionedDb ? provisionedDb.dbName : activeProject.name}
                    </h1>
                    <span className="px-2 py-0.5 rounded bg-[#A3E635]/15 border border-[#A3E635]/30 text-[10px] font-mono text-[#A3E635] font-semibold">
                      {activeProject.cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span>
                      {activeProject.host}:{activeProject.port} • role {activeProject.dbUser}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText("overview-url", activeProject.directUri)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#2E2E2E] bg-[#1A1A1A] hover:bg-[#242424] text-[11px] text-zinc-300 cursor-pointer"
                    >
                      {copiedKey === "overview-url" ? <Check className="size-3 text-[#A3E635]" /> : <Copy className="size-3" />}
                      <span>Copy URI</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateStudioSection("sql")}
                    className="px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#0C0F17] hover:bg-[#232323] text-xs font-medium text-zinc-200 cursor-pointer"
                  >
                    Open SQL Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateStudioSection("tables")}
                    className="px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#0C0F17] hover:bg-[#232323] text-xs font-medium text-zinc-200 cursor-pointer"
                  >
                    Table Editor ({studioTables.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(true)}
                    className="px-3.5 py-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-semibold text-xs cursor-pointer"
                  >
                    Connect psql / SDK
                  </button>
                </div>
              </div>

              {/* Status 2x2 Cards (100% Live PostgreSQL Cluster Data) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    icon: CheckCircle2,
                    label: "CLUSTER STATUS",
                    value: clusterHealth?.ok ? "Online" : clusterHealth ? "Offline" : "Probing...",
                    sub: clusterHealth?.ok
                      ? `${clusterHealth.latencyMs}ms PG latency`
                      : clusterHealth?.error || "Checking /api/db/health",
                    accent: clusterHealth?.ok ? "text-[#A3E635]" : "text-amber-300",
                  },
                  {
                    icon: Cpu,
                    label: "ENGINE",
                    value: clusterHealth?.version || "PostgreSQL 16",
                    sub: `${clusterHealth?.pgvectorAvailable ? "pgvector Ready" : "Standard PG"} • ${studioTables.length} table(s)`,
                    accent: "text-white",
                  },
                  {
                    icon: HardDrive,
                    label: "DATABASE SIZE",
                    value: activeDbSummary?.sizePretty || provisionedDb?.sizePretty || "—",
                    sub: activeDbSummary
                      ? `${activeDbSummary.usagePct}% of ${activeDbSummary.storageLimitMb} MB quota`
                      : provisionedDb?.dbName || "Not provisioned",
                    accent: "text-white",
                  },
                  {
                    icon: Activity,
                    label: "CONNECTIONS",
                    value:
                      activeDbSummary !== null
                        ? `${activeDbSummary.activeConnections} / ${activeDbSummary.maxConnections}`
                        : `0 / ${activeProject.maxPoolSize}`,
                    sub: liveDbStats.cacheHitPct
                      ? `Cache hit ${liveDbStats.cacheHitPct}`
                      : "Isolated tenant role",
                    accent: "text-white",
                  },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex items-start gap-3"
                    >
                      <div className="size-9 rounded-lg border border-[#2A2A2E] bg-[#05060A] grid place-items-center shrink-0">
                        <Icon className="size-4 text-[#A3E635]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          {stat.label}
                        </div>
                        <div className={`text-sm font-semibold mt-0.5 truncate ${stat.accent}`}>{stat.value}</div>
                        <div className="text-[11px] text-zinc-500 truncate">{stat.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <TopologyClusterPanel
                region={clusterHealth?.originRegion || projectRegion}
                envLabel={activeProject.environment}
                pingMs={pingStatus.postgres}
                tableCount={studioTables.length}
                totalRows={Object.values(tableCounts).reduce((a, b) => a + b, 0)}
                host={activeProject.host}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-400">Public Schema Tables</div>
                    <div className="text-lg font-bold text-white font-mono mt-1">{studioTables.length} Tables</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateStudioSection("tables")}
                    className="px-2.5 py-1 rounded border border-[#2E2E2E] bg-[#101520] hover:text-[#A3E635] text-xs cursor-pointer"
                  >
                    Browse →
                  </button>
                </div>
                <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-400">Recorded Snapshots</div>
                    <div className="text-lg font-bold text-[#A3E635] font-mono mt-1">
                      {activeDbSummary?.backupCount ?? dbSnapshots.length}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateStudioSection("backups")}
                    className="px-2.5 py-1 rounded border border-[#2E2E2E] bg-[#101520] hover:text-[#A3E635] text-xs cursor-pointer"
                  >
                    Backups →
                  </button>
                </div>
                <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-400">Authenticated Operator</div>
                    <div className="text-sm font-semibold text-white font-mono mt-1 truncate max-w-[160px]">
                      {sessionUser.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateStudioSection("auth")}
                    className="px-2.5 py-1 rounded border border-[#2E2E2E] bg-[#101520] hover:text-[#A3E635] text-xs cursor-pointer"
                  >
                    Manage →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: TABLE EDITOR (SCREENSHOT 6)                               */}
          {/* =============================================================== */}
          {activeSection === "tables" && (
            <>
              {/* Open Table Tab Strip */}
              <div className="border-b border-[#242424] bg-[#080A10] px-3 pt-1.5 flex items-center gap-1 overflow-x-auto shrink-0">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-t-md bg-[#1D1D1F] border-t border-l border-r border-[#2E2E2E] text-xs font-mono text-white">
                  <Table2 className="size-3.5 text-[#A3E635]" />
                  <span>{selectedTable}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateTableModal(true)}
                  className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-[#101520] cursor-pointer"
                  title="Create new table"
                  aria-label="Create new table"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {/* Top Filter & Action Toolbar (Screenshot 6) */}
              <div className="border-b border-[#2E2E2E] bg-[#0C0F17] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <select
                    value={selectedTable}
                    onChange={(e) => {
                      setSelectedTable(e.target.value);
                      setCurrentPage(1);
                      setSearchFilter("");
                    }}
                    className="md:hidden bg-[#05060A] border border-[#2E2E2E] rounded px-2 py-1 text-xs text-white font-mono max-w-[140px]"
                    aria-label="Select database table"
                  >
                    {studioTables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.label} ({tableCounts[t.name] ?? "-"})
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <Search className="size-3 text-zinc-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder={`Filter ${selectedTable} by id, email, role...`}
                      value={searchFilter}
                      onChange={(e) => {
                        setSearchFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-7 w-44 sm:w-64 rounded-md border border-[#2E2E2E] bg-[#05060A] pl-7 pr-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#A3E635]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="hidden xl:inline-flex items-center gap-1 rounded-md border border-[#2E2E2E] bg-[#05060A] px-2 py-1 text-[11px] font-mono text-zinc-300">
                    Role {activeProject.dbUser}
                  </span>

                  {selectedTable && (
                    <button
                      type="button"
                      onClick={() => void handleDropTable(selectedTable)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 text-xs text-red-400 cursor-pointer"
                      title={`Drop table public.${selectedTable}`}
                    >
                      <Trash2 className="size-3" />
                      <span>Drop</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1 rounded-md border border-[#2E2E2E] bg-[#222222] hover:bg-[#2a2a2a] px-2 py-1 text-xs text-zinc-300 cursor-pointer"
                    title="Export as CSV"
                  >
                    <Download className="size-3" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1 rounded-md border border-[#2E2E2E] bg-[#222222] hover:bg-[#2a2a2a] px-2 py-1 text-xs text-zinc-300 cursor-pointer"
                    title="Export as JSON"
                  >
                    <Download className="size-3" />
                    <span>JSON</span>
                  </button>

                  <button
                    type="button"
                    disabled={!selectedTable}
                    onClick={() => {
                      setEditingRow(null);
                      setJsonDraft(JSON.stringify(activeTableMeta.defaultRow, null, 2));
                      setShowInsertModal(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] px-3 py-1 text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                    <span>Insert</span>
                  </button>
                </div>
              </div>

              {/* Semantic Responsive & Sortable Data Table (Screenshot 6) */}
              <div
                tabIndex={0}
                role="region"
                aria-label={`${selectedTable} records grid`}
                className="flex-1 overflow-auto bg-[#05060A]"
              >
                <table className="w-full border-collapse text-left text-xs font-mono min-w-[600px]">
                  <caption className="sr-only">{selectedTable} database records</caption>
                  <thead className="sticky top-0 z-10 bg-[#1A1A1A] border-b border-[#2E2E2E] text-zinc-400">
                    <tr>
                      <th scope="col" className="px-3 py-2 w-16 text-center border-r border-[#262626]">
                        Actions
                      </th>
                      {tableColumns.map((col) => {
                        const isSorted = sortColumn === col.name;
                        const ariaSortValue = isSorted
                          ? sortDirection === "asc"
                            ? ("ascending" as const)
                            : ("descending" as const)
                          : undefined;
                        return (
                          <th
                            key={col.name}
                            scope="col"
                            aria-sort={ariaSortValue}
                            className="p-0 border-r border-[#262626] select-none"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (sortColumn === col.name) {
                                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                                } else {
                                  setSortColumn(col.name);
                                  setSortDirection("asc");
                                }
                              }}
                              className="w-full min-h-[28px] px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#222222] text-zinc-200 font-semibold cursor-pointer focus-visible:outline focus-visible:outline-[#A3E635]"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                {col.isPrimary && <KeyRound className="size-3 text-[#A3E635] shrink-0" aria-hidden="true" />}
                                <span className="truncate">{col.name}</span>
                                <span className="text-[10px] font-normal text-zinc-500">{col.type}</span>
                              </span>
                              <ArrowUpDown className="size-3 text-zinc-500 shrink-0" aria-hidden="true" />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {loading ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1} className="p-8 text-center text-zinc-500">
                          <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#A3E635]" />
                          Querying table {selectedTable}...
                        </td>
                      </tr>
                    ) : !selectedTable ? (
                      <tr>
                        <td colSpan={Math.max(tableColumns.length + 1, 2)} className="p-8 text-center text-zinc-400">
                          <p className="mb-3">No tables created yet in this workspace.</p>
                          <button
                            type="button"
                            onClick={() => setShowCreateTableModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#A3E635] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bef264] cursor-pointer"
                          >
                            + New table
                          </button>
                        </td>
                      </tr>
                    ) : paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1} className="p-8 text-center text-zinc-500">
                          No records found in table {selectedTable}.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, i) => (
                        <tr key={i} className="hover:bg-[#1C1C1C] transition-colors group">
                          <td className="px-2 py-1.5 text-center border-r border-[#222222] whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRow(row);
                                  setJsonDraft(JSON.stringify(row, null, 2));
                                  setShowInsertModal(true);
                                }}
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                                title="Edit Row"
                                aria-label="Edit Row"
                              >
                                <Edit3 className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row)}
                                className="p-1 rounded hover:bg-red-950 text-red-400 hover:text-red-300 cursor-pointer"
                                title="Delete Row"
                                aria-label="Delete Row"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </td>
                          {tableColumns.map((col) => {
                            const val = row[col.name];
                            const formatted =
                              val === null || val === undefined
                                ? "NULL"
                                : typeof val === "object"
                                  ? JSON.stringify(val)
                                  : String(val);
                            return (
                              <td
                                key={col.name}
                                className={`px-3 py-2 border-r border-[#222222] max-w-[260px] truncate whitespace-nowrap ${
                                  val === null || val === undefined ? "text-zinc-600 italic" : "text-zinc-200"
                                }`}
                                title={formatted}
                              >
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="border-t border-[#2E2E2E] bg-[#0C0F17] px-4 py-2 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <div>
                  Showing {processedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} –{" "}
                  {Math.min(currentPage * pageSize, processedRows.length)} of {processedRows.length} rows
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* =============================================================== */}
          {/* VIEW: SQL EDITOR (PURE MANUAL SUPABASE-STYLE POSTGRESQL RUNNER) */}
          {/* =============================================================== */}
          {activeSection === "sql" && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#05060A] overflow-hidden">
              <div className="border-b border-[#2E2E2E] bg-[#080A10] px-4 py-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#222225] border border-[#2E2E2E] text-xs font-mono text-white">
                    <Terminal className="size-3 text-[#A3E635]" /> SQL Query Editor
                  </span>
                  {provisionedDb ? (
                    <span className="rounded bg-lime-500/10 border border-lime-500/30 text-[#A3E635] px-2 py-0.5 text-[10px] font-mono">
                      {provisionedDb.dbName} • {provisionedDb.dbUser}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 text-[10px] font-mono">
                      Not provisioned — Run will provision or click Provision DB
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label="Select SQL Template"
                    defaultValue=""
                    onChange={(e) => {
                      const t = SQL_TEMPLATES.find((x) => x.id === e.target.value);
                      if (t) {
                        setActiveSql(t.sql);
                        setSqlError(null);
                      }
                    }}
                    className="h-8 rounded-md border border-[#2E2E2E] bg-[#05060A] px-2.5 text-xs text-zinc-300 font-mono outline-none focus:border-[#A3E635]"
                  >
                    <option value="">Templates...</option>
                    {SQL_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        [{tmpl.category}] {tmpl.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveSql("");
                      setSqlError(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-[#2E2E2E] bg-[#1D1D20] hover:bg-[#27272B] text-zinc-300 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <span>Clear</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSqlQuery}
                    className="inline-flex items-center gap-1 rounded-md border border-[#2E2E2E] bg-[#1D1D20] hover:bg-[#27272B] text-zinc-200 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Save className="size-3.5" />
                    <span>Save Ctrl+S</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleExecuteSql()}
                    disabled={executingSql}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] px-3.5 py-1.5 text-xs font-bold shadow cursor-pointer disabled:opacity-50"
                  >
                    <Play className={`size-3.5 fill-current ${executingSql ? "animate-spin" : ""}`} />
                    <span>{executingSql ? "Running..." : "Run Ctrl ↵"}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                {/* Manual SQL Editor with Line Numbers (Zero AI Copilot) */}
                <div className="h-[50%] min-h-[200px] flex border-b border-[#2E2E2E] bg-[#07090E]">
                  <div className="w-10 py-3 bg-[#141417] border-r border-[#222226] text-right pr-2 font-mono text-[11px] text-zinc-600 select-none overflow-hidden">
                    {(activeSql || " ").split("\n").map((_, idx) => (
                      <div key={idx} className="leading-relaxed">
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={activeSql}
                    onChange={(e) => setActiveSql(e.target.value)}
                    onKeyDown={handleSqlKeyDown}
                    spellCheck={false}
                    placeholder="-- Write PostgreSQL 16 / pgvector SQL and press Ctrl+Enter to execute directly against your database..."
                    className="flex-1 p-3 bg-transparent text-[#A3E635] font-mono text-xs outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* History Strip */}
                <div className="border-b border-[#242424] bg-[#151517] px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <History className="size-3" /> Recent Runs:
                  </span>
                  <div className="flex items-center gap-3 overflow-x-auto ml-3">
                    {sqlHistory.length === 0 ? (
                      <span className="text-zinc-600">No queries executed yet in this session.</span>
                    ) : (
                      sqlHistory.slice(0, 4).map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setActiveSql(h.sql);
                            setSqlError(null);
                          }}
                          className={`truncate max-w-[200px] hover:text-white cursor-pointer ${
                            h.ok ? "text-zinc-400" : "text-red-400"
                          }`}
                        >
                          {h.ok ? "✓ " : "✕ "}
                          {h.sql.replace(/\s+/g, " ")}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Results | Chart | JSON Panel */}
                <div className="flex-1 flex flex-col bg-[#0A0D14] min-h-0">
                  <div className="border-b border-[#242428] bg-[#18181B] px-4 py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-4">
                      {[
                        { id: "grid" as const, label: "Results" },
                        { id: "chart" as const, label: "Chart" },
                        { id: "json" as const, label: "JSON" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSqlResultViewMode(tab.id)}
                          className={`pb-1 -mb-2 border-b-2 transition-colors cursor-pointer ${
                            sqlResultViewMode === tab.id
                              ? "border-white text-white font-semibold"
                              : "border-transparent text-zinc-400 hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {sqlError ? (
                      <span className="text-red-400 text-[11px] font-semibold">
                        ERROR{sqlError.pgCode ? ` (${sqlError.pgCode})` : ""}
                      </span>
                    ) : sqlExecutionStats ? (
                      <span className="text-[#A3E635] text-[11px]">
                        {sqlExecutionStats.command} • {sqlExecutionStats.rowCount} row(s) • {sqlExecutionStats.timeMs}ms
                        {sqlExecutionStats.truncated ? " (truncated at 500)" : ""}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 overflow-auto p-3">
                    {sqlError ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 font-mono text-xs space-y-2"
                      >
                        <div className="flex items-center gap-2 text-red-400 font-bold">
                          <AlertCircle className="size-4 shrink-0" />
                          <span>
                            PostgreSQL Error{sqlError.pgCode ? ` [SQLSTATE ${sqlError.pgCode}]` : ""}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap text-red-200 leading-relaxed">{sqlError.message}</pre>
                        {sqlError.detail && (
                          <div className="text-zinc-300">
                            <span className="text-zinc-500">DETAIL: </span>
                            {sqlError.detail}
                          </div>
                        )}
                        {sqlError.hint && (
                          <div className="text-amber-300">
                            <span className="text-zinc-500">HINT: </span>
                            {sqlError.hint}
                          </div>
                        )}
                        {sqlError.position && (
                          <div className="text-zinc-400">
                            <span className="text-zinc-500">POSITION: </span>
                            character {sqlError.position}
                          </div>
                        )}
                      </div>
                    ) : sqlResults === null ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs font-mono gap-1.5">
                        <span>
                          Click <strong className="text-zinc-300">Run (Ctrl+Enter)</strong> to execute SQL directly against{" "}
                          <span className="text-[#A3E635]">{provisionedDb?.dbName || "your PostgreSQL database"}</span>.
                        </span>
                        <span className="text-[11px] text-zinc-600">
                          All statements execute live on PostgreSQL 16 via /api/db/query.
                        </span>
                      </div>
                    ) : sqlResultViewMode === "grid" ? (
                      sqlResults.length === 0 ? (
                        <div className="rounded-lg border border-[#A3E635]/30 bg-[#141A17] p-4 font-mono text-xs space-y-1">
                          <div className="text-[#A3E635] font-semibold flex items-center gap-2">
                            <CheckCircle2 className="size-4" />
                            <span>
                              Success. No rows returned ({sqlExecutionStats?.command || "OK"} •{" "}
                              {sqlExecutionStats?.timeMs ?? 0}ms).
                            </span>
                          </div>
                          {sqlResultFields.length > 0 && (
                            <div className="text-zinc-400 text-[11px]">
                              Columns: {sqlResultFields.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-mono text-xs border border-[#242428]">
                            <thead className="bg-[#1B1B1F] border-b border-[#2E2E2E]">
                              <tr>
                                {(sqlResultFields.length > 0
                                  ? sqlResultFields
                                  : Object.keys(sqlResults[0] || {})
                                ).map((k) => (
                                  <th key={k} className="p-2 border-r border-[#262626] text-zinc-300 font-semibold">
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#202024]">
                              {sqlResults.map((r, idx) => {
                                const cols =
                                  sqlResultFields.length > 0 ? sqlResultFields : Object.keys(r);
                                return (
                                  <tr key={idx} className="hover:bg-[#1A1A1E]">
                                    {cols.map((colName) => {
                                      const v = r[colName];
                                      const formatted =
                                        v === null || v === undefined
                                          ? "NULL"
                                          : typeof v === "object"
                                            ? JSON.stringify(v)
                                            : String(v);
                                      return (
                                        <td
                                          key={colName}
                                          title={formatted}
                                          className={`p-2 border-r border-[#222226] truncate max-w-[260px] ${
                                            v === null || v === undefined ? "text-zinc-600 italic" : "text-zinc-300"
                                          }`}
                                        >
                                          {formatted}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : sqlResultViewMode === "chart" ? (
                      <div className="p-4 rounded-lg border border-[#242428] bg-[#111114] space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white">
                          <BarChart3 className="size-4 text-[#A3E635]" />
                          <span>Live Row Distribution Across Public Tables</span>
                        </div>
                        {studioTables.length === 0 ? (
                          <p className="text-xs font-mono text-zinc-500">
                            No tables in public schema yet. Run a CREATE TABLE statement to get started.
                          </p>
                        ) : (
                          <div className="space-y-2 font-mono text-[11px]">
                            {studioTables.slice(0, 10).map((t) => {
                              const count = tableCounts[t.name] ?? t.estimatedRows;
                              const maxCount = Math.max(
                                1,
                                ...studioTables.map((st) => tableCounts[st.name] ?? st.estimatedRows),
                              );
                              const pct = Math.min(100, Math.max(4, Math.round((count / maxCount) * 100)));
                              return (
                                <div key={t.name} className="flex items-center gap-3">
                                  <span className="w-36 truncate text-zinc-300">{t.name}</span>
                                  <div className="flex-1 h-3 rounded bg-[#1B1B1F] overflow-hidden">
                                    <div className="h-full bg-[#A3E635]/80 rounded" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-14 text-right text-[#A3E635]">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <pre className="text-xs font-mono text-[#A3E635] bg-[#07090E] p-4 rounded-lg overflow-x-auto border border-[#242428]">
                        {JSON.stringify(sqlResults, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: DATABASE & SCHEMA VISUALIZER & BACKUPS (SCREENSHOT 8)     */}
          {/* =============================================================== */}
          {isDatabaseOrBackups && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {effectiveDatabaseTab === "visualizer" && (
                <>
                  <div className="border-b border-[#2E2E2E] bg-[#0C0F17] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-[#05060A] border border-[#2E2E2E] font-mono text-zinc-200">
                        schema public
                      </span>
                      <div className="relative">
                        <Search className="size-3 text-zinc-500 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={schemaFindTable}
                          onChange={(e) => setSchemaFindTable(e.target.value)}
                          placeholder="Find table..."
                          className="h-7 w-44 rounded-md border border-[#2E2E2E] bg-[#05060A] pl-7 pr-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#A3E635]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyText("schema-ddl", buildFullSchemaDdl())}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-[#2E2E2E] bg-[#222222] hover:bg-[#2a2a2a] text-xs font-medium text-zinc-200 cursor-pointer"
                      >
                        {copiedKey === "schema-ddl" ? (
                          <Check className="size-3.5 text-[#A3E635]" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        <span>{copiedKey === "schema-ddl" ? "Copied SQL" : "Copy as SQL"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSchemaFindTable("");
                          setStatusBanner({ type: "info", message: "Schema Visualizer auto-layout aligned." });
                        }}
                        className="px-3 py-1 rounded-md border border-[#2E2E2E] bg-[#222222] hover:bg-[#2a2a2a] text-xs font-medium text-zinc-200 cursor-pointer"
                      >
                        Auto layout
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-6" style={DOT_GRID_STYLE}>
                    {studioTables.length === 0 ? (
                      <div className="max-w-md mx-auto mt-16 rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-6 text-center space-y-3">
                        <Database className="size-8 text-[#A3E635] mx-auto" />
                        <h3 className="text-sm font-bold text-white">No Tables in Public Schema</h3>
                        <p className="text-xs text-zinc-400">
                          {provisionedDb
                            ? `Your PostgreSQL database ${provisionedDb.dbName} is live and empty. Create a table visually or via the SQL Editor.`
                            : "Provision your isolated PostgreSQL database first to design and inspect tables."}
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCreateTableModal(true)}
                            className="px-3 py-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold text-xs cursor-pointer"
                          >
                            + New table
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateStudioSection("sql")}
                            className="px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#18181D] text-zinc-200 text-xs cursor-pointer"
                          >
                            Open SQL Editor
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl mx-auto">
                        {studioTables
                          .filter(
                            (t) =>
                              !schemaFindTable.trim() ||
                              t.name.toLowerCase().includes(schemaFindTable.toLowerCase())
                          )
                          .map((tbl) => (
                            <div
                              key={tbl.name}
                              className="rounded-lg border border-[#2E2E2E] bg-[#171719]/95 shadow-lg overflow-hidden font-mono text-xs"
                            >
                              <div className="px-3 py-2 bg-[#1D1D20] border-b border-[#2A2A2E] flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white font-semibold truncate">
                                  <Table2 className="size-3.5 text-[#A3E635] shrink-0" />
                                  <span className="truncate">{tbl.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTable(tbl.name);
                                    navigateStudioSection("tables");
                                  }}
                                  className="text-[10px] text-zinc-400 hover:text-[#A3E635] cursor-pointer shrink-0"
                                >
                                  Open →
                                </button>
                              </div>
                              <div className="divide-y divide-[#222226] max-h-56 overflow-y-auto">
                                {tbl.columns.map((col) => (
                                  <div
                                    key={col.name}
                                    className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                                  >
                                    <span className="flex items-center gap-1.5 text-zinc-300 truncate">
                                      {col.isPrimary ? (
                                        <KeyRound className="size-3 text-[#A3E635] shrink-0" />
                                      ) : (
                                        <span className="size-1.5 rounded-full bg-zinc-600 shrink-0 ml-1 mr-0.5" />
                                      )}
                                      <span className="truncate">{col.name}</span>
                                    </span>
                                    <span className="text-zinc-500 shrink-0">{col.udtName || col.dataType}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {effectiveDatabaseTab === "tables" && (
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Public Schema Tables ({studioTables.length})</h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshLiveSchema()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#18181D] text-zinc-200 text-xs cursor-pointer"
                      >
                        <RefreshCw className={`size-3.5 ${schemaLoading ? "animate-spin" : ""}`} /> Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateTableModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold text-xs cursor-pointer"
                      >
                        <Plus className="size-3.5" /> New table
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                        <tr>
                          <th className="p-3">Table</th>
                          <th className="p-3">Primary Key</th>
                          <th className="p-3">Columns</th>
                          <th className="p-3">Rows</th>
                          <th className="p-3">Disk Size</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232327]">
                        {studioTables.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-zinc-500">
                              No public tables found in {activeProject.dbName}.
                            </td>
                          </tr>
                        ) : (
                          studioTables.map((t) => (
                            <tr key={t.name} className="hover:bg-[#1E1E22]">
                              <td className="p-3 text-white font-semibold">{t.name}</td>
                              <td className="p-3 text-[#A3E635]">{t.primaryKey}</td>
                              <td className="p-3 text-zinc-300">{t.columns.length}</td>
                              <td className="p-3 text-zinc-300">{tableCounts[t.name] ?? t.estimatedRows}</td>
                              <td className="p-3 text-zinc-400">{t.sizePretty}</td>
                              <td className="p-3 text-right space-x-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTable(t.name);
                                    navigateStudioSection("tables");
                                  }}
                                  className="text-[#A3E635] hover:underline cursor-pointer"
                                >
                                  Inspect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDropTable(t.name)}
                                  className="text-red-400 hover:underline cursor-pointer"
                                >
                                  Drop
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(effectiveDatabaseTab === "extensions" ||
                effectiveDatabaseTab === "functions" ||
                effectiveDatabaseTab === "triggers" ||
                effectiveDatabaseTab === "indexes" ||
                effectiveDatabaseTab === "policies" ||
                effectiveDatabaseTab === "roles") && (
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-white capitalize">
                        Live PostgreSQL {effectiveDatabaseTab}
                      </h2>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        Queried live from system catalogs on {activeProject.dbName}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={catalogLoading}
                      onClick={() => void loadCatalogSubTab(effectiveDatabaseTab)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#18181D] hover:border-[#A3E635] text-zinc-200 text-xs font-mono cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${catalogLoading ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {catalogError ? (
                    <div className="rounded-xl border border-red-500/35 bg-red-950/25 p-4 text-xs font-mono text-red-300">
                      {catalogError}
                    </div>
                  ) : catalogLoading ? (
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-8 text-center text-xs font-mono text-zinc-400">
                      Querying PostgreSQL catalog...
                    </div>
                  ) : catalogRows.length === 0 ? (
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-8 text-center text-xs font-mono text-zinc-500 space-y-2">
                      <div>No {effectiveDatabaseTab} defined in public schema yet.</div>
                      <button
                        type="button"
                        onClick={() => navigateStudioSection("sql")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#A3E635] text-[#11181C] font-bold cursor-pointer"
                      >
                        Open SQL Editor
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                          <tr>
                            {Object.keys(catalogRows[0] || {}).map((k) => (
                              <th key={k} className="p-3 capitalize">
                                {k.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232327]">
                          {catalogRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#1E1E22]">
                              {Object.values(row).map((v, cIdx) => (
                                <td key={cIdx} className="p-3 text-zinc-200 max-w-md truncate" title={String(v ?? "NULL")}>
                                  {v === null || v === undefined ? (
                                    <span className="text-zinc-600 italic">NULL</span>
                                  ) : (
                                    String(v)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {effectiveDatabaseTab === "backups" && (
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Archive className="size-4 text-[#A3E635]" />
                        <span>Live Database Snapshots &amp; DDL Exports</span>
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1">
                        Record real PostgreSQL snapshots with SHA-256 schema digests via /api/db/lifecycle and export live schemas or data.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={snapshotLabel}
                        onChange={(e) => setSnapshotLabel(e.target.value)}
                        placeholder="Snapshot label..."
                        className="h-8 rounded-md border border-[#2E2E2E] bg-[#05060A] px-2.5 text-xs font-mono text-zinc-200 focus:border-[#A3E635] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={creatingSnapshot || !provisionedDb}
                        onClick={() => void handleCreateSnapshot()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-bold px-3.5 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                      >
                        <Archive className="size-3.5" />
                        <span>{creatingSnapshot ? "Recording..." : "Create Snapshot"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Recorded Snapshots Table */}
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-x-auto">
                    <div className="px-4 py-2.5 border-b border-[#242428] flex items-center justify-between text-xs font-mono">
                      <span className="text-white font-semibold">
                        Recorded Snapshots for {activeProject.dbName} ({dbSnapshots.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadBackupsAndAudit()}
                        className="text-zinc-400 hover:text-[#A3E635] cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                        <tr>
                          <th className="p-3">Snapshot ID</th>
                          <th className="p-3">Label</th>
                          <th className="p-3">Size</th>
                          <th className="p-3">Tables</th>
                          <th className="p-3">SHA-256</th>
                          <th className="p-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232327]">
                        {dbSnapshots.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-zinc-500">
                              No snapshots recorded yet. Click "Create Snapshot" to capture your database state.
                            </td>
                          </tr>
                        ) : (
                          dbSnapshots.map((s) => (
                            <tr key={s.id} className="hover:bg-[#1E1E22]">
                              <td className="p-3 text-[#A3E635] font-semibold">{s.id}</td>
                              <td className="p-3 text-white">{s.label}</td>
                              <td className="p-3 text-zinc-300">{s.sizePretty}</td>
                              <td className="p-3 text-zinc-300">{s.tableCount}</td>
                              <td className="p-3 text-zinc-500">{s.checksumSha256.slice(0, 14)}…</td>
                              <td className="p-3 text-zinc-400">{s.createdAt.slice(0, 19).replace("T", " ")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-5 space-y-3">
                      <FileCode className="size-5 text-[#A3E635]" />
                      <h3 className="font-bold text-white text-sm">Live Schema DDL (.sql)</h3>
                      <p className="text-xs text-zinc-400">
                        Exports CREATE TABLE definitions for all {studioTables.length} live public table(s).
                      </p>
                      <button
                        type="button"
                        onClick={handleExportFullSchemaSql}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold px-3 py-2 text-xs cursor-pointer"
                      >
                        <Download className="size-3.5" /> Export Schema (.sql)
                      </button>
                    </div>

                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-5 space-y-3">
                      <Database className="size-5 text-blue-400" />
                      <h3 className="font-bold text-white text-sm">Live Data Dump (.json)</h3>
                      <p className="text-xs text-zinc-400">Queries all live tables in {activeProject.dbName} and downloads JSON.</p>
                      <button
                        type="button"
                        onClick={() => void handleExportFullDatabaseJson()}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[#2E2E2E] bg-[#222225] hover:bg-[#2a2a2f] text-white font-semibold px-3 py-2 text-xs cursor-pointer"
                      >
                        <Download className="size-3.5" /> Export All Data (.json)
                      </button>
                    </div>

                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-5 space-y-3">
                      <Table2 className="size-5 text-amber-400" />
                      <h3 className="font-bold text-white text-sm">Active Table CSV</h3>
                      <p className="text-xs text-zinc-400">
                        Download spreadsheet-ready CSV of <span className="text-[#A3E635] font-mono">{selectedTable || "no table selected"}</span>.
                      </p>
                      <button
                        type="button"
                        disabled={!selectedTable}
                        onClick={handleExportCsv}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[#2E2E2E] bg-[#222225] hover:bg-[#2a2a2f] text-white font-semibold px-3 py-2 text-xs cursor-pointer disabled:opacity-40"
                      >
                        <Download className="size-3.5" /> Download {selectedTable || "table"}.csv
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: ACCOUNT, ISOLATED DB CREDENTIALS & AUDIT LOGS             */}
          {/* =============================================================== */}
          {activeSection === "auth" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 space-y-6">
              {(authSubTab === "account" || authSubTab === "users") && (
                <>
                  {/* Dedicated Isolated PostgreSQL Database Card */}
                  <div className="rounded-xl border border-[#A3E635]/30 bg-[#0A0D14] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262629] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Database className="size-4 text-[#A3E635]" />
                        <span className="text-xs font-bold text-white font-mono">
                          Dedicated Isolated PostgreSQL Database (Per-User Instance)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Database Plan Tier"
                          value={selectedDbPlanId}
                          onChange={(e) => setSelectedDbPlanId(e.target.value)}
                          className="rounded bg-[#101013] border border-[#2E2E34] px-2 py-1 text-[11px] font-mono text-zinc-200 focus:border-[#A3E635] focus:outline-none"
                        >
                          <option value="db-free">Sandbox (₹0 • 500MB • 10 conns)</option>
                          <option value="db-starter">Starter (₹399/mo • 10GB • 35 conns)</option>
                          <option value="db-pro">Pro Vector (₹1,199/mo • 50GB • 100 conns)</option>
                          <option value="db-enterprise">Enterprise (₹3,999/mo • 250GB • 300 conns)</option>
                        </select>
                        {provisionedDb && (
                          <button
                            type="button"
                            disabled={creatingSnapshot}
                            onClick={() => void handleCreateSnapshot("Manual Studio Snapshot")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181D] border border-[#2E2E34] hover:border-[#A3E635] text-zinc-200 font-bold text-[11px] font-mono cursor-pointer disabled:opacity-50"
                          >
                            <span>{creatingSnapshot ? "Snapshotting..." : "Snapshot"}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={provisioningDb || rotatingPassword}
                          onClick={async () => {
                            if (provisionedDb) {
                              await handleRotateDbPassword();
                              return;
                            }
                            const tid = sessionUser.tenantId || `TNT-${sessionUser.id}`;
                            const res = await provisionIsolatedPgDatabase({
                              tenantId: tid,
                              userId: sessionUser.id,
                              email: sessionUser.email,
                              projectName: sessionUser.fullName,
                              planId: selectedDbPlanId,
                            });
                            if (res) {
                              await loadRealDatabasesAndHealth();
                              await refreshLiveSchema(res.dbName);
                              setStatusBanner({
                                type: "success",
                                message: `Provisioned dedicated PostgreSQL database ${res.dbName} (role: ${res.dbUser}).`,
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-bold text-[11px] font-mono cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`size-3 ${provisioningDb || rotatingPassword ? "animate-spin" : ""}`} />
                          <span>
                            {provisioningDb
                              ? "Provisioning..."
                              : rotatingPassword
                                ? "Rotating..."
                                : provisionedDb
                                  ? "Rotate DB Password"
                                  : "Provision Dedicated DB"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {provisionedDb ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                        <div className="rounded bg-[#101013] border border-[#26262A] p-2.5">
                          <span className="text-[10px] text-zinc-500 uppercase block">Database Name</span>
                          <span className="text-[#A3E635] font-bold">{provisionedDb.dbName}</span>
                        </div>
                        <div className="rounded bg-[#101013] border border-[#26262A] p-2.5">
                          <span className="text-[10px] text-zinc-500 uppercase block">Dedicated Role</span>
                          <span className="text-white font-semibold">{provisionedDb.dbUser}</span>
                        </div>
                        <div className="rounded bg-[#101013] border border-[#26262A] p-2.5">
                          <span className="text-[10px] text-zinc-500 uppercase block">Endpoint</span>
                          <span className="text-zinc-200">{provisionedDb.dbHost}:{provisionedDb.dbPort}</span>
                        </div>
                        <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-2 rounded bg-[#07090E] border border-[#26262A] px-3 py-2">
                          <code className="text-[11px] text-zinc-300 break-all">
                            {provisionedDb.connectionString}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              copyText("auth-uri", provisionedDb.connectionString);
                              setStatusBanner({
                                type: "success",
                                message: "Copied dedicated PostgreSQL connection URI to clipboard.",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#18181D] border border-[#2E2E34] text-[10px] text-white hover:border-[#A3E635] cursor-pointer shrink-0"
                          >
                            <Copy className="size-3" />
                            <span>Copy URI</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 font-mono">
                        No dedicated database provisioned yet. Click{" "}
                        <span className="text-[#A3E635]">Provision Dedicated DB</span> to create your isolated PostgreSQL database and role on the server.
                      </p>
                    )}
                  </div>

                  {/* Account Profile & Admin Provisioning Panel */}
                  <div id="provision-user-panel" className={`grid grid-cols-1 ${isPlatformAdmin ? "xl:grid-cols-2" : ""} gap-4`}>
                    <form
                      onSubmit={handleUpdateOwnAccount}
                      className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262629] pb-2.5">
                        <div className="flex items-center gap-2">
                          <UserCheck className="size-4 text-[#A3E635]" />
                          <span className="text-xs font-bold text-white font-mono">
                            My Database Account &amp; Profile
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-lime-500/15 border border-lime-500/30 text-[#A3E635] font-mono text-[10px] font-bold">
                          {sessionUser.admin === "yes" ? "SUPERUSER" : "ISOLATED DEVELOPER"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase block mb-1">Signed-In Email</label>
                          <input
                            type="email"
                            disabled
                            value={sessionUser.email}
                            className="w-full px-2.5 py-1.5 rounded bg-[#101013] border border-[#26262A] text-zinc-400 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label htmlFor="studio-account-display-name" className="text-[10px] text-zinc-400 uppercase block mb-1">Display Name</label>
                          <input
                            id="studio-account-display-name"
                            name="displayName"
                            type="text"
                            autoComplete="name"
                            required
                            value={accountDisplayName}
                            onChange={(e) => setAccountDisplayName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                        </div>
                        <div>
                          <label htmlFor="studio-account-new-password" className="text-[10px] text-zinc-400 uppercase block mb-1">
                            New Password (optional)
                          </label>
                          <input
                            id="studio-account-new-password"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            minLength={6}
                            value={accountNewPassword}
                            onChange={(e) => setAccountNewPassword(e.target.value)}
                            placeholder="6+ chars"
                            className="w-full px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={savingAccount}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          <Save className="size-3.5" />
                          <span>{savingAccount ? "Saving..." : "Save Profile & Password"}</span>
                        </button>
                      </div>
                    </form>

                    {isPlatformAdmin && (
                      <form
                        onSubmit={handleProvisionDatabaseUser}
                        className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262629] pb-2.5">
                          <div className="flex items-center gap-2">
                            <UserPlus className="size-4 text-[#A3E635]" />
                            <span className="text-xs font-bold text-white font-mono">
                              Provision New Developer Account + Isolated DB
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400">ADMIN ONLY</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs font-mono">
                          <input
                            type="text"
                            name="newUserFullName"
                            autoComplete="name"
                            required
                            value={newUserFullName}
                            onChange={(e) => setNewUserFullName(e.target.value)}
                            placeholder="Full Name"
                            className="px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                          <input
                            type="email"
                            name="newUserEmail"
                            autoComplete="email"
                            spellCheck={false}
                            required
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="dev@company.com"
                            className="px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                          <input
                            type="password"
                            name="newUserPassword"
                            autoComplete="new-password"
                            required
                            minLength={6}
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Password (6+)"
                            className="px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                          <select
                            aria-label="New user role"
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value === "yes" ? "yes" : "no")}
                            className="px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          >
                            <option value="no">Developer</option>
                            <option value="yes">Admin</option>
                          </select>
                          <input
                            type="text"
                            value={newUserTenantId}
                            onChange={(e) => setNewUserTenantId(e.target.value)}
                            placeholder="Tenant ID"
                            className="px-2.5 py-1.5 rounded bg-[#101013] border border-[#2E2E2E] text-white focus:outline-none focus:border-[#A3E635]"
                          />
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="submit"
                            disabled={creatingAccount}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-zinc-200 text-black font-bold text-xs cursor-pointer disabled:opacity-50"
                          >
                            <UserPlus className="size-3.5" />
                            <span>{creatingAccount ? "Creating..." : "Create User & DB"}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}

              {authSubTab === "sessions" && (
                <div className="space-y-4 max-w-4xl">
                  <h2 className="text-lg font-bold text-white">Active Session Claims</h2>
                  <pre className="rounded-xl border border-[#2E2E2E] bg-[#161618] p-4 font-mono text-xs text-[#A3E635] overflow-x-auto">
                    {JSON.stringify(
                      verifySessionToken() || {
                        sub: sessionUser.id,
                        email: sessionUser.email,
                        role: sessionUser.admin === "yes" ? "admin" : "client",
                        tenantId: sessionUser.tenantId,
                        database: provisionedDb?.dbName || null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}

              {authSubTab === "audit" && (
                <div className="space-y-4 max-w-5xl">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Live PostgreSQL Audit Logs ({dbAuditLogs.length})</h2>
                    <button
                      type="button"
                      onClick={() => void loadBackupsAndAudit()}
                      className="px-3 py-1.5 rounded border border-[#2E2E2E] bg-[#18181D] text-xs font-mono text-zinc-200 cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Database</th>
                          <th className="p-3">Actor</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232327]">
                        {dbAuditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-zinc-500">
                              No audit log entries recorded yet for {activeProject.dbName}.
                            </td>
                          </tr>
                        ) : (
                          dbAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#1E1E22]">
                              <td className="p-3 text-zinc-400 whitespace-nowrap">{log.createdAt.slice(0, 19).replace("T", " ")}</td>
                              <td className="p-3 text-[#A3E635] font-semibold">{log.action}</td>
                              <td className="p-3 text-zinc-300">{log.dbName}</td>
                              <td className="p-3 text-zinc-300">{log.actor}</td>
                              <td className="p-3 text-zinc-200">{log.status}</td>
                              <td className="p-3 text-zinc-400 max-w-md truncate" title={log.detail}>{log.detail}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: CONNECT & LIVE POSTGRESQL QUERY TEST                      */}
          {/* =============================================================== */}
          {activeSection === "sandbox" && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#05060A] overflow-hidden">
              <div className="border-b border-[#2E2E2E] bg-[#0C0F17] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Code2 className="size-4 text-[#A3E635]" />
                  <span className="font-bold text-sm text-white">Direct PostgreSQL Connection &amp; Live Query Probe</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Target Table:</span>
                  <select
                    aria-label="Target query table"
                    value={sandboxSelectedTable}
                    onChange={(e) => setSandboxSelectedTable(e.target.value)}
                    className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs font-mono text-zinc-200"
                  >
                    <option value="">(Database version &amp; role check)</option>
                    {studioTables.map((t) => (
                      <option key={t.name} value={t.name}>
                        public.{t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleTestSandboxEndpoint()}
                    disabled={sandboxLoading}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Send className="size-3" />
                    <span>{sandboxLoading ? "Querying..." : "Run Live Query"}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
                <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-[#2E2E2E] bg-[#101014] min-h-0">
                  <div className="border-b border-[#222222] bg-[#16161C] px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {(["node", "psql", "python", "prisma"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSandboxTab(tab)}
                          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer uppercase ${
                            sandboxTab === tab ? "bg-[#A3E635] text-[#11181C] font-bold" : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyText(`snippet-${sandboxTab}`, sandboxSnippets[sandboxTab])}
                      className="inline-flex items-center gap-1 text-[11px] text-[#A3E635] hover:underline cursor-pointer"
                    >
                      {copiedKey === `snippet-${sandboxTab}` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      <span>{copiedKey === `snippet-${sandboxTab}` ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="flex-1 p-4 bg-[#0B0B0E] overflow-auto">
                    <pre className="font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {sandboxSnippets[sandboxTab]}
                    </pre>
                  </div>
                </div>

                <div className="flex flex-col bg-[#121216] min-h-0 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span className="text-white font-semibold">Live PostgreSQL Response (/api/db/query)</span>
                    {sandboxLatency !== null && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] border ${
                          sandboxStatusOk
                            ? "bg-lime-500/10 border-lime-500/30 text-[#A3E635]"
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}
                      >
                        {sandboxStatusOk ? "OK" : "ERROR"} • {sandboxLatency}ms
                      </span>
                    )}
                  </div>
                  <div className="flex-1 rounded-xl border border-[#2E2E2E] bg-[#0B0B0D] p-3 overflow-auto">
                    <pre
                      className={`font-mono text-xs leading-relaxed ${
                        sandboxStatusOk === false ? "text-red-300" : "text-[#A3E635]"
                      }`}
                    >
                      {sandboxResponse ||
                        `// Click "Run Live Query" to execute a real SELECT against ${activeProject.dbName}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: LIVE POSTGRESQL OBSERVABILITY                             */}
          {/* =============================================================== */}
          {activeSection === "pooler" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="size-4 text-[#A3E635]" />
                    <span>Live PostgreSQL Observability &amp; Activity</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Measured directly from /api/db/health, /api/db/summary, pg_stat_database, and pg_stat_activity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void loadRealDatabasesAndHealth();
                    void loadLiveObservability();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#18181D] hover:border-[#A3E635] text-xs font-mono text-zinc-200 cursor-pointer"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Refresh Metrics</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Active / Max Conns",
                    val: activeDbSummary
                      ? `${activeDbSummary.activeConnections} / ${activeDbSummary.maxConnections}`
                      : `0 / ${activeProject.maxPoolSize}`,
                    sub: `Cluster total: ${clusterHealth?.activeConnections ?? "—"}`,
                  },
                  {
                    label: "Database Disk Size",
                    val: activeDbSummary?.sizePretty || "—",
                    sub: activeDbSummary
                      ? `${activeDbSummary.usagePct}% of ${activeDbSummary.storageLimitMb} MB`
                      : "Provision DB to measure",
                  },
                  {
                    label: "Buffer Cache Hit",
                    val: liveDbStats.cacheHitPct || "—",
                    sub: "Live pg_stat_database",
                  },
                  {
                    label: "Cluster Latency",
                    val: clusterHealth?.ok ? `${clusterHealth.latencyMs}ms` : "—",
                    sub: clusterHealth?.pgvectorAvailable ? "pgvector enabled" : "PostgreSQL",
                  },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-1">
                    <div className="text-xs text-zinc-400">{m.label}</div>
                    <div className="text-xl font-bold text-[#A3E635] font-mono">{m.val}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Live pg_stat_activity Table */}
              <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-x-auto">
                <div className="px-4 py-2.5 border-b border-[#242428] text-xs font-mono text-white font-semibold">
                  Active Database Sessions (pg_stat_activity on {activeProject.dbName})
                </div>
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                    <tr>
                      <th className="p-3">PID</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">State</th>
                      <th className="p-3">Started</th>
                      <th className="p-3">Query</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232327]">
                    {liveDbStats.activeQueries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-500">
                          No active sessions reported for {activeProject.dbName}.
                        </td>
                      </tr>
                    ) : (
                      liveDbStats.activeQueries.map((q, idx) => (
                        <tr key={idx} className="hover:bg-[#1E1E22]">
                          <td className="p-3 text-[#A3E635]">{String(q.pid ?? "-")}</td>
                          <td className="p-3 text-white">{String(q.usename ?? "-")}</td>
                          <td className="p-3 text-zinc-300">{String(q.state ?? "-")}</td>
                          <td className="p-3 text-zinc-400">{String(q.started_at ?? "-").slice(0, 19)}</td>
                          <td className="p-3 text-zinc-300 max-w-md truncate">{String(q.query ?? "")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <TopologyClusterPanel
                region={clusterHealth?.originRegion || projectRegion}
                envLabel={activeProject.environment}
                pingMs={pingStatus.postgres}
                tableCount={studioTables.length}
                totalRows={Object.values(tableCounts).reduce((a, b) => a + b, 0)}
                host={activeProject.host}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW: PROJECT SETTINGS (SCREENSHOTS 1, 2, 3, 4, 5)              */}
          {/* =============================================================== */}
          {isSettingsOrApi && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* GENERAL SETTINGS (SCREENSHOTS 4 & 5) */}
              {effectiveSettingsTab === "general" && (
                <div className="max-w-4xl space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">General settings</h2>
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] divide-y divide-[#262626]">
                      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-5">
                          <div className="text-xs font-medium text-white">Project name</div>
                          <div className="text-[11px] text-zinc-500">Displayed throughout the dashboard.</div>
                        </div>
                        <div className="md:col-span-7">
                          <input
                            type="text"
                            value={projectDisplayName}
                            onChange={(e) => setProjectDisplayName(e.target.value)}
                            className="w-full h-9 rounded-md border border-[#2E2E2E] bg-[#05060A] px-3 text-xs text-zinc-100 focus:outline-none focus:border-[#A3E635]"
                          />
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-5">
                          <div className="text-xs font-medium text-white">Project ID</div>
                          <div className="text-[11px] text-zinc-500">Reference used in APIs and URLs.</div>
                        </div>
                        <div className="md:col-span-7 flex items-center gap-2">
                          <input
                            type="text"
                            disabled
                            value={activeProject.id}
                            className="flex-1 h-9 rounded-md border border-[#262626] bg-[#05060A] px-3 font-mono text-xs text-zinc-400"
                          />
                          <button
                            type="button"
                            onClick={() => copyText("prj-id", activeProject.id)}
                            className="h-9 px-3 rounded-md border border-[#2E2E2E] bg-[#1D1D20] hover:bg-[#27272B] text-xs text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === "prj-id" ? <Check className="size-3.5 text-[#A3E635]" /> : <Copy className="size-3.5" />}
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-5">
                          <div className="text-xs font-medium text-white">Project region</div>
                          <div className="text-[11px] text-zinc-500">Cluster geographic affinity</div>
                        </div>
                        <div className="md:col-span-7 flex items-center gap-2">
                          <select
                            aria-label="Project region"
                            value={projectRegion}
                            onChange={(e) =>
                              setProjectRegion(
                                e.target.value as "ap-southeast-2" | "ap-south-1" | "eu-central-1"
                              )
                            }
                            className="flex-1 h-9 rounded-md border border-[#2E2E2E] bg-[#05060A] px-3 font-mono text-xs text-zinc-200"
                          >
                            <option value="ap-southeast-2">ap-southeast-2 — Australia (Sydney · Primary Origin)</option>
                            <option value="ap-south-1">ap-south-1 — South Asia (Chennai / Mumbai)</option>
                            <option value="eu-central-1">eu-central-1 — Central Europe (Frankfurt)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => copyText("prj-region", projectRegion)}
                            className="h-9 px-3 rounded-md border border-[#2E2E2E] bg-[#1D1D20] hover:bg-[#27272B] text-xs text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === "prj-region" ? <Check className="size-3.5 text-[#A3E635]" /> : <Copy className="size-3.5" />}
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.setItem(`spx_project_name_${tenantSlug}`, projectDisplayName);
                              localStorage.setItem(`spx_project_region_${tenantSlug}`, projectRegion);
                            } catch {
                              // Ignore storage errors
                            }
                            setStatusBanner({
                              type: "success",
                              message: `Saved project settings (${projectDisplayName} in ${projectRegion}).`,
                            });
                          }}
                          className="px-4 py-1.5 rounded-md bg-[#65A30D] hover:bg-[#A3E635] hover:text-[#11181C] text-white font-semibold text-xs border border-[#A3E635]/40 cursor-pointer"
                        >
                          Save changes
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Project Access (Screenshot 5) */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-white">Project access</h3>
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-hidden">
                      <div className="p-4 border-b border-[#262626] flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-medium text-white">Organization-wide access</div>
                          <div className="text-[11px] text-zinc-400">
                            Organization operators with verified session credentials can manage this cluster.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateStudioSection("auth")}
                          className="px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#222225] hover:bg-[#2B2B30] text-xs text-zinc-200 cursor-pointer"
                        >
                          Manage members
                        </button>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 text-white">
                          <span>{sessionUser.email}</span>
                          <span className="px-1.5 py-0.5 rounded border border-[#2E2E2E] bg-[#242428] text-[10px] text-zinc-400">
                            YOU
                          </span>
                        </div>
                        <span className="text-zinc-300">Owner</span>
                      </div>
                    </div>
                  </div>

                  {/* Database Lifecycle Actions (Suspend / Resume / Delete / Sign Out) */}
                  <div className="space-y-4">
                    {provisionedDb && (
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-white">PostgreSQL Instance Lifecycle</h3>
                        <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-white font-mono">
                              {provisionedDb.dbName} — Status: {activeDbSummary?.status || provisionedDb.status || "Active"}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Suspending revokes LOGIN on role {provisionedDb.dbUser} and terminates active sessions immediately.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(activeDbSummary?.status || provisionedDb.status) === "Suspended" ? (
                              <button
                                type="button"
                                disabled={lifecycleBusy}
                                onClick={() => void handleDbLifecycleAction("resume")}
                                className="px-3 py-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold text-xs cursor-pointer disabled:opacity-50"
                              >
                                Resume Database
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={lifecycleBusy}
                                onClick={() => void handleDbLifecycleAction("suspend")}
                                className="px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold text-xs cursor-pointer disabled:opacity-50"
                              >
                                Suspend Database
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={lifecycleBusy}
                              onClick={() => void handleDbLifecycleAction("deprovision")}
                              className="px-3 py-1.5 rounded-md border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-300 font-semibold text-xs cursor-pointer disabled:opacity-50"
                            >
                              Drop Database
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-white">Workspace Session</h3>
                      <div className="rounded-xl border border-red-500/35 bg-[#1B1314] p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="size-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-white">
                              Signing out locks Studio immediately
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Your PostgreSQL database remains running on the cluster; sign back in anytime to resume.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleLockWorkspace}
                          className="px-3.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold text-xs cursor-pointer"
                        >
                          Lock &amp; Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INFRASTRUCTURE TELEMETRY */}
              {effectiveSettingsTab === "infrastructure" && (
                <div className="max-w-5xl space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Infrastructure</h2>
                    <p className="text-xs text-zinc-400">
                      Live PostgreSQL cluster node info and measured health metrics.
                    </p>
                  </div>
                  <TopologyClusterPanel
                    region={clusterHealth?.originRegion || projectRegion}
                    envLabel={activeProject.environment}
                    pingMs={pingStatus.postgres}
                    tableCount={studioTables.length}
                    totalRows={Object.values(tableCounts).reduce((a, b) => a + b, 0)}
                    host={activeProject.host}
                  />
                </div>
              )}

              {/* CREDENTIALS & CONNECTION STRINGS */}
              {effectiveSettingsTab === "api_keys" && (
                <div className="max-w-4xl space-y-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Database Credentials &amp; Connection URI</h2>
                      <p className="text-xs text-zinc-400">
                        Direct PostgreSQL role credentials for your isolated database <span className="font-mono text-[#A3E635]">{activeProject.dbName}</span>.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={rotatingPassword || !provisionedDb}
                      onClick={() => void handleRotateDbPassword()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#A3E635] hover:bg-[#84CC16] px-3 py-1.5 text-xs font-bold text-[#11181C] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${rotatingPassword ? "animate-spin" : ""}`} />
                      <span>{rotatingPassword ? "Rotating..." : "Rotate PostgreSQL Password"}</span>
                    </button>
                  </div>

                  {/* Role Password Card */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">PostgreSQL Role Password ({activeProject.dbUser})</h3>
                    <p className="text-xs text-zinc-400">
                      For security, passwords are only returned at provision or rotation time. Click Rotate to issue a fresh 256-bit password.
                    </p>
                    <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs text-white font-mono">{activeProject.dbUser}</div>
                        <div className="text-[11px] text-zinc-500">Least-privilege database owner role</div>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-3 py-1.5 rounded-md border border-[#2E2E2E] bg-[#05060A] text-zinc-200">
                          {activeProject.serviceRoleKey
                            ? showSecretKey
                              ? activeProject.serviceRoleKey
                              : "••••••••••••••••••••••••"
                            : "Rotate password to reveal"}
                        </span>
                        {activeProject.serviceRoleKey && (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowSecretKey((s) => !s)}
                              className="p-1.5 rounded border border-[#2E2E2E] bg-[#1F1F23] hover:text-white cursor-pointer"
                              title={showSecretKey ? "Hide password" : "Reveal password"}
                              aria-label={showSecretKey ? "Hide password" : "Reveal password"}
                            >
                              {showSecretKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyText("secret-role", activeProject.serviceRoleKey)}
                              className="p-1.5 rounded border border-[#2E2E2E] bg-[#1F1F23] hover:text-[#A3E635] cursor-pointer"
                              title="Copy password"
                              aria-label="Copy password"
                            >
                              {copiedKey === "secret-role" ? <Check className="size-3.5 text-[#A3E635]" /> : <Copy className="size-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connection URIs & .env Card */}
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-white font-mono">
                          Environment Variables (.env) — {activeProject.dbName}
                        </h3>
                        <p className="text-[11px] text-zinc-400">Direct PostgreSQL connection string for Prisma, Drizzle, pg, and psycopg.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            "env-file",
                            `DATABASE_URL="${activeProject.directUri}"\nPGHOST="${activeProject.host}"\nPGPORT="${activeProject.port}"\nPGDATABASE="${activeProject.dbName}"\nPGUSER="${activeProject.dbUser}"`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded bg-[#A3E635] px-3 py-1.5 text-xs font-bold text-[#11181C] cursor-pointer"
                      >
                        {copiedKey === "env-file" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        <span>{copiedKey === "env-file" ? "Copied .env" : "Copy .env"}</span>
                      </button>
                    </div>
                    <pre className="rounded-md border border-[#262626] bg-[#05060A] p-3 font-mono text-[11px] text-[#A3E635] overflow-x-auto leading-relaxed">
{`DATABASE_URL="${activeProject.directUri}"
PGHOST="${activeProject.host}"
PGPORT="${activeProject.port}"
PGDATABASE="${activeProject.dbName}"
PGUSER="${activeProject.dbUser}"`}
                    </pre>
                  </div>
                </div>
              )}

              {/* AUDIT TRAIL */}
              {effectiveSettingsTab === "audit" && (
                <div className="max-w-5xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">PostgreSQL Provisioner Audit Trail</h2>
                    <button
                      type="button"
                      onClick={() => void loadBackupsAndAudit()}
                      className="px-3 py-1.5 rounded border border-[#2E2E2E] bg-[#18181D] text-xs font-mono text-zinc-200 cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1C1C1F] border-b border-[#2E2E2E] text-zinc-400">
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Actor</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232327]">
                        {dbAuditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-500">
                              No audit events recorded yet.
                            </td>
                          </tr>
                        ) : (
                          dbAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#1E1E22]">
                              <td className="p-3 text-zinc-400 whitespace-nowrap">{log.createdAt.slice(0, 19).replace("T", " ")}</td>
                              <td className="p-3 text-[#A3E635] font-semibold">{log.action}</td>
                              <td className="p-3 text-zinc-300">{log.actor}</td>
                              <td className="p-3 text-zinc-200">{log.status}</td>
                              <td className="p-3 text-zinc-400">{log.detail}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PLAN & REAL STORAGE QUOTA */}
              {effectiveSettingsTab === "billing" && (
                <div className="max-w-4xl space-y-4">
                  <h2 className="text-lg font-semibold text-white">Plan &amp; Live Storage Quota</h2>
                  <div className="rounded-xl border border-[#2E2E2E] bg-[#0A0D14] p-5 space-y-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-zinc-300 font-medium">Active PostgreSQL Resource Tier</span>
                        <p className="text-[11px] text-zinc-500">
                          Applying a plan updates PostgreSQL CONNECTION LIMIT, statement_timeout, and work_mem immediately.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-[#A3E635]/15 border border-[#A3E635]/30 text-[#A3E635] font-mono font-bold">
                        {activeDbSummary?.planName || provisionedDb?.planName || selectedDbPlanId}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "db-free", name: "Sandbox", price: "₹0/mo", quota: "500 MB • 10 conns" },
                        { id: "db-starter", name: "Starter", price: "₹399/mo", quota: "10 GB • 35 conns" },
                        { id: "db-pro", name: "Pro Vector", price: "₹1,199/mo", quota: "50 GB • 100 conns" },
                        { id: "db-enterprise", name: "Enterprise", price: "₹3,999/mo", quota: "250 GB • 300 conns" },
                      ].map((tier) => {
                        const active = (activeDbSummary?.planId || selectedDbPlanId) === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            disabled={lifecycleBusy}
                            onClick={() => {
                              setSelectedDbPlanId(tier.id);
                              if (provisionedDb) {
                                void handleDbLifecycleAction("upgrade_plan", tier.id);
                              }
                            }}
                            className={`rounded-lg border p-3 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                              active
                                ? "border-[#A3E635]/60 bg-[#A3E635]/10 text-white"
                                : "border-[#262626] bg-[#07090E] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                            }`}
                          >
                            <div className="font-mono font-bold text-xs text-white">{tier.name}</div>
                            <div className="text-[11px] text-[#A3E635] font-mono mt-0.5">{tier.price}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-1">{tier.quota}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#242428] font-mono">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span>Measured PostgreSQL Size: {activeDbSummary?.sizePretty || "—"}</span>
                        <span>
                          Quota: {activeDbSummary ? `${activeDbSummary.usagePct}% of ${activeDbSummary.storageLimitMb} MB` : "—"}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded bg-[#18181D] overflow-hidden">
                        <div
                          className="h-full bg-[#A3E635] rounded"
                          style={{ width: `${Math.min(100, Math.max(2, activeDbSummary?.usagePct ?? 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* =================================================================== */}
      {/* ACCESSIBLE NATIVE MODALS                                            */}
      {/* =================================================================== */}

      {/* 1. CONNECT TO YOUR PROJECT MODAL */}
      <NativeDialog
        open={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        titleId={connectDialogTitleId}
        maxWidthClass="max-w-2xl"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div>
              <h2 id={connectDialogTitleId} className="text-base font-bold text-white">
                Connect to your project
              </h2>
              <p className="text-xs text-zinc-400">
                Get connection strings, PgBouncer pooler URIs, and SDK examples for {activeProject.name}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectModal(false)}
              className="p-1.5 rounded text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Close Connect modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-[#262626] pb-2 text-xs font-mono">
            {[
              { id: "uri" as const, label: "Direct URI" },
              { id: "pooler" as const, label: "Pooler :6543" },
              { id: "nextjs" as const, label: "React / Next.js" },
              { id: "prisma" as const, label: "Prisma" },
              { id: "env" as const, label: ".env" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setConnectTab(tab.id)}
                className={`px-3 py-1.5 rounded-md cursor-pointer ${
                  connectTab === tab.id
                    ? "bg-[#A3E635] text-[#11181C] font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-[#222226]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(() => {
            const connectSnippet =
              connectTab === "uri"
                ? activeProject.directUri
                : connectTab === "pooler"
                  ? activeProject.pooledUri
                  : connectTab === "nextjs"
                    ? sandboxSnippets.js
                    : connectTab === "prisma"
                      ? sandboxSnippets.prisma
                      : `SPARROWX_URL="https://db.sparrowx.net"\nSPARROWX_ANON_KEY="${activeProject.anonKey}"\nDATABASE_URL="${activeProject.pooledUri}"`;
            return (
              <div className="space-y-3">
                <pre className="rounded-lg border border-[#2E2E2E] bg-[#101013] p-4 font-mono text-xs text-[#A3E635] overflow-x-auto leading-relaxed">
                  {connectSnippet}
                </pre>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => copyText("connect-modal-snippet", connectSnippet)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#A3E635] text-[#11181C] font-bold text-xs cursor-pointer"
                  >
                    {copiedKey === "connect-modal-snippet" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copiedKey === "connect-modal-snippet" ? "Copied" : "Copy snippet"}</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </NativeDialog>

      {/* 2. INSERT / EDIT ROW MODAL */}
      <NativeDialog
        open={showInsertModal}
        onClose={() => setShowInsertModal(false)}
        titleId={rowDialogTitleId}
        maxWidthClass="max-w-lg"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <h2 id={rowDialogTitleId} className="font-bold text-sm text-white">
              {editingRow ? `Edit Row in ${selectedTable}` : `Insert Row into ${selectedTable}`}
            </h2>
            <button
              type="button"
              onClick={() => setShowInsertModal(false)}
              className="text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Close Row Modal"
            >
              <X className="size-4" />
            </button>
          </div>
          <textarea
            rows={12}
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            aria-label="Row JSON payload"
            className="w-full rounded-md border border-[#2E2E2E] bg-[#05060A] p-3 font-mono text-xs text-[#A3E635] outline-none focus:border-[#A3E635]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInsertModal(false)}
              className="rounded-md border border-[#2E2E2E] bg-[#232323] px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#2E2E2E] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingRow}
              onClick={() => void handleSaveRow()}
              className="rounded-md bg-[#A3E635] px-4 py-1.5 text-xs font-bold text-[#11181C] hover:opacity-95 cursor-pointer disabled:opacity-50"
            >
              {savingRow ? "Executing SQL..." : "Save Row"}
            </button>
          </div>
        </div>
      </NativeDialog>

      {/* 3. CREATE NEW TABLE MODAL */}
      <NativeDialog
        open={showCreateTableModal}
        onClose={() => setShowCreateTableModal(false)}
        titleId={tableDialogTitleId}
        maxWidthClass="max-w-3xl"
      >
        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <h2 id={tableDialogTitleId} className="font-bold text-white text-base flex items-center gap-2">
              <Table2 className="size-4 text-[#A3E635]" />
              <span>Visual Table &amp; Schema Designer</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateTableModal(false)}
              className="text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Close Table Modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-300 block mb-1">Table Name</label>
              <input
                type="text"
                placeholder="e.g. ai_knowledge_base"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#2E2E2E] bg-[#05060A] px-3 font-mono text-zinc-100 outline-none focus:border-[#A3E635]"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. Vector embeddings and document metadata"
                value={newTableDescription}
                onChange={(e) => setNewTableDescription(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#2E2E2E] bg-[#05060A] px-3 text-zinc-100 outline-none focus:border-[#A3E635]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300 text-xs">Columns Schema</span>
              <button
                type="button"
                onClick={() =>
                  setNewTableColumns((prev) => [
                    ...prev,
                    {
                      name: `col_${prev.length + 1}`,
                      type: "TEXT",
                      isPrimary: false,
                      isNullable: true,
                      defaultValue: "''",
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-[11px] text-[#A3E635] hover:underline cursor-pointer"
              >
                <Plus className="size-3" /> Add Column
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {newTableColumns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[#242424] bg-[#080A10] p-2 text-xs"
                >
                  <input
                    type="text"
                    aria-label="Column name"
                    value={col.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTableColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, name: val } : c)));
                    }}
                    className="h-8 flex-1 min-w-[110px] rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-zinc-100"
                  />

                  <select
                    aria-label="Column type"
                    value={col.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTableColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, type: val } : c)));
                    }}
                    className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-zinc-200"
                  >
                    <option value="UUID">UUID</option>
                    <option value="TEXT">TEXT</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BIGINT">BIGINT</option>
                    <option value="NUMERIC(12,2)">NUMERIC(12,2)</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="TIMESTAMPTZ">TIMESTAMPTZ</option>
                    <option value="DATE">DATE</option>
                    <option value="JSONB">JSONB</option>
                    <option value="vector(3)">vector(3)</option>
                    <option value="vector(384)">vector(384)</option>
                    <option value="vector(1536)">vector(1536)</option>
                  </select>

                  <label className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                    <input
                      type="checkbox"
                      checked={col.isPrimary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewTableColumns((prev) =>
                          prev.map((c, i) =>
                            i === idx
                              ? { ...c, isPrimary: checked, isNullable: !checked }
                              : checked
                                ? { ...c, isPrimary: false }
                                : c
                          )
                        );
                      }}
                    />
                    <span>PK</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                    <input
                      type="checkbox"
                      checked={col.isNullable}
                      disabled={col.isPrimary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewTableColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, isNullable: checked } : c)));
                      }}
                    />
                    <span>Null</span>
                  </label>

                  {newTableColumns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setNewTableColumns((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                      aria-label="Remove column"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 font-mono">Live PostgreSQL 16 DDL Preview</span>
            <pre className="p-3 rounded-lg border border-[#242424] bg-[#0E0E10] text-[#A3E635] font-mono text-[11px] overflow-x-auto max-h-32">
              {generatedTableDdl}
            </pre>
          </div>

          <div className="flex items-center justify-between border-t border-[#2E2E2E] pt-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={newTableEnableRls}
                onChange={(e) => setNewTableEnableRls(e.target.checked)}
              />
              <span>Enable Row Level Security (RLS)</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateTableModal(false)}
                className="rounded-lg border border-[#2E2E2E] bg-[#232323] px-3 py-1.5 text-xs text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingTable}
                onClick={() => void handleCreateNewTable()}
                className="rounded-lg bg-[#A3E635] hover:bg-[#84CC16] text-[#11181C] px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {creatingTable ? "Creating in PostgreSQL..." : "Create Table"}
              </button>
            </div>
          </div>
        </div>
      </NativeDialog>
    </div>
  );
}

function BracesIconFallback() {
  return (
    <span
      aria-hidden="true"
      className="size-4 inline-flex items-center justify-center font-mono text-[11px] font-bold text-zinc-400"
    >
      {"{}"}
    </span>
  );
}
