# Asset Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone asset management module with full lifecycle tracking, QR codes, parts inventory, and cross-app support (admin, mobile, customer portal).

**Architecture:** New `server/asset_service/` module within the existing FastAPI server with its own DB tables (assets_v2, asset_parts, asset_part_usage, asset_custom_field_defs). Reuses existing auth, Supabase connection, and request lifecycle. New API prefix `/api/asset-management/*`.

**Tech Stack:** FastAPI (Python), Supabase PostgreSQL, React (Vite) for all three frontends, qrcode (Python library for QR generation)

---

### Task 1: Database Schema — New Tables

**Files:**
- Create: `server/asset_service/schema.sql` (reference SQL for Supabase)
- Run via Supabase dashboard SQL editor

- [ ] **Step 1: Write the schema SQL**

```sql
-- assets_v2: Core asset table
CREATE TABLE public.assets_v2 (
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
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_location_id UUID REFERENCES public.customer_locations(id) ON DELETE SET NULL,
    assigned_contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
    parent_asset_id UUID REFERENCES public.assets_v2(id) ON DELETE SET NULL,
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
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- asset_custom_field_defs: Manager-defined field schemas per category
CREATE TABLE public.asset_custom_field_defs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options JSONB,
    required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(category, field_name)
);

-- asset_parts: Parts inventory
CREATE TABLE public.asset_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID REFERENCES public.assets_v2(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'each',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- asset_part_usage: Parts consumed during jobs
CREATE TABLE public.asset_part_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    part_id UUID REFERENCES public.asset_parts(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add asset_id to existing requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets_v2(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_assets_v2_customer_id ON public.assets_v2(customer_id);
CREATE INDEX idx_assets_v2_contractor_id ON public.assets_v2(assigned_contractor_id);
CREATE INDEX idx_assets_v2_category ON public.assets_v2(category);
CREATE INDEX idx_assets_v2_status ON public.assets_v2(status);
CREATE INDEX idx_assets_v2_qr_code ON public.assets_v2(qr_code);
CREATE INDEX idx_asset_parts_sku ON public.asset_parts(sku);
CREATE INDEX idx_asset_part_usage_request ON public.asset_part_usage(request_id);
CREATE INDEX idx_requests_asset_id ON public.requests(asset_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_assets_v2_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_assets_v2_updated_at
    BEFORE UPDATE ON public.assets_v2
    FOR EACH ROW EXECUTE FUNCTION update_assets_v2_updated_at();
```

- [ ] **Step 2: Run SQL in Supabase dashboard**

Run the SQL above in Supabase SQL editor. Verify tables created.

- [ ] **Step 3: Add assets_v2 to ALLOWED_TABLES**

In `server/fastapi_app.py`, add `"assets_v2"` to the `ALLOWED_TABLES` set alongside `"assets"`.

---

### Task 2: Backend — Asset Service Module

**Files:**
- Create: `server/asset_service/__init__.py`
- Create: `server/asset_service/models.py`
- Create: `server/asset_service/qr.py`
- Create: `server/asset_service/db.py`
- Create: `server/asset_service/routes.py`
- Modify: `server/fastapi_app.py` (register router)

- [ ] **Step 1: Create package and dependencies**

```bash
pip install qrcode[pil]
```

Create `server/asset_service/__init__.py`:
```python
```

- [ ] **Step 2: Create models.py** — Pydantic schemas for request/response

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

class AssetCreate(BaseModel):
    asset_name: str
    asset_code: str
    category: str = "Other"
    sub_category: Optional[str] = None
    status: str = "Active"
    criticality: str = "Medium"
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_location_id: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    parent_asset_id: Optional[str] = None
    install_date: Optional[date] = None
    purchase_date: Optional[date] = None
    warranty_expiry_date: Optional[date] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None

class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    status: Optional[str] = None
    criticality: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_location_id: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    install_date: Optional[date] = None
    purchase_date: Optional[date] = None
    warranty_expiry_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None
    photo_urls: Optional[List[str]] = None

