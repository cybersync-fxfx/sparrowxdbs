import fs from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";

export interface EggSectionSummary {
  id: "games" | "applications" | "generic";
  title: string;
  nestName: string;
  nestId: number | null;
  repoUrl: string;
  commit: string;
  count: number;
}

export interface EggCatalogItem {
  id: string;
  section: "games" | "applications" | "generic";
  nestName: string;
  nestId: number | null;
  eggId: number | null;
  installed: boolean;
  name: string;
  category: string;
  description: string;
  author: string;
  dockerImage: string;
  repoPath: string;
}

export interface EggCatalogPayload {
  version: string;
  generatedAt: string;
  totalEggs: number;
  sections: EggSectionSummary[];
  eggs: EggCatalogItem[];
}

function loadEggCatalogFromDisk(): EggCatalogPayload | null {
  const dataDir = process.env.SPARROWX_DATA_DIR || path.resolve(process.cwd(), "data");
  const candidates = [
    path.resolve(dataDir, "ptero-eggs-catalog.json"),
    path.resolve(process.cwd(), "data/ptero-eggs-catalog.json"),
    path.resolve(process.cwd(), ".output/public/data/ptero-eggs-catalog.json"),
    path.resolve(process.cwd(), "public/data/ptero-eggs-catalog.json"),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as EggCatalogPayload;
      if (parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.eggs)) {
        return parsed;
      }
    } catch {
      // Try next fallback catalog path
    }
  }
  return null;
}

export const Route = createFileRoute("/api/game/eggs-catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const catalog = loadEggCatalogFromDisk();
        if (!catalog) {
          return Response.json(
            {
              ok: false,
              error: "Game egg catalog is currently syncing. Please check back shortly.",
              sections: [],
              eggs: [],
              totalEggs: 0,
            },
            { status: 200, headers: { "Cache-Control": "no-cache" } },
          );
        }

        const url = new URL(request.url);
        const section = (url.searchParams.get("section") || "").trim().toLowerCase();
        const query = (url.searchParams.get("q") || "").trim().toLowerCase();

        let filtered = catalog.eggs;
        if (section === "games" || section === "applications" || section === "generic") {
          filtered = filtered.filter((e) => e.section === section);
        }
        if (query) {
          filtered = filtered.filter(
            (e) =>
              e.name.toLowerCase().includes(query) ||
              e.category.toLowerCase().includes(query) ||
              e.description.toLowerCase().includes(query),
          );
        }

        return Response.json(
          {
            ok: true,
            version: catalog.version,
            generatedAt: catalog.generatedAt,
            totalEggs: catalog.totalEggs,
            sections: catalog.sections,
            eggs: filtered,
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-cache, max-age=30" },
          },
        );
      },
    },
  },
});
