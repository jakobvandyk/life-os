"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Income {
  id: number;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  is_passive: number;
  notes: string;
  user_id: string;
}

interface Expense {
  id: number;
  category: string;
  amount: number;
  currency: string;
  frequency: string;
  is_variable: number;
  notes: string;
  user_id: string;
}

interface Liability {
  id: number;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  due_day: number;
  category: string;
  notes: string;
  user_id: string;
}

interface Metrics {
  monthlyIncomeAud: number;
  monthlyExpensesAud: number;
  monthlySurplusAud: number;
  savingsRate: number;
}

const CUR: Record<string, string> = { AUD: "A$", NZD: "NZ$", USD: "US$" };

function fmt(cents: number, c = "AUD") {
  const s = CUR[c] || "$";
  return `${cents < 0 ? "-" : ""}${s}${(Math.abs(cents) / 100).toLocaleString(
    "en-AU",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  )}`;
}

function freqLabel(f: string) {
  const m: Record<string, string> = {
    daily: "/day", weekly: "/wk", fortnightly: "/fn",
    monthly: "/mo", quarterly: "/qtr", annual: "/yr",
  };
  return m[f] || "";
}

function daysUntil(dueDay: number): number {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (thisMonth > now) {
    return Math.ceil((thisMonth.getTime() - now.getTime()) / 86400000);
  }
  const next = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  return Math.ceil((next.getTime() - now.getTime()) / 86400000);
}

const inputClass =
  "w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";
const selectClass =
  "bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";

