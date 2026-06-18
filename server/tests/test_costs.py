import sys, os, uuid
from datetime import date
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
        CREATE TABLE IF NOT EXISTS asset_cost_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            cost_type TEXT NOT NULL,
            amount DECIMAL NOT NULL,
            description TEXT,
            recorded_date DATE NOT NULL,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── Model validation tests ────────────────────────────────────────────────

def test_cost_record_model_valid():
    from asset_service.costs.models import CostRecord
    cost = CostRecord(
        asset_id="00000000-0000-0000-0000-000000000001",
        cost_type="maintenance",
        amount=150.00,
        recorded_date=date(2025, 6, 1),
    )
    assert cost.description is None
    assert cost.cost_type == "maintenance"
    assert cost.amount == 150.00
    assert str(cost.recorded_date) == "2025-06-01"


def test_cost_record_model_with_all_fields():
    from asset_service.costs.models import CostRecord
    cost = CostRecord(
        asset_id="00000000-0000-0000-0000-000000000001",
        cost_type="repair",
        amount=500.50,
        description="Fixed cooling unit",
        recorded_date=date(2025, 7, 15),
    )
    assert cost.description == "Fixed cooling unit"
    assert cost.cost_type == "repair"
    assert cost.amount == 500.50
    assert str(cost.recorded_date) == "2025-07-15"


def test_cost_record_model_missing_required():
    from asset_service.costs.models import CostRecord
    import pytest
    with pytest.raises(Exception):
        CostRecord(asset_id="00000000-0000-0000-0000-000000000001", cost_type="test")


# ── DB operation tests ────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn):
    from asset_service import db as asset_db
    unique_code = f"CST-TEST-{uuid.uuid4().hex[:8].upper()}"
    asset = asset_db.create_asset(conn, {
        "asset_name": "Cost Test Asset",
        "asset_code": unique_code,
        "category": "Test",
    })
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_cost_history WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_db_record_cost():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        cost = cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "maintenance",
            "amount": 250.00,
            "description": "Routine maintenance",
            "recorded_date": "2025-06-15",
        }, user_id=None)
        conn.commit()
        assert cost is not None
        assert cost["cost_type"] == "maintenance"
        assert cost["amount"] == 250.00
        assert cost["description"] == "Routine maintenance"
        assert cost["asset_id"] == asset["id"]
        assert "id" in cost
        assert "recorded_date" in cost
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_cost():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "inspection",
            "amount": 100.00,
            "recorded_date": "2025-06-01",
        })
        conn.commit()
        fetched = cost_db.get_cost(conn, created["id"])
        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["cost_type"] == "inspection"
        assert fetched["amount"] == 100.00
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_cost_not_found():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    try:
        result = cost_db.get_cost(conn, "00000000-0000-0000-0000-000000000099")
        assert result is None
    finally:
        conn.close()


def test_db_list_costs():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "repair",
            "amount": 300.00,
            "recorded_date": "2025-07-01",
        })
        cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "maintenance",
            "amount": 150.00,
            "recorded_date": "2025-06-15",
        })
        conn.commit()
        costs = cost_db.list_costs(conn, asset["id"])
        assert len(costs) == 2
        cost_types = {c["cost_type"] for c in costs}
        assert "repair" in cost_types
        assert "maintenance" in cost_types
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_costs_empty():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        costs = cost_db.list_costs(conn, asset["id"])
        assert costs == []
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_cost_summary():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "maintenance",
            "amount": 100.00,
            "recorded_date": "2025-06-01",
        })
        cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "maintenance",
            "amount": 200.00,
            "recorded_date": "2025-06-15",
        })
        cost_db.record_cost(conn, {
            "asset_id": asset["id"],
            "cost_type": "repair",
            "amount": 500.00,
            "recorded_date": "2025-07-01",
        })
        conn.commit()
        summary = cost_db.get_cost_summary(conn)
        summary_map = {s["cost_type"]: s for s in summary}
        assert "maintenance" in summary_map
        assert summary_map["maintenance"]["count"] == 2
        assert summary_map["maintenance"]["total"] == 300.00
        assert "repair" in summary_map
        assert summary_map["repair"]["count"] == 1
        assert summary_map["repair"]["total"] == 500.00
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_cost_summary_empty():
    from asset_service.costs import db as cost_db
    conn = _get_test_conn()
    try:
        summary = cost_db.get_cost_summary(conn)
        assert summary == []
    finally:
        conn.close()


# ── API endpoint tests ────────────────────────────────────────────────────

from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


def _api_create_asset(token):
    unique_code = f"CST-API-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={"asset_name": "API Cost Test", "asset_code": unique_code, "category": "Test"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    return resp.json()


def _api_delete_asset(token, asset_id):
    conn = _get_test_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM asset_cost_history WHERE asset_id = %s::uuid", (asset_id,))
        cur.close()
        cur = conn.cursor()
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        cur.close()
        conn.commit()
    finally:
        conn.close()


def test_api_list_costs():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        resp = client.get(
            f"/api/asset-management/assets/{asset['id']}/costs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_record_cost():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        resp = client.post(
            f"/api/asset-management/assets/{asset['id']}/costs",
            json={
                "asset_id": asset["id"],
                "cost_type": "installation",
                "amount": 1200.00,
                "description": "Initial installation",
                "recorded_date": "2025-06-01",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["cost_type"] == "installation"
        assert data["amount"] == 1200.00
        assert data["description"] == "Initial installation"
        assert data["asset_id"] == asset["id"]
        assert "id" in data
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_record_cost_non_admin():
    """Non-admin users should get 403 when recording costs."""
    resp = client.post("/api/login", json={"email": "cont1@simplyclik.testinator.com", "password": "Temp123!"})
    token = resp.json()["token"]
    resp = client.post(
        "/api/asset-management/assets/00000000-0000-0000-0000-000000000001/costs",
        json={
            "asset_id": "00000000-0000-0000-0000-000000000001",
            "cost_type": "test",
            "amount": 10.00,
            "recorded_date": "2025-06-01",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_api_get_cost_summary():
    token = login_token()
    resp = client.get(
        "/api/asset-management/costs/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_cost_summary_non_admin():
    """Non-admin users should get 403 for cost summary."""
    resp = client.post("/api/login", json={"email": "cont1@simplyclik.testinator.com", "password": "Temp123!"})
    token = resp.json()["token"]
    resp = client.get(
        "/api/asset-management/costs/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_api_costs_require_auth():
    resp = client.get("/api/asset-management/assets/00000000-0000-0000-0000-000000000001/costs")
    assert resp.status_code == 401
