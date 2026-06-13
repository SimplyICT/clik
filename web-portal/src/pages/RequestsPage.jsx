import { useState, useEffect } from 'react';
import { q, create, update, customerFilter } from '../api/client';

const TABS = [
  { key: 'pending', label: 'Pending', statuses: ['pending_approval','rfi','awaiting_quote','pending_quote_approval'] },
  { key: 'open', label: 'Open', statuses: ['awaiting_acceptance','accepted','in_progress','contractor_completed'] },
  { key: 'closed', label: 'Closed', statuses: ['completed','declined','cancelled'] },
];

const ST_COLORS = {
  pending_approval: '#94a3b8', awaiting_acceptance: '#38bdf8',
  awaiting_quote: '#f59e0b', pending_quote_approval: '#f59e0b',
  accepted: '#22c55e', rfi: '#ef4444', in_progress: '#3b82f6',
  contractor_completed: '#22c55e', completed: '#22c55e',
  declined: '#ef4444', cancelled: '#ef4444',
};

const ST_LABELS = {
  pending_approval: 'Pending Approval', awaiting_acceptance: 'Awaiting Acceptance',
  awaiting_quote: 'Awaiting Quote', pending_quote_approval: 'Pending Quote Approval',
  accepted: 'Accepted', rfi: 'More Info Needed', in_progress: 'In Progress',
  contractor_completed: 'Contractor Completed', completed: 'Completed',
  declined: 'Declined', cancelled: 'Cancelled',
};

const SERVICE_TYPES = ['Air Conditioning','Cleaning','Electrical','General Maintenance','Painting','Plumbing','Refrigeration'];
const PRIORITIES = ['low','medium','high','urgent'];
const CNAME = () => sessionStorage.getItem('customer_name') || '';

