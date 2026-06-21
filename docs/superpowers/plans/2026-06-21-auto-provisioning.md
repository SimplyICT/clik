# Auto-Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click contractor onboarding via email magic link — no password, no registration form.

**Architecture:** New `invite_tokens` DB table + 3 API endpoints + standalone accept-invite HTML page + invite button on UsersPage. Reuses existing `send_email()` and `create_session()` functions.

**Tech Stack:** FastAPI, PostgreSQL (Supabase), pg8000, SMTP (existing send_email)

---

### File Structure

| File | Type | Purpose |
|------|------|---------|
| `server/asset_service/schema.sql` | Modify | Add `invite_tokens` table |
| `server/asset_service/invite_routes.py` | Create | 3 API endpoints for invite lifecycle |
| `server/static/invite.html` | Create | Standalone accept-invite page (no React) |
| `server/fastapi_app.py` | Modify | Register router, serve invite page, add `mkdir` for static dir |
| `web-admin/src/pages/UsersPage.jsx` | Modify | Add "Send Invite" button + invite status per user |

---

### Task 1: Database — `invite_tokens` table

**Files:**
- Modify: `server/asset_service/schema.sql`

- [ ] **Step 1: Append the new table to schema.sql**

```sql
-- Invite tokens for auto-provisioning (magic link onboarding)
CREATE TABLE IF NOT EXISTS invite_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
```

- [ ] **Step 2: Apply migration to the database**

```bash
cd /home/aiagent/simplyclik-app/server && python3 -c "
from dotenv import load_dotenv; from pathlib import Path; load_dotenv(Path('.env'))
import os, pg8000
host = os.environ.get('SUPABASE_DB_HOST') or os.environ['DB_HOST']
port = os.environ.get('SUPABASE_DB_PORT') or os.environ['DB_PORT']
dbname = os.environ.get('SUPABASE_DB_NAME') or os.environ['DB_NAME']
user = os.environ.get('SUPABASE_DB_USER') or os.environ['DB_USER']
password = os.environ.get('SUPABASE_DB_PASSWORD') or os.environ['DB_PASSWORD']
conn = pg8000.connect(host=host, port=int(port), database=dbname, user=user, password=password, ssl_context=True)
cur = conn.cursor()
cur.execute(open('asset_service/schema.sql').read())
conn.commit()
cur.close()
conn.close()
print('Schema applied')
"
```

---

### Task 2: Backend — Invite API routes

**Files:**
- Create: `server/asset_service/invite_routes.py`

- [ ] **Step 1: Create `server/asset_service/invite_routes.py`**

```python
import secrets
from fastapi import APIRouter, Depends, HTTPException
from asset_service.permissions import require_session

router = APIRouter(tags=["invite"])


async def require_admin(session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can manage invites")
    return session


@router.get("/api/invite/status/{user_id}")
async def get_invite_status(user_id: str, session: dict = Depends(require_admin)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT token, expires_at, used_at, created_at
            FROM invite_tokens
            WHERE user_id = %s::uuid
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"invited": False, "accepted": False}
        return {
            "invited": True,
            "accepted": row[2] is not None,
            "expires_at": row[1].isoformat() if row[1] else None,
            "created_at": row[3].isoformat() if row[3] else None,
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.post("/api/invite/{user_id}")
async def send_invite(user_id: str, session: dict = Depends(require_admin)):
    import bcrypt
    from notifications import send_email
    from asset_service.db import get_conn
    base_url = os.environ.get("APP_URL", "https://pwa.simplyclik.com")
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Check user exists
        cur.execute("SELECT email FROM auth.users WHERE id = %s::uuid", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(404, detail="User not found")
        email = user_row[0]
        # Generate token
        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO invite_tokens (user_id, token, created_by) VALUES (%s::uuid, %s, %s::uuid)",
            (user_id, token, session.get("uid"))
        )
        conn.commit()
        cur.close()
        # Send email
        invite_url = f"{base_url}/invite/{token}"
        send_email(
            to=email,
            subject="You're invited to SimplyClik",
            body=f"Hi there,\n\nYou've been invited to join SimplyClik. Click the link below to get started:\n\n{invite_url}\n\nThis link expires in 7 days.\n\nSimplyClik Team"
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/invite/accept/{token}")
async def accept_invite(token: str):
    from asset_service.db import get_conn
    from fastapi_app import create_session
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT it.user_id, u.email, up.role, up.customer_ref
            FROM invite_tokens it
            JOIN auth.users u ON u.id = it.user_id
            LEFT JOIN public.user_profiles up ON up.user_id = it.user_id
            WHERE it.token = %s AND it.used_at IS NULL AND it.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(410, detail="Invite link is invalid or has expired")
        uid, email, role, customer_ref = row
        # Mark as used
        cur.execute("UPDATE invite_tokens SET used_at = NOW() WHERE token = %s", (token,))
        conn.commit()
        cur.close()
        # Create session
        session_data = {
            "uid": str(uid), "email": email, "mode": "mobile",
            "customer_ref": customer_ref,
        }
        session_token = create_session(session_data)
        return {
            "ok": True,
            "token": session_token,
            "user": {"id": str(uid), "email": email, "uid": str(uid)},
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()
```

