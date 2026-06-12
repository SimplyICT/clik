import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { q, update, create } from '../api/client';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [quoteAmt, setQuoteAmt] = useState('');
  const [invNum, setInvNum] = useState('');
  const [invAmt, setInvAmt] = useState('');

  useEffect(() => {
    Promise.all([
      q('requests', { filters: [{ field: 'id', value: id }] }),
      q('request_notes', { select: 'id,display_name,description,added_date', filters: [{ field: 'request_id', value: id }], order: 'added_date.asc' }).catch(() => []),
      q('request_invoices', { filters: [{ field: 'request_id', value: id }] }).catch(() => []),
    ]).then(([r, n, i]) => {
      if (Array.isArray(r) && r.length > 0) setJob(r[0]);
      setNotes(Array.isArray(n) ? n : []);
      if (Array.isArray(i) && i.length > 0) setInvoice(i[0]);
    });
  }, [id]);

  const doAction = async (status) => {
    try { await update('requests', id, { status }); setJob({ ...job, status }); } catch (e) { alert('Failed: ' + e.message); }
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
    try {
      await update('requests', id, { quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setJob({ ...job, quoteAmount: parseFloat(quoteAmt), status: 'pending_quote_approval' });
      setQuoteAmt('');
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const submitInvoice = async () => {
    if (!invNum || !invAmt) return;
    try {
      await create('request_invoices', { request_id: id, invoice_number: invNum, amount: parseFloat(invAmt), currency: 'AUD', submit_date: new Date().toISOString(), customer_id: job.customerId });
      await update('requests', id, { invoiceAmount: parseFloat(invAmt), status: 'contractor_completed' });
      setJob({ ...job, invoiceAmount: parseFloat(invAmt), status: 'contractor_completed' });
      setInvNum(''); setInvAmt('');
    } catch (e) { alert('Failed: ' + e.message); }
  };

  if (!job) return <Centered>Loading...</Centered>;

  return (
    <div>
      <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Back</button>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{job.title}</h3>
        <span style={{ background: ST_COLORS[job.status] || '#94a3b8', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{job.status?.replace(/_/g, ' ')}</span>
        <p style={{ fontSize: 13, color: '#555', margin: '10px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.description}</p>
        <div style={{ fontSize: 13, color: '#666', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><small style={{ color: '#888' }}>Service</small><div>{job.serviceType}</div></div>
          <div><small style={{ color: '#888' }}>Priority</small><div>{job.priority}</div></div>
          <div><small style={{ color: '#888' }}>Location</small><div style={{ fontSize: 12 }}>{job.customerName}</div></div>
        </div>
        {job.quoteAmount && <div style={{ marginTop: 10, padding: 10, background: '#f0f9ff', borderRadius: 6, fontSize: 13, color: '#0369a1' }}>Quote: ${Number(job.quoteAmount).toFixed(2)}</div>}
      </div>

      {/* Actions */}
      {job.status === 'awaiting_acceptance' && <button onClick={() => doAction('accepted')} style={btn('#22c55e')}>Accept Job</button>}
      {job.status === 'awaiting_quote' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Submit Quote</h4>
          <input type="number" placeholder="Quote amount" value={quoteAmt} onChange={e => setQuoteAmt(e.target.value)} style={input} />
          <button onClick={submitQuote} style={btn('#00d4ff')}>Submit Quote</button>
        </div>
      )}
      {job.status === 'accepted' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Submit Invoice</h4>
          <input placeholder="Invoice number" value={invNum} onChange={e => setInvNum(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <input type="number" placeholder="Invoice amount" value={invAmt} onChange={e => setInvAmt(e.target.value)} style={input} />
          <button onClick={submitInvoice} style={btn('#00d4ff')}>Submit Invoice</button>
        </div>
      )}
      {job.status === 'rfi' && <button onClick={() => doAction('pending_approval')} style={btn('#3b82f6')}>Mark Info Provided</button>}

      {/* Invoice display */}
      {invoice && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Invoice: {invoice.invoice_number}</div>
          <div style={{ fontSize: 13, color: '#166534' }}>${Number(invoice.amount).toFixed(2)} {invoice.currency}</div>
        </div>
      )}

      {/* Notes */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Notes</h4>
        {notes.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No notes yet</div>}
        {notes.map((n, i) => (
          <div key={n.id || i} style={{ padding: '8px 10px', background: '#f9f9f9', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{n.display_name}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{n.added_date ? new Date(n.added_date).toLocaleString() : ''}</span>
            </div>
            <div style={{ color: '#555' }}>{n.description}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }} />
          <button onClick={addNote} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Add</button>
        </div>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, marginBottom: 8, boxSizing: 'border-box' };
function btn(color) { return { width: '100%', padding: '12px', borderRadius: 6, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }; }
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
