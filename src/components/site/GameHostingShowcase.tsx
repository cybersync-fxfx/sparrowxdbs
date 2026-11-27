import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { resolveEggResourceProfile } from "@/lib/egg-smart-plans";
import { SERVICES } from "@/lib/services";
import type { EggCatalogItem, EggCatalogPayload } from "@/routes/api/game/eggs-catalog";
import { useSessionSummary } from "./Navbar";

type EcosystemTab = "games" | "applications" | "generic";

interface ShowcaseCardItem {
  id: string;
  section: EcosystemTab;
  title: string;
  subtitle: string;
  eggQuery: string;
  image: string;
  ramRange: string;
}

const SHOWCASE_CARDS: ShowcaseCardItem[] = [
  // --- GAME SERVERS (12 rich artwork cards) ---
  {
    id: "sc-minecraft",
    section: "games",
    title: "Minecraft Java & Modded",
    subtitle: "Paper, Purpur, Forge, Fabric, CurseForge, FTB & Bedrock editions",
    eggQuery: "paper",
    image: SERVICES.minecraft.image,
    ramRange: "2GB to 20GB smart tiers",
  },
  {
    id: "sc-fivem",
    section: "games",
    title: "FiveM & RedM Roleplay",
    subtitle: "txAdmin pre-installed, OneSync Infinity & custom MLO streaming",
    eggQuery: "fivem",
    image: SERVICES.fivem.image,
    ramRange: "4GB to 16GB smart tiers",
  },
  {
    id: "sc-samp",
    section: "games",
    title: "SA-MP & open.mp",
    subtitle: "Classic Pawn 0.3.7, open.mp, MTA:SA with MySQL & RCON guard",
    eggQuery: "samp",
    image: SERVICES.samp.image,
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-rust",
    section: "games",
    title: "Rust Dedicated",
    subtitle: "High-pop wipe readiness, Oxide/uMod support & auto-wipe eggs",
    eggQuery: "rust",
    image: "/images/game-showcase/rust.jpg",
    ramRange: "6GB to 24GB smart tiers",
  },
  {
    id: "sc-palworld",
    section: "games",
    title: "Palworld",
    subtitle: "Guild bases, co-op worlds and dedicated SteamCMD updates",
    eggQuery: "palworld",
    image: "/images/game-showcase/palworld.jpg",
    ramRange: "6GB to 24GB smart tiers",
  },
  {
    id: "sc-cs2",
    section: "games",
    title: "Counter-Strike 2 & FPS",
    subtitle: "CS2, CS 1.6 ReHLDS, CS:Source, TF2, Left 4 Dead 2 & Arena shooters",
    eggQuery: "counter strike2",
    image: "/images/game-showcase/cs2.jpg",
    ramRange: "1GB to 16GB smart tiers",
  },
  {
    id: "sc-valheim",
    section: "games",
    title: "Valheim",
    subtitle: "BepInEx and Valheim Plus mod packs ready out of the box",
    eggQuery: "valheim",
    image: "/images/game-showcase/valheim.jpg",
    ramRange: "4GB to 16GB smart tiers",
  },
  {
    id: "sc-ark",
    section: "games",
    title: "ARK Survival Ascended & Evolved",
    subtitle: "Prehistoric dino clusters, PixARK and high-memory world saves",
    eggQuery: "ark",
    image: "/images/game-showcase/ark.jpg",
    ramRange: "6GB to 24GB smart tiers",
  },
  {
    id: "sc-terraria",
    section: "games",
    title: "Terraria & tModLoader",
    subtitle: "Vanilla Terraria, TShock permissions and Calamity mod worlds",
    eggQuery: "terraria",
    image: "/images/game-showcase/terraria.jpg",
    ramRange: "1GB to 10GB smart tiers",
  },
  {
    id: "sc-dayz",
    section: "games",
    title: "DayZ & Survival Sandboxes",
    subtitle: "DayZ, 7 Days to Die, Project Zomboid, SCUM & Sons of the Forest",
    eggQuery: "dayz",
    image: "/images/game-showcase/dayz.jpg",
    ramRange: "4GB to 16GB smart tiers",
  },
  {
    id: "sc-satisfactory",
    section: "games",
    title: "Satisfactory & Factorio",
    subtitle: "Megabase automation grids tuned for sustained single-thread UPS",
    eggQuery: "satisfactory",
    image: "/images/game-showcase/satisfactory.jpg",
    ramRange: "1GB to 24GB smart tiers",
  },
  {
    id: "sc-enshrouded",
    section: "games",
    title: "Enshrouded & V Rising",
    subtitle: "Voxel realms, Conan Exiles, Soulmask and fantasy PvE/PvP worlds",
    eggQuery: "enshrouded",
    image: "/images/game-showcase/enshrouded.jpg",
    ramRange: "4GB to 24GB smart tiers",
  },

  // --- APPLICATIONS & BOTS (6 visual cards) ---
  {
    id: "sc-discord-bots",
    section: "applications",
    title: "Discord & Twitch Bots",
    subtitle: "Red, Ree6, JMusicBot, PhantomBot, SogeBot & custom 24/7 bots",
    eggQuery: "red",
    image: SERVICES.discord.image,
    ramRange: "512MB to 4GB smart tiers",
  },
  {
    id: "sc-sql-databases",
    section: "applications",
    title: "PostgreSQL & MariaDB",
    subtitle: "Postgres 13 through 17 and MariaDB on isolated NVMe storage",
    eggQuery: "postgres16",
    image: "/images/game-showcase/databases.jpg",
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-nosql-cache",
    section: "applications",
    title: "MongoDB, Redis & Search",
    subtitle: "MongoDB 7/8, Redis 5/6/7, Meilisearch, RabbitMQ & Elasticsearch",
    eggQuery: "redis 7",
    image: "/images/game-showcase/databases.jpg",
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-voice-comms",
    section: "applications",
    title: "TeamSpeak 3 & 6 Voice",
    subtitle: "Crystal-clear low-jitter clan voice channels & TS3 Manager",
    eggQuery: "teamspeak",
    image: "/images/game-showcase/voice-comms.svg",
    ramRange: "512MB to 4GB smart tiers",
  },
  {
    id: "sc-monitoring",
    section: "applications",
    title: "Uptime Kuma, Grafana & Loki",
    subtitle: "Status pages, Prometheus metrics and real-time log stacks",
    eggQuery: "uptime kuma",
    image: "/images/game-showcase/apps-stack.jpg",
    ramRange: "512MB to 8GB smart tiers",
  },
  {
    id: "sc-dev-apps",
    section: "applications",
    title: "Lavalink, Gitea & MinIO S3",
    subtitle: "Audio streaming nodes, private Git hosting, Code-Server & Owncast",
    eggQuery: "lavalink",
    image: "/images/game-showcase/code-systems.svg",
    ramRange: "1GB to 8GB smart tiers",
  },

  // --- GENERIC CLOUD RUNTIMES (6 visual cards covering all 12 languages) ---
  {
    id: "sc-rt-js",
    section: "generic",
    title: "Node.js, Bun & Deno",
    subtitle: "TypeScript APIs, Discord bots, Nodemon hot-reload & web services",
    eggQuery: "node",
    image: "/images/game-showcase/runtimes.svg",
    ramRange: "512MB to 4GB smart tiers",
  },
  {
    id: "sc-rt-python",
    section: "generic",
    title: "Python Generic",
    subtitle: "FastAPI backends, Telegram/Discord bots, scrapers & automation",
    eggQuery: "python",
    image: "/images/game-showcase/code-systems.svg",
    ramRange: "512MB to 4GB smart tiers",
  },
  {
    id: "sc-rt-go",
    section: "generic",
    title: "Golang Generic",
    subtitle: "Compiled low-footprint Go microservices & network relays",
    eggQuery: "golang",
    image: "/images/game-showcase/apps-stack.jpg",
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-rt-rust",
    section: "generic",
    title: "Rust Generic",
    subtitle: "Zero-cost Cargo & Tokio async backend applications",
    eggQuery: "rust",
    image: "/images/game-showcase/runtimes.svg",
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-rt-java",
    section: "generic",
    title: "Java JVM Generic",
    subtitle: "Spring Boot APIs, custom JAR runners & Gradle/Maven builds",
    eggQuery: "java",
    image: "/images/game-showcase/code-systems.svg",
    ramRange: "1GB to 8GB smart tiers",
  },
  {
    id: "sc-rt-polyglot",
    section: "generic",
    title: "C#, Elixir, Dart & Lua",
    subtitle: "Dedicated containers for .NET, Elixir OTP, Dart & Luvit apps",
    eggQuery: "elixir",
    image: "/images/game-showcase/databases.jpg",
    ramRange: "512MB to 8GB smart tiers",
  },
];

