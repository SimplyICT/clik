# Auto-Provisioning — Design Spec

**Date:** 2026-06-21
**Status:** Draft
**Version:** 1.0

## Overview

One-click contractor onboarding. Admin creates a user and sends an invite email. The contractor clicks a magic link → lands on an accept page → gets auto-logged in → installs the PWA. No password setup, no registration form.

## Flow

```
Admin creates user → clicks "Send Invite" → email sent with magic link
  → Contractor clicks link → /invite/{token} page loads
  → Backend validates token, creates session
  → Accept page stores session, shows "Install App" prompt
  → Contractor opens PWA → already logged in → ready to work
```

## Data Model

### `invite_tokens` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | FK to `auth.users.id` |
| `token` | TEXT | UNIQUE, 64-char hex via `secrets.token_hex(32)` |
| `expires_at` | TIMESTAMPTZ | Default `NOW() + INTERVAL '7 days'` |
| `used_at` | TIMESTAMPTZ | Null until accepted |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `created_by` | UUID | Admin user who sent it |

Index on `token` for lookup.

### `.env` additions

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
SMTP_FROM=noreply@simplyclik.com
```

## Backend API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/invite/{user_id}` | Admin | Generate invite token, send email |
| `GET` | `/api/invite/accept/{token}` | None | Validate token, create session, return session data |
| `GET` | `/api/invite/status/{user_id}` | Admin | Check if user has a pending/used invite |

### `POST /api/invite/{user_id}`

1. Verify requesting user is admin
2. Verify target user exists and is not archived
3. Generate 64-char token, insert into `invite_tokens` with 7-day expiry
4. Build invite URL: `{APP_URL}/invite/{token}`
5. Send email via `send_email(to, subject, body)` with the link
6. Return `{ok: true}`

Email body template:
```
Subject: You're invited to SimplyClik

Hi there,

You've been invited to join SimplyClik. Click the link below to get started:

{invite_url}

This link expires in 7 days.

SimplyClik Team
```

### `GET /api/invite/accept/{token}`

1. Look up token in `invite_tokens` where `used_at IS NULL` AND `expires_at > NOW()`
2. If not found → return `{ok: false, error: "invalid or expired"}`
3. Set `used_at = NOW()`
4. Create a session via existing `create_session()` with the user's data
5. Return `{ok: true, token: "<session_token>", user: {...}, ...}`

### `GET /api/invite/status/{user_id}`

1. Query most recent invite for this user
2. Return `{invited: bool, accepted: bool, expires_at: ..., created_at: ...}`

## Frontend — Accept Page

**Path:** `/invite/{token}` — standalone page outside any SPA

**File:** `server/static/invite.html` — a self-contained HTML page served by FastAPI's static file serving (no React needed)

### Page behavior:
1. On load, call `GET /api/invite/accept/{token}`
2. If valid:
   - Store `token` and `user` in `localStorage`
   - Show success message: "You're in! Let's set up your app."
   - Show large **"Install App"** button (captures `beforeinstallprompt`)
   - After install (or skip), redirect to `/mobile/`
3. If invalid/expired:
   - Show error message: "This link has expired or is no longer valid."
   - "Contact your administrator" note

### PWA Install:
- Listen for `beforeinstallprompt` event
- Store event reference
- Show "Install App" button when available
- On click → fire stored event → browser shows native install prompt
- If declined or not available → show "Open in Browser" fallback

### Mobile PWA config (already done):
- `manifest.json` with `display: "standalone"`, scope `/mobile/`
- Service worker with push notifications
- Session persists in localStorage — after install, PWA opens to `/mobile/` and user is logged in

## Admin UI — Invite Button

On the UsersPage, add to each user row:
- **"Send Invite"** button (amber/envelope icon)
- **Status indicator**: dot showing "Not invited" / "Invite sent" / "Accepted"
- Clicking generates invite via `POST /api/invite/{user_id}`
- On success, show status update + "Invite sent to {email}"
- Option to resend (generates new token, invalidates old)

## Email Configuration

The existing `send_email()` function in `server/notifications.py` handles SMTP. It needs SMTP env vars configured. The invite feature will use this function directly.

## Implementation Order

1. Add `invite_tokens` table to schema.sql + migration
2. Add SMTP config to .env
3. Create `invite_routes.py` with 3 endpoints
4. Create accept-invite HTML page
5. Add invite button + status to UsersPage
6. Register routes + serve invite page from FastAPI
7. Set up SMTP env vars
8. Test full flow: create user → send invite → click link → accept → PWA install
