import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

export default function ProfilePage() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = localStorage.getItem('role') || sessionStorage.getItem('role');
  const cname = localStorage.getItem('customer_name') || sessionStorage.getItem('customer_name') || '';
  const [profile, setProfile] = useState(null);
  const [pushoverKey, setPushoverKey] = useState('');
  const [pushoverStatus, setPushoverStatus] = useState('loading');
  const [savingPushover, setSavingPushover] = useState(false);
  const [pushoverMsg, setPushoverMsg] = useState('');

  useEffect(() => {
    const pid = localStorage.getItem('author_profile_id') || sessionStorage.getItem('author_profile_id');
    if (pid) {
      q('profiles', { select: 'company_name,contact_name,contact_email,contact_phone_number,profile_type', filters: [{ field: 'id', value: pid }] }).then(d => {
        if (Array.isArray(d) && d.length > 0) setProfile(d[0]);
      }).catch(() => {});
    }
    fetchPushoverStatus();
  }, []);

  async function fetchPushoverStatus() {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/pushover/key', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) { setPushoverStatus('error'); return; }
      const data = await resp.json();
      if (data.hasKey) {
        setPushoverStatus('active');
      } else {
        setPushoverStatus('setup');
      }
    } catch {
      setPushoverStatus('error');
    }
  }

  async function handleSavePushover() {
    if (!pushoverKey.trim()) return;
    setSavingPushover(true);
    setPushoverMsg('');
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/pushover/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ pushover_user_key: pushoverKey.trim() }),
      });
      if (!resp.ok) throw new Error('Failed');
      setPushoverStatus('active');
      setPushoverMsg('Pushover key saved!');
      setPushoverKey('');
    } catch {
      setPushoverMsg('Failed to save key');
    } finally {
      setSavingPushover(false);
    }
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, background: '#1a1a2e', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, margin: '0 auto 12px' }}>
          {(user.email || 'U')[0].toUpperCase()}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{profile?.company_name || cname || 'User'}</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{user.email}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2, textTransform: 'capitalize' }}>{role}</div>
      </div>

      {profile && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Details</h4>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
            <div><small style={{ color: '#888' }}>Name</small><div>{profile.contact_name || '-'}</div></div>
            <div><small style={{ color: '#888' }}>Email</small><div>{profile.contact_email || '-'}</div></div>
            <div><small style={{ color: '#888' }}>Phone</small><div>{profile.contact_phone_number || '-'}</div></div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Notifications</h4>
        {pushoverStatus === 'loading' && <div style={{ fontSize: 13, color: '#888' }}>Loading...</div>}
        {pushoverStatus === 'active' && (
          <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 8 }}>✓ Pushover connected</div>
        )}
        {pushoverStatus === 'setup' && (
          <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 8 }}>
            iOS uses Pushover for alerts. Install the Pushover app and enter your User Key.
          </div>
        )}
        {(pushoverStatus === 'setup' || pushoverStatus === 'active') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={pushoverKey}
              onChange={e => setPushoverKey(e.target.value)}
              placeholder="Pushover User Key"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
            <button onClick={handleSavePushover} disabled={savingPushover}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {savingPushover ? '...' : 'Save'}
            </button>
          </div>
        )}
        {pushoverMsg && <div style={{ fontSize: 12, color: pushoverMsg.includes('saved') ? '#22c55e' : '#ef4444', marginTop: 6 }}>{pushoverMsg}</div>}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>About</h4>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>
          <div>SimplyClik Mobile v1.0.0</div>
          <div style={{ marginTop: 4 }}><a href="#" style={{ color: '#00d4ff', textDecoration: 'none' }}>Terms of Service</a></div>
          <div><a href="#" style={{ color: '#00d4ff', textDecoration: 'none' }}>Privacy Policy</a></div>
        </div>
      </div>
    </div>
  );
}
