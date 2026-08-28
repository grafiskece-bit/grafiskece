"""ClientRevive AI - iteration 2 feature tests (WhatsApp/Fonnte, reminders, score override,
follow-up auto-schedule, new settings fields)."""
import os
import re
import uuid
from datetime import date, timedelta
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


@pytest.fixture(scope="module")
def demo_client():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("credentials not found in /app/memory/test_credentials.md")
    r = requests.post(f"{API}/auth/login", json={"email": email.group(1), "password": pwd.group(1)}, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"demo login failed {r.status_code}: {r.text[:300]}")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def new_user():
    """Fresh registered user (auto-seeded with 15 clients incl. ones due today)."""
    email = f"TEST_{uuid.uuid4().hex[:8]}@clientrevivetest.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "testpass1", "name": "TEST Iter2"}, timeout=180)
    if r.status_code != 200:
        pytest.fail(f"register failed {r.status_code}: {r.text[:300]}")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {r.json()['token']}"})
    return s


# ---------- WhatsApp / Fonnte ----------
class TestWhatsAppSend:
    def test_fallback_when_no_token(self, new_user):
        # ensure token empty
        st = new_user.get(f"{API}/settings", timeout=60).json()
        assert st.get("fonnte_token", "") == ""
        cid = new_user.post(f"{API}/clients", json={"name": "TEST WA Klien", "whatsapp": "+62 811 2223 334"}, timeout=60).json()["id"]
        try:
            r = new_user.post(f"{API}/whatsapp/send", json={"client_id": cid, "message": "Halo tes"}, timeout=60)
            assert r.status_code == 200, r.text[:300]
            d = r.json()
            assert d["sent"] is False
            assert d["fallback"] == "wa.me"
            assert d["wa_link"].startswith("https://wa.me/628112223334?text=")
        finally:
            new_user.delete(f"{API}/clients/{cid}", timeout=30)

    def test_400_when_client_whatsapp_empty(self, new_user):
        cid = new_user.post(f"{API}/clients", json={"name": "TEST WA Kosong"}, timeout=60).json()["id"]
        try:
            r = new_user.post(f"{API}/whatsapp/send", json={"client_id": cid, "message": "hi"}, timeout=60)
            assert r.status_code == 400, f"got {r.status_code}: {r.text[:200]}"
            assert "WhatsApp" in r.json().get("detail", "")
        finally:
            new_user.delete(f"{API}/clients/{cid}", timeout=30)

    def test_404_unknown_client(self, new_user):
        r = new_user.post(f"{API}/whatsapp/send", json={"client_id": str(uuid.uuid4()), "message": "hi"}, timeout=60)
        assert r.status_code == 404

    def test_requires_auth(self):
        r = requests.post(f"{API}/whatsapp/send", json={"client_id": "x", "message": "y"}, timeout=30)
        assert r.status_code in (401, 403)


