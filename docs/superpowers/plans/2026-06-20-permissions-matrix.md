# Permissions Matrix System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary `is_admin` permission model with a granular matrix per-resource (view/edit) for each non-admin user.

**Architecture:** One new DB table (`user_permissions`), one new backend module (`permissions.py`) with a reusable `require_permission` dependency, one new API route file, and one new frontend page. Route guards migrate from ad-hoc `is_admin` checks to declarative resource-based checks.

**Tech Stack:** FastAPI, PostgreSQL (Supabase), React, pg8000

---

### Task 1: Database Migration — `user_permissions` table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/asset_service/schema.sql` (applied at the end)

- [ ] **Step 1: Add table and index to schema.sql**

Append to `server/asset_service/schema.sql`:

```sql
-- Permissions Matrix: per-user view/edit access per resource
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL,
    resource TEXT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
```

Also add to the `_ensure_tables()` function in the test file `server/tests/test_permissions.py` that will be created in Task 9.

---

### Task 2: Backend — Permission helpers and `require_permission` dependency

**Files:**
- Create: `server/asset_service/permissions.py`

- [ ] **Step 1: Create `server/asset_service/permissions.py`**

```python
from fastapi import Depends, HTTPException, Header
from typing import Literal
from asset_service.db import get_conn

RESOURCES = [
    "dashboard", "assets", "work_orders", "requests",
    "customers", "contractors", "locations", "activity", "users",
]

MANAGER_DEFAULTS = {
    "dashboard":   {"can_view": True,  "can_edit": True},
    "assets":      {"can_view": True,  "can_edit": True},
    "work_orders": {"can_view": True,  "can_edit": True},
    "requests":    {"can_view": True,  "can_edit": True},
    "customers":   {"can_view": True,  "can_edit": True},
    "contractors": {"can_view": True,  "can_edit": True},
    "locations":   {"can_view": True,  "can_edit": True},
    "activity":    {"can_view": True,  "can_edit": True},
    "users":       {"can_view": False, "can_edit": False},
}

ADMIN_PERMISSIONS = {r: {"can_view": True, "can_edit": True} for r in RESOURCES}


def has_permission(uid: str, resource: str, action: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT can_view, can_edit FROM user_permissions WHERE user_id = %s::uuid AND resource = %s",
            (uid, resource)
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return False
        return row[0] if action == "view" else row[1]
    finally:
        conn.close()


def get_user_permissions(uid: str) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT resource, can_view, can_edit FROM user_permissions WHERE user_id = %s::uuid",
            (uid,)
        )
        rows = cur.fetchall()
        cur.close()
        return {r: {"can_view": v, "can_edit": e} for r, v, e in rows}
    finally:
        conn.close()


def seed_manager_defaults(uid: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        for resource, perms in MANAGER_DEFAULTS.items():
            cur.execute(
                """INSERT INTO user_permissions (user_id, resource, can_view, can_edit)
                   VALUES (%s::uuid, %s, %s, %s)
                   ON CONFLICT (user_id, resource) DO NOTHING""",
                (uid, resource, perms["can_view"], perms["can_edit"])
            )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_user_permissions(uid: str, permissions: dict):
    conn = get_conn()
    try:
        cur = conn.cursor()
        for resource, perms in permissions.items():
            cur.execute(
                """INSERT INTO user_permissions (user_id, resource, can_view, can_edit)
                   VALUES (%s::uuid, %s, %s, %s)
                   ON CONFLICT (user_id, resource)
                   DO UPDATE SET can_view = %s, can_edit = %s""",
                (uid, resource, perms.get("can_view", False), perms.get("can_edit", False),
                 perms.get("can_view", False), perms.get("can_edit", False))
            )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


def require_permission(resource: str, action: Literal["view", "edit"]):
    async def _checker(session: dict = Depends(require_session)):
        if session.get("is_admin"):
            return session
        if not has_permission(session["uid"], resource, action):
            raise HTTPException(403, detail=f"No {action} access to {resource}")
        return session
    return _checker
```

---

### Task 3: Backend — Permission management API routes

**Files:**
- Create: `server/asset_service/permissions_routes.py`

