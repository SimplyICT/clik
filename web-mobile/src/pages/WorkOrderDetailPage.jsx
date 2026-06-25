import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getItemAny, setItem } from '../api/storage';

const STATUS_FLOW = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
};

const WO_COLORS = { pending:'#94a3b8', in_progress:'#3b82f6', completed:'#22c55e', cancelled:'#ef4444' };
const WO_LABELS = { pending:'Pending', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled' };

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [laborHours, setLaborHours] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`/api/asset-management/work-orders/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setWo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const token = () => getItemAny('token');

  async function transition(newStatus) {
    setUpdating(true);
    try {
      const body = { status: newStatus };
      if (newStatus === 'completed') {
        if (laborHours) body.labor_hours = parseFloat(laborHours) || 0;
        if (notes) body.notes = notes;
      }
      const resp = await fetch(`/api/asset-management/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error('Failed to update');
      const updated = await resp.json();
      setWo(updated);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <Centered>Loading...</Centered>;
  if (!wo) return <Centered>Work order not found</Centered>;

  const nextStatuses = STATUS_FLOW[wo.status] || [];

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{wo.title}</h3>
          <span style={{ background: WO_COLORS[wo.status] || '#94a3b8', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{WO_LABELS[wo.status] || wo.status}</span>
        </div>
        {wo.description && <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>{wo.description}</p>}
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.8 }}>
          <div><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{wo.type}</span></div>
          <div><strong>Priority:</strong> <span style={{ textTransform: 'capitalize' }}>{wo.priority}</span></div>
          {wo.scheduled_date && <div><strong>Scheduled:</strong> {wo.scheduled_date}</div>}
          {wo.completed_date && <div><strong>Completed:</strong> {wo.completed_date}</div>}
          {wo.labor_hours != null && <div><strong>Labor Hours:</strong> {wo.labor_hours}</div>}
          {wo.labor_cost != null && <div><strong>Labor Cost:</strong> ${wo.labor_cost}</div>}
          {wo.parts_cost != null && <div><strong>Parts Cost:</strong> ${wo.parts_cost}</div>}
          {wo.total_cost != null && <div><strong>Total Cost:</strong> ${wo.total_cost}</div>}
          {wo.notes && <div><strong>Notes:</strong> {wo.notes}</div>}
        </div>
      </div>

      {nextStatuses.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 12px' }}>Update Status</h4>
          {nextStatuses.includes('completed') && (
            <div style={{ marginBottom: 12 }}>
              <input value={laborHours} onChange={e => setLaborHours(e.target.value)}
                placeholder="Labor hours (optional)" type="number" step="0.5"
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Completion notes (optional)"
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', minHeight: 60, resize: 'vertical' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {nextStatuses.map(s => (
              <button key={s} onClick={() => transition(s)} disabled={updating}
                style={{
                  flex: 1, padding: '12px', borderRadius: 6, border: 'none',
                  background: s === 'completed' ? '#22c55e' : s === 'cancelled' ? '#ef4444' : '#3b82f6',
                  color: '#fff', fontWeight: 700, fontSize: 14, cursor: updating ? 'default' : 'pointer',
                  opacity: updating ? 0.7 : 1,
                }}>
                {updating ? '...' : WO_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Centered({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{children}</div>; }
