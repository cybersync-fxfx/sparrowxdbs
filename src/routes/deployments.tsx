import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, Rocket, Terminal } from "lucide-react";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import {
  formatRelativeTime,
  FrameworkIcon,
  StatusBadge,
  useDeploySession,
} from "@/components/deploy/deploy-ui";

export const Route = createFileRoute("/deployments")({
  head: () => ({
    meta: [{ title: "Deployments — SparrowX Deploy" }],
  }),
  component: GlobalDeploymentsPage,
});

interface GlobalDeploymentItem {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  framework: string;
  status: string;
  triggerSource: string;
  branch: string;
  commitSha?: string | null;
  commitMessage: string;
  durationMs?: number | null;
  createdAt: string;
}

function GlobalDeploymentsPage() {
  const { user, checking } = useDeploySession(true);
  const [deployments, setDeployments] = useState<GlobalDeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/deploy/deployments", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.deployments)) setDeployments(d.deployments);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-xs spx-mono text-zinc-400">
        Verifying session...
      </div>
    );
  }

  return (
    <DeployAppShell user={user} activeNav="deployments">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Global Deployments
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time build and rollout activity across every project in your workspace.
            </p>
          </div>
          <a
            href="/deploy/new"
            className="h-9 rounded-lg spx-silver-btn inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold"
          >
            <Rocket className="size-3.5" />
            <span>New Deployment</span>
          </a>
        </div>

        <div className="rounded-2xl spx-obsidian-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs spx-mono text-zinc-500">
              Loading deployment history...
            </div>
          ) : deployments.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="text-sm font-medium text-white">No deployments yet</div>
              <p className="text-xs text-zinc-400">
                Create your first project to stream live Railpack and BuildKit builds.
              </p>
              <a
                href="/deploy/new"
                className="inline-flex h-9 items-center rounded-lg spx-silver-btn px-4 text-xs font-semibold"
              >
                Import Repository
              </a>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {deployments.map((dep) => (
                <div
                  key={dep.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-9 rounded-lg border border-white/10 bg-[#06080E] grid place-items-center shrink-0">
                      <FrameworkIcon framework={dep.framework} className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/projects/${dep.projectId}`}
                          className="text-sm font-semibold text-white hover:underline"
                        >
                          {dep.projectName}
                        </a>
                        <StatusBadge status={dep.status} />
                        <span className="spx-mono text-[11px] text-sky-400">
                          {dep.commitSha?.slice(0, 7) || dep.id.slice(-7)}
                        </span>
                        <span className="text-[11px] spx-mono text-zinc-500">
                          <GitBranch className="size-3 inline mr-1" />
                          {dep.branch}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{dep.commitMessage}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] spx-mono text-zinc-500 tabular-nums">
                      {formatRelativeTime(dep.createdAt)}
                      {dep.durationMs ? ` · ${(dep.durationMs / 1000).toFixed(1)}s` : ""}
                    </span>
                    <a
                      href={`/projects/${dep.projectId}?tab=logs`}
                      className="h-8 rounded-md spx-ghost-btn inline-flex items-center gap-1.5 px-3 text-xs"
                    >
                      <Terminal className="size-3.5 text-sky-400" />
                      <span>Logs</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DeployAppShell>
  );
}
