# Phase 2: Maintenance & Work Orders — Design Spec

## Overview

Extend the asset management system with maintenance scheduling and work order management, following the same modular architecture established in Phase 1. Each subsystem is a sub-module under `server/asset_service/`.

## Module: Maintenance Schedules

### Directory: `server/asset_service/maintenance/`

### Models

- **MaintenanceScheduleCreate:** asset_id, title, description, frequency_type (daily/weekly/monthly/yearly/hours_run/meter_reading), frequency_value, next_due, assigned_contractor_id, auto_create_work_order
- **MaintenanceScheduleUpdate:** all optional fields for PATCH

### DB Operations (`db.py`)

- `create_schedule(conn, data, user_id)` — insert new schedule
- `get_schedule(conn, schedule_id)` — get by ID
- `list_schedules(conn, asset_id=None)` — list all or filter by asset
- `update_schedule(conn, schedule_id, data)` — update fields
- `delete_schedule(conn, schedule_id)` — hard delete
- `get_due_schedules(conn)` — schedules where next_due <= NOW() (for cron)

### API Routes (`routes.py`)

- `GET /api/asset-management/maintenance` — list schedules
- `GET /api/asset-management/maintenance/{schedule_id}` — get schedule
- `POST /api/asset-management/maintenance` — create schedule
- `PATCH /api/asset-management/maintenance/{schedule_id}` — update schedule
- `DELETE /api/asset-management/maintenance/{schedule_id}` — admin only

## Module: Work Orders

### Directory: `server/asset_service/work_orders/`

### Models

- **WorkOrderCreate:** asset_id, schedule_id (optional), type (preventive/corrective/inspection/emergency), title, description, priority, assigned_contractor_id, scheduled_date
- **WorkOrderUpdate:** all optional fields including status transitions, completion data, costs, notes

### DB Operations (`db.py`)

- `create_work_order(conn, data, user_id)` — insert with created_by
- `get_work_order(conn, wo_id)` — get by ID
- `list_work_orders(conn, asset_id=None, status=None, contractor_id=None)` — filterable list
- `update_work_order(conn, wo_id, data)` — update fields
- `delete_work_order(conn, wo_id)` — hard delete, admin only

### API Routes (`routes.py`)

- `GET /api/asset-management/work-orders` — list with filters
- `GET /api/asset-management/work-orders/{wo_id}` — get work order
- `POST /api/asset-management/work-orders` — create work order
- `PATCH /api/asset-management/work-orders/{wo_id}` — update (status, costs, etc.)
- `DELETE /api/asset-management/work-orders/{wo_id}` — admin only
- `GET /api/asset-management/assets/{asset_id}/work-orders` — list by asset

## Module: Cron / Background Jobs

### Directory: `server/asset_service/cron/`

### Tasks (`tasks.py`)

- `check_due_maintenance()` — queries `get_due_schedules()`, for each schedule with `auto_create_work_order=True`, creates a work order, logs audit event, sends notification, updates schedule's `last_completed` and `next_due`

### Scheduler Integration

- Add a method in `server/scheduler.py` to register the cron job (runs hourly)
- The existing APScheduler is already initialized in `fastapi_app.py`

## Testing

Each module gets a test file in `server/tests/`:
- `test_maintenance.py` — model validation, DB CRUD, API endpoints, auth checks
- `test_work_orders.py` — model validation, DB CRUD, API endpoints, auth/permission checks
- `test_cron.py` — due schedule detection, work order auto-creation, notification trigger

Tests follow the same pattern as Phase 1 (direct DB helpers, TestClient for API tests).

## Implementation Order

1. Maintenance module (models → DB → routes → tests)
2. Work orders module (models → DB → routes → tests)
3. Cron/background jobs (tasks → scheduler integration → tests)
