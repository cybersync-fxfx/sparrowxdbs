import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import {
  buildWhatsAppSupportUrl,
  WHATSAPP_SUPPORT_DIGITS,
  WHATSAPP_SUPPORT_DISPLAY,
} from "@/lib/whatsapp-support";

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
    const observed = new WeakSet<Element>();
    let revealTimer: number | null = null;

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (revealTimer == null) {
                revealTimer = window.setTimeout(() => {
                  triggerToaster();
                }, 450);
              }
              break;
            }
          }
        },
        { threshold: 0.15 },
      );

      const attachToPlanSections = () => {
        document.querySelectorAll(PLAN_SELECTOR).forEach((el) => {
          if (!observed.has(el)) {
            observed.add(el);
            observer?.observe(el);
          }
        });
      };

      attachToPlanSections();
      const mutationObserver = new MutationObserver(() => attachToPlanSections());
      mutationObserver.observe(document.body, { childList: true, subtree: true });

      return () => {
        document.removeEventListener("click", handleClick, { capture: true });
        mutationObserver.disconnect();
        observer?.disconnect();
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
        className="fixed bottom-5 right-5 z-50"
      >
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#071510]/95 px-3.5 py-2 text-xs font-semibold text-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,0.28)] backdrop-blur-md transition-all hover:scale-[1.03] hover:border-emerald-400 hover:bg-emerald-950"
          aria-label={`Chat on WhatsApp ${WHATSAPP_SUPPORT_DISPLAY}`}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <MessageCircle className="size-3.5" />
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
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-[350px] animate-in fade-in slide-in-from-right-6 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#081310]/95 p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.65),0_0_28px_rgba(16,185,129,0.22)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-emerald-500/20 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300">
              <MessageCircle className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#081310]" />
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
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
          >
            <MessageCircle className="size-4" />
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