Add import at the top:
```python
import os
```

- [ ] **Step 2: Register the router in `server/fastapi_app.py`**

Add with the other includes:
```python
from asset_service.invite_routes import router as invite_router
app.include_router(invite_router)
```

---

### Task 3: Create `server/static/` directory and invite.html page

**Files:**
- Create: `server/static/invite.html`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p /home/aiagent/simplyclik-app/server/static
```

- [ ] **Step 2: Create accept-invite HTML page**

Create `/home/aiagent/simplyclik-app/server/static/invite.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#1a1a2e">
<title>SimplyClik Invite</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #16213e; border-radius: 12px; padding: 40px 32px; width: min(400px, 90vw); text-align: center; }
  h1 { font-size: 22px; margin-bottom: 8px; }
  p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
  .spinner { width: 40px; height: 40px; border: 3px solid #333; border-top-color: #00d4ff; border-radius: 50%; animation: spin .8s linear infinite; margin: 20px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn { display: block; width: 100%; padding: 14px; border-radius: 8px; border: none; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 12px; }
  .btn-primary { background: #00d4ff; color: #000; }
  .btn-secondary { background: transparent; color: #94a3b8; border: 1px solid #333; }
  .error { color: #ef4444; font-size: 14px; }
  .success { color: #22c55e; font-size: 14px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card" id="app">
  <div id="loading">
    <div class="spinner"></div>
    <p>Validating your invite...</p>
  </div>
  <div id="success" style="display:none">
    <div class="icon">🎉</div>
    <h1>You're in!</h1>
    <p id="successMsg">Let's set up your app.</p>
    <button class="btn btn-primary" id="installBtn" style="display:none" onclick="installApp()">Install App</button>
    <button class="btn btn-secondary" onclick="openApp()">Open SimplyClik</button>
  </div>
  <div id="error" style="display:none">
    <div class="icon">😕</div>
    <h1>Link Expired</h1>
    <p class="error">This invite link is no longer valid. Please contact your administrator for a new one.</p>
  </div>
</div>

<script>
let deferredPrompt = null;
const token = location.pathname.split('/').pop();

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});

async function init() {
  try {
    const resp = await fetch('/api/invite/accept/' + token);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Invalid');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('_remember', 'true');
    document.getElementById('loading').style.display = 'none';
    document.getElementById('success').style.display = 'block';
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
  }
}

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
}

function openApp() {
  window.location.href = '/mobile/';
}

init();
</script>
</body>
</html>
```

---

### Task 4: Serve invite page from FastAPI

**Files:**
- Modify: `server/fastapi_app.py`

- [ ] **Step 1: Add static file route for invite.html**

Add near the other static file routes (around line 1023):
```python
import os
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent / "static"

@app.get("/invite/{token}")
async def invite_page(token: str):
    idx = STATIC_DIR / "invite.html"
    if idx.exists():
        return FileResponse(str(idx), media_type="text/html")
    raise HTTPException(404)
```

Make sure the `import os` is already at the top, and add `from pathlib import Path` if not already imported (it is).

---

### Task 5: Frontend — Invite button on UsersPage

**Files:**
- Modify: `web-admin/src/pages/UsersPage.jsx`

- [ ] **Step 1: Add invite state + functions**

Add these state variables after existing profile state (around line 55):
```jsx
const [inviteStatus, setInviteStatus] = useState({});
const [sendingInvite, setSendingInvite] = useState(false);
```

Add this function to fetch invite status when selecting a user (inside `selectUser`, after the profile fetch, before the closing `}` of the try block):
```jsx
// Load invite status
try {
  const invResp = await fetch(`/api/invite/status/${user.id}`, { headers: { ...authHeaders() } });
  if (invResp.ok) {
    const invData = await invResp.json();
    setInviteStatus(invData);
  }
} catch(e) {}
```

But since this is ASYNC and will always run (even for stale requests), wrap it in the same stale-check pattern:
```jsx
if (req !== activeReq) return;
```

Actually, place the invite status fetch AFTER the profile data check, but INSIDE the profile fetch's try block (so it only runs for valid requests).

Or simpler: add a separate useEffect to fetch invite status when `selectedUserId` changes:
```jsx
useEffect(() => {
  if (!selectedUserId) return;
  fetch(`/api/invite/status/${selectedUserId}`, { headers: { ...authHeaders() } })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d) setInviteStatus(d); })
    .catch(() => {});
}, [selectedUserId]);
```

Add the send invite function:
```jsx
async function handleSendInvite() {
  setSendingInvite(true);
  setMessage(null);
  try {
    const resp = await fetch(`/api/invite/${selectedUserId}`, {
      method: 'POST',
      headers: { ...authHeaders() },
    });
    if (!resp.ok) throw new Error('Failed to send invite');
    setInviteStatus({ invited: true, accepted: false });
    setMessage({ type: 'success', text: 'Invite sent successfully' });
  } catch (e) {
    setMessage({ type: 'error', text: 'Error sending invite: ' + e.message });
  } finally {
    setSendingInvite(false);
  }
}
```

- [ ] **Step 2: Add invite UI to the user detail panel**

Add these buttons in the user actions section (near the Archive + Delete buttons):
```jsx
<button
  onClick={handleSendInvite}
  disabled={sendingInvite}
  style={{ ...btnSecondary, color: inviteStatus.accepted ? '#22c55e' : '#f59e0b', borderColor: inviteStatus.accepted ? '#22c55e' : '#f59e0b' }}
