import React from "react";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";

export type SparrowxServiceKey = "db" | "sec" | "file" | "password" | "api" | "infra";

export interface SparrowxFooterProps {
  onLaunchService?: ((
    key: SparrowxServiceKey,
    prodUrl: string,
    localParam: string,
  ) => void) | undefined;
  isAuthenticated?: boolean | undefined;
  onSignIn?: (() => void) | undefined;
  onSignOut?: (() => void) | undefined;
  inPageAnchors?: boolean | undefined;
}

interface ProductLinkItem {
  label: string;
  sublabel: string;
  href: string;
  serviceKey?: SparrowxServiceKey;
  localParam?: string;
}

const PRODUCT_LINKS: ProductLinkItem[] = [
  {
    label: "Cloud Infra",
    sublabel: "infra.sparrowx.net",
    href: "https://infra.sparrowx.net",
    serviceKey: "infra",
  },
  {
    label: "Cloud Database",
    sublabel: "db.sparrowx.net",
    href: "/db",
    serviceKey: "db",
  },
  {
    label: "Shield SOC & WAF",
    sublabel: "sec.sparrowx.net",
    href: "/shield",
    serviceKey: "sec",
  },
  {
    label: "Drop File Vault",
    sublabel: "file.sparrowx.net",
    href: "/drop",
    serviceKey: "file",
  },
  {
    label: "Password & Keys",
    sublabel: "password.sparrowx.net",
    href: "/keys",
    serviceKey: "password",
  },
  {
    label: "PostgREST API",
    sublabel: "api.sparrowx.net",
    href: "/gateway",
    serviceKey: "api",
  },
  {
    label: "Game Hosting",
    sublabel: "game.sparrowx.net",
    href: "/game",
  },
  {
    label: "Game DDoS Defense",
    sublabel: "gamesec.sparrowx.net",
    href: "https://gamesec.sparrowx.net",
  },
];

const LINK_CLASSES =
  "min-h-6 inline-flex items-center gap-2 text-sm text-[#F4F6FA]/70 hover:text-[#F4F6FA] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm cursor-pointer";

