from fastapi import Depends, HTTPException, Header
from typing import Literal
from asset_service.db import get_conn

RESOURCES = [
    "dashboard", "assets", "work_orders", "requests",
    "customers", "contractors", "locations", "activity", "users",
]

MANAGER_DEFAULTS = {
    "dashboard":   {"can_view": True,  "can_edit": True},
    "assets":      {"can_view": True,  "can_edit": True},
    "work_orders": {"can_view": True,  "can_edit": True},
    "requests":    {"can_view": True,  "can_edit": True},
    "customers":   {"can_view": True,  "can_edit": True},
    "contractors": {"can_view": True,  "can_edit": True},
    "locations":   {"can_view": True,  "can_edit": True},
    "activity":    {"can_view": True,  "can_edit": True},
    "users":       {"can_view": False, "can_edit": False},
}

ADMIN_PERMISSIONS = {r: {"can_view": True, "can_edit": True} for r in RESOURCES}


def has_permission(uid: str, resource: str, action: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT can_view, can_edit FROM user_permissions WHERE user_id = %s::uuid AND resource = %s",
            (uid, resource)
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return False
        return row[0] if action == "view" else row[1]
    finally:
        conn.close()


def get_user_permissions(uid: str) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT resource, can_view, can_edit FROM user_permissions WHERE user_id = %s::uuid",
            (uid,)
        )
        rows = cur.fetchall()
        cur.close()
        return {r: {"can_view": v, "can_edit": e} for r, v, e in rows}
    finally:
        conn.close()


def seed_manager_defaults(uid: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        for resource, perms in MANAGER_DEFAULTS.items():
            cur.execute(
                """INSERT INTO user_permissions (user_id, resource, can_view, can_edit)
                   VALUES (%s::uuid, %s, %s, %s)
                   ON CONFLICT (user_id, resource) DO NOTHING""",
                (uid, resource, perms["can_view"], perms["can_edit"])
            )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_user_permissions(uid: str, permissions: dict):
    conn = get_conn()
    try:
        cur = conn.cursor()
        for resource, perms in permissions.items():
            cur.execute(
                """INSERT INTO user_permissions (user_id, resource, can_view, can_edit)
                   VALUES (%s::uuid, %s, %s, %s)
                   ON CONFLICT (user_id, resource)
                   DO UPDATE SET can_view = %s, can_edit = %s""",
                (uid, resource, perms.get("can_view", False), perms.get("can_edit", False),
                 perms.get("can_view", False), perms.get("can_edit", False))
            )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


def require_permission(resource: str, action: Literal["view", "edit"]):
    async def _checker(session: dict = Depends(require_session)):
        if session.get("is_admin"):
            return session
        if not has_permission(session["uid"], resource, action):
            raise HTTPException(403, detail=f"No {action} access to {resource}")
        return session
    return _checker
