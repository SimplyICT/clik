"""Apply performance indexes to the SimplyClik database.
Safe to run repeatedly (all CREATE INDEX IF NOT EXISTS)."""
import os, sys, pg8000
from dotenv import load_dotenv
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

host = os.environ.get("DB_HOST")
port = int(os.environ.get("DB_PORT", 5432))
dbname = os.environ.get("DB_NAME", "postgres")
user = os.environ.get("DB_USER")
password = os.environ.get("DB_PASSWORD")

if not all([host, user, password]):
    print("ERROR: Missing DB environment variables (DB_HOST, DB_USER, DB_PASSWORD)")
    sys.exit(1)

STATEMENTS = [
    # Every API request validates session via sessions.token
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);",
    # Cleanup old sessions
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);",
    # Assets page sorts by asset_name
    "CREATE INDEX IF NOT EXISTS idx_assets_v2_asset_name ON assets_v2(asset_name);",
    # Permission lookups: user_id + resource
    "CREATE INDEX IF NOT EXISTS idx_user_permissions_user_resource ON user_permissions(user_id, resource);",
    # Work orders sorted by created_at desc
    "CREATE INDEX IF NOT EXISTS idx_asset_work_orders_created_at ON asset_work_orders(created_at DESC);",
    # Requests filtered by customer_id (manager dashboard)
    'CREATE INDEX IF NOT EXISTS idx_requests_customer_id ON requests("customerId");',
    # customerLocations is a view — check if customerId filter can be optimized via underlying tables
    "CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON profiles(customer_id);",
]

conn = pg8000.connect(host=host, port=port, database=dbname, user=user, password=password, ssl_context=True)
success = 0
failed = 0
for sql in STATEMENTS:
    try:
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        conn.commit()
        print(f"  ✓ {sql[:90].strip()}")
        success += 1
    except Exception as e:
        conn.rollback()
        msg = str(e).split("=>")[-1].strip()[:100]
        print(f"  ✗ {sql[:90].strip()} => {msg}")
        failed += 1

cur = conn.cursor()
# Also check if customerLocations is a view
try:
    cur.execute("SELECT relkind FROM pg_class WHERE relname = 'customerLocations'")
    row = cur.fetchone()
    if row:
        kind = {"r": "table", "v": "view", "m": "materialized view"}.get(row[0], row[0])
        print(f"\nℹ customerLocations is a {kind} — cannot index directly.")
except:
    pass
cur.close()
conn.close()
print(f"\nDone. {success} applied, {failed} failed.")
