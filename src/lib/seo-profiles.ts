export type SeoProfileKey =
  | "master"
  | "shield"
  | "game"
  | "infra"
  | "db"
  | "drop"
  | "keys"
  | "gateway"
  | "netsec"
  | "deploy"
  | "ai"
  | "agents"
  | "dpdp";

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
  themeColor?: string;
  robots: string;
  jsonLd: Record<string, unknown>;
}

const LASTMOD = "2026-11-23";

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
    title: "SparrowX — Cloud Infrastructure, DDoS Security & Databases",
    description:
      "SparrowX Technologies: Sovereign cloud VPS & VDS, managed PostgreSQL databases, autonomous WAF/DDoS protection, game hosting, and encrypted tools.",
    keywords:
      "sparrowx, sparrowx.net, sparrowx technologies, sparrowx cloud, sparrowx client area, sparrowx login, sparrowx ecosystem",
    ogTitle: "SparrowX — Complete Developer Toolkit for Security, Cloud & AI Agentics",
    ogDescription:
      "All-in-one sovereign developer toolkit for security, cloud databases, REST APIs, bare-metal deployment, encrypted utilities, and AI automation.",
    ogImage: "https://sparrowx.net/logos/sparrowx-main.png",
    ogImageAlt: "SparrowX Technologies Official Platform Logo",
    twitterTitle: "SparrowX — Official Cloud & Security Ecosystem",
    twitterDescription:
      "Official hub for SparrowX Technologies products and the unified SparrowX Client Area.",
    iconHref: "/logos/sparrowx-main.png",
    themeColor: "#090B0E",
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
    ogImage: "https://sec.sparrowx.net/logos/sparrowx-shield.png",
    ogImageAlt: "SparrowX Shield — Website Security Scanner, Edge WAF & DDoS Protection",
    twitterTitle: "SparrowX Shield — Website Security, Edge WAF & DDoS Protection",
    twitterDescription:
      "Free deep website security scanner, Layer-7 WAF, DDoS mitigation, and real-time threat interception at sec.sparrowx.net.",
    iconHref: "/logos/sparrowx-shield.png",
    themeColor: "#F9103A",
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
    ogImage: "https://sparrowx.net/logos/sparrowx-main.png",
    ogImageAlt: "SparrowX Game Hosting — FiveM, Minecraft, SA-MP & Discord Bot Servers",
    twitterTitle: "SparrowX Game Hosting — FiveM, Minecraft, SA-MP & Bot Hosting",
    twitterDescription:
      "12ms Asia-IN NVMe Gen4 game server hosting with DDoS protection and instant Pterodactyl panel from ₹49/mo.",
    iconHref: "/logos/sparrowx-main.png",
    themeColor: "#FF6B00",
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
          image: "https://sparrowx.net/logos/sparrowx-main.png",
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
    ogImage: "https://infra.sparrowx.net/logos/sparrowx-silver.png",
    ogImageAlt: "SparrowX Cloud Infra — Bare Metal and KVM NVMe VPS Infrastructure",
    twitterTitle: "SparrowX Cloud Infra — Bare Metal & KVM NVMe VPS",
    twitterDescription:
      "Instant KVM NVMe VPS and AMD Ryzen/EPYC bare metal servers with XDP DDoS defense and zero egress fees.",
    iconHref: "/logos/sparrowx-silver.png",
    themeColor: "#0EA5E9",
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
    ogImage: "https://db.sparrowx.net/logos/sparrowx-db.png",
    ogImageAlt: "SparrowX Cloud DB — Managed PostgreSQL 16 and pgvector",
    twitterTitle: "SparrowX Cloud DB — Managed PostgreSQL & pgvector",
    twitterDescription:
      "Fast managed PostgreSQL 16+ with pgvector AI search, instant REST API, and zero egress fees at db.sparrowx.net.",
    iconHref: "/logos/sparrowx-db.png",
    themeColor: "#A3E635",
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
    ogImage: "https://file.sparrowx.net/logos/sparrowx-drop.png",
    ogImageAlt: "SparrowX Drop — Zero-Knowledge Encrypted File Transfer",
    twitterTitle: "SparrowX Drop — Free Encrypted File Transfer & 10 GB Vault",
    twitterDescription:
      "Zero-login AES-256 encrypted file sharing up to 2.5 GB and a 10 GB free private vault at file.sparrowx.net.",
    iconHref: "/logos/sparrowx-drop.png",
    themeColor: "#A855F7",
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
    ogImage: "https://password.sparrowx.net/logos/sparrowx-keys.png",
    ogImageAlt: "SparrowX Keys — 100% Offline Cryptographic Password Generator",
    twitterTitle: "SparrowX Keys — 100% Offline Password & Key Generator",
    twitterDescription:
      "Generate hardware-grade passwords, Diceware passphrases, and API secrets 100% offline in your browser.",
    iconHref: "/logos/sparrowx-keys.png",
    themeColor: "#F59E0B",
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

  /**
   * API GATEWAY OWNER — Instant hosted PostgreSQL REST API & developer SDKs.
   */
  gateway: {
    key: "gateway",
    siteName: "SparrowX API Gateway",
    canonicalUrl: "https://api.sparrowx.net/",
    title: "SparrowX API Gateway — Instant Hosted PostgreSQL REST API & SDKs",
    description:
      "Query sovereign PostgreSQL databases over HTTPS with sub-millisecond PostgREST latency, scoped spx_db API keys, and ready-to-run TypeScript, Python, and cURL SDKs at api.sparrowx.net.",
    keywords:
      "postgresql rest api, postgrest hosting, hosted api gateway, database rest api, sparrowx api gateway, api.sparrowx.net, developer api keys, typescript sql sdk",
    ogTitle: "SparrowX API Gateway — Instant Hosted PostgreSQL REST API",
    ogDescription:
      "Sub-millisecond REST API over your sovereign PostgreSQL tables with scoped keys, automatic OpenAPI docs, and instant SDK snippets.",
    ogImage: "https://api.sparrowx.net/logos/sparrowx-network.png",
    ogImageAlt: "SparrowX API Gateway — Hosted PostgreSQL REST API & SDKs",
    twitterTitle: "SparrowX API Gateway — Instant PostgreSQL REST API",
    twitterDescription:
      "Query sovereign PostgreSQL tables over HTTPS with scoped API keys and instant TypeScript, Python & cURL SDKs.",
    iconHref: "/logos/sparrowx-network.png",
    themeColor: "#38BDF8",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://api.sparrowx.net/#software",
      name: "SparrowX API Gateway",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, Linux, REST, HTTPS",
      url: "https://api.sparrowx.net/",
      image: "https://api.sparrowx.net/logos/sparrowx-network.png",
      description:
        "Instant RESTful PostgreSQL API gateway with scoped spx_db keys, row-level security, and ready-to-run cURL, TypeScript, and Python SDKs.",
      provider: {
        "@type": "Organization",
        name: "SparrowX Technologies",
        url: "https://sparrowx.net/",
      },
    },
  },

  /**
   * NETSEC GUARD OWNER — Autonomous Linux DDoS defense, WireGuard tunnels & eBPF/XDP radar.
   */
  netsec: {
    key: "netsec",
    siteName: "SparrowX NetSec Guard",
    canonicalUrl: "https://netsec.sparrowx.net/",
    title: "SparrowX NetSec Guard — Autonomous Linux DDoS Radar, XDP & WireGuard Tunnels",
    description:
      "Protect Linux servers with SparrowX NetSec Guard (netsec.sparrowx.net): kernel-level eBPF/XDP packet dropping, nftables automation, WireGuard origin cloaking, and real-time threat radar.",
    keywords:
      "linux ddos protection, xdp firewall, ebpf ddos mitigation, wireguard tunnel protection, nftables automation, threat radar, sparrowx netsec, netsec.sparrowx.net",
    ogTitle: "SparrowX NetSec Guard — Autonomous Linux XDP & WireGuard DDoS Defense",
    ogDescription:
      "Real-time threat radar, kernel eBPF/XDP packet filtering, and encrypted WireGuard origin cloaking for Linux servers.",
    ogImage: "https://netsec.sparrowx.net/logos/sparrowx-netsec-3d.png",
    ogImageAlt: "SparrowX NetSec Guard — Autonomous Linux DDoS Defense Logo",
    twitterTitle: "SparrowX NetSec Guard — Linux XDP & WireGuard DDoS Defense",
    twitterDescription:
      "Kernel-level eBPF/XDP packet dropping, WireGuard tunnels, and autonomous threat radar for Linux infrastructure.",
    iconHref: "/logos/sparrowx-netsec-3d.png",
    themeColor: "#FF223A",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://netsec.sparrowx.net/#software",
      name: "SparrowX NetSec Guard",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Linux, Ubuntu, Debian",
      url: "https://netsec.sparrowx.net/",
      image: "https://netsec.sparrowx.net/logos/sparrowx-netsec-3d.png",
      description:
        "Autonomous Linux infrastructure security panel with eBPF/XDP DDoS mitigation, nftables firewall orchestration, WireGuard tunnels, and live threat radar.",
      provider: {
        "@type": "Organization",
        name: "SparrowX Technologies",
        url: "https://sparrowx.net/",
      },
    },
  },

  deploy: {
    key: "deploy",
    siteName: "SparrowX Deploy",
    canonicalUrl: "https://deploy.sparrowx.net/",
    title: "SparrowX Deploy — Git-to-Edge Cloud PaaS & Instant Web App Hosting",
    description:
      "Deploy Next.js, Vite, React, Node.js, Python, and Docker apps with instant *.deploy.sparrowx.net HTTPS URLs, live build logs, and zero egress fees at deploy.sparrowx.net.",
    keywords:
      "cloud paas, deploy web app india, git push hosting, nextjs hosting india, docker paas, sparrowx deploy, deploy.sparrowx.net",
    ogTitle: "SparrowX Deploy — Git-to-Edge Cloud PaaS",
    ogDescription:
      "Connect GitHub and ship full-stack apps to Indian bare-metal edge nodes with automatic SSL and live logs.",
    ogImage: "https://deploy.sparrowx.net/logos/sparrowx-network.png",
    ogImageAlt: "SparrowX Deploy — Git-to-Edge Cloud PaaS",
    twitterTitle: "SparrowX Deploy — Cloud PaaS",
    twitterDescription:
      "Deploy React, Next.js, Node.js, Python, and Docker workloads on sovereign Indian bare metal.",
    iconHref: "/logos/sparrowx-network.png",
    themeColor: "#000000",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://deploy.sparrowx.net/#software",
      name: "SparrowX Deploy",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, Linux, Docker",
      url: "https://deploy.sparrowx.net/",
      provider: { "@type": "Organization", name: "SparrowX Technologies", url: "https://sparrowx.net/" },
    },
  },

  ai: {
    key: "ai",
    siteName: "SparrowX AI Gateway",
    canonicalUrl: "https://ai.sparrowx.net/",
    title: "SparrowX AI — Unified LLM Gateway, Model Playground & Prompt Guardrails",
    description:
      "OpenAI-compatible AI Gateway with live Model Playground, inline prompt-injection & PII guardrails, scoped API keys, and sovereign inference at ai.sparrowx.net.",
    keywords:
      "llm gateway, openai compatible proxy, ai prompt guardrails, model playground, sparrowx ai, ai.sparrowx.net",
    ogTitle: "SparrowX AI — Unified LLM Gateway & Prompt Guardrails",
    ogDescription:
      "Route LLMs through one OpenAI-compatible gateway with inline prompt-injection blocking and INR metering.",
    ogImage: "https://ai.sparrowx.net/logos/sparrowx-main.png",
    ogImageAlt: "SparrowX AI Gateway",
    twitterTitle: "SparrowX AI Gateway",
    twitterDescription:
      "Unified OpenAI-compatible LLM gateway, model playground, and inline guardrails.",
    iconHref: "/logos/sparrowx-main.png",
    themeColor: "#8B5CF6",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://ai.sparrowx.net/#software",
      name: "SparrowX AI Gateway",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, REST",
      url: "https://ai.sparrowx.net/",
      provider: { "@type": "Organization", name: "SparrowX Technologies", url: "https://sparrowx.net/" },
    },
  },

  agents: {
    key: "agents",
    siteName: "SparrowX Autonomous Agents",
    canonicalUrl: "https://agents.sparrowx.net/",
    title: "SparrowX Agents — Autonomous AI Agent Runtime, Tools & Live Traces",
    description:
      "Deploy autonomous AI agents with pgvector memory, authorized security & database tools, Sentinel guardrails, live execution traces, and webhook triggers at agents.sparrowx.net.",
    keywords:
      "ai agent hosting, autonomous agents runtime, mcp hosting india, agent workflows, sparrowx agents, agents.sparrowx.net",
    ogTitle: "SparrowX Agents — Autonomous AI Agent Runtime",
    ogDescription:
      "Deploy guardrailed AI agents with tools, pgvector memory, webhooks, and live traces.",
    ogImage: "https://agents.sparrowx.net/logos/sparrowx-main.png",
    ogImageAlt: "SparrowX Autonomous Agents",
    twitterTitle: "SparrowX Autonomous Agents",
    twitterDescription:
      "Managed runtime for autonomous AI agents with tools, memory, and webhooks.",
    iconHref: "/logos/sparrowx-main.png",
    themeColor: "#10B981",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://agents.sparrowx.net/#software",
      name: "SparrowX Autonomous Agents",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, Linux",
      url: "https://agents.sparrowx.net/",
      provider: { "@type": "Organization", name: "SparrowX Technologies", url: "https://sparrowx.net/" },
    },
  },

  dpdp: {
    key: "dpdp",
    siteName: "SparrowX DPDP Compliance",
    canonicalUrl: "https://dpdp.sparrowx.net/",
    title: "SparrowX DPDP — India Digital Personal Data Protection Act 2023 Suite",
    description:
      "Automate India DPDP Act 2023 compliance: Section 6 consent notice builder, DSAR Data Principal rights desk, 72-hour breach console, and sovereign data inventory at dpdp.sparrowx.net.",
    keywords:
      "dpdp act 2023 compliance, india data protection, dsar portal, consent notice builder, sparrowx dpdp, dpdp.sparrowx.net",
    ogTitle: "SparrowX DPDP — India DPDP Act 2023 Compliance Suite",
    ogDescription:
      "Section 6 consent manager, DSAR rights desk, 72-hour breach console, and data inventory for Indian teams.",
    ogImage: "https://dpdp.sparrowx.net/logos/sparrowx-shield.png",
    ogImageAlt: "SparrowX DPDP Compliance Suite",
    twitterTitle: "SparrowX DPDP Compliance Suite",
    twitterDescription:
      "Automate India DPDP Act 2023 consent, DSAR rights, and breach reporting.",
    iconHref: "/logos/sparrowx-shield.png",
    themeColor: "#10B981",
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": "https://dpdp.sparrowx.net/#software",
      name: "SparrowX DPDP Compliance",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://dpdp.sparrowx.net/",
      provider: { "@type": "Organization", name: "SparrowX Technologies", url: "https://sparrowx.net/" },
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
  if (host.startsWith("deploy.")) return "deploy";
  if (host.startsWith("ai.")) return "ai";
  if (host.startsWith("agents.")) return "agents";
  if (host.startsWith("dpdp.")) return "dpdp";
  if (host.startsWith("api.") || host.startsWith("rest.")) return "gateway";
  if (host.startsWith("netsec.")) return "netsec";
  if (host.startsWith("game.")) return "game";
  return "master";
}

