# SimplyClik — Project Memory

Last updated: 2026-06-18 (session end)

## Active Tasks
- **Asset System Expansion** — comprehensive build-out in progress
  - Status: Implementation phase — Phase 1 schema complete, documents module next
  - Architecture: Modular (extend asset_service with sub-modules)
  - Scope: Lifecycle management, analytics/reporting, field operations
  - Asset types: Facilities/HVAC + general business (vehicles, tools, IT)
  - Maintenance: Preventive scheduling + reactive work orders
  - Financials: Basic (purchase cost + replacement value)
  - Import/Export: CSV/Excel system (fresh start, no existing data)
  - Execution: Subagent-driven development

## 2026-06-18 (Session 2)
- Completed Phase 1 schema tasks (1.1-1.4):
  - Extended assets_v2 with 8 new columns (purchase_cost, replacement_value, depreciation_method, useful_life_years, location_name, contractor_name, hours_run, meter_reading)
  - Created asset_documents table
  - Created asset_audit_log table
  - Created asset_cost_history table
  - 15/15 tests passing, committed (a775055)
- Documents module (Tasks 1.5-1.7) dispatched but cancelled — ready to resume
- Implementation plan written: docs/superpowers/plans/2026-06-18-asset-system-expansion.md
- Design spec written: docs/superpowers/specs/2026-06-18-asset-system-expansion-design.md

## 2026-06-18 (Session 1)
- Asset system expansion design session
- Explored current asset system: backend (asset_service module), admin UI, mobile UI, portal UI
- User wants comprehensive build-out: lifecycle, analytics, field operations — all at once
- Proposed 3 architecture approaches: Modular (recommended), Microservice, Monolith
- User chose: Modular approach (extend asset_service with sub-modules)
- Designed new database schema: asset_documents, asset_maintenance_schedules, asset_work_orders, asset_audit_log, asset_cost_history
- Extensions to assets_v2: purchase_cost, replacement_value, depreciation_method, useful_life_years, location_name, contractor_name, hours_run, meter_reading

## 2026-06-17
- Installed graphify opencode plugin globally at `~/.config/opencode/plugins/`
- Ran `graphify opencode install` — wrote AGENTS.md section + plugin registration
- Graph generation hangs after AST extraction (4031 files, needs longer timeout or LLM API key)
- Diagnosed mobile "Assets" page error: server processes were from Jun 14, didn't have asset management routes
- Found `qrcode` Python package was missing — installed it
- Restarted both uvicorn processes (3001 admin/API, 3004 mobile) with latest code
- Nginx config reviewed: `/mobile/` → 3004 (MODE=mobile), `/api/` → 3001 (MODE=admin)

## Project State
- Firebase-to-Supabase migration: complete
- Asset Management System v1: complete ✅ (basic CRUD, parts, custom fields, QR codes)
- Asset Management System v2: implementation in progress
  - Phase 1 schema: complete ✅ (15/15 tests)
  - Phase 1 modules: documents (next), audit, costs
  - Phase 2: maintenance & work orders (pending)
  - Phase 3: analytics & reporting (pending)
  - Phase 4: portal & polish (pending)
- Graphify plugin installed (global), graph generation in progress
- PWA mobile server (port 3004) and admin/API server (port 3001) running

## Decisions
- Servers restarted with nohup, logs at /tmp/uvicorn-mobile.log and /tmp/uvicorn-admin.log
- Asset expansion: Modular architecture, build everything in one go
- Execution approach: Subagent-driven development (fresh subagent per task + two-stage review)

## Next Steps
- Resume documents module implementation (Tasks 1.5-1.7)
- Then audit module (Tasks 1.8-1.9)
- Then costs module (Tasks 1.10-1.12)
- Then Phase 2: maintenance & work orders
