import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pg8000


def _ensure_tables():
    host = os.environ.get("SUPABASE_DB_HOST") or os.environ["DB_HOST"]
    port = os.environ.get("SUPABASE_DB_PORT") or os.environ["DB_PORT"]
    dbname = os.environ.get("SUPABASE_DB_NAME") or os.environ["DB_NAME"]
    user = os.environ.get("SUPABASE_DB_USER") or os.environ["DB_USER"]
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ["DB_PASSWORD"]
    conn = pg8000.connect(
        host=host, port=int(port),
        database=dbname, user=user,
        password=password, ssl_context=True,
    )
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_permissions (
            user_id UUID NOT NULL,
            resource TEXT NOT NULL,
            can_view BOOLEAN NOT NULL DEFAULT false,
            can_edit BOOLEAN NOT NULL DEFAULT false,
            PRIMARY KEY (user_id, resource)
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


_ensure_tables()


from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def login_token():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    return resp.json()["token"]


# ── Permission helpers ────────────────────────────────────────────────────

def test_has_permission_false_for_unknown():
    from asset_service.permissions import has_permission
    assert has_permission("00000000-0000-0000-0000-000000000099", "assets", "view") is False


def test_seed_manager_defaults():
    from asset_service.permissions import seed_manager_defaults, get_user_permissions, MANAGER_DEFAULTS
    import uuid
    test_uid = str(uuid.uuid4())
    seed_manager_defaults(test_uid)
    perms = get_user_permissions(test_uid)
    for r, expected in MANAGER_DEFAULTS.items():
        assert r in perms, f"Missing resource {r}"
        assert perms[r]["can_view"] == expected["can_view"], f"{r} can_view mismatch"
        assert perms[r]["can_edit"] == expected["can_edit"], f"{r} can_edit mismatch"


def test_set_user_permissions():
    from asset_service.permissions import set_user_permissions, get_user_permissions
    import uuid
    test_uid = str(uuid.uuid4())
    perms = {"assets": {"can_view": True, "can_edit": True}, "dashboard": {"can_view": True, "can_edit": False}}
    set_user_permissions(test_uid, perms)
    stored = get_user_permissions(test_uid)
    assert stored["assets"]["can_view"] is True
    assert stored["assets"]["can_edit"] is True
    assert stored["dashboard"]["can_view"] is True
    assert stored["dashboard"]["can_edit"] is False


def test_set_user_permissions_overwrites():
    from asset_service.permissions import set_user_permissions, get_user_permissions
    import uuid
    test_uid = str(uuid.uuid4())
    set_user_permissions(test_uid, {"assets": {"can_view": True, "can_edit": True}})
    set_user_permissions(test_uid, {"assets": {"can_view": False, "can_edit": False}})
    stored = get_user_permissions(test_uid)
    assert stored["assets"]["can_view"] is False
    assert stored["assets"]["can_edit"] is False


# ── API endpoint tests ────────────────────────────────────────────────────

def test_get_my_permissions_admin():
    token = login_token()
    resp = client.get("/api/users/me/permissions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "permissions" in data
    assert data["permissions"]["assets"]["can_view"] is True
    assert data["permissions"]["assets"]["can_edit"] is True


def test_get_my_permissions_requires_auth():
    resp = client.get("/api/users/me/permissions")
    assert resp.status_code == 401


def test_get_user_permissions_admin_only():
    token = login_token()
    resp = client.get("/api/users/permissions/00000000-0000-0000-0000-000000000001",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_get_user_permissions_unauthorized():
    resp = client.post("/api/login", json={"email": "cont1@simplyclik.testinator.com", "password": "Temp123!"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    resp2 = client.get("/api/users/permissions/00000000-0000-0000-0000-000000000001",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 403


def test_put_user_permissions_admin_only():
    token = login_token()
    test_uid = "00000000-0000-0000-0000-000000000001"
    resp = client.put(f"/api/users/permissions/{test_uid}",
                      json={"permissions": {"assets": {"can_view": True, "can_edit": True}}},
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_login_returns_permissions_for_admin():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "permissions" in data
    assert data["permissions"]["assets"]["can_view"] is True
    assert data["permissions"]["assets"]["can_edit"] is True
