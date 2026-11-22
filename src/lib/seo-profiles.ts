export type SeoProfileKey =
  | "master"
  | "shield"
  | "game"
  | "infra"
  | "db"
  | "drop"
  | "keys";

export interface SeoProfile {
  key: SeoProfileKey;
  siteName: string;
  canonicalUrl: string;
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  twitterTitle: string;
  twitterDescription: string;
  iconHref: string;
  robots: string;
  jsonLd: Record<string, unknown>;
}

const LASTMOD = "2026-11-22";

export const SEO_PROFILES: Record<SeoProfileKey, SeoProfile> = {
  /**
   * MASTER BRAND HUB — ONLY ranks for SparrowX brand & ecosystem queries.
   * Deliberately avoids competing with generic "security", "hosting", "database",
   * "file sharing", or "password generator" queries owned by dedicated subdomains.
   */
  master: {
    key: "master",
    siteName: "SparrowX",
    canonicalUrl: "https://sparrowx.net/",
    title: "SparrowX — Official Cloud, Security & Developer Platform (sparrowx.net)",
    description:
      "Official SparrowX Technologies hub. Launch SparrowX Shield, SparrowX Game Hosting, SparrowX Cloud Infra, SparrowX Cloud DB, SparrowX Drop, SparrowX Keys, and your unified SparrowX Client Area.",
    keywords:
      "sparrowx, sparrowx.net, sparrowx technologies, sparrowx cloud, sparrowx client area, sparrowx login, sparrowx ecosystem",
    ogTitle: "SparrowX — Official Sovereign Cloud & Security Ecosystem",
    ogDescription:
      "Access the complete SparrowX Technologies product suite from one official portal — dedicated subdomains for security, game hosting, cloud infrastructure, databases, encrypted file transfer, and offline cryptography.",
    ogImage: "https://sparrowx.net/logos/sparrowx-main.jpg",
    ogImageAlt: "SparrowX Technologies Official Platform Logo",
    twitterTitle: "SparrowX — Official Cloud & Security Ecosystem",
    twitterDescription:
      "Official hub for SparrowX Technologies products and the unified SparrowX Client Area.",
    iconHref: "/sparrowx-logo.png",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://sparrowx.net/#organization",
          name: "SparrowX Technologies",
          alternateName: "SparrowX",
          url: "https://sparrowx.net/",
          logo: {
            "@type": "ImageObject",
            url: "https://sparrowx.net/logos/sparrowx-main.jpg",
            width: 512,
            height: 512,
            caption: "SparrowX Technologies Official Emblem",
          },
          image: "https://sparrowx.net/logos/sparrowx-main.jpg",
          description:
            "SparrowX Technologies builds independent, high-performance cloud products across dedicated subdomains: SparrowX Shield (sec.sparrowx.net), SparrowX Game Hosting (sparrowx.net/game), SparrowX Cloud Infra (infra.sparrowx.net), SparrowX Cloud DB (db.sparrowx.net), SparrowX Drop (file.sparrowx.net), and SparrowX Keys (password.sparrowx.net).",
          email: "support@sparrowx.net",
          sameAs: ["https://x.com/sparrowx", "https://github.com/cybersync-fxfx/sparrowxdbs"],
          contactPoint: {
            "@type": "ContactPoint",
            email: "support@sparrowx.net",
            contactType: "customer service",
            availableLanguage: ["English"],
          },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "SparrowX Product Ecosystem",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "SoftwareApplication",
                  name: "SparrowX Shield",
                  url: "https://sec.sparrowx.net/",
                  applicationCategory: "SecurityApplication",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "SparrowX Game Hosting",
                  url: "https://sparrowx.net/game",
                  serviceType: "Game Server Hosting",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "SparrowX Cloud Infra",
                  url: "https://infra.sparrowx.net/",
                  serviceType: "Bare Metal & KVM VPS Hosting",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "SoftwareApplication",
                  name: "SparrowX Cloud DB",
                  url: "https://db.sparrowx.net/",
                  applicationCategory: "DeveloperApplication",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "WebApplication",
                  name: "SparrowX Drop",
                  url: "https://file.sparrowx.net/",
                  applicationCategory: "UtilitiesApplication",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "WebApplication",
                  name: "SparrowX Keys",
                  url: "https://password.sparrowx.net/",
                  applicationCategory: "SecurityApplication",
                },
              },
            ],
          },
        },
        {
          "@type": "WebSite",
          "@id": "https://sparrowx.net/#website",
          url: "https://sparrowx.net/",
          name: "SparrowX",
          description: "Official SparrowX Technologies hub and unified client portal.",
          publisher: { "@id": "https://sparrowx.net/#organization" },
        },
      ],
    },
  },

  /**
   * SECURITY OWNER — Exclusively owns cybersecurity, website security scanner,
   * WAF, DDoS protection, AI guardrails, and malware scanning.
   */
  shield: {
    key: "shield",
    siteName: "SparrowX Shield",
    canonicalUrl: "https://sec.sparrowx.net/",
    title: "SparrowX Shield — Website Security Scanner, Edge WAF & DDoS Protection",
    description:
      "Protect websites, APIs, and AI agents with SparrowX Shield (sec.sparrowx.net). Run a free 8-tool deep website security scan, deploy sub-millisecond Layer-7 WAF & DDoS protection, and block SQLi, XSS, and prompt injection.",
    keywords:
      "website security, website security scanner, free security scan, web application firewall, edge waf, ddos protection, cybersecurity platform, vulnerability scanner, malware scanner, ai security guardrails, prompt injection defense, ssl tls audit, sparrowx shield, sec.sparrowx.net",
    ogTitle: "SparrowX Shield — Website Security Scanner, Edge WAF & DDoS Defense",
    ogDescription:
      "Run a free 8-tool deep website security audit and deploy automated Layer-7 WAF, DDoS mitigation, and AI prompt-injection protection at sec.sparrowx.net.",
    ogImage: "https://sec.sparrowx.net/logos/sparrowx-shield.jpg",
    ogImageAlt: "SparrowX Shield — Website Security Scanner, Edge WAF & DDoS Protection",
    twitterTitle: "SparrowX Shield — Website Security, Edge WAF & DDoS Protection",
    twitterDescription:
      "Free deep website security scanner, Layer-7 WAF, DDoS mitigation, and real-time threat interception at sec.sparrowx.net.",
    iconHref: "/sparrowx-shield-logo.svg",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": "https://sec.sparrowx.net/#software",
          name: "SparrowX Shield — Website Security & Edge WAF",
          applicationCategory: "SecurityApplication",
          operatingSystem: "Web, Linux, NGINX, Express, Cloudflare",
          url: "https://sec.sparrowx.net/",
          image: "https://sparrowx.net/logos/sparrowx-shield.jpg",
          description:
            "Autonomous website security scanner, Layer-7 Web Application Firewall (WAF), real-time DDoS mitigation, origin IP cloaking, and AI prompt injection defense.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          featureList: [
            "8-Tool Deep Website Security & Vulnerability Scanner",
            "Layer-7 Edge WAF (SQLi, XSS, SSRF, RCE Protection)",
            "Sub-Second DDoS Mitigation & Bot Defense",
            "TLS/SSL, DNSSEC, SPF/DMARC & Security Headers Audit",
            "AI Prompt Injection & LLM Tool Firewall",
          ],
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How does the free SparrowX Shield website security scanner work?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "SparrowX Shield runs a non-intrusive 8-tool deep security scan checking TLS/HTTPS ciphers, DNS & email authentication (SPF/DMARC/CAA), HTTP security headers, exposed endpoints, CORS posture, and threat intelligence in under 15 seconds.",
              },
            },
            {
              "@type": "Question",
              name: "Does SparrowX Shield protect websites from DDoS, SQLi, and AI prompt injection?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. SparrowX Shield combines Layer-7 WAF filtering for SQL injection, XSS, and credential stuffing with automated DDoS mitigation and an inline AI guardrail firewall for LLM applications.",
              },
            },
            {
              "@type": "Question",
              name: "How quickly can I deploy SparrowX Shield on my server?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "You can attach SparrowX Shield in under 60 seconds using our zero-dependency drop-in script, NGINX reverse proxy connector, or Node.js/Python middleware.",
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * GAME HOSTING OWNER — Exclusively owns "hosting", "game hosting", FiveM,
   * Minecraft, SA-MP, and Discord bot hosting searches.
   */
  game: {
    key: "game",
    siteName: "SparrowX Game Hosting",
    canonicalUrl: "https://sparrowx.net/game",
    title: "SparrowX Game Hosting — Best Low-Ping FiveM, Minecraft, SA-MP & Bot Hosting",
    description:
      "Fast NVMe Gen4 game server hosting in India & Asia with 12ms ping, always-on DDoS protection, instant Pterodactyl panel setup, and affordable INR plans starting at ₹49/mo for FiveM, Minecraft, SA-MP, and 24/7 Discord bots.",
    keywords:
      "game hosting, server hosting, hosting india, fivem server hosting, fivem hosting india, minecraft server hosting india, samp server hosting, discord bot hosting 24/7, low ping game hosting, pterodactyl panel hosting, nvme game server hosting, ddos protected game hosting, sparrowx game hosting",
    ogTitle: "SparrowX Game Hosting — Low-Ping FiveM, Minecraft, SA-MP & Discord Bot Servers",
    ogDescription:
      "Launch lag-free FiveM, Minecraft, SA-MP, and Discord bot servers in seconds on Ryzen NVMe Gen4 hardware with 12–15ms Asia-IN ping and instant Pterodactyl panel access.",
    ogImage: "https://sparrowx.net/assets/logo-game-A5Nnak65.png",
    ogImageAlt: "SparrowX Game Hosting — FiveM, Minecraft, SA-MP & Discord Bot Servers",
    twitterTitle: "SparrowX Game Hosting — FiveM, Minecraft, SA-MP & Bot Hosting",
    twitterDescription:
      "12ms Asia-IN NVMe Gen4 game server hosting with DDoS protection and instant Pterodactyl panel from ₹49/mo.",
    iconHref: "/logos/sparrowx-main.png",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          "@id": "https://sparrowx.net/game#service",
          name: "SparrowX Game Hosting",
          serviceType: "Game Server Hosting",
          url: "https://sparrowx.net/game",
          image: "https://sparrowx.net/assets/logo-game-A5Nnak65.png",
          description:
            "Low-ping NVMe Gen4 game server hosting for FiveM (GTA V RP), Minecraft, SA-MP, and 24/7 Discord bots with instant Pterodactyl panel provisioning and L4/L7 DDoS protection.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          areaServed: ["India", "Singapore", "Asia", "Global"],
          offers: {
            "@type": "AggregateOffer",
            lowPrice: "49",
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Which game servers can I host on SparrowX Game Hosting?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "SparrowX Game Hosting supports instant 1-click deployment for FiveM (GTA V Roleplay with txAdmin), Minecraft (Paper, Purpur, Forge, Fabric, Bedrock), SA-MP / open.mp, and 24/7 Node.js & Python Discord bots.",
              },
            },
            {
              "@type": "Question",
              name: "What ping and hardware do SparrowX Game Hosting nodes deliver?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All game nodes run on high-clock AMD Ryzen & Xeon processors with NVMe Gen4 SSDs in Asia-IN data centers, delivering 12–15ms latency across India and sub-second DDoS mitigation.",
              },
            },
            {
              "@type": "Question",
              name: "Does every game server include Pterodactyl Panel access?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Every server is automatically provisioned on our Pterodactyl Game Panel at game.panel.sparrowx.net with 1-click SSO login, live console, SFTP/file manager, backups, and MySQL database allocations.",
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * CLOUD INFRASTRUCTURE OWNER — Exclusively owns VPS, Dedicated Servers,
   * Bare Metal, and KVM cloud compute searches.
   */
  infra: {
    key: "infra",
    siteName: "SparrowX Cloud Infra",
    canonicalUrl: "https://infra.sparrowx.net/",
    title: "SparrowX Cloud Infra — Bare Metal, Dedicated Servers & KVM NVMe VPS Hosting",
    description:
      "Deploy high-clock AMD Ryzen & EPYC bare metal servers, dedicated servers, and instant KVM NVMe VPS across India, Singapore, and Europe with unmetered fiber, zero egress fees, and always-on XDP DDoS protection.",
    keywords:
      "vps hosting, kvm vps india, bare metal server, dedicated server hosting, cloud infrastructure, amd ryzen dedicated server, epyc bare metal, nvme vps hosting, unmetered vps, xdp ddos protected vps, sparrowx infra, infra.sparrowx.net",
    ogTitle: "SparrowX Cloud Infra — Bare Metal, Dedicated Servers & KVM NVMe VPS",
    ogDescription:
      "Single-tenant bare metal silicon, dedicated nodes, and instant NVMe KVM VPS on transparent INR/USD pricing with zero egress traps at infra.sparrowx.net.",
    ogImage: "https://infra.sparrowx.net/3d/cloud-infra-server.jpg",
    ogImageAlt: "SparrowX Cloud Infra — Bare Metal and KVM NVMe VPS Infrastructure",
    twitterTitle: "SparrowX Cloud Infra — Bare Metal & KVM NVMe VPS",
    twitterDescription:
      "Instant KVM NVMe VPS and AMD Ryzen/EPYC bare metal servers with XDP DDoS defense and zero egress fees.",
    iconHref: "/sparrowx-logo.png",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          "@id": "https://infra.sparrowx.net/#service",
          name: "SparrowX Cloud Infra — Bare Metal & KVM VPS",
          serviceType: "Cloud Infrastructure, Dedicated Servers & VPS Hosting",
          url: "https://infra.sparrowx.net/",
          image: "https://infra.sparrowx.net/3d/cloud-infra-server.jpg",
          description:
            "Single-tenant bare metal servers, dedicated AMD Ryzen/EPYC compute nodes, and instant NVMe KVM VPS across India, Singapore, and Europe with unmetered bandwidth and XDP DDoS mitigation.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What virtualization and storage does SparrowX Cloud Infra use?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "SparrowX Cloud Infra runs full KVM hardware virtualization on enterprise NVMe Gen4 RAID storage and single-tenant AMD Ryzen & EPYC bare metal servers with no noisy-neighbor overselling.",
              },
            },
            {
              "@type": "Question",
              name: "Are there egress bandwidth fees on SparrowX VPS or Bare Metal?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. All SparrowX Cloud Infra servers come with flat pricing, generous unmetered fiber ports, and zero surprise egress bandwidth bills.",
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * DATABASE OWNER — Exclusively owns PostgreSQL hosting, cloud database,
   * pgvector AI vector database, and serverless Postgres searches.
   */
  db: {
    key: "db",
    siteName: "SparrowX Cloud DB",
    canonicalUrl: "https://db.sparrowx.net/",
    title: "SparrowX Cloud DB — Managed PostgreSQL 16 & pgvector AI Database Hosting",
    description:
      "Deploy managed PostgreSQL 16+ cloud databases with native pgvector AI vector search, visual SQL studio, instant REST API, PgBouncer connection pooling, and zero egress fees at db.sparrowx.net.",
    keywords:
      "managed postgresql, cloud database, postgresql hosting, pgvector database, ai vector database, serverless postgres, postgres rest api, pgbouncer pooling, zero egress database, sparrowx db, db.sparrowx.net",
    ogTitle: "SparrowX Cloud DB — Managed PostgreSQL 16 & pgvector AI Studio",
    ogDescription:
      "High-performance managed PostgreSQL with visual table editor, pgvector AI search, instant PostgREST API, and zero bandwidth egress fees.",
    ogImage: "https://db.sparrowx.net/logos/sparrowx-db.jpg",
    ogImageAlt: "SparrowX Cloud DB — Managed PostgreSQL 16 and pgvector",
    twitterTitle: "SparrowX Cloud DB — Managed PostgreSQL & pgvector",
    twitterDescription:
      "Fast managed PostgreSQL 16+ with pgvector AI search, instant REST API, and zero egress fees at db.sparrowx.net.",
    iconHref: "/sparrowx-db-logo.svg",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": "https://db.sparrowx.net/#software",
          name: "SparrowX Cloud DB",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          url: "https://db.sparrowx.net/",
          image: "https://sparrowx.net/logos/sparrowx-db.jpg",
          description:
            "Managed PostgreSQL 16+ database studio with native pgvector AI embeddings, PgBouncer pooling, instant REST API, and automated backups.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What database engine powers SparrowX Cloud DB?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "SparrowX Cloud DB runs dedicated PostgreSQL 16+ on NVMe Gen4 storage with PgBouncer connection pooling and native pgvector for LLM embeddings.",
              },
            },
            {
              "@type": "Question",
              name: "Are there any hidden bandwidth or egress fees?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. SparrowX Cloud DB uses transparent flat pricing with zero egress bandwidth traps.",
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * FILE TRANSFER OWNER — Exclusively owns encrypted file transfer, free file sharing,
   * send large files without login, and zero-knowledge cloud vault searches.
   */
  drop: {
    key: "drop",
    siteName: "SparrowX Drop",
    canonicalUrl: "https://file.sparrowx.net/",
    title: "SparrowX Drop — Free Encrypted File Transfer (No Login) & 10 GB Vault",
    description:
      "Send files up to 2.5 GB free with zero sign-up and client-side AES-GCM-256 encryption, or store files in a 10 GB free zero-knowledge encrypted cloud vault at file.sparrowx.net.",
    keywords:
      "encrypted file transfer, free file sharing no login, send large files free, zero knowledge file sharing, aes-256 file transfer, ephemeral file share, encrypted cloud vault, secure file drop, sparrowx drop, file.sparrowx.net",
    ogTitle: "SparrowX Drop — Zero-Knowledge Encrypted File Transfer & Free 10 GB Vault",
    ogDescription:
      "Browser-side AES-256 encrypted file sharing with zero login required, auto-expiring links, and a 10 GB free encrypted vault at file.sparrowx.net.",
    ogImage: "https://file.sparrowx.net/logos/sparrowx-drop.jpg",
    ogImageAlt: "SparrowX Drop — Zero-Knowledge Encrypted File Transfer",
    twitterTitle: "SparrowX Drop — Free Encrypted File Transfer & 10 GB Vault",
    twitterDescription:
      "Zero-login AES-256 encrypted file sharing up to 2.5 GB and a 10 GB free private vault at file.sparrowx.net.",
    iconHref: "/sparrowx-drop-logo.svg",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          "@id": "https://file.sparrowx.net/#webapp",
          name: "SparrowX Drop",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "All",
          url: "https://file.sparrowx.net/",
          image: "https://sparrowx.net/logos/sparrowx-drop.jpg",
          description:
            "Zero-knowledge browser-encrypted file transfer up to 2.5 GB without registration, plus a 10 GB free encrypted cloud vault.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How does SparrowX Drop zero-knowledge encryption work?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All files are encrypted directly inside your browser using W3C Web Crypto AES-GCM-256 before upload. SparrowX servers never see your decryption key.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need an account to send large files?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No account is required. Drag and drop files up to 2.5 GB in Ephemeral Mode with custom download limits and automatic expiration.",
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * PASSWORD / CRYPTO OWNER — Exclusively owns offline password generator,
   * Diceware passphrases, and cryptographic key / API secret generator searches.
   */
  keys: {
    key: "keys",
    siteName: "SparrowX Keys",
    canonicalUrl: "https://password.sparrowx.net/",
    title: "SparrowX Keys — 100% Offline Cryptographic Password & Secret Generator",
    description:
      "Generate hardware-grade random passwords, Diceware passphrases, JWT secrets, and cryptographic API keys 100% offline in your browser using Web Crypto API with zero network calls at password.sparrowx.net.",
    keywords:
      "offline password generator, strong password generator, secure password generator, diceware passphrase generator, cryptographic key generator, api key generator, jwt secret generator, client-side password generator, sparrowx keys, password.sparrowx.net",
    ogTitle: "SparrowX Keys — 100% Offline Password, Diceware & Cryptographic Key Generator",
    ogDescription:
      "Zero-telemetry client-side password, Diceware passphrase, and cryptographic secret generator powered by Web Crypto CSPRNG at password.sparrowx.net.",
    ogImage: "https://password.sparrowx.net/logos/sparrowx-keys.jpg",
    ogImageAlt: "SparrowX Keys — 100% Offline Cryptographic Password Generator",
    twitterTitle: "SparrowX Keys — 100% Offline Password & Key Generator",
    twitterDescription:
      "Generate hardware-grade passwords, Diceware passphrases, and API secrets 100% offline in your browser.",
    iconHref: "/sparrowx-keys-logo.svg",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          "@id": "https://password.sparrowx.net/#webapp",
          name: "SparrowX Keys",
          applicationCategory: "SecurityApplication",
          operatingSystem: "All",
          url: "https://password.sparrowx.net/",
          image: "https://sparrowx.net/logos/sparrowx-keys.jpg",
          description:
            "100% offline browser-side cryptographic password, Diceware passphrase, and API secret generator using Web Crypto CSPRNG.",
          provider: {
            "@type": "Organization",
            name: "SparrowX Technologies",
            url: "https://sparrowx.net/",
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Why is an offline password generator safer?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "SparrowX Keys runs 100% in local browser memory with zero network calls, so generated passwords and secrets never touch any remote server or log.",
              },
            },
            {
              "@type": "Question",
              name: "Can I use SparrowX Keys completely offline?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Once loaded, you can disconnect from the internet and SparrowX Keys continues generating CSPRNG passwords, Diceware passphrases, and cryptographic keys.",
              },
            },
          ],
        },
      ],
    },
  },
};