export default function RequestsPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium', customerLocationProfileId: '' });
  const [creating, setCreating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = async () => {
    const cf = customerFilter();
    const [reqs, locs] = await Promise.all([
      q('requests', { select: 'id,title,status,serviceType,priority,customerId,customerName,customerLocationProfileId,contractorProfileId,requestStartDate,requestEndDate,description,quoteAmount,invoiceAmount,purchaseOrder,newNotesCustomer', filters: cf, order: 'requestStartDate.desc.nullslast' }),
      q('customerLocations', { select: 'id,companyName', filters: cf }),
    ]);
    setAll(Array.isArray(reqs) ? reqs : []);
    setLocations(Array.isArray(locs) ? locs : []);
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, []);

  const openDetail = async (r) => {
    setDetail(r);
    setNotes([]);
    setInvoice(null);
    if (r.newNotesCustomer) {
      update('requests', r.id, { newNotesCustomer: false }).catch(() => {});
    }
    const [notesData, invoiceData] = await Promise.all([
      q('request_notes', { select: 'id,display_name,description,note_type,visibility,added_date', filters: [{ field: 'request_id', value: r.id }], order: 'added_date.asc' }).catch(() => []),
      q('request_invoices', { select: '*', filters: [{ field: 'request_id', value: r.id }] }).catch(() => null),
    ]);
    setNotes(Array.isArray(notesData) ? notesData : []);
    if (invoiceData && Array.isArray(invoiceData) && invoiceData.length > 0) {
      setInvoice(invoiceData[0]);
    }
  };

  const doAction = async (newStatus) => {
    if (!detail || actionLoading) return;
    setActionLoading(true);
    try {
      await update('requests', detail.id, { status: newStatus });
      await loadRequests();
      const updated = all.find(r => r.id === detail.id);
      if (updated) openDetail({ ...updated, status: newStatus });
      else setDetail(null);
    } catch (err) { alert('Action failed: ' + err.message); }
    setActionLoading(false);
  };

  const addNote = async () => {
    if (!noteText.trim() || !detail) return;
    try {
      await create('request_notes', {
        request_id: detail.id,
        author_profile_id: sessionStorage.getItem('author_profile_id') || null,
        display_name: CNAME() || 'Customer',
        description: noteText,
        note_type: 'comment',
        visibility: 'public',
        added_date: new Date().toISOString(),
      });
      setNoteText('');
      const notesData = await q('request_notes', { select: 'id,display_name,description,note_type,visibility,added_date', filters: [{ field: 'request_id', value: detail.id }], order: 'added_date.asc' });
      setNotes(Array.isArray(notesData) ? notesData : []);
    } catch (err) { alert('Failed to add note: ' + err.message); }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.customerLocationProfileId) {
      alert('Title, description, and location are required'); return;
    }
    const cid = sessionStorage.getItem('customer_id');
    if (!cid) { alert('Session expired - please log out and back in'); return; }
    setCreating(true);
    try {
      await create('requests', {
        title: form.title, description: form.description,
        serviceType: form.serviceType, priority: form.priority,
        customerId: cid,
        customerName: CNAME() || 'Customer',
        customerLocationProfileId: form.customerLocationProfileId,
        status: 'pending_approval', requestStartDate: new Date().toISOString(),
      });
      setShowCreate(false);
      setForm({ title: '', description: '', serviceType: SERVICE_TYPES[0], priority: 'medium', customerLocationProfileId: '' });
      await loadRequests();
    } catch (err) { alert('Create failed: ' + err.message); }
    setCreating(false);
  };

  const locName = (id) => locations.find(l => l.id === id)?.companyName || id?.slice(0, 8) || '-';

  const t = TABS.find(x => x.key === tab);
  const filtered = all.filter(r => t?.statuses.includes(r.status));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Requests ({all.length})</h2>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ New Request</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TABS.map(t2 => (
          <button key={t2.key} onClick={() => { setTab(t2.key); setDetail(null); }}
            style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: tab === t2.key ? '#1a1a2e' : '#e0e0e0', color: tab === t2.key ? '#fff' : '#333', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {t2.label} ({all.filter(r => t2.statuses.includes(r.status)).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No requests in this category</div>
      ) : (
        filtered.map(r => (
          <div key={r.id} onClick={() => openDetail(r)}
            style={{ padding: '14px 16px', background: detail?.id === r.id ? '#f0f7ff' : '#fff', borderRadius: 6, marginBottom: 4, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <span style={{ background: ST_COLORS[r.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                {ST_LABELS[r.status] || r.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
              {r.serviceType} {r.priority ? `· ${r.priority}` : ''} {r.requestStartDate ? `· ${new Date(r.requestStartDate).toLocaleDateString()}` : ''}
              {r.newNotesCustomer ? <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 600 }}>· New note</span> : null}
            </div>
          </div>
        ))
      )}

      {detail && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 2 }}>{detail.title}</h3>
              <span style={{ background: ST_COLORS[detail.status] || '#94a3b8', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
                {ST_LABELS[detail.status] || detail.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 20, fontSize: 13, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{detail.description || 'No description'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              <Field label="Service" value={detail.serviceType} />
              <Field label="Priority" value={detail.priority ? detail.priority.charAt(0).toUpperCase() + detail.priority.slice(1) : '-'} />
              <Field label="Location" value={locName(detail.customerLocationProfileId)} />
              <Field label="Created" value={detail.requestStartDate ? new Date(detail.requestStartDate).toLocaleDateString() : '-'} />
              <Field label="Completed" value={detail.requestEndDate ? new Date(detail.requestEndDate).toLocaleDateString() : '-'} />
              <Field label="Purchase Order" value={detail.purchaseOrder || '-'} />
            </div>

            {detail.quoteAmount && (
              <div style={{ marginBottom: 20, padding: 16, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>Quote: ${Number(detail.quoteAmount).toFixed(2)}</div>
                {detail.invoiceAmount && (
                  <div style={{ fontSize: 13, color: '#0369a1' }}>Invoiced: ${Number(detail.invoiceAmount).toFixed(2)}</div>
                )}
              </div>
            )}

            {invoice && (
              <div style={{ marginBottom: 20, padding: 16, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Invoice: {invoice.invoice_number}</div>
                <div style={{ fontSize: 13, color: '#166534' }}>Amount: ${Number(invoice.amount).toFixed(2)} {invoice.currency}</div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>PO: {invoice.purchase_order || '-'} · Submitted: {invoice.submit_date ? new Date(invoice.submit_date).toLocaleDateString() : '-'}</div>
              </div>
            )}

            {detail.status === 'pending_quote_approval' && (
              <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
                <button onClick={() => doAction('awaiting_acceptance')} disabled={actionLoading}
                  style={{ padding: '10px 24px', borderRadius: 4, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {actionLoading ? 'Processing...' : 'Approve Quote'}
                </button>
                <button onClick={() => doAction('declined')} disabled={actionLoading}
                  style={{ padding: '10px 24px', borderRadius: 4, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Decline
                </button>
              </div>
            )}
            {detail.status === 'awaiting_acceptance' && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => doAction('accepted')} disabled={actionLoading}
                  style={{ padding: '10px 24px', borderRadius: 4, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {actionLoading ? 'Processing...' : 'Accept'}
                </button>
              </div>
            )}
            {detail.status === 'rfi' && (
              <div style={{ marginBottom: 20, padding: 16, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>Additional information needed</div>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Type your response..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 8 }} />
                <button onClick={async () => {
                  if (!noteText.trim()) return;
                  await addNote();
                  await doAction('pending_approval');
                }} style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Submit Response
                </button>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 20 }}>
              <h4 style={{ fontSize: 14, marginBottom: 12, color: '#444' }}>Timeline & Notes</h4>

              {notes.length === 0 && <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>No notes yet</div>}
              {notes.map((n, i) => (
                <div key={n.id || i} style={{ padding: '10px 14px', background: '#f9f9f9', borderRadius: 6, marginBottom: 8, border: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>{n.display_name || 'System'}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{n.added_date ? new Date(n.added_date).toLocaleString() : ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{n.description}</div>
                </div>
              ))}

              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..."
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }} />
                <button onClick={addNote} disabled={!noteText.trim()}
                  style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: noteText.trim() ? 1 : 0.5 }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 480 }}>
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
              <select value={form.customerLocationProfileId} onChange={e => setForm({...form, customerLocationProfileId: e.target.value})}
                style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="">Select location...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.companyName}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#333' }}>{value}</div>
    </div>
  );
}
