import sys, os, uuid
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
            created_by UUID
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
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── Model validation tests ────────────────────────────────────────────────


def test_create_model_valid():
    from asset_service.maintenance.models import MaintenanceScheduleCreate
    sched = MaintenanceScheduleCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        title="Monthly Filter Check",
        frequency_type="monthly",
        frequency_value=1,
    )
    assert sched.title == "Monthly Filter Check"
    assert sched.frequency_type == "monthly"
    assert sched.frequency_value == 1
    assert sched.description is None
    assert sched.assigned_contractor_id is None
    assert sched.auto_create_work_order is False


def test_create_model_with_all_fields():
    from asset_service.maintenance.models import MaintenanceScheduleCreate
    sched = MaintenanceScheduleCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        title="Quarterly Service",
        description="Full quarterly maintenance check",
        frequency_type="monthly",
        frequency_value=3,
        assigned_contractor_id="00000000-0000-0000-0000-000000000002",
        auto_create_work_order=True,
    )
    assert sched.description == "Full quarterly maintenance check"
    assert sched.assigned_contractor_id == "00000000-0000-0000-0000-000000000002"
    assert sched.auto_create_work_order is True


def test_create_model_missing_required():
    from asset_service.maintenance.models import MaintenanceScheduleCreate
    import pytest
    with pytest.raises(Exception):
        MaintenanceScheduleCreate(asset_id="00000000-0000-0000-0000-000000000001", title="Test")


def test_create_model_missing_title():
    from asset_service.maintenance.models import MaintenanceScheduleCreate
    import pytest
    with pytest.raises(Exception):
        MaintenanceScheduleCreate(asset_id="00000000-0000-0000-0000-000000000001", frequency_type="monthly", frequency_value=1)


def test_create_model_missing_frequency_value():
    from asset_service.maintenance.models import MaintenanceScheduleCreate
    import pytest
    with pytest.raises(Exception):
        MaintenanceScheduleCreate(asset_id="00000000-0000-0000-0000-000000000001", title="Test", frequency_type="monthly")


# ── DB operation tests ────────────────────────────────────────────────────


def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn):
    from asset_service import db as asset_db
    unique_code = f"MAINT-TEST-{uuid.uuid4().hex[:8].upper()}"
    asset = asset_db.create_asset(conn, {
        "asset_name": "Maint Test Asset",
        "asset_code": unique_code,
        "category": "Test",
    })
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_maintenance_schedules WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_db_create_schedule():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        sched = maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "Weekly Inspection",
            "description": "Weekly visual inspection",
            "frequency_type": "weekly",
            "frequency_value": 1,
            "auto_create_work_order": True,
        }, user_id=None)
        conn.commit()
        assert sched is not None
        assert sched["title"] == "Weekly Inspection"
        assert sched["description"] == "Weekly visual inspection"
        assert sched["frequency_type"] == "weekly"
        assert sched["frequency_value"] == 1
        assert sched["auto_create_work_order"] is True
        assert sched["asset_id"] == asset["id"]
        assert "id" in sched
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_schedule():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "Get Test Schedule",
            "frequency_type": "daily",
            "frequency_value": 1,
        })
        conn.commit()
        fetched = maint_db.get_schedule(conn, created["id"])
        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["title"] == "Get Test Schedule"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_schedule_not_found():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    try:
        result = maint_db.get_schedule(conn, "00000000-0000-0000-0000-000000000099")
        assert result is None
    finally:
        conn.close()


