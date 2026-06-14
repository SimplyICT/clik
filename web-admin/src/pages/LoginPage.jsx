import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUser, isAdmin } from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const nav = useNavigate();

  if (getUser() && isAdmin()) { nav('/dashboard', { replace: true }); return null; }

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await login(email, password, remember);
      if (d.is_admin) {
        nav('/dashboard', { replace: true });
      } else if (d.author_profile_id) {
        // Non-admin: detect role and redirect to the right app
        setError('Redirecting...');
        const s = remember ? localStorage : sessionStorage;
        try {
          const resp = await fetch('/api/supabase/profiles?select=profile_type&id=eq.' + d.author_profile_id, {
            headers: { 'Authorization': 'Bearer ' + d.token }
          });
          const p = await resp.json();
          if (Array.isArray(p) && p.length > 0) {
            const role = p[0].profile_type === 'contractor' ? 'contractor' : 'manager';
            s.setItem('role', role);
            window.location.href = role === 'contractor' ? '/mobile/' : '/portal/';
          } else {
            window.location.href = '/portal/';
          }
        } catch {
          window.location.href = '/portal/';
        }
      } else {
        setError('Unknown user type. Please use the correct portal.');
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <form onSubmit={submit} style={{ background: '#16213e', padding: 40, borderRadius: 8, width: 360 }}>
        <h1 style={{ color: '#fff', marginBottom: 24, fontSize: 22 }}>Simplyclik</h1>
        <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>Sign in with your account. You'll be directed to the correct portal based on your role.</p>
        {error && <div style={{ background: '#ff4444', color: '#fff', padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 4, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 14 }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', marginBottom: 16, borderRadius: 4, border: '1px solid #333', background: '#0f3460', color: '#fff', fontSize: 14 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#888', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#00d4ff' }} />
          Remember me
        </label>
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '10px', borderRadius: 4, border: 'none', background: loading ? '#555' : '#00d4ff', color: '#000', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
