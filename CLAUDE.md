@AGENTS.md

# Life OS — Project Context for Claude Code

## Project
Personal Life OS web dashboard built by Jakob, based in Hamilton, New Zealand.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL) — all data, auth, RLS on every table
- Deployed on Vercel at https://life-os-zeta-brown.vercel.app
- Auto-deploys on push to main
- IMPORTANT: Tailwind v4 — use `@import "tailwindcss"` and `@theme {}` in globals.css, NOT tailwind.config.ts

## Architecture Rules
- All UI is client-side ("use client") with direct Supabase calls — NO API routes (except AI chat + integration webhooks)
- Import supabase from `src/lib/supabase.ts` for client-side
- Import createClient from `src/lib/supabase-server.ts` for server-side
- Import getServiceClient from `src/lib/supabase-service.ts` for service-role (webhooks/crons only, lazy-init)
- Every insert() MUST include user_id from supabase.auth.getUser()
- Guard all writes: if (!userId) return
- All writes have offline fallback: on error, call `queueWrite(table, operation, payload)` from `src/lib/sync.ts`
- RLS policies on all tables: auth.uid() = user_id
- finance_exchange_rates is global (no user_id) — authenticated read, service_role write
- All monetary values stored as integers (cents), never floats
- Multi-currency: NZD base, AUD and USD secondary
- Frequency-to-monthly multipliers: daily×30, weekly×(52/12), fortnightly×(26/12), monthly×1, quarterly÷3, annual÷12

## Design System: "Desert Mystic"
Custom CSS variables defined in globals.css via `@theme {}`. Use Tailwind desert-* classes:
- Backgrounds: bg-desert-bg, bg-desert-surface, bg-desert-surface-hover
- Borders: border-desert-border, border-desert-border-strong
- Text: text-desert-text, text-desert-text-2, text-desert-text-3
- Accent: bg-desert-accent, text-desert-accent, hover:bg-desert-accent-glow
- Semantic: text-desert-success, text-desert-danger, text-desert-mystic, text-desert-celestial
- Cards: bg-desert-surface border border-desert-border rounded-sm
- Buttons: bg-desert-accent text-desert-bg font-mono uppercase tracking-wider
- Headings: font-mono uppercase tracking-wider
- Numbers: always font-mono
- Inputs: bg-desert-bg border border-desert-border-strong rounded-sm
- Medium brutalism: rounded-sm on cards/inputs, rounded-lg on buttons/pills only
- Page headers: consistent `pb-6 border-b border-desert-border` separator on all pages

## Colour Palette
- --bg: #1a1714 (dark leather)
- --surface: #242019 (worn sandstone)
- --surface-hover: #2e2a22 (warmed stone)
- --border: #3d3730 (cracked earth)
- --border-strong: #5c5345 (rope)
- --text: #e8dcc8 (parchment)
- --text-2: #a89880 (faded ink)
- --text-3: #6b5f50 (dust)
- --accent: #d4793c (campfire orange)
- --accent-glow: #e8943d (ember)
- --success: #7a9a5a (dried sage)
- --warning: #c4873a (desert sand)
- --danger: #b54a3a (rust red)
- --mystic: #8a6aaa (twilight purple)
- --celestial: #4a7a9a (night sky blue)
- --forest: #5a7a5a (moss)
- --ocean: #4a6a7a (deep water)
- --clay: #9a7a6a (dried clay)

## Typography
- Headings: IBM Plex Mono, bold, uppercase, wide tracking
- Body: IBM Plex Sans
- Numbers/data: IBM Plex Mono
- Pixel headers: Press Start 2P (font-pixel class)

## Current Icon System (D3)
Sidebar and page headers use monospace Unicode glyphs instead of emoji:
- Dashboard: ◈  Tasks: ☐  Habits: ↻  Workouts: ▲
- Journal: ✎  Goals: ◎  Finances: $  Calendar: ▦
- Knowledge: ≡  Review: ⟳  AI Chat: ⟡  Settings: ⚙

