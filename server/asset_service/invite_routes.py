import os
import secrets
import io
import base64
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
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


@router.get("/api/invite/{user_id}/qr")
async def get_invite_qr(user_id: str, session: dict = Depends(require_admin)):
    """Return a QR code SVG for the user's latest invite link."""
    from asset_service.db import get_conn
    base_url = os.environ.get("APP_URL", "https://pwa.simplyclik.com")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT token FROM invite_tokens
            WHERE user_id = %s::uuid AND used_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            raise HTTPException(404, detail="No active invite token found for this user")
        token = row[0]
        invite_url = f"{base_url}/invite/{token}"
        qr = qrcode.make(invite_url)
        buf = io.BytesIO()
        qr.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")
    except HTTPException:
        raise
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
        # Generate QR code for the invite link
        qr_buf = io.BytesIO()
        qrcode.make(invite_url).save(qr_buf, format="PNG")
        qr_b64 = base64.b64encode(qr_buf.getvalue()).decode()
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;padding:40px 20px">
<div style="max-width:400px;margin:0 auto;background:#16213e;border-radius:12px;padding:32px;text-align:center">
<h1 style="color:#fff;font-size:20px;margin:0 0 8px">You're invited!</h1>
<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px">
  You've been invited to join <strong style="color:#fff">SimplyClik</strong>.
  Open this link on your phone to get started.
</p>
<a href="{invite_url}" style="display:inline-block;background:#00d4ff;color:#000;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:20px">
  Open Invite
</a>
<div style="background:#0f3460;border-radius:8px;padding:16px;margin-bottom:16px">
  <p style="color:#94a3b8;font-size:12px;margin:0 0 8px">Or scan this QR code with your phone camera:</p>
  <img src="data:image/png;base64,{qr_b64}" width="200" height="200" style="display:block;margin:0 auto;border-radius:8px" />
</div>
<p style="color:#94a3b8;font-size:12px;margin:0">On iPhone/iPad, open in Safari for the best experience.<br>This link expires in 7 days.</p>
</div>
</body>
</html>"""
        send_email(
            to=email,
            subject="You're invited to SimplyClik",
            body=f"Hi there,\n\nYou've been invited to join SimplyClik. Open this link on your phone to get started:\n\n{invite_url}\n\nOn iPhone/iPad, open in Safari for the best experience.\nThis link expires in 7 days.\n\nSimplyClik Team",
            html=html_body
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/auth/cookie")
async def auth_from_cookie(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, detail="No session cookie")
    from fastapi_app import validate_session
    session = validate_session(token)
    if not session:
        raise HTTPException(401, detail="Invalid session")
    uid = session.get("uid")
    from asset_service.permissions import get_user_permissions
    perms = get_user_permissions(uid)
    # Also fetch profile data
    from asset_service.db import get_conn as gconn
    conn = gconn()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.customer_id, p.id, p.company_name
        FROM public.profiles p
        WHERE p.user_id = %s::uuid LIMIT 1
    """, (uid,))
    prow = cur.fetchone()
    cur.close()
    conn.close()
    customer_id = str(prow[0]) if prow and prow[0] else None
    author_profile_id = str(prow[1]) if prow and prow[1] else None
    customer_name = prow[2] if prow and prow[2] else None
    role = None
    if uid:
        from asset_service.db import get_conn as gconn2
        conn2 = gconn2()
        c2 = conn2.cursor()
        c2.execute("SELECT role FROM public.user_profiles WHERE user_id = %s::uuid", (uid,))
        rrow = c2.fetchone()
        role = rrow[0] if rrow else None
        c2.close()
        conn2.close()
    return {
        "ok": True, "token": token,
        "user": {"id": uid, "email": session.get("email"), "uid": uid},
        "permissions": perms or {},
        "author_profile_id": author_profile_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "role": role or "user",
    }

@router.get("/api/invite/accept/{token}")
async def accept_invite(token: str):
    from asset_service.db import get_conn as gconn
    from fastapi_app import create_session
    from asset_service.permissions import get_user_permissions
    conn = gconn()
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

        # Fetch profile data like login does
        conn2 = gconn()
        cur2 = conn2.cursor()
        cur2.execute("""
            SELECT p.customer_id, p.id, p.company_name
            FROM public.profiles p
            WHERE p.user_id = %s::uuid LIMIT 1
        """, (str(uid),))
        profile_row = cur2.fetchone()
        customer_id = str(profile_row[0]) if profile_row and profile_row[0] else None
        author_profile_id = str(profile_row[1]) if profile_row and profile_row[1] else None
        customer_name = profile_row[2] if profile_row and profile_row[2] else None
        if customer_id and not customer_name:
            cur2.execute("SELECT name FROM public.customers WHERE id = %s", (customer_id,))
            c_row = cur2.fetchone()
            if c_row:
                customer_name = c_row[0]
        cur2.close()
        conn2.close()

        # Fetch permissions
        perms = get_user_permissions(str(uid))

        session_data = {
            "uid": str(uid), "email": email, "mode": "mobile",
            "customer_ref": customer_ref,
        }
        session_token = create_session(session_data)
        resp = JSONResponse({
            "ok": True,
            "token": session_token,
            "user": {"id": str(uid), "email": email, "uid": str(uid)},
            "permissions": perms or {},
            "author_profile_id": author_profile_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_ref": customer_ref,
            "role": role or "user",
        })
        resp.set_cookie(key="session", value=session_token, max_age=2592000, httponly=True, samesite="lax", path="/")
        return resp
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()
