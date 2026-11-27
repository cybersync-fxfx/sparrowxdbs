import React, { useState } from "react";
import { Check, Copy, Database, Play, ShieldCheck, Sparkles, Terminal, Zap } from "lucide-react";
import { ThreeModelViewer } from "@/components/shared/ThreeModelViewer";
import { InteractiveCard } from "@/components/shared/InteractiveCard";
import { BentoCard, BentoGrid } from "@/components/shared/BentoGrid";

const PLAYGROUND_TABS = [
  {
    id: "pgvector",
    label: "pgvector AI Search (<=>)",
    code: `-- Semantic cosine similarity search on 1536-dim embeddings
SELECT id, title, 1 - (embedding <=> $1::vector) AS similarity
FROM knowledge_chunks
WHERE tenant_id = 'tnt_india_01'
ORDER BY embedding <=> $1::vector
LIMIT 5;`,
    output: `5 rows returned in 3.8 ms (HNSW index scan · Mumbai NVMe Gen5)
  #1  "Zero-Egress PostgreSQL Architecture"   similarity: 0.964
  #2  "PgBouncer Transaction Pooling Guide"   similarity: 0.941
  #3  "Row Level Security Multi-Tenant Spec"  similarity: 0.918`,
  },
  {
    id: "sql",
    label: "PostgreSQL 16 SQL",
    code: `-- ACID transactional order ledger with JSONB telemetry
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  amount_inr integer NOT NULL CHECK (amount_inr > 0),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);`,
    output: `CREATE TABLE completed in 1.9 ms
  WAL Sync: Synchronous NVMe · Automated Point-in-Time Snapshot Ready`,
  },
  {
    id: "connect",
    label: "PgBouncer Pooler URI",
    code: `# High-concurrency Transaction Pooler (Port 6543)
DATABASE_URL="postgresql://spx_admin:********@db.sparrowx.net:6543/app_prod?sslmode=require"

# Direct REST API Endpoint (PostgREST)
curl https://db.sparrowx.net/rest/v1/orders?limit=10 \\
  -H "apikey: spx_live_your_anon_key"`,
    output: `TLS 1.3 handshake verified · Pool capacity: 1,500 concurrent clients`,
  },
] as const;

export function DbSpatialShowcase() {
  const [activeTab, setActiveTab] = useState<(typeof PLAYGROUND_TABS)[number]["id"]>("pgvector");
  const [executed, setExecuted] = useState(true);
  const [copied, setCopied] = useState(false);

  const current = PLAYGROUND_TABS.find((t) => t.id === activeTab) ?? PLAYGROUND_TABS[0]!;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(current.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  return (
    <section className="space-y-8">
      {/* 3D Database Cylinder Cluster + Interactive SQL & pgvector Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5">
          <ThreeModelViewer
            variant="database-cluster"
            heightClass="h-[320px] sm:h-full min-h-[340px]"
            label="POSTGRESQL 16 · PGVECTOR 3D CLUSTER"
          />
        </div>

        <InteractiveCard
          spotlightColor="rgba(16, 185, 129, 0.16)"
          className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#141A29] pb-3">
              <div className="flex items-center gap-2 font-mono text-xs text-[#10B981]">
                <Terminal className="size-4" />
                <span>Interactive SQL &amp; pgvector Playground</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLAYGROUND_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setExecuted(true);
                    }}
                    className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-[#10B981] text-[#030407] font-bold"
                        : "border border-[#141A29] bg-[#030407] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative rounded-xl border border-[#141A29] bg-[#030407] p-4">
              <pre className="overflow-x-auto font-mono text-xs text-zinc-200 leading-relaxed">
                <code>{current.code}</code>
              </pre>
              <div className="mt-3 flex items-center justify-between border-t border-[#141A29] pt-2.5">
                <button
                  type="button"
                  onClick={() => setExecuted(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981]/15 px-3 py-1 font-mono text-[11px] font-bold text-[#10B981] hover:bg-[#10B981] hover:text-[#030407] transition-colors cursor-pointer"
                >
                  <Play className="size-3" />
                  <span>Run Query Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#141A29] bg-[#080B12] px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                >
                  {copied ? <Check className="size-3 text-[#10B981]" /> : <Copy className="size-3" />}
                  <span>{copied ? "Copied" : "Copy Snippet"}</span>
                </button>
              </div>
            </div>

            {executed && (
              <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3.5 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap">
                {current.output}
              </div>
            )}
          </div>
        </InteractiveCard>
      </div>

      {/* Enterprise DB Features Bento */}
      <BentoGrid className="lg:grid-cols-4">
        <BentoCard
          title="1-Click Provisioning"
          description="Isolated PostgreSQL 16 schemas and dedicated databases spun up on NVMe Gen5 storage in seconds."
          badge="INSTANT"
          accent="emerald"
          icon={<Zap className="size-5 text-[#10B981]" />}
        />
        <BentoCard
          title="Automated Snapshots"
          description="Nightly encrypted WAL backups and instant point-in-time SQL & JSON exports with zero egress cost."
          badge="ZERO LOSS"
          accent="periwinkle"
          icon={<ShieldCheck className="size-5 text-[#8F9CFF]" />}
        />
        <BentoCard
          title="Connection String Copy"
          description="One-click PgBouncer transaction pooler (port 6543) & PostgREST API keys wired for Next.js, Prisma, and Drizzle."
          badge="PORT 6543"
          accent="cyan"
          icon={<Database className="size-5 text-[#06B6D4]" />}
        />
        <BentoCard
          title="Zero-Downtime Scaling"
          description="Scale RAM, IOPS, and pgvector HNSW memory seamlessly as your AI embeddings grow to millions of rows."
          badge="PGVECTOR"
          accent="amber"
          icon={<Sparkles className="size-5 text-[#F59E0B]" />}
        />
      </BentoGrid>
    </section>
  );
}