## Project Structure
src/app/
├── page.tsx (bento dashboard)
├── layout.tsx (sidebar + dark theme + SW registrar)
├── globals.css (Tailwind v4 @theme + design system)
├── login/page.tsx
├── tasks/page.tsx
├── habits/page.tsx
├── journal/page.tsx
├── goals/page.tsx
├── finances/
│   ├── page.tsx
│   └── components/ (MetricCards, AccountsTab, CashflowTab, TaxFlagsTab)
├── workouts/
│   ├── page.tsx
│   ├── constants.ts (SESSIONS definition)
│   └── components/ (SessionLogger, DailyCheckin, ProgressView, HistoryView)
├── calendar/page.tsx
├── knowledge/page.tsx
├── review/page.tsx
├── chat/page.tsx
├── settings/page.tsx
└── api/
    ├── chat/route.ts
    ├── review-summary/route.ts
    ├── integrations/health/route.ts
    ├── import/cronometer/route.ts
    ├── import/ofx/route.ts
    ├── sync/binance/route.ts
    └── sync/ical/route.ts
src/proxy.ts (auth proxy — Next.js 16, excludes /api/ routes)
src/components/ (Sidebar, SignOutButton, SyncStatus, ServiceWorkerRegistrar, PixelIcon)
src/hooks/ (useOnlineStatus.ts)
src/lib/ (supabase.ts, supabase-server.ts, supabase-service.ts, local-db.ts, sync.ts)
src/lib/ai/ (context-builders.ts)
src/types/ (modules.d.ts)
public/ (manifest.json, sw.js, icon-192.svg, icon-512.svg, banners/)
vercel.json (Binance cron schedule)

## Supabase Tables
tasks, habits, habit_logs, journal_entries, goals, goal_milestones,
key_results, finance_accounts, finance_income, finance_expenses,
finance_liabilities, finance_transactions, finance_snapshots,
finance_tax_flags, finance_exchange_rates, projects, workout_sessions,
workout_exercises, workout_checkins, calendar_events, kb_notes,
kb_tags, kb_note_tags, weekly_reviews, chat_sessions, chat_messages,
integration_syncs, raw_imports

## Key Schema Details
- Goal areas: finance, health, side_projects, personal_growth, personal
- Goal progress types: percentage, milestone, numeric
- Task priorities: urgent, high, medium, low
- Task statuses: todo, in_progress, done
- Habit log types: boolean, numeric, partial
- Journal: mood 1-5 (😞😐🙂😊🤩), energy 1-5 (🪫😴⚡🔥🚀), unique per (user_id, date)
- Finance account types: savings, investment, cash, kiwisaver, super, credit
- Finance asset classes: cash_equivalents, equities, crypto, bonds, reits, commodities, other
- Finance liquidity tiers: immediate, short_term, illiquid
- Workout sessions: upper-strength, lower-strength, upper-volume, lower-volume (defined in constants.ts)
- Workout RPE values: easy, med, hard, fail (display: easy=green, med=amber, hard=red, fail=purple)
- workout_checkins: hrv (SDNN, Apple Health), hrv_rmssd (RMSSD, Polar H10/Elite HRV), shin_pain (0-10), waist_cm (real)
- Exchange rate pairs stored as e.g. "NZDAUD" (no slash) with rate as real
- kb_notes types: note, ai_response, research
- chat_messages capabilities: focus, review, spending, journal, general

## What's Built (All Phases Complete)
- Login (Supabase Auth)
- Dashboard (bento grid, contextual greetings, linked cards)
- Tasks (full CRUD, priorities, filters, relative dates)
- Habits (daily toggle, streaks)
- Journal (mood/energy, gratitude/reflection/wins, upsert by date)
- Goals (OKRs with key results, progress updates)
- Finances (accounts, cashflow P&L, tax flags, multi-currency)
- Workouts (session logger, daily checkin, progress, history)
- Calendar (month grid + agenda, merged events/tasks/goals)
- Knowledge Base (notes, tags, search, types, linked goals/tasks)
- Weekly Review (8-section form, auto-pulled data, AI summary)
- AI Chat (5 capabilities, context builders, session history, save-to-KB)
- Settings (profile, live integration controls, exchange rates, sync logs)
- Desert Mystic design system (D1-D6 applied)
- Integrations (Apple Health webhook, Cronometer CSV, myBOQ OFX, Binance API, iCal feed)
- PWA + offline sync (Dexie.js, service worker, SyncStatus, queueWrite on all 25 write ops)

