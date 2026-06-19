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
    sql = f"INSERT INTO asset_audit_log (id, asset_id, event_type, actor_id, actor_name, details) VALUES (%s, %s::uuid, %s, %s, %s, %s::jsonb)"
    vals = [event_id, asset_id, event_type, actor_id, actor_name, details]
    cur = conn.cursor()
    cur.execute(sql, vals)
    cur.close()
    return get_event(conn, event_id)


def get_event(conn, event_id):
    sql = f"SELECT {AUDIT_COLS} FROM asset_audit_log WHERE id = %s::uuid"
    rows = _exec(conn, sql, (event_id,))
    if rows:
        return _row_to_event(rows[0])
    return None


def list_events(conn, asset_id=None, event_type=None, limit=100, offset=0):
    clauses = []
    params = []
    if asset_id:
        clauses.append("asset_id = %s::uuid")
        params.append(asset_id)
    if event_type:
        clauses.append("event_type = %s")
        params.append(event_type)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    sql = f"SELECT {AUDIT_COLS} FROM asset_audit_log {where} ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    rows = _exec(conn, sql, params)
    return [_row_to_event(r) for r in rows]
