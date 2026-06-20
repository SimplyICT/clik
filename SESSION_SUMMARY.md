# SimplyClik Modernization — Session Summary

## Overview
Complete rebuild of the SimplyClik maintenance platform from Firebase to a standalone React+Vite+Python stack. All Firebase dependencies removed. Four independent apps served via nGinx reverse proxy.

## Final Folder Structure
```
/home/aiagent/simplyclik-app/
├── server/
│   ├── fastapi_app.py        # Unified FastAPI server (admin/portal/mobile modes)
│   ├── scheduler.py           # APScheduler background jobs
│   ├── notifications.py       # SendGrid + Pushover + in-app notifications
│   ├── server.py              # Legacy stdlib server (still present, not used)
│   ├── portal-server.py       # Legacy portal server (still present, not used)
│   ├── .env                   # All secrets (gitignored)
│   ├── tests/                 # Pytest integration tests
│   ├── nginx.conf             # Reverse proxy config
│   └── vapid_*.pem            # Web Push API keys
├── web-admin/                 # Admin React app (Vite)
│   └── build/                 # Pre-built production files
├── web-portal/                # Portal React app (Vite)
│   └── build/
├── web-mobile/                # Mobile PWA (Vite) — contractors + end users
│   └── build/
├── tracker/                   # Project Tracker (port 3003)
│   ├── server.py              # Python HTTP server + REST API
│   ├── index.html             # SPA with Kanban + list views
│   └── data.json              # 10 sub-projects, 70+ tasks
└── legacy/                    # Original Firebase repo (archived)
```

## Live URLs
| App | URL | Login |
|-----|-----|-------|
| **Admin** | https://pwa.simplyclik.com/ | admin@simplyclik.local / Temp123! |
| **Portal** | https://pwa.simplyclik.com/portal/ | portal@simplyclik.local / Temp123! |
| **Mobile** | https://pwa.simplyclik.com/mobile/ | contractor@simplyclik.local / Temp123! or manager@simplyclik.local / Temp123! |
| **Tracker** | http://208.87.135.84:3003 | Project management for all sub-projects |
| **API** | POST /api/login | Returns {token, user, is_admin, customer_id} |

## Data Source
Supabase project `imkkhzxeggjxepbisoyy` — migrated from Firebase with 14 users, 2 customers, 4 contractors, 9 locations, 25 requests, 42 notes, 8 invoices.

## Sub-Projects — All Complete

### Admin Portal (13/13 ✅ 100%)
| Module | Features |
|--------|----------|
| Login | Custom auth, admin role check, session tokens |
| Dashboard | Count tiles (customers, contractors, locations, requests, leads) |
| Customers | List + 4-step wizard with full location management (inline add/remove + CSV bulk upload) |
| Contractors | List + 3-step wizard (Details → Locations/Services → Manage) |
| Requests | List with status filters, create modal, detail panel with inline edit |
| Assets | List with CRUD modal, customer/location dropdowns |
| Leads | Two-panel layout: list + detail/notes, convert, delete |
| Activity | Monthly summaries per customer, drill-down to location detail |
| Help | HelpPage + DevDocsPage for all modules |

### Customer Portal (10/10 ✅ 100%)
| Module | Features |
|--------|----------|
| Login | Custom auth, stores customer_id for data filtering |
| Dashboard | Clickable tiles (locations, requests count) |
| Service Locations | Two-panel: list + detail showing requests per location |
| Requests | Three tabs, full detail with timeline, notes, approve/decline quotes, accept, RFI response, quote & invoice display |
| Activity | Monthly per-location request summary |
| Manage | Add/edit/remove users with roles (Manager/Operator/User) |

### Backend API (17/17 ✅ 100%)
| Feature | Status |
|---------|--------|
| FastAPI migration (uvicorn, httpx, async) | ✅ |
| Server-side session management (24h TTL, Bearer tokens) | ✅ |
| Secrets moved to env vars (_require_env) | ✅ |
| Locked-down Supabase proxy (auth required, table allowlist) | ✅ |
| Customer CRUD | ✅ |
| Contractor CRUD | ✅ |
| Location CRUD (+ geocoding placeholder) | ✅ |
| Request CRUD + state machine (11-status lifecycle) | ✅ |
| Notes/history CRUD | ✅ |
| Invoice management + 48h auto-approval | ✅ |
| Image upload (presigned URLs via Supabase Storage) | ✅ |
| Asset CRUD | ✅ |
| Lead management + convert to customer | ✅ |
| Activity/analytics endpoints | ✅ |
| User management (create/update/delete, password mgmt) | ✅ |
| OTP generation/verification | ✅ |
| CORS + structured logging (JSON) | ✅ |

### Scheduled Tasks (3/3 ✅ 100%)
| Task | Details |
|------|---------|
| Auto-complete requests | APScheduler, 12h interval, marks contractor_completed + 48h as completed |
| Auto-reassign contractors | Escalates to next contractor based on priority timeout (6-120h) |
| Scheduler chosen | APScheduler, runs inside FastAPI admin server |

### Notification System (4/4 ✅ 100%)
| Service | Status |
|---------|--------|
| SendGrid email | OTPs, new request alerts, status changes, invoices, lead confirmations |
| Pushover push notifications | Production push to all devices |
| In-app notifications | Banner + history within web apps |
| Trigger wiring | Create/update events wired to notification dispatch |

