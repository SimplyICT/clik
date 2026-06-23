import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { q, canEdit } from '../api/client';
import PushSetup from './PushSetup';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const ST_LABELS = { pending_approval:'Pending', awaiting_acceptance:'Awaiting Acceptance', awaiting_quote:'Awaiting Quote', pending_quote_approval:'Quote Approval', accepted:'Accepted', rfi:'More Info', in_progress:'In Progress', contractor_completed:'Done', completed:'Completed', declined:'Declined', cancelled:'Cancelled' };
const POLL_MS = 15000; // Every 15s for snappier updates

function useJobPoller(isContractor) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newJobs, setNewJobs] = useState([]); // Array of {title} for display
  const prevCount = useRef(0);
  const lastTitles = useRef('');

  const fetch = useCallback(() => {
    const pid = localStorage.getItem('author_profile_id') || sessionStorage.getItem('author_profile_id');
    if (!pid && isContractor) { setLoading(false); return; }
    if (isContractor) {
      q('requests', {
        select: 'id,title,status,serviceType,priority,customerName,customerLocationProfileId,quoteAmount,invoiceAmount,requestStartDate,description',
        filters: [{ field: 'contractorProfileId', value: pid }],
        order: 'requestStartDate.desc.nullslast',
      }).then(d => {
        const arr = Array.isArray(d) ? d : [];
        const needsAction = arr.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status));
        const currentTitles = needsAction.map(j => j.title).sort().join('|');
        
        // Detect new jobs by title change (not just count)
        if (lastTitles.current && currentTitles !== lastTitles.current) {
          const oldTitles = new Set(lastTitles.current.split('|'));
          const fresh = needsAction.filter(j => !oldTitles.has(j.title));
          if (fresh.length > 0) {
            setNewJobs(prev => [...fresh.map(j => ({ title: j.title, customerName: j.customerName })), ...prev].slice(0, 10));
            // Vibrate on supported devices
            if (navigator.vibrate) navigator.vibrate(200);
            // Update page title
            document.title = `(${fresh.length}) SimplyClik`;
            // Reset title after 10s
            setTimeout(() => { document.title = 'SimplyClik'; }, 10000);
          }
        }
        lastTitles.current = currentTitles;
        setJobs(arr);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [isContractor]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, POLL_MS);
    const timeout = setTimeout(() => setLoading(false), 8000); // Force render after 8s even if queries hang
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [fetch]);

  return { jobs, loading, newJobs, clearNew: () => setNewJobs([]), refetch: fetch };
}

export default function DashboardPage() {
  const nav = useNavigate();
  const role = localStorage.getItem('role') || sessionStorage.getItem('role');
  const isContractor = role === 'contractor';
  const { jobs, loading, newJobs, clearNew, refetch } = useJobPoller(isContractor);

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <PushSetup onSubscribed={refetch} />

      {/* Persistent notification banner - stays until dismissed */}
      {newJobs.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #00d4ff)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,212,255,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              ⚡ {newJobs.length} New Job{newJobs.length > 1 ? 's' : ''}
            </div>
            <button onClick={() => { clearNew(); document.title = 'SimplyClik'; }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
          {newJobs.slice(0, 3).map((j, i) => (
            <div key={i} style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 4, padding: '6px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 6 }}>
              <span style={{ fontWeight: 600 }}>{j.title}</span>
              {j.customerName && <span style={{ opacity: 0.7 }}> — {j.customerName}</span>}
            </div>
          ))}
          {newJobs.length > 3 && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>+{newJobs.length - 3} more</div>
          )}
          <button onClick={() => { clearNew(); refetch(); }} style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: '#fff', color: '#1a1a2e', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            Refresh & Dismiss
          </button>
        </div>
      )}

      {isContractor ? <ContractorView jobs={jobs} nav={nav} /> : <ManagerView nav={nav} />}
    </div>
  );
}

const PAGE_SIZE = 10;

function ContractorView({ jobs, nav }) {
  const [page, setPage] = useState(0);
  const needsAction = jobs.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status));
  const newJobs = jobs.filter(j => j.status === 'awaiting_acceptance').length;
  const activeJobs = jobs.filter(j => !['completed', 'declined', 'cancelled', 'awaiting_acceptance'].includes(j.status)).length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const paginatedJobs = jobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#38bdf8' }}>{newJobs}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>New</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{activeJobs}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Active</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{completedJobs}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Completed</div>
        </div>
      </div>

      {needsAction.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#ef4444' }}>⚡ Needs Action</h3>
          {needsAction.slice(0, 3).map(r => <JobCard key={r.id} job={r} onClick={() => nav(`/jobs/${r.id}`)} />)}
        </div>
      )}

      <h3 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>All Jobs ({jobs.length})</h3>
      {jobs.length === 0 ? <Centered>No jobs assigned yet. Waiting for new jobs...</Centered> : paginatedJobs.map(r => <JobCard key={r.id} job={r} onClick={() => nav(`/jobs/${r.id}`)} />)}
      {jobs.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: page === 0 ? '#f5f5f5' : '#fff', color: page === 0 ? '#bbb' : '#333', fontWeight: 600, fontSize: 13, cursor: page === 0 ? 'default' : 'pointer' }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#888' }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: page >= totalPages - 1 ? '#f5f5f5' : '#fff', color: page >= totalPages - 1 ? '#bbb' : '#333', fontWeight: 600, fontSize: 13, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
            Next →
          </button>
        </div>
      )}
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 12 }}>Auto-refreshes every 15s</div>
    </div>
  );
}

function ManagerView({ nav }) {
  const [sc, setSc] = useState(0);
  const [rc, setRc] = useState(0);
  const [loading, setLoading] = useState(true);
  const cid = localStorage.getItem('customer_id') || sessionStorage.getItem('customer_id');

  useEffect(() => {
    Promise.all([
      q('customerLocations', { select: 'id', filters: cid ? [{ field: 'customerId', value: cid }] : [] }).catch(() => []),
      q('requests', { select: 'id', filters: cid ? [{ field: 'customerId', value: cid }] : [] }).catch(() => []),
    ]).then(([locs, reqs]) => {
      setSc(Array.isArray(locs) ? locs.length : 0);
      setRc(Array.isArray(reqs) ? reqs.length : 0);
      setLoading(false);
    });
  }, [cid]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <QuickTile label="Sites" value={loading ? '…' : sc} color="#00d4ff" onClick={() => nav('/sites')} />
        <QuickTile label="Requests" value={loading ? '…' : rc} color="#ff9500" onClick={() => nav('/requests')} />
      </div>
      {canEdit('requests') && <button onClick={() => nav('/requests/new')} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>+ New Request</button>}
    </div>
  );
}

function QuickTile({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 10, padding: 20, textAlign: 'center', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
      <div style={{ fontSize: 36, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function JobCard({ job, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{job.title}</div>
        <span style={{ background: ST_COLORS[job.status] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{ST_LABELS[job.status] || job.status}</span>
      </div>
      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{job.customerName} · {job.serviceType}{job.priority ? ` · ${job.priority}` : ''}</div>
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
