import { useState, useEffect } from 'react';
import { authHeaders, create, canEdit } from '../api/client';

const API = '/api/asset-management';
const SERVICE_TYPES = ['Air Conditioning','Cleaning','Electrical','General Maintenance','Painting','Plumbing','Refrigeration'];
const PRIORITIES = ['low','medium','high','urgent'];
const DOC_TYPE_COLORS = { manual: '#6366f1', certificate: '#22c55e', inspection: '#f59e0b', photo: '#3b82f6', other: '#94a3b8' };

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}

export default function AssetDetailView({ asset, onClose, onAssetUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showRequestService, setShowRequestService] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium' });
  const [creating, setCreating] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [jobsError, setJobsError] = useState(null);
  const [docsError, setDocsError] = useState(null);

  useEffect(() => {
    if (asset) {
      setJobsLoading(true);
      setDocsLoading(true);
      setJobsError(null);
      setDocsError(null);
      fetch(`${API}/assets/${asset.id}/jobs`, { headers: { ...authHeaders() } })
        .then(r => { if (!r.ok) throw new Error('Failed to load service history'); return r.json(); })
        .then(data => setJobs(Array.isArray(data) ? data : []))
        .catch(err => { setJobs([]); setJobsError(err.message); })
        .finally(() => setJobsLoading(false));
      fetch(`${API}/assets/${asset.id}/documents`, { headers: { ...authHeaders() } })
        .then(r => { if (!r.ok) throw new Error('Failed to load documents'); return r.json(); })
        .then(data => setDocuments(Array.isArray(data) ? data : []))
        .catch(err => { setDocuments([]); setDocsError(err.message); })
        .finally(() => setDocsLoading(false));
    }
  }, [asset]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      const existingNotes = asset.notes || '';
      const newNote = `[${new Date().toLocaleString()}] ${storage().getItem('customer_name') || 'Customer'}: ${noteText}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
      const res = await fetch(`${API}/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ notes: updatedNotes }),
      });
      if (!res.ok) throw new Error('Failed to add note');
      setNoteText('');
      const updated = await res.json();
      if (onAssetUpdated) onAssetUpdated(updated);
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
    setNoteSaving(false);
  };

  const handleRequestService = async () => {
    const cid = storage().getItem('customer_id');
    if (!cid) { alert('Session expired'); return; }
    if (!form.title.trim() || !form.description.trim()) {
      alert('Title and description are required'); return;
    }
    setCreating(true);
    try {
      await create('requests', {
        title: form.title,
        description: form.description,
        serviceType: form.serviceType,
        priority: form.priority,
        customerId: cid,
        customerName: storage().getItem('customer_name') || 'Customer',
        status: 'pending_approval',
        requestStartDate: new Date().toISOString(),
        asset_id: asset.id,
      });
      setShowRequestService(false);
      setForm({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium' });
    } catch (err) {
      alert('Failed to create request: ' + err.message);
    }
    setCreating(false);
  };

  const FIELD_GROUPS = [
    { label: 'Category', value: asset.category },
    { label: 'Sub Category', value: asset.sub_category },
    { label: 'Status', value: asset.status },
    { label: 'Lifecycle', value: asset.lifecycle_status },
    { label: 'Criticality', value: asset.criticality },
    { label: 'Manufacturer', value: asset.manufacturer },
    { label: 'Model', value: asset.model },
    { label: 'Serial Number', value: asset.serial_number },
    { label: 'Install Date', value: asset.install_date ? new Date(asset.install_date).toLocaleDateString() : '-' },
    { label: 'Purchase Date', value: asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '-' },
    { label: 'Warranty Expiry', value: asset.warranty_expiry_date ? new Date(asset.warranty_expiry_date).toLocaleDateString() : '-' },
    { label: 'Last Service', value: asset.last_service_date ? new Date(asset.last_service_date).toLocaleDateString() : '-' },
    { label: 'Next Service', value: asset.next_service_date ? new Date(asset.next_service_date).toLocaleDateString() : '-' },
  ];

  const photos = Array.isArray(asset.photo_urls) ? asset.photo_urls : [];

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 2 }}>{asset.asset_name || 'Unnamed Asset'}</h3>
          <span style={{ fontSize: 12, color: '#888' }}>{asset.asset_code}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          {FIELD_GROUPS.map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 1 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: '#333' }}>{f.value || '-'}</div>
            </div>
          ))}
        </div>

        {photos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Photos</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((url, i) => (
                <img key={i} src={url} alt={`Asset photo ${i + 1}`} onClick={() => setPhotoIndex(i)}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #e0e0e0', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        )}

        {photoIndex !== null && (
          <div onClick={() => setPhotoIndex(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'pointer' }}>
            <img src={photos[photoIndex]} alt={`Photo ${photoIndex + 1}`} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 4 }} />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Documents</h4>
          {docsLoading ? (
            <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>
          ) : docsError ? (
            <div style={{ color: '#ef4444', fontSize: 13 }}>{docsError}</div>
          ) : documents.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13 }}>No documents</div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} onClick={() => window.open(doc.file_url, '_blank')}
                style={{ padding: '10px 12px', background: '#f9f9f9', borderRadius: 6, marginBottom: 6, border: '1px solid #f0f0f0', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{doc.file_name || 'Untitled'}</span>
                  <span style={{ background: DOC_TYPE_COLORS[doc.file_type] || '#94a3b8', color: '#fff', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                    {doc.file_type || 'other'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                  {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString()}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {asset.custom_fields && Object.keys(asset.custom_fields).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Custom Fields</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.entries(asset.custom_fields).map(([key, val]) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: '#888' }}>{key}</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{String(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {asset.notes && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Notes</h4>
            <div style={{ padding: 12, background: '#f9f9f9', borderRadius: 6, fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{asset.notes}</div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Add Note</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your note..." rows={2}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            {canEdit('assets') && (
              <button onClick={addNote} disabled={!noteText.trim() || noteSaving}
                style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: noteText.trim() && !noteSaving ? 1 : 0.5 }}>
                {noteSaving ? 'Saving...' : 'Add'}
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>Service History</h4>
          {jobsLoading ? (
            <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>
          ) : jobsError ? (
            <div style={{ color: '#ef4444', fontSize: 13 }}>{jobsError}</div>
          ) : jobs.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13 }}>No service history</div>
          ) : (
            jobs.map(j => (
              <div key={j.id} style={{ padding: '10px 12px', background: '#f9f9f9', borderRadius: 6, marginBottom: 6, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{j.title}</span>
                  <span style={{ background: '#94a3b8', color: '#fff', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                    {j.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {j.serviceType} {j.requestStartDate ? `· ${new Date(j.requestStartDate).toLocaleDateString()}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {canEdit('requests') && (
          <button onClick={() => setShowRequestService(true)}
            style={{ padding: '10px 24px', borderRadius: 4, border: 'none', background: '#1a1a2e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            Request Service
          </button>
        )}
      </div>

      {showRequestService && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: 16 }}>Request Service for {asset.asset_name}</h3>
            <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowRequestService(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              {canEdit('requests') && (
                <button onClick={handleRequestService} disabled={creating} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {creating ? 'Creating...' : 'Submit Request'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
