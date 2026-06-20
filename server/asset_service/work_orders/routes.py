from fastapi import APIRouter, Depends, HTTPException, Header, Query
from . import db, models

router = APIRouter(tags=["asset-management-work-orders"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/work-orders")
async def list_work_orders(
    asset_id: str = Query(None),
    status: str = Query(None),
    contractor_id: str = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_work_orders(conn, asset_id, status, contractor_id, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list work orders: {str(e)}")
    finally:
        conn.close()


@router.get("/api/asset-management/work-orders/{wo_id}")
async def get_work_order(wo_id: str, session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        wo = db.get_work_order(conn, wo_id)
        if not wo:
            raise HTTPException(404, detail="Work order not found")
        return wo
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to get work order: {str(e)}")
    finally:
        conn.close()


@router.post("/api/asset-management/work-orders", status_code=201)
async def create_work_order(
    body: models.WorkOrderCreate,
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        if not data.get("asset_id"):
            raise HTTPException(400, detail="asset_id is required")
        if not data.get("title"):
            raise HTTPException(400, detail="title is required")
        wo = db.create_work_order(conn, data, session.get("uid"))
        conn.commit()
        return wo
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to create work order: {str(e)}")
    finally:
        conn.close()


@router.patch("/api/asset-management/work-orders/{wo_id}")
async def update_work_order(
    wo_id: str,
    body: models.WorkOrderUpdate,
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        existing = db.get_work_order(conn, wo_id)
        if not existing:
            raise HTTPException(404, detail="Work order not found")
        data = body.model_dump(exclude_unset=True)
        wo = db.update_work_order(conn, wo_id, data)
        conn.commit()
        return wo
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to update work order: {str(e)}")
    finally:
        conn.close()


@router.delete("/api/asset-management/work-orders/{wo_id}")
async def delete_work_order_route(wo_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete work orders")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        existing = db.get_work_order(conn, wo_id)
        if not existing:
            raise HTTPException(404, detail="Work order not found")
        db.delete_work_order(conn, wo_id)
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to delete work order: {str(e)}")
    finally:
        conn.close()


@router.get("/api/asset-management/assets/{asset_id}/work-orders")
async def list_work_orders_by_asset(
    asset_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_work_orders(conn, asset_id=asset_id, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list work orders for asset: {str(e)}")
    finally:
        conn.close()