## Integrations (Phase 6)
- Apple Health: POST /api/integrations/health (x-api-key auth, env: HEALTH_WEBHOOK_KEY, HEALTH_USER_ID)
  - JSON body: { date (required, YYYY-MM-DD), hrv (SDNN), hrv_rmssd (RMSSD from Polar H10), sleep_hours, weight, readiness (1-10), mindfulness_minutes, shin_pain (0-10), waist_cm }
  - All fields except date are optional — only send what the iOS Shortcut pulls
  - Upserts to workout_checkins, logs mindfulness to habit_logs if matching habit exists
  - maxDuration=10, uses maybeSingle() to avoid crash on missing rows
- Cronometer: POST /api/import/cronometer (CSV upload, session auth)
- myBOQ: POST /api/import/ofx (OFX upload, session auth)
- Binance: GET /api/sync/binance (HMAC-SHA256, env: BINANCE_API_KEY, BINANCE_SECRET, CRON_SECRET, daily 8am via vercel.json)
- iCal: GET /api/sync/ical (env: ICAL_URL_1..ICAL_URL_10)

## Required Vercel Environment Variables
- NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/public key
- SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for webhooks/crons, bypasses RLS)
- ANTHROPIC_API_KEY — for AI Chat and review summary
- HEALTH_WEBHOOK_KEY — API key for Apple Health webhook (alphanumeric only, no special chars)
- HEALTH_USER_ID — Supabase user UUID (single-user system)
- BINANCE_API_KEY, BINANCE_SECRET — Binance read-only API credentials
- CRON_SECRET — protects cron-triggered endpoints
- ICAL_URL_1..ICAL_URL_10 — iCal feed URLs (Google Calendar secret address etc.)

## Auth / Routing
- Auth handled by src/proxy.ts (Next.js 16 uses proxy.ts, NOT middleware.ts)
- /api/* routes are excluded from auth redirect (webhooks/crons handle their own auth)
- /login, static files, PWA assets also excluded
- All other routes redirect to /login if no session

## PWA + Offline (Phase 7)
- Service worker: public/sw.js (network-first, cache fallback)
- Manifest: public/manifest.json
- Dexie.js local DB: src/lib/local-db.ts (mirrors tasks, habits, journal, goals, workouts)
- Sync queue: src/lib/sync.ts (queueWrite, processSyncQueue, seedLocalCache)
- useOnlineStatus hook: src/hooks/useOnlineStatus.ts
- SyncStatus component in sidebar (green/amber/red dot)
- All 25 write operations across 13 files have offline fallbacks wired

## AI Chat System Prompt
"You are Jakob's personal Life OS assistant. You have access to his live data.
Be concise, direct, and practical. Use plain text unless markdown genuinely helps.
Jakob is based in Hamilton, New Zealand. Currency is NZD."

## Pixel Art Icons (D3 — Complete)
- PixelIcon component at src/components/PixelIcon.tsx
- 7x7 SVG pixel grids with crispEdges rendering, uses currentColor
- 12 icons: dashboard (bento grid), tasks (checkbox), habits (circle arrow),
  workouts (dumbbell), journal (open book), goals (bullseye), finances (dollar),
  calendar (grid), knowledge (book spines), review (refresh arrows),
  chat (speech bubble), settings (gear cog)
- Used in: sidebar NavList (14px), page headers (18px), dashboard bento cards (12px)
- ICON_NAMES export maps route paths to icon names

## Planned: D4 Page Header Banners (User-Generated)
Jakob will create pixel art banner strips from his own photos. Specs:
- **Dimensions:** 960×48px (120×6 pixel grid, each cell 8×8px)
- **Format:** SVG preferred, PNG acceptable
- **Palette:** bg #1a1714, surface #242019, border #3d3730, border-strong #5c5345, accent #d4793c, text-3 #6b5f50
- **Files:** public/banners/{dashboard,tasks,habits,workouts,journal,goals,finances,calendar,knowledge,review,chat,settings}.svg
- **Wiring:** PageBanner component renders `<img>` below h1, w-full h-8 md:h-12 object-cover opacity-40
- Keep sparse and subtle — mostly bg colour with silhouette highlights

## Current Status
All phases complete (1-7). D3 pixel art icons complete. Offline fallbacks wired.
Next: D4 banners (user-created), data export endpoint, additional polish as needed.