>
  {sendingInvite ? 'Sending...' : inviteStatus.accepted ? '✓ Accepted' : inviteStatus.invited ? 'Resend Invite' : 'Send Invite'}
</button>
```

The button shows:
- "Send Invite" (amber) if never invited
- "Resend Invite" (amber) if invited but not accepted
- "✓ Accepted" (green) if accepted
- "Sending..." while the request is in flight

- [ ] **Step 3: Verify syntax**

```bash
node -c web-admin/src/pages/UsersPage.jsx
```

---

### Task 6: Verify and rebuild

**Files:**
- All the above

- [ ] **Step 1: Verify backend compiles**

```bash
cd /home/aiagent/simplyclik-app/server && python -m py_compile asset_service/invite_routes.py fastapi_app.py
```

- [ ] **Step 2: Rebuild admin frontend**

```bash
cd /home/aiagent/simplyclik-app/web-admin && rm -rf build node_modules/.vite && node_modules/.bin/vite build
```

- [ ] **Step 3: Restart admin server**

```bash
kill $(ps aux | grep "uvicorn.*3001" | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 1
cd /home/aiagent/simplyclik-app/server && nohup /home/aiagent/mission-control-site/venv/bin/python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 3001 --forwarded-allow-ips=* > /tmp/simplyclik-admin.log 2>&1 &
```

- [ ] **Step 4: Test the full flow**

```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"email":"admin@simplyclik.local","password":"Temp123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
# Send invite to a user
curl -s -X POST "http://localhost:3001/api/invite/8fcae71d-7ad2-4229-aad1-a18797df3263" -H "Authorization: Bearer $TOKEN"
# The email won't send without SMTP config, but the token will be created
# Check invite status
curl -s "http://localhost:3001/api/invite/status/8fcae71d-7ad2-4229-aad1-a18797df3263" -H "Authorization: Bearer $TOKEN"
# Manually get token (from DB) and test accept
PGPASSWORD=... psql -h ... -c "SELECT token FROM invite_tokens WHERE user_id='8fcae71d-7ad2-4229-aad1-a18797df3267' ORDER BY created_at DESC LIMIT 1" 2>/dev/null || echo "Test accept manually via curl after getting token"
```

---

### Task 7: Configure SMTP (admin setup)

- [ ] **Step 1: Update `.env` with SMTP settings**

The user should add to `/home/aiagent/simplyclik-app/server/.env`:
```env
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
SMTP_FROM=noreply@simplyclik.com
```

- [ ] **Step 2: Restart server after .env update**

```bash
kill $(ps aux | grep "uvicorn.*3001" | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 1
cd /home/aiagent/simplyclik-app/server && nohup /home/aiagent/mission-control-site/venv/bin/python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 3001 --forwarded-allow-ips=* > /tmp/simplyclik-admin.log 2>&1 &
```
