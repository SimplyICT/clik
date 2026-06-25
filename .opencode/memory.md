# SimplyClik — Project Memory

Last updated: 2026-06-25 (session end)

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

### Auto-Provisioning
- invite_tokens table with 7-day expiry
- 3 API endpoints: send, accept, status
- Accept-invite page at /invite/{token} with auto-redirect to mobile app
- iOS browser detection + copyable link instructions for Safari
- SMTP via SMTP2GO configured and verified
- Session cookie bridge for iOS PWA auto-login
- AuthGate component for race-condition-free auth flow

### Contractor Profile Auto-Creation
- Setting user role to "contractor" auto-creates profiles entry
- Contractor immediately appears in Contractors page
- Backward-compatible: existing contractors can be fixed via role update

### Help & DevDocs Updated
- Permissions Matrix, User Management, Invite/Auto-Provisioning sections added

## Session Close Rituals
- ✅ Help and DevDocs pages checked/updated
- ✅ All commits pushed
- ✅ Memory updated

## Project State
- Firebase-to-Supabase migration: complete
- Asset Management System v2: complete
- Permissions Matrix System: complete
- User Management: create/edit/delete/archive/search + address autocomplete
- ~186 tests across all modules

## 2026-06-21 (Session 6 — Auto-Provisioning)
- **Full auto-provisioning system**:
  - `invite_tokens` table with 7-day expiry
  - 3 API endpoints: send, accept, status
  - Dedicated accept-invite page at `/invite/{token}` with PWA install prompt
  - Invite button on UsersPage (Send / Resend / ✓ Accepted)
  - SMTP configured (SMTP2GO: mail-au.smtp2go.com:2525)
  - Email verified working
  - Full flow tested end-to-end
- Design spec: `docs/superpowers/specs/2026-06-21-auto-provisioning-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-21-auto-provisioning.md`

## 2026-06-23 (Session 7 — Pagination + Quote Description + Asset Site Filtering)
- **Dashboard pagination:** Contractor job list now has prev/next pagination (10 per page) with page indicator. Needs-action alerts stay at top.
- **Quote description:** Added `quote_description` column to `requests` table + migration. Contractors can now enter a description when submitting a quote. Displayed alongside the quote amount.
- **Asset site filtering:** Assets are now tied to customer locations. Contractors only see assets at sites they are assigned to via `customer_location_contractors`. Backend: added `customer_location_id` and `location_ids` (comma-separated) filters to the asset-management API. Frontend: mobile AssetsPage fetches contractor's assigned locations and filters assets accordingly.
- **FastAPI whitelist:** Added `quoteDescription` to PATCH field whitelist.

## 2026-06-25 (Session 8 — Pushover + Onboarding + QR + Passwordless + Role fixes)

### Per-User Pushover Notifications ✅
- DB: `pushover_user_key` column on `public.user_profiles`
- Backend: `POST/GET /api/pushover/save-key` + `GET /api/pushover/key`
- `send_pushover()` accepts per-user `user_key` parameter
- All notification triggers resolve per-user pushover key from profiles
- Admin panel: Pushover key field in user create/edit form
- Mobile profile: Pushover key management section

### PWA Install + Onboarding Flow ✅
- `OnboardingPage.jsx`: 3-step flow (install → pushover → done)
- Shows after invite acceptance via `show_onboarding` sessionStorage flag
- PWA install banner + Pushover key entry

### QR Code Invites ✅
- `GET /api/invite/{user_id}/qr` endpoint returns PNG QR code
- QR Code button in admin UsersPage after sending invite
- QR code embedded directly in invite email (HTML with base64)

### Passwordless Auth Fixes ✅
- `accept_invite` now returns `permissions`, `author_profile_id`, `customer_id`, `customer_name`, `role`
- Cookie bridge (`/api/auth/cookie`) returns same fields
- Cache API bridge stores + restores all fields (token, user, permissions, role, etc.)
- `RequireAuth` always hits cookie bridge first before fallbacks
- `LoginPage` auto-checks cookie bridge on mount

### Password Management ✅
- `POST /api/users/{user_id}/reset-password` endpoint
- Reset Password button + modal in admin UsersPage

### Bugfixes
- `update_user_profile` INSERT used invalid `profile_type` enum value `'user'` → changed to UPDATE-only
- Stale uvicorn processes blocking systemd restarts resolved
- Fixed: user details save failing with 500

## Project State
- All major systems complete
- Permissions Matrix ✅
- User Management ✅
- Auto-Provisioning ✅
- Infrastructure (CI/CD + rate limiting) ✅
- Asset Site Filtering ✅
- Quote Description ✅
- Pushover Notifications ✅
- PWA Onboarding + QR Invites ✅
- Passwordless Auto-Login ✅
