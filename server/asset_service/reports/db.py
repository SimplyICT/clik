def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows


def get_dashboard_kpis(conn):
    total = _exec(conn, "SELECT COUNT(*) FROM assets_v2")[0][0]
    active = _exec(conn, "SELECT COUNT(*) FROM assets_v2 WHERE status = 'Active'")[0][0]
    by_status = _exec(conn, "SELECT status, COUNT(*)::int FROM assets_v2 GROUP BY status ORDER BY status")
    by_category = _exec(conn, "SELECT category, COUNT(*)::int FROM assets_v2 GROUP BY category ORDER BY category")
    active_wos = _exec(conn, "SELECT COUNT(*) FROM asset_work_orders WHERE status NOT IN ('completed', 'cancelled')")[0][0]
    overdue_maint = _exec(conn, "SELECT COUNT(*) FROM asset_maintenance_schedules WHERE next_due < NOW()")[0][0]
    warranty = _exec(conn, "SELECT COUNT(*) FROM assets_v2 WHERE warranty_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'")[0][0]
    total_costs_row = _exec(conn, "SELECT COALESCE(SUM(amount)::float, 0) FROM asset_cost_history")
    total_costs = total_costs_row[0][0] if total_costs_row else 0.0

    return {
        "total_assets": total,
        "active_assets": active,
        "assets_by_status": [{"status": r[0], "count": r[1]} for r in by_status],
        "assets_by_category": [{"category": r[0], "count": r[1]} for r in by_category],
        "active_work_orders": active_wos,
        "overdue_maintenance": overdue_maint,
        "warranty_expiring_soon": warranty,
        "total_costs": total_costs,
    }


def get_warranty_report(conn, days=30):
    interval_str = f"{days} days"
    rows = _exec(conn, """
        SELECT id, asset_name, asset_code, category, status, manufacturer, model,
               serial_number, warranty_expiry_date, location_name, contractor_name
        FROM assets_v2
        WHERE warranty_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + %s::interval
        ORDER BY warranty_expiry_date ASC
    """, (interval_str,))
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "asset_name": r[1],
            "asset_code": r[2],
            "category": r[3],
            "status": r[4],
            "manufacturer": r[5],
            "model": r[6],
            "serial_number": r[7],
            "warranty_expiry_date": r[8].isoformat() if r[8] else None,
            "location_name": r[9],
            "contractor_name": r[10],
        })
    return result


def get_maintenance_overdue(conn):
    rows = _exec(conn, """
        SELECT s.id, s.asset_id, a.asset_name, s.title, s.description,
               s.frequency_type, s.frequency_value, s.next_due, s.assigned_contractor_id
        FROM asset_maintenance_schedules s
        LEFT JOIN assets_v2 a ON a.id = s.asset_id
        WHERE s.next_due < NOW()
        ORDER BY s.next_due ASC
    """)
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "asset_id": str(r[1]) if r[1] else None,
            "asset_name": r[2],
            "title": r[3],
            "description": r[4],
            "frequency_type": r[5],
            "frequency_value": r[6],
            "next_due": r[7].isoformat() if r[7] else None,
            "assigned_contractor_id": str(r[8]) if r[8] else None,
        })
    return result


def export_assets_csv(conn):
    rows = _exec(conn, """
        SELECT id, asset_name, asset_code, category, status, criticality,
               manufacturer, model, serial_number, location_name, contractor_name,
               purchase_cost, replacement_value, created_at
        FROM assets_v2 ORDER BY asset_name ASC
    """)
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "asset_name": r[1],
            "asset_code": r[2],
            "category": r[3],
            "status": r[4],
            "criticality": r[5],
            "manufacturer": r[6],
            "model": r[7],
            "serial_number": r[8],
            "location_name": r[9],
            "contractor_name": r[10],
            "purchase_cost": float(r[11]) if r[11] else None,
            "replacement_value": float(r[12]) if r[12] else None,
            "created_at": r[13].isoformat() if r[13] else None,
        })
    return result


def export_work_orders_csv(conn):
    rows = _exec(conn, """
        SELECT id, asset_id, type, title, description, priority, status,
               assigned_contractor_id, scheduled_date, completed_date,
               labor_hours, labor_cost, parts_cost, total_cost, notes, created_at
        FROM asset_work_orders ORDER BY created_at DESC
    """)
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "asset_id": str(r[1]) if r[1] else None,
            "type": r[2],
            "title": r[3],
            "description": r[4],
            "priority": r[5],
            "status": r[6],
            "assigned_contractor_id": str(r[7]) if r[7] else None,
            "scheduled_date": r[8].isoformat() if r[8] else None,
            "completed_date": r[9].isoformat() if r[9] else None,
            "labor_hours": float(r[10]) if r[10] else None,
            "labor_cost": float(r[11]) if r[11] else None,
            "parts_cost": float(r[12]) if r[12] else None,
            "total_cost": float(r[13]) if r[13] else None,
            "notes": r[14],
            "created_at": r[15].isoformat() if r[15] else None,
        })
    return result


def export_costs_csv(conn):
    rows = _exec(conn, """
        SELECT id, asset_id, cost_type, amount, description, recorded_date, created_at
        FROM asset_cost_history ORDER BY recorded_date DESC
    """)
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "asset_id": str(r[1]) if r[1] else None,
            "cost_type": r[2],
            "amount": float(r[3]) if r[3] else None,
            "description": r[4],
            "recorded_date": r[5].isoformat() if r[5] else None,
            "created_at": r[6].isoformat() if r[6] else None,
        })
    return result
