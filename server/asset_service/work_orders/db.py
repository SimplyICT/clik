from uuid import uuid4

WO_COLS = (
    "id, asset_id, schedule_id, type, title, description, priority, status, "
    "assigned_contractor_id, scheduled_date, completed_date, completed_by, "
    "labor_hours, labor_cost, parts_cost, total_cost, notes, created_at, updated_at"
)


def _row_to_wo(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "schedule_id": str(r[2]) if r[2] else None,
        "type": r[3],
        "title": r[4],
        "description": r[5],
        "priority": r[6],
        "status": r[7],
        "assigned_contractor_id": str(r[8]) if r[8] else None,
        "scheduled_date": r[9].isoformat() if r[9] else None,
        "completed_date": r[10].isoformat() if r[10] else None,
        "completed_by": r[11],
        "labor_hours": float(r[12]) if r[12] else None,
        "labor_cost": float(r[13]) if r[13] else None,
        "parts_cost": float(r[14]) if r[14] else None,
        "total_cost": float(r[15]) if r[15] else None,
        "notes": r[16],
        "created_at": r[17].isoformat() if r[17] else None,
        "updated_at": r[18].isoformat() if r[18] else None,
    }


def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows


def list_work_orders(conn, asset_id=None, status=None, contractor_id=None):
    clauses = []
    params = []
    if asset_id:
        clauses.append("asset_id = %s::uuid")
        params.append(asset_id)
    if status:
        clauses.append("status = %s")
        params.append(status)
    if contractor_id:
        clauses.append("assigned_contractor_id = %s::uuid")
        params.append(contractor_id)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    sql = f"SELECT {WO_COLS} FROM asset_work_orders {where} ORDER BY created_at DESC"
    rows = _exec(conn, sql, params)
    return [_row_to_wo(r) for r in rows]


def get_work_order(conn, wo_id):
    sql = f"SELECT {WO_COLS} FROM asset_work_orders WHERE id = %s::uuid"
    rows = _exec(conn, sql, (wo_id,))
    if rows:
        return _row_to_wo(rows[0])
    return None


def create_work_order(conn, data, user_id=None):
    wo_id = str(uuid4())
    cols = [
        "id", "asset_id", "schedule_id", "type", "title", "description",
        "priority", "status", "assigned_contractor_id", "scheduled_date",
    ]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        wo_id,
        data.get("asset_id"),
        data.get("schedule_id"),
        data.get("type"),
        data.get("title"),
        data.get("description"),
        data.get("priority", "medium"),
        data.get("status", "pending"),
        data.get("assigned_contractor_id"),
        data.get("scheduled_date"),
    ]
    sql = f"INSERT INTO asset_work_orders ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return get_work_order(conn, str(row[0]))


def update_work_order(conn, wo_id, data):
    fields = []
    values = []
    for key, val in data.items():
        fields.append(f"{key} = %s")
        values.append(val)
    if not fields:
        return get_work_order(conn, wo_id)
    values.append(wo_id)
    sql = f"UPDATE asset_work_orders SET {', '.join(fields)} WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, values)
    cur.close()
    return get_work_order(conn, wo_id)


def delete_work_order(conn, wo_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_work_orders WHERE id = %s::uuid", (wo_id,))
    cur.close()
