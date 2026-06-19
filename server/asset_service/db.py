import os
import json
import pg8000
from uuid import uuid4
from . import qr
from .audit import db as audit_db

BASE_URL = os.environ.get("APP_URL", "https://pwa.simplyclik.com")

def get_conn():
    host = os.environ.get("SUPABASE_DB_HOST") or os.environ.get("DB_HOST")
    port = os.environ.get("SUPABASE_DB_PORT") or os.environ.get("DB_PORT")
    dbname = os.environ.get("SUPABASE_DB_NAME") or os.environ.get("DB_NAME")
    user = os.environ.get("SUPABASE_DB_USER") or os.environ.get("DB_USER")
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("DB_PASSWORD")
    if not all([host, port, dbname, user, password]):
        raise RuntimeError("Missing database environment variables")
    return pg8000.connect(
        host=host,
        port=int(port),
        database=dbname,
        user=user,
        password=password,
        ssl_context=True,
    )

ASSET_V2_COLS = """id, asset_name, asset_code, qr_code, category, sub_category, status,
    lifecycle_status, criticality, manufacturer, model, serial_number,
    customer_id, customer_location_id, assigned_contractor_id, parent_asset_id,
    install_date, purchase_date, warranty_expiry_date, last_service_date, next_service_date,
    photo_urls, custom_fields, notes, created_at, updated_at, created_by"""

def _row_to_asset_v2(r):
    return {
        "id": str(r[0]),
        "asset_name": r[1],
        "asset_code": r[2],
        "qr_code": r[3],
        "category": r[4],
        "sub_category": r[5],
        "status": r[6],
        "lifecycle_status": r[7],
        "criticality": r[8],
        "manufacturer": r[9],
        "model": r[10],
        "serial_number": r[11],
        "customer_id": str(r[12]) if r[12] else None,
        "customer_location_id": str(r[13]) if r[13] else None,
        "assigned_contractor_id": str(r[14]) if r[14] else None,
        "parent_asset_id": str(r[15]) if r[15] else None,
        "install_date": r[16].isoformat() if r[16] else None,
        "purchase_date": r[17].isoformat() if r[17] else None,
        "warranty_expiry_date": r[18].isoformat() if r[18] else None,
        "last_service_date": r[19].isoformat() if r[19] else None,
        "next_service_date": r[20].isoformat() if r[20] else None,
        "photo_urls": r[21] if r[21] else [],
        "custom_fields": r[22] if r[22] else {},
        "notes": r[23],
        "created_at": r[24].isoformat() if r[24] else None,
        "updated_at": r[25].isoformat() if r[25] else None,
        "created_by": str(r[26]) if r[26] else None,
    }

PART_COLS = "id, asset_id, name, sku, quantity, min_threshold, unit, created_at"

def _row_to_part(r):
    return {
        "id": str(r[0]),
        "asset_id": str(r[1]) if r[1] else None,
        "name": r[2],
        "sku": r[3],
        "quantity": r[4],
        "min_threshold": r[5],
        "unit": r[6],
        "created_at": r[7].isoformat() if r[7] else None,
    }

CUSTOM_FIELD_DEF_COLS = "id, category, field_name, field_label, field_type, options, required, sort_order"

def _row_to_custom_field_def(r):
    return {
        "id": str(r[0]),
        "category": r[1],
        "field_name": r[2],
        "field_label": r[3],
        "field_type": r[4],
        "options": r[5] if r[5] else [],
        "required": r[6],
        "sort_order": r[7],
    }

REQUEST_COLS = """id,title,description,"serviceType",priority,status,"purchaseOrder",
    "customerId","customerName","customerLocationProfileId","contractorProfileId",
    "quoteAmount","invoiceAmount","requestStartDate","requestEndDate",asset_id"""

