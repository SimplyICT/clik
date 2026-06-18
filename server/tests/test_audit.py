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


_ensure_tables()


# ── Model validation tests ────────────────────────────────────────────────

def test_audit_event_create_model_valid():
    from asset_service.audit.models import AuditEventCreate
    event = AuditEventCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        event_type="created",
    )
    assert event.actor_id is None
    assert event.actor_name is None
    assert event.details is None


def test_audit_event_create_model_with_all_fields():
    from asset_service.audit.models import AuditEventCreate
    event = AuditEventCreate(
        asset_id="00000000-0000-0000-0000-000000000001",
        event_type="updated",
        actor_id="00000000-0000-0000-0000-000000000099",
        actor_name="John Doe",
        details={"field": "status", "old": "Active", "new": "Retired"},
    )
    assert event.actor_id == "00000000-0000-0000-0000-000000000099"
    assert event.actor_name == "John Doe"
    assert event.details == {"field": "status", "old": "Active", "new": "Retired"}


def test_audit_event_create_model_missing_required():
    from asset_service.audit.models import AuditEventCreate
    import pytest
    with pytest.raises(Exception):
        AuditEventCreate(asset_id="00000000-0000-0000-0000-000000000001")


# ── DB operation tests ────────────────────────────────────────────────────

def _get_test_conn():
    from asset_service.db import get_conn
    return get_conn()


def _create_test_asset(conn):
    from asset_service import db as asset_db
    unique_code = f"AUD-TEST-{uuid.uuid4().hex[:8].upper()}"
    asset = asset_db.create_asset(conn, {
        "asset_name": "Audit Test Asset",
        "asset_code": unique_code,
        "category": "Test",
    })
    conn.commit()
    return asset


def _cleanup_test_asset(conn, asset_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_audit_log WHERE asset_id = %s::uuid", (asset_id,))
    cur.close()
    cur = conn.cursor()
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    cur.close()
    conn.commit()


def test_db_log_event():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        event = audit_db.log_event(
            conn,
            asset_id=asset["id"],
            event_type="test_event",
            actor_id="00000000-0000-0000-0000-000000000099",
            actor_name="Tester",
            details={"key": "value"},
        )
        conn.commit()
        assert event is not None
        assert event["event_type"] == "test_event"
        assert event["asset_id"] == asset["id"]
        assert event["actor_id"] == "00000000-0000-0000-0000-000000000099"
        assert event["actor_name"] == "Tester"
        assert event["details"] == {"key": "value"}
        assert "id" in event
        assert "created_at" in event
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_event():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        created = audit_db.log_event(conn, asset_id=asset["id"], event_type="get_test")
        conn.commit()
        fetched = audit_db.get_event(conn, created["id"])
        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["event_type"] == "get_test"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_get_event_not_found():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    try:
        result = audit_db.get_event(conn, "00000000-0000-0000-0000-000000000099")
        assert result is None
    finally:
        conn.close()


def test_db_list_events():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        audit_db.log_event(conn, asset_id=asset["id"], event_type="event_a")
        audit_db.log_event(conn, asset_id=asset["id"], event_type="event_b")
        conn.commit()
        events = audit_db.list_events(conn, asset_id=asset["id"])
        types = {e["event_type"] for e in events}
        assert "created" in types
        assert "event_a" in types
        assert "event_b" in types
        assert len(events) >= 3
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_events_empty():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        events = audit_db.list_events(conn, asset_id=asset["id"], event_type="nonexistent")
        assert events == []
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_events_filter_by_type():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        audit_db.log_event(conn, asset_id=asset["id"], event_type="type_a")
        audit_db.log_event(conn, asset_id=asset["id"], event_type="type_b")
        conn.commit()
        events = audit_db.list_events(conn, asset_id=asset["id"], event_type="type_a")
        assert len(events) == 1
        assert events[0]["event_type"] == "type_a"
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


def test_db_list_events_limit():
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        asset = _create_test_asset(conn)
        for i in range(5):
            audit_db.log_event(conn, asset_id=asset["id"], event_type=f"evt_{i}")
        conn.commit()
        events = audit_db.list_events(conn, asset_id=asset["id"], limit=3)
        assert len(events) == 3
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()


# ── Audit on asset creation (Task 1.9) ────────────────────────────────────

def test_audit_logged_on_asset_create():
    """Verify that creating an asset automatically logs an audit event."""
    from asset_service import db as asset_db
    from asset_service.audit import db as audit_db
    conn = _get_test_conn()
    asset = None
    try:
        unique_code = f"AUD-CREATE-{uuid.uuid4().hex[:8].upper()}"
        asset = asset_db.create_asset(conn, {
            "asset_name": "Audit Create Test",
            "asset_code": unique_code,
            "category": "Test",
        }, user_id="00000000-0000-0000-0000-000000000099")
        conn.commit()
        events = audit_db.list_events(conn, asset_id=asset["id"])
        assert len(events) >= 1
        created_events = [e for e in events if e["event_type"] == "created"]
        assert len(created_events) == 1
        assert created_events[0]["actor_id"] == "00000000-0000-0000-0000-000000000099"
        assert created_events[0]["details"]["asset_name"] == "Audit Create Test"
        assert created_events[0]["details"]["asset_code"] == unique_code
    finally:
        if asset:
            _cleanup_test_asset(conn, asset["id"])
        conn.close()
