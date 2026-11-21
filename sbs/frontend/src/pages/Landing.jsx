import { useState } from 'react';
import {
  Shield,
  Activity,
  Terminal,
  Lock,
  Zap,
  Globe,
  RadioTower,
  Server,
  Check,
  Copy,
  ArrowRight,
  Cpu,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const PIPELINE_STAGES = [
  {
    step: '01',
    title: 'NIC Driver XDP Hook',
    tag: 'Pre-sk_buff · 0.04ms',
    desc: 'Intercepts raw Ethernet frames inside the network driver before Linux kernel memory allocation.',
    tone: 'crimson',
  },
  {
    step: '02',
    title: 'eBPF Hash Blocklist',
    tag: '262,144 IPs · O(1) Drop',
    desc: 'Instant wire-speed XDP_DROP on known botnets and volumetric flood sources via blocked_ipv4 BPF map.',
    tone: 'crimson',
  },
  {
    step: '03',
    title: 'UDP Protocol Inspector',
    tag: '14+ Game & VPN Signatures',
    desc: 'Deep packet header validation for FiveM, Steam A2S, RakNet/Rust, SA-MP, AltV, Minecraft, WireGuard & DNS.',
    tone: 'cyan',
  },
  {
    step: '04',
    title: 'XDP_TX Cookie Challenge',
    tag: 'Stateless 5s Handshake',
    desc: 'Reflects cryptographic challenge cookies at wire speed and promotes verified clients to a 180s per-CPU LRU whitelist.',
    tone: 'amber',
  },
  {
    step: '05',
    title: 'Clean Origin Tunnel',
    tag: 'GRE / WireGuard / HAProxy',
    desc: 'Forwards only authenticated, scrubbed traffic to your game server, VPS, or web application origin.',
    tone: 'emerald',
  },
];

const PROTOCOL_BADGES = [
  { name: 'FiveM / RedM', ports: 'UDP/TCP 30120', status: 'Signature + Cookie' },
  { name: 'Minecraft Java & Bedrock', ports: 'TCP 25565 · UDP 19132', status: 'Handshake Guard' },
  { name: 'Rust & Unturned (RakNet)', ports: 'UDP 28015 · 27015', status: '0x05 Offline Filter' },
  { name: 'Steam Source / A2S Query', ports: 'UDP 27000–27500', status: 'A2S Cache & Challenge' },
  { name: 'SA-MP / open.mp & AltV', ports: 'UDP 7777 · 7788', status: 'Magic Header Check' },
  { name: 'ARK / Mordhau / Squad', ports: 'UDP 7000–8999', status: 'Beacon Validator' },
  { name: 'WireGuard & OpenVPN', ports: 'UDP 51820 · 1194', status: 'Initiation Handshake' },
  { name: 'Web, API & Authoritative DNS', ports: 'TCP 80/443 · UDP 53', status: 'L7 WAF + QR=0 Filter' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const installCmd = 'curl -sSL https://sparrowx.net/ddos-setup.sh | sudo bash';

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(installCmd).catch(() => {});
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2200);
  };

  return (
    <div className="ns-landing">
      <div className="ns-ambient ns-ambient-crimson" />
      <div className="ns-ambient ns-ambient-cyan" />

      {/* Top Navigation */}
      <header className="ns-navbar">
        <div className="ns-nav-inner">
          <div className="ns-brand" onClick={() => navigate('/')}>
            <img src="/logo.png?v=3d" alt="SparrowX NetSec 3D Emblem" className="ns-brand-logo" />
            <div>
              <div className="ns-brand-name">
                SPARROWX <span>NETSEC</span>
              </div>
              <div className="ns-brand-tag">AUTONOMOUS XDP / eBPF DDOS SCRUBBING</div>
            </div>
          </div>

          <div className="ns-nav-links">
            <a href="#pipeline">XDP Pipeline</a>
            <a href="#protocols">Protected Protocols</a>
            <button type="button" className="ns-link-btn" onClick={() => navigate('/docs')}>
              Documentation
            </button>
          </div>

          <div className="ns-nav-actions">
            <div className="ns-live-pill">
              <span className="ns-pulse-dot" />
              <span>SCRUBBER ARMED · &lt;0.38ms</span>
            </div>
            <button type="button" className="ns-btn-ghost" onClick={() => navigate('/login')}>
              Sign In
            </button>
            <button type="button" className="ns-btn-primary" onClick={() => navigate('/login')}>
              <span>Launch SOC Console</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="ns-container">
        <section className="ns-hero">
          <div className="ns-hero-badge">
            <Zap size={13} />
            <span>KERNEL-LEVEL LAYER 3 / 4 / 7 MITIGATION · ZERO SK_BUFF OVERHEAD</span>
          </div>

          <h1 className="ns-hero-title">
            Stop Volumetric DDoS Floods{' '}
            <span className="ns-gradient-text">Before They Reach Your Kernel.</span>
          </h1>

          <p className="ns-hero-sub">
            SparrowX NetSec combines wire-speed <strong>eBPF / XDP driver scrubbing</strong>, stateful UDP
            challenge cookies, game-protocol signature inspection, and real-time SOC telemetry to keep your
            FiveM, Minecraft, Rust, VPS, and web infrastructure online under multi-million PPS attacks.
          </p>

          <div className="ns-hero-ctas">
            <button type="button" className="ns-btn-hero-primary" onClick={() => navigate('/login')}>
              <Shield size={18} />
              <span>Open Live DDoS Dashboard</span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="ns-btn-hero-secondary" onClick={() => navigate('/docs')}>
              <Terminal size={17} />
              <span>View XDP &amp; Agent Docs</span>
            </button>
          </div>

          {/* 1-Command Quick Deploy Bar */}
          <div className="ns-cmd-bar">
            <div className="ns-cmd-label">1-CLICK VPS XDP SHIELD</div>
            <code className="ns-cmd-code">{installCmd}</code>
            <button type="button" className="ns-cmd-copy" onClick={handleCopyCmd}>
              {copiedCmd ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedCmd ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Live Telemetry Hero Strip */}
          <div className="ns-kpi-grid">
            <div className="ns-kpi-card">
              <div className="ns-kpi-label">ANYCAST SCRUBBING CAPACITY</div>
              <div className="ns-kpi-value">4.8+ Tbps</div>
              <div className="ns-kpi-meta">Multi-pop L3/L4/L7 edge filtration</div>
            </div>
            <div className="ns-kpi-card">
              <div className="ns-kpi-label">XDP DRIVER LATENCY</div>
              <div className="ns-kpi-value ns-text-emerald">&lt; 0.38 ms</div>
              <div className="ns-kpi-meta">Zero sk_buff allocation on dropped packets</div>
            </div>
            <div className="ns-kpi-card">
              <div className="ns-kpi-label">BPF BLOCKLIST &amp; WHITELIST</div>
              <div className="ns-kpi-value ns-text-cyan">2.0M+ IPs</div>
              <div className="ns-kpi-meta">Per-CPU LRU hash maps synced in real time</div>
            </div>
            <div className="ns-kpi-card">
              <div className="ns-kpi-label">GAME &amp; VPN PROTOCOLS</div>
              <div className="ns-kpi-value ns-text-crimson">14+ Engines</div>
              <div className="ns-kpi-meta">FiveM, Rust, Steam A2S, SA-MP, Minecraft, WG</div>
            </div>
          </div>
        </section>

        {/* 5-Stage XDP Scrubbing Pipeline */}
        <section id="pipeline" className="ns-section">
          <div className="ns-section-head">
            <span className="ns-eyebrow">ARCHITECTURE</span>
            <h2>5-Stage Autonomous XDP / eBPF Scrubbing Pipeline</h2>
            <p>Every inbound packet is inspected at line rate before reaching user-space sockets.</p>
          </div>

          <div className="ns-pipeline-grid">
            {PIPELINE_STAGES.map((s) => (
              <article key={s.step} className={`ns-stage-card tone-${s.tone}`}>
                <div className="ns-stage-top">
                  <span className="ns-stage-num">STAGE {s.step}</span>
                  <span className="ns-stage-tag">{s.tag}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Supported Game & Enterprise Protocols */}
        <section id="protocols" className="ns-section">
          <div className="ns-section-head">
            <span className="ns-eyebrow">PROTOCOL INTELLIGENCE</span>
            <h2>Purpose-Built for Game Servers, Bare-Metal VPS &amp; Low-Latency APIs</h2>
            <p>Pre-tuned payload inspectors eliminate spoofed UDP amplification and query floods.</p>
          </div>

          <div className="ns-proto-grid">
            {PROTOCOL_BADGES.map((p) => (
              <div key={p.name} className="ns-proto-card">
                <div className="ns-proto-header">
                  <span className="ns-proto-name">{p.name}</span>
                  <span className="ns-proto-status">{p.status}</span>
                </div>
                <div className="ns-proto-ports">{p.ports}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Launch Cards */}
        <section className="ns-section">
          <div className="ns-launch-grid">
            <div onClick={() => navigate('/login')} className="ns-launch-card primary">
              <div className="ns-launch-icon">
                <Lock size={22} />
              </div>
              <div className="ns-launch-body">
                <h3>Client &amp; Operator SOC Console</h3>
                <p>Live bandwidth graphs, Threat Radar, Geo-IP Attack Map, and 1-click IP ban controls.</p>
              </div>
              <ArrowRight size={18} />
            </div>

            <div onClick={() => navigate('/docs')} className="ns-launch-card">
              <div className="ns-launch-icon">
                <Terminal size={22} />
              </div>
              <div className="ns-launch-body">
                <h3>XDP Agent &amp; API Documentation</h3>
                <p>Deploy the Linux telemetry agent, GRE/WireGuard tunnels, and automated blocklist webhooks.</p>
              </div>
              <ArrowRight size={18} />
            </div>

            <div onClick={() => navigate('/dashboard')} className="ns-launch-card">
              <div className="ns-launch-icon">
                <Activity size={22} />
              </div>
              <div className="ns-launch-body">
                <h3>Real-Time Telemetry &amp; Scrubbing HUD</h3>
                <p>Monitor PPS, SYN rates, CPU/Memory headroom, and live SSH + firewall events.</p>
              </div>
              <ArrowRight size={18} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
