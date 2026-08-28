# ClientRevive AI - PRD

## Problem Statement
Build a professional web-based CRM + AI client follow-up assistant ("ClientRevive AI") for a freelance graphic designer/content creator. Purpose: revive old clients, prioritize who to contact, know what they bought, generate personalized WhatsApp messages via AI (Bahasa Indonesia), and track follow-ups until repeat orders happen. Target: ~Rp 2Jt additional revenue/week from old clients.

## Architecture
- Backend: FastAPI + MongoDB (motor)
- Frontend: React 19 + Tailwind + Shadcn UI + Recharts
- AI: Gemini 3 Flash via `emergentintegrations` (Emergent LLM Key)
- Auth: JWT (bcrypt password hashing)
- WhatsApp: wa.me link (user reviews & sends manually)

## User Persona
Freelance designer in Indonesia who has existing client list (Notion), wants to increase repeat orders.

## Core Data Model
- users (id, email, name, password_hash)
- clients (id, user_id, name, business_name, whatsapp, ig, category, location, status, follow_up_status, notes, priority, tags, next_follow_up_date, last_follow_up_date)
- orders (id, user_id, client_id, order_date, service, project_name, order_value, notes, delivery_status)
- followups (id, user_id, client_id, message, channel, status, response, notes, next_follow_up_date)
- settings (id, user_id, business_name, services[], pricing{}, follow_up_intervals[], whatsapp_number, ai_tone, currency, business_description)

## Implemented (2026-02)
- JWT auth (register auto-seeds 15 sample Indonesian clients + orders)
- Dashboard with 8 KPIs + revenue opportunity banner + Today's Follow-Ups grid
- Client database with search + 7 quick filters + CSV import + Add/Delete
- Client profile: AI analysis (score, category, recommendation), AI message generator (6 tones + 4 modifiers), WhatsApp send button, order history + add, follow-up history
- Smart Recommendations page: top 10 clients with reasoning, offer, service, revenue estimate
- Orders table (all orders)
- Follow-Ups history
- Calendar (react-day-picker) with scheduled follow-ups
- Analytics: revenue by month bar chart, top services pie, client status bars
- Settings: business name, description, WA number, services, pricing, tone, intervals
- Opportunity score algorithm (recency+frequency+monetary)
- Sample data reseed endpoint

## Backlog (P1/P2)
- P1: Editable client next_follow_up_date scheduler UI (currently API-only)
- P1: WhatsApp Business API integration (currently only wa.me link)
- P1: Notion API sync
- P2: Multi-user teams
- P2: Email follow-up channel
- P2: Automated follow-up interval reminders (background job)

## Next Tasks (post-1st-finish)
- Test full auth + AI flows via testing agent
- Fix any P0 bugs found
- Enhancements per user request
