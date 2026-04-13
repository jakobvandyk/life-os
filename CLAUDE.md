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

## Current Icon System (D3+D7)
Sidebar and page headers use 9x9 pixel art SVG icons (PixelIcon component).
Navigation grouped into sections: LIFE (tasks/habits/calendar), TRACK (workouts/finances/knowledge), REFLECT (journal/goals/review), SYSTEM (chat/settings).
Active sidebar item uses bg-desert-accent/10 warm tint. Dashboard cards have domain-coloured left border accents.

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
    ├── sync/ical/route.ts
    ├── sync/kubios/route.ts (scaffold, not active)
    └── export/analysis/route.ts
src/proxy.ts (auth proxy — Next.js 16, excludes /api/, /manifest.json, /sw.js)
src/components/ (Sidebar, SignOutButton, SyncStatus, ServiceWorkerRegistrar, PixelIcon, PixelBackground, Sparkline, Markdown)
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
integration_syncs, raw_imports, nutrition_daily

## Key Schema Details
- Goal areas: finance, health, side_projects, personal_growth, personal
- Goal progress types: percentage, milestone, numeric
- Task priorities: urgent, high, medium, low
- Task statuses: todo, in_progress, done (clickable badge cycles status)
- Tasks support subtasks via parent_id (BIGINT FK, cascade delete)
- Habit log types: boolean, numeric, partial
- Habit frequencies: daily, weekdays, weekends, weekly, monthly (streaks respect frequency — skip non-due days)
- Journal: mood 1-5 (😞😐🙂😊🤩), energy 1-5 (🪫😴⚡🔥🚀), unique per (user_id, date)
- Finance account types: savings, investment, cash, kiwisaver, super, credit
- Finance asset classes: cash_equivalents, equities, crypto, bonds, reits, commodities, other
- Finance liquidity tiers: immediate, short_term, illiquid
- Workout sessions: upper-strength, lower-strength, upper-volume, lower-volume (defined in constants.ts)
- Workout RPE values: easy, med, hard, fail (display: easy=green, med=amber, hard=red, fail=purple)
- workout_checkins: hrv (SDNN, Apple Health), hrv_rmssd (RMSSD, Kubios/Polar H10), pns_index, sns_index, stress_index, kubios_readiness (0-100), mean_hr, shin_pain (0-10), waist_cm, body_fat_pct (scale bioimpedance estimate), sleep_score (real, Garmin/Apple Health sleep quality percentage), steps, active_calories, resting_hr, vo2_max (Garmin → Apple Health), tags (text array)
- Exchange rate pairs stored as e.g. "NZDAUD" (no slash) with rate as real
- kb_notes types: note, ai_response, research
- chat_messages capabilities: focus, review, spending, journal, general
- nutrition_daily: unique per (user_id, date), macros (calories, protein_g, carbs_g, fat_g, fiber_g), hydration (water_ml), stimulants (caffeine_mg, alcohol_g), micros (vitamin_d_iu, iron_mg, magnesium_mg, zinc_mg, sodium_mg, potassium_mg), source defaults to 'cronometer'

## What's Built (All Phases Complete)
- Login (Supabase Auth)
- Dashboard (bento grid, contextual greetings, linked cards, nutrition card, 30-day biometric sparklines, skeleton loading)
- Tasks (full CRUD, inline editing, subtasks, priorities, filters, status badges, responsive mobile layout)
- Habits (daily toggle, inline editing, pixel art icon picker, frequency-aware streaks, weekends/monthly recurrence)
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
  - JSON body: { date (required, YYYY-MM-DD), hrv (SDNN), hrv_rmssd (RMSSD from Kubios/Polar H10), sleep_hours, sleep_score, weight, readiness (1-10), mindfulness_minutes, shin_pain (0-10), waist_cm, pns_index, sns_index, stress_index, kubios_readiness (0-100), mean_hr, body_fat_pct, steps, active_calories, resting_hr, vo2_max }
  - All fields except date are optional — only send what the iOS Shortcut pulls
  - Upserts to workout_checkins, logs mindfulness to habit_logs if matching habit exists
  - maxDuration=10, uses maybeSingle() to avoid crash on missing rows
