import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EGG_RESOURCE_PROFILES, resolveEggResourceProfile } from "@/lib/egg-smart-plans";
import { findPlan } from "@/lib/services";
import type { EggCatalogItem, EggCatalogPayload } from "@/routes/api/game/eggs-catalog";

const CATALOG_PATH = path.resolve(process.cwd(), "public/data/ptero-eggs-catalog.json");
const CATALOG = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as EggCatalogPayload;

function findEgg(match: (e: EggCatalogItem) => boolean): EggCatalogItem {
  const found = CATALOG.eggs.find(match);
  if (!found) throw new Error("Expected egg not found in catalog");
  return found;
}

describe("Smart 5-Plan Egg Resource Profiler (all 321 eggs)", () => {
  it("profiles every one of the 321 catalog eggs into 5 server-validatable plans", () => {
    expect(CATALOG.eggs.length).toBeGreaterThanOrEqual(300);

    for (const egg of CATALOG.eggs) {
      const profile = resolveEggResourceProfile(egg);
      expect(profile.plans).toHaveLength(5);

      // Strictly increasing RAM & price across all 5 tiers
      for (let i = 1; i < profile.plans.length; i++) {
        expect(profile.plans[i]!.ramMb).toBeGreaterThan(profile.plans[i - 1]!.ramMb);
        expect(profile.plans[i]!.priceInr).toBeGreaterThan(profile.plans[i - 1]!.priceInr);
      }

      // Every smart plan ID resolves server-side via findPlan()
      for (const plan of profile.plans) {
        const resolved = findPlan(plan.id);
        expect(resolved).not.toBeNull();
        expect(resolved!.plan.ramMb).toBe(plan.ramMb);
        expect(resolved!.plan.priceInr).toBe(plan.priceInr);
      }
    }

    expect(Object.keys(EGG_RESOURCE_PROFILES)).toHaveLength(9);
  });

  it("assigns logical real-world RAM ranges AND attractive themed plan names across Games, Applications & Generic Runtimes", () => {
    const samp = findEgg((e) => e.repoPath.includes("gta/samp/"));
    const sampProfile = resolveEggResourceProfile(samp);
    expect(sampProfile.ramRangeLabel).toBe("1GB – 8GB RAM");
    expect(sampProfile.plans.map((p) => p.name)).toEqual([
      "Grove Street",
      "Idlewood Turf",
      "Los Santos RP",
      "San Fierro City",
      "Las Venturas Max",
    ]);

    const paper = findEgg((e) => e.repoPath.includes("minecraft/java/paper/"));
    const paperProfile = resolveEggResourceProfile(paper);
    expect(paperProfile.ramRangeLabel).toBe("3GB – 16GB RAM");
    expect(paperProfile.plans.map((p) => p.name)).toEqual([
      "Oak SMP",
      "Iron Realm",
      "Diamond Core",
      "Netherite Pro",
      "Ender Titan",
    ]);

    const forge = findEgg((e) => e.repoPath.includes("minecraft/java/forge/"));
    const forgeProfile = resolveEggResourceProfile(forge);
    expect(forgeProfile.ramRangeLabel).toBe("4GB – 20GB RAM");
    expect(forgeProfile.plans[2]!.name).toBe("Beacon Forge");

    const bedrock = findEgg((e) => e.repoPath.includes("minecraft/bedrock/bedrock/"));
    const bedrockProfile = resolveEggResourceProfile(bedrock);
    expect(bedrockProfile.ramRangeLabel).toBe("2GB – 10GB RAM");
    expect(bedrockProfile.plans[2]!.name).toBe("Emerald Bedrock");

    const velocity = findEgg((e) => e.repoPath.includes("minecraft/proxy/java/velocity/"));
    const velocityProfile = resolveEggResourceProfile(velocity);
    expect(velocityProfile.ramRangeLabel).toBe("512MB – 4GB RAM");
    expect(velocityProfile.plans[1]!.name).toBe("Velocity Edge");

    const fivem = findEgg((e) => e.repoPath.includes("gta/fivem/"));
    const fivemProfile = resolveEggResourceProfile(fivem);
    expect(fivemProfile.ramRangeLabel).toBe("4GB – 16GB RAM");
    expect(fivemProfile.plans[2]!.name).toBe("Midnight City");

    const palworld = findEgg((e) => e.section === "games" && e.name.toLowerCase() === "palworld");
    const palProfile = resolveEggResourceProfile(palworld);
    expect(palProfile.ramRangeLabel).toBe("6GB – 24GB RAM");
    expect(palProfile.plans[2]!.name).toBe("Alpha Pal");

    const rustGame = findEgg((e) => e.section === "games" && e.repoPath.includes("rust/"));
    const rustGameProfile = resolveEggResourceProfile(rustGame);
    expect(rustGameProfile.ramRangeLabel).toBe("6GB – 24GB RAM");
    expect(rustGameProfile.plans[2]!.name).toBe("Stone Compound");

    const rustGeneric = findEgg((e) => e.section === "generic" && e.name.toLowerCase().includes("rust"));
    const rustGenProfile = resolveEggResourceProfile(rustGeneric);
    expect(rustGenProfile.ramRangeLabel).toBe("1GB – 8GB RAM");
    expect(rustGenProfile.plans[1]!.name).toBe("Tokio Core");

    const redis = findEgg((e) => e.section === "applications" && e.name.toLowerCase().includes("redis 7"));
    const redisProfile = resolveEggResourceProfile(redis);
    expect(redisProfile.ramRangeLabel).toBe("1GB – 8GB RAM");
    expect(redisProfile.plans[0]!.name).toBe("Cache Micro");

    const postgres = findEgg((e) => e.section === "applications" && e.name.toLowerCase().includes("postgres16"));
    expect(resolveEggResourceProfile(postgres).plans[2]!.name).toBe("Primary Vault");

    const uptimeKuma = findEgg((e) => e.section === "applications" && e.name.toLowerCase().includes("uptime kuma"));
    expect(resolveEggResourceProfile(uptimeKuma).plans[0]!.name).toBe("Pulse Watch");

    const pythonGeneric = findEgg((e) => e.section === "generic" && e.name.toLowerCase().includes("python"));
    const pyProfile = resolveEggResourceProfile(pythonGeneric);
    expect(pyProfile.ramRangeLabel).toBe("512MB – 4GB RAM");
    expect(pyProfile.plans[1]!.name).toBe("FastAPI Core");

    const nodeGeneric = findEgg((e) => e.section === "generic" && e.name.toLowerCase().includes("node"));
    expect(resolveEggResourceProfile(nodeGeneric).plans[0]!.name).toBe("Event Loop");
  });
});
