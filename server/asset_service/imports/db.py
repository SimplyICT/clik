import csv
import io


def parse_csv(content, delimiter=","):
    if not content or not content.strip():
        return []
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    return [dict(r) for r in reader]


def validate_asset_import_row(row, index):
    errors = []
    if not row.get("asset_name", "").strip():
        errors.append("asset_name is required")
    if not row.get("asset_code", "").strip():
        errors.append("asset_code is required")
    return errors


def _create_single_asset(conn, row, user_id=None):
    errors = validate_asset_import_row(row, 0)
    if errors:
        return None, errors

    from asset_service.db import create_asset

    data = {
        "asset_name": row.get("asset_name"),
        "asset_code": row.get("asset_code"),
        "category": row.get("category", "Other"),
        "status": row.get("status", "Active"),
        "criticality": row.get("criticality", "Medium"),
        "manufacturer": row.get("manufacturer"),
        "model": row.get("model"),
        "serial_number": row.get("serial_number"),
        "notes": row.get("notes"),
    }

    asset = create_asset(conn, data, user_id)

    extra_cols = []
    extra_vals = []
    for col in ("purchase_cost", "replacement_value", "location_name", "contractor_name"):
        val = row.get(col)
        if val is not None and str(val).strip():
            extra_cols.append(f"{col} = %s")
            extra_vals.append(val)
    if extra_cols:
        extra_vals.append(asset["id"])
        cur = conn.cursor()
        cur.execute(f"UPDATE assets_v2 SET {', '.join(extra_cols)} WHERE id = %s::uuid", extra_vals)
        cur.close()

    conn.commit()
    return asset, []


def import_assets(conn, rows, user_id=None):
    result = {"imported": 0, "skipped": 0, "errors": []}
    for i, row in enumerate(rows):
        index = i + 1
        asset, errors = _create_single_asset(conn, row, user_id)
        if errors:
            result["skipped"] += 1
            result["errors"].append({"row": index, "message": "; ".join(errors)})
        else:
            result["imported"] += 1
    return result
