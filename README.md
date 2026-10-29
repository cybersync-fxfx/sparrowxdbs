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
* **Autonomous Billing & Security Credits**: Automated credit-metered service provisioning, transaction ledger, and payment gateway backed by Supabase PostgreSQL.
* **Live Supabase PostgreSQL Backend**: Full row-level security (RLS) schema supporting incidents, threat feeds, assets, vulnerabilities, audit logs, and client subscriptions.

---

## Architecture & Technology Stack

* **Framework**: React 19, TanStack Router, TanStack React Query, Vite 8.
* **Database & Persistence**: Supabase PostgreSQL with REST API and offline cache fallback.
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

## License & Sovereignty

Proprietary software developed for **SparrowX Security Operations**. All data sovereignty and encryption keys remain in your sovereign infrastructure.
