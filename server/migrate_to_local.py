"""
Dump schema + data from Supabase PG 17 and restore to local PG 16.
Uses pg8000 to bypass pg_dump version mismatch.
"""
import os, sys, json, re
from datetime import datetime
from uuid import UUID
from decimal import Decimal
from dotenv import load_dotenv
from pathlib import Path
import pg8000

load_dotenv(Path(__file__).resolve().parent / ".env")

SRC = dict(
    host=os.environ["DB_HOST"], port=int(os.environ.get("DB_PORT", 5432)),
    database=os.environ.get("DB_NAME", "postgres"),
    user=os.environ.get("DB_USER", "postgres"),
    password=os.environ["DB_PASSWORD"], ssl_context=True,
)
DST = dict(
    host="localhost", port=5432, database="simplyclik",
    user="aiagent", ssl_context=False,
)

def connect(cfg):
    return pg8000.connect(**cfg)

EXCLUDE_SCHEMAS = {'pg_catalog', 'information_schema', 'extensions', 'graphql', 'graphql_public', 'net', 'pgtle', 'supabase_functions'}
EXCLUDE_TABLES = {
    'supabase_migrations.schema_migrations',
    'audit_log_entry',
}

def get_schema(cur):
    """Extract all DDL from information_schema."""
    # Get custom types (enums)
    cur.execute("""
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder
    """)
    enums = {}
    for name, label in cur.fetchall():
        enums.setdefault(name, []).append(label)

    # Get tables
    cur.execute("""
        SELECT table_schema, table_name, table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog','information_schema','_graphql','extensions','net','pgtle','supabase_functions','storage','auth')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
    """)
    tables = cur.fetchall()

    # Get columns for each table
    schema_info = {}
    for sch, tbl, _ in tables:
        cur.execute(f"""
            SELECT column_name, data_type, is_nullable, column_default,
                   character_maximum_length, udt_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (sch, tbl))
        schema_info[f"{sch}.{tbl}"] = cur.fetchall()

    return enums, schema_info

def build_ddl(enums, schema_info):
    """Generate CREATE TYPE and CREATE TABLE statements."""
    lines = []
    lines.append("-- Auto-generated DDL from Supabase")
    lines.append("-- Custom enums")
    for name, labels in sorted(enums.items()):
        vals = ", ".join(f"'{l}'" for l in labels)
        lines.append(f"CREATE TYPE {name} AS ENUM ({vals});")

    for full_name, cols in schema_info.items():
        lines.append(f"\n-- {full_name}")
        sch, tbl = full_name.split(".")
        col_defs = []
        for name, dtype, nullable, default, charmax, udt in cols:
            pg_type = udt or dtype
            if dtype in ('ARRAY',):
                pg_type = 'TEXT[]'
            elif dtype in ('USER-DEFINED',):
                pg_type = udt
            elif dtype == 'jsonb':
                pg_type = 'jsonb'
            elif dtype == 'uuid':
                pg_type = 'uuid'
            elif 'numeric' in dtype:
                pg_type = dtype
            elif 'timestamp' in dtype:
                pg_type = dtype
            elif 'bool' in dtype:
                pg_type = 'boolean'
            elif 'int' in dtype:
                pg_type = dtype

            col = f'  "{name}" {pg_type}' if any(c.isupper() for c in name) else f'  {name} {pg_type}'
            if default:
                col += f" DEFAULT {default}"
            if nullable == 'NO':
                col += " NOT NULL"
            col_defs.append(col)

        lines.append("CREATE TABLE IF NOT EXISTS " + (f'"{tbl}"' if any(c.isupper() for c in tbl) else tbl) + " (")
        lines.append(",\n".join(col_defs))
        lines.append(");")
    return "\n".join(lines)

def serialize(v):
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return json.dumps(v)
    if isinstance(v, list):
        return json.dumps(v)
    return v

def migrate():
    src = connect(SRC)
    dst = connect(DST)
    cur_src = src.cursor()
    cur_dst = dst.cursor()

    print("Step 1: Extracting schema from Supabase...")
    enums, schema_info = get_schema(cur_src)
    ddl = build_ddl(enums, schema_info)

    # Write DDL to file for reference
    with open("/home/aiagent/pg_data/schema.sql", "w") as f:
        f.write(ddl)
    print(f"  Schema written ({len(schema_info)} tables, {len(enums)} enums)")

    print("Step 2: Creating schema locally...")
    cur_dst.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    # Split DDL by semicolons and execute each statement
    for stmt in ddl.split(";"):
        stmt = stmt.strip()
        if stmt and not stmt.startswith("--"):
            try:
                cur_dst.execute(stmt)
            except Exception as e:
                print(f"  SKIP schema: {str(e)[:100]}")

    dst.commit()

    print("Step 3: Copying data...")
    for full_name, cols in schema_info.items():
        sch, tbl = full_name.split(".")
        quoted_name = f'"{tbl}"' if any(c.isupper() for c in tbl) else tbl
        if sch != 'public':
            quoted_name = f"{sch}.{quoted_name}"

        col_names = [c[0] for c in cols]
        quoted_cols = ', '.join(f'"{c}"' if any(x.isupper() for x in c) else c for c in col_names)
        ph = ', '.join(['%s'] * len(col_names))
        insert_sql = f"INSERT INTO {quoted_name} ({quoted_cols}) VALUES ({ph}) ON CONFLICT DO NOTHING"

        try:
            cur_src.execute(f"SELECT {quoted_cols} FROM {quoted_name} ORDER BY 1")
        except Exception as e:
            continue

        rows = cur_src.fetchall()
        if not rows:
            continue

        count = 0
        for row in rows:
            try:
                vals = [serialize(v) for v in row]
                cur_dst.execute(insert_sql, vals)
                count += 1
            except Exception as e:
                pass  # skip problematic rows

        dst.commit()
        print(f"  {quoted_name}: {count}/{len(rows)} rows")

    # Create the Supabase views
    print("\nStep 4: Creating Supabase-compatible views...")
    views_sql = """
    CREATE OR REPLACE VIEW requests AS
    SELECT r.id, r.title, r.description, r.service_type AS "serviceType",
           r.priority, r.status, r.purchase_order AS "purchaseOrder",
           r.customer_id AS "customerId", c.name AS "customerName",
           r.customer_location_profile_id AS "customerLocationProfileId",
           r.contractor_profile_id AS "contractorProfileId",
           r.quote_amount AS "quoteAmount", r.invoice_amount AS "invoiceAmount",
           r.request_start_date AS "requestStartDate",
           r.request_end_date AS "requestEndDate",
           r.new_notes_customer AS "newNotesCustomer",
           r.new_notes_contractor AS "newNotesContractor",
           r.new_notes_hq AS "newNotesHq",
           r.created_at AS "createdAt", r.updated_at AS "updatedAt",
           r.asset_id AS "assetId"
    FROM requests_base r
    LEFT JOIN customers_base c ON c.id = r.customer_id;

    CREATE OR REPLACE VIEW "customerLocations" AS
    SELECT id, user_id AS "userId", profile_type AS "profileType",
           company_name AS "companyName", contact_name AS "contactName",
           contact_email AS "contactEmail",
           contact_phone_number AS "contactPhoneNumber",
           service_contact_name AS "serviceContactName",
           service_contact_email AS "serviceContactEmail",
           address_json AS "addressJson", reference,
           customer_id AS "customerId", geo_lat AS "geoLat",
           geo_lng AS "geoLng", is_verified AS "isVerified",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM profiles
    WHERE profile_type = 'customer_location';

    CREATE OR REPLACE VIEW customers AS
    SELECT id, name, logo_url AS "logoUrl",
           payment_email AS "paymentEmail",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM customers_base;
    """
    for stmt in views_sql.strip().split(";"):
        stmt = stmt.strip()
        if stmt and not stmt.startswith("--"):
            try:
                cur_dst.execute(stmt)
            except Exception as e:
                print(f"  SKIP view: {str(e)[:100]}")
    dst.commit()

    print("\nStep 5: Creating indexes...")
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)",
        'CREATE INDEX IF NOT EXISTS idx_requests_contractor ON requests_base(contractor_profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_requests_customer_location ON requests_base(customer_location_profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_requests_start_date ON requests_base(request_start_date DESC)',
        'CREATE INDEX IF NOT EXISTS idx_requests_status ON requests_base(status)',
        'CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON profiles(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_requests_base_customer_id ON requests_base(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_requests_base_asset_id ON requests_base(asset_id)',
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_asset_name ON assets_v2(asset_name)",
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_customer_id ON assets_v2(customer_id)",
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_contractor_id ON assets_v2(assigned_contractor_id)",
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_category ON assets_v2(category)",
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_status ON assets_v2(status)",
        "CREATE INDEX IF NOT EXISTS idx_assets_v2_qr_code ON assets_v2(qr_code)",
        "CREATE INDEX IF NOT EXISTS idx_asset_work_orders_asset_id ON asset_work_orders(asset_id)",
        "CREATE INDEX IF NOT EXISTS idx_asset_work_orders_status ON asset_work_orders(status)",
        "CREATE INDEX IF NOT EXISTS idx_asset_work_orders_assigned_contractor ON asset_work_orders(assigned_contractor_id)",
        "CREATE INDEX IF NOT EXISTS idx_asset_work_orders_created_at ON asset_work_orders(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_user_permissions_user_resource ON user_permissions(user_id, resource)",
        'CREATE INDEX IF NOT EXISTS idx_requests_customer_id ON requests("customerId")',
        'CREATE INDEX IF NOT EXISTS idx_customer_locations_customer_id ON "customerLocations"("customerId")',
    ]
    for idx in indexes:
        try:
            cur_dst.execute(idx)
        except Exception as e:
            print(f"  SKIP idx: {str(e)[:100]}")
    dst.commit()

    cur_src.close()
    cur_dst.close()
    src.close()
    dst.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
