import os
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
    from notifications import send_email
    from asset_service.db import get_conn
    base_url = os.environ.get("APP_URL", "https://pwa.simplyclik.com")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT email FROM auth.users WHERE id = %s::uuid", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(404, detail="User not found")
        email = user_row[0]
        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO invite_tokens (user_id, token, created_by) VALUES (%s::uuid, %s, %s::uuid)",
            (user_id, token, session.get("uid"))
        )
        conn.commit()
        cur.close()
        invite_url = f"{base_url}/invite/{token}"
        send_email(
            to=email,
            subject="You're invited to SimplyClik",
            body=f"Hi there,\n\nYou've been invited to join SimplyClik. Open this link on your phone to get started:\n\n{invite_url}\n\nOn iPhone/iPad, open in Safari for the best experience.\nThis link expires in 7 days.\n\nSimplyClik Team"
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
        cur.execute("UPDATE invite_tokens SET used_at = NOW() WHERE token = %s", (token,))
        conn.commit()
        cur.close()
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
