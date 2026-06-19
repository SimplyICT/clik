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
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── CSV parsing tests ─────────────────────────────────────────────────────

def test_parse_csv_valid():
    from asset_service.imports import db as imp_db
    csv_content = "asset_name,asset_code,category\nTest Asset,TC-001,HVAC\n"
    rows = imp_db.parse_csv(csv_content)
    assert len(rows) == 1
    assert rows[0]["asset_name"] == "Test Asset"
    assert rows[0]["asset_code"] == "TC-001"
    assert rows[0]["category"] == "HVAC"


def test_parse_csv_empty():
    from asset_service.imports import db as imp_db
    assert imp_db.parse_csv("") == []
    assert imp_db.parse_csv("   ") == []


def test_parse_csv_malformed():
    from asset_service.imports import db as imp_db
    rows = imp_db.parse_csv("asset_name,asset_code\n")
    assert rows == []


def test_parse_csv_multiple_rows():
    from asset_service.imports import db as imp_db
    csv_content = "asset_name,asset_code\nAsset A,A-001\nAsset B,B-002\nAsset C,C-003\n"
    rows = imp_db.parse_csv(csv_content)
    assert len(rows) == 3


def test_parse_csv_with_extra_fields():
    from asset_service.imports import db as imp_db
    csv_content = "asset_name,asset_code,status,criticality,manufacturer\nWidget,W-001,Active,High,Acme\n"
    rows = imp_db.parse_csv(csv_content)
    assert len(rows) == 1
    assert rows[0]["status"] == "Active"
    assert rows[0]["criticality"] == "High"
    assert rows[0]["manufacturer"] == "Acme"


# ── Row validation tests ──────────────────────────────────────────────────

def test_validate_valid_row():
    from asset_service.imports import db as imp_db
    row = {"asset_name": "Test Asset", "asset_code": "TC-001"}
    errors = imp_db.validate_asset_import_row(row, 0)
    assert errors == []


def test_validate_valid_row_with_optional_fields():
    from asset_service.imports import db as imp_db
    row = {
        "asset_name": "Test Asset",
        "asset_code": "TC-001",
        "category": "HVAC",
        "status": "Active",
        "criticality": "High",
        "manufacturer": "Acme",
        "model": "X100",
        "serial_number": "SN-001",
        "location_name": "Site A",
        "contractor_name": "ABC Contracting",
        "purchase_cost": "5000.00",
        "replacement_value": "6000.00",
        "notes": "Test notes",
    }
    errors = imp_db.validate_asset_import_row(row, 0)
    assert errors == []


def test_validate_missing_asset_name():
    from asset_service.imports import db as imp_db
    row = {"asset_name": "", "asset_code": "TC-001"}
    errors = imp_db.validate_asset_import_row(row, 0)
    assert len(errors) == 1
    assert "asset_name" in errors[0]


def test_validate_missing_asset_code():
    from asset_service.imports import db as imp_db
    row = {"asset_name": "Test Asset", "asset_code": ""}
    errors = imp_db.validate_asset_import_row(row, 0)
    assert len(errors) == 1
    assert "asset_code" in errors[0]


def test_validate_missing_both():
    from asset_service.imports import db as imp_db
    row = {"asset_name": "", "asset_code": ""}
    errors = imp_db.validate_asset_import_row(row, 0)
    assert len(errors) == 2


# ── DB import tests ───────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_import_valid_data():
    from asset_service.imports import db as imp_db
    conn = _get_test_conn()
    asset_ids = []
    try:
        rows = [
            {"asset_name": "Import Test A", "asset_code": f"IMP-A-{uuid.uuid4().hex[:8].upper()}"},
            {"asset_name": "Import Test B", "asset_code": f"IMP-B-{uuid.uuid4().hex[:8].upper()}"},
        ]
        result = imp_db.import_assets(conn, rows)
        assert result["imported"] == 2
        assert result["skipped"] == 0
        assert result["errors"] == []

        for row in rows:
            from asset_service.db import get_asset
            assets = imp_db.parse_csv(
                f"asset_name,asset_code\n{row['asset_name']},{row['asset_code']}\n"
            )
            from asset_service.db import list_assets
            found = [a for a in list_assets(conn) if a["asset_code"] == row["asset_code"]]
            assert len(found) == 1
            asset_ids.append(found[0]["id"])
    finally:
        for aid in asset_ids:
            _cleanup_test_asset(conn, aid)
        conn.close()


