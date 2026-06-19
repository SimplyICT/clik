import { useState, useEffect } from 'react';
import { authHeaders } from '../api/client';

const API = '/api/asset-management';

const STATUS_COLORS = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

const PRIORITY_COLORS = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
};

const STATUS_OPTIONS = ['All', 'pending', 'in_progress', 'completed', 'cancelled'];

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}

export default function MyWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const cid = storage().getItem('customer_id');
        const assetRes = await fetch(`${API}/assets?customer_id=${encodeURIComponent(cid || '')}`, { headers: { ...authHeaders() } });
        if (!assetRes.ok) throw new Error('Failed to load assets');
        const assets = await assetRes.json();
        if (!Array.isArray(assets) || assets.length === 0) {
          setWorkOrders([]);
          setLoading(false);
          return;
        }
        const results = await Promise.all(
          assets.map(a =>
            fetch(`${API}/work-orders?asset_id=${a.id}`, { headers: { ...authHeaders() } })
              .then(r => r.ok ? r.json() : [])
              .then(orders => Array.isArray(orders) ? orders.map(o => ({ ...o, asset_name: a.asset_name })) : [])
              .catch(() => [])
          )
        );
        setWorkOrders(results.flat());
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = statusFilter === 'All' ? workOrders : workOrders.filter(wo => wo.status === statusFilter);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading work orders...</div>;

  if (error) return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>My Work Orders</h2>
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>My Work Orders ({workOrders.length})</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: statusFilter === s ? (STATUS_COLORS[s] || '#1a1a2e') : '#e0e0e0',
              color: statusFilter === s ? '#fff' : '#333',
            }}>
            {s === 'All' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No work orders found</div>
      ) : (
        filtered.map(wo => (
          <div key={wo.id} style={{ padding: '14px 16px', background: '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{wo.title || 'Untitled'}</div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{wo.asset_name} {wo.type ? `· ${wo.type}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ background: PRIORITY_COLORS[wo.priority] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {wo.priority || 'low'}
                </span>
                <span style={{ background: STATUS_COLORS[wo.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {wo.status ? wo.status.replace(/_/g, ' ') : 'unknown'}
                </span>
              </div>
            </div>
            {wo.scheduled_date && (
              <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
                Scheduled: {new Date(wo.scheduled_date).toLocaleDateString()}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
