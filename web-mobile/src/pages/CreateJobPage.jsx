import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { canEdit } from '../api/client';

const TOKEN = () => localStorage.getItem('token');
const headers = () => ({ 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

async function apiPost(path, body) {
  const res = await fetch(`/api/asset-management${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const INPUT = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' };
const SELECT = { ...INPUT, background: '#fff' };
const LABEL = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' };

const JOB_TYPES = ['Install', 'Move', 'Retire', 'Inspect', 'Repair', 'Transfer'];
const PRIORITIES = [
  { value: 'low', color: '#22c55e' },
  { value: 'medium', color: '#f59e0b' },
  { value: 'high', color: '#ef4444' },
];

export default function CreateJobPage() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => { if (!canEdit('assets')) nav(-1); }, []);
  const [jobType, setJobType] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!jobType) { alert('Select a job type'); return; }
    setSaving(true);
    try {
      await apiPost(`/assets/${id}/create-job`, { job_type: jobType, description, priority });
      nav(`/assets/${id}`);
    } catch (e) { alert('Failed to create job: ' + e.message); }
    setSaving(false);
  };

  return (
    <div>
      <button onClick={() => nav(`/assets/${id}`)}
        style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>
        ← Asset
      </button>

      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#1a1a2e' }}>Create Job</h2>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <label style={LABEL}>Job Type *</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {JOB_TYPES.map(t => (
            <button key={t} onClick={() => setJobType(t)} style={{
              padding: '10px 6px', borderRadius: 6, border: jobType === t ? '2px solid #00d4ff' : '1px solid #ddd',
              background: jobType === t ? '#f0f9ff' : '#fff', color: jobType === t ? '#00d4ff' : '#555',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', textAlign: 'center'
            }}>{t}</button>
          ))}
        </div>

        <label style={LABEL}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the job..."
          rows={4} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />

        <label style={LABEL}>Priority</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {PRIORITIES.map(p => (
            <button key={p.value} onClick={() => setPriority(p.value)} style={{
              flex: 1, padding: '8px', borderRadius: 6, border: priority === p.value ? '2px solid ' + p.color : '1px solid #ddd',
              background: priority === p.value ? p.color + '20' : '#fff', color: priority === p.value ? p.color : '#555',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize'
            }}>{p.value}</button>
          ))}
        </div>
      </div>

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : '#22c55e', color: '#fff', fontWeight: 700, fontSize: 16, cursor: saving ? 'default' : 'pointer', marginBottom: 24 }}>
        {saving ? 'Creating...' : 'Create Job'}
      </button>
    </div>
  );
}