# ---------- Reminders ----------
class TestRemindersToday:
    def test_reminders_today_structure_seeded(self, new_user):
        r = new_user.get(f"{API}/reminders/today", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["date"] == date.today().isoformat()
        assert isinstance(d["clients"], list)
        assert d["count"] == len(d["clients"])
        assert d["count"] > 0, "fresh seeded user should have clients due today"
        scores = [c["opportunity_score"] for c in d["clients"]]
        assert scores == sorted(scores, reverse=True), "clients not sorted by score desc"
        for c in d["clients"]:
            assert "_id" not in c
            assert c["next_follow_up_date"][:10] <= d["date"]
            assert "name" in c and "total_spending" in c and "days_since_last_order" in c

    def test_future_date_not_included(self, new_user):
        future = (date.today() + timedelta(days=15)).isoformat()
        cid = new_user.post(f"{API}/clients", json={"name": "TEST Future FU"}, timeout=60).json()["id"]
        new_user.patch(f"{API}/clients/{cid}", json={"next_follow_up_date": future}, timeout=60)
        try:
            ids = [c["id"] for c in new_user.get(f"{API}/reminders/today", timeout=60).json()["clients"]]
            assert cid not in ids
            # today's date should be included
            new_user.patch(f"{API}/clients/{cid}", json={"next_follow_up_date": date.today().isoformat()}, timeout=60)
            ids2 = [c["id"] for c in new_user.get(f"{API}/reminders/today", timeout=60).json()["clients"]]
            assert cid in ids2, "client due today missing from reminders"
        finally:
            new_user.delete(f"{API}/clients/{cid}", timeout=30)

    def test_requires_auth(self):
        r = requests.get(f"{API}/reminders/today", timeout=30)
        assert r.status_code in (401, 403)


# ---------- Opportunity score override ----------
class TestScoreOverride:
    def test_override_applies_everywhere(self, demo_client):
        cid = demo_client.post(f"{API}/clients", json={"name": "TEST Override Klien", "whatsapp": "628111000111"}, timeout=60).json()["id"]
        try:
            base = demo_client.get(f"{API}/clients/{cid}", timeout=60).json()
            assert base["opportunity_score"] == 35
            r = demo_client.patch(f"{API}/clients/{cid}", json={"opportunity_score_override": 95}, timeout=60)
            assert r.status_code == 200, r.text[:200]
            single = demo_client.get(f"{API}/clients/{cid}", timeout=60).json()
            assert single["opportunity_score"] == 95
            assert single["opportunity_category"] == "Hot"
            listed = [c for c in demo_client.get(f"{API}/clients", timeout=90).json() if c["id"] == cid][0]
            assert listed["opportunity_score"] == 95
        finally:
            demo_client.delete(f"{API}/clients/{cid}", timeout=30)

    def test_override_bounds_rejected_or_ignored(self, demo_client):
        cid = demo_client.post(f"{API}/clients", json={"name": "TEST Override Bounds"}, timeout=60).json()["id"]
        try:
            r = demo_client.patch(f"{API}/clients/{cid}", json={"opportunity_score_override": 150}, timeout=60)
            # either validation error, or value ignored by compute (falls back to computed)
            assert r.status_code in (200, 422)
            score = demo_client.get(f"{API}/clients/{cid}", timeout=60).json()["opportunity_score"]
            assert 0 <= score <= 100, f"out-of-range score leaked: {score}"
        finally:
            demo_client.delete(f"{API}/clients/{cid}", timeout=30)

    def test_override_zero(self, demo_client):
        cid = demo_client.post(f"{API}/clients", json={"name": "TEST Override Zero"}, timeout=60).json()["id"]
        try:
            demo_client.patch(f"{API}/clients/{cid}", json={"opportunity_score_override": 0}, timeout=60)
            score = demo_client.get(f"{API}/clients/{cid}", timeout=60).json()["opportunity_score"]
            assert score == 0, f"override 0 not honored, got {score}"
        finally:
            demo_client.delete(f"{API}/clients/{cid}", timeout=30)

    def test_edit_fields_persist(self, demo_client):
        cid = demo_client.post(f"{API}/clients", json={"name": "TEST Edit Fields"}, timeout=60).json()["id"]
        try:
            payload = {"name": "TEST Edit Fields Updated", "business_name": "TEST CV", "whatsapp": "628222333444",
                       "email": "test_edit@example.com", "instagram": "@testedit", "business_category": "Fashion",
                       "location": "Bandung", "status": "VIP", "priority": "Tinggi", "tags": ["premium", "repeat"],
                       "preferred_channel": "Instagram", "notes": "TEST notes"}
            r = demo_client.patch(f"{API}/clients/{cid}", json=payload, timeout=60)
            assert r.status_code == 200
            g = demo_client.get(f"{API}/clients/{cid}", timeout=60).json()
            for k, v in payload.items():
                assert g[k] == v, f"{k} not persisted: {g.get(k)!r} != {v!r}"
        finally:
            demo_client.delete(f"{API}/clients/{cid}", timeout=30)


# ---------- Follow-up auto-schedule ----------
class TestFollowUpAutoSchedule:
    def test_auto_schedule_uses_settings_intervals(self, new_user):
        # set custom intervals
        st = new_user.get(f"{API}/settings", timeout=60).json()
        st["follow_up_intervals"] = [3, 10, 21]
        assert new_user.put(f"{API}/settings", json=st, timeout=60).status_code == 200
        cid = new_user.post(f"{API}/clients", json={"name": "TEST AutoSchedule"}, timeout=60).json()["id"]
        try:
            r1 = new_user.post(f"{API}/followups", json={"client_id": cid, "message": "TEST fu 1"}, timeout=60)
            assert r1.status_code == 200, r1.text[:300]
            exp1 = (date.today() + timedelta(days=3)).isoformat()
            assert r1.json()["next_follow_up_date"] == exp1
            c1 = new_user.get(f"{API}/clients/{cid}", timeout=60).json()
            assert c1["next_follow_up_date"] == exp1
            assert c1["follow_up_status"] == "Sudah Dihubungi"
            assert c1["last_follow_up_date"]

            r2 = new_user.post(f"{API}/followups", json={"client_id": cid, "message": "TEST fu 2"}, timeout=60)
            exp2 = (date.today() + timedelta(days=10)).isoformat()
            assert r2.json()["next_follow_up_date"] == exp2

            r3 = new_user.post(f"{API}/followups", json={"client_id": cid, "message": "TEST fu 3"}, timeout=60)
            exp3 = (date.today() + timedelta(days=21)).isoformat()
            assert r3.json()["next_follow_up_date"] == exp3
            # 4th should clamp to last interval
            r4 = new_user.post(f"{API}/followups", json={"client_id": cid, "message": "TEST fu 4"}, timeout=60)
            assert r4.json()["next_follow_up_date"] == exp3
        finally:
            new_user.delete(f"{API}/clients/{cid}", timeout=30)

    def test_explicit_next_date_respected(self, new_user):
        cid = new_user.post(f"{API}/clients", json={"name": "TEST Explicit FU"}, timeout=60).json()["id"]
        try:
            r = new_user.post(f"{API}/followups", json={"client_id": cid, "message": "TEST", "next_follow_up_date": "2027-03-05"}, timeout=60)
            assert r.status_code == 200
            assert r.json()["next_follow_up_date"] == "2027-03-05"
            assert new_user.get(f"{API}/clients/{cid}", timeout=60).json()["next_follow_up_date"] == "2027-03-05"
        finally:
            new_user.delete(f"{API}/clients/{cid}", timeout=30)


# ---------- Settings new fields ----------
class TestSettingsFonnte:
    def test_defaults(self, new_user):
        s = new_user.get(f"{API}/settings", timeout=60).json()
        assert "fonnte_token" in s and "reminder_time" in s
        assert s["fonnte_token"] == ""
        assert s["reminder_time"] == "08:00"

    def test_persist_fonnte_and_reminder_time(self, new_user):
        s = new_user.get(f"{API}/settings", timeout=60).json()
        s["fonnte_token"] = "TESTfonntetoken123"
        s["reminder_time"] = "19:30"
        assert new_user.put(f"{API}/settings", json=s, timeout=60).status_code == 200
        s2 = new_user.get(f"{API}/settings", timeout=60).json()
        assert s2["fonnte_token"] == "TESTfonntetoken123"
        assert s2["reminder_time"] == "19:30"
        # reset for other tests in this module
        s2["fonnte_token"] = ""
        new_user.put(f"{API}/settings", json=s2, timeout=60)
        assert new_user.get(f"{API}/settings", timeout=60).json()["fonnte_token"] == ""
