import { useState, useEffect } from 'react';
import { q, customerFilter } from '../api/client';

export default function LocationsPage() {
  const [locs, setLocs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const cf = customerFilter();
    Promise.all([
      q('customerLocations', { select: '*', filters: cf }),
      q('requests', { select: 'id,title,status,serviceType,customerLocationProfileId', filters: cf }),
    ]).then(([l, r]) => {
      setLocs(Array.isArray(l) ? l : []);
      setRequests(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Service Locations ({locs.length})</h2>
        {locs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No locations found</div>
        ) : (
          locs.map(l => (
            <div key={l.id} onClick={() => setSelected(l)}
              style={{ padding: '14px 16px', background: selected?.id === l.id ? '#f0f7ff' : '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600 }}>{l.companyName || 'Unknown'}</div>
              <div style={{ color: '#666', fontSize: 12 }}>{l.addressJson?.city || ''} {l.addressJson?.state || ''} {l.reference ? `(${l.reference})` : ''}</div>
            </div>
          ))
        )}
      </div>
      <div>
        {selected ? (
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0' }}>
            <h3 style={{ marginBottom: 12 }}>{selected.companyName}</h3>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              <div>Contact: {selected.contactName || '-'}</div>
              <div>Email: {selected.contactEmail || '-'}</div>
              <div>Phone: {selected.contactPhoneNumber || '-'}</div>
              {selected.reference && <div>Reference: {selected.reference}</div>}
            </div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Requests at this location</h4>
            {requests.filter(r => r.customerLocationProfileId === selected.id).length === 0 ? (
              <div style={{ color: '#888', fontSize: 13 }}>No requests for this location</div>
            ) : (
              requests.filter(r => r.customerLocationProfileId === selected.id).map(r => (
                <div key={r.id} style={{ padding: '10px 12px', background: '#f9f9f9', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{r.serviceType} — {r.status?.replace(/_/g, ' ')}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#ccc', background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            Select a location to view details
          </div>
        )}
      </div>
    </div>
  );
}
