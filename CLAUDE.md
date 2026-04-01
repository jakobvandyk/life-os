@AGENTS.md

# Life OS — Project Context for Claude Code

## Project
Personal Life OS web dashboard built by Jakob, based in Hamilton, New Zealand.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL) — all data, auth, RLS on every table
- Deployed on Vercel at https://life-os-zeta-brown.vercel.app
- Auto-deploys on push to main

## Architecture Rules
- All UI is client-side ("use client") with direct Supabase calls — NO API routes (except AI chat + integration webhooks)
- Import supabase from `src/lib/supabase.ts` for client-side
- Import createClient from `src/lib/supabase-server.ts` for server-side
- Every insert() MUST include user_id from supabase.auth.getUser()
- Guard all writes: if (!userId) return
- RLS policies on all tables: auth.uid() = user_id
- finance_exchange_rates is global (no user_id) — authenticated read, service_role write
- All monetary values stored as integers (cents), never floats
- Multi-currency: NZD base, AUD and USD secondary
- Frequency-to-monthly multipliers: daily×30, weekly×(52/12), fortnightly×(26/12), monthly×1, quarterly÷3, annual÷12

## Design System: "Desert Mystic"
Custom CSS variables defined in globals.css. Use Tailwind desert-* classes:
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

## Project Structure
src/app/
├── page.tsx (bento dashboard)
├── layout.tsx (sidebar + dark theme)
├── globals.css (design system variables)
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
    └── review-summary/route.ts
src/components/ (Sidebar, SignOutButton)
src/lib/ (supabase.ts, supabase-server.ts)
src/lib/ai/ (context-builders.ts)

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
- Exchange rate pairs stored as e.g. "NZDAUD" (no slash) with rate as real
- kb_notes types: note, ai_response, research
- chat_messages capabilities: focus, review, spending, journal, general

## What's Built
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
- Settings (profile, integration placeholders, exchange rates, data export placeholder)
- Desert Mystic design system (D1-D6 applied)

## What's NOT Built Yet

### Phase 6 — Integrations
- Apple Health: webhook at /api/integrations/health, receives HRV/sleep/weight via iOS Shortcut, protected by x-api-key header
- Cronometer: CSV upload at /api/import/cronometer, stores in raw_imports
- myBOQ: OFX upload at /api/import/ofx, parses to finance_transactions
- Binance: API sync at /api/sync/binance, HMAC-SHA256 auth, updates crypto account balances, Vercel cron daily 8am
- iCal: feed sync at /api/sync/ical, parses .ics into calendar_events

### Phase 7 — PWA + Offline
- Dexie.js (IndexedDB) local database mirroring key tables
- Sync queue for offline writes, auto-replay on reconnect
- Service worker via next-pwa, manifest.json
- SyncStatus component in sidebar (green/amber/red dot)

## AI Chat System Prompt
"You are Jakob's personal Life OS assistant. You have access to his live data.
Be concise, direct, and practical. Use plain text unless markdown genuinely helps.
Jakob is based in Hamilton, New Zealand. Currency is NZD."

## Current Priority
Phase 6 integrations (Apple Health, Cronometer, myBOQ, Binance, iCal),
then Phase 7 PWA + offline sync.
