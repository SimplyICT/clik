"""
SimplyClik FastAPI Server — replaces server.py and portal-server.py.
Run in admin mode:  uvicorn fastapi_app:app --host 0.0.0.0 --port 3001
Run in portal mode: MODE=portal uvicorn fastapi_app:app --host 0.0.0.0 --port 3002
"""
import os, json, bcrypt, secrets, mimetypes, pg8000, time, logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Load .env BEFORE any other local imports that read env vars
ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from scheduler import init_scheduler, scheduler as sched
from notifications import init_notifications as init_notif, get_inapp, mark_read, notify_request_update
from asset_service.routes import router as asset_management_router
from asset_service.documents.routes import router as documents_router
from asset_service.costs.routes import router as costs_router
from asset_service.maintenance.routes import router as maintenance_router
from asset_service.work_orders.routes import router as work_orders_router
from asset_service.reports.routes import router as reports_router
from asset_service.imports.routes import router as imports_router
from asset_service.audit.routes import router as audit_router
from asset_service.permissions_routes import router as permissions_router
from asset_service.invite_routes import router as invite_router

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

ROOT = Path(__file__).resolve().parent.parent
ADMIN_BUILD = ROOT / "web-admin" / "build"
PORTAL_BUILD = ROOT / "web-portal" / "build"
MOBILE_BUILD = ROOT / "web-mobile" / "build"
MODE = os.environ.get("MODE", "admin")
BUILD_DIR = MOBILE_BUILD if MODE == "mobile" else (PORTAL_BUILD if MODE == "portal" else ADMIN_BUILD)

def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return val

SUPABASE_URL = _require_env("SUPABASE_URL")
ANON_KEY = _require_env("ANON_KEY")
DB_CONFIG = dict(
    host=_require_env("DB_HOST"),
    port=int(_require_env("DB_PORT")),
    database=_require_env("DB_NAME"),
    user=_require_env("DB_USER"),
    password=_require_env("DB_PASSWORD"),
    ssl_context=True,
)

# ── session store (DB-backed, survives restarts) ──────────────────────────
SESSION_TTL = timedelta(days=30)  # localStorage persists, so extend session lifetime

def create_session(data: dict) -> str:
    token = secrets.token_hex(32)
    now = datetime.utcnow().isoformat()
    expires = (datetime.utcnow() + SESSION_TTL).isoformat()
    db("INSERT INTO sessions (token, user_id, data, created_at, expires_at) VALUES (%s,%s,%s,%s,%s)",
       (token, data.get("uid", ""), json.dumps(data), now, expires))
    return token

def validate_session(token: str) -> dict | None:
    rows = db("SELECT data, expires_at FROM sessions WHERE token = %s", (token,))
    if not rows:
        return None
    data_str, expires_dt = rows[0]
    if expires_dt and datetime.utcnow() > expires_dt.replace(tzinfo=None):
        db("DELETE FROM sessions WHERE token = %s", (token,))
        return None
    return json.loads(data_str) if isinstance(data_str, str) else data_str

# ── lifespan ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=15)
    if MODE == "admin":
        init_scheduler(DB_CONFIG)
        sched.start()
        import logging
        logging.getLogger("simplyclik.scheduler").info("Scheduler started (st01 12h, st02 4h)")
    init_notif(DB_CONFIG)
    yield
    if MODE == "admin":
        sched.shutdown(wait=False)
    await app.state.http.aclose()

app = FastAPI(lifespan=lifespan, title=f"SimplyClik {MODE.title()} API", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(asset_management_router)
app.include_router(documents_router)
app.include_router(costs_router)
app.include_router(maintenance_router)
app.include_router(work_orders_router)
app.include_router(reports_router)
app.include_router(imports_router)
app.include_router(audit_router)
app.include_router(permissions_router)
app.include_router(invite_router)

# ── helpers ───────────────────────────────────────────────────────────────
import threading
_db_local = threading.local()

def _get_conn():
    if not hasattr(_db_local, "conn") or _db_local.conn is None:
        _db_local.conn = pg8000.connect(**DB_CONFIG)
    return _db_local.conn

def db(sql: str, params=None):
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(sql, params or [])
    try:
        rows = cur.fetchall()
        conn.commit()
        return rows
    except:
        conn.commit()
        return []
    finally:
        cur.close()

def guess_ct(path: str) -> str:
    return mimetypes.guess_type(path)[0] or "application/octet-stream"

# ── auth dependency ───────────────────────────────────────────────────────
async def require_session(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Missing or invalid token")
    token = authorization[7:]
    session = validate_session(token)
    if not session:
        raise HTTPException(401, detail="Invalid or expired token")
    return session

# ── login ─────────────────────────────────────────────────────────────────
LOGIN_RATELIMIT: dict[str, list[float]] = {}

def _check_login_rate_limit(ip: str):
    now = time.time()
    window = 60.0
    if ip not in LOGIN_RATELIMIT:
        LOGIN_RATELIMIT[ip] = []
    LOGIN_RATELIMIT[ip] = [t for t in LOGIN_RATELIMIT[ip] if now - t < window]
    if len(LOGIN_RATELIMIT[ip]) >= 5:
        raise HTTPException(429, detail="Too many login attempts. Try again later.")
    LOGIN_RATELIMIT[ip].append(now)

@app.post("/api/login")
async def handle_login(request: Request):
    _check_login_rate_limit(request.client.host if request.client else "unknown")
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    if not email or not pw:
        raise HTTPException(400, detail="Email and password required")

    try:
        rows = db("SELECT id, email, encrypted_password FROM auth.users WHERE email = %s", (email,))
        if not rows:
            raise HTTPException(401, detail="Invalid credentials")
        uid, db_email, pw_hash = rows[0]
        if not bcrypt.checkpw(pw.encode(), pw_hash.encode()):
            raise HTTPException(401, detail="Invalid credentials")

        # Always fetch profile data for portal/mobile fields (contractor, customer_id, etc.)
        profile = db("""
            SELECT up.role, up.customer_ref, p.customer_id, p.id
            FROM public.user_profiles up
            LEFT JOIN public.profiles p ON p.user_id = up.user_id
            WHERE up.user_id = %s LIMIT 1
        """, (uid,))
        customer_ref = profile[0][1] if profile else None
        customer_id = str(profile[0][2]) if profile and profile[0][2] else None
        author_profile_id = str(profile[0][3]) if profile and profile[0][3] else None
        customer_name = None
        if customer_id:
            c = db("SELECT name FROM public.customers WHERE id = %s", (customer_id,))
            if c:
                customer_name = c[0][0]

        if MODE in ("portal", "mobile"):
            session_data = {"uid": str(uid), "email": db_email, "mode": "portal",
                           "customer_id": customer_id, "customer_ref": customer_ref}
            token = create_session(session_data)
            from asset_service.permissions import get_user_permissions, seed_manager_defaults, MANAGER_DEFAULTS
            perms = get_user_permissions(str(uid))
            if not perms:
                profile_role = profile[0][0] if profile else None
                if profile_role and profile_role.lower() == "manager":
                    seed_manager_defaults(str(uid))
                    perms = MANAGER_DEFAULTS
            result = {"token": token, "user": {"id": str(uid), "email": db_email, "uid": str(uid)},
                      "customer_ref": customer_ref, "customer_id": customer_id,
                      "author_profile_id": author_profile_id, "customer_name": customer_name,
                      "permissions": perms or {}}
            return result
        else:
            role_rows = db("SELECT role FROM public.user_roles WHERE user_id = %s", (uid,))
            is_admin = bool(role_rows and role_rows[0][0] == "admin")
            session_data = {"uid": str(uid), "email": db_email, "mode": "admin", "is_admin": is_admin,
                           "customer_id": customer_id, "customer_ref": customer_ref}
            token = create_session(session_data)
            result = {"token": token, "user": {"id": str(uid), "email": db_email, "uid": str(uid)}, "is_admin": is_admin}
            from asset_service.permissions import get_user_permissions, seed_manager_defaults, ADMIN_PERMISSIONS
            if is_admin:
                result["permissions"] = ADMIN_PERMISSIONS
            else:
                perms = get_user_permissions(str(uid))
                if not perms:
                    profile_role = profile[0][0] if profile else None
                    if profile_role and profile_role.lower() == "manager":
                        seed_manager_defaults(str(uid))
                        perms = get_user_permissions(str(uid))
                result["permissions"] = perms
            if customer_id:
                result["customer_id"] = customer_id
                result["customer_ref"] = customer_ref
                result["author_profile_id"] = author_profile_id
                result["customer_name"] = customer_name
            return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))

