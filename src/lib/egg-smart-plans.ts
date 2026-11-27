import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";
import type { Plan, ServiceId } from "./services";

export type EggResourceProfileId =
  | "bot"
  | "samp"
  | "app"
  | "mc-bed"
  | "mc-java"
  | "mc-mod"
  | "rp"
  | "surv"
  | "heavy";

export interface SmartPlanTier extends Plan {
  profileId: EggResourceProfileId;
  tierLabel: string;
  capacityHint: string;
}

export interface EggResourceProfile {
  id: EggResourceProfileId;
  label: string;
  serviceId: ServiceId;
  ramRangeLabel: string;
  reasoning: string;
  plans: SmartPlanTier[];
}

export const EGG_RESOURCE_PROFILES: Record<EggResourceProfileId, EggResourceProfile> = {
  bot: {
    id: "bot",
    label: "Lightweight Bot, Proxy & Runtime",
    serviceId: "discord",
    ramRangeLabel: "512MB – 4GB RAM",
    reasoning:
      "Bots, Minecraft proxies (Velocity/Waterfall), voice servers, and Node.js/Python/Bun apps run efficiently starting at 512MB and rarely need more than 4GB.",
    plans: [
      { id: "smart-bot-1", profileId: "bot", name: "Micro", tierLabel: "Tier 1", capacityHint: "1–2 light bots", ramMb: 512, vcpu: 0.5, diskGb: 5, priceInr: 49 },
      { id: "smart-bot-2", profileId: "bot", name: "Starter", tierLabel: "Tier 2", capacityHint: "Active community", ramMb: 1024, vcpu: 0.75, diskGb: 10, priceInr: 89 },
      { id: "smart-bot-3", profileId: "bot", name: "Standard", tierLabel: "Tier 3", capacityHint: "Multi-guild / Proxy", ramMb: 2048, vcpu: 1.0, diskGb: 20, priceInr: 169, popular: true },
      { id: "smart-bot-4", profileId: "bot", name: "Scale", tierLabel: "Tier 4", capacityHint: "Sharded / Music", ramMb: 3072, vcpu: 1.5, diskGb: 30, priceInr: 249 },
      { id: "smart-bot-5", profileId: "bot", name: "Cluster", tierLabel: "Tier 5", capacityHint: "High-traffic node", ramMb: 4096, vcpu: 2.0, diskGb: 40, priceInr: 329 },
    ],
  },
  samp: {
    id: "samp",
    label: "Classic Native / Pawn / Source Engine",
    serviceId: "samp",
    ramRangeLabel: "1GB – 8GB RAM",
    reasoning:
      "Native C/C++/Pawn game engines like SA-MP, open.mp, MTA:SA, CS 1.6, TF2, Terraria, and Factorio are super RAM-efficient — 1GB boots smoothly and 8GB handles maxed-out servers.",
    plans: [
      { id: "smart-samp-1", profileId: "samp", name: "Starter", tierLabel: "Tier 1", capacityHint: "Up to 50 players", ramMb: 1024, vcpu: 0.75, diskGb: 10, slots: 50, priceInr: 79 },
      { id: "smart-samp-2", profileId: "samp", name: "Community", tierLabel: "Tier 2", capacityHint: "Up to 150 players", ramMb: 2048, vcpu: 1.0, diskGb: 20, slots: 150, priceInr: 149 },
      { id: "smart-samp-3", profileId: "samp", name: "Popular RP", tierLabel: "Tier 3", capacityHint: "Up to 350 players", ramMb: 4096, vcpu: 1.5, diskGb: 35, slots: 350, priceInr: 279, popular: true },
      { id: "smart-samp-4", profileId: "samp", name: "Network", tierLabel: "Tier 4", capacityHint: "Up to 600 players", ramMb: 6144, vcpu: 2.0, diskGb: 50, slots: 600, priceInr: 399 },
      { id: "smart-samp-5", profileId: "samp", name: "Max Cap", tierLabel: "Tier 5", capacityHint: "Up to 1000 players", ramMb: 8192, vcpu: 2.5, diskGb: 70, slots: 1000, priceInr: 529 },
    ],
  },
  app: {
    id: "app",
    label: "Database, Dev Platform & Compiled App",
    serviceId: "discord",
    ramRangeLabel: "1GB – 8GB RAM",
    reasoning:
      "Databases (PostgreSQL, MariaDB, MongoDB, Redis), Git/Monitoring stacks, Lavalink, and Go/Rust/Java/C# apps need steady 1GB–8GB memory caches and fast NVMe storage.",
    plans: [
      { id: "smart-app-1", profileId: "app", name: "Dev", tierLabel: "Tier 1", capacityHint: "Testing / staging", ramMb: 1024, vcpu: 0.75, diskGb: 15, priceInr: 99 },
      { id: "smart-app-2", profileId: "app", name: "Starter", tierLabel: "Tier 2", capacityHint: "Small production", ramMb: 2048, vcpu: 1.5, diskGb: 30, priceInr: 189 },
      { id: "smart-app-3", profileId: "app", name: "Production", tierLabel: "Tier 3", capacityHint: "Live workloads", ramMb: 4096, vcpu: 2.0, diskGb: 50, priceInr: 349, popular: true },
      { id: "smart-app-4", profileId: "app", name: "Business", tierLabel: "Tier 4", capacityHint: "Heavy queries", ramMb: 6144, vcpu: 3.0, diskGb: 80, priceInr: 499 },
      { id: "smart-app-5", profileId: "app", name: "Enterprise", tierLabel: "Tier 5", capacityHint: "High concurrency", ramMb: 8192, vcpu: 4.0, diskGb: 120, priceInr: 649 },
    ],
  },
  "mc-bed": {
    id: "mc-bed",
    label: "Minecraft Bedrock / Lightweight Sandbox",
    serviceId: "minecraft",
    ramRangeLabel: "2GB – 10GB RAM",
    reasoning:
      "Bedrock Edition engines (Vanilla Bedrock, PocketMine-MP, Nukkit) have lower memory overhead than Java — 2GB runs small realms cleanly and scales to 10GB for large worlds.",
    plans: [
      { id: "smart-mc-bed-1", profileId: "mc-bed", name: "Starter", tierLabel: "Tier 1", capacityHint: "5–10 players", ramMb: 2048, vcpu: 1.0, diskGb: 15, priceInr: 159 },
      { id: "smart-mc-bed-2", profileId: "mc-bed", name: "Friends SMP", tierLabel: "Tier 2", capacityHint: "10–25 players", ramMb: 3072, vcpu: 1.5, diskGb: 25, priceInr: 229 },
      { id: "smart-mc-bed-3", profileId: "mc-bed", name: "Realm Plus", tierLabel: "Tier 3", capacityHint: "25–50 players", ramMb: 4096, vcpu: 2.0, diskGb: 35, priceInr: 319, popular: true },
      { id: "smart-mc-bed-4", profileId: "mc-bed", name: "Community", tierLabel: "Tier 4", capacityHint: "50–100 players", ramMb: 6144, vcpu: 2.5, diskGb: 55, priceInr: 469 },
      { id: "smart-mc-bed-5", profileId: "mc-bed", name: "Mega Realm", tierLabel: "Tier 5", capacityHint: "100+ players", ramMb: 10240, vcpu: 3.5, diskGb: 90, priceInr: 749 },
    ],
  },
  "mc-java": {
    id: "mc-java",
    label: "Minecraft Java (Paper / Purpur / Spigot)",
    serviceId: "minecraft",
    ramRangeLabel: "3GB – 16GB RAM",
    reasoning:
      "Modern Minecraft Java 1.20+ needs at least 3GB RAM for clean JVM garbage collection and 20.0 TPS chunk loading, scaling up to 16GB for heavy plugin networks.",
    plans: [
      { id: "smart-mc-java-1", profileId: "mc-java", name: "Starter SMP", tierLabel: "Tier 1", capacityHint: "5–15 players", ramMb: 3072, vcpu: 1.5, diskGb: 20, priceInr: 249 },
      { id: "smart-mc-java-2", profileId: "mc-java", name: "Core SMP", tierLabel: "Tier 2", capacityHint: "15–35 players", ramMb: 4096, vcpu: 2.0, diskGb: 30, priceInr: 349 },
      { id: "smart-mc-java-3", profileId: "mc-java", name: "Diamond SMP", tierLabel: "Tier 3", capacityHint: "35–75 players", ramMb: 6144, vcpu: 2.5, diskGb: 50, priceInr: 499, popular: true },
      { id: "smart-mc-java-4", profileId: "mc-java", name: "Pro Network", tierLabel: "Tier 4", capacityHint: "75–150 players", ramMb: 8192, vcpu: 3.0, diskGb: 70, priceInr: 649 },
      { id: "smart-mc-java-5", profileId: "mc-java", name: "Extreme SMP", tierLabel: "Tier 5", capacityHint: "150+ / heavy chunks", ramMb: 16384, vcpu: 4.0, diskGb: 120, priceInr: 1199 },
    ],
  },
  "mc-mod": {
    id: "mc-mod",
    label: "Modded Minecraft (Forge / Fabric / Modpacks)",
    serviceId: "minecraft",
    ramRangeLabel: "4GB – 20GB RAM",
    reasoning:
      "Modded Forge, Fabric, NeoForge, CurseForge, and FTB packs require at least 4GB RAM baseline for mod registries and world-gen threads, with 8GB–12GB ideal for full modpacks.",
    plans: [
      { id: "smart-mc-mod-1", profileId: "mc-mod", name: "Light Mods", tierLabel: "Tier 1", capacityHint: "20–50 mods", ramMb: 4096, vcpu: 2.0, diskGb: 30, priceInr: 349 },
      { id: "smart-mc-mod-2", profileId: "mc-mod", name: "Modpack Entry", tierLabel: "Tier 2", capacityHint: "50–120 mods", ramMb: 6144, vcpu: 2.5, diskGb: 45, priceInr: 499 },
      { id: "smart-mc-mod-3", profileId: "mc-mod", name: "Modpack Pro", tierLabel: "Tier 3", capacityHint: "120–250 mods", ramMb: 8192, vcpu: 3.0, diskGb: 65, priceInr: 649, popular: true },
      { id: "smart-mc-mod-4", profileId: "mc-mod", name: "Kitchen Sink", tierLabel: "Tier 4", capacityHint: "250–400 mods", ramMb: 12288, vcpu: 4.0, diskGb: 95, priceInr: 949 },
      { id: "smart-mc-mod-5", profileId: "mc-mod", name: "Ultra Pack", tierLabel: "Tier 5", capacityHint: "400+ heavy mods", ramMb: 20480, vcpu: 5.0, diskGb: 140, priceInr: 1499 },
    ],
  },
  rp: {
    id: "rp",
    label: "GTA V RP, Modern FPS & High-Tick Multiplayer",
    serviceId: "fivem",
    ramRangeLabel: "4GB – 16GB RAM",
    reasoning:
      "FiveM, RedM, CS2, DayZ, Arma, Garry's Mod, and BeamMP stream large MLOs, custom vehicles, and high-tick scripts — 4GB fits dev/small servers and 8GB–16GB powers live cities.",
    plans: [
      { id: "smart-rp-1", profileId: "rp", name: "Dev / Test", tierLabel: "Tier 1", capacityHint: "Up to 32 slots", ramMb: 4096, vcpu: 1.5, diskGb: 35, slots: 32, priceInr: 399 },
      { id: "smart-rp-2", profileId: "rp", name: "Starter City", tierLabel: "Tier 2", capacityHint: "Up to 48 slots", ramMb: 6144, vcpu: 2.0, diskGb: 55, slots: 48, priceInr: 569 },
      { id: "smart-rp-3", profileId: "rp", name: "Midnight RP", tierLabel: "Tier 3", capacityHint: "Up to 64 slots", ramMb: 8192, vcpu: 2.5, diskGb: 75, slots: 64, priceInr: 749, popular: true },
      { id: "smart-rp-4", profileId: "rp", name: "Syndicate", tierLabel: "Tier 4", capacityHint: "Up to 128 slots", ramMb: 12288, vcpu: 3.5, diskGb: 120, slots: 128, priceInr: 1149 },
      { id: "smart-rp-5", profileId: "rp", name: "Metropolis", tierLabel: "Tier 5", capacityHint: "256+ OneSync", ramMb: 16384, vcpu: 4.5, diskGb: 160, slots: 256, priceInr: 1499 },
    ],
  },
  surv: {
    id: "surv",
    label: "3D Open-World Survival & Sandbox",
    serviceId: "minecraft",
    ramRangeLabel: "4GB – 16GB RAM",
    reasoning:
      "3D survival games (Valheim, V Rising, 7 Days to Die, Sons of the Forest, Eco) keep persistent bases and AI active in RAM — 4GB is the stable floor and 8GB is ideal for tribes.",
    plans: [
      { id: "smart-surv-1", profileId: "surv", name: "Co-op Duo", tierLabel: "Tier 1", capacityHint: "2–6 players", ramMb: 4096, vcpu: 2.0, diskGb: 30, priceInr: 359 },
      { id: "smart-surv-2", profileId: "surv", name: "Squad", tierLabel: "Tier 2", capacityHint: "6–12 players", ramMb: 6144, vcpu: 2.5, diskGb: 45, priceInr: 519 },
      { id: "smart-surv-3", profileId: "surv", name: "Tribe Pro", tierLabel: "Tier 3", capacityHint: "12–24 players", ramMb: 8192, vcpu: 3.0, diskGb: 65, priceInr: 679, popular: true },
      { id: "smart-surv-4", profileId: "surv", name: "Community", tierLabel: "Tier 4", capacityHint: "24–50 players", ramMb: 12288, vcpu: 4.0, diskGb: 95, priceInr: 979 },
      { id: "smart-surv-5", profileId: "surv", name: "Dedicated World", tierLabel: "Tier 5", capacityHint: "50+ / huge map", ramMb: 16384, vcpu: 5.0, diskGb: 130, priceInr: 1299 },
    ],
  },
  heavy: {
    id: "heavy",
    label: "Heavy Open-World Engine (Rust / ARK / Palworld)",
    serviceId: "fivem",
    ramRangeLabel: "6GB – 24GB RAM",
    reasoning:
      "Large Unreal/Unity world servers like Rust, ARK, Palworld, Enshrouded, Satisfactory, and Conan Exiles need at least 6GB to boot without OOM crashes and 12GB–16GB for active wipes.",
    plans: [
      { id: "smart-heavy-1", profileId: "heavy", name: "Minimum Entry", tierLabel: "Tier 1", capacityHint: "Small private map", ramMb: 6144, vcpu: 2.5, diskGb: 50, priceInr: 549 },
      { id: "smart-heavy-2", profileId: "heavy", name: "Standard Map", tierLabel: "Tier 2", capacityHint: "Up to 32 players", ramMb: 8192, vcpu: 3.0, diskGb: 75, priceInr: 749 },
      { id: "smart-heavy-3", profileId: "heavy", name: "High-Pop", tierLabel: "Tier 3", capacityHint: "Up to 75 players", ramMb: 12288, vcpu: 4.0, diskGb: 110, priceInr: 1099, popular: true },
      { id: "smart-heavy-4", profileId: "heavy", name: "Mega Map", tierLabel: "Tier 4", capacityHint: "100+ / modded", ramMb: 16384, vcpu: 5.0, diskGb: 150, priceInr: 1449 },
      { id: "smart-heavy-5", profileId: "heavy", name: "Titan Dedicated", tierLabel: "Tier 5", capacityHint: "Max entities / wipe", ramMb: 24576, vcpu: 6.0, diskGb: 220, priceInr: 2099 },
    ],
  },
};

