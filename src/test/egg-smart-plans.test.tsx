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

  it("assigns logical real-world RAM ranges to SA-MP, Minecraft, FiveM, Rust, Palworld, Bots, Redis, and Generic Runtimes", () => {
    const samp = findEgg((e) => e.repoPath.includes("gta/samp/"));
    expect(resolveEggResourceProfile(samp).ramRangeLabel).toBe("1GB – 8GB RAM");

    const paper = findEgg((e) => e.repoPath.includes("minecraft/java/paper/"));
    expect(resolveEggResourceProfile(paper).ramRangeLabel).toBe("3GB – 16GB RAM");

    const forge = findEgg((e) => e.repoPath.includes("minecraft/java/forge/"));
    expect(resolveEggResourceProfile(forge).ramRangeLabel).toBe("4GB – 20GB RAM");

    const bedrock = findEgg((e) => e.repoPath.includes("minecraft/bedrock/bedrock/"));
    expect(resolveEggResourceProfile(bedrock).ramRangeLabel).toBe("2GB – 10GB RAM");

    const velocity = findEgg((e) => e.repoPath.includes("minecraft/proxy/java/velocity/"));
    expect(resolveEggResourceProfile(velocity).ramRangeLabel).toBe("512MB – 4GB RAM");

    const fivem = findEgg((e) => e.repoPath.includes("gta/fivem/"));
    expect(resolveEggResourceProfile(fivem).ramRangeLabel).toBe("4GB – 16GB RAM");

    const palworld = findEgg((e) => e.section === "games" && e.name.toLowerCase() === "palworld");
    expect(resolveEggResourceProfile(palworld).ramRangeLabel).toBe("6GB – 24GB RAM");

    const rustGame = findEgg((e) => e.section === "games" && e.repoPath.includes("rust/"));
    expect(resolveEggResourceProfile(rustGame).ramRangeLabel).toBe("6GB – 24GB RAM");

    const rustGeneric = findEgg((e) => e.section === "generic" && e.name.toLowerCase().includes("rust"));
    expect(resolveEggResourceProfile(rustGeneric).ramRangeLabel).toBe("1GB – 8GB RAM");

    const redis = findEgg((e) => e.section === "applications" && e.name.toLowerCase().includes("redis 7"));
    expect(resolveEggResourceProfile(redis).ramRangeLabel).toBe("1GB – 8GB RAM");

    const pythonGeneric = findEgg((e) => e.section === "generic" && e.name.toLowerCase().includes("python"));
    expect(resolveEggResourceProfile(pythonGeneric).ramRangeLabel).toBe("512MB – 4GB RAM");
  });
});
