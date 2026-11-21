import { useEffect, useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { UserCheck, UserX, ShieldCheck, RefreshCw, Database } from 'lucide-react';

export default function Settings({ token, user }) {
  const { viewMode } = useTelemetry();
  const [tunnelStatus, setTunnelStatus] = useState('inactive');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const fetchUsers = async () => {
    if (user?.role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/internal/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setUsers(data);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    const fetchStatus = () => {
      if (viewMode !== 'global') {
        fetch('/api/agent/tunnel/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Unable to load tunnel status.');
            }
            setTunnelStatus(data.status || 'inactive');
          })
          .catch((error) => setFeedback(error.message));
      }
    };

    fetchStatus();
    if (user?.role === 'admin') fetchUsers();
    
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, [token, viewMode, user?.role]);

  const handleUpdateUser = async (username, status) => {
    try {
      const res = await fetch('/api/internal/users/status', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, status })
      });
      if (res.ok) {
        setFeedback(`User @${username} updated successfully (${status}).`);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.error || 'Failed to update user.');
      }
    } catch {
      setFeedback('Failed to update user.');
    }
  };

  const handleRemoveTunnel = async () => {
    setIsBusy(true);
    setFeedback('');

    try {
      const response = await fetch('/api/agent/tunnel/remove', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect protection.');
      }
      setTunnelStatus('inactive');
      setFeedback('Protection disconnect request sent successfully.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const dbPrimary = user?.database?.primary || null;

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">{viewMode === 'global' ? 'Infrastructure' : 'Account'}</p>
          <h1 className="page-title">{viewMode === 'global' ? 'Global Management' : 'Settings & Account'}</h1>
          <p className="page-copy">
            {viewMode === 'global' 
              ? 'Centralized control for operator approvals, role assignments, and infrastructure health.'
              : 'Review your operator identity, linked Master Developer Database, and WireGuard protection state.'}
          </p>
        </div>
        <div className="hero-status-stack">
          {viewMode !== 'global' && (
            <>
              <div className={`status-pill ${user?.agentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
                {user?.agentStatus || 'NO AGENT'}
              </div>
              <div className={`status-pill ${tunnelStatus === 'active' ? 'connected' : 'disconnected'}`}>
                Tunnel {tunnelStatus}
              </div>
            </>
          )}
          {viewMode === 'global' && (
            <div className="status-pill connected">
              GUARD INFRASTRUCTURE ONLINE
            </div>
          )}
        </div>
      </section>

      {feedback && (
        <div className={`callout-inline ${feedback.toLowerCase().includes('successfully') || feedback.toLowerCase().includes('updated') ? 'success' : 'danger'}`}>
          {feedback}
        </div>
      )}

      <section className="content-grid two-up">
        {viewMode === 'global' && user?.role === 'admin' ? (
          <article className="glass-panel elevated-panel full-width">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Administration</p>
                <h3>Operator Access Management</h3>
              </div>
              <button className="icon-button" onClick={fetchUsers} disabled={loadingUsers} title="Refresh users">
                <RefreshCw size={16} className={loadingUsers ? 'spin' : ''} />
              </button>
            </div>
            
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Operator</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Agent ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isApproved = u.status === 'approved' || u.status === 'active';
                    return (
                      <tr key={u.id}>
                        <td className="bold">@{u.username}</td>
                        <td className="mono">{u.email || '—'}</td>
                        <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                        <td><span className={`status-badge ${isApproved ? 'approved' : u.status}`}>{u.status}</span></td>
                        <td className="mono">{u.agent_id || '—'}</td>
                        <td>
                          <div className="action-row-mini">
                            {!isApproved && (
                              <button title="Approve Operator" onClick={() => handleUpdateUser(u.username, 'approved')} className="icon-btn-sm success">
                                <UserCheck size={14}/>
                              </button>
                            )}
                            {isApproved && (
                              <button title="Suspend to Pending" onClick={() => handleUpdateUser(u.username, 'pending')} className="icon-btn-sm warning">
                                <UserX size={14}/>
                              </button>
                            )}
                            {u.role !== 'admin' && (
                              <button title="Promote to Admin" onClick={() => handleUpdateUser(u.username, 'admin')} className="icon-btn-sm info">
                                <ShieldCheck size={14}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty-row">No operator accounts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        ) : (
          <>
            <article className="glass-panel elevated-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Identity</p>
                  <h3>Operator &amp; Master SSO Details</h3>
                </div>
              </div>
              <div className="fact-list">
                <div className="fact-row">
                  <span>Username</span>
                  <span className="fact-value">@{user?.username || '-'}</span>
                </div>
                <div className="fact-row">
                  <span>Email</span>
                  <span className="fact-value">{user?.email || '-'}</span>
                </div>
                <div className="fact-row">
                  <span>Role</span>
                  <span className="fact-value">{(user?.role || 'user').toUpperCase()}</span>
                </div>
                <div className="fact-row">
                  <span>Agent ID</span>
                  <span className="fact-value">{user?.agentId || '-'}</span>
                </div>
                <div className="fact-row">
                  <span>Master SSO Sync</span>
                  <span className={`fact-value ${user?.masterConnected ? 'success' : ''}`}>
                    {user?.masterConnected ? 'LINKED (sparrowx.net)' : 'LOCAL SOVEREIGN PG'}
                  </span>
                </div>
                <div className="fact-row">
                  <span>Developer Database</span>
                  <span className="fact-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    {dbPrimary ? (
                      <>
                        <Database size={13} />
                        {dbPrimary.dbName} ({dbPrimary.planId})
                      </>
                    ) : (
                      'No linked database'
                    )}
                  </span>
                </div>
              </div>
            </article>

            <article className="glass-panel elevated-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Protection</p>
                  <h3>SparrowGuard Tunnel Controls</h3>
                </div>
              </div>
              <div className="fact-list compact">
                <div className="fact-row">
                  <span>Agent Connectivity</span>
                  <span className={`fact-value ${user?.agentStatus === 'CONNECTED' ? 'success' : 'danger'}`}>{user?.agentStatus || 'NO AGENT'}</span>
                </div>
                <div className="fact-row">
                  <span>WireGuard Clean Pipe</span>
                  <span className={`fact-value ${tunnelStatus === 'active' ? 'success' : 'warning'}`}>{tunnelStatus.toUpperCase()}</span>
                </div>
                <div className="fact-row">
                  <span>Scrubbing Engine</span>
                  <span className="fact-value">XDP / eBPF + nftables Guard</span>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="danger"
                  onClick={handleRemoveTunnel}
                  disabled={isBusy || tunnelStatus !== 'active'}
                >
                  {isBusy ? 'Disconnecting...' : 'Disconnect WireGuard Tunnel'}
                </button>
              </div>
            </article>
          </>
        )}
      </section>

      <style>{`
        .full-width { grid-column: 1 / -1; }
        .user-table-wrapper { overflow-x: auto; margin-top: 10px; }
        .user-table { width: 100%; border-collapse: collapse; text-align: left; }
        .user-table th { padding: 12px; font-size: 0.7rem; color: rgba(255,255,255,0.45); text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .user-table td { padding: 14px 12px; font-size: 0.84rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); }
        .user-table .bold { color: #fff; font-weight: 700; }
        .user-table .mono { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #22d3ee; }
        .role-badge { padding: 3px 8px; border-radius: 6px; font-size: 0.68rem; text-transform: uppercase; font-weight: 700; background: rgba(255,255,255,0.06); }
        .role-badge.admin { background: rgba(255,34,58,0.16); color: #ff4d61; border: 1px solid rgba(255,34,58,0.35); }
        .status-badge { padding: 3px 8px; border-radius: 6px; font-size: 0.68rem; text-transform: uppercase; font-weight: 700; }
        .status-badge.approved, .status-badge.active { background: rgba(16,185,129,0.14); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
        .status-badge.pending { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .action-row-mini { display: flex; gap: 8px; }
        .icon-btn-sm { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.14) !important; background: transparent !important; color: #fff !important; transition: all 0.2s; padding: 0 !important; }
        .icon-btn-sm.success:hover { color: #10b981 !important; border-color: #10b981 !important; }
        .icon-btn-sm.warning:hover { color: #f59e0b !important; border-color: #f59e0b !important; }
        .icon-btn-sm.info:hover { color: #22d3ee !important; border-color: #22d3ee !important; }
        .empty-row { text-align: center; color: rgba(255,255,255,0.35); font-style: italic; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
