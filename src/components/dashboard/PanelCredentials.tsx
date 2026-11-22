import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, ExternalLink, KeyRound, Loader2, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [showCustomReset, setShowCustomReset] = useState(false);
  const [customPassword, setCustomPassword] = useState("");

  const reveal = useMutation({
    mutationFn: () => revealPanelPassword(),
    onSuccess: (pw) => {
      setPassword(pw);
      setShown(true);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const reset = useMutation({
    mutationFn: (newPassword?: string) =>
      resetPanelPassword({ data: newPassword ? { newPassword } : {} }),
    onSuccess: (pw) => {
      setPassword(pw);
      setShown(true);
      setCustomPassword("");
      setShowCustomReset(false);
      toast.success("Panel password updated", {
        description: "Synced live to game.panel.sparrowx.net with your Google email.",
      });
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
    <div id="settings" className="surface-3d rim-sheen flex flex-col justify-between rounded-3xl p-6 scroll-mt-24">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-discord glow-discord">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold">Panel Settings &amp; Credentials</h3>
              <p className="font-mono text-[11px] text-muted-foreground">{panel.url.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
            <ShieldCheck className="size-3" /> Google Synced
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Panel Username</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm">{panel.username ?? "Syncing on next login…"}</span>
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Synced Google Email</p>
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
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Panel Password</p>
              <button
                type="button"
                onClick={() => setShowCustomReset((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-sheen hover:underline"
              >
                <Settings2 className="size-3" /> {showCustomReset ? "Cancel" : "Set Custom"}
              </button>
            </div>
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

            {showCustomReset && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customPassword.trim().length >= 8) {
                    reset.mutate(customPassword.trim());
                  }
                }}
                className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5"
              >
                <Input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  minLength={8}
                  maxLength={64}
                  className="h-8 bg-background/70 font-mono text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="discord"
                  className="h-8 rounded-lg px-3 text-xs"
                  disabled={reset.isPending || customPassword.trim().length < 8}
                >
                  {reset.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="rounded-xl"
          onClick={() => reset.mutate(undefined)}
          disabled={reset.isPending}
        >
          {reset.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reset Password
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
