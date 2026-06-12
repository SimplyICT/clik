import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { q, update, create } from '../api/client';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const ST_LABELS = { pending_approval:'Pending', awaiting_acceptance:'Awaiting Acceptance', awaiting_quote:'Awaiting Quote', pending_quote_approval:'Quote Approval', accepted:'Accepted', rfi:'More Info', in_progress:'In Progress', contractor_completed:'Done', completed:'Completed', declined:'Declined', cancelled:'Cancelled' };

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [quoteAmt, setQuoteAmt] = useState('');
  const [invNum, setInvNum] = useState('');
  const [invAmt, setInvAmt] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    Promise.all([
      q('requests', { select: '*', filters: [{ field: 'id', value: id }] }),
      q('request_notes', { select: 'id,display_name,description,added_date', filters: [{ field: 'request_id', value: id }], order: 'added_date.asc' }).catch(() => []),
      q('request_invoices', { select: '*', filters: [{ field: 'request_id', value: id }] }).catch(() => []),
    ]).then(([r, n, i]) => {
      if (Array.isArray(r) && r.length > 0) setJob(r[0]);
      setNotes(Array.isArray(n) ? n : []);
      if (Array.isArray(i) && i.length > 0) setInvoice(i[0]);
      setLoading(false);
    });
  }, [id]);

  const doAction = async (status) => {
    setActionLoading(status);
    try {
      await update('requests', id, { status });
      setJob({ ...job, status });
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await create('request_notes', { request_id: id, author_profile_id: sessionStorage.getItem('author_profile_id'), display_name: 'Contractor', description: noteText, note_type: 'comment', visibility: 'public', added_date: new Date().toISOString() });
      setNoteText('');
      const n = await q('request_notes', { select: 'id,display_name,description,added_date', filters: [{ field: 'request_id', value: id }], order: 'added_date.asc' });
      setNotes(Array.isArray(n) ? n : []);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const submitQuote = async () => {
    if (!quoteAmt) return;
    setActionLoading('quote');
    try {
      await update('requests', id, { quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setJob({ ...job, quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setQuoteAmt('');
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  const submitInvoice = async () => {
    if (!invNum || !invAmt) return;
    setActionLoading('invoice');
    try {
      await create('request_invoices', { request_id: id, invoice_number: invNum, amount: parseFloat(invAmt), currency: 'AUD', submit_date: new Date().toISOString(), customer_id: job.customerId });
      await update('requests', id, { invoiceAmount: parseFloat(invAmt), status: 'contractor_completed' });
      setJob({ ...job, invoiceAmount: parseFloat(invAmt), status: 'contractor_completed' });
      setInvNum(''); setInvAmt('');
    } catch (e) { alert('Failed: ' + e.message); }
    setActionLoading('');
  };

  if (loading) return <Centered>Loading...</Centered>;
  if (!job) return <Centered>Job not found</Centered>;

  return (
    <div>
      <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12, fontWeight: 600 }}>← Back to Jobs</button>

      {/* Status header */}
      <div style={{ background: ST_COLORS[job.status] || '#94a3b8', borderRadius: 10, padding: '14px 16px', marginBottom: 12, color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{job.title}</div>
        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>{ST_LABELS[job.status] || job.status}</div>
      </div>

      {/* Details card */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.description}</p>
        <div style={{ fontSize: 13, color: '#666', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><small style={{ color: '#888' }}>Customer</small><div>{job.customerName || '-'}</div></div>
          <div><small style={{ color: '#888' }}>Service</small><div>{job.serviceType}</div></div>
          <div><small style={{ color: '#888' }}>Priority</small><div style={{ textTransform: 'capitalize' }}>{job.priority}</div></div>
          <div><small style={{ color: '#888' }}>Created</small><div>{job.requestStartDate ? new Date(job.requestStartDate).toLocaleDateString() : '-'}</div></div>
        </div>
        {job.quoteAmount && (
          <div style={{ marginTop: 10, padding: 10, background: '#f0f9ff', borderRadius: 6, fontSize: 13, color: '#0369a1' }}>
            <strong>Quote:</strong> ${Number(job.quoteAmount).toFixed(2)}
          </div>
        )}
      </div>

      {/* Actions - based on status */}
      {job.status === 'awaiting_acceptance' && (
        <ActionBtn color="#22c55e" label={actionLoading === 'accepted' ? 'Processing...' : 'Accept Job'} onClick={() => doAction('accepted')} />
      )}

      {job.status === 'awaiting_quote' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Submit Quote</h4>
          <input type="number" step="0.01" placeholder="Quote amount ($)" value={quoteAmt} onChange={e => setQuoteAmt(e.target.value)} style={input} />
          <ActionBtn color="#00d4ff" label={actionLoading === 'quote' ? 'Sending...' : 'Submit Quote'} onClick={submitQuote} disabled={!quoteAmt} />
        </div>
      )}

      {job.status === 'accepted' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Submit Invoice</h4>
          <input placeholder="Invoice number" value={invNum} onChange={e => setInvNum(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <input type="number" step="0.01" placeholder="Invoice amount ($)" value={invAmt} onChange={e => setInvAmt(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <ActionBtn color="#00d4ff" label={actionLoading === 'invoice' ? 'Sending...' : 'Submit Invoice'} onClick={submitInvoice} disabled={!invNum || !invAmt} />
        </div>
      )}

      {job.status === 'rfi' && <ActionBtn color="#3b82f6" label={actionLoading === 'pending_approval' ? 'Processing...' : 'Mark Info Provided'} onClick={() => doAction('pending_approval')} />}
      {job.status === 'in_progress' && <ActionBtn color="#22c55e" label={actionLoading === 'contractor_completed' ? 'Processing...' : 'Mark Completed'} onClick={() => doAction('contractor_completed')} />}

      {/* Invoice display */}
      {invoice && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Invoice: {invoice.invoice_number}</div>
          <div style={{ fontSize: 13, color: '#166534' }}>${Number(invoice.amount).toFixed(2)} {invoice.currency}</div>
          {invoice.purchase_order && <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>PO: {invoice.purchase_order}</div>}
        </div>
      )}

      {/* Notes */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Timeline & Notes</h4>
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
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }} />
          <button onClick={addNote} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: noteText.trim() ? 1 : 0.5 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, marginBottom: 8, boxSizing: 'border-box' };
function ActionBtn({ color, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: disabled ? '#ccc' : color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: disabled ? 'default' : 'pointer', marginBottom: 12 }}>
      {label}
    </button>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