- [ ] **Step 1: Create `server/asset_service/permissions_routes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from . import permissions
from .permissions import require_session, get_user_permissions, set_user_permissions, seed_manager_defaults, ADMIN_PERMISSIONS

router = APIRouter(tags=["permissions"])


async def require_admin(session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can manage permissions")
    return session


@router.get("/api/users/me/permissions")
async def get_my_permissions(session: dict = Depends(require_session)):
    if session.get("is_admin"):
        return {"permissions": ADMIN_PERMISSIONS}
    perms = get_user_permissions(session["uid"])
    if not perms:
        return {"permissions": {}}
    return {"permissions": perms}


@router.get("/api/users/permissions/{user_id}")
async def get_user_permissions_route(user_id: str, session: dict = Depends(require_admin)):
    perms = get_user_permissions(user_id)
    return {"user_id": user_id, "permissions": perms or {}}


@router.put("/api/users/permissions/{user_id}")
async def update_user_permissions(user_id: str, body: dict, session: dict = Depends(require_admin)):
    permissions_data = body.get("permissions", {})
    set_user_permissions(user_id, permissions_data)
    return {"ok": True, "user_id": user_id}


@router.post("/api/users/permissions/{user_id}/seed")
async def seed_user_permissions(user_id: str, session: dict = Depends(require_admin)):
    seed_manager_defaults(user_id)
    perms = get_user_permissions(user_id)
    return {"ok": True, "user_id": user_id, "permissions": perms}
```

- [ ] **Step 2: Register the router in `server/fastapi_app.py`**

Add with the other `include_router` calls (around line 104):

```python
from asset_service.permissions_routes import router as permissions_router

app.include_router(permissions_router)
```

---

### Task 4: Backend — Update login response

**Files:**
- Modify: `server/fastapi_app.py` (login handler)

- [ ] **Step 1: Add permissions to the admin login response**

In `server/fastapi_app.py`, in the admin login branch (around line 182-194), after constructing `result`, add permissions:

```python
# After line 188: result = {"token": ..., "user": ..., "is_admin": ...}
from asset_service.permissions import get_user_permissions, seed_manager_defaults, ADMIN_PERMISSIONS
if is_admin:
    result["permissions"] = ADMIN_PERMISSIONS
else:
    perms = get_user_permissions(str(uid))
    if not perms:
        # Check if user has a manager profile — seed defaults
        profile_role = profile[0][0] if profile else None
        if profile_role and profile_role.lower() == "manager":
            seed_manager_defaults(str(uid))
            perms = get_user_permissions(str(uid))
    result["permissions"] = perms
```

---

### Task 5: Backend — Migrate route guards

**Files:**
- Modify: `server/asset_service/routes.py`
- Modify: `server/asset_service/documents/routes.py`
- Modify: `server/asset_service/costs/routes.py`
- Modify: `server/asset_service/maintenance/routes.py`
- Modify: `server/asset_service/work_orders/routes.py`
- Modify: `server/asset_service/imports/routes.py`

For each file, replace `require_session` with the appropriate `require_permission` on admin-gated endpoints.

- [ ] **Step 1: Migrate `server/asset_service/routes.py`**

Find and replace all `if not session.get("is_admin"): raise HTTPException(403, ...)` patterns.

For the bulk endpoints and admin-only operations, change the dependency from `require_session` to `require_permission("assets", "edit")`:

```python
# Before:
async def bulk_update_status(body: dict, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can perform bulk operations")

# After:
from asset_service.permissions import require_permission

async def bulk_update_status(body: dict, session: dict = Depends(require_permission("assets", "edit"))):
    # no inline is_admin check needed
```

Affected endpoints in `routes.py`:
- `bulk/status` — replace dependency with `require_permission("assets", "edit")`, remove body check
- `bulk/transfer` — same
- `bulk/assign` — same
- `transfer` — same
- `delete_part` — same
- `create_custom_field` — same

- [ ] **Step 2: Migrate `server/asset_service/documents/routes.py`**

Endpoint `DELETE /documents/{doc_id}`:
```python
# Before
async def delete_document(doc_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete documents")

# After
async def delete_document(doc_id: str, session: dict = Depends(require_permission("assets", "edit"))):
```

- [ ] **Step 3: Migrate `server/asset_service/costs/routes.py`**

Endpoints `POST /costs` and `GET /costs/summary`:
- `POST /costs` → `require_permission("assets", "edit")`
- `GET /costs/summary` → `require_permission("assets", "view")`

- [ ] **Step 4: Migrate `server/asset_service/maintenance/routes.py`**

Endpoint `DELETE /schedules/{id}` → `require_permission("assets", "edit")`

- [ ] **Step 5: Migrate `server/asset_service/work_orders/routes.py`**

Endpoint `DELETE /work-orders/{id}` → `require_permission("work_orders", "edit")`

- [ ] **Step 6: Migrate `server/asset_service/imports/routes.py`**

Endpoint `POST /import` → `require_permission("assets", "edit")`

---

### Task 6: Frontend — API helpers and login storage

