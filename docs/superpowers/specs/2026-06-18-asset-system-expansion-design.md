# Asset System Expansion — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Version:** 1.0

## Overview

Comprehensive expansion of the SimplyClik asset management system from basic CRUD to a full enterprise asset management platform. This expansion adds lifecycle management, maintenance scheduling, work orders, document management, financial tracking, analytics/reporting, and field operations capabilities.

**Asset Types:** Facilities/HVAC equipment + general business assets (vehicles, tools, IT equipment)  
**Maintenance Model:** Preventive scheduling + reactive work orders  
**Financial Tracking:** Basic (purchase cost + replacement value + cost history)  
**Scope:** All areas — lifecycle, analytics, field operations

## Architecture

**Approach:** Modular extension of existing `asset_service` module

The existing `server/asset_service/` module provides the foundation (assets CRUD, parts, custom fields, QR codes). We extend it with sub-modules, each with its own routes and database operations, sharing the same FastAPI router and database connection.

### Module Structure

```
server/asset_service/
├── __init__.py
├── models.py              # Pydantic models (extended)
├── routes.py              # Existing asset/part routes
├── db.py                  # Existing asset/part DB operations
├── schema.sql             # Existing schema
├── qr.py                  # QR code generation
│
├── documents/             # NEW: Document management
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── maintenance/           # NEW: Maintenance scheduling
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── work_orders/           # NEW: Work order management
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── audit/                 # NEW: Audit trail
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── costs/                 # NEW: Financial tracking
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── reports/               # NEW: Analytics & reporting
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── imports/               # NEW: CSV import/export
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
└── cron/                  # NEW: Background jobs
    ├── scheduler.py
    └── tasks.py
```

**API Prefix:** All new endpoints under `/api/asset-management/*`  
**Auth:** Reuses existing `require_session` middleware  
**DB:** Reuses existing Supabase connection (pg8000)  
**Storage:** Reuses existing Supabase Storage for documents

## Database Schema

### Extensions to `assets_v2`

Add columns to existing table:

| Column | Type | Notes |
|--------|------|-------|
| purchase_cost | decimal(12,2) | Original purchase price |
| replacement_value | decimal(12,2) | Current estimated replacement value |
| depreciation_method | text | straight_line, none |
| useful_life_years | integer | For depreciation calculation |
| location_name | text | Denormalized for faster display |
| contractor_name | text | Denormalized for faster display |
| hours_run | decimal(10,2) | For equipment tracked by operating hours |
| meter_reading | decimal(10,2) | Odometer/hour meter reading |

### New Tables

#### `asset_documents`

File attachments (photos, manuals, certificates, inspection reports, PDFs).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2 |
| file_name | text | Original filename |
| file_url | text | Supabase Storage URL |
| file_type | text | photo, manual, certificate, inspection, other |
| file_size | integer | Bytes |
| mime_type | text | |
| uploaded_by | UUID | FK to users |
| created_at | timestamptz | |

#### `asset_maintenance_schedules`

Preventive maintenance rules (recurring schedules).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2 |
| title | text | e.g., "Replace air filter" |
| description | text | |
| frequency_type | text | daily, weekly, monthly, quarterly, annually, hours_run |
| frequency_value | integer | Every N units of frequency_type |
| last_completed | timestamptz | |
| next_due | timestamptz | Auto-calculated |
| assigned_contractor_id | UUID | FK, nullable |
| auto_create_work_order | boolean | Auto-create WO when due |
| created_by | UUID | |
| created_at | timestamptz | |

#### `asset_work_orders`

Maintenance work orders (both preventive and reactive).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2 |
| schedule_id | UUID | FK to maintenance_schedules, nullable (null = reactive) |
| type | text | preventive, reactive, inspection, repair, installation |
| title | text | |
| description | text | |
| priority | text | low, medium, high, urgent |
| status | text | pending, in_progress, completed, cancelled |
| assigned_contractor_id | UUID | FK, nullable |
| scheduled_date | date | |
| completed_date | date | |
| completed_by | UUID | FK to users |
| labor_hours | decimal(6,2) | |
| labor_cost | decimal(10,2) | |
| parts_cost | decimal(10,2) | Auto-calculated from part usage |
| total_cost | decimal(10,2) | labor + parts |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `asset_audit_log`

Real audit trail (replaces fake client-side audit log).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2 |
| event_type | text | created, updated, retired, transferred, status_changed, maintenance_completed, work_order_created, document_added, etc. |
| actor_id | UUID | Who did it |
| actor_name | text | Denormalized for fast display |
| details | jsonb | What changed (before/after values) |
| created_at | timestamptz | |

#### `asset_cost_history`

Financial tracking (purchase, improvements, maintenance costs).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2 |
| cost_type | text | purchase, improvement, maintenance, depreciation |
| amount | decimal(10,2) | |
| description | text | |
| recorded_date | date | |
| created_by | UUID | |
| created_at | timestamptz | |

