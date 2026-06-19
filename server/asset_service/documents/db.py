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


def list_documents(conn, asset_id, limit=50, offset=0):
    sql = f"SELECT {DOC_COLS} FROM asset_documents WHERE asset_id = %s::uuid ORDER BY created_at DESC LIMIT %s OFFSET %s"
    rows = _exec(conn, sql, (asset_id, limit, offset))
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
