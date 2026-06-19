import sys, os, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pg8000
from datetime import datetime, timezone, timedelta


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


def _get_conn():
    from asset_service.db import get_conn
    return get_conn()


def test_compute_next_due_daily():
    from asset_service.cron.tasks import _compute_next_due
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    result = _compute_next_due(base, "daily", 7)
    assert result == base + timedelta(days=7)


def test_compute_next_due_weekly():
    from asset_service.cron.tasks import _compute_next_due
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    result = _compute_next_due(base, "weekly", 2)
    assert result == base + timedelta(weeks=2)


def test_compute_next_due_monthly():
    from asset_service.cron.tasks import _compute_next_due
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    from dateutil.relativedelta import relativedelta
    result = _compute_next_due(base, "monthly", 3)
    assert result == base + relativedelta(months=3)


def test_compute_next_due_hours_run_returns_none():
    from asset_service.cron.tasks import _compute_next_due
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    result = _compute_next_due(base, "hours_run", 500)
    assert result is None


def test_compute_next_due_none_last_completed():
    from asset_service.cron.tasks import _compute_next_due
    result = _compute_next_due(None, "daily", 1)
    assert result is None


def test_check_due_maintenance_creates_work_order():
    conn = _get_conn()
    asset_id = str(uuid.uuid4())
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO assets_v2 (id, asset_name, asset_code, qr_code, category)
            VALUES (%s::uuid, 'Cron Test Asset', %s, %s, 'Test')
        """, (asset_id, f"CRON-{uuid.uuid4().hex[:8]}", f"qr-{uuid.uuid4().hex[:8]}"))
        conn.commit()

        schedule_id = str(uuid.uuid4())
        past_due = datetime.now(timezone.utc) - timedelta(days=1)
        cur.execute("""
            INSERT INTO asset_maintenance_schedules
                (id, asset_id, title, frequency_type, frequency_value,
                 next_due, auto_create_work_order)
            VALUES (%s::uuid, %s::uuid, 'Test Schedule', 'daily', 1,
                    %s, TRUE)
        """, (schedule_id, asset_id, past_due))
        conn.commit()
        cur.close()

        from asset_service.cron import tasks
        tasks.DB_CONFIG = {
            "host": os.environ.get("SUPABASE_DB_HOST") or os.environ["DB_HOST"],
            "port": int(os.environ.get("SUPABASE_DB_PORT") or os.environ["DB_PORT"]),
            "database": os.environ.get("SUPABASE_DB_NAME") or os.environ["DB_NAME"],
            "user": os.environ.get("SUPABASE_DB_USER") or os.environ["DB_USER"],
            "password": os.environ.get("SUPABASE_DB_PASSWORD") or os.environ["DB_PASSWORD"],
            "ssl_context": True,
        }
        tasks.check_due_maintenance()

        cur = conn.cursor()
        cur.execute("SELECT id FROM asset_work_orders WHERE schedule_id = %s::uuid", (schedule_id,))
        wos = cur.fetchall()
        assert len(wos) == 1, f"Expected 1 work order, got {len(wos)}"

        cur.execute("""
            SELECT last_completed FROM asset_maintenance_schedules WHERE id = %s::uuid
        """, (schedule_id,))
        row = cur.fetchone()
        assert row is not None
        assert row[0] is not None

        cur.execute("""
            SELECT id FROM asset_audit_log WHERE asset_id = %s::uuid
               AND event_type = 'work_order_auto_created'
        """, (asset_id,))
        logs = cur.fetchall()
        assert len(logs) >= 1, "Expected audit log entry"
        cur.close()

        cur = conn.cursor()
        cur.execute("DELETE FROM asset_audit_log WHERE asset_id = %s::uuid", (asset_id,))
        cur.execute("DELETE FROM asset_work_orders WHERE asset_id = %s::uuid", (asset_id,))
        cur.execute("DELETE FROM asset_maintenance_schedules WHERE id = %s::uuid", (schedule_id,))
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        conn.commit()
        cur.close()
    finally:
        conn.close()


def test_check_due_maintenance_skips_non_auto():
    conn = _get_conn()
    asset_id = str(uuid.uuid4())
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO assets_v2 (id, asset_name, asset_code, qr_code, category)
            VALUES (%s::uuid, 'Cron Skip Test', %s, %s, 'Test')
        """, (asset_id, f"CRON-SKIP-{uuid.uuid4().hex[:8]}", f"qr-{uuid.uuid4().hex[:8]}"))
        conn.commit()

        schedule_id = str(uuid.uuid4())
        past_due = datetime.now(timezone.utc) - timedelta(days=1)
        cur.execute("""
            INSERT INTO asset_maintenance_schedules
                (id, asset_id, title, frequency_type, frequency_value,
                 next_due, auto_create_work_order)
            VALUES (%s::uuid, %s::uuid, 'Skip Schedule', 'daily', 1,
                    %s, FALSE)
        """, (schedule_id, asset_id, past_due))
        conn.commit()
        cur.close()

        from asset_service.cron import tasks
        tasks.check_due_maintenance()

        cur = conn.cursor()
        cur.execute("SELECT id FROM asset_work_orders WHERE schedule_id = %s::uuid", (schedule_id,))
        wos = cur.fetchall()
        assert len(wos) == 0, f"Expected 0 work orders, got {len(wos)}"

        cur.execute("DELETE FROM asset_maintenance_schedules WHERE id = %s::uuid", (schedule_id,))
        cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
        conn.commit()
        cur.close()
    finally:
        conn.close()
