from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import uuid
import jwt
import bcrypt
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = os.environ.get('JWT_ALGORITHM', 'HS256')

app = FastAPI(title="ClientRevive AI")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clientrevive")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def days_between(iso_str: Optional[str]) -> Optional[int]:
    if not iso_str:
        return None
    try:
        s = iso_str.replace('Z', '+00:00')
        d = datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - d).days
    except Exception:
        try:
            # try date-only YYYY-MM-DD
            d = datetime.strptime(iso_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - d).days
        except Exception:
            return None


# ================= MODELS =================
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class OrderIn(BaseModel):
    order_date: str
    service: str
    project_name: str = ""
    order_value: float = 0
    notes: str = ""
    delivery_status: str = "Selesai"


class ClientIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    business_name: str = ""
    whatsapp: str = ""
    email: str = ""
    instagram: str = ""
    business_category: str = ""
    location: str = ""
    notes: str = ""
    status: str = "Aktif"  # Aktif, Dormant, Potensial, VIP, Lost, Baru
    follow_up_status: str = "Belum Dihubungi"
    tags: List[str] = []
    priority: str = "Sedang"
    preferred_channel: str = "WhatsApp"


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    business_name: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    business_category: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    follow_up_status: Optional[str] = None
    tags: Optional[List[str]] = None
    priority: Optional[str] = None
    preferred_channel: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    opportunity_score_override: Optional[int] = Field(default=None, ge=0, le=100)


class FollowUpIn(BaseModel):
    client_id: str
    message: str
    channel: str = "WhatsApp"
    status: str = "Terkirim"  # Terkirim, Dibalas, Tidak Dibalas
    response: str = ""
    notes: str = ""
    next_follow_up_date: Optional[str] = None


class SettingsIn(BaseModel):
    business_name: str = ""
    services: List[str] = []
    pricing: dict = {}
    follow_up_intervals: List[int] = [7, 14, 30, 60, 90]
    whatsapp_number: str = ""
    ai_tone: str = "Ramah"
    currency: str = "Rp"
    business_description: str = ""
    fonnte_token: str = ""
    reminder_time: str = "08:00"


class WhatsAppSendIn(BaseModel):
    client_id: str
    message: str
    schedule_at: Optional[str] = None  # ISO datetime for scheduling


class GenerateMessageIn(BaseModel):
    client_id: str
    tone: str = "Ramah"  # Ramah, Kasual, Profesional, Hangat, Sales, Soft Selling
    modifier: Optional[str] = None  # 'shorter', 'more_casual', 'more_professional', 'regenerate'
    previous_message: Optional[str] = None


# ================= AUTH =================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


@api_router.post("/auth/register")
async def register(data: RegisterInput):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    # default settings
    await db.settings.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "business_name": data.name,
        "services": ["Logo Design", "Branding", "Social Media Design", "Instagram Carousel", "Instagram Reels", "Video Editing", "Content Creation", "Wedding Design", "Poster", "Flyer", "Packaging"],
        "pricing": {"Logo Design": 750000, "Branding": 2500000, "Social Media Design": 500000, "Instagram Carousel": 350000, "Video Editing": 600000},
        "follow_up_intervals": [7, 14, 30, 60, 90],
        "whatsapp_number": "",
        "ai_tone": "Ramah",
        "currency": "Rp",
        "business_description": "Freelance graphic designer & content creator",
        "fonnte_token": "",
        "reminder_time": "08:00",
    })
    # seed sample data
    await seed_sample_data(user_id)
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name}}


@api_router.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


# ================= OPPORTUNITY SCORE =================
def compute_opportunity_score(client: dict, orders: List[dict]) -> int:
    override = client.get("opportunity_score_override")
    if isinstance(override, int) and 0 <= override <= 100:
        return override
    if not orders:
        # never ordered: neutral-low score
        return 35
    total_orders = len(orders)
    total_spend = sum(o.get("order_value", 0) for o in orders)
    last_order_date = max(o.get("order_date", "") for o in orders)
    days = days_between(last_order_date) or 0

    # Recency component (max 40)
    if days <= 30:
        recency = 15
    elif days <= 60:
        recency = 25
    elif days <= 120:
        recency = 40
    elif days <= 240:
        recency = 35
    else:
        recency = 25

    # Frequency component (max 30)
    freq = min(30, total_orders * 6)

    # Monetary component (max 30)
    if total_spend >= 5000000:
        mon = 30
    elif total_spend >= 2000000:
        mon = 22
    elif total_spend >= 1000000:
        mon = 15
    else:
        mon = 8

    score = recency + freq + mon
    return max(0, min(100, score))


