import { useState, useEffect, useCallback } from 'react';
import { q, create, update } from '../api/client';

const STATUS_OPTIONS = [
  { value: 'pending_approval', label: 'Pending Approval', color: '#94a3b8' },
  { value: 'awaiting_acceptance', label: 'Awaiting Acceptance', color: '#38bdf8' },
  { value: 'awaiting_quote', label: 'Awaiting Quote', color: '#f59e0b' },
  { value: 'pending_quote_approval', label: 'Pending Quote Approval', color: '#f59e0b' },
  { value: 'accepted', label: 'Accepted', color: '#22c55e' },
  { value: 'rfi', label: 'More Info Needed', color: '#ef4444' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'contractor_completed', label: 'Contractor Completed', color: '#22c55e' },
  { value: 'completed', label: 'Completed', color: '#22c55e' },
  { value: 'declined', label: 'Declined', color: '#ef4444' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
];
const STATUS_MAP = {}; STATUS_OPTIONS.forEach(s => { STATUS_MAP[s.value] = s; });
const PRIORITIES = ['urgent','high','medium','low'];
const SERVICE_TYPES = ['Air Conditioning','Cleaning','Electrical','General Maintenance','Painting','Plumbing','Refrigeration'];

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium', customerId: '', customerLocationProfileId: '', contractorProfileId: '' });
  const [customerLocations, setCustomerLocations] = useState([]);
  const [editCustomerLocations, setEditCustomerLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [contractors, setContractors] = useState([]);

  const load = useCallback(async () => {
    const [reqs, cust, conts, locs] = await Promise.all([
      q('requests', { select: '*', order: 'requestStartDate.desc.nullslast', limit: 100 }),
      q('customers', { select: 'id,name', order: 'name.asc' }),
      q('contractors', { select: 'id,companyName', order: 'companyName.asc' }).catch(() => []),
      q('customerLocations', { select: 'id,companyName,reference,customerId', limit: 500 }).catch(() => []),
    ]);
    setRequests(reqs || []);
    setCustomers(cust || []);
    setContractors(conts || []);
    setAllLocations(locs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.customerId) {
      q('customerLocations', { select: 'id,companyName,reference', filters: [{ field: 'customerId', value: form.customerId }], limit: 100 }).then(locs => {
        setCustomerLocations(locs || []);
      }).catch(() => setCustomerLocations([]));
    } else {
      setCustomerLocations([]);
    }
  }, [form.customerId]);

  useEffect(() => {
    if (editForm?.customerId) {
      q('customerLocations', { select: 'id,companyName,reference', filters: [{ field: 'customerId', value: editForm.customerId }], limit: 100 }).then(locs => {
        setEditCustomerLocations(locs || []);
      }).catch(() => setEditCustomerLocations([]));
    }
  }, [editForm?.customerId]);

  const filtered = statusFilter ? requests.filter(r => r.status === statusFilter) : requests;

  const handleSaveEdit = async () => {
    if (!editForm) return;
    try {
      const updates = {
        title: editForm.title, description: editForm.description,
        serviceType: editForm.serviceType, priority: editForm.priority,
        status: editForm.status,
      };
      if (editForm.customerLocationProfileId !== undefined) {
        updates.customerLocationProfileId = editForm.customerLocationProfileId || null;
      }
      if (editForm.contractorProfileId !== undefined) {
        updates.contractorProfileId = editForm.contractorProfileId || null;
      }
      await update('requests', editForm.id, updates);
      setDetail({ ...detail, ...editForm });
      setEditForm(null);
      load();
    } catch (err) { alert('Update failed: ' + err.message); }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.customerId) {
      alert('Title, description, and customer are required'); return;
    }
    try {
      await create('requests', {
        title: form.title, description: form.description,
        serviceType: form.serviceType, priority: form.priority,
        customerId: form.customerId,
        customerLocationProfileId: form.customerLocationProfileId || null,
        contractorProfileId: form.contractorProfileId || null,
        status: form.contractorProfileId ? 'awaiting_acceptance' : 'pending_approval',
      });
      setShowCreate(false);
      setForm({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium', customerId: '', customerLocationProfileId: '', contractorProfileId: '' });
      load();
    } catch (err) { alert('Create failed: ' + err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Requests ({requests.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ New Request</button>
          <button onClick={() => { console.log('TEST CLICK'); setDetail({id:'test', title:'Test Request', status:'pending_approval', serviceType:'Test', priority:'high', requestStartDate:null, description:'Test'}); }} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #f00', cursor: 'pointer', fontSize: 12 }}>Test Detail Panel</button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
        <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Title</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Service</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Priority</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Date</th>
          <th style={{ width: 40 }}></th>
        </tr></thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => { console.log('ROW CLICKED', r.id); setDetail(r); setEditForm(null); }}>
              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.title}</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ background: STATUS_MAP[r.status]?.color || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {STATUS_MAP[r.status]?.label || r.status}
                </span>
              </td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{r.serviceType || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666', textTransform: 'capitalize' }}>{r.priority}</td>
              <td style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>{r.requestStartDate ? new Date(r.requestStartDate).toLocaleDateString() : '-'}</td>
              <td style={{ padding: '10px 14px' }}>▶</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detail + Edit panel */}
      {detail && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 8, padding: 24, border: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16 }}>Request Details</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setEditForm(editForm ? null : { ...detail })} style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: editForm ? '#f0f0f0' : '#fff' }}>
                {editForm ? 'Cancel' : 'Edit'}
              </button>
              <button onClick={() => { setDetail(null); setEditForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
            </div>
          </div>

          {editForm ? (
            <div>
              <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Title</label>
                <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={{ fontSize: 11, color: '#888' }}>Service</label>
                  <select value={editForm.serviceType} onChange={e => setEditForm({...editForm, serviceType: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 11, color: '#888' }}>Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Site/Location</label>
                <select value={editForm.customerLocationProfileId || ''} onChange={e => setEditForm({...editForm, customerLocationProfileId: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Not set</option>
                  {editCustomerLocations.map(l => <option key={l.id} value={l.id}>{l.companyName}{l.reference ? ` (${l.reference})` : ''}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Contractor</label>
                <select value={editForm.contractorProfileId || ''} onChange={e => setEditForm({...editForm, contractorProfileId: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Not assigned</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <button onClick={handleSaveEdit} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Save Changes
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              <div><small style={{ color: '#888' }}>Status</small>
                <span style={{ display: 'inline-block', marginTop: 4, background: STATUS_MAP[detail.status]?.color || '#94a3b8', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                  {STATUS_MAP[detail.status]?.label || detail.status}
                </span>
              </div>
              <div><small style={{ color: '#888' }}>Title</small><div style={{ fontSize: 14, marginTop: 2 }}>{detail.title}</div></div>
              <div><small style={{ color: '#888' }}>Description</small><div style={{ fontSize: 14, marginTop: 2 }}>{detail.description || '-'}</div></div>
              <div><small style={{ color: '#888' }}>Service</small><div style={{ fontSize: 14, marginTop: 2 }}>{detail.serviceType || '-'}</div></div>
              <div><small style={{ color: '#888' }}>Priority</small><div style={{ fontSize: 14, marginTop: 2, textTransform: 'capitalize' }}>{detail.priority}</div></div>
              <div><small style={{ color: '#888' }}>Site</small><div style={{ fontSize: 14, marginTop: 2 }}>{
                (() => {
                  const loc = allLocations.find(l => l.id === detail.customerLocationProfileId);
                  return loc ? loc.companyName : (detail.customerLocationProfileId || '-');
                })()
              }</div></div>
              <div><small style={{ color: '#888' }}>Contractor</small><div style={{ fontSize: 14, marginTop: 2 }}>{
                (() => {
                  const c = contractors.find(c2 => c2.id === detail.contractorProfileId);
                  return c ? c.companyName : (detail.contractorProfileId || 'Not assigned');
                })()
              }</div></div>
              <div><small style={{ color: '#888' }}>Created</small><div style={{ fontSize: 14, marginTop: 2 }}>{detail.requestStartDate ? new Date(detail.requestStartDate).toLocaleDateString() : '-'}</div></div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 520 }}>
            <h3 style={{ marginBottom: 16 }}>New Request</h3>
            <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
              <select value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value, customerLocationProfileId: ''})}
                style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <select value={form.customerLocationProfileId} onChange={e => setForm({...form, customerLocationProfileId: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
              <option value="">Select site/location...</option>
              {customerLocations.map(l => <option key={l.id} value={l.id}>{l.companyName}{l.reference ? ` (${l.reference})` : ''}</option>)}
            </select>
            <select value={form.contractorProfileId} onChange={e => setForm({...form, contractorProfileId: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
              <option value="">Assign contractor (optional — auto-match if site selected)</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
              {form.contractorProfileId
                ? 'Status will be set to Awaiting Acceptance — contractor notified immediately.'
                : form.customerLocationProfileId
                  ? 'A contractor linked to this site will be auto-assigned and notified.'
                  : 'No site selected — request will be created as Pending Approval (unassigned).'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