def _row_to_job(r):
    return {
        "id": str(r[0]), "title": r[1], "description": r[2], "serviceType": r[3],
        "priority": r[4], "status": r[5], "purchaseOrder": r[6],
        "customerId": str(r[7]) if r[7] else None, "customerName": r[8],
        "customerLocationProfileId": str(r[9]) if r[9] else None,
        "contractorProfileId": str(r[10]) if r[10] else None,
        "quoteAmount": float(r[11]) if r[11] else None,
        "invoiceAmount": float(r[12]) if r[12] else None,
        "requestStartDate": r[13].isoformat() if r[13] else None,
        "requestEndDate": r[14].isoformat() if r[14] else None,
        "asset_id": str(r[15]) if r[15] else None,
    }

USAGE_COLS = "id, part_id, request_id, quantity, used_by, used_at"

def _row_to_usage(r):
    return {
        "id": str(r[0]),
        "part_id": str(r[1]) if r[1] else None,
        "request_id": str(r[2]) if r[2] else None,
        "quantity": r[3],
        "used_by": str(r[4]) if r[4] else None,
        "used_at": r[5].isoformat() if r[5] else None,
    }

def _exec(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    return rows

def list_assets(conn, filters=None):
    filters = filters or {}
    clauses = []
    params = []
    if filters.get("category"):
        clauses.append("category = %s")
        params.append(filters["category"])
    if filters.get("status"):
        clauses.append("status = %s")
        params.append(filters["status"])
    if filters.get("customer_id"):
        clauses.append("customer_id = %s::uuid")
        params.append(filters["customer_id"])
    if filters.get("contractor_id"):
        clauses.append("assigned_contractor_id = %s::uuid")
        params.append(filters["contractor_id"])
    if filters.get("search"):
        clauses.append("(asset_name ILIKE %s OR asset_code ILIKE %s OR serial_number ILIKE %s)")
        like = f"%{filters['search']}%"
        params.extend([like, like, like])
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    sql = f"SELECT {ASSET_V2_COLS} FROM assets_v2 {where} ORDER BY asset_name ASC NULLS LAST"
    rows = _exec(conn, sql, params)
    return [_row_to_asset_v2(r) for r in rows]

def get_asset(conn, asset_id):
    sql = f"SELECT {ASSET_V2_COLS} FROM assets_v2 WHERE id = %s::uuid"
    rows = _exec(conn, sql, (asset_id,))
    if rows:
        return _row_to_asset_v2(rows[0])
    return None

def create_asset(conn, data, user_id=None):
    asset_id = str(uuid4())
    qr_code = qr.generate_qr_code(asset_id, BASE_URL)
    cols = ["id", "asset_name", "asset_code", "qr_code", "category", "sub_category",
            "status", "criticality", "manufacturer", "model", "serial_number",
            "customer_id", "customer_location_id", "assigned_contractor_id",
            "parent_asset_id", "install_date", "purchase_date", "warranty_expiry_date",
            "notes", "custom_fields", "created_by"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [
        asset_id, data.get("asset_name"), data.get("asset_code"), qr_code,
        data.get("category", "Other"), data.get("sub_category"),
        data.get("status", "Active"), data.get("criticality", "Medium"),
        data.get("manufacturer"), data.get("model"), data.get("serial_number"),
        data.get("customer_id"), data.get("customer_location_id"),
        data.get("assigned_contractor_id"), data.get("parent_asset_id"),
        data.get("install_date"), data.get("purchase_date"),
        data.get("warranty_expiry_date"), data.get("notes"),
        json.dumps(data.get("custom_fields")) if data.get("custom_fields") else "{}",
        user_id,
    ]
    sql = f"INSERT INTO assets_v2 ({col_str}) VALUES ({ph})"
    cur = conn.cursor()
    cur.execute(sql, vals)
    cur.close()
    audit_db.log_event(
        conn,
        asset_id=asset_id,
        event_type="created",
        actor_id=user_id,
        details={"asset_name": data.get("asset_name"), "asset_code": data.get("asset_code")}
    )
    return get_asset(conn, asset_id)

def update_asset(conn, asset_id, data):
    fields = []
    values = []
    for key, val in data.items():
        if key == "custom_fields":
            fields.append(f"{key} = %s")
            values.append(json.dumps(val) if val else None)
        elif key in ("photo_urls",):
            fields.append(f"{key} = %s")
            values.append(val)
        else:
            fields.append(f"{key} = %s")
            values.append(val)
    if not fields:
        return get_asset(conn, asset_id)
    values.append(asset_id)
    sql = f"UPDATE assets_v2 SET {', '.join(fields)} WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, values)
    cur.close()
    return get_asset(conn, asset_id)

def retire_asset(conn, asset_id):
    sql = "UPDATE assets_v2 SET status = 'Retired', lifecycle_status = 'retired' WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, (asset_id,))
    cur.close()
    return get_asset(conn, asset_id)

def transfer_asset(conn, asset_id, new_customer_id, new_location_id):
    sql = "UPDATE assets_v2 SET customer_id = %s::uuid, customer_location_id = %s::uuid WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, (new_customer_id, new_location_id, asset_id))
    cur.close()
    return get_asset(conn, asset_id)

def bulk_update_status(conn, asset_ids, status, user_id=None):
    sql = "UPDATE assets_v2 SET status = %s WHERE id = ANY(%s::uuid[])"
    cur = conn.cursor()
    cur.execute(sql, (status, asset_ids))
    updated = cur.rowcount
    cur.close()
    for aid in asset_ids:
        audit_db.log_event(conn, asset_id=aid, event_type="bulk_status_update",
                           actor_id=user_id, details={"status": status})
    return {"updated": updated}


def bulk_transfer(conn, asset_ids, customer_id, location_id, user_id=None):
    sql = "UPDATE assets_v2 SET customer_id = %s::uuid, customer_location_id = %s::uuid WHERE id = ANY(%s::uuid[])"
    cur = conn.cursor()
    cur.execute(sql, (customer_id, location_id, asset_ids))
    updated = cur.rowcount
    cur.close()
    for aid in asset_ids:
        audit_db.log_event(conn, asset_id=aid, event_type="bulk_transfer",
                           actor_id=user_id,
                           details={"customer_id": customer_id, "location_id": location_id})
    return {"updated": updated}


def bulk_assign_contractor(conn, asset_ids, contractor_id, user_id=None):
    sql = "UPDATE assets_v2 SET assigned_contractor_id = %s::uuid WHERE id = ANY(%s::uuid[])"
    cur = conn.cursor()
    cur.execute(sql, (contractor_id, asset_ids))
    updated = cur.rowcount
    cur.close()
    for aid in asset_ids:
        audit_db.log_event(conn, asset_id=aid, event_type="bulk_assign_contractor",
                           actor_id=user_id,
                           details={"contractor_id": contractor_id})
    return {"updated": updated}


def list_parts(conn, asset_id=None):
    if asset_id:
        sql = f"SELECT {PART_COLS} FROM asset_parts WHERE asset_id = %s::uuid ORDER BY name ASC"
        rows = _exec(conn, sql, (asset_id,))
    else:
        sql = f"SELECT {PART_COLS} FROM asset_parts ORDER BY name ASC"
        rows = _exec(conn, sql)
    return [_row_to_part(r) for r in rows]

def create_part(conn, data):
    cols = ["asset_id", "name", "sku", "quantity", "min_threshold", "unit"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [data.get("asset_id"), data.get("name"), data.get("sku"),
            data.get("quantity", 0), data.get("min_threshold", 0), data.get("unit", "each")]
    sql = f"INSERT INTO asset_parts ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    part_id = str(row[0]) if row else None
    if not part_id:
        return None
    return get_part(conn, part_id)

def get_part(conn, part_id):
    sql = f"SELECT {PART_COLS} FROM asset_parts WHERE id = %s::uuid"
    rows = _exec(conn, sql, (part_id,))
    if rows:
        return _row_to_part(rows[0])
    return None

def update_part(conn, part_id, data):
    fields = []
    values = []
    for key, val in data.items():
        if val is None:
            continue
        fields.append(f"{key} = %s")
        values.append(val)
    if not fields:
        return get_part(conn, part_id)
    values.append(part_id)
    sql = f"UPDATE asset_parts SET {', '.join(fields)} WHERE id = %s::uuid"
    cur = conn.cursor()
    cur.execute(sql, values)
    cur.close()
    return get_part(conn, part_id)

def delete_part(conn, part_id):
    cur = conn.cursor()
    cur.execute("DELETE FROM asset_parts WHERE id = %s::uuid", (part_id,))
    cur.close()

def record_part_usage(conn, part_id, request_id, quantity, user_id=None):
    rows = _exec(conn, "SELECT quantity FROM asset_parts WHERE id = %s::uuid", (part_id,))
    if not rows:
        raise ValueError("Part not found")
    current_qty = rows[0][0]
    if current_qty < quantity:
        raise ValueError(f"Insufficient stock: have {current_qty}, need {quantity}")
    rows = _exec(conn,
        "INSERT INTO asset_part_usage (part_id, request_id, quantity, used_by) VALUES (%s::uuid, %s::uuid, %s, %s) RETURNING id",
        (part_id, request_id, quantity, user_id))
    usage_id = str(rows[0][0]) if rows else None
    _exec(conn, "UPDATE asset_parts SET quantity = quantity - %s WHERE id = %s::uuid", (quantity, part_id))
    if usage_id:
        rows = _exec(conn, f"SELECT {USAGE_COLS} FROM asset_part_usage WHERE id = %s::uuid", (usage_id,))
        if rows:
            return _row_to_usage(rows[0])
    return None

def list_asset_jobs(conn, asset_id):
    sql = f"SELECT {REQUEST_COLS} FROM requests WHERE asset_id = %s::uuid ORDER BY \"requestStartDate\" DESC NULLS LAST"
    rows = _exec(conn, sql, (asset_id,))
    return [_row_to_job(r) for r in rows]

def create_asset_job(conn, asset_id, data, user_id=None):
    title = data.get("job_type", "")
    desc = data.get("description")
    priority = data.get("priority", "medium")
    user_id_str = str(user_id) if user_id else None
    sql = """INSERT INTO requests (title, description, priority, status, asset_id, "customerId")
             VALUES (%s, %s, %s, 'pending_approval', %s::uuid, %s::uuid) RETURNING id"""
    cur = conn.cursor()
    cur.execute(sql, (title, desc, priority, asset_id, user_id_str))
    row = cur.fetchone()
    cur.close()
    job_id = str(row[0]) if row else None
    if not job_id:
        return None
    sql = f"SELECT {REQUEST_COLS} FROM requests WHERE id = %s::uuid"
    rows = _exec(conn, sql, (job_id,))
    if rows:
        return _row_to_job(rows[0])
    return None

def get_custom_field_defs(conn, category=None):
    if category:
        sql = f"SELECT {CUSTOM_FIELD_DEF_COLS} FROM asset_custom_field_defs WHERE category = %s ORDER BY sort_order ASC"
        rows = _exec(conn, sql, (category,))
    else:
        sql = f"SELECT {CUSTOM_FIELD_DEF_COLS} FROM asset_custom_field_defs ORDER BY sort_order ASC"
        rows = _exec(conn, sql)
    return [_row_to_custom_field_def(r) for r in rows]

def create_custom_field_def(conn, data):
    cols = ["category", "field_name", "field_label", "field_type", "options", "required", "sort_order"]
    ph = ", ".join(["%s"] * len(cols))
    col_str = ", ".join(cols)
    vals = [data.get("category"), data.get("field_name"), data.get("field_label"),
            data.get("field_type", "text"),
            json.dumps(data.get("options")) if data.get("options") else None,
            data.get("required", False), data.get("sort_order", 0)]
    sql = f"INSERT INTO asset_custom_field_defs ({col_str}) VALUES ({ph}) RETURNING id"
    cur = conn.cursor()
    cur.execute(sql, vals)
    row = cur.fetchone()
    cur.close()
    field_id = str(row[0]) if row else None
    if not field_id:
        return None
    sql = f"SELECT {CUSTOM_FIELD_DEF_COLS} FROM asset_custom_field_defs WHERE id = %s::uuid"
    rows = _exec(conn, sql, (field_id,))
    if rows:
        return _row_to_custom_field_def(rows[0])
    return None
