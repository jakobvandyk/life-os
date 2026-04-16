# Transactions Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Transactions tab to the Finances page with monthly spend analytics, auto-categorised transaction list, per-transaction historical exchange rates, and batch OFX upload.

**Architecture:** New `TransactionsTab` component receives transactions and rates as props from `page.tsx`. A `rate_nzdaud` column on `finance_transactions` stores the historical exchange rate for each transaction's date. A one-off backfill script populates rates for existing transactions. The OFX and Akahu importers write the current rate on each new transaction. Settings page gets multi-file OFX upload.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Tailwind CSS v4 (Desert Mystic theme)

---

### Task 1: Add rate_nzdaud column and backfill historical rates

**Files:**
- Create: `scripts/backfill-rates.js`
- No migration files — column added via Supabase dashboard or script

- [ ] **Step 1: Add the column to Supabase**

Run this via the Supabase SQL editor (Dashboard > SQL Editor):

```sql
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS rate_nzdaud real;
```

- [ ] **Step 2: Write the backfill script**

Create `scripts/backfill-rates.js`:

```js
#!/usr/bin/env node
// Backfill rate_nzdaud for all existing finance_transactions.
// Fetches historical NZDAUD rate per unique date from frankfurter.app.

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env.local");
const envFile = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Get all unique dates that need rates
  const { data: txns } = await sb
    .from("finance_transactions")
    .select("date")
    .is("rate_nzdaud", null);

  if (!txns || txns.length === 0) {
    console.log("No transactions need backfilling.");
    return;
  }

  const uniqueDates = [...new Set(txns.map((t) => t.date))].sort();
  console.log(`Backfilling ${uniqueDates.length} unique dates for ${txns.length} transactions...\n`);

  const rateCache = new Map();

  for (const date of uniqueDates) {
    // frankfurter doesn't serve future or today — use latest for recent dates
    let rate;
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=NZD&symbols=AUD`);
      if (res.ok) {
        const data = await res.json();
        rate = data.rates.AUD;
      }
    } catch {}

    if (!rate) {
      // Fallback: use nearest cached rate or current
      const cached = [...rateCache.values()];
      rate = cached.length > 0 ? cached[cached.length - 1] : 0.83;
    }

    rateCache.set(date, rate);

    const { error } = await sb
      .from("finance_transactions")
      .update({ rate_nzdaud: rate })
      .eq("date", date)
      .is("rate_nzdaud", null);

    if (error) {
      console.log(`  ${date}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${date}: NZDAUD=${rate.toFixed(4)}`);
    }

    // Rate limit: ~1 req/sec to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✓ Backfilled ${uniqueDates.length} dates`);
}

main().catch(console.error);
```

- [ ] **Step 3: Run the backfill**

Run: `node scripts/backfill-rates.js`
Expected: Each unique date gets a rate printed, ~200 dates over ~1 minute.

- [ ] **Step 4: Verify backfill**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim(); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('finance_transactions').select('*', { count: 'exact', head: true }).is('rate_nzdaud', null)
  .then(({count}) => console.log('Transactions without rate:', count));
"
```

Expected: `Transactions without rate: 0`

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-rates.js
git commit -m "Add rate_nzdaud column and backfill script for historical exchange rates"
```

---

### Task 2: Write rate_nzdaud on OFX import and Akahu sync

**Files:**
- Modify: `src/app/api/import/ofx/route.ts`
- Modify: `src/app/api/sync/akahu/route.ts`

- [ ] **Step 1: Update OFX import to write rate_nzdaud**

In `src/app/api/import/ofx/route.ts`, after the `importSource` and `currency` are determined (around line 95), fetch the current rate:

```typescript
  // Fetch current NZDAUD rate for transaction records
  const { data: nzdaudRate } = await supabase
    .from("finance_exchange_rates")
    .select("rate")
    .eq("pair", "NZDAUD")
    .single();
  const rateNzdaud = nzdaudRate?.rate || 0.83;
