export type ServiceDocId = "db" | "infra" | "shield" | "game" | "drop" | "keys" | "api";

export interface ServiceDocSection {
  id: string;
  title: string;
  summary: string;
  bullets?: string[];
  code?: {
    label: string;
    language: string;
    snippet: string;
  };
}

export interface ServiceDocSpec {
  id: ServiceDocId;
  name: string;
  tagline: string;
  domain: string;
  launchPath: string;
  logo: string;
  accentClass: string;
  badgeClass: string;
  sections: ServiceDocSection[];
}

export const SERVICE_DOCS: Record<ServiceDocId, ServiceDocSpec> = {
  db: {
    id: "db",
    name: "SparrowX Cloud DB",
    tagline: "Managed Sovereign PostgreSQL 16, PgBouncer Pooler, PostgREST Data API & pgvector",
    domain: "db.sparrowx.net",
    launchPath: "/db",
    logo: "/logos/sparrowx-db.png",
    accentClass: "text-[#A3E635]",
    badgeClass: "bg-[#A3E635]/15 border-[#A3E635]/35 text-[#A3E635]",
    sections: [
      {
        id: "quickstart",
        title: "1. Quickstart & Connection Strings",
        summary:
          "Every SparrowX Cloud DB account provisions an isolated PostgreSQL 16 database with PgBouncer transaction pooling on port 6543 and direct TLS connections on port 5432.",
        bullets: [
          "Sign in with Google at https://db.sparrowx.net to open your Studio Console.",
          "Your dedicated database credentials and TLS URI are available under Overview -> Connect.",
          "Use port 6543 for serverless/edge functions and port 5432 for migrations and long-lived pools.",
        ],
        code: {
          label: ".env",
          language: "bash",
          snippet: `# Direct PostgreSQL 16 connection (migrations & Prisma)
DATABASE_URL="postgresql://<db_user>:<db_password>@db.sparrowx.net:5432/<db_name>?sslmode=require"

# PgBouncer Pooled connection (high-concurrency apps)
POOLER_URL="postgresql://<db_user>:<db_password>@db.sparrowx.net:6543/<db_name>?sslmode=require&pgbouncer=true"`,
        },
      },
      {
        id: "sdk-prisma",
        title: "2. Connect from Node.js, Next.js or Prisma",
        summary:
          "SparrowX Cloud DB speaks 100% standard PostgreSQL wire protocol — no proprietary driver lock-in.",
        code: {
          label: "src/db.ts",
          language: "typescript",
          snippet: `import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 15,
});

const { rows } = await pool.query("SELECT NOW() AS server_time;");
console.log(rows[0]);`,
        },
      },
      {
        id: "rest-api",
        title: "3. Instant PostgREST Data API",
        summary:
          "Query any table in your public schema over HTTPS using your personal SparrowX API key generated in Studio Settings.",
        code: {
          label: "curl",
          language: "bash",
          snippet: `curl -s "https://api.sparrowx.net/rest/v1/projects?select=*&limit=20" \\
  -H "apikey: spx_live_your_personal_key" \\
  -H "Authorization: Bearer spx_live_your_personal_key"`,
        },
      },
      {
        id: "pgvector",
        title: "4. AI Vector Search (pgvector)",
        summary:
          "Enable native vector similarity search directly inside your PostgreSQL tables for RAG and semantic search.",
        code: {
          label: "SQL Editor",
          language: "sql",
          snippet: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  embedding VECTOR(1536)
);

CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);`,
        },
      },
      {
        id: "backups-cli",
        title: "5. Automated Backups & Terminal TUI",
        summary:
          "Manage tables, trigger logical backups, and inspect live row counts directly on your OVH Linux host using the built-in CLI.",
        code: {
          label: "Linux Server CLI",
          language: "bash",
          snippet: `# Open the interactive Supabase-style Database TUI
sudo sparrowx-db

# Export full compressed backup of all databases
sudo bash /opt/sparrowxdbs/deploy/backup-all-dbs.sh`,
        },
      },
    ],
  },

  infra: {
    id: "infra",
    name: "SparrowX Cloud Infra",
    tagline: "Bare Metal, Dedicated Servers, KVM NVMe VPS, Proxmox VE Panel & UPI Auto-Pay",
    domain: "infra.sparrowx.net",
    launchPath: "/infra",
    logo: "/logos/sparrowx-main.png",
    accentClass: "text-sky-400",
    badgeClass: "bg-sky-500/15 border-sky-400/35 text-sky-300",
    sections: [
      {
        id: "deploy",
        title: "1. Deploying Bare Metal, Dedicated & KVM VPS",
        summary:
          "Choose from Bare Metal, Dedicated Servers, or Cloud KVM NVMe VPS plans at https://infra.sparrowx.net, configure your hostname, OS image, and region, then complete checkout with Unified UPI Auto-Confirmation.",
        bullets: [
          "Supported OS images: Ubuntu 24.04 LTS, Debian 12, Rocky Linux 9, AlmaLinux 9, and Proxmox-ready templates.",
          "After checkout completes, your server appears immediately inside the SparrowX Cloud Panel (/infra/dashboard).",
          "Zero mock servers: the dashboard remains empty until you provision your first real server.",
        ],
      },
      {
        id: "proxmox-link",
        title: "2. Connecting Your Proxmox VE Cluster",
        summary:
          "Bind your OVH Proxmox VE host in /opt/sparrowxdbs/.env to enable real-time VM start/stop/reboot, Cloud-Init OS reinstalls, snapshots, and live CPU/RAM/disk telemetry.",
        code: {
          label: "/opt/sparrowxdbs/.env",
          language: "bash",
          snippet: `PROXMOX_API_URL="https://pve.yourdomain.com:8006"
PROXMOX_API_TOKEN_ID="sparrowx@pam!infra-panel"
PROXMOX_API_TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
PROXMOX_NODE="pve"
PROXMOX_VERIFY_TLS="false"`,
        },
      },
      {
        id: "ssh-network",
        title: "3. Browser SSH, SSH Keys & Reverse DNS",
        summary:
          "Manage root access, inject ED25519 SSH public keys, rotate passwords, and configure IPv4/IPv6 rDNS records directly from /infra/dashboard.",
        code: {
          label: "Generate ED25519 Key",
          language: "bash",
          snippet: `ssh-keygen -t ed25519 -C "ops@yourdomain.com"
cat ~/.ssh/id_ed25519.pub   # Paste into Cloud Panel -> SSH & Web Terminal`,
        },
      },
      {
        id: "upi-autopay",
        title: "4. Unified UPI Auto-Confirmation Billing",
        summary:
          "Configure your merchant UPI VPA and webhook secret to auto-verify UPI QR / deep-link top-ups across Cloud Infra, Cloud DB, and Game Hosting.",
        code: {
          label: "/opt/sparrowxdbs/.env",
          language: "bash",
          snippet: `SPARROWX_UPI_VPA="sparrowx@okhdfcbank"
SPARROWX_UPI_MERCHANT_NAME="SparrowX Cloud"
SPARROWX_UPI_WEBHOOK_SECRET="replace_with_32_char_secret"`,
        },
      },
    ],
  },

  shield: {
    id: "shield",
    name: "SparrowX Shield & Network DDoS",
    tagline: "XDP/eBPF Wire-Speed Scrubbing, Linux Master NOC TUI & Client VPS/Game Protection",
    domain: "sec.sparrowx.net",
    launchPath: "/shield",
    logo: "/logos/sparrowx-sec.png",
    accentClass: "text-rose-400",
    badgeClass: "bg-rose-500/15 border-rose-400/35 text-rose-300",
    sections: [
      {
        id: "noc-tui",
        title: "1. Linux Master Cybersecurity Terminal Dashboard (sparrowx-noc)",
        summary:
          "Monitor live incoming/outgoing Mbps & PPS, XDP/eBPF packet drops, active IP connections, protected WireGuard/game proxies, and real-time firewall logs directly inside your Linux terminal.",
        bullets: [
          "Pane 1: Live RX/TX sparklines, Peak rates, XDP drop %, /proc/net/snmp L3/L4 counters & Conntrack.",
          "Pane 2: WireGuard tunnels (spx_*), protected Minecraft/FiveM/SA-MP/MTA/VPS edge proxies & open ports.",
          "Pane 3 & 4: Active IP talkers + Live Split Blocklist & Whitelist Manager ([w] Whitelist, [W] Unwhitelist, [b] Ban, [u] Unban, [c] Cycle Theme).",
        ],
        code: {
          label: "Launch Linux Master NOC",
          language: "bash",
          snippet: `# On your SparrowX OVH Server
sudo sparrowx-noc

# Switch theme or run a one-shot ANSI snapshot
sudo sparrowx-noc --theme emerald
sudo sparrowx-noc --once`,
        },
      },
      {
        id: "client-gen",
        title: "2. Protecting Client VPS & Game Servers (sparrowx-gen-client)",
        summary:
          "Place your SparrowX Edge server directly in front of any client's Linux VPS, Minecraft, FiveM, SA-MP, or MTA:SA server — even if they host on a third-party game panel with no root access.",
        code: {
          label: "Interactive Protection Wizard",
          language: "bash",
          snippet: `# Launch the 8-step interactive wizard (asks Client IP, Ports & Game/VPS Profile)
sudo sparrowx-gen-client

# List active client proxies or remove one cleanly
sudo sparrowx-gen-client --list
sudo sparrowx-gen-client --remove <agent_id>`,
        },
      },
      {
        id: "xdp-setup",
        title: "3. Attaching the XDP / eBPF Anti-DDoS Kernel Filter",
        summary:
          "Compile and attach SparrowX's verifier-safe XDP C filter to drop volumetric UDP floods and invalid protocol handshakes before sk_buff allocation.",
        code: {
          label: "Install & Verify XDP",
          language: "bash",
          snippet: `curl -sSL https://sparrowx.net/ddos-setup.sh | sudo bash
sudo sparrowx-xdp --status`,
        },
      },
    ],
  },

  game: {
    id: "game",
    name: "SparrowX Game Hosting",
    tagline: "FiveM, SA-MP, Minecraft & Bot Hosting with Google Sign-In & Pterodactyl SSO",
    domain: "game.sparrowx.net",
    launchPath: "/game",
    logo: "/logos/sparrowx-main.png",
    accentClass: "text-amber-400",
    badgeClass: "bg-amber-500/15 border-amber-400/35 text-amber-300",
    sections: [
      {
        id: "google-sso",
        title: "1. Google Sign-In & Client Area",
        summary:
          "All Game Hosting accounts authenticate exclusively via Google Sign-In (/api/auth/google/login), linked automatically to your SparrowX Master SSO session and Pterodactyl panel user.",
        bullets: [
          "Click 'Continue with Google' on https://game.sparrowx.net to open your live Client Area (/game/dashboard).",
          "New accounts start cleanly at 0 SparrowCoins and 0 servers — no simulated demo data.",
          "1 SparrowCoin = ₹1 INR; top up via Razorpay UPI/cards or redeem an active database promo code.",
        ],
      },
      {
        id: "ptero-sso",
        title: "2. One-Click Pterodactyl Panel Auto-Login",
        summary:
          "Click 'Panel Auto-Login' in your Client Area to sign straight into game.panel.sparrowx.net via HMAC-signed short-lived SSO tokens without typing a separate password.",
        code: {
          label: "/opt/sparrowxdbs/.env",
          language: "bash",
          snippet: `PTERO_URL="https://game.panel.sparrowx.net"
PTERO_APPLICATION_API_KEY="ptla_your_application_key"
PTERO_CLIENT_API_KEY="ptlc_your_client_key"
PTERO_SSO_SECRET="your_shared_hmac_secret"`,
        },
      },
      {
        id: "game-ddos",
        title: "3. Game-Aware L4 DDoS Protection (FiveM / Minecraft / SA-MP)",
        summary:
          "Every hosted game node runs behind SparrowX GameSec L4 filtering with stateful UDP challenge cookies for FiveM (30120), SA-MP (7777), MTA (22003), and Minecraft (25565/19132).",
      },
    ],
  },

  drop: {
    id: "drop",
    name: "SparrowX Drop & Vault",
    tagline: "Zero-Login RAM Ephemeral Transfers & 10 GB Persistent Encrypted Cloud Vault",
    domain: "file.sparrowx.net",
    launchPath: "/drop",
    logo: "/logos/sparrowx-file.png",
    accentClass: "text-violet-400",
    badgeClass: "bg-violet-500/15 border-violet-400/35 text-violet-300",
    sections: [
      {
        id: "ephemeral",
        title: "1. Zero-Login Ephemeral RAM Drops",
        summary:
          "Drop any file up to 100 MB at https://file.sparrowx.net without signing in. Files live strictly in volatile server memory and self-destruct automatically after download or expiry.",
      },
      {
        id: "vault",
        title: "2. Persistent 10 GB Encrypted Vault",
        summary:
          "Sign in with Google to unlock your persistent NVMe Vault with permanent shareable /f/<id> download links, instant revocation, and built-in payload malware scanning.",
      },
    ],
  },

  keys: {
    id: "keys",
    name: "SparrowX Offline Keys",
    tagline: "Zero-Knowledge Browser-Only AES-256-GCM Password & Secret Vault",
    domain: "password.sparrowx.net",
    launchPath: "/keys",
    logo: "/logos/sparrowx-password.png",
    accentClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/15 border-emerald-400/35 text-emerald-300",
    sections: [
      {
        id: "zero-knowledge",
        title: "1. Zero-Knowledge Local Encryption",
        summary:
          "All encryption and decryption happen strictly inside your browser using the Web Crypto API (PBKDF2 key derivation + AES-256-GCM). Your master passphrase and plaintext secrets never touch SparrowX servers.",
      },
      {
        id: "backup-export",
        title: "2. Portable Encrypted Vault Export & Recovery",
        summary:
          "Export your encrypted vault bundle anytime as a portable JSON file and import it on any offline device without creating a cloud account.",
      },
    ],
  },

  api: {
    id: "api",
    name: "SparrowX API Gateway",
    tagline: "Authenticated Private REST API, PostgREST Filtering & Unified Google SSO",
    domain: "api.sparrowx.net",
    launchPath: "/gateway",
    logo: "/logos/sparrowx-api.png",
    accentClass: "text-cyan-400",
    badgeClass: "bg-cyan-500/15 border-cyan-400/35 text-cyan-300",
    sections: [
      {
        id: "auth-headers",
        title: "1. Authentication & Personal API Keys",
        summary:
          "For security, SparrowX never exposes database schemas or endpoints anonymously. Sign in with Google at https://api.sparrowx.net to generate your personal `spx_` API key.",
        code: {
          label: "Authenticated Request",
          language: "bash",
          snippet: `curl -s "https://api.sparrowx.net/rest/v1/protected_services?select=id,name,endpoint" \\
  -H "apikey: spx_live_your_key" \\
  -H "Authorization: Bearer spx_live_your_key"`,
        },
      },
      {
        id: "client-protect-api",
        title: "2. Client VPS Protection API",
        summary:
          "Programmatically generate bound client VPS protection installers and collect 60-second health heartbeats.",
        code: {
          label: "Generate Protection Bundle",
          language: "bash",
          snippet: `curl -X POST "https://sparrowx.net/api/client-protect/generate" \\
  -H "Content-Type: application/json" \\
  -H "X-SparrowX-Admin-Key: $SPARROWX_ADMIN_API_KEY" \\
  -d '{"username":"acme_prod","email":"ops@acme.io","ports":"80,443","format":"script"}' \\
  -o sparrowx-protect-acme.sh`,
        },
      },
    ],
  },
};

export const SERVICE_DOC_LIST: ServiceDocSpec[] = [
  SERVICE_DOCS.db,
  SERVICE_DOCS.infra,
  SERVICE_DOCS.shield,
  SERVICE_DOCS.game,
  SERVICE_DOCS.drop,
  SERVICE_DOCS.keys,
  SERVICE_DOCS.api,
];

export function isValidServiceDocId(value: string): value is ServiceDocId {
  return value in SERVICE_DOCS;
}
