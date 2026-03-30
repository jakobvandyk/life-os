import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "life-os.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    -- ═══════════════════════════════════════════
    -- EXISTING TABLES
    -- ═══════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      project_id INTEGER,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('urgent', 'high', 'medium', 'low')),
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '✅',
      target_frequency TEXT DEFAULT 'daily' CHECK(target_frequency IN ('daily', 'weekdays', 'weekly')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 1,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(habit_id, date)
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      mood INTEGER CHECK(mood BETWEEN 1 AND 5),
      energy INTEGER CHECK(energy BETWEEN 1 AND 5),
      gratitude TEXT DEFAULT '',
      reflection TEXT DEFAULT '',
      wins TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      timeframe TEXT DEFAULT 'quarterly',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS key_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      target REAL NOT NULL,
      current REAL DEFAULT 0,
      unit TEXT DEFAULT '',
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );

    -- ═══════════════════════════════════════════
    -- FINANCE TABLES
    -- ═══════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS finance_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      institution TEXT DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('AUD', 'NZD', 'USD')),
      liquidity_tier TEXT DEFAULT 'immediate' CHECK(liquidity_tier IN ('immediate', 'short_term', 'illiquid')),
      tax_advantaged INTEGER DEFAULT 0,
      asset_class TEXT DEFAULT 'cash_equivalents' CHECK(asset_class IN (
        'cash_equivalents', 'equities', 'crypto', 'bonds', 'reits', 'commodities', 'other'
      )),
      account_type TEXT DEFAULT 'savings' CHECK(account_type IN (
        'savings', 'investment', 'cash', 'super', 'credit'
      )),
      balance INTEGER DEFAULT 0,
      interest_rate_pa REAL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('AUD', 'NZD', 'USD')),
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN (
        'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'
      )),
      is_passive INTEGER DEFAULT 0,
      linked_account_id INTEGER,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (linked_account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS finance_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('AUD', 'NZD', 'USD')),
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN (
        'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'
      )),
      is_variable INTEGER DEFAULT 0,
      variable_min INTEGER,
      variable_max INTEGER,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_liabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('AUD', 'NZD', 'USD')),
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN (
        'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'
      )),
      due_day INTEGER CHECK(due_day BETWEEN 1 AND 31),
      category TEXT DEFAULT 'other' CHECK(category IN (
        'subscription', 'insurance', 'loan', 'credit_card', 'other'
      )),
      linked_account_id INTEGER,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (linked_account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS finance_tax_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      jurisdiction TEXT DEFAULT 'AU' CHECK(jurisdiction IN ('AU', 'NZ', 'US', 'multi')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('urgent', 'high', 'medium', 'low')),
      notes TEXT DEFAULT '',
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      net_worth_aud INTEGER NOT NULL,
      liquid_assets_aud INTEGER DEFAULT 0,
      monthly_income_aud INTEGER DEFAULT 0,
      monthly_expenses_aud INTEGER DEFAULT 0,
      savings_rate_pct REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL UNIQUE,
      rate REAL NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════
    -- INDEXES
    -- ═══════════════════════════════════════════

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_fin_accounts_type ON finance_accounts(account_type);
    CREATE INDEX IF NOT EXISTS idx_fin_accounts_tier ON finance_accounts(liquidity_tier);
    CREATE INDEX IF NOT EXISTS idx_fin_snapshots_date ON finance_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_fin_tax_flags_priority ON finance_tax_flags(priority);
    CREATE INDEX IF NOT EXISTS idx_fin_income_passive ON finance_income(is_passive);
    CREATE INDEX IF NOT EXISTS idx_fin_liabilities_due ON finance_liabilities(due_day);
  `);

  // Seed default exchange rates if table is empty
  const rateCount = db.prepare("SELECT COUNT(*) as count FROM finance_exchange_rates").get() as { count: number };
  if (rateCount.count === 0) {
    const seedRates = db.prepare(
      "INSERT INTO finance_exchange_rates (pair, rate) VALUES (?, ?)"
    );
    seedRates.run("NZDAUD", 0.8366);
    seedRates.run("AUDUSD", 0.7082);
    seedRates.run("NZDUSD", 0.5926);
  }
}