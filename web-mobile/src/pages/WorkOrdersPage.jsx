import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItemAny } from '../api/storage';

const WO_COLORS = { pending:'#94a3b8', in_progress:'#3b82f6', completed:'#22c55e', cancelled:'#ef4444' };
const WO_LABELS = { pending:'Pending', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled' };
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending', status: 'pending' },
  { key: 'in_progress', label: 'In Progress', status: 'in_progress' },
  { key: 'completed', label: 'Completed', status: 'completed' },
];

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const nav = useNavigate();

  const fetchOrders = useCallback(() => {
    const pid = getItemAny('author_profile_id');
    if (!pid) { setLoading(false); return; }
    const token = getItemAny('token');
    window.fetch(`/api/asset-management/work-orders?contractor_id=${pid}&limit=200`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const f = FILTERS.find(x => x.key === filter);
  const filtered = f?.status ? orders.filter(o => o.status === f.status) : orders;

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {FILTERS.map(f2 => (
          <button key={f2.key} onClick={() => setFilter(f2.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none',
            background: filter === f2.key ? '#1a1a2e' : '#e0e0e0',
            color: filter === f2.key ? '#fff' : '#333', fontWeight: 600,
            fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>{f2.label} ({f2.status ? orders.filter(o => o.status === f2.status).length : orders.length})</button>
        ))}
      </div>
      {filtered.length === 0 ? <Centered>No work orders</Centered> : filtered.map(o => (
        <div key={o.id} onClick={() => nav(`/work-orders/${o.id}`)}
          style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{o.title}</div>
            <span style={{ background: WO_COLORS[o.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{WO_LABELS[o.status] || o.status}</span>
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            {o.type && <span style={{ textTransform: 'capitalize' }}>{o.type}</span>}
            {o.priority && <> · {o.priority}</>}
            {o.scheduled_date && <> · {o.scheduled_date}</>}
          </div>
          {o.description && <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{o.description.slice(0, 100)}</div>}
        </div>
      ))}
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
