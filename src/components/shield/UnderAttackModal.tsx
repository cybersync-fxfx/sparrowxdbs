import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldAlert, Siren } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { emitDiscordTelemetry } from "@/lib/discord-telemetry";

export interface UnderAttackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ATTACK_TYPES = [
  "Layer-7 HTTP / HTTPS Flood",
  "Layer-3/4 Volumetric DDoS (UDP/SYN/ICMP)",
  "Active Server Breach / Ransomware",
  "SQLi / XSS / API Credential Stuffing",
  "AI Prompt Injection / LLM Abuse",
  "Other Critical Security Incident",
];

const SEVERITY_LEVELS = [
  { id: "critical", label: "P0 Critical — Service Completely Down" },
  { id: "high", label: "P1 High — Active Degradation / High Packet Loss" },
  { id: "medium", label: "P2 Elevated — Suspicious Probes / Early Attack" },
] as const;

export function UnderAttackModal({ open, onOpenChange }: UnderAttackModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [targetAsset, setTargetAsset] = useState("");
  const [attackType, setAttackType] = useState(ATTACK_TYPES[0]!);
  const [severity, setSeverity] = useState<"critical" | "high" | "medium">("critical");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !targetAsset.trim()) {
      setError("Please provide your contact email and the domain or IP under attack.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await emitDiscordTelemetry({
        category: "emergency",
        severity,
        service: "SparrowX Shield (sec.sparrowx.net)",
        title: `UNDER ATTACK: ${targetAsset.trim()}`,
        description: details.trim() || "Immediate mitigation requested via Under Attack emergency form.",
        fields: {
          "Reporter Name": name.trim() || "Not provided",
          "Contact Email": email.trim(),
          "Phone / Discord / WhatsApp": contactHandle.trim() || "Not provided",
          "Target Domain / IP": targetAsset.trim(),
          "Attack Vector": attackType,
        },
      });
      setTicketId(res.ticketId || `SPX-${Date.now().toString(36).toUpperCase()}`);
    } catch {
      setError("Failed to dispatch emergency alert. Please retry immediately.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTicketId(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg border border-red-500/45 bg-[#0B0608] text-white shadow-[0_24px_90px_-15px_rgba(239,68,68,0.45)] p-0 overflow-hidden">
        {/* Emergency Alert Header */}
        <div className="bg-gradient-to-r from-red-600/25 via-red-500/15 to-transparent border-b border-red-500/30 px-6 py-4">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-mono font-bold text-red-200 w-fit">
              <span className="size-2 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
              <span>EMERGENCY RESPONSE · PRIORITY 0</span>
            </div>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Siren className="size-5 text-red-400" aria-hidden="true" />
              <span>Under Active Attack? Rapid Mitigation Intake</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-red-100/75">
              This dispatches an instant high-priority alert directly to SparrowX SOC engineers for emergency DDoS scrubbing, WAF activation, and origin cloaking.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          {ticketId ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto size-12 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 grid place-items-center text-emerald-400">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Emergency Alert Dispatched</h3>
                <p className="text-xs text-zinc-300">
                  Our SOC team has been paged immediately with your incident details.
                </p>
                <p className="font-mono text-xs text-red-300 pt-1">
                  Incident Reference: <strong>{ticketId}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => resetAndClose(false)}
                className="inline-flex items-center justify-center rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold px-5 py-2 text-xs cursor-pointer"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {error && (
                <div className="rounded-lg border border-red-500/45 bg-red-500/15 px-3 py-2 text-red-200 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ua-name" className="text-zinc-300 font-medium block">
                    Your Name / Org
                  </label>
                  <input
                    id="ua-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex / Acme Cloud"
                    className="w-full rounded-lg border border-red-500/25 bg-black/60 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-red-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ua-email" className="text-zinc-300 font-medium block">
                    Contact Email *
                  </label>
                  <input
                    id="ua-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ops@yourdomain.com"
                    className="w-full rounded-lg border border-red-500/25 bg-black/60 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-red-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ua-target" className="text-zinc-300 font-medium block">
                    Domain or IP Under Attack *
                  </label>
                  <input
                    id="ua-target"
                    type="text"
                    required
                    value={targetAsset}
                    onChange={(e) => setTargetAsset(e.target.value)}
                    placeholder="api.yourdomain.com or 203.0.113.10"
                    className="w-full rounded-lg border border-red-500/25 bg-black/60 px-3 py-2 text-white font-mono placeholder:text-zinc-500 focus:border-red-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ua-contact" className="text-zinc-300 font-medium block">
                    Discord / WhatsApp / Phone
                  </label>
                  <input
                    id="ua-contact"
                    type="text"
                    value={contactHandle}
                    onChange={(e) => setContactHandle(e.target.value)}
                    placeholder="@handle or +91..."
                    className="w-full rounded-lg border border-red-500/25 bg-black/60 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-red-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ua-vector" className="text-zinc-300 font-medium block">
                    Attack Type
                  </label>
                  <select
                    id="ua-vector"
                    value={attackType}
                    onChange={(e) => setAttackType(e.target.value)}
                    className="w-full rounded-lg border border-red-500/25 bg-[#0E090C] px-3 py-2 text-white focus:border-red-400 focus:outline-none"
                  >
                    {ATTACK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="ua-severity" className="text-zinc-300 font-medium block">
                    Impact Severity
                  </label>
                  <select
                    id="ua-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as "critical" | "high" | "medium")}
                    className="w-full rounded-lg border border-red-500/25 bg-[#0E090C] px-3 py-2 text-white focus:border-red-400 focus:outline-none"
                  >
                    {SEVERITY_LEVELS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="ua-details" className="text-zinc-300 font-medium block">
                  Incident Details (Traffic volume, target ports, symptoms)
                </label>
                <textarea
                  id="ua-details"
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the attack traffic, affected ports/endpoints, and any error codes..."
                  className="w-full rounded-lg border border-red-500/25 bg-black/60 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-red-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => resetAndClose(false)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2 text-xs shadow-[0_6px_24px_rgba(239,68,68,0.4)] transition-all cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{submitting ? "Paging SOC Team..." : "Send Emergency SOS"}</span>
                  {!submitting && <Send className="size-3" aria-hidden="true" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
