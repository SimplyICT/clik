import os
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import Response
from . import db, models, qr

router = APIRouter(tags=["asset-management"])
APP_URL = os.environ.get("APP_URL", "https://pwa.simplyclik.com")

async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/assets")
async def list_assets(
    category: str = Query(None),
    status: str = Query(None),
    customer_id: str = Query(None),
    contractor_id: str = Query(None),
    search: str = Query(None),
    session: dict = Depends(require_session),
):
    conn = db.get_conn()
    try:
        return db.list_assets(conn, {
            "category": category,
            "status": status,
            "customer_id": customer_id,
            "contractor_id": contractor_id,
            "search": search,
        })
    finally:
        conn.close()


@router.get("/api/asset-management/assets/{asset_id}")
async def get_asset(asset_id: str, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        asset = db.get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        return asset
    finally:
        conn.close()


@router.post("/api/asset-management/assets", status_code=201)
async def create_asset(body: models.AssetCreate, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        asset = db.create_asset(conn, body.model_dump(), session.get("uid"))
        conn.commit()
        return asset
    finally:
        conn.close()


@router.patch("/api/asset-management/assets/{asset_id}")
async def update_asset(asset_id: str, body: models.AssetUpdate, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(400, detail="No fields to update")
        asset = db.update_asset(conn, asset_id, data)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        conn.commit()
        return asset
    finally:
        conn.close()


@router.post("/api/asset-management/assets/bulk/status")
async def bulk_update_status(body: dict, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can perform bulk operations")
    conn = db.get_conn()
    try:
        result = db.bulk_update_status(conn, body["asset_ids"], body["status"], session.get("uid"))
        conn.commit()
        return result
    finally:
        conn.close()


@router.post("/api/asset-management/assets/bulk/transfer")
async def bulk_transfer(body: dict, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can perform bulk operations")
    conn = db.get_conn()
    try:
        result = db.bulk_transfer(conn, body["asset_ids"], body.get("customer_id"), body.get("location_id"), session.get("uid"))
        conn.commit()
        return result
    finally:
        conn.close()


@router.post("/api/asset-management/assets/bulk/assign")
async def bulk_assign(body: dict, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can perform bulk operations")
    conn = db.get_conn()
    try:
        result = db.bulk_assign_contractor(conn, body["asset_ids"], body.get("contractor_id"), session.get("uid"))
        conn.commit()
        return result
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/retire")
async def retire_asset(asset_id: str, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        asset = db.retire_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        conn.commit()
        return asset
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/transfer")
async def transfer_asset(asset_id: str, body: dict, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can transfer assets")
    conn = db.get_conn()
    try:
        asset = db.transfer_asset(conn, asset_id, body.get("customer_id"), body.get("location_id"))
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        conn.commit()
        return asset
    finally:
        conn.close()


@router.get("/api/asset-management/assets/{asset_id}/qr")
async def get_asset_qr(asset_id: str, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        asset = db.get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        qr_bytes = qr.generate_qr_bytes(asset_id, APP_URL)
        return Response(content=qr_bytes, media_type="image/png")
    finally:
        conn.close()


@router.get("/api/asset-management/assets/{asset_id}/jobs")
async def list_asset_jobs(asset_id: str, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        return db.list_asset_jobs(conn, asset_id)
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/create-job", status_code=201)
async def create_asset_job(asset_id: str, body: models.JobCreate, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        job = db.create_asset_job(conn, asset_id, body.model_dump(), session.get("uid"))
        conn.commit()
        return job
    finally:
        conn.close()


@router.get("/api/asset-management/parts")
async def list_parts(asset_id: str = Query(None), session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        return db.list_parts(conn, asset_id)
    finally:
        conn.close()


@router.post("/api/asset-management/parts", status_code=201)
async def create_part(body: models.PartCreate, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        part = db.create_part(conn, body.model_dump())
        conn.commit()
        return part
    finally:
        conn.close()


@router.patch("/api/asset-management/parts/{part_id}")
async def update_part(part_id: str, body: models.PartUpdate, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(400, detail="No fields to update")
        part = db.update_part(conn, part_id, data)
        if not part:
            raise HTTPException(404, detail="Part not found")
        conn.commit()
        return part
    finally:
        conn.close()


@router.delete("/api/asset-management/parts/{part_id}")
async def delete_part(part_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete parts")
    conn = db.get_conn()
    try:
        db.delete_part(conn, part_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/api/asset-management/parts/record-usage", status_code=201)
async def record_part_usage(body: models.PartUsageRecord, session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        usage = db.record_part_usage(conn, body.part_id, body.request_id, body.quantity, session.get("uid"))
        conn.commit()
        return usage
    finally:
        conn.close()


@router.get("/api/asset-management/custom-fields")
async def list_custom_fields(category: str = Query(None), session: dict = Depends(require_session)):
    conn = db.get_conn()
    try:
        return db.get_custom_field_defs(conn, category)
    finally:
        conn.close()


@router.post("/api/asset-management/custom-fields", status_code=201)
async def create_custom_field(body: models.CustomFieldDefCreate, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can create custom field definitions")
    conn = db.get_conn()
    try:
        field = db.create_custom_field_def(conn, body.model_dump())
        conn.commit()
        return field
    finally:
        conn.close()