### Mobile PWA (4/4 ✅ 100%)
| Module | Features |
|--------|----------|
| Scaffold + login | Vite + React, role detection (contractor vs manager), PWA manifest + service worker |
| Contractor dashboard | Job list, accept/quote/invoice workflow, status tracking |
| End user locations | Location list, request creation, request list with status tracking |
| Photo upload | Camera capture from mobile for requests and notes |
| Unified login | Single login endpoint for all user types |

### Infrastructure (7/9 ✅ ~78%)
| Item | Status |
|------|--------|
| Secrets → env vars | ✅ Done (fastapi_app.py uses _require_env) |
| nGinx reverse proxy | ✅ HTTPS + Let's Encrypt SSL + internal port routing |
| Systemd services | ✅ Admin, Portal, Mobile, Tracker all managed |
| Structured logging | ✅ JSON format, request IDs |
| Health check endpoints | ✅ /health |
| Environment config | ✅ dev/staging/prod via .env |
| Tests | ✅ Pytest integration tests |
| Rate limiting | ⏳ Pending |
| CI/CD pipeline | ⏳ Pending |

### iOS / Android Apps
Replaced by the responsive PWA. No native apps — the PWA works on all devices.

### Public Website
Not a priority. Marketing site + lead capture deferred.

## Key Technical Decisions
- **No Firebase** — completely removed Firebase SDK from all apps
- **No native apps** — PWA serves all devices (iOS, Android, desktop)
- **FastAPI** — replaced stdlib http.server with async FastAPI + uvicorn
- **Server-side sessions** — tokens with 24h TTL, validated on every request
- **Secrets in env vars** — no hardcoded credentials in source code
- **Supabase views** — created camelCase views matching old Firebase field names
- **APScheduler** — background jobs for auto-complete and auto-reassign
- **Pushover + SendGrid** — push notifications and email
- **nGinx reverse proxy** — single gateway for all apps with HTTPS
- **Systemd services** — all four servers managed by systemd with auto-restart

## Systemd Services
```
systemctl --user restart simplyclik           # Admin (port 3001)
systemctl --user restart simplyclik-portal    # Portal (port 3002)
systemctl --user restart simplyclik-tracker   # Tracker (port 3003)
systemctl --user restart simplyclik-mobile    # Mobile PWA (port 3004)
```

## Credentials
| Account | Email | Password | Access |
|---------|-------|----------|--------|
| Admin | admin@simplyclik.local | Temp123! | Full admin |
| Portal Manager | cont2@simplyclik.testinator.com | Temp123! | Crypto Central |
| Portal Manager | grapes@simplyclik.testinator.com | Temp123! | zepto |
| Portal Operator | cont4@simplyclik.testinator.com | Temp123! | Crypto Central (limited) |
| Mobile Contractor | contractor@simplyclik.local | Temp123! | Job dashboard, quotes, invoices |
| Mobile Manager | manager@simplyclik.local | Temp123! | Locations, requests |

## Known Issues
1. Some migrated customer contact fields are empty (data was in Firebase customerLocations, not customers)

## Database Notes
- The `requests` view has `INSTEAD OF INSERT/UPDATE` triggers (`requests_insert()`, `requests_update()`) that map view columns to `requests_base` table columns. These were updated to include `customer_location_profile_id`, `contractor_profile_id` and auto-assignment logic: on insert, if a location is set, the trigger checks `customer_location_contractors` and auto-assigns the first linked contractor, setting status to `awaiting_acceptance`.

## Project Tracker (port 3003)
10 sub-projects, 70+ tasks tracked with Kanban + list views:
- **Admin Portal** — 13/13 done ✅ (100%)
- **Customer Portal** — 10/10 done ✅ (100%)
- **Backend API** — 17/17 done ✅ (100%)
- **Scheduled Tasks** — 3/3 done ✅ (100%)
- **Notification System** — 4/4 done ✅ (100%)
- **Mobile PWA** — 4/4 done ✅ (100%)
- **iOS App** — Replaced by PWA
- **Android App** — Replaced by PWA
- **Public Website** — Deferred (not a priority)
- **Infrastructure** — 7/9 done (~78%), rate limiting + CI/CD pending

### Asset Management System v2 (4 phases ✅ 100%)
Complete enterprise asset management platform expansion — adds lifecycle management, maintenance scheduling, work orders, document management, financial tracking, analytics/reporting, and field operations.

**Architecture:** Modular extension of server/asset_service with sub-modules (documents/, audit/, costs/, maintenance/, work_orders/, reports/, imports/, cron/)

| Phase | Status | Modules | Tests |
|-------|--------|---------|-------|
| Phase 1 — Core Infrastructure | ✅ Complete | Documents, Audit, Costs | 41 |
| Phase 2 — Maintenance & Work Orders | ✅ Complete | Maintenance, Work Orders, Cron | 51 |
| Phase 3 — Analytics & Reporting | ✅ Complete | Reports, Imports, Bulk Ops | 48 |
| Phase 4 — Portal & Polish | ✅ Complete | Portal pages, Pagination, Docs, Tests | ~25+ |

**Database:** 6 new tables (asset_documents, asset_maintenance_schedules, asset_work_orders, asset_audit_log, asset_cost_history) + extended assets_v2 columns

**API Prefix:** All new endpoints under /api/asset-management/*

**~165+ total tests** across all modules

## Next Steps (when resuming)
1. Infrastructure hardening: rate limiting, CI/CD pipeline
2. Public website (if/when prioritized)
3. Keep tracker updated with progress as work is done
