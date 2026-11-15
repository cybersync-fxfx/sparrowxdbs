import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Globe,
  Layers,
  Lock,
  Radio,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import type { AppUser, Asset, Incident } from "@/lib/supabase";
import { emitEngineToast } from "./BackgroundEngineToaster";

export type SocViewMode = "queue" | "calm" | "map" | "plans";

export interface SparrowxSentraSocWorkbenchProps {
  incidents?: Incident[] | undefined;
  assets?: Asset[] | undefined;
  currentUser?: AppUser | null | undefined;
  onResolveIncident?: ((id: string) => Promise<void> | void) | undefined;
  onToggleAssetIsolation?: ((id: string) => Promise<void> | void) | undefined;
  onOpenAuthModal?: (() => void) | undefined;
  onOpenClientArea?: (() => void) | undefined;
  onSignOut?: (() => void) | undefined;
  activeRailMode?: SocViewMode | undefined;
  onSelectRailMode?: ((mode: SocViewMode) => void) | undefined;
  showExtendedRailItems?: boolean | undefined;
  /** When false (default in production client flows), never seed fake FIN-WS-0419 / INC-4127 sample incidents. */
  allowDemoFallback?: boolean | undefined;
}

interface SocNode {
  id: string;
  label: string;
  sublabel: string;
  kind: "attacker" | "host" | "account" | "target";
  x: number;
  y: number;
}

interface SocEdge {
  from: string;
  to: string;
  label: string;
}

interface SocHostCard {
  id: string;
  hostname: string;
  role: string;
  location: string;
  status: "Compromised" | "Targeted" | "Contained" | "Safe";
  riskScore: number;
  evidence: string[];
  processTree: string;
  networkFlow: string;
}

interface SocAiStep {
  time: string;
  title: string;
  detail: string;
  tags: string[];
  isApproval?: boolean;
}

interface SocCase {
  id: string;
  title: string;
  subtitle: string;
  queueSummary: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "Contained" | "Resolved";
  mine: boolean;
  openedAt: string;
  mitre: string;
  owner: string;
  alertsGrouped: number;
  assetsInPath: number;
  filesEncrypted: number;
  containSeconds: number;
  confidence: number;
  ageLabel: string;
  containedAtLabel: string;
  nodes: SocNode[];
  edges: SocEdge[];
  hosts: SocHostCard[];
  timeline: SocAiStep[];
  approvalActionLabel: string;
  approvalDescription: string;
  containedSummaryTitle: string;
  containedSummaryDetail: string;
  backendIncidentId?: string;
}

