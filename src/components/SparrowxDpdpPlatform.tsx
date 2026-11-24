import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileCheck2,
  FileText,
  Globe,
  LayoutGrid,
  Lock,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { buildMasterHref } from "@/lib/routing";
import { SparrowxFooter } from "@/components/SparrowxFooter";

type DpdpTab = "overview" | "consent" | "dsar" | "breach" | "inventory";

interface DsarRequest {
  id: string;
  principalName: string;
  principalEmail: string;
  type: "Access" | "Correction" | "Erasure" | "Grievance";
  status: "Open" | "Verifying" | "Completed";
  createdAt: string;
  dueDate: string;
  notes: string;
}

interface DataAssetRow {
  id: string;
  system: string;
  category: string;
  purpose: string;
  region: "Mumbai IN-1" | "Chennai IN-2" | "Sydney AU-1" | "Encrypted Edge";
  retentionDays: number;
  encrypted: boolean;
}

interface ComplianceControl {
  id: string;
  section: string;
  title: string;
  description: string;
  passed: boolean;
}

const STORAGE_KEYS = {
  controls: "spx_dpdp_controls_v1",
  dsar: "spx_dpdp_dsar_v1",
  inventory: "spx_dpdp_inventory_v1",
};

const DEFAULT_CONTROLS: ComplianceControl[] = [
  {
    id: "sec-5",
    section: "Section 5",
    title: "Itemized Pre-Collection Privacy Notice",
    description: "Clear, plain-language notice detailing personal data categories and processing purpose prior to consent.",
    passed: true,
  },
  {
    id: "sec-6",
    section: "Section 6",
    title: "Free, Specific, Informed & Unconditional Consent",
    description: "Granular opt-in consent with an equally simple one-click withdrawal mechanism.",
    passed: true,
  },
  {
    id: "sec-8-5",
    section: "Section 8(5)",
    title: "Reasonable Security Safeguards (AES-256 + TLS 1.3)",
    description: "Encryption in transit and at rest with WAF, RBAC, and immutable access audit trails.",
    passed: true,
  },
  {
    id: "sec-8-6",
    section: "Section 8(6)",
    title: "72-Hour Data Breach Notification Workflow",
    description: "Automated incident triage and formatted notifications to Data Protection Board of India & affected principals.",
    passed: true,
  },
  {
    id: "sec-9",
    section: "Section 9",
    title: "Verifiable Parental Consent for Minors (<18)",
    description: "Age gating and zero behavioral tracking or targeted advertising directed at children.",
    passed: false,
  },
  {
    id: "sec-11",
    section: "Sections 11–13",
    title: "Data Principal Rights Desk (Access, Erasure, Grievance)",
    description: "Self-service DSAR intake portal with statutory SLA tracking and Grievance Officer contact.",
    passed: true,
  },
  {
    id: "sec-10",
    section: "Section 10",
    title: "Data Protection Officer (DPO) & DPIA Schedule",
    description: "Designated India-based DPO and periodic Data Protection Impact Assessments for Significant Data Fiduciaries.",
    passed: false,
  },
];

const DEFAULT_DSAR: DsarRequest[] = [
  {
    id: "DSAR-2026-101",
    principalName: "Aarav Menon",
    principalEmail: "aarav.menon@example.in",
    type: "Access",
    status: "Verifying",
    createdAt: "2026-11-22",
    dueDate: "2026-12-07",
    notes: "Requested JSON export of account profile and billing history.",
  },
  {
    id: "DSAR-2026-102",
    principalName: "Priya Nair",
    principalEmail: "priya.nair@example.in",
    type: "Erasure",
    status: "Open",
    createdAt: "2026-11-23",
    dueDate: "2026-12-08",
    notes: "Account closure & permanent deletion across PostgreSQL and backups.",
  },
];

