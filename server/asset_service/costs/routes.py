from fastapi import APIRouter, Depends, HTTPException, Header, Query
from . import db, models

router = APIRouter(tags=["asset-management-costs"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/assets/{asset_id}/costs")
async def list_costs(
    asset_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_costs(conn, asset_id, limit=limit, offset=offset)
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/costs", status_code=201)
async def record_cost(
    asset_id: str,
    body: models.CostRecord,
    session: dict = Depends(require_session),
):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can record costs")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        data["asset_id"] = asset_id
        cost = db.record_cost(conn, data, session.get("uid"))
        conn.commit()
        return cost
    finally:
        conn.close()


@router.get("/api/asset-management/costs/summary")
async def get_cost_summary(session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can view cost summary")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_cost_summary(conn)
    finally:
        conn.close()