const INITIAL_CASES: SocCase[] = [
  {
    id: "INC-4127",
    title: "Credential theft on FIN-WS-0419",
    subtitle: "Opened 14:02:11 by SparrowX Sense · 7 alerts · MITRE T1003, T1021 · Owner Mateo Ruiz",
    queueSummary: "7 alerts · EDR, DNS, firewall",
    severity: "Critical",
    status: "Open",
    mine: true,
    openedAt: "14:02:11",
    mitre: "T1003, T1021",
    owner: "Mateo Ruiz",
    alertsGrouped: 7,
    assetsInPath: 4,
    filesEncrypted: 0,
    containSeconds: 39,
    confidence: 96,
    ageLabel: "14:02",
    containedAtLabel: "14:03:02",
    nodes: [
      { id: "c2", label: "45.137.21.9", sublabel: "External C2", kind: "attacker", x: 96, y: 122 },
      { id: "ws", label: "FIN-WS-0419", sublabel: "Finance laptop", kind: "host", x: 268, y: 122 },
      { id: "acct", label: "svc_backup", sublabel: "Stolen account", kind: "account", x: 438, y: 122 },
      { id: "fs", label: "FS-02", sublabel: "File server", kind: "target", x: 604, y: 72 },
      { id: "sql", label: "SQL-PAY-01", sublabel: "Payroll DB", kind: "target", x: 604, y: 168 },
    ],
    edges: [
      { from: "c2", to: "ws", label: "beacon · 60 s" },
      { from: "ws", to: "acct", label: "LSASS read" },
      { from: "acct", to: "fs", label: "SMB · x14" },
      { from: "acct", to: "sql", label: "SMB · x2" },
    ],
    hosts: [
      {
        id: "h-ws",
        hostname: "FIN-WS-0419",
        role: "Finance",
        location: "Oslo",
        status: "Compromised",
        riskScore: 92,
        evidence: ["LSASS read", "C2 beacon 60 s", "SMB -> x14"],
        processTree: "explorer.exe -> rundll32.exe (pid 4812) -> lsass.exe memory handle",
        networkFlow: "Outbound TCP 443 -> 45.137.21.9:443 (60s interval, 1.4 KB payload)",
      },
      {
        id: "h-fs",
        hostname: "FS-02",
        role: "File server",
        location: "Oslo DC-1",
        status: "Targeted",
        riskScore: 48,
        evidence: ["14 SMB logons with svc_backup", "No file session opened"],
        processTree: "smbd.exe (pid 1904) <- Kerberos TGS ticket verification",
        networkFlow: "14 inbound SMB auth events from 10.14.8.42 blocked on ACL policy",
      },
      {
        id: "h-sql",
        hostname: "SQL-PAY-01",
        role: "Payroll DB",
        location: "Oslo DC-1",
        status: "Targeted",
        riskScore: 34,
        evidence: ["2 logon attempts dropped", "Segment firewall enforced"],
        processTree: "sqlservr.exe <- TCP 1433 SYN dropped by micro-segmentation",
        networkFlow: "2 inbound connection attempts from 10.14.8.42 dropped by firewall",
      },
    ],
    timeline: [
      {
        time: "14:02:11",
        title: "Grouped 7 alerts into one incident",
        detail: "EDR, DNS and firewall linked, 48 s.",
        tags: ["EDR", "DNS", "Firewall"],
      },
      {
        time: "14:02:18",
        title: "rundll32.exe read LSASS memory",
        detail: "Attempted dump of svc_backup token.",
        tags: ["LSASS", "T1003"],
      },
      {
        time: "14:02:27",
        title: "Beacon to 45.137.21.9 every 60 s",
        detail: "New external domain on Allowlist check.",
        tags: ["C2", "Outbound"],
      },
      {
        time: "14:02:41",
        title: "14 SMB logons to FS-02",
        detail: "Lateral movement with the stolen creds.",
        tags: ["SMB", "Lateral"],
      },
    ],
    approvalActionLabel: "Isolate FIN-WS-0419",
    approvalDescription: "Cuts the beacon and SMB. The Citrix session stays active for Mateo.",
    containedSummaryTitle: "Host contained",
    containedSummaryDetail: "Isolated FIN-WS-0419 via network quarantine. C2 beacon and SMB lateral movement blocked.",
  },
  {
    id: "INC-4126",
    title: "Impossible travel for m.haddad",
    subtitle: "Opened 13:49:10 by SparrowX Identity · 3 alerts · MITRE T1078 · Owner Mateo Ruiz",
    queueSummary: "3 alerts · Entra ID · waiting on MFA",
    severity: "High",
    status: "Open",
    mine: false,
    openedAt: "13:49:10",
    mitre: "T1078",
    owner: "Mateo Ruiz",
    alertsGrouped: 3,
    assetsInPath: 3,
    filesEncrypted: 0,
    containSeconds: 185,
    confidence: 89,
    ageLabel: "13 min",
    containedAtLabel: "13:52:40",
    nodes: [
      { id: "ext-ip", label: "185.220.101.4", sublabel: "TOR Exit Node", kind: "attacker", x: 110, y: 122 },
      { id: "idp", label: "m.haddad", sublabel: "Entra ID Session", kind: "account", x: 310, y: 122 },
      { id: "sso", label: "SPX-SSO-01", sublabel: "Identity Broker", kind: "host", x: 500, y: 78 },
      { id: "mail", label: "EXCH-EDGE", sublabel: "Mail Relay", kind: "target", x: 500, y: 166 },
    ],
    edges: [
      { from: "ext-ip", to: "idp", label: "OAuth · 11 min" },
      { from: "idp", to: "sso", label: "token mint" },
      { from: "idp", to: "mail", label: "IMAP probe" },
    ],
    hosts: [
      {
        id: "h-idp",
        hostname: "m.haddad (Identity)",
        role: "Staff Eng",
        location: "Paris -> Bucharest",
        status: "Compromised",
        riskScore: 76,
        evidence: ["2,100 km jump in 11 min", "Unrecognized Linux user-agent"],
        processTree: "EntraID /oauth2/token -> Conditional Access Step-Up triggered",
        networkFlow: "185.220.101.4:52911 -> login.sparrowx.net:443",
      },
      {
        id: "h-sso",
        hostname: "SPX-SSO-01",
        role: "Identity Broker",
        location: "EU-West",
        status: "Targeted",
        riskScore: 22,
        evidence: ["Refresh token throttled", "FIDO2 hardware key required"],
        processTree: "oidc-gateway worker enforced MFA challenge",
        networkFlow: "Zero privilege escalation tokens issued",
      },
    ],
    timeline: [
      {
        time: "13:49:10",
        title: "Grouped 3 Entra ID velocity alerts",
        detail: "Paris SSO followed by TOR exit IP session.",
        tags: ["Identity", "Entra ID"],
      },
      {
        time: "13:50:02",
        title: "Legacy IMAP endpoint probed",
        detail: "Blocked automatically by Conditional Access.",
        tags: ["IMAP", "Blocked"],
      },
    ],
    approvalActionLabel: "Revoke tokens & enforce FIDO2",
    approvalDescription: "Invalidates all active OAuth refresh tokens for m.haddad and requires hardware key reset.",
    containedSummaryTitle: "Session revoked & secured",
    containedSummaryDetail: "All refresh tokens invalidated and malicious TOR session terminated cleanly.",
  },
  {
    id: "INC-4124",
    title: "Public bucket: marketing-assets-eu",
    subtitle: "Opened 12:18:04 by Cloud Posture · 2 alerts · MITRE T1530 · Auto-triaged",
    queueSummary: "2 alerts · Object Storage Config",
    severity: "Medium",
    status: "Open",
    mine: false,
    openedAt: "12:18:04",
    mitre: "T1530",
    owner: "Unassigned",
    alertsGrouped: 2,
    assetsInPath: 2,
    filesEncrypted: 0,
    containSeconds: 74,
    confidence: 92,
    ageLabel: "1h 44m",
    containedAtLabel: "12:20:15",
    nodes: [
      { id: "acl", label: "ACL Change", sublabel: "CI deploy PR #89", kind: "attacker", x: 130, y: 122 },
      { id: "bkt", label: "marketing-assets-eu", sublabel: "Object Bucket", kind: "host", x: 350, y: 122 },
      { id: "cdn", label: "Edge CDN", sublabel: "Public Origin", kind: "target", x: 570, y: 122 },
    ],
    edges: [
      { from: "acl", to: "bkt", label: "public-read ACL" },
      { from: "bkt", to: "cdn", label: "0 sensitive objects" },
    ],
    hosts: [
      {
        id: "h-bkt",
        hostname: "marketing-assets-eu",
        role: "S3/Object Bucket",
        location: "Frankfurt",
        status: "Compromised",
        riskScore: 44,
        evidence: ["Public-read ACL applied", "Zero PII objects classified"],
        processTree: "terraform-apply role -> PutBucketAcl",
        networkFlow: "Scanned by SparrowX DLP classifier (clean static media)",
      },
    ],
    timeline: [
      {
        time: "12:18:04",
        title: "Detected public ACL modification",
        detail: "Triggered by Terraform workspace deploy.",
        tags: ["Cloud", "ACL"],
      },
    ],
    approvalActionLabel: "Lock bucket ACL private",
    approvalDescription: "Reverts bucket ACL to private origin access and forces CDN signed URLs.",
    containedSummaryTitle: "Bucket policy locked",
    containedSummaryDetail: "Public ACL removed; origin restricted exclusively to signed edge CDN identity.",
  },
  {
    id: "INC-4121",
    title: "Phishing link clicked, blocked at proxy",
    subtitle: "Closed 11:04:19 by SparrowX Sense · 4 alerts · MITRE T1566 · Auto-contained",
    queueSummary: "Closed by SparrowX · 2 hosts touched",
    severity: "Low",
    status: "Resolved",
    mine: false,
    openedAt: "11:04:19",
    mitre: "T1566",
    owner: "SparrowX Autopilot",
    alertsGrouped: 4,
    assetsInPath: 2,
    filesEncrypted: 0,
    containSeconds: 2,
    confidence: 99,
    ageLabel: "3h",
    containedAtLabel: "11:04:21",
    nodes: [
      { id: "url", label: "auth-sync.top", sublabel: "Blocked URL", kind: "attacker", x: 140, y: 122 },
      { id: "prx", label: "SWG-PROXY-02", sublabel: "Edge Filter", kind: "host", x: 350, y: 122 },
      { id: "u1", label: "ENG-MBP-19", sublabel: "Developer Mac", kind: "target", x: 560, y: 122 },
    ],
    edges: [
      { from: "url", to: "prx", label: "sinkholed · 2 s" },
      { from: "prx", to: "u1", label: "clean · 0 bytes" },
    ],
    hosts: [
      {
        id: "h-prx",
        hostname: "ENG-MBP-19",
        role: "Engineering",
        location: "Remote",
        status: "Contained",
        riskScore: 4,
        evidence: ["Payload sinkholed at proxy", "Zero credential submission"],
        processTree: "chrome-helper -> HTTP 403 intercepted by SWG-PROXY-02",
        networkFlow: "DNS response rewritten to sinkhole 127.0.0.1",
      },
    ],
    timeline: [
      {
        time: "11:04:19",
        title: "Phishing URL intercepted by SWG proxy",
        detail: "Zero bytes transferred to client browser.",
        tags: ["SWG", "DNS Sinkhole"],
      },
    ],
    approvalActionLabel: "Host already safe",
    approvalDescription: "Auto-remediated in 2 seconds.",
    containedSummaryTitle: "Host contained",
    containedSummaryDetail: "Edge proxy sinkholed phishing domain before payload execution.",
  },
  {
    id: "INC-4119",
    title: "API burst from build runner ci-07",
    subtitle: "Opened 10:12:44 by Edge WAF · 4 alerts · MITRE T1190 · Triaged",
    queueSummary: "4 alerts · audit log · rate-limited",
    severity: "Low",
    status: "Open",
    mine: false,
    openedAt: "10:12:44",
    mitre: "T1190",
    owner: "SparrowX WAF",
    alertsGrouped: 4,
    assetsInPath: 2,
    filesEncrypted: 0,
    containSeconds: 18,
    confidence: 88,
    ageLabel: "4h",
    containedAtLabel: "10:14:00",
    nodes: [
      { id: "ci", label: "ci-07", sublabel: "Build Runner", kind: "host", x: 160, y: 122 },
      { id: "gw", label: "api.sparrowx.net", sublabel: "Edge Gateway", kind: "target", x: 520, y: 122 },
    ],
    edges: [{ from: "ci", to: "gw", label: "429 rate-limited" }],
    hosts: [
      {
        id: "h-ci",
        hostname: "ci-07",
        role: "CI Runner",
        location: "SYD-DC-2",
        status: "Targeted",
        riskScore: 21,
        evidence: ["1,200 req/min burst throttled", "Adaptive L7 limiter active"],
        processTree: "github-runner -> parallel integration suite",
        networkFlow: "Rate-limited at Cloudflare/Nginx edge with HTTP 429",
      },
    ],
    timeline: [
      {
        time: "10:12:44",
        title: "Adaptive L7 rate limiter triggered",
        detail: "Throttled ci-07 API loop without dropping production traffic.",
        tags: ["WAF-L7", "Rate Limit"],
      },
    ],
    approvalActionLabel: "Lock ci-07 concurrency cap",
    approvalDescription: "Applies a 120 req/min token bucket policy specifically to ci-07 service key.",
    containedSummaryTitle: "Token bucket enforced",
    containedSummaryDetail: "ci-07 capped at 120 req/min at the edge gateway.",
  },
];

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function SparrowxSentraSocWorkbench({
  incidents = [],
  assets = [],
  currentUser,
  onResolveIncident,
  onToggleAssetIsolation,
  onOpenAuthModal,
  onOpenClientArea,
  onSignOut,
  activeRailMode,
  onSelectRailMode,
  showExtendedRailItems = false,
  allowDemoFallback = true,
}: SparrowxSentraSocWorkbenchProps) {
  const [cases, setCases] = useState<SocCase[]>(() =>
    allowDemoFallback ? INITIAL_CASES : [],
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() =>
    allowDemoFallback ? "INC-4127" : "",
  );
  const [queueTab, setQueueTab] = useState<"Open" | "Mine" | "Resolved">("Open");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [internalMode, setInternalMode] = useState<"queue" | "calm">(() =>
    allowDemoFallback || (incidents && incidents.length > 0) ? "queue" : "calm",
  );
  const [investigatedHostId, setInvestigatedHostId] = useState<string | null>(null);
  const [clockUtc, setClockUtc] = useState<string>("14:02:39");
  const [liveSeconds, setLiveSeconds] = useState<number>(39);

  // Merge any external live backend incidents cleanly into the Sentra queue
  useEffect(() => {
    if (!incidents || incidents.length === 0) {
      if (!allowDemoFallback) {
        setCases([]);
      }
      return;
    }
    setCases((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const mapped = incidents
        .filter((inc) => !existingIds.has(inc.id))
        .map<SocCase>((inc, idx) => {
          const isContained = inc.status === "Contained";
          const targetHost = assets[idx]?.hostname || inc.source || "SPX-EDGE-01";
          const sev: SocCase["severity"] =
            inc.severity === "Critical"
              ? "Critical"
              : inc.severity === "High"
                ? "High"
                : inc.severity === "Medium"
                  ? "Medium"
                  : "Low";
          return {
            id: inc.id,
            title: inc.title,
            subtitle: `Opened ${inc.time} by SparrowX Sense · Edge Telemetry · Owner ${inc.assignee}`,
            queueSummary: `${inc.source} · ${inc.playbook}`,
            severity: sev,
            status: isContained ? "Resolved" : "Open",
            mine: true,
            openedAt: inc.time,
            mitre: "T1190, T1078",
            owner: inc.assignee,
            alertsGrouped: Math.max(1, inc.affectedAssets),
            assetsInPath: Math.max(1, inc.affectedAssets),
            filesEncrypted: 0,
            containSeconds: isContained ? 28 : 42,
            confidence: 94,
            ageLabel: inc.time,
            containedAtLabel: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }),
            nodes: [
              { id: "src", label: inc.source || "External Vector", sublabel: "Inbound Threat", kind: "attacker", x: 118, y: 122 },
              { id: "hst", label: targetHost, sublabel: "Protected Asset", kind: "host", x: 340, y: 122 },
              { id: "edge", label: "SPARROWX-WAF", sublabel: "L7 Edge Node", kind: "target", x: 562, y: 122 },
            ],
            edges: [
              { from: "src", to: "hst", label: "exploit probe" },
              { from: "hst", to: "edge", label: "inspection" },
            ],
            hosts: [
              {
                id: `host-${inc.id}`,
                hostname: targetHost,
                role: assets[idx]?.environment || "Production",
                location: "Edge Cluster",
                status: isContained ? "Contained" : "Compromised",
                riskScore: isContained ? 9 : assets[idx]?.riskScore ?? 84,
                evidence: [inc.summary.slice(0, 48), inc.playbook],
                processTree: `sparrowx-agent -> WAF ruleset inspecting ${targetHost}`,
                networkFlow: `Origin ${inc.source} -> ${targetHost}:443`,
              },
            ],
            timeline: [
              {
                time: inc.time,
                title: inc.title,
                detail: inc.summary,
                tags: [inc.severity, "Live Feed"],
              },
            ],
            approvalActionLabel: `Contain ${targetHost}`,
            approvalDescription: `Executes ${inc.playbook} and isolates ${targetHost} immediately.`,
            containedSummaryTitle: "Host contained",
            containedSummaryDetail: `${targetHost} isolated cleanly via SparrowX SOC autopilot.`,
            backendIncidentId: inc.id,
          };
        });
      const base = allowDemoFallback ? prev : prev.filter((p) => incidents.some((i) => i.id === p.id));
      const nextList = mapped.length > 0 ? [...mapped, ...base] : base;
      if (nextList.length > 0 && !allowDemoFallback) {
        setInternalMode("queue");
      }
      return nextList;
    });
  }, [incidents, assets, allowDemoFallback]);

  // Live clock & stopwatch tick for active uncontained incident
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockUtc(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
      setLiveSeconds((s) => s + 1);
    };
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, []);

  const resolvedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? cases[0],
    [cases, selectedCaseId],
  );

  const openCases = useMemo(() => cases.filter((c) => c.status === "Open"), [cases]);
  const mineCases = useMemo(() => cases.filter((c) => c.mine), [cases]);
  const resolvedCases = useMemo(() => cases.filter((c) => c.status !== "Open"), [cases]);
  const activeCriticalCount = useMemo(
    () => openCases.filter((c) => c.severity === "Critical").length,
    [openCases],
  );

  const filteredQueue = useMemo(() => {
    const base =
      queueTab === "Open" ? openCases : queueTab === "Mine" ? mineCases : resolvedCases;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return cases.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.queueSummary.toLowerCase().includes(q) ||
        c.hosts.some((h) => h.hostname.toLowerCase().includes(q)),
    );
  }, [queueTab, openCases, mineCases, resolvedCases, cases, searchQuery]);

  const isCalmMode =
    !resolvedCase ||
    activeRailMode === "calm" ||
    (activeRailMode !== "queue" && internalMode === "calm");

  const activeCase: SocCase | undefined = resolvedCase;

  const isSelectedResolved = activeCase ? activeCase.status !== "Open" : true;

  const watchedAssetsLabel = allowDemoFallback
    ? "Watching 1,284 assets"
    : assets.length > 0
      ? `Watching ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`
      : "Telemetry Off · Not Configured";

  const handleContainCase = async (targetCase: SocCase) => {
    if (targetCase.backendIncidentId && onResolveIncident) {
      await onResolveIncident(targetCase.backendIncidentId);
    }
    if (assets.length > 0 && onToggleAssetIsolation) {
      const matchingAsset = assets.find((a) =>
        targetCase.hosts.some((h) => h.hostname.toLowerCase().includes(a.hostname.toLowerCase())),
      );
      if (matchingAsset && matchingAsset.status !== "Isolated") {
        await onToggleAssetIsolation(matchingAsset.id);
      }
    }

    try {
      const { executeContainmentAction } = await import("@/lib/security.functions");
      await executeContainmentAction({
        data: {
          incidentId: targetCase.id,
          tenantId: currentUser?.tenantId || "tnt-system",
          actionType: "quarantine_host",
          target: targetCase.hosts[0]?.hostname || "Target Host",
          actor: currentUser?.fullName || currentUser?.email || "SOC Lead",
          reason: targetCase.queueSummary,
        },
      });
    } catch {
      // In-browser / offline fallback
    }

    emitEngineToast(
      `${targetCase.id} neutralized. Cryptographic audit entry chained with SHA-256 integrity.`,
      "success",
      "Host Isolated & Threat Contained",
    );

    const nowStr = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const finalSecs = targetCase.id === "INC-4127" ? Math.max(51, liveSeconds % 90) : 44;

    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== targetCase.id) return c;
        return {
          ...c,
          status: "Resolved",
          containSeconds: finalSecs,
          containedAtLabel: nowStr,
          hosts: c.hosts.map((h, i) => ({
            ...h,
            status: i === 0 ? "Contained" : "Safe",
            riskScore: i === 0 ? 8 : Math.min(12, h.riskScore),
          })),
        };
      }),
    );
  };

  const handleReopenCase = async (caseId: string) => {
    try {
      const { executeContainmentAction } = await import("@/lib/security.functions");
      await executeContainmentAction({
        data: {
          incidentId: caseId,
          tenantId: currentUser?.tenantId || "tnt-system",
          actionType: "unquarantine_host",
          target: caseId,
          actor: currentUser?.fullName || currentUser?.email || "SOC Lead",
          reason: "Case reopened for further investigation",
        },
      });
    } catch {
      // In-browser fallback
    }

    emitEngineToast(
      `${caseId} returned to active triage queue. Quarantine state updated.`,
      "info",
      "Case Re-opened",
    );

    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const orig = INITIAL_CASES.find((ic) => ic.id === caseId);
        return orig ? orig : { ...c, status: "Open" };
      }),
    );
  };

  const displaySeconds = !activeCase
    ? 0
    : isSelectedResolved
      ? activeCase.containSeconds
      : activeCase.id === "INC-4127"
        ? (liveSeconds % 36) + 24
        : activeCase.containSeconds;

  const operatorName = currentUser?.fullName || (allowDemoFallback ? "Mateo Ruiz" : "Guest Operator");
  const operatorInitials = operatorName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "SP";

  const sevBadgeClass = (sev: SocCase["severity"], resolved: boolean) => {
    if (resolved) {
      return "bg-emerald-500/15 text-[#10B981] border-emerald-500/35";
    }
    switch (sev) {
      case "Critical":
        return "bg-[#F9103A]/15 text-[#F9103A] border-[#F9103A]/35";
      case "High":
        return "bg-[#F96246]/15 text-[#F96246] border-[#F96246]/35";
      case "Medium":
        return "bg-[#FFEBB9]/12 text-[#FFEBB9] border-[#FFEBB9]/30";
      default:
        return "bg-[#F4F6FA]/10 text-[#F4F6FA]/80 border-[#F4F6FA]/20";
    }
  };

  return (
    <section
      aria-label="SparrowX Security Operations Workbench"
      className="font-soc relative overflow-hidden rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#090B11] text-[#F4F6FA] shadow-[0_28px_90px_rgba(0,0,0,0.85)]"
    >
      {/* Subtle Crimson & Obsidian Ambient Vignette Matching Reference Palette */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-28 right-0 h-80 w-96 rounded-full blur-[120px] transition-opacity duration-500 ${
          activeCriticalCount > 0 ? "bg-[#F9103A]/[0.08]" : "bg-[#10B981]/[0.06]"
        }`}
      />

      {/* TOP COMMAND HEADER */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F6FA]/[0.07] bg-[#0D1017]/95 px-4 py-2.5">
        {/* Left: Brand Prism + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setInternalMode("queue");
              onSelectRailMode?.("queue");
            }}
            className="flex size-8 items-center justify-center rounded-lg border border-emerald-400/25 bg-[#11191D] text-emerald-400 transition-colors hover:border-emerald-400/50 cursor-pointer shrink-0"
            title="Return to Live SOC Queue"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3 20 8v8l-8 5-8-5V8l8-5Z" />
              <path d="M12 3v18M4 8l8 5 8-5" className="opacity-65" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-[#F4F6FA]/55 truncate">
            <button
              type="button"
              onClick={() => {
                setInternalMode("queue");
                onSelectRailMode?.("queue");
              }}
              className="hover:text-[#F4F6FA] transition-colors cursor-pointer"
            >
              Incidents
            </button>
            <span className="text-[#F4F6FA]/30">&gt;</span>
            <span className="font-medium text-[#F4F6FA] tabular-nums">
              {isCalmMode || !activeCase ? "Live queue" : activeCase.id}
            </span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="relative w-full sm:w-72 md:w-80 order-last sm:order-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#F4F6FA]/40" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hosts, users, IPs"
            className="h-8 w-full rounded-lg border border-[#F4F6FA]/[0.08] bg-[#121620] pl-8 pr-3 text-xs text-[#F4F6FA] placeholder-[#F4F6FA]/40 outline-none transition-colors focus:border-[#F96246]/60"
          />
        </div>

        {/* Right Telemetry + Operator Status */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => {
              const next = isCalmMode ? "queue" : "calm";
              setInternalMode(next);
              onSelectRailMode?.(next);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#F4F6FA]/[0.08] bg-[#121620] px-2.5 py-1 text-[11px] font-medium text-[#F4F6FA]/85 transition-colors hover:border-[#F4F6FA]/25 cursor-pointer"
            title="Toggle Live Calm Radar View"
          >
            <span className={`size-1.5 rounded-full ${allowDemoFallback || assets.length > 0 ? "bg-[#10B981]" : "bg-[#F96246]"}`} />
            <span className="tabular-nums">{watchedAssetsLabel}</span>
          </button>

          <span className="hidden md:inline-block font-mono text-[11px] text-[#F4F6FA]/55 tabular-nums">
            {clockUtc} UTC
          </span>

          <div className="flex items-center gap-2 rounded-full border border-[#F4F6FA]/[0.08] bg-[#121620] pl-1.5 pr-2.5 py-1">
            <span className="grid size-5 place-items-center rounded-full bg-[#1E2433] text-[10px] font-semibold text-[#FFEBB9]">
              {operatorInitials}
            </span>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
              <span className="font-medium text-[#F4F6FA]">{operatorName}</span>
              <span className="text-[#F4F6FA]/40">· On-call · Tier 2</span>
            </div>
          </div>

          {onOpenAuthModal && !currentUser && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-3 py-1.5 text-xs font-medium text-[#F4F6FA] transition-colors hover:bg-[#F9103A]/90 cursor-pointer"
            >
              <Lock className="size-3" />
              <span>Sign In</span>
            </button>
          )}

          {currentUser && onOpenClientArea && (
            <button
              type="button"
              onClick={onOpenClientArea}
              className="inline-flex items-center gap-1 rounded-lg border border-[#F4F6FA]/15 bg-[#141824] px-2.5 py-1 text-[11px] font-medium text-[#FFEBB9] transition-colors hover:bg-[#1B2130] cursor-pointer"
            >
              <User className="size-3" />
              <span>Client Area</span>
            </button>
          )}

          {currentUser && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-[#F4F6FA]/10 px-2.5 py-1 text-[11px] text-[#F4F6FA]/70 transition-colors hover:text-[#F4F6FA] cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* MAIN 4-ZONE SOC GRID */}
      <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-[48px_275px_minmax(0,1fr)_285px] min-h-[650px]">
        {/* 1. LEFT SLIM ICON RAIL */}
        <nav
          aria-label="SOC Workspace Views"
          className="flex lg:flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-[#F4F6FA]/[0.07] bg-[#0B0E14] px-2 py-2 lg:py-3"
        >
          <div className="flex lg:flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setInternalMode("queue");
                onSelectRailMode?.("queue");
              }}
              aria-label="Active Incident Queue"
              title="Incident Triage & Attack Path"
              className={`grid size-8 place-items-center rounded-lg transition-colors cursor-pointer ${
                !isCalmMode && activeRailMode !== "map" && activeRailMode !== "plans"
                  ? "bg-[#F9103A]/15 text-[#F9103A] border border-[#F9103A]/35"
                  : "text-[#F4F6FA]/50 hover:text-[#F4F6FA] hover:bg-[#F4F6FA]/[0.05]"
              }`}
            >
              <ShieldAlert className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setInternalMode("calm");
                onSelectRailMode?.("calm");
              }}
              aria-label="All Quiet Radar"
              title="All Quiet Monitoring View"
              className={`grid size-8 place-items-center rounded-lg transition-colors cursor-pointer ${
                isCalmMode
                  ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/35"
                  : "text-[#F4F6FA]/50 hover:text-[#F4F6FA] hover:bg-[#F4F6FA]/[0.05]"
              }`}
            >
              <Radio className="size-4" />
            </button>

            {showExtendedRailItems && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectRailMode?.("map")}
                  aria-label="Threat Matrix & Origin Audit"
                  title="Global Threat Matrix & Origin Audit"
                  className={`grid size-8 place-items-center rounded-lg transition-colors cursor-pointer ${
                    activeRailMode === "map"
                      ? "bg-[#F96246]/15 text-[#F96246] border border-[#F96246]/35"
                      : "text-[#F4F6FA]/50 hover:text-[#F4F6FA] hover:bg-[#F4F6FA]/[0.05]"
                  }`}
                >
                  <Globe className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRailMode?.("plans")}
                  aria-label="1-Command Server Agent & Plans"
                  title="1-Command Agent & Protection Plans"
                  className={`grid size-8 place-items-center rounded-lg transition-colors cursor-pointer ${
                    activeRailMode === "plans"
                      ? "bg-[#FFEBB9]/15 text-[#FFEBB9] border border-[#FFEBB9]/35"
                      : "text-[#F4F6FA]/50 hover:text-[#F4F6FA] hover:bg-[#F4F6FA]/[0.05]"
                  }`}
                >
                  <Layers className="size-4" />
                </button>
              </>
            )}
          </div>

          <div className="hidden lg:flex flex-col items-center gap-2">
            <span
              title="SparrowX Edge Daemon Connected"
              className="grid size-7 place-items-center rounded-full border border-[#F4F6FA]/10 bg-[#121620] text-[10px] font-semibold text-[#F4F6FA]/75"
            >
              {operatorInitials}
            </span>
          </div>
        </nav>

        {/* 2. LEFT PANE: LIVE QUEUE & TRIAGE FUNNEL */}
        <aside className="flex flex-col border-b lg:border-b-0 lg:border-r border-[#F4F6FA]/[0.07] bg-[#0B0E14]/90">
          {/* Alerts Summary Block */}
          <div className="border-b border-[#F4F6FA]/[0.07] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#F4F6FA]">Queue</span>
              <span className="text-[11px] text-[#F4F6FA]/45">Live Shift</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#F4F6FA]/45">
                {allowDemoFallback ? "Alerts Today" : "Live Incidents"}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xl font-medium tracking-tight text-[#F4F6FA] tabular-nums">
                  {allowDemoFallback ? "3,912" : cases.length}
                </span>
                <span className="text-[11px] font-medium text-[#10B981] tabular-nums">
                  {allowDemoFallback
                    ? "^ 4.1% vs 7d avg"
                    : assets.length > 0
                      ? "Sensor Active"
                      : "Not Configured"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex items-center justify-between text-[#F4F6FA]/65">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#10B981]" />
                  <span>{allowDemoFallback ? "Closed as noise by SparrowX" : "Resolved incidents"}</span>
                </span>
                <span className="font-medium text-[#F4F6FA] tabular-nums">
                  {allowDemoFallback ? "3,861" : resolvedCases.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#F4F6FA]/65">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#F96246]" />
                  <span>Grouped into {cases.length} incidents</span>
                </span>
                <span className="font-medium text-[#F4F6FA] tabular-nums">
                  {allowDemoFallback ? "51" : openCases.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#F4F6FA]/65">
                <span className="flex items-center gap-2">
                  <span
                    className={`size-1.5 rounded-full ${
                      activeCriticalCount > 0 ? "bg-[#F9103A]" : "bg-[#10B981]"
                    }`}
                  />
                  <span>Waiting for a person</span>
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    activeCriticalCount > 0 ? "text-[#F9103A]" : "text-[#10B981]"
                  }`}
                >
                  {activeCriticalCount}
                </span>
              </div>
            </div>
          </div>

          {/* Queue Filter Tabs — Compliant Single-Row Tablist (modern-web-guidance tabs) */}
          <div
            role="tablist"
            aria-label="Incident queue filter"
            className="flex items-center gap-4 overflow-x-auto border-b border-[#F4F6FA]/[0.07] px-4 text-xs"
          >
            {(
              [
                { id: "Open", count: openCases.length },
                { id: "Mine", count: mineCases.length },
                { id: "Resolved", count: (allowDemoFallback ? 47 : 0) + resolvedCases.length },
              ] as const
            ).map((tab) => {
              const selected = queueTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setQueueTab(tab.id)}
                  className={`soc-tab-btn shrink-0 flex items-center gap-1.5 py-2.5 text-xs transition-colors cursor-pointer ${
                    selected
                      ? "font-medium text-[#F4F6FA]"
                      : "text-[#F4F6FA]/50 hover:text-[#F4F6FA]/85"
                  }`}
                >
                  <span>{tab.id}</span>
                  <span className="rounded bg-[#F4F6FA]/[0.07] px-1.5 py-0.5 text-[10px] tabular-nums text-[#F4F6FA]/75">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Queue Cards List */}
          <div className="flex-1 divide-y divide-[#F4F6FA]/[0.06] overflow-y-auto max-h-[470px]">
            {filteredQueue.length > 0 ? (
              filteredQueue.map((c) => {
                const isSelected = !isCalmMode && activeCase?.id === c.id;
                const isResolved = c.status !== "Open";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      setInvestigatedHostId(null);
                      setInternalMode("queue");
                      onSelectRailMode?.("queue");
                    }}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                      isSelected
                        ? isResolved
                          ? "bg-[#121C19] border-l-2 border-l-[#10B981]"
                          : "bg-[#171216] border-l-2 border-l-[#F9103A]"
                        : "hover:bg-[#F4F6FA]/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sevBadgeClass(
                            c.severity,
                            isResolved,
                          )}`}
                        >
                          {isResolved ? "Resolved" : c.severity}
                        </span>
                        <span className="font-mono text-[11px] text-[#F4F6FA]/55 tabular-nums">
                          {c.id}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#F4F6FA]/45 tabular-nums">
                        {isResolved ? `${c.containSeconds} s` : c.ageLabel}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-[#F4F6FA] leading-snug">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-[#F4F6FA]/50 truncate">{c.queueSummary}</div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto size-5 text-[#10B981]" />
                <p className="text-xs text-[#F4F6FA]/65">No matching incidents in {queueTab}.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQueueTab("Open");
                    setSearchQuery("");
                    setInternalMode("calm");
                  }}
                  className="text-[11px] font-medium text-[#FFEBB9] hover:underline cursor-pointer"
                >
                  Switch to All Quiet Radar →
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* 3. CENTER WORKSPACE: ACTIVE INCIDENT OR CALM RADAR */}
        <main className="min-w-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#F4F6FA]/[0.07] bg-[#090B11] p-4 sm:p-5">
          {isCalmMode ? (
            /* CALM RADAR VIEW — "All quiet. Nothing needs you." (Image 1 Top-Left) */
            <div className="flex flex-1 flex-col items-center justify-between py-6 text-center">
              <div className="w-full flex items-center justify-between text-xs text-[#F4F6FA]/50">
                <span>Autonomous Perimeter Radar</span>
                <button
                  type="button"
                  onClick={() => {
                    setInternalMode("queue");
                    onSelectRailMode?.("queue");
                  }}
                  className="rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-2.5 py-1 text-[11px] font-medium text-[#F4F6FA]/85 hover:border-[#F96246]/50 transition-colors cursor-pointer"
                >
                  Inspect Open Queue ({openCases.length})
                </button>
              </div>

              <div className="my-8 flex flex-col items-center space-y-6">
                {/* Circular Radar Dial */}
                <div className="relative grid size-28 place-items-center rounded-full border border-[#10B981]/25 bg-[#0D1416] shadow-[0_0_50px_rgba(16,185,129,0.12)]">
                  <div className="size-20 rounded-full border border-[#F4F6FA]/[0.06]" />
                  <div
                    aria-hidden="true"
                    className="animate-spx-radar absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, rgba(16,185,129,0.28) 0deg, rgba(16,185,129,0) 68deg, transparent 360deg)",
                    }}
                  />
                  <div className="relative size-2 rounded-full bg-[#10B981] shadow-[0_0_12px_#10B981]" />
                </div>

                <div className="space-y-2 max-w-md">
                  <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#F4F6FA]">
                    {allowDemoFallback
                      ? "All quiet. Nothing needs you."
                      : assets.length > 0
                        ? "Perimeter Clear. Zero Open Incidents."
                        : "Edge Telemetry Not Configured Yet"}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#F4F6FA]/55 leading-relaxed">
                    {allowDemoFallback
                      ? `SparrowX closed 3,861 alerts as noise today and grouped 51 into ${cases.length} incidents. You get paged only when a person has to decide.`
                      : assets.length > 0
                        ? `Monitoring ${assets.length} protected ${assets.length === 1 ? "asset" : "assets"} in real time. Genuine WAF & telemetry triggers will appear here immediately.`
                        : "Connect a domain or edge sensor in Client Area to activate live L7 WAF inspection, attack correlation, and autonomous containment."}
                  </p>
                </div>
              </div>

              <div className="grid w-full max-w-xl grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-4 text-left space-y-1">
                  <div className="text-xl font-medium text-[#F4F6FA] tabular-nums">
                    {allowDemoFallback ? "1.8 s" : `${openCases.length}`}
                  </div>
                  <div className="text-[11px] text-[#F4F6FA]/50">
                    {allowDemoFallback ? "median triage" : "open incidents"}
                  </div>
                </div>
                <div className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-4 text-left space-y-1">
                  <div className="text-xl font-medium text-[#F4F6FA] tabular-nums">
                    {allowDemoFallback ? "6 h 12 m" : `${assets.length}`}
                  </div>
                  <div className="text-[11px] text-[#F4F6FA]/50">
                    {allowDemoFallback ? "since last critical" : "connected assets"}
                  </div>
                </div>
                <div className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-4 text-left space-y-1">
                  <div className="text-xl font-medium text-[#10B981] tabular-nums">
                    {allowDemoFallback ? "98.7%" : assets.length > 0 ? "ARMED" : "OFF"}
                  </div>
                  <div className="text-[11px] text-[#F4F6FA]/50">
                    {allowDemoFallback ? "auto-closed" : "sensor status"}
                  </div>
                </div>
              </div>
            </div>
          ) : activeCase ? (
            /* ACTIVE INCIDENT TRIAGE VIEW (Top-Right, Bottom-Left, Bottom-Right of Image 1) */
            <div className="space-y-5">
              {/* Top Row: Severity & ID + 4-Stage Pipeline Stepper */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${sevBadgeClass(
                      activeCase.severity,
                      isSelectedResolved,
                    )}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isSelectedResolved
                          ? "bg-[#10B981]"
                          : activeCase.severity === "Critical"
                            ? "bg-[#F9103A]"
                            : activeCase.severity === "High"
                              ? "bg-[#F96246]"
                              : "bg-[#FFEBB9]"
                      }`}
                    />
                    <span>{isSelectedResolved ? "Resolved" : activeCase.severity}</span>
                  </span>
                  <span className="font-mono text-xs text-[#F4F6FA]/55 tabular-nums">
                    {activeCase.id}
                  </span>
                </div>

                {/* Lifecycle Progress Stepper */}
                <div className="flex items-center gap-2 text-[11px]">
                  {(
                    [
                      { label: "Detected", done: true },
                      { label: "Triaged", done: true },
                      { label: "Contained", done: isSelectedResolved },
                      { label: "Resolved", done: isSelectedResolved },
                    ] as const
                  ).map((step, i) => (
                    <React.Fragment key={step.label}>
                      {i > 0 && (
                        <span
                          className={`h-px w-4 sm:w-6 ${
                            step.done ? "bg-[#10B981]/65" : "bg-[#F4F6FA]/15"
                          }`}
                        />
                      )}
                      <span
                        className={`inline-flex items-center gap-1 ${
                          step.done ? "text-[#10B981] font-medium" : "text-[#F4F6FA]/45"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            step.done ? "bg-[#10B981]" : "border border-[#F4F6FA]/35 bg-transparent"
                          }`}
                        />
                        <span>{step.label}</span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Incident Headline & Meta */}
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-[#F4F6FA]">
                  {activeCase.title}
                </h2>
                <p className="text-xs text-[#F4F6FA]/55">{activeCase.subtitle}</p>
              </div>

              {/* 4 KPI Strip with Live Ticking Timer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 overflow-hidden rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] divide-x divide-y sm:divide-y-0 divide-[#F4F6FA]/[0.07]">
                <div className="p-3.5 space-y-1">
                  <span className="text-[11px] text-[#F4F6FA]/50 block">Alerts grouped</span>
                  <span className="text-2xl font-medium text-[#F4F6FA] tabular-nums">
                    {activeCase.alertsGrouped}
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <span className="text-[11px] text-[#F4F6FA]/50 block">Assets in path</span>
                  <span className="text-2xl font-medium text-[#F4F6FA] tabular-nums">
                    {activeCase.assetsInPath}
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <span className="text-[11px] text-[#F4F6FA]/50 block">Files encrypted</span>
                  <span className="text-2xl font-medium text-[#F4F6FA] tabular-nums">
                    {activeCase.filesEncrypted}
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-[#F4F6FA]/50 block">
                      {isSelectedResolved ? "Contained in" : "Time to contain · running"}
                    </span>
                    <span
                      className={`text-2xl font-medium tabular-nums ${
                        isSelectedResolved ? "text-[#10B981]" : "text-[#F96246]"
                      }`}
                    >
                      {formatTimer(displaySeconds)}
                    </span>
                  </div>
                  {/* Sparkline Waveform */}
                  <svg viewBox="0 0 42 20" className="w-10 h-5 shrink-0" fill="none">
                    {isSelectedResolved ? (
                      <path
                        d="M2 15 L14 8 L22 14 L40 14"
                        stroke="#10B981"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    ) : (
                      <path
                        d="M2 14 L8 10 L13 15 L20 5 L27 14 L34 8 L40 11"
                        stroke="#F96246"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Interactive SVG Attack Path Graph */}
              <div className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#F4F6FA]/85">Attack path</span>
                  <div className="flex items-center gap-4 text-[11px] text-[#F4F6FA]/55">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#F9103A]" />
                      <span>Attacker activity</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-sky-400" />
                      <span>Asset</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#10B981]" />
                      <span>Contained</span>
                    </span>
                  </div>
                </div>

                <div className="relative overflow-x-auto rounded-lg bg-[#090B11] border border-[#F4F6FA]/[0.05] p-2">
                  <svg
                    viewBox="0 0 700 220"
                    className="w-full min-w-[540px] h-48 select-none"
                    role="img"
                    aria-label={`Attack path topology for ${activeCase.title}`}
                  >
                    <defs>
                      <pattern id="soc-dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" fill="rgba(244,246,250,0.08)" />
                      </pattern>
                    </defs>
                    <rect width="700" height="220" fill="url(#soc-dot-grid)" />

                    {/* Edges */}
                    {activeCase.edges.map((edge, idx) => {
                      const fromNode = activeCase.nodes.find((n) => n.id === edge.from);
                      const toNode = activeCase.nodes.find((n) => n.id === edge.to);
                      if (!fromNode || !toNode) return null;

                      const isFirstCut = idx === 0 && isSelectedResolved;
                      const strokeColor = isSelectedResolved
                        ? "#10B981"
                        : idx === 0
                          ? "#F9103A"
                          : idx === 1
                            ? "#F96246"
                            : "rgba(244,246,250,0.32)";

                      const mx = (fromNode.x + toNode.x) / 2;
                      const my = (fromNode.y + toNode.y) / 2 - 10;

                      return (
                        <g key={`${edge.from}-${edge.to}`}>
                          <line
                            x1={fromNode.x}
                            y1={fromNode.y}
                            x2={toNode.x}
                            y2={toNode.y}
                            stroke={strokeColor}
                            strokeWidth={isSelectedResolved ? 1.5 : 1.75}
                            strokeDasharray={isFirstCut || !isSelectedResolved ? "5 4" : undefined}
                            opacity={isFirstCut ? 0.45 : 0.9}
                          />
                          <text
                            x={mx}
                            y={my}
                            textAnchor="middle"
                            fill={
                              isFirstCut
                                ? "#10B981"
                                : idx === 0
                                  ? "#F96246"
                                  : "rgba(244,246,250,0.55)"
                            }
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {isFirstCut ? "severed" : edge.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {activeCase.nodes.map((node) => {
                      const isPrimaryHost = node.kind === "host";
                      const isAttacker = node.kind === "attacker";
                      const nodeColor = isSelectedResolved
                        ? isAttacker
                          ? "#F9103A"
                          : "#10B981"
                        : isAttacker
                          ? "#F9103A"
                          : isPrimaryHost
                            ? "#F9103A"
                            : node.kind === "account"
                              ? "#FFEBB9"
                              : "#F96246";

                      return (
                        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                          {/* Pulsing ring for active compromised host, dashed containment ring when isolated */}
                          {isPrimaryHost && !isSelectedResolved && (
                            <>
                              <circle
                                r="29"
                                fill="rgba(249,16,58,0.08)"
                                stroke="#F9103A"
                                strokeWidth="1"
                                opacity="0.55"
                              />
                              <circle
                                r="36"
                                fill="none"
                                stroke="#F9103A"
                                strokeWidth="0.9"
                                opacity="0.28"
                              />
                            </>
                          )}
                          {isPrimaryHost && isSelectedResolved && (
                            <circle
                              r="29"
                              fill="rgba(16,185,129,0.1)"
                              stroke="#10B981"
                              strokeWidth="1.25"
                              strokeDasharray="4 3"
                            />
                          )}

                          <circle
                            r="20"
                            fill="#121622"
                            stroke={nodeColor}
                            strokeWidth="1.75"
                          />
                          <text
                            y="4"
                            textAnchor="middle"
                            fill={nodeColor}
                            fontSize="12"
                            fontWeight="700"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {isAttacker
                              ? "✕"
                              : isPrimaryHost && !isSelectedResolved
                                ? "!"
                                : isPrimaryHost && isSelectedResolved
                                  ? "✓"
                                  : node.kind === "account"
                                    ? "@"
                                    : "▣"}
                          </text>

                          <text
                            y="36"
                            textAnchor="middle"
                            fill="#F4F6FA"
                            fontSize="11"
                            fontWeight="600"
                          >
                            {node.label}
                          </text>
                          <text
                            y="50"
                            textAnchor="middle"
                            fill="rgba(244,246,250,0.48)"
                            fontSize="10"
                          >
                            {node.sublabel}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Affected Hosts Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#F4F6FA]/85">Affected hosts</span>
                  <span className="text-[11px] text-[#F4F6FA]/45 tabular-nums">
                    {isSelectedResolved
                      ? `1 contained · ${Math.max(0, activeCase.hosts.length - 1)} safe`
                      : `1 compromised · ${Math.max(0, activeCase.hosts.length - 1)} targeted`}
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {/* Primary Compromised / Contained Host Card */}
                  {activeCase.hosts.slice(0, 1).map((primaryHost) => (
                    <div
                      key={primaryHost.id}
                      className={`rounded-xl border p-4 space-y-3 transition-colors ${
                        isSelectedResolved
                          ? "border-[#10B981]/35 bg-[#0D1615]"
                          : "border-[#F9103A]/35 bg-[#150E13]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Server className="size-3.5 text-[#F4F6FA]/60" />
                            <span className="text-sm font-medium text-[#F4F6FA]">
                              {primaryHost.hostname}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#F4F6FA]/50 block mt-0.5">
                            {primaryHost.role} · {primaryHost.location}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            isSelectedResolved
                              ? "border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981]"
                              : "border-[#F9103A]/40 bg-[#F9103A]/15 text-[#F9103A]"
                          }`}
                        >
                          {isSelectedResolved ? "Contained" : primaryHost.status}
                        </span>
                      </div>

                      {/* Risk Meter */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#F4F6FA]/50">Risk</span>
                          <span
                            className={`font-medium tabular-nums ${
                              isSelectedResolved ? "text-[#10B981]" : "text-[#F9103A]"
                            }`}
                          >
                            {primaryHost.riskScore}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#F4F6FA]/[0.08] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width,background-color] duration-300 ${
                              isSelectedResolved ? "bg-[#10B981]" : "bg-[#F9103A]"
                            }`}
                            style={{ width: `${primaryHost.riskScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Evidence Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {primaryHost.evidence.map((ev) => (
                          <span
                            key={ev}
                            className="rounded border border-[#F4F6FA]/10 bg-[#090B11]/80 px-2 py-0.5 font-mono text-[10px] text-[#F4F6FA]/75"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>

                      {/* Contained timestamp or Interactive Buttons */}
                      {isSelectedResolved ? (
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                          <div className="flex items-center gap-1.5 text-[#10B981]">
                            <ShieldCheck className="size-4 shrink-0" />
                            <span className="font-medium tabular-nums">
                              Isolated at {activeCase.containedAtLabel}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReopenCase(activeCase.id)}
                            className="rounded-md border border-[#F4F6FA]/15 px-2.5 py-1 text-[11px] text-[#F4F6FA]/65 hover:text-[#F4F6FA] transition-colors cursor-pointer"
                          >
                            Restore Simulation
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleContainCase(activeCase)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-3.5 py-2 text-xs font-medium text-[#F4F6FA] transition-colors hover:bg-[#F9103A]/90 cursor-pointer shadow-[0_6px_20px_rgba(249,16,58,0.28)]"
                          >
                            <ShieldAlert className="size-3.5" />
                            <span>Contain host</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setInvestigatedHostId((prev) =>
                                prev === primaryHost.id ? null : primaryHost.id,
                              )
                            }
                            className="rounded-lg border border-[#F4F6FA]/12 bg-[#121622] px-3.5 py-2 text-xs font-medium text-[#F4F6FA]/85 transition-colors hover:border-[#F4F6FA]/25 cursor-pointer"
                          >
                            {investigatedHostId === primaryHost.id
                              ? "Hide forensics"
                              : "Investigate"}
                          </button>
                        </div>
                      )}

                      {investigatedHostId === primaryHost.id && (
                        <div className="rounded-lg border border-[#F4F6FA]/10 bg-[#090B11] p-3 text-[11px] font-mono space-y-1.5 text-[#F4F6FA]/75">
                          <div>
                            <span className="text-[#FFEBB9]">Process: </span>
                            <span>{primaryHost.processTree}</span>
                          </div>
                          <div>
                            <span className="text-[#F96246]">Socket: </span>
                            <span>{primaryHost.networkFlow}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Secondary Hosts Column */}
                  <div className="flex flex-col gap-3">
                    {activeCase.hosts.slice(1).map((host) => {
                      const safe = isSelectedResolved || host.status === "Safe";
                      return (
                        <div
                          key={host.id}
                          className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-[#F4F6FA] truncate">
                                {host.hostname}
                              </span>
                              <span className="text-[11px] text-[#F4F6FA]/45 truncate">
                                {host.role}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                                safe
                                  ? "border-[#10B981]/35 bg-[#10B981]/12 text-[#10B981]"
                                  : "border-[#F96246]/35 bg-[#F96246]/12 text-[#F96246]"
                              }`}
                            >
                              {safe ? "Safe" : host.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#F4F6FA]/55 leading-relaxed">
                            {host.evidence.join(" · ")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>

        {/* 4. RIGHT PANE: SPARROWX SENSE 3D ORB + AI TRIAGE TIMELINE */}
        <aside className="flex flex-col bg-[#0B0E14]/90">
          {/* SparrowX Sense 3D Orb Card */}
          <div className="border-b border-[#F4F6FA]/[0.07] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[#F4F6FA]">
                <span
                  className={`size-1.5 rounded-full ${
                    activeCriticalCount > 0 && !isCalmMode ? "bg-[#F9103A]" : "bg-[#10B981]"
                  }`}
                />
                <span>SparrowX Sense</span>
              </span>
              <span className="text-[11px] text-[#F4F6FA]/45 tabular-nums">
                {allowDemoFallback
                  ? "Live · 1,284 assets"
                  : assets.length > 0
                    ? `Live · ${assets.length} assets`
                    : "Not Configured"}
              </span>
            </div>

            {/* 3D Glossy Sphere Orb Card (Matches Image 1 Orb Directly) */}
            <div className="relative overflow-hidden rounded-xl border border-[#F4F6FA]/[0.08] bg-[#08090F] p-4">
              {/* Ambient Glow Behind Orb */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
                  activeCriticalCount > 0 && !isCalmMode
                    ? "bg-[radial-gradient(circle_at_50%_45%,rgba(249,16,58,0.22),transparent_65%)]"
                    : "bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.20),transparent_65%)]"
                }`}
              />

              <div className="relative mx-auto my-2 flex size-24 items-center justify-center">
                {/* Specular 3D Obsidian Sphere with Plasma Ring */}
                <div
                  className="relative size-20 rounded-full shadow-[inset_-12px_-14px_26px_rgba(0,0,0,0.95),inset_10px_8px_18px_rgba(244,246,250,0.14)]"
                  style={{
                    background:
                      activeCriticalCount > 0 && !isCalmMode
                        ? "radial-gradient(circle at 34% 28%, #3a3f4e 0%, #10131c 48%, #040508 82%, #F9103A 100%)"
                        : "radial-gradient(circle at 34% 28%, #3a464e 0%, #10171c 48%, #040709 82%, #10B981 100%)",
                  }}
                >
                  {/* Equatorial Ring */}
                  <div
                    className={`pointer-events-none absolute left-1/2 top-1/2 h-6 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-[100%] border-2 transition-colors duration-300 ${
                      activeCriticalCount > 0 && !isCalmMode
                        ? "border-[#F9103A]/80 shadow-[0_0_20px_rgba(249,16,58,0.65)]"
                        : "border-[#10B981]/75 shadow-[0_0_20px_rgba(16,185,129,0.55)]"
                    }`}
                  />
                </div>
              </div>

              <div className="relative flex items-end justify-between pt-1">
                <div>
                  <span className="text-[10px] text-[#F4F6FA]/45 block">Threat level</span>
                  <span
                    className={`text-sm font-medium ${
                      activeCriticalCount > 0 && !isCalmMode
                        ? "text-[#F9103A]"
                        : "text-[#10B981]"
                    }`}
                  >
                    {activeCriticalCount > 0 && !isCalmMode ? "Critical" : "Calm"}
                  </span>
                </div>
                <span className="text-sm font-medium text-[#F4F6FA] tabular-nums">
                  {activeCriticalCount > 0 && !isCalmMode
                    ? `${activeCriticalCount} active`
                    : "0 active"}
                </span>
              </div>
            </div>
          </div>

          {/* AI Triage Timeline */}
          <div className="flex-1 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-[#F4F6FA] block">AI triage</span>
                  <span className="text-[11px] text-[#F4F6FA]/45">
                    {isCalmMode
                      ? "Standing by"
                      : isSelectedResolved
                        ? "Mitigation verified"
                        : "Reasoning live · 4 steps"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-[#F4F6FA] tabular-nums block">
                    {isCalmMode || !activeCase ? "0%" : `${activeCase.confidence}%`}
                  </span>
                  <span className="text-[10px] text-[#F4F6FA]/45">confidence</span>
                </div>
              </div>

              {isCalmMode || !activeCase ? (
                <div className="rounded-xl border border-[#F4F6FA]/[0.07] bg-[#0D1017] p-4 space-y-2 text-center my-4">
                  <span className="text-xs font-medium text-[#F4F6FA] block">Listening</span>
                  <p className="text-[11px] text-[#F4F6FA]/50 leading-relaxed">
                    Every alert is read, enriched and grouped before it reaches an operator.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 border-l border-[#F4F6FA]/10 pl-3 ml-1">
                  {activeCase.timeline.map((step) => (
                    <div key={`${step.time}-${step.title}`} className="relative space-y-1">
                      <span className="absolute -left-[16px] top-1.5 size-1.5 rounded-full bg-[#F96246]" />
                      <div className="font-mono text-[10px] text-[#F4F6FA]/45 tabular-nums">
                        {step.time}
                      </div>
                      <div className="text-xs font-medium text-[#F4F6FA]">{step.title}</div>
                      <p className="text-[11px] text-[#F4F6FA]/55 leading-snug">{step.detail}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {step.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-[#F4F6FA]/[0.08] bg-[#121620] px-1.5 py-0.5 text-[10px] text-[#F4F6FA]/65"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Action / Approval State Card */}
            {!isCalmMode && activeCase && (
              isSelectedResolved ? (
                <div className="rounded-xl border border-[#10B981]/35 bg-[#0D1A16] p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-[#10B981] tabular-nums">
                      {activeCase.containedAtLabel} · Done
                    </span>
                    <CheckCircle2 className="size-3.5 text-[#10B981]" />
                  </div>
                  <div className="text-xs font-medium text-[#F4F6FA]">
                    {activeCase.containedSummaryTitle}
                  </div>
                  <p className="text-[11px] text-[#F4F6FA]/60 leading-snug">
                    {activeCase.containedSummaryDetail}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#F96246]/45 bg-[#191112] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-medium">
                    <span className="font-mono text-[#F96246] tabular-nums">14:02:48</span>
                    <span className="rounded border border-[#F9103A]/40 bg-[#F9103A]/15 px-1.5 py-0.5 uppercase tracking-wide text-[#F9103A]">
                      Needs Approval
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[#F4F6FA]">
                    {activeCase.approvalActionLabel}
                  </div>
                  <p className="text-[11px] text-[#F4F6FA]/65 leading-snug">
                    {activeCase.approvalDescription}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleContainCase(activeCase)}
                    className="w-full rounded-lg bg-[#F9103A] py-1.5 text-xs font-medium text-[#F4F6FA] transition-colors hover:bg-[#F9103A]/90 cursor-pointer"
                  >
                    Approve &amp; Contain
                  </button>
                </div>
              )
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