export function normalizeSeoHostname(rawHost: string | null | undefined): string {
  if (!rawHost) return "";
  return rawHost.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
}

export function resolveSeoProfileKeyForHost(rawHost: string | null | undefined): SeoProfileKey {
  const host = normalizeSeoHostname(rawHost);
  if (!host) return "master";
  if (host.startsWith("sec.") || host.startsWith("shield.")) return "shield";
  if (host.startsWith("db.") || host.startsWith("studio.")) return "db";
  if (host.startsWith("file.") || host.startsWith("drop.") || host.startsWith("share.")) return "drop";
  if (host.startsWith("password.") || host.startsWith("passwd.") || host.startsWith("keys.")) return "keys";
  if (host.startsWith("infra.") || host.startsWith("metal.") || host.startsWith("vps.")) return "infra";
  if (host.startsWith("game.")) return "game";
  return "master";
}

export function resolveSeoProfileForHost(rawHost: string | null | undefined): SeoProfile {
  return SEO_PROFILES[resolveSeoProfileKeyForHost(rawHost)];
}

export function buildRouteHeadFromProfile(profile: SeoProfile) {
  return {
    meta: [
      { title: profile.title },
      { name: "description", content: profile.description },
      { name: "keywords", content: profile.keywords },
      { name: "robots", content: profile.robots },
      { property: "og:site_name", content: profile.siteName },
      { property: "og:title", content: profile.ogTitle },
      { property: "og:description", content: profile.ogDescription },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: profile.canonicalUrl },
      { property: "og:image", content: profile.ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: profile.ogImageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@sparrowx" },
      { name: "twitter:title", content: profile.twitterTitle },
      { name: "twitter:description", content: profile.twitterDescription },
      { name: "twitter:image", content: profile.ogImage },
      { name: "twitter:image:alt", content: profile.ogImageAlt },
    ],
    links: [
      { rel: "canonical", href: profile.canonicalUrl },
      { rel: "icon", href: profile.iconHref },
      { rel: "shortcut icon", href: profile.iconHref },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(profile.jsonLd),
      },
    ],
  };
}

