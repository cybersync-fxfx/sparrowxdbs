# SparrowX Dual Platform: Deployment & Business Architecture Guide

This manual specifies how to deploy and operate the dual-engine business model on a single **64 GB RAM / 8-Core / 2 TB NVMe VPS**:
1. **SparrowX Security**: Edge Reverse Proxy, WAF, DDoS Mitigation & AI Prompt Guardrails.
2. **SparrowX DB**: Sovereign Database-as-a-Service (PostgreSQL 16 + pgvector + PgBouncer + PostgREST + Instant API Keys).

---

## 1. Hardware Resource Allocation (64 GB RAM / 8 Cores / 2 TB NVMe)

| Subsystem | CPU Allocation | RAM Limit | Disk Footprint | Primary Role |
| :--- | :--- | :--- | :--- | :--- |
| **SparrowX PostgreSQL 16 + pgvector** | 5 Cores | 40 GB (16GB shared buffers) | Up to 1.8 TB | Primary transactional DB, AI embeddings, customer schemas |
| **PgBouncer (Connection Pooler)** | 1.5 Cores | 2 GB | Minimal | Sustains up to **5,000 active concurrent client connections** |
| **PostgREST (Auto-REST Engine)** | 1.5 Cores | 3 GB | Minimal | Instant auto-generated OpenAPI & REST endpoints |
| **SparrowX Security Edge Proxy (Caddy/WAF)**| 2 Cores | 4 GB | Minimal | TLS termination, DDoS filtering, bot throttling, HTTP/3 |
| **Threat Cache (Redis 7)** | 1 Core | 2 GB | ~5 GB | IP rate-limiting, blocked token blacklist, session cache |
| **SparrowX Studio / Management UI** | 1 Core | 2 GB | ~1 GB | Web dashboard, client portal, SQL editor |
| **OS & Headroom Buffer** | Shared | ~11 GB | ~150 GB | Linux OS cache, kernel buffers, backup staging |

> **Verdict**: 64 GB RAM and 8 cores is more than enough to comfortably power **50 to 100+ active client database projects** alongside the high-throughput edge security proxy.

---

## 2. Quick Deploy on Ubuntu 22.04 / 24.04 VPS

### Step 1: Install Docker & Docker Compose
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Step 2: Clone Repository & Configure Environment
```bash
git clone https://github.com/your-org/sparrowxdbs.git
cd sparrowxdbs

# Copy environment variables
cp .env.example .env
```

Set your production secrets inside `.env`:
```env
POSTGRES_DB=sparrowbase
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YourStrongDatabasePassword2026!
SPARROWX_JWT_SECRET=super-secure-at-least-32-chars-jwt-secret-string
SPARROWX_REDIS_SECRET=YourStrongRedisPassword2026!
DOMAIN_STUDIO=studio.yourdomain.com
DOMAIN_API=api.yourdomain.com
```

### Step 3: Launch Dual Platform Services
```bash
docker compose -f docker-compose.sparrowx.yml up -d
```

### Step 4: Verify Running Services
```bash
docker compose -f docker-compose.sparrowx.yml ps
```

---

## 3. How External Projects Connect to SparrowX DB

Every created project provides external clients with two API keys and two connection strings:

### 1. Connection Strings (for ORMs and Direct Backends)
- **Direct PostgreSQL URL** (Direct connection):
  `postgresql://postgres:[PASSWORD]@vps-ip:5432/sparrowbase`
- **PgBouncer Pooled URL** (Serverless, Next.js, Vercel, AWS Lambda):
  `postgresql://postgres:[PASSWORD]@vps-ip:6543/sparrowbase?pgbouncer=true`

### 2. Client SDK Integration (Next.js / TypeScript)
Clients can use standard Supabase SDK directly:
```typescript
import { createClient } from '@supabase/supabase-js';

const sparrowxUrl = 'https://api.yourdomain.com';
const sparrowxAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const db = createClient(sparrowxUrl, sparrowxAnonKey);

// Fetch data with sub-millisecond latency
const { data, error } = await db.from('products').select('*');
```

---

## 4. Business Model & Packaging

| Plan | Target Customer | Features Included | Monthly Price |
| :--- | :--- | :--- | :--- |
| **SparrowX Security Starter** | Websites & APIs | WAF, DDoS edge shield, SSL, 500k req/mo | **$29 / mo** |
| **SparrowX DB Pro** | Developers & Startups | 1 Dedicated DB, pgvector, 10GB NVMe, PgBouncer | **$49 / mo** |
| **SparrowX Sovereign Bundle** | AI & SaaS Scale-ups | **Both Security & DBaaS**: WAF + pgvector DB + 100GB NVMe | **$149 / mo** |
| **Dedicated Private VPS** | Enterprise & Gov | Dedicated 64GB node on client infrastructure, custom SLA | **$499+ / mo** |
