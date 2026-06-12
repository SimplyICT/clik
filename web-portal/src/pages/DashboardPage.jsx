import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q, customerFilter } from '../api/client';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    const cf = customerFilter();
    Promise.all([
      q('requests', { select: 'id', filters: cf }),
      q('customerLocations', { select: 'id', filters: cf }),
    ]).then(([reqs, locs]) => {
      setStats({
        requests: Array.isArray(reqs) ? reqs.length : 0,
        locations: Array.isArray(locs) ? locs.length : 0,
      });
    }).catch(() => setStats({ requests: 0, locations: 0 }));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div onClick={() => nav('/locations')} style={{ background: '#fff', borderRadius: 8, padding: 24, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Service Locations</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#00d4ff' }}>{stats?.locations ?? '-'}</div>
        </div>
        <div onClick={() => nav('/requests')} style={{ background: '#fff', borderRadius: 8, padding: 24, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Open Requests</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#ff9500' }}>{stats?.requests ?? '-'}</div>
        </div>
      </div>
    </div>
  );
}
