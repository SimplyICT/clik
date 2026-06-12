import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUser } from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (getUser()) { nav('/dashboard', { replace: true }); return null; }

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await login(email, pw);
      // Determine role: if login returns customer_ref, they're a customer user; otherwise check user_profiles
      if (d.customer_id) {
        sessionStorage.setItem('role', 'customer_user');
        sessionStorage.setItem('customer_name', d.customer_name || '');
        try {
          const res = await fetch('/api/supabase/user_profiles?select=role&user_id=eq.' + d.user.id, {
            headers: { 'Authorization': 'Bearer ' + d.token }
          });
          const p = await res.json();
          if (Array.isArray(p) && p.length > 0) sessionStorage.setItem('role', p[0].role || 'customer_user');
        } catch {}
      } else {
        sessionStorage.setItem('role', 'admin');
      }
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
          style={{ width: '100%', padding: '12px', marginBottom: 20, borderRadius: 6, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 16 }} />
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: 6, border: 'none', background: loading ? '#555' : '#00d4ff', color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