export function resolveSeoProfileForHost(rawHost: string | null | undefined): SeoProfile {
  return SEO_PROFILES[resolveSeoProfileKeyForHost(rawHost)];
}

export function buildRouteHeadFromProfile(profile: SeoProfile) {
  const ogImageType = profile.ogImage.endsWith(".png")
    ? "image/png"
    : profile.ogImage.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return {
    meta: [
      { title: profile.title },
      { name: "description", content: profile.description },
      { name: "keywords", content: profile.keywords },
      { name: "robots", content: profile.robots },
      ...(profile.themeColor ? [{ name: "theme-color", content: profile.themeColor }] : []),
      { property: "og:site_name", content: profile.siteName },
      { property: "og:title", content: profile.ogTitle },
      { property: "og:description", content: profile.ogDescription },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: profile.canonicalUrl },
      { property: "og:image", content: profile.ogImage },
      { property: "og:image:secure_url", content: profile.ogImage },
      { property: "og:image:type", content: ogImageType },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: profile.ogImageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@sparrowx" },
      { name: "twitter:creator", content: "@sparrowx" },
      { name: "twitter:title", content: profile.twitterTitle },
      { name: "twitter:description", content: profile.twitterDescription },
      { name: "twitter:image", content: profile.ogImage },
      { name: "twitter:image:alt", content: profile.ogImageAlt },
    ],
    links: [
      { rel: "canonical", href: profile.canonicalUrl },
      { rel: "icon", href: profile.iconHref, type: profile.iconHref.endsWith(".svg") ? "image/svg+xml" : "image/png" },
      { rel: "shortcut icon", href: profile.iconHref },
      { rel: "apple-touch-icon", href: profile.iconHref },
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
 * HTTP 301 canonical host redirect for server-side requests across `sparrowx.net`
 * and all product subdomains.
 *
 * Enforces strict host isolation:
 * 1. Legacy path mirrors on `sparrowx.net` / `www.sparrowx.net` (`/db`, `/shield`, `/drop`,
 *    `/keys`, `/infra`, `/deploy`, `/ai`, `/agents`, `/dpdp`, `/gateway`) 301 to their canonical subdomain.
 * 2. Cross-subdomain path leaks (e.g. `db.sparrowx.net/infra`, `sec.sparrowx.net/story`,
 *    `api.sparrowx.net/db`) 301 directly to the owning canonical host in a single hop.
 * 3. Localhost / non-production hosts always return `null` so local routing stays intact.
 */
export function resolveCanonicalSubdomainRedirect(
  rawHost: string | null | undefined,
  pathname: string,
  search: string,
): string | null {
  const host = normalizeSeoHostname(rawHost);
  if (!host || (host !== "sparrowx.net" && !host.endsWith(".sparrowx.net"))) {
    return null;
  }

  // Never intercept APIs, PostgREST, server functions, static assets, or external apps
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/rest/") ||
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/logos/") ||
    pathname.startsWith("/3d/") ||
    pathname.startsWith("/xdp/") ||
    /\.[a-z0-9]{1,8}$/i.test(pathname)
  ) {
    return null;
  }

  // Skip wildcard tenant hosts (`*.ai.sparrowx.net`, `*.deploy.sparrowx.net`) & special hosts
  const prefix = host === "sparrowx.net" ? "" : host.slice(0, -".sparrowx.net".length);
  if (
    prefix === "admin" ||
    prefix === "console" ||
    prefix === "php" ||
    prefix === "panel" ||
    prefix === "game" ||
    prefix === "game.dash" ||
    prefix === "game.panel" ||
    prefix === "netsec" ||
    prefix === "gamesec" ||
    prefix.startsWith("ingest.") ||
    prefix.endsWith(".ai") ||
    prefix.endsWith(".deploy")
  ) {
    return null;
  }

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const suffix = search || "";

  // Map every dedicated path to its canonical owner host + path
  const PATH_OWNERS: ReadonlyArray<{
    match: (p: string) => boolean;
    ownerHost: string;
    destPath: (p: string) => string;
  }> = [
    { match: (p) => p === "/db", ownerHost: "db.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/shield", ownerHost: "sec.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/drop", ownerHost: "file.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/f" || p.startsWith("/f/"), ownerHost: "file.sparrowx.net", destPath: (p) => p },
    { match: (p) => p === "/keys", ownerHost: "password.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/gateway", ownerHost: "api.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/infra", ownerHost: "infra.sparrowx.net", destPath: () => "/" },
    {
      match: (p) => p === "/infra/dashboard" || p === "/infra/configure",
      ownerHost: "infra.sparrowx.net",
      destPath: (p) => p,
    },
    { match: (p) => p === "/deploy", ownerHost: "deploy.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/ai", ownerHost: "ai.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/agents", ownerHost: "agents.sparrowx.net", destPath: () => "/" },
    { match: (p) => p === "/dpdp", ownerHost: "dpdp.sparrowx.net", destPath: () => "/" },
    {
      match: (p) =>
        p === "/game" ||
        p.startsWith("/game/") ||
        p === "/story" ||
        p === "/terms" ||
        p === "/refund" ||
        p === "/security",
      ownerHost: "sparrowx.net",
      destPath: (p) => p,
    },
  ];

  for (const rule of PATH_OWNERS) {
    if (rule.match(normalizedPath)) {
      if (host !== rule.ownerHost) {
        return `https://${rule.ownerHost}${rule.destPath(normalizedPath)}${suffix}`;
      }
      return null;
    }
  }

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
      "Disallow: /deploy",
      "Disallow: /ai",
      "Disallow: /agents",
      "Disallow: /dpdp",
      "Disallow: /gateway",
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
      <image:loc>https://sparrowx.net/logos/sparrowx-main.png</image:loc>
      <image:title>SparrowX Technologies Official Platform</image:title>
    </image:image>
  </url>
  <url>
    <loc>https://sparrowx.net/game</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.95</priority>
    <image:image>
      <image:loc>https://sparrowx.net/logos/sparrowx-main.png</image:loc>
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
    <loc>https://sparrowx.net/security</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://sparrowx.net/terms</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://sparrowx.net/refund</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
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
