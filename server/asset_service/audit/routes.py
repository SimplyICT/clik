from fastapi import APIRouter, Depends, HTTPException, Query, Header
from . import db
from asset_service.permissions import require_permission

router = APIRouter(tags=["asset-management-audit"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/audit")
async def list_audit_events(
    asset_id: str = Query(None),
    event_type: str = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_permission("assets", "view")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_events(conn, asset_id, event_type, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list audit events: {str(e)}")
    finally:
        conn.close()
