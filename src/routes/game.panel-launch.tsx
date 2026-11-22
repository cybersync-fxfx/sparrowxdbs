import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPanelLaunchContext, resetPanelPassword, revealPanelPassword } from "@/lib/portal.functions";

const searchSchema = z.object({
  next: z.string().optional(),
  mode: z.string().optional(),
});

function sanitizeNext(raw?: string): string {
  if (!raw) return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("\\")) return "/";
  return t;
}

export const Route = createFileRoute("/game/panel-launch")({
  validateSearch: searchSchema,
  component: PanelLaunchPage,
});

function PanelLaunchPage() {
  const { next } = Route.useSearch();
  const safeNext = sanitizeNext(next);
  const navigate = useNavigate();
  const [revealedPass, setRevealedPass] = useState<string | null>(null);
  const [syncedUsername, setSyncedUsername] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const infoQ = useQuery({
    queryKey: ["game-panel-launch-context"],
    queryFn: () => getPanelLaunchContext(),
    retry: false,
  });

  useEffect(() => {
    if (infoQ.error instanceof Error && infoQ.error.message.includes("UNAUTHENTICATED")) {
      navigate({ to: "/game" });
    }
  }, [infoQ.error, navigate]);

  const revealMut = useMutation({
    mutationFn: () => revealPanelPassword(),
    onSuccess: (pw) => setRevealedPass(pw),
    onError: (e) => toast.error(e instanceof Error ? e.message.replace(/^[A-Z_]+:\s*/, "") : "Unable to reveal password"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetPanelPassword({ data: {} }),
    onSuccess: (res) => {
      const nextPassword = typeof res === "string" ? res : res.password;
      const nextUsername = typeof res === "string" ? null : res.username;
      setRevealedPass(nextPassword);
      if (nextUsername) setSyncedUsername(nextUsername);
      toast.success("Panel password reset & synced live");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message.replace(/^[A-Z_]+:\s*/, "") : "Unable to reset password"),
  });

  const info = infoQ.data;
  const displayUsername = syncedUsername ?? info?.username ?? info?.email ?? "";
  const targetPanelUrl = info ? `${info.panelUrl}${safeNext === "/" ? "" : safeNext}` : "https://game.panel.sparrowx.net";

  const copyValue = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error("Copy failed — copy manually");
    }
  };

  const copyPasswordAndLaunch = async () => {
    try {
      const pw = revealedPass ?? (await revealPanelPassword());
      setRevealedPass(pw);
      await navigator.clipboard.writeText(pw);
      toast.success("Panel password copied — opening Pterodactyl Panel");
    } catch {
      toast.info("Opening Pterodactyl Panel");
    }
    window.open(targetPanelUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#07090F] text-white px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/[0.08]">
            <Link to="/game/dashboard">
              <ArrowLeft className="size-4" /> Back to Client Area
            </Link>
          </Button>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-300">
            <ShieldCheck className="size-3.5" /> Pterodactyl Panel Access
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0D111A] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
              <Terminal className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Game Control Panel Bridge</h1>
              <p className="mt-1 text-sm text-white/65">
                {info?.ssoReady
                  ? "Signed auto-login SSO bridge is online. Redirecting you directly into your panel session."
                  : "Direct Credential Assist is ready while the host SSO bridge initializes."}
              </p>
            </div>
          </div>

          {infoQ.isLoading ? (
            <div className="mt-8 flex items-center justify-center gap-3 py-8 text-sm text-white/60">
              <Loader2 className="size-5 animate-spin text-indigo-400" /> Loading your panel identity...
            </div>
          ) : info ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#07090F]/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-white/45">Target Panel Route</span>
                  <span className="font-mono text-xs text-cyan-300 break-all">{targetPanelUrl}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-white/55">Panel Username</span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-white/[0.06] px-2.5 py-1 font-mono text-xs text-white select-all">
                      {displayUsername}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-white/65 hover:text-white"
                      onClick={() => copyValue("user", displayUsername, "Username")}
                    >
                      {copiedKey === "user" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-white/55">
                    <KeyRound className="size-3.5" /> Panel Password
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-white/[0.06] px-2.5 py-1 font-mono text-xs text-white break-all select-all">
                      {revealedPass ?? "••••••••••••••••"}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-white/65 hover:text-white"
                      onClick={() => (revealedPass ? setRevealedPass(null) : revealMut.mutate())}
                      disabled={revealMut.isPending}
                      aria-label={revealedPass ? "Hide password" : "Reveal password"}
                    >
                      {revealMut.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : revealedPass ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-white/65 hover:text-white"
                      onClick={() => resetMut.mutate()}
                      disabled={resetMut.isPending}
                      title="Reset & sync new password"
                    >
                      {resetMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    </Button>
                    {revealedPass && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-white/65 hover:text-white"
                        onClick={() => copyValue("pass", revealedPass, "Password")}
                      >
                        {copiedKey === "pass" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {info.ssoReady ? (
                  <Button asChild size="lg" variant="discord" className="rounded-xl sm:col-span-2">
                    <a href={`/api/game/panel-sso?next=${encodeURIComponent(safeNext)}`}>
                      <ShieldCheck className="size-4" /> Auto-Login Into Game Panel <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      variant="discord"
                      className="rounded-xl"
                      onClick={copyPasswordAndLaunch}
                    >
                      <Copy className="size-4" /> Copy Password & Open Panel
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1]">
                      <a href={targetPanelUrl} target="_blank" rel="noreferrer">
                        Open Game Panel <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  </>
                )}
              </div>

              {!info.ssoReady && info.mode === "live" && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-200/90">
                  <RefreshCw className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  <span>
                    One-click OVH panel SSO (`sparrowx-sso.php`) activates automatically when `ovh/update.sh` or `ovh/fix.sh` syncs `PTERO_SSO_SECRET` to `game.panel.sparrowx.net`. Until then, use <strong>Copy Password &amp; Open Panel</strong> above.
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
