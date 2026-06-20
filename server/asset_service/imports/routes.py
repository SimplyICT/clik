from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response

from .models import ImportRequest
from asset_service.permissions import require_permission

router = APIRouter(tags=["asset-management-imports"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


IMPORT_TEMPLATE = (
    "asset_name,asset_code,category,status,manufacturer,model,serial_number,"
    "purchase_cost,location_name,notes\n"
    "Example Asset,AST-001,HVAC,Active,Acme,X100,SN-001,5000.00,"
    "Site A,Sample import row\n"
)


@router.get("/api/asset-management/reports/import/template")
async def import_template(session: dict = Depends(require_permission("assets", "view"))):
    return Response(
        content=IMPORT_TEMPLATE,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=asset-import-template.csv"},
    )


@router.post("/api/asset-management/reports/import")
async def import_csv(
    body: ImportRequest,
    session: dict = Depends(require_permission("assets", "edit")),
):
    if not body.csv_content or not body.csv_content.strip():
        raise HTTPException(400, detail="CSV content is required")

    from . import db as import_db
    from asset_service.db import get_conn

    try:
        rows = import_db.parse_csv(body.csv_content)
    except Exception as e:
        raise HTTPException(400, detail=f"Failed to parse CSV: {str(e)}")

    if not rows:
        raise HTTPException(400, detail="CSV content is empty or invalid")

    conn = get_conn()
    try:
        result = import_db.import_assets(conn, rows, user_id=session.get("uid"))
        return result
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to import assets: {str(e)}")
    finally:
        conn.close()
