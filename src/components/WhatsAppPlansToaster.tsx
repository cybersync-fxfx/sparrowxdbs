import { useEffect, useRef, useState } from "react";
import { Phone, X } from "lucide-react";
import {
  buildWhatsAppSupportUrl,
  WHATSAPP_SUPPORT_DIGITS,
  WHATSAPP_SUPPORT_DISPLAY,
} from "@/lib/whatsapp-support";

export function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.002 3.2C8.94 3.2 3.2 8.94 3.2 16.002c0 2.256.59 4.458 1.71 6.4L3.1 29.01l6.78-1.778a12.74 12.74 0 0 0 6.122 1.56h.005c7.06 0 12.8-5.74 12.8-12.79 0-3.42-1.332-6.634-3.75-9.052A12.72 12.72 0 0 0 16.002 3.2Zm0 23.43h-.004a10.6 10.6 0 0 1-5.405-1.48l-.388-.23-4.024 1.056 1.074-3.922-.252-.402a10.58 10.58 0 0 1-1.627-5.65c0-5.86 4.768-10.628 10.63-10.628 2.838 0 5.506 1.106 7.512 3.114a10.56 10.56 0 0 1 3.112 7.516c-.002 5.86-4.77 10.626-10.628 10.626Zm5.828-7.956c-.32-.16-1.89-.932-2.182-1.038-.293-.107-.506-.16-.719.16-.213.32-.825 1.038-1.012 1.252-.186.213-.373.24-.692.08-.32-.16-1.35-.497-2.57-1.586-.95-.847-1.592-1.893-1.778-2.213-.186-.32-.02-.493.14-.652.144-.143.32-.373.48-.56.16-.186.213-.32.32-.533.106-.213.053-.4-.027-.56-.08-.16-.719-1.732-.985-2.371-.26-.623-.524-.539-.719-.549l-.612-.01c-.213 0-.56.08-.852.4-.293.32-1.118 1.093-1.118 2.665s1.145 3.091 1.305 3.304c.16.213 2.253 3.44 5.458 4.824.762.329 1.357.526 1.821.673.765.243 1.462.209 2.012.127.614-.092 1.89-.773 2.156-1.519.266-.746.266-1.386.186-1.519-.08-.133-.293-.213-.612-.373Z"
      />
    </svg>
  );
}

const DISMISS_SESSION_KEY = "spx_whatsapp_toaster_dismissed";
const PLAN_SELECTOR =
  '#plans, #pricing, [id*="plan"], [id*="pricing"], [data-plans-section]';
const PLAN_CLICK_KEYWORDS =
  /\b(plan|plans|pricing|price|deploy|order|buy|subscribe|subscription|upgrade|vps|dedicated|bare metal|fivem|minecraft|sa-mp|pro vault|sparrowcoins)\b/i;

function detectCurrentServiceContext(): string {
  if (typeof window === "undefined") return "SparrowX";
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  if (host.startsWith("sec.") || host.startsWith("shield.") || path.startsWith("/shield")) {
    return "SparrowX Shield";
  }
  if (host.startsWith("db.") || path.startsWith("/db")) {
    return "SparrowX Cloud DB";
  }
  if (host.startsWith("infra.") || path.startsWith("/infra")) {
    return "SparrowX Cloud Infra";
  }
  if (host.startsWith("file.") || host.startsWith("drop.") || path.startsWith("/drop")) {
    return "SparrowX Drop";
  }
  if (host.startsWith("password.") || host.startsWith("keys.") || path.startsWith("/keys")) {
    return "SparrowX Keys";
  }
  if (host.startsWith("game.") || path.startsWith("/game")) {
    return "SparrowX Game Hosting";
  }
  return "SparrowX";
}

function isPlanInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-whatsapp-toaster]")) return false;
  if (target.closest(PLAN_SELECTOR)) return true;

  const clickable = target.closest("a, button, [role='button'], [role='tab']");
  if (!clickable) return false;

  const href = clickable.getAttribute("href") ?? "";
  if (/(#plans|#pricing|\/game|\/infra|\/db|\/shield|\/drop)/i.test(href)) {
    return true;
  }

  const label = (
    clickable.textContent ||
    clickable.getAttribute("aria-label") ||
    ""
  ).trim();
  return PLAN_CLICK_KEYWORDS.test(label);
}

