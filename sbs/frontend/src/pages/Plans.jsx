import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, HardDrive, Package, Check, ArrowRight, Shield, ExternalLink } from 'lucide-react';

const PLANS = [
  {
    id: 'sparrow-basic',
    name: 'NetSec Edge Starter',
    category: { name: 'Starter Shield' },
    price: 5.0,
    billing_period: 'mo',
    specs: { ram_gb: 2, cpu_cores: 1, disk_gb: 20, scrub_tbps: '1.2 Tbps' },
    features: { backups: 1, databases: 1, protocols: 'L3/L4 XDP + WireGuard Clean Pipe' },
    targetUrl: '/install',
    ctaLabel: 'ATTACH SERVER AGENT',
  },
  {
    id: 'sparrow-pro',
    name: 'NetSec Game & Pro Shield',
    category: { name: 'Game & Pro' },
    price: 15.0,
    billing_period: 'mo',
    specs: { ram_gb: 4, cpu_cores: 2, disk_gb: 50, scrub_tbps: '3.2 Tbps' },
    features: { backups: 3, databases: 3, protocols: 'FiveM, Minecraft, CS2, Rust, SA-MP Filters' },
    targetUrl: 'https://gamesec.sparrowx.net',
    ctaLabel: 'LAUNCH GAMESEC L4',
  },
  {
    id: 'sparrow-elite',
    name: 'NetSec Sovereign Metal',
    category: { name: 'Enterprise' },
    price: 35.0,
    billing_period: 'mo',
    specs: { ram_gb: 8, cpu_cores: 4, disk_gb: 100, scrub_tbps: '4.8+ Tbps' },
    features: { backups: 5, databases: 5, protocols: 'Dedicated Anycast VIP + Custom eBPF Maps' },
    targetUrl: 'https://sparrowx.net/infra',
    ctaLabel: 'DEPLOY CLOUD INFRA',
  },
];

export default function Plans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleDeploy = (plan) => {
    setSelectedPlan(plan);
    if (plan.targetUrl.startsWith('/')) {
      navigate(plan.targetUrl);
    }
  };

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Marketplace &amp; Tiers</p>
          <h1 className="page-title">Deploy Protected Infrastructure</h1>
          <p className="page-copy">
            Attach our XDP/eBPF protection agent to your existing Linux VPS or provision dedicated DDoS-protected Game &amp; Cloud nodes across the SparrowX ecosystem.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className="status-pill connected">4.8+ TBPS SCRUBBING CAPACITY</div>
        </div>
      </section>

      {selectedPlan && !selectedPlan.targetUrl.startsWith('/') && (
        <section
          className="callout-banner"
          style={{
            borderColor: 'rgba(34,211,238,0.45)',
            background: 'rgba(34,211,238,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>[PROVISIONING]</strong>{' '}
            <span>
              Selected <strong>{selectedPlan.name}</strong> (${selectedPlan.price}/mo). Continue to the SparrowX provisioning portal or attach an existing server immediately via Install Agent.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="secondary-button" onClick={() => navigate('/install')}>
              Install Local Agent
            </button>
            <a
              href={selectedPlan.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#ff223a',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                textDecoration: 'none',
              }}
            >
              <span>Open Provisioning Portal</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </section>
      )}

      <div className="plans-grid">
        {PLANS.map((plan) => (
          <article key={plan.id} className="glass-panel elevated-panel plan-card">
            <div className="plan-badge">{plan.category.name}</div>
            <h2 className="plan-name">{plan.name}</h2>

            <div className="plan-price">
              <span className="price-symbol">$</span>
              <span className="price-amount">{plan.price}</span>
              <span className="price-period">/{plan.billing_period}</span>
            </div>

            <div className="plan-specs">
              <div className="spec-item">
                <Shield size={14} className="text-cyan" />
                <span>{plan.specs.scrub_tbps} XDP Scrubbing</span>
              </div>
              <div className="spec-item">
                <Package size={14} className="text-cyan" />
                <span>{plan.specs.ram_gb} GB Dedicated RAM</span>
              </div>
              <div className="spec-item">
                <Cpu size={14} className="text-cyan" />
                <span>{plan.specs.cpu_cores} High-Frequency vCores</span>
              </div>
              <div className="spec-item">
                <HardDrive size={14} className="text-cyan" />
                <span>{plan.specs.disk_gb} GB Enterprise NVMe</span>
              </div>
            </div>

            <div className="plan-features">
              <div className="feature-item">
                <Check size={14} className="text-green" />
                <span>{plan.features.protocols}</span>
              </div>
              <div className="feature-item">
                <Check size={14} className="text-green" />
                <span>{plan.features.backups} Automated Snapshot Slots</span>
              </div>
              <div className="feature-item">
                <Check size={14} className="text-green" />
                <span>{plan.features.databases} Sovereign PostgreSQL DBs</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDeploy(plan)}
              className="plan-button"
            >
              <span>{plan.ctaLabel}</span>
              <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>

      <style>{`
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          margin-top: 12px;
        }
        .plan-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease;
          border: 1px solid var(--panel-border);
          background: var(--panel-bg);
          border-radius: 14px;
        }
        .plan-card:hover {
          border-color: var(--accent-cyan);
          transform: translateY(-4px);
          box-shadow: 0 0 30px rgba(255, 34, 58, 0.16);
        }
        .plan-badge {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--accent-cyan);
          color: #fff;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 5px 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-bottom-left-radius: 10px;
        }
        .plan-name {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: -0.3px;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .price-symbol {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--accent-cyan);
        }
        .price-amount {
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--text-main);
          font-family: var(--font-display);
        }
        .price-period {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
        }
        .plan-specs {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px 0;
          border-top: 1px solid var(--panel-border);
          border-bottom: 1px solid var(--panel-border);
        }
        .spec-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text-soft);
        }
        .plan-features {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .plan-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px !important;
          border-radius: 10px !important;
          background: linear-gradient(135deg, #ff223a 0%, #c90f24 100%) !important;
          color: #fff !important;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 1px;
          border: 1px solid rgba(255, 92, 112, 0.45) !important;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
