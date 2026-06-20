# Asset Management System — Design Spec

**Date:** 2026-06-15
**Status:** Draft
**Version:** 1.0

## Overview

A redesigned asset management system for SimplyClik, built as a standalone module within the existing FastAPI server. Supports full lifecycle management of physical equipment across admin, mobile, and customer portals.

## Roles & Permissions

| Role | Create | Edit | Retire | Delete | Transfer | Audit Log | Custom Fields |
|------|--------|------|--------|--------|----------|-----------|---------------|
| Admin/Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contractor | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Customer (their own) | ✗ | Notes only | ✗ | ✗ | ✗ | ✗ | ✗ |

## Architecture

- **Module:** `server/asset_service/` — standalone router within the existing FastAPI server
- **API prefix:** `/api/asset-management/*`
- **Auth:** Reuses existing `require_session` middleware
- **DB connection:** Reuses existing Supabase connection (pg8000)
- **Storage:** Reuses existing Supabase Storage for photos

## Database Schema

### New Tables

#### `assets_v2`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_name | text | |
| asset_code | text | Unique |
| qr_code | text | Unique, auto-generated |
| category | text | HVAC, Electrical, Plumbing, Fire, Security, Building, IT, Other |
| sub_category | text | |
| status | text | Active, Under Maintenance, Out of Service, Retired |
| lifecycle_status | text | active, retired, moved, transferred |
| criticality | text | Low, Medium, High |
| manufacturer | text | |
| model | text | |
| serial_number | text | |
| customer_id | UUID | FK to customers |
| customer_location_id | UUID | FK to customer_locations |
| assigned_contractor_id | UUID | FK to contractors, nullable |
| parent_asset_id | UUID | Self-referencing FK for component relationships, nullable |
| install_date | date | |
| purchase_date | date | |
| warranty_expiry_date | date | |
| last_service_date | date | |
| next_service_date | date | |
| photo_urls | text[] | Array of Supabase Storage URLs |
| custom_fields | jsonb | Category-specific fields |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| created_by | UUID | FK to users |

#### `asset_custom_field_defs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| category | text | Which asset category this applies to |
| field_name | text | e.g., "btu_rating" |
| field_label | text | e.g., "BTU Rating" |
| field_type | text | text, number, select, boolean |
| options | jsonb | For select type: array of choices |
| required | boolean | |
| sort_order | integer | |

#### `asset_parts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| asset_id | UUID | FK to assets_v2, nullable (generic parts) |
| name | text | |
| sku | text | |
| quantity | integer | Current stock |
| min_threshold | integer | Low-stock warning |
| unit | text | e.g., "each", "box", "liter" |
| created_at | timestamptz | |

#### `asset_part_usage`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| part_id | UUID | FK to asset_parts |
| request_id | UUID | FK to requests |
| quantity | integer | |
| used_by | UUID | FK to users |
| used_at | timestamptz | |

### Existing Table Changes

- `requests`: Add `asset_id` UUID (nullable FK to assets_v2)

## API Endpoints

### Assets (`/api/asset-management/assets`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assets` | All | List with filters (category, status, customer, contractor) |
| GET | `/assets/{id}` | All | Detail with service history |
| POST | `/assets` | Contractor+ | Create (auto-generates QR code) |
| PATCH | `/assets/{id}` | Contractor+ | Update |
| POST | `/assets/{id}/retire` | Contractor+ | Retire asset |
| POST | `/assets/{id}/transfer` | Manager | Transfer to different customer |
| GET | `/assets/{id}/qr` | All | Return QR code as PNG |

### Jobs (`/api/asset-management/assets/{id}/jobs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assets/{id}/jobs` | All | List all jobs for this asset |
| POST | `/assets/{id}/create-job` | Contractor+ | Create request linked to asset (type: install/move/retire/inspect/repair/transfer) |

### Parts (`/api/asset-management/parts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/parts` | All | List with filters |
| GET | `/parts/{id}` | All | Detail |
| POST | `/parts` | Contractor+ | Create |
| PATCH | `/parts/{id}` | Contractor+ | Update |
| DELETE | `/parts/{id}` | Manager | Delete |
| POST | `/parts/{id}/record-usage` | Contractor+ | Record parts consumed during a job |

## Admin Portal UI

Replaces the current `/assets` page with a full Asset Management hub:

- **All Assets** tab — table with search, filters by category/status/customer/contractor, QR preview
- **Asset Detail** — full detail with photo gallery, parts list, service history timeline, action buttons (Create Job, Edit, Retire, Transfer, Print QR)
- **Parts Inventory** — manage parts catalog, low-stock warnings, usage history
- **Custom Fields** — manager-only: define per-category custom field schemas
- **Audit Log** — manager-only: all lifecycle events

**Creator:** Add/edit asset modal/form with all fields including photo upload, category-specific custom fields, assigned contractor dropdown.

## Mobile PWA UI

New "Assets" tab in contractor dashboard alongside existing "Jobs" tab:

- **Asset List** — filterable list by category/status, QR scan button in header
- **Asset Detail** — all fields, photos, parts list, service history. Action buttons: Create Job, Edit, Retire
- **Create Asset** — form with all fields + camera photo capture. QR auto-generated
- **QR Scanner** — camera-based scan → opens asset detail
- **Create Job** — select job type, auto-links to asset, creates request
- **Record Parts** — during a job, select parts and quantities used

## Customer Portal UI

New "My Assets" nav item:

- **Asset List** — view their assets, filterable by location/category
- **Asset Detail** — view all fields, photos, service history, add notes
- **Request Service** — create maintenance request linked to asset

## QR Code System

- QR codes encode a URL: `{app-url}/asset/{asset_id}`
- Auto-generated on asset creation
- Scanned via mobile camera → opens asset detail in Mobile PWA
- Printable from admin portal (PNG download)
- No special hardware required

## Parts Inventory

- Parts can be generic (not tied to a specific asset) or asset-specific
- Contractors record usage during jobs via `record-usage` endpoint
- Low-stock warnings shown in admin portal when quantity < min_threshold

## Job Creation Flow

1. User views asset detail (any app)
2. Clicks "Create Job" → selects job type (install/move/retire/inspect/repair/transfer)
3. System creates a new request in the existing requests table with `asset_id` set
4. Existing request lifecycle handles the rest (assignment, status transitions, notifications, invoicing)

## Custom Fields (JSONB)

Category-specific fields stored in `custom_fields` JSONB column:

| Category | Fields |
|----------|--------|
| HVAC | BTU rating, refrigerant type, SEER rating, filter size |
| Electrical | Voltage, amperage, phase, panel size |
| Plumbing | Pipe size, material, pressure rating, flow rate |
| Fire | Type, capacity, inspection interval |
| Security | Camera type, resolution, recording duration, access control type |
| Building | Square footage, material, roof type, year built |
| IT | CPU, RAM, storage, OS version, IP address |

Custom field schemas defined by manager in admin portal, stored in `asset_custom_field_defs` table.
