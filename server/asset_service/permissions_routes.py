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
    pushover_user_key = (body.get("pushover_user_key") or "").strip()
    if not email or not password:
        raise HTTPException(400, detail="Email and password required")
    if len(password) < 6:
        raise HTTPException(400, detail="Password must be at least 6 characters")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(409, detail="User with this email already exists")
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        uid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO users (id, email, password_hash, is_active, created_at, updated_at) VALUES (%s::uuid, %s, %s, true, NOW(), NOW())",
            (uid, email, pw_hash)
        )
        cur.execute(
            "INSERT INTO public.user_profiles (user_id, role, pushover_user_key) VALUES (%s::uuid, %s, %s) ON CONFLICT (user_id) DO UPDATE SET role = %s, pushover_user_key = %s",
            (uid, role, pushover_user_key, role, pushover_user_key)
        )
        # Auto-create profiles entry for contractors so they appear in Contractors page
        if role == "contractor":
            profile_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO public.profiles (id, user_id, profile_type, company_name, contact_name, contact_email, contact_phone_number, service_contact_name, service_contact_email, address_json) VALUES (%s::uuid, %s::uuid, 'contractor', '', '', %s, '', '', '', '{}') ON CONFLICT (user_id) DO NOTHING",
                (profile_id, uid, email)
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
        cur.execute("DELETE FROM users WHERE id = %s::uuid", (user_id,))
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
    import uuid
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
        # Auto-create profiles entry if changing to contractor
        if role == "contractor":
            cur.execute("SELECT id FROM public.profiles WHERE user_id = %s::uuid", (user_id,))
            if not cur.fetchone():
                cur.execute("SELECT email FROM users WHERE id = %s::uuid", (user_id,))
                email_row = cur.fetchone()
                email = email_row[0] if email_row else ""
                profile_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO public.profiles (id, user_id, profile_type, company_name, contact_name, contact_email, contact_phone_number, service_contact_name, service_contact_email, address_json) VALUES (%s::uuid, %s::uuid, 'contractor', '', '', %s, '', '', '', '{}')",
                    (profile_id, user_id, email)
                )
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
            FROM users u
            LEFT JOIN public.user_profiles up ON up.user_id = u.id
            WHERE up.archived IS NOT TRUE OR up.archived IS NULL
            ORDER BY u.email ASC
        """)
        rows = cur.fetchall()
        cur.close()
        return [{"id": str(r[0]), "email": r[1], "role": r[2] or "user"} for r in rows]
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/users/{user_id}/profile")
async def get_user_profile(user_id: str, session: dict = Depends(require_admin)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT up.role, up.archived, up.pushover_user_key,
                   p.contact_name, p.contact_phone_number, p.contact_email,
                   p.company_name, p.customer_id, p.address_line1, p.address_line2, p.city, p.state, p.postcode
            FROM public.user_profiles up
            LEFT JOIN public.profiles p ON p.user_id = up.user_id
            WHERE up.user_id = %s::uuid
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"user_id": user_id, "role": None, "archived": False, "pushover_user_key": None,
                    "contact_name": None, "contact_phone": None, "contact_email": None,
                    "company_name": None, "customer_id": None, "address_line1": None,
                    "address_line2": None, "city": None, "state": None, "postcode": None}
        return {
            "user_id": user_id,
            "role": row[0],
            "archived": row[1] or False,
            "pushover_user_key": row[2],
            "contact_name": row[3],
            "contact_phone": row[4],
            "contact_email": row[5],
            "company_name": row[6],
            "customer_id": str(row[7]) if row[7] else None,
            "address_line1": row[8],
            "address_line2": row[9],
            "city": row[10],
            "state": row[11],
            "postcode": row[12],
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.put("/api/users/{user_id}/profile")
async def update_user_profile(user_id: str, body: dict, session: dict = Depends(require_admin)):
    contact_name = body.get("contact_name")
    contact_phone = body.get("contact_phone")
    contact_email = body.get("contact_email")
    address_line1 = body.get("address_line1")
    address_line2 = body.get("address_line2")
    city = body.get("city")
    state = body.get("state")
    postcode = body.get("postcode")
    pushover_user_key = (body.get("pushover_user_key") or "").strip()
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Only UPDATE existing profiles entry (don't INSERT — profile_type enum doesn't have 'user')
        cur.execute("""
            UPDATE public.profiles SET
                contact_name = COALESCE(%s, contact_name),
                contact_phone_number = COALESCE(%s, contact_phone_number),
                contact_email = COALESCE(%s, contact_email),
                address_line1 = COALESCE(%s, address_line1),
                address_line2 = COALESCE(%s, address_line2),
                city = COALESCE(%s, city),
                state = COALESCE(%s, state),
                postcode = COALESCE(%s, postcode)
            WHERE user_id = %s::uuid
        """, (contact_name, contact_phone, contact_email,
              address_line1, address_line2, city, state, postcode,
              user_id))
        # Update pushover_user_key on user_profiles if provided
        if pushover_user_key:
            cur.execute(
                "UPDATE public.user_profiles SET pushover_user_key = %s WHERE user_id = %s::uuid",
                (pushover_user_key, user_id)
            )
        conn.commit()
        cur.close()
        return {"ok": True, "pushover_user_key": pushover_user_key}
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()


@router.post("/api/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, body: dict, session: dict = Depends(require_admin)):
    password = body.get("password") or ""
    if len(password) < 6:
        raise HTTPException(400, detail="Password must be at least 6 characters")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s::uuid",
            (pw_hash, user_id)
        )
        if cur.rowcount == 0:
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


@router.post("/api/users/{user_id}/archive")
async def archive_user(user_id: str, session: dict = Depends(require_admin)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE public.user_profiles SET archived = true WHERE user_id = %s::uuid",
            (user_id,)
        )
        if cur.rowcount == 0:
            raise HTTPException(404, detail="User not found")
        conn.commit()
        cur.close()
        return {"ok": True, "archived": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, detail=str(e))
    finally:
        conn.close()
