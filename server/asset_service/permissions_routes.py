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
                cur.execute("SELECT email FROM auth.users WHERE id = %s::uuid", (user_id,))
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
            FROM auth.users u
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
            SELECT up.role, up.archived, p.contact_name, p.contact_phone_number, p.contact_email,
                   p.company_name, p.customer_id, p.address_line1, p.address_line2, p.city, p.state, p.postcode
            FROM public.user_profiles up
            LEFT JOIN public.profiles p ON p.user_id = up.user_id
            WHERE up.user_id = %s::uuid
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"user_id": user_id, "role": None, "archived": False, "contact_name": None,
                    "contact_phone": None, "contact_email": None, "company_name": None,
                    "customer_id": None, "address_line1": None, "address_line2": None,
                    "city": None, "state": None, "postcode": None}
        return {
            "user_id": user_id,
            "role": row[0],
            "archived": row[1] or False,
            "contact_name": row[2],
            "contact_phone": row[3],
            "contact_email": row[4],
            "company_name": row[5],
            "customer_id": str(row[6]) if row[6] else None,
            "address_line1": row[7],
            "address_line2": row[8],
            "city": row[9],
            "state": row[10],
            "postcode": row[11],
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
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO public.profiles (user_id, profile_type, contact_name, contact_phone_number,
                contact_email, address_line1, address_line2, city, state, postcode)
            VALUES (%s::uuid, 'user', %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                contact_name = COALESCE(%s, profiles.contact_name),
                contact_phone_number = COALESCE(%s, profiles.contact_phone_number),
                contact_email = COALESCE(%s, profiles.contact_email),
                address_line1 = COALESCE(%s, profiles.address_line1),
                address_line2 = COALESCE(%s, profiles.address_line2),
                city = COALESCE(%s, profiles.city),
                state = COALESCE(%s, profiles.state),
                postcode = COALESCE(%s, profiles.postcode)
        """, (user_id, contact_name, contact_phone, contact_email,
              address_line1, address_line2, city, state, postcode,
              contact_name, contact_phone, contact_email,
              address_line1, address_line2, city, state, postcode))
        conn.commit()
        cur.close()
        return {"ok": True}
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
