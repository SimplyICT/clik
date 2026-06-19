from uuid import uuid4

COST_COLS = "id, asset_id, cost_type, amount, description, recorded_date, created_by, created_at"


def _row_to_cost(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]),
        "cost_type": r[2],
        "amount": float(r[3]) if r[3] is not None else None,
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


def list_costs(conn, asset_id, limit=50, offset=0):
    sql = f"SELECT {COST_COLS} FROM asset_cost_history WHERE asset_id = %s::uuid ORDER BY recorded_date DESC LIMIT %s OFFSET %s"
    rows = _exec(conn, sql, (asset_id, limit, offset))
    return [_row_to_cost(r) for r in rows]


def get_cost_summary(conn):
    sql = "SELECT cost_type, COUNT(*)::int, SUM(amount)::float FROM asset_cost_history GROUP BY cost_type ORDER BY cost_type"
    rows = _exec(conn, sql)
    return [{"cost_type": r[0], "count": r[1], "total": r[2]} for r in rows]
