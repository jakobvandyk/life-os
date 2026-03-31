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
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500";
const selectClass =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500";

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
      <div className="bg-gray-900 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Monthly P&L</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Income</p>
            <p className="text-lg font-bold text-green-400">{fmt(metrics.monthlyIncomeAud)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expenses</p>
            <p className="text-lg font-bold text-red-400">{fmt(metrics.monthlyExpensesAud)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Surplus</p>
            <p className={`text-lg font-bold ${metrics.monthlySurplusAud >= 0 ? "text-green-400" : "text-red-400"}`}>
              {fmt(metrics.monthlySurplusAud)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Savings Rate</p>
            <p className={`text-lg font-bold ${metrics.savingsRate >= 20 ? "text-green-400" : "text-amber-400"}`}>
              {metrics.savingsRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* ═══ INCOME ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Income Sources</h2>
          <button
            onClick={() => setForm(form === "income" ? null : "income")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Income
          </button>
        </div>

        {form === "income" && (
          <div className="bg-gray-900 rounded-lg p-5 mb-4 space-y-3">
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
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={incomeForm.is_passive}
                  onChange={(e) => setIncomeForm({...incomeForm, is_passive: e.target.checked })} className="rounded bg-gray-800 border-gray-700" />
                Passive
              </label>
              <div className="flex-1" />
              <button onClick={addIncome} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {income.length === 0 ? (
          <p className="text-gray-600 text-sm bg-gray-900 rounded-lg p-8 text-center">No income sources yet.</p>
        ) : (
          <div className="space-y-2">
            {income.map((i) => (
              <div key={i.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 group hover:border-gray-700 transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {i.name}
                    {i.is_passive ? <span className="text-xs text-purple-400 ml-2">passive</span> : ""}
                  </p>
                  {i.notes && <p className="text-xs text-gray-500">{i.notes}</p>}
                </div>
                <p className="text-lg font-bold text-green-400">
                  {fmt(i.amount, i.currency)}
                  <span className="text-xs text-gray-500 ml-1">{freqLabel(i.frequency)}</span>
                </p>
                <button onClick={() => deleteItem("income", i.id)}
                  className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ EXPENSES ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Expenses</h2>
          <button onClick={() => setForm(form === "expense" ? null : "expense")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">+ Add Expense</button>
        </div>

        {form === "expense" && (
          <div className="bg-gray-900 rounded-lg p-5 mb-4 space-y-3">
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
              <button onClick={addExpense} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-gray-600 text-sm bg-gray-900 rounded-lg p-8 text-center">No expenses yet.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 group hover:border-gray-700 transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{e.category}</p>
                  {e.notes && <p className="text-xs text-gray-500">{e.notes}</p>}
                </div>
                                <p className="text-lg font-bold text-red-400">
                  {fmt(e.amount, e.currency)}
                  <span className="text-xs text-gray-500 ml-1">{freqLabel(e.frequency)}</span>
                </p>
                <button onClick={() => deleteItem("expense", e.id)}
                  className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ LIABILITIES ═══ */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Liabilities</h2>
          <button onClick={() => setForm(form === "liability" ? null : "liability")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">+ Add Liability</button>
        </div>

        {form === "liability" && (
          <div className="bg-gray-900 rounded-lg p-5 mb-4 space-y-3">
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
                <span className="text-xs text-gray-500">Due day:</span>
                <input type="number" min="1" max="31" value={liabilityForm.due_day}
                  onChange={(e) => setLiabilityForm({...liabilityForm, due_day: e.target.value })}
                  className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <select value={liabilityForm.category} onChange={(e) => setLiabilityForm({...liabilityForm, category: e.target.value })} className={selectClass}>
                <option value="credit_card">Credit Card</option><option value="subscription">Subscription</option>
                <option value="insurance">Insurance</option><option value="loan">Loan</option><option value="other">Other</option>
              </select>
              <div className="flex-1" />
              <button onClick={addLiability} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">Add</button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {liabilities.length === 0 ? (
          <p className="text-gray-600 text-sm bg-gray-900 rounded-lg p-8 text-center">No liabilities yet.</p>
        ) : (
          <div className="space-y-2">
            {liabilities.map((l) => {
              const days = daysUntil(l.due_day);
              return (
                <div key={l.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 group hover:border-gray-700 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{l.name}</p>
                    <p className="text-xs text-gray-500">
                      {l.category.replace(/_/g, " ")}
                      {l.notes ? ` · ${l.notes}` : ""}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                    days <= 3 ? "bg-red-500/20 text-red-400" : days <= 7 ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-400"
                  }`}>
                    {days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `${days} days`}
                  </div>
                  <p className="text-lg font-bold text-orange-400">
                    {fmt(l.amount, l.currency)}
                    <span className="text-xs text-gray-500 ml-1">{freqLabel(l.frequency)}</span>
                  </p>
                  <button onClick={() => deleteItem("liability", l.id)}
                    className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}