import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';
import PushSetup from './PushSetup';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const ST_LABELS = { pending_approval:'Pending', awaiting_acceptance:'Awaiting Acceptance', awaiting_quote:'Awaiting Quote', pending_quote_approval:'Quote Approval', accepted:'Accepted', rfi:'More Info', in_progress:'In Progress', contractor_completed:'Done', completed:'Completed', declined:'Declined', cancelled:'Cancelled' };
const POLL_MS = 30000;

function useJobPoller(isContractor) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newJobs, setNewJobs] = useState(0);
  const prevCount = useRef(0);

  const fetch = useCallback(() => {
    const pid = sessionStorage.getItem('author_profile_id');
    if (!pid && isContractor) { setLoading(false); return; }
    if (isContractor) {
      q('requests', {
        select: 'id,title,status,serviceType,priority,customerName,customerLocationProfileId,quoteAmount,invoiceAmount,requestStartDate,description',
        filters: [{ field: 'contractorProfileId', value: pid }],
        order: 'requestStartDate.desc.nullslast',
      }).then(d => {
        const arr = Array.isArray(d) ? d : [];
        const needsAction = arr.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status)).length;
        if (prevCount.current > 0 && needsAction > prevCount.current) {
          setNewJobs(n => n + (needsAction - prevCount.current));
        }
        prevCount.current = needsAction;
        setJobs(arr);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [isContractor]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, POLL_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { jobs, loading, newJobs, clearNew: () => setNewJobs(0), refetch: fetch };
}

export default function DashboardPage() {
  const nav = useNavigate();
  const role = sessionStorage.getItem('role');
  const isContractor = role === 'contractor';
  const { jobs, loading, newJobs, clearNew, refetch } = useJobPoller(isContractor);

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <PushSetup onSubscribed={refetch} />

      {newJobs > 0 && (
        <div style={{ background: '#00d4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'pulse 2s infinite' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>⚡ {newJobs} new job{newJobs > 1 ? 's' : ''} available!</span>
          <button onClick={() => { clearNew(); refetch(); }} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#000', color: '#00d4ff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
        </div>
      )}

      {isContractor ? <ContractorView jobs={jobs} nav={nav} /> : <ManagerView nav={nav} />}
    </div>
  );
}

function ContractorView({ jobs, nav }) {
  const needsAction = jobs.filter(j => ['awaiting_acceptance', 'awaiting_quote'].includes(j.status));
  const newJobs = jobs.filter(j => j.status === 'awaiting_acceptance').length;
  const activeJobs = jobs.filter(j => !['completed', 'declined', 'cancelled', 'awaiting_acceptance'].includes(j.status)).length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;

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
      {jobs.length === 0 ? <Centered>No jobs assigned yet. Waiting for new jobs...</Centered> : jobs.slice(0, 10).map(r => <JobCard key={r.id} job={r} onClick={() => nav(`/jobs/${r.id}`)} />)}
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 12 }}>Auto-refreshes every 30s</div>
    </div>
  );
}

function ManagerView({ nav }) {
  const sc = parseInt(sessionStorage.getItem('siteCount') || '0');
  const rc = parseInt(sessionStorage.getItem('requestCount') || '0');
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <QuickTile label="Sites" value={sc} color="#00d4ff" onClick={() => nav('/sites')} />
        <QuickTile label="Requests" value={rc} color="#ff9500" onClick={() => nav('/requests')} />
      </div>
      <button onClick={() => nav('/requests/new')} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>+ New Request</button>
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
