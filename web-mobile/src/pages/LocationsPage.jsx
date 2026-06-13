import { useState, useEffect } from 'react';
import { q } from '../api/client';

export default function LocationsPage() {
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const cid = localStorage.getItem('customer_id') || '';

  useEffect(() => {
    q('customerLocations', { select: '*', filters: cid ? [{ field: 'customerId', value: cid }] : [] }).then(d => { setLocs(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Centered>Loading...</Centered>;
  return (
    <div>
      {locs.length === 0 ? <Centered>No locations</Centered> : locs.map(l => (
        <div key={l.id} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.companyName}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{l.addressJson?.city || ''} {l.addressJson?.state || ''} {l.reference ? `(${l.reference})` : ''}</div>
        </div>
      ))}
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
