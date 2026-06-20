from fastapi import APIRouter, Depends, HTTPException, Query, Header
from . import db, models
from asset_service.permissions import require_permission

router = APIRouter(tags=["asset-management-maintenance"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/maintenance")
async def list_schedules(
    asset_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_permission("assets", "view")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_schedules(conn, asset_id, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list maintenance schedules: {str(e)}")
    finally:
        conn.close()


@router.get("/api/asset-management/maintenance/{schedule_id}")
async def get_schedule(schedule_id: str, session: dict = Depends(require_permission("assets", "view"))):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        sched = db.get_schedule(conn, schedule_id)
        if not sched:
            raise HTTPException(404, detail="Schedule not found")
        return sched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to get schedule: {str(e)}")
    finally:
        conn.close()


@router.post("/api/asset-management/maintenance", status_code=201)
async def create_schedule(
    body: models.MaintenanceScheduleCreate,
    session: dict = Depends(require_permission("assets", "edit")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        if not data.get("asset_id"):
            raise HTTPException(400, detail="asset_id is required")
        if not data.get("title"):
            raise HTTPException(400, detail="title is required")
        sched = db.create_schedule(conn, data, session.get("uid"))
        conn.commit()
        return sched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to create schedule: {str(e)}")
    finally:
        conn.close()


@router.patch("/api/asset-management/maintenance/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: models.MaintenanceScheduleUpdate,
    session: dict = Depends(require_permission("assets", "edit")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        existing = db.get_schedule(conn, schedule_id)
        if not existing:
            raise HTTPException(404, detail="Schedule not found")
        data = body.model_dump(exclude_unset=True)
        sched = db.update_schedule(conn, schedule_id, data)
        conn.commit()
        return sched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to update schedule: {str(e)}")
    finally:
        conn.close()


@router.post("/api/asset-management/maintenance/{schedule_id}/complete")
async def complete_schedule(schedule_id: str, session: dict = Depends(require_permission("assets", "edit"))):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        sched = db.complete_schedule(conn, schedule_id)
        if not sched:
            raise HTTPException(404, detail="Schedule not found")
        conn.commit()
        return sched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to complete schedule: {str(e)}")
    finally:
        conn.close()


@router.delete("/api/asset-management/maintenance/{schedule_id}")
async def delete_schedule(schedule_id: str, session: dict = Depends(require_permission("assets", "edit"))):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        existing = db.get_schedule(conn, schedule_id)
        if not existing:
            raise HTTPException(404, detail="Schedule not found")
        db.delete_schedule(conn, schedule_id)
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to delete schedule: {str(e)}")
    finally:
        conn.close()
