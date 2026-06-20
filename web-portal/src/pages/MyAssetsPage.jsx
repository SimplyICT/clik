import { useState, useEffect } from 'react';
import { q, authHeaders, customerFilter } from '../api/client';
import AssetDetailView from './AssetDetailView';

const API = '/api/asset-management';

const STATUS_COLORS = {
  'Active': '#22c55e',
  'Inactive': '#94a3b8',
  'Under Maintenance': '#f59e0b',
  'Retired': '#ef4444',
};

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}

export default function MyAssetsPage() {
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cid = storage().getItem('customer_id');
      const [assetData, locData] = await Promise.all([
        fetch(`${API}/assets?customer_id=${encodeURIComponent(cid || '')}`, { headers: { ...authHeaders() } }).then(r => {
          if (!r.ok) throw new Error('Failed to load assets');
          return r.json();
        }),
        q('customerLocations', { select: 'id,companyName', filters: customerFilter() }).catch(() => []),
      ]);
      setAssets(Array.isArray(assetData) ? assetData : []);
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdatedAsset = (updated) => {
    setSelected(updated);
    setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const categories = [...new Set(assets.filter(a => a.category).map(a => a.category))];

  const filtered = assets.filter(a => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (locationFilter && a.customer_location_id !== locationFilter) return false;
    return true;
  });

  const locName = (id) => locations.find(l => l.id === id)?.companyName || id?.slice(0, 8) || '-';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading assets...</div>;

  if (error) return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>My Assets</h2>
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>
    </div>
  );

  return (
    <div className="two-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>My Assets ({assets.length})</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">All Locations</option>
            {locations.filter(l => assets.some(a => a.customer_location_id === l.id)).map(l => (
              <option key={l.id} value={l.id}>{l.companyName}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No assets found</div>
        ) : (
          filtered.map(a => (
            <div key={a.id} onClick={() => setSelected(a)}
              style={{ padding: '14px 16px', background: selected?.id === a.id ? '#f0f7ff' : '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{a.asset_name || 'Unnamed Asset'}</div>
                <span style={{ background: STATUS_COLORS[a.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {a.status || 'Unknown'}
                </span>
              </div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                {a.asset_code} {a.category ? `· ${a.category}` : ''} {a.customer_location_id ? `· ${locName(a.customer_location_id)}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
      <div>
        {selected ? (
          <AssetDetailView asset={selected} onClose={() => setSelected(null)} onAssetUpdated={handleUpdatedAsset} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#ccc', background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            Select an asset to view details
          </div>
        )}
      </div>
    </div>
  );
}
