"use client";

import { useEffect, useState } from "react";
import MetricCards from "./components/MetricCards";
import AccountsTab from "./components/AccountsTab";
import CashflowTab from "./components/CashflowTab";
import TaxFlagsTab from "./components/TaxFlagsTab";
import { supabase } from "@/lib/supabase";

interface Account {
  id: number; name: string; institution: string; currency: string;
  liquidity_tier: string; tax_advantaged: number; asset_class: string;
  account_type: string; balance: number; interest_rate_pa: number | null; notes: string; user_id: string;
}
interface Income {
  id: number; name: string; amount: number; currency: string;
  frequency: string; is_passive: number; notes: string; user_id: string;
}
interface Expense {
  id: number; category: string; amount: number; currency: string;
  frequency: string; is_variable: number; notes: string; user_id: string;
}
interface Liability {
  id: number; name: string; amount: number; currency: string;
  frequency: string; due_day: number; category: string; notes: string; user_id: string;
}
interface TaxFlag {
  id: number; title: string; jurisdiction: string; priority: string; notes: string; user_id: string;
}
interface ExchangeRate {
  id: number; pair: string; rate: number;
}
interface FinanceData {
  accounts: Account[];
  income: Income[];
  expenses: Expense[];
  liabilities: Liability[];
  taxFlags: TaxFlag[];
  rates: ExchangeRate[];
  // snapshots: { date: string; net_worth_aud: number }[]; // Not used in current component
  metrics: Metrics;
}

interface Metrics {
  netWorthAud: number;
  liquidAssetsAud: number;
  totalLiabilitiesAud: number;
  monthlyIncomeAud: number;
  monthlyExpensesAud: number;
  monthlySurplusAud: number;
  monthlyPassiveAud: number;
  savingsRate: number;
  runwayMonths: number;
}