class AssetResponse(BaseModel):
    id: str
    asset_name: str
    asset_code: str
    qr_code: str
    category: str
    sub_category: Optional[str] = None
    status: str
    lifecycle_status: str
    criticality: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_location_id: Optional[str] = None
    customer_location_name: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    assigned_contractor_name: Optional[str] = None
    parent_asset_id: Optional[str] = None
    install_date: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    last_service_date: Optional[str] = None
    next_service_date: Optional[str] = None
    photo_urls: List[str] = []
    custom_fields: dict = {}
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class PartCreate(BaseModel):
    asset_id: Optional[str] = None
    name: str
    sku: str
    quantity: int = 0
    min_threshold: int = 0
    unit: str = "each"

class PartUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    min_threshold: Optional[int] = None
    unit: Optional[str] = None

class PartUsageRecord(BaseModel):
    part_id: str
    request_id: str
    quantity: int

class JobCreate(BaseModel):
    job_type: str  # install, move, retire, inspect, repair, transfer
    description: Optional[str] = None
    priority: Optional[str] = "medium"

class CustomFieldDefCreate(BaseModel):
    category: str
    field_name: str
    field_label: str
    field_type: str = "text"
    options: Optional[list] = None
    required: bool = False
    sort_order: int = 0
```

- [ ] **Step 3: Create qr.py** — QR code generation

```python
import qrcode
from io import BytesIO
import base64

