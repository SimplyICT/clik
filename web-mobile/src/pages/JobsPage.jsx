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
const POLL_MS = 15000;

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [newJobs, setNewJobs] = useState([]);
  const lastTitles = useRef('');
  const nav = useNavigate();

  const fetch = useCallback(() => {
    const pid = localStorage.getItem('author_profile_id') || sessionStorage.getItem('author_profile_id');
    if (!pid) { setLoading(false); return; }
    q('requests', { select: 'id,title,status,serviceType,priority,customerName,quoteAmount,invoiceAmount,requestStartDate,description', filters: [{ field: 'contractorProfileId', value: pid }], order: 'requestStartDate.desc.nullslast', limit: 200 }).then(d => {
      const arr = Array.isArray(d) ? d : [];
      const needsAction = arr.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status));
      const currentTitles = needsAction.map(j => j.title).sort().join('|');
      if (lastTitles.current && currentTitles !== lastTitles.current) {
        const oldTitles = new Set(lastTitles.current.split('|'));
        const fresh = needsAction.filter(j => !oldTitles.has(j.title));
        if (fresh.length > 0) {
          setNewJobs(prev => [...fresh.map(j => ({ title: j.title, customerName: j.customerName })), ...prev].slice(0, 10));
          if (navigator.vibrate) navigator.vibrate(200);
          document.title = `(${fresh.length}) SimplyClik`;
          setTimeout(() => { document.title = 'SimplyClik'; }, 10000);
        }
      }
      lastTitles.current = currentTitles;
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
      {newJobs.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #00d4ff)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,212,255,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>⚡ {newJobs.length} New Job{newJobs.length > 1 ? 's' : ''}</div>
            <button onClick={() => { setNewJobs([]); document.title = 'SimplyClik'; }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          {newJobs.slice(0, 3).map((j, i) => (
            <div key={i} style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 4, padding: '6px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 6 }}>
              <span style={{ fontWeight: 600 }}>{j.title}</span>
              {j.customerName && <span style={{ opacity: 0.7 }}> — {j.customerName}</span>}
            </div>
          ))}
          {newJobs.length > 3 && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>+{newJobs.length - 3} more</div>}
          <button onClick={() => { setNewJobs([]); fetch(); }} style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: '#fff', color: '#1a1a2e', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>Refresh & Dismiss</button>
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
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 12 }}>Auto-refreshes every 15s</div>
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