### Indexes

```sql
CREATE INDEX idx_asset_documents_asset_id ON asset_documents(asset_id);
CREATE INDEX idx_asset_maintenance_schedules_asset_id ON asset_maintenance_schedules(asset_id);
CREATE INDEX idx_asset_maintenance_schedules_next_due ON asset_maintenance_schedules(next_due);
CREATE INDEX idx_asset_work_orders_asset_id ON asset_work_orders(asset_id);
CREATE INDEX idx_asset_work_orders_status ON asset_work_orders(status);
CREATE INDEX idx_asset_work_orders_assigned_contractor ON asset_work_orders(assigned_contractor_id);
CREATE INDEX idx_asset_audit_log_asset_id ON asset_audit_log(asset_id);
CREATE INDEX idx_asset_audit_log_created_at ON asset_audit_log(created_at);
CREATE INDEX idx_asset_cost_history_asset_id ON asset_cost_history(asset_id);
```

## API Endpoints

### Documents (`/api/asset-management/assets/{id}/documents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assets/{id}/documents` | All | List documents for asset |
| POST | `/assets/{id}/documents` | Contractor+ | Upload document (multipart form → Supabase Storage) |
| DELETE | `/documents/{doc_id}` | Manager | Delete document |
| GET | `/documents/{doc_id}/download` | All | Get signed download URL |

### Maintenance Schedules (`/api/asset-management/assets/{id}/schedules`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assets/{id}/schedules` | All | List schedules for asset |
| GET | `/schedules` | All | List all schedules (with `due_soon` filter) |
| POST | `/assets/{id}/schedules` | Contractor+ | Create schedule |
| PATCH | `/schedules/{id}` | Contractor+ | Update schedule |
| DELETE | `/schedules/{id}` | Manager | Delete schedule |
| POST | `/schedules/{id}/complete` | Contractor+ | Mark completed, auto-calculate next_due |

### Work Orders (`/api/asset-management/work-orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/work-orders` | All | List with filters (status, asset, contractor, type) |
| GET | `/work-orders/{id}` | All | Detail with parts used, labor |
| POST | `/work-orders` | Contractor+ | Create (manual or auto from schedule) |
| PATCH | `/work-orders/{id}` | Contractor+ | Update status, assign, etc. |
| POST | `/work-orders/{id}/complete` | Contractor+ | Complete WO, update asset status, log costs |
| GET | `/work-orders/{id}/parts` | All | List parts used in this WO |
| POST | `/work-orders/{id}/parts` | Contractor+ | Add parts to WO |

### Audit Log (`/api/asset-management/audit`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit` | Manager | List events with filters (asset_id, event_type, date range) |
| GET | `/assets/{id}/audit` | All | Events for specific asset |

### Costs (`/api/asset-management/assets/{id}/costs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assets/{id}/costs` | All | Cost history for asset |
| POST | `/assets/{id}/costs` | Manager | Record cost (purchase, improvement, maintenance) |
| GET | `/costs/summary` | Manager | Aggregated costs across all assets |

### Reports & Export (`/api/asset-management/reports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/dashboard` | All | KPIs: total assets, by status, by category, overdue maintenance, active WOs |
| GET | `/reports/export` | Contractor+ | CSV export (assets, work orders, costs) — `?type=assets&format=csv` |
| POST | `/reports/import` | Manager | CSV import with field mapping validation |
| GET | `/reports/import/template` | All | Download CSV template |
| GET | `/reports/warranty` | All | Assets with expiring/expired warranties |
| GET | `/reports/maintenance-overdue` | All | Assets with overdue maintenance |

### Bulk Operations (`/api/asset-management/assets/bulk`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/assets/bulk/status` | Manager | Bulk status change |
| POST | `/assets/bulk/transfer` | Manager | Bulk transfer to customer/location |
| POST | `/assets/bulk/assign` | Manager | Bulk assign contractor |

### QR Batch (`/api/asset-management/qr`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/qr/batch` | Contractor+ | Generate printable PDF with multiple QR codes |
| GET | `/qr/print/{asset_id}` | All | Single QR label (print-ready) |

## Background Jobs (Cron)

Lightweight cron tasks (run via existing server or separate script):

1. **Recalculate `next_due`** on maintenance schedules after completion
2. **Auto-create work orders** for schedules where `auto_create_work_order = true` and `next_due <= today`
3. **Warranty alerts** — flag assets where `warranty_expiry_date` is within 30 days
4. **Depreciation** — monthly recalculation of `replacement_value` for straight-line assets

**Implementation:** Use APScheduler or simple cron script that runs daily.

## Admin UI Changes

### New Tabs/Pages

1. **Dashboard tab**
   - KPI cards: total assets, active WOs, overdue maintenance, warranty expiring
   - Charts: assets by status/category, maintenance trends, cost trends

