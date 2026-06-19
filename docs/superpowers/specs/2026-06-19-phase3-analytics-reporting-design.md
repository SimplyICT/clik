# Phase 3: Analytics, Reporting & Bulk Operations — Design Spec

## Overview

Phase 3 adds analytical dashboards, data export/import, and bulk operations to the asset management system. No new database tables — all queries operate on existing tables (`assets_v2`, `asset_work_orders`, `asset_maintenance_schedules`, `asset_cost_history`, `asset_audit_log`).

## Module: Reports

### Directory: `server/asset_service/reports/`

### DB Operations (`db.py`)

- `get_dashboard_kpis(conn)` — returns: total_assets, assets_by_status, assets_by_category, active_work_orders, overdue_maintenance_count, warranty_expiring_soon, total_costs
- `get_warranty_report(conn, days=30)` — assets with warranty_expiry_date within the next N days
- `get_maintenance_overdue(conn)` — schedules where next_due < NOW() and status is active
- `export_assets_csv(conn)` — all assets as list of dicts for CSV conversion
- `export_work_orders_csv(conn, filters)` — work orders as list of dicts
- `export_costs_csv(conn, filters)` — cost history as list of dicts

### API Routes (`routes.py`)

- `GET /api/asset-management/reports/dashboard` — KPIs (no auth restriction, all users can see)
- `GET /api/asset-management/reports/warranty` — warranty report (query param: `days`, default 30)
- `GET /api/asset-management/reports/maintenance-overdue` — overdue maintenance
- `GET /api/asset-management/reports/export` — CSV export (query param: `type` = assets|work_orders|costs, returns CSV content with `text/csv` content type)

### Tests (`test_reports.py`)

Follow existing test patterns. Test KPI queries against real DB data.

## Module: Import

### Directory: `server/asset_service/imports/`

### DB Operations (`db.py`)

- `parse_csv(content, delimiter=',')` — parse CSV text into list of dicts
- `validate_asset_import_row(row)` — validate required fields, return errors
- `import_assets(conn, rows, user_id)` — batch insert validated rows, return counts (imported, skipped, errors)

### API Routes (`routes.py`)

- `POST /api/asset-management/reports/import` — admin only, accepts CSV file content as JSON `{"csv_content": "...", "import_type": "assets"}`, validates and imports
- `GET /api/asset-management/reports/import/template` — returns sample CSV header row for asset imports

### Models (`models.py`)

- `ImportRequest` — csv_content (str), import_type (str = "assets")

### Tests (`test_imports.py`)

Test CSV parsing, validation, and import logic.

## Module: Bulk Operations

No new module directory. Add to `server/asset_service/routes.py` and `server/asset_service/db.py`.

### DB Operations (in `db.py`)

- `bulk_update_status(conn, asset_ids, status, user_id)` — update status for multiple assets, log audit events
- `bulk_transfer(conn, asset_ids, customer_id, location_id, user_id)` — transfer multiple assets, log audit events
- `bulk_assign_contractor(conn, asset_ids, contractor_id, user_id)` — assign contractor to multiple assets, log audit events

### API Routes (in `routes.py`)

- `POST /api/asset-management/assets/bulk/status` — admin only, body: `{"asset_ids": [...], "status": "..."}`
- `POST /api/asset-management/assets/bulk/transfer` — admin only, body: `{"asset_ids": [...], "customer_id": "...", "location_id": "..."}`
- `POST /api/asset-management/assets/bulk/assign` — admin only, body: `{"asset_ids": [...], "contractor_id": "..."}`

### Tests (`test_asset_management.py`)

Add test methods for bulk operations. Follow existing test patterns.

## Implementation Order

1. Reports module (KPIs, warranty, overdue, export)
2. Import module (CSV parse, validate, import)
3. Bulk operations (status, transfer, assign)
