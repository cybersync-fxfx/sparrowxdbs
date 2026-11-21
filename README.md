# SparrowX | Autonomous Security Operations Platform & AI Guardrails

<p align="center">
  <img src="public/sparrowx-logo.png" alt="SparrowX Logo" width="160" />
</p>

<p align="center">
  <strong>Production-grade Developer SecOps, Real-time Threat Intelligence & AI Agent Firewalls.</strong>
</p>

---

## Overview

**SparrowX** is an autonomous security operations platform engineered for modern web apps, cloud APIs, and autonomous AI agents (LLM / Model Context Protocol). It bridges enterprise SOC triage with multi-tenant client management, credit-metered protection modules, and continuous compliance reporting.

## Key Capabilities

* **SOC Operations Command Center**: Live incident queue, threat indicators (IOCs), monitored host assets, and CVE tracking computed directly from production telemetry.
* **Autonomous AI Agent & LLM Shield**: Edge inspection of LLM prompts and Model Context Protocol (MCP) tool executions to neutralize prompt injections, jailbreaks, and sensitive PII leaks.
* **Perimeter Web & WAF Protection**: Edge firewalling against OWASP Top 10, automated DDoS/bot challenges, and 1-click blocklist export (`iptables`, `UFW`, `Cloudflare`).
* **Multi-Tenant Client Portal**: Dedicated self-service workspace where clients manage subscribed services, inspect real-time logs, and integrate drop-in telemetry SDKs.
* **Autonomous Billing & Security Credits**: Automated credit-metered service provisioning, transaction ledger, and sovereign payment gateway.
* **Live High-Availability Security Datastore**: Full row-level security (RLS) schema supporting incidents, threat feeds, assets, vulnerabilities, audit logs, and client subscriptions.

---

## Architecture & Technology Stack

* **Framework**: React 19, TanStack Router, TanStack React Query, Vite 8.
* **Database & Persistence**: High-Availability Cloud PostgreSQL REST Datastore with offline cache fallback.
* **Design & Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons, Plus Jakarta Sans, JetBrains Mono.
* **Testing & Quality**: Vitest, TypeScript (Strict Mode), ESLint.

---

## Local Development

Ensure you have [Node.js](https://nodejs.org) (v20+ recommended) and npm installed:

```sh
# Clone repository
git clone <repository-url>
cd sparrowxdbs

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quality Checks

```sh
# Run type checking
npx tsc --noEmit

# Run unit tests
npm run test

# Run linter
npm run lint

# Build production bundle
npm run build
```

---

## Server Deployment, Updater & L3/L4 DDoS XDP Links

Run any SparrowX installer or DDoS defense script directly over HTTPS (`https://sparrowx.net/...`) or from a cloned repository (`/opt/sparrowxdbs`):

| Purpose | Single-Line Command | Repo File |
|---|---|---|
| Full A-to-Z Stack + Build Setup | `curl -sSL https://sparrowx.net/setup.sh \| sudo bash` | [setup.sh](setup.sh) / [public/setup.sh](public/setup.sh) |
| Single-File DDoS + XDP/eBPF Setup | `curl -sSL https://sparrowx.net/ddos-setup.sh \| sudo bash` | [deploy/ddos-setup.sh](deploy/ddos-setup.sh) |
| XDP/eBPF Kernel C Scrubber | `curl -sSL https://sparrowx.net/xdp/sparrowx_xdp_ddos.c -o sparrowx_xdp_ddos.c` | [deploy/xdp/sparrowx_xdp_ddos.c](deploy/xdp/sparrowx_xdp_ddos.c) |
| XDP Compiler & NIC Loader | `curl -sSL https://sparrowx.net/xdp/attach-xdp.sh \| sudo bash -s -- --attach` | [deploy/xdp/attach-xdp.sh](deploy/xdp/attach-xdp.sh) |
| Updater, Rebuild & DDoS Sync | `curl -sSL https://sparrowx.net/update.sh \| sudo bash` | [update.sh](update.sh) |
| Autonomous 12-Stage Auto-Heal Doctor | `curl -sSL https://sparrowx.net/fix.sh \| sudo bash -s -- --auto` | [fix.sh](fix.sh) |
| Total Infrastructure Audit (11 Layers) | `curl -sSL https://sparrowx.net/verification.sh \| sudo bash` | [verification.sh](verification.sh) / [public/verification.sh](public/verification.sh) |
| Self-Hosted Open-Source SMTP (Postfix + DKIM) | `curl -sSL https://sparrowx.net/smtp-setup.sh \| sudo bash` | [deploy/smtp-setup.sh](deploy/smtp-setup.sh) / [public/smtp-setup.sh](public/smtp-setup.sh) |
| VPS Telemetry Connector (+optional XDP) | `curl -sSL https://sparrowx.net/install-connector.sh \| SPX_KEY=... SPX_TENANT=... SPX_ENABLE_DDOS=1 bash` | [public/install-connector.sh](public/install-connector.sh) |

Global CLI symlinks installed on Ubuntu/Debian hosts: `sparrowx-setup`, `sparrowx-ddos`, `sparrowx-xdp`, `sparrowx-update`, `sparrowx-fix`, `sparrowx-doctor`, `sparrowx-verify`, `sparrowx-db`, `sparrowx-heal`.

---

## License & Sovereignty

Proprietary software developed for **SparrowX Security Operations**. All data sovereignty and encryption keys remain in your sovereign infrastructure.