def test_import_with_extra_fields():
    from asset_service.imports import db as imp_db
    conn = _get_test_conn()
    asset_ids = []
    try:
        code = f"IMP-EXT-{uuid.uuid4().hex[:8].upper()}"
        rows = [{
            "asset_name": "Import Extra Fields",
            "asset_code": code,
            "category": "HVAC",
            "status": "Active",
            "criticality": "High",
            "manufacturer": "Acme",
            "model": "X200",
            "serial_number": "SN-EXT-001",
            "location_name": "Site B",
            "contractor_name": "XYZ Contracting",
            "purchase_cost": "10000.00",
            "replacement_value": "12000.00",
            "notes": "Imported with extra fields",
        }]
        result = imp_db.import_assets(conn, rows)
        assert result["imported"] == 1
        assert result["skipped"] == 0

        from asset_service.db import list_assets
        found = [a for a in list_assets(conn) if a["asset_code"] == code]
        assert len(found) == 1
        asset_ids.append(found[0]["id"])

        cur = conn.cursor()
        cur.execute(
            "SELECT purchase_cost, replacement_value, location_name, contractor_name, notes "
            "FROM assets_v2 WHERE id = %s::uuid",
            (found[0]["id"],),
        )
        row = cur.fetchone()
        cur.close()
        assert float(row[0]) == 10000.00
        assert float(row[1]) == 12000.00
        assert row[2] == "Site B"
        assert row[3] == "XYZ Contracting"
    finally:
        for aid in asset_ids:
            _cleanup_test_asset(conn, aid)
        conn.close()


def test_import_mixed_rows():
    from asset_service.imports import db as imp_db
    conn = _get_test_conn()
    asset_ids = []
    try:
        code = f"IMP-MIX-{uuid.uuid4().hex[:8].upper()}"
        rows = [
            {"asset_name": "Valid Import", "asset_code": code},
            {"asset_name": "", "asset_code": "SHOULD-SKIP"},
            {"asset_name": "Also Valid", "asset_code": f"IMP-MIX2-{uuid.uuid4().hex[:8].upper()}"},
            {"asset_name": "No Code Here", "asset_code": ""},
        ]
        result = imp_db.import_assets(conn, rows)
        assert result["imported"] == 2
        assert result["skipped"] == 2
        assert len(result["errors"]) == 2
        assert result["errors"][0]["row"] == 2
        assert result["errors"][1]["row"] == 4
        assert "asset_name" in result["errors"][0]["message"] or "asset_code" in result["errors"][0]["message"]
    finally:
        for aid in asset_ids:
            _cleanup_test_asset(conn, aid)
        conn.close()


def test_import_empty_rows():
    from asset_service.imports import db as imp_db
    conn = _get_test_conn()
    try:
        result = imp_db.import_assets(conn, [])
        assert result["imported"] == 0
        assert result["skipped"] == 0
        assert result["errors"] == []
    finally:
        conn.close()


# ── API endpoint tests ────────────────────────────────────────────────────

from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


def test_api_template_requires_auth():
    resp = client.get("/api/asset-management/reports/import/template")
    assert resp.status_code == 401


def test_api_template_download():
    token = login_token()
    resp = client.get(
        "/api/asset-management/reports/import/template",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "asset_name" in resp.text
    assert "Example Asset" in resp.text


def test_api_import_requires_auth():
    resp = client.post(
        "/api/asset-management/reports/import",
        json={"csv_content": "asset_name,asset_code\nTest,TC-001", "import_type": "assets"},
    )
    assert resp.status_code == 401


def test_api_import_non_admin_403():
    from fastapi_app import create_session
    token = create_session({"uid": str(uuid.uuid4()), "email": "nonadmin@test.local", "mode": "admin", "is_admin": False})
    resp = client.post(
        "/api/asset-management/reports/import",
        json={"csv_content": "asset_name,asset_code\nTest,TC-001", "import_type": "assets"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_api_import_valid():
    from asset_service.imports import db as imp_db
    token = login_token()
    code = f"API-IMP-{uuid.uuid4().hex[:8].upper()}"
    csv_content = f"asset_name,asset_code,category\nAPI Import Test,{code},HVAC\n"
    resp = client.post(
        "/api/asset-management/reports/import",
        json={"csv_content": csv_content, "import_type": "assets"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported"] == 1
    assert data["skipped"] == 0
    assert data["errors"] == []

    conn = _get_test_conn()
    try:
        from asset_service.db import list_assets
        found = [a for a in list_assets(conn) if a["asset_code"] == code]
        assert len(found) == 1
        cur = conn.cursor()
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (found[0]["id"],))
        cur.close()
        conn.commit()
    finally:
        conn.close()


def test_api_import_empty_csv():
    token = login_token()
    resp = client.post(
        "/api/asset-management/reports/import",
        json={"csv_content": "", "import_type": "assets"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_api_import_invalid_rows():
    token = login_token()
    csv_content = "asset_name,asset_code\n,"
    resp = client.post(
        "/api/asset-management/reports/import",
        json={"csv_content": csv_content, "import_type": "assets"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported"] == 0
    assert data["skipped"] == 1
