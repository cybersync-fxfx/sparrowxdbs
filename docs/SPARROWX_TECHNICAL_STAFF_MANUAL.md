# SparrowX — Enterprise Technical Staff Operational Manual
**Version:** 2.4.0-Production  
**Author:** SparrowX Engineering Team  
**Scope:** Architecture, Security Enforcement, Onboarding Workflows, and Troubleshooting Playbooks

---

## 1. Executive Summary & Core Purpose

**SparrowX** is an autonomous cybersecurity operations platform, edge reverse proxy, and sovereign database engine. It acts as an intelligent security perimeter placed in front of websites, cloud APIs, generative AI agents, and PostgreSQL databases.

### The Problem It Solves:
When companies deploy websites, APIs, and AI models on the open internet (e.g., bare-metal OVHcloud servers, AWS, or local VPSs), their servers are constantly hit by automated bots, port scanners, SQL injections, volumetric DDoS bursts, and prompt injection jailbreaks.

### How SparrowX Solves It:
SparrowX sits between the public internet and your origin servers. Every request is inspected in under **2 milliseconds**:
1. **Malicious traffic** (hackers, botnets, prompt exploits) is dropped or quarantined at the edge.
2. **Clean traffic** is forwarded to your origin server.
3. **Outbound responses** are scrubbed for sensitive data leaks (PII, API keys) before returning to the user.

---

## 2. Platform Architecture

```
                                 [ PUBLIC INTERNET ]
                                          │
                        (Inbound HTTP / HTTPS / AI Prompts)
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    SPARROWX AUTONOMOUS EDGE SHIELD    │
                      ├───────────────────────────────────────┤
                      │  • DDoS / Rate Limiter (Token Bucket) │
                      │  • OWASP WAF (SQLi, XSS, RCE Filter)  │
                      │  • AI Prompt Shield (Jailbreak Guard) │
                      │  • Port & Protocol Inspector          │
                      └───────────────────┬───────────────────┘
                                          │
               ┌──────────────────────────┼──────────────────────────┐
               │ (Clean Requests Forward) │                          │
               ▼                          ▼                          ▼
    ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
    │ 1. Web App / API   │     │ 2. AI / LLM Agent  │     │ 3. Sovereign DB    │
    │ (Origin Server)    │     │ (OpenAI / Claude)  │     │ (PostgreSQL 5432)  │
    └──────────┬─────────┘     └──────────┬─────────┘     └──────────┬─────────┘
               │                          │                          │
               └──────────────────────────┼──────────────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │     OUTBOUND DATA SANITIZATION        │
                      │  • PII Masking (SSN, Cards, Emails)   │
                      │  • API Key & Credential Leak Filter   │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                                   [ END USER ]
```

---

## 3. How Protection Actually Works: The "Back-and-Forth" Flow

> [!IMPORTANT]  
> **Key Technical Rule:** Simply entering a domain name into the SparrowX dashboard registers the service's identity, creates its cryptographic keys, and allocates its telemetry slot. **To actually protect traffic**, all traffic must pass through the SparrowX inspection pipeline.

There are two primary integration methods supported:

### Method A: Edge Reverse Proxy (Zero-Code / DNS Routing)
This is the standard approach for public websites and API servers.
1. The client registers their domain (e.g., `api.acme.com`).
2. The client updates their DNS provider (Cloudflare, GoDaddy, Route53) with a **CNAME record**:
   ```
   CNAME  api.acme.com  ➔  proxy.sparrowx.net
   ```
3. When a visitor requests `https://api.acme.com/users`, DNS routes the request to SparrowX edge servers first.
4. SparrowX inspects the headers, query parameters, and payload body:
   - If SQL injection or abnormal payload is detected: Returns `HTTP 403 Forbidden` instantly.
   - If clean: Forwards request to client's origin server IP (e.g. `51.68.21.44`).
5. The origin server responds. SparrowX inspects the response to ensure no database connection strings or secrets are leaked, then returns the safe response to the visitor.

### Method B: Native SDK & Middleware (For AI Agents, Next.js, Express, Python)
For serverless apps or backend AI agents making LLM calls, install the SparrowX middleware directly:

#### 1. Next.js Edge Middleware (`middleware.ts`):
```typescript
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Evaluates request url and payloads against SparrowX live signatures
  const isBlocked = checkSparrowxShield(request);
  if (isBlocked) {
    return new NextResponse(JSON.stringify({ error: "Blocked by SparrowX Edge Shield" }), { status: 403 });
  }
  return NextResponse.next();
}
```

