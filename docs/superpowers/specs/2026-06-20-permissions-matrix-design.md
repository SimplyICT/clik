# Permissions Matrix System — Design Spec

**Date:** 2026-06-20
**Status:** Draft
**Version:** 1.0

## Overview

Replace the current binary `is_admin` permission model with a granular matrix-based system where each user has per-resource view/edit permissions. Admins bypass all restrictions; managers get sensible defaults that can be overridden per user; contractors require explicit setup.

## Data Model

### `user_permissions` table

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID (FK to `auth.users.id`) | |
| `resource` | VARCHAR | One of: `dashboard`, `assets`, `work_orders`, `requests`, `customers`, `contractors`, `locations`, `activity`, `users` |
| `can_view` | BOOLEAN | NOT NULL, default false |
| `can_edit` | BOOLEAN | NOT NULL, default false |

**PK:** `(user_id, resource)`

### Permission rules by role

| Role | How permissions work |
|------|---------------------|
| **Admin** | `is_admin=true` in session. Bypasses `user_permissions` entirely — full access to everything. |
| **Manager** | On first login, if no rows exist in `user_permissions`, seed from `MANAGER_DEFAULTS`. Admins can then tweak per-manager. |
| **Contractor** | No defaults. Admin must set permissions explicitly. No rows = no access to anything. |

### Manager defaults (hardcoded constant)

```python
MANAGER_DEFAULTS = {
    "dashboard":   {"can_view": True,  "can_edit": True},
    "assets":      {"can_view": True,  "can_edit": True},
    "work_orders": {"can_view": True,  "can_edit": True},
    "requests":    {"can_view": True,  "can_edit": True},
    "customers":   {"can_view": True,  "can_edit": True},
    "contractors": {"can_view": True,  "can_edit": True},
    "locations":   {"can_view": True,  "can_edit": True},
    "activity":    {"can_view": True,  "can_edit": True},
    "users":       {"can_view": False, "can_edit": False},  # admins only
}
```

## Backend

### New dependency: `require_permission`

```python
async def require_permission(resource: str, action: Literal["view", "edit"]):
    async def _checker(session: dict = Depends(require_session)):
        if session.get("is_admin"):
            return session
        if not has_permission(session["uid"], resource, action):
            raise HTTPException(403, detail=f"No {action} access to {resource}")
        return session
    return _checker
```

Implementation of `has_permission`:
```python
def has_permission(uid: str, resource: str, action: str) -> bool:
    row = db("SELECT can_view, can_edit FROM user_permissions WHERE user_id = %s AND resource = %s", (uid, resource))
    if not row:
        return False
    return row[0][f"can_{action}"]
```

### New API routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/users/permissions/{user_id}` | Admin only | Get a user's full permission matrix |
| `PUT` | `/api/users/permissions/{user_id}` | Admin only | Set permissions for a user |
| `GET` | `/api/users/me/permissions` | Any session | Get current user's permissions |

`PUT` request body:
```json
{
  "permissions": {
    "assets": {"can_view": true, "can_edit": true},
    "work_orders": {"can_view": true, "can_edit": false}
  }
}
```

### Login response update

`POST /api/login` now returns a `permissions` object alongside `token`, `user`, `is_admin`:
```json
{
  "token": "...",
  "user": {"uid": "...", "email": "...", "role": "manager"},
  "is_admin": false,
  "permissions": {
    "assets": {"can_view": true, "can_edit": true},
    "work_orders": {"can_view": true, "can_edit": false}
  }
}
```

If admin, the backend returns all resources with both `can_view` and `can_edit` as `true` for convenience.

### Route migration

Replace all ad-hoc `if not session.get("is_admin"): raise 403` checks with the new `require_permission` dependency.

**Resource mapping:** Sub-modules (documents, costs, maintenance, imports) are features of the Asset Management page, so they're gated by the `assets` resource. Work Orders is a top-level page with its own resource.

| Route file | Endpoints | Permission check |
|------------|-----------|-----------------|
| `server/asset_service/routes.py` | `bulk/status`, `bulk/transfer`, `bulk/assign`, `transfer`, `delete_part`, `create_custom_field` | `require_permission("assets", "edit")` |
| `documents/routes.py` | `DELETE /documents/{doc_id}` | `require_permission("assets", "edit")` |
| `costs/routes.py` | `POST /costs` | `require_permission("assets", "edit")` |
| `costs/routes.py` | `GET /costs/summary` | `require_permission("assets", "view")` |
| `maintenance/routes.py` | `DELETE /schedules/{id}` | `require_permission("assets", "edit")` |
| `work_orders/routes.py` | `DELETE /work-orders/{id}` | `require_permission("work_orders", "edit")` |
| `imports/routes.py` | `POST /import` | `require_permission("assets", "edit")` |

## Frontend

### Login storage

On login, store the `permissions` object alongside `token`, `user`, and `is_admin`.

### Permission helpers

In `web-admin/src/api/client.js`:
```js
export function getPermissions() {
  try {
    return JSON.parse(localStorage.getItem('permissions') || sessionStorage.getItem('permissions') || '{}');
  } catch { return {}; }
}

export function canView(resource) {
  return isAdmin() || getPermissions()?.[resource]?.can_view === true;
}

export function canEdit(resource) {
  return isAdmin() || getPermissions()?.[resource]?.can_edit === true;
}
```

### Conditional rendering

Replace all `{admin && ...}` and `{isManager && ...}` patterns with permission-based checks (`canView(resource)` / `canEdit(resource)`) across all page components.

- Action buttons (delete, create, edit) → `canEdit(resource)`
- Tab visibility (Custom Fields, Import/Export, Audit Log) → `canView(resource)` or `canEdit(resource)` as appropriate
- Page-level content (sections that only some should see) → `canView(resource)`

### User Permissions Manager page

New admin page at `/admin/users` (route: `/users`):
- User list with search/filter
- Select a user → view their permission matrix
- Matrix grid: rows = resources, columns = "View" / "Edit" toggle switches
- Auto-seeds manager defaults when first viewing a manager
- Save button → `PUT /api/users/permissions/{user_id}`

### Affected frontend files

| File | Change |
|------|--------|
| `web-admin/src/api/client.js` | Add `getPermissions`, `canView`, `canEdit` |
| `web-admin/src/App.jsx` | Add `/users` route, update `RequireAuth` to pass permissions |
| `web-admin/src/pages/AssetManagementPage.jsx` | Replace `admin` guards with `canEdit`/`canView` |
| `web-admin/src/pages/LoginPage.jsx` | Store permissions from login response |
| `web-portal/src/api/client.js` | Add same helpers (for future portal use) |
| `web-portal/src/App.jsx` | No immediate changes (portal uses role-based scoping) |
| `web-mobile/src/api/client.js` | No immediate changes |

## Implementation Order

1. Database migration: create `user_permissions` table
2. Backend: `has_permission` helper + `require_permission` dependency
3. Backend: `GET/PUT /api/users/permissions/{user_id}` + `GET /api/users/me/permissions`
4. Backend: update login response to include permissions
5. Backend: migrate existing route guards to `require_permission`
6. Frontend: API helpers (`getPermissions`, `canView`, `canEdit`)
7. Frontend: store permissions on login
8. Frontend: create User Permissions Manager page
9. Frontend: update conditional rendering across admin pages
10. Frontend: add User Management link to navigation
11. Test: backend permission checks, frontend rendering, login flow