def opportunity_category(score: int) -> str:
    if score >= 80:
        return "Hot"
    if score >= 60:
        return "Warm"
    if score >= 40:
        return "Potensial"
    return "Prioritas Rendah"


# ================= CLIENTS =================
@api_router.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    clients = await db.clients.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    # enrich with orders
    for c in clients:
        orders = await db.orders.find({"user_id": user["id"], "client_id": c["id"]}, {"_id": 0}).to_list(500)
        c["orders_count"] = len(orders)
        c["total_spending"] = sum(o.get("order_value", 0) for o in orders)
        c["last_order_date"] = max((o.get("order_date", "") for o in orders), default=None)
        c["first_order_date"] = min((o.get("order_date", "") for o in orders), default=None)
        c["last_service"] = None
        if orders:
            last = max(orders, key=lambda o: o.get("order_date", ""))
            c["last_service"] = last.get("service")
        c["days_since_last_order"] = days_between(c["last_order_date"]) if c["last_order_date"] else None
        c["opportunity_score"] = compute_opportunity_score(c, orders)
        c["opportunity_category"] = opportunity_category(c["opportunity_score"])
    return clients


@api_router.post("/clients")
async def create_client(data: ClientIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["created_at"] = now_iso()
    doc["last_follow_up_date"] = None
    doc["next_follow_up_date"] = None
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    orders = await db.orders.find({"user_id": user["id"], "client_id": client_id}, {"_id": 0}).sort("order_date", -1).to_list(500)
    followups = await db.followups.find({"user_id": user["id"], "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    c["orders"] = orders
    c["followups"] = followups
    c["orders_count"] = len(orders)
    c["total_spending"] = sum(o.get("order_value", 0) for o in orders)
    c["last_order_date"] = max((o.get("order_date", "") for o in orders), default=None)
    c["first_order_date"] = min((o.get("order_date", "") for o in orders), default=None)
    c["days_since_last_order"] = days_between(c["last_order_date"]) if c["last_order_date"] else None
    c["all_services"] = list({o.get("service") for o in orders if o.get("service")})
    c["last_service"] = orders[0]["service"] if orders else None
    c["opportunity_score"] = compute_opportunity_score(c, orders)
    c["opportunity_category"] = opportunity_category(c["opportunity_score"])
    return c


@api_router.patch("/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdate, user=Depends(get_current_user)):
    raw = data.model_dump(exclude_unset=True)
    set_fields = {k: v for k, v in raw.items() if v is not None}
    unset_fields = {k: "" for k, v in raw.items() if v is None}
    if not set_fields and not unset_fields:
        return {"ok": True}
    update_op = {}
    if set_fields:
        update_op["$set"] = set_fields
    if unset_fields:
        update_op["$unset"] = unset_fields
    r = await db.clients.update_one({"id": client_id, "user_id": user["id"]}, update_op)
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    return {"ok": True}


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user)):
    await db.clients.delete_one({"id": client_id, "user_id": user["id"]})
    await db.orders.delete_many({"client_id": client_id, "user_id": user["id"]})
    await db.followups.delete_many({"client_id": client_id, "user_id": user["id"]})
    return {"ok": True}


# ================= ORDERS =================
@api_router.get("/clients/{client_id}/orders")
async def list_orders(client_id: str, user=Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"], "client_id": client_id}, {"_id": 0}).sort("order_date", -1).to_list(500)
    return orders


@api_router.post("/clients/{client_id}/orders")
async def create_order(client_id: str, data: OrderIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id, "user_id": user["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["client_id"] = client_id
    doc["created_at"] = now_iso()
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user=Depends(get_current_user)):
    await db.orders.delete_one({"id": order_id, "user_id": user["id"]})
    return {"ok": True}


@api_router.get("/orders")
async def all_orders(user=Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("order_date", -1).to_list(2000)
    # attach client name
    client_ids = list({o["client_id"] for o in orders})
    clients = await db.clients.find({"user_id": user["id"], "id": {"$in": client_ids}}, {"_id": 0, "id": 1, "name": 1, "business_name": 1}).to_list(2000)
    cmap = {c["id"]: c for c in clients}
    for o in orders:
        c = cmap.get(o["client_id"], {})
        o["client_name"] = c.get("name", "")
        o["business_name"] = c.get("business_name", "")
    return orders


# ================= FOLLOW-UPS =================
@api_router.get("/followups")
async def list_followups(user=Depends(get_current_user)):
    fus = await db.followups.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    client_ids = list({f["client_id"] for f in fus})
    clients = await db.clients.find({"user_id": user["id"], "id": {"$in": client_ids}}, {"_id": 0}).to_list(2000)
    cmap = {c["id"]: c for c in clients}
    for f in fus:
        c = cmap.get(f["client_id"], {})
        f["client_name"] = c.get("name", "")
        f["business_name"] = c.get("business_name", "")
    return fus


@api_router.post("/followups")
async def create_followup(data: FollowUpIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["created_at"] = now_iso()
    # auto-schedule next follow-up from settings intervals if not provided
    if not doc.get("next_follow_up_date"):
        settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
        intervals = settings.get("follow_up_intervals") or [7, 14, 30, 60, 90]
        # count previous followups to pick interval progressively
        prev = await db.followups.count_documents({"user_id": user["id"], "client_id": doc["client_id"]})
        idx = min(prev, len(intervals) - 1)
        days = intervals[idx]
        doc["next_follow_up_date"] = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()
    await db.followups.insert_one(doc)
    update = {"last_follow_up_date": doc["created_at"], "follow_up_status": "Sudah Dihubungi", "next_follow_up_date": doc["next_follow_up_date"]}
    await db.clients.update_one({"id": doc["client_id"], "user_id": user["id"]}, {"$set": update})
    doc.pop("_id", None)
    return doc


# ================= WHATSAPP (FONNTE) =================
@api_router.post("/whatsapp/send")
async def whatsapp_send(data: WhatsAppSendIn, user=Depends(get_current_user)):
    """Send WhatsApp via Fonnte if user has token; otherwise return wa_link fallback."""
    c = await db.clients.find_one({"id": data.client_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    if not c.get("whatsapp"):
        raise HTTPException(status_code=400, detail="Nomor WhatsApp klien belum diisi")
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    token = settings.get("fonnte_token", "").strip()
    target = c["whatsapp"].replace("+", "").replace(" ", "")
    if not token:
        # fallback
        return {
            "sent": False,
            "fallback": "wa.me",
            "wa_link": f"https://wa.me/{target}?text={data.message}",
        }
    # Send via Fonnte
    import httpx
    form = {"target": target, "message": data.message, "countryCode": "62"}
    if data.schedule_at:
        try:
            dt = datetime.fromisoformat(data.schedule_at.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            form["schedule"] = str(int(dt.timestamp()))
        except Exception:
            pass
    multipart = {k: (None, v) for k, v in form.items()}
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            resp = await hc.post("https://api.fonnte.com/send", headers={"Authorization": token}, files=multipart)
            resp.raise_for_status()
            result = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "Fonnte timeout, coba lagi")
    except Exception as e:
        raise HTTPException(502, f"Fonnte error: {e}")
    if result.get("status") is not True:
        reason = result.get("reason", "Fonnte menolak")
        raise HTTPException(400, f"Fonnte gagal: {reason}")
    # Record follow-up
    await db.followups.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "client_id": data.client_id,
        "message": data.message,
        "channel": "WhatsApp (Fonnte)",
        "status": "Terjadwal" if data.schedule_at else "Terkirim",
        "response": "",
        "notes": "",
        "next_follow_up_date": None,
        "created_at": now_iso(),
        "fonnte_id": result.get("id"),
    })
    await db.clients.update_one({"id": data.client_id, "user_id": user["id"]}, {"$set": {"last_follow_up_date": now_iso(), "follow_up_status": "Sudah Dihubungi"}})
    return {"sent": True, "scheduled": bool(data.schedule_at), "fonnte_id": result.get("id"), "detail": result.get("detail")}


# ================= REMINDERS =================
@api_router.get("/reminders/today")
async def reminders_today(user=Depends(get_current_user)):
    today_iso = datetime.now(timezone.utc).date().isoformat()
    clients = await db.clients.find({"user_id": user["id"], "next_follow_up_date": {"$lte": today_iso + "T99:99"}}, {"_id": 0}).to_list(1000)
    due = [c for c in clients if c.get("next_follow_up_date") and c["next_follow_up_date"][:10] <= today_iso]
    # enrich
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)
    obc = {}
    for o in orders:
        obc.setdefault(o["client_id"], []).append(o)
    for c in due:
        co = obc.get(c["id"], [])
        c["opportunity_score"] = compute_opportunity_score(c, co)
        c["last_service"] = max(co, key=lambda o: o.get("order_date", ""))["service"] if co else None
        c["total_spending"] = sum(o.get("order_value", 0) for o in co)
        last = max((o.get("order_date", "") for o in co), default=None)
        c["days_since_last_order"] = days_between(last) if last else None
    due.sort(key=lambda x: x.get("opportunity_score", 0), reverse=True)
    return {"date": today_iso, "count": len(due), "clients": due}


# ================= DASHBOARD =================
@api_router.get("/dashboard/summary")
async def dashboard_summary(user=Depends(get_current_user)):
    clients = await db.clients.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)
    followups = await db.followups.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)

    orders_by_client = {}
    for o in orders:
        orders_by_client.setdefault(o["client_id"], []).append(o)

    total_clients = len(clients)
    never_contacted = 0
    contacted_this_week = 0
    d30 = d60 = d90 = 0
    high_value = 0
    today_iso = datetime.now(timezone.utc).date().isoformat()
    followup_today = 0
    total_potential_revenue = 0

    hot_clients = []
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    for c in clients:
        co = orders_by_client.get(c["id"], [])
        last_order = max((o.get("order_date", "") for o in co), default=None)
        if not co:
            # never ordered -> exclude from dormant buckets (no baseline order date)
            days = None
        else:
            days = days_between(last_order)
            if days is None:
                days = 9999
        total_spend = sum(o.get("order_value", 0) for o in co)
        score = compute_opportunity_score(c, co)
        c_enriched = {**c, "opportunity_score": score, "days_since_last_order": days, "total_spending": total_spend, "orders_count": len(co), "last_order_date": last_order, "last_service": (max(co, key=lambda x: x.get("order_date", ""))["service"] if co else None)}

        if not c.get("last_follow_up_date"):
            never_contacted += 1
        else:
            lf = c.get("last_follow_up_date")
            try:
                lfd = datetime.fromisoformat(lf.replace('Z', '+00:00'))
                if lfd >= week_ago:
                    contacted_this_week += 1
            except Exception:
                pass

        if days is not None and days >= 30:
            d30 += 1
        if days is not None and days >= 60:
            d60 += 1
        if days is not None and days >= 90:
            d90 += 1

        if total_spend >= 2000000:
            high_value += 1

        if c.get("next_follow_up_date"):
            if c["next_follow_up_date"][:10] <= today_iso:
                followup_today += 1

        if score >= 60:
            # potential = average order value * conversion probability
            avg_order = (total_spend / len(co)) if co else 500000
            prob = 0.25 if score >= 80 else 0.15
            total_potential_revenue += avg_order * prob
            hot_clients.append(c_enriched)

    hot_clients.sort(key=lambda x: x["opportunity_score"], reverse=True)

    repeat_this_month = 0
    for cid, co in orders_by_client.items():
        this_month = [o for o in co if o.get("order_date", "") >= month_start.date().isoformat()]
        if len(co) > len(this_month) and this_month:
            repeat_this_month += 1

    return {
        "total_clients": total_clients,
        "follow_up_today": followup_today,
        "never_contacted": never_contacted,
        "contacted_this_week": contacted_this_week,
        "high_value_clients": high_value,
        "dormant_30": d30,
        "dormant_60": d60,
        "dormant_90": d90,
        "repeat_this_month": repeat_this_month,
        "estimated_potential_revenue": int(total_potential_revenue),
        "top_clients_today": hot_clients[:8],
    }


# ================= AI: MESSAGE GENERATOR =================
def build_client_context(client: dict, orders: List[dict], settings: dict) -> str:
    services = ", ".join([o["service"] for o in orders]) if orders else "belum ada"
    last_order = max((o.get("order_date", "") for o in orders), default="belum ada")
    days = days_between(last_order) if orders else None
    total_spend = sum(o.get("order_value", 0) for o in orders)
    return f"""
DATA KLIEN:
- Nama: {client.get('name')}
- Bisnis: {client.get('business_name', '-')}
- Kategori: {client.get('business_category', '-')}
- Jumlah pesanan sebelumnya: {len(orders)}
- Total pengeluaran: Rp {total_spend:,.0f}
- Layanan yang pernah dibeli: {services}
- Terakhir pesan: {last_order} ({days} hari lalu)
- Catatan: {client.get('notes', '-')}

DATA FREELANCER:
- Nama bisnis: {settings.get('business_name', '-')}
- Layanan yang ditawarkan: {', '.join(settings.get('services', []))}
- Deskripsi: {settings.get('business_description', '-')}
""".strip()


async def gen_ai_text(system: str, prompt: str, session_id: str = None) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id or str(uuid.uuid4()),
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")
    resp = await chat.send_message(UserMessage(text=prompt))
    return str(resp).strip()


@api_router.post("/ai/generate-message")
async def ai_generate_message(data: GenerateMessageIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": data.client_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    orders = await db.orders.find({"user_id": user["id"], "client_id": data.client_id}, {"_id": 0}).to_list(500)
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0}) or {}

    tone_map = {
        "Ramah": "hangat, ramah, seperti sahabat lama",
        "Kasual": "santai, casual, seperti chat teman",
        "Profesional": "profesional tapi tetap approachable",
        "Hangat": "hangat, personal, empatik",
        "Sales": "persuasif, fokus pada value & benefit",
        "Soft Selling": "halus, prioritaskan hubungan dulu, jual pelan-pelan",
    }
    tone_desc = tone_map.get(data.tone, "hangat & natural")

    system = (
        "Kamu adalah sales assistant untuk freelance graphic designer di Indonesia. "
        "Tugasmu menulis pesan WhatsApp follow-up yang PERSONAL, TIDAK spam, dan MEMBANGUN HUBUNGAN dulu sebelum menjual. "
        "Gunakan bahasa Indonesia natural, boleh santai dengan sapaan 'Kak' atau 'Mas/Mbak' sesuai konteks. "
        "JANGAN pakai template generik. JANGAN paksa jualan di kalimat pertama. "
        "Sisipkan 1 emoji maksimal di seluruh pesan (tidak wajib). Panjang ideal 3-5 kalimat. "
        "JANGAN mengarang informasi yang tidak ada di data klien. "
        "Output HANYA pesan WhatsApp mentah, tanpa penjelasan atau markdown."
    )

    ctx = build_client_context(c, orders, settings)
    instruction = f"Tulis pesan follow-up dengan tone: {tone_desc}."
    if data.modifier == "shorter":
        instruction = f"Tulis pesan follow-up SANGAT SINGKAT (2-3 kalimat), tone: {tone_desc}."
    elif data.modifier == "more_casual":
        instruction = "Tulis pesan follow-up yang LEBIH KASUAL & santai seperti chat teman."
    elif data.modifier == "more_professional":
        instruction = "Tulis pesan follow-up yang LEBIH PROFESIONAL dan formal namun tetap hangat."
    elif data.modifier == "regenerate":
        instruction = f"Tulis versi ALTERNATIF pesan follow-up dengan pendekatan berbeda, tone: {tone_desc}."

    prompt = f"{ctx}\n\nINSTRUKSI: {instruction}\n\nAnalisis riwayat klien, temukan hook natural (misal referensi project sebelumnya), lalu tawarkan layanan yang relevan tanpa terkesan memaksa."

    text = ""
    try:
        text = await gen_ai_text(system, prompt, session_id=f"msg-{data.client_id}")
    except Exception as e:
        logger.exception("AI generate error")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    return {"message": text}


@api_router.get("/ai/analyze/{client_id}")
async def ai_analyze(client_id: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    orders = await db.orders.find({"user_id": user["id"], "client_id": client_id}, {"_id": 0}).to_list(500)
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    score = compute_opportunity_score(c, orders)

    system = (
        "Kamu adalah AI Sales Analyst untuk freelance designer. Analisis klien dan berikan rekomendasi ringkas dalam JSON. "
        "Output HARUS valid JSON tanpa markdown atau penjelasan tambahan, format: "
        '{"analysis": "string 2-3 kalimat analisis situasi klien", "recommended_service": "string nama layanan", "recommended_offer": "string tawaran spesifik dengan harga", "recommended_timing": "string kapan sebaiknya kontak"}'
    )
    ctx = build_client_context(c, orders, settings)
    prompt = f"{ctx}\n\nSkor peluang: {score}/100.\n\nBerikan analisis dan rekomendasi konkret untuk revive klien ini. Output JSON saja."

    try:
        raw = await gen_ai_text(system, prompt, session_id=f"analyze-{client_id}")
        # Try to extract JSON
        import json as _json
        raw_clean = raw.replace("```json", "").replace("```", "").strip()
        parsed = _json.loads(raw_clean)
    except Exception as e:
        logger.warning(f"AI analyze parse fallback: {e}")
        parsed = {
            "analysis": "Klien memiliki riwayat order yang menarik dan berpotensi untuk repeat order.",
            "recommended_service": "Social Media Content Package",
            "recommended_offer": "7 konten/bulan - Rp 500.000",
            "recommended_timing": "Kontak minggu ini",
        }

    return {"score": score, "category": opportunity_category(score), **parsed}


@api_router.get("/ai/recommendations")
async def ai_recommendations(user=Depends(get_current_user)):
    """Top 10 clients to contact today, with reasoning."""
    clients = await db.clients.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    orders_by_client = {}
    for o in orders:
        orders_by_client.setdefault(o["client_id"], []).append(o)

    scored = []
    for c in clients:
        co = orders_by_client.get(c["id"], [])
        score = compute_opportunity_score(c, co)
        last_order = max((o.get("order_date", "") for o in co), default=None)
        days = days_between(last_order) if last_order else None
        total_spend = sum(o.get("order_value", 0) for o in co)
        last_service = None
        if co:
            last = max(co, key=lambda o: o.get("order_date", ""))
            last_service = last.get("service")
        scored.append({
            **c,
            "opportunity_score": score,
            "opportunity_category": opportunity_category(score),
            "days_since_last_order": days,
            "total_spending": total_spend,
            "orders_count": len(co),
            "last_service": last_service,
            "last_order_date": last_order,
        })
    scored.sort(key=lambda x: x["opportunity_score"], reverse=True)
    top = scored[:10]

    # Simple heuristic recommendations per client (no LLM to keep fast)
    service_pool = settings.get("services", ["Social Media Design", "Branding", "Content Package"])
    pricing = settings.get("pricing", {})

    for t in top:
        last = t.get("last_service") or ""
        # cross-sell logic
        if "Logo" in last:
            rec_service = "Instagram Branding Package"
            offer = "Template feed 12 slot + brand guideline"
        elif "Branding" in last:
            rec_service = "Monthly Social Media Content"
            offer = "7 konten/bulan"
        elif "Social Media" in last or "Instagram" in last:
            rec_service = "Video Reels Package"
            offer = "4 reels/bulan"
        elif "Wedding" in last:
            rec_service = "Same Day Edit Video"
            offer = "SDE + album cetak"
        else:
            rec_service = service_pool[0] if service_pool else "Social Media Design"
            offer = "Paket starter 5 konten"

        price = pricing.get(rec_service, 500000)
        price_str = f"Rp {int(price):,}".replace(",", ".")
        days = t.get("days_since_last_order")
        reason_parts = []
        if days is not None:
            reason_parts.append(f"Pesanan terakhir {days} hari lalu")
        if t.get("orders_count", 0) > 1:
            reason_parts.append(f"sudah order {t['orders_count']}x")
        if t.get("total_spending", 0) >= 2000000:
            reason_parts.append("total spending tinggi")
        t["reason"] = ". ".join(reason_parts) if reason_parts else "Klien potensial belum di-follow up"
        t["recommended_service"] = rec_service
        t["recommended_offer"] = f"{offer} - {price_str}"

    # revenue estimate
    est_conversion = 0.2
    avg_order = 500000
    if top:
        avgs = [t["total_spending"] / t["orders_count"] for t in top if t["orders_count"]]
        if avgs:
            avg_order = sum(avgs) / len(avgs)
    daily_est = int(len(top) * est_conversion * avg_order)

    return {
        "top_clients": top,
        "revenue_estimate": {
            "clients_count": len(top),
            "conversion_rate": est_conversion,
            "avg_order": int(avg_order),
            "daily_potential": daily_est,
            "weekly_potential": daily_est * 5,
        },
    }


# ================= SETTINGS =================
@api_router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        s = {"user_id": user["id"], "business_name": user["name"], "services": [], "pricing": {}, "follow_up_intervals": [7, 14, 30, 60, 90], "whatsapp_number": "", "ai_tone": "Ramah", "currency": "Rp", "business_description": "", "fonnte_token": "", "reminder_time": "08:00"}
    s.setdefault("fonnte_token", "")
    s.setdefault("reminder_time", "08:00")
    return s


@api_router.put("/settings")
async def update_settings(data: SettingsIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    await db.settings.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True}


# ================= CSV IMPORT =================
@api_router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    for row in reader:
        name = (row.get("name") or row.get("Nama") or "").strip()
        if not name:
            continue
        cid = str(uuid.uuid4())
        doc = {
            "id": cid,
            "user_id": user["id"],
            "name": name,
            "business_name": (row.get("business_name") or row.get("Bisnis") or "").strip(),
            "whatsapp": (row.get("whatsapp") or row.get("WhatsApp") or "").strip(),
            "email": (row.get("email") or "").strip(),
            "instagram": (row.get("instagram") or "").strip(),
            "business_category": (row.get("business_category") or row.get("Kategori") or "").strip(),
            "location": (row.get("location") or row.get("Lokasi") or "").strip(),
            "notes": (row.get("notes") or "").strip(),
            "status": "Aktif",
            "follow_up_status": "Belum Dihubungi",
            "tags": [],
            "priority": "Sedang",
            "preferred_channel": "WhatsApp",
            "created_at": now_iso(),
            "last_follow_up_date": None,
            "next_follow_up_date": None,
        }
        await db.clients.insert_one(doc)
        # optional single-order fields
        service = (row.get("last_service") or row.get("service") or "").strip()
        order_value = row.get("order_value") or row.get("value") or "0"
        order_date = row.get("last_order_date") or row.get("order_date") or ""
        if service:
            try:
                val = float(str(order_value).replace(",", "").replace(".", "")) if order_value else 0
            except Exception:
                val = 0
            await db.orders.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "client_id": cid,
                "order_date": order_date or now_iso()[:10],
                "service": service,
                "project_name": "",
                "order_value": val,
                "notes": "",
                "delivery_status": "Selesai",
                "created_at": now_iso(),
            })
        imported += 1
    return {"imported": imported}


# ================= SAMPLE DATA =================
SAMPLE_CLIENTS = [
    {"name": "Andi Pratama", "business_name": "Kopi Kenangan Cabang Bandung", "whatsapp": "6281234567891", "instagram": "@andipratama", "business_category": "F&B", "location": "Bandung", "status": "Dormant", "notes": "Suka desain minimalis, prefer warna earthy."},
    {"name": "Sarah Wijaya", "business_name": "Sarah Beauty Studio", "whatsapp": "6281234567892", "instagram": "@sarahbeautystudio", "business_category": "Beauty", "location": "Jakarta", "status": "VIP", "notes": "Repeat customer, cepat respon."},
    {"name": "Budi Hartono", "business_name": "Hartono Wedding Organizer", "whatsapp": "6281234567893", "business_category": "Wedding", "location": "Surabaya", "status": "Aktif", "notes": "Butuh desain undangan setiap bulan."},
    {"name": "Rina Kusuma", "business_name": "Rina Boutique", "whatsapp": "6281234567894", "instagram": "@rinaboutique.id", "business_category": "Fashion", "location": "Yogyakarta", "status": "Dormant", "notes": "Sempat vakum, tapi followers-nya masih aktif."},
    {"name": "Dewa Kurniawan", "business_name": "Dewa Barbershop", "whatsapp": "6281234567895", "instagram": "@dewabarbershop", "business_category": "Beauty", "location": "Bali", "status": "Potensial", "notes": "Baru buka cabang ke-2."},
    {"name": "Maya Sari", "business_name": "Maya Cake House", "whatsapp": "6281234567896", "instagram": "@mayacakehouse", "business_category": "F&B", "location": "Jakarta", "status": "Aktif", "notes": "Order rutin per lebaran & natal."},
    {"name": "Fahmi Rahman", "business_name": "Fahmi Fitness", "whatsapp": "6281234567897", "business_category": "Fitness", "location": "Bandung", "status": "Baru", "notes": "Baru gabung, butuh full branding."},
    {"name": "Lestari Dewi", "business_name": "Lestari Herbal", "whatsapp": "", "instagram": "@lestariherbal", "business_category": "Health", "location": "Semarang", "status": "Dormant", "notes": "No WA belum ada, hubungi via IG."},
    {"name": "Rangga Wijaksono", "business_name": "Rangga Coffee Roaster", "whatsapp": "6281234567899", "instagram": "@ranggacoffee", "business_category": "F&B", "location": "Malang", "status": "VIP", "notes": "Ekspansi ke Surabaya bulan depan."},
    {"name": "Tania Putri", "business_name": "Tania Photography", "whatsapp": "6281234567800", "instagram": "@taniaphoto", "business_category": "Creative", "location": "Jakarta", "status": "Aktif", "notes": "Butuh caption template."},
    {"name": "Hendra Setiawan", "business_name": "Hendra Motor Custom", "whatsapp": "6281234567801", "business_category": "Automotive", "location": "Bogor", "status": "Dormant", "notes": "Order flyer event, sudah lama tidak kontak."},
    {"name": "Yuni Astuti", "business_name": "Yuni Katering", "whatsapp": "6281234567802", "instagram": "@yunikatering", "business_category": "F&B", "location": "Depok", "status": "Potensial", "notes": "Sedang buka pre-order menu baru."},
    {"name": "Bagas Nugroho", "business_name": "Bagas Property", "whatsapp": "6281234567803", "business_category": "Property", "location": "Jakarta", "status": "VIP", "notes": "Butuh brosur listing rutin."},
    {"name": "Citra Larasati", "business_name": "Citra Skincare", "whatsapp": "6281234567804", "instagram": "@citraskincare", "business_category": "Beauty", "location": "Jakarta", "status": "Dormant", "notes": "Sempat pause karena hamil."},
    {"name": "Reza Fauzi", "business_name": "Reza Digital Agency", "whatsapp": "6281234567805", "business_category": "Agency", "location": "Bandung", "status": "Aktif", "notes": "Sering outsource desain ke kita."},
]


async def seed_sample_data(user_id: str):
    services_pool = [
        ("Logo Design", 750000),
        ("Branding", 2500000),
        ("Social Media Design", 500000),
        ("Instagram Carousel", 350000),
        ("Instagram Reels", 600000),
        ("Video Editing", 800000),
        ("Content Creation", 900000),
        ("Wedding Design", 1500000),
        ("Poster", 250000),
        ("Flyer", 200000),
        ("Packaging", 1200000),
    ]
    import random
    random.seed(user_id)
    today = datetime.now(timezone.utc)

    for idx, s in enumerate(SAMPLE_CLIENTS):
        cid = str(uuid.uuid4())
        doc = {
            "id": cid,
            "user_id": user_id,
            "name": s["name"],
            "business_name": s.get("business_name", ""),
            "whatsapp": s.get("whatsapp", ""),
            "email": "",
            "instagram": s.get("instagram", ""),
            "business_category": s.get("business_category", ""),
            "location": s.get("location", ""),
            "notes": s.get("notes", ""),
            "status": s.get("status", "Aktif"),
            "follow_up_status": "Belum Dihubungi",
            "tags": [],
            "priority": random.choice(["Tinggi", "Sedang", "Rendah"]),
            "preferred_channel": "WhatsApp",
            "created_at": now_iso(),
            "last_follow_up_date": None,
            "next_follow_up_date": None,
        }
        # seed some clients with next_follow_up_date near today for reminder demo
        if idx in [0, 4, 8, 11]:
            offset = random.choice([-2, -1, 0, 0, 1])
            doc["next_follow_up_date"] = (today + timedelta(days=offset)).date().isoformat()
        await db.clients.insert_one(doc)

        # generate 1-5 orders
        n_orders = random.randint(1, 5)
        # last order days ago depending on status
        if s.get("status") == "VIP":
            days_offset = random.randint(15, 60)
        elif s.get("status") == "Aktif":
            days_offset = random.randint(30, 90)
        elif s.get("status") == "Dormant":
            days_offset = random.randint(120, 300)
        elif s.get("status") == "Baru":
            days_offset = random.randint(3, 20)
        else:
            days_offset = random.randint(60, 200)

        for i in range(n_orders):
            svc, base_price = random.choice(services_pool)
            order_days_ago = days_offset + i * random.randint(30, 80)
            order_date = (today - timedelta(days=order_days_ago)).date().isoformat()
            value = base_price * random.choice([0.8, 1.0, 1.2, 1.5])
            await db.orders.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "client_id": cid,
                "order_date": order_date,
                "service": svc,
                "project_name": f"{svc} untuk {s['business_name']}",
                "order_value": int(value),
                "notes": "",
                "delivery_status": "Selesai",
                "created_at": now_iso(),
            })


@api_router.post("/seed-sample-data")
async def seed_endpoint(user=Depends(get_current_user)):
    await db.clients.delete_many({"user_id": user["id"]})
    await db.orders.delete_many({"user_id": user["id"]})
    await db.followups.delete_many({"user_id": user["id"]})
    await seed_sample_data(user["id"])
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"app": "ClientRevive AI", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
