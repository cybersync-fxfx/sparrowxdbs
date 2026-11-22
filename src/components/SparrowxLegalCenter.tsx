import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Server,
  FileText,
  CreditCard,
  Scale,
  CheckCircle2,
  Database,
  Shield,
  KeyRound,
  FolderLock,
  Gamepad2,
  Globe2,
} from "lucide-react";
import { SparrowxFooter } from "@/components/SparrowxFooter";

export type LegalTabKey = "terms" | "refund" | "security" | "services";

export interface SparrowxLegalCenterProps {
  initialTab?: LegalTabKey;
}

export function SparrowxLegalCenter({
  initialTab = "terms",
}: SparrowxLegalCenterProps) {
  const [activeTab, setActiveTab] = useState<LegalTabKey>(initialTab);
  const [activeService, setActiveService] = useState<
    "infra" | "db" | "shield" | "drop" | "keys" | "gateway" | "game"
  >("infra");

  return (
    <div className="min-h-screen bg-[#07090F] text-[#F4F6FA] flex flex-col font-sans selection:bg-[#FFA14A] selection:text-black antialiased">
      {/* Top Header Navigation */}
      <header className="border-b border-white/10 bg-[#0B0E17]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA14A] rounded-lg"
          >
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX Sovereign Cloud Logo"
              width={30}
              height={30}
              className="size-7.5 object-contain drop-shadow-[0_2px_8px_rgba(255,161,74,0.3)]"
            />
            <span className="font-bold tracking-tight text-white text-base">
              SparrowX <span className="text-[#FFA14A] font-medium text-xs uppercase tracking-wider ml-1 px-1.5 py-0.5 rounded bg-[#FFA14A]/10 border border-[#FFA14A]/20">Legal &amp; Trust Center</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              &larr; Back to Platform
            </a>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-white/5 bg-gradient-to-b from-[#0C101A] to-[#07090F] py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-medium">
            <ShieldCheck className="size-3.5" />
            <span>Sovereign Cloud &bull; Verified Data Protection Standards</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Terms of Service &amp; Refund Policy
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Transparent, legally binding agreements across all SparrowX infrastructure.
            Our data sovereignty architecture guarantees complete privacy, while our strict
            operational policies ensure high performance for every deployed node.
          </p>

          {/* Quick Tab Switcher */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "terms"
                  ? "bg-[#FFA14A] text-black shadow-lg shadow-[#FFA14A]/20"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <FileText className="size-4" />
              Terms of Service
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("refund")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "refund"
                  ? "bg-[#FFA14A] text-black shadow-lg shadow-[#FFA14A]/20"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <CreditCard className="size-4" />
              Refund Policy (Strict No-Refund)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "security"
                  ? "bg-[#FFA14A] text-black shadow-lg shadow-[#FFA14A]/20"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <Lock className="size-4" />
              Data Security Guarantee
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("services")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "services"
                  ? "bg-[#FFA14A] text-black shadow-lg shadow-[#FFA14A]/20"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <Server className="size-4" />
              Service-Specific Appendices
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-8">
        {/* ========================================================================= */}
        {/* TAB 1: TERMS OF SERVICE                                                   */}
        {/* ========================================================================= */}
        {activeTab === "terms" && (
          <article className="space-y-8 animate-in fade-in duration-300">
            {/* Summary Notice */}
            <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5 text-[#FFA14A] font-bold text-sm uppercase tracking-wider">
                <Scale className="size-4.5" />
                <span>Master Services Agreement (MSA)</span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Last updated: <strong>November 2026</strong>. By accessing, ordering, or deploying any infrastructure, database,
                network proxy, or security service on <strong>SparrowX Technologies</strong> (including <code className="text-white font-mono">sparrowx.net</code>,
                <code className="text-white font-mono">infra.sparrowx.net</code>, <code className="text-white font-mono">db.sparrowx.net</code>,
                <code className="text-white font-mono">sec.sparrowx.net</code>, and related endpoints), you enter into a legally binding contract with SparrowX Technologies.
              </p>
            </div>

            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">1</span>
                Acceptance of Terms &amp; Scope of Services
              </h2>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  SparrowX Technologies provides sovereign cloud computing infrastructure, high-frequency bare-metal
                  instances, virtual private servers (Cloud VPS), virtual dedicated servers (VDS), managed PostgreSQL
                  databases, Layer 3/4/7 DDoS mitigation, zero-knowledge encrypted vaults, and API gateway proxies.
                </p>
                <p>
                  By creating an account, generating API tokens, adding billing credits, or executing automated provisioning
                  scripts, you certify that you are at least 18 years of age (or the legal age of majority in your jurisdiction)
                  and possess the authority to enter into this agreement.
                </p>
              </div>
            </section>

            {/* Section 2: Acceptable Use Policy */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">2</span>
                Acceptable Use Policy (AUP) &amp; Strict Prohibitions
              </h2>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  SparrowX infrastructure is engineered for developers, engineering teams, and production applications.
                  The following activities are strictly prohibited across all nodes, subnets, and databases:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                  <li><strong className="text-zinc-200">Outbound DDoS or Stress Testing:</strong> Initiating denial-of-service floods, SYN amplification, UDP stressers, or port-scanning against external networks.</li>
                  <li><strong className="text-zinc-200">Malware &amp; Command-and-Control:</strong> Hosting or propagating malware, ransomware, botnets, trojans, or phishing payloads.</li>
                  <li><strong className="text-zinc-200">Unsolicited Mass Email (SPAM):</strong> Operating mass mailing engines, open SMTP relays, or scraped email dispatchers. Port 25 is filtered on standard VPS tiers.</li>
                  <li><strong className="text-zinc-200">Cryptocurrency Mining on Shared VPS:</strong> Unauthorized continuous 100% CPU/GPU mining on multi-tenant VPS tiers that impairs adjacent noisy neighbors (allowed only on dedicated Bare Metal plans).</li>
                  <li><strong className="text-zinc-200">IP Hijacking &amp; Forged Headers:</strong> Spoofing packet origin headers or manipulating BGP announcements.</li>
                </ul>
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
                  <strong>Zero Tolerance Notice:</strong> Violations of the Acceptable Use Policy trigger immediate suspension of all associated compute instances, forfeiture of any remaining funds, and immediate reporting to law enforcement authorities where criminal conduct is identified.
                </div>
              </div>
            </section>

            {/* Section 3: SLA & Availability */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">3</span>
                Service Level Agreement (SLA) &amp; Uptime Guarantee
              </h2>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  We target an operational uptime of <strong>99.9%</strong> on core compute nodes, power feeds, and backbone network connectivity in our Tier IV Mumbai and EU partner facilities.
                </p>
                <p>
                  SLA exclusions include scheduled maintenance (communicated at least 24 hours in advance), customer configuration errors, upstream transit fiber cuts beyond our Anycast redundancy, or customer operating system kernel panics.
                </p>
              </div>
            </section>

            {/* Section 4: Limitation of Liability */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">4</span>
                Limitation of Liability &amp; Disclaimers
              </h2>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. SparrowX Technologies
                  shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits,
                  loss of data, or business interruption.
                </p>
              </div>
            </section>
          </article>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STRICT REFUND POLICY (NO REFUND ONCE DEPLOYED)                     */}
        {/* ========================================================================= */}
        {activeTab === "refund" && (
          <article className="space-y-8 animate-in fade-in duration-300">
            {/* Primary Policy Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1A1208] to-[#0D121D] border-2 border-[#FFA14A]/70 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-[#FFA14A] font-extrabold text-base uppercase tracking-wider">
                <AlertTriangle className="size-5 shrink-0" />
                <span>Strict Hardware &amp; Provisioning Refund Policy</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Once a server or service is deployed to your account, there is strictly NO REFUND.
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                All sales, subscriptions, upfront payments, and invoice settlements for Cloud VPS, Dedicated VDS,
                Bare Metal servers, sovereign databases, and network allocations are <strong>final and non-refundable</strong> immediately
                upon automated orchestration and deployment to your account.
              </p>
            </div>

            {/* Detailed Justification Section */}
            <section className="space-y-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">1</span>
                Technical &amp; Operational Reasons for the Strict Policy
              </h3>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  Unlike non-tangible software subscriptions, deploying a SparrowX infrastructure node causes immediate, irrevocable physical and financial commitments:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#0D121D] border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-sm">
                      <Server className="size-4 text-[#FFA14A]" />
                      <span>Dedicated Silicon Allocation</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      When your instance is provisioned, physical AMD Ryzen 9 9950X Zen 5 CPU cores and DDR5 ECC RAM channels are locked exclusively for your hypervisor container.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0D121D] border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-sm">
                      <Globe2 className="size-4 text-emerald-400" />
                      <span>Dedicated IPv4/IPv6 Subnet Leasing</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Static public IP addresses are leased from regional internet registries (APNIC/RIPE) with immediate upstream carrier routing costs.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0D121D] border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-sm">
                      <Database className="size-4 text-sky-400" />
                      <span>NVMe Gen5 Storage Commitments</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      High-IOPS PCIe 5.0 solid-state blocks are carved out on enterprise storage arrays and wiped on delivery with zero wear-and-tear recovery.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0D121D] border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-sm">
                      <Shield className="size-4 text-purple-400" />
                      <span>Transit &amp; DDoS Scrubbing Pipes</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Multi-gigabit upstream transit capacity at Tier IV Mumbai (NIXI/DE-CIX) is committed to your node&apos;s MAC and VLAN boundary.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Scenarios */}
            <section className="space-y-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">2</span>
                Pre-Deployment vs. Post-Deployment Clarifications
              </h3>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#0D121D] border border-emerald-500/30 flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Pre-Deployment Automated Provisioning Failure</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        If payment is processed but the hypervisor is unable to provision your requested node due to an internal capacity exhaustion or hardware fault prior to activation, you will receive a full 100% refund or instant platform credit replacement.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0D121D] border border-red-500/30 flex items-start gap-3">
                    <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Post-Deployment Operational Changes</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Once the node receives its IP, boots Cloud-Init, or is accessible via SSH/Dashboard, no refund can be granted for buyer&apos;s remorse, lack of technical knowledge, network latency variations, or change of project scope.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Chargebacks & Fraud */}
            <section className="space-y-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="size-6 rounded-lg bg-[#FFA14A]/15 text-[#FFA14A] flex items-center justify-center text-xs font-mono font-bold">3</span>
                Chargebacks, Payment Disputes &amp; Abuse
              </h3>
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed pl-8">
                <p>
                  Initiating a chargeback, bank dispute, or payment reversal through your bank, credit card issuer, or UPI payment provider without first contacting SparrowX Engineering violates this agreement.
                </p>
                <p>
                  In the event of an unjustified dispute, SparrowX reserves the right to immediately terminate all connected infrastructure, delete associated snapshots and databases, and place the organization on our global abuse blacklist.
                </p>
                <div className="pt-2 text-xs font-mono text-zinc-400">
                  Billing inquiries or questions: Contact <a href="mailto:billing@sparrowx.net" className="text-[#FFA14A] hover:underline font-bold">billing@sparrowx.net</a> or <a href="mailto:support@sparrowx.net" className="text-[#FFA14A] hover:underline font-bold">support@sparrowx.net</a>.
                </div>
              </div>
            </section>
          </article>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DATA SECURITY GUARANTEE ("OUR DATA IS SO SECURED")                 */}
        {/* ========================================================================= */}
        {activeTab === "security" && (
          <article className="space-y-8 animate-in fade-in duration-300">
            {/* Security Pledge Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B151F] to-[#080E17] border-2 border-emerald-500/50 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-400 font-extrabold text-base uppercase tracking-wider">
                <ShieldCheck className="size-5 shrink-0" />
                <span>Enterprise Data Sovereignty &amp; Privacy Guarantee</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Your data is completely sovereign, encrypted, and isolated. Don&apos;t worry about anything.
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                SparrowX was built from the ground up for builders who refuse to compromise on security.
                We operate under a <strong>Zero-Knowledge, Zero-Inspection</strong> philosophy.
                Your data, customer records, database rows, encrypted keys, and private files belong strictly to you.
              </p>
            </div>

            {/* 6 Core Security Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Pillar 1 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Lock className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Zero-Knowledge Client Encryption</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  For tools like <strong>Drop File Vault</strong> and <strong>Password &amp; Keys Engine</strong>, encryption keys are computed in your browser using modern WebCrypto APIs (AES-256-GCM / XChaCha20-Poly1305). Plaintext data never touches our disk or servers.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Database className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Encrypted PostgreSQL at Rest &amp; Transit</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every <strong>SparrowX Sovereign DB</strong> cluster runs on encrypted NVMe volumes. Network traffic between client applications and the database is forced over TLS 1.3 with strict SNI and scram-sha-256 authentication.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Server className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Hypervisor-Level Tenant Isolation</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Our Cloud VPS and VDS servers run on hardened Proxmox VE hypervisors with Linux namespaces, cgroups v2, and CPU microcode security patches active. Cross-tenant memory leaks and side-channel snooping are blocked at the hardware silicon level.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Shield className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Always-On eBPF/XDP DDoS Protection</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every incoming packet is verified at the network interface card driver stage before it reaches user space. Malicious volumetric floods, SYN scans, and UDP amplification are filtered without latency degradation.
                </p>
              </div>

              {/* Pillar 5 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <FolderLock className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Zero Third-Party Data Brokers</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We never monetize, scrape, inspect, or sell customer traffic or metadata. There are zero tracking pixels or behavioral ad scripts injected into your applications or management portals.
                </p>
              </div>

              {/* Pillar 6 */}
              <div className="p-5 rounded-2xl bg-[#0D121D] border border-white/10 space-y-3">
                <div className="size-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <KeyRound className="size-5" />
                </div>
                <h3 className="text-base font-bold text-white">Disaster Recovery &amp; Automated Backups</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The <strong>SparrowX Backup System</strong> automatically packages your configurations, databases, and SSL certificates into self-healing restore bundles. You can redeploy your entire environment onto a fresh node with a single curl command.
                </p>
              </div>
            </div>
          </article>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SERVICE-SPECIFIC APPENDICES                                       */}
        {/* ========================================================================= */}
        {activeTab === "services" && (
          <article className="space-y-6 animate-in fade-in duration-300">
            <div className="p-4 rounded-xl bg-[#0D121D] border border-white/10 text-xs text-zinc-300">
              Select an individual SparrowX service to review its tailored operational guidelines, data retention commitments, and no-refund specifications.
            </div>

            {/* Service Selector Chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: "infra", label: "Cloud VPS & VDS", icon: Server },
                { id: "db", label: "Sovereign Database", icon: Database },
                { id: "shield", label: "Shield SOC & WAF", icon: Shield },
                { id: "drop", label: "Drop Vault", icon: FolderLock },
                { id: "keys", label: "Password & Keys", icon: KeyRound },
                { id: "gateway", label: "API Gateway", icon: Globe2 },
                { id: "game", label: "Game Hosting", icon: Gamepad2 },
              ].map((s) => {
                const Icon = s.icon;
                const isSelected = activeService === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveService(s.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#FFA14A] text-black font-bold shadow-md"
                        : "bg-white/5 text-zinc-400 hover:text-white border border-white/10"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Service Appendix Content */}
            <div className="p-6 rounded-2xl bg-[#0D121D] border border-white/10 space-y-4">
              {activeService === "infra" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Server className="size-5 text-[#FFA14A]" />
                    Cloud VPS &amp; Dedicated VDS Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Deployment Terms:</strong> Nodes are provisioned with root access, automated Proxmox Linux bridge (<code className="font-mono text-white">vmbr0</code>), and Cloud-Init network configuration. Customers are the sole root administrators of their operating system.
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Refund Clause:</strong> Once the hypervisor reserves the AMD Ryzen 9 9950X compute threads, commits NVMe Gen5 storage, and assigns your static public IP, the server is deployed and <strong>strictly non-refundable</strong>.
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Data Security:</strong> Storage volumes are partitioned with strict hypervisor block-level isolation. Physical drives are cryptographically sanitized upon server termination.
                  </p>
                </div>
              )}

              {activeService === "db" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="size-5 text-sky-400" />
                    Sovereign Cloud Database Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Data Integrity &amp; Ownership:</strong> Customer owns 100% of all schemas, tables, and records. SparrowX engineers have zero access to database rows or decryption keys.
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Refund Clause:</strong> Database cluster provisioning allocates dedicated RAM buffers and storage pools immediately upon invoice settlement; no refunds are provided once active.
                  </p>
                </div>
              )}

              {activeService === "shield" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="size-5 text-purple-400" />
                    Shield SOC &amp; L7 WAF Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Traffic Scrubbing:</strong> Traffic passing through SparrowX Shield is analyzed at wire-speed for malicious payloads, SQL injection, and volumetric floods. Payload bodies are not archived or stored beyond active inspection buffers.
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Refund Clause:</strong> Shield rules and Anycast edge slots are allocated dynamically; activated subscriptions are non-refundable.
                  </p>
                </div>
              )}

              {activeService === "drop" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderLock className="size-5 text-emerald-400" />
                    Drop File Vault Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Client-Side Encryption:</strong> All files uploaded via SparrowX Drop are encrypted on the client device before upload. Passphrases and decryption keys never reach SparrowX.
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Retention &amp; Self-Destruction:</strong> Files are automatically deleted from storage once their expiry timer or download quota is reached.
                  </p>
                </div>
              )}

              {activeService === "keys" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <KeyRound className="size-5 text-amber-400" />
                    Password &amp; Key Tooling Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Offline Generation:</strong> All password generation and cryptographic key hashing occur 100% locally in the browser memory sandbox. No telemetry or generated secrets are ever transmitted across the network.
                  </p>
                </div>
              )}

              {activeService === "gateway" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe2 className="size-5 text-teal-400" />
                    API Gateway Proxy Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Rate Limiting &amp; Authentication:</strong> Gateway routes are guarded by JWT verification and token bucket algorithms. Logs retain only operational HTTP metadata without request body payloads.
                  </p>
                </div>
              )}

              {activeService === "game" && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Gamepad2 className="size-5 text-orange-400" />
                    Game Hosting &amp; GameSec Appendix
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    <strong>Anti-DDoS &amp; Performance:</strong> Servers receive low-latency UDP routing and gaming-specific attack filters. Port allocations and dedicated compute are locked upon deployment with zero refunds.
                  </p>
                </div>
              )}
            </div>
          </article>
        )}
      </main>

      {/* Footer Component */}
      <SparrowxFooter />
    </div>
  );
}
