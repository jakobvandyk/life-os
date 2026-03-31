"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Account {
  id: number;
  name: string;
  institution: string;
  currency: string;
  liquidity_tier: string;
  tax_advantaged: number;
  asset_class: string;
  account_type: string;
  balance: number;
  interest_rate_pa: number | null;
  notes: string;
  user_id: string;
}

const CUR: Record<string, string> = { AUD: "A$", NZD: "NZ$", USD: "US$" };

function fmt(cents: number, c = "AUD") {
  const s = CUR[c] || "$";
  return `${cents < 0 ? "-" : ""}${s}${(Math.abs(cents) / 100).toLocaleString(
    "en-AU",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  )}`;
}

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500";
const selectClass =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500";

const TIERS = [
  { key: "immediate", label: "💧 Immediate", order: 0 },
  { key: "short_term", label: "📊 Short Term", order: 1 },
  { key: "illiquid", label: "🔒 Illiquid", order: 2 },
];

export default function AccountsTab({
  accounts,
  onRefresh,
  userId,
}: {
  accounts: Account[];
  onRefresh: () => void;
  userId: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editBal, setEditBal] = useState<number | null>(null);
  const [balVal, setBalVal] = useState("");
  const [form, setForm] = useState({
    name: "",
    institution: "",
    currency: "AUD",
    liquidity_tier: "immediate",
    asset_class: "cash_equivalents",
    account_type: "savings",
    balance: "",
    interest_rate_pa: "",
    notes: "",
    tax_advantaged: false,
  });

  const addAccount = async () => {
    if (!userId) return;
    if (!form.name.trim()) return;
    const { error } = await supabase.from("finance_accounts").insert({
      ...form,
      balance: form.balance ? Math.round(parseFloat(form.balance) * 100) : 0,
      interest_rate_pa: form.interest_rate_pa
        ? parseFloat(form.interest_rate_pa) / 100
        : null,
      user_id: userId,
    });
    if (error) console.error("Error adding account:", error);
    setForm({
      name: "", institution: "", currency: "AUD", liquidity_tier: "immediate",
      asset_class: "cash_equivalents", account_type: "savings", balance: "",
      interest_rate_pa: "", notes: "", tax_advantaged: false,
    });
    setShowForm(false);
    onRefresh();
  };

  const saveBal = async (id: number) => {
    if (!userId) return;
    const cents = Math.round(parseFloat(balVal) * 100);
    if (isNaN(cents)) return;
    const { error } = await supabase
      .from("finance_accounts")
      .update({ balance: cents })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) console.error("Error saving balance:", error);
    setEditBal(null);
    onRefresh();
  };

  const deleteAccount = async (id: number) => {
    if (!userId) return;
    const { error } = await supabase.from("finance_accounts").delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("Error deleting account:", error);
    onRefresh();
  };

  const nonCredit = accounts.filter((a) => a.account_type !== "credit");
  const creditAccounts = accounts.filter((a) => a.account_type === "credit");

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Accounts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Account
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-lg p-5 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Account name"
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value })}
              className={inputClass}
              autoFocus
            />
            <input
              type="text"
              placeholder="Institution (e.g. BOQ, BNZ)"
              value={form.institution}
              onChange={(e) => setForm({...form, institution: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <select
              value={form.currency}
              onChange={(e) => setForm({...form, currency: e.target.value })}
              className={selectClass}
            >
              <option value="AUD">AUD</option>
              <option value="NZD">NZD</option>
              <option value="USD">USD</option>
            </select>
            <select
              value={form.liquidity_tier}
              onChange={(e) => setForm({...form, liquidity_tier: e.target.value })}
              className={selectClass}
            >
              <option value="immediate">Immediate</option>
              <option value="short_term">Short Term</option>
              <option value="illiquid">Illiquid</option>
            </select>
            <select
              value={form.asset_class}
              onChange={(e) => setForm({...form, asset_class: e.target.value })}
              className={selectClass}
            >
              <option value="cash_equivalents">Cash</option>
              <option value="equities">Equities</option>
              <option value="crypto">Crypto</option>
              <option value="bonds">Bonds</option>
              <option value="reits">REITs</option>
              <option value="commodities">Commodities</option>
              <option value="other">Other</option>
            </select>
            <select
              value={form.account_type}
              onChange={(e) => setForm({...form, account_type: e.target.value })}
              className={selectClass}
            >
              <option value="savings">Savings</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
              <option value="super">Super</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              step="0.01"
              placeholder="Balance (e.g. 13800.50)"
              value={form.balance}
              onChange={(e) => setForm({...form, balance: e.target.value })}
              className={inputClass}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Interest rate % (e.g. 5.10)"
              value={form.interest_rate_pa}
              onChange={(e) => setForm({...form, interest_rate_pa: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({...form, notes: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={form.tax_advantaged}
                onChange={(e) => setForm({...form, tax_advantaged: e.target.checked })}
                className="rounded bg-gray-800 border-gray-700"
              />
              Tax advantaged
            </label>
            <div className="flex-1" />
            <button onClick={addAccount} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
              Add Account
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="bg-gray-900 rounded-lg p-12 text-center">
          <p className="text-gray-500">No accounts yet. Add your first one!</p>
        </div>
      )}

      {/* Accounts by Tier */}
      {TIERS.map(({ key, label }) => {
        const tierAccounts = nonCredit.filter((a) => a.liquidity_tier === key);
        if (tierAccounts.length === 0) return null;
        return (
          <div key={key} className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
              {label}
            </h3>
            <div className="space-y-2">
              {tierAccounts.map((a) => (
                <div
                  key={a.id}
                  className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 group hover:border-gray-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.institution} · {a.asset_class.replace(/_/g, " ")}
                      {a.tax_advantaged ? " · 🛡️ Tax advantaged" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {editBal === a.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.01"
                          value={balVal}
                          onChange={(e) => setBalVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveBal(a.id)}
                          className="w-32 bg-gray-800 border border-amber-500 rounded px-2 py-1 text-white text-sm text-right"
                          autoFocus
                        />
                        <button onClick={() => saveBal(a.id)} className="text-green-400 text-xs">✓</button>
                        <button onClick={() => setEditBal(null)} className="text-gray-500 text-xs">✕</button>
                      </div>
                    ) : (
                      <p
                        className="text-lg font-bold text-white font-mono cursor-pointer hover:text-amber-400 transition-colors"
                        onClick={() => { setEditBal(a.id); setBalVal((a.balance / 100).toFixed(2)); }}
                      >
                        {fmt(a.balance, a.currency)}
                      </p>
                    )}
                    {a.interest_rate_pa && (
                      <p className="text-xs text-green-400">
                        {(a.interest_rate_pa * 100).toFixed(2)}% p.a.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteAccount(a.id)}
                    className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Credit Accounts */}
      {creditAccounts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
            💳 Credit / Liabilities
          </h3>
          <div className="space-y-2">
            {creditAccounts.map((a) => (
              <div
                key={a.id}
                className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 group hover:border-gray-700 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.institution}</p>
                </div>
                <p className="text-lg font-bold text-red-400">
                  {fmt(a.balance, a.currency)}
                </p>
                <button
                  onClick={() => deleteAccount(a.id)}
                  className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}