export function buildCardDestination(
  isLoggedIn: boolean,
  eggQuery: string,
  section: EcosystemTab,
): string {
  const dashboardTarget = `/game/dashboard?egg=${encodeURIComponent(eggQuery)}&section=${section}`;
  if (isLoggedIn) return dashboardTarget;
  return `/login?next=${encodeURIComponent(dashboardTarget)}`;
}

export function GameHostingShowcase() {
  const { data: me } = useSessionSummary();
  const [activeTab, setActiveTab] = useState<EcosystemTab>("games");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: catalog } = useQuery<EggCatalogPayload>({
    queryKey: ["landing-eggs-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/game/eggs-catalog", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return (await res.json()) as EggCatalogPayload;
    },
    staleTime: 120_000,
  });

  const gamesCount = catalog?.sections?.find((s) => s.id === "games")?.count ?? 254;
  const appsCount = catalog?.sections?.find((s) => s.id === "applications")?.count ?? 55;
  const genericCount = catalog?.sections?.find((s) => s.id === "generic")?.count ?? 12;
  const totalCount = catalog?.totalEggs ?? gamesCount + appsCount + genericCount;

  const visibleCards = useMemo(
    () => SHOWCASE_CARDS.filter((c) => c.section === activeTab),
    [activeTab],
  );

  const searchResults = useMemo<EggCatalogItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !catalog?.eggs?.length) return [];
    return catalog.eggs
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q),
      )
      .slice(0, 18);
  }, [searchQuery, catalog]);

  const isLoggedIn = Boolean(me);

  return (
    <section id="catalog" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl">
            {totalCount} Ready-to-Deploy Servers Across Three Ecosystems
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Click any game, application, or runtime below to open its tailored five-tier hardware options and guided setup in the Client Area.
          </p>
        </div>

        {/* Connected 3-ecosystem segmented selector (tabular-nums counts) */}
        <div
          role="tablist"
          aria-label="Hosting ecosystems"
          className="inline-flex rounded-2xl border border-white/10 bg-[#0b0e17] p-1.5 overflow-x-auto self-start lg:self-auto"
        >
          {(
            [
              { id: "games" as const, label: "Game Servers", count: gamesCount },
              { id: "applications" as const, label: "Apps & Bots", count: appsCount },
              { id: "generic" as const, label: "Cloud Runtimes", count: genericCount },
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  selected
                    ? "bg-white text-zinc-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`ml-2 tabular-nums text-xs ${selected ? "text-zinc-600" : "text-slate-400"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Search across ALL 321 eggs right on the landing page */}
      <div className="mt-8">
        <div role="search" className="relative max-w-xl">
          <label htmlFor="landing-egg-search" className="sr-only">
            Search all {totalCount} games, applications, and runtimes
          </label>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="landing-egg-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search all ${totalCount} titles (Paper, FiveM, SA-MP, Palworld, PostgreSQL, Python...)`}
            className="h-12 w-full rounded-2xl border border-white/12 bg-[#0b0e17] pl-11 pr-4 text-sm text-white placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </div>

        {/* Instant Search Results Grid when typing */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#0b0e17] p-6 text-sm text-slate-400">
                No server packages matched &ldquo;{searchQuery}&rdquo;. Try Minecraft, Rust, FiveM, SA-MP, Redis, or Python.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((egg) => {
                  const profile = resolveEggResourceProfile(egg);
                  const href = buildCardDestination(isLoggedIn, egg.id, egg.section);
                  return (
                    <a
                      key={egg.id}
                      href={href}
                      className="group block rounded-2xl border border-white/10 bg-[#0b0e17] p-4 transition-colors duration-200 hover:border-emerald-400/60"
                    >
                      <article className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {egg.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-400 truncate">
                            {egg.category} · {profile.ramRangeLabel}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-300"
                          aria-hidden="true"
                        />
                      </article>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Image Showcase Cards (Single-Destination Cards per modern-web-guidance: card) */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => {
          const href = buildCardDestination(isLoggedIn, card.eggQuery, card.section);
          return (
            <a
              key={card.id}
              href={href}
              className="group block rounded-2xl border border-white/10 bg-[#0b0e17] overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-1 hover:border-emerald-400/60 focus-visible:outline-2 focus-visible:outline-emerald-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <article className="flex h-full flex-col">
                <img
                  src={card.image}
                  alt={`${card.title} hosting on SparrowX`}
                  width={460}
                  height={288}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h3 className="font-display text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      {card.subtitle}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3.5 text-sm">
                    <span className="tabular-nums text-slate-400">{card.ramRange}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                      <span>{isLoggedIn ? "Configure" : "Sign in"}</span>
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </article>
            </a>
          );
        })}
      </div>
    </section>
  );
}
