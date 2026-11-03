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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClientTenant } from "@/lib/supabase";
import {
  getTenantDatabaseConfig,
  rotateTenantDashboardApiKey,
  verifyWebsiteConnector,
  verifyServerConnector,
  type SovereignTenantDatabaseConfig,
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

  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedHtmlCode, setCopiedHtmlCode] = useState(false);
  const [copiedVpsCommand, setCopiedVpsCommand] = useState(false);

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
    return dbConfig.connectors.vpsServer.serverIp || "104.21.55.19";
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
  }, [tenantId, tenantName, primaryDomain]);

  const handleCopy = (text: string, type: "key" | "html" | "vps") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      showToast("Dashboard API Key copied to clipboard");
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

  const handleRotateKey = () => {
    const newKey = rotateTenantDashboardApiKey(tenantId);
    setDbConfig((prev) => ({ ...prev, dashboardApiKey: newKey }));
    showToast("Dashboard API Key successfully rotated. Remember to update your connectors.", "warning");
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
  data-spx-domain="${primaryDomain}"
  async>
</script>`;

  const vpsConnectorCommand = `curl -sSL https://sparrowx.net/install-connector.sh | SPX_KEY="${dbConfig.dashboardApiKey}" SPX_TENANT="${tenantId}" bash`;

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
            Each dashboard has a 100% physically isolated database and unique API key.
            Connect your website or server using our drop-in connector files below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary flex items-center gap-1.5">
            <Database className="size-3.5" />
            <span>{dbConfig.databaseName}</span>
          </span>
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            <span>Partition {dbConfig.partitionStatus}</span>
          </span>
        </div>
      </section>

      {/* 2. DASHBOARD API & DEDICATED DATABASE CONFIGURATION */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3.5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Dashboard API & Telemetry Credentials</h2>
              <p className="text-[11px] text-muted-foreground">
                Private API key and endpoints for your dedicated sovereign database partition.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRotateKey}
            className="h-8 gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3 text-primary" />
            <span>Rotate Key</span>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* API Key Box */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Your Dashboard API Key</span>
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
                className="h-9 gap-1.5 text-xs shrink-0"
              >
                {copiedKey ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copiedKey ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pass as <code className="text-primary font-mono">x-sparrowx-key</code> header or <code className="text-primary font-mono">data-spx-key</code> script attribute.
            </p>
          </div>

          {/* Database Partition Info */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <span className="text-xs font-semibold text-foreground">Sovereign Database Architecture</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Schema Partition</div>
                <div className="mt-0.5 font-bold text-primary truncate" title={dbConfig.databaseName}>
                  {dbConfig.databaseName}
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Encryption</div>
                <div className="mt-0.5 font-bold text-emerald-400 truncate">
                  AES-256-GCM Hardware
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Ingress Endpoint</div>
                <div className="mt-0.5 font-bold text-foreground truncate">
                  {dbConfig.apiIngestEndpoint}/verify
                </div>
              </div>
              <div className="rounded border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground font-sans uppercase">Cross-Tenant Isolation</div>
                <div className="mt-0.5 font-bold text-emerald-400 truncate">
                  Strict Zero-Leak
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WEBSITE CONNECTOR (HTML DROP-IN SCRIPT) */}
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

      {/* 4. VPS & DEDICATED SERVER CONNECTOR */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Server className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">VPS & Dedicated Server Connector</h2>
            <p className="text-[11px] text-muted-foreground">
              If your backend or website is hosted on a VPS (Linux/Ubuntu/Debian/CentOS/AWS EC2), run this command on your server to install the sovereign protection agent.
            </p>
          </div>
        </div>

        {/* VPS Installer Command */}
        <div className="rounded-lg border border-border bg-black/90 p-4 font-mono text-xs text-zinc-300 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[11px] text-zinc-400 font-sans font-semibold">
              Linux Server Terminal Command (Run as root or sudo)
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
          <pre className="overflow-x-auto text-amber-300 leading-relaxed text-[11px] select-all">
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
              placeholder="e.g. 104.21.55.19 or api.myserver.com"
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

      {/* 5. WORKSPACE SECURITY POLICIES */}
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
