import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    q('requests', { select: '*', order: 'requestStartDate.desc.nullslast', limit: 50 }).then(d => { setJobs(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      {jobs.length === 0 ? <Centered>No jobs assigned</Centered> : jobs.map(r => (
        <div key={r.id} onClick={() => nav(`/jobs/${r.id}`)} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
            <span style={{ background: ST_COLORS[r.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.status?.replace(/_/g, ' ')}</span>
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{r.serviceType} {r.priority ? `· ${r.priority}` : ''} {r.requestStartDate ? `· ${new Date(r.requestStartDate).toLocaleDateString()}` : ''}</div>
        </div>
      ))}
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
