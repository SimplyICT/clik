from fastapi import APIRouter, Depends, HTTPException, Header, Query
from . import db, models
from asset_service.permissions import require_permission

router = APIRouter(tags=["asset-management-documents"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/assets/{asset_id}/documents")
async def list_documents(
    asset_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: dict = Depends(require_permission("assets", "view")),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        from asset_service.db import get_asset
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        return db.list_documents(conn, asset_id, limit=limit, offset=offset)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to list documents: {str(e)}")
    finally:
        conn.close()


@router.post("/api/asset-management/assets/{asset_id}/documents", status_code=201)
async def upload_document(
    asset_id: str,
    body: models.DocumentCreate,
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
        if not data.get("file_url"):
            raise HTTPException(400, detail="file_url is required")
        doc = db.create_document(conn, data, session.get("uid"))
        conn.commit()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to upload document: {str(e)}")
    finally:
        conn.close()


@router.delete("/api/asset-management/documents/{doc_id}")
async def delete_document_route(doc_id: str, session: dict = Depends(require_permission("assets", "edit"))):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        doc = db.get_document(conn, doc_id)
        if not doc:
            raise HTTPException(404, detail="Document not found")
        db.delete_document(conn, doc_id)
        conn.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to delete document: {str(e)}")
    finally:
        conn.close()