# ── logout ────────────────────────────────────────────────────────────────
@app.post("/api/logout")
async def handle_logout(authorization: str | None = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        db("DELETE FROM sessions WHERE token = %s", (authorization[7:],))
    return {"ok": True}

# ── Supabase proxy (auth required, allowlisted tables, rate limited) ──────
ALLOWED_TABLES = {
    "customers", "customerLocations", "contractors", "requests",
    "assets", "assets_v2", "leads", "request_notes", "request_invoices",
    "user_profiles", "users", "profiles", "user_roles",
    "leadsHistory", "customer_location_contractors",
}

RATELIMIT: dict[str, list[float]] = {}
RATELIMIT_MAX = int(os.environ.get("RATELIMIT_MAX", "100"))
RATELIMIT_WINDOW = 60.0

def _check_rate_limit(ip: str):
    now = time.time()
    window = RATELIMIT_WINDOW
    if ip not in RATELIMIT:
        RATELIMIT[ip] = []
    RATELIMIT[ip] = [t for t in RATELIMIT[ip] if now - t < window]
    if len(RATELIMIT[ip]) >= RATELIMIT_MAX:
        raise HTTPException(429, detail="Rate limit exceeded")
    RATELIMIT[ip].append(now)

@app.api_route("/api/supabase/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def supabase_proxy(path: str, request: Request, session: dict = Depends(require_session)):
    table = path.split("/")[0].split("?")[0]
    if table not in ALLOWED_TABLES:
        raise HTTPException(403, detail=f"Table not allowed: {table}")
    _check_rate_limit(request.client.host if request.client else "unknown")
    qs = str(request.url).split("?")[1] if "?" in str(request.url) else ""
    url = f"{SUPABASE_URL}/rest/v1/{path}?{qs}" if qs else f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {"apikey": ANON_KEY, "Content-Type": "application/json"}
    # Forward the Prefer header from the frontend (needed for return=representation)
    prefer = request.headers.get("prefer")
    if prefer:
        headers["Prefer"] = prefer
    body = await request.body() if request.method in ("POST", "PATCH") else None
    try:
        resp = await app.state.http.request(request.method, url, content=body, headers=headers)
        # After successful POST to requests, fire notification if contractor was assigned
        if request.method == "POST" and resp.status_code == 201 and table == "requests":
            try:
                data = json.loads(resp.content)
                if isinstance(data, list):
                    data = data[0]
                contr_id = data.get("contractorProfileId")
                if contr_id:
                    from notifications import send_push, send_pushover, user_id_from_profile, get_pushover_key
                    import asyncio
                    title = data.get('title', '')
                    asyncio.create_task(asyncio.to_thread(send_push, contr_id,
                        "New Job Available", f"'{title}' has been assigned to you"))
                    uid = user_id_from_profile(contr_id)
                    if uid:
                        push_key = get_pushover_key(uid)
                        if push_key:
                            job_url = f"https://pwa.simplyclik.com/mobile/jobs/{data.get('id','')}"
                            asyncio.create_task(asyncio.to_thread(send_pushover,
                                "New Job Available", f"'{title}' has been assigned to you", job_url, "Open Job", push_key))
            except:
                pass
        return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
    except httpx.HTTPStatusError as e:
        return Response(content=e.response.content, status_code=e.response.status_code, media_type="application/json")

# ── Customer CRUD (api05) ─────────────────────────────────────────────────
CUSTOMER_COLS = "id,name,\"contactName\",\"contactEmail\",\"contactPhoneNumber\",\"addressJson\",\"serviceContactName\",\"serviceContactEmail\",\"paymentEmail\",billing,\"createdAt\",\"updatedAt\""

def _row_to_customer(r):
    addr = r[5]
    if isinstance(addr, str):
        addr = json.loads(addr) if addr else None
    return {"id": str(r[0]), "name": r[1], "contactName": r[2], "contactEmail": r[3],
            "contactPhoneNumber": r[4], "addressJson": addr,
            "serviceContactName": r[6], "serviceContactEmail": r[7],
            "paymentEmail": r[8], "billing": r[9],
            "createdAt": r[10].isoformat() if r[10] else None,
            "updatedAt": r[11].isoformat() if r[11] else None}

def _customer_filter(session):
    if session.get("mode") == "portal":
        cid = session.get("customer_id")
        if not cid:
            raise HTTPException(400, detail="No customer_id in session")
        return f"WHERE id = '{cid}'::uuid"
    return ""

@app.get("/api/customers")
async def list_customers(session: dict = Depends(require_session)):
    where = _customer_filter(session)
    rows = db(f"SELECT {CUSTOMER_COLS} FROM customers {where} ORDER BY name ASC")
    return [_row_to_customer(r) for r in rows]

@app.get("/api/customers/summary")
async def customer_summary(session: dict = Depends(require_session)):
    where = _customer_filter(session)
    rows = db(f"""
        SELECT c.name,
          (SELECT count(*) FROM \"customerLocations\" cl WHERE cl.\"customerId\" = c.id) as locs,
          (SELECT count(*) FROM requests r WHERE r.\"customerId\" = c.id AND r.status NOT IN ('completed','declined','cancelled')) as open,
          (SELECT count(*) FROM requests r WHERE r.\"customerId\" = c.id AND r.status IN ('completed','declined','cancelled')) as closed,
          (SELECT count(*) FROM requests r WHERE r.\"customerId\" = c.id) as total
        FROM customers c {where} ORDER BY c.name ASC
    """)
    return [{"name": r[0], "locations": r[1], "openRequests": r[2], "closedRequests": r[3], "totalRequests": r[4]} for r in rows]

@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {CUSTOMER_COLS} FROM customers WHERE id = %s::uuid", (customer_id,))
    if not rows:
        raise HTTPException(404, detail="Customer not found")
    cust = _row_to_customer(rows[0])
    locs = db('SELECT count(*) FROM "customerLocations" WHERE "customerId" = %s::uuid', (customer_id,))
    reqs = db("""
        SELECT count(*) FILTER (WHERE status NOT IN ('completed','declined','cancelled')),
               count(*) FILTER (WHERE status IN ('completed','declined','cancelled')),
               count(*) FROM requests WHERE "customerId" = %s::uuid
    """, (customer_id,))
    cust["locationCount"] = locs[0][0] if locs else 0
    cust["openRequests"] = reqs[0][0] if reqs else 0
    cust["closedRequests"] = reqs[0][1] if reqs else 0
    cust["totalRequests"] = reqs[0][2] if reqs else 0
    return cust

@app.post("/api/customers")
async def create_customer(body: dict, session: dict = Depends(require_session)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, detail="Customer name is required")
    addr = json.dumps(body.get("addressJson")) if body.get("addressJson") else None
    rows = db("""
        INSERT INTO customers (name, "contactName", "contactEmail", "contactPhoneNumber",
          "addressJson", "serviceContactName", "serviceContactEmail", "paymentEmail", billing)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (name, body.get("contactName"), body.get("contactEmail"), body.get("contactPhoneNumber"),
          addr, body.get("serviceContactName"), body.get("serviceContactEmail"),
          body.get("paymentEmail"), body.get("billing", "Trial")))
    return {"id": str(rows[0][0])}

UPDATABLE = [("name","name"),("contactName","contactName"),("contactEmail","contactEmail"),
             ("contactPhoneNumber","contactPhoneNumber"),("serviceContactName","serviceContactName"),
             ("serviceContactEmail","serviceContactEmail"),("paymentEmail","paymentEmail"),
             ("billing","billing"),("addressJson","addressJson")]

@app.patch("/api/customers/{customer_id}")
async def update_customer(customer_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in UPDATABLE:
        if key in body:
            v = body[key]
            if key == "addressJson":
                v = json.dumps(v) if v else None
            fields.append(f'"{col}" = %s')
            vals.append(v)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    vals.append(customer_id)
    db(f"UPDATE customers SET {', '.join(fields)} WHERE id = %s::uuid", vals)
    return {"ok": True}

@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM customers WHERE id = %s::uuid", (customer_id,))
    return {"ok": True}

# ── Contractor CRUD (api06) ──────────────────────────────────────────────
CONTRACTOR_COLS = "id,\"companyName\",\"contactName\",\"contactEmail\",\"contactPhoneNumber\",\"addressJson\",\"serviceContactName\",\"serviceContactEmail\",abn,reference"

def _row_to_contractor(r):
    addr = r[5]
    if isinstance(addr, str):
        addr = json.loads(addr) if addr else None
    return {"id": str(r[0]), "companyName": r[1], "contactName": r[2], "contactEmail": r[3],
            "contactPhoneNumber": r[4], "addressJson": addr,
            "serviceContactName": r[6], "serviceContactEmail": r[7], "abn": r[8], "reference": r[9]}

@app.get("/api/contractors")
async def list_contractors(session: dict = Depends(require_session)):
    rows = db(f"SELECT {CONTRACTOR_COLS} FROM contractors ORDER BY \"companyName\" ASC")
    return [_row_to_contractor(r) for r in rows]

@app.get("/api/contractors/{contractor_id}")
async def get_contractor(contractor_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {CONTRACTOR_COLS} FROM contractors WHERE id = %s::uuid", (contractor_id,))
    if not rows:
        raise HTTPException(404, detail="Contractor not found")
    return _row_to_contractor(rows[0])

@app.post("/api/contractors")
async def create_contractor(body: dict, session: dict = Depends(require_session)):
    cn = (body.get("companyName") or "").strip()
    if not cn:
        raise HTTPException(400, detail="Company name is required")
    addr = json.dumps(body.get("addressJson")) if body.get("addressJson") else None
    rows = db("""
        INSERT INTO contractors ("companyName", "contactName", "contactEmail", "contactPhoneNumber",
          "addressJson", "serviceContactName", "serviceContactEmail", abn)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (cn, body.get("contactName"), body.get("contactEmail"), body.get("contactPhoneNumber"),
          addr, body.get("serviceContactName"), body.get("serviceContactEmail"), body.get("abn")))
    return {"id": str(rows[0][0])}

@app.patch("/api/contractors/{contractor_id}")
async def update_contractor(contractor_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in [("companyName","companyName"),("contactName","contactName"),("contactEmail","contactEmail"),
                     ("contactPhoneNumber","contactPhoneNumber"),("serviceContactName","serviceContactName"),
                     ("serviceContactEmail","serviceContactEmail"),("abn","abn"),("reference","reference")]:
        if key in body:
            fields.append(f'"{col}" = %s')
            vals.append(body[key])
    if "addressJson" in body:
        fields.append('"addressJson" = %s')
        vals.append(json.dumps(body["addressJson"]) if body["addressJson"] else None)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    vals.append(contractor_id)
    db(f"UPDATE contractors SET {', '.join(fields)} WHERE id = %s::uuid", vals)
    return {"ok": True}

@app.delete("/api/contractors/{contractor_id}")
async def delete_contractor(contractor_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM contractors WHERE id = %s::uuid", (contractor_id,))
    return {"ok": True}

# ── Location CRUD (api07) ────────────────────────────────────────────────
LOCATION_COLS = "id,\"companyName\",\"contactName\",\"contactEmail\",\"contactPhoneNumber\",\"addressJson\",reference,\"customerId\",\"geoLat\",\"geoLng\""

def _row_to_location(r):
    addr = r[5]
    if isinstance(addr, str):
        addr = json.loads(addr) if addr else None
    return {"id": str(r[0]), "companyName": r[1], "contactName": r[2], "contactEmail": r[3],
            "contactPhoneNumber": r[4], "addressJson": addr, "reference": r[6],
            "customerId": str(r[7]) if r[7] else None, "geoLat": r[8], "geoLng": r[9]}

@app.get("/api/locations")
async def list_locations(session: dict = Depends(require_session)):
    where = ""
    if session.get("mode") == "portal":
        cid = session.get("customer_id")
        if cid:
            where = f'WHERE "customerId" = \'{cid}\'::uuid'
    rows = db(f"SELECT {LOCATION_COLS} FROM \"customerLocations\" {where} ORDER BY \"companyName\" ASC")
    return [_row_to_location(r) for r in rows]

@app.get("/api/locations/{location_id}")
async def get_location(location_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {LOCATION_COLS} FROM \"customerLocations\" WHERE id = %s::uuid", (location_id,))
    if not rows:
        raise HTTPException(404, detail="Location not found")
    return _row_to_location(rows[0])

@app.post("/api/locations")
async def create_location(body: dict, session: dict = Depends(require_session)):
    cn = (body.get("companyName") or "").strip()
    if not cn:
        raise HTTPException(400, detail="Location name is required")
    addr = json.dumps(body.get("addressJson")) if body.get("addressJson") else None
    rows = db("""
        INSERT INTO "customerLocations" ("companyName", "contactName", "contactEmail",
          "contactPhoneNumber", "addressJson", reference, "customerId")
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (cn, body.get("contactName"), body.get("contactEmail"), body.get("contactPhoneNumber"),
          addr, body.get("reference"), body.get("customerId")))
    return {"id": str(rows[0][0])}

@app.patch("/api/locations/{location_id}")
async def update_location(location_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in [("companyName","companyName"),("contactName","contactName"),("contactEmail","contactEmail"),
                     ("contactPhoneNumber","contactPhoneNumber"),("reference","reference"),
                     ("customerId","customerId"),("geoLat","geoLat"),("geoLng","geoLng")]:
        if key in body:
            fields.append(f'"{col}" = %s')
            vals.append(body[key])
    if "addressJson" in body:
        fields.append('"addressJson" = %s')
        vals.append(json.dumps(body["addressJson"]) if body["addressJson"] else None)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    vals.append(location_id)
    db(f'UPDATE "customerLocations" SET {", ".join(fields)} WHERE id = %s::uuid', vals)
    return {"ok": True}

@app.delete("/api/locations/{location_id}")
async def delete_location(location_id: str, session: dict = Depends(require_session)):
    db('DELETE FROM "customerLocations" WHERE id = %s::uuid', (location_id,))
    return {"ok": True}

# ── Request CRUD with state machine (api08) ──────────────────────────────
REQUEST_COLS = "id,title,description,\"serviceType\",priority,status,\"purchaseOrder\",\"customerId\",\"customerName\",\"customerLocationProfileId\",\"contractorProfileId\",\"quoteAmount\",\"invoiceAmount\",\"requestStartDate\",\"requestEndDate\""

VALID_TRANSITIONS = {
    "pending_approval": ["rfi", "awaiting_quote", "cancelled"],
    "rfi": ["pending_approval", "cancelled"],
    "awaiting_quote": ["pending_quote_approval", "cancelled"],
    "pending_quote_approval": ["awaiting_acceptance", "declined", "rfi"],
    "awaiting_acceptance": ["accepted", "declined"],
    "accepted": ["in_progress", "cancelled"],
    "in_progress": ["contractor_completed", "cancelled"],
    "contractor_completed": ["completed", "cancelled"],
    "completed": [],
    "declined": [],
    "cancelled": [],
}

def _row_to_request(r):
    return {"id": str(r[0]), "title": r[1], "description": r[2], "serviceType": r[3],
            "priority": r[4], "status": r[5], "purchaseOrder": r[6],
            "customerId": str(r[7]) if r[7] else None, "customerName": r[8],
            "customerLocationProfileId": str(r[9]) if r[9] else None,
            "contractorProfileId": str(r[10]) if r[10] else None,
            "quoteAmount": float(r[11]) if r[11] else None,
            "invoiceAmount": float(r[12]) if r[12] else None,
            "requestStartDate": r[13].isoformat() if r[13] else None,
            "requestEndDate": r[14].isoformat() if r[14] else None}

@app.get("/api/requests")
async def list_requests(session: dict = Depends(require_session)):
    where = ""
    if session.get("mode") == "portal":
        cid = session.get("customer_id")
        if cid:
            where = f'WHERE "customerId" = \'{cid}\'::uuid'
    rows = db(f"SELECT {REQUEST_COLS} FROM requests {where} ORDER BY \"requestStartDate\" DESC NULLS LAST")
    return [_row_to_request(r) for r in rows]

@app.get("/api/requests/{request_id}")
async def get_request(request_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {REQUEST_COLS} FROM requests WHERE id = %s::uuid", (request_id,))
    if not rows:
        raise HTTPException(404, detail="Request not found")
    return _row_to_request(rows[0])

@app.post("/api/requests")
async def create_request(body: dict, session: dict = Depends(require_session)):
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, detail="Title is required")
    status = body.get("status", "pending_approval")
    loc_id = body.get("customerLocationProfileId")

    # Auto-assign contractor based on customer_location_contractors
    contr_id = body.get("contractorProfileId")
    if not contr_id and loc_id:
        crows = db("SELECT contractor_id::text FROM customer_location_contractors WHERE customer_location_id = %s::uuid LIMIT 1", (loc_id,))
        if crows:
            contr_id = crows[0][0]
            status = "awaiting_acceptance"

    rows = db("""
        INSERT INTO requests (title, description, "serviceType", priority, status,
          "customerId", "customerName", "customerLocationProfileId", "contractorProfileId", "requestStartDate")
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (title, body.get("description"), body.get("serviceType"), body.get("priority", "medium"),
          status, body.get("customerId"), body.get("customerName"),
          loc_id, contr_id, body.get("requestStartDate", None)))

    if contr_id:
        db("INSERT INTO request_contractor_priority (request_id, contractor_id, priority) VALUES (%s,%s,1) ON CONFLICT DO NOTHING",
           (str(rows[0][0]), contr_id))
        from notifications import send_push
        import asyncio
        asyncio.create_task(asyncio.to_thread(send_push, contr_id, 'New Job Available',
            f"'{title}' has been assigned to you"))
    return {"id": str(rows[0][0]), "status": status}

@app.post("/api/requests/{request_id}/transition")
async def transition_request(request_id: str, body: dict, session: dict = Depends(require_session)):
    new_status = body.get("status", "").strip()
    if not new_status:
        raise HTTPException(400, detail="Target status is required")
    rows = db("SELECT status FROM requests WHERE id = %s::uuid", (request_id,))
    if not rows:
        raise HTTPException(404, detail="Request not found")
    current = rows[0][0]
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise HTTPException(400, detail=f"Cannot transition from '{current}' to '{new_status}'. Allowed: {allowed}")
    db("UPDATE requests SET status = %s WHERE id = %s::uuid", (new_status, request_id))
    import asyncio
    asyncio.ensure_future(asyncio.to_thread(notify_request_update, request_id, current, new_status, session))
    return {"ok": True, "from": current, "to": new_status}

@app.patch("/api/requests/{request_id}")
async def update_request(request_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in [("title","title"),("description","description"),("serviceType","serviceType"),
                     ("priority","priority"),("purchaseOrder","purchaseOrder"),
                     ("quoteAmount","quoteAmount"),("quoteDescription","quoteDescription"),
                     ("invoiceAmount","invoiceAmount"),
                     ("contractorProfileId","contractorProfileId"),
                     ("customerLocationProfileId","customerLocationProfileId"),
                     ("requestEndDate","requestEndDate")]:
        if key in body:
            fields.append(f'"{col}" = %s')
            vals.append(body[key])
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    vals.append(request_id)
    db(f"UPDATE requests SET {', '.join(fields)} WHERE id = %s::uuid", vals)
    return {"ok": True}

@app.delete("/api/requests/{request_id}")
async def delete_request(request_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM requests WHERE id = %s::uuid", (request_id,))
    return {"ok": True}

# ── Notes CRUD (api09) ────────────────────────────────────────────────────
NOTE_COLS = "id,request_id,author_profile_id,display_name,description,note_type,visibility,added_date"

def _row_to_note(r):
    return {"id": str(r[0]), "requestId": str(r[1]) if r[1] else None,
            "authorProfileId": str(r[2]) if r[2] else None, "displayName": r[3],
            "description": r[4], "noteType": r[5], "visibility": r[6],
            "addedDate": r[7].isoformat() if r[7] else None}

@app.get("/api/requests/{request_id}/notes")
async def list_notes(request_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {NOTE_COLS} FROM request_notes WHERE request_id = %s::uuid ORDER BY added_date ASC", (request_id,))
    return [_row_to_note(r) for r in rows]

@app.post("/api/requests/{request_id}/notes")
async def create_note(request_id: str, body: dict, session: dict = Depends(require_session)):
    text = (body.get("description") or "").strip()
    if not text:
        raise HTTPException(400, detail="Note text is required")
    rows = db("""
        INSERT INTO request_notes (request_id, author_profile_id, display_name, description, note_type, visibility, added_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (request_id, body.get("authorProfileId") or body.get("author_profile_id"),
          body.get("displayName") or "System", text,
          body.get("noteType", "comment"), body.get("visibility", "public"),
          body.get("addedDate") or datetime.utcnow().isoformat()))
    return {"id": str(rows[0][0])}

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM request_notes WHERE id = %s::uuid", (note_id,))
    return {"ok": True}

# ── Invoice CRUD + auto-approval (api10) ──────────────────────────────────
INVOICE_COLS = "request_id,invoice_number,purchase_order,amount,currency,submit_date,auto_approve_date,customer_id"

def _row_to_invoice(r):
    return {"requestId": str(r[0]) if r[0] else None, "invoiceNumber": r[1], "purchaseOrder": r[2],
            "amount": float(r[3]) if r[3] else None, "currency": r[4],
            "submitDate": r[5].isoformat() if r[5] else None,
            "autoApproveDate": r[6].isoformat() if r[6] else None,
            "customerId": str(r[7]) if r[7] else None}

@app.get("/api/requests/{request_id}/invoice")
async def get_invoice(request_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {INVOICE_COLS} FROM request_invoices WHERE request_id = %s::uuid", (request_id,))
    if not rows:
        return None
    return _row_to_invoice(rows[0])

@app.post("/api/requests/{request_id}/invoice")
async def create_invoice(request_id: str, body: dict, session: dict = Depends(require_session)):
    amount = body.get("amount")
    if not amount:
        raise HTTPException(400, detail="Invoice amount is required")
    submit_date = body.get("submitDate") or datetime.utcnow().isoformat()
    auto_approve = body.get("autoApproveDate") or (datetime.utcnow() + timedelta(hours=48)).isoformat()
    rows = db("""
        INSERT INTO request_invoices (request_id, invoice_number, purchase_order, amount, currency, submit_date, auto_approve_date, customer_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (request_id) DO UPDATE SET amount = EXCLUDED.amount, invoice_number = EXCLUDED.invoice_number
        RETURNING request_id
    """, (request_id, body.get("invoiceNumber"), body.get("purchaseOrder"),
          amount, body.get("currency", "AUD"), submit_date, auto_approve, body.get("customerId")))
    return {"ok": True}

@app.post("/api/invoices/process-auto-approvals")
async def process_auto_approvals(session: dict = Depends(require_session)):
    now = datetime.utcnow().isoformat()
    rows = db("""
        UPDATE request_invoices SET auto_approved = true
        WHERE auto_approve_date <= %s AND (auto_approved IS NULL OR auto_approved = false)
        RETURNING request_id
    """, (now,))
    return {"approved": len(rows)}

# ── Image upload — presigned URLs (api11) ─────────────────────────────────
STORAGE_URL = f"{SUPABASE_URL}/storage/v1"

@app.post("/api/upload/presign")
async def presign_upload(body: dict, session: dict = Depends(require_session)):
    bucket = body.get("bucket", "request-images")
    path = body.get("path", "")
    if not path:
        raise HTTPException(400, detail="Upload path is required")
    url = f"{STORAGE_URL}/object/{bucket}/{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{STORAGE_URL}/object/{bucket}/{path}",
            headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"},
            content=b"",  # empty POST to create the object reference
        )
        # Return the public URL or upload URL
        return {"uploadUrl": url, "publicUrl": f"{STORAGE_URL}/object/public/{bucket}/{path}"}

@app.get("/api/upload/url/{bucket:path}/{filepath:path}")
async def get_upload_url(bucket: str, filepath: str, session: dict = Depends(require_session)):
    return {"url": f"{STORAGE_URL}/object/public/{bucket}/{filepath}"}

# ── Asset CRUD (api12) ────────────────────────────────────────────────────
ASSET_COLS = "id,\"assetName\",\"assetCode\",category,\"subCategory\",status,\"criticality\",manufacturer,model,\"serialNumber\",\"customerId\",\"customerName\",\"customerLocationId\",\"customerLocationName\",\"installDate\",\"purchaseDate\",\"warrantyExpiryDate\",\"lastServiceDate\",\"nextServiceDate\",notes"

def _row_to_asset(r):
    return {"id": str(r[0]), "assetName": r[1], "assetCode": r[2], "category": r[3],
            "subCategory": r[4], "status": r[5], "criticality": r[6],
            "manufacturer": r[7], "model": r[8], "serialNumber": r[9],
            "customerId": str(r[10]) if r[10] else None, "customerName": r[11],
            "customerLocationId": str(r[12]) if r[12] else None, "customerLocationName": r[13],
            "installDate": r[14].isoformat() if r[14] else None,
            "purchaseDate": r[15].isoformat() if r[15] else None,
            "warrantyExpiryDate": r[16].isoformat() if r[16] else None,
            "lastServiceDate": r[17].isoformat() if r[17] else None,
            "nextServiceDate": r[18].isoformat() if r[18] else None, "notes": r[19]}

@app.get("/api/assets")
async def list_assets(session: dict = Depends(require_session)):
    rows = db(f"SELECT {ASSET_COLS} FROM assets ORDER BY \"assetName\" ASC NULLS LAST")
    return [_row_to_asset(r) for r in rows]

@app.get("/api/assets/{asset_id}")
async def get_asset(asset_id: str, session: dict = Depends(require_session)):
    rows = db(f"SELECT {ASSET_COLS} FROM assets WHERE id = %s::uuid", (asset_id,))
    if not rows: raise HTTPException(404, detail="Asset not found")
    return _row_to_asset(rows[0])

ASSET_UPDATABLE = [("assetName","assetName"),("assetCode","assetCode"),("category","category"),
    ("subCategory","subCategory"),("status","status"),("criticality","criticality"),
    ("manufacturer","manufacturer"),("model","model"),("serialNumber","serialNumber"),
    ("customerId","customerId"),("customerName","customerName"),
    ("customerLocationId","customerLocationId"),("customerLocationName","customerLocationName"),
    ("installDate","installDate"),("purchaseDate","purchaseDate"),
    ("warrantyExpiryDate","warrantyExpiryDate"),("lastServiceDate","lastServiceDate"),
    ("nextServiceDate","nextServiceDate"),("notes","notes")]

@app.post("/api/assets")
async def create_asset(body: dict, session: dict = Depends(require_session)):
    rows = db("""
        INSERT INTO assets ("assetName","assetCode",category,"subCategory",status,"criticality",
          manufacturer,model,"serialNumber","customerId","customerName",
          "customerLocationId","customerLocationName","installDate","purchaseDate",
          "warrantyExpiryDate","lastServiceDate","nextServiceDate",notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, tuple(body.get(k) for k,_ in ASSET_UPDATABLE))
    return {"id": str(rows[0][0])}

@app.patch("/api/assets/{asset_id}")
async def update_asset(asset_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in ASSET_UPDATABLE:
        if key in body:
            fields.append(f'"{col}" = %s'); vals.append(body[key])
    if not fields: raise HTTPException(400, detail="No fields to update")
    vals.append(asset_id)
    db(f"UPDATE assets SET {', '.join(fields)} WHERE id = %s::uuid", vals)
    return {"ok": True}

@app.delete("/api/assets/{asset_id}")
async def delete_asset(asset_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM assets WHERE id = %s::uuid", (asset_id,))
    return {"ok": True}

# ── Lead CRUD (api13) ─────────────────────────────────────────────────────
@app.get("/api/leads")
async def list_leads(session: dict = Depends(require_session)):
    rows = db("SELECT id, first_name, last_name, email, company, contact_phone_number, notes, created_at FROM leads ORDER BY created_at DESC")
    return [{"id": str(r[0]), "firstName": r[1], "lastName": r[2], "email": r[3],
             "company": r[4], "contactPhoneNumber": r[5], "notes": r[6],
             "createdAt": r[7].isoformat() if r[7] else None} for r in rows]

@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: str, session: dict = Depends(require_session)):
    rows = db("SELECT id, first_name, last_name, email, company, contact_phone_number, notes, created_at FROM leads WHERE id = %s::uuid", (lead_id,))
    if not rows: raise HTTPException(404, detail="Lead not found")
    r = rows[0]
    return {"id": str(r[0]), "firstName": r[1], "lastName": r[2], "email": r[3],
            "company": r[4], "contactPhoneNumber": r[5], "notes": r[6],
            "createdAt": r[7].isoformat() if r[7] else None}

@app.post("/api/leads")
async def create_lead(body: dict, session: dict = Depends(require_session)):
    rows = db("""
        INSERT INTO leads (first_name, last_name, email, company, contact_phone_number, notes)
        VALUES (%s,%s,%s,%s,%s,%s) RETURNING id
    """, (body.get("firstName"), body.get("lastName"), body.get("email"),
          body.get("company"), body.get("contactPhoneNumber"), body.get("notes")))
    return {"id": str(rows[0][0])}

@app.patch("/api/leads/{lead_id}")
async def update_lead(lead_id: str, body: dict, session: dict = Depends(require_session)):
    fields, vals = [], []
    for key, col in [("firstName","first_name"),("lastName","last_name"),("email","email"),
                     ("company","company"),("contactPhoneNumber","contact_phone_number"),("notes","notes")]:
        if key in body:
            fields.append(f"{col} = %s"); vals.append(body[key])
    if not fields: raise HTTPException(400, detail="No fields to update")
    vals.append(lead_id)
    db(f"UPDATE leads SET {', '.join(fields)} WHERE id = %s::uuid", vals)
    return {"ok": True}

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, session: dict = Depends(require_session)):
    db("DELETE FROM leads WHERE id = %s::uuid", (lead_id,))
    return {"ok": True}

# ── Activity / Analytics (api14) ──────────────────────────────────────────
@app.get("/api/activity/summary")
async def activity_summary(session: dict = Depends(require_session)):
    where = ""
    if session.get("mode") == "portal":
        cid = session.get("customer_id")
        if cid: where = f'WHERE "customerId" = \'{cid}\'::uuid'
    rows = db(f"""
        SELECT "customerId", "customerName",
          count(*) FILTER (WHERE status NOT IN ('completed','declined','cancelled')) as open,
          count(*) FILTER (WHERE status IN ('completed','declined','cancelled')) as closed,
          count(*) as total
        FROM requests {where} GROUP BY "customerId", "customerName" ORDER BY "customerName" ASC
    """)
    return [{"customerId": str(r[0]) if r[0] else None, "customerName": r[1],
             "open": r[2], "closed": r[3], "total": r[4]} for r in rows]

@app.get("/api/activity/location/{customer_id}")
async def activity_by_location(customer_id: str, session: dict = Depends(require_session)):
    rows = db("""
        SELECT r."customerLocationProfileId", cl."companyName",
          count(*) FILTER (WHERE r.status NOT IN ('completed','declined','cancelled')) as open,
          count(*) FILTER (WHERE r.status IN ('completed','declined','cancelled')) as closed,
          count(*) as total
        FROM requests r
        LEFT JOIN "customerLocations" cl ON cl.id = r."customerLocationProfileId"
        WHERE r."customerId" = %s::uuid
        GROUP BY r."customerLocationProfileId", cl."companyName"
        ORDER BY cl."companyName" ASC
    """, (customer_id,))
    return [{"locationId": str(r[0]) if r[0] else None, "locationName": r[1],
             "open": r[2], "closed": r[3], "total": r[4]} for r in rows]

# ── User management (api15) ───────────────────────────────────────────────
@app.get("/api/users")
async def list_users(session: dict = Depends(require_session)):
    rows = db("""
        SELECT u.id, u.email, up.role, up.customer_ref
        FROM auth.users u
        LEFT JOIN public.user_profiles up ON up.user_id = u.id
        ORDER BY u.email ASC
    """)
    return [{"id": str(r[0]), "email": r[1], "role": r[2], "customerRef": r[3]} for r in rows]

@app.get("/api/users/{user_id}")
async def get_user(user_id: str, session: dict = Depends(require_session)):
    rows = db("""
        SELECT u.id, u.email, up.role, up.customer_ref
        FROM auth.users u LEFT JOIN public.user_profiles up ON up.user_id = u.id
        WHERE u.id = %s::uuid
    """, (user_id,))
    if not rows: raise HTTPException(404, detail="User not found")
    r = rows[0]
    return {"id": str(r[0]), "email": r[1], "role": r[2], "customerRef": r[3]}

@app.get("/api/customers/{customer_id}/users")
async def list_customer_users(customer_id: str, session: dict = Depends(require_session)):
    rows = db("""
        SELECT u.id, u.email, up.role
        FROM auth.users u
        JOIN public.user_profiles up ON up.user_id = u.id
        JOIN public.profiles p ON p.user_id = u.id
        WHERE p.customer_id = %s::uuid
        ORDER BY u.email ASC
    """, (customer_id,))
    return [{"id": str(r[0]), "email": r[1], "role": r[2]} for r in rows]

# ── OTP generation/verification (api16) ───────────────────────────────────
import random, string

@app.post("/api/otp/generate")
async def generate_otp(body: dict, session: dict = Depends(require_session)):
    profile_id = body.get("profileId") or body.get("profile_id")
    if not profile_id:
        raise HTTPException(400, detail="profile_id is required")
    code = ''.join(random.choices(string.digits, k=6))
    expires = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
    db("""
        INSERT INTO one_time_passcodes (code, profile_id, expires_at)
        VALUES (%s, %s::uuid, %s)
        ON CONFLICT (profile_id) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, consumed_at = NULL
    """, (code, profile_id, expires))
    return {"code": code, "expiresAt": expires}

@app.post("/api/otp/verify")
async def verify_otp(body: dict, session: dict = Depends(require_session)):
    code = body.get("code", "").strip()
    profile_id = body.get("profileId") or body.get("profile_id")
    if not code or not profile_id:
        raise HTTPException(400, detail="code and profile_id are required")
    rows = db("""
        SELECT code, expires_at, consumed_at FROM one_time_passcodes
        WHERE profile_id = %s::uuid AND consumed_at IS NULL
    """, (profile_id,))
    if not rows: raise HTTPException(400, detail="No active OTP found")
    stored, expires, consumed = rows[0]
    if stored != code:
        raise HTTPException(400, detail="Invalid code")
    if datetime.utcnow() > expires.replace(tzinfo=None) if expires else True:
        raise HTTPException(400, detail="Code expired")
    db("UPDATE one_time_passcodes SET consumed_at = %s WHERE profile_id = %s::uuid",
       (datetime.utcnow().isoformat(), profile_id))
    return {"ok": True, "verified": True}

# ── Health check (inf05) ──────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "mode": MODE, "version": "2.1.0"}

@app.get("/api/health/db")
async def health_db():
    try:
        db("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(503, detail=f"Database: {e}")

# ── Structured logging (inf04) — uvicorn configured with JSON format ──────
# Start uvicorn with: --log-config server/logging.json or set env LOG_FORMAT=json
# This enables structured JSON logging via uvicorn's built-in formatter.

# ── CORS + logging (api17) — handled by middleware and CORSMiddleware above ──

# ── Push notification VAPID key ──────────────────────────────────────────
@app.get("/api/push/vapid-key")
async def vapid_key():
    from notifications import get_vapid_public_key
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(503, detail="VAPID not initialized")
    return {"publicKey": key}

# ── Notification API endpoints (ns03) ──────────────────────────────────────
@app.get("/api/notifications")
async def list_notifications(session: dict = Depends(require_session)):
    uid = session.get("uid")
    if not uid: raise HTTPException(400, detail="No user in session")
    return get_inapp(uid)

@app.post("/api/notifications/{note_id}/read")
async def read_notification(note_id: str, session: dict = Depends(require_session)):
    mark_read(note_id)
    return {"ok": True}

@app.post("/api/notifications/device-token")
async def register_device(body: dict, session: dict = Depends(require_session)):
    token = body.get("pushToken") or body.get("push_token")
    platform = body.get("platform", "web")
    if not token: raise HTTPException(400, detail="pushToken is required")
    uid = session.get("uid")
    profile_id = body.get("profileId") or body.get("profile_id") or uid
    app_version = body.get("appVersion") or body.get("app_version")
    db("""
        INSERT INTO device_tokens (user_id, profile_id, push_token, platform, app_version, is_active, last_seen_at)
        VALUES (%s::uuid, %s::uuid, %s, %s, %s, true, now())
        ON CONFLICT (push_token) DO UPDATE SET last_seen_at = now(), is_active = true, platform = EXCLUDED.platform
    """, (uid, profile_id, token, platform, app_version))
    return {"ok": True}

# ── Pushover per-user key endpoints ────────────────────────────────────
@app.get("/api/pushover/key")
async def get_pushover_key_status(session: dict = Depends(require_session)):
    uid = session.get("uid")
    if not uid:
        raise HTTPException(400, detail="No user in session")
    from notifications import get_pushover_key
    key = get_pushover_key(uid)
    return {"hasKey": bool(key)}

@app.post("/api/pushover/save-key")
async def save_pushover_key(body: dict, session: dict = Depends(require_session)):
    uid = session.get("uid")
    if not uid:
        raise HTTPException(400, detail="No user in session")
    push_key = (body.get("pushover_user_key") or "").strip()
    if not push_key:
        raise HTTPException(400, detail="pushover_user_key is required")
    db("UPDATE public.user_profiles SET pushover_user_key = %s WHERE user_id = %s::uuid",
       (push_key, uid))
    return {"ok": True}

STATIC_DIR = Path(__file__).resolve().parent / "static"

@app.get("/invite/{token}")
async def invite_page(token: str):
    idx = STATIC_DIR / "invite.html"
    if idx.exists():
        return FileResponse(str(idx), media_type="text/html")
    raise HTTPException(404)

# ── static file serving ───────────────────────────────────────────────────
def _serve_file(filepath: str, build_dir: Path) -> Response:
    if not filepath:
        filepath = "index.html"
    full = build_dir / filepath
    if full.exists() and full.is_file():
        return FileResponse(str(full), media_type=guess_ct(str(full)))
    idx = build_dir / "index.html"
    if idx.exists():
        return FileResponse(str(idx), media_type="text/html")
    raise HTTPException(404)

@app.get("/assets/{filepath:path}")
async def assets(filepath: str):
    return _serve_file(f"assets/{filepath}", BUILD_DIR)

@app.head("/assets/{filepath:path}")
async def assets_head(filepath: str):
    return await assets(filepath)

@app.get("/portal/{filepath:path}")
async def portal_static(filepath: str):
    return _serve_file(filepath, PORTAL_BUILD)

@app.head("/portal/{filepath:path}")
async def portal_static_head(filepath: str):
    return await portal_static(filepath)

@app.get("/{filepath:path}")
async def admin_or_portal_root(filepath: str):
    if MODE == "portal":
        return _serve_file(filepath, PORTAL_BUILD)
    if MODE == "mobile":
        return _serve_file(filepath, MOBILE_BUILD)
    return _serve_file(filepath, ADMIN_BUILD)

@app.head("/{filepath:path}")
async def admin_or_portal_root_head(filepath: str):
    return await admin_or_portal_root(filepath)
