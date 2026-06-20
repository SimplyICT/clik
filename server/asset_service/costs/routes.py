from fastapi import APIRouter, Depends, HTTPException, Header, Query
from . import db, models
from asset_service.permissions import require_permission

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
        from asset_service.db import get_asset
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        return db.list_costs(conn, asset_id, limit=limit, offset=offset)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list costs: {str(e)}")
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/costs", status_code=201)
async def record_cost(
    asset_id: str,
    body: models.CostRecord,
    session: dict = Depends(require_permission("assets", "edit")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        from asset_service.db import get_asset
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        data = body.model_dump()
        data["asset_id"] = asset_id
        if not data.get("cost_type"):
            raise HTTPException(400, detail="cost_type is required")
        if data.get("amount") is None:
            raise HTTPException(400, detail="amount is required")
        cost = db.record_cost(conn, data, session.get("uid"))
        conn.commit()
        return cost
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to record cost: {str(e)}")
    finally:
        conn.close()


@router.get("/api/asset-management/costs/summary")
async def get_cost_summary(session: dict = Depends(require_permission("assets", "view"))):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_cost_summary(conn)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to get cost summary: {str(e)}")
    finally:
        conn.close()