def test_db_list_schedules():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "List Test 1",
            "frequency_type": "monthly",
            "frequency_value": 1,
        })
        maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "List Test 2",
            "frequency_type": "yearly",
            "frequency_value": 1,
        })
        conn.commit()
        scheds = maint_db.list_schedules(conn)
        # Should find at least our two
        our = [s for s in scheds if s["asset_id"] == asset["id"]]
        assert len(our) == 2
        titles = {s["title"] for s in our}
        assert "List Test 1" in titles
        assert "List Test 2" in titles
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_schedules_empty():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        scheds = maint_db.list_schedules(conn, asset["id"])
        assert scheds == []
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_schedules_by_asset():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "Asset Specific",
            "frequency_type": "monthly",
            "frequency_value": 1,
        })
        conn.commit()
        scheds = maint_db.list_schedules(conn, asset["id"])
        assert len(scheds) == 1
        assert scheds[0]["title"] == "Asset Specific"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_update_schedule():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "Before Update",
            "frequency_type": "monthly",
            "frequency_value": 1,
        })
        conn.commit()
        updated = maint_db.update_schedule(conn, created["id"], {"title": "After Update", "frequency_value": 3})
        conn.commit()
        assert updated["title"] == "After Update"
        assert updated["frequency_value"] == 3
        fetched = maint_db.get_schedule(conn, created["id"])
        assert fetched["title"] == "After Update"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_delete_schedule():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = maint_db.create_schedule(conn, {
            "asset_id": asset["id"],
            "title": "Delete Me",
            "frequency_type": "daily",
            "frequency_value": 1,
        })
        conn.commit()
        maint_db.delete_schedule(conn, created["id"])
        conn.commit()
        fetched = maint_db.get_schedule(conn, created["id"])
        assert fetched is None
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_due_schedules():
    from asset_service.maintenance import db as maint_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        # Create a schedule with next_due in the past and auto_create_work_order=true
        sched_id = str(uuid.uuid4())
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO asset_maintenance_schedules (id, asset_id, title, frequency_type, frequency_value, next_due, auto_create_work_order)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s, NOW() - interval '1 day', TRUE)
        """, (sched_id, asset["id"], "Due Now", "daily", 1))
        cur.close()
        conn.commit()
        due = maint_db.get_due_schedules(conn)
        due_ids = {s["id"] for s in due}
        assert sched_id in due_ids
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


def _api_create_asset(token):
    unique_code = f"MAINT-API-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={"asset_name": "API Maint Test", "asset_code": unique_code, "category": "Test"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    return resp.json()


def _api_delete_asset(token, asset_id):
    conn = _get_test_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM asset_maintenance_schedules WHERE asset_id = %s::uuid", (asset_id,))
        cur.close()
        cur = conn.cursor()
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        cur.close()
        conn.commit()
    finally:
        conn.close()


def test_api_list_schedules():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        # Create a schedule
        client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "API List Test",
                "frequency_type": "monthly",
                "frequency_value": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(
            "/api/asset-management/maintenance",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        our = [s for s in data if s["asset_id"] == asset["id"]]
        assert len(our) >= 1
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_get_schedule():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "API Get Test",
                "frequency_type": "weekly",
                "frequency_value": 2,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201
        sched_id = create_resp.json()["id"]

        resp = client.get(
            f"/api/asset-management/maintenance/{sched_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "API Get Test"
        assert data["frequency_type"] == "weekly"
        assert data["frequency_value"] == 2
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_get_schedule_not_found():
    token = login_token()
    resp = client.get(
        "/api/asset-management/maintenance/00000000-0000-0000-0000-000000000099",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_api_create_schedule():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        resp = client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "API Create Test",
                "description": "Created via API",
                "frequency_type": "yearly",
                "frequency_value": 1,
                "auto_create_work_order": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "API Create Test"
        assert data["description"] == "Created via API"
        assert data["frequency_type"] == "yearly"
        assert data["frequency_value"] == 1
        assert data["auto_create_work_order"] is True
        assert data["asset_id"] == asset["id"]
        assert "id" in data
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_update_schedule():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "Before Update",
                "frequency_type": "daily",
                "frequency_value": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        sched_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/asset-management/maintenance/{sched_id}",
            json={"title": "After Update", "frequency_value": 2},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "After Update"
        assert data["frequency_value"] == 2
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_update_schedule_not_found():
    token = login_token()
    resp = client.patch(
        "/api/asset-management/maintenance/00000000-0000-0000-0000-000000000099",
        json={"title": "Nope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_api_delete_schedule():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "Delete Me",
                "frequency_type": "daily",
                "frequency_value": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        sched_id = create_resp.json()["id"]

        resp = client.delete(
            f"/api/asset-management/maintenance/{sched_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_list_by_asset_id():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "Asset Filter Test",
                "frequency_type": "monthly",
                "frequency_value": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(
            f"/api/asset-management/maintenance?asset_id={asset['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["asset_id"] == asset["id"]
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_require_auth():
    resp = client.get("/api/asset-management/maintenance")
    assert resp.status_code == 401


def test_api_delete_non_admin_returns_403():
    # Create a non-admin session token manually
    from fastapi_app import create_session
    non_admin_token = create_session({"uid": "00000000-0000-0000-0000-000000000001", "email": "test@test.com", "mode": "admin", "is_admin": False})

    # Create an admin token to set up test data
    admin_token = login_token()
    asset = _api_create_asset(admin_token)
    try:
        create_resp = client.post(
            "/api/asset-management/maintenance",
            json={
                "asset_id": asset["id"],
                "title": "Non-admin delete test",
                "frequency_type": "monthly",
                "frequency_value": 1,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        sched_id = create_resp.json()["id"]

        # Try to delete with non-admin token
        resp = client.delete(
            f"/api/asset-management/maintenance/{sched_id}",
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert resp.status_code == 403
    finally:
        _api_delete_asset(admin_token, asset["id"])
