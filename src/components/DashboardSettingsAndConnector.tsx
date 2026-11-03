import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Database,
  Globe2,
  Server,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Terminal,
  ExternalLink,
  Lock,
  Layers,
  Wrench,
  CheckCircle2,
  XCircle,
  Code2,
  Eye,
  EyeOff,
  Zap,
  Network,
  Table,
  Plus,
  Trash2,
  Radio,
  ArrowRight,
  Shield,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClientTenant } from "@/lib/supabase";
import {
  getTenantDatabaseConfig,
  rotateTenantDashboardApiKey,
  resetTenantApiCredentials,
  verifyWebsiteConnector,
  verifyServerConnector,
  getTenantDatabaseIps,
  addTenantDatabaseIp,
  removeTenantDatabaseIp,
  probeTenantDatabaseIp,
  validateIpAddress,
  type SovereignTenantDatabaseConfig,
  type TenantDatabaseIpRecord,
} from "@/lib/tenant-database";

interface DashboardSettingsAndConnectorProps {
  tenant: ClientTenant | null;
  onVerifyTenantSdk?: (tenant: ClientTenant) => Promise<void>;
  showToast: (msg: string, variant?: "default" | "error" | "warning") => void;
  autoContainCritical?: boolean;
  setAutoContainCritical?: (v: boolean) => void;
  realtimePagerDuty?: boolean;
  setRealtimePagerDuty?: (v: boolean) => void;
  enforceStrictMfa?: boolean;
  setEnforceStrictMfa?: (v: boolean) => void;
}

