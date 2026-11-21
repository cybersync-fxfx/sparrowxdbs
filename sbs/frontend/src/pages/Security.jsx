import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Activity, RefreshCw, AlertCircle, CheckCircle2, Terminal } from 'lucide-react';

export default function SecurityStatus({ token }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internal/security-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch security status');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    setNotice('');
    setError(null);
    try {
      const res = await fetch('/api/internal/security-fix', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to trigger repair');
      setNotice('Automated 4-layer defense self-heal initiated. Services will refresh status in 15–30 seconds.');
      setTimeout(fetchStatus, 15000);
    } catch (err) {
      setError('Auto-fix error: ' + err.message);
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60000);
    return () => clearInterval(id);
  }, []);

  const layers = [
    { id: 'xdp', name: 'Layer 1: XDP / eBPF Hook', icon: <Cpu size={20} />, desc: 'Wire-speed pre-skb packet drop in the NIC ring buffer' },
    { id: 'nftables', name: 'Layer 2: nftables Guard Set', icon: <ShieldCheck size={20} />, desc: 'Kernel-level dynamic blacklist and connection rate limiting' },
    { id: 'haproxy', name: 'Layer 3: HAProxy L7 WAF', icon: <Activity size={20} />, desc: 'Application-level TLS termination and HTTP flood blocker' },
    { id: 'fastnetmon', name: 'Layer 4: FastNetMon / Radar', icon: <AlertCircle size={20} />, desc: 'Real-time anomaly scoring and automatic blackholing' }
  ];

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Defense Stack</p>
          <h1 className="page-title">Infrastructure Status</h1>
          <p className="page-copy">Real-time health verification and automated self-healing for the 4-layer DDoS scrubbing stack.</p>
        </div>
        <div className="hero-status-stack">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading || fixing}
            className="secondary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw className={loading ? 'spin' : ''} size={14} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleFix}
            disabled={fixing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw className={fixing ? 'spin' : ''} size={14} />
            <span>{fixing ? 'Healing Stack...' : 'Run Auto-Fix'}</span>
          </button>
        </div>
      </section>

      {notice && (
        <section className="callout-banner" style={{ borderColor: 'rgba(34,211,238,0.45)', background: 'rgba(34,211,238,0.08)' }}>
          <strong>[HEAL]</strong> <span>{notice}</span>
        </section>
      )}

      {error && (
        <section className="callout-banner warning">
          <strong>[!]</strong> <span>{error}</span>
        </section>
      )}

      <div className="security-grid">
        {layers.map(layer => {
          const isActive = status?.[layer.id]?.active;
          const details = status?.[layer.id]?.details;

          return (
            <div key={layer.id} className={`security-card ${isActive ? 'active' : 'inactive'}`}>
              <div className="card-top">
                <div className="layer-icon">{layer.icon}</div>
                <div className={`status-badge ${isActive ? 'online' : 'offline'}`}>
                  {isActive ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {isActive ? 'ACTIVE' : 'STANDBY'}
                </div>
              </div>
              <div className="card-body">
                <h3>{layer.name}</h3>
                <p className="desc">{layer.desc}</p>
                <div className="details-box">
                  <Terminal size={14} className="details-icon" />
                  <code>{loading && !status ? 'Probing kernel & service state...' : (details || 'Ready for inspection')}</code>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .security-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 16px;
        }
        .security-card {
          background: rgba(14, 18, 28, 0.84);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 22px;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .security-card.active {
          border-color: rgba(34, 211, 238, 0.35);
          box-shadow: 0 0 24px rgba(34, 211, 238, 0.08);
        }
        .security-card.inactive {
          border-color: rgba(255, 34, 58, 0.32);
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .layer-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(255, 34, 58, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ff223a;
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .status-badge.online {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .status-badge.offline {
          background: rgba(255, 34, 58, 0.14);
          color: #ff4d61;
          border: 1px solid rgba(255, 34, 58, 0.32);
        }
        .card-body h3 {
          margin: 0;
          font-size: 1rem;
          color: #f8fafc;
        }
        .card-body .desc {
          font-size: 0.8rem;
          color: #94a3b8;
          margin: 6px 0 14px 0;
        }
        .details-box {
          background: rgba(0, 0, 0, 0.42);
          padding: 12px;
          border-radius: 10px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .details-icon {
          margin-top: 3px;
          color: #22d3ee;
          flex-shrink: 0;
        }
        .details-box code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          color: #e2e8f0;
          word-break: break-all;
          white-space: pre-wrap;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
