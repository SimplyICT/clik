import { useState, useEffect } from 'react';
import { q, customerFilter } from '../api/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ActivityPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    setLoading(true);
    const cf = customerFilter();
    Promise.all([
      q('requests', { select: 'id,title,status,customerLocationProfileId,serviceType', filters: cf }),
      q('customerLocations', { select: 'id,companyName', filters: cf }),
    ]).then(([reqs, locs]) => {
      const locMap = {};
      (locs || []).forEach(l => { locMap[l.id] = l.companyName; });
      const grouped = {};
      (reqs || []).forEach(r => {
        const lid = r.customerLocationProfileId || 'unknown';
        if (!grouped[lid]) grouped[lid] = { locationName: locMap[lid] || 'Location ' + lid.slice(0,8), open: 0, closed: 0, total: 0 };
        grouped[lid].total++;
        if (r.status === 'completed' || r.status === 'contractor_completed') grouped[lid].closed++;
        else grouped[lid].open++;
      });
      setData(Object.entries(grouped).map(([id, d]) => ({ id, ...d })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [month]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Activity</h2>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {data.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No activity data</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Location</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Open</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Closed</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Total</th>
          </tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.locationName}</td>
                <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 600 }}>{d.open}</td>
                <td style={{ padding: '10px 14px', color: '#22c55e', fontWeight: 600 }}>{d.closed}</td>
                <td style={{ padding: '10px 14px', color: '#666' }}>{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
