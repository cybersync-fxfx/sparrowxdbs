import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TelemetryProvider } from './context/TelemetryContext';
import Landing  from './pages/Landing';
import Auth     from './pages/Auth';
import Docs     from './pages/Docs';
import Layout   from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal  from './pages/Terminal';
import Firewall  from './pages/Firewall';
import Blocklist from './pages/Blocklist';
import Install   from './pages/Install';
import ApiKeys   from './pages/ApiKeys';
import Settings  from './pages/Settings';
import ThreatRadar from './pages/ThreatRadar';
import ThreatMap   from './pages/ThreatMap';
import Security    from './pages/Security';
import Plans       from './pages/Plans';

function hasPendingMasterSsoAttempt() {
  const params = new URLSearchParams(window.location.search);
  const wantsMasterSso =
    params.get('sso') === 'master' ||
    params.get('google_auth') === '1' ||
    Boolean(params.get('ssoToken'));
  let optedOut = false;
  try {
    optedOut = sessionStorage.getItem('sparrowx_netsec_logged_out') === '1';
  } catch {
    optedOut = false;
  }
  return wantsMasterSso && !optedOut;
}

function App() {
  const [token,   setToken]   = useState(() => localStorage.getItem('sparrowx_token') || localStorage.getItem('sbs_token'));
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem('sparrowx_token') || localStorage.getItem('sbs_token')) || hasPendingMasterSsoAttempt()
  );

  // -- Fetch /api/me ---------------------------------------------------------
  const fetchMe = useCallback((tk) => {
    fetch('/api/me', { headers: { Authorization: `Bearer ${tk}` } })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('session expired');
      })
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem('sparrowx_token');
        localStorage.removeItem('sbs_token');
        setToken(null);
        setUser(null);
      });
  }, []);

  // Initial load & optional Master SSO exchange (?sso=master or ?ssoToken=...)
  useEffect(() => {
    if (token) {
      fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('session expired');
        })
        .then(data => { setUser(data); setLoading(false); })
        .catch(() => {
          localStorage.removeItem('sparrowx_token');
          localStorage.removeItem('sbs_token');
          setToken(null);
          setLoading(false);
        });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!hasPendingMasterSsoAttempt()) {
      return;
    }

    fetch('/api/auth/master-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params.get('ssoToken') ? { ssoToken: params.get('ssoToken') } : {}),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.token) {
          localStorage.setItem('sparrowx_token', data.token);
          localStorage.removeItem('sbs_token');
          if (data.user) {
            setUser(data.user);
          }
          setToken(data.token);
          setLoading(false);
          try {
            window.history.replaceState({}, '', '/dashboard');
          } catch {
            // ignore history API errors
          }
          return;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  // Poll /api/me every 10s to keep user fresh
  useEffect(() => {
    if (!token || !user) return;
    const id = setInterval(() => fetchMe(token), 10000);
    return () => clearInterval(id);
  }, [token, user?.id, fetchMe]);

  const handleSetToken = (t) => {
    if (t) {
      try {
        sessionStorage.removeItem('sparrowx_netsec_logged_out');
      } catch {
        // ignore storage errors
      }
      localStorage.setItem('sparrowx_token', t);
    } else {
      localStorage.removeItem('sparrowx_token');
    }
    localStorage.removeItem('sbs_token');
    setToken(t);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', justifyContent: 'center', alignItems: 'center',
        background: '#030407', color: '#f8fafc',
        fontFamily: "'JetBrains Mono', monospace", gap: '16px'
      }}>
        <img src="/logo.png?v=3d" alt="SparrowX NetSec" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(255,34,58,0.55))' }} />
        <div style={{
          width: '36px', height: '36px',
          border: '2px solid rgba(255,34,58,0.22)',
          borderTop: '2px solid #ff223a',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '0.76rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#94a3b8' }}>
          Initializing SparrowX NetSec...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/docs" element={<Docs />} />
        {!token ? (
          <>
            <Route path="/"          element={<Landing />} />
            <Route path="/login"     element={<Auth setToken={handleSetToken} initialTab="login" />} />
            <Route path="/register"  element={<Auth setToken={handleSetToken} initialTab="register" />} />
            <Route path="/dashboard" element={<Navigate to="/login" replace />} />
            <Route path="*"          element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route element={
            <TelemetryProvider token={token} user={user}>
              <Layout user={user} setToken={handleSetToken} />
            </TelemetryProvider>
          }>
            <Route path="/"          element={<Dashboard token={token} user={user} />} />
            <Route path="/dashboard" element={<Dashboard token={token} user={user} />} />
            <Route path="/login"     element={<Navigate to="/" replace />} />
            <Route path="/register"  element={<Navigate to="/" replace />} />
            <Route path="/terminal"  element={<Terminal  token={token} user={user} />} />
            <Route path="/firewall"  element={<Firewall  token={token} user={user} />} />
            <Route path="/blocklist" element={<Blocklist token={token} user={user} />} />
            <Route path="/install"   element={<Install   token={token} user={user} />} />
            <Route path="/apikeys"   element={<ApiKeys   token={token} user={user} setUser={setUser} />} />
            <Route path="/settings"  element={<Settings  token={token} user={user} />} />
            <Route path="/radar"     element={<ThreatRadar token={token} />} />
            <Route path="/map"       element={<ThreatMap token={token} />} />
            <Route path="/security"  element={<Security  token={token} />} />
            <Route path="/plans"     element={<Plans     token={token} user={user} />} />
            <Route path="*"          element={<Navigate to="/" />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
