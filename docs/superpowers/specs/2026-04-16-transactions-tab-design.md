---
title: Transactions Tab — Finance Module
date: 2026-04-16
status: approved
---

# Transactions Tab Design

## Overview

Add a 4th tab ("Transactions") to the Finances page alongside Accounts, Cashflow, and Tax & Flags. Provides monthly spend analytics, auto-categorised transaction list, and drill-down from summary to individual transactions.

## Layout

Summary top, list bottom. Three sections stacked vertically.

### Header

- Month selector: chevron arrows + month/year label (e.g., "Apr 2026")
- Currency toggle on the right: NZD (default), AUD, USD
- Toggle affects monthly totals only — individual transactions always show in their original currency

### Section 1 — Monthly Spend Chart

- Horizontal bar chart showing total spend for the last 6 months
- Current month highlighted with `bg-desert-accent`
- Clicking a bar navigates to that month
- Bars scaled relative to the highest month in the range

### Section 2 — Category Breakdown

- Row of category cards for the selected month
- Each card shows: category name, total spend (in selected toggle currency), transaction count
- Clicking a card filters the transaction list below to that category
- Active filter shown with accent border, clearable

### Section 3 — Transaction List

- Scrollable list for the selected month (filtered by category if active)
- Each row: date, description, category pill, amount in original currency
- Income transactions in `text-desert-success`, expenses in default text
- Sorted by date descending
- Clicking a category pill opens a dropdown to reassign the category — persists to `finance_transactions.category` in the DB
- Empty state: "No transactions for this month"

## Auto-Categorisation

Keyword-to-category map applied at display time. Stored categories in the DB take precedence (user overrides). Map defined as a constant in the component:

| Category | Keywords |
|---|---|
| Shopping | TRADEME, WAREHOUSE, AMAZON, EBAY, IMAGELAND |
| Subscriptions | APPLE.COM, GOOGLE, SPOTIFY, NETFLIX, MONTHLY FEE |
| Food & Drink | COUNTDOWN, PAK N SAVE, NEW WORLD, UBER EATS, MCDONALD |
| Transport | METRO, PARKING, BP, Z ENERGY, UBER |
| Health | MEDICAL, PHARMACY, CHEMIST |
| Entertainment | HOYTS, CINEMA |
| Fees & Interest | INTEREST CHARGES, FEE, LEVY |
| Uncategorised | everything else |

Case-insensitive substring match on the transaction description.

## Currency Handling

- Transactions displayed in their original stored currency (AUD for CommBank, NZD for Akahu)
- Each transaction has a `rate_nzdaud` column — the actual AUD/NZD exchange rate on that transaction's date
- Monthly totals converted to the selected toggle currency using per-transaction historical rates
- Akahu transactions (NZD): `rate_nzdaud` is the rate on that date (for converting totals when AUD is selected)
- CommBank transactions (AUD): `rate_nzdaud` used to convert to NZD for totals

### Conversion logic

- To NZD: `amount_aud / rate_nzdaud` (since rate is "1 NZD = X AUD")
- To AUD: `amount_nzd * rate_nzdaud`
- To USD: convert to NZD first using `rate_nzdaud`, then multiply by the current NZDUSD rate from `finance_exchange_rates`. USD toggle is approximate for historical transactions (uses current NZD/USD rate, not historical) — acceptable since USD view is secondary.

## Data Changes

### New column

Add `rate_nzdaud` (real, nullable) to `finance_transactions`. Stores the AUD/NZD exchange rate on the transaction date.

### Backfill

One-off script to backfill `rate_nzdaud` for existing ~1,200 transactions:

1. Collect unique transaction dates
2. Fetch historical NZDAUD rate for each date from frankfurter.app API
3. Update all transactions for each date in a single query

### Import changes

- OFX import (`/api/import/ofx`): fetch current NZDAUD rate from `finance_exchange_rates` table and write to `rate_nzdaud` on each transaction
- Akahu sync (`/api/sync/akahu`): same — read current rate, write to each transaction

## Batch OFX Upload

Enhance the Settings "Bank OFX" uploader to accept multiple files:

- Change file input to accept `multiple`
- Process files sequentially, calling `/api/import/ofx` for each
- Show aggregated result: total imported, total skipped, total value across all files
- Progress indicator while processing (e.g., "Importing file 2 of 5...")

## Component Structure

- `TransactionsTab.tsx` in `src/app/finances/components/`
- Receives transactions, exchange rates, and userId as props from `page.tsx`
- Page fetches `finance_transactions` alongside existing data queries
- Category keyword map and auto-categorisation logic are internal to the component

## Design System

Follows existing Desert Mystic patterns:
- Cards: `bg-desert-surface border border-desert-border rounded-sm`
- Category pills: `bg-desert-bg border border-desert-border rounded-sm px-2 py-0.5 text-xs font-mono`
- Amounts: `font-mono`
- Income: `text-desert-success`
- Bar chart bars: `bg-desert-accent` for current month, `bg-desert-border-strong` for others
- Active category filter: `border-desert-accent`
