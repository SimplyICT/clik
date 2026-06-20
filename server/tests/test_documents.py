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
        CREATE TABLE IF NOT EXISTS asset_documents (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL DEFAULT 'other',
            file_size INTEGER,
            mime_type TEXT,
            uploaded_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


# ── Model validation tests ────────────────────────────────────────────────

def test_document_create_model_valid():
    from asset_service.documents.models import DocumentCreate
    doc = DocumentCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        file_name="test.pdf",
        file_url="https://example.com/test.pdf",
    )
    assert doc.file_type == "other"
    assert doc.file_size is None
    assert doc.mime_type is None


def test_document_create_model_with_all_fields():
    from asset_service.documents.models import DocumentCreate
    doc = DocumentCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        file_name="manual.pdf",
        file_url="https://example.com/manual.pdf",
        file_type="manual",
        file_size=1024,
        mime_type="application/pdf",
    )
    assert doc.file_type == "manual"
    assert doc.file_size == 1024
    assert doc.mime_type == "application/pdf"


def test_document_create_model_missing_required():
    from asset_service.documents.models import DocumentCreate
    import pytest
    with pytest.raises(Exception):
        DocumentCreate(asset_id="00000000-0000-0000-0000-000000000001", file_name="test.pdf")


# ── DB operation tests ────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn):
    """Create a temporary asset for document tests."""
    from asset_service import db as asset_db
    unique_code = f"DOC-TEST-{uuid.uuid4().hex[:8].upper()}"
    asset = asset_db.create_asset(conn, {
        "asset_name": "Doc Test Asset",
        "asset_code": unique_code,
        "category": "Test",
    })
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    """Remove test asset and its documents."""
    from asset_service.documents import db as doc_db
    # Delete all documents for this asset first
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_documents WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_db_create_document():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        doc = doc_db.create_document(conn, {
            "asset_id": asset["id"],
            "file_name": "test-doc.pdf",
            "file_url": "https://example.com/test-doc.pdf",
            "file_type": "manual",
            "file_size": 2048,
            "mime_type": "application/pdf",
        }, user_id=None)
        conn.commit()
        assert doc is not None
        assert doc["file_name"] == "test-doc.pdf"
        assert doc["file_url"] == "https://example.com/test-doc.pdf"
        assert doc["file_type"] == "manual"
        assert doc["file_size"] == 2048
        assert doc["asset_id"] == asset["id"]
        assert "id" in doc
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_document():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = doc_db.create_document(conn, {
            "asset_id": asset["id"],
            "file_name": "get-test.pdf",
            "file_url": "https://example.com/get-test.pdf",
        })
        conn.commit()
        fetched = doc_db.get_document(conn, created["id"])
        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["file_name"] == "get-test.pdf"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_document_not_found():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    try:
        result = doc_db.get_document(conn, "00000000-0000-0000-0000-000000000099")
        assert result is None
    finally:
        conn.close()


def test_db_list_documents():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        doc_db.create_document(conn, {
            "asset_id": asset["id"],
            "file_name": "list-doc-1.pdf",
            "file_url": "https://example.com/list-doc-1.pdf",
        })
        doc_db.create_document(conn, {
            "asset_id": asset["id"],
            "file_name": "list-doc-2.pdf",
            "file_url": "https://example.com/list-doc-2.pdf",
        })
        conn.commit()
        docs = doc_db.list_documents(conn, asset["id"])
        assert len(docs) == 2
        file_names = {d["file_name"] for d in docs}
        assert "list-doc-1.pdf" in file_names
        assert "list-doc-2.pdf" in file_names
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_documents_empty():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        docs = doc_db.list_documents(conn, asset["id"])
        assert docs == []
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_delete_document():
    from asset_service.documents import db as doc_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        doc = doc_db.create_document(conn, {
            "asset_id": asset["id"],
            "file_name": "delete-me.pdf",
            "file_url": "https://example.com/delete-me.pdf",
        })
        conn.commit()
        doc_db.delete_document(conn, doc["id"])
        conn.commit()
        fetched = doc_db.get_document(conn, doc["id"])
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


def _api_create_asset(token):
    unique_code = f"DOC-API-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post("/api/asset-management/assets",
                       json={"asset_name": "API Doc Test", "asset_code": unique_code, "category": "Test"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    return resp.json()


def _api_delete_asset(token, asset_id):
    """Delete asset via direct DB to also clean up documents."""
    conn = _get_test_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM asset_documents WHERE asset_id = %s::uuid", (asset_id,))
        cur.close()
        cur = conn.cursor()
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        cur.close()
        conn.commit()
    finally:
        conn.close()


def test_api_upload_document():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        resp = client.post(
            f"/api/asset-management/assets/{asset['id']}/documents",
            json={
                "asset_id": asset["id"],
                "file_name": "api-upload.pdf",
                "file_url": "https://example.com/api-upload.pdf",
                "file_type": "manual",
                "file_size": 4096,
                "mime_type": "application/pdf",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["file_name"] == "api-upload.pdf"
        assert data["file_url"] == "https://example.com/api-upload.pdf"
        assert data["file_type"] == "manual"
        assert data["file_size"] == 4096
        assert data["asset_id"] == asset["id"]
        assert "id" in data
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_list_documents():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        # Create two documents
        for i in range(2):
            client.post(
                f"/api/asset-management/assets/{asset['id']}/documents",
                json={
                    "asset_id": asset["id"],
                    "file_name": f"api-list-{i}.pdf",
                    "file_url": f"https://example.com/api-list-{i}.pdf",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        resp = client.get(
            f"/api/asset-management/assets/{asset['id']}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_delete_document():
    token = login_token()
    asset = _api_create_asset(token)
    try:
        # Create a document
        create_resp = client.post(
            f"/api/asset-management/assets/{asset['id']}/documents",
            json={
                "asset_id": asset["id"],
                "file_name": "api-delete.pdf",
                "file_url": "https://example.com/api-delete.pdf",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        doc_id = create_resp.json()["id"]

        # Delete it
        resp = client.delete(
            f"/api/asset-management/documents/{doc_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # Verify it's gone
        list_resp = client.get(
            f"/api/asset-management/assets/{asset['id']}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(list_resp.json()) == 0
    finally:
        _api_delete_asset(token, asset["id"])


def test_api_documents_require_auth():
    resp = client.get("/api/asset-management/assets/00000000-0000-0000-0000-000000000001/documents")
    assert resp.status_code == 401


def test_api_delete_document_requires_auth():
    resp = client.delete("/api/asset-management/documents/00000000-0000-0000-0000-000000000001")
    assert resp.status_code == 401


def test_api_upload_document_requires_auth():
    resp = client.post(
        "/api/asset-management/assets/00000000-0000-0000-0000-000000000001/documents",
        json={
            "asset_id": "00000000-0000-0000-0000-000000000001",
            "file_name": "noauth.pdf",
            "file_url": "https://example.com/noauth.pdf",
        },
    )
    assert resp.status_code == 401
