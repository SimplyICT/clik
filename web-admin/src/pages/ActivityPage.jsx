import { useState, useEffect } from 'react';
import { q } from '../api/client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ActivityPage() {
  const [summary, setSummary] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const year = now.getFullYear();

  const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month+1, 0).toISOString().slice(0,10);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    Promise.all([
      q('requests', { select: 'customerId,customerName,status,customerLocationId', limit: 500 }),
      q('customers', { select: 'id,name', order: 'name.asc' }),
    ]).then(([requests, customers]) => {
      const reqs = requests || [];
      const custMap = {};
      (customers || []).forEach(c => { custMap[c.id] = c.name; });

      const byCustomer = {};
      reqs.forEach(r => {
        const cid = r.customerId || 'unknown';
        if (!byCustomer[cid]) byCustomer[cid] = { customerName: r.customerName || custMap[cid] || 'Unknown', open: 0, closed: 0, total: 0, ids: [] };
        byCustomer[cid].total++;
        byCustomer[cid].ids.push(r.id);
        if (r.status === 'completed' || r.status === 'contractor_completed' || r.status === 'declined' || r.status === 'cancelled') {
          byCustomer[cid].closed++;
        } else {
          byCustomer[cid].open++;
        }
      });

      setSummary(Object.entries(byCustomer).map(([id, d]) => ({ id, ...d })).filter(s => s.total > 0));
      setLoading(false);
    });
  }, [month]);

  const showDetail = async (customerId, customerName) => {
    setDetail(customerName);
    setDetailData([]);
    const [reqs, locs] = await Promise.all([
      q('requests', { select: 'id,title,status,customerLocationId,customerLocationProfileId', filters: [{ field: 'customerId', value: customerId }], limit: 200 }),
      q('customerLocations', { select: 'id,companyName', filters: [{ field: 'customerId', value: customerId }], limit: 100 }),
    ]);
    const locMap = {};
    (locs || []).forEach(l => { locMap[l.id] = l.companyName; });
    const locReqs = {};
    (reqs || []).forEach(r => {
      const lid = r.customerLocationProfileId || 'unknown';
      if (!locReqs[lid]) locReqs[lid] = { locationName: locMap[lid] || 'Location ' + lid.slice(0,8), open: 0, closed: 0, total: 0 };
      locReqs[lid].total++;
      if (r.status === 'completed' || r.status === 'contractor_completed' || r.status === 'declined' || r.status === 'cancelled') {
        locReqs[lid].closed++;
      } else {
        locReqs[lid].open++;
      }
    });
    setDetailData(Object.entries(locReqs).map(([id, d]) => ({ id, ...d })));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>
          {detail ? <><a href="#" onClick={e => { e.preventDefault(); setDetail(null); }} style={{ color: '#00d4ff', textDecoration: 'none' }}>Activity</a> / {detail}</> : 'Activity Summary'}
        </h2>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
        </select>
      </div>

      {!detail ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Customer</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Open</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Closed</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Total</th>
            <th style={{ width: 40 }}></th>
          </tr></thead>
          <tbody>
            {summary.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.customerName}</td>
                <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 600 }}>{s.open}</td>
                <td style={{ padding: '10px 14px', color: '#22c55e', fontWeight: 600 }}>{s.closed}</td>
                <td style={{ padding: '10px 14px', color: '#666' }}>{s.total}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => showDetail(s.id, s.customerName)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🔍</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Location</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Open</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Closed</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Total</th>
          </tr></thead>
          <tbody>
            {detailData.map(d => (
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
