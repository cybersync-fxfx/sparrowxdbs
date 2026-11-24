import React from "react";

interface GoogleSignInButtonProps {
  nextPath?: string;
  label?: string;
  className?: string;
}

/**
 * Builds the canonical Google OAuth start URL.
 * On any `*.sparrowx.net` subdomain, always initiates OAuth on `https://sparrowx.net/api/auth/google/login`
 * with the full `https://<current-host><nextPath>` return URL so the OAuth state cookie is set on the
 * exact same origin Google calls back to (`https://sparrowx.net/api/auth/google/callback`), eliminating
 * cross-subdomain cookie loss.
 */
export function buildGoogleLoginHref(nextPath?: string): string {
  if (typeof window === "undefined") {
    return `/api/auth/google/login?next=${encodeURIComponent(nextPath || "/")}`;
  }
  const rawTarget =
    nextPath ||
    `${window.location.pathname}${window.location.search || ""}` ||
    "/";

  const host = window.location.hostname.toLowerCase();
  const isSparrowxProd = host === "sparrowx.net" || host.endsWith(".sparrowx.net");
  if (isSparrowxProd) {
    const fullReturn = rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
      ? rawTarget
      : `${window.location.origin}${rawTarget.startsWith("/") ? rawTarget : `/${rawTarget}`}`;
    return `https://sparrowx.net/api/auth/google/login?next=${encodeURIComponent(fullReturn)}`;
  }

  return `/api/auth/google/login?next=${encodeURIComponent(rawTarget)}`;
}

export function GoogleSignInButton({
  nextPath,
  label = "Continue with Google",
  className = "",
}: GoogleSignInButtonProps) {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = buildGoogleLoginHref(nextPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 font-medium text-sm border border-zinc-200 shadow-sm transition-colors cursor-pointer ${className}`}
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
      <span>{label}</span>
    </button>
  );
}
