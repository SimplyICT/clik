import { useState, useEffect } from 'react';
import { authHeaders } from '../api/client';

const RESOURCES = [
  'dashboard', 'assets', 'work_orders', 'requests',
  'customers', 'contractors', 'locations', 'activity', 'users',
];

const ROLES = [
  { value: 'admin', label: 'Admin', color: '#ef4444' },
  { value: 'manager', label: 'Manager', color: '#f59e0b' },
  { value: 'user', label: 'User', color: '#6b7280' },
  { value: 'contractor', label: 'Contractor', color: '#8b5cf6' },
];

const roleMap = {};
ROLES.forEach(r => { roleMap[r.value] = r; });

const cardStyle = {
  background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20,
};

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box',
};

const btnPrimary = {
  padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};

const btnDanger = {
  padding: '8px 20px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};

const btnSecondary = {
  padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};

let activeReq = 0;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const resp = await fetch('/api/users', { headers: { ...authHeaders() } });
      if (!resp.ok) throw new Error('Failed to fetch users');
      const data = await resp.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage({ type: 'error', text: 'Error fetching users: ' + e.message });
    } finally {
      setLoading(false);
    }
  }

  async function selectUser(user) {
    const req = ++activeReq;
    setSelectedUserId(user.id);
    setSelectedUserData(user);
    setMessage(null);
    try {
      const resp = await fetch(`/api/users/permissions/${user.id}`, {
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to fetch permissions');
      const data = await resp.json();
      if (req !== activeReq) return;
      const perms = data.permissions || {};
      const filled = {};
      for (const r of RESOURCES) {
        filled[r] = perms[r] || { can_view: false, can_edit: false };
      }
      setPermissions(filled);
    } catch (e) {
      if (req === activeReq) {
        setMessage({ type: 'error', text: 'Error loading permissions: ' + e.message });
      }
    }
  }

  function togglePermission(resource, field) {
    setPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [field]: !prev[resource]?.[field],
      },
    }));
  }

  async function savePermissions() {
    setSaving(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/users/permissions/${selectedUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ permissions }),
      });
      if (!resp.ok) throw new Error('Failed to save permissions');
      setMessage({ type: 'success', text: 'Permissions saved successfully' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error saving permissions: ' + e.message });
    } finally {
      setSaving(false);
    }
  }

  async function seedDefaults() {
    setMessage(null);
    try {
      const resp = await fetch(`/api/users/permissions/${selectedUserId}/seed`, {
        method: 'POST',
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to seed defaults');
      const data = await resp.json();
      setPermissions(data.permissions || {});
      setMessage({ type: 'success', text: 'Manager defaults seeded' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error seeding defaults: ' + e.message });
    }
  }

  async function updateRole(newRole) {
    setUpdatingRole(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/users/${selectedUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      if (!resp.ok) throw new Error('Failed to update role');
      setSelectedUserData(prev => ({ ...prev, role: newRole }));
      setUsers(prev => prev.map(u => u.id === selectedUserId ? { ...u, role: newRole } : u));
      setMessage({ type: 'success', text: 'Role updated successfully' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error updating role: ' + e.message });
    } finally {
      setUpdatingRole(false);
    }
  }

  async function deleteUser() {
    setMessage(null);
    try {
      const resp = await fetch(`/api/users/${selectedUserId}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to delete user');
      setUsers(prev => prev.filter(u => u.id !== selectedUserId));
      setSelectedUserId(null);
      setSelectedUserData(null);
      setPermissions({});
      setShowDeleteConfirm(false);
      setMessage({ type: 'success', text: 'User deleted successfully' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error deleting user: ' + e.message });
      setShowDeleteConfirm(false);
    }
  }

  async function handleCreate() {
    if (!createForm.email.trim() || !createForm.password.trim()) {
      setMessage({ type: 'error', text: 'Email and password are required' });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(createForm),
      });
      if (!resp.ok) throw new Error('Failed to create user');
      const newUser = await resp.json();
      setUsers(prev => [...prev, newUser]);
      setShowCreate(false);
      setCreateForm({ email: '', password: '', role: 'user' });
      setMessage({ type: 'success', text: 'User created successfully' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error creating user: ' + e.message });
    } finally {
      setCreating(false);
    }
  }

  function toggleStyle(on) {
    return {
      padding: '4px 10px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: 4,
      background: on ? '#22c55e' : '#f3f4f6', color: on ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, minWidth: 48,
    };
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading users...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>User Management</h2>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Create User</button>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px', marginBottom: 16, borderRadius: 6,
          background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: message.type === 'error' ? '#dc2626' : '#16a34a',
          border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          fontSize: 13, fontWeight: 500,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Users ({users.length})
          </div>
          {users.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>No users found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map(u => {
                const role = roleMap[u.role] || roleMap.user;
                const isSelected = selectedUserId === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => selectUser(u)}
                    style={{
                      padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#f9fafb',
                      border: isSelected ? '1px solid #93c5fd' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 4, wordBreak: 'break-all' }}>
                      {u.email}
                    </div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      background: role.color, color: '#fff', fontSize: 11, fontWeight: 600,
                    }}>
                      {role.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedUserId && selectedUserData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 16, wordBreak: 'break-all' }}>
                {selectedUserData.email}
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={selectedUserData.role || 'user'}
                      onChange={e => updateRole(e.target.value)}
                      disabled={updatingRole}
                      style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {updatingRole && <span style={{ color: '#888', fontSize: 12, alignSelf: 'center' }}>Updating...</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowDeleteConfirm(true)} style={btnDanger}>Delete User</button>
                <button onClick={seedDefaults} style={btnSecondary}>Reset to Manager Defaults</button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Permissions
              </div>
              <div className="responsive-table" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Resource</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>View</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map(r => (
                      <tr key={r} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500, textTransform: 'capitalize', color: '#374151' }}>
                          {r.replace(/_/g, ' ')}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <button
                            style={toggleStyle(permissions[r]?.can_view)}
                            onClick={() => togglePermission(r, 'can_view')}
                          >
                            {permissions[r]?.can_view ? 'On' : 'Off'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <button
                            style={toggleStyle(permissions[r]?.can_edit)}
                            onClick={() => togglePermission(r, 'can_edit')}
                          >
                            {permissions[r]?.can_edit ? 'On' : 'Off'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12 }}>
                <button onClick={savePermissions} disabled={saving}
                  style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Select a user to manage permissions
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Create User</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>Add a new user to the system</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
              <input placeholder="user@example.com" value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" placeholder="Enter password" value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role</label>
              <select value={createForm.role}
                onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                style={{ ...inputStyle }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ ...btnPrimary, opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Delete User</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              Are you sure you want to delete <strong>{selectedUserData?.email}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={btnSecondary}>Cancel</button>
              <button onClick={deleteUser} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
