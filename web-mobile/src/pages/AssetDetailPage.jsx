import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TOKEN = () => localStorage.getItem('token');
const headers = () => ({ 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

async function apiGet(path) {
  const res = await fetch(`/api/asset-management${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`/api/asset-management${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const STATUS_COLORS = { active: '#22c55e', inactive: '#94a3b8', under_repair: '#f59e0b', retired: '#ef4444', disposed: '#6b7280' };
const CRIT_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };

export default function AssetDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [asset, setAsset] = useState(null);
  const [parts, setParts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retiring, setRetiring] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const role = localStorage.getItem('role');
  const isContractor = role === 'contractor';

  useEffect(() => {
    Promise.all([
      apiGet(`/assets/${id}`).catch(e => { throw new Error('Asset: ' + e.message); }),
      apiGet(`/assets/${id}/parts`).catch(() => []),
      apiGet(`/assets/${id}/jobs`).catch(() => []),
    ]).then(([a, p, j]) => {
      setAsset(a);
      setParts(Array.isArray(p) ? p : []);
      setJobs(Array.isArray(j) ? j : []);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  const handleRetire = async () => {
    setRetiring(true);
    try {
      await apiPost(`/assets/${id}/retire`, {});
      setAsset({ ...asset, status: 'retired' });
      setShowRetireConfirm(false);
    } catch (e) { alert('Failed to retire: ' + e.message); }
    setRetiring(false);
  };

  if (loading) return <Centered>Loading...</Centered>;
  if (error) return <Centered>Error: {error}</Centered>;
  if (!asset) return <Centered>Asset not found</Centered>;

  return (
    <div>
      <button onClick={() => nav('/assets')} style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>← Assets</button>

      <div style={{ background: STATUS_COLORS[asset.status] || '#94a3b8', borderRadius: 10, padding: '14px 16px', marginBottom: 12, color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{asset.asset_name}</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{asset.asset_code} · {asset.status?.replace('_', ' ')}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Details</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#666' }}>
          <div><small style={{ color: '#888' }}>Category</small><div>{asset.category || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Sub Category</small><div>{asset.sub_category || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Status</small><div><span style={{ color: STATUS_COLORS[asset.status] || '#888', fontWeight: 600 }}>{asset.status?.replace('_', ' ')}</span></div></div>
          <div><small style={{ color: '#888' }}>Criticality</small><div><span style={{ color: CRIT_COLORS[asset.criticality] || '#888', fontWeight: 600 }}>{asset.criticality || '-'}</span></div></div>
          <div><small style={{ color: '#888' }}>Manufacturer</small><div>{asset.manufacturer || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Model</small><div>{asset.model || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Serial #</small><div>{asset.serial_number || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Location</small><div>{asset.location || '-'}</div></div>
        </div>
        {asset.notes && <div style={{ marginTop: 10, fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}><small style={{ color: '#888' }}>Notes</small><div style={{ marginTop: 2 }}>{asset.notes}</div></div>}
      </div>

      {/* Photos */}
      {asset.photos && asset.photos.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Photos ({asset.photos.length})</h4>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {asset.photos.map((url, i) => (
              <img key={i} src={url} alt={`Photo ${i + 1}`} style={{ width: 120, height: 90, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            ))}
          </div>
        </div>
      )}

      {/* Parts */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ fontSize: 14, margin: 0 }}>Parts ({parts.length})</h4>
          {!isContractor && (
            <button onClick={() => nav(`/assets/${id}/record-parts`)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Record
            </button>
          )}
        </div>
        {parts.length === 0
          ? <div style={{ color: '#888', fontSize: 13 }}>No parts recorded</div>
          : parts.map((p, i) => (
            <div key={p.id || i} style={{ padding: '8px 0', borderBottom: i < parts.length - 1 ? '1px solid #eee' : 'none', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.name || p.part_name}</span>
              <span style={{ color: '#666' }}>{p.quantity ? `x${p.quantity}` : ''}</span>
            </div>
          ))}
      </div>

      {/* Service History */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Service History ({jobs.length})</h4>
        {jobs.length === 0
          ? <div style={{ color: '#888', fontSize: 13 }}>No service history</div>
          : jobs.map((j, i) => (
            <div key={j.id || i} style={{ padding: '8px 0', borderBottom: i < jobs.length - 1 ? '1px solid #eee' : 'none', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{j.job_type || j.type}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{j.description?.slice(0, 80)}{j.description?.length > 80 ? '...' : ''}</div>
              <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>{j.created_at ? new Date(j.created_at).toLocaleDateString() : ''}</div>
            </div>
          ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <ActionBtn color="#22c55e" label="Create Job" onClick={() => nav(`/assets/${id}/create-job`)} />
        {!isContractor && <ActionBtn color="#00d4ff" label="Edit Asset" onClick={() => nav(`/assets/${id}/edit`)} />}
        {!isContractor && asset.status !== 'retired' && asset.status !== 'disposed' && (
          <>
            {showRetireConfirm
              ? <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleRetire} disabled={retiring}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {retiring ? 'Retiring...' : 'Confirm Retire'}
                  </button>
                  <button onClick={() => setShowRetireConfirm(false)}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              : <ActionBtn color="#ef4444" label="Retire Asset" onClick={() => setShowRetireConfirm(true)} />
            }
          </>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ color, label, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
