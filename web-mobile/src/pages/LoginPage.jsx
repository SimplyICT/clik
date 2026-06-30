import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUser } from '../api/client';
import { setItem } from '../api/storage';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const [remember, setRemember] = useState(true);
  const nav = useNavigate();

  // Auto-check cookie bridge on mount (passwordless invite flow)
  useEffect(() => {
    const timer = setTimeout(() => setAutoChecking(false), 3000);
    if (getUser()) { clearTimeout(timer); nav('/', { replace: true }); return; }
    fetch('/api/auth/cookie', { credentials: 'include', signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.token) {
          setItem('token', d.token);
          cacheToken(d.token);
          setItem('user', JSON.stringify(d.user));
          if (d.permissions) setItem('permissions', JSON.stringify(d.permissions));
          if (d.author_profile_id) setItem('author_profile_id', d.author_profile_id);
          if (d.customer_id) setItem('customer_id', d.customer_id);
          if (d.customer_name) setItem('customer_name', d.customer_name);
          if (d.role) setItem('role', d.role);
          nav('/', { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setAutoChecking(false); });
    return () => clearTimeout(timer);
  }, []);

  if (getUser()) return null;

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, pw, remember);
      nav('/', { replace: true });
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  if (autoChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', padding: 20 }}>
        <div style={{ color: '#888', fontSize: 14 }}>Checking session...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', padding: 20 }}>
      <form onSubmit={submit} style={{ background: '#16213e', padding: 32, borderRadius: 12, width: '100%', maxWidth: 360 }}>
        <h1 style={{ color: '#fff', marginBottom: 24, fontSize: 20 }}>SimplyClik</h1>
        {error && <div style={{ background: '#ef4444', color: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: 10, borderRadius: 6, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 16 }} />
        <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: 16, borderRadius: 6, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 16 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#888', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#00d4ff' }} />
          Remember me
        </label>
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: 6, border: 'none', background: loading ? '#555' : '#00d4ff', color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
