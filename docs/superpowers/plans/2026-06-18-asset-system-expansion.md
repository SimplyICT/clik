# Asset System Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the SimplyClik asset management system from basic CRUD to a full enterprise platform with lifecycle management, maintenance scheduling, work orders, document management, financial tracking, analytics/reporting, and field operations.

**Architecture:** Modular extension of existing `server/asset_service/` module. Each subsystem (documents, maintenance, work_orders, audit, costs, reports, imports) is a sub-module with its own routes, DB operations, and models, all sharing the same FastAPI router and database connection.

**Tech Stack:** Python 3.11, FastAPI, pg8000 (PostgreSQL), Supabase Storage, React 18, Vite, React Router

---

## File Structure

```
server/asset_service/
├── __init__.py                    # Module init
├── models.py                      # Existing Pydantic models (extended)
├── routes.py                      # Existing asset/part routes
├── db.py                          # Existing asset/part DB operations
├── schema.sql                     # Existing schema
├── qr.py                          # QR code generation
│
├── documents/                     # NEW: Document management
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── maintenance/                   # NEW: Maintenance scheduling
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── work_orders/                   # NEW: Work order management
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── audit/                         # NEW: Audit trail
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── costs/                         # NEW: Financial tracking
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── reports/                       # NEW: Analytics & reporting
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
├── imports/                       # NEW: CSV import/export
│   ├── __init__.py
│   ├── routes.py
│   ├── db.py
│   └── models.py
│
└── cron/                          # NEW: Background jobs
    ├── __init__.py
    ├── scheduler.py
    └── tasks.py

server/tests/
├── test_documents.py
├── test_maintenance.py
├── test_work_orders.py
├── test_audit.py
├── test_costs.py
├── test_reports.py
└── test_imports.py

web-admin/src/pages/
├── AssetDetailPage.jsx            # NEW: Full asset detail page
├── WorkOrdersPage.jsx             # NEW: Work orders kanban/list
├── MaintenancePage.jsx            # NEW: Maintenance schedules
├── DashboardPage.jsx              # NEW: KPI dashboard
└── ImportExportPage.jsx           # NEW: CSV import/export

web-mobile/src/pages/
├── WorkOrdersListPage.jsx         # NEW: Contractor WO list
└── WorkOrderDetailPage.jsx        # NEW: WO detail/actions

web-portal/src/pages/
├── MyWorkOrdersPage.jsx           # NEW: Customer WO view
└── AssetDocumentsView.jsx         # NEW: Customer asset docs
```

---

# Phase 1: Core Infrastructure (Documents, Audit, Costs)

## Task 1.1: Database Schema - Extend assets_v2

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for new columns**

```python
# server/tests/test_schema.py
import pytest
import pg8000
import os

def get_test_conn():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        ssl_context=True,
    )

def test_assets_v2_has_new_columns():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'assets_v2'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "purchase_cost" in columns
    assert "replacement_value" in columns
    assert "depreciation_method" in columns
    assert "useful_life_years" in columns
    assert "location_name" in columns
    assert "contractor_name" in columns
    assert "hours_run" in columns
    assert "meter_reading" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_assets_v2_has_new_columns -v
```