const DEFAULT_INVENTORY: DataAssetRow[] = [
  {
    id: "inv-1",
    system: "SparrowX Primary PostgreSQL",
    category: "Identity & Auth (Email, Name, Role)",
    purpose: "Account authentication & SSO session binding",
    region: "Mumbai IN-1",
    retentionDays: 365,
    encrypted: true,
  },
  {
    id: "inv-2",
    system: "Razorpay / UPI Billing Ledger",
    category: "Transaction IDs & GST Invoices",
    purpose: "Statutory financial compliance & subscription billing",
    region: "Mumbai IN-1",
    retentionDays: 2555,
    encrypted: true,
  },
  {
    id: "inv-3",
    system: "Shield WAF Edge Telemetry",
    category: "Truncated IP & Request Fingerprints",
    purpose: "L7 DDoS mitigation & abuse prevention",
    region: "Encrypted Edge",
    retentionDays: 30,
    encrypted: true,
  },
];

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function SparrowxDpdpPlatform() {
  const [activeTab, setActiveTab] = useState<DpdpTab>("overview");
  const [controls, setControls] = useState<ComplianceControl[]>(DEFAULT_CONTROLS);
  const [dsarList, setDsarList] = useState<DsarRequest[]>(DEFAULT_DSAR);
  const [inventory, setInventory] = useState<DataAssetRow[]>(DEFAULT_INVENTORY);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Consent & Notice Builder state
  const [orgName, setOrgName] = useState("SparrowX Technologies");
  const [dpoEmail, setDpoEmail] = useState("dpo@sparrowx.net");
  const [purposeText, setPurposeText] = useState(
    "Cloud infrastructure provisioning, account security, billing, and abuse prevention",
  );
  const [retentionDays, setRetentionDays] = useState("365");
  const [categories, setCategories] = useState<Record<string, boolean>>({
    identity: true,
    billing: true,
    telemetry: true,
    marketing: false,
  });

  // New DSAR state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newType, setNewType] = useState<DsarRequest["type"]>("Access");
  const [newNotes, setNewNotes] = useState("");

  // Breach Console state
  const [breachTitle, setBreachTitle] = useState("Unauthorized API Token Exposure");
  const [breachAffected, setBreachAffected] = useState("142");
  const [breachDetectedAt, setBreachDetectedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [breachContainment, setBreachContainment] = useState(
    "Revoked compromised credentials, rotated signing keys, blocked source ASN at Edge WAF.",
  );

  // New Data Asset state
  const [assetSystem, setAssetSystem] = useState("");
  const [assetCategory, setAssetCategory] = useState("");
  const [assetPurpose, setAssetPurpose] = useState("");
  const [assetRegion, setAssetRegion] = useState<DataAssetRow["region"]>("Mumbai IN-1");

  useEffect(() => {
    setControls(loadStored(STORAGE_KEYS.controls, DEFAULT_CONTROLS));
    setDsarList(loadStored(STORAGE_KEYS.dsar, DEFAULT_DSAR));
    setInventory(loadStored(STORAGE_KEYS.inventory, DEFAULT_INVENTORY));
  }, []);

  const persistControls = (next: ComplianceControl[]) => {
    setControls(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.controls, JSON.stringify(next));
    } catch {
      // ignore storage error
    }
  };

  const persistDsar = (next: DsarRequest[]) => {
    setDsarList(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.dsar, JSON.stringify(next));
    } catch {
      // ignore storage error
    }
  };

  const persistInventory = (next: DataAssetRow[]) => {
    setInventory(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(next));
    } catch {
      // ignore storage error
    }
  };

  const readinessScore = useMemo(() => {
    const passed = controls.filter((c) => c.passed).length;
    return Math.round((passed / Math.max(1, controls.length)) * 100);
  }, [controls]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const selectedCategoryLabels = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

  const generatedConsentSnippet = `<!-- SparrowX DPDP Act 2023 Consent Banner (${orgName}) -->
<script>
  window.__SPX_DPDP_CONFIG__ = {
    fiduciary: ${JSON.stringify(orgName)},
    dpoEmail: ${JSON.stringify(dpoEmail)},
    categories: ${JSON.stringify(selectedCategoryLabels)},
    purpose: ${JSON.stringify(purposeText)},
    retentionDays: ${Number(retentionDays) || 365},
    withdrawUrl: "https://dpdp.sparrowx.net/?tab=dsar"
  };
</script>
<script defer src="https://dpdp.sparrowx.net/consent-widget.js"></script>`;

  const generatedBreachNotice = `DATA PROTECTION BOARD OF INDIA — PERSONAL DATA BREACH INTIMATION (DPDP ACT 2023, SEC. 8(6))
================================================================================
Data Fiduciary       : ${orgName}
Grievance / DPO      : ${dpoEmail}
Incident Title       : ${breachTitle}
Detected Timestamp   : ${breachDetectedAt} UTC (Within 72-hour statutory window)
Estimated Principals : ${breachAffected} affected record(s)
Containment Actions  : ${breachContainment}
Remediation Contact  : Submit Data Principal queries to ${dpoEmail}
================================================================================`;

  const exportAuditJson = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      standard: "India Digital Personal Data Protection Act, 2023 (DPDP)",
      fiduciary: orgName,
      dpoEmail,
      readinessScorePct: readinessScore,
      controls,
      openDsarRequests: dsarList,
      dataInventory: inventory,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-dpdp-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateDsar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    const today = new Date();
    const due = new Date(today.getTime() + 15 * 86400000);
    const item: DsarRequest = {
      id: `DSAR-${today.getFullYear()}-${Math.floor(200 + Math.random() * 799)}`,
      principalName: newName.trim(),
      principalEmail: newEmail.trim().toLowerCase(),
      type: newType,
      status: "Open",
      createdAt: today.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      notes: newNotes.trim() || "Submitted via SparrowX DPDP Rights Desk.",
    };
    persistDsar([item, ...dsarList]);
    setNewName("");
    setNewEmail("");
    setNewNotes("");
  };

  const cycleDsarStatus = (id: string) => {
    const order: DsarRequest["status"][] = ["Open", "Verifying", "Completed"];
    persistDsar(
      dsarList.map((r) =>
        r.id === id ? { ...r, status: order[(order.indexOf(r.status) + 1) % order.length]! } : r,
      ),
    );
  };

  const handleAddInventory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetSystem.trim() || !assetCategory.trim()) return;
    persistInventory([
      {
        id: `inv-${Date.now().toString(36)}`,
        system: assetSystem.trim(),
        category: assetCategory.trim(),
        purpose: assetPurpose.trim() || "Core service delivery",
        region: assetRegion,
        retentionDays: 365,
        encrypted: true,
      },
      ...inventory,
    ]);
    setAssetSystem("");
    setAssetCategory("");
    setAssetPurpose("");
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans antialiased flex flex-col">
      {/* Vercel-Style Sticky Header + Tabs */}
      <header className="sticky top-0 z-40 border-b border-[#262626] bg-[#000000]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={buildMasterHref("/")} className="flex items-center gap-2 shrink-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX DPDP"
                width={26}
                height={26}
                className="size-6.5 object-contain"
              />
            </a>
            <span className="text-zinc-600 font-light">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm tracking-tight text-white truncate">
                SparrowX DPDP
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                DPDP Act 2023 • IN
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={buildMasterHref("/")}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <span>Portal</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={exportAuditJson}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md bg-white hover:bg-zinc-200 text-black px-3.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Export Audit</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <nav aria-label="DPDP Compliance Sections" className="flex items-center gap-1 -mb-px">
            {(
              [
                { id: "overview", label: "Overview & Checklist", icon: LayoutGrid },
                { id: "consent", label: "Consent & Notice Builder", icon: FileCheck2 },
                { id: "dsar", label: "DSAR Rights Desk", icon: UserCheck },
                { id: "breach", label: "72h Breach Console", icon: ShieldAlert },
                { id: "inventory", label: "Data Inventory", icon: Database },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "border-white text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* OVERVIEW TAB (Landing Hero + Live Readiness Controls) */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono text-emerald-300">
                  <Scale className="size-3.5" aria-hidden="true" />
                  <span>dpdp.sparrowx.net • India DPDP Act 2023 Readiness Suite</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Automate India DPDP Compliance Without Legal Friction.
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Generate Section 6 consent notices, manage Data Principal access &amp; erasure requests (DSAR), map sovereign India data stores, and draft 72-hour Data Protection Board breach intimations in one workspace.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("consent")}
                    className="rounded-md bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Build Consent Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("dsar")}
                    className="rounded-md border border-[#262626] bg-[#111] hover:bg-[#1a1a1a] text-white px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    Open DSAR Desk ({dsarList.filter((d) => d.status !== "Completed").length} Open)
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#000000] p-5 min-w-[240px] space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                  <span>DPDP READINESS</span>
                  <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                </div>
                <div className="text-4xl font-extrabold text-white font-mono">
                  {readinessScore}%
                </div>
                <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${readinessScore}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-400">
                  {controls.filter((c) => c.passed).length} of {controls.length} statutory controls verified
                </div>
              </div>
            </section>

            {/* Interactive Controls Checklist */}
            <section className="rounded-xl border border-[#262626] bg-[#0A0A0A] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    DPDP Act 2023 Statutory Control Checklist
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Click any control to toggle verification status — your audit score updates live.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Saved locally • Exportable JSON
                </span>
              </div>
              <div className="divide-y divide-[#1f1f1f]">
                {controls.map((ctrl) => (
                  <button
                    key={ctrl.id}
                    type="button"
                    onClick={() =>
                      persistControls(
                        controls.map((c) => (c.id === ctrl.id ? { ...c, passed: !c.passed } : c)),
                      )
                    }
                    className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-colors flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-[#262626] bg-[#111] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                          {ctrl.section}
                        </span>
                        <span className="text-sm font-medium text-white">{ctrl.title}</span>
                      </div>
                      <p className="text-xs text-zinc-400">{ctrl.description}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono border ${
                        ctrl.passed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {ctrl.passed ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Verified
                        </>
                      ) : (
                        <>
                          <Clock className="size-3.5" /> Action Needed
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* CONSENT & NOTICE BUILDER TAB */}
        {activeTab === "consent" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Section 5 &amp; 6 Consent Notice Generator
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure your Data Fiduciary details and embed the DPDP consent widget in your site.
                </p>
              </div>
              <div className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="text-zinc-400">Data Fiduciary Organization</span>
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Grievance Officer / DPO Email</span>
                  <input
                    value={dpoEmail}
                    onChange={(e) => setDpoEmail(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Declared Processing Purpose</span>
                  <textarea
                    rows={3}
                    value={purposeText}
                    onChange={(e) => setPurposeText(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Retention Period (Days)</span>
                  <input
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
                <div className="space-y-1.5 pt-1">
                  <span className="text-zinc-400 block">Personal Data Categories</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(categories).map(([key, enabled]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategories({ ...categories, [key]: !enabled })}
                        className={`rounded-md border px-3 py-2 text-left text-xs capitalize cursor-pointer ${
                          enabled
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-[#262626] bg-[#000] text-zinc-400"
                        }`}
                      >
                        {enabled ? "✓ " : "+ "}
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {/* Live Banner Preview */}
              <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-3">
                <div className="text-[11px] font-mono text-zinc-400 uppercase">
                  Live User Consent Banner Preview
                </div>
                <div className="rounded-lg border border-white/15 bg-[#05060A] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      {orgName} — DPDP Personal Data Notice
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      India DPDP 2023
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    We collect <strong>{selectedCategoryLabels.join(", ") || "Essential"}</strong> data for: {purposeText}. Retained up to {retentionDays} days. Contact our Grievance Officer at <span className="underline">{dpoEmail}</span> or withdraw consent anytime.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-white text-black px-3 py-1.5 text-xs font-semibold">
                      Accept Selected
                    </span>
                    <span className="rounded border border-white/20 px-3 py-1.5 text-xs text-zinc-300">
                      Essential Only
                    </span>
                  </div>
                </div>
              </div>

              {/* Embed Snippet */}
              <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Production Embed Code</span>
                  <button
                    type="button"
                    onClick={() => void copyText("consent", generatedConsentSnippet)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#262626] bg-[#111] hover:bg-[#1a1a1a] px-2.5 py-1 text-xs text-white cursor-pointer"
                  >
                    {copiedKey === "consent" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedKey === "consent" ? "Copied" : "Copy Snippet"}</span>
                  </button>
                </div>
                <pre className="rounded-lg border border-[#262626] bg-[#000] p-3.5 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                  {generatedConsentSnippet}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* DSAR RIGHTS DESK TAB */}
        {activeTab === "dsar" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleCreateDsar}
              className="lg:col-span-4 rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-3 h-fit"
            >
              <h2 className="text-sm font-semibold text-white">Log Data Principal Request</h2>
              <p className="text-xs text-zinc-400">
                Track statutory Access, Correction, Erasure, and Grievance tickets with 15-day SLA.
              </p>
              <input
                required
                placeholder="Data Principal Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <input
                required
                type="email"
                placeholder="principal@domain.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as DsarRequest["type"])}
                className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              >
                <option value="Access">Right to Access (Sec. 11)</option>
                <option value="Correction">Right to Correction (Sec. 12)</option>
                <option value="Erasure">Right to Erasure (Sec. 12)</option>
                <option value="Grievance">Grievance Redressal (Sec. 13)</option>
              </select>
              <textarea
                rows={3}
                placeholder="Verification & scope notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-white hover:bg-zinc-200 text-black py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" /> Create DSAR Ticket
              </button>
            </form>

            <div className="lg:col-span-8 rounded-xl border border-[#262626] bg-[#0A0A0A] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Active DSAR Queue ({dsarList.length})
                </h2>
                <span className="text-[11px] font-mono text-zinc-400">
                  Click status pill to advance workflow
                </span>
              </div>
              <div className="divide-y divide-[#1f1f1f]">
                {dsarList.map((req) => (
                  <div
                    key={req.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">{req.id}</span>
                        <span className="text-sm font-semibold text-white">{req.principalName}</span>
                        <span className="rounded border border-[#262626] bg-[#111] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                          {req.type}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        {req.principalEmail} • Due {req.dueDate}
                      </div>
                      <p className="text-xs text-zinc-300">{req.notes}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => cycleDsarStatus(req.id)}
                        className={`rounded-full px-3 py-1 text-[11px] font-mono border cursor-pointer ${
                          req.status === "Completed"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : req.status === "Verifying"
                              ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {req.status}
                      </button>
                      <button
                        type="button"
                        onClick={() => persistDsar(dsarList.filter((d) => d.id !== req.id))}
                        aria-label="Delete DSAR request"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 72-HOUR BREACH CONSOLE TAB */}
        {activeTab === "breach" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-xl border border-red-500/25 bg-[#0A0A0A] p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono uppercase">
                <AlertTriangle className="size-4" />
                <span>DPDP Sec. 8(6) &amp; CERT-In Breach Drafting</span>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">Incident Title</span>
                <input
                  value={breachTitle}
                  onChange={(e) => setBreachTitle(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block space-y-1">
                  <span className="text-zinc-400">Affected Principals</span>
                  <input
                    value={breachAffected}
                    onChange={(e) => setBreachAffected(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Detected At (UTC)</span>
                  <input
                    type="datetime-local"
                    value={breachDetectedAt}
                    onChange={(e) => setBreachDetectedAt(e.target.value)}
                    className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-400">Containment &amp; Mitigation Taken</span>
                <textarea
                  rows={4}
                  value={breachContainment}
                  onChange={(e) => setBreachContainment(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-white"
                />
              </label>
            </div>

            <div className="lg:col-span-7 rounded-xl border border-[#262626] bg-[#0A0A0A] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white inline-flex items-center gap-2">
                  <FileText className="size-4 text-red-400" />
                  Formatted Board &amp; Principal Breach Notice
                </span>
                <button
                  type="button"
                  onClick={() => void copyText("breach", generatedBreachNotice)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white hover:bg-zinc-200 text-black px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  {copiedKey === "breach" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copiedKey === "breach" ? "Copied Notice" : "Copy Legal Notice"}</span>
                </button>
              </div>
              <pre className="rounded-lg border border-[#262626] bg-[#000] p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">
                {generatedBreachNotice}
              </pre>
            </div>
          </div>
        )}

        {/* DATA INVENTORY TAB */}
        {activeTab === "inventory" && (
          <div className="space-y-5">
            <form
              onSubmit={handleAddInventory}
              className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                required
                placeholder="System / Database Name"
                value={assetSystem}
                onChange={(e) => setAssetSystem(e.target.value)}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <input
                required
                placeholder="Personal Data Fields"
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value)}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              />
              <select
                value={assetRegion}
                onChange={(e) => setAssetRegion(e.target.value as DataAssetRow["region"])}
                className="rounded-md border border-[#262626] bg-[#000] px-3 py-2 text-xs text-white"
              >
                <option value="Mumbai IN-1">Mumbai IN-1 (Sovereign)</option>
                <option value="Chennai IN-2">Chennai IN-2 (Sovereign)</option>
                <option value="Sydney AU-1">Sydney AU-1</option>
                <option value="Encrypted Edge">Encrypted Edge</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-white hover:bg-zinc-200 text-black px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                + Register Data Store
              </button>
            </form>

            <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#262626] text-zinc-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">System</th>
                    <th className="px-4 py-3">Personal Data</th>
                    <th className="px-4 py-3">Residency</th>
                    <th className="px-4 py-3">Retention</th>
                    <th className="px-4 py-3">Safeguard</th>
                    <th className="px-4 py-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f1f]">
                  {inventory.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{row.system}</td>
                      <td className="px-4 py-3 text-zinc-300">{row.category}</td>
                      <td className="px-4 py-3 font-mono text-emerald-300">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="size-3" /> {row.region}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{row.retentionDays}d</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                          <Lock className="size-3" /> AES-256
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => persistInventory(inventory.filter((i) => i.id !== row.id))}
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <SparrowxFooter />
    </div>
  );
}
