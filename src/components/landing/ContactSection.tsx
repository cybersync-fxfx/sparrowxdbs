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

type Status = "idle" | "submitting" | "success" | "error";
type FieldErrors = Partial<Record<"name" | "email" | "topic" | "message", string>>;

const FOUNDER_EMAIL = "founder@sparrowx.net";
const SECURITY_EMAIL = "security@sparrowx.net";

const inputClass =
  "w-full px-3.5 py-2.5 rounded bg-[#070B14] border border-sky-500/20 text-white placeholder-[#7C8BA1] focus:outline-none focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/40 transition-colors aria-[invalid=true]:border-rose-400";

function CopyRow({ label, email }: { label: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-3 rounded bg-[#070A12] border border-sky-500/15 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-[10px] text-[#8795AB] block uppercase">{label}</span>
        <a
          href={`mailto:${email}`}
          className="text-white hover:text-sky-300 font-semibold truncate block"
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
        className="size-8 rounded bg-[#111A30] border border-sky-500/20 text-[#94A3B8] hover:text-white grid place-items-center shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400/40 outline-none"
      >
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
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
      <p id={`${uid}-${key}-err`} className="text-[11px] text-rose-300">
        {errors[key]}
      </p>
    ) : null;

  return (
    <section
      id="contact"
      className="border-t border-sky-500/15 bg-[#080C17] px-4 sm:px-6 py-16 scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-sky-400">
            <Mail className="size-3.5" aria-hidden />
            <span>DIRECT FOUNDER ACCESS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Talk directly with our engineering team.
          </h2>
          <p className="text-xs sm:text-sm text-[#A3B1C6] max-w-2xl">
            Custom PostgreSQL clusters, dedicated Shield IP blocks, or an architecture question:
            send it here and an engineer replies personally.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className="border border-sky-500/20 bg-[#0C1222] rounded-lg p-6 space-y-4 shadow-xl">
              <h3 className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider border-b border-sky-500/15 pb-2">
                Direct channels
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <CopyRow label="Founding team" email={FOUNDER_EMAIL} />
                <CopyRow label="Security & disclosures" email={SECURITY_EMAIL} />
                <div className="p-3 rounded bg-[#070A12] border border-sky-500/15 space-y-1">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <span className="size-2 rounded-full bg-emerald-400 shrink-0" aria-hidden />
                    <span>Target response: within 4 hours</span>
                  </div>
                  <p className="text-[11px] text-[#A3B1C6] leading-relaxed">
                    On-call coverage across Asia-Pacific, Europe and US time zones.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-sky-500/20 bg-[#0C1222] rounded-lg p-6 space-y-3 shadow-xl text-xs">
              <h3 className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider border-b border-sky-500/15 pb-2">
                Quick answers
              </h3>
              <div className="space-y-3 text-[#A3B1C6]">
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

          <div className="lg:col-span-7 border border-sky-500/20 bg-[#0C1222] rounded-lg p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="border-b border-sky-500/15 pb-3 space-y-0.5">
              <h3 className="font-bold text-white text-base font-sans flex items-center gap-2">
                <MessageSquare className="size-4 text-sky-400" aria-hidden />
                <span>Send a message</span>
              </h3>
              <p className="text-xs text-[#A3B1C6]">
                Tell us about your project. We only use your details to reply.
              </p>
            </div>

            {status === "success" ? (
              <div
                role="status"
                className="p-6 rounded-lg bg-[#070B14] border border-emerald-500/30 space-y-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Message received</h4>
                    <p className="text-xs text-[#A3B1C6] font-mono">
                      Ticket: <span className="text-emerald-400 font-bold">{ticketId}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  Thanks, <strong className="text-white">{form.name}</strong>. We'll reply to{" "}
                  <span className="text-emerald-400">{form.email}</span>. Quote the ticket number if
                  you follow up.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setForm((f) => ({ ...f, message: "" }));
                  }}
                  className="px-4 py-2 rounded bg-[#111A30] border border-sky-500/25 text-[#94A3B8] hover:text-white transition-colors cursor-pointer font-mono text-xs"
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
                    <label htmlFor={`${uid}-name`} className="text-[11px] text-[#A3B1C6]">
                      Your name <span className="text-sky-400">*</span>
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
                    <label htmlFor={`${uid}-email`} className="text-[11px] text-[#A3B1C6]">
                      Email <span className="text-sky-400">*</span>
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
                  <label htmlFor={`${uid}-topic`} className="text-[11px] text-[#A3B1C6]">
                    Topic
                  </label>
                  <select
                    {...field("topic")}
                    value={form.topic}
                    onChange={set("topic")}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {err("topic")}
                </div>

                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor={`${uid}-message`}
                    className="text-[11px] text-[#A3B1C6] flex justify-between"
                  >
                    <span>
                      Message <span className="text-sky-400">*</span>
                    </span>
                    <span className="text-[#7C8BA1] tabular-nums">{form.message.length}/4000</span>
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
                    <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px] flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-px" aria-hidden />
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
                  <span className="text-[10px] text-[#8795AB]">
                    No tracking. Your IP is stored only as a hash.
                  </span>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="px-6 py-2.5 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(56,189,248,0.25)] focus-visible:ring-2 focus-visible:ring-sky-300 outline-none"
                  >
                    {status === "submitting" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-3.5" aria-hidden />
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