/**
 * HTTP 301 canonical host redirect for server-side requests on `sparrowx.net` / `www.sparrowx.net`.
 * Ensures Googlebot and visitors hitting legacy path URLs immediately transfer 100% authority
 * to the dedicated subdomain with zero duplicate-content collision.
 */
export function resolveCanonicalSubdomainRedirect(
  rawHost: string | null | undefined,
  pathname: string,
  search: string,
): string | null {
  const host = normalizeSeoHostname(rawHost);
  if (host !== "sparrowx.net" && host !== "www.sparrowx.net") {
    return null;
  }

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const suffix = search || "";

  if (normalizedPath === "/db") return `https://db.sparrowx.net/${suffix}`;
  if (normalizedPath === "/shield") return `https://sec.sparrowx.net/${suffix}`;
  if (normalizedPath === "/drop") return `https://file.sparrowx.net/${suffix}`;
  if (normalizedPath === "/keys") return `https://password.sparrowx.net/${suffix}`;
  if (normalizedPath === "/infra") return `https://infra.sparrowx.net/${suffix}`;

  // Canonicalize www.sparrowx.net -> https://sparrowx.net
  if (host === "www.sparrowx.net") {
    return `https://sparrowx.net${pathname}${suffix}`;
  }

  return null;
}

/**
 * Generates a host-specific robots.txt so each subdomain owns its own sitemap
 * and sparrowx.net never indexes duplicate subdomain path mirrors or private dashboards.
 */
