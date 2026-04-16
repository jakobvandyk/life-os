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
  ["Transfer", ["TRANSFER TO", "TRANSFER FROM", "COMMBANK APP", "PAYMENT RECEIVED"]],
  ["Travel", ["AIRLINE", "AIRLINES", "HOSTEL", "BACKPACKER", "SAFETYWING", "TRAVEL INSURANCE", "AMTRAK", "FIORDLAND"]],
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
