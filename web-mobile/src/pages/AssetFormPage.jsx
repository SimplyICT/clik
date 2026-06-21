import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { canEdit } from '../api/client';
import ImageUpload, { uploadImages } from './ImageUpload';

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

async function apiPatch(path, body) {
  const res = await fetch(`/api/asset-management${path}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const INPUT = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' };
const SELECT = { ...INPUT, background: '#fff' };
const LABEL = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' };

const CATEGORIES = ['Electronics', 'Furniture', 'Vehicle', 'Tool', 'Equipment', 'Network', 'Other'];
const STATUSES = ['active', 'inactive', 'under_repair'];
const CRITICALITY = ['low', 'medium', 'high', 'critical'];

export default function AssetFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => { if (!canEdit('assets')) nav(-1); }, []);
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customFields, setCustomFields] = useState([]);

  const [form, setForm] = useState({
    asset_name: '', asset_code: '', category: 'Electronics', sub_category: '', status: 'active',
    criticality: 'low', manufacturer: '', model: '', serial_number: '', location: '', purchase_date: '',
    warranty_expiry: '', notes: '', customer_id: '',
  });
  const [customValues, setCustomValues] = useState({});
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (isEdit) {
      apiGet(`/assets/${id}`).then(a => {
        setForm({
          asset_name: a.asset_name || '', asset_code: a.asset_code || '', category: a.category || 'Electronics',
          sub_category: a.sub_category || '', status: a.status || 'active', criticality: a.criticality || 'low',
          manufacturer: a.manufacturer || '', model: a.model || '', serial_number: a.serial_number || '',
          location: a.location || '', purchase_date: a.purchase_date?.split('T')[0] || '',
          warranty_expiry: a.warranty_expiry?.split('T')[0] || '', notes: a.notes || '', customer_id: a.customer_id || '',
        });
        if (a.custom_fields) setCustomValues(a.custom_fields);
        setLoading(false);
      }).catch(e => { setError(e.message); setLoading(false); });
    }
  }, [id, isEdit]);

  useEffect(() => {
    apiGet(`/custom-fields?category=${form.category}`).then(d => {
      setCustomFields(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, [form.category]);

  const set = field => e => setForm({ ...form, [field]: e.target.value });
  const setCustom = field => e => setCustomValues({ ...customValues, [field]: e.target.value });

  const handleSubmit = async () => {
    if (!form.asset_name.trim() || !form.asset_code.trim()) { alert('Asset name and code are required'); return; }
    setSaving(true);
    try {
      let photoUrls = undefined;
      if (photos.length > 0) {
        photoUrls = await uploadImages(photos, `assets/${Date.now()}`);
      }
      const body = { ...form, photo_urls: photoUrls, custom_fields: customFields.length > 0 ? customValues : undefined };
      if (isEdit) {
        await apiPatch(`/assets/${id}`, body);
        nav(`/assets/${id}`);
      } else {
        const created = await apiPost('/assets', body);
        nav(`/assets/${created.id || '/assets'}`);
      }
    } catch (e) { alert('Failed to save: ' + e.message); }
    setSaving(false);
  };

  if (loading) return <Centered>Loading...</Centered>;
  if (error) return <Centered>Error: {error}</Centered>;

  return (
    <div>
      <button onClick={() => nav(isEdit ? `/assets/${id}` : '/assets')}
        style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>
        ← {isEdit ? 'Asset' : 'Assets'}
      </button>

      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#1a1a2e' }}>{isEdit ? 'Edit Asset' : 'Create Asset'}</h2>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <label style={LABEL}>Asset Name *</label>
        <input value={form.asset_name} onChange={set('asset_name')} placeholder="e.g. Dell Monitor" style={INPUT} />

        <label style={LABEL}>Asset Code *</label>
        <input value={form.asset_code} onChange={set('asset_code')} placeholder="e.g. MON-001" style={INPUT} />

        <label style={LABEL}>Category</label>
        <select value={form.category} onChange={set('category')} style={SELECT}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={LABEL}>Sub Category</label>
        <input value={form.sub_category} onChange={set('sub_category')} placeholder="e.g. 24-inch" style={INPUT} />

        <label style={LABEL}>Status</label>
        <select value={form.status} onChange={set('status')} style={SELECT}>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>

        <label style={LABEL}>Criticality</label>
        <select value={form.criticality} onChange={set('criticality')} style={SELECT}>
          {CRITICALITY.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={LABEL}>Manufacturer</label>
            <input value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Dell" style={{ ...INPUT, marginBottom: 0 }} />
          </div>
          <div>
            <label style={LABEL}>Model</label>
            <input value={form.model} onChange={set('model')} placeholder="e.g. P2419H" style={{ ...INPUT, marginBottom: 0 }} />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={LABEL}>Serial Number</label>
          <input value={form.serial_number} onChange={set('serial_number')} placeholder="Serial #" style={INPUT} />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Assignment</h4>
        <label style={LABEL}>Customer ID</label>
        <input value={form.customer_id} onChange={set('customer_id')} placeholder="Customer ID" style={INPUT} />
        <label style={LABEL}>Location</label>
        <input value={form.location} onChange={set('location')} placeholder="Location" style={INPUT} />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Photos</h4>
        <ImageUpload onImagesChange={setPhotos} existing={[]} />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Dates</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={LABEL}>Purchase Date</label>
            <input type="date" value={form.purchase_date} onChange={set('purchase_date')} style={{ ...INPUT, marginBottom: 0 }} />
          </div>
          <div>
            <label style={LABEL}>Warranty Expiry</label>
            <input type="date" value={form.warranty_expiry} onChange={set('warranty_expiry')} style={{ ...INPUT, marginBottom: 0 }} />
          </div>
        </div>
      </div>

      {customFields.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Additional Fields</h4>
          {customFields.map((f, i) => (
            <div key={f.field_name || i} style={{ marginBottom: 8 }}>
              <label style={LABEL}>{f.display_name || f.field_name}</label>
              {f.field_type === 'select' || f.field_type === 'dropdown'
                ? <select value={customValues[f.field_name] || ''} onChange={setCustom(f.field_name)} style={SELECT}>
                    <option value="">Select...</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                : <input type={f.field_type === 'number' ? 'number' : 'text'} value={customValues[f.field_name] || ''}
                    onChange={setCustom(f.field_name)} placeholder={f.display_name} style={INPUT} />
              }
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Notes</h4>
        <textarea value={form.notes} onChange={set('notes')} placeholder="Additional notes..." rows={4}
          style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : '#00d4ff', color: saving ? '#888' : '#000', fontWeight: 700, fontSize: 16, cursor: saving ? 'default' : 'pointer', marginBottom: 24 }}>
        {saving ? 'Saving...' : isEdit ? 'Update Asset' : 'Create Asset'}
      </button>
    </div>
  );
}

function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
