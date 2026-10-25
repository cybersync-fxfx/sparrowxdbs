import React, { useState } from "react";
import { Bell, Send, Plus, Trash2, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSavedWebhooks,
  saveWebhooks,
  dispatchIncidentWebhook,
  type WebhookConfig,
  type WebhookChannel,
} from "@/lib/advanced-features";
import { type Severity } from "@/lib/supabase";

export function LiveWebhookDispatcherManager({ showToast }: { showToast: (msg: string) => void }) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(() => getSavedWebhooks());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState<WebhookChannel>("slack");
  const [newUrl, setNewUrl] = useState("");
  const [newMinSeverity, setNewMinSeverity] = useState<Severity>("High");
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    const updated = webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    setWebhooks(updated);
    saveWebhooks(updated);
    showToast("Updated webhook status");
  };

  const handleDelete = (id: string) => {
    const updated = webhooks.filter((w) => w.id !== id);
    setWebhooks(updated);
    saveWebhooks(updated);
    showToast("Removed webhook dispatcher");
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    const created: WebhookConfig = {
      id: `wh-${Date.now()}`,
      name: newName.trim(),
      channel: newChannel,
      url: newUrl.trim(),
      enabled: true,
      minSeverity: newMinSeverity,
      successCount: 0,
      failureCount: 0,
      lastTriggered: "Never",
    };
    const updated = [created, ...webhooks];
    setWebhooks(updated);
    saveWebhooks(updated);
    setNewName("");
    setNewUrl("");
    setShowAddForm(false);
    showToast(`Added ${created.name} dispatcher`);
  };

  const handleTestPing = async (wh: WebhookConfig) => {
    setTestingId(wh.id);
    const mockIncident = {
      id: "INC-TEST-PING",
      title: "Test Security Dispatcher Telemetry Ping",
      source: "SparrowX Live Webhook Manager",
      time: new Date().toLocaleTimeString(),
      severity: wh.minSeverity,
      status: "Investigating" as const,
      assignee: "Automated Dispatcher",
      summary: "Manual test ping initiated to verify webhook connectivity.",
      playbook: "Diagnostic Ping Verification",
      affectedAssets: 1,
    };
    await dispatchIncidentWebhook(mockIncident, { channelOverride: wh.channel });
    setWebhooks(getSavedWebhooks());
    setTestingId(null);
    showToast(`Test telemetry packet dispatched to ${wh.name}`);
  };

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bell className="size-3.5" />
            </span>
            <h2 className="text-base font-semibold">
              Real-Time Alert Dispatchers (Slack / Discord / PagerDuty)
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically broadcast High and Critical security events to your team's escalation
            channels.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="sm"
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          {showAddForm ? "Cancel" : "Add Alert Channel"}
        </Button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 rounded-md border border-border bg-background/50 p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Channel Name</label>
              <input
                type="text"
                placeholder="e.g. SecOps Alerts Slack"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="mt-1 h-8 w-full rounded border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as WebhookChannel)}
                className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
              >
                <option value="slack">Slack Incoming Webhook</option>
                <option value="discord">Discord Webhook</option>
                <option value="pagerduty">PagerDuty Events API v2</option>
                <option value="custom">Custom JSON Webhook Endpoint</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Minimum Severity</label>
              <select
                value={newMinSeverity}
                onChange={(e) => setNewMinSeverity(e.target.value as Severity)}
                className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
              >
                <option value="Critical">Critical Only</option>
                <option value="High">High & Critical</option>
                <option value="Medium">All Incidents (Medium+)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Webhook Endpoint URL
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2.5 text-xs font-mono text-foreground outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              onClick={() => setShowAddForm(false)}
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs">
              Save Alert Channel
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 divide-y divide-border rounded-md border border-border bg-background/40">
        {webhooks.map((wh) => (
          <div
            key={wh.id}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground">{wh.name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                  {wh.channel}
                </span>
                <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {wh.minSeverity}+
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground truncate max-w-md">
                {wh.url}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-mono mr-2">
                Sent: {wh.successCount}
              </span>
              <Button
                onClick={() => handleTestPing(wh)}
                disabled={testingId === wh.id}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1"
              >
                <Send className="size-3" />
                {testingId === wh.id ? "Pinging..." : "Test Ping"}
              </Button>
              <Button
                onClick={() => handleToggle(wh.id)}
                size="sm"
                variant={wh.enabled ? "secondary" : "ghost"}
                className="h-7 px-2 text-[11px]"
              >
                {wh.enabled ? "Active" : "Disabled"}
              </Button>
              <Button
                onClick={() => handleDelete(wh.id)}
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
