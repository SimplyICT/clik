import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { q, update, create } from '../api/client';
import ImageUpload, { uploadImages } from './ImageUpload';

const ST = {
  pending_approval: { label: 'Pending Approval', color: '#94a3b8', next: [] },
  awaiting_quote: { label: 'Awaiting Quote', color: '#f59e0b', next: [] },
  pending_quote_approval: { label: 'Quote to Approve', color: '#f59e0b', next: [] },
  awaiting_acceptance: { label: 'Awaiting Acceptance', color: '#38bdf8', next: [] },
  accepted: { label: 'Accepted', color: '#22c55e', next: [] },
  rfi: { label: 'More Info Needed', color: '#ef4444', next: [] },
  in_progress: { label: 'In Progress', color: '#3b82f6', next: [] },
  contractor_completed: { label: 'Done — Awaiting Confirmation', color: '#22c55e', next: [] },
  completed: { label: 'Completed', color: '#22c55e', next: [] },
  declined: { label: 'Declined', color: '#ef4444', next: [] },
  cancelled: { label: 'Cancelled', color: '#ef4444', next: [] },
};

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [quoteAmt, setQuoteAmt] = useState('');
  const [invNum, setInvNum] = useState('');
  const [invAmt, setInvAmt] = useState('');
  const [invPO, setInvPO] = useState('');
  const [quoteImages, setQuoteImages] = useState([]);
  const [completeImages, setCompleteImages] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const role = localStorage.getItem('role') || sessionStorage.getItem('role');
  const isContractor = role === 'contractor';

  useEffect(() => {
    Promise.all([
      q('requests', { select: '*', filters: [{ field: 'id', value: id }] }),
      q('request_notes', { select: 'id,display_name,description,added_date', filters: [{ field: 'request_id', value: id }], order: 'added_date.asc' }).catch(() => []),
      q('request_invoices', { select: '*', filters: [{ field: 'request_id', value: id }] }).catch(() => []),
      q('customerLocations', { filters: [] }).catch(() => []),
    ]).then(([r, n, i, l]) => {
      if (Array.isArray(r) && r.length > 0) setJob(r[0]);
      setNotes(Array.isArray(n) ? n : []);
      if (Array.isArray(i) && i.length > 0) setInvoice(i[0]);
      setLocs(Array.isArray(l) ? l : []);
      setLoading(false);
    });
  }, [id]);

  const doAction = async (status, extra = {}) => {
    setActionLoading(status);
    try {
      await update('requests', id, { ...extra, status });
      setJob({ ...job, ...extra, status });
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await create('request_notes', {
        request_id: id, author_profile_id: localStorage.getItem('author_profile_id') || sessionStorage.getItem('author_profile_id'),
        display_name: isContractor ? 'Contractor' : 'Customer',
        description: noteText, note_type: 'comment', visibility: 'public', added_date: new Date().toISOString(),
      });
      setNoteText('');
      const n = await q('request_notes', { select: 'id,display_name,description,added_date', filters: [{ field: 'request_id', value: id }], order: 'added_date.asc' });
      setNotes(Array.isArray(n) ? n : []);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const handleQuoteSubmit = async () => {
    if (!quoteAmt) return;
    setActionLoading('quote');
    try {
      const paths = await uploadImages(quoteImages, `requests/${id}/contractor`);
      await update('requests', id, { quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setJob({ ...job, quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setQuoteAmt('');
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  const handleCompleteSubmit = async () => {
    if (!invNum || !invAmt) return;
    setActionLoading('complete');
    try {
      await uploadImages(completeImages, `requests/${id}/contractor`);
      const now = new Date(); const later = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await create('request_invoices', {
        request_id: id, invoice_number: invNum, amount: parseFloat(invAmt), purchase_order: invPO || null,
        currency: 'AUD', submit_date: now.toISOString(), auto_approve_date: later.toISOString(), customer_id: job.customerId,
      });
      await update('requests', id, { invoiceAmount: parseFloat(invAmt), status: 'contractor_completed', requestEndDate: now.toISOString() });
      setJob({ ...job, invoiceAmount: parseFloat(invAmt), status: 'contractor_completed' });
      setInvNum(''); setInvAmt(''); setInvPO('');
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  if (loading) return <Centered>Loading...</Centered>;
  if (!job) return <Centered>Job not found</Centered>;

  const s = ST[job.status] || { label: job.status, color: '#94a3b8' };
  const loc = locs.find(l => l.id === job.customerLocationProfileId);

  return (
    <div>
      <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>← Back</button>

      {/* Status header */}
      <div style={{ background: s.color, borderRadius: 10, padding: '14px 16px', marginBottom: 12, color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{job.title}</div>
        <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>{s.label}</div>
      </div>

      {/* Contact card */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{job.customerName || 'Customer'}</div>
        {loc && (
          <div style={{ fontSize: 12, color: '#666' }}>
            {loc.addressJson?.city ? `${loc.addressJson.city}, ${loc.addressJson.state || ''}` : loc.companyName}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {loc?.contactPhoneNumber && (
            <a href={`tel:${loc.contactPhoneNumber}`} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 6, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              📞 Call
            </a>
          )}
          {loc && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(loc.companyName + ' ' + (loc.addressJson?.city || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 6, background: '#e3f2fd', color: '#1565c0', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              🗺️ Map
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{job.description || 'No description'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontSize: 13, color: '#666' }}>
          <div><small style={{ color: '#888' }}>Service</small><div>{job.serviceType}</div></div>
          <div><small style={{ color: '#888' }}>Priority</small><div style={{ textTransform: 'capitalize' }}>{job.priority}</div></div>
          <div><small style={{ color: '#888' }}>Location</small><div>{loc?.companyName || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Created</small><div>{job.requestStartDate ? new Date(job.requestStartDate).toLocaleDateString() : '-'}</div></div>
        </div>
      </div>

      {/* Quote amount display */}
      {job.quoteAmount && (
        <div style={{ background: '#f0f9ff', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>Quote: ${Number(job.quoteAmount).toFixed(2)}</div>
        </div>
      )}

      {/* Invoice display */}
      {invoice && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Invoice: {invoice.invoice_number}</div>
          <div style={{ fontSize: 13, color: '#166534' }}>${Number(invoice.amount).toFixed(2)} {invoice.currency}</div>
          {invoice.purchase_order && <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>PO: {invoice.purchase_order}</div>}
          <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>Submitted: {invoice.submit_date ? new Date(invoice.submit_date).toLocaleDateString() : '-'}</div>
        </div>
      )}

      {/* ── Status-specific actions ── */}

      {/* CONTRACTOR: Accept job */}
      {isContractor && job.status === 'awaiting_acceptance' && (
        <ActionBtn color="#22c55e" label={actionLoading === 'accepted' ? 'Processing...' : '✅ Accept Job'} onClick={() => doAction('accepted')} />
      )}

      {/* CONTRACTOR: Submit quote with images */}
      {isContractor && job.status === 'awaiting_quote' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Submit Quote</h4>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: 11, fontSize: 14, color: '#888' }}>$</span>
              <input type="number" step="0.01" placeholder="0.00" value={quoteAmt} onChange={e => setQuoteAmt(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, boxSizing: 'border-box' }} />
            </div>
          </div>
          <ImageUpload onImagesChange={setQuoteImages} />
          <ActionBtn color="#00d4ff" label={actionLoading === 'quote' ? 'Submitting...' : 'Submit Quote'} onClick={handleQuoteSubmit} disabled={!quoteAmt} />
        </div>
      )}

      {/* CONTRACTOR: Submit invoice with images on completion */}
      {isContractor && job.status === 'accepted' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Job Complete — Submit Invoice</h4>
          <input placeholder="Invoice number *" value={invNum} onChange={e => setInvNum(e.target.value)} style={input} />
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{ position: 'absolute', left: 12, top: 11, fontSize: 14, color: '#888' }}>$</span>
            <input type="number" step="0.01" placeholder="0.00" value={invAmt} onChange={e => setInvAmt(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, boxSizing: 'border-box' }} />
          </div>
          <input placeholder="Purchase order (optional)" value={invPO} onChange={e => setInvPO(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <ImageUpload onImagesChange={setCompleteImages} />
          <ActionBtn color="#22c55e" label={actionLoading === 'complete' ? 'Submitting...' : 'Submit Invoice & Complete'} onClick={handleCompleteSubmit} disabled={!invNum || !invAmt} />
        </div>
      )}

      {/* CONTRACTOR / CUSTOMER: RFI response */}
      {!isContractor && job.status === 'rfi' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px', color: '#ef4444' }}>Additional Information Needed</h4>
          <ActionBtn color="#3b82f6" label={actionLoading === 'pending_approval' ? 'Processing...' : 'Mark as Provided'} onClick={() => doAction('pending_approval')} />
        </div>
      )}

      {/* CUSTOMER: Approve/decline quote */}
      {!isContractor && job.status === 'pending_quote_approval' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => doAction('awaiting_acceptance')} disabled={!!actionLoading} style={{ flex: 1, padding: '14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {actionLoading ? '...' : '✅ Approve Quote'}
          </button>
          <button onClick={() => doAction('declined')} disabled={!!actionLoading} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      )}

      {/* CUSTOMER: Accept */}
      {!isContractor && job.status === 'awaiting_acceptance' && (
        <ActionBtn color="#22c55e" label={actionLoading === 'accepted' ? 'Processing...' : '✅ Accept'} onClick={() => doAction('accepted')} />
      )}

      {/* CUSTOMER: Confirm completion */}
      {!isContractor && job.status === 'contractor_completed' && (
        <ActionBtn color="#22c55e" label={actionLoading === 'completed' ? 'Processing...' : '✅ Confirm Completed'} onClick={() => doAction('completed', { requestEndDate: new Date().toISOString() })} />
      )}

      {/* CONTRACTOR: Mark complete (if no invoice flow) */}
      {isContractor && job.status === 'in_progress' && (
        <ActionBtn color="#22c55e" label={actionLoading === 'contractor_completed' ? 'Processing...' : '✅ Mark Completed'} onClick={() => doAction('contractor_completed', { requestEndDate: new Date().toISOString() })} />
      )}

      {/* Completed view — final summary */}
      {job.status === 'completed' && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 8 }}>✅ Job Complete</div>
          {job.requestEndDate && <div style={{ fontSize: 13, color: '#166534' }}>Completed: {new Date(job.requestEndDate).toLocaleDateString()}</div>}
          {invoice && <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>Invoice: {invoice.invoice_number} — ${Number(invoice.amount).toFixed(2)}</div>}
        </div>
      )}

      {/* Timeline & Notes */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Timeline & Notes</h4>
        {notes.length === 0 && <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>No notes yet</div>}
        {notes.map((n, i) => (
          <div key={n.id || i} style={{ padding: '8px 10px', background: '#f9f9f9', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{n.display_name || 'System'}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{n.added_date ? new Date(n.added_date).toLocaleString() : ''}</span>
            </div>
            <div style={{ color: '#555' }}>{n.description}</div>
          </div>
        ))}
        {!['completed', 'declined', 'cancelled'].includes(job.status) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }} />
            <button onClick={addNote} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: noteText.trim() ? 1 : 0.5 }}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, marginBottom: 8, boxSizing: 'border-box' };
function ActionBtn({ color, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: disabled ? '#ccc' : color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: disabled ? 'default' : 'pointer', marginBottom: 12 }}>
      {label}
    </button>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
