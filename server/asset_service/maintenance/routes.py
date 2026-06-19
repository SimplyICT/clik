from fastapi import APIRouter, Depends, HTTPException, Query, Header
from . import db, models

router = APIRouter(tags=["asset-management-maintenance"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/maintenance")
async def list_schedules(
    asset_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_schedules(conn, asset_id, limit=limit, offset=offset)
    finally:
        conn.close()


@router.get("/api/asset-management/maintenance/{schedule_id}")
async def get_schedule(schedule_id: str, session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        sched = db.get_schedule(conn, schedule_id)
        if not sched:
            raise HTTPException(404, detail="Schedule not found")
        return sched
    finally:
        conn.close()


@router.post("/api/asset-management/maintenance", status_code=201)
async def create_schedule(
    body: models.MaintenanceScheduleCreate,
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        sched = db.create_schedule(conn, data, session.get("uid"))
        conn.commit()
        return sched
    finally:
        conn.close()


@router.patch("/api/asset-management/maintenance/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: models.MaintenanceScheduleUpdate,
    session: dict = Depends(require_session),
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
    finally:
        conn.close()


@router.delete("/api/asset-management/maintenance/{schedule_id}")
async def delete_schedule(schedule_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete maintenance schedules")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        db.delete_schedule(conn, schedule_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