const SMART_PLAN_INDEX = new Map<string, { profile: EggResourceProfile; plan: SmartPlanTier }>();
for (const profile of Object.values(EGG_RESOURCE_PROFILES)) {
  for (const plan of profile.plans) {
    SMART_PLAN_INDEX.set(plan.id, { profile, plan });
  }
}

export function findSmartPlan(planId: string): { profile: EggResourceProfile; plan: SmartPlanTier } | null {
  return SMART_PLAN_INDEX.get(planId) ?? null;
}

export function getDefaultProfileForService(service: ServiceId): EggResourceProfile {
  if (service === "samp") return EGG_RESOURCE_PROFILES.samp;
  if (service === "minecraft") return EGG_RESOURCE_PROFILES["mc-java"];
  if (service === "fivem") return EGG_RESOURCE_PROFILES.rp;
  return EGG_RESOURCE_PROFILES.bot;
}

/**
 * Intelligently profiles ANY of the 321 official Pterodactyl eggs (Games, Applications & Bots,
 * Generic Runtimes) into the best-fitting 5-tier hardware profile.
 */
export function resolveEggResourceProfile(
  egg: Pick<EggCatalogItem, "section" | "name" | "category" | "repoPath" | "description">,
): EggResourceProfile {
  const hay = `${egg.name} ${egg.category} ${egg.repoPath}`.toLowerCase();

  // 1. Generic Runtimes (12 eggs)
  if (egg.section === "generic") {
    if (/(golang|rust|java|c#|csharp|elixir)/i.test(hay)) {
      return EGG_RESOURCE_PROFILES.app;
    }
    return EGG_RESOURCE_PROFILES.bot;
  }

  // 2. Applications & Bots (55 eggs)
  if (egg.section === "applications") {
    if (/(elasticsearch|folding)/i.test(hay)) {
      return EGG_RESOURCE_PROFILES.heavy;
    }
    if (/(database|postgres|mariadb|mysql|mongo|redis|rethinkdb|meilisearch|rabbitmq|minio|gitea|forgejo|grafana|prometheus|loki|code server|owncast|lavalink|reposilite|languagetool)/i.test(hay)) {
      return EGG_RESOURCE_PROFILES.app;
    }
    if (
      /(bots\/|voice\/|teamspeak|ts3|uptime|haste|rathole|yarr|\b5e\b|sftp|\bnats\b|phantom|soge|sinusbot|jmusic|aoede|bastion|corp|dynamica|fragbot|muse|parkertron|pixel|ree6|\bred\b|big brother)/i.test(
        hay,
      )
    ) {
      return EGG_RESOURCE_PROFILES.bot;
    }
    return EGG_RESOURCE_PROFILES.app;
  }

  // 3. Game Servers (254 eggs)
  // 3a. Minecraft Proxies & Limbo -> Ultra-light (512MB - 4GB)
  if (/(minecraft\/proxy|velocity|waterfall|travertine|waterdog|viaaas|limbo|crewlink)/i.test(hay)) {
    return EGG_RESOURCE_PROFILES.bot;
  }

  // 3b. Minecraft Bedrock & Modded Terraria -> 2GB - 10GB
  if (/(minecraft\/bedrock|pocketmine|nukkit|gomint|levilamina|liteloader|tmodloader)/i.test(hay)) {
    return EGG_RESOURCE_PROFILES["mc-bed"];
  }

  // 3c. Minecraft Modded Java (Forge, Fabric, Modpacks) -> 4GB - 20GB
  if (
    /(forge|neoforge|fabric|quilt|curseforge|modrinth|ftb|mohist|magma|arclight|spongeforge|tekkit|hexxit|blightfall|attack of the b|1\.12\.2|1\.7\.10|the1 12|the1 7)/i.test(
      hay,
    )
  ) {
    return EGG_RESOURCE_PROFILES["mc-mod"];
  }

  // 3d. Minecraft Java (Paper, Purpur, Spigot, Folia, Hytale) -> 3GB - 16GB
  if (/(minecraft\/java|minecraft\/crossplay|paper|purpur|spigot|folia|canvasmc|canvas mc|cuberite|glowstone|krypton|sponge|vanillacord|vanilla cord|hytale)/i.test(hay)) {
    return EGG_RESOURCE_PROFILES["mc-java"];
  }

  // 3e. Heavy Open-World Giants (Rust, ARK, Palworld, Enshrouded, Satisfactory, Conan, SCUM, Space Engineers) -> 6GB - 24GB
  if (
    /(\brust\b|\bark\b|pixark|palworld|enshrouded|satisfactory|conan|\bscum\b|soulmask|icarus|myth of empires|the front|thefront|the isle|path of titans|space engineers|empyrion)/i.test(
      hay,
    )
  ) {
    return EGG_RESOURCE_PROFILES.heavy;
  }

  // 3f. Classic Native / SA-MP / Source / 2D / Retro -> 1GB - 8GB
  if (
    /(samp|s a m p|openmp|open m p|mtasa|multi theft auto|gtac|grand theft auto connected|cs 1\.6|counter strike1|counter strike source|cs2d|c s2 d|hlds|half life|hl2|sven|team fortress|left4dead|quake|openarena|urban terror|urbanterror|wolfenstein|et legacy|e t legacy|xonotic|teeworlds|ddnet|d d net|ddrace|d d race|soldat|openttd|open t t d|openra|open r a|openrct2|cubeengine|assault cube|cube2|doom|zandronum|mindustry|classicube|classi cube|sonic robo|supertuxkart|super tux|clone hero|impostor|factorio|terraria|tshock|starbound|core keeper|necesse|minetest|dont starve|don t starve|subnautica|rimworld|trackmania|truck simulator|\bfof\b|black mesa|nazi zombies|open fortress|sourcecoop|source coop|nmrih|contagion|banana shooter|puck|tachyon|\bksp\b|k s p|risk of rain|tower unite|league sandbox|iw4x|\bcod\b|mohaa|losangelescrimes|l a c)/i.test(
      hay,
    )
  ) {
    return EGG_RESOURCE_PROFILES.samp;
  }

  // 3g. GTA V RP, Tactical FPS & Modern High-Tick Multiplayer -> 4GB - 16GB
  if (
    /(fivem|five m|redm|red m|altv|alt v|ragemp|rage m p|ragecoop|rage c o o p|gmod|garry|counter strike2|\bcs2\b|assetto corsa|automobilista|beamng|beam m p|kissmp|unturned|scpsl|s c p s l|insurgency|squad|arma|bannerlord|mordhau|dayz|pavlov|killing floor|holdfast|ground branch|post scriptum|barotrauma|project zomboid|harsh doorstop|\br5\b|americas army|america s army|battalion|onset|just cause|j c3|tarkov)/i.test(
      hay,
    )
  ) {
    return EGG_RESOURCE_PROFILES.rp;
  }

  // 3h. FoundryVTT (categorized in games repo) -> App/VTT 1GB - 8GB
  if (/foundryvtt/i.test(hay)) {
    return EGG_RESOURCE_PROFILES.app;
  }

  // 3i. Default for all other modern 3D survival / sandbox games -> 4GB - 16GB
  return EGG_RESOURCE_PROFILES.surv;
}
