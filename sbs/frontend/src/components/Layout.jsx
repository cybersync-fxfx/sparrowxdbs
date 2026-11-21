import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Terminal, Shield, ListX, Download, Key, Settings, LogOut, RadioTower, ServerCog, Globe, Sparkles, ShoppingCart, Database, BookOpen } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import NotificationCenter from './NotificationCenter';

export default function Layout({ user, setToken }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('sparrowx_netsec_logged_out', '1');
    } catch {
      // ignore storage errors
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // best effort session cleanup
    }
    setToken(null);
    localStorage.removeItem('sparrowx_token');
    localStorage.removeItem('sbs_token');
    navigate('/');
  };

  const navItems = [
    { section: 'Monitor' },
    { path: '/', name: 'Dashboard', icon: <Activity size={18} />, caption: 'Live telemetry and connection health' },
    { path: '/terminal', name: 'Terminal', icon: <Terminal size={18} />, caption: 'Run remote commands through the agent' },
    { path: '/plans', name: 'Marketplace', icon: <ShoppingCart size={18} />, caption: 'Deploy new infrastructure and server plans' },
    { section: 'Security' },
    { path: '/firewall', name: 'Firewall', icon: <Shield size={18} />, caption: 'Inspect active firewall rules and service state' },
    { path: '/blocklist', name: 'Block List', icon: <ListX size={18} />, caption: 'Ban, review, and remove blocked IPs' },
    { path: '/radar', name: 'Threat Radar', icon: <RadioTower size={18} />, caption: 'Live IP scoring and automated defense' },
    { path: '/map', name: 'Global Threat Map', icon: <Globe size={18} />, caption: 'Live geographic visualization' },
    { path: '/security', name: 'Infra Status', icon: <ServerCog size={18} />, caption: 'Check status of XDP, HAProxy, and defense layers' },
    { section: 'Setup' },
    { path: '/install', name: 'Install Agent', icon: <Download size={18} />, caption: 'Generate the installer and deploy to a server' },
    { path: '/apikeys', name: 'API & Keys', icon: <Key size={18} />, caption: 'Manage agent credentials and API access' },
    { path: '/settings', name: 'Settings', icon: <Settings size={18} />, caption: 'Account details and network controls' },
    { path: '/docs', name: 'Documentation', icon: <BookOpen size={18} />, caption: 'XDP/eBPF setup guides and API runbooks' },
    { section: 'Ecosystem' },
    { path: 'https://sparrowx.net', name: 'SparrowX Master Cloud', icon: <Database size={18} />, caption: 'Managed PostgreSQL, Vault & Cloud Console', isExternal: true },
    { path: 'https://gamesec.sparrowx.net', name: 'GameSec L4 DDoS', icon: <Shield size={18} />, caption: 'Anycast L3/L4 Game DDoS Protection', isExternal: true },
    { path: 'https://game.sparrowx.net', name: 'Game Server Hosting', icon: <Sparkles size={18} />, caption: 'FiveM, Minecraft, SA-MP & Discord Bots', isExternal: true },
  ];

  const { isConnected, agentStatus, wsState, viewMode, setViewMode } = useTelemetry();

  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="brand-lockup" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo.png?v=3d" alt="SparrowX NetSec Logo" className="brand-logo" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span className="brand-title" style={{ fontSize: '0.96rem', letterSpacing: '0.04em' }}>
              SPARROWX <span style={{ color: 'var(--accent-cyan)' }}>NETSEC</span>
            </span>
            <span className="brand-subtitle" style={{ fontSize: '0.58rem', letterSpacing: '0.18em' }}>
              XDP · L3/L4/L7 SHIELD
            </span>
          </div>
        </div>

        <div className="topbar-meta">
          {user?.role === 'admin' && (
            <div className="view-switcher">
              <button 
                className={`view-button ${viewMode === 'global' ? 'active' : ''}`}
                onClick={() => setViewMode('global')}
                title="Global Guard Infrastructure View"
              >
                <Globe size={14} />
                <span>GUARD</span>
              </button>
              <button 
                className={`view-button ${viewMode === 'agent' ? 'active' : ''}`}
                onClick={() => setViewMode('agent')}
                title="Local VPS Agent View"
              >
                <ServerCog size={14} />
                <span>LOCAL</span>
              </button>
            </div>
          )}

          <div className={`status-pill ${isConnected || user?.role === 'admin' ? 'connected' : 'disconnected'}`}>
            <RadioTower size={14} />
            {user?.role === 'admin' ? (viewMode === 'global' ? 'GUARD ONLINE' : 'LOCAL MONITORING') : (agentStatus === 'CONNECTED' ? 'CONNECTED' : 'NO AGENT')}
          </div>
          <div className="meta-chip">WS {wsState}</div>
          <div className="topbar-time">{time}</div>
          {user?.database?.connected && user.database.primary && (
            <div
              className="master-db-chip"
              title={`SparrowX Developer Database linked: ${user.database.primary.dbName} (${user.database.primary.planId})`}
            >
              <Database size={13} />
              <span>DB: {user.database.primary.dbName}</span>
            </div>
          )}
          <div className="user-chip">@{user?.username} {user?.role === 'admin' && '(ADMIN)'}</div>
          
          <button className="icon-button danger-outline" onClick={handleLogout} aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="main-area">
        <aside className="sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <ServerCog size={16} />
              <span>{viewMode === 'global' ? 'Guard Infrastructure' : 'Linked Agent'}</span>
            </div>
            <div className="sidebar-card-value">
              {viewMode === 'global' ? 'Primary Guard Node' : (user?.agentId || 'Not assigned')}
            </div>
            <div className="sidebar-card-meta">
              {viewMode === 'global' 
                ? 'Monitoring all traffic scrubbing nodes.' 
                : (isConnected ? 'Agent is streaming telemetry live.' : 'Download a fresh installer to attach a server.')
              }
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item, idx) => {
              if (item.section) {
                return <div key={idx} className="sidebar-section">{item.section}</div>;
              }

              // Hide admin-only items
              if (item.path === '/security' && user?.role !== 'admin') {
                return null;
              }

              const isActive = location.pathname === item.path;

              if (item.isExternal) {
                return (
                  <a
                    key={idx}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                  >
                    <div className="nav-link-icon">{item.icon}</div>
                    <div>
                      <div className="nav-link-title">{item.name}</div>
                      <div className="nav-link-caption">{item.caption}</div>
                    </div>
                  </a>
                );
              }

              return (
                <NavLink
                  key={idx}
                  to={item.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <div className="nav-link-icon">{item.icon}</div>
                  <div>
                    <div className="nav-link-title">{item.name}</div>
                    <div className="nav-link-caption">
                      {(() => {
                        const cap = item.caption || '';
                        return viewMode === 'global' 
                          ? cap.replace(/your server|the agent/gi, 'global infrastructure') 
                          : cap;
                      })()}
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
      <NotificationCenter />
    </div>
  );
}
