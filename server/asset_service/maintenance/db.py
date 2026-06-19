from uuid import uuid4

SCHED_COLS = "id, asset_id, title, description, frequency_type, frequency_value, last_completed, next_due, assigned_contractor_id, auto_create_work_order, created_by, created_at"


def _row_to_schedule(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "title": r[2],
        "description": r[3],
        "frequency_type": r[4],
        "frequency_value": r[5],
        "last_completed": r[6].isoformat() if r[6] else None,
        "next_due": r[7].isoformat() if r[7] else None,
        "assigned_contractor_id": str(r[8]) if r[8] else None,
        "auto_create_work_order": r[9] if r[9] else False,
        "created_by": str(r[10]) if r[10] else None,
        "created_at": r[11].isoformat() if r[11] else None,
    }


def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows


def list_schedules(conn, asset_id=None):
    if asset_id:
        sql = f"SELECT {SCHED_COLS} FROM asset_maintenance_schedules WHERE asset_id = %s::uuid ORDER BY created_at DESC"
        rows = _exec(conn, sql, (asset_id,))
    else:
        sql = f"SELECT {SCHED_COLS} FROM asset_maintenance_schedules ORDER BY created_at DESC"
        rows = _exec(conn, sql)
    return [_row_to_schedule(r) for r in rows]


def get_schedule(conn, schedule_id):
    sql = f"SELECT {SCHED_COLS} FROM asset_maintenance_schedules WHERE id = %s::uuid"
    rows = _exec(conn, sql, (schedule_id,))
    if rows:
        return _row_to_schedule(rows[0])
    return None


def create_schedule(conn, data, user_id=None):
    schedule_id = str(uuid4())
    cols = ["id", "asset_id", "title", "description", "frequency_type", "frequency_value",
            "assigned_contractor_id", "auto_create_work_order", "created_by"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        schedule_id,
        data["asset_id"],
        data["title"],
        data.get("description"),
        data["frequency_type"],
        data["frequency_value"],
        data.get("assigned_contractor_id"),
        data.get("auto_create_work_order", False),
        user_id,
    ]
    sql = f"INSERT INTO asset_maintenance_schedules ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return get_schedule(conn, str(row[0]))


def update_schedule(conn, schedule_id, data):
    fields = []
    values = []
    for key in ["title", "description", "frequency_type", "frequency_value",
                 "assigned_contractor_id", "auto_create_work_order"]:
        if key in data:
            fields.append(f"{key} = %s")
            values.append(data[key])
    if not fields:
        return get_schedule(conn, schedule_id)
    values.append(schedule_id)
    sql = f"UPDATE asset_maintenance_schedules SET {', '.join(fields)} WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, values)
    cur.close()
    return get_schedule(conn, schedule_id)


def delete_schedule(conn, schedule_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_maintenance_schedules WHERE id = %s::uuid", (schedule_id,))
    cur.close()


def get_due_schedules(conn):
    sql = f"SELECT {SCHED_COLS} FROM asset_maintenance_schedules WHERE next_due <= NOW() AND auto_create_work_order = TRUE"
    rows = _exec(conn, sql)
    return [_row_to_schedule(r) for r in rows]