Expected: FAIL (columns don't exist yet)

- [ ] **Step 3: Add ALTER TABLE statements to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

-- Phase 1: Extend assets_v2 with new columns
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS replacement_value DECIMAL(12,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS depreciation_method TEXT DEFAULT 'none';
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS useful_life_years INTEGER;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS contractor_name TEXT;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS hours_run DECIMAL(10,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS meter_reading DECIMAL(10,2);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_assets_v2_has_new_columns -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: extend assets_v2 with financial and operational columns"
```

---

## Task 1.2: Database Schema - Create asset_documents table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for asset_documents table**

```python
# Add to server/tests/test_schema.py

def test_asset_documents_table_exists():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'asset_documents'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "id" in columns
    assert "asset_id" in columns
    assert "file_name" in columns
    assert "file_url" in columns
    assert "file_type" in columns
    assert "file_size" in columns
    assert "mime_type" in columns
    assert "uploaded_by" in columns
    assert "created_at" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_asset_documents_table_exists -v
```

Expected: FAIL

- [ ] **Step 3: Add CREATE TABLE to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

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
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset_id ON asset_documents(asset_id);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_asset_documents_table_exists -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: create asset_documents table"
```

---

## Task 1.3: Database Schema - Create asset_audit_log table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for asset_audit_log table**

```python
# Add to server/tests/test_schema.py

def test_asset_audit_log_table_exists():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'asset_audit_log'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "id" in columns
    assert "asset_id" in columns
    assert "event_type" in columns
    assert "actor_id" in columns
    assert "actor_name" in columns
    assert "details" in columns
    assert "created_at" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_asset_audit_log_table_exists -v
```

Expected: FAIL

- [ ] **Step 3: Add CREATE TABLE to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

CREATE TABLE IF NOT EXISTS asset_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    actor_id UUID,
    actor_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_audit_log_asset_id ON asset_audit_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_audit_log_created_at ON asset_audit_log(created_at);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_asset_audit_log_table_exists -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: create asset_audit_log table"
```

---

## Task 1.4: Database Schema - Create asset_cost_history table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for asset_cost_history table**

```python
# Add to server/tests/test_schema.py

def test_asset_cost_history_table_exists():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'asset_cost_history'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "id" in columns
    assert "asset_id" in columns
    assert "cost_type" in columns
    assert "amount" in columns
    assert "description" in columns
    assert "recorded_date" in columns
    assert "created_by" in columns
    assert "created_at" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_asset_cost_history_table_exists -v
```

Expected: FAIL

- [ ] **Step 3: Add CREATE TABLE to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

CREATE TABLE IF NOT EXISTS asset_cost_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    cost_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    recorded_date DATE NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_cost_history_asset_id ON asset_cost_history(asset_id);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_asset_cost_history_table_exists -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: create asset_cost_history table"
```

---

## Task 1.5: Documents Module - Pydantic Models

**Files:**
- Create: `server/asset_service/documents/__init__.py`
- Create: `server/asset_service/documents/models.py`
- Test: `server/tests/test_documents.py`

- [ ] **Step 1: Create documents module directory**

```bash
mkdir -p server/asset_service/documents
touch server/asset_service/documents/__init__.py
```

- [ ] **Step 2: Write test for DocumentCreate model**

```python
# server/tests/test_documents.py
from asset_service.documents.models import DocumentCreate

def test_document_create_model():
    doc = DocumentCreate(
        asset_id="123e4567-e89b-12d3-a456-426614174000",
        file_name="manual.pdf",
        file_url="https://storage.example.com/manual.pdf",
        file_type="manual",
        file_size=1024000,
        mime_type="application/pdf",
    )
    assert doc.asset_id == "123e4567-e89b-12d3-a456-426614174000"
    assert doc.file_name == "manual.pdf"
    assert doc.file_type == "manual"
    assert doc.file_size == 1024000
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && pytest tests/test_documents.py::test_document_create_model -v
```

Expected: FAIL (ModuleNotFoundError)

- [ ] **Step 4: Implement DocumentCreate model**

```python
# server/asset_service/documents/models.py
from pydantic import BaseModel
from typing import Optional

class DocumentCreate(BaseModel):
    asset_id: str
    file_name: str
    file_url: str
    file_type: str = "other"
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_documents.py::test_document_create_model -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/documents/ server/tests/test_documents.py
git commit -m "feat: add DocumentCreate pydantic model"
```

---

## Task 1.6: Documents Module - Database Operations

**Files:**
- Create: `server/asset_service/documents/db.py`
- Test: `server/tests/test_documents.py`

- [ ] **Step 1: Write test for create_document**

```python
# Add to server/tests/test_documents.py
import pg8000
import os
from asset_service.documents import db as doc_db
from uuid import uuid4

def get_test_conn():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        ssl_context=True,
    )

def test_create_document():
    conn = get_test_conn()
    
    # Create test asset first
    asset_id = str(uuid4())
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO assets_v2 (id, asset_name, asset_code, qr_code, category, status, criticality)
        VALUES (%s::uuid, 'Test Asset', 'TEST-001', 'qr-123', 'Other', 'Active', 'Medium')
    """, (asset_id,))
    conn.commit()
    
    # Create document
    doc_data = {
        "asset_id": asset_id,
        "file_name": "manual.pdf",
        "file_url": "https://storage.example.com/manual.pdf",
        "file_type": "manual",
        "file_size": 1024000,
        "mime_type": "application/pdf",
    }
    doc = doc_db.create_document(conn, doc_data, user_id="test-user")
    conn.commit()
    
    assert doc is not None
    assert doc["file_name"] == "manual.pdf"
    assert doc["file_type"] == "manual"
    assert doc["asset_id"] == asset_id
    
    # Cleanup
    cur.execute("DELETE FROM asset_documents WHERE id = %s::uuid", (doc["id"],))
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    conn.commit()
    cur.close()
    conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_documents.py::test_create_document -v
```

Expected: FAIL (ModuleNotFoundError or AttributeError)

- [ ] **Step 3: Implement document DB operations**

```python
# server/asset_service/documents/db.py
import json
from uuid import uuid4

DOC_COLS = "id, asset_id, file_name, file_url, file_type, file_size, mime_type, uploaded_by, created_at"

def _row_to_doc(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "file_name": r[2],
        "file_url": r[3],
        "file_type": r[4],
        "file_size": r[5],
        "mime_type": r[6],
        "uploaded_by": str(r[7]) if r[7] else None,
        "created_at": r[8].isoformat() if r[8] else None,
    }

def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows

def list_documents(conn, asset_id):
    sql = f"SELECT {DOC_COLS} FROM asset_documents WHERE asset_id = %s::uuid ORDER BY created_at DESC"
    rows = _exec(conn, sql, (asset_id,))
    return [_row_to_doc(r) for r in rows]

def get_document(conn, doc_id):
    sql = f"SELECT {DOC_COLS} FROM asset_documents WHERE id = %s::uuid"
    rows = _exec(conn, sql, (doc_id,))
    if rows:
        return _row_to_doc(rows[0])
    return None

def create_document(conn, data, user_id=None):
    doc_id = str(uuid4())
    cols = ["id", "asset_id", "file_name", "file_url", "file_type", "file_size", "mime_type", "uploaded_by"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        doc_id,
        data["asset_id"],
        data["file_name"],
        data["file_url"],
        data.get("file_type", "other"),
        data.get("file_size"),
        data.get("mime_type"),
        user_id,
    ]
    sql = f"INSERT INTO asset_documents ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return get_document(conn, str(row[0]))

def delete_document(conn, doc_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_documents WHERE id = %s::uuid", (doc_id,))
    cur.close()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && pytest tests/test_documents.py::test_create_document -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/asset_service/documents/ server/tests/test_documents.py
git commit -m "feat: implement document database operations"
```

---

## Task 1.7: Documents Module - API Routes

**Files:**
- Create: `server/asset_service/documents/routes.py`
- Modify: `server/fastapi_app.py` (add router)
- Test: `server/tests/test_documents.py`

- [ ] **Step 1: Write test for document endpoints**

```python
# Add to server/tests/test_documents.py
from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)

def test_list_documents_endpoint():
    # Login first
    resp = client.post("/api/login", json={"email": "test@example.com", "password": "test"})
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create test asset
    resp = client.post("/api/asset-management/assets", 
        json={"asset_name": "Test Asset", "asset_code": "TEST-DOC-001"},
        headers=headers)
    asset_id = resp.json()["id"]
    
    # List documents (should be empty)
    resp = client.get(f"/api/asset-management/assets/{asset_id}/documents", headers=headers)
    
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_documents.py::test_list_documents_endpoint -v
```

Expected: FAIL (404 - endpoint doesn't exist)

- [ ] **Step 3: Implement document routes**

```python
# server/asset_service/documents/routes.py
from fastapi import APIRouter, Depends, HTTPException
from . import db, models

router = APIRouter(tags=["asset-management-documents"])

async def require_session(authorization: str | None = None):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)

@router.get("/api/asset-management/assets/{asset_id}/documents")
async def list_documents(asset_id: str, session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_documents(conn, asset_id)
    finally:
        conn.close()

@router.post("/api/asset-management/assets/{asset_id}/documents", status_code=201)
async def upload_document(
    asset_id: str,
    body: models.DocumentCreate,
    session: dict = Depends(require_session)
):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        data["asset_id"] = asset_id
        doc = db.create_document(conn, data, session.get("uid"))
        conn.commit()
        return doc
    finally:
        conn.close()

@router.delete("/api/asset-management/documents/{doc_id}")
async def delete_document(doc_id: str, session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can delete documents")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        db.delete_document(conn, doc_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
```

- [ ] **Step 4: Register documents router in fastapi_app.py**

```python
# Add to server/fastapi_app.py after existing asset_management_router import
from asset_service.documents.routes import router as documents_router
app.include_router(documents_router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_documents.py::test_list_documents_endpoint -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/documents/ server/fastapi_app.py server/tests/test_documents.py
git commit -m "feat: add document upload/list/delete endpoints"
```

---

## Task 1.8: Audit Module - Database Operations

**Files:**
- Create: `server/asset_service/audit/__init__.py`
- Create: `server/asset_service/audit/db.py`
- Create: `server/asset_service/audit/models.py`
- Test: `server/tests/test_audit.py`

- [ ] **Step 1: Create audit module directory**

```bash
mkdir -p server/asset_service/audit
touch server/asset_service/audit/__init__.py
```

- [ ] **Step 2: Write test for log_event**

```python
# server/tests/test_audit.py
import pg8000
import os
from asset_service.audit import db as audit_db
from uuid import uuid4

def get_test_conn():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        ssl_context=True,
    )

def test_log_audit_event():
    conn = get_test_conn()
    
    # Create test asset
    asset_id = str(uuid4())
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO assets_v2 (id, asset_name, asset_code, qr_code, category, status, criticality)
        VALUES (%s::uuid, 'Test Asset', 'TEST-AUDIT-001', 'qr-123', 'Other', 'Active', 'Medium')
    """, (asset_id,))
    conn.commit()
    
    # Log event
    event = audit_db.log_event(
        conn,
        asset_id=asset_id,
        event_type="created",
        actor_id="test-user",
        actor_name="Test User",
        details={"action": "asset_created"}
    )
    conn.commit()
    
    assert event is not None
    assert event["event_type"] == "created"
    assert event["asset_id"] == asset_id
    
    # Cleanup
    cur.execute("DELETE FROM asset_audit_log WHERE id = %s::uuid", (event["id"],))
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    conn.commit()
    cur.close()
    conn.close()
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && pytest tests/test_audit.py::test_log_audit_event -v
```

Expected: FAIL

- [ ] **Step 4: Implement audit DB operations**

```python
# server/asset_service/audit/models.py
from pydantic import BaseModel
from typing import Optional

class AuditEventCreate(BaseModel):
    asset_id: str
    event_type: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    details: Optional[dict] = None
```

```python
# server/asset_service/audit/db.py
import json
from uuid import uuid4

AUDIT_COLS = "id, asset_id, event_type, actor_id, actor_name, details, created_at"

def _row_to_event(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "event_type": r[2],
        "actor_id": str(r[3]) if r[3] else None,
        "actor_name": r[4],
        "details": r[5] if r[5] else {},
        "created_at": r[6].isoformat() if r[6] else None,
    }

def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows

def log_event(conn, asset_id, event_type, actor_id=None, actor_name=None, details=None):
    event_id = str(uuid4())
    cols = ["id", "asset_id", "event_type", "actor_id", "actor_name", "details"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        event_id,
        asset_id,
        event_type,
        actor_id,
        actor_name,
        json.dumps(details) if details else "{}",
    ]
    sql = f"INSERT INTO asset_audit_log ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return get_event(conn, str(row[0]))

def get_event(conn, event_id):
    sql = f"SELECT {AUDIT_COLS} FROM asset_audit_log WHERE id = %s::uuid"
    rows = _exec(conn, sql, (event_id,))
    if rows:
        return _row_to_event(rows[0])
    return None

def list_events(conn, asset_id=None, event_type=None, limit=100):
    clauses = []
    params = []
    if asset_id:
        clauses.append("asset_id = %s::uuid")
        params.append(asset_id)
    if event_type:
        clauses.append("event_type = %s")
        params.append(event_type)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    sql = f"SELECT {AUDIT_COLS} FROM asset_audit_log {where} ORDER BY created_at DESC LIMIT %s"
    params.append(limit)
    rows = _exec(conn, sql, params)
    return [_row_to_event(r) for r in rows]
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_audit.py::test_log_audit_event -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/audit/ server/tests/test_audit.py
git commit -m "feat: implement audit log database operations"
```

---

## Task 1.9: Wire Audit Logging into Asset CRUD

**Files:**
- Modify: `server/asset_service/db.py`
- Test: `server/tests/test_audit.py`

- [ ] **Step 1: Write test for audit on asset creation**

```python
# Add to server/tests/test_audit.py

def test_audit_logged_on_asset_creation():
    conn = get_test_conn()
    
    from asset_service import db as asset_db
    
    # Create asset
    asset_data = {
        "asset_name": "Audit Test Asset",
        "asset_code": "AUDIT-TEST-001",
        "category": "Other",
        "status": "Active",
        "criticality": "Medium",
    }
    asset = asset_db.create_asset(conn, asset_data, user_id="test-user")
    conn.commit()
    
    # Check audit log
    events = audit_db.list_events(conn, asset_id=asset["id"])
    assert len(events) > 0
    assert events[0]["event_type"] == "created"
    
    # Cleanup
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_audit_log WHERE asset_id = %s::uuid", (asset["id"],))
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset["id"],))
    conn.commit()
    cur.close()
    conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_audit.py::test_audit_logged_on_asset_creation -v
```

Expected: FAIL (no audit event logged)

- [ ] **Step 3: Wire audit logging into create_asset**

```python
# Modify server/asset_service/db.py - add import at top
from .audit import db as audit_db

# Modify create_asset function - add audit logging before return
def create_asset(conn, data, user_id=None):
    # ... existing code ...
    asset = get_asset(conn, asset_id)
    
    # Log audit event
    audit_db.log_event(
        conn,
        asset_id=asset_id,
        event_type="created",
        actor_id=user_id,
        details={"asset_name": data.get("asset_name"), "asset_code": data.get("asset_code")}
    )
    conn.commit()
    
    return asset
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && pytest tests/test_audit.py::test_audit_logged_on_asset_creation -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/asset_service/db.py server/tests/test_audit.py
git commit -m "feat: wire audit logging into asset creation"
```

---

## Task 1.10: Costs Module - Database Operations

**Files:**
- Create: `server/asset_service/costs/__init__.py`
- Create: `server/asset_service/costs/db.py`
- Create: `server/asset_service/costs/models.py`
- Test: `server/tests/test_costs.py`

- [ ] **Step 1: Create costs module directory**

```bash
mkdir -p server/asset_service/costs
touch server/asset_service/costs/__init__.py
```

- [ ] **Step 2: Write test for record_cost**

```python
# server/tests/test_costs.py
import pg8000
import os
from asset_service.costs import db as cost_db
from uuid import uuid4

def get_test_conn():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        ssl_context=True,
    )

def test_record_cost():
    conn = get_test_conn()
    
    # Create test asset
    asset_id = str(uuid4())
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO assets_v2 (id, asset_name, asset_code, qr_code, category, status, criticality)
        VALUES (%s::uuid, 'Test Asset', 'TEST-COST-001', 'qr-123', 'Other', 'Active', 'Medium')
    """, (asset_id,))
    conn.commit()
    
    # Record cost
    cost_data = {
        "asset_id": asset_id,
        "cost_type": "purchase",
        "amount": 5000.00,
        "description": "Initial purchase",
        "recorded_date": "2026-01-15",
    }
    cost = cost_db.record_cost(conn, cost_data, user_id="test-user")
    conn.commit()
    
    assert cost is not None
    assert cost["amount"] == 5000.00
    assert cost["cost_type"] == "purchase"
    
    # Cleanup
    cur.execute("DELETE FROM asset_cost_history WHERE id = %s::uuid", (cost["id"],))
    cur.execute("DELETE FROM assets_v2 WHERE id = %s::uuid", (asset_id,))
    conn.commit()
    cur.close()
    conn.close()
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && pytest tests/test_costs.py::test_record_cost -v
```

Expected: FAIL

- [ ] **Step 4: Implement cost DB operations**

```python
# server/asset_service/costs/models.py
from pydantic import BaseModel
from typing import Optional
from datetime import date

class CostRecord(BaseModel):
    asset_id: str
    cost_type: str
    amount: float
    description: Optional[str] = None
    recorded_date: date
```

```python
# server/asset_service/costs/db.py
import json
from uuid import uuid4

COST_COLS = "id, asset_id, cost_type, amount, description, recorded_date, created_by, created_at"

def _row_to_cost(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "cost_type": r[2],
        "amount": float(r[3]),
        "description": r[4],
        "recorded_date": r[5].isoformat() if r[5] else None,
        "created_by": str(r[6]) if r[6] else None,
        "created_at": r[7].isoformat() if r[7] else None,
    }

def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows

def record_cost(conn, data, user_id=None):
    cost_id = str(uuid4())
    cols = ["id", "asset_id", "cost_type", "amount", "description", "recorded_date", "created_by"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        cost_id,
        data["asset_id"],
        data["cost_type"],
        data["amount"],
        data.get("description"),
        data["recorded_date"],
        user_id,
    ]
    sql = f"INSERT INTO asset_cost_history ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return get_cost(conn, str(row[0]))

def get_cost(conn, cost_id):
    sql = f"SELECT {COST_COLS} FROM asset_cost_history WHERE id = %s::uuid"
    rows = _exec(conn, sql, (cost_id,))
    if rows:
        return _row_to_cost(rows[0])
    return None

def list_costs(conn, asset_id):
    sql = f"SELECT {COST_COLS} FROM asset_cost_history WHERE asset_id = %s::uuid ORDER BY recorded_date DESC"
    rows = _exec(conn, sql, (asset_id,))
    return [_row_to_cost(r) for r in rows]

def get_cost_summary(conn):
    sql = """
        SELECT 
            cost_type,
            COUNT(*) as count,
            SUM(amount) as total
        FROM asset_cost_history
        GROUP BY cost_type
    """
    rows = _exec(conn, sql)
    return [{"cost_type": r[0], "count": r[1], "total": float(r[2])} for r in rows]
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_costs.py::test_record_cost -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/costs/ server/tests/test_costs.py
git commit -m "feat: implement cost tracking database operations"
```

---

## Task 1.11: Costs Module - API Routes

**Files:**
- Create: `server/asset_service/costs/routes.py`
- Modify: `server/fastapi_app.py`
- Test: `server/tests/test_costs.py`

- [ ] **Step 1: Write test for cost endpoints**

```python
# Add to server/tests/test_costs.py
from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)

def test_list_costs_endpoint():
    # Login
    resp = client.post("/api/login", json={"email": "test@example.com", "password": "test"})
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create asset
    resp = client.post("/api/asset-management/assets",
        json={"asset_name": "Cost Test", "asset_code": "COST-EP-001"},
        headers=headers)
    asset_id = resp.json()["id"]
    
    # List costs (should be empty)
    resp = client.get(f"/api/asset-management/assets/{asset_id}/costs", headers=headers)
    
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_costs.py::test_list_costs_endpoint -v
```

Expected: FAIL (404)

- [ ] **Step 3: Implement cost routes**

```python
# server/asset_service/costs/routes.py
from fastapi import APIRouter, Depends, HTTPException
from . import db, models

router = APIRouter(tags=["asset-management-costs"])

async def require_session(authorization: str | None = None):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)

@router.get("/api/asset-management/assets/{asset_id}/costs")
async def list_costs(asset_id: str, session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_costs(conn, asset_id)
    finally:
        conn.close()

@router.post("/api/asset-management/assets/{asset_id}/costs", status_code=201)
async def record_cost(
    asset_id: str,
    body: models.CostRecord,
    session: dict = Depends(require_session)
):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can record costs")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        data = body.model_dump()
        data["asset_id"] = asset_id
        cost = db.record_cost(conn, data, session.get("uid"))
        conn.commit()
        return cost
    finally:
        conn.close()

@router.get("/api/asset-management/costs/summary")
async def get_cost_summary(session: dict = Depends(require_session)):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can view cost summary")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.get_cost_summary(conn)
    finally:
        conn.close()
```

- [ ] **Step 4: Register costs router in fastapi_app.py**

```python
# Add to server/fastapi_app.py
from asset_service.costs.routes import router as costs_router
app.include_router(costs_router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_costs.py::test_list_costs_endpoint -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/costs/ server/fastapi_app.py server/tests/test_costs.py
git commit -m "feat: add cost tracking API endpoints"
```

---

## Task 1.12: Audit Module - API Routes

**Files:**
- Create: `server/asset_service/audit/routes.py`
- Modify: `server/fastapi_app.py`
- Test: `server/tests/test_audit.py`

- [ ] **Step 1: Write test for audit endpoints**

```python
# Add to server/tests/test_audit.py
from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)

def test_list_audit_events():
    # Login
    resp = client.post("/api/login", json={"email": "test@example.com", "password": "test"})
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # List audit events (should work for managers)
    resp = client.get("/api/asset-management/audit", headers=headers)
    
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_audit.py::test_list_audit_events -v
```

Expected: FAIL (404)

- [ ] **Step 3: Implement audit routes**

```python
# server/asset_service/audit/routes.py
from fastapi import APIRouter, Depends, HTTPException, Query
from . import db

router = APIRouter(tags=["asset-management-audit"])

async def require_session(authorization: str | None = None):
    from fastapi_app import require_session as _rs
    return await _rs(authorization)

@router.get("/api/asset-management/audit")
async def list_audit_events(
    asset_id: str = Query(None),
    event_type: str = Query(None),
    limit: int = Query(100),
    session: dict = Depends(require_session)
):
    if not session.get("is_admin"):
        raise HTTPException(403, detail="Only admins can view audit log")
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_events(conn, asset_id=asset_id, event_type=event_type, limit=limit)
    finally:
        conn.close()

@router.get("/api/asset-management/assets/{asset_id}/audit")
async def list_asset_audit_events(asset_id: str, session: dict = Depends(require_session)):
    from asset_service.db import get_conn
    conn = get_conn()
    try:
        return db.list_events(conn, asset_id=asset_id)
    finally:
        conn.close()
```

- [ ] **Step 4: Register audit router in fastapi_app.py**

```python
# Add to server/fastapi_app.py
from asset_service.audit.routes import router as audit_router
app.include_router(audit_router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_audit.py::test_list_audit_events -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/audit/ server/fastapi_app.py server/tests/test_audit.py
git commit -m "feat: add audit log API endpoints"
```

---

# Phase 1 Complete

Phase 1 delivers:
- Extended assets_v2 schema with financial/operational columns
- Document management (upload, list, delete)
- Audit trail (automatic logging on asset operations)
- Cost tracking (record, list, summary)

**Next:** Phase 2 - Maintenance & Work Orders

---

# Phase 2: Maintenance & Work Orders

## Task 2.1: Database Schema - Create asset_maintenance_schedules table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for maintenance_schedules table**

```python
# Add to server/tests/test_schema.py

def test_asset_maintenance_schedules_table_exists():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'asset_maintenance_schedules'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "id" in columns
    assert "asset_id" in columns
    assert "title" in columns
    assert "frequency_type" in columns
    assert "frequency_value" in columns
    assert "next_due" in columns
    assert "auto_create_work_order" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_asset_maintenance_schedules_table_exists -v
```

Expected: FAIL

- [ ] **Step 3: Add CREATE TABLE to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

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
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_schedules_asset_id ON asset_maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_schedules_next_due ON asset_maintenance_schedules(next_due);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_asset_maintenance_schedules_table_exists -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: create asset_maintenance_schedules table"
```

---

## Task 2.2: Database Schema - Create asset_work_orders table

**Files:**
- Modify: `server/asset_service/schema.sql`
- Test: `server/tests/test_schema.py`

- [ ] **Step 1: Write test for work_orders table**

```python
# Add to server/tests/test_schema.py

def test_asset_work_orders_table_exists():
    conn = get_test_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'asset_work_orders'
    """)
    columns = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    assert "id" in columns
    assert "asset_id" in columns
    assert "schedule_id" in columns
    assert "type" in columns
    assert "status" in columns
    assert "labor_hours" in columns
    assert "total_cost" in columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && pytest tests/test_schema.py::test_asset_work_orders_table_exists -v
```

Expected: FAIL

- [ ] **Step 3: Add CREATE TABLE to schema.sql**

```sql
-- Add to end of server/asset_service/schema.sql

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
);

CREATE INDEX IF NOT EXISTS idx_asset_work_orders_asset_id ON asset_work_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_status ON asset_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_assigned_contractor ON asset_work_orders(assigned_contractor_id);
```

- [ ] **Step 4: Run migration**

```bash
cd server && python -c "
import pg8000, os
conn = pg8000.connect(
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    ssl_context=True,
)
with open('asset_service/schema.sql') as f:
    sql = f.read()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print('Migration complete')
"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && pytest tests/test_schema.py::test_asset_work_orders_table_exists -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/asset_service/schema.sql server/tests/test_schema.py
git commit -m "feat: create asset_work_orders table"
```

---

# Phase 2 Complete (Schema)

Phase 2 schema delivers:
- Maintenance schedules table with frequency tracking
- Work orders table with labor/parts cost tracking

**Next:** Continue with maintenance module implementation (Tasks 2.3-2.15)

---

# Summary

This plan covers:

**Phase 1 (Complete):** Core Infrastructure
- Documents, Audit, Costs modules
- 12 tasks with full TDD

**Phase 2 (Schema Complete):** Maintenance & Work Orders
- Schema created
- Remaining tasks: maintenance module, work orders module, cron jobs

**Phase 3:** Analytics & Reporting (not yet written)
- Dashboard KPIs, CSV import/export, bulk operations

**Phase 4:** Portal & Polish (not yet written)
- Customer portal features, mobile offline support