2. **Asset Detail page** (new route `/assets/:id`, replaces modal)
   - Photo gallery with upload
   - Document list (manuals, certificates, inspection reports)
   - Maintenance schedules
   - Work order history
   - Cost history
   - Audit trail
   - Child assets (parent-child hierarchy via existing `parent_asset_id`)
   - Tabs or sections for each area (details, documents, maintenance, work orders, costs, audit)

3. **Work Orders tab**
   - Kanban board (pending → in_progress → completed)
   - List view toggle
   - Filters: status, asset, contractor, type, date range

4. **Maintenance tab**
   - Calendar view of upcoming schedules
   - Overdue alerts
   - Schedule management

5. **Import/Export**
   - CSV upload with column mapping UI
   - Template download
   - Export assets, work orders, costs

6. **QR Batch**
   - Select assets → generate printable PDF labels

### Enhanced Asset Form

- Photo upload (multiple)
- Document upload
- Parent asset selection (hierarchy)
- Purchase cost, replacement value
- Depreciation method, useful life
- Hours run, meter reading

## Mobile UI Changes

### New Features

1. **Work Orders list**
   - Contractor sees assigned WOs
   - Update status (pending → in_progress → completed)
   - Add parts, record labor hours
   - Add notes/photos

2. **Offline support**
   - Cache asset list + detail for offline viewing
   - Sync changes when online (queue mutations)

3. **Camera integration**
   - Photo upload to asset documents directly from camera
   - QR scan → asset detail → quick actions

4. **Quick actions from asset detail**
   - Create WO
   - View maintenance schedule
   - Add photo
   - Record meter reading

## Portal UI Changes

### New Features

1. **My Work Orders**
   - Customers see WOs for their assets
   - View status, history

2. **Request Service**
   - Link service request to specific asset
   - Auto-create work order

3. **Asset Documents**
   - View photos/manuals for their assets

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Database:**
- Extend `assets_v2` with new columns
- Create `asset_documents`, `asset_audit_log`, `asset_cost_history` tables
- Run migrations

**Backend:**
- Implement documents module (upload, list, delete)
- Implement audit module (event logging)
- Implement costs module (record, list, summary)
- Wire audit logging into existing asset CRUD operations

**Admin UI:**
- Asset detail page (full page, not modal)
- Document upload/gallery
- Cost history view
- Audit trail view

**Mobile UI:**
- Photo upload from camera
- Document list view

### Phase 2: Maintenance & Work Orders (Week 3-4)

**Database:**
- Create `asset_maintenance_schedules`, `asset_work_orders` tables
- Run migrations

**Backend:**
- Implement maintenance module (schedules, completion, next_due calculation)
- Implement work orders module (create, assign, complete, parts usage)
- Implement cron jobs (auto-create WOs, warranty alerts)

**Admin UI:**
- Maintenance tab (calendar, schedule management)
- Work orders tab (kanban + list view)
- Asset detail: maintenance schedules, work order history

**Mobile UI:**
- Work orders list (contractor view)
- WO status updates, parts usage, labor recording
- Offline caching for asset list

### Phase 3: Analytics & Reporting (Week 5-6)

**Backend:**
- Implement reports module (dashboard KPIs, exports)
- Implement imports module (CSV upload, validation, mapping)
- Implement bulk operations
- Implement QR batch generation

**Admin UI:**
- Dashboard tab (KPI cards, charts)
- Import/Export UI (CSV upload, mapping, template download)
- QR batch UI (select assets, generate PDF)
- Warranty report, maintenance overdue report

**Mobile UI:**
- Offline sync
- QR scan → asset detail → quick actions

### Phase 4: Portal & Polish (Week 7-8)

**Portal UI:**
- My Work Orders page
- Request Service (linked to asset)
- Asset Documents view

**Polish:**
- Performance optimization (pagination, caching)
- Error handling improvements
- Documentation
- Testing (unit, integration, E2E)

## Testing Strategy

- **Unit tests:** All DB operations, business logic (next_due calculation, depreciation)
- **Integration tests:** API endpoints, file uploads, CSV import/export
- **E2E tests:** Critical user flows (create asset → schedule maintenance → complete WO)
- **Mobile tests:** Offline sync, camera integration, QR scanning

## Security Considerations

- File upload validation (size limits, MIME type checking)
- Supabase Storage signed URLs (no public access)
- Audit log immutability (no updates/deletes)
- Role-based access control (enforce at API level)
- CSV import validation (prevent injection)

## Performance Considerations

- Pagination on all list endpoints (default 50, max 500)
- Database indexes on frequently queried columns
- Caching for dashboard KPIs (5-minute TTL)
- Lazy loading for asset detail (documents, work orders, costs)
- Bulk operations: batch DB queries, not individual

## Migration Strategy

**Existing data:** No migration needed — new columns are nullable, new tables are additive.

**Backward compatibility:** Existing API endpoints remain unchanged. New endpoints are additive.

**Rollback plan:** New tables can be dropped, new columns can be made nullable. No destructive changes.
