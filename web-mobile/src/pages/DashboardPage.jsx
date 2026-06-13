import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { q } from '../api/client';
import PushSetup from './PushSetup';

const ST_COLORS = { pending_approval:'#94a3b8', awaiting_acceptance:'#38bdf8', awaiting_quote:'#f59e0b', pending_quote_approval:'#f59e0b', accepted:'#22c55e', rfi:'#ef4444', in_progress:'#3b82f6', contractor_completed:'#22c55e', completed:'#22c55e', declined:'#ef4444', cancelled:'#ef4444' };
const ST_LABELS = { pending_approval:'Pending', awaiting_acceptance:'Awaiting Acceptance', awaiting_quote:'Awaiting Quote', pending_quote_approval:'Quote Approval', accepted:'Accepted', rfi:'More Info', in_progress:'In Progress', contractor_completed:'Done', completed:'Completed', declined:'Declined', cancelled:'Cancelled' };

export default function DashboardPage() {
  const nav = useNavigate();
  const role = sessionStorage.getItem('role');
  const isContractor = role === 'contractor';
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isContractor) {
      const pid = sessionStorage.getItem('author_profile_id');
      if (!pid) { setLoading(false); return; }
      q('requests', { select: 'id,title,status,serviceType,priority,customerName,customerLocationProfileId,quoteAmount,invoiceAmount,requestStartDate,description', filters: [{ field: 'contractorProfileId', value: pid }], order: 'requestStartDate.desc.nullslast' }).then(d => {
        setJobs(Array.isArray(d) ? d : []); setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      const cid = sessionStorage.getItem('customer_id') || '';
      Promise.all([
        q('customerLocations', { select: 'id,companyName', filters: cid ? [{ field: 'customerId', value: cid }] : [] }),
        q('requests', { select: 'id,status', filters: cid ? [{ field: 'customerId', value: cid }] : [] }),
      ]).then(([locs, reqs]) => {
        sessionStorage.setItem('siteCount', String(Array.isArray(locs) ? locs.length : 0));
        sessionStorage.setItem('requestCount', String(Array.isArray(reqs) ? reqs.length : 0));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  if (loading) return <Centered>Loading...</Centered>;

  return (
    <div>
      <PushSetup />
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
        <StatBox label="New" count={newJobs} color="#38bdf8" />
        <StatBox label="Active" count={activeJobs} color="#3b82f6" />
        <StatBox label="Completed" count={completedJobs} color="#22c55e" />
      </div>

      {needsAction.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#ef4444' }}>⚡ Needs Action</h3>
          {needsAction.slice(0, 3).map(r => <JobCard key={r.id} job={r} onClick={() => nav(`/jobs/${r.id}`)} />)}
        </div>
      )}

      <h3 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>All Jobs ({jobs.length})</h3>
      {jobs.length === 0 ? <Centered>No jobs assigned yet. You'll be notified when one becomes available.</Centered> : jobs.slice(0, 10).map(r => <JobCard key={r.id} job={r} onClick={() => nav(`/jobs/${r.id}`)} />)}
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

function StatBox({ label, count, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '12px 8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
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
