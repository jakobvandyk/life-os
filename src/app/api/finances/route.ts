import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "daily": return amount * 30;
    case "weekly": return Math.round(amount * 52 / 12);
    case "fortnightly": return Math.round(amount * 26 / 12);
    case "monthly": return amount;
    case "quarterly": return Math.round(amount / 3);
    case "annual": return Math.round(amount / 12);
    default: return amount;
  }
}

function toAud(
  amount: number,
  currency: string,
  rates: Record<string, number>
): number {
  if (currency === "AUD") return amount;
  if (currency === "NZD") return Math.round(amount * (rates["NZDAUD"] || 0.8366));
  if (currency === "USD") return Math.round(amount / (rates["AUDUSD"] || 0.7082));
  return amount;
}

export function GET() {
  const db = getDb();

  // Exchange rates
  const rateRows = db.prepare("SELECT pair, rate FROM finance_exchange_rates").all() as { pair: string; rate: number }[];
  const rates: Record<string, number> = {};
  rateRows.forEach((r) => {
    rates[r.pair] = r.rate;
  });

  // Accounts
  const accounts = db.prepare("SELECT * FROM finance_accounts ORDER BY liquidity_tier, name").all() as Record<string, unknown>[];

  // Compute asset totals
  let totalAssetsAud = 0;
  let liquidAssetsAud = 0;
  let totalLiabilitiesAud = 0;

  accounts.forEach((a) => {
    const balAud = toAud(a.balance as number, a.currency as string, rates);
    if (a.account_type === "credit") {
      totalLiabilitiesAud += Math.abs(balAud);
    } else {
      totalAssetsAud += balAud;
      if (a.liquidity_tier === "immediate" || a.liquidity_tier === "short_term") {
        liquidAssetsAud += balAud;
      }
    }
  });

  const netWorthAud = totalAssetsAud - totalLiabilitiesAud;

  // Income
  const incomeRows = db.prepare("SELECT * FROM finance_income ORDER BY is_passive DESC, amount DESC").all() as Record<string, unknown>[];

  let monthlyIncomeAud = 0;
  let monthlyPassiveAud = 0;
  incomeRows.forEach((i) => {
    const monthlyAud = toAud(
      toMonthly(i.amount as number, i.frequency as string),
      i.currency as string,
      rates
    );
    monthlyIncomeAud += monthlyAud;
    if (i.is_passive) monthlyPassiveAud += monthlyAud;
  });

  // Expenses
  const expenseRows = db.prepare("SELECT * FROM finance_expenses ORDER BY amount DESC").all() as Record<string, unknown>[];

  let monthlyExpensesAud = 0;
  expenseRows.forEach((e) => {
    monthlyExpensesAud += toAud(
      toMonthly(e.amount as number, e.frequency as string),
      e.currency as string,
      rates
    );
  });

  // Liabilities (recurring costs added to expenses)
  const liabilityRows = db.prepare("SELECT * FROM finance_liabilities ORDER BY due_day").all() as Record<string, unknown>[];

  liabilityRows.forEach((l) => {
    monthlyExpensesAud += toAud(
      toMonthly(l.amount as number, l.frequency as string),
      l.currency as string,
      rates
    );
  });

  // Derived metrics
  const monthlySurplusAud = monthlyIncomeAud - monthlyExpensesAud;
  const savingsRate =
    monthlyIncomeAud > 0 ? (monthlySurplusAud / monthlyIncomeAud) * 100 : 0;
  const runwayMonths =
    monthlyExpensesAud > 0 ? liquidAssetsAud / monthlyExpensesAud : 999;

  // Tax flags (unresolved only)
  const taxFlags = db.prepare(
      `SELECT * FROM finance_tax_flags WHERE resolved_at IS NULL
       ORDER BY CASE priority
         WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
         WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`
    ).all();

  // Snapshots for chart
  const snapshots = db.prepare(
      "SELECT date, net_worth_aud FROM finance_snapshots ORDER BY date DESC LIMIT 12"
    ).all();

  // Record today's snapshot idempotently
  const today = new Date().toISOString().split("T")[0];
  const existingSnap = db.prepare("SELECT id FROM finance_snapshots WHERE date = ?").get(today);
  if (!existingSnap) {
    db.prepare(
      `INSERT INTO finance_snapshots
         (date, net_worth_aud, liquid_assets_aud, monthly_income_aud, monthly_expenses_aud, savings_rate_pct)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(today, netWorthAud, liquidAssetsAud, monthlyIncomeAud, monthlyExpensesAud, savingsRate);
  }

  return NextResponse.json({
    accounts,
    income: incomeRows,
    expenses: expenseRows,
    liabilities: liabilityRows,
    taxFlags,
    snapshots: (snapshots as Record<string, unknown>[]).reverse(),
    rates,
    metrics: {
      netWorthAud,
      liquidAssetsAud,
      totalLiabilitiesAud,
      monthlyIncomeAud,
      monthlyExpensesAud,
      monthlySurplusAud,
      monthlyPassiveAud,
      savingsRate,
      runwayMonths,
    },
  });
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { table, data: d } = body;

  if (table === "account") {
    const r = db.prepare(
      `INSERT INTO finance_accounts
         (name, institution, currency, liquidity_tier, tax_advantaged, asset_class, account_type, balance, interest_rate_pa, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      d.name, d.institution || "", d.currency || "AUD",
      d.liquidity_tier || "immediate", d.tax_advantaged ? 1 : 0,
      d.asset_class || "cash_equivalents", d.account_type || "savings",
      d.balance || 0, d.interest_rate_pa || null, d.notes || ""
    );
    return NextResponse.json(
      db.prepare("SELECT * FROM finance_accounts WHERE id = ?").get(r.lastInsertRowid),
      { status: 201 }
    );
  }

  if (table === "income") {
    const r = db.prepare(
      `INSERT INTO finance_income (name, amount, currency, frequency, is_passive, linked_account_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      d.name, d.amount, d.currency || "AUD", d.frequency || "monthly",
      d.is_passive ? 1 : 0, d.linked_account_id || null, d.notes || ""
    );
    return NextResponse.json(
      db.prepare("SELECT * FROM finance_income WHERE id = ?").get(r.lastInsertRowid),
      { status: 201 }
    );
  }

  if (table === "expense") {
    const r = db.prepare(
      `INSERT INTO finance_expenses (category, amount, currency, frequency, is_variable, variable_min, variable_max, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      d.category, d.amount, d.currency || "AUD", d.frequency || "monthly",
      d.is_variable ? 1 : 0, d.variable_min || null, d.variable_max || null, d.notes || ""
    );
    return NextResponse.json(
      db.prepare("SELECT * FROM finance_expenses WHERE id = ?").get(r.lastInsertRowid),
      { status: 201 }
    );
  }

  if (table === "liability") {
    const r = db.prepare(
      `INSERT INTO finance_liabilities (name, amount, currency, frequency, due_day, category, linked_account_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      d.name, d.amount, d.currency || "AUD", d.frequency || "monthly",
      d.due_day || 1, d.category || "other", d.linked_account_id || null, d.notes || ""
    );
    return NextResponse.json(
      db.prepare("SELECT * FROM finance_liabilities WHERE id = ?").get(r.lastInsertRowid),
      { status: 201 }
    );
  }

  if (table === "tax_flag") {
    const r = db.prepare(
      `INSERT INTO finance_tax_flags (title, jurisdiction, priority, notes)
       VALUES (?, ?, ?, ?)`
    ).run(d.title, d.jurisdiction || "AU", d.priority || "medium", d.notes || "");
    return NextResponse.json(
      db.prepare("SELECT * FROM finance_tax_flags WHERE id = ?").get(r.lastInsertRowid),
      { status: 201 }
    );
  }

  if (table === "exchange_rate") {
    db.prepare(
      `INSERT OR REPLACE INTO finance_exchange_rates (pair, rate, updated_at)
       VALUES (?, ?, datetime('now'))`
    ).run(d.pair, d.rate);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown table" }, { status: 400 });
}