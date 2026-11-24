import { useId, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { CONTACT_TOPICS } from "@/lib/contact-inquiry";
import { emitDiscordTelemetry } from "@/lib/discord-telemetry";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";

type Status = "idle" | "submitting" | "success" | "error";
type FieldErrors = Partial<Record<"name" | "email" | "topic" | "message", string>>;

const FOUNDER_EMAIL = "founder@sparrowx.net";
const SECURITY_EMAIL = "security@sparrowx.net";

const inputClass =
  "w-full px-3.5 py-2.5 rounded bg-[#090B10] border border-white/25 text-white placeholder-zinc-500 focus:outline-none focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/40 transition-colors aria-[invalid=true]:border-white aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-white/50";

function CopyRow({ label, email }: { label: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-3 rounded bg-[#090B10] border border-white/15 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-[10px] text-zinc-400 block uppercase">{label}</span>
        <a
          href={`mailto:${email}`}
          className="text-white hover:text-zinc-300 font-semibold truncate block"
        >
          {email}
        </a>
      </div>
      <button
        type="button"
        aria-label={`Copy ${email}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable; the mailto link still works */
          }
        }}
        className="size-8 rounded bg-[#0D1017] border border-white/25 text-zinc-300 hover:text-white grid place-items-center shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-white/40 outline-none"
      >
        {copied ? <Check className="size-3.5 text-white" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function ContactSection() {
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: CONTACT_TOPICS[0] as string,
    message: "",
    website: "", // honeypot, hidden from real users
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setFormError("");
    setErrors({});
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.ticketId) {
        setTicketId(data.ticketId);
        setStatus("success");
        void emitDiscordTelemetry({
          category: "form",
          severity: "info",
          service: "SparrowX Contact Form",
          title: `Contact Inquiry: ${form.topic}`,
          description: form.message,
          fields: {
            Name: form.name,
            Email: form.email,
            Topic: form.topic,
            TicketID: data.ticketId,
          },
        });
        return;
      }
      if (res.status === 422 && data.fields) setErrors(data.fields);
      setFormError(
        res.status === 429
          ? "You've sent several messages recently. Please try again later or email us directly."
          : data.error || "Something went wrong. Please try again.",
      );
    } catch {
      setFormError("Network error. Please try again or email us directly.");
    }
    setStatus("error");
  };

  const mailto = `mailto:${FOUNDER_EMAIL}?subject=${encodeURIComponent(`[SparrowX Inquiry] ${form.topic}`)}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`;

  const field = (key: "name" | "email" | "topic" | "message") => ({
    id: `${uid}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${uid}-${key}-err` : undefined,
  });
  const err = (key: "name" | "email" | "topic" | "message") =>
    errors[key] ? (
      <p id={`${uid}-${key}-err`} className="text-[11px] text-zinc-200 flex items-center gap-1.5">
        <AlertCircle className="size-3.5 shrink-0 text-white" aria-hidden="true" />
        <span>{errors[key]}</span>
      </p>
    ) : null;

  return (
    <section
      id="contact"
      className="border-t border-white/15 bg-[#05060A] px-4 sm:px-6 py-16 scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-300">
            <Mail className="size-3.5 text-white" aria-hidden="true" />
            <span>DIRECT FOUNDER ACCESS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Talk directly with our engineering team.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
            Custom PostgreSQL clusters, dedicated Shield IP blocks, or an architecture question:
            send it here and an engineer replies personally.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className="border border-white/20 bg-[#090B10] rounded-lg p-6 space-y-4 shadow-xl">
              <h3 className="text-xs font-mono text-white font-bold uppercase tracking-wider border-b border-white/15 pb-2">
                Direct channels
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <CopyRow label="Founding team" email={FOUNDER_EMAIL} />
                <CopyRow label="Security & disclosures" email={SECURITY_EMAIL} />
                <div className="p-3 rounded bg-[#090B10] border border-emerald-500/35 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-emerald-400 block uppercase">WhatsApp Support (India)</span>
                    <a
                      href={buildWhatsAppSupportUrl("Hi SparrowX Support, I need help with SparrowX services.")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-emerald-300 font-semibold truncate block"
                    >
                      {WHATSAPP_SUPPORT_DISPLAY}
                    </a>
                  </div>
                  <a
                    href={buildWhatsAppSupportUrl("Hi SparrowX Support, I need help with SparrowX services.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] shrink-0 transition-colors"
                  >
                    Chat
                  </a>
                </div>
                <div className="p-3 rounded bg-[#05060A] border border-white/15 space-y-1">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <span className="size-2 rounded-full bg-white shrink-0" aria-hidden="true" />
                    <span>Target response: within 4 hours</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    On-call coverage across Asia-Pacific, Europe and US time zones.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-white/20 bg-[#090B10] rounded-lg p-6 space-y-3 shadow-xl text-xs">
              <h3 className="text-xs font-mono text-white font-bold uppercase tracking-wider border-b border-white/15 pb-2">
                Quick answers
              </h3>
              <div className="space-y-3 text-zinc-400">
                <div>
                  <h4 className="font-bold text-white mb-0.5">
                    Are the utilities really free with no account?
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    Yes. SparrowX Files (ephemeral drop) and SparrowX Keys run in your browser with
                    no registration or billing details.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">
                    Can I import an existing PostgreSQL database?
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    Yes. Studio accepts standard connection strings and pg_dump files, with no
                    platform lock-in.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 border border-white/20 bg-[#090B10] rounded-lg p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="border-b border-white/15 pb-3 space-y-0.5">
              <h3 className="font-bold text-white text-base font-sans flex items-center gap-2">
                <MessageSquare className="size-4 text-white" aria-hidden="true" />
                <span>Send a message</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Tell us about your project. We only use your details to reply.
              </p>
            </div>

            {status === "success" ? (
              <div
                role="status"
                className="p-6 rounded-lg bg-[#05060A] border border-white/30 space-y-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-white/10 border border-white/35 grid place-items-center text-white shrink-0">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Message received</h4>
                    <p className="text-xs text-zinc-400 font-mono">
                      Ticket: <span className="text-white font-bold">{ticketId}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Thanks, <strong className="text-white">{form.name}</strong>. We'll reply to{" "}
                  <span className="text-white underline underline-offset-4">{form.email}</span>. Quote the ticket number if
                  you follow up.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setForm((f) => ({ ...f, message: "" }));
                  }}
                  className="px-4 py-2 rounded bg-[#0D1017] border border-white/25 text-zinc-300 hover:text-white transition-colors cursor-pointer font-mono text-xs"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4 font-mono text-xs">
                {/* Honeypot */}
                <div className="hidden" aria-hidden>
                  <label htmlFor={`${uid}-website`}>Website</label>
                  <input
                    id={`${uid}-website`}
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={set("website")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label htmlFor={`${uid}-name`} className="text-[11px] text-zinc-300">
                      Your name <span className="text-white">*</span>
                    </label>
                    <input
                      {...field("name")}
                      type="text"
                      required
                      autoComplete="name"
                      maxLength={80}
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Alex Rivera"
                      className={inputClass}
                    />
                    {err("name")}
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label htmlFor={`${uid}-email`} className="text-[11px] text-zinc-300">
                      Email <span className="text-white">*</span>
                    </label>
                    <input
                      {...field("email")}
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      value={form.email}
                      onChange={set("email")}
                      placeholder="alex@acmecorp.dev"
                      className={inputClass}
                    />
                    {err("email")}
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor={`${uid}-topic`} className="text-[11px] text-zinc-300">
                    Topic
                  </label>
                  <select
                    {...field("topic")}
                    value={form.topic}
                    onChange={set("topic")}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t} value={t} className="bg-[#05060A] text-white">
                        {t}
                      </option>
                    ))}
                  </select>
                  {err("topic")}
                </div>

                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor={`${uid}-message`}
                    className="text-[11px] text-zinc-300 flex justify-between"
                  >
                    <span>
                      Message <span className="text-white">*</span>
                    </span>
                    <span className="text-zinc-400 tabular-nums">{form.message.length}/4000</span>
                  </label>
                  <textarea
                    {...field("message")}
                    rows={5}
                    required
                    maxLength={4000}
                    value={form.message}
                    onChange={set("message")}
                    placeholder="What are you building, and how can we help?"
                    className={`${inputClass} resize-none leading-relaxed`}
                  />
                  {err("message")}
                </div>

                <div aria-live="polite">
                  {status === "error" && formError && (
                    <div className="p-3 rounded bg-white/10 border border-white/35 text-zinc-100 text-[11px] flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-px text-white" aria-hidden="true" />
                      <div className="space-y-1">
                        <p>{formError}</p>
                        <a href={mailto} className="underline hover:text-white">
                          Email us instead
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-zinc-400">
                    No tracking. Your IP is stored only as a hash.
                  </span>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="px-6 py-2.5 rounded bg-white hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.16)] focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
                  >
                    {status === "submitting" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-3.5" aria-hidden="true" />
                    )}
                    <span>{status === "submitting" ? "Sending…" : "Send message"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
