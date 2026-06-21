import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { canEdit } from '../api/client';

const TOKEN = () => localStorage.getItem('token');
const headers = () => ({ 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

async function apiGet(path) {
  const res = await fetch(`/api/asset-management${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Vehicle', 'Tool', 'Equipment', 'Network', 'Other'];
const STATUS_FILTERS = ['All', 'active', 'inactive', 'under_repair', 'retired'];

const STATUS_COLORS = { active: '#22c55e', inactive: '#94a3b8', under_repair: '#f59e0b', retired: '#ef4444', disposed: '#6b7280' };

export default function AssetsPage() {
  const nav = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await apiGet('/assets');
      setAssets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = assets.filter(a => {
    if (category !== 'All' && a.category !== category) return false;
    if (statusFilter !== 'All' && a.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <Centered>Loading assets...</Centered>;
  if (error) return <Centered>Error: {error}</Centered>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0, color: '#1a1a2e' }}>Assets</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setRefreshing(true); fetch(); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
            {refreshing ? '...' : '↻'}
          </button>
          {canEdit('assets') && (
            <button onClick={() => nav('/qr-scanner')}
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#1a1a2e', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              QR Scan
            </button>
          )}
          {canEdit('assets') && (
            <button onClick={() => nav('/assets/new')}
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              + New
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, background: '#fff' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, background: '#fff' }}>
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? <Centered>No assets found</Centered>
        : filtered.map(a => (
          <div key={a.id} onClick={() => nav(`/assets/${a.id}`)}
            style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.asset_name}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{a.asset_code}</div>
              </div>
              <span style={{ background: STATUS_COLORS[a.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {a.status?.replace('_', ' ')}
              </span>
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{a.category}{a.sub_category ? ` / ${a.sub_category}` : ''}</div>
          </div>
        ))}
    </div>
  );
}

function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