```

Then in the row-building loop, add `rate_nzdaud` to each row object (inside the `rows.push({...})` call):

Add `rate_nzdaud: rateNzdaud,` after `external_id: externalId,`.

- [ ] **Step 2: Update Akahu sync to write rate_nzdaud**

In `src/app/api/sync/akahu/route.ts`, after the `db` client is created (around line 63), fetch the current rate:

```typescript
  // Fetch current NZDAUD rate for transaction records
  const { data: nzdaudRate } = await db
    .from("finance_exchange_rates")
    .select("rate")
    .eq("pair", "NZDAUD")
    .single();
  const rateNzdaud = nzdaudRate?.rate || 0.83;
```

Then in the transaction upsert (around line 147), add `rate_nzdaud: rateNzdaud,` to the upsert object.

- [ ] **Step 3: Build and verify**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/import/ofx/route.ts src/app/api/sync/akahu/route.ts
git commit -m "Write rate_nzdaud on OFX import and Akahu sync"
```

---

### Task 3: Build the TransactionsTab component

**Files:**
- Create: `src/app/finances/components/TransactionsTab.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/finances/components/TransactionsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";

interface Transaction {
  id: number;
  date: string;
  amount: number;
  currency: string;
  description: string;
  type: string;
  category: string | null;
  import_source: string;
  rate_nzdaud: number | null;
}

interface ExchangeRate {
  pair: string;
  rate: number;
}

const CUR: Record<string, string> = { AUD: "A$", NZD: "NZ$", USD: "US$" };

function fmt(cents: number, c = "NZD") {
  const s = CUR[c] || "$";
  return `${cents < 0 ? "-" : ""}${s}${(Math.abs(cents) / 100).toLocaleString(
    "en-NZ",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  )}`;
}

const CATEGORY_MAP: [string, string[]][] = [
  ["Shopping", ["TRADEME", "WAREHOUSE", "AMAZON", "EBAY", "IMAGELAND", "SHEIN", "ALIEXPRESS"]],
  ["Subscriptions", ["APPLE.COM", "GOOGLE", "SPOTIFY", "NETFLIX", "MONTHLY FEE", "YOUTUBE", "DISNEY"]],
  ["Food & Drink", ["COUNTDOWN", "PAK N SAVE", "NEW WORLD", "UBER EATS", "MCDONALD", "KFC", "SUBWAY", "DOMINO"]],
  ["Transport", ["METRO", "PARKING", "BP ", "Z ENERGY", "UBER", "TAXI", "FUEL"]],
  ["Health", ["MEDICAL", "PHARMACY", "CHEMIST", "DOCTOR", "DENTAL"]],
  ["Entertainment", ["HOYTS", "CINEMA", "TICKETEK", "EVENT"]],
  ["Fees & Interest", ["INTEREST CHARGES", "INTEREST CHARGE", "FEE", "LEVY"]],
];

function autoCategory(description: string): string {
  const upper = description.toUpperCase();
  for (const [cat, keywords] of CATEGORY_MAP) {
    if (keywords.some((kw) => upper.includes(kw))) return cat;
  }
  return "Uncategorised";
}

function getCategory(txn: Transaction): string {
  return txn.category || autoCategory(txn.description);
}

function convertToDisplay(amountCents: number, fromCurrency: string, toCurrency: string, rateNzdaud: number | null, rates: ExchangeRate[]): number {
  if (fromCurrency === toCurrency) return amountCents;
  const rate = rateNzdaud || 0.83;

  // Convert to NZD first
  let nzd = amountCents;
  if (fromCurrency === "AUD") nzd = amountCents / rate;
  if (fromCurrency === "USD") {
    const nzdusd = rates.find((r) => r.pair === "NZDUSD")?.rate || 0.59;
    nzd = amountCents / nzdusd;
  }

  if (toCurrency === "NZD") return nzd;
  if (toCurrency === "AUD") return nzd * rate;
  if (toCurrency === "USD") {
    const nzdusd = rates.find((r) => r.pair === "NZDUSD")?.rate || 0.59;
    return nzd * nzdusd;
  }
  return amountCents;
}

function getMonthKey(date: string): string {
  return date.slice(0, 7); // "2026-04"
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function shiftMonth(key: string, delta: number): string {
  const d = new Date(parseInt(key.slice(0, 4)), parseInt(key.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TransactionsTab({
  transactions,
  rates,
  userId,
  onRefresh,
}: {
  transactions: Transaction[];
  rates: ExchangeRate[];
  userId: string | null;
  onRefresh: () => void;
}) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [displayCurrency, setDisplayCurrency] = useState<string>("NZD");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Group transactions by month
  const monthTxns = transactions.filter((t) => getMonthKey(t.date) === selectedMonth);
  const expenseTxns = monthTxns.filter((t) => t.type === "expense");

  // Last 6 months for bar chart
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(currentMonth, -i));

  const monthlyTotals = months.map((m) => {
    const txns = transactions.filter((t) => getMonthKey(t.date) === m && t.type === "expense");
    const total = txns.reduce(
      (sum, t) => sum + Math.abs(convertToDisplay(t.amount, t.currency, displayCurrency, t.rate_nzdaud, rates)),
      0
    );
    return { month: m, total };
  });

  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);

  // Category breakdown for selected month
  const categoryTotals = new Map<string, { total: number; count: number }>();
  expenseTxns.forEach((t) => {
    const cat = getCategory(t);
    const converted = Math.abs(convertToDisplay(t.amount, t.currency, displayCurrency, t.rate_nzdaud, rates));
    const existing = categoryTotals.get(cat) || { total: 0, count: 0 };
    categoryTotals.set(cat, { total: existing.total + converted, count: existing.count + 1 });
  });
  const sortedCategories = [...categoryTotals.entries()].sort((a, b) => b[1].total - a[1].total);

  // Filtered transaction list
  const filteredTxns = categoryFilter
    ? monthTxns.filter((t) => getCategory(t) === categoryFilter)
    : monthTxns;
  const sortedTxns = [...filteredTxns].sort((a, b) => b.date.localeCompare(a.date));

  // Monthly totals for summary
  const monthIncome = monthTxns
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Math.abs(convertToDisplay(t.amount, t.currency, displayCurrency, t.rate_nzdaud, rates)), 0);
  const monthExpense = expenseTxns.reduce(
    (s, t) => s + Math.abs(convertToDisplay(t.amount, t.currency, displayCurrency, t.rate_nzdaud, rates)),
    0
  );

  const updateCategory = async (txnId: number, category: string) => {
    const { error } = await supabase
      .from("finance_transactions")
      .update({ category })
      .eq("id", txnId);
    if (error) queueWrite("finance_transactions", "update", { id: txnId, category });
    setEditingId(null);
    onRefresh();
  };

  const allCategories = CATEGORY_MAP.map(([name]) => name).concat(["Uncategorised"]);

  return (
    <div className="space-y-6">
      {/* Header: Month selector + Currency toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="text-desert-text-3 hover:text-desert-text transition-colors"
          >
            ◀
          </button>
          <span className="font-mono text-sm text-desert-text font-medium w-24 text-center">
            {formatMonth(selectedMonth)}
          </span>
          <button
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="text-desert-text-3 hover:text-desert-text transition-colors"
          >
            ▶
          </button>
        </div>
        <div className="flex gap-1">
          {["NZD", "AUD", "USD"].map((c) => (
            <button
              key={c}
              onClick={() => setDisplayCurrency(c)}
              className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors ${
                displayCurrency === c
                  ? "bg-desert-accent text-desert-bg"
                  : "text-desert-text-3 hover:text-desert-text-2"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly Spend Chart (6 months) */}
      <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-desert-text-2 mb-3">Monthly Spend</h3>
        <div className="space-y-2">
          {monthlyTotals.map(({ month, total }) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className="w-full flex items-center gap-3 group"
            >
              <span className="font-mono text-[10px] text-desert-text-3 w-16 text-right shrink-0">
                {formatMonth(month).slice(0, 3)}
              </span>
              <div className="flex-1 h-5 bg-desert-bg rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all ${
                    month === selectedMonth ? "bg-desert-accent" : "bg-desert-border-strong group-hover:bg-desert-text-3"
                  }`}
                  style={{ width: `${Math.max((total / maxMonthly) * 100, 1)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-desert-text-2 w-20 text-right shrink-0">
                {fmt(Math.round(total), displayCurrency)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      {sortedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm bg-desert-danger/20 text-desert-danger border border-desert-danger/30"
            >
              ✕ Clear
            </button>
          )}
          {sortedCategories.map(([cat, { total, count }]) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`px-3 py-1.5 text-xs font-mono rounded-sm border transition-colors ${
                categoryFilter === cat
                  ? "border-desert-accent bg-desert-accent/10 text-desert-accent"
                  : "border-desert-border bg-desert-surface text-desert-text-2 hover:border-desert-border-strong"
              }`}
            >
              {cat} · {fmt(Math.round(total), displayCurrency)} · {count}
            </button>
          ))}
        </div>
      )}

      {/* Summary Row */}
      <div className="flex gap-4 text-xs font-mono text-desert-text-3">
        <span>{monthTxns.length} transactions</span>
        <span>Income: <span className="text-desert-success">{fmt(Math.round(monthIncome), displayCurrency)}</span></span>
        <span>Spend: <span className="text-desert-text">{fmt(Math.round(monthExpense), displayCurrency)}</span></span>
      </div>

      {/* Transaction List */}
      <div className="space-y-1">
        {sortedTxns.length === 0 ? (
          <p className="text-desert-text-3 text-sm text-center py-8">No transactions for this month</p>
        ) : (
          sortedTxns.map((txn) => {
            const cat = getCategory(txn);
            return (
              <div
                key={txn.id}
                className="flex items-center gap-3 py-2 px-3 bg-desert-surface border border-desert-border rounded-sm hover:border-desert-border-strong transition-colors"
              >
                <span className="font-mono text-[10px] text-desert-text-3 w-14 shrink-0">
                  {new Date(txn.date + "T00:00").toLocaleDateString("en-NZ", { day: "2-digit", month: "short" })}
                </span>
                <span className="text-sm text-desert-text truncate flex-1" title={txn.description}>
                  {txn.description}
                </span>
                {editingId === txn.id ? (
                  <select
                    autoFocus
                    value={cat}
                    onChange={(e) => updateCategory(txn.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    className="bg-desert-bg border border-desert-border-strong rounded-sm text-[10px] font-mono px-1 py-0.5 text-desert-text"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingId(txn.id)}
                    className="px-2 py-0.5 text-[10px] font-mono rounded-sm bg-desert-bg border border-desert-border text-desert-text-3 hover:border-desert-border-strong hover:text-desert-text-2 transition-colors shrink-0"
                  >
                    {cat}
                  </button>
                )}
                <span
                  className={`font-mono text-sm w-24 text-right shrink-0 ${
                    txn.type === "income" ? "text-desert-success" : "text-desert-text"
                  }`}
                >
                  {fmt(txn.amount, txn.currency)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

Run: `npx next build`
Expected: Build succeeds (component isn't wired up yet, but should compile).

- [ ] **Step 3: Commit**

```bash
git add src/app/finances/components/TransactionsTab.tsx
git commit -m "Add TransactionsTab component with monthly chart, categories, and drill-down"
```

---

### Task 4: Wire TransactionsTab into the Finances page

**Files:**
- Modify: `src/app/finances/page.tsx`

- [ ] **Step 1: Add Transaction interface and import**

At the top of `page.tsx`, add the import after the existing component imports:

```typescript
import TransactionsTab from "./components/TransactionsTab";
```

Add a Transaction interface after the existing TaxFlag interface (around line 29):

```typescript
interface Transaction {
  id: number; date: string; amount: number; currency: string;
  description: string; type: string; category: string | null;
  import_source: string; rate_nzdaud: number | null; user_id: string;
}
```

- [ ] **Step 2: Add transactions to state and data fetching**

Update the `Tab` type (line 125):

```typescript
type Tab = "accounts" | "cashflow" | "tax" | "transactions";
```

Add `transactions: Transaction[]` to the `FinanceData` interface.

In `fetchData`, add to the `Promise.all` array:

```typescript
supabase.from("finance_transactions").select("*").eq("user_id", userId).order("date", { ascending: false }),
```

And in the destructured result, add `{ data: transactionsData }`.

Set `transactions: transactionsData || []` in the `setData` call.

- [ ] **Step 3: Add the tab button and content**

In the tabs array (around line 258), add:

```typescript
{ key: "transactions", label: "Transactions" },
```

After the tax tab content block (around line 300), add:

```tsx
{tab === "transactions" && (
  <TransactionsTab
    transactions={data.transactions}
    rates={data.rates}
    userId={userId}
    onRefresh={fetchData}
  />
)}
```

- [ ] **Step 4: Build and verify**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/finances/page.tsx
git commit -m "Wire TransactionsTab into Finances page as 4th tab"
```

---

### Task 5: Batch OFX upload in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Update the OFX file input and handler**

Replace the OFX upload section (the `<input>` and `<button>` around lines 428-444) with multi-file support:

Change the `<input>` to accept multiple files:

```tsx
<input
  ref={ofxRef}
  type="file"
  accept=".ofx,.qfx"
  multiple
  className="hidden"
  onChange={async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSyncing("OFX");
    setUploadResult(null);
    let totalImported = 0;
    let totalSkipped = 0;
    let totalValue = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadResult(`Importing file ${i + 1} of ${files.length}...`);
      const formData = new FormData();
      formData.append("file", files[i]);
      try {
        const res = await fetch("/api/import/ofx", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) {
          totalImported += data.imported || 0;
          totalSkipped += data.skipped || 0;
          totalValue += parseFloat(data.total_value || "0");
        }
      } catch {}
    }
    setUploadResult(
      `OFX: ${totalImported} imported, ${totalSkipped} skipped, $${totalValue.toFixed(2)}`
    );
    setSyncing(null);
    // Refresh sync logs
    const { data: freshLogs } = await supabase
      .from("integration_syncs")
      .select("*")
      .order("synced_at", { ascending: false })
      .limit(20);
    if (freshLogs) setSyncLogs(freshLogs);
    if (ofxRef.current) ofxRef.current.value = "";
  }}
/>
```

Keep the button the same but update the label:

```tsx
{syncing === "OFX" ? "..." : "Upload OFX"}
```

- [ ] **Step 2: Build and verify**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "Support batch OFX upload: select multiple files, process sequentially"
```

---

### Task 6: Deploy and verify

**Files:** None (deployment only)

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Deploy to production**

```bash
npx vercel --prod
```

Expected: Build succeeds, deployment READY.

- [ ] **Step 3: Verify in browser**

Open the Finances page, click the "Transactions" tab. Verify:
- Month selector works (chevron navigation)
- Currency toggle switches between NZD/AUD/USD
- Monthly spend bars show data for last 6 months
- Category pills appear with totals
- Clicking a category filters the list
- Transaction list shows date, description, category, amount
- Clicking a category pill on a transaction opens the reassign dropdown

- [ ] **Step 4: Test batch OFX upload**

Open Settings, scroll to Bank OFX. Select multiple .ofx files. Verify:
- Progress shows "Importing file X of Y"
- Final result shows aggregated imported/skipped/value

- [ ] **Step 5: Update CLAUDE.md**

Add to the recent additions section and update the project structure.
