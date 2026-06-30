"""Copy data from Supabase to local PostgreSQL."""
import os, sys, json
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

def copy_table(name, src_cols):
    """Copy one table's data using bulk operations."""
    sch, tbl = name.split(".")
    qn = f'"{tbl}"' if any(c.isupper() for c in tbl) else tbl
    if sch != "public":
        qn = f"{sch}.{qn}"

    cnames = [c[0] for c in src_cols]
    qcols = ", ".join(f'"{c}"' if any(x.isupper() for x in c) else c for c in cnames)
    ph = ", ".join(["%s"] * len(cnames))
    sql = f"INSERT INTO {qn} ({qcols}) VALUES ({ph}) ON CONFLICT DO NOTHING"

    src = pg8000.connect(**SRC)
    dst = pg8000.connect(**DST)
    cur_src = src.cursor()
    cur_dst = dst.cursor()

    try:
        cur_src.execute(f"SELECT {qcols} FROM {qn} ORDER BY 1")
    except Exception as e:
        return 0, 0

    rows = cur_src.fetchall()
    if not rows:
        return 0, 0

    ok = 0
    for row in rows:
        vals = []
        for v in row:
            if isinstance(v, UUID):
                vals.append(str(v))
            elif isinstance(v, datetime):
                vals.append(v.isoformat())
            elif isinstance(v, Decimal):
                vals.append(float(v))
            elif isinstance(v, list):
                vals.append('{}' if len(v) == 0 else '{' + ','.join(str(x) for x in v) + '}')
            elif isinstance(v, dict):
                vals.append(json.dumps(v))
            else:
                vals.append(v)
        try:
            cur_dst.execute("SAVEPOINT sp")
            cur_dst.execute(sql, vals)
            cur_dst.execute("RELEASE SAVEPOINT sp")
            ok += 1
        except Exception:
            cur_dst.execute("ROLLBACK TO SAVEPOINT sp")

    dst.commit()
    cur_src.close()
    cur_dst.close()
    src.close()
    dst.close()
    return len(rows), ok

if __name__ == "__main__":
    # Get columns from destination
    dst = pg8000.connect(**DST)
    cur = dst.cursor()
    cur.execute("""
        SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog','information_schema')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
    """)
    tables = cur.fetchall()

    for sch, tbl in tables:
        cur.execute("""
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (sch, tbl))
        cols = cur.fetchall()
        name = f"{sch}.{tbl}"
        total, ok = copy_table(name, cols)
        if total > 0:
            print(f"  {name}: {ok}/{total} rows")
    cur.close()
    dst.close()
    print("Done!")