def generate_qr_code(asset_id: str, base_url: str = "") -> str:
    """Generate QR code PNG and return as base64 string."""
    url = f"{base_url}/mobile/asset/{asset_id}" if base_url else asset_id
    img = qrcode.make(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

def generate_qr_bytes(asset_id: str, base_url: str = "") -> bytes:
    """Generate QR code and return raw PNG bytes."""
    url = f"{base_url}/mobile/asset/{asset_id}" if base_url else asset_id
    img = qrcode.make(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
```

- [ ] **Step 4: Create db.py** — Database query functions

```python
import os
import pg8000.native
from typing import Optional, List
from uuid import uuid4
from datetime import date

DB_CONFIG = {
    "host": os.getenv("SUPABASE_DB_HOST"),
    "port": int(os.getenv("SUPABASE_DB_PORT", "5432")),
    "database": os.getenv("SUPABASE_DB_NAME", "postgres"),
    "user": os.getenv("SUPABASE_DB_USER"),
    "password": os.getenv("SUPABASE_DB_PASSWORD"),
}

def get_conn():
    return pg8000.native.Connection(**DB_CONFIG)

ASSET_COLS = [
    "id", "asset_name", "asset_code", "qr_code", "category", "sub_category",
    "status", "lifecycle_status", "criticality", "manufacturer", "model",
    "serial_number", "customer_id", "customer_location_id",
    "assigned_contractor_id", "parent_asset_id",
    "install_date", "purchase_date", "warranty_expiry_date",
    "last_service_date", "next_service_date",
    "photo_urls", "custom_fields", "notes", "created_at", "updated_at", "created_by",
]

def row_to_asset(row):
    return {
        "id": str(row[0]),
        "asset_name": row[1],
        "asset_code": row[2],
        "qr_code": row[3],
        "category": row[4],
        "sub_category": row[5],
        "status": row[6],
        "lifecycle_status": row[7],
        "criticality": row[8],
        "manufacturer": row[9],
        "model": row[10],
        "serial_number": row[11],
        "customer_id": str(row[12]) if row[12] else None,
        "customer_location_id": str(row[13]) if row[13] else None,
        "assigned_contractor_id": str(row[14]) if row[14] else None,
        "parent_asset_id": str(row[15]) if row[15] else None,
        "install_date": str(row[16]) if row[16] else None,
        "purchase_date": str(row[17]) if row[17] else None,
        "warranty_expiry_date": str(row[18]) if row[18] else None,
        "last_service_date": str(row[19]) if row[19] else None,
        "next_service_date": str(row[20]) if row[20] else None,
        "photo_urls": row[21] if row[21] else [],
        "custom_fields": row[22] if row[22] else {},
        "notes": row[23],
        "created_at": str(row[24]) if row[24] else None,
        "updated_at": str(row[25]) if row[25] else None,
        "created_by": str(row[26]) if row[26] else None,
    }

def list_assets(conn, filters: dict = None):
    query = "SELECT " + ", ".join(ASSET_COLS) + " FROM assets_v2 WHERE 1=1"
    params = []
    if filters:
        if filters.get("category"):
            query += " AND category = :category"
            params.append(filters["category"])
        if filters.get("status"):
            query += " AND status = :status"
            params.append(filters["status"])
        if filters.get("customer_id"):
            query += " AND customer_id = :customer_id"
            params.append(filters["customer_id"])
        if filters.get("contractor_id"):
            query += " AND assigned_contractor_id = :contractor_id"
            params.append(filters["contractor_id"])
        if filters.get("search"):
            query += " AND (asset_name ILIKE :search OR asset_code ILIKE :search OR serial_number ILIKE :search)"
            params.append(f"%{filters['search']}%")
    query += " ORDER BY asset_name ASC"
    result = conn.run(query, *params)
    return [row_to_asset(r) for r in result]

def get_asset(conn, asset_id: str):
    query = "SELECT " + ", ".join(ASSET_COLS) + " FROM assets_v2 WHERE id = :id"
    result = conn.run(query, asset_id)
    return row_to_asset(result[0]) if result else None

def create_asset(conn, data: dict, user_id: str):
    asset_id = str(uuid4())
    qr_code = data.get("qr_code", asset_id[:8].upper())
    cols = ["id", "qr_code", "created_by"]
    vals = [asset_id, qr_code, user_id]
    for key in ["asset_name", "asset_code", "category", "sub_category", "status",
                "criticality", "manufacturer", "model", "serial_number",
                "customer_id", "customer_location_id", "assigned_contractor_id",
                "parent_asset_id", "install_date", "purchase_date",
                "warranty_expiry_date", "notes", "custom_fields"]:
        if key in data and data[key] is not None:
            cols.append(key)
            vals.append(data[key])
    placeholders = ", ".join([f":{c}" for c in cols])
    col_names = ", ".join(cols)
    conn.run(f"INSERT INTO assets_v2 ({col_names}) VALUES ({placeholders})", *vals)
    return get_asset(conn, asset_id)

def update_asset(conn, asset_id: str, data: dict):
    set_clauses = []
    vals = []
    for key, val in data.items():
        if val is not None and key in ASSET_COLS:
            set_clauses.append(f"{key} = :{key}")
            vals.append(val)
    if not set_clauses:
        return get_asset(conn, asset_id)
    vals.append(asset_id)
    conn.run(f"UPDATE assets_v2 SET {', '.join(set_clauses)} WHERE id = :id", *vals)
    return get_asset(conn, asset_id)

def retire_asset(conn, asset_id: str):
    conn.run("UPDATE assets_v2 SET status = 'Retired', lifecycle_status = 'retired' WHERE id = :id", asset_id)
    return get_asset(conn, asset_id)

def transfer_asset(conn, asset_id: str, new_customer_id: str, new_location_id: str = None):
    conn.run("UPDATE assets_v2 SET customer_id = :cid, lifecycle_status = 'transferred' WHERE id = :id", new_customer_id, asset_id)
    if new_location_id:
        conn.run("UPDATE assets_v2 SET customer_location_id = :lid WHERE id = :id", new_location_id, asset_id)
    return get_asset(conn, asset_id)

def list_parts(conn, asset_id: str = None):
    if asset_id:
        result = conn.run("SELECT * FROM asset_parts WHERE asset_id = :aid OR asset_id IS NULL ORDER BY name", asset_id)
    else:
        result = conn.run("SELECT * FROM asset_parts ORDER BY name")
    return [dict(zip([c[0] for c in conn.columns], r)) for r in result]

def create_part(conn, data: dict):
    return conn.run(
        "INSERT INTO asset_parts (name, sku, quantity, min_threshold, unit, asset_id) VALUES (:name, :sku, :qty, :min, :unit, :aid) RETURNING *",
        data["name"], data["sku"], data.get("quantity", 0), data.get("min_threshold", 0), data.get("unit", "each"), data.get("asset_id")
    )

def record_part_usage(conn, part_id: str, request_id: str, quantity: int, user_id: str):
    conn.run("INSERT INTO asset_part_usage (part_id, request_id, quantity, used_by) VALUES (:pid, :rid, :qty, :uid)", part_id, request_id, quantity, user_id)
    conn.run("UPDATE asset_parts SET quantity = quantity - :qty WHERE id = :pid", quantity, part_id)

def list_asset_jobs(conn, asset_id: str):
    result = conn.run("SELECT * FROM requests WHERE asset_id = :aid ORDER BY created_at DESC", asset_id)
    return [dict(zip([c[0] for c in conn.columns], r)) for r in result]

def get_custom_field_defs(conn, category: str = None):
    if category:
        result = conn.run("SELECT * FROM asset_custom_field_defs WHERE category = :cat ORDER BY sort_order", category)
    else:
        result = conn.run("SELECT * FROM asset_custom_field_defs ORDER BY category, sort_order")
    return [dict(zip([c[0] for c in conn.columns], r)) for r in result]

def create_custom_field_def(conn, data: dict):
    return conn.run(
        "INSERT INTO asset_custom_field_defs (category, field_name, field_label, field_type, options, required, sort_order) VALUES (:cat, :fn, :fl, :ft, :opts, :req, :so) RETURNING *",
        data["category"], data["field_name"], data["field_label"], data.get("field_type", "text"),
        data.get("options"), data.get("required", False), data.get("sort_order", 0)
    )
```

- [ ] **Step 5: Create routes.py** — All asset management API routes

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from .models import (
    AssetCreate, AssetUpdate, PartCreate, PartUpdate,
    PartUsageRecord, JobCreate, CustomFieldDefCreate
)
from .db import (
    get_conn, list_assets, get_asset, create_asset, update_asset,
    retire_asset, transfer_asset, list_parts, create_part,
    record_part_usage, list_asset_jobs, get_custom_field_defs,
    create_custom_field_def
)
from .qr import generate_qr_bytes
from ..fastapi_app import require_session
import os

router = APIRouter(prefix="/api/asset-management", tags=["Asset Management"])
BASE_URL = os.getenv("APP_URL", "https://pwa.simplyclik.com")

@router.get("/assets")
def api_list_assets(
    category: str = None, status: str = None,
    customer_id: str = None, contractor_id: str = None,
    search: str = None, user=Depends(require_session)
):
    filters = {k: v for k, v in locals().items() if v and k != "user"}
    with get_conn() as conn:
        return list_assets(conn, filters)

@router.get("/assets/{asset_id}")
def api_get_asset(asset_id: str, user=Depends(require_session)):
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        return asset

@router.post("/assets")
def api_create_asset(data: AssetCreate, user=Depends(require_session)):
    with get_conn() as conn:
        return create_asset(conn, data.model_dump(exclude_none=True), user["id"])

@router.patch("/assets/{asset_id}")
def api_update_asset(asset_id: str, data: AssetUpdate, user=Depends(require_session)):
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        return update_asset(conn, asset_id, data.model_dump(exclude_none=True))

@router.post("/assets/{asset_id}/retire")
def api_retire_asset(asset_id: str, user=Depends(require_session)):
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        return retire_asset(conn, asset_id)

@router.post("/assets/{asset_id}/transfer")
def api_transfer_asset(asset_id: str, new_customer_id: str, new_location_id: str = None, user=Depends(require_session)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Only managers can transfer assets")
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        return transfer_asset(conn, asset_id, new_customer_id, new_location_id)

@router.get("/assets/{asset_id}/qr")
def api_asset_qr(asset_id: str, user=Depends(require_session)):
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
    png_bytes = generate_qr_bytes(asset_id, f"{BASE_URL}/mobile/asset")
    return Response(content=png_bytes, media_type="image/png")

@router.get("/assets/{asset_id}/jobs")
def api_asset_jobs(asset_id: str, user=Depends(require_session)):
    with get_conn() as conn:
        return list_asset_jobs(conn, asset_id)

@router.post("/assets/{asset_id}/create-job")
def api_create_asset_job(asset_id: str, job: JobCreate, user=Depends(require_session)):
    with get_conn() as conn:
        asset = get_asset(conn, asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        description = f"[{job.job_type.upper()}] {job.description or ''} - Asset: {asset['asset_name']} ({asset['asset_code']})"
        result = conn.run(
            "INSERT INTO requests (customer_id, customer_location_id, description, status, priority, asset_id, created_by) VALUES (:cid, :lid, :desc, :status, :priority, :aid, :uid) RETURNING *",
            asset["customer_id"], asset["customer_location_id"],
            description, "new", job.priority, asset_id, user["id"]
        )
        return dict(zip([c[0] for c in conn.columns], result[0]))

# ── Parts ──

@router.get("/parts")
def api_list_parts(user=Depends(require_session)):
    with get_conn() as conn:
        return list_parts(conn)

@router.post("/parts")
def api_create_part(data: PartCreate, user=Depends(require_session)):
    with get_conn() as conn:
        return create_part(conn, data.model_dump())

@router.patch("/parts/{part_id}")
def api_update_part(part_id: str, data: PartUpdate, user=Depends(require_session)):
    with get_conn() as conn:
        sets = {k: v for k, v in data.model_dump(exclude_none=True).items() if v is not None}
        if sets:
            conn.run(f"UPDATE asset_parts SET {', '.join(f'{k}=:{k}' for k in sets)} WHERE id=:id", *sets.values(), part_id)
        return conn.run("SELECT * FROM asset_parts WHERE id=:id", part_id)

@router.delete("/parts/{part_id}")
def api_delete_part(part_id: str, user=Depends(require_session)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Only managers can delete parts")
    with get_conn() as conn:
        conn.run("DELETE FROM asset_parts WHERE id=:id", part_id)
    return {"ok": True}

@router.post("/parts/record-usage")
def api_record_part_usage(record: PartUsageRecord, user=Depends(require_session)):
    with get_conn() as conn:
        record_part_usage(conn, record.part_id, record.request_id, record.quantity, user["id"])
    return {"ok": True}

# ── Custom Field Definitions ──

@router.get("/custom-fields")
def api_list_custom_fields(category: str = None, user=Depends(require_session)):
    with get_conn() as conn:
        return get_custom_field_defs(conn, category)

@router.post("/custom-fields")
def api_create_custom_field(data: CustomFieldDefCreate, user=Depends(require_session)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Only managers can define custom fields")
    with get_conn() as conn:
        return create_custom_field_def(conn, data.model_dump())
```

- [ ] **Step 6: Register router in fastapi_app.py**

In `server/fastapi_app.py`, add near other route registrations:
```python
from asset_service.routes import router as asset_management_router
app.include_router(asset_management_router)
```

Also add `"assets_v2"` to `ALLOWED_TABLES`.

- [ ] **Step 7: Write test and verify**

Create `server/tests/test_asset_management.py`:
```python
def test_asset_management_list(client):
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/asset-management/assets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_asset_management_create(client):
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.post("/api/asset-management/assets", json={
        "asset_name": "Test HVAC Unit",
        "asset_code": "HVAC-001",
        "category": "HVAC",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_name"] == "Test HVAC Unit"
    assert data["qr_code"] is not None
```

Run: `python -m pytest server/tests/test_asset_management.py -v`
Expected: PASS

---

### Task 3: Admin Portal — Asset Management Page

**Files:**
- Create: `web-admin/src/pages/AssetManagementPage.jsx`
- Modify: `web-admin/src/App.jsx` (update route)

- [ ] **Step 1: Create AssetManagementPage.jsx**

Full page with tabs: All Assets, Parts Inventory, Custom Fields, Audit Log.

Features:
- Asset list table with search/filter by category/status/customer
- Add/Edit modal with all fields including custom fields per category
- QR code display and print button
- Photo upload (reuse existing Supabase Storage pattern)
- Create Job button → opens modal with job type selector → calls create-job API
- Parts Inventory tab: parts table with CRUD, low-stock highlighting
- Custom Fields tab: manager-only field definition editor
- Audit Log tab: manager-only event list
- Permission-based UI: contractors see the same page but without delete/transfer/audit/custom-fields controls

Follow existing patterns in `web-admin/src/pages/CustomersPage.jsx` (modal-based CRUD, API calls via `client.js`).

- [ ] **Step 2: Update routing in App.jsx**

```diff
- import AssetsPage from './pages/AssetsPage';
+ import AssetManagementPage from './pages/AssetManagementPage';
```

Update the nav item:
```diff
- { path: '/assets', label: 'Assets' },
+ { path: '/assets', label: 'Asset Management' },
```

Update route component:
```diff
- <Route path="/assets" element={<AssetsPage />} />
+ <Route path="/assets" element={<AssetManagementPage />} />
```

Remove or archive the old `AssetsPage.jsx` if the new page fully replaces it.

---

### Task 4: Mobile PWA — Asset Management

**Files:**
- Create: `web-mobile/src/pages/AssetsPage.jsx` — asset list with QR scan button
- Create: `web-mobile/src/pages/AssetDetailPage.jsx` — full asset detail with actions
- Create: `web-mobile/src/pages/AssetFormPage.jsx` — create/edit form
- Create: `web-mobile/src/pages/QRScannerPage.jsx` — camera scanner
- Create: `web-mobile/src/pages/CreateJobPage.jsx` — job creation form
- Create: `web-mobile/src/pages/RecordPartsPage.jsx` — parts usage form
- Modify: `web-mobile/src/App.jsx` — add routes
- Modify: `web-mobile/src/api/client.js` — add asset management API calls

Follow existing mobile patterns in `web-mobile/src/pages/`.

- [ ] **Step 1: Create AssetsPage.jsx** — list with filters, pull-to-refresh, QR scan button in header
- [ ] **Step 2: Create AssetDetailPage.jsx** — full detail, photo gallery, action buttons (Create Job, Edit, Retire)
- [ ] **Step 3: Create AssetFormPage.jsx** — create/edit form with fields, custom fields per category, camera photo capture
- [ ] **Step 4: Create QRScannerPage.jsx** — camera-based scanner, navigates to asset detail on scan
- [ ] **Step 5: Create CreateJobPage.jsx** — select job type, add description, submit
- [ ] **Step 6: Create RecordPartsPage.jsx** — select parts, enter quantities, submit
- [ ] **Step 7: Update App.jsx** — add routes for all new pages, add "Assets" tab to dashboard

---

### Task 5: Customer Portal — My Assets

**Files:**
- Create: `web-portal/src/pages/MyAssetsPage.jsx`
- Modify: `web-portal/src/App.jsx` — add route

- [ ] **Step 1: Create MyAssetsPage.jsx** — list customer's assets (filtered by customer_id from session), view detail, add notes, request service (link to existing request creation)
- [ ] **Step 2: Update App.jsx**

```diff
+ import MyAssetsPage from './pages/MyAssetsPage';
```

Add to nav items:
```diff
+ { path: '/my-assets', label: 'My Assets' },
```

Add route:
```diff
+ <Route path="/my-assets" element={<MyAssetsPage />} />
```

---

### Task 6: E2E Smoke Test

- [ ] **Step 1: Run all existing tests**
```bash
python -m pytest server/tests/ -v
```

- [ ] **Step 2: Manual smoke test**
1. Login to admin portal → navigate to Asset Management
2. Create an asset with all fields including custom fields
3. View the QR code, verify it renders
4. Create a job from the asset → verify request created with asset_id
5. Add parts, record usage
6. Login to mobile → scan QR code → verify asset detail opens
7. Login to customer portal → verify asset visible with notes capability