- Garmin Recovery: not a direct API integration — map recovery % to readiness field via iOS Shortcut (divide by 10 for 0-10 scale)
- Kubios HRV: Manual entry via DailyCheckin form (Polar H10 → Kubios app → read values → enter in Life OS). Metrics: RMSSD, PNS index, SNS index, Baevsky stress index, readiness 0-100, mean HR. Sync scaffold at /api/sync/kubios (not active, requires paid Kubios Cloud).
- Cronometer: POST /api/import/cronometer (CSV upload, session auth) — auto-detects format:
  - Nutrition CSV (wide format): parses → nutrition_daily (macros/micros), workout_checkins (weight/body_fat/waist, selective merge), journal_entries (mood/energy, existing entries only)
  - Biometrics CSV (long format: Day,Group,Metric,Unit,Amount): pivots → workout_checkins (weight, body_fat_pct, sleep, sleep_score, hrv, resting_hr, mean_hr — selective merge), journal_entries (mood/energy, existing entries only)
- myBOQ: POST /api/import/ofx (OFX upload, session auth)
- Binance: GET /api/sync/binance (HMAC-SHA256, env: BINANCE_API_KEY, BINANCE_SECRET, CRON_SECRET, daily 8am via vercel.json)
- iCal: GET /api/sync/ical (env: ICAL_URL_1..ICAL_URL_10)
- Data Export: GET /api/export/analysis?days=14 (session auth, max 90). Full JSON bundle for offline AI analysis. Download buttons on dashboard + review page.
- Insight Import: Knowledge Base "Import Insight" modal. Accepts .md/.txt or pasted markdown. Saves as kb_notes type: ai_response, auto-tagged: claude-analysis.
- Analysis prompt template: public/analysis-prompt.md
- Workflow: Export JSON → analyse in Claude (subscription) → save markdown → import insight to KB

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
# Future (Kubios sync, requires paid cloud): KUBIOS_CLIENT_ID, KUBIOS_CLIENT_SECRET, KUBIOS_ACCESS_TOKEN

