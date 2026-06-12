import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q, create } from '../api/client';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const TYPES = ['Air Conditioning','Cleaning','Electrical','General Maintenance','Painting','Plumbing','Refrigeration'];
const PRIORITIES = ['low','medium','high','urgent'];

export default function ManagerRequestsPage({ createMode }) {
  const [reqs, setReqs] = useState([]);
  const [locs, setLocs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!createMode);
  const [form, setForm] = useState({ title:'', description:'', serviceType: TYPES[0], priority:'medium', customerLocationProfileId:'', contractorProfileId:'' });
  const nav = useNavigate();
  const cid = sessionStorage.getItem('customer_id') || '';
  const cname = sessionStorage.getItem('customer_name') || '';

  useEffect(() => {
    Promise.all([
      q('requests', { select: 'id,title,status,serviceType,priority,customerLocationProfileId,requestStartDate', filters: cid ? [{ field: 'customerId', value: cid }] : [], order: 'requestStartDate.desc.nullslast' }),
      q('customerLocations', { select: 'id,companyName', filters: cid ? [{ field: 'customerId', value: cid }] : [] }),
      q('contractors', { select: 'id,companyName', filters: [] }).catch(() => []),
    ]).then(([r, l, c]) => { setReqs(Array.isArray(r)?r:[]); setLocs(Array.isArray(l)?l:[]); setContractors(Array.isArray(c)?c:[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.customerLocationProfileId) {
      alert('Title, description, and location are required');
      return;
    }
    try {
      await create('requests', {
        title: form.title, description: form.description, serviceType: form.serviceType,
        priority: form.priority, customerId: cid, customerName: cname || 'Customer',
        customerLocationProfileId: form.customerLocationProfileId,
        contractorProfileId: form.contractorProfileId || null,
        status: form.contractorProfileId ? 'awaiting_acceptance' : 'pending_approval',
        requestStartDate: new Date().toISOString(),
      });
      setShowForm(false);
      setForm({ title:'', description:'', serviceType:TYPES[0], priority:'medium', customerLocationProfileId:'', contractorProfileId:'' });
      const r = await q('requests', { select:'id,title,status,serviceType,priority,customerLocationProfileId,requestStartDate', filters: cid ? [{ field:'customerId', value: cid }] : [], order:'requestStartDate.desc.nullslast' });
      setReqs(Array.isArray(r)?r:[]);
      alert('Request submitted successfully');
    } catch (e) { alert('Failed: ' + e.message); }
  };

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <button onClick={() => { setShowForm(!showForm); if (!showForm) nav('/requests/new'); else nav('/requests'); }}
        style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: showForm ? '#ef4444' : '#00d4ff', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
        {showForm ? 'Cancel' : '+ New Request'}
      </button>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>New Service Request</h4>
          <input placeholder="Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={input} />
          <textarea placeholder="Description *" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} style={{...input, resize:'vertical'}} />
          <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})} style={input}>
            {TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={form.customerLocationProfileId} onChange={e => setForm({...form, customerLocationProfileId: e.target.value})} style={input}>
            <option value="">Select site *</option>
            {locs.map(l => <option key={l.id} value={l.id}>{l.companyName}</option>)}
          </select>
          <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} style={input}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
          <select value={form.contractorProfileId} onChange={e => setForm({...form, contractorProfileId: e.target.value})} style={input}>
            <option value="">Assign contractor (optional)</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
          <button onClick={handleCreate} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>Submit Request</button>
        </div>
      )}

      {!showForm && (
        <div>
          {reqs.length === 0 ? <Centered>No requests yet</Centered> : reqs.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                <span style={{ background: ST_COLORS[r.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>{r.status?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{r.serviceType} · {r.priority} {r.requestStartDate ? `· ${new Date(r.requestStartDate).toLocaleDateString()}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const input = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, marginBottom: 8, boxSizing: 'border-box' };
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
