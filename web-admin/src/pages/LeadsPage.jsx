import { useState, useEffect, useCallback } from 'react';
import { q, create, del } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function LeadsPage() {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertType, setConvertType] = useState('customer');
  const nav = useNavigate();

  const load = useCallback(async () => {
    const d = await q('leads', { select: '*', order: 'created_at.desc', limit: 100 });
    setItems(d || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load notes when a lead is selected
  useEffect(() => {
    if (selected) {
      q('leadsHistory', { filters: [{ field: 'lead_id', value: selected.id }], order: 'date.desc', limit: 50 })
        .then(d => setNotes({ ...notes, [selected.id]: d || [] }))
        .catch(() => {});
    }
  }, [selected?.id]);

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    try {
      await create('leadsHistory', { lead_id: selected.id, note: newNote, date: new Date().toISOString() });
      setNewNote('');
      const d = await q('leadsHistory', { filters: [{ field: 'lead_id', value: selected.id }], order: 'date.desc', limit: 50 });
      setNotes({ ...notes, [selected.id]: d || [] });
    } catch (err) { alert('Failed to add note: ' + err.message); }
  };

  const handleDelete = async id => {
    await del('leads', id);
    setConfirmDelete(null);
    setSelected(null);
    load();
  };

  const handleConvert = () => {
    if (!selected) return;
    if (convertType === 'customer') {
      nav('/customers', { state: { firstName: selected.firstName, lastName: selected.lastName, 
        email: selected.email, company: selected.company, contactPhoneNumber: selected.contactPhoneNumber } });
    } else {
      nav('/contractors', { state: { firstName: selected.firstName, lastName: selected.lastName, 
        email: selected.email, company: selected.company, contactPhoneNumber: selected.contactPhoneNumber } });
    }
    setShowConvert(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Leads ({items.length})</h2>
        {items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No leads yet</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            {items.map(l => (
              <div key={l.id} onClick={() => setSelected(l)}
                style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                  background: selected?.id === l.id ? '#f0f7ff' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{(l.firstName || '') + ' ' + (l.lastName || '')}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{l.email || l.company || l.contactPhoneNumber || ''}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setConfirmDelete(l.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        {selected ? (
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0' }}>
            <h3 style={{ marginBottom: 12 }}>{(selected.firstName || '') + ' ' + (selected.lastName || '')}</h3>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              {selected.email && <div>Email: {selected.email}</div>}
              {selected.company && <div>Company: {selected.company}</div>}
              {selected.contactPhoneNumber && <div>Phone: {selected.contactPhoneNumber}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setConvertType('customer'); setShowConvert(true); }}
                  style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #00d4ff', background: 'transparent', color: '#00d4ff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Convert to Customer</button>
                <button onClick={() => { setConvertType('contractor'); setShowConvert(true); }}
                  style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #00d4ff', background: 'transparent', color: '#00d4ff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Convert to Contractor</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: '#888' }}>Notes</h4>
              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}>
                {(notes[selected.id] || []).map((n, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: '#f9f9f9', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                    <div style={{ color: '#666', fontSize: 11 }}>{n.date ? new Date(n.date).toLocaleString() : ''}</div>
                    {n.note}
                  </div>
                ))}
                {(!notes[selected.id] || notes[selected.id].length === 0) && (
                  <div style={{ color: '#ccc', fontSize: 12, padding: 8 }}>No notes yet</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }} />
                <button onClick={addNote} style={{ padding: '8px 14px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Add</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 8, padding: 40, textAlign: 'center', color: '#ccc', border: '1px solid #e0e0e0' }}>
            Select a lead to view details
          </div>
        )}
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360 }}>
            <h3 style={{ marginBottom: 8 }}>Delete Lead?</h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>This removes all contact history.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showConvert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360 }}>
            <h3 style={{ marginBottom: 8 }}>Convert to {convertType === 'customer' ? 'Customer' : 'Contractor'}</h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>This will navigate to the {convertType} creation form with lead data pre-filled.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConvert(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleConvert} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Go to {convertType === 'customer' ? 'Customers' : 'Contractors'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
