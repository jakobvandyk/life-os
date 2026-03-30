"use client";

import { useEffect, useState } from "react";
import MetricCards from "./components/MetricCards";
import AccountsTab from "./components/AccountsTab";
import CashflowTab from "./components/CashflowTab";
import TaxFlagsTab from "./components/TaxFlagsTab";

interface FinanceData {
  accounts: Account[];
  income: Income[];
  expenses: Expense[];
  liabilities: Liability[];
  taxFlags: TaxFlag[];
  snapshots: { date: string; net_worth_aud: number }[];
  rates: Record<string, number>;
  metrics: Metrics;
}

interface Account {
  id: number; name: string; institution: string; currency: string;
  liquidity_tier: string; tax_advantaged: number; asset_class: string;
  account_type: string; balance: number; interest_rate_pa: number | null; notes: string;
}
interface Income {
  id: number; name: string; amount: number; currency: string;
  frequency: string; is_passive: number; notes: string;
}
interface Expense {
  id: number; category: string; amount: number; currency: string;
  frequency: string; is_variable: number; notes: string;
}
interface Liability {
  id: number; name: string; amount: number; currency: string;
  frequency: string; due_day: number; category: string; notes: string;
}
interface TaxFlag {
  id: number; title: string; jurisdiction: string; priority: string; notes: string;
}
interface Metrics {
  netWorthAud: number; liquidAssetsAud: number; totalLiabilitiesAud: number;
  monthlyIncomeAud: number; monthlyExpensesAud: number; monthlySurplusAud: number;
  monthlyPassiveAud: number; savingsRate: number; runwayMonths: number;
}

type Tab = "accounts" | "cashflow" | "tax";

export default function FinancesPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<Tab>("accounts");

  const fetchData = () => {
    fetch("/api/finances").then((r) => r.json()).then(setData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">💰 Finances</h1>
        <p className="text-gray-500 mt-1">
          Wealth building · Base currency: AUD
        </p>
      </div>

      {/* Metric Cards */}
      <MetricCards metrics={data.metrics} />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "accounts", label: "Accounts" },
          { key: "cashflow", label: "Cashflow" },
          { key: "tax", label: "Tax & Flags" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "accounts" && (
        <AccountsTab accounts={data.accounts} onRefresh={fetchData} />
      )}

      {tab === "cashflow" && (
        <CashflowTab
          income={data.income}
          expenses={data.expenses}
          liabilities={data.liabilities}
          metrics={{
            monthlyIncomeAud: data.metrics.monthlyIncomeAud,
            monthlyExpensesAud: data.metrics.monthlyExpensesAud,
            monthlySurplusAud: data.metrics.monthlySurplusAud,
            savingsRate: data.metrics.savingsRate,
          }}
          onRefresh={fetchData}
        />
      )}

      {tab === "tax" && (
        <TaxFlagsTab taxFlags={data.taxFlags} onRefresh={fetchData} />
      )}
    </div>
  );
}