export function buildHostRobotsTxt(rawHost: string | null | undefined): string {
  const key = resolveSeoProfileKeyForHost(rawHost);

  if (key === "master") {
    return [
      "User-agent: *",
      "Allow: /",
      "Allow: /game",
      "Allow: /story",
      "Allow: /docs",
      "Disallow: /db",
      "Disallow: /shield",
      "Disallow: /drop",
      "Disallow: /keys",
      "Disallow: /infra",
      "Disallow: /game/dashboard",
      "Disallow: /game/panel-launch",
      "Disallow: /infra/dashboard",
      "Disallow: /api/",
      "Disallow: /rest/",
      "",
      "Sitemap: https://sparrowx.net/sitemap.xml",
      "",
    ].join("\n");
  }

  const profile = SEO_PROFILES[key];
  const origin = profile.canonicalUrl.replace(/\/+$/, "");

  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /rest/",
    "Disallow: /dashboard",
    "Disallow: /game/dashboard",
    "Disallow: /infra/dashboard",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

/**
 * Generates a strictly single-host sitemap.xml (100% compliant with Google Sitemap Protocol)
 * so every subdomain has a clean, isolated index with zero cross-host or duplicate URL pollution.
 */
export function buildHostSitemapXml(rawHost: string | null | undefined): string {
  const key = resolveSeoProfileKeyForHost(rawHost);

  if (key === "master") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://sparrowx.net/</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://sparrowx.net/logos/sparrowx-main.jpg</image:loc>
      <image:title>SparrowX Technologies Official Platform</image:title>
    </image:image>
  </url>
  <url>
    <loc>https://sparrowx.net/game</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.95</priority>
    <image:image>
      <image:loc>https://sparrowx.net/assets/logo-game-A5Nnak65.png</image:loc>
      <image:title>SparrowX Game Hosting — FiveM, Minecraft, SA-MP and Discord Bot Servers</image:title>
    </image:image>
  </url>
  <url>
    <loc>https://sparrowx.net/story</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://sparrowx.net/docs</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
  <url>
    <loc>https://sparrowx.net/docs/errors</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`;
  }

  const profile = SEO_PROFILES[key];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${profile.canonicalUrl}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${profile.ogImage}</image:loc>
      <image:title>${profile.ogImageAlt}</image:title>
    </image:image>
  </url>
</urlset>
`;
}
