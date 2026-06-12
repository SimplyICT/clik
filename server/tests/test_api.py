"""
Basic integration tests for the SimplyClik API.
Run: python -m pytest server/tests/ -v
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["SUPABASE_URL"] = "https://imkkhzxeggjxepbisoyy.supabase.co"
os.environ["ANON_KEY"] = "sb_publishable_TNGKtfXYmjreJbzsTFZmQg_7DL977FT"
os.environ["DB_HOST"] = "db.imkkhzxeggjxepbisoyy.supabase.co"
os.environ["DB_PORT"] = "5432"
os.environ["DB_NAME"] = "postgres"
os.environ["DB_USER"] = "postgres"
os.environ["DB_PASSWORD"] = "LQ9aty9wUewIMYWF"

from fastapi.testclient import TestClient
from fastapi_app import app

client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_admin():
    resp = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["is_admin"] is True


def test_login_invalid():
    resp = client.post("/api/login", json={"email": "wrong@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_supabase_proxy_requires_auth():
    resp = client.get("/api/supabase/customers?select=id&limit=1")
    assert resp.status_code == 401


def test_supabase_proxy_with_auth():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/supabase/customers?select=id&limit=1",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_customers_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/customers", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_customers_summary():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/customers/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_requests_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/requests", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_contractors_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/contractors", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_locations_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/locations", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_assets_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/assets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_leads_list():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/leads", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_activity_summary():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/activity/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_notifications():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_state_machine_invalid():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.post("/api/requests/00000000-0000-0000-0000-000000000000/transition",
                       json={"status": "completed"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_disallowed_table():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.get("/api/supabase/secret_table",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_otp_generate():
    login = client.post("/api/login", json={"email": "admin@simplyclik.local", "password": "Temp123!"})
    token = login.json()["token"]
    resp = client.post("/api/otp/generate",
                       json={"profileId": "00000000-0000-0000-0000-000000000001"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "code" in data
    assert len(data["code"]) == 6
