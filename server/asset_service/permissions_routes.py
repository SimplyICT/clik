import bcrypt
import uuid

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


@router.post("/api/users")
async def create_user(body: dict, session: dict = Depends(require_admin)):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = body.get("role") or "user"
    if not email or not password:
        raise HTTPException(400, detail="Email and password required")
    if len(password) < 6:
        raise HTTPException(400, detail="Password must be at least 6 characters")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(409, detail="User with this email already exists")
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        uid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (%s::uuid, %s, %s, NOW())",
            (uid, email, pw_hash)
        )
        cur.execute(
            "INSERT INTO public.user_profiles (user_id, role) VALUES (%s::uuid, %s) ON CONFLICT (user_id) DO UPDATE SET role = %s",
            (uid, role, role)
        )
        conn.commit()
        cur.close()
        return {"ok": True, "user_id": uid, "email": email, "role": role}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.delete("/api/users/{user_id}")
async def delete_user(user_id: str, session: dict = Depends(require_admin)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM user_permissions WHERE user_id = %s::uuid", (user_id,))
        cur.execute("DELETE FROM public.user_profiles WHERE user_id = %s::uuid", (user_id,))
        cur.execute("DELETE FROM public.profiles WHERE user_id = %s::uuid", (user_id,))
        cur.execute("DELETE FROM auth.users WHERE id = %s::uuid", (user_id,))
        if cur.rowcount == 0:
            conn.rollback()
            raise HTTPException(404, detail="User not found")
        conn.commit()
        cur.close()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.patch("/api/users/{user_id}")
async def update_user(user_id: str, body: dict, session: dict = Depends(require_admin)):
    role = body.get("role")
    if not role:
        raise HTTPException(400, detail="Role is required")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO public.user_profiles (user_id, role) VALUES (%s::uuid, %s) ON CONFLICT (user_id) DO UPDATE SET role = %s",
            (user_id, role, role)
        )
        if cur.rowcount == 0:
            raise HTTPException(404, detail="User not found")
        conn.commit()
        cur.close()
        return {"ok": True, "user_id": user_id, "role": role}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/users")
async def list_users(session: dict = Depends(require_admin)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.email, up.role
            FROM auth.users u
            LEFT JOIN public.user_profiles up ON up.user_id = u.id
            ORDER BY u.email ASC
        """)
        rows = cur.fetchall()
        cur.close()
        return [{"id": str(r[0]), "email": r[1], "role": r[2] or "user"} for r in rows]
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()