export function SparrowxFooter({
  onLaunchService,
  isAuthenticated = false,
  onSignIn,
  onSignOut,
  inPageAnchors = false,
}: SparrowxFooterProps) {
  const anchorPrefix = inPageAnchors ? "#" : "/#";

  const handleProductClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: ProductLinkItem,
  ) => {
    if (typeof window === "undefined") return;
    if (item.href.startsWith("/")) {
      e.preventDefault();
      window.location.assign(item.href);
      return;
    }
    if (onLaunchService && item.serviceKey) {
      e.preventDefault();
      onLaunchService(item.serviceKey, item.href, item.serviceKey);
      return;
    }
  };

  return (
    <footer className="font-soc relative z-10 mt-auto border-t border-[#F4F6FA]/[0.08] bg-[#07090F] text-[#F4F6FA]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          {/* Brand Summary & Status Column */}
          <div className="md:col-span-4 space-y-4 min-w-0">
            <a
              href="/"
              className="min-h-6 inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Autonomous Security and Sovereign Cloud Platform"
                width={34}
                height={34}
                loading="lazy"
                className="size-8.5 object-contain shrink-0 drop-shadow-[0_4px_10px_rgba(255,255,255,0.2)]"
              />
              <span className="text-base font-medium tracking-tight text-[#F4F6FA]">
                SparrowX Technologies
              </span>
            </a>

            <p className="text-sm text-[#F4F6FA]/60 leading-relaxed max-w-[38ch]">
              Independent cloud infrastructure for developers and teams.
              Predictable PostgreSQL databases, L7 DDoS defense, encrypted file
              transfer, and client-side key tooling.
            </p>

            <div>
              <a
                href={`${anchorPrefix}status`}
                className={LINK_CLASSES}
              >
                <span
                  className="size-2 rounded-full bg-[#10B981] shrink-0"
                  aria-hidden="true"
                />
                <span>All systems operational</span>
              </a>
            </div>
          </div>

          {/* Structured Footer Navigation Columns */}
          <nav
            aria-label="Footer"
            className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 min-w-0"
          >
            {/* Column 1: Products */}
            <div className="space-y-3 min-w-0">
              <h3 className="text-sm font-medium text-[#F4F6FA]">Products</h3>
              <ul role="list" className="list-none space-y-2 p-0 m-0">
                {PRODUCT_LINKS.map((item) => (
                  <li key={`${item.label}-${item.href}`} className="min-w-0">
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => handleProductClick(e, item)}
                      className={`${LINK_CLASSES} max-w-full`}
                    >
                      <span className="shrink-0">{item.label}</span>
                      <span className="text-xs text-[#F4F6FA]/40 truncate">
                        {item.sublabel}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Infrastructure */}
            <div className="space-y-3 min-w-0">
              <h3 className="text-sm font-medium text-[#F4F6FA]">
                Infrastructure
              </h3>
              <ul role="list" className="list-none space-y-2 p-0 m-0">
                <li className="min-w-0">
                  <a href="/infra" className={LINK_CLASSES}>
                    Dedicated NVMe VPS
                  </a>
                </li>
                <li className="min-w-0">
                  <a
                    href={`${anchorPrefix}comparison`}
                    className={LINK_CLASSES}
                  >
                    Why SparrowX
                  </a>
                </li>
                <li className="min-w-0">
                  <a href={`${anchorPrefix}status`} className={LINK_CLASSES}>
                    Live System Status
                  </a>
                </li>
                <li className="min-w-0">
                  <a href="/docs" className={LINK_CLASSES}>
                    Documentation
                  </a>
                </li>
                <li className="min-w-0">
                  <a href="/docs/errors" className={LINK_CLASSES}>
                    Error Reference
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="space-y-3 min-w-0">
              <h3 className="text-sm font-medium text-[#F4F6FA]">Company</h3>
              <ul role="list" className="list-none space-y-2 p-0 m-0">
                <li className="min-w-0">
                  <a href="/story" className={LINK_CLASSES}>
                    Read Our Story
                  </a>
                </li>
                <li className="min-w-0">
                  <a href={`${anchorPrefix}contact`} className={LINK_CLASSES}>
                    Contact Engineering
                  </a>
                </li>
                <li className="min-w-0">
                  <a
                    href={buildWhatsAppSupportUrl("Hi SparrowX Support, I need assistance with my account or subscription.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LINK_CLASSES} text-emerald-300/90 hover:text-emerald-200`}
                  >
                    <span>WhatsApp Support</span>
                    <span className="text-xs text-[#F4F6FA]/45 font-mono">
                      {WHATSAPP_SUPPORT_DISPLAY}
                    </span>
                  </a>
                </li>
                <li className="min-w-0">
                  <a
                    href="mailto:security@sparrowx.net"
                    className={LINK_CLASSES}
                  >
                    Security &amp; Abuse
                  </a>
                </li>
                <li className="min-w-0">
                  {isAuthenticated && onSignOut ? (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className={LINK_CLASSES}
                    >
                      Sign out of workspace
                    </button>
                  ) : onSignIn ? (
                    <button
                      type="button"
                      onClick={onSignIn}
                      className={LINK_CLASSES}
                    >
                      Operator sign in
                    </button>
                  ) : (
                    <a href="/" className={LINK_CLASSES}>
                      Workspace portal
                    </a>
                  )}
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* Bottom Copyright & Direct Domain Strip */}
        <div className="mt-12 pt-6 border-t border-[#F4F6FA]/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#F4F6FA]/50">
          <p className="min-w-0">
            &copy; {new Date().getFullYear()} SparrowX Technologies. Built for
            developers, startups, and privacy-conscious builders.
          </p>
          <div className="flex flex-wrap items-center gap-6 min-w-0">
            <a
              href="/terms"
              className="min-h-6 inline-flex items-center hover:text-[#F4F6FA] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              Terms of Service
            </a>
            <a
              href="/refund"
              className="min-h-6 inline-flex items-center text-[#FFA14A] hover:text-[#FFA14A]/80 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              Refund Policy
            </a>
            <a
              href="/security"
              className="min-h-6 inline-flex items-center text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              Data Security
            </a>
            <a
              href="/story"
              className="min-h-6 inline-flex items-center hover:text-[#F4F6FA] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              Our Story
            </a>
            <a
              href="https://sparrowx.net"
              className="min-h-6 inline-flex items-center hover:text-[#F4F6FA] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              sparrowx.net
            </a>
            <a
              href="mailto:support@sparrowx.net"
              className="min-h-6 inline-flex items-center hover:text-[#F4F6FA] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F96246] rounded-sm"
            >
              support@sparrowx.net
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
