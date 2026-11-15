import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealPanelPassword, resetPanelPassword } from "@/lib/portal.functions";
import type { DashboardData } from "@/lib/portal-types";
import { errorText } from "./hooks";

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Couldn't access clipboard"),
  );
}

export function PanelCredentials({ panel }: { panel: DashboardData["panel"] }) {
  const [password, setPassword] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const reveal = useMutation({
    mutationFn: () => revealPanelPassword(),
    onSuccess: (pw) => {
      setPassword(pw);
      setShown(true);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const reset = useMutation({
    mutationFn: () => resetPanelPassword(),
    onSuccess: (pw) => {
      setPassword(pw);
      setShown(true);
      toast.success("Panel password synced", { description: "Your new password is live on the game panel." });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const handleCopy = (key: string, value: string, label: string) => {
    copy(value, label);
    setCopiedField(key);
    setTimeout(() => setCopiedField((cur) => (cur === key ? null : cur)), 1500);
  };

  const toggle = () => (password ? setShown((s) => !s) : reveal.mutate());
  const copyPw = async () => {
    if (password) return handleCopy("pw", password, "Password");
    try {
      const pw = await reveal.mutateAsync();
      handleCopy("pw", pw, "Password");
    } catch {
      /* toast handled */
    }
  };

  return (
    <div className="surface-3d rim-sheen flex flex-col justify-between rounded-3xl p-6">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-discord glow-discord">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold">Pterodactyl Panel</h3>
              <p className="font-mono text-[11px] text-muted-foreground">{panel.url.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
            <ShieldCheck className="size-3" /> SSO Ready
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Username</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm">{panel.username ?? "Not linked yet"}</span>
              {panel.username && (
                <button
                  type="button"
                  onClick={() => handleCopy("user", panel.username!, "Username")}
                  className="text-muted-foreground hover:text-sheen"
                  aria-label="Copy username"
                >
                  {copiedField === "user" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              )}
            </div>
          </div>
          {panel.email && (
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Panel Email</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-secondary-foreground">{panel.email}</span>
                <button
                  type="button"
                  onClick={() => handleCopy("email", panel.email!, "Email")}
                  className="text-muted-foreground hover:text-sheen"
                  aria-label="Copy email"
                >
                  {copiedField === "email" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fallback Password</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm">{shown && password ? password : "••••••••••••••••"}</span>
              <span className="flex items-center gap-3">
                <button type="button" onClick={toggle} className="text-muted-foreground hover:text-sheen" aria-label={shown ? "Hide password" : "Reveal password"}>
                  {reveal.isPending ? <Loader2 className="size-4 animate-spin" /> : shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button type="button" onClick={copyPw} className="text-muted-foreground hover:text-sheen" aria-label="Copy password">
                  {copiedField === "pw" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => reset.mutate()} disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync / Reset
        </Button>
        <Button asChild variant="discord" className="rounded-xl">
          <a href="/api/game/panel-sso?next=%2F" target="_blank" rel="noreferrer">
            Open Game Panel <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
