# Life OS

A personal dashboard that pulls health, training, finance and planning data into one place. Devices and banks feed it automatically, it works offline as a PWA, and an AI layer answers questions against the live data.

Single-user by design. It runs my own life and is public as a code sample, not as a product. There is no hosted demo and the data is mine, so a clone gives you the schema and the pipelines, not the contents.

Built from late March 2026 and in daily use since. Developed with Claude Code as a pair programmer, which the commit trailers show. The product decisions, data rules, design system and integration choices are mine; the assistant wrote much of the code against specs and plans that live in `docs/superpowers/`.

## What it does

Twelve pages grouped as Life (tasks, habits, calendar), Track (workouts, finances, knowledge base), Reflect (journal, goals, weekly review) and System (chat, settings), with a bento dashboard on top. The CRUD is ordinary. The ingestion is where the work went.

Health and training come from Apple Health through an iOS Shortcut that posts to a webhook each morning (HRV, sleep, weight, readiness, steps, VO2 max, with Garmin recovery mapped in through Shortcuts), from a streaming client-side parser for Apple Health export files over 200 MB for backfill, from Cronometer CSV exports in both their nutrition and biometrics layouts, auto-detected, and from Kubios HRV readings off a Polar H10.

Money comes from Akahu, the NZ open-banking API, on a daily cron for accounts, balances and categorised transactions; from OFX exports for Australian banks, both the SGML v1 and XML v2 flavours; and from a read-only Binance key, run locally under launchd because Binance blocks Vercel's egress. Exchange rates refresh from the ECB feed on each sync.

Calendar feeds merge through iCal. A Telegram bot pairs to the account and handles habit completion, mood and energy logging and snoozing through commands and inline keyboards. The notification engine dispatches to web push, Telegram and in-app across ten rule types, with timezone, quiet hours, deduplication and snooze re-firing.

The AI side is a chat over the live data with five capability modes, an auto-drafted weekly review summary, and a JSON export of all 22 data tables for analysis outside the app, with an import path that files the resulting insight back into the knowledge base.

Three data rules hold it together. Source authority runs device or API first, then structured import, then manual entry, and a manual value always wins as an override. Imports use selective merge upserts so a later import can never null a value a device wrote. Money is stored as integer cents in NZD with AUD and USD alongside.

Offline, a Dexie mirror of the core tables serves reads, writes go to a queue that replays on reconnect (upsert for tables with unique constraints), and a sidebar indicator shows queue state with retry and clear.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Supabase for Postgres and auth, with row-level security on every table. Vercel for hosting and cron. Dexie.js, web-push, ical.js, ofx-js and the Anthropic SDK.

One architectural choice shapes the codebase: the UI talks to Supabase directly from the client under RLS, and API routes exist only for the AI endpoints, webhooks, imports and crons. Each of those carries its own auth, a session check, a bearer cron secret or a per-integration key. The login redirect lives in `src/proxy.ts`.

## Design

The theme is called Desert Mystic: dark leather and sandstone palette, IBM Plex Mono headings, and a light variant tuned as desert at midday rather than white. Icons are hand-drawn 9 by 9 pixel-art SVGs, sixty-odd of them, rendered in currentColor. Each page has a code-generated 120 by 40 pixel scene behind it at low opacity. No component library.

## Running it

You need a Supabase project and the environment variables listed in `CLAUDE.md`. Then:

```
npm install
npm run dev
```

The table list is in `CLAUDE.md`; only three incremental migrations are in `supabase/migrations/`, so the base schema has to be created by hand for now.

## Docs

`CLAUDE.md` is the full architecture and integration reference. It was written for AI-assisted development and doubles as the project handbook. `DATA-INVENTORY.md` maps every data point to its source device and ingestion path, and `DATA-STRATEGY.md` holds the authority rules, the daily workflow and the iOS Shortcut specification.