**Files:**
- Modify: `web-admin/src/api/client.js`
- Modify: `web-admin/src/pages/LoginPage.jsx`

- [ ] **Step 1: Add permission helpers to `web-admin/src/api/client.js`**

Add after the existing `isAdmin()` function:

```js
export function getPermissions() {
  try {
    return JSON.parse(
      localStorage.getItem('permissions') || sessionStorage.getItem('permissions') || '{}'
    );
  } catch { return {}; }
}

export function canView(resource) {
  if (isAdmin()) return true;
  const perms = getPermissions();
  return perms?.[resource]?.can_view === true;
}

export function canEdit(resource) {
  if (isAdmin()) return true;
  const perms = getPermissions();
  return perms?.[resource]?.can_edit === true;
}
```

- [ ] **Step 2: Store permissions on login in `LoginPage.jsx`**

In `web-admin/src/pages/LoginPage.jsx`, after the login API call succeeds, store the `permissions` field:

```js
// After storing is_admin:
s.setItem('is_admin', JSON.stringify(d.is_admin || false));
// Add:
s.setItem('permissions', JSON.stringify(d.permissions || {}));
```

---

### Task 7: Frontend — User Permissions Manager page

**Files:**
- Create: `web-admin/src/pages/UsersPage.jsx`

- [ ] **Step 1: Create `web-admin/src/pages/UsersPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, getToken, apiPost } from '../api/client';

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

  const token = getToken();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      // Fetch users via the Supabase proxy endpoint (already used elsewhere)
      const resp = await fetch('/api/supabase/users?select=id,email', {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch permissions');
      const data = await resp.json();
      const perms = data.permissions || {};
      // Fill in missing resources with defaults
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
          Authorization: `Bearer ${token}`,
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
        {/* User list */}
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

        {/* Permission matrix */}
        {selectedUser && (
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>Permissions for {users.find(u => u.id === selectedUser)?.email || selectedUser}</h3>
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
                onClick={() => fetch(`/api/users/permissions/${selectedUser}/seed`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                }).then(() => selectUser(selectedUser))}
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
```

---

### Task 8: Frontend — Route and navigation updates

**Files:**
- Modify: `web-admin/src/App.jsx`
- Verify: `web-admin/src/pages/AssetManagementPage.jsx`

- [ ] **Step 1: Add /users route in `web-admin/src/App.jsx`**

Import the new page and add a route:

```jsx
import UsersPage from './pages/UsersPage';

// Add route inside the existing <Routes>:
<Route path="/users" element={<RequireAuth><Layout><UsersPage /></Layout></RequireAuth>} />
```

Also add a nav link for "User Management" in the header/menu. In the desktop nav (around where Help/DevDocs links are), add:

```jsx
<Link to="/users">Users</Link>
```

And in the mobile hamburger menu, add:

```jsx
<Link to="/users">User Management</Link>
```

- [ ] **Step 2: Update AssetManagementPage.jsx permission checks**

Find all `{admin && ...}` and `{isManager && ...}` patterns and replace them with `{canView(...)}` / `{canEdit(...)}`.

Key replacements:
- `if (isManager) tabs.push({ label: 'Custom Fields', ... })` → `if (canEdit('assets')) tabs.push(...)`
- `if (admin) tabs.push({ label: 'Audit Log', ... })` → `if (canView('assets')) tabs.push(...)`
- `if (isManager) tabs.push({ label: 'Work Orders', ... })` → `if (canView('work_orders')) tabs.push(...)`
- `if (isManager) tabs.push({ label: 'Maintenance', ... })` → `if (canEdit('assets')) tabs.push(...)`
- `if (isManager) tabs.push({ label: 'Import/Export', ... })` → `if (canEdit('assets')) tabs.push(...)`
- `if (isManager) tabs.push({ label: 'QR Batch', ... })` → `if (canEdit('assets')) tabs.push(...)`
- `{admin && <button ...>Delete</button>}` → `{canEdit('assets') && <button ...>Delete</button>}`

Add import at top:
```jsx
import { canView, canEdit } from '../api/client';
```

---

### Task 9: Tests

**Files:**
- Create: `server/tests/test_permissions.py`

- [ ] **Step 1: Create `server/tests/test_permissions.py`**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pg8000


