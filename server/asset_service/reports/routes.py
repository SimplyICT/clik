import csv
import io

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import Response

from . import db

router = APIRouter(tags=["asset-management-reports"])


async def require_session(authorization: str | None = Header(None)):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)


@router.get("/api/asset-management/reports/dashboard")
async def dashboard(session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_dashboard_kpis(conn)
    finally:
        conn.close()


@router.get("/api/asset-management/reports/warranty")
async def warranty_report(
    days: int = Query(30, ge=1, le=365),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_warranty_report(conn, days)
    finally:
        conn.close()


@router.get("/api/asset-management/reports/maintenance-overdue")
async def maintenance_overdue(session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_maintenance_overdue(conn)
    finally:
        conn.close()


def _to_csv(rows, fieldnames):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


EXPORT_FIELDS = {
    "assets": {
        "fn": db.export_assets_csv,
        "fields": [
            "id", "asset_name", "asset_code", "category", "status", "criticality",
            "manufacturer", "model", "serial_number", "location_name", "contractor_name",
            "purchase_cost", "replacement_value", "created_at",
        ],
        "filename": "assets-export.csv",
    },
    "work_orders": {
        "fn": db.export_work_orders_csv,
        "fields": [
            "id", "asset_id", "type", "title", "description", "priority", "status",
            "assigned_contractor_id", "scheduled_date", "completed_date",
            "labor_hours", "labor_cost", "parts_cost", "total_cost", "notes", "created_at",
        ],
        "filename": "work-orders-export.csv",
    },
    "costs": {
        "fn": db.export_costs_csv,
        "fields": [
            "id", "asset_id", "cost_type", "amount", "description", "recorded_date", "created_at",
        ],
        "filename": "costs-export.csv",
    },
}


@router.get("/api/asset-management/reports/export")
async def export_report(
    type: str = Query(..., pattern="^(assets|work_orders|costs)$"),
    session: dict = Depends(require_session),
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        cfg = EXPORT_FIELDS[type]
        rows = cfg["fn"](conn)
        csv_str = _to_csv(rows, cfg["fields"])
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename={cfg["filename"]}'},
        )
    finally:
        conn.close()
