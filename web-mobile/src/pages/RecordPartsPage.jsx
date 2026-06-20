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

export default function RecordPartsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/parts').then(d => {
      setParts(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectedPartData = parts.find(p => String(p.id || p.part_id) === selectedPart);

  const handleSubmit = async () => {
    if (!selectedPart) { alert('Select a part'); return; }
    if (!quantity || quantity < 1) { alert('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      await apiPost('/parts/record-usage', { asset_id: id, part_id: selectedPart, quantity: parseInt(quantity) });
      nav(`/assets/${id}`);
    } catch (e) { alert('Failed to record part usage: ' + e.message); }
    setSaving(false);
  };

  if (loading) return <Centered>Loading parts...</Centered>;

  return (
    <div>
      <button onClick={() => nav(`/assets/${id}`)}
        style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>
        ← Asset
      </button>

      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#1a1a2e' }}>Record Part Usage</h2>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        {parts.length === 0 ? (
          <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No parts available in inventory.
          </div>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' }}>Select Part *</label>
            <select value={selectedPart} onChange={e => setSelectedPart(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 12, background: '#fff', boxSizing: 'border-box' }}>
              <option value="">Select a part...</option>
              {parts.map(p => (
                <option key={p.id || p.part_id} value={p.id || p.part_id}>
                  {p.name || p.part_name}{p.part_number ? ` (${p.part_number})` : ''}{p.stock_quantity !== undefined ? ` — Stock: ${p.stock_quantity}` : ''}
                </option>
              ))}
            </select>

            {selectedPartData && (
              <div style={{ background: '#f9f9f9', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 13, color: '#555' }}>
                <div><small style={{ color: '#888' }}>Part #</small> {selectedPartData.part_number || '-'}</div>
                <div><small style={{ color: '#888' }}>Stock</small> {selectedPartData.stock_quantity ?? '-'}</div>
                {selectedPartData.unit_price && <div><small style={{ color: '#888' }}>Price</small> ${Number(selectedPartData.unit_price).toFixed(2)}</div>}
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' }}>Quantity *</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
          </>
        )}
      </div>

      {parts.length > 0 && (
        <button onClick={handleSubmit} disabled={saving || !selectedPart || !quantity}
          style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: saving || !selectedPart || !quantity ? '#ccc' : '#00d4ff', color: saving || !selectedPart || !quantity ? '#888' : '#000', fontWeight: 700, fontSize: 16, cursor: saving || !selectedPart || !quantity ? 'default' : 'pointer', marginBottom: 24 }}>
          {saving ? 'Recording...' : 'Record Usage'}
        </button>
      )}
    </div>
  );
}

function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
