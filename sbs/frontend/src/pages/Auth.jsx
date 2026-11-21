import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Shield,
  Terminal,
  Activity,
  Lock,
  Server,
  Zap,
  Globe,
  Eye,
  EyeOff,
  Database,
  ArrowRight,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Auth({ setToken, initialTab = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register' || window.location.pathname === '/register' || initialTab === 'register') {
      return 'register';
    }
    return 'login';
  });
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [masterPeek, setMasterPeek] = useState(null);
  const [providers, setProviders] = useState({
    pgEnabled: true,
    masterSsoEnabled: true,
    autoApprove: true,
    masterUrl: 'https://sparrowx.net',
  });

  const loginIdRef = useRef(null);
  const regUserRef = useRef(null);
  const regEmailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/register' || params.get('tab') === 'register') {
      setTab('register');
    } else if (location.pathname === '/login' && params.get('tab') !== 'register') {
      setTab(initialTab === 'register' ? 'register' : 'login');
    }
  }, [location.pathname, location.search, initialTab]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMasterSsoLogin = useCallback(
    async (explicitToken = '') => {
      setSsoLoading(true);
      setError('');
      setMsg('');
      try {
        try {
          sessionStorage.removeItem('sparrowx_netsec_logged_out');
        } catch {
          // ignore storage restrictions
        }
        const res = await fetch('/api/auth/master-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(explicitToken ? { ssoToken: explicitToken } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.token) {
          setToken(data.token);
          return true;
        }
        setError(data?.error || 'Could not authorize SparrowX Master session.');
        return false;
      } catch {
        setError('Unable to reach NetSec SSO bridge. Please try manual sign-in.');
        return false;
      } finally {
        setSsoLoading(false);
      }
    },
    [setToken]
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const ssoMode = params.get('sso');
    const urlToken = params.get('ssoToken') || '';
    const authErr = params.get('auth_error') || '';
    if (authErr) {
      setError(authErr);
    }

    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setProviders((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});

    fetch('/api/auth/master-sso?peek=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (!active || !data) return;
        setMasterPeek(data);
        let optedOut = false;
        try {
          optedOut = sessionStorage.getItem('sparrowx_netsec_logged_out') === '1';
        } catch {
          optedOut = false;
        }
        if ((ssoMode === 'master' || urlToken) && (data.authenticated || urlToken) && !optedOut) {
          await handleMasterSsoLogin(urlToken);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [handleMasterSsoLogin]);

  const validateFields = () => {
    const errors = {};
    if (tab === 'login') {
      if (!loginIdentifier.trim()) {
        errors.loginIdentifier = 'Enter your registered email address or username.';
      }
      if (!password) {
        errors.password = 'Enter your account password.';
      }
    } else {
      const cleanUser = regUsername.trim();
      const cleanEmail = regEmail.trim();
      if (cleanUser.length < 3) {
        errors.regUsername = 'Choose an operator username (at least 3 characters).';
      }
      if (!EMAIL_RE.test(cleanEmail)) {
        errors.regEmail = 'Enter a valid email address (for example, name@domain.com).';
      }
      if (password.length < 8) {
        errors.password = 'Use at least 8 characters for your portal password.';
      }
    }
    return errors;
  };

  const allErrors = validateFields();
  const visibleError = (field) => (submitAttempted || touched[field] ? allErrors[field] : '');

  const switchTab = (nextTab) => {
    if (nextTab === 'register' && loginIdentifier.includes('@') && !regEmail) {
      setRegEmail(loginIdentifier.trim());
    }
    setTab(nextTab);
    setError('');
    setMsg('');
    setTouched({});
    setSubmitAttempted(false);
  };

  const focusFirstError = (errors) => {
    if (errors.loginIdentifier && loginIdRef.current) {
      loginIdRef.current.focus();
    } else if (errors.regUsername && regUserRef.current) {
      regUserRef.current.focus();
    } else if (errors.regEmail && regEmailRef.current) {
      regEmailRef.current.focus();
    } else if (errors.password && passwordRef.current) {
      passwordRef.current.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');
    setMsg('');

    const currentErrors = validateFields();
    if (Object.keys(currentErrors).length > 0) {
      focusFirstError(currentErrors);
      setError('Review the highlighted fields before continuing.');
      return;
    }

    setSubmitting(true);
    const url = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload =
      tab === 'login'
        ? { username: loginIdentifier.trim(), email: loginIdentifier.trim(), password }
        : { username: regUsername.trim(), email: regEmail.trim().toLowerCase(), password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data.token) {
          try {
            sessionStorage.removeItem('sparrowx_netsec_logged_out');
          } catch {
            // ignore storage errors
          }
          setToken(data.token);
          return;
        }
        setMsg(
          data.message ||
            'Account created and queued for administrator approval. You can sign in once approved.'
        );
        setLoginIdentifier(regEmail.trim());
        setTab('login');
        setPassword('');
        setTouched({});
        setSubmitAttempted(false);
      } else if (data.isPending) {
        setError('Your account is still pending approval by an administrator.');
      } else {
        setError(data.error || 'Authentication failed. Check your credentials and try again.');
      }
    } catch {
      setError('Network connection interrupted while reaching SparrowX auth service.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToAuth = () => {
    const target = document.getElementById('auth-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      const firstInput = target.querySelector('input');
      if (firstInput) firstInput.focus({ preventScroll: true });
    }
  };

  const masterUrl = masterPeek?.masterUrl || providers.masterUrl || 'https://sparrowx.net';
  const dbPrimary = masterPeek?.database?.primary || null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)', fontFamily: 'var(--font-body)', overflowX: 'clip' }}>
      {/* Ambient Background Glows */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(255, 34, 58, 0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* Navbar */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          width: '100%',
          zIndex: 50,
          padding: scrolled ? '14px 36px' : '20px 36px',
          background: scrolled ? 'rgba(3, 5, 8, 0.92)' : 'rgba(3, 5, 8, 0.72)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.25s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <img
            src="/logo.png?v=3d"
            alt="SparrowX NetSec"
            style={{ width: '40px', height: '40px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(255,34,58,0.5))' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.03em' }}>
              SPARROWX <span style={{ color: '#ff223a' }}>NETSEC</span>
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.16em', fontFamily: 'var(--font-mono)' }}>
              XDP · L3/L4/L7 SHIELD
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '22px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/')}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            Overview
          </button>
          <a href="#services" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.88rem', fontWeight: '500' }}>
            Services
          </a>
          <a href="#architecture" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.88rem', fontWeight: '500' }}>
            Architecture
          </a>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/docs')}
            style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={14} /> Docs
          </button>
          <a href="https://gamesec.sparrowx.net" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.86rem', fontWeight: '500' }}>
            GameSec L4
          </a>
          <a href={masterUrl} style={{ color: 'var(--text-soft)', textDecoration: 'none', fontSize: '0.86rem', fontWeight: '600' }}>
            Master Portal
          </a>
          <button type="button" onClick={scrollToAuth} style={{ padding: '9px 18px', fontSize: '0.84rem' }}>
            {tab === 'register' ? 'Create Account' : 'Operator Login'}
          </button>
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 10, paddingTop: '110px' }}>
        {/* Hero Section */}
        <section style={{ padding: '56px 36px', maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', minHeight: '80vh', gap: '56px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 480px' }}>
            <div style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(255, 34, 58, 0.14)', border: '1px solid rgba(255, 34, 58, 0.35)', borderRadius: '999px', color: '#ff4d61', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '1.2px', marginBottom: '22px', textTransform: 'uppercase' }}>
              Autonomous XDP / eBPF Scrubbing Cloud
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 4.6vw, 4.1rem)', lineHeight: '1.1', marginBottom: '22px' }}>
              Defend Your Network with <span className="glow-text">Wire-Speed XDP</span>
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: '1.65', marginBottom: '32px', maxWidth: '580px' }}>
              Deploy kernel-level XDP/eBPF scrubbing agents across your Linux and game server fleet, synchronize with your SparrowX Master account, and drop volumetric floods in sub-millisecond time.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button type="button" onClick={scrollToAuth} style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                {tab === 'register' ? 'Complete Registration' : 'Sign In to Console'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/docs')}
                style={{ padding: '14px 24px', fontSize: '0.95rem' }}
              >
                Read XDP Documentation
              </button>
            </div>
          </div>

          {/* Auth + Master Developer Connection Panel */}
          <div id="auth-section" style={{ flex: '1 1 420px', display: 'flex', justifyContent: 'center' }}>
            <div className="glass-panel auth-card">
              {/* Tabs */}
              <div className="auth-tabs" role="tablist" aria-label="Account authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'login'}
                  className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => switchTab('login')}
                >
                  <LogIn size={16} /> SIGN IN
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'register'}
                  className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
                  onClick={() => switchTab('register')}
                >
                  <UserPlus size={16} /> REGISTER
                </button>
              </div>

              {/* Official Google OAuth 2.0 Sign-In */}
              <button
                type="button"
                className="auth-google-btn"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('sparrowx_netsec_logged_out');
                  } catch {
                    // ignore storage errors
                  }
                  window.location.href = '/api/auth/google/login';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* SparrowX Master Connection SSO Bridge */}
              {masterPeek?.authenticated ? (
                <div className="auth-sso-card">
                  <div className="auth-sso-header">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} /> SparrowX Master Session Detected
                    </span>
                    <span>{masterPeek.user?.role === 'admin' ? 'ADMIN' : 'DEVELOPER'}</span>
                  </div>
                  <div className="auth-sso-identity">
                    Signed in on Master Portal as <strong>{masterPeek.user?.email}</strong>
                  </div>
                  {dbPrimary ? (
                    <div className="auth-db-pill">
                      <Database size={13} />
                      <span>
                        Dev DB linked: <strong>{dbPrimary.dbName}</strong> ({dbPrimary.planId})
                      </span>
                    </div>
                  ) : (
                    <div className="auth-db-pill" style={{ color: 'var(--text-soft)', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Database size={13} />
                      <span>Master tenant linked — ready for NetSec sync</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="auth-sso-btn"
                    onClick={() => handleMasterSsoLogin()}
                    disabled={ssoLoading || submitting}
                  >
                    {ssoLoading ? 'Linking Master Session...' : 'Continue with Master Session'}
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="auth-sso-card muted">
                  <div className="auth-sso-header">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Database size={14} /> SparrowX Master SSO Bridge
                    </span>
                    <a
                      href={masterUrl}
                      style={{ color: '#22d3ee', textDecoration: 'underline', textTransform: 'none', fontSize: '0.75rem' }}
                    >
                      Open Master Portal
                    </a>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                    Have a SparrowX Master account? Sign in directly with your Master email &amp; password below to link your Developer Database and NetSec scrubbing panel.
                  </div>
                </div>
              )}

              <h2 style={{ marginBottom: '18px', textAlign: 'center', color: 'var(--text-main)', fontSize: '1.35rem' }}>
                {tab === 'login' ? 'Secure Portal Access' : 'Create Operator Account'}
              </h2>

              {/* Single Polite Status / Error Announcer */}
              <div role="status" aria-live="polite">
                {error && (
                  <div className="auth-status-banner error">
                    <Shield size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}
                {msg && (
                  <div className="auth-status-banner success">
                    <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{msg}</span>
                  </div>
                )}
              </div>

              <form noValidate onSubmit={handleSubmit} className="auth-form">
                {tab === 'login' ? (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-login-id">
                      Email Address or Username
                    </label>
                    <input
                      ref={loginIdRef}
                      id="auth-login-id"
                      name="username"
                      type="text"
                      className="auth-input"
                      autoComplete="username"
                      spellCheck={false}
                      autoCapitalize="none"
                      required
                      placeholder="operator@domain.com"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, loginIdentifier: true }))}
                      aria-invalid={Boolean(visibleError('loginIdentifier'))}
                      aria-describedby={visibleError('loginIdentifier') ? 'err-login-id' : undefined}
                    />
                    {visibleError('loginIdentifier') && (
                      <span id="err-login-id" className="auth-field-error">
                        {visibleError('loginIdentifier')}
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="auth-reg-username">
                        Operator Username
                      </label>
                      <input
                        ref={regUserRef}
                        id="auth-reg-username"
                        name="username"
                        type="text"
                        className="auth-input"
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="none"
                        minLength={3}
                        required
                        placeholder="cyberops_01"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, regUsername: true }))}
                        aria-invalid={Boolean(visibleError('regUsername'))}
                        aria-describedby={visibleError('regUsername') ? 'err-reg-username' : undefined}
                      />
                      {visibleError('regUsername') && (
                        <span id="err-reg-username" className="auth-field-error">
                          {visibleError('regUsername')}
                        </span>
                      )}
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="auth-reg-email">
                        Email Address
                      </label>
                      <input
                        ref={regEmailRef}
                        id="auth-reg-email"
                        name="email"
                        type="email"
                        className="auth-input"
                        autoComplete="email"
                        spellCheck={false}
                        autoCapitalize="none"
                        required
                        placeholder="operator@domain.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, regEmail: true }))}
                        aria-invalid={Boolean(visibleError('regEmail'))}
                        aria-describedby={visibleError('regEmail') ? 'err-reg-email' : undefined}
                      />
                      {visibleError('regEmail') && (
                        <span id="err-reg-email" className="auth-field-error">
                          {visibleError('regEmail')}
                        </span>
                      )}
                    </div>
                  </>
                )}

                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-password">
                    {tab === 'login' ? 'Password' : 'Create Password'}
                  </label>
                  <div className="auth-password-wrap">
                    <input
                      ref={passwordRef}
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input"
                      autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                      minLength={tab === 'register' ? 8 : undefined}
                      required
                      placeholder={tab === 'login' ? 'Enter your password' : 'At least 8 characters'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                      aria-invalid={Boolean(visibleError('password'))}
                      aria-describedby={
                        [tab === 'register' ? 'hint-password' : '', visibleError('password') ? 'err-password' : '']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {tab === 'register' && (
                    <span id="hint-password" className="auth-field-hint">
                      Minimum 8 characters. Syncs with your SparrowX Developer account.
                    </span>
                  )}
                  {visibleError('password') && (
                    <span id="err-password" className="auth-field-error">
                      {visibleError('password')}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={submitting || ssoLoading}
                  aria-busy={submitting}
                >
                  {submitting
                    ? tab === 'login'
                      ? 'VERIFYING CREDENTIALS...'
                      : 'CREATING OPERATOR ACCOUNT...'
                    : tab === 'login'
                      ? 'AUTHORIZE SESSION'
                      : 'CREATE ACCOUNT & ENTER'}
                </button>
              </form>

              {tab === 'login' && (
                <details className="auth-help-disclosure">
                  <summary>Need help accessing your credentials?</summary>
                  <p>
                    Enter the email and password registered on NetSec or on{' '}
                    <a href={masterUrl} style={{ color: '#22d3ee' }}>
                      sparrowx.net
                    </a>
                    .{' '}
                    {masterPeek?.authenticated
                      ? 'Your active Master session is detected above — click Continue with Master Session for 1-click sign-in.'
                      : 'You can also switch to the REGISTER tab above to provision a new operator account with instant activation.'}
                  </p>
                </details>
              )}

              <div className="auth-meta-footer">
                <span>
                  Auth: <strong>{providers.pgEnabled ? 'Sovereign PostgreSQL' : 'Supabase Auth'}</strong>
                </span>
                <span>
                  {providers.autoApprove ? 'Instant Developer Activation' : 'Admin Approval Gate'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" style={{ padding: '90px 36px', background: 'rgba(5, 7, 12, 0.5)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '70px' }}>
              <h2 style={{ fontSize: '2.7rem', marginBottom: '18px' }}>
                Comprehensive <span className="text-cyan">Protection</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '680px', margin: '0 auto' }}>
                SparrowX NetSec delivers kernel-accelerated defense tools to shield your Linux and game server environments from volumetric floods and unauthorized access.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '28px' }}>
              <div className="glass-panel" style={{ padding: '36px' }}>
                <div style={{ background: 'rgba(255, 34, 58, 0.12)', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '22px', color: 'var(--accent-cyan)' }}>
                  <Zap size={28} />
                </div>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>XDP Instant Mitigation</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Drops spoofed SYN, UDP amplification, and botnet floods inside the NIC driver ring buffer before kernel socket allocation.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '36px' }}>
                <div style={{ background: 'rgba(34, 211, 238, 0.12)', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '22px', color: '#22d3ee' }}>
                  <Activity size={28} />
                </div>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Sub-Second Telemetry</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Stream live PPS, Mbps, SYN rate, and per-IP threat radar scores over encrypted WebSockets with zero polling lag.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '36px' }}>
                <div style={{ background: 'rgba(255, 34, 58, 0.12)', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '22px', color: 'var(--accent-cyan)' }}>
                  <Terminal size={28} />
                </div>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Zero-SSH Remote Console</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Inspect nftables rulesets, trigger automated self-healing, and execute remote diagnostics without exposing public SSH ports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="architecture" style={{ padding: '90px 36px', position: 'relative' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '72px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 480px' }}>
              <h2 style={{ fontSize: '2.4rem', marginBottom: '28px' }}>
                5-Stage <span className="text-red">Scrubbing Architecture</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Server size={22} color="#ff223a" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>The SparrowX NetSec Agent</h4>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      A lightweight daemon that hooks into eBPF/XDP and nftables on your Linux host, streaming live `/proc/net/dev` packet counters and enforcing instant bans.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Globe size={22} color="#22d3ee" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>SparrowGuard WireGuard Clean Pipe</h4>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      Route ingress traffic through the guard scrubbing node and forward only verified, clean packets to your origin server over an encrypted WireGuard tunnel.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Lock size={22} color="#10b981" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Zero-Trust Master Sync</h4>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      Credentials and developer databases synchronize directly across sovereign PostgreSQL clusters with HMAC-signed session tokens.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 460px' }}>
              <div className="glass-panel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #ff223a, #22d3ee)' }} />
                <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.82rem', marginBottom: '18px' }}>
                  Live Scrubbing Telemetry Benchmark
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>XDP Driver Hook</span>
                    <span style={{ color: '#10b981' }}>● ARMED (XDP_DROP)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Scrubbing Latency</span>
                    <span style={{ color: '#22d3ee' }}>&lt; 0.38 ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>eBPF Blacklist Capacity</span>
                    <span style={{ color: '#ff223a' }}>2,000,000+ IPs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Kernel CPU Overhead</span>
                    <span style={{ color: '#f59e0b' }}>&lt; 1.8% @ 10Mpps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '36px', background: 'rgba(3, 5, 8, 0.9)', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
          <img src="/logo.png?v=3d" alt="SparrowX NetSec" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
            SPARROWX <span style={{ color: '#ff223a' }}>NETSEC</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
          &copy; {new Date().getFullYear()} SparrowX Sovereign Network Security (`netsec.sparrowx.net`). All rights reserved.
        </p>
      </footer>
    </div>
  );
}
