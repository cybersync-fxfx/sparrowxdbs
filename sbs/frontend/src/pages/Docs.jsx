import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  Server,
  Settings,
  Cpu,
  Layers,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import './Docs.css';

export default function Docs() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [typedCommand, setTypedCommand] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState('');

  const fullCommand = 'curl -fsSL https://netsec.sparrowx.net/ddos-setup.sh | sudo bash';

  useEffect(() => {
    let i = 0;
    setTypedCommand('');
    setShowOutput(false);

    const interval = setInterval(() => {
      if (i < fullCommand.length) {
        setTypedCommand((prev) => prev + fullCommand.charAt(i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowOutput(true), 350);
      }
    }, 35);

    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const copyCommand = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(''), 2000);
  };

  return (
    <div className="docs-container">
      <div className="docs-glow" />
      <div className="docs-glow-bottom" />

      <nav className="docs-nav">
        <div className="docs-logo" onClick={() => navigate('/')}>
          <img src="/logo.png?v=3d" alt="SparrowX NetSec" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="docs-logo-text">
              SPARROWX <span style={{ color: '#ff223a' }}>NETSEC DOCS</span>
            </span>
            <span style={{ fontSize: '0.64rem', color: '#94a3b8', letterSpacing: '0.16em', fontFamily: 'JetBrains Mono, monospace' }}>
              XDP / eBPF · SPARROWGUARD ARCHITECTURE
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="docs-back-btn" onClick={() => navigate('/login')}>
            Operator Console
          </button>
          <button className="docs-back-btn primary" onClick={() => navigate('/')}>
            <ArrowLeft size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Back to Showcase
          </button>
        </div>
      </nav>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <h3>Documentation</h3>
          <ul>
            <li>
              <a
                href="#overview"
                className={activeSection === 'overview' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('overview');
                }}
              >
                <BookOpen size={16} />
                <span>Platform &amp; XDP Pipeline</span>
              </a>
            </li>
            <li>
              <a
                href="#installation"
                className={activeSection === 'installation' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('installation');
                }}
              >
                <Server size={16} />
                <span>1-Click Deployment</span>
              </a>
            </li>
            <li>
              <a
                href="#protocols"
                className={activeSection === 'protocols' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('protocols');
                }}
              >
                <Layers size={16} />
                <span>Game &amp; L7 Profiles</span>
              </a>
            </li>
            <li>
              <a
                href="#configuration"
                className={activeSection === 'configuration' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('configuration');
                }}
              >
                <Settings size={16} />
                <span>Environment &amp; API</span>
              </a>
            </li>
            <li>
              <a
                href="#troubleshooting"
                className={activeSection === 'troubleshooting' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('troubleshooting');
                }}
              >
                <AlertTriangle size={16} />
                <span>Troubleshooting Runbook</span>
              </a>
            </li>
          </ul>
        </aside>

        <main className="docs-content">
          {/* Overview */}
          <section id="overview" className="docs-section">
            <h2>
              <Shield /> 5-Stage XDP / eBPF Autonomous Scrubbing
            </h2>
            <p>
              SparrowX NetSec (`netsec.sparrowx.net`) is an autonomous L3/L4/L7 DDoS mitigation and telemetry platform.
              Malicious packets are dropped inside the NIC driver ring buffer via eBPF/XDP before the Linux kernel allocates
              `sk_buff` socket memory.
            </p>
            <div className="info-grid">
              <div className="info-card">
                <h4>
                  <Cpu size={18} style={{ color: '#ff223a' }} /> Stage 1–2: XDP &amp; eBPF Maps
                </h4>
                <p>
                  Attaches to the network driver hook and evaluates 262,144+ active IP/CIDR entries in O(1) constant time with
                  `XDP_DROP`.
                </p>
              </div>
              <div className="info-card">
                <h4>
                  <CheckCircle size={18} style={{ color: '#22d3ee' }} /> Stage 3–4: Game &amp; SYN Cookies
                </h4>
                <p>
                  Validates Valve Source A2S, RakNet, ENet, and CitizenFX UDP payloads while challenging TCP SYN floods via
                  stateless `XDP_TX` cookies.
                </p>
              </div>
              <div className="info-card">
                <h4>
                  <Shield size={18} style={{ color: '#10b981' }} /> Stage 5: SparrowGuard Pipe
                </h4>
                <p>
                  Forwards verified clean traffic to your protected origin VPS or game node over an encrypted WireGuard mesh
                  tunnel.
                </p>
              </div>
            </div>
          </section>

          {/* Installation */}
          <section id="installation" className="docs-section">
            <h2>
              <Terminal /> 1-Click Shield &amp; Agent Deployment
            </h2>
            <p>
              Deploy the full SparrowX XDP/eBPF DDoS defense stack or attach an existing Ubuntu/Debian server to your NetSec
              operator console.
            </p>

            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="terminal-title">bash ~ sparrowx-xdp-installer</span>
                <button
                  type="button"
                  className="docs-copy-btn"
                  onClick={() => copyCommand(fullCommand, 'setup')}
                >
                  {copiedCmd === 'setup' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCmd === 'setup' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="terminal-body">
                <div>
                  <span className="terminal-prompt">root@guard-node:~#</span>
                  <span>{typedCommand}</span>
                  {!showOutput && <span className="terminal-cursor" />}
                </div>
                {showOutput && (
                  <div style={{ marginTop: '1rem', color: '#94a3b8' }}>
                    <div style={{ color: '#22d3ee' }}>[✓] Compiling eBPF / XDP kernel program (sparrowx_xdp.o)...</div>
                    <div style={{ color: '#22d3ee' }}>[✓] Pinning BPF map /sys/fs/bpf/sparrowx_blacklist...</div>
                    <div style={{ color: '#22d3ee' }}>[✓] Synchronizing nftables inet detroit_guard &amp; WireGuard pipe...</div>
                    <div style={{ color: '#10b981', marginTop: '0.5rem', fontWeight: 700 }}>
                      [OK] SparrowX NetSec XDP Shield v2.4 active (&lt; 0.38ms scrubbing latency).
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="info-grid">
              <div className="info-card">
                <h4>Per-Server Telemetry Agent</h4>
                <p>
                  Sign in to the Operator Console, open <strong>Install Agent</strong>, download
                  <code>sparrowx-agent-&lt;agent_id&gt;.sh</code>, and run it as root on your target VPS.
                </p>
              </div>
              <div className="info-card">
                <h4>Supported Linux Kernels</h4>
                <p>
                  Ubuntu 20.04 / 22.04 / 24.04 LTS and Debian 11 / 12 / 13 (Linux kernel 5.15+ with native or generic XDP and
                  nftables).
                </p>
              </div>
            </div>
          </section>

          {/* Protocols */}
          <section id="protocols" className="docs-section">
            <h2>
              <Layers /> Protected Game &amp; Enterprise Protocols
            </h2>
            <p>
              Pre-tuned eBPF and nftables inspection profiles eliminate amplification vectors while preserving zero-jitter
              tick rates for real players.
            </p>
            <div className="info-grid">
              <div className="info-card">
                <h4>FiveM / RedM (CitizenFX)</h4>
                <p>UDP/TCP 30120 `getinfo` / `getstatus` flood rate limiting and ENet handshake verification.</p>
              </div>
              <div className="info-card">
                <h4>Minecraft Java &amp; Bedrock</h4>
                <p>TCP 25565 SYN/bot mitigation and UDP 19132 RakNet unconnected ping validation.</p>
              </div>
              <div className="info-card">
                <h4>CS2 / Rust / Source Engine</h4>
                <p>UDP 27015–28015 Valve `A2S_INFO` / `A2S_PLAYER` reflection caching and query signature challenges.</p>
              </div>
              <div className="info-card">
                <h4>SA-MP / open.mp &amp; Web APIs</h4>
                <p>UDP 7777 `SAMP` magic-header validation plus HAProxy L7 HTTP/2 and TLS request rate limiting.</p>
              </div>
            </div>
          </section>

          {/* Configuration */}
          <section id="configuration" className="docs-section">
            <h2>
              <Key /> Environment &amp; REST API Reference
            </h2>
            <p>
              Agents and automation scripts authenticate with the NetSec controller using your operator API key and JWT
              bearer token.
            </p>

            <div className="info-grid">
              <div className="info-card">
                <h4>SPARROWX_SERVER</h4>
                <p>
                  Controller origin streaming WebSocket and REST telemetry (default:
                  <code>https://netsec.sparrowx.net</code>).
                </p>
              </div>
              <div className="info-card">
                <h4>SPARROWX_API_KEY</h4>
                <p>
                  Per-operator secret key (`spx_...`) managed under the <strong>API &amp; Keys</strong> tab.
                </p>
              </div>
            </div>

            <div className="terminal-window" style={{ marginTop: '1rem' }}>
              <div className="terminal-header">
                <span className="terminal-title" style={{ marginLeft: 0 }}>
                  REST API · Blocklist &amp; Remote Command Example
                </span>
              </div>
              <div className="terminal-body" style={{ fontSize: '0.84rem' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>{`# 1. Inspect active guard firewall blocklist
curl -fsSL https://netsec.sparrowx.net/api/guard/blocklist \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. Ban a malicious IP across Guard + connected agents
curl -X POST https://netsec.sparrowx.net/api/guard/blocklist \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"ip":"203.0.113.45"}'

# 3. Execute an audited diagnostic command on your linked agent
curl -X POST https://netsec.sparrowx.net/api/command \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"cmd":"nft list ruleset"}'`}</pre>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="docs-section">
            <h2>
              <AlertTriangle /> Troubleshooting &amp; Operator Runbook
            </h2>
            <p>Immediate diagnostic commands for common agent, WireGuard tunnel, and firewall states.</p>

            <div className="trouble-item">
              <div className="trouble-header">Agent shows DISCONNECTED or Packet Telemetry Needs Refresh</div>
              <div className="trouble-fix">
                Download a fresh installer from <strong>Install Agent</strong> and run{' '}
                <code>sudo bash sparrowx-agent-&lt;agent_id&gt;.sh</code> on your server, then check{' '}
                <code>systemctl status sbs-agent --no-pager</code>.
              </div>
            </div>

            <div className="trouble-item warning">
              <div className="trouble-header">WireGuard SparrowGuard Tunnel Stuck in Provisioning</div>
              <div className="trouble-fix">
                Verify UDP port <code>51820</code> is reachable on the Guard node and run{' '}
                <code>sudo wg show</code> on both endpoints to confirm a recent handshake timestamp.
              </div>
            </div>

            <div className="trouble-item">
              <div className="trouble-header">Unbanning an IP via Local Host CLI</div>
              <div className="trouble-fix">
                Remove an IP directly from the guard nftables set with:{' '}
                <code>sudo nft delete element inet detroit_guard blacklist &#123; YOUR_IP &#125;</code>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