export function DashboardSettingsAndConnector({
  tenant,
  onVerifyTenantSdk,
  showToast,
  autoContainCritical = true,
  setAutoContainCritical,
  realtimePagerDuty = true,
  setRealtimePagerDuty,
  enforceStrictMfa = true,
  setEnforceStrictMfa,
}: DashboardSettingsAndConnectorProps) {
  const tenantId = tenant?.id || "TNT-DEFAULT";
  const tenantName = tenant?.name || "Client Workspace";
  const primaryDomain = tenant?.primaryDomain || "example.com";

  const [dbConfig, setDbConfig] = useState<SovereignTenantDatabaseConfig>(() =>
    getTenantDatabaseConfig(tenantId, tenantName, primaryDomain),
  );

  // Credential Display & Copy State
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedHtmlCode, setCopiedHtmlCode] = useState(false);
  const [copiedVpsCommand, setCopiedVpsCommand] = useState(false);

  // API IDs & Key Reset State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSelection, setResetSelection] = useState<"all" | "key_only" | "id_only">("all");
  const [isResetting, setIsResetting] = useState(false);
  const [lastResetFeedback, setLastResetFeedback] = useState<string | null>(null);

  // Dedicated Tenant IP Database Table State
  const [tenantIps, setTenantIps] = useState<TenantDatabaseIpRecord[]>(() =>
    getTenantDatabaseIps(tenantId),
  );
  const [newIpAddress, setNewIpAddress] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [newIpType, setNewIpType] = useState<TenantDatabaseIpRecord["type"]>("server_wan");
  const [newIpNotes, setNewIpNotes] = useState("");
  const [isAddingIp, setIsAddingIp] = useState(false);
  const [ipFormError, setIpFormError] = useState<string | null>(null);
  const [ipFormSuccess, setIpFormSuccess] = useState<string | null>(null);
  const [probingIpId, setProbingIpId] = useState<string | null>(null);
  const [copiedIpId, setCopiedIpId] = useState<string | null>(null);

  // Website connector test state
  const [websiteTestUrl, setWebsiteTestUrl] = useState(() => {
    return primaryDomain.startsWith("http") ? primaryDomain : `https://${primaryDomain}`;
  });
  const [isTestingWebsite, setIsTestingWebsite] = useState(false);
  const [websiteResult, setWebsiteResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  }>({
    tested: Boolean(dbConfig.connectors.websiteHtml.verifiedAt || tenant?.sdkVerified),
    success: Boolean(dbConfig.connectors.websiteHtml.installed || tenant?.sdkVerified),
    message: dbConfig.connectors.websiteHtml.installed || tenant?.sdkVerified
      ? `Website connector confirmed active on ${primaryDomain}. SparrowX protection is live.`
      : "Connector not verified yet. Paste the snippet into your website and click Connect below.",
  });

  // Server connector test state
  const [serverHostInput, setServerHostInput] = useState(() => {
    return dbConfig.connectors.vpsServer.serverIp || "";
  });
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverResult, setServerResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  }>({
    tested: Boolean(dbConfig.connectors.vpsServer.verifiedAt),
    success: Boolean(dbConfig.connectors.vpsServer.installed),
    message: dbConfig.connectors.vpsServer.installed
      ? `Sovereign server agent confirmed active on ${dbConfig.connectors.vpsServer.serverIp || "host"}.`
      : "Server agent not verified yet. Run the curl installer on your VPS and click Verify below.",
  });

  useEffect(() => {
    const cfg = getTenantDatabaseConfig(tenantId, tenantName, primaryDomain);
    setDbConfig(cfg);
    setTenantIps(getTenantDatabaseIps(tenantId));
  }, [tenantId, tenantName, primaryDomain]);

  const handleCopy = (text: string, type: "key" | "clientId" | "html" | "vps") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      showToast("Dashboard API Key copied to clipboard");
    } else if (type === "clientId") {
      setCopiedClientId(true);
      setTimeout(() => setCopiedClientId(false), 2000);
      showToast("Client API ID copied to clipboard");
    } else if (type === "html") {
      setCopiedHtmlCode(true);
      setTimeout(() => setCopiedHtmlCode(false), 2000);
      showToast("HTML Connector snippet copied to clipboard");
    } else {
      setCopiedVpsCommand(true);
      setTimeout(() => setCopiedVpsCommand(false), 2000);
      showToast("VPS installer command copied to clipboard");
    }
  };

  // Reset API Credentials Handler (API ID and/or API Key)
  const handleResetCredentials = (what: "all" | "key_only" | "id_only") => {
    setIsResetting(true);
    try {
      const res = resetTenantApiCredentials(tenantId, what);
      const updatedConfig = getTenantDatabaseConfig(tenantId, tenantName, primaryDomain);
      setDbConfig(updatedConfig);
      setLastResetFeedback(res.message);
      showToast(res.message, "success");
      setShowResetConfirm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset API credentials.";
      showToast(msg, "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Add IP to Dedicated Tenant Database Table
  const handleAddIp = () => {
    setIpFormError(null);
    setIpFormSuccess(null);

    const validation = validateIpAddress(newIpAddress);
    if (!validation.valid) {
      setIpFormError(validation.message || "Invalid IP address format.");
      return;
    }

    setIsAddingIp(true);
    try {
      const res = addTenantDatabaseIp(tenantId, {
        ipAddress: newIpAddress,
        label: newIpLabel,
        type: newIpType,
        notes: newIpNotes,
      });

      if (res.success && res.record) {
        setTenantIps(getTenantDatabaseIps(tenantId));
        setIpFormSuccess(res.message);
        setNewIpAddress("");
        setNewIpLabel("");
        setNewIpNotes("");
        showToast(res.message, "success");

        // Sync with VPS server host test input if applicable
        if (newIpType === "server_wan" || newIpType === "waf_origin") {
          setServerHostInput(res.record.ipAddress);
        }
      } else {
        setIpFormError(res.message);
        showToast(res.message, "error");
      }
    } finally {
      setIsAddingIp(false);
    }
  };

  // Remove IP from Dedicated Tenant Table
  const handleRemoveIp = (recordId: string) => {
    const res = removeTenantDatabaseIp(tenantId, recordId);
    if (res.success) {
      setTenantIps(getTenantDatabaseIps(tenantId));
      showToast(res.message, "warning");
    } else {
      showToast(res.message, "error");
    }
  };

  // Live Probe on Registered Tenant IP
  const handleProbeIp = async (recordId: string) => {
    setProbingIpId(recordId);
    try {
      const res = await probeTenantDatabaseIp(tenantId, recordId);
      setTenantIps(getTenantDatabaseIps(tenantId));
      if (res.success) {
        showToast(res.message, "success");
      } else {
        showToast(res.message, "warning");
      }
    } finally {
      setProbingIpId(null);
    }
  };

  // Copy IP to Clipboard
  const handleCopyIp = (ip: string, id: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIpId(id);
    setTimeout(() => setCopiedIpId(null), 2000);
    showToast(`IP ${ip} copied to clipboard`);
  };

  const handleRunWebsiteTest = async () => {
    setIsTestingWebsite(true);
    try {
      const res = await verifyWebsiteConnector(tenantId, websiteTestUrl);
      setWebsiteResult({
        tested: true,
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
      });

      if (res.success) {
        showToast("Website connected successfully! Protection is active.");
        if (tenant && onVerifyTenantSdk) {
          await onVerifyTenantSdk(tenant);
        }
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection verification failed.";
      setWebsiteResult({
        tested: true,
        success: false,
        message: msg,
      });
      showToast(msg, "error");
    } finally {
      setIsTestingWebsite(false);
      setDbConfig(getTenantDatabaseConfig(tenantId, tenantName, primaryDomain));
    }
  };

  const handleRunServerTest = async () => {
    setIsTestingServer(true);
    try {
      const res = await verifyServerConnector(tenantId, serverHostInput);
      setServerResult({
        tested: true,
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
      });

      if (res.success) {
        showToast("VPS server connected successfully! Sovereign agent active.");
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Server probe failed.";
      setServerResult({
        tested: true,
        success: false,
        message: msg,
      });
      showToast(msg, "error");
    } finally {
      setIsTestingServer(false);
      setDbConfig(getTenantDatabaseConfig(tenantId, tenantName, primaryDomain));
    }
  };

  const htmlConnectorSnippet = `<!-- SparrowX Autonomous Cyber Defense & AI Shield -->
<script 
  src="https://sparrowx.net/sparrowx-shield.js" 
  data-spx-key="${dbConfig.dashboardApiKey}" 
  data-spx-tenant="${tenantId}" 
  data-spx-client-id="${dbConfig.apiClientId}"
  data-spx-domain="${primaryDomain}"
  async>
</script>`;

  const vpsConnectorCommand = `curl -sSL https://sparrowx.net/install-connector.sh | SPX_KEY="${dbConfig.dashboardApiKey}" SPX_TENANT="${tenantId}" SPX_CLIENT_ID="${dbConfig.apiClientId}" bash`;

  return (
    <div className="space-y-6">
      {/* 1. Header & Sovereign Tenant Isolation Identity */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Lock className="size-3.5" />
            <span>Sovereign Tenant Environment & Database</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Settings, Dashboard API & Connectors
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm max-w-3xl">
            Each dashboard has a 100% physically isolated database, separate IP records table, and resettable API credentials.
            Manage your server IPs and connect your website or server using our drop-in connector files below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary flex items-center gap-1.5">
            <Database className="size-3.5" />
            <span>{dbConfig.databaseName}</span>
          </span>
          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
            <Table className="size-3.5" />
            <span>Table: {dbConfig.ipTableName}</span>
          </span>
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            <span>Partition {dbConfig.partitionStatus}</span>
          </span>
        </div>
      </section>

      {/* 2. DASHBOARD API CREDENTIALS & EASY CREDENTIAL RESET */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3.5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">API Credentials & ID Management</h2>
              <p className="text-[11px] text-muted-foreground">
                Dedicated Client API ID and private Secret Key for your isolated database partition. Reset credentials anytime with 1 click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              className="h-8 gap-1.5 text-xs font-semibold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <RotateCcw className="size-3" />
              <span>Reset API IDs & Keys</span>
            </Button>
          </div>
        </div>

        {/* Quick Reset Confirmation Panel */}
        {showResetConfirm && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3 animate-in fade-in-50 duration-150">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-amber-300">Reset API Credentials for {tenantName}</div>
                <p className="text-zinc-300 leading-relaxed">
                  Resetting credentials will immediately revoke existing tokens and issue fresh cryptographically signed keys. Connectors running previous credentials will need to be updated.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
              <span className="text-xs text-zinc-300">Choose action:</span>
              <Button
                type="button"
                size="sm"
                disabled={isResetting}
                onClick={() => handleResetCredentials("all")}
                className="h-7 text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400"
              >
                {isResetting && resetSelection === "all" ? "Resetting..." : "Reset Both (API ID + Secret Key)"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isResetting}
                onClick={() => handleResetCredentials("key_only")}
                className="h-7 text-xs border-zinc-700 hover:text-white"
              >
                Reset API Key Only
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isResetting}
                onClick={() => handleResetCredentials("id_only")}
                className="h-7 text-xs border-zinc-700 hover:text-white"
              >
                Reset Client ID Only
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowResetConfirm(false)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {lastResetFeedback && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>{lastResetFeedback} Connectors have been updated with your new credentials.</span>
            </div>
            <button
              type="button"
              onClick={() => setLastResetFeedback(null)}
              className="text-xs text-emerald-400 hover:text-white font-mono"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Client API ID */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Client API ID</span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Application ID</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={dbConfig.apiClientId}
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-xs text-foreground outline-none select-all"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopy(dbConfig.apiClientId, "clientId")}
                className="h-9 gap-1 text-xs shrink-0"
              >
                {copiedClientId ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copiedClientId ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pass as <code className="text-primary font-mono">x-sparrowx-client-id</code> header or <code className="text-primary font-mono">data-spx-client-id</code> attribute.
            </p>
          </div>

          {/* Card 2: Dashboard API Key */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Dashboard API Key</span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                <span>{showApiKey ? "Hide" : "Reveal"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type={showApiKey ? "text" : "password"}
                readOnly
                value={dbConfig.dashboardApiKey}
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-xs text-foreground outline-none select-all"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopy(dbConfig.dashboardApiKey, "key")}
                className="h-9 gap-1 text-xs shrink-0"
              >
                {copiedKey ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copiedKey ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pass as <code className="text-primary font-mono">x-sparrowx-key</code> header or <code className="text-primary font-mono">data-spx-key</code> attribute.
            </p>
          </div>

          {/* Card 3: Database Partition Architecture */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold text-foreground">Database Partition Details</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Dedicated Database</div>
                <div className="mt-0.5 font-bold text-primary truncate" title={dbConfig.databaseName}>
                  {dbConfig.databaseName}
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Dedicated IP Table</div>
                <div className="mt-0.5 font-bold text-cyan-400 truncate" title={dbConfig.ipTableName}>
                  {dbConfig.ipTableName}
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Encryption</div>
                <div className="mt-0.5 font-bold text-emerald-400 truncate">
                  AES-256 Hardware KMS
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Ingress Endpoint</div>
                <div className="mt-0.5 font-bold text-foreground truncate">
                  {dbConfig.apiIngestEndpoint}/verify
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DEDICATED SEPARATE DATABASE TABLE FOR CLIENT TENANT IPS */}
      <section className="rounded-xl border border-cyan-500/30 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3.5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Network className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Dedicated Tenant IP Database Table</span>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] text-cyan-300 font-bold">
                  {dbConfig.ipTableName}
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Add server WAN IPs, WAF protected origin hosts, and gateway IPs directly into your tenant&apos;s isolated database table.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-1 text-xs font-mono font-semibold text-cyan-300">
              {tenantIps.length} IP Record{tenantIps.length === 1 ? "" : "s"} in Table
            </span>
          </div>
        </div>

        {/* Add IP Form */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="font-semibold text-xs text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5 text-cyan-400" />
              <span>Add IP Address to Database Table</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Target Table: <code className="text-cyan-400">{dbConfig.ipTableName}</code>
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">IP Address or CIDR *</label>
              <input
                type="text"
                value={newIpAddress}
                onChange={(e) => {
                  setNewIpAddress(e.target.value);
                  setIpFormError(null);
                }}
                placeholder="e.g. 76.76.21.30 or 198.51.100.0/24"
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-xs text-foreground outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Host Label / Name</label>
              <input
                type="text"
                value={newIpLabel}
                onChange={(e) => setNewIpLabel(e.target.value)}
                placeholder="e.g. Primary Production Server"
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">IP Purpose / Type</label>
              <select
                value={newIpType}
                onChange={(e) => setNewIpType(e.target.value as TenantDatabaseIpRecord["type"])}
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none focus:border-cyan-400"
              >
                <option value="server_wan">Server Origin (WAN Public IP)</option>
                <option value="waf_origin">WAF Protected Web Host</option>
                <option value="allowed_inbound">Allowed Inbound Gateway</option>
                <option value="vpn_gateway">VPN / Secure Tunnel</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <Button
                type="button"
                onClick={handleAddIp}
                disabled={isAddingIp || !newIpAddress.trim()}
                className="h-9 gap-1.5 text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400"
              >
                {isAddingIp ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Add IP to Database</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error & Success Feedback */}
          {ipFormError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <span>{ipFormError}</span>
            </div>
          )}

          {ipFormSuccess && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              <span>{ipFormSuccess}</span>
            </div>
          )}
        </div>

        {/* Database IP Records Table */}
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          {tenantIps.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Network className="size-8 mx-auto text-muted-foreground/50" />
              <div className="text-xs font-bold text-foreground">No IP addresses registered in table yet</div>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                Add your website or server public IP above. It will be stored in your dedicated database table <code className="text-cyan-400">{dbConfig.ipTableName}</code> and protected by SparrowX.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-card/60 text-[10px] uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Label & Type</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Table Partition</th>
                    <th className="py-2.5 px-3">Health / Connectivity</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tenantIps.map((ipRec) => (
                    <tr key={ipRec.id} className="hover:bg-card/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground text-xs">{ipRec.ipAddress}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyIp(ipRec.ipAddress, ipRec.id)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copy IP"
                          >
                            {copiedIpId === ipRec.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{ipRec.label}</div>
                        <span className="mt-0.5 inline-block rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 font-semibold">
                          {ipRec.type === "server_wan"
                            ? "Server Origin (WAN)"
                            : ipRec.type === "waf_origin"
                              ? "WAF Protected Host"
                              : ipRec.type === "allowed_inbound"
                                ? "Allowed Gateway"
                                : "VPN Tunnel"}
                        </span>
                      </td>

                      <td className="py-3 px-3 hidden md:table-cell">
                        <code className="text-[10px] text-muted-foreground font-mono bg-card px-1.5 py-0.5 rounded border border-border/40">
                          {ipRec.tableName}
                        </code>
                      </td>

                      <td className="py-3 px-3">
                        {ipRec.lastProbeStatus === "Reachable" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Reachable ({ipRec.lastProbeLatencyMs || 12}ms)</span>
                          </span>
                        ) : ipRec.lastProbeStatus === "Unreachable" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <span className="size-1.5 rounded-full bg-destructive" />
                            <span>Unreachable</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                            <span className="size-1.5 rounded-full bg-zinc-400" />
                            <span>Pending Probe</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={probingIpId === ipRec.id}
                            onClick={() => handleProbeIp(ipRec.id)}
                            className="h-7 px-2 text-[11px] gap-1 border-border/80"
                            title="Run live connectivity probe on this IP"
                          >
                            <RefreshCw className={`size-3 ${probingIpId === ipRec.id ? "animate-spin text-cyan-400" : ""}`} />
                            <span className="hidden sm:inline">Probe</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setServerHostInput(ipRec.ipAddress);
                              showToast(`Active server IP set to ${ipRec.ipAddress}`);
                            }}
                            className="h-7 px-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                            title="Set as target host in VPS connector form below"
                          >
                            <span>Use in VPS</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveIp(ipRec.id)}
                            className="h-7 px-1.5 text-destructive hover:bg-destructive/10"
                            title="Delete IP record from database"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 4. WEBSITE CONNECTOR (HTML DROP-IN SCRIPT) */}
      <section className="rounded-xl border border-primary/30 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Globe2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Website HTML Profile Connector</h2>
            <p className="text-[11px] text-muted-foreground">
              Copy and paste this single script into your website&apos;s HTML profile (<code className="text-foreground">&lt;head&gt;</code> or <code className="text-foreground">&lt;body&gt;</code>) to activate defense.
            </p>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="rounded-lg border border-border bg-black/90 p-4 font-mono text-xs text-zinc-300 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[11px] text-zinc-400 font-sans font-semibold">
              Drop-In Script Tag (HTML / WordPress / Next.js / PHP / React / Webflow)
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleCopy(htmlConnectorSnippet, "html")}
              className="h-7 gap-1 text-[11px] font-sans border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white"
            >
              {copiedHtmlCode ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copiedHtmlCode ? "Copied" : "Copy Code"}</span>
            </Button>
          </div>
          <pre className="overflow-x-auto text-emerald-300 leading-relaxed text-[11px]">
            {htmlConnectorSnippet}
          </pre>
        </div>

        {/* Real Live Website Test Form */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="font-semibold text-xs text-foreground">
            Test & Confirm Your Website Connection
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full">
              <input
                type="text"
                value={websiteTestUrl}
                onChange={(e) => setWebsiteTestUrl(e.target.value)}
                placeholder="https://yourdomain.com"
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <Button
              type="button"
              onClick={handleRunWebsiteTest}
              disabled={isTestingWebsite}
              className="h-9 gap-1.5 text-xs font-semibold shrink-0 w-full sm:w-auto"
            >
              {isTestingWebsite ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Connecting & Verifying...</span>
                </>
              ) : (
                <>
                  <Zap className="size-3.5 text-primary-foreground" />
                  <span>Connect & Verify Website</span>
                </>
              )}
            </Button>
          </div>

          {/* Honest Result Display: Never Leave Users Guessing */}
          {websiteResult.tested && (
            <div
              className={`rounded-lg border p-3 text-xs leading-relaxed transition-all ${
                websiteResult.success
                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {websiteResult.success ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold">
                    {websiteResult.success ? "Website Connected Successfully" : "Website Connection Failed"}
                    {websiteResult.latencyMs ? ` (${websiteResult.latencyMs}ms RTT)` : ""}
                  </div>
                  <div>{websiteResult.message}</div>
                  {!websiteResult.success && (
                    <div className="text-[11px] opacity-90 pt-1">
                      <strong>How to fix:</strong>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Ensure the script tag is pasted inside your website&apos;s HTML.</li>
                        <li>Verify that your website domain is published and publicly accessible on the web.</li>
                        <li>Click &quot;Connect & Verify Website&quot; to re-check.</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. VPS & DEDICATED SERVER CONNECTOR */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Server className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">VPS & Dedicated Server Connector</h2>
            <p className="text-[11px] text-muted-foreground">
              Run this 1-line shell script on your Linux VPS (Ubuntu, Debian, RHEL, Alpine) to install the autonomous security agent and bind to your database.
            </p>
          </div>
        </div>

        {/* Command Box */}
        <div className="rounded-lg border border-border bg-black/90 p-4 font-mono text-xs text-zinc-300 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[11px] text-zinc-400 font-sans font-semibold">
              Linux Server 1-Command Installer
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleCopy(vpsConnectorCommand, "vps")}
              className="h-7 gap-1 text-[11px] font-sans border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white"
            >
              {copiedVpsCommand ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copiedVpsCommand ? "Copied" : "Copy Command"}</span>
            </Button>
          </div>
          <pre className="overflow-x-auto text-amber-300 leading-relaxed text-[11px]">
            {vpsConnectorCommand}
          </pre>
        </div>

        {/* Server Probe Form */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="font-semibold text-xs text-foreground">
            Verify VPS Server Agent Handshake
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={serverHostInput}
              onChange={(e) => setServerHostInput(e.target.value)}
              placeholder="e.g. 198.51.100.42 or api.myserver.com"
              className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
            <Button
              type="button"
              onClick={handleRunServerTest}
              disabled={isTestingServer}
              className="h-9 gap-1.5 text-xs font-semibold shrink-0 w-full sm:w-auto"
            >
              {isTestingServer ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Probing Server Agent...</span>
                </>
              ) : (
                <>
                  <Server className="size-3.5 text-primary-foreground" />
                  <span>Verify Server Connection</span>
                </>
              )}
            </Button>
          </div>

          {/* Result Display */}
          {serverResult.tested && (
            <div
              className={`rounded-lg border p-3 text-xs leading-relaxed transition-all ${
                serverResult.success
                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {serverResult.success ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {serverResult.success ? "Server Agent Connected" : "Server Agent Not Detected"}
                  </div>
                  <div>{serverResult.message}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. WORKSPACE SECURITY POLICIES */}
      <section className="rounded-xl border border-border bg-card divide-y divide-border shadow-sm">
        <div className="p-4 sm:p-5">
          <h2 className="text-sm font-bold text-foreground">Workspace Security Policies</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated containment, escalation triggers, and authentication enforcement.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Autonomous containment for Critical EDR detections
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Automatically isolate endpoints and block malicious IPs when high-confidence exploits are intercepted.
            </p>
          </div>
          {setAutoContainCritical && (
            <Button
              onClick={() => {
                setAutoContainCritical(!autoContainCritical);
                showToast(`Autonomous containment ${!autoContainCritical ? "enabled" : "disabled"}`);
              }}
              size="sm"
              variant={autoContainCritical ? "default" : "outline"}
              className="text-xs"
            >
              {autoContainCritical ? "Enabled" : "Disabled"}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Realtime PagerDuty & Webhook escalation on Critical incidents
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Immediately notify your on-call engineering team when an incident is triaged as Critical.
            </p>
          </div>
          {setRealtimePagerDuty && (
            <Button
              onClick={() => {
                setRealtimePagerDuty(!realtimePagerDuty);
                showToast(`PagerDuty escalation ${!realtimePagerDuty ? "enabled" : "disabled"}`);
              }}
              size="sm"
              variant={realtimePagerDuty ? "default" : "outline"}
              className="text-xs"
            >
              {realtimePagerDuty ? "Enabled" : "Disabled"}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Hardware WebAuthn / FIDO2 MFA enforcement
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Require cryptographic security keys for sensitive rule deployments and API key rotations.
            </p>
          </div>
          {setEnforceStrictMfa && (
            <Button
              onClick={() => {
                setEnforceStrictMfa(!enforceStrictMfa);
                showToast(`Strict MFA ${!enforceStrictMfa ? "enforced" : "relaxed"}`);
              }}
              size="sm"
              variant={enforceStrictMfa ? "default" : "outline"}
              className="text-xs"
            >
              {enforceStrictMfa ? "Enforced" : "Optional"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
