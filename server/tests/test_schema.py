"""Tests for schema changes: Phase 1 (assets_v2 extensions, asset_documents, asset_audit_log, asset_cost_history) and Phase 2 (asset_maintenance_schedules, asset_work_orders)."""

import os
import pytest
import pg8000
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def get_test_conn():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        ssl_context=True,
    )


def _get_columns(conn, table_name):
    """Return a set of column names for the given table."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = %s
        """,
        (table_name,),
    )
    cols = {row[0] for row in cur.fetchall()}
    cur.close()
    return cols


def _table_exists(conn, table_name):
    """Return True if the table exists in the public schema."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table_name,),
    )
    count = cur.fetchone()[0]
    cur.close()
    return count > 0


class TestAssetsV2NewColumns:
    """Verify the 8 new columns on assets_v2."""

    EXPECTED_COLUMNS = {
        "purchase_cost",
        "replacement_value",
        "depreciation_method",
        "useful_life_years",
        "location_name",
        "contractor_name",
        "hours_run",
        "meter_reading",
    }

    def test_all_new_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"assets_v2 is missing columns: {missing}"
        finally:
            conn.close()

    def test_purchase_cost_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "purchase_cost" in cols
        finally:
            conn.close()

    def test_replacement_value_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "replacement_value" in cols
        finally:
            conn.close()

    def test_depreciation_method_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "depreciation_method" in cols
        finally:
            conn.close()

    def test_useful_life_years_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "useful_life_years" in cols
        finally:
            conn.close()

    def test_location_name_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "location_name" in cols
        finally:
            conn.close()

    def test_contractor_name_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "contractor_name" in cols
        finally:
            conn.close()

    def test_hours_run_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "hours_run" in cols
        finally:
            conn.close()

    def test_meter_reading_column(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "assets_v2")
            assert "meter_reading" in cols
        finally:
            conn.close()


class TestAssetDocumentsTable:
    """Verify asset_documents table exists with correct columns."""

    EXPECTED_COLUMNS = {
        "id",
        "asset_id",
        "file_name",
        "file_url",
        "file_type",
        "file_size",
        "mime_type",
        "uploaded_by",
        "created_at",
    }

    def test_table_exists(self):
        conn = get_test_conn()
        try:
            assert _table_exists(conn, "asset_documents")
        finally:
            conn.close()

    def test_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "asset_documents")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"asset_documents is missing columns: {missing}"
        finally:
            conn.close()


class TestAssetAuditLogTable:
    """Verify asset_audit_log table exists with correct columns."""

    EXPECTED_COLUMNS = {
        "id",
        "asset_id",
        "event_type",
        "actor_id",
        "actor_name",
        "details",
        "created_at",
    }

    def test_table_exists(self):
        conn = get_test_conn()
        try:
            assert _table_exists(conn, "asset_audit_log")
        finally:
            conn.close()

    def test_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "asset_audit_log")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"asset_audit_log is missing columns: {missing}"
        finally:
            conn.close()


class TestAssetCostHistoryTable:
    """Verify asset_cost_history table exists with correct columns."""

    EXPECTED_COLUMNS = {
        "id",
        "asset_id",
        "cost_type",
        "amount",
        "description",
        "recorded_date",
        "created_by",
        "created_at",
    }

    def test_table_exists(self):
        conn = get_test_conn()
        try:
            assert _table_exists(conn, "asset_cost_history")
        finally:
            conn.close()

    def test_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "asset_cost_history")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"asset_cost_history is missing columns: {missing}"
        finally:
            conn.close()


class TestAssetMaintenanceSchedulesTable:
    """Verify asset_maintenance_schedules table exists with correct columns."""

    EXPECTED_COLUMNS = {
        "id",
        "asset_id",
        "title",
        "description",
        "frequency_type",
        "frequency_value",
        "last_completed",
        "next_due",
        "assigned_contractor_id",
        "auto_create_work_order",
        "created_by",
        "created_at",
    }

    def test_table_exists(self):
        conn = get_test_conn()
        try:
            assert _table_exists(conn, "asset_maintenance_schedules")
        finally:
            conn.close()

    def test_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "asset_maintenance_schedules")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"asset_maintenance_schedules is missing columns: {missing}"
        finally:
            conn.close()


class TestAssetWorkOrdersTable:
    """Verify asset_work_orders table exists with correct columns."""

    EXPECTED_COLUMNS = {
        "id",
        "asset_id",
        "schedule_id",
        "type",
        "title",
        "description",
        "priority",
        "status",
        "assigned_contractor_id",
        "scheduled_date",
        "completed_date",
        "completed_by",
        "labor_hours",
        "labor_cost",
        "parts_cost",
        "total_cost",
        "notes",
        "created_at",
        "updated_at",
    }

    def test_table_exists(self):
        conn = get_test_conn()
        try:
            assert _table_exists(conn, "asset_work_orders")
        finally:
            conn.close()

    def test_columns_exist(self):
        conn = get_test_conn()
        try:
            cols = _get_columns(conn, "asset_work_orders")
            missing = self.EXPECTED_COLUMNS - cols
            assert not missing, f"asset_work_orders is missing columns: {missing}"
        finally:
            conn.close()
