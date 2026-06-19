import sys, os, uuid
from datetime import datetime, timedelta, date
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pg8000


def _ensure_tables():
    host = os.environ.get("SUPABASE_DB_HOST") or os.environ["DB_HOST"]
    port = os.environ.get("SUPABASE_DB_PORT") or os.environ["DB_PORT"]
    dbname = os.environ.get("SUPABASE_DB_NAME") or os.environ["DB_NAME"]
    user = os.environ.get("SUPABASE_DB_USER") or os.environ["DB_USER"]
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ["DB_PASSWORD"]
    conn = pg8000.connect(
        host=host, port=int(port),
        database=dbname, user=user,
        password=password, ssl_context=True,
    )
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS assets_v2 (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_name TEXT NOT NULL,
            asset_code TEXT NOT NULL UNIQUE,
            qr_code TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL DEFAULT 'Other',
            sub_category TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            lifecycle_status TEXT NOT NULL DEFAULT 'active',
            criticality TEXT NOT NULL DEFAULT 'Medium',
            manufacturer TEXT,
            model TEXT,
            serial_number TEXT,
            customer_id UUID,
            customer_location_id UUID,
            assigned_contractor_id UUID,
            parent_asset_id UUID,
            install_date DATE,
            purchase_date DATE,
            warranty_expiry_date DATE,
            last_service_date DATE,
            next_service_date DATE,
            photo_urls TEXT[] DEFAULT '{}',
            custom_fields JSONB DEFAULT '{}',
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID,
            purchase_cost DECIMAL(12,2),
            replacement_value DECIMAL(12,2),
            location_name TEXT,
            contractor_name TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_work_orders (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            schedule_id UUID,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT NOT NULL DEFAULT 'medium',
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_contractor_id UUID,
            scheduled_date DATE,
            completed_date DATE,
            completed_by UUID,
            labor_hours DECIMAL(6,2),
            labor_cost DECIMAL(10,2),
            parts_cost DECIMAL(10,2) DEFAULT 0,
            total_cost DECIMAL(10,2),
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_maintenance_schedules (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            frequency_type TEXT NOT NULL,
            frequency_value INTEGER NOT NULL,
            last_completed TIMESTAMPTZ,
            next_due TIMESTAMPTZ,
            assigned_contractor_id UUID,
            auto_create_work_order BOOLEAN DEFAULT FALSE,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_cost_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            cost_type TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            recorded_date DATE NOT NULL,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12,2)")
    cur.execute("ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS replacement_value DECIMAL(12,2)")
    cur.execute("ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS location_name TEXT")
    cur.execute("ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS contractor_name TEXT")
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── DB operation tests ────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn, overrides=None):
    from asset_service import db as asset_db
    unique_code = f"REP-TEST-{uuid.uuid4().hex[:8].upper()}"
    data = {
        "asset_name": "Report Test Asset",
        "asset_code": unique_code,
        "category": "Test",
        "status": "Active",
    }
    if overrides:
        data.update(overrides)
    asset = asset_db.create_asset(conn, data)
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_cost_history WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_maintenance_schedules WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_work_orders WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


# ── get_dashboard_kpis ────────────────────────────────────────────────────

def test_db_dashboard_kpis_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        kpis = rpt_db.get_dashboard_kpis(conn)
        assert isinstance(kpis, dict)
        assert isinstance(kpis["total_assets"], int)
        assert isinstance(kpis["active_assets"], int)
        assert isinstance(kpis["assets_by_status"], list)
        assert isinstance(kpis["assets_by_category"], list)
        assert isinstance(kpis["active_work_orders"], int)
        assert isinstance(kpis["overdue_maintenance"], int)
        assert isinstance(kpis["warranty_expiring_soon"], int)
        assert isinstance(kpis["total_costs"], (int, float))
        for s in kpis["assets_by_status"]:
            assert "status" in s and "count" in s
        for c in kpis["assets_by_category"]:
            assert "category" in c and "count" in c
    finally:
        conn.close()


def test_db_dashboard_kpis_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn, {"category": "HVAC"})
        aid = asset["id"]

        cur = conn.cursor()
        cur.execute(
            "UPDATE assets_v2 SET purchase_cost = %s, location_name = %s WHERE id = %s::uuid",
            (5000.00, "Site A", aid),
        )
        cur.close()

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_work_orders (id, asset_id, type, title, status) VALUES (%s::uuid, %s::uuid, %s, %s, %s)",
            (str(uuid.uuid4()), aid, "corrective", "Fix pump", "in_progress"),
        )
        cur.close()

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_maintenance_schedules (id, asset_id, title, frequency_type, frequency_value, next_due) VALUES (%s::uuid, %s::uuid, %s, %s, %s, NOW() - interval '1 day')",
            (str(uuid.uuid4()), aid, "Overdue check", "daily", 1,),
        )
        cur.close()

        cur = conn.cursor()
        cur.execute(
            "UPDATE assets_v2 SET warranty_expiry_date = CURRENT_DATE + interval '15 days' WHERE id = %s::uuid",
            (aid,),
        )
        cur.close()

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_cost_history (id, asset_id, cost_type, amount, recorded_date) VALUES (%s::uuid, %s::uuid, %s, %s, %s)",
            (str(uuid.uuid4()), aid, "repair", 250.00, date.today()),
        )
        cur.close()

        conn.commit()

        kpis = rpt_db.get_dashboard_kpis(conn)
        assert kpis["total_assets"] >= 1
        assert kpis["active_assets"] >= 1
        assert any(s["status"] == "Active" for s in kpis["assets_by_status"])
        assert any(c["category"] == "HVAC" for c in kpis["assets_by_category"])
        assert kpis["active_work_orders"] >= 1
        assert kpis["overdue_maintenance"] >= 1
        assert kpis["warranty_expiring_soon"] >= 1
        assert kpis["total_costs"] >= 250.00
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])

        conn.close()


