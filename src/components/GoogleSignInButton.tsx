import React from "react";

interface OAuthButtonProps {
  nextPath?: string;
  label?: string;
  className?: string;
}

interface OAuthSignInButtonsProps {
  nextPath?: string;
  googleLabel?: string;
  githubLabel?: string;
  layout?: "stack" | "row";
  compact?: boolean;
  className?: string;
}

function buildCanonicalOAuthHref(provider: "google" | "github", nextPath?: string): string {
  const endpoint = `/api/auth/${provider}/login`;
  if (typeof window === "undefined") {
    return `${endpoint}?next=${encodeURIComponent(nextPath || "/")}`;
  }
  const rawTarget =
    nextPath ||
    `${window.location.pathname}${window.location.search || ""}` ||
    "/";

  const host = window.location.hostname.toLowerCase();
  const isSparrowxProd = host === "sparrowx.net" || host.endsWith(".sparrowx.net");
  if (isSparrowxProd) {
    const fullReturn =
      rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
        ? rawTarget
        : `${window.location.origin}${rawTarget.startsWith("/") ? rawTarget : `/${rawTarget}`}`;
    return `https://sparrowx.net${endpoint}?next=${encodeURIComponent(fullReturn)}`;
  }

  return `${endpoint}?next=${encodeURIComponent(rawTarget)}`;
}

/**
 * Builds the canonical Google OAuth start URL.
 * Always initiates on `https://sparrowx.net/api/auth/google/login` for `*.sparrowx.net`
 * so the CSRF state cookie matches the callback origin.
 */
export function buildGoogleLoginHref(nextPath?: string): string {
  return buildCanonicalOAuthHref("google", nextPath);
}

/**
 * Builds the canonical GitHub OAuth start URL.
 * Always initiates on `https://sparrowx.net/api/auth/github/login` for `*.sparrowx.net`
 * so the CSRF state cookie matches the callback origin.
 */
export function buildGithubLoginHref(nextPath?: string): string {
  return buildCanonicalOAuthHref("github", nextPath);
}

export function GoogleBrandIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export function GitHubBrandIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  nextPath,
  label = "Continue with Google",
  className = "",
}: OAuthButtonProps) {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = buildGoogleLoginHref(nextPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm border border-zinc-200 shadow-sm transition-colors cursor-pointer ${className}`}
    >
      <GoogleBrandIcon className="size-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function GitHubSignInButton({
  nextPath,
  label = "Continue with GitHub",
  className = "",
}: OAuthButtonProps) {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = buildGithubLoginHref(nextPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#161B22] hover:bg-[#1F2630] text-white font-semibold text-sm border border-white/15 shadow-sm transition-colors cursor-pointer ${className}`}
    >
      <GitHubBrandIcon className="size-4 shrink-0 text-white" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Unified SparrowX OAuth-only sign-in group (Google + GitHub).
 * Replaces all manual email/password forms across every SparrowX service.
 */
export function OAuthSignInButtons({
  nextPath,
  googleLabel = "Continue with Google",
  githubLabel = "Continue with GitHub",
  layout = "stack",
  compact = false,
  className = "",
}: OAuthSignInButtonsProps) {
  const btnCompactClass = compact ? "!min-h-[34px] !py-1.5 !px-3 !text-xs !rounded-lg !w-auto gap-2" : "";
  return (
    <div
      className={`${
        layout === "row"
          ? "flex flex-wrap items-center gap-2"
          : "space-y-2.5 w-full"
      } ${className}`}
    >
      <GoogleSignInButton nextPath={nextPath} label={googleLabel} className={btnCompactClass} />
      <GitHubSignInButton nextPath={nextPath} label={githubLabel} className={btnCompactClass} />
    </div>
  );
}
