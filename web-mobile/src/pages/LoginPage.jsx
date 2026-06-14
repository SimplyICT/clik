import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUser } from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const nav = useNavigate();

  if (getUser()) { nav('/dashboard', { replace: true }); return null; }

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, pw, remember);
      nav('/dashboard', { replace: true });
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

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