# ── get_warranty_report ───────────────────────────────────────────────────

def test_db_warranty_report_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        result = rpt_db.get_warranty_report(conn)
        assert isinstance(result, list)
    finally:
        conn.close()


def test_db_warranty_report_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn, {"category": "HVAC"})
        aid = asset["id"]

        cur = conn.cursor()
        cur.execute(
            "UPDATE assets_v2 SET warranty_expiry_date = CURRENT_DATE + interval '10 days', manufacturer = %s, model = %s, serial_number = %s WHERE id = %s::uuid",
            ("Acme", "X100", "SN-001", aid),
        )
        cur.close()
        conn.commit()

        result = rpt_db.get_warranty_report(conn, days=30)
        assert len(result) >= 1
        row = next(r for r in result if r["id"] == aid)
        assert row["asset_name"] == "Report Test Asset"
        assert row["manufacturer"] == "Acme"
        assert row["model"] == "X100"
        assert row["serial_number"] == "SN-001"
        assert row["warranty_expiry_date"] is not None
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_warranty_report_outside_window():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        aid = asset["id"]

        cur = conn.cursor()
        cur.execute(
            "UPDATE assets_v2 SET warranty_expiry_date = CURRENT_DATE + interval '60 days' WHERE id = %s::uuid",
            (aid,),
        )
        cur.close()
        conn.commit()

        result = rpt_db.get_warranty_report(conn, days=30)
        ids = [r["id"] for r in result]
        assert aid not in ids
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── get_maintenance_overdue ───────────────────────────────────────────────

def test_db_maintenance_overdue_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        result = rpt_db.get_maintenance_overdue(conn)
        assert result == []
    finally:
        conn.close()


def test_db_maintenance_overdue_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        aid = asset["id"]
        sched_id = str(uuid.uuid4())

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_maintenance_schedules (id, asset_id, title, frequency_type, frequency_value, next_due) VALUES (%s::uuid, %s::uuid, %s, %s, %s, NOW() - interval '2 days')",
            (sched_id, aid, "Past due check", "daily", 1),
        )
        cur.close()
        conn.commit()

        result = rpt_db.get_maintenance_overdue(conn)
        ids = [r["id"] for r in result]
        assert sched_id in ids
        row = next(r for r in result if r["id"] == sched_id)
        assert row["asset_name"] == "Report Test Asset"
        assert row["title"] == "Past due check"
        assert row["next_due"] is not None
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_maintenance_not_overdue():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        aid = asset["id"]
        sched_id = str(uuid.uuid4())

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_maintenance_schedules (id, asset_id, title, frequency_type, frequency_value, next_due) VALUES (%s::uuid, %s::uuid, %s, %s, %s, NOW() + interval '10 days')",
            (sched_id, aid, "Future check", "monthly", 1),
        )
        cur.close()
        conn.commit()

        result = rpt_db.get_maintenance_overdue(conn)
        ids = [r["id"] for r in result]
        assert sched_id not in ids
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── export_assets_csv ─────────────────────────────────────────────────────

