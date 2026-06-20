import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, authHeaders } from '../api/client';

const RESOURCES = [
  'dashboard', 'assets', 'work_orders', 'requests',
  'customers', 'contractors', 'locations', 'activity', 'users',
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const resp = await fetch('/api/supabase/users?select=id,email', {
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to fetch users');
      const data = await resp.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  }

  async function selectUser(userId) {
    setSelectedUser(userId);
    setMessage('');
    try {
      const resp = await fetch(`/api/users/permissions/${userId}`, {
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to fetch permissions');
      const data = await resp.json();
      const perms = data.permissions || {};
      const filled = {};
      for (const r of RESOURCES) {
        filled[r] = perms[r] || { can_view: false, can_edit: false };
      }
      setPermissions(filled);
    } catch (e) {
      setMessage('Error loading permissions: ' + e.message);
    }
  }

  function togglePermission(userId, resource, field) {
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
    setMessage('');
    try {
      const resp = await fetch(`/api/users/permissions/${selectedUser}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ permissions }),
      });
      if (!resp.ok) throw new Error('Failed to save permissions');
      setMessage('Permissions saved successfully');
    } catch (e) {
      setMessage('Error saving permissions: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function seedDefaults() {
    setMessage('');
    try {
      const resp = await fetch(`/api/users/permissions/${selectedUser}/seed`, {
        method: 'POST',
        headers: { ...authHeaders() },
      });
      if (!resp.ok) throw new Error('Failed to seed defaults');
      const data = await resp.json();
      setPermissions(data.permissions || {});
      setMessage('Manager defaults seeded');
    } catch (e) {
      setMessage('Error seeding defaults: ' + e.message);
    }
  }

  function cellStyle() {
    return { textAlign: 'center', padding: '4px' };
  }

  function toggleStyle(on) {
    return {
      padding: '4px 8px',
      cursor: 'pointer',
      border: '1px solid #ccc',
      borderRadius: '4px',
      background: on ? '#22c55e' : '#f3f4f6',
      color: on ? '#fff' : '#374151',
      fontSize: '12px',
      minWidth: '48px',
    };
  }

  if (loading) return <div style={{ padding: 24 }}>Loading users...</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>User Permissions</h1>

      {message && (
        <div style={{
          padding: '8px 16px',
          marginBottom: 16,
          borderRadius: 4,
          background: message.includes('Error') ? '#fef2f2' : '#f0fdf4',
          color: message.includes('Error') ? '#dc2626' : '#16a34a',
          border: `1px solid ${message.includes('Error') ? '#fecaca' : '#bbf7d0'}`,
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 300, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
            Users
          </div>
          {users.map(u => (
            <div
              key={u.id}
              onClick={() => selectUser(u.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: selectedUser === u.id ? '#eff6ff' : 'transparent',
                borderBottom: '1px solid #f3f4f6',
                fontWeight: selectedUser === u.id ? 600 : 400,
              }}
            >
              {u.email}
            </div>
          ))}
        </div>

        {selectedUser && (
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>
              Permissions for {users.find(u => u.id === selectedUser)?.email || selectedUser}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Resource</th>
                  <th style={cellStyle()}>View</th>
                  <th style={cellStyle()}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map(r => (
                  <tr key={r} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{r.replace('_', ' ')}</td>
                    <td style={cellStyle()}>
                      <button
                        style={toggleStyle(permissions[r]?.can_view)}
                        onClick={() => togglePermission(selectedUser, r, 'can_view')}
                      >
                        {permissions[r]?.can_view ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td style={cellStyle()}>
                      <button
                        style={toggleStyle(permissions[r]?.can_edit)}
                        onClick={() => togglePermission(selectedUser, r, 'can_edit')}
                      >
                        {permissions[r]?.can_edit ? 'Yes' : 'No'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={savePermissions}
                disabled={saving}
                style={{
                  padding: '8px 24px',
                  background: saving ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
              <button
                onClick={seedDefaults}
                style={{
                  marginLeft: 8,
                  padding: '8px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Seed Manager Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
