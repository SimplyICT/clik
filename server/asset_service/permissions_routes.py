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
