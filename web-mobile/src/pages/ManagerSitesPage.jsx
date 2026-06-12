import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

export default function ManagerSitesPage() {
  const [sites, setSites] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const nav = useNavigate();
  const cid = sessionStorage.getItem('customer_id') || '';

  useEffect(() => {
    Promise.all([
      q('customerLocations', { select: 'id,companyName,contactName,contactEmail,contactPhoneNumber,addressJson,reference,customerId', filters: cid ? [{ field: 'customerId', value: cid }] : [] }),
      q('requests', { select: 'id,title,status,serviceType,customerLocationProfileId', filters: cid ? [{ field: 'customerId', value: cid }] : [] }),
    ]).then(([l, r]) => { setSites(Array.isArray(l)?l:[]); setReqs(Array.isArray(r)?r:[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <button onClick={() => nav('/requests/new')} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>+ New Request</button>
      {sites.length === 0 ? <Centered>No sites assigned to your account</Centered> : sites.map(s => (
        <div key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.companyName}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
            {s.addressJson?.city || ''} {s.addressJson?.state || ''} {s.reference ? `(${s.reference})` : ''}
          </div>
          {selected?.id === s.id && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                <div>Contact: {s.contactName || '-'}</div>
                <div>Email: {s.contactEmail || '-'}</div>
                <div>Phone: {s.contactPhoneNumber || '-'}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#444' }}>Requests</div>
              {reqs.filter(r => r.customerLocationProfileId === s.id).length === 0
                ? <div style={{ color: '#888', fontSize: 13 }}>No requests for this site</div>
                : reqs.filter(r => r.customerLocationProfileId === s.id).map(r => (
                    <div key={r.id} style={{ padding: '8px 10px', background: '#f9f9f9', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div style={{ color: '#888', fontSize: 12 }}>{r.serviceType} · {r.status?.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
