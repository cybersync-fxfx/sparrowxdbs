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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportSparrowxError } from "../lib/sparrowx-error-reporting";
import { useServiceFavicon } from "../lib/service-favicon";
import { clearSessionToken } from "../lib/advanced-features";
import { GlobalEmailVerificationHost } from "../components/EmailVerificationModal";
import { SparrowxAmbientLogoBackdrop } from "../components/SparrowxAmbientLogoBackdrop";
import { WhatsAppPlansToaster } from "../components/WhatsAppPlansToaster";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("Root Error Boundary caught:", error);
  const router = useRouter();
  useEffect(() => {
    reportSparrowxError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const errorMessage = error instanceof Error ? error.message : String(error || "Unknown error");

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

        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left font-mono text-xs text-destructive overflow-x-auto max-h-32">
            <code>{errorMessage}</code>
          </div>
        )}

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "SparrowX Technologies" },
      { name: "theme-color", content: "#090B0E" },
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
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
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
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5926090831336748"
          crossOrigin="anonymous"
        />
        <script
          src="/sparrowx-shield.js"
          data-site-id="TNT-3800"
          data-api-key="spx_tenant••••••••850c"
          data-endpoint="https://db.sparrowx.net"
          data-auto-block="true"
          data-anti-bot="active"
          async
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function useGlobalScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const observed = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-spx-reveal", "visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );

    const scan = () => {
      const vh = window.innerHeight || 900;
      const nodes = document.querySelectorAll("main section, section[id], article");
      nodes.forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        const rect = el.getBoundingClientRect();
        // Keep above-the-fold sections visible immediately; animate below-the-fold sections on scroll
        if (rect.top > vh * 0.92) {
          el.setAttribute("data-spx-reveal", "pending");
          io.observe(el);
        }
      });
    };

    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useServiceFavicon();
  useGlobalScrollReveal();

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
