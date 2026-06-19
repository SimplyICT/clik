from fastapi import APIRouter, Depends, HTTPException, Header, Query
from . import db, models

router = APIRouter(tags=["asset-management-documents"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/assets/{asset_id}/documents")
async def list_documents(
    asset_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_documents(conn, asset_id, limit=limit, offset=offset)
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/documents", status_code=201)
async def upload_document(
    asset_id: str,
    body: models.DocumentCreate,
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        data["asset_id"] = asset_id
        doc = db.create_document(conn, data, session.get("uid"))
        conn.commit()
        return doc
    finally:
        conn.close()


@router.delete("/api/asset-management/documents/{doc_id}")
async def delete_document_route(doc_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete documents")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        db.delete_document(conn, doc_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