## Auth / Routing
- Auth handled by src/proxy.ts (Next.js 16 uses proxy.ts, NOT middleware.ts)
- /api/* routes are excluded from auth redirect (webhooks/crons handle their own auth)
- /manifest.json, /sw.js excluded from auth redirect (PWA assets must not return HTML)
- /login, static files, PWA assets also excluded
- All other routes redirect to /login if no session

## PWA + Offline (Phase 7)
- Service worker: public/sw.js (network-first, cache fallback)
- Manifest: public/manifest.json
- Dexie.js local DB: src/lib/local-db.ts (mirrors tasks, habits, journal, goals, workouts)
- Sync queue: src/lib/sync.ts (queueWrite, processSyncQueue, seedLocalCache)
- Replay uses upsert for tables with unique constraints (UPSERT_TABLES map in sync.ts)
- Auto-retry: useOnlineStatus replays pending items every 30s when online (not just on offline→online)
- useOnlineStatus hook: src/hooks/useOnlineStatus.ts
- SyncStatus component in sidebar (green/amber/red dot, clickable with Retry/Clear when pending/error)
- All 25 write operations across 13 files have offline fallbacks wired

## AI Chat System Prompt
"You are Jakob's personal Life OS assistant. You have access to his live data.
Be concise, direct, and practical. Use plain text unless markdown genuinely helps.
Jakob is based in Hamilton, New Zealand. Currency is NZD."

## Pixel Art Icons (D3 + D7 — Complete)
- PixelIcon component at src/components/PixelIcon.tsx
- 9x9 SVG pixel grids with crispEdges rendering, uses currentColor (upgraded from 7x7)
- 12 nav/page icons: dashboard, tasks, habits, workouts, journal, goals, finances, calendar, knowledge, review, chat, settings
- 50+ emoji replacement icons: mood faces (5), energy levels (5), habit icons (16), chat capabilities (5), integration icons (5), journal sections (3), task priorities (4), empty states (4), branding bolt
- Used in: sidebar NavList (16px), page headers (22px), dashboard bento cards (14px), mood/energy selectors (24px), habit picker (18px)
- Habit icons use backward compat: PixelIcon names for new habits, emoji fallback for existing DB records
- ICON_NAMES export maps route paths to icon names

## Pixel Art Backgrounds (D4 — Complete)
- PixelBackground component at src/components/PixelBackground.tsx
- 120×40 SVG pixel grids with multi-colour palette (7 theme colours)
- Code-generated scenes using drawing helpers (cactus, mountain, mesa, star, etc.)
- Fixed position, bottom-aligned, 7% opacity, pointer-events-none
- Auto-detects route via usePathname() — rendered once in layout.tsx
- Colours use CSS variables → auto light/dark theme support
- Scene cache prevents re-computation
- 12 unique scenes:
  - Dashboard: desert panorama (mesas, saguaro cacti, setting sun)
  - Tasks: desert trail (winding path, signposts, cacti)
  - Habits: canyon layers (rock strata, waterfall)
  - Workouts: mountain range (jagged peaks, boulders, climbing rope)
  - Journal: campfire (flames, smoke wisps, bedroll, starry sky)
  - Goals: summit vista (peak with flag, eagle silhouette)
  - Finances: gold mine (mine cart, pickaxe, gold nuggets)
  - Calendar: desert sky (crescent moon, constellations)
  - Knowledge: ancient library (stone archway, scroll shelves, lantern)
  - Review: compass rose (cardinal points, map edges, trail markers)
  - Chat: campsite (tent, smoke signals, small fire)
  - Settings: workbench (gear wheels, tools, crafting table)
- IMPORTANT: Page root divs must NOT use bg-desert-bg (blocks the background art). Body provides the bg colour.

## Light/Dark Theme
- Toggle in sidebar footer: "☀ LIGHT" / "☽ DARK"
- Implemented via CSS variable overrides: `html.light {}` in globals.css
- FOUC-prevention inline script in layout.tsx reads localStorage before first paint
- Light palette: warm parchment/sandstone ("desert at midday"), not clinical white
- All components automatically adapt — no per-page changes needed
- Preference persisted in localStorage key: "theme" (values: "light" | "dark")

## Data Inventory & Strategy
- DATA-INVENTORY.md — every data point, its origin device, ingestion path, and authoritative source
- DATA-STRATEGY.md — source authority hierarchy, daily/weekly workflow, conflict resolution rules, device chain diagram, full iOS Shortcut specification
- Authority rule: device/API > structured import (CSV) > manual entry. Manual always wins as override.

## Current Status
All phases complete (1-7). All design phases complete (D1-D7).

Recent additions (2026-04-12):
- Markdown rendering (react-markdown + remark-gfm + syntax highlighting, prose-desert theme)
- Cronometer biometric mapping (nutrition_daily table, CSV import → nutrition/checkins/journal)
- Garmin health metrics (steps, active_calories, resting_hr, vo2_max via Apple Health webhook)
- Dashboard: nutrition card, 30-day biometric sparklines (13 metrics, hero/secondary split), skeleton loading + fade-in
- Design elevation: card accent borders, gradient header divider, sidebar section grouping (LIFE/TRACK/REFLECT/SYSTEM)
- 9x9 pixel icon upgrade (12 nav icons + 50+ emoji replacements across all pages)
- Workouts trends grid grouped into Body Composition / HRV & Recovery / Activity / Kubios sections
- Data strategy docs: DATA-STRATEGY.md (workflow, iOS Shortcut spec), DATA-INVENTORY.md (rewritten)
- Press Start 2P font fix (CSS variable resolution)
- Export route includes nutrition_daily

Recent additions (2026-04-13):
- Icon clarity revamp: tasks (clipboard), review (cycle arrows), settings (wrench), unclear habit icons redrawn bolder
- Sync queue fix: replay uses upsert for tables with unique constraints (was failing on duplicate kb_tags)
- Auto-retry pending sync items every 30s when online (was only on offline→online transition)
- SyncStatus clickable with Retry/Clear buttons for stuck queue items
- Sign out button moved from sidebar to Settings page (Account section)
- KB pin icon: 📌 emoji → kb_pinned PixelIcon
- Manifest/SW console errors fixed: proxy.ts skips /manifest.json and /sw.js
- Historical emoji habits migrated to pixel icon names in DB

Next: Cronometer auto-import via Apple Health (eliminates CSV), goal auto-progress, review snapshots.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
