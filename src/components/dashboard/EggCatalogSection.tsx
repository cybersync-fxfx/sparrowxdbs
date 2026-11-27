import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Gamepad2,
  Package,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EggCatalogItem, EggSectionSummary } from "@/routes/api/game/eggs-catalog";

interface CatalogApiResponse {
  ok: boolean;
  version?: string;
  generatedAt?: string;
  totalEggs: number;
  sections: EggSectionSummary[];
  eggs: EggCatalogItem[];
  error?: string;
}

const SECTION_ICONS = {
  games: Gamepad2,
  applications: Boxes,
  generic: Cpu,
} as const;

const PAGE_SIZE = 24;

export function EggCatalogSection({
  onSelectDeployPlans,
  onSelectEgg,
  selectedEggId,
}: {
  onSelectDeployPlans?: () => void;
  onSelectEgg?: (egg: EggCatalogItem) => void;
  selectedEggId?: string | null;
}) {
  const [activeSection, setActiveSection] = useState<"games" | "applications" | "generic">("games");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching, refetch } = useQuery<CatalogApiResponse>({
    queryKey: ["game-eggs-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/game/eggs-catalog", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load egg catalog.");
      return (await res.json()) as CatalogApiResponse;
    },
    staleTime: 60_000,
  });

  const sections = data?.sections ?? [];
  const allEggs = data?.eggs ?? [];

  const sectionEggs = useMemo(
    () => allEggs.filter((e) => e.section === activeSection),
    [allEggs, activeSection],
  );

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const egg of sectionEggs) {
      counts.set(egg.category, (counts.get(egg.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [sectionEggs]);

  const filteredEggs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sectionEggs.filter((egg) => {
      if (selectedCategory !== "all" && egg.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        egg.name.toLowerCase().includes(q) ||
        egg.category.toLowerCase().includes(q) ||
        egg.description.toLowerCase().includes(q) ||
        egg.dockerImage.toLowerCase().includes(q)
      );
    });
  }, [sectionEggs, searchQuery, selectedCategory]);

  const activeMeta = sections.find((s) => s.id === activeSection);
  const visibleEggs = filteredEggs.slice(0, visibleCount);

  return (
    <section
      id="sparrowx-egg-library"
      aria-label="SparrowX Pterodactyl Egg Package Library"
      className="surface-3d rim-sheen rounded-3xl border border-border p-6 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sheen">
              <Package className="size-3" aria-hidden="true" />
              <span>Egg Upgrade Packager · 3 Official Repos</span>
            </span>
            {data?.totalEggs ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-300">
                {data.totalEggs} Packages Ready
              </span>
            ) : null}
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Supported Games, Applications &amp; Generic Runtimes
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Synced directly from official Pterodactyl repositories into 3 separate Panel Nests. Run{" "}
            <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-sheen">
              sudo sparrowx-eggs sync
            </code>{" "}
            anytime to upgrade both Panel and Client Area in one command.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{isFetching ? "Refreshing..." : "Refresh Catalog"}</span>
          </Button>
          <Button asChild variant="secondary" size="sm" className="rounded-xl">
            <a href="/api/game/panel-sso?next=%2F" target="_blank" rel="noreferrer">
              <Terminal className="size-3.5 text-emerald-400" aria-hidden="true" />
              <span>Open Panel</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>

      {/* 3 Separate Section Tabs (Game Servers | Applications & Bots | Generic Runtimes) */}
      <div
        role="tablist"
        aria-label="Egg repository sections"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      >
        {(["games", "applications", "generic"] as const).map((secId) => {
          const Icon = SECTION_ICONS[secId];
          const meta = sections.find((s) => s.id === secId);
          const active = activeSection === secId;
          const label =
            meta?.title ||
            (secId === "games"
              ? "Game Servers"
              : secId === "applications"
                ? "Applications & Bots"
                : "Generic Runtimes");
          return (
            <button
              key={secId}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveSection(secId);
                setSelectedCategory("all");
                setVisibleCount(PAGE_SIZE);
              }}
              className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                active
                  ? "border-primary bg-primary/15 text-foreground shadow-sm"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`size-9 rounded-xl grid place-items-center shrink-0 border ${
                    active
                      ? "border-primary/40 bg-primary/20 text-sheen"
                      : "border-border bg-background/60 text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {meta ? `pterodactyl/${secId === "games" ? "game-eggs" : secId === "applications" ? "application-eggs" : "generic-eggs"} @ ${meta.commit}` : secId}
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-0.5 font-mono text-xs font-bold shrink-0">
                {meta?.count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Category Filter Strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <search className="relative flex-1 max-w-md">
          <label htmlFor="egg-catalog-search" className="sr-only">
            Search eggs in {activeMeta?.title || activeSection}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="egg-catalog-search"
            name="eggQuery"
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder={`Search ${sectionEggs.length} ${activeMeta?.title?.toLowerCase() ?? "egg"} packages...`}
            className="h-10 w-full rounded-xl border border-border bg-background/60 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </search>

        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span>
            Showing {visibleEggs.length} of {filteredEggs.length}
          </span>
          {activeMeta?.repoUrl && (
            <a
              href={activeMeta.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sheen hover:underline"
            >
              <span>Upstream Repo</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {topCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setVisibleCount(PAGE_SIZE);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              selectedCategory === "all"
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({sectionEggs.length})
          </button>
          {topCategories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "border-primary bg-primary/20 text-foreground"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Egg Cards Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 rounded-2xl border border-border bg-background/40 animate-pulse"
            />
          ))}
        </div>
      ) : visibleEggs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background/40 p-8 text-center text-xs text-muted-foreground">
          {allEggs.length === 0
            ? "No eggs synced yet. Run 'sudo sparrowx-eggs sync' on your VPS to import all 3 Pterodactyl repositories."
            : `No eggs matched "${searchQuery}" in ${activeMeta?.title ?? activeSection}.`}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEggs.map((egg) => (
              <article
                key={egg.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-background/45 p-4 hover:border-primary/45 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-foreground leading-snug">
                      {egg.name}
                    </h3>
                    {egg.installed ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300 shrink-0">
                        <CheckCircle2 className="size-2.5" aria-hidden="true" />
                        <span>Panel Live</span>
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
                        {egg.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {egg.description || `Official Pterodactyl ${egg.category} package (${egg.repoPath}).`}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {egg.dockerImage || egg.category}
                  </span>
                  {(onSelectEgg || onSelectDeployPlans) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectEgg) {
                          onSelectEgg(egg);
                        } else {
                          onSelectDeployPlans?.();
                        }
                      }}
                      className={`text-[11px] font-semibold hover:underline shrink-0 cursor-pointer ${
                        selectedEggId === egg.id ? "text-emerald-300" : "text-sheen"
                      }`}
                    >
                      {selectedEggId === egg.id ? "Selected ✓" : "Configure & Deploy →"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {filteredEggs.length > visibleCount && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, filteredEggs.length - visibleCount)} More ({filteredEggs.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
