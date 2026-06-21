# SimplyClik — Project Memory

Last updated: 2026-06-21 (session end)

## 2026-06-20/21 (Session 5+ — Permissions Matrix + Infrastructure + User Mgmt)

### Permissions Matrix System — Complete ✅
- DB: `user_permissions` table (user_id, resource, can_view, can_edit)
- Backend: `has_permission`, `get_user_permissions`, `seed_manager_defaults`, `set_user_permissions`, `require_permission` dependency
- 4 API endpoints for managing permissions
- Login returns `permissions` field; manager defaults auto-seeded
- Route guard migration: 12 endpoints across 6 files → `require_permission`
- Frontend: `canView`/`canEdit` helpers, UsersPage with permission matrix

### Infrastructure
- Login rate limiting (5/min per IP)
- CI/CD pipeline: `.github/workflows/ci.yml`
- Pushed to https://github.com/SimplyICT/clik

### User Management (UsersPage)
- User CRUD API: create, list, update role, delete, archive
- User profile: contact_name, contact_phone, contact_email
- Address fields: address_line1, address_line2, city, state, postcode
- Address autocomplete via OpenStreetMap Nominatim API
- Search/filter user list
- Archive (soft delete) + hard delete
- Professional card-based UI with role badges
- Requests detail panel: redesigned as centered modal with edit capability

### Portal/Mobile Permission Gating
- Portal: canEdit guards on AssetDetailView, RequestsPage, ManagePage
- Mobile: canEdit across 8 files, page-level guards on form pages
- Mobile: replaced all `!isContractor` with `canEdit('assets')`

### Service Worker Fix
- Admin/portal SW: self-unregistering to clear old SW
- Mobile SW: fixed fetch handler to fall back to cached shell

## Project State
- Firebase-to-Supabase migration: complete
- Asset Management System v2: complete
- Permissions Matrix System: complete
- User Management: create/edit/delete/archive/search + address autocomplete
- ~186 tests across all modules

## Next Session
- **Auto-provisioning flow**: Email link → auto-register → PWA install → auto-login → full-screen mobile experience for contractors
  - Generate unique invite link per user
  - Click link creates account (no password)
  - Auto-installs PWA icon
  - Auto-signs in
  - Full-screen mode like pwa.simplyclik.com/mobile
