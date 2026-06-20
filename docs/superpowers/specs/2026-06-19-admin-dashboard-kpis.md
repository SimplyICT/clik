# Admin Dashboard — Asset KPIs & Charts

**Date:** 2026-06-19
**Status:** Approved
**Version:** 1.0

## Overview

Extend the existing admin DashboardPage with asset management KPIs and inline SVG bar charts. No new pages, no new routes, no external chart libraries.

## Design

### Layout (top to bottom)

1. **Row 1** — existing 5 count tiles (Customers, Contractors, Locations, Requests, Leads) — unchanged
2. **Row 2** — 6 new asset KPI cards in a 3-column grid:
   - Total Assets, Active Assets (green), Active Work Orders (red), Overdue Maintenance (amber), Warranty Expiring Soon (pink), Total Costs (purple)
3. **Row 3** — two inline SVG bar charts side-by-side:
   - **Assets by Status** — Active, Under Maintenance, Out of Service, Retired
   - **Assets by Category** — top 6 categories by count

### Data Source

Single call to `GET /api/asset-management/reports/dashboard` — already exists, returns:
```json
{
  "total_assets": 47,
  "active_assets": 35,
  "assets_by_status": [{"status":"Active","count":35}, ...],
  "assets_by_category": [{"category":"HVAC","count":20}, ...],
  "active_work_orders": 7,
  "overdue_maintenance": 3,
  "warranty_expiring_soon": 5,
  "total_costs": 45200.0
}
```

### Charts

Inline SVG bar charts generated in React — no libraries. Each chart:
- Takes `[{label, count}]` data
- Renders bars with proportional heights
- Labels below each bar
- Responsive via viewBox

### Error Handling

- Loading state while fetching
- Error state if API fails (hide chart section, show message)
- Graceful if data is empty (zero-state message)

### Files Changed

- `web-admin/src/pages/DashboardPage.jsx` — extend with KPI section + charts
