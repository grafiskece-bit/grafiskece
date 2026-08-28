"""ClientRevive AI - backend API regression tests."""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("credentials not found")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session, test_credentials):
    r = session.post(f"{API}/auth/login", json=test_credentials, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    assert isinstance(tok, str) and tok
    return tok


@pytest.fixture(scope="session")
def client(demo_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {demo_token}"})
    return s


@pytest.fixture(scope="session")
def fresh_user(session):
    """Register a brand new user (tests auto-seed of 15 clients)."""
    email = f"TEST_{uuid.uuid4().hex[:8]}@clientrevivetest.com"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST User"}, timeout=120)
    if r.status_code != 200:
        pytest.fail(f"register failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"})
    return {"email": email, "password": "test1234", "data": data, "client": s}


# ---------- health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- auth module ----------
class TestAuth:
    def test_register_returns_token_and_user(self, fresh_user):
        d = fresh_user["data"]
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == fresh_user["email"]
        assert d["user"]["name"] == "TEST User"
        assert isinstance(d["user"]["id"], str)

    def test_register_seeds_15_clients_with_orders(self, fresh_user):
        r = fresh_user["client"].get(f"{API}/clients", timeout=60)
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) == 15, f"expected 15 seeded clients, got {len(clients)}"
        assert sum(c["orders_count"] for c in clients) > 0

    def test_register_duplicate_email(self, session, fresh_user):
        r = session.post(f"{API}/auth/register", json={"email": fresh_user["email"], "password": "x", "name": "y"}, timeout=60)
        assert r.status_code == 400

    def test_login_with_created_credentials(self, session, fresh_user):
        r = session.post(f"{API}/auth/login", json={"email": fresh_user["email"], "password": "test1234"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == fresh_user["email"]

    def test_login_invalid_password(self, session, fresh_user):
        r = session.post(f"{API}/auth/login", json={"email": fresh_user["email"], "password": "wrong"}, timeout=60)
        assert r.status_code == 401

    def test_demo_login(self, demo_token):
        assert demo_token

    def test_me(self, client, test_credentials):
        r = client.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == test_credentials["email"]

    @pytest.mark.parametrize("path", ["/clients", "/orders", "/followups", "/settings", "/dashboard/summary", "/ai/recommendations"])
    def test_protected_endpoints_require_auth(self, session, path):
        r = requests.get(f"{API}{path}", timeout=30)
        assert r.status_code in (401, 403), f"{path} returned {r.status_code}"

    def test_invalid_token_rejected(self, session):
        r = requests.get(f"{API}/clients", headers={"Authorization": "Bearer bogus.token.xyz"}, timeout=30)
        assert r.status_code == 401


# ---------- dashboard ----------
class TestDashboard:
    def test_summary_metrics(self, fresh_user):
        r = fresh_user["client"].get(f"{API}/dashboard/summary", timeout=60)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_clients", "follow_up_today", "never_contacted", "contacted_this_week",
                  "high_value_clients", "dormant_30", "dormant_60", "dormant_90",
                  "repeat_this_month", "estimated_potential_revenue", "top_clients_today"]:
            assert k in d, f"missing {k}"
        assert d["total_clients"] == 15
        assert d["dormant_30"] >= d["dormant_60"] >= d["dormant_90"]
        assert d["estimated_potential_revenue"] > 0
        assert isinstance(d["top_clients_today"], list) and len(d["top_clients_today"]) > 0
        assert len(d["top_clients_today"]) <= 8
        top = d["top_clients_today"][0]
        assert "opportunity_score" in top and "name" in top
        assert "_id" not in top


# ---------- clients CRUD ----------
class TestClients:
    created = []

    def test_list_enriched(self, client):
        r = client.get(f"{API}/clients", timeout=60)
        assert r.status_code == 200
        cs = r.json()
        assert len(cs) >= 1
        for c in cs:
            assert "_id" not in c
            assert 0 <= c["opportunity_score"] <= 100
            assert "days_since_last_order" in c
            assert "total_spending" in c
            assert "last_service" in c
            assert "opportunity_category" in c

    def test_create_and_get_single(self, client):
        payload = {"name": "TEST Klien Baru", "business_name": "TEST Bisnis", "whatsapp": "628111222333",
                   "business_category": "F&B", "location": "Jakarta", "status": "Potensial"}
        r = client.post(f"{API}/clients", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        c = r.json()
        assert "_id" not in c
        cid = c["id"]
        TestClients.created.append(cid)
        assert c["name"] == payload["name"]
        assert c["whatsapp"] == payload["whatsapp"]

        g = client.get(f"{API}/clients/{cid}", timeout=60)
        assert g.status_code == 200
        d = g.json()
        assert d["name"] == payload["name"]
        assert isinstance(d["orders"], list) and d["orders"] == []
        assert isinstance(d["followups"], list)
        assert isinstance(d["all_services"], list)
        assert d["opportunity_score"] == 35

    def test_get_nonexistent_client_404(self, client):
        r = client.get(f"{API}/clients/{uuid.uuid4()}", timeout=30)
        assert r.status_code == 404

    def test_patch_client_persists(self, client):
        cid = TestClients.created[0]
        r = client.patch(f"{API}/clients/{cid}", json={"notes": "TEST catatan update", "status": "VIP"}, timeout=60)
        assert r.status_code == 200
        g = client.get(f"{API}/clients/{cid}", timeout=60).json()
        assert g["notes"] == "TEST catatan update"
        assert g["status"] == "VIP"
        assert g["name"] == "TEST Klien Baru"

    def test_patch_nonexistent_404(self, client):
        r = client.patch(f"{API}/clients/{uuid.uuid4()}", json={"notes": "x"}, timeout=30)
        assert r.status_code == 404

    def test_orders_crud_on_client(self, client):
        cid = TestClients.created[0]
        payload = {"order_date": "2025-06-01", "service": "Logo Design", "project_name": "TEST Project",
                   "order_value": 1500000, "notes": "TEST", "delivery_status": "Selesai"}
        r = client.post(f"{API}/clients/{cid}/orders", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        o = r.json()
        assert "_id" not in o
        oid = o["id"]
        assert o["order_value"] == 1500000

        g = client.get(f"{API}/clients/{cid}", timeout=60).json()
        assert g["orders_count"] == 1
        assert g["total_spending"] == 1500000
        assert g["last_service"] == "Logo Design"
        assert "Logo Design" in g["all_services"]

        # appears in global orders with enrichment
        allo = client.get(f"{API}/orders", timeout=60).json()
        match = [x for x in allo if x["id"] == oid]
        assert match, "order not present in /api/orders"
        assert match[0]["client_name"] == "TEST Klien Baru"
        assert match[0]["business_name"] == "TEST Bisnis"

        d = client.delete(f"{API}/orders/{oid}", timeout=60)
        assert d.status_code == 200
        g2 = client.get(f"{API}/clients/{cid}", timeout=60).json()
        assert g2["orders_count"] == 0

    def test_order_on_nonexistent_client_404(self, client):
        r = client.post(f"{API}/clients/{uuid.uuid4()}/orders", json={"order_date": "2025-01-01", "service": "X"}, timeout=30)
        assert r.status_code == 404

    def test_delete_client_removes_it(self, client):
        payload = {"name": "TEST Delete Me"}
        cid = client.post(f"{API}/clients", json=payload, timeout=60).json()["id"]
        r = client.delete(f"{API}/clients/{cid}", timeout=60)
        assert r.status_code == 200
        assert client.get(f"{API}/clients/{cid}", timeout=30).status_code == 404

    @classmethod
    def teardown_class(cls):
        pass


# ---------- follow-ups ----------
class TestFollowUps:
    def test_create_followup_updates_client(self, client):
        cid = client.post(f"{API}/clients", json={"name": "TEST FU Klien"}, timeout=60).json()["id"]
        r = client.post(f"{API}/followups", json={"client_id": cid, "message": "TEST pesan follow up",
                                                 "channel": "WhatsApp", "status": "Terkirim",
                                                 "next_follow_up_date": "2026-12-01"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        f = r.json()
        assert "_id" not in f
        assert f["message"] == "TEST pesan follow up"

        c = client.get(f"{API}/clients/{cid}", timeout=60).json()
        assert c["last_follow_up_date"], "last_follow_up_date not updated"
        assert c["next_follow_up_date"] == "2026-12-01"
        assert len(c["followups"]) == 1

        lst = client.get(f"{API}/followups", timeout=60).json()
        mine = [x for x in lst if x["id"] == f["id"]]
        assert mine and mine[0]["client_name"] == "TEST FU Klien"
        client.delete(f"{API}/clients/{cid}", timeout=30)


# ---------- settings ----------
class TestSettings:
    def test_get_defaults(self, fresh_user):
        r = fresh_user["client"].get(f"{API}/settings", timeout=60)
        assert r.status_code == 200
        s = r.json()
        assert "_id" not in s
        assert s["business_name"] == "TEST User"
        assert isinstance(s["services"], list) and len(s["services"]) > 0
        assert s["ai_tone"] == "Ramah"
        assert s["currency"] == "Rp"
        assert s["follow_up_intervals"] == [7, 14, 30, 60, 90]

    def test_update_persists(self, fresh_user):
        c = fresh_user["client"]
        payload = {"business_name": "TEST Studio", "services": ["Logo Design", "Branding"],
                   "pricing": {"Logo Design": 900000}, "follow_up_intervals": [7, 30],
                   "whatsapp_number": "628999888777", "ai_tone": "Kasual", "currency": "Rp",
                   "business_description": "TEST desc"}
        r = c.put(f"{API}/settings", json=payload, timeout=60)
        assert r.status_code == 200
        s = c.get(f"{API}/settings", timeout=60).json()
        assert s["business_name"] == "TEST Studio"
        assert s["ai_tone"] == "Kasual"
        assert s["whatsapp_number"] == "628999888777"
        assert s["pricing"]["Logo Design"] == 900000


# ---------- AI ----------
class TestAI:
    def test_generate_message(self, client):
        cid = client.get(f"{API}/clients", timeout=60).json()[0]["id"]
        r = client.post(f"{API}/ai/generate-message", json={"client_id": cid, "tone": "Ramah"}, timeout=180)
        assert r.status_code == 200, r.text[:400]
        msg = r.json()["message"]
        assert isinstance(msg, str) and len(msg) > 30
        TestAI.long_msg = msg
        TestAI.cid = cid

    def test_generate_message_shorter(self, client):
        cid = getattr(TestAI, "cid", None) or client.get(f"{API}/clients", timeout=60).json()[0]["id"]
        r = client.post(f"{API}/ai/generate-message", json={"client_id": cid, "tone": "Ramah", "modifier": "shorter"}, timeout=180)
        assert r.status_code == 200, r.text[:400]
        short = r.json()["message"]
        assert len(short) > 10
        base = getattr(TestAI, "long_msg", None)
        if base:
            assert len(short) < len(base) * 1.2, f"shorter modifier produced longer text ({len(short)} vs {len(base)})"

    def test_generate_message_invalid_client(self, client):
        r = client.post(f"{API}/ai/generate-message", json={"client_id": str(uuid.uuid4())}, timeout=60)
        assert r.status_code == 404

    def test_analyze(self, client):
        cid = client.get(f"{API}/clients", timeout=60).json()[0]["id"]
        r = client.get(f"{API}/ai/analyze/{cid}", timeout=180)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        for k in ["score", "category", "analysis", "recommended_service", "recommended_offer", "recommended_timing"]:
            assert k in d and d[k] not in (None, ""), f"missing/empty {k}"
        assert 0 <= d["score"] <= 100

    def test_analyze_invalid_client(self, client):
        r = client.get(f"{API}/ai/analyze/{uuid.uuid4()}", timeout=60)
        assert r.status_code == 404

    def test_recommendations(self, client):
        r = client.get(f"{API}/ai/recommendations", timeout=120)
        assert r.status_code == 200
        d = r.json()
        top = d["top_clients"]
        assert 0 < len(top) <= 10
        scores = [t["opportunity_score"] for t in top]
        assert scores == sorted(scores, reverse=True)
        for t in top:
            assert "_id" not in t
            for k in ["reason", "recommended_service", "recommended_offer", "opportunity_score"]:
                assert t.get(k) not in (None, ""), f"missing {k}"
        re_ = d["revenue_estimate"]
        assert re_["daily_potential"] > 0
        assert re_["weekly_potential"] == re_["daily_potential"] * 5
        assert re_["clients_count"] == len(top)


# ---------- isolation + seed reset ----------
class TestIsolationAndSeed:
    def test_data_isolation(self, client, fresh_user):
        cid = client.post(f"{API}/clients", json={"name": "TEST Isolated Client"}, timeout=60).json()["id"]
        try:
            other = fresh_user["client"]
            assert other.get(f"{API}/clients/{cid}", timeout=30).status_code == 404
            names = [c["name"] for c in other.get(f"{API}/clients", timeout=60).json()]
            assert "TEST Isolated Client" not in names
            assert other.patch(f"{API}/clients/{cid}", json={"notes": "hack"}, timeout=30).status_code == 404
        finally:
            client.delete(f"{API}/clients/{cid}", timeout=30)

    def test_seed_resets_to_15(self, fresh_user):
        c = fresh_user["client"]
        c.post(f"{API}/clients", json={"name": "TEST Extra"}, timeout=60)
        r = c.post(f"{API}/seed-sample-data", json={}, timeout=180)
        assert r.status_code == 200
        clients = c.get(f"{API}/clients", timeout=60).json()
        assert len(clients) == 15
        assert "TEST Extra" not in [x["name"] for x in clients]
