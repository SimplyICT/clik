import { useState, useEffect } from 'react';
import { q } from '../api/client';

export default function ManagePage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'User' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    q('user_profiles', { select: 'user_id,role,customer_ref' })
      .then(async (profiles) => {
        const arr = Array.isArray(profiles) ? profiles : [];
        const userProfiles = arr.filter(p => p.customer_ref);
        const userIds = userProfiles.map(p => p.user_id).join(',');
        let userMap = {};
        if (userIds) {
          try {
            const usersData = await q('users', { select: 'id,email', filters: [{ field: 'id', op: 'in', value: `(${userIds})` }] });
            if (Array.isArray(usersData)) {
              usersData.forEach(u => { userMap[u.id] = u.email; });
            }
          } catch {}
        }
        const merged = userProfiles.map(p => ({
          id: p.user_id,
          email: userMap[p.user_id] || 'unknown@email.com',
          role: p.role || 'User',
        }));
        setUsers(merged);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditUser(null);
    setForm({ name: '', email: '', phone: '', role: 'User' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: '', email: u.email, phone: '', role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    alert('User management requires the backend API (coming in Phase 1). For now, users can be managed directly in Supabase.');
    setSaving(false);
    setShowModal(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>User Management ({users.length})</h2>
        <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Add User</button>
      </div>

      {users.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No users found for this customer</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Email</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Role</th>
            <th style={{ width: 50 }}></th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.email}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: u.role === 'Manager' ? '#38bdf8' : u.role === 'Operator' ? '#f59e0b' : '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{u.role}</span></td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => openEdit(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 420 }}>
            <h3 style={{ marginBottom: 16 }}>{editUser ? 'Edit User' : 'Add User'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>Email</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="User">User</option>
                <option value="Operator">Operator</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