export function WhatsAppPlansToaster() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [serviceLabel, setServiceLabel] = useState("SparrowX");
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setServiceLabel(detectCurrentServiceContext());

    try {
      if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore storage access issues
    }

    const triggerToaster = () => {
      if (triggeredRef.current) return;
      try {
        if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === "1") return;
      } catch {
        // ignore
      }
      triggeredRef.current = true;
      setServiceLabel(detectCurrentServiceContext());
      setVisible(true);
    };

    // 1. Trigger immediately when a visitor clicks into plans/pricing/services or interacts with plan cards
    const handleClick = (event: MouseEvent) => {
      if (isPlanInteractiveTarget(event.target)) {
        triggerToaster();
      }
    };
    document.addEventListener("click", handleClick, { capture: true, passive: true });

    // 2. Trigger when a visitor scrolls into any Plans / Pricing section
    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const observed = new WeakSet<Element>();
    let revealTimer: number | null = null;
    let scanRafId = 0;

    const stopWatchers = () => {
      if (scanRafId) {
        window.cancelAnimationFrame(scanRafId);
        scanRafId = 0;
      }
      mutationObserver?.disconnect();
      mutationObserver = null;
      observer?.disconnect();
      observer = null;
    };

    const isAlreadyDismissed = (() => {
      try {
        return window.sessionStorage.getItem(DISMISS_SESSION_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (!isAlreadyDismissed && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (revealTimer == null) {
                revealTimer = window.setTimeout(() => {
                  triggerToaster();
                  stopWatchers();
                }, 450);
              }
              break;
            }
          }
        },
        { threshold: 0.15 },
      );

      const attachToPlanSections = () => {
        scanRafId = 0;
        if (triggeredRef.current) {
          stopWatchers();
          return;
        }
        document.querySelectorAll(PLAN_SELECTOR).forEach((el) => {
          if (!observed.has(el)) {
            observed.add(el);
            observer?.observe(el);
          }
        });
      };

      const scheduleAttach = () => {
        if (scanRafId || triggeredRef.current) return;
        scanRafId = window.requestAnimationFrame(attachToPlanSections);
      };

      attachToPlanSections();
      mutationObserver = new MutationObserver((mutations) => {
        if (triggeredRef.current) {
          stopWatchers();
          return;
        }
        for (let i = 0; i < mutations.length; i++) {
          const added = mutations[i]?.addedNodes;
          if (!added || added.length === 0) continue;
          for (let j = 0; j < added.length; j++) {
            if (added[j]?.nodeType === 1) {
              scheduleAttach();
              return;
            }
          }
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });

      return () => {
        document.removeEventListener("click", handleClick, { capture: true });
        stopWatchers();
        if (revealTimer != null) window.clearTimeout(revealTimer);
      };
    }

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (revealTimer != null) window.clearTimeout(revealTimer);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  };

  const whatsappUrl = buildWhatsAppSupportUrl(
    `Hi SparrowX Team! I'm checking out ${serviceLabel} plans on the website and would love help choosing the right plan.`,
  );

  // If the user dismissed the card, leave a subtle compact launcher pill so they can still reach WhatsApp anytime
  if (!visible) {
    if (!dismissed) return null;
    return (
      <div
        data-whatsapp-toaster="pill"
        className="fixed bottom-4 right-4 z-30"
      >
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-[#071510]/90 px-3 py-1.5 text-[11px] font-medium text-emerald-300 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[border-color,background-color] hover:border-emerald-400 hover:bg-emerald-950"
          aria-label={`Chat on WhatsApp ${WHATSAPP_SUPPORT_DISPLAY}`}
        >
          <span className="relative flex size-1.5">
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <WhatsAppLogo className="size-3.5 text-[#25D366]" />
          <span>WhatsApp · {WHATSAPP_SUPPORT_DISPLAY}</span>
        </a>
      </div>
    );
  }

  return (
    <aside
      data-whatsapp-toaster="open"
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-[320px] animate-in fade-in slide-in-from-right-6 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#081310]/95 p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.65),0_0_28px_rgba(16,185,129,0.22)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-emerald-500/20 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white shadow-[0_6px_18px_rgba(37,211,102,0.45)]">
              <WhatsAppLogo className="size-6" />
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-300 ring-2 ring-[#081310]" />
              </span>
            </span>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                WhatsApp Support · Online Now
              </p>
              <h3 className="text-sm font-bold leading-snug text-white">
                We&apos;re waiting to help you!
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close WhatsApp support prompt"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="relative mt-2.5 text-xs leading-relaxed text-zinc-300">
          Exploring <span className="font-semibold text-white">{serviceLabel}</span> plans? Message
          or call us directly on WhatsApp for instant setup, custom quotes, or quick help.
        </p>

        <div className="relative mt-3 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-black/40 px-3 py-2">
          <span className="text-[11px] text-zinc-400">Mobile / WhatsApp</span>
          <a
            href={`tel:+${WHATSAPP_SUPPORT_DIGITS}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-300 hover:text-emerald-200"
          >
            <Phone className="size-3" />
            {WHATSAPP_SUPPORT_DISPLAY}
          </a>
        </div>

        <div className="relative mt-3 flex items-center gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-slate-950 transition-all hover:bg-[#2ee573] shadow-[0_6px_20px_rgba(37,211,102,0.35)]"
          >
            <WhatsAppLogo className="size-[18px]" />
            <span>Chat on WhatsApp Now</span>
          </a>
          <a
            href={`tel:+${WHATSAPP_SUPPORT_DIGITS}`}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            title={`Call ${WHATSAPP_SUPPORT_DISPLAY}`}
          >
            <Phone className="size-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
