# SimplyClik Modernization — Session Summary

## Overview
Complete rebuild of the SimplyClik maintenance platform from Firebase to a standalone React+Vite+Python stack. All Firebase dependencies removed. Two separate apps served independently.

---

## Final Folder Structure
```
/home/aiagent/simplyclik-app/
├── server/server.py           # Admin server (port 3001)
├── server/portal-server.py    # Portal server (port 3002)
├── web-admin/                 # Admin React app (Vite)
│   └── build/                 # Pre-built production files
├── web-portal/                # Portal React app (Vite)
│   └── build/
├── tracker/                   # Project Tracker (port 3003)
│   ├── server.py              # Python HTTP server + REST API
│   ├── index.html             # SPA with Kanban + list views
│   └── data.json              # 9 sub-projects, 60+ tasks
└── legacy/                    # Original Firebase repo (archived)
```

## Live URLs
| App | URL | Login |
|-----|-----|-------|
| **Admin** | http://208.87.135.84:3001 | admin@simplyclik.local / Temp123! |
| **Portal** | http://208.87.135.84:3002 | cont2@simplyclik.testinator.com / Temp123! |
| **Tracker** | http://208.87.135.84:3003 | Project management for all sub-projects |
| **API** | POST /api/login | Returns {token, user, is_admin, customer_id} |

## Data Source
Supabase project `imkkhzxeggjxepbisoyy` — migrated from Firebase with 14 users, 2 customers, 4 contractors, 9 locations, 25 requests, 42 notes, 8 invoices.

## Admin Portal Modules (port 3001)
| Module | Status | Features |
|--------|--------|----------|
| Login | ✅ | Custom auth, admin role check |
| Dashboard | ✅ | Count tiles (customers, contractors, locations, requests, leads) |
| Customers | ✅ | List + 4-step wizard with full location management (inline add/remove + CSV bulk upload) |
| Contractors | ✅ | List + 3-step wizard (Details → Locations/Services → Manage) |
| Requests | ✅ | List with status filters, create modal, detail panel with inline edit |
| Assets | ✅ | List with CRUD modal, customer/location dropdowns |
| Leads | ✅ | Two-panel layout: list + detail/notes, convert, delete |
| Activity | ✅ | Monthly summaries per customer, drill-down to location detail |

## Customer Portal Modules (port 3002)
| Module | Status | Features |
|--------|--------|----------|
| Login | ✅ | Custom auth, stores customer_id for data filtering |
| Dashboard | ✅ | Clickable tiles (locations, requests count) |
| Service Locations | ✅ | Two-panel: list + detail showing requests per location |
| Requests | ✅ | Three tabs, full detail with timeline, notes, approve/decline quotes, accept, RFI response, quote & invoice display |
| Activity | ✅ | Monthly per-location request summary |
| Manage | ✅ | Add/edit/remove users with roles (Manager/Operator/User) |

## Key Technical Decisions
- **No Firebase** — completely removed Firebase SDK from both apps
- **No SDKs** — uses native `fetch()` to Supabase REST API + custom auth endpoint
- **Custom auth** — POST /api/login validates bcrypt passwords directly, returns JSON with user + role
- **Supabase views** — created camelCase views matching old Firebase field names
- **Systemd services** — both servers managed by systemd user services with auto-restart
- **No cross-contamination** — mission-control app.py cleaned of all SimplyClik routes

## Systemd Services
```
systemctl --user restart simplyclik              # Admin (port 3001)
systemctl --user restart simplyclik-portal       # Portal (port 3002)
systemctl --user restart simplyclik-tracker      # Tracker (port 3003)
```

## Credentials
| Account | Email | Password | Access |
|---------|-------|----------|--------|
| Admin | admin@simplyclik.local | Temp123! | Full admin |
| Portal Manager | cont2@simplyclik.testinator.com | Temp123! | Crypto Central |
| Portal Manager | grapes@simplyclik.testinator.com | Temp123! | zepto |
| Portal Operator | cont4@simplyclik.testinator.com | Temp123! | Crypto Central (limited) |

## Known Issues
1. Portal Manage page not built
2. Portal locations show correct locations but request <-> location linking depends on `customerLocationProfileId` column
3. Some migrated customer contact fields are empty (data was in Firebase customerLocations, not customers)

## Project Tracker (port 3003)
9 sub-projects, 60+ tasks tracked with Kanban + list views:
- **Admin Portal** — 13/13 done ✅ (100%)
- **Customer Portal** — 10/10 done ✅ (100%)
- **Backend API** — 0/17 done (0%), critical: real session management, env vars, Flask/FastAPI migration, all CRUD endpoints
- **Scheduled Tasks** — 0/3 done (0%), auto-complete + auto-reassign cron jobs
- **Notification System** — 0/4 done (0%), SendGrid email + FCM push + in-app
- **iOS App** — 0/6 done (0%), audit Firebase calls, rebuild with REST API
- **Android App** — 0/7 done (0%), skeleton only, full implementation needed
- **Public Website** — 0/4 done (0%), marketing site + lead capture
- **Infrastructure** — 1/9 done (11%), systemd services done, secrets/env/logging/etc needed

## Next Steps (when resuming)
1. Build Backend API layer (Phase 1) — unblocks cp10 and admin ap13 final migration
2. Phase 0 security fixes (env vars, session management)
3. Build Scheduled Tasks (auto-complete + auto-reassign)
4. Keep tracker updated with progress as work is done