def _ensure_tables():
    host = os.environ.get("SUPABASE_DB_HOST") or os.environ["DB_HOST"]
    port = os.environ.get("SUPABASE_DB_PORT") or os.environ["DB_PORT"]
    dbname = os.environ.get("SUPABASE_DB_NAME") or os.environ["DB_NAME"]
    user = os.environ.get("SUPABASE_DB_USER") or os.environ["DB_USER"]
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ["DB_PASSWORD"]
    conn = pg8000.connect(
        host=host, port=int(port),
        database=dbname, user=user,
        password=password, ssl_context=True,
    )
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_permissions (
            user_id UUID NOT NULL,
            resource TEXT NOT NULL,
            can_view BOOLEAN NOT NULL DEFAULT false,
            can_edit BOOLEAN NOT NULL DEFAULT false,
            PRIMARY KEY (user_id, resource)
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


# ── Permission helpers ────────────────────────────────────────────────────

def test_has_permission_false_for_unknown():
    from asset_service.permissions import has_permission
    assert has_permission("00000000-0000-0000-0000-000000000099", "assets", "view") is False


def test_seed_manager_defaults():
    from asset_service.permissions import seed_manager_defaults, get_user_permissions, MANAGER_DEFAULTS
    import uuid
    test_uid = str(uuid.uuid4())
    seed_manager_defaults(test_uid)
    perms = get_user_permissions(test_uid)
    for r, expected in MANAGER_DEFAULTS.items():
        assert r in perms, f"Missing resource {r}"
        assert perms[r]["can_view"] == expected["can_view"], f"{r} can_view mismatch"
        assert perms[r]["can_edit"] == expected["can_edit"], f"{r} can_edit mismatch"


def test_set_user_permissions():
    from asset_service.permissions import set_user_permissions, get_user_permissions
    import uuid
    test_uid = str(uuid.uuid4())
    perms = {"assets": {"can_view": True, "can_edit": True}, "dashboard": {"can_view": True, "can_edit": False}}
    set_user_permissions(test_uid, perms)
    stored = get_user_permissions(test_uid)
    assert stored["assets"]["can_view"] is True
    assert stored["assets"]["can_edit"] is True
    assert stored["dashboard"]["can_view"] is True
    assert stored["dashboard"]["can_edit"] is False


def test_set_user_permissions_overwrites():
    from asset_service.permissions import set_user_permissions, get_user_permissions
    import uuid
    test_uid = str(uuid.uuid4())
    set_user_permissions(test_uid, {"assets": {"can_view": True, "can_edit": True}})
    set_user_permissions(test_uid, {"assets": {"can_view": False, "can_edit": False}})
    stored = get_user_permissions(test_uid)
    assert stored["assets"]["can_view"] is False
    assert stored["assets"]["can_edit"] is False


# ── API endpoint tests ────────────────────────────────────────────────────

def test_get_my_permissions_admin():
    token = login_token()
    resp = client.get("/api/users/me/permissions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "permissions" in data
    assert data["permissions"]["assets"]["can_view"] is True
    assert data["permissions"]["assets"]["can_edit"] is True


def test_get_my_permissions_requires_auth():
    resp = client.get("/api/users/me/permissions")
    assert resp.status_code == 401


def test_get_user_permissions_admin_only():
    token = login_token()
    resp = client.get("/api/users/permissions/00000000-0000-0000-0000-000000000001",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_get_user_permissions_unauthorized():
    # Login as a non-admin user (cont1 from test data)
    resp = client.post("/api/login", json={"email": "cont1@simplyclik.testinator.com", "password": "Temp123!"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    resp2 = client.get("/api/users/permissions/00000000-0000-0000-0000-000000000001",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 403


def test_put_user_permissions_admin_only():
    token = login_token()
    test_uid = "00000000-0000-0000-0000-000000000001"
    resp = client.put(f"/api/users/permissions/{test_uid}",
                      json={"permissions": {"assets": {"can_view": True, "can_edit": True}}},
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_login_returns_permissions_for_admin():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "permissions" in data
    assert data["permissions"]["assets"]["can_view"] is True
    assert data["permissions"]["assets"]["can_edit"] is True
```

- [ ] **Step 2: Run the tests**

```bash
cd server && python -m pytest tests/test_permissions.py -v
```

Expected: ALL tests PASS.

---

### Task 10: Run verification

**Files:**
- None

- [ ] **Step 1: Run all backend tests**

```bash
cd server && python -m pytest tests/ -v
```

Expected: All existing tests still pass (admin login returns permissions now but the field is just extra — existing assertions should still work). Any test that checks exact shape of login response may need a minor update to include the `permissions` field.

- [ ] **Step 2: Lint/type check**

```bash
cd server && python -m py_compile asset_service/permissions.py asset_service/permissions_routes.py
```

- [ ] **Step 3: Verify frontend build**

```bash
cd web-admin && npm run build 2>&1 | tail -20
```