#### 2. Python AI Agent Guardrail (`sparrowx_guardrail.py`):
```python
from sparrowx_guardrail import SparrowXShield

shield = SparrowXShield(api_key="spx_live_xyz", service_id="srv-123")

# 1. Inspect user prompt before LLM invocation
safe_prompt = shield.scan_prompt(user_input) # Catches jailbreaks, strips PII

# 2. Call Model
response = openai.chat.completions.create(model="gpt-4", messages=[{"role": "user", "content": safe_prompt}])

# 3. Verify MCP tool call before execution
shield.verify_mcp_tool_call(tool_name="bash_command", tool_args={"cmd": "ls -la"})
```

---

## 4. Complete Configuration Switches Reference

Every service in SparrowX has dedicated protection toggles in the **Web & AI Shield** module:

| Switch / Setting | Options | What it Does Under the Hood |
| :--- | :--- | :--- |
| **Shield Enforcement Mode** | `Active Shield` vs `Monitor` | **Active:** Drops malicious packets with HTTP 403/429.<br>**Monitor:** Logs threats to SIEM without interrupting traffic (used during dry runs). |
| **Prompt Shield** | `Enabled` / `Disabled` | Runs deep semantic pattern matching against known LLM jailbreak tactics (`ignore previous instructions`, `DAN mode`, developer overrides). |
| **PII Redaction** | `Enabled` / `Disabled` | In-flight regex scrubbing replacing Credit Cards, Social Security Numbers, and Passwords with `[REDACTED]`. |
| **Rate Limiting** | `10 to 10,000 req/min` | Token-bucket algorithm per client IP. Excess traffic receives `HTTP 429 Too Many Requests`. |
| **MCP Tool Firewall** | `Strict` / `Permissive` | Enforces allowlists on autonomous AI agent tool calls. Blocks dangerous primitives like `rm -rf`, raw SQL execution, or socket creation. |
| **Asset Isolation** | `Protected` vs `Isolated` | Kill-switch. Instantly severs a host's network connectivity in the mesh if lateral intrusion is detected. |

---

## 5. Reading the 2D Dot-Matrix Threat Map

The 2D Equirectangular Threat Map provides live situational awareness across your network:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [● HOST: Roubaix (OVH Host) · IP: 51.68.21.44 · Ports: 80, 443, 8443]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   (Visitor: Seoul, KR) ───[Parabolic Laser Arc]───► (⭐ YOUR HOST)     │
│   IP: 175.208.44.12:51842 ➔ Port: 443/TLS [INTERCEPTED]               │
│                                                                        │
│   Continents: High-visibility silver dot matrix (#94a3b8)              │
│   Host Beacon: Pulsing dual concentric radar shockwaves                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Host Beacons (Golden Nodes)**: Represent your active hosting hubs. Concentric radar waves indicate active listening on ports 80, 443, 8443, 22, and 5432.
2. **Visitor / Threat Nodes (Cyan/Red Nodes)**: Inbound connections from external networks.
3. **Curved Parabolic Arcs**: Show real-time traffic trajectories with inline HUD tags displaying:
   `[Country] ([Client IP]:[Port]) ➔ HOST:[Target Port] ([Protocol])`
4. **Real-Time Host Connections Feed**: Chronological stream of all intercepted packets with status (`BLOCKED`, `INTERCEPTED`, `QUARANTINED`).

---

## 6. Standard Technical Staff Onboarding Checklist

When a client or colleague asks you to onboard a new website or AI service, follow these exact steps:

1. **Log in** to SparrowX Dashboard with your administrator or authorized tenant account.
2. Navigate to **Web & AI Shield** → click **Register Protected Service**.
3. Fill in:
   - **Service Name**: e.g., `Production Storefront API`.
   - **Endpoint / Domain**: e.g., `https://api.store.com`.
   - **Origin Real IP**: The actual server IP where the app runs (e.g., `51.68.21.44`).
4. Select category: `Web Application`, `API Gateway`, or `AI Agent / LLM`.
5. Click **Deploy Shield**. Copy the generated API Key (`spx_live_...`).
6. Give the client their integration instructions:
   - For DNS: Set CNAME to `proxy.sparrowx.net`.
   - For Next.js/Express/Python: Copy the generated SDK code from the **Client Connectors** tab.
7. Verify on the **Global Traffic Mesh Map** that inbound packets appear with latency and HTTP status code.

---

## 7. Emergency Response Playbook

### Scenario A: Volumetric DDoS Attack
1. Open **SOC Command** → **Live Operations**.
2. Identify target origin host.
3. Toggle Rate Limiting from `1000/min` down to `150/min`.
4. Click **Export Blocked IPs** and import the list into upstream Cloudflare or server `iptables`.

### Scenario B: Compromised Host or Rogue Agent
1. Open **Infrastructure Assets**.
2. Locate the impacted server asset.
3. Click **Isolate Asset**. The server is immediately severed from the SparrowX mesh to stop lateral spread.
4. Review audit logs in **Activity History** to inspect the root cause.

---
*SparrowX Autonomous Security Operations Platform — Confidential & Internal Use Only.*
