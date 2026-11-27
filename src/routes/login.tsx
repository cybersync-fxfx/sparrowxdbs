import React, { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, ShieldCheck, User } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — SparrowX Deploy" },
      {
        name: "description",
        content: "Sign in to SparrowX Deploy with GitHub, Google, or your SparrowX account.",
      },
    ],
  }),
  component: SparrowxLoginPage,
});

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/deploy";
  return raw;
}

function SparrowxLoginPage() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { nextPath, authError } = useMemo(() => {
    if (typeof window === "undefined") return { nextPath: "/deploy", authError: "" };
    const sp = new URLSearchParams(window.location.search);
    return {
      nextPath: sanitizeNextPath(sp.get("next")),
      authError: sp.get("auth_error") || "",
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/master-sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          mode,
          ...(mode === "register" && fullName.trim() ? { fullName: fullName.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid email or password.");
      }
      window.location.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const githubUrl = `/api/auth/github/login?scope=repo&next=${encodeURIComponent(nextPath)}`;
  const googleUrl = `/api/auth/google/login?next=${encodeURIComponent(nextPath)}`;
  const isGameLogin = nextPath.startsWith("/game");

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans antialiased flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <a href={isGameLogin ? "/game" : "/"} className="flex items-center gap-2.5">
          <span className="size-7 rounded-md bg-gradient-to-b from-[#F3F6FA] to-[#CFD6E2] grid place-items-center">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-[#05060A]" aria-hidden="true">
              <path d="M12 3L21 19H3L12 3Z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            {isGameLogin ? "SparrowX Game Hosting" : "SparrowX Deploy"}
          </span>
        </a>
        <span className="inline-flex items-center gap-1.5 text-[11px] spx-mono text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>OVH Mumbai Edge</span>
        </span>
      </header>

      <main className="my-auto py-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl spx-obsidian-card p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] spx-mono uppercase tracking-wider text-zinc-300">
              <ShieldCheck className="size-3 text-emerald-400" />
              <span>SparrowX Unified SSO</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {mode === "signin"
                ? isGameLogin
                  ? "Sign in to Game Client Area"
                  : "Sign in to SparrowX Deploy"
                : isGameLogin
                  ? "Create your Game Hosting account"
                  : "Create your Deploy account"}
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isGameLogin ? (
                <>
                  Launch any of our 321+ games, bots, databases, and runtimes with smart 5-tier sizing and instant{" "}
                  <span className="spx-mono text-zinc-200">game.panel.sparrowx.net</span> SSO.
                </>
              ) : (
                <>
                  Deploy Git repositories with Railpack zero-config builds, instant{" "}
                  <span className="spx-mono text-zinc-200">*.deploy.sparrowx.net</span> SSL, and live
                  build logs.
                </>
              )}
            </p>
          </div>

          {(error || authError) && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              {error || authError}
            </div>
          )}

          {/* OAuth Providers */}
          <div className="space-y-2.5">
            <a
              href={githubUrl}
              className="w-full h-11 rounded-lg spx-silver-btn inline-flex items-center justify-center gap-2.5 text-sm font-semibold"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.95 10.95 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              <span>Continue with GitHub</span>
            </a>

            <a
              href={googleUrl}
              className="w-full h-11 rounded-lg spx-ghost-btn inline-flex items-center justify-center gap-2.5 text-sm font-medium"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-white/[0.07]" />
            <span className="px-3 text-[11px] spx-mono uppercase text-zinc-500">or email</span>
            <div className="flex-1 border-t border-white/[0.07]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Full Name</label>
                <div className="relative">
                  <User className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Atchu Kriz"
                    className="w-full h-10 rounded-lg spx-obsidian-input pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Work Email</label>
              <div className="relative">
                <Mail className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.in"
                  className="w-full h-10 rounded-lg spx-obsidian-input pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Password</label>
              <div className="relative">
                <Lock className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-10 rounded-lg spx-obsidian-input pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg spx-ghost-btn border-white/15 hover:bg-white/[0.1] text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? "Authenticating..."
                  : mode === "signin"
                    ? "Sign in with Email"
                    : "Create Account"}
              </span>
              <ArrowRight className="size-3.5" />
            </button>
          </form>

          <div className="text-center text-xs text-zinc-400">
            {mode === "signin" ? (
              <>
                New to SparrowX Deploy?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="text-zinc-200 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="text-zinc-200 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>© {new Date().getFullYear()} SparrowX Technologies</span>
        <span className="spx-mono">HttpOnly SSO · *.sparrowx.net</span>
      </footer>
    </div>
  );
}
