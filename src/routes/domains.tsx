import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Globe, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import { StatusBadge, useDeploySession } from "@/components/deploy/deploy-ui";

export const Route = createFileRoute("/domains")({
  head: () => ({
    meta: [{ title: "Domains & SSL — SparrowX Deploy" }],
  }),
  component: GlobalDomainsPage,
});

interface DomainRow {
  id: string;
  projectId: string;
  projectName: string;
  domain: string;
  isDefault: boolean;
  verified: boolean;
  tlsStatus: string;
  verificationTarget: string;
}

function GlobalDomainsPage() {
  const { user, checking } = useDeploySession(true);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [cnameTarget, setCnameTarget] = useState("deploy.sparrowx.net");
  const [edgeIp, setEdgeIp] = useState("139.99.131.135");
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deploy/domains", { credentials: "include" });
      const data = await res.json();
      if (data?.ok) {
        setDomains(Array.isArray(data.domains) ? data.domains : []);
        if (data.cnameTarget) setCnameTarget(data.cnameTarget);
        if (data.edgeIp) setEdgeIp(data.edgeIp);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void loadDomains();
  }, [user]);

  const verifyDns = async (domainId: string) => {
    setCheckingId(domainId);
    try {
      const res = await fetch("/api/deploy/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domainId }),
      });
      const d = await res.json();
      if (d?.verified) toast.success(d.detail || "DNS verified & Let's Encrypt TLS active.");
      else toast.warning(d?.detail || "DNS record not propagated yet.");
      await loadDomains();
    } catch {
      toast.error("DNS check failed.");
    } finally {
      setCheckingId(null);
    }
  };

  const deleteDomain = async (domainId: string) => {
    await fetch(`/api/deploy/domains?id=${encodeURIComponent(domainId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    toast.success("Domain removed.");
    await loadDomains();
  };

  const copyVal = (k: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(k);
    toast.success("Copied DNS target");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-xs spx-mono text-zinc-400">
        Verifying session...
      </div>
    );
  }

  return (
    <DeployAppShell user={user} activeNav="domains">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Domains &amp; Automated SSL
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Automatic Let&apos;s Encrypt On-Demand TLS across all *.deploy.sparrowx.net and verified
            custom domains.
          </p>
        </div>

        {/* DNS Reference Card */}
        <div className="rounded-2xl spx-obsidian-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-white/[0.06] bg-[#06080E] p-3.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] spx-mono text-zinc-500">SUBDOMAIN CNAME TARGET</div>
              <div className="spx-mono text-sky-400 mt-0.5">{cnameTarget}</div>
            </div>
            <button
              type="button"
              onClick={() => copyVal("cname", cnameTarget)}
              className="size-8 rounded-md spx-ghost-btn grid place-items-center cursor-pointer"
            >
              {copiedKey === "cname" ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#06080E] p-3.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] spx-mono text-zinc-500">
                APEX A RECORD (OVH MUMBAI EDGE)
              </div>
              <div className="spx-mono text-emerald-400 mt-0.5">{edgeIp}</div>
            </div>
            <button
              type="button"
              onClick={() => copyVal("ip", edgeIp)}
              className="size-8 rounded-md spx-ghost-btn grid place-items-center cursor-pointer"
            >
              {copiedKey === "ip" ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl spx-obsidian-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs spx-mono text-zinc-500">Loading domains...</div>
          ) : domains.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Globe className="size-6 mx-auto text-zinc-500" />
              <div className="text-sm font-medium text-white">No domains provisioned yet</div>
              <p className="text-xs text-zinc-400">
                Deploy a project to receive an automatic HTTPS subdomain.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {domains.map((dom) => (
                <div
                  key={dom.id}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm spx-mono font-semibold text-white">
                        {dom.domain}
                      </span>
                      <StatusBadge status={dom.verified ? "Active" : "Pending"} />
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <a href={`/projects/${dom.projectId}`} className="hover:text-white underline">
                        {dom.projectName}
                      </a>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 spx-mono text-emerald-400">
                        <ShieldCheck className="size-3" />
                        TLS {dom.tlsStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!dom.isDefault && (
                      <>
                        <button
                          type="button"
                          disabled={checkingId === dom.id}
                          onClick={() => void verifyDns(dom.id)}
                          className="h-8 rounded-md spx-ghost-btn px-3 text-xs cursor-pointer"
                        >
                          {checkingId === dom.id ? "Verifying..." : "Verify DNS"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDomain(dom.id)}
                          className="size-8 rounded-md spx-ghost-btn hover:text-red-400 grid place-items-center cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
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
