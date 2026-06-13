import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

export default function ProfilePage() {
  const nav = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const role = sessionStorage.getItem('role');
  const cname = sessionStorage.getItem('customer_name') || '';
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const pid = sessionStorage.getItem('author_profile_id');
    if (pid) {
      q('profiles', { select: 'company_name,contact_name,contact_email,contact_phone_number,profile_type', filters: [{ field: 'id', value: pid }] }).then(d => {
        if (Array.isArray(d) && d.length > 0) setProfile(d[0]);
      }).catch(() => {});
    }
  }, []);

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
