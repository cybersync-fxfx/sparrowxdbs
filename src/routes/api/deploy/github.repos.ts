import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/deploy/github/repos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
        }

        const { getGithubConnectionForActor } = await import("@/lib/server/deploy-store.server");
        const gh = await getGithubConnectionForActor(auth.actor);
        const url = new URL(request.url);
        const detectRepo = url.searchParams.get("detect");

        // Optional framework auto-detection for a public or private GitHub repo (`owner/repo`)
        if (detectRepo && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(detectRepo)) {
          const headers: Record<string, string> = {
            Accept: "application/vnd.github+json",
            "User-Agent": "SparrowX-Deploy/2.0",
          };
          if (gh.accessToken) headers.Authorization = `Bearer ${gh.accessToken}`;

          try {
            const contentsRes = await fetch(`https://api.github.com/repos/${detectRepo}/contents`, {
              headers,
              signal: AbortSignal.timeout(6000),
            });
            const items = contentsRes.ok
              ? ((await contentsRes.json()) as Array<{ name?: string }>)
              : [];
            const names = new Set(items.map((i) => String(i.name || "").toLowerCase()));

            let framework = "static";
            let buildMethod: "railpack" | "dockerfile" = "railpack";
            let buildCommand = "";
            let startCommand = "";
            let outputDir = ".";
            let port = 3000;

            if (names.has("dockerfile")) {
              framework = "docker";
              buildMethod = "dockerfile";
              buildCommand = "docker build .";
              outputDir = ".";
              port = 3000;
            } else if (names.has("requirements.txt") || names.has("pyproject.toml")) {
              framework = "python";
              buildCommand = "pip install -r requirements.txt";
              startCommand = "uvicorn main:app --host 0.0.0.0 --port 8000";
              port = 8000;
            } else if (names.has("package.json")) {
              const pkgRes = await fetch(
                `https://api.github.com/repos/${detectRepo}/contents/package.json`,
                { headers, signal: AbortSignal.timeout(5000) },
              ).catch(() => null);
              let depsText = "";
              if (pkgRes && pkgRes.ok) {
                const pkgJson = (await pkgRes.json()) as { content?: string };
                if (pkgJson.content) {
                  depsText = Buffer.from(pkgJson.content, "base64").toString("utf8");
                }
              }
              if (depsText.includes("@tanstack/react-start")) {
                framework = "tanstack";
                buildCommand = "npm run build";
                startCommand = "node .output/server/index.mjs";
                outputDir = ".output";
              } else if (depsText.includes('"next"')) {
                framework = "nextjs";
                buildCommand = "npm run build";
                startCommand = "npm run start";
                outputDir = ".next";
              } else if (depsText.includes('"vite"')) {
                framework = "vite";
                buildCommand = "npm run build";
                startCommand = "npx serve -s dist";
                outputDir = "dist";
              } else {
                framework = "node";
                buildCommand = "npm install";
                startCommand = "npm start";
                outputDir = ".";
              }
            }

            return Response.json(
              {
                ok: true,
                detected: { framework, buildMethod, buildCommand, startCommand, outputDir, port },
              },
              { headers: { "Cache-Control": "no-store" } },
            );
          } catch {
            return Response.json({
              ok: true,
              detected: {
                framework: "nextjs",
                buildMethod: "railpack",
                buildCommand: "npm run build",
                startCommand: "npm run start",
                outputDir: ".next",
                port: 3000,
              },
            });
          }
        }

        if (!gh.connected || !gh.accessToken) {
          return Response.json(
            { ok: true, connected: false, username: null, repos: [] },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        try {
          const res = await fetch(
            "https://api.github.com/user/repos?sort=updated&per_page=40&affiliation=owner,collaborator",
            {
              headers: {
                Authorization: `Bearer ${gh.accessToken}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "SparrowX-Deploy/2.0",
              },
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!res.ok) {
            return Response.json(
              {
                ok: true,
                connected: true,
                username: gh.username,
                repos: [],
                error: "GitHub token expired — reconnect GitHub.",
              },
              { headers: { "Cache-Control": "no-store" } },
            );
          }
          const raw = (await res.json()) as Array<{
            id: number;
            name: string;
            full_name: string;
            html_url: string;
            clone_url: string;
            default_branch: string;
            private: boolean;
            language: string | null;
            updated_at: string;
          }>;
          return Response.json(
            {
              ok: true,
              connected: true,
              username: gh.username,
              repos: raw.map((r) => ({
                id: r.id,
                name: r.name,
                fullName: r.full_name,
                htmlUrl: r.html_url,
                cloneUrl: r.clone_url,
                defaultBranch: r.default_branch || "main",
                isPrivate: r.private,
                language: r.language,
                updatedAt: r.updated_at,
              })),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: true, connected: true, username: gh.username, repos: [] },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
