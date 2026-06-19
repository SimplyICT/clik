import sys, os, uuid, json, secrets
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pg8000
from datetime import datetime, timedelta, date


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
            completed_by TEXT,
            labor_hours NUMERIC,
            labor_cost NUMERIC,
            parts_cost NUMERIC,
            total_cost NUMERIC,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── Model validation tests ────────────────────────────────────────────────

def test_work_order_create_model_valid():
    from asset_service.work_orders.models import WorkOrderCreate
    wo = WorkOrderCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        type="preventive",
        title="Test Work Order",
    )
    assert wo.priority == "medium"
    assert wo.schedule_id is None
    assert wo.description is None


def test_work_order_create_model_with_all_fields():
    from asset_service.work_orders.models import WorkOrderCreate
    wo = WorkOrderCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        schedule_id="00000000-0000-0000-0000-000000000002",
        type="corrective",
        title="Full Work Order",
        description="A detailed description",
        priority="high",
        assigned_contractor_id="00000000-0000-0000-0000-000000000003",
        scheduled_date="2026-07-01",
    )
    assert wo.type == "corrective"
    assert wo.title == "Full Work Order"
    assert wo.description == "A detailed description"
    assert wo.priority == "high"
    assert wo.assigned_contractor_id == "00000000-0000-0000-0000-000000000003"


def test_work_order_create_model_missing_required():
    from asset_service.work_orders.models import WorkOrderCreate
    import pytest
    with pytest.raises(Exception):
        WorkOrderCreate(asset_id="00000000-0000-0000-0000-000000000001")


def test_work_order_create_model_missing_type():
    from asset_service.work_orders.models import WorkOrderCreate
    import pytest
    with pytest.raises(Exception):
        WorkOrderCreate(asset_id="00000000-0000-0000-0000-000000000001", title="Test")


# ── DB operation tests ────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn):
    from asset_service import db as asset_db
    unique_code = f"WO-TEST-{uuid.uuid4().hex[:8].upper()}"
    asset = asset_db.create_asset(conn, {
        "asset_name": "WO Test Asset",
        "asset_code": unique_code,
        "category": "Test",
    })
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_work_orders WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_db_create_work_order():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wo = wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "preventive",
            "title": "Preventive maintenance",
            "description": "Check all systems",
            "priority": "high",
            "scheduled_date": "2026-07-15",
        }, user_id=None)
        conn.commit()
        assert wo is not None
        assert wo["type"] == "preventive"
        assert wo["title"] == "Preventive maintenance"
        assert wo["description"] == "Check all systems"
        assert wo["priority"] == "high"
        assert wo["status"] == "pending"
        assert wo["asset_id"] == asset["id"]
        assert "id" in wo
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_work_order():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "corrective",
            "title": "Fix leaking pipe",
        })
        conn.commit()
        fetched = wo_db.get_work_order(conn, created["id"])
        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["title"] == "Fix leaking pipe"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_work_order_not_found():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    try:
        result = wo_db.get_work_order(conn, "00000000-0000-0000-0000-000000000099")
        assert result is None
    finally:
        conn.close()


def test_db_list_work_orders():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "inspection",
            "title": "Monthly inspection",
        })
        wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "preventive",
            "title": "Oil change",
        })
        conn.commit()
        wos = wo_db.list_work_orders(conn)
        assert len(wos) >= 2
        wos = wo_db.list_work_orders(conn, asset_id=asset["id"])
        assert len(wos) == 2
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_work_orders_empty():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wos = wo_db.list_work_orders(conn, asset_id=asset["id"])
        assert wos == []
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_work_orders_with_filters():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "emergency",
            "title": "Emergency repair",
            "status": "in_progress",
        })
        wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "preventive",
            "title": "Routine check",
            "status": "pending",
        })
        conn.commit()
        pending = wo_db.list_work_orders(conn, asset_id=asset["id"], status="pending")
        assert len(pending) == 1
        assert pending[0]["title"] == "Routine check"
        in_progress = wo_db.list_work_orders(conn, asset_id=asset["id"], status="in_progress")
        assert len(in_progress) == 1
        assert in_progress[0]["title"] == "Emergency repair"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_update_work_order():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wo = wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "corrective",
            "title": "Initial title",
            "priority": "low",
        })
        conn.commit()
        updated = wo_db.update_work_order(conn, wo["id"], {
            "title": "Updated title",
            "priority": "critical",
            "status": "in_progress",
        })
        conn.commit()
        assert updated["title"] == "Updated title"
        assert updated["priority"] == "critical"
        assert updated["status"] == "in_progress"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_delete_work_order():
    from asset_service.work_orders import db as wo_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        wo = wo_db.create_work_order(conn, {
            "asset_id": asset["id"],
            "type": "inspection",
            "title": "Delete me",
        })
        conn.commit()
        wo_db.delete_work_order(conn, wo["id"])
        conn.commit()
        fetched = wo_db.get_work_order(conn, wo["id"])
        assert fetched is None
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