const FREQUENCY_TO_MONTHLY_FACTOR: Record<string, number> = {
  daily: 30,
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

const convertCurrency = (amount: number, currency: string, rates: ExchangeRate[]) => {
  if (currency === "NZD") return amount;
  const rate = rates.find(r => r.pair === `NZD/${currency}`)?.rate;
  if (rate) return amount / rate; // Convert to NZD
  return amount; // Fallback
};

const calculateMetrics = (accounts: Account[], income: Income[], expenses: Expense[], liabilities: Liability[], rates: ExchangeRate[]): Metrics => {
  let netWorthAud = 0;
  let liquidAssetsAud = 0;
  let totalLiabilitiesAud = 0;
  let monthlyIncomeAud = 0;
  let monthlyExpensesAud = 0;
  let monthlyPassiveAud = 0;

  accounts.forEach(acc => {
    const balanceInNzd = convertCurrency(acc.balance, acc.currency, rates);
    netWorthAud += balanceInNzd;
    if (acc.liquidity_tier === "immediate" || acc.liquidity_tier === "short_term") {
      liquidAssetsAud += balanceInNzd;
    }
    if (acc.account_type === "credit") {
      totalLiabilitiesAud -= balanceInNzd; // Credit accounts are liabilities
    }
  });

  liabilities.forEach(lia => {
    totalLiabilitiesAud += convertCurrency(lia.amount, lia.currency, rates);
  });

  income.forEach(inc => {
    const monthlyAmount = convertCurrency(inc.amount, inc.currency, rates) * (FREQUENCY_TO_MONTHLY_FACTOR[inc.frequency] || 0);
    monthlyIncomeAud += monthlyAmount;
    if (inc.is_passive) {
      monthlyPassiveAud += monthlyAmount;
    }
  });

  expenses.forEach(exp => {
    monthlyExpensesAud += convertCurrency(exp.amount, exp.currency, rates) * (FREQUENCY_TO_MONTHLY_FACTOR[exp.frequency] || 0);
  });

  const monthlySurplusAud = monthlyIncomeAud - monthlyExpensesAud;
  const savingsRate = monthlyIncomeAud > 0 ? (monthlySurplusAud / monthlyIncomeAud) * 100 : 0;
  const runwayMonths = monthlyExpensesAud > 0 ? liquidAssetsAud / monthlyExpensesAud : Infinity;

  return {
    netWorthAud,
    liquidAssetsAud,
    totalLiabilitiesAud,
    monthlyIncomeAud,
    monthlyExpensesAud,
    monthlySurplusAud,
    monthlyPassiveAud,
    savingsRate,
    runwayMonths,
  };
};

type Tab = "accounts" | "cashflow" | "tax";

export default function FinancesPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<Tab>("accounts");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const convertCurrency = (amount: number, currency: string, rates: ExchangeRate[]) => {
    if (currency === "NZD") return amount;
    const rate = rates.find(r => r.pair === `NZD/${currency}`)?.rate;
    if (rate) return amount / rate; // Convert to NZD
    return amount; // Fallback
  };

  const calculateMetrics = (accounts: Account[], income: Income[], expenses: Expense[], liabilities: Liability[], rates: ExchangeRate[]): Metrics => {
    let netWorthAud = 0;
    let liquidAssetsAud = 0;
    let totalLiabilitiesAud = 0;
    let monthlyIncomeAud = 0;
    let monthlyExpensesAud = 0;
    let monthlyPassiveAud = 0;

    accounts.forEach(acc => {
      const balanceInNzd = convertCurrency(acc.balance, acc.currency, rates);
      netWorthAud += balanceInNzd;
      if (acc.liquidity_tier === "immediate" || acc.liquidity_tier === "short_term") {
        liquidAssetsAud += balanceInNzd;
      }
      if (acc.account_type === "credit") {
        totalLiabilitiesAud -= balanceInNzd; // Credit accounts are liabilities
      }
    });

    liabilities.forEach(lia => {
      totalLiabilitiesAud += convertCurrency(lia.amount, lia.currency, rates);
    });

    income.forEach(inc => {
      const monthlyAmount = convertCurrency(inc.amount, inc.currency, rates) * (FREQUENCY_TO_MONTHLY_FACTOR[inc.frequency] || 0);
      monthlyIncomeAud += monthlyAmount;
      if (inc.is_passive) {
        monthlyPassiveAud += monthlyAmount;
      }
    });

    expenses.forEach(exp => {
      monthlyExpensesAud += convertCurrency(exp.amount, exp.currency, rates) * (FREQUENCY_TO_MONTHLY_FACTOR[exp.frequency] || 0);
    });

    const monthlySurplusAud = monthlyIncomeAud - monthlyExpensesAud;
    const savingsRate = monthlyIncomeAud > 0 ? (monthlySurplusAud / monthlyIncomeAud) * 100 : 0;
    const runwayMonths = monthlyExpensesAud > 0 ? liquidAssetsAud / monthlyExpensesAud : Infinity;

    return {
      netWorthAud,
      liquidAssetsAud,
      totalLiabilitiesAud,
      monthlyIncomeAud,
      monthlyExpensesAud,
      monthlySurplusAud,
      monthlyPassiveAud,
      savingsRate,
      runwayMonths,
    };
  };

  const fetchData = async () => {
    if (!userId) return;

    const [{ data: accountsData }, { data: incomeData }, { data: expensesData }, { data: liabilitiesData }, { data: taxFlagsData }, { data: ratesData }] = await Promise.all([
      supabase.from("finance_accounts").select("*").eq("user_id", userId),
      supabase.from("finance_income").select("*").eq("user_id", userId),
      supabase.from("finance_expenses").select("*").eq("user_id", userId),
      supabase.from("finance_liabilities").select("*").eq("user_id", userId),
      supabase.from("finance_tax_flags").select("*").eq("user_id", userId),
      supabase.from("finance_exchange_rates").select("*"),
    ]);

    const accounts = accountsData || [];
    const income = incomeData || [];
    const expenses = expensesData || [];
    const liabilities = liabilitiesData || [];
    const taxFlags = taxFlagsData || [];
    const rates = ratesData || [];

    const metrics = calculateMetrics(accounts, income, expenses, liabilities, rates);

    setData({
      accounts,
      income,
      expenses,
      liabilities,
      taxFlags,
      rates,
      metrics,
    });
  };

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
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
                ? "bg-amber-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "accounts" && (
        <AccountsTab accounts={data.accounts} onRefresh={fetchData} userId={userId} />
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
          userId={userId}
        />
      )}

      {tab === "tax" && (
        <TaxFlagsTab taxFlags={data.taxFlags} onRefresh={fetchData} userId={userId} />
      )}
    </div>
  );
}