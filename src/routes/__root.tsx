import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportSparrowxError } from "../lib/sparrowx-error-reporting";
import { useServiceFavicon } from "../lib/service-favicon";
import { clearSessionToken } from "../lib/advanced-features";
import {
  resolveAutoCorrectedPath,
  resolveCanonicalSubdomainRedirect,
} from "../lib/route-autocorrect";
import { GlobalEmailVerificationHost } from "../components/EmailVerificationModal";
import { SparrowxAmbientLogoBackdrop } from "../components/SparrowxAmbientLogoBackdrop";
import { WhatsAppPlansToaster } from "../components/WhatsAppPlansToaster";

function NotFoundComponent() {
  const [targetPath, setTargetPath] = useState<string>("/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hostname, pathname, search, protocol } = window.location;
    const subdomainRedirect = resolveCanonicalSubdomainRedirect(
      hostname,
      pathname,
      search,
      protocol.replace(":", ""),
    );
    if (subdomainRedirect && subdomainRedirect !== window.location.href) {
      setTargetPath(subdomainRedirect);
      window.location.replace(subdomainRedirect);
      return;
    }

    const corrected = resolveAutoCorrectedPath(pathname, hostname) || "/";
    const fullTarget = `${corrected}${search}`;
    setTargetPath(fullTarget);
    if (corrected !== pathname) {
      window.location.replace(fullTarget);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          SparrowX Smart Route Recovery
        </p>
        <h1 className="text-2xl font-bold text-foreground">
          Redirecting you to the right page…
        </h1>
        <p className="text-sm text-muted-foreground">
          Detected a mistyped path and auto-corrected it to{" "}
          <span className="font-mono text-foreground">{targetPath}</span>.
        </p>
        <div className="pt-2">
          <Link
            to={targetPath.startsWith("/") ? targetPath : "/"}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue now
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportSparrowxError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="max-w-lg w-full text-center space-y-4">
        <div className="inline-flex size-12 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20 text-destructive mb-2">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Platform Service Initializing
        </h1>
        <p className="text-sm text-muted-foreground">
          The browser encountered an interrupted session state while rendering the dashboard.
        </p>

        <div className="pt-2 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              try {
                if (typeof window !== "undefined") {
                  clearSessionToken();
                  window.localStorage.clear();
                  window.sessionStorage.clear();
                  void fetch("/api/auth/master-sso", { method: "DELETE", keepalive: true }).catch(() => {});
                  window.location.reload();
                  return;
                }
              } catch {
                // ignore
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
          >
            Reset Session & Reload
          </button>

          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retry
          </button>
        </div>

        <div className="pt-4 flex items-center justify-center gap-4 text-xs font-mono text-muted-foreground border-t border-border">
          <a href="https://sec.sparrowx.net" className="hover:text-primary transition-colors">
            sec.sparrowx.net (Security)
          </a>
          <span>·</span>
          <a href="https://db.sparrowx.net" className="hover:text-primary transition-colors">
            db.sparrowx.net (Database)
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "author", content: "SparrowX Technologies" },
      { name: "theme-color", content: "#090B0E" },
      { name: "google-adsense-account", content: "ca-pub-5926090831336748" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function useSilentProductionConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!import.meta.env.PROD) return;
    const noop = () => {};
    const methods = [
      "log",
      "info",
      "debug",
      "warn",
      "error",
      "trace",
      "table",
      "dir",
      "group",
      "groupCollapsed",
      "groupEnd",
    ] as const;
    for (const m of methods) {
      try {
        (window.console as unknown as Record<string, unknown>)[m] = noop;
      } catch {
        // ignore read-only console properties
      }
    }
  }, []);
}

function useDeferredAdSense() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (document.querySelector('script[data-spx-adsense="true"]')) return;

    let cancelled = false;
    let idleId: number | null = null;
    let timerId: number | null = null;

    const inject = () => {
      if (cancelled || document.querySelector('script[data-spx-adsense="true"]')) return;
      const script = document.createElement("script");
      script.async = true;
      script.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5926090831336748";
      script.crossOrigin = "anonymous";
      script.setAttribute("fetchpriority", "low");
      script.setAttribute("data-spx-adsense", "true");
      document.body.appendChild(script);
    };

    const scheduleInject = () => {
      if (cancelled) return;
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof win.requestIdleCallback === "function") {
        idleId = win.requestIdleCallback(inject, { timeout: 3500 });
      } else {
        timerId = window.setTimeout(inject, 2200);
      }
    };

    if (document.readyState === "complete") {
      scheduleInject();
    } else {
      window.addEventListener("load", scheduleInject, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleInject);
      const win = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);
}

function useGlobalScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const supportsNativeViewTimeline =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("(animation-timeline: view()) and (animation-range: entry)");

    if (!supportsNativeViewTimeline && typeof IntersectionObserver === "undefined") return;

    const observed = new WeakSet<Element>();
    const io = supportsNativeViewTimeline
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.setAttribute("data-spx-reveal", "visible");
                io?.unobserve(entry.target);
              }
            }
          },
          { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
        );

    let rafId = 0;

    const scan = () => {
      rafId = 0;
      const vh = window.innerHeight || 900;
      const nodes = document.querySelectorAll("main section, section[id], article");
      // Batch DOM reads before DOM writes to prevent forced synchronous layout thrashing
      const toReveal: Element[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (!el || observed.has(el)) continue;
        observed.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.top > vh * 0.92) {
          toReveal.push(el);
        }
      }
      for (let i = 0; i < toReveal.length; i++) {
        const el = toReveal[i]!;
        if (supportsNativeViewTimeline) {
          el.setAttribute("data-spx-scroll-reveal", "auto");
        } else {
          el.setAttribute("data-spx-reveal", "pending");
          io?.observe(el);
        }
      }
    };

    const scheduleScan = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(scan);
    };

    scheduleScan();

    const mo = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i]?.addedNodes;
        if (!added || added.length === 0) continue;
        for (let j = 0; j < added.length; j++) {
          if (added[j]?.nodeType === 1) {
            scheduleScan();
            return;
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      mo.disconnect();
      io?.disconnect();
    };
  }, []);
}

function useGlobalErrorWebhookCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastSentAt = 0;
    let lastSignature = "";

    const dispatchError = (err: unknown, mechanism: string, extra?: Record<string, unknown>) => {
      const msg = err instanceof Error ? err.message : String(err || "Unknown runtime error");
      const sig = `${mechanism}:${msg}`;
      const now = Date.now();
      if (sig === lastSignature && now - lastSentAt < 10_000) return;
      lastSignature = sig;
      lastSentAt = now;
      reportSparrowxError(err, { mechanism, ...extra });
    };

    const onError = (event: ErrorEvent) => {
      dispatchError(event.error ?? event.message, "window.onerror", {
        Filename: event.filename || window.location.pathname,
        Line: event.lineno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      dispatchError(event.reason, "window.unhandledrejection");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useSilentProductionConsole();
  useServiceFavicon();
  useDeferredAdSense();
  useGlobalScrollReveal();
  useGlobalErrorWebhookCapture();

  return (
    <QueryClientProvider client={queryClient}>
      <SparrowxAmbientLogoBackdrop />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <GlobalEmailVerificationHost />
      <WhatsAppPlansToaster />
    </QueryClientProvider>
  );
}
