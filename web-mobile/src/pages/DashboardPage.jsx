import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const nav = useNavigate();
  const role = sessionStorage.getItem('role');
  const isContractor = role === 'contractor';
  const cid = sessionStorage.getItem('customer_id') || '';

  useEffect(() => {
    if (isContractor) {
      q('requests', { select: 'id,title,status,priority', filters: cid ? [{ field: 'contractorProfileId', value: cid }] : [], limit: 20 }).then(d => setData(Array.isArray(d) ? d : [])).catch(() => setData([]));
    } else {
      const cf = cid ? [{ field: 'customerId', value: cid }] : [];
      Promise.all([
        q('requests', { select: 'id', filters: cf }),
        q('customerLocations', { select: 'id', filters: cf }),
      ]).then(([r, l]) => setData({ requests: Array.isArray(r) ? r.length : 0, locations: Array.isArray(l) ? l.length : 0 })).catch(() => setData({ requests: 0, locations: 0 }));
    }
  }, []);

  if (!data) return <Centered>Loading...</Centered>;

  if (isContractor) {
    const open = data.filter(r => !['completed','declined','cancelled'].includes(r.status));
    return (
      <div>
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#00d4ff' }}>{open.length}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Open Jobs</div>
        </div>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Recent Jobs</h3>
        {data.slice(0, 5).map(r => (
          <div key={r.id} onClick={() => nav(`/jobs/${r.id}`)} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{r.status?.replace(/_/g, ' ')} · {r.priority}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Card label="Service Locations" value={data.locations} color="#00d4ff" onClick={() => nav('/locations')} />
      <Card label="Open Requests" value={data.requests} color="#ff9500" onClick={() => nav('/requests')} />
    </div>
  );
}

function Card({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 10, padding: 20, textAlign: 'center', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
      <div style={{ fontSize: 36, fontWeight: 700, color }}>{value ?? '-'}</div>
      <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
