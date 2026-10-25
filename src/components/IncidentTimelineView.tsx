import React, { useState } from "react";
import { Clock, Plus, CheckCircle, ShieldCheck, Activity, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getIncidentTimeline,
  appendIncidentTimelineEvent,
  type IncidentTimelineEvent,
} from "@/lib/advanced-features";
import { type Incident } from "@/lib/supabase";

export function IncidentTimelineView({
  incident,
  currentOperator,
  showToast,
}: {
  incident: Incident;
  currentOperator: string;
  showToast: (msg: string) => void;
}) {
  const [timeline, setTimeline] = useState<IncidentTimelineEvent[]>(() =>
    getIncidentTimeline(incident.id, incident),
  );
  const [newStage, setNewStage] = useState<IncidentTimelineEvent["stage"]>("Remediated");
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    const updated = appendIncidentTimelineEvent(incident.id, {
      stage: newStage,
      actor: currentOperator || "SecOps Responder",
      summary: newNote.trim(),
    });
    setTimeline(updated);
    setNewNote("");
    setIsSubmitting(false);
    showToast("Added timeline event to incident record");
  };

  const getStageBadge = (stage: IncidentTimelineEvent["stage"]) => {
    switch (stage) {
      case "Detected":
        return "border-destructive/30 bg-destructive/10 text-destructive";
      case "Triaged":
        return "border-primary/30 bg-primary/10 text-primary";
      case "Playbook Executed":
        return "border-info/30 bg-info/10 text-info";
      case "Remediated":
      case "Contained":
        return "border-success/30 bg-success/10 text-success";
      default:
        return "border-border bg-secondary text-muted-foreground";
    }
  };

  return (
    <div className="mt-5 border border-border bg-card p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Forensic Incident Timeline & Remediation Log
          </h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {timeline.length} Recorded Milestone(s)
        </span>
      </div>

      <div className="relative mt-4 space-y-4 pl-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {timeline.map((event) => (
          <div key={event.id} className="relative flex items-start gap-3">
            <span className="absolute -left-4 mt-1 size-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex-1 rounded border border-border/80 bg-background/50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold text-[10px] border ${getStageBadge(event.stage)}`}
                  >
                    {event.stage}
                  </span>
                  <span className="font-medium text-foreground">{event.actor}</span>
                </div>
                <span className="font-mono text-muted-foreground">{event.timestamp}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{event.summary}</p>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleAddEvent}
        className="mt-4 border-t border-border pt-3 flex flex-col gap-2.5"
      >
        <div className="flex items-center gap-2">
          <select
            value={newStage}
            onChange={(e) => setNewStage(e.target.value as IncidentTimelineEvent["stage"])}
            className="h-8 rounded border border-border bg-background px-2.5 text-xs text-foreground outline-none"
          >
            <option value="Triaged">Triaged</option>
            <option value="Playbook Executed">Playbook Executed</option>
            <option value="Remediated">Remediated</option>
            <option value="Contained">Contained</option>
          </select>
          <input
            type="text"
            placeholder="Add remediation notes or containment action..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="h-8 flex-1 rounded border border-border bg-background px-3 text-xs text-foreground outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !newNote.trim()}
            className="h-8 text-xs gap-1"
          >
            <Plus className="size-3.5" />
            Add Note
          </Button>
        </div>
      </form>
    </div>
  );
}