def _non_admin_token():
    token = secrets.token_hex(32)
    now = datetime.utcnow().isoformat()
    expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    conn = _get_test_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (token, user_id, data, created_at, expires_at) VALUES (%s, %s, %s, %s, %s)",
        (token, "00000000-0000-0000-0000-000000000000",
         json.dumps({"uid": "00000000-0000-0000-0000-000000000000",
                     "email": "nonadmin@test.com",
                     "mode": "admin",
                     "is_admin": False}),
         now, expires),
    )
    conn.commit()
    cur.close()
    conn.close()
    return token


def _api_create_asset(token):
    unique_code = f"WO-API-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={"asset_name": "API WO Test", "asset_code": unique_code, "category": "Test"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    return resp.json()


def _api_delete_asset(token, asset_id):
    conn = _get_test_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM asset_work_orders WHERE asset_id = %s::uuid", (asset_id,))
        cur.close()
        cur = conn.cursor()
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        cur.close()
        conn.commit()
    finally:
        conn.close()


def test_api_create_work_order():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        resp = client.post(
            "/api/asset-management/work-orders",
            json={
                "asset_id": asset["id"],
                "type": "preventive",
                "title": "API created work order",
                "description": "Created via API",
                "priority": "high",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "API created work order"
        assert data["type"] == "preventive"
        assert data["description"] == "Created via API"
        assert data["priority"] == "high"
        assert data["asset_id"] == asset["id"]
        assert data["status"] == "pending"
        assert "id" in data
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_list_work_orders():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        for i in range(2):
            client.post(
                "/api/asset-management/work-orders",
                json={
                    "asset_id": asset["id"],
                    "type": "preventive",
                    "title": f"API list WO {i}",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        resp = client.get(
            "/api/asset-management/work-orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_get_work_order():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/work-orders",
            json={
                "asset_id": asset["id"],
                "type": "inspection",
                "title": "API get test",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        wo_id = create_resp.json()["id"]
        resp = client.get(
            f"/api/asset-management/work-orders/{wo_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "API get test"
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_update_work_order():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/work-orders",
            json={
                "asset_id": asset["id"],
                "type": "corrective",
                "title": "Before update",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        wo_id = create_resp.json()["id"]
        resp = client.patch(
            f"/api/asset-management/work-orders/{wo_id}",
            json={"title": "After update", "priority": "critical", "status": "in_progress"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "After update"
        assert data["priority"] == "critical"
        assert data["status"] == "in_progress"
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_delete_work_order():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        create_resp = client.post(
            "/api/asset-management/work-orders",
            json={
                "asset_id": asset["id"],
                "type": "emergency",
                "title": "Delete me",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        wo_id = create_resp.json()["id"]
        resp = client.delete(
            f"/api/asset-management/work-orders/{wo_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_list_work_orders_by_asset():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        client.post(
            "/api/asset-management/work-orders",
            json={
                "asset_id": asset["id"],
                "type": "preventive",
                "title": "Asset specific WO",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(
            f"/api/asset-management/assets/{asset['id']}/work-orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["asset_id"] == asset["id"]
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_work_orders_require_auth():
    resp = client.get("/api/asset-management/work-orders")
    assert resp.status_code == 401


def test_api_delete_work_order_non_admin():
    token = _non_admin_token()
    resp = client.delete(
        "/api/asset-management/work-orders/00000000-0000-0000-0000-000000000001",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
