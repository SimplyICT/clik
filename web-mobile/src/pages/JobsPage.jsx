import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const ST_LABELS = { pending_approval:'Pending', awaiting_acceptance:'Awaiting Acceptance', awaiting_quote:'Awaiting Quote', pending_quote_approval:'Quote Approval', accepted:'Accepted', rfi:'More Info', in_progress:'In Progress', contractor_completed:'Done', completed:'Completed', declined:'Declined', cancelled:'Cancelled' };
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', statuses: ['pending_approval','awaiting_acceptance','awaiting_quote','pending_quote_approval','accepted','rfi','in_progress'] },
  { key: 'done', label: 'Done', statuses: ['contractor_completed','completed'] },
  { key: 'closed', label: 'Closed', statuses: ['declined','cancelled'] },
];
const POLL_MS = 30000;

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [newJobs, setNewJobs] = useState(0);
  const prevCount = useRef(0);
  const nav = useNavigate();

  const fetch = useCallback(() => {
    const pid = sessionStorage.getItem('author_profile_id');
    if (!pid) { setLoading(false); return; }
    q('requests', { select: 'id,title,status,serviceType,priority,customerName,quoteAmount,invoiceAmount,requestStartDate,description', filters: [{ field: 'contractorProfileId', value: pid }], order: 'requestStartDate.desc.nullslast' }).then(d => {
      const arr = Array.isArray(d) ? d : [];
      const needsAction = arr.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status)).length;
      if (prevCount.current > 0 && needsAction > prevCount.current) {
        setNewJobs(n => n + (needsAction - prevCount.current));
      }
      prevCount.current = needsAction;
      setJobs(arr);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, POLL_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  const f = FILTERS.find(x => x.key === filter);
  const filtered = f?.statuses ? jobs.filter(j => f.statuses.includes(j.status)) : jobs;

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      {newJobs > 0 && (
        <div style={{ background: '#00d4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>⚡ {newJobs} new job{newJobs > 1 ? 's' : ''}!</span>
          <button onClick={() => { setNewJobs(0); fetch(); }} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#000', color: '#00d4ff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Show</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {FILTERS.map(f2 => (
          <button key={f2.key} onClick={() => setFilter(f2.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === f2.key ? '#1a1a2e' : '#e0e0e0',
            color: filter === f2.key ? '#fff' : '#333', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>{f2.label} ({f2.statuses ? jobs.filter(j => f2.statuses.includes(j.status)).length : jobs.length})</button>
        ))}
      </div>
      {filtered.length === 0 ? <Centered>No jobs in this category</Centered> : filtered.map(r => (
        <div key={r.id} onClick={() => nav(`/jobs/${r.id}`)} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
            <span style={{ background: ST_COLORS[r.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{ST_LABELS[r.status] || r.status}</span>
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{r.customerName} · {r.serviceType}{r.priority ? ` · ${r.priority}` : ''}</div>
        </div>
      ))}
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 12 }}>Auto-refreshes every 30s</div>
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
