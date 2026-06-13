import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (localStorage.getItem('user')) { nav('/dashboard', { replace: true }); return null; }

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || d.error || 'Login failed');
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      if (d.customer_id) localStorage.setItem('customer_id', d.customer_id);
      if (d.customer_ref) localStorage.setItem('customer_ref', d.customer_ref);
      if (d.customer_name) localStorage.setItem('customer_name', d.customer_name);
      if (d.author_profile_id) localStorage.setItem('author_profile_id', d.author_profile_id);
      nav('/dashboard', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <form onSubmit={submit} style={{ background: '#16213e', padding: 40, borderRadius: 8, width: 'min(360px, 90vw)' }}>
        <h1 style={{ color: '#fff', marginBottom: 24, fontSize: 22 }}>Simplyclik Portal</h1>
        {error && <div style={{ background: '#ff4444', color: '#fff', padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 4, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 14 }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', marginBottom: 20, borderRadius: 4, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 14 }} />
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '10px', borderRadius: 4, border: 'none', background: loading ? '#555' : '#00d4ff', color: '#000', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