def test_db_export_assets_csv_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        result = rpt_db.export_assets_csv(conn)
        assert isinstance(result, list)
    finally:
        conn.close()


def test_db_export_assets_csv_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn, {"category": "HVAC"})
        aid = asset["id"]
        cur = conn.cursor()
        cur.execute(
            "UPDATE assets_v2 SET manufacturer = %s, model = %s, serial_number = %s, purchase_cost = %s, location_name = %s, contractor_name = %s WHERE id = %s::uuid",
            ("Acme", "X100", "SN-001", 5000.00, "Site A", "ABC Contracting", aid),
        )
        cur.close()
        conn.commit()

        result = rpt_db.export_assets_csv(conn)
        assert len(result) >= 1
        row = next(r for r in result if r["id"] == aid)
        assert row["asset_name"] == "Report Test Asset"
        assert row["category"] == "HVAC"
        assert row["manufacturer"] == "Acme"
        assert row["model"] == "X100"
        assert row["serial_number"] == "SN-001"
        assert row["purchase_cost"] == 5000.00
        assert row["location_name"] == "Site A"
        assert row["contractor_name"] == "ABC Contracting"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── export_work_orders_csv ────────────────────────────────────────────────

def test_db_export_work_orders_csv_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        result = rpt_db.export_work_orders_csv(conn)
        assert isinstance(result, list)
    finally:
        conn.close()


def test_db_export_work_orders_csv_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        aid = asset["id"]
        wo_id = str(uuid.uuid4())

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_work_orders (id, asset_id, type, title, description, priority, status, total_cost) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s)",
            (wo_id, aid, "corrective", "Fix pump", "Repair the pump", "high", "completed", 1500.00),
        )
        cur.close()
        conn.commit()

        result = rpt_db.export_work_orders_csv(conn)
        assert len(result) >= 1
        row = next(r for r in result if r["id"] == wo_id)
        assert row["type"] == "corrective"
        assert row["title"] == "Fix pump"
        assert row["description"] == "Repair the pump"
        assert row["priority"] == "high"
        assert row["status"] == "completed"
        assert row["total_cost"] == 1500.00
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── export_costs_csv ──────────────────────────────────────────────────────

def test_db_export_costs_csv_empty():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    try:
        result = rpt_db.export_costs_csv(conn)
        assert isinstance(result, list)
    finally:
        conn.close()


def test_db_export_costs_csv_with_data():
    from asset_service.reports import db as rpt_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        aid = asset["id"]
        cost_id = str(uuid.uuid4())

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO asset_cost_history (id, asset_id, cost_type, amount, description, recorded_date) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)",
            (cost_id, aid, "repair", 1200.00, "Major repair", date.today()),
        )
        cur.close()
        conn.commit()

        result = rpt_db.export_costs_csv(conn)
        assert len(result) >= 1
        row = next(r for r in result if r["id"] == cost_id)
        assert row["cost_type"] == "repair"
        assert row["amount"] == 1200.00
        assert row["description"] == "Major repair"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── API endpoint tests ────────────────────────────────────────────────────

from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


def test_api_dashboard_requires_auth():
    resp = client.get("/api/asset-management/reports/dashboard")
    assert resp.status_code == 401


def test_api_dashboard_returns_kpis():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_assets" in data
    assert "active_assets" in data
    assert "assets_by_status" in data
    assert "assets_by_category" in data
    assert "active_work_orders" in data
    assert "overdue_maintenance" in data
    assert "warranty_expiring_soon" in data
    assert "total_costs" in data


def test_api_warranty_requires_auth():
    resp = client.get("/api/asset-management/reports/warranty")
    assert resp.status_code == 401


def test_api_warranty_default():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/warranty",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_warranty_with_days():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/warranty?days=60",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_maintenance_overdue_requires_auth():
    resp = client.get("/api/asset-management/reports/maintenance-overdue")
    assert resp.status_code == 401


def test_api_maintenance_overdue():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/maintenance-overdue",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_export_requires_auth():
    resp = client.get("/api/asset-management/reports/export?type=assets")
    assert resp.status_code == 401


def test_api_export_assets():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/export?type=assets",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in resp.headers["content-disposition"]


def test_api_export_work_orders():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/export?type=work_orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")


def test_api_export_costs():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/export?type=costs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")


def test_api_export_invalid_type():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/export?type=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_api_export_missing_type():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/export",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