export default function CashflowTab({
  income,
  expenses,
  liabilities,
  metrics,
  onRefresh,
  userId,
}: {
  income: Income[];
  expenses: Expense[];
  liabilities: Liability[];
  metrics: Metrics;
  onRefresh: () => void;
  userId: string | null;
}) {
  const [form, setForm] = useState<string | null>(null);

  const [incomeForm, setIncomeForm] = useState({
    name: "", amount: "", currency: "AUD", frequency: "monthly",
    is_passive: false, notes: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    category: "", amount: "", currency: "AUD", frequency: "monthly", notes: "",
  });
  const [liabilityForm, setLiabilityForm] = useState({
    name: "", amount: "", currency: "AUD", frequency: "monthly",
    due_day: "1", category: "other", notes: "",
  });

  const addIncome = async () => {
    if (!userId) return;
    if (!incomeForm.name.trim() || !incomeForm.amount) return;
    const { error } = await supabase.from("finance_income").insert({
      ...incomeForm,
      amount: Math.round(parseFloat(incomeForm.amount) * 100),
      user_id: userId,
    });
    if (error) console.error("Error adding income:", error);
    setIncomeForm({ name: "", amount: "", currency: "AUD", frequency: "monthly", is_passive: false, notes: "" });
    setForm(null);
    onRefresh();
  };

  const addExpense = async () => {
    if (!userId) return;
    if (!expenseForm.category.trim() || !expenseForm.amount) return;
    const { error } = await supabase.from("finance_expenses").insert({
      ...expenseForm,
      amount: Math.round(parseFloat(expenseForm.amount) * 100),
      user_id: userId,
    });
    if (error) console.error("Error adding expense:", error);
    setExpenseForm({ category: "", amount: "", currency: "AUD", frequency: "monthly", notes: "" });
    setForm(null);
    onRefresh();
  };

  const addLiability = async () => {
    if (!userId) return;
    if (!liabilityForm.name.trim() || !liabilityForm.amount) return;
    const { error } = await supabase.from("finance_liabilities").insert({
      ...liabilityForm,
      amount: Math.round(parseFloat(liabilityForm.amount) * 100),
      due_day: parseInt(liabilityForm.due_day),
      user_id: userId,
    });
    if (error) console.error("Error adding liability:", error);
    setLiabilityForm({ name: "", amount: "", currency: "AUD", frequency: "monthly", due_day: "1", category: "other", notes: "" });
    setForm(null);
    onRefresh();
  };

  const deleteItem = async (table: string, id: number) => {
    if (!userId) return;
    const { error } = await supabase.from(`finance_${table}`).delete().eq("id", id).eq("user_id", userId);
    if (error) console.error(`Error deleting ${table}:`, error);
    onRefresh();
  };

  return (
    <div className="space-y-8">
      {/* P&L Summary */}
      <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
        <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text mb-3">Monthly P&L</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-desert-text-3">Income</p>
            <p className="text-lg font-bold font-mono text-desert-success">{fmt(metrics.monthlyIncomeAud)}</p>
          </div>
          <div>
            <p className="text-sm text-desert-text-3">Expenses</p>
            <p className="text-lg font-bold font-mono text-desert-danger">{fmt(metrics.monthlyExpensesAud)}</p>
          </div>
          <div>
            <p className="text-sm text-desert-text-3">Surplus</p>
            <p className={`text-lg font-bold font-mono ${metrics.monthlySurplusAud >= 0 ? "text-desert-success" : "text-desert-danger"}`}>
              {fmt(metrics.monthlySurplusAud)}
            </p>
          </div>
          <div>
            <p className="text-sm text-desert-text-3">Savings Rate</p>
            <p className={`text-lg font-bold font-mono ${metrics.savingsRate >= 20 ? "text-desert-success" : "text-desert-accent"}`}>
              {metrics.savingsRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* ═══ INCOME ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">Income Sources</h2>
          <button
            onClick={() => setForm(form === "income" ? null : "income")}
            className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150"
          >
            + Add Income
          </button>
        </div>

        {form === "income" && (
          <div className="bg-desert-surface rounded-sm p-5 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Source name (e.g. UoA Salary)" value={incomeForm.name}
                onChange={(e) => setIncomeForm({...incomeForm, name: e.target.value })} className={inputClass} autoFocus />
              <input type="number" step="0.01" placeholder="Amount (e.g. 4868.00)" value={incomeForm.amount}
                onChange={(e) => setIncomeForm({...incomeForm, amount: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-3 items-center">
              <select value={incomeForm.currency} onChange={(e) => setIncomeForm({...incomeForm, currency: e.target.value })} className={selectClass}>
                <option value="AUD">AUD</option><option value="NZD">NZD</option><option value="USD">USD</option>
              </select>
              <select value={incomeForm.frequency} onChange={(e) => setIncomeForm({...incomeForm, frequency: e.target.value })} className={selectClass}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-desert-text-3 cursor-pointer">
                <input type="checkbox" checked={incomeForm.is_passive}
                  onChange={(e) => setIncomeForm({...incomeForm, is_passive: e.target.checked })} className="rounded bg-desert-bg border border-desert-border" />
                Passive
              </label>
              <div className="flex-1" />
              <button onClick={addIncome} className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {income.length === 0 ? (
          <p className="text-desert-text-3 text-sm bg-desert-surface rounded-sm p-8 text-center">No income sources yet.</p>
        ) : (
          <div className="space-y-2">
            {income.map((i) => (
              <div key={i.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center gap-4 group hover:border-desert-border-strong transition-colors duration-150">
                <div className="flex-1">
                  <p className="font-mono font-medium text-sm text-desert-text">
                    {i.name}
                    {i.is_passive ? <span className="text-xs text-desert-mystic ml-2">passive</span> : ""}
                  </p>
                  {i.notes && <p className="text-xs text-desert-text-3">{i.notes}</p>}
                </div>
                <p className="text-lg font-bold font-mono text-desert-success">
                  {fmt(i.amount, i.currency)}
                  <span className="text-xs text-desert-text-3 ml-1">{freqLabel(i.frequency)}</span>
                </p>
                <button onClick={() => deleteItem("income", i.id)}
                  className="text-desert-text-3 hover:text-desert-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ EXPENSES ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">Expenses</h2>
          <button onClick={() => setForm(form === "expense" ? null : "expense")}
            className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150">+ Add Expense</button>
        </div>

        {form === "expense" && (
          <div className="bg-desert-surface rounded-sm p-5 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Category (e.g. Rent, Food)" value={expenseForm.category}
                onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value })} className={inputClass} autoFocus />
              <input type="number" step="0.01" placeholder="Amount (e.g. 250.00)" value={expenseForm.amount}
                onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-3 items-center">
              <select value={expenseForm.currency} onChange={(e) => setExpenseForm({...expenseForm, currency: e.target.value })} className={selectClass}>
                <option value="AUD">AUD</option><option value="NZD">NZD</option><option value="USD">USD</option>
              </select>
              <select value={expenseForm.frequency} onChange={(e) => setExpenseForm({...expenseForm, frequency: e.target.value })} className={selectClass}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
              </select>
              <div className="flex-1" />
              <button onClick={addExpense} className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-desert-text-3 text-sm bg-desert-surface rounded-sm p-8 text-center">No expenses yet.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center gap-4 group hover:border-desert-border-strong transition-colors duration-150">
                <div className="flex-1">
                  <p className="font-mono font-medium text-sm text-desert-text">{e.category}</p>
                  {e.notes && <p className="text-xs text-desert-text-3">{e.notes}</p>}
                </div>
                                <p className="text-lg font-bold font-mono text-desert-danger">
                  {fmt(e.amount, e.currency)}
                  <span className="text-xs text-desert-text-3 ml-1">{freqLabel(e.frequency)}</span>
                </p>
                <button onClick={() => deleteItem("expense", e.id)}
                  className="text-desert-text-3 hover:text-desert-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ LIABILITIES ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">Liabilities</h2>
          <button onClick={() => setForm(form === "liability" ? null : "liability")}
            className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150">+ Add Liability</button>
        </div>

        {form === "liability" && (
          <div className="bg-desert-surface rounded-sm p-5 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Name (e.g. CommBank CC)" value={liabilityForm.name}
                onChange={(e) => setLiabilityForm({...liabilityForm, name: e.target.value })} className={inputClass} autoFocus />
              <input type="number" step="0.01" placeholder="Amount (e.g. 293.00)" value={liabilityForm.amount}
                onChange={(e) => setLiabilityForm({...liabilityForm, amount: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <select value={liabilityForm.currency} onChange={(e) => setLiabilityForm({...liabilityForm, currency: e.target.value })} className={selectClass}>
                <option value="AUD">AUD</option><option value="NZD">NZD</option><option value="USD">USD</option>
              </select>
              <select value={liabilityForm.frequency} onChange={(e) => setLiabilityForm({...liabilityForm, frequency: e.target.value })} className={selectClass}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-desert-text-3">Due day:</span>
                <input type="number" min="1" max="31" value={liabilityForm.due_day}
                  onChange={(e) => setLiabilityForm({...liabilityForm, due_day: e.target.value })}
                  className="w-16 bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent" />
              </div>
              <select value={liabilityForm.category} onChange={(e) => setLiabilityForm({...liabilityForm, category: e.target.value })} className={selectClass}>
                <option value="credit_card">Credit Card</option><option value="subscription">Subscription</option>
                <option value="insurance">Insurance</option><option value="loan">Loan</option><option value="other">Other</option>
              </select>
              <div className="flex-1" />
              <button onClick={addLiability} className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {liabilities.length === 0 ? (
          <p className="text-desert-text-3 text-sm bg-desert-surface rounded-sm p-8 text-center">No liabilities yet.</p>
        ) : (
          <div className="space-y-2">
            {liabilities.map((l) => {
              const days = daysUntil(l.due_day);
              return (
                <div key={l.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center gap-4 group hover:border-desert-border-strong transition-colors duration-150">
                  <div className="flex-1">
                    <p className="font-mono font-medium text-sm text-desert-text">{l.name}</p>
                    <p className="text-xs text-desert-text-3">
                      {l.category.replace(/_/g, " ")}
                      {l.notes ? ` · ${l.notes}` : ""}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                    days <= 3 ? "bg-desert-danger-dim text-desert-danger" : days <= 7 ? "bg-desert-warning-dim text-desert-warning" : "bg-desert-surface border border-desert-border text-desert-text-3"
                  }`}>
                    {days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `${days} days`}
                  </div>
                  <p className="text-lg font-bold font-mono text-desert-accent">
                    {fmt(l.amount, l.currency)}
                    <span className="text-xs text-desert-text-3 ml-1">{freqLabel(l.frequency)}</span>
                  </p>
                  <button onClick={() => deleteItem("liability", l.id)}
                    className="text-desert-text-3 hover:text-desert-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}