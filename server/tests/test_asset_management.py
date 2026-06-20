import sys, os, json
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
        CREATE TABLE IF NOT EXISTS asset_parts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID REFERENCES assets_v2(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            sku TEXT NOT NULL UNIQUE,
            quantity INTEGER NOT NULL DEFAULT 0,
            min_threshold INTEGER NOT NULL DEFAULT 0,
            unit TEXT NOT NULL DEFAULT 'each',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_part_usage (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            part_id UUID REFERENCES asset_parts(id) ON DELETE CASCADE,
            request_id UUID,
            quantity INTEGER NOT NULL,
            used_by UUID,
            used_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_custom_field_defs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            category TEXT NOT NULL,
            field_name TEXT NOT NULL,
            field_label TEXT NOT NULL,
            field_type TEXT NOT NULL DEFAULT 'text',
            options JSONB,
            required BOOLEAN DEFAULT FALSE,
            sort_order INTEGER DEFAULT 0,
            UNIQUE(category, field_name)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_audit_log (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            actor_id UUID,
            actor_name TEXT,
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

from fastapi.testclient import TestClient
from fastapi_app import app

_ensure_tables()

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


def test_asset_management_list_assets():
    token = login_token()
    resp = client.get("/api/asset-management/assets",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_asset_management_create_asset():
    token = login_token()
    import uuid
    unique_code = f"TEST-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={
                           "asset_name": "Test Asset",
                           "asset_code": unique_code,
                           "category": "Test",
                           "status": "Active",
                       },
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["asset_name"] == "Test Asset"
    assert data["asset_code"] == unique_code
    assert "id" in data
    assert "qr_code" in data


def _create_test_asset(token, name, code):
    resp = client.post("/api/asset-management/assets",
                       json={
                           "asset_name": name,
                           "asset_code": code,
                           "category": "Test",
                           "status": "Active",
                       },
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    return resp.json()["id"]


def test_bulk_update_status():
    token = login_token()
    import uuid
    id1 = _create_test_asset(token, "Bulk Status 1", f"BULK-STATUS-{uuid.uuid4().hex[:8].upper()}")
    id2 = _create_test_asset(token, "Bulk Status 2", f"BULK-STATUS-{uuid.uuid4().hex[:8].upper()}")
    resp = client.post("/api/asset-management/assets/bulk/status",
                       json={"asset_ids": [id1, id2], "status": "Inactive"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] == 2
    for aid in (id1, id2):
        r = client.get(f"/api/asset-management/assets/{aid}",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.json()["status"] == "Inactive"


def test_bulk_transfer():
    token = login_token()
    import uuid
    id1 = _create_test_asset(token, "Bulk Transfer 1", f"BULK-TFR-{uuid.uuid4().hex[:8].upper()}")
    id2 = _create_test_asset(token, "Bulk Transfer 2", f"BULK-TFR-{uuid.uuid4().hex[:8].upper()}")
    cust_id = "00000000-0000-0000-0000-000000000001"
    loc_id = "00000000-0000-0000-0000-000000000002"
    resp = client.post("/api/asset-management/assets/bulk/transfer",
                       json={"asset_ids": [id1, id2], "customer_id": cust_id, "location_id": loc_id},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] == 2
    for aid in (id1, id2):
        r = client.get(f"/api/asset-management/assets/{aid}",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.json()["customer_id"] == cust_id
        assert r.json()["customer_location_id"] == loc_id


def test_bulk_assign_contractor():
    token = login_token()
    import uuid
    id1 = _create_test_asset(token, "Bulk Assign 1", f"BULK-ASN-{uuid.uuid4().hex[:8].upper()}")
    id2 = _create_test_asset(token, "Bulk Assign 2", f"BULK-ASN-{uuid.uuid4().hex[:8].upper()}")
    contractor_id = "00000000-0000-0000-0000-000000000003"
    resp = client.post("/api/asset-management/assets/bulk/assign",
                       json={"asset_ids": [id1, id2], "contractor_id": contractor_id},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] == 2
    for aid in (id1, id2):
        r = client.get(f"/api/asset-management/assets/{aid}",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.json()["assigned_contractor_id"] == contractor_id


def test_bulk_operations_require_admin():
    resp = client.post("/api/login", json={"email": "contractor@simplyclik.local", "password": "Temp123!"})
    try:
        non_admin_token = resp.json()["token"]
    except (KeyError, ValueError):
        return
    import uuid
    resp = client.post("/api/asset-management/assets/bulk/status",
                       json={"asset_ids": [], "status": "Inactive"},
                       headers={"Authorization": f"Bearer {non_admin_token}"})
    assert resp.status_code == 403


def test_asset_management_create_asset_duplicate_code():
    token = login_token()
    import uuid
    import pytest
    from pg8000.dbapi import IntegrityError
    unique_code = f"DUP-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={"asset_name": "Original", "asset_code": unique_code, "category": "Test", "status": "Active"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201

    with pytest.raises(IntegrityError):
        client.post("/api/asset-management/assets",
                    json={"asset_name": "Duplicate", "asset_code": unique_code, "category": "Test", "status": "Active"},
                    headers={"Authorization": f"Bearer {token}"})


def test_asset_management_get_asset_not_found():
    token = login_token()
    resp = client.get(
        "/api/asset-management/assets/00000000-0000-0000-0000-000000000099